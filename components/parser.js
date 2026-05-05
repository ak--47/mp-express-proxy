/**
 * parses the incoming data from the SDK
 * @param  {string | Object | Object[]} reqBody
 * @returns {Object[]}
 */
function parseSDKData(reqBody) {
	if (reqBody === undefined) return [];
	if (reqBody === null) return [];

	try {
		let data;

		if (typeof reqBody === 'string') {
			const trimmed = reqBody.trim();

			if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
				// handling JSON
				try {
					data = JSON.parse(trimmed);
				}
				catch (e) {
					throw new Error('unable to parse incoming data (tried JSON)');
				}
			}

			// handling multipart form data / base64
			else {
				try {
					data = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf-8'));
				}
				catch (e) {
					// handling sendBeacon: data=VALUE
					try {
						const eqIndex = trimmed.indexOf('=');
						if (eqIndex < 0) throw new Error('unable to parse incoming data (no delimiter)');
						const body = trimmed.substring(eqIndex + 1);
						if (!body) throw new Error('unable to parse incoming data (tried sendBeacon)');
						const decoded = decodeURIComponent(body);

						try {
							data = JSON.parse(decoded);
						} catch {
							data = JSON.parse(Buffer.from(decoded, 'base64').toString('utf-8'));
						}
					}
					catch (e) {
						throw new Error('unable to parse incoming data (tried base64)');
					}

				}

			}
		}

		else if (Array.isArray(reqBody)) {
			if (reqBody.length === 0) data = [];
			if (reqBody.length) {
				if (reqBody[0]?.data) {
					if (typeof reqBody[0].data === 'string') {
						data = reqBody.map(r => JSON.parse(r.data));
					}
				}
				else {
					data = reqBody;
				}
			}

			
		}

		else if (!Array.isArray(reqBody) && typeof reqBody === 'object') {
			data = [reqBody];
		}

		else {
			//should never get here
			throw new Error('unable to parse incoming data (unknown format)', reqBody);
		}

		if (!Array.isArray(data)) return [data];
		if (Array.isArray(data)) return data;

		throw new Error('data is not an array (unknown format)', reqBody);

	}
	catch (e) {
		console.error(e);
		console.error('unable to parse incoming data');
		console.error('reqBody:', reqBody);
		return [];
	}
}

module.exports = { parseSDKData };