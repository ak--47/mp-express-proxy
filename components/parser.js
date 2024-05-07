/**
 * parses the incoming data from the SDK
 * @param  {unknown} reqBody
 * @returns {Object[]}
 */
function parseSDKData(reqBody) {
	try {
		let data;

		// handling JSON
		if (typeof reqBody === 'string') {
			if (reqBody.startsWith("[") || reqBody.startsWith("{")) {
				try {
					data = JSON.parse(reqBody);
				}
				catch (e) {
					// probably not JSON
					throw new Error('unable to parse incoming data (tried JSON)');
				}
			}

			// handling multipart form data
			else {
				try {
					data = JSON.parse(Buffer.from(reqBody, 'base64').toString('utf-8'));
				}
				catch (e) {

					// handling sendBeacon
					try {
						const body = reqBody.split("=").splice(-1).pop();
						data = JSON.parse(Buffer.from(decodeURIComponent(body), 'base64').toString('utf-8'));
					}
					catch (e) {
						// we don't know what this is
						throw new Error('unable to parse incoming data (tried base64)');
					}

				}

			}
		}

		if (Array.isArray(data)) return data;
		else if (data) return [data];
		else {
			throw new Error('unable to parse incoming data (unknown format)');
		}
	}
	catch (e) {
		console.error(e);
		console.error('unable to parse incoming data');
		console.error('reqBody:', reqBody);
		return [];
	}
}

module.exports = { parseSDKData };