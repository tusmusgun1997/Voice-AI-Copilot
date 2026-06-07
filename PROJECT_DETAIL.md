# HighLevel Voice AI Observability Copilot

## Project Summary

The Voice AI Observability Copilot is a HighLevel-integrated dashboard for reviewing Voice AI agent performance from real call transcripts.

The app helps teams move from raw call logs to actionable review items. It fetches agents, calls, prompts, and transcripts from HighLevel, evaluates calls against configurable observability parameters, and surfaces clear human actions such as customer follow-up, escalation, prompt improvement, or parameter updates.

Observability parameters are reusable evaluation checklists that define what a successful call should include for a specific type of Voice AI agent. For example, a home renovation lead agent may be checked on whether it captured the renovation need, urgency, contact details, and a clear next step. These parameters are created as versioned checklists in the app and then attached to a HighLevel agent using that agent's HighLevel ID.

When a new call is completed, a webhook or manual analyze action triggers the backend analysis flow. The backend fetches the call transcript, agent prompt, and call context from HighLevel, loads the observability parameter version attached to that agent, and asks the LLM to evaluate the call against those checks. The result is stored as parameter-level pass/fail outcomes and human-review actions.

The main goal is to close the loop between:

1. Voice AI calls happening in HighLevel.
2. Transcript-level performance analysis.
3. Agent-specific observability checks.
4. Human review actions and system improvement suggestions.

## HighLevel Setup

The project was developed and tested using a HighLevel Marketplace sandbox setup.

### Setup Flow

1. Created a HighLevel Marketplace Developer account.
2. Created a private Marketplace app.
3. Created a sandbox/test agency account from the Developer Portal.
4. Created a sandbox sub-account/location inside HighLevel.
5. Created Voice AI agents and test calls inside the sandbox.
6. Configured the app as a Marketplace custom page so it can open inside the HighLevel interface.
7. Added OAuth/client credentials for the Marketplace app flow.
8. Used the HighLevel APIs to fetch Voice AI agents, call logs, and transcripts.
9. Connected the app to a deployed/local frontend URL for demo access.

### HighLevel Integration Approach

The app is designed as a HighLevel Marketplace app with a custom page.

This means the user can access the dashboard from inside HighLevel, while the app itself runs as a separate Vue and Node.js application. HighLevel remains the source of truth for operational data such as agents, calls, transcripts, prompts, and location details.

## Product Flow

### 1. Overview

The Overview page gives a simple operational snapshot of the Voice AI review workflow.

It highlights recent activity, open actions, and important call review items without overwhelming the user with too many metrics.

### 2. Agents

The Agents page lists Voice AI agents fetched from HighLevel.

Each agent has a detail page where the reviewer can see:

- Agent information.
- Prompt and configuration context.
- Attached observability parameter version.
- Agent-specific actions.

The app does not duplicate HighLevel agent data in the database. It links custom review configuration to the HighLevel agent ID.

### 3. Observability

The Observability section manages reusable LLM parameter versions.

Each version is a checklist that defines how calls should be evaluated. Parameters include:

- Parameter title.
- Description for LLM analysis.
- Success signal hints.
- Failure signal hints.
- Suggested action when missed.
- Prompt/script guidance.

These versions can be attached to agents, so different agents can be judged against different goals.

### 4. Calls

The Calls page fetches call logs from HighLevel.

Each call opens into a dedicated call detail page with tabs for:

- Transcript.
- LLM summary.
- Parameter results.
- Actions.

The parameter results show whether each observability check passed, failed, was unknown, or was not applicable.

### 5. Actions

The Actions section is split into two categories:

- Customer actions: caller-facing follow-up such as calling back, answering a question, or escalating an issue.
- System actions: internal improvements such as updating a prompt, improving an agent profile, or refining observability parameters.

The human reviewer can decide whether to apply, complete, ignore, or delete actions. The LLM suggests actions, but the human stays in control.

## Analysis Flow

