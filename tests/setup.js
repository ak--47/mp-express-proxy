const { spawn } = require('child_process');

// This function is called once before running the tests to start the test server.
module.exports = async () => {
	console.log('Starting test server...\n\n');
	global.__SERVER__ = spawn('npm', ['run', 'dev']);
	global.__FRONTEND__ = spawn('npm', ['run', 'frontend']);

	// Create a promise that resolves if the server starts successfully.
	const serverStarted = new Promise(resolve => {
		global.__SERVER__.stdout.on('data', data => {
			if (data.toString().includes('proxy alive on 8080')) {
				console.log(data.toString());
				resolve('started');
			}
		});

		// global.__SERVER__.stderr.on('data', data => {
		// 	console.error(`Error: ${data.toString()}`);
		// });
	});

	// Create a timeout promise that resolves after a certain period.
	const timeout = new Promise(resolve => {
		setTimeout(() => {
			resolve('timeout');
		}, 5000); 
	});

	// Wait for either the server to start or the timeout.
	const result = await Promise.race([serverStarted, timeout]);
	if (result === 'timeout') {
		console.log('Timeout reached, assuming the server is already running or stuck starting.');
	}

	// We resolve anyway after the timeout or if the server starts.
};

