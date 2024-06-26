# Mixpanel Proxy Express
this is a simple express server that acts as a proxy for mixpanel. it is designed to be used in a serverless environment, such as google cloud run, and effectively provides scaffolding for to modify each record before it gets sent to mixpanel.

the proof of concept demonstrates how this can be used to hide the token from the client - but this could also be used as the basis of a proxy that enforces a schema on the data being sent to mixpanel, enriches data points in flight, or even sends mixpanel data to other places.

under the hood, it provides hooks to handle requests made to the `/track` `/engage` and `/groups` endpoints.

## Deployment
To use this server, you need to set the following environment variables:
- `MIXPANEL_TOKEN`: the token for your mixpanel project
- `FRONTEND_URL`: the url of your frontend application (for CORS)

You can optionally set the following environment variables:
- `PORT`: the port the server will listen on (default: 8080)
- `REGION`: `US` or `EU` if using [EU data residency](https://docs.mixpanel.com/docs/privacy/eu-residency) (default is **US**)

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