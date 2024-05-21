// A row-level Mixpanel proxy server which receives data from Mixpanel's JS Lib.
// by ak@mixpanel.com

// DEPENDENCIES
const express = require('express');
const app = express();
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const fetch = require('fetch-retry')(global.fetch);
const setupCORS = require('./components/corsConfig');
const { parseSDKData } = require('./components/parser');
const { version } = require('./package.json');

// ENV
require('dotenv').config();
const PORT = process.env.PORT || 8080;
const REGION = process.env.REGION || 'US';
let RUNTIME = process.env.RUNTIME || 'unknown';
if (process.env.NODE_ENV) RUNTIME = process.env.NODE_ENV; // more common
let FRONTEND_URL = process.env.FRONTEND_URL || "";
let MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN || "";
if (FRONTEND_URL === "none") FRONTEND_URL = "";
if (MIXPANEL_TOKEN === "none") MIXPANEL_TOKEN = "";

// MIDDLEWARE
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: 'text/plain' }));
setupCORS(app, FRONTEND_URL);

// REGION
const BASE_URL = `https://api${REGION?.toUpperCase() === "EU" ? '-eu' : ''}.mixpanel.com`;
if (!MIXPANEL_TOKEN && RUNTIME !== "prod") console.error('MIXPANEL_TOKEN is not set; this is required to run the proxy server. Please set it as an environment variable.');
const SESSION_RECORDING_URL = `https://api-js.mixpanel.com/record`;


// ROUTES
// https://developer.mixpanel.com/reference/track-event
// https://developer.mixpanel.com/reference/engage
// https://developer.mixpanel.com/reference/groups
app.post('/track', async (req, res) => await handleMixpanelData('track', req, res));
app.post('/engage', async (req, res) => await handleMixpanelData('engage', req, res));
app.post('/groups', async (req, res) => await handleMixpanelData('groups', req, res));
app.all('/', (req, res) => res.status(200).json({ status: "OK" }));
app.all('/ping', (req, res) => res.status(200).json({ status: "OK", message: "pong", version }));
app.all('/decide', (req, res) => res.status(299).send({ error: "the /decide endpoint is deprecated" }));

// PROXIES
app.use('/lib.min.js', createProxyMiddleware({
	target: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
	changeOrigin: true,
	pathRewrite: { '^/lib.min.js': '' },
	logLevel: RUNTIME === "prod" ? "error" : "debug"
}));

app.use('/lib.js', createProxyMiddleware({
	target: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.js',
	changeOrigin: true,
	pathRewrite: { '^/lib.js': '' },
	logLevel: RUNTIME === "prod" ? "error" : "debug"
}));

// session recording
app.use('/record', createProxyMiddleware({
	target: SESSION_RECORDING_URL,
	changeOrigin: true,
	pathRewrite: { '^/record': '' },
	logLevel: RUNTIME === "prod" ? "error" : "debug",
	timeout: 60000, 
	proxyTimeout: 60000
	// onProxyReq: (proxyReq, req, res) => {
	// 	// Log request details for debugging
	// 	console.log(`proxy request to: ${proxyReq.getHeader('host')}${proxyReq.path}`);
	// },
	// onProxyRes: (proxyRes, req, res) => {
	// 	// Log response details for debugging
	// 	console.log(`proxy response from: ${proxyRes.req.getHeader('host')}${proxyRes.req.path}`);
		
	// },
	// onError: (err, req, res) => {
	// 	// Log the error details
	// 	console.error(`Proxy error: ${err.message}`);
	// 	res.status(500).send('Proxy error occurred.');
	// }
}));

// RANDOM ERRORS
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send(`Something went wrong!\n\n${err?.message || err}`);
});


// START
const server = app.listen(PORT, () => {
	if (RUNTIME === 'dev') console.log(`proxy alive on ${PORT}`);
});



/**
 * this function handles the incoming data from the Mixpanel JS lib via .track() .people.set() and .group.set()
 * @param  {'track' | 'engage' | 'groups'} type
 * @param  {import('express').Request} req
 * @param  {import('express').Response} res
 */
async function handleMixpanelData(type, req, res) {
	if (!type) return res.status(400).send('No type provided');
	if (!req.body) return res.status(400).send('No data provided');

	const data = parseSDKData(req.body?.data || req.body);
	const endUserIp = req.headers['x-forwarded-for'] || req?.socket?.remoteAddress || req?.connection?.remoteAddress;

	// mutate the data
	data.forEach(record => {

		// include token
		if (MIXPANEL_TOKEN) {
			if (type === 'track') record.properties.token = MIXPANEL_TOKEN;
			if (type === 'engage') record.$token = MIXPANEL_TOKEN;
			if (type === 'groups') record.$token = MIXPANEL_TOKEN;
		}

		// include the IP address for geo-location
		if (req.query.ip === '1') {
			if (type === 'track') record.properties.ip = endUserIp;
			if (type === 'engage') record.$ip = endUserIp;
			if (type === 'groups') record.$ip = endUserIp;
		}
	});

	const endpointUrl = `${BASE_URL}/${type}?verbose=1`;

	try {
		const flushData = await makeRequest(endpointUrl, data);
		res.send(flushData);
	}

	catch (error) {
		if (RUNTIME === 'dev') console.error(error);
		res.status(500).send(`An error occurred calling /${type}`);
	}
}

/**
 * sends a POST request to the given URL with the given data
 * @param  {string} url
 * @param  {Object[]} data
 */
async function makeRequest(url, data) {
	if (RUNTIME === 'dev') console.log(`\nrequest to ${shortUrl(url)} with data:\n${pp(data)} ${sep()}`);

	const request = await fetch(url, {
		method: 'POST',
		body: JSON.stringify(data),
		headers: {
			'Content-Type': 'application/json'
		},
	});

	const { status = 0, statusText = "" } = request;
	const response = await request.json();

	if (RUNTIME === 'dev') console.log(`got ${status} ${statusText} from ${shortUrl(url)}:\n${pp(response)} ${sep()}`);

	return response;
}

// helpers
function pp(obj) {
	return JSON.stringify(obj, null, 2);
}

function sep() {
	return `\n--------\n`;
}

function shortUrl(url) {
	return new URL(url).pathname;
}

module.exports = {
	parseSDKData,
	makeRequest,
	handleMixpanelData,
	server
};