// This file is used to stop the test server after all tests have been run.
const kill = require('tree-kill');
const { promisify } = require('util');
module.exports = async () => {
	console.log('\n\nStopping test server...\n\n');
	const pid = global.__SERVER__.pid;
	const killAsync = promisify(kill);
	await killAsync(pid)
		.then(() => console.log('Test server stopped.\n\n'))
		.catch(error => console.error('Error stopping test server:', error));

	const frontendPid = global.__FRONTEND__.pid;
	await killAsync(frontendPid)
		.then(() => console.log('Frontend stopped.\n\n'))
		.catch(error => console.error('Error stopping frontend:', error));
		
	console.log('teardown complete.\n');
};
