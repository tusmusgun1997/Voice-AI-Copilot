# Voice AI Observability Copilot

A HighLevel Voice AI observability suite that monitors call transcripts, scores agent performance against KPI checkpoints, and surfaces recommendations for prompt, script, and human follow-up improvements.

## What This Builds

- **Monitor loop:** fetches Voice AI call logs from a HighLevel sandbox location and analyzes transcript behavior against configured success criteria.
- **Analyze loop:** provides a Vue dashboard with agent scores, issue queues, recommendation summaries, and "Use Actions" for calls that need human review or script training.
- **Integration path:** designed to run as a HighLevel Marketplace app custom page or a sandbox custom menu link.

## Stack

- **Backend:** Node.js, Express
- **Frontend:** Vue 3, Vite
- **Persistence:** local JSON by default, optional Supabase Postgres for demo hosting
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
DATA_STORE=json
LOCAL_DATA_FILE=data/app-data.json
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
SUPABASE_INSTALLATION_NAME=Voice AI Test Location
SUPABASE_IS_SANDBOX=true
USE_DEMO_DATA_WHEN_EMPTY=true
SHOW_DELETED_AGENT_CALLS=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
ANALYSIS_JOB_MAX_ATTEMPTS=5
ANALYSIS_JOB_RETRY_DELAY_MS=12000
```

Set `GHL_CALL_TYPE=TRIAL` when you want the dashboard to focus on sandbox Web Call / test-call logs. Leave it blank or use `LIVE` for production phone calls.

Set `SHOW_DELETED_AGENT_CALLS=false` to hide historical HighLevel call logs whose agent no longer exists in the live Voice AI agent list.

For Supabase storage, run the SQL in `database/supabase-demo-schema.sql`, set `DATA_STORE=supabase`, and fill `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. Keep the service-role key backend-only. If you want to apply the schema from the repo, set `SUPABASE_DB_URL` temporarily and run `npm run db:schema`.

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

## Useful API Routes

```text
GET /api/health
GET /api/call-logs
GET /api/call-analyses
GET /api/call-analyses/:callId
POST /api/call-analyses/:callId/analyze
GET /api/analysis-jobs
GET /api/observability
POST /api/webhooks/voice-ai-call-end
```

`/api/observability` returns the normalized dashboard payload used by the Vue frontend.

`POST /api/call-analyses/:callId/analyze` lets the UI enqueue LLM review for one selected call. `POST /api/webhooks/voice-ai-call-end` uses the same worker for webhook-driven analysis. The worker fetches the call from HighLevel by `callId`, loads the agent's observability parameters, asks OpenAI for a structured judgment, and stores the lightweight result in the configured data store.

For local development, app-managed data is stored in one JSON file: `data/app-data.json`. It contains `profiles`, `versions`, and `analyses`. For hosted demos, set `DATA_STORE=supabase` to use Supabase Postgres tables instead.

## HighLevel Integration

For the MVP demo:

1. Deploy or run the app so HighLevel can reach a public frontend URL.
2. In the Marketplace app, add a **Custom Page** pointing to that public frontend URL.
3. In **Advanced Settings > Auth**, add the OAuth redirect URL as `<public-url>/api/oauth/callback`.
4. In **Manage > Secrets**, create/copy the Client ID and Client Secret, then add them to `.env`.
5. Set `GHL_OAUTH_REDIRECT_URL` in `.env` to the exact same redirect URL configured in HighLevel.
6. Add the required scopes, save the app, and create/update a testable app version.
7. Install the private app into the sandbox location using the Developer Portal test link.

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
- No app-user/customer database is used in the sandbox version; app storage is limited to agent parameters and call-analysis outcomes keyed by HighLevel IDs.

## Team Of One Notes

- **Product:** focused the MVP on the validation flywheel: transcript ingestion, issue detection, and immediate recommended action.
- **Design:** used an operational dashboard layout with scannable metrics, filters, review queue, and action list.
- **Engineering:** separated HighLevel API access, analysis logic, demo data, and UI rendering into small modules.
- **QA:** token/scope verification was tested against the sandbox API; remaining QA should include calls with real Voice AI transcripts and webhook delivery tests.
