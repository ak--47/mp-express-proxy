/* cSpell:disable */
//@ts-nocheck
const { formatAlert, logsExplorerUrl } = require('../components/alertFormat');
const { SlackAlerts, hpmLogProvider, scrub, CAP_PER_HOUR, DEDUPE_WINDOW_MS } = require('../components/slackAlerts');

const AT = Date.parse('2026-11-27T04:15:00Z'); // 11:15 PM ET
const HOOK = 'https://hooks.slack.com/services/T000/B000/secretsecret';
const PROD_ENV = { RUNTIME: 'prod', K_SERVICE: 'express-proxy', SLACK_ALERT_WEBHOOK_URL: HOOK };

/** A SlackAlerts with a recording fetch, a settable clock, and inline defer. */
function harness({ env = PROD_ENV, fetchImpl } = {}) {
	const posts = [];
	let now = AT;
	const alerts = new SlackAlerts({
		env,
		now: () => now,
		defer: fn => fn(),
		fetchImpl: fetchImpl || (async (url, init) => { posts.push({ url, text: JSON.parse(init.body).text }); return { ok: true, status: 200 }; })
	});
	return { alerts, posts, advance: ms => { now += ms; } };
}

describe('alertFormat (CommonJS port of the fleet reference)', () => {
	test('matches the reference output byte for byte', () => {
		const stack = `TypeError: Cannot read properties of undefined (reading 'events')\n    at buildEvents (/app/server/v5/runner.js:212:18)\n    at async run (/app/server/v5/runner.js:88:5)\n    at x (/app/node_modules/express/lib/router.js:1:1)`;
		const text = formatAlert({
			service: 'DM4', title: '[runner] dungeon run failed', userId: 'aaron@mixpanel.com', clientId: '3276012',
			component: 'runner', path: 'POST /api/run', status: 500, stack, atMs: AT, notes: ['+3 more since 11:02 PM'],
			logsUrl: logsExplorerUrl({ project: 'mixpanel-gtm-training', service: 'dm4', needle: '[runner] dungeon run failed', atMs: AT })
		});
		expect(text).toBe([
			':rotating_light: *DM4 — [runner] dungeon run failed*',
			'*WHO:* aaron@mixpanel.com / 3276012',
			'*WHAT:* runner / POST /api/run / 500',
			'*WHERE:* server/v5/runner.js @ 212',
			'*WHEN:* 11/26/26 @ 11:15 PM ET · +3 more since 11:02 PM',
			'*WHY:*',
			"> TypeError: Cannot read properties of undefined (reading 'events')",
			'>     at buildEvents (/app/server/v5/runner.js:212:18)',
			'>     at async run (/app/server/v5/runner.js:88:5)',
			'>     at x (/app/node_modules/express/lib/router.js:1:1)',
			'<https://console.cloud.google.com/logs/query;query=resource.type%3D%22cloud_run_revision%22%0Aresource.labels.service_name%3D%22dm4%22%0Aseverity%3E%3DERROR%0AjsonPayload.message%3A%22%5Brunner%5D%20dungeon%20run%20failed%22;timeRange=2026-11-27T03%3A15%3A00.000Z%2F2026-11-27T04%3A45%3A00.000Z;cursorTimestamp=2026-11-27T04%3A15%3A00.000Z?project=mixpanel-gtm-training|View logs in GCP>'
		].join('\n'));
	});

	test('escapes and dashes like the reference', () => {
		expect(formatAlert({ service: 'Express Proxy', title: 'upstream <timeout> & retry', atMs: AT })).toBe([
			':rotating_light: *Express Proxy — upstream &lt;timeout&gt; &amp; retry*',
			'*WHO:* —',
			'*WHAT:* —',
			'*WHERE:* —',
			'*WHEN:* 11/26/26 @ 11:15 PM ET',
			'*WHY:*',
			'> upstream &lt;timeout&gt; &amp; retry'
		].join('\n'));
	});
});

