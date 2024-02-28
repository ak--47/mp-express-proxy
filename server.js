const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 8080;
require('dotenv').config();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));


// CORS Middleware
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || "*");
	res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.header('Access-Control-Allow-Credentials', 'true');
	next();
});

app.options('*', (req, res) => {
	// Set CORS headers here
	res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
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
		const eventData = JSON.parse(req.body.data);
		const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		for (let event of eventData) {
			if (event.properties && event.properties.token) delete event.properties.token;
			if (event.properties) event.properties.ip = ip; 
		}

		const importRequest = await fetch('https://api.mixpanel.com/import?verbose=1', {
			method: 'POST',
			body: JSON.stringify(eventData),
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Basic ' + Buffer.from(process.env.MIXPANEL_TOKEN + ':').toString('base64')
			},
		});

		const importResponse = await importRequest.json();
		res.send(importResponse);

	} catch (error) {
		console.error(error);
		res.status(500).send('An error occurred');
	}
});



app.listen(port, () => {
	console.log(`proxy alive on ${port}`);
});
