# HighLevel Marketplace + Sandbox Setup Walkthrough

This file explains, in simple terms, what we did to get the Voice AI Observability Copilot running inside a HighLevel sandbox through a Marketplace app.

## 1. What We Were Building

The project requirement was to build a **Voice AI Observability Copilot** for HighLevel Voice AI agents.

The app needed to:

- Read Voice AI call logs/transcripts from HighLevel.
- Analyze calls against agent goals and KPIs.
- Show a dashboard with scores, issues, recommendations, and human-review actions.
- Run inside the HighLevel interface through a Marketplace/custom page integration.

## 2. Created A HighLevel Marketplace App

We started in the **HighLevel Marketplace Developer Portal** and created a **Private Marketplace App**.

Private app was the right choice because:

- It is easier to test in a sandbox.
- It does not need public marketplace approval.
- It still supports OAuth, scopes, custom pages, and test install links.

Important app choices:

```text
App type: Private
Target user: Sub-account / Location
Placement: Left menu navigation
```

The app target was sub-account/location because Voice AI calls belong to a HighLevel location, not just the agency dashboard.

## 3. Created A Sandbox/Test Account

From the Developer Portal, we used:

```text
Testing → Create App Test Account
```

Then we logged into the sandbox like a normal HighLevel account:

```text
https://app.gohighlevel.com
```

Inside the sandbox agency, we created a new sub-account/location using:

```text
Blank Snapshot
Regular Account
```

The sandbox location/sub-account ID we used was:

```text
89w8BhdDot7ZJMWK5JCA
```

In HighLevel language, **Location ID** and **Sub-account ID** are effectively the same thing for this install/test flow.

## 4. Created A Private Integration Token

Inside the sandbox sub-account, we created a **Private Integration Token**.

The token allowed our local Node backend to call HighLevel APIs while we were still building the full Marketplace OAuth flow.

Scopes selected:

```text
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agent-goals.readonly
locations.readonly
contacts.readonly
```

The most important scope was:

```text
voice-ai-dashboard.readonly
```

That is needed to read Voice AI call logs/transcripts.

We tested the token against:

```text
GET /voice-ai/dashboard/call-logs
```

At first it failed because the token did not have the required scope. After regenerating the PIT with the right scope, HighLevel returned:

```text
200 OK
callLogs: []
```

That meant authentication was working, but no Voice AI calls existed yet.

## 5. Built The Local App

We scaffolded this repo as a local full-stack app:

```text
Node.js backend
Vue.js frontend
Vite dev server
```

Main local URLs:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
```

The backend calls HighLevel and exposes local API routes like:

```text
GET /api/health
GET /api/call-logs
GET /api/agent-goals
GET /api/observability
GET /api/oauth/callback
POST /api/webhooks/voice-ai-call-end
```

The frontend dashboard shows:

- monitored calls
- average score
- critical issues
- Use Actions
- agent performance
- goal checks
- call review queue
- recommendations

## 6. Added Environment Variables

We used a local `.env` file for secrets and sandbox configuration.

The `.env` file is ignored by git and should not be committed.

Important variables:

```env
PORT=3001
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2023-02-21
GHL_LOCATION_ID=89w8BhdDot7ZJMWK5JCA
GHL_PRIVATE_INTEGRATION_TOKEN=your_private_integration_token
GHL_CALL_TYPE=TRIAL
GHL_CLIENT_ID=your_marketplace_client_id
GHL_CLIENT_SECRET=your_marketplace_client_secret
GHL_OAUTH_REDIRECT_URL=https://your-tunnel-url.trycloudflare.com/api/oauth/callback
GHL_OAUTH_USER_TYPE=Location
AGENT_GOALS_FILE=config/agent-goals.json
USE_DEMO_DATA_WHEN_EMPTY=false
```

We used:

```env
GHL_CALL_TYPE=TRIAL
```

because the first Voice AI call was a sandbox/test Web Call, not a live phone call.

## 7. Created A Voice AI Test Call

Inside HighLevel, we created/tested a Voice AI agent and made a browser/Web Call test.

After that, the call-log API returned:

```text
totalRecords: 1
trialCall: true
hasSummary: true
hasTranscript: true
```

That confirmed the app was reading real HighLevel Voice AI data.

## 8. Added Agent Goal Scoring

The requirement said observability should be based on the agent's goals or script.

So we added goal-profile based scoring.

Default goal profile checks:

- Clear opening
- Need qualification
- Next step offered
- Outcome confirmed
- Escalation handled

Optional custom config:

```text
config/agent-goals.json
```

There is an example file:

```text
config/agent-goals.example.json
```

This lets us map a real HighLevel Voice AI agent ID to custom goals, keywords, scoring weights, and recommendations.

## 9. Exposed The Local App With Cloudflare Tunnel

HighLevel cannot load `localhost`, so we needed a public HTTPS URL.

We used Cloudflare Tunnel:

```bash
npx --yes cloudflared tunnel --url http://localhost:5173 --no-autoupdate
```

Cloudflare generated a temporary public URL like:

```text
https://something.trycloudflare.com
```

That public URL forwarded traffic to:

```text
http://localhost:5173
```

Because Vite proxies `/api` to the backend, the public tunnel URL could load both:

```text
/
/api/observability
```

Important: the tunnel URL changes when the tunnel restarts.

Every time the tunnel URL changes, update it in:

1. HighLevel Custom Page Live URL
2. HighLevel Custom Page Testing URL
3. HighLevel OAuth redirect URL
4. Local `.env` as `GHL_OAUTH_REDIRECT_URL`

## 10. Added The Custom Page In HighLevel

In the Marketplace app, we added a Custom Page.

Fields used:

```text
Custom page title:
Voice AI Observability