describe('SlackAlerts gate', () => {
	test.each([
		['prod on Cloud Run with URL', PROD_ENV, true],
		['NODE_ENV=production', { NODE_ENV: 'production', K_SERVICE: 'x', SLACK_ALERT_WEBHOOK_URL: HOOK }, true],
		['Cloud Run job', { RUNTIME: 'prod', CLOUD_RUN_JOB: 'x', SLACK_ALERT_WEBHOOK_URL: HOOK }, true],
		['dev', { RUNTIME: 'dev', K_SERVICE: 'x', SLACK_ALERT_WEBHOOK_URL: HOOK }, false],
		['not on Cloud Run', { RUNTIME: 'prod', SLACK_ALERT_WEBHOOK_URL: HOOK }, false],
		['no URL', { RUNTIME: 'prod', K_SERVICE: 'x' }, false]
	])('%s', (_name, env, expected) => {
		const { alerts, posts } = harness({ env });
		expect(alerts.enabled()).toBe(expected);
		alerts.notify({ message: 'boom', component: 'express' });
		expect(posts.length).toBe(0 + (expected ? 1 : 0));
	});
});

describe('SlackAlerts behaviour', () => {
	test('notify does no work on the calling tick (fire-and-forget)', async () => {
		const posts = [];
		const alerts = new SlackAlerts({
			env: PROD_ENV,
			fetchImpl: async (url, init) => { posts.push(init.body); return { ok: true, status: 200 }; }
		});
		const spy = jest.spyOn(alerts, 'record');
		alerts.notify({ message: '[upstream] /track request failed', component: 'upstream' });
		expect(spy).not.toHaveBeenCalled();
		expect(posts.length).toBe(0);
		await alerts.flush();
		expect(spy).toHaveBeenCalledTimes(1);
		expect(posts.length).toBe(1);
	});

	test('posts the standard format for an upstream failure', async () => {
		const { alerts, posts } = harness();
		const error = new TypeError('fetch failed');
		error.stack = 'TypeError: fetch failed\n    at node:internal/deps/undici/undici:13510:13\n    at async makeRequest (/usr/src/app/server.js:203:18)\n    at async handleMixpanelData (/usr/src/app/server.js:181:21)';
		error.cause = { code: 'ECONNRESET' };
		alerts.notify({ message: '[upstream] /track request failed', component: 'upstream', path: 'POST /track', status: 500, error });
		await alerts.flush();
		expect(posts.length).toBe(1);
		expect(posts[0].url).toBe(HOOK);
		const text = posts[0].text;
		console.log(`sample alert:\n${text}`);
		const lines = text.split('\n');
		expect(lines.slice(0, 6)).toEqual([
			':rotating_light: *Express Proxy — [upstream] /track request failed*',
			'*WHO:* —',
			'*WHAT:* upstream / POST /track / 500',
			'*WHERE:* server.js @ 203',
			'*WHEN:* 11/26/26 @ 11:15 PM ET',
			'*WHY:*'
		]);
		expect(text).toContain('> cause: ECONNRESET');
		expect(text).toContain('> TypeError: fetch failed');
		expect(lines[lines.length - 1]).toMatch(/^<https:\/\/console\.cloud\.google\.com\/logs\/query;.*service_name%3D%22express-proxy%22.*\?project=mixpanel-gtm-training\|View logs in GCP>$/);
	});

	test('dedupes per message | component for 30 min and reports the count', async () => {
		const { alerts, posts, advance } = harness();
		for (let i = 0; i < 4; i++) alerts.notify({ message: 'same', component: 'express' });
		alerts.notify({ message: 'same', component: 'proxy' }); // different component, own key
		expect(posts.length).toBe(2);
		advance(DEDUPE_WINDOW_MS);
		alerts.notify({ message: 'same', component: 'express' });
		expect(posts.length).toBe(3);
		expect(posts[2].text).toContain('*WHEN:* 11/26/26 @ 11:45 PM ET · +3 more since 11:15 PM');
	});

	test('caps at 20 posts per rolling hour and reports the held count', async () => {
		const { alerts, posts, advance } = harness();
		for (let i = 0; i < CAP_PER_HOUR + 5; i++) alerts.notify({ message: `err ${i}`, component: 'express' });
		expect(posts.length).toBe(CAP_PER_HOUR);
		advance(60 * 60_000);
		alerts.notify({ message: 'after the hour', component: 'express' });
		expect(posts.length).toBe(CAP_PER_HOUR + 1);
		expect(posts[CAP_PER_HOUR].text).toContain('+5 other alerts held by the rate cap');
	});

	test('never puts query strings, JSON input or tokens in Slack', async () => {
		const { alerts, posts } = harness();
		const error = new SyntaxError('Unexpected token \'d\', "data=eyJldmVudCI6ImZvbyJ9" is not valid JSON');
		error.stack = `${error.message}\n    at JSON.parse (<anonymous>)\n    at handle (/usr/src/app/server.js:10:5)`;
		alerts.notify({
			message: '[express] failed for /record?distinct_id=alice@example.com&token=0123456789abcdef0123456789abcdef',
			component: 'express',
			path: 'POST /record?distinct_id=alice@example.com',
			error
		});
		const text = posts[0].text;
		expect(text).not.toMatch(/alice|eyJ|0123456789abcdef0123456789abcdef|distinct_id=/);
		expect(text).toContain('/record?…');
		expect(text).toContain('&lt;input omitted&gt; is not valid JSON');
	});

	test('scrub strips webhook URLs too', () => {
		expect(scrub(`bad ${HOOK} url`)).toBe('bad <webhook> url');
	});

	test('a failed post never throws and warns once with the webhook redacted', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const { alerts } = harness({ fetchImpl: async () => { throw new Error(`Failed to parse URL from ${HOOK}`); } });
		expect(() => alerts.notify({ message: 'x', component: 'express' })).not.toThrow();
		await alerts.flush();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).not.toContain('hooks.slack.com');
		expect(warn.mock.calls[0][0]).toContain('<webhook>');
		warn.mockRestore();
	});

	test('a non-2xx response warns with the status only', async () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
		const { alerts } = harness({ fetchImpl: async () => ({ ok: false, status: 404 }) });
		alerts.notify({ message: 'x', component: 'express' });
		await alerts.flush();
		expect(JSON.parse(warn.mock.calls[0][0])).toEqual({ severity: 'WARNING', message: '[slack-alerts] post failed', status: 404 });
		warn.mockRestore();
	});
});

describe('hpmLogProvider', () => {
	test('alerts on proxy errors with path and code, no query string', () => {
		const { alerts, posts } = harness();
		const base = { log() {}, debug() {}, info() {}, warn() {}, error: jest.fn() };
		const provider = hpmLogProvider(alerts)(base);
		const line = '[HPM] Error occurred while proxying request express-proxy.run.app/record/?distinct_id=alice&seq=3 to https://api.mixpanel.com/ [ECONNRESET] (https://nodejs.org/api/errors.html#errors_common_system_errors)';
		provider.error(line);
		expect(base.error).toHaveBeenCalledWith(line); // original stderr line unchanged
		expect(posts.length).toBe(1);
		expect(posts[0].text).toContain('*Express Proxy — [proxy] /record upstream error ECONNRESET*');
		expect(posts[0].text).toContain('*WHAT:* proxy / /record/');
		expect(posts[0].text).not.toContain('alice');
	});

	test('ignores other error lines', () => {
		const { alerts, posts } = harness();
		const provider = hpmLogProvider(alerts)({ error() {} });
		provider.error('[HPM] something else');
		expect(posts.length).toBe(0);
	});
});
