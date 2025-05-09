// A row-level Mixpanel proxy server which receives data from Mixpanel's JS Lib.
// by ak@mixpanel.com

// DEPENDENCIES
const express = require('express');
const app = express();
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
// @ts-ignore
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
/** @type {'AWS'|'LAMBDA'|'GCP'| 'CLOUD_FUNCTIONS' | 'CLOUD_RUN' | 'AZURE_FUNCTIONS' | 'FUNCTIONS' | 'AZURE' | 'LOCAL' | string} platform */
let PLATFORM = process.env.PLATFORM?.toUpperCase() || 'LOCAL';

// MIDDLEWARE + REGIONS
setupCORS(app, FRONTEND_URL);
const BASE_URL = `https://api${REGION?.toUpperCase() === "EU" ? '-eu' : ''}.mixpanel.com`;
if (!MIXPANEL_TOKEN && RUNTIME !== "prod") console.error('MIXPANEL_TOKEN is not set; this is required to run the proxy server. Please set it as an environment variable.');

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

app.use('/record', createProxyMiddleware({
	target: BASE_URL,
	changeOrigin: true,
	pathRewrite: { '^/record': '/record' },
	logLevel: RUNTIME === "prod" ? "error" : "debug",
}));

app.use('/flags', createProxyMiddleware({
	target: BASE_URL,
	changeOrigin: true,
	pathRewrite: { '^/flags': '/flags' },
	logLevel: RUNTIME === "prod" ? "error" : "debug",
}))

// PARSERS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: 'text/plain' }));

// CATCHING ERRORS
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send(`Something went wrong!\n\n${err?.message || err}`);
});


// ROUTES
app.post('/track', async (req, res) => await handleMixpanelData('track', req, res)); //? https://developer.mixpanel.com/reference/track-event
app.post('/engage', async (req, res) => await handleMixpanelData('engage', req, res)); //? https://developer.mixpanel.com/reference/engage
app.post('/groups', async (req, res) => await handleMixpanelData('groups', req, res)); //? https://developer.mixpanel.com/reference/groups
app.all('/', (req, res) => res.status(200).json({ status: "OK" }));
app.all('/ping', (req, res) => res.status(200).json({ status: "OK", message: "pong", version }));
app.all('/decide', (req, res) => res.status(299).send({ error: "the /decide endpoint is deprecated" }));

// START
if (PLATFORM === 'LAMBDA') PLATFORM = 'AWS';
if (PLATFORM === 'FUNCTIONS') PLATFORM = 'AZURE';
if (PLATFORM === 'CLOUD_FUNCTIONS') PLATFORM = 'GCP';
if (PLATFORM === 'CLOUD_RUN') PLATFORM = 'LOCAL';

switch (PLATFORM) {
	case 'GCP':
		const { http } = require('@google-cloud/functions-framework');
		http('mixpanel_proxy', app);  // Register the Express app as an HTTP function
		module.exports = app;
		break;
	case 'AWS':
		const serverless = require('serverless-http');
		module.exports.handler = serverless(app);
		break;
	case 'AZURE':
		const createHandler = require('azure-function-express').createHandler;
		module.exports = createHandler(app);
		break;
	default:
		app.listen(PORT, () => {
			if (RUNTIME === 'dev') console.log(`proxy alive on ${PORT}`);
		});
		break;

}



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


module.exports.parseSDKData = parseSDKData;
module.exports.makeRequest = makeRequest;
module.exports.handleMixpanelData = handleMixpanelData;
