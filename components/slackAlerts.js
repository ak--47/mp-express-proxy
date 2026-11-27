// @ts-check
/**
 * Slack error alerts: posts production errors to SLACK_ALERT_WEBHOOK_URL in
 * the fleet's standard format (components/alertFormat.js).
 *
 * Ported from dm4's server/utils/slack-alerts.js, minus its dungeon dedupe,
 * recoverable hold, and sweep alert.
 *
 *   - Gate: production (RUNTIME=prod or NODE_ENV=production) AND on Cloud Run
 *     (K_SERVICE or CLOUD_RUN_JOB) AND the URL set. Local dev and tests never post.
 *   - Dedupe: once per `message | component` per 30 minutes. Repeats are
 *     counted and reported on that key's next post.
 *   - Cap: 20 posts per rolling hour; posts over the cap are counted and
 *     reported on the next post that goes out.
 *   - Zero request-path cost: notify() only queues a setImmediate; formatting,
 *     dedupe and the POST run after the response has been handed off.
 *   - Never throws. 5s POST timeout. A failed post writes one console.warn
 *     line (never console.error: that would look like another error), with any
 *     webhook URL redacted.
 *   - Privacy: this proxy carries other people's tracking data. Callers pass
 *     only a message, a component, a route, a status and an Error. Nothing here
 *     reads a request body, header or token, and scrub() strips query strings,
 *     JSON.parse input snippets and 32-hex tokens from every text field.
 *
 * @module components/slackAlerts
 */

const { formatAlert, logsExplorerUrl, etTime } = require('./alertFormat');

const DEDUPE_WINDOW_MS = 30 * 60_000;
const CAP_PER_HOUR = 20;
const HOUR_MS = 60 * 60_000;
const POST_TIMEOUT_MS = 5_000;
const MAX_KEYS = 500;
const SERVICE_NAME = 'Express Proxy';
const GCP_PROJECT = 'mixpanel-gtm-training';
const DEFAULT_SERVICE = 'express-proxy';

/**
 * Remove anything from error text that could carry tracking data: query
 * strings (Session Replay's /record carries distinct_id etc. there), the input
 * snippet V8 puts in JSON.parse errors, Mixpanel tokens (32 hex), and webhook URLs.
 * @param {unknown} v
 * @returns {string}
 */
function scrub(v) {
	return String(v ?? '')
		.replace(/https?:\/\/hooks\.slack\.com\/\S*/g, '<webhook>')
		.replace(/, ".*" is not valid JSON/g, ', <input omitted> is not valid JSON')
		.replace(/(\/[^\s?]*)\?[^\s)\]'"]*/g, '$1?…')
		.replace(/\b[0-9a-f]{32}\b/gi, '<redacted>');
}

/**
 * An error message with any webhook URL removed (fetch puts the URL in some errors).
 * @param {unknown} err
 * @param {string} url
 */
function redact(err, url) {
	let msg = err instanceof Error ? err.message : String(err);
	if (url) msg = msg.split(url).join('<webhook>');
	return msg.replace(/https?:\/\/hooks\.slack\.com\/\S*/g, '<webhook>');
}

/** @param {unknown} err */
function warn(message, err, url) {
	console.warn(JSON.stringify({ severity: 'WARNING', message, error: redact(err, url) }));
}

/**
 * @typedef {object} AlertRecord
 * @property {string} message      short error, e.g. '[upstream] /track request failed'
 * @property {string} [component]  'express' | 'upstream' | 'proxy' | 'process'
 * @property {string} [path]       'POST /track'
 * @property {string|number} [status]
 * @property {unknown} [error]     Error (message + stack feed WHY / WHERE) or string
 * @property {string} [detail]     extra WHY text
 */

class SlackAlerts {
	/**
	 * @param {{fetchImpl?: typeof fetch, now?: () => number, env?: NodeJS.ProcessEnv, defer?: (fn: () => void) => void}} [deps]
	 */
	constructor({ fetchImpl, now, env, defer } = {}) {
		this.fetchImpl = fetchImpl || ((url, init) => fetch(url, init));
		this.now = now || Date.now;
		this.env = env || process.env;
		this.defer = defer || (fn => setImmediate(fn));
		/** @type {Map<string, {lastSentAt: number, suppressed: number}>} */
		this.keys = new Map();
		/** @type {number[]} */
		this.sentTimes = [];
		this.capSuppressed = 0;
		/** @type {Set<Promise<void>>} */
		this.pending = new Set();
	}

	url() {
		return this.env.SLACK_ALERT_WEBHOOK_URL || '';
	}

	isProduction() {
		return this.env.RUNTIME === 'prod' || this.env.NODE_ENV === 'production';
	}

	/** True when this process should post: prod, on Cloud Run, URL set. */
	enabled() {
		return Boolean(this.isProduction() && (this.env.K_SERVICE || this.env.CLOUD_RUN_JOB) && this.url());
	}

	/**
	 * Queue one alert. Returns immediately; all work happens on a later tick.
	 * Never throws.
	 * @param {AlertRecord} info
	 */
	notify(info) {
		try {
			if (!this.enabled()) return;
			const atMs = this.now();
			this.track(new Promise(resolve => {
				this.defer(() => {
					try { this.record(info, atMs); }
					catch (err) { warn('[slack-alerts] notify failed', err, this.url()); }
					resolve();
				});
			}));
		} catch (err) {
			warn('[slack-alerts] notify failed', err, this.url());
		}
	}

