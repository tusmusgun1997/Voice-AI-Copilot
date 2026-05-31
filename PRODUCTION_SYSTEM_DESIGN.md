# Local System Design: HighLevel Voice AI Observability Copilot

This is the simplified design for the current local/demo version. We are **not building full production persistence yet**.

The key decision: **HighLevel stays the source of truth** for agents, calls, transcripts, prompts, contacts, and call metadata. Our app stores only the custom observability configuration we create and lightweight call-analysis outcomes keyed by HighLevel IDs.

## 1. What We Store Locally

We only store data that does not already exist in HighLevel.

```text
agent_observability_profiles
- locationId
- agentId
- profileId
- profileName
- agentObjective
- goals
- riskSignals
- parameters[]
```

Each parameter is user-created inside our app:

```text
parameter
- id
- title
- descriptionForLLM
- successSignalHints
- failureSignalHints
- recommendationWhenMissed
- promptGuidance
- requiresHumanReview
- useActionType
- enabled
```

For the local app, this can remain in:

```text
data/agent-observability-profiles.json
```

We also store local analysis results created by webhook/sandbox sync jobs:

```text
call_analysis_results
- locationId
- agentId
- callId
- jobId
- status: queued | running | retrying | succeeded | failed | skipped
- stage: analysis_pending | waiting_for_call_log | waiting_for_transcript | healthy | monitor | needs_review | human_follow_up | script_training | analysis_failed
- score
- summary
- parameterResults[]
- recommendations[]
- useActions[]
- attempts
- nextRetryAt
```

For the local app, this remains in:

```text
data/call-analysis-results.json
```

Later, this same structure can move to Postgres, but we do not need that now.

## 2. What We Do Not Store

We should not store these locally right now:

- Full agents
- Full call logs
- Full transcripts
- Contact records
- Agent prompts
- Voice AI configuration
- App users/RBAC/install ownership

Instead, we store only the HighLevel IDs needed to fetch them again:

```text
locationId
agentId
callId
```

When the dashboard opens, or when a webhook tells us something changed, we use those IDs to fetch the latest data from the HighLevel API.

## 3. Runtime Data Flow

```text
Frontend opens inside HighLevel
        |
        v
Backend reads local env/OAuth context
        |
        v
Fetch agents + calls from HighLevel API
        |
        v
Fetch local parameters by locationId + agentId
        |
        v
Analyze calls in memory
        |
        v
Return dashboard payload to frontend
```

For now, deterministic analysis can happen on demand when `/api/observability` is called. LLM analysis runs asynchronously from webhook or sandbox sync events and is saved locally by `callId`.

## 4. Agent Flow

Each HighLevel Voice AI agent has an ID.

```text
HighLevel agent
- agentId
- name
- prompt
- welcomeMessage
- settings
```

Our local app only stores:

```text
agentId -> observability parameters
```

So when the user opens an agent:

1. Fetch agent list from HighLevel.
2. Display agent name from HighLevel.
3. If user opens Prompt, fetch/display prompt from HighLevel data.
4. If user opens Parameters, read/write our local parameters for that `agentId`.
5. If user opens Details, display current HighLevel agent metadata.

## 5. Call Flow

Each call also has a HighLevel call/log ID.

```text
HighLevel call
- callId
- agentId
- contactId
- transcript
- duration
- createdAt
- status
```

Our app should not save the full call. It should use:

```text
callId + agentId + locationId
```

Then:

1. Fetch calls from HighLevel.
2. Match each call to its `agentId`.
3. Load custom parameters for that `agentId`.
4. Analyze transcript in memory.
5. Return live call data plus any stored LLM analysis outcome to the UI.

If the same call is viewed again, we re-fetch the call from HighLevel and attach the stored LLM result by `callId`.

## 6. Webhook Flow For Local/Demo

When HighLevel sends a webhook for a new Voice AI call:

```text
HighLevel webhook
        |
        v
POST /api/webhooks/voice-ai-call-end
        |
        v
Read locationId + agentId + callId from payload
        |
        v
Fetch call details/transcript from HighLevel API
        |
        v
Load local parameters for agentId
        |
        v
Analyze with OpenAI in a background job
        |
        v
Store lightweight result by callId + agentId
```

For now, the webhook endpoint returns `202 accepted` and uses an in-memory queue plus local JSON result storage. We do **not** need app-user storage or a production database yet.

Minimum local webhook payload we care about:

```text
locationId
agentId
callId
eventType
timestamp
```

If transcript is not ready yet:

1. Return `202 accepted`.
2. Mark the job as `retrying`.
3. Retry after a short delay until the call log/transcript is available or the max attempts are reached.

For sandbox testing, `POST /api/call-analyses/sync-latest` can scan recent HighLevel calls and enqueue any call that does not have a local analysis result yet.

## 7. Auth For Current Local Version

For the local demo, keep auth simple:

- Use the current `.env` token or OAuth test install token.
- Use `GHL_LOCATION_ID` to know which HighLevel location we are working with.
- Do not create app users yet.
- Do not build multi-user RBAC yet.
- Do not store customer/contact records locally.

Current local identity model:

```text
local app instance
  -> one HighLevel locationId
  -> one set of API credentials
  -> many HighLevel agents/calls fetched live
  -> local custom parameters keyed by agentId
```

## 8. What The Backend Should Own

The backend should own only:

- HighLevel API calls.
- Local parameter persistence.
- Analysis orchestration.
- Webhook receiving.
- Local call-analysis result storage keyed by HighLevel IDs.
- OAuth callback handling for sandbox install.

The backend should not become a duplicate HighLevel database.

## 9. Local API Shape

Useful endpoints for this version:

```text
GET /api/observability
GET /api/call-logs
GET /api/call-analyses
GET /api/analysis-jobs
POST /api/call-analyses/sync-latest
GET /api/agent-observability-profiles/:agentId
PUT /api/agent-observability-profiles/:agentId
POST /api/webhooks/voice-ai-call-end
GET /api/oauth/callback
```

The main endpoint remains:

```text
GET /api/observability
```

It should:

1. Fetch agents from HighLevel.
2. Fetch calls from HighLevel.
3. Load local parameters by `agentId`.
4. Analyze transcripts.
5. Attach stored LLM results by `callId`.
6. Return the dashboard payload.

## 10. Later Production Upgrade

Only when we move beyond local/demo, we can add:

- Database for installs and parameters.
- Encrypted OAuth token storage per installed location.
- Durable webhook event table and background workers.
- Queue workers for async transcript analysis.
- User accounts and roles.
- Cached analysis results.

But for now, the lean design is:

```text
HighLevel owns operational data.
Our app owns observability parameters and lightweight analysis outcomes.
Analysis is computed from live HighLevel data + local parameters.
```
