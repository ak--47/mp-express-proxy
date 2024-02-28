# Mixpanel Proxy Express
this is a simple express server that acts as a proxy for mixpanel. it is designed to be used in a serverless environment, such as google cloud run, and it can hide the token from the client.

under the hood, it re-routes requests from /track to /import and uses the mixpanel import api to send the events.

## Usage
To use this server, you need to set the following environment variables:
- `MIXPANEL_TOKEN`: the token for your mixpanel project
- `FRONTEND_URL`: the url of your frontend application (for CORS)

On the client side, you should use the following configuration for initializing mixpanel:
```javascript
mixpanel.init("dummyToken", {
			api_host: PROXY_URL,		
			api_payload_format: 'json'
})
```

check `deploy.sh` for an example of how to deploy this server to google cloud run.
