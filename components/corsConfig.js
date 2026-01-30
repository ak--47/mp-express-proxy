module.exports = function (app) {
	function varyAppend(res, val) {
		const cur = res.getHeader('Vary');
		res.setHeader('Vary', cur ? `${cur}, ${val}` : val);
	}

	app.use((req, res, next) => {
		const origin = req.headers.origin;
		if (origin) {
			res.header('Access-Control-Allow-Origin', origin); // reflect
			varyAppend(res, 'Origin');
			res.header('Access-Control-Allow-Credentials', 'true'); // SDK uses credentials
		}


		// Prevent CORB by telling browser to trust our Content-Type
		res.header('X-Content-Type-Options', 'nosniff');

		if (req.method === 'OPTIONS') {
			// Echo back exactly what the browser asked to use
			const reqMethod = req.headers['access-control-request-method'] || 'GET,POST,OPTIONS';
			const reqHeaders = req.headers['access-control-request-headers'] || '';
			res.header('Access-Control-Allow-Methods', reqMethod + ',OPTIONS');
			if (reqHeaders) {
				res.header('Access-Control-Allow-Headers', reqHeaders);
				varyAppend(res, 'Access-Control-Request-Headers');
			}
			res.header('Access-Control-Max-Age', '600');
			return res.status(204).end(); // no body
		}

		next();
	});
};