Placement:
Left menu navigation

Live URL:
https://your-tunnel-url.trycloudflare.com

Testing URL:
https://your-tunnel-url.trycloudflare.com

Allow microphone:
Off

Allow camera:
Off
```

We chose **Left menu navigation** so the dashboard appears inside HighLevel's sidebar.

## 11. Added OAuth Redirect Handling

At first, installing the app failed because HighLevel expected a real OAuth install flow.

So we added:

```text
GET /api/oauth/callback
```

HighLevel redirects to this endpoint with a temporary OAuth `code`.

Our backend exchanges that code for an access token using:

```text
POST https://services.leadconnectorhq.com/oauth/token
```

For the local demo, the dashboard still reads call logs through the sandbox PIT. But adding OAuth token exchange makes the Marketplace install flow complete properly.

HighLevel OAuth redirect URL:

```text
https://your-tunnel-url.trycloudflare.com/api/oauth/callback
```

## 12. Generated A Test Install Link

In the Marketplace Developer Portal, we generated a test install link for the app version.

When it asked for sub-account ID, we used the sandbox Location ID:

```text
89w8BhdDot7ZJMWK5JCA
```

Then we opened the test link, allowed the app, and installed it.

After fixing the OAuth callback and redirect URL, the app installed successfully.

## 13. How To Run Everything Now

Start the local app:

```bash
npm run dev
```

Start the tunnel:

```bash
npx --yes cloudflared tunnel --url http://localhost:5173 --no-autoupdate
```

Copy the generated `https://*.trycloudflare.com` URL.

Update HighLevel with that URL:

```text
Custom Page Live URL
Custom Page Testing URL
OAuth Redirect URL + /api/oauth/callback
```

Update local `.env`:

```env
GHL_OAUTH_REDIRECT_URL=https://your-new-tunnel-url.trycloudflare.com/api/oauth/callback
```

Restart:

```bash
npm run dev
```

Generate a fresh test link and install the app.

## 14. Troubleshooting We Hit

### Token not authorized for this scope

Cause:

```text
The PIT did not include voice-ai-dashboard.readonly.
```

Fix:

```text
Regenerate PIT with the correct Voice AI scopes.
```

### App install failed due to insufficient data

Cause:

```text
Marketplace app version was missing required install/auth details.
```

Fix:

```text
Add scopes, custom page URL, OAuth redirect URL, save app, create/update version, generate new test link.
```

### This integration cannot be added, please contact the developer

Cause:

```text
OAuth callback existed, but the backend was not exchanging the OAuth code for an access token.
```

Fix:

```text
Add /api/oauth/callback and exchange the code at /oauth/token.
```

### Tunnel URL stopped working

Cause:

```text
Quick Cloudflare tunnel URLs are temporary.
```

Fix:

```text
Start a new tunnel and update HighLevel URLs plus local .env.
```

## 15. Security Notes

Do not commit:

```text
.env
Private Integration Token
Client Secret
OAuth tokens
```

Before final submission, rotate/regenerate:

```text
HighLevel PIT
Marketplace Client Secret
```

because they were used during local setup.

## 16. Final Mental Model

Simple flow:

```text
HighLevel sandbox call logs
        ↓
Node backend reads Voice AI transcripts
        ↓
Backend scores calls against agent goals
        ↓
Vue dashboard shows issues and recommendations
        ↓
Cloudflare Tunnel gives public HTTPS URL
        ↓
HighLevel Custom Page embeds that URL in the left menu
```

That is how the local observability dashboard became a working HighLevel sandbox Marketplace app.