The analysis flow is designed to be asynchronous.

1. A call is completed in HighLevel.
2. A webhook or manual analyze action creates an analysis job.
3. The backend fetches the call transcript and agent context from HighLevel.
4. The backend loads the observability parameter version attached to that agent.
5. The LLM evaluates the transcript using structured output.
6. The backend stores the analysis result, parameter results, and actions.
7. The frontend shows the results on the call, agent, and actions pages.

The LLM is instructed to create actions only when human review or system improvement is actually needed.

## Data Ownership

HighLevel stores:

- Voice AI agents.
- Agent prompts.
- Call logs.
- Call transcripts.
- Location/sub-account data.

The app database stores:

- Marketplace installation reference.
- Observability parameter versions.
- Agent-to-parameter-version attachments.
- Call analysis jobs.
- Parameter-level analysis results.
- Human actions generated from analysis.

This keeps the app lightweight and avoids duplicating data that already exists in HighLevel.

## Tech Stack

### Frontend

- Vue 3.
- Vite.
- Geist font.
- Lucide icons.
- Modular component-based UI.

### Backend

- Node.js.
- Express.js.
- HighLevel API integration.
- OAuth-ready Marketplace app flow.
- Async call analysis queue.
- Structured LLM analysis service.

### Database

- Supabase Postgres.
- Stores only custom observability and analysis data.
- HighLevel IDs are used to link app data back to agents and calls.

### AI Layer

- OpenAI LLM integration.
- Structured JSON output for predictable analysis.
- Parameter-by-parameter call evaluation.
- Action generation for customer follow-up and system improvements.

## Key Design Decisions

### HighLevel As Source Of Truth

The app does not try to replace HighLevel. It adds an observability layer on top of HighLevel data.

### Agent-Specific Evaluation

Each Voice AI agent can have different responsibilities, so each agent can be attached to a different observability parameter version.

### Human-In-The-Loop Actions

The system suggests actions, but a human reviewer decides whether to apply, ignore, complete, or delete them.

### Explainable Analysis

Instead of only showing a generic score, the app shows parameter-level results so reviewers can understand exactly why a call was flagged.

## Current Demo Scope

Functional in the demo:

- HighLevel sandbox integration.
- Voice AI agent listing.
- Call log and transcript review.
- Reusable observability parameter versions.
- Agent-to-parameter attachment.
- LLM-based call analysis flow.
- Parameter-level pass/fail results.
- Customer and system action queues.
- Supabase-backed custom app data.

Still future-facing:

- Production OAuth token storage for multiple real customers.
- Full webhook hardening and retry monitoring.
- Team/user permissions.
- Deeper analytics over long-term call history.
- Direct prompt update automation after human approval.

## Local Run

Install dependencies:

```bash
npm install
```

Run frontend and backend locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Environment Variables

The app expects environment variables for:

- HighLevel API base URL and version.
- HighLevel location ID.
- HighLevel private integration token or OAuth credentials.
- OpenAI API key and model.
- Supabase URL and service role key.
- Supabase database connection string for schema setup.

Secrets are not committed to the repository and should be configured in `.env` locally or in the hosting provider environment settings.

## Team Of One Ownership

This project was handled end-to-end across product, design, engineering, and QA.

Product focus:

- Turn transcript review into a clear review workflow.
- Keep the UI centered around agents, calls, observability, and actions.

Design focus:

- Simple operational dashboard.
- Minimal left navigation.
- Dedicated detail pages for agents and calls.
- Clear separation between customer actions and system actions.

Engineering focus:

- Modular Vue frontend.
- Express backend with routes, controllers, services, and utility layers.
- HighLevel API integration.
- Supabase-backed custom data model.
- Structured LLM analysis pipeline.

QA focus:

- Tested with HighLevel sandbox agents and calls.
- Verified that deleted agents are not treated as active agents.
- Verified parameter attachment and call analysis flow.
- Verified that actions are generated only when review is needed.
