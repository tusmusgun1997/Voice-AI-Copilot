# Voice AI Observability Copilot

A HighLevel Voice AI observability suite that monitors call transcripts, scores agent performance against KPI checkpoints, and surfaces recommendations for prompt, script, and human follow-up improvements.

## What This Builds

- **Monitor loop:** fetches Voice AI call logs from a HighLevel sandbox location and analyzes transcript behavior against configured success criteria.
- **Analyze loop:** provides a Vue dashboard with agent scores, issue queues, recommendation summaries, and "Use Actions" for calls that need human review or script training.
- **Integration path:** designed to run as a HighLevel Marketplace app custom page or a sandbox custom menu link.

## Stack

- **Backend:** Node.js, Express
- **Frontend:** Vue 3, Vite
- **HighLevel API:** Private Integration Token for local development, OAuth-ready app path for Marketplace installation

## Sandbox Prerequisites

1. Create or open a HighLevel Marketplace Developer account.
2. Create a private Marketplace app.
3. Create a sandbox/test agency account from **Developer Portal > Testing**.
4. Log into the sandbox at `https://app.gohighlevel.com`.
5. Create a regular sub-account/location from a blank snapshot.
6. Inside the sub-account, create a Private Integration Token with these scopes:

```text
voice-ai-dashboard.readonly
voice-ai-agents.readonly
voice-ai-agent-goals.readonly
locations.readonly
contacts.readonly
```

7. Keep the Location ID and PIT private. Rotate any PIT that was pasted into chat or shared during testing.

## Local Setup

Create `.env` from `.env.example` and fill in a rotated sandbox PIT:

```env
PORT=3001
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2023-02-21
GHL_LOCATION_ID=your_location_id
GHL_PRIVATE_INTEGRATION_TOKEN=your_rotated_sandbox_pit
GHL_CALL_TYPE=
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_OAUTH_REDIRECT_URL=https://your-public-url.example.com/api/oauth/callback
GHL_OAUTH_USER_TYPE=Location
AGENT_GOALS_FILE=config/agent-goals.json
OBSERVABILITY_PROFILES_FILE=data/agent-observability-profiles.json
CALL_ANALYSIS_RESULTS_FILE=data/call-analysis-results.json
USE_DEMO_DATA_WHEN_EMPTY=true
SHOW_DELETED_AGENT_CALLS=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
ANALYSIS_JOB_MAX_ATTEMPTS=5
ANALYSIS_JOB_RETRY_DELAY_MS=12000
```

Set `GHL_CALL_TYPE=TRIAL` when you want the dashboard to focus on sandbox Web Call / test-call logs. Leave it blank or use `LIVE` for production phone calls.

Set `SHOW_DELETED_AGENT_CALLS=false` to hide historical HighLevel call logs whose agent no longer exists in the live Voice AI agent list.

## Agent Goal Configuration

The copilot scores each call against an agent goal profile. If no custom profile is configured, the default profile checks for a clear opening, need qualification, next step, outcome confirmation, and escalation handling.

To configure a real HighLevel Voice AI agent:

1. Copy `config/agent-goals.example.json` to `config/agent-goals.json`.
2. Replace `replace_with_highlevel_agent_id` with the agent ID returned in the Voice AI call logs.
3. Adjust the `goals`, `criteria`, `keywordsAny`, `requiredWhenAny`, and recommendations to match the agent script.
4. Restart the backend.

The dashboard will show the active goal profile in the **Goal Checks** panel and on each agent row.

Install and run:

```bash
npm install
npm run dev
```

The dashboard runs at:

```text
http://localhost:5173
```

The backend runs at:

```text
http://localhost:3001
```

For a production-style local run, build the Vue app and serve everything from Express:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:3001
```

## Temporary Tunnel For HighLevel Demo

For a quick sandbox demo, run the app locally and expose the Vite frontend with Cloudflare Tunnel:

```bash
npm run dev
npx --yes cloudflared tunnel --url http://localhost:5173 --no-autoupdate
```

Use the generated `https://*.trycloudflare.com` URL as the HighLevel Custom Page URL. Keep your laptop awake and both the dev server and tunnel running while reviewers test it.

## Useful API Routes

```text
GET /api/health
GET /api/call-logs
GET /api/call-analyses
GET /api/call-analyses/:callId
GET /api/analysis-jobs
POST /api/call-analyses/sync-latest
GET /api/agent-goals
GET /api/observability
POST /api/webhooks/voice-ai-call-end
```

`/api/observability` returns the normalized dashboard payload used by the Vue frontend.

`POST /api/webhooks/voice-ai-call-end` now enqueues an async local analysis job. The worker fetches the call from HighLevel by `callId`, loads the agent's local observability parameters, asks OpenAI for a structured judgment, and stores the lightweight result in `data/call-analysis-results.json`.

For sandbox testing, `POST /api/call-analyses/sync-latest` scans recent HighLevel calls and enqueues any call that does not already have a local LLM result.

## HighLevel Integration

For the MVP demo:

1. Run the local app with `npm run dev`.
2. Expose the Vite URL with a tunnel such as ngrok or Cloudflare Tunnel.
3. In the Marketplace app, add a **Custom Page** pointing to the public frontend URL.
4. In **Advanced Settings > Auth**, add the OAuth redirect URL as `<public-url>/api/oauth/callback`.
5. In **Manage > Secrets**, create/copy the Client ID and Client Secret, then add them to `.env`.
6. Set `GHL_OAUTH_REDIRECT_URL` in `.env` to the exact same redirect URL configured in HighLevel.
7. Add the required scopes, save the app, and create/update a testable app version.
8. Install the private app into the sandbox location using the Developer Portal test link.

For production-style app installation, replace the local PIT with the OAuth install flow and store location access tokens per installed sub-account.

## Functional vs Mocked

Functional:

- HighLevel Voice AI call-log API client.
- Node ingestion endpoint.
- Transcript normalization.
- KPI scoring.
- Recommendation generation.
- Use Action extraction.
- Vue dashboard.
- Webhook receiver for `VoiceAiCallEnd`.
- Async webhook-triggered OpenAI analysis pipeline with local file-backed result storage.

Mocked or demo-backed:

- If the sandbox has zero Voice AI calls, the dashboard falls back to demo calls so the review flow is visible.
- The dashboard still includes deterministic local scoring for immediate visibility.
- OpenAI analysis requires `OPENAI_API_KEY`; without it, webhook jobs are stored as failed until the key is added.
- No app-user/customer database is used in the sandbox version; local storage is limited to agent parameters and call-analysis outcomes keyed by HighLevel IDs.

## Team Of One Notes

- **Product:** focused the MVP on the validation flywheel: transcript ingestion, issue detection, and immediate recommended action.
- **Design:** used an operational dashboard layout with scannable metrics, filters, review queue, and action list.
- **Engineering:** separated HighLevel API access, analysis logic, demo data, and UI rendering into small modules.
- **QA:** token/scope verification was tested against the sandbox API; remaining QA should include calls with real Voice AI transcripts and webhook delivery tests.
