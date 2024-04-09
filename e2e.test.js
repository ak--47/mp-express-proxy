/* cSpell:disable */
const { parseSDKData } = require('./parser');

describe('DATA', () => {
	test('POST /track (json)', async () => {
		const response = await fetch('http://localhost:8080/track', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `data=%7B%22event%22%3A%20%22look%20no%20token!%22%2C%22properties%22%3A%20%7B%22%24os%22%3A%20%22Mac%20OS%20X%22%2C%22%24browser%22%3A%20%22Chrome%22%2C%22%24current_url%22%3A%20%22http%3A%2F%2Flocalhost%3A3000%2F%22%2C%22%24browser_version%22%3A%20122%2C%22%24screen_height%22%3A%201080%2C%22%24screen_width%22%3A%201920%2C%22mp_lib%22%3A%20%22web%22%2C%22%24lib_version%22%3A%20%222.49.0%22%2C%22%24insert_id%22%3A%20%2233x91hx63q5ntr6q%22%2C%22time%22%3A%20${Date.now()}%2C%22distinct_id%22%3A%20%22%24device%3A18dfa623f8414f-0ac97dcee76b58-1d525637-1fa400-18dfa623f8514f%22%2C%22%24device_id%22%3A%20%2218dfa623f8414f-0ac97dcee76b58-1d525637-1fa400-18dfa623f8514f%22%2C%22%24initial_referrer%22%3A%20%22%24direct%22%2C%22%24initial_referring_domain%22%3A%20%22%24direct%22%2C%22token%22%3A%20%22%22%7D%7D`,
		});
		const data = await response.json();
		expect(data).toEqual({ error: null, status: 1 });
	});

	test('POST /track (form)', async () => {
		const payload = {"event": "look no token!","properties": {"$os": "Mac OS X","$browser": "Chrome","$current_url": "http://localhost:3000/","$browser_version": 122,"$screen_height": 1080,"$screen_width": 1920,"mp_lib": "web","$lib_version": "2.49.0","$insert_id": "6vufqscyx36h4h5v","time": Date.now(),"distinct_id": "$device:18dfa610897264-06d57d796ce8f8-1d525637-1fa400-18dfa610897264","$device_id": "18dfa610897264-06d57d796ce8f8-1d525637-1fa400-18dfa610897264","$initial_referrer": "$direct","$initial_referring_domain": "$direct","token": ""}}
		const response = await fetch('http://localhost:8080/track', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				
			},
			body: `data=${Buffer.from(JSON.stringify(payload)).toString('base64')}`,
		});
		const data = await response.json();
		expect(data).toEqual({ error: null, status: 1 });
	});
	
	//THIS DOESN'T WORK
	test('POST /track (sendBeacon)', async () => {
		const payload = {
			event: "foo",
			properties: {
				"$os": "Mac OS X",
				"$browser": "Chrome",
				"$current_url": "http://localhost:3000/",
				"$browser_version": 123,
				"$screen_height": 1080,
				"$screen_width": 1920,
				"mp_lib": "web",
				"$lib_version": "2.49.0",
				"$insert_id": "exampleInsertId",
				"time": Date.now(), // Dynamic timestamp
				"distinct_id": "$device:exampleDistinctId",
				"$device_id": "exampleDeviceId",
				"$initial_referrer": "$direct",
				"$initial_referring_domain": "$direct",
				"token": ""
			}
		};
		const encodedPayload = encodeURIComponent(Buffer.from(JSON.stringify(payload)).toString('base64'));
		const response = await fetch('http://localhost:8080/track', {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain;charset=UTF-8'
				
			},
			body: `data=${encodedPayload}`,
		});
		const data = await response.json();
		expect(data).toEqual({ error: null, status: 1 });
	});

	test('POST /engage', async () => {
		const response = await fetch('http://localhost:8080/engage', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `data=%7B%22%24set%22%3A%20%7B%22%24os%22%3A%20%22Mac%20OS%20X%22%2C%22%24browser%22%3A%20%22Chrome%22%2C%22%24browser_version%22%3A%20122%2C%22foo%22%3A%20%22bar%22%7D%2C%22%24token%22%3A%20%22%22%2C%22%24distinct_id%22%3A%20%22ak%22%2C%22%24device_id%22%3A%20%2218dfa623f8414f-0ac97dcee76b58-1d525637-1fa400-18dfa623f8514f%22%2C%22%24user_id%22%3A%20%22ak%22%7D`,
		});
		const data = await response.json();
		expect(data).toEqual({ error: null, status: 1 });
	});
});

describe('PROXY', ()=>{
	test('GET /lib.min.js', async () => {
        const response = await fetch('http://localhost:8080/lib.min.js', {
            method: 'GET'
        });
        const contentType = response.headers.get('content-type');
        const text = await response.text();

        // Check for successful response
        expect(response.status).toEqual(200);

        // Check the content type is for JavaScript
        expect(contentType).toMatch(/javascript/);

        // Optionally check for a specific string in the response
        // This depends on what the JavaScript file contains
        expect(text.startsWith('(function() {')).toBe(true);
    });

	test('GET /lib.js', async () => {
        const response = await fetch('http://localhost:8080/lib.js', {
            method: 'GET'
        });
        const contentType = response.headers.get('content-type');
        const text = await response.text();

        // Check for successful response
        expect(response.status).toEqual(200);

        // Check the content type is for JavaScript
        expect(contentType).toMatch(/javascript/);

        // Optionally check for a specific string in the response
        // This depends on what the JavaScript file contains
        expect(text.startsWith('(function () {')).toBe(true);
    });


	test('GET /decide', async () => {
        const response = await fetch('http://localhost:8080/decide', {
            method: 'GET'
        });
        const contentType = response.headers.get('content-type');
        const body = await response.json();

        // Check for successful response
        expect(response.status).toEqual(299);
		expect(body.error).toEqual('the /decide endpoint is deprecated');
        expect(contentType).toEqual('application/json; charset=utf-8');
    });

	test('POST /decide', async () => {
        const response = await fetch('http://localhost:8080/decide', {
            method: 'POST'
        });
        const contentType = response.headers.get('content-type');
        const body = await response.json();

        // Check for successful response
        expect(response.status).toEqual(299);
		expect(body.error).toEqual('the /decide endpoint is deprecated');
        expect(contentType).toEqual('application/json; charset=utf-8');
    });
})



describe('PARSING', () => {
	console.error = jest.fn();
    test('{}', () => {
        const input = JSON.stringify({ key: 'value' });
        expect(parseSDKData(input)).toEqual([{ key: 'value' }]);
    });

    test('[{}, {}, {}]', () => {
        const input = JSON.stringify([{ key: 'value' }, { key: 'value' }, { key: 'value' }]);
        expect(parseSDKData(input)).toEqual([{ key: 'value' }, { key: 'value' }, { key: 'value' }]);
    });

    test('base64 encoded', () => {
        const json = JSON.stringify({ key: 'value' });
        const base64 = Buffer.from(json).toString('base64');
        expect(parseSDKData(base64)).toEqual([{ key: 'value' }]);
    });

    test('sendBeacon', () => {
        const json = JSON.stringify({ key: 'value' });
        const encoded = encodeURIComponent(Buffer.from(json).toString('base64'));
        const input = `data=${encoded}`;
        expect(parseSDKData(input)).toEqual([{ key: 'value' }]);
    });

    test('unknown format', () => {
        const input = 'definitely not jason';
        expect(parseSDKData(input)).toEqual([]);
    });
});