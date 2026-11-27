# Mixpanel Proxy Express
this is a simple express server that acts as a proxy for mixpanel. it is designed to be used in a serverless environment, such as google cloud run, and effectively provides scaffolding for to modify each record before it gets sent to mixpanel.

the proof of concept demonstrates how this can be used to hide the token from the client - but this could also be used as the basis of a proxy that enforces a schema on the data being sent to mixpanel, enriches data points in flight, or even sends mixpanel data to other places.

under the hood, it provides hooks to handle requests made to the `/track` `/engage` and `/groups` endpoints.

## Security and exposure

**What it is.** A public demo of a Mixpanel tracking proxy. It runs on Cloud Run as `express-proxy` (project `mixpanel-gtm-training`, `us-central1`). It handles about 1.3M requests per month.

**Why it is public.** The proxy must accept tracking from any web page:
- AK's sites send tracking through it so ad blockers do not block it.
- AK's Chrome extension sends tracking through it from any page.
- The team uses it in customer demos (tracking before and after a proxy).

Customers do not use this deployment in production. Mixpanel project tokens are public values. The browser SDK puts the token in every request.

**Routes.** No route has authentication.

| Route | Method | Forwards to |
| --- | --- | --- |
| `/track`, `/engage`, `/groups` | POST | `api.mixpanel.com` (`api-eu` if `REGION=EU`), after the proxy parses the body |
| `/record`, `/flags` | any | `api.mixpanel.com`, streamed as is |
| `/lib.min.js`, `/lib.js` | GET | `cdn.mxpnl.com` (latest Mixpanel JS SDK) |
| `/libs/<file>.js` | GET | `cdn.mxpnl.com/libs/`. The file name must match `^[A-Za-z0-9._-]+\.js(\.map)?$`, else 400 |
| `/`, `/ping` | any | none (health check) |
| `/decide` | any | none (returns 299, deprecated) |

**Fixed upstreams, no SSRF.** The upstream hosts are hard-coded. No request value can change the target host. The proxy forwards only to Mixpanel ingestion (`api.mixpanel.com`) and the Mixpanel CDN (`cdn.mxpnl.com`).

**Any origin is allowed on purpose.** `components/corsConfig.js` reflects the request `Origin` and allows credentials. This lets the extension and demo pages on any site use the proxy. `FRONTEND_URL` is read but not used for CORS.

**Forced-token mode.** If `MIXPANEL_TOKEN` is set, the proxy writes that token onto every `/track`, `/engage` and `/groups` record. It replaces any token the client sent. Clients can then call `mixpanel.init("")`. This is the "hide the token" demo. In this mode, anyone on the internet can send events, profiles and groups into that one demo project. The live service has `MIXPANEL_TOKEN` empty, so the mode is off and the proxy forwards the client's own token. It has been off since at least January 2026.

**Cost and abuse limits.**
- Body size: 10 MB per request on `/track`, `/engage`, `/groups` (body parser limit). The proxy does not parse `/record` and `/flags`, so only the Cloud Run request limit (32 MiB) applies.
- Max instances: 20 (`--max-instances`; 30-day peak was 9), with concurrency 80, 1 vCPU and 512 MiB each. This caps the Cloud Run cost of a traffic spike.
- No rate limit in the proxy.
- The proxy adds no read access beyond the public Mixpanel SDK endpoints. Abuse can add junk data to a Mixpanel project. It cannot read project data out.

## Deployment
To use this server, you need to set the following environment variables:
- `MIXPANEL_TOKEN`: the token for your mixpanel project
- `FRONTEND_URL`: the url of your frontend application (for CORS)

You can optionally set the following environment variables:
- `PORT`: the port the server will listen on (default: 8080)
- `REGION`: `US` or `EU` if using [EU data residency](https://docs.mixpanel.com/docs/privacy/eu-residency) (default is **US**)
- `SLACK_ALERT_WEBHOOK_URL`: Slack incoming webhook for error alerts (`components/slackAlerts.js`). Posts only in production on Cloud Run (`RUNTIME=prod` + `K_SERVICE`). `cloudbuild.yaml` injects it from Secret Manager (`fde-slack-alert-webhook`). Alerts carry the route, status and error only, never event payloads, tokens, headers or query strings, and are sent after the response (no added latency).

check `deploy.sh` for an example of how to deploy this server to google cloud run or use the deploy button below!


[Google Cloud Btn]: https://binbashbanana.github.io/deploy-buttons/buttons/remade/googlecloud.svg
[Google Cloud Deploy]: https://deploy.cloud.run?git_repo=https://github.com/ak--47/mp-express-proxy


[![Google Cloud Btn]][Google Cloud Deploy]



## Usage

Once you have deployed the proxy, you should use the following client-side configuration for initializing mixpanel

```javascript
const PROXY_URL = `http://localhost:8080`; // the url of your deployed proxy
const MIXPANEL_CUSTOM_LIB_URL = `${PROXY_URL}/lib.min.js`;
// mixpanel snippet
(function (f, b) { ... })(document, window.mixpanel || []);

// you may pass an empty string as the token to init() 
mixpanel.init("", {	api_host: PROXY_URL })

// this event will get sent to your mixpanel project via the proxy
mixpanel.track("test", { "foo": "bar" })
```
(see `./demo/index.html` for a full working example)


## Demo


<a href="https://www.loom.com/share/fc0acf9214e34165958acdbbf4eeef1c?sid=07d6101d-5924-4ea9-80c2-d780fee2111f"><img src="https://aktunes.neocities.org/token%20hide.png"></a>