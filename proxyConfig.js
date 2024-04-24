const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app, RUNTIME) {

	// Proxies for JS lib
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
		target: 'https://api-js.mixpanel.com/record',
		changeOrigin: true,
		pathRewrite: { '^/record': '' },
		logLevel: RUNTIME === "prod" ? "error" : "debug"
	}));



};