	/**
	 * Dedupe, cap, format and post. Synchronous up to the POST.
	 * @param {AlertRecord} info
	 * @param {number} [atMs]
	 * @returns {string | null} the text posted, or null when suppressed
	 */
	record(info, atMs = this.now()) {
		const message = scrub(String(info.message ?? '').split('\n')[0].trim()) || 'error';
		const component = typeof info.component === 'string' ? info.component : '';
		const key = `${message} | ${component}`;

		const state = this.keys.get(key);
		if (state && atMs - state.lastSentAt < DEDUPE_WINDOW_MS) {
			state.suppressed += 1;
			return null;
		}

		this.sentTimes = this.sentTimes.filter(t => atMs - t < HOUR_MS);
		if (this.sentTimes.length >= CAP_PER_HOUR) {
			this.capSuppressed += 1;
			return null;
		}

		const notes = [];
		if (state && state.suppressed > 0) notes.push(`+${state.suppressed} more since ${etTime(state.lastSentAt, false)}`);
		if (this.capSuppressed > 0) notes.push(`+${this.capSuppressed} other alerts held by the rate cap`);
		this.capSuppressed = 0;

		this.keys.set(key, { lastSentAt: atMs, suppressed: 0 });
		this.sentTimes.push(atMs);
		this.pruneKeys(atMs);

		const text = this.format(info, { message, component, notes, atMs });
		this.track(this.post(text));
		return text;
	}

	/**
	 * @param {AlertRecord} info
	 * @param {{message: string, component: string, notes: string[], atMs: number}} parts
	 */
	format(info, { message, component, notes, atMs }) {
		const err = info.error;
		const errMessage = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
		const stack = err instanceof Error && typeof err.stack === 'string' ? scrub(err.stack) : undefined;
		const cause = err instanceof Error && err.cause ? /** @type {any} */ (err.cause) : null;
		const causeText = cause ? `cause: ${cause.code || cause.message || String(cause)}` : '';
		// The stack's first line repeats the message; only add the message when there is no stack.
		const detail = [stack ? '' : errMessage, info.detail, causeText].filter(Boolean).map(scrub).join('\n');
		return formatAlert({
			service: SERVICE_NAME,
			title: message,
			component,
			path: info.path ? scrub(info.path) : undefined,
			status: info.status,
			stack,
			detail,
			atMs,
			notes,
			logsUrl: logsExplorerUrl({
				project: GCP_PROJECT,
				service: this.env.K_SERVICE || DEFAULT_SERVICE,
				atMs
			})
		});
	}

	/**
	 * Post and report failure on the console. Resolves either way.
	 * @param {string} text
	 */
	async post(text) {
		try {
			const res = await this.fetchImpl(this.url(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
				signal: AbortSignal.timeout(POST_TIMEOUT_MS)
			});
			if (!res.ok) console.warn(JSON.stringify({ severity: 'WARNING', message: '[slack-alerts] post failed', status: res.status }));
		} catch (err) {
			warn('[slack-alerts] post failed', err, this.url());
		}
	}

	/** @param {Promise<void>} p */
	track(p) {
		this.pending.add(p);
		p.finally(() => this.pending.delete(p));
	}

	/**
	 * Resolve when queued alerts and their posts finish, or `timeoutMs` passes.
	 * Await this before process exit.
	 * @param {number} [timeoutMs]
	 */
	async flush(timeoutMs = 3000) {
		const deadline = Date.now() + timeoutMs;
		while (this.pending.size > 0 && Date.now() < deadline) {
			/** @type {ReturnType<typeof setTimeout>|undefined} */
			let timer;
			const timeout = new Promise(resolve => { timer = setTimeout(resolve, deadline - Date.now()); });
			await Promise.race([Promise.allSettled([...this.pending]), timeout]);
			clearTimeout(timer);
		}
	}

	/** @param {number} now */
	pruneKeys(now) {
		if (this.keys.size <= MAX_KEYS) return;
		for (const [k, v] of this.keys) {
			if (now - v.lastSentAt >= DEDUPE_WINDOW_MS) this.keys.delete(k);
		}
	}
}

/**
 * http-proxy-middleware logProvider that alerts on proxy errors. hpm hands
 * the provider one interpolated line:
 *   [HPM] Error occurred while proxying request HOST/PATH?QUERY to TARGET [CODE] (link)
 * The original line still goes to stderr unchanged; the alert gets the path
 * without its query string and the error code.
 * @param {SlackAlerts} alerts
 */
function hpmLogProvider(alerts) {
	return (/** @type {any} */ provider) => ({
		...provider,
		error: (/** @type {any[]} */ ...args) => {
			provider.error(...args);
			try {
				const line = String(args[0] ?? '');
				const m = line.match(/^\[HPM\] Error occurred while proxying request (\S+) to \S+ \[([^\]]+)\]/);
				if (!m) return;
				const slash = m[1].indexOf('/');
				const path = slash >= 0 ? m[1].slice(slash).split('?')[0] : '';
				const prefix = '/' + (path.split('/')[1] || '');
				alerts.notify({
					message: `[proxy] ${prefix} upstream error ${m[2]}`,
					component: 'proxy',
					path,
					detail: `proxy request to upstream failed: ${m[2]}`
				});
			} catch { /* never throw from a logger */ }
		}
	});
}

const slackAlerts = new SlackAlerts();

module.exports = slackAlerts;
module.exports.SlackAlerts = SlackAlerts;
module.exports.hpmLogProvider = hpmLogProvider;
module.exports.scrub = scrub;
module.exports.DEDUPE_WINDOW_MS = DEDUPE_WINDOW_MS;
module.exports.CAP_PER_HOUR = CAP_PER_HOUR;
