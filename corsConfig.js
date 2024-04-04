module.exports = function (app, FRONTEND_URL) {
	// CORS Middleware
	app.use((req, res, next) => {
		res.header('Access-Control-Allow-Origin', FRONTEND_URL);
		res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.header('Access-Control-Allow-Credentials', 'true');
		next();
	});

	// CORS Options
	app.options('*', (req, res) => {
		res.header('Access-Control-Allow-Origin', FRONTEND_URL);
		res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.header('Access-Control-Allow-Credentials', 'true');
		res.sendStatus(200);
	});

};
