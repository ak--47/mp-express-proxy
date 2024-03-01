const { spawn } = require('child_process');

describe('API Tests', () => {
	test('POST /track (json)', async () => {
		const response = await fetch('http://localhost:8080/track', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `data=%7B%22event%22%3A%20%22look%20no%20token!%22%2C%22properties%22%3A%20%7B%22%24os%22%3A%20%22Mac%20OS%20X%22%2C%22%24browser%22%3A%20%22Chrome%22%2C%22%24current_url%22%3A%20%22http%3A%2F%2Flocalhost%3A3000%2F%22%2C%22%24browser_version%22%3A%20122%2C%22%24screen_height%22%3A%201080%2C%22%24screen_width%22%3A%201920%2C%22mp_lib%22%3A%20%22web%22%2C%22%24lib_version%22%3A%20%222.49.0%22%2C%22%24insert_id%22%3A%20%2233x91hx63q5ntr6q%22%2C%22time%22%3A%201709302760.468%2C%22distinct_id%22%3A%20%22%24device%3A18dfa623f8414f-0ac97dcee76b58-1d525637-1fa400-18dfa623f8514f%22%2C%22%24device_id%22%3A%20%2218dfa623f8414f-0ac97dcee76b58-1d525637-1fa400-18dfa623f8514f%22%2C%22%24initial_referrer%22%3A%20%22%24direct%22%2C%22%24initial_referring_domain%22%3A%20%22%24direct%22%2C%22token%22%3A%20%22%22%7D%7D`,
		});
		const data = await response.json();
		expect(data).toEqual({ error: null, status: 1 });
	});

	test('POST /track (form)', async () => {
		const response = await fetch('http://localhost:8080/track', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				
			},
			body: `data=eyJldmVudCI6ICJsb29rIG5vIHRva2VuISIsInByb3BlcnRpZXMiOiB7IiRvcyI6ICJNYWMgT1MgWCIsIiRicm93c2VyIjogIkNocm9tZSIsIiRjdXJyZW50X3VybCI6ICJodHRwOi8vbG9jYWxob3N0OjMwMDAvIiwiJGJyb3dzZXJfdmVyc2lvbiI6IDEyMiwiJHNjcmVlbl9oZWlnaHQiOiAxMDgwLCIkc2NyZWVuX3dpZHRoIjogMTkyMCwibXBfbGliIjogIndlYiIsIiRsaWJfdmVyc2lvbiI6ICIyLjQ5LjAiLCIkaW5zZXJ0X2lkIjogIjZ2dWZxc2N5eDM2aDRoNXYiLCJ0aW1lIjogMTcwOTMwMjY4NS44MzQsImRpc3RpbmN0X2lkIjogIiRkZXZpY2U6MThkZmE2MTA4OTcyNjQtMDZkNTdkNzk2Y2U4ZjgtMWQ1MjU2MzctMWZhNDAwLTE4ZGZhNjEwODk3MjY0IiwiJGRldmljZV9pZCI6ICIxOGRmYTYxMDg5NzI2NC0wNmQ1N2Q3OTZjZThmOC0xZDUyNTYzNy0xZmE0MDAtMThkZmE2MTA4OTcyNjQiLCIkaW5pdGlhbF9yZWZlcnJlciI6ICIkZGlyZWN0IiwiJGluaXRpYWxfcmVmZXJyaW5nX2RvbWFpbiI6ICIkZGlyZWN0IiwidG9rZW4iOiAiIn19`,
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
