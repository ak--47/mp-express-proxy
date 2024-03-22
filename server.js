const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const app = express();
const fetch = require('fetch-retry')(global.fetch);
require('dotenv').config();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

// Environment Variables
const port = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN;
const REGION = process.env.REGION || 'US';
const RUNTIME = process.env.RUNTIME || 'prod';

const BASE_URL = `https://api${REGION?.toUpperCase() === "EU" ? '-eu' : ''}.mixpanel.com`;

if (!MIXPANEL_TOKEN) {
	console.error('MIXPANEL_TOKEN is not set; this is required to run the proxy server. Please set it as an environment variable.');
	process.exit(1);
}


// CORS Middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', FRONTEND_URL);
	res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.header('Access-Control-Allow-Credentials', 'true');
	next();
});

app.options('*', (req, res) => {
	// Set CORS headers here
	res.header('Access-Control-Allow-Origin', FRONTEND_URL);
	res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.header('Access-Control-Allow-Credentials', 'true');
	res.sendStatus(200);
});


app.use('/lib.min.js', createProxyMiddleware({
	target: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
	changeOrigin: true,
	pathRewrite: { '^/lib.min.js': '' }
}));

// Proxy for /lib.js
app.use('/lib.js', createProxyMiddleware({
	target: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.js',
	changeOrigin: true,
	pathRewrite: { '^/lib.js': '' }
}));

// Proxy for /decide
app.use('/decide', createProxyMiddleware({
	target: 'https://decide.mixpanel.com/decide',
	changeOrigin: true,
	pathRewrite: { '^/decide': '' }
}));


// custom Handler for /track
app.post('/track', async (req, res) => {
	try {
		if (!req.body.data) return res.status(400).send('No data provided');
		const params = req.query;
		const eventData = parseIncomingData(req.body?.data || req.body);
		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress;
		for (let event of eventData) {
			if (!event.properties) event.properties = {};
			event.properties.token = MIXPANEL_TOKEN;
			if (params.ip === '1') event.properties.ip = ip;
		}

		const flushData = await makeRequest(`${BASE_URL}/track?verbose=1`, eventData);
		res.send(flushData);

	} catch (error) {
		console.error(error);
		res.status(500).send('An error occurred calling /track');
	}
});




// custom Handler for /engage
app.post('/engage', async (req, res) => {
	try {
		if (!req.body.data) return res.status(400).send('No data provided');
		const params = req.query;
		const profileData = parseIncomingData(req.body?.data || req.body);
		const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress;
		for (let update of profileData) {
			update.$token = MIXPANEL_TOKEN;
			if (params.ip === '1') update.$ip = ip;
		}

		const flushData = await makeRequest(`${BASE_URL}/engage?verbose=1`, profileData);
		res.send(flushData);

	} catch (error) {
		console.error(error);
		res.status(500).send('An error occurred calling /engage');
	}
});



app.listen(port, () => {
	if (RUNTIME === 'dev') console.log(`proxy alive on ${port}`);
});


function parseIncomingData(reqBody) {
	try {
		let data;
		if (typeof reqBody === 'string') {
			if (reqBody.startsWith("[") || reqBody.startsWith("{")) {
				try {
					data = JSON.parse(reqBody);
				}
				catch (e) {
					// probably not JSON
				}
			}

			// probably form data
			else {
				try {
					data = JSON.parse(Buffer.from(reqBody, 'base64').toString('utf-8'));
				}
				catch (e) {
					throw new Error('unable to parse incoming data');
				}

			}
		}

		if (Array.isArray(data)) return data;
		else if (data) return [data];
		else {
			throw new Error('unable to parse incoming data');
		}
	}
	catch (e) {
		console.error(e);
		console.error('unable to parse incoming data');
		console.error('reqBody:', reqBody);
		return [];
	}
}


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

function sep(){
	return `\n--------\n`
}

function shortUrl(url) {
	return new URL(url).pathname;
}