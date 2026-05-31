# Agent Observability Parameters Plan

This plan covers the next product step: letting users configure observability parameters per Voice AI agent inside our app, then using those parameters to evaluate each call transcript.

## 1. Goal

The Copilot should not judge every agent with the same generic checklist.

Each agent should have its own observability profile based on:

- agent role
- agent objective
- script/prompt expectations
- required caller outcome
- escalation rules
- business-specific risks

The product loop becomes:

```text
Agent script/goal
  -> observability parameters
  -> call transcript evaluation
  -> issues and recommendations
  -> prompt/script adjustment
```

## 2. Current State

Today, HighLevel provides:

- agents
- call logs
- transcripts/messages
- summaries
- duration
- executed call actions

Our app currently analyzes calls using a default rule-based profile in `server/agentGoals.js`.

The app already supports custom goal profiles from:

```text
config/agent-goals.json
```

But there is no UI yet for users to edit these per-agent parameters.

## 3. New Product Requirement

Add a local settings experience where each agent can have its own observability profile.

For each agent, the user should be able to define:

- agent role and objective
- success criteria
- KPI weights
- required behaviors
- failure behaviors
- negative signals
- escalation rules
- recommendation guidance
- human review triggers

These settings will live in our app for now, not in HighLevel.

Later, an LLM will use these same settings as the evaluation rubric for every call.

## 4. UI Design

Add an **Observability Parameters** section inside the existing agent side panel.

Recommended location:

- Agents page
- Click agent
- Right side panel opens
- Add section after `Agent role & objective`

### Section Layout

```text
Observability Parameters

Profile name
Script summary
Primary goals
Negative signals

KPI Checks
  - Clear opening
  - Need qualification
  - Next step offered
  - Outcome confirmed
  - Escalation handled

[Add KPI]
[Save parameters]
```

### KPI Row Fields

Each KPI should have:

- Label
- Category
- Weight
- Expected behavior
- Failure behavior
- Pass signals
- Fail/risk signals
- Recommendation
- Use Action type

Example:

```text
Label: Next step offered
Weight: 25
Expected behavior: Agent offers appointment, callback, quote, transfer, or specific follow-up.
Failure behavior: Agent ends call with vague language and no concrete next step.
Pass signals: book, schedule, quote, callback, appointment
Use Action: Script training
```

## 5. Data Model

Create local profile storage.

Recommended file:

```text
data/agent-observability-profiles.json
```

Shape:

```json
{
  "profiles": [
    {
      "id": "profile_appointment_intake",
      "agentIds": ["89w8BhdDot7ZJMWK5JCA-agent-id"],
      "agentNames": ["My First Agent"],
      "name": "Appointment Intake Observability",
      "scriptSummary": "Qualify caller, offer appointment, and confirm next step.",
      "goals": [
        "Understand caller need",
        "Offer a concrete next step",
        "Confirm the outcome"
      ],
      "negativeSignals": [
        "frustrated",
        "call back later",
        "not helpful",
        "billing",
        "charged"
      ],
      "criteria": [
        {
          "id": "nextStep",
          "label": "Next step offered",
          "category": "conversion",
          "weight": 25,
          "expectedBehavior": "Agent offers a specific appointment, callback, quote, or transfer.",
          "failureBehavior": "Call ends without a clear next action.",
          "keywordsAny": ["book", "schedule", "appointment", "quote", "callback"],
          "allowExecutedAction": true,
          "useActionType": "Script training",
          "issue": "Call ended without a concrete next step.",
          "recommendation": "Train the agent to offer a specific next step before closing.",
          "promptPatch": "Before ending the call, offer one concrete next action and confirm it with the caller."
        }
      ]
    }
  ]
}
```

## 6. Backend Plan

Add profile management APIs:

```text
GET    /api/agent-observability-profiles
GET    /api/agent-observability-profiles/:agentId
PUT    /api/agent-observability-profiles/:agentId
POST   /api/agent-observability-profiles/:agentId/criteria
DELETE /api/agent-observability-profiles/:agentId/criteria/:criterionId
```

For now, these APIs can read/write JSON locally.

Later, this can move to:

- database
- account-level HighLevel custom storage, if available
- app backend storage keyed by company/location/agent

## 7. Analysis Flow With Local Parameters

When `/api/observability` runs:

1. Fetch HighLevel agents.
2. Fetch call logs.
3. Load local observability profiles.
4. Match each call to profile by `agentId` first, then `agentName`.
5. Evaluate transcript using that profile.
6. Produce score, issues, recommendations, and use actions.

Current matching logic already exists conceptually in:

```text
getAgentGoalProfile(goalProfiles, call)
```

We should rename the concept from `goalProfiles` to `observabilityProfiles` over time.

## 8. Rule-Based Evaluation Now

For the local prototype, keep the current deterministic evaluation.

Each criterion can still use:

- `keywordsAny`
- `requiredWhenAny`
- `passWhenAny`
- `allowExecutedAction`
- `weight`
- `negativeSignals`

This gives us:

- transparent scoring
- easy debugging
- no LLM cost
- predictable demo behavior

Scoring remains:

```text
score = 100 - missed KPI weights - negative signal penalty
```

Severity remains explainable:

```text
critical = high-weight KPI failed OR score < 60
warning = lower-weight KPI failed
info = data quality / non-risk item
```

## 9. LLM Evaluation Later

Later, replace or supplement keyword matching with an LLM judge.

The LLM should receive:

- agent role/objective
- observability profile
- KPI criteria
- transcript
- call metadata

The LLM should return structured JSON only:

```json
{
  "score": 72,
  "criteria": [
    {
      "id": "qualification",
      "passed": true,
      "confidence": "high",
      "evidence": "Caller asked about availability and agent asked preferred time.",
      "reason": "Agent gathered timing preference before offering a next step."
    },
    {
      "id": "confirmation",
      "passed": false,
      "confidence": "medium",
      "evidence": "Agent said someone will follow up but did not confirm owner or timeframe.",
      "reason": "No concrete confirmation was provided."
    }
  ],
  "issues": [
    {
      "criterionId": "confirmation",
      "severity": "warning",
      "message": "Outcome was not confirmed back to caller.",
      "recommendation": "Add a closing confirmation with owner and timeframe.",
      "promptPatch": "Before ending, repeat the next action, owner, and expected timeframe."
    }
  ],
  "missedOpportunities": [
    {
      "type": "conversion",
      "label": "Caller showed booking intent but was not offered a specific slot.",
      "severity": "critical"
    }
  ]
}
```

## 10. Hybrid Evaluation Recommendation

Best path:

1. Keep rule-based checks for clear hard signals.
2. Add LLM evaluation for semantic checks.
3. Combine both into final score.

Example:

```text
Rule engine:
  - transcript missing
  - executed action detected
  - obvious keywords
  - known risk phrases

LLM judge:
  - did the agent actually understand intent?
  - was the response appropriate?
  - was the next step concrete?
  - was escalation handled well?
  - was the call aligned with the script?
```

This is stronger than pure keyword matching and more controllable than pure LLM scoring.

## 11. Recommended Implementation Steps

### Step 1: Create Local Profile Storage

Add:

```text
data/agent-observability-profiles.json
```

Seed it from current default profile.

### Step 2: Add Backend Profile Service

Create:

```text
server/observabilityProfiles.js
```

Responsibilities:

- read profiles
- write profiles
- create default profile for an agent
- validate criteria
- merge defaults

### Step 3: Add API Routes

Add profile CRUD routes in `server/index.js`.

### Step 4: Add UI Section In Agent Drawer

Inside `AgentDrawer.vue`, add:

- profile name
- summary
- goals
- KPI list
- edit button
- save button

### Step 5: Use Profiles In Dashboard Analysis

Change `/api/observability` to load local profiles and pass them into `buildObservabilityDashboard`.

### Step 6: Add LLM Adapter Later

Create:

```text
server/evaluators/ruleEvaluator.js
server/evaluators/llmEvaluator.js
server/evaluators/hybridEvaluator.js
```

The dashboard should not care which evaluator produced the result.

## 12. UI Principles

The parameter editor should feel like a builder, not a config file.

Good UI:

- simple agent-specific profile
- editable KPI rows
- clear weights
- examples of pass/fail behavior
- one-click save
- visible "used in scoring" state

Avoid:

- huge JSON editor as primary UI
- too many fields at once
- making users understand backend schema
- hiding which criteria produced failures

## 13. Demo Narrative

For the demo, we can say:

> Each Voice AI agent can have its own observability profile. The profile defines what success means for that agent: what it must ask, what outcome it should create, when it should escalate, and which failure patterns matter. Calls are then evaluated against that agent-specific profile, producing scores, issues, recommendations, and use actions.

And for current vs future:

> The current prototype uses an explainable rule-based evaluator. The next step is to plug in an LLM evaluator that uses the same profile as a rubric for deeper transcript understanding.

## 14. Open Product Decisions

- Should profiles be account-level or location-level?
- Should profile changes affect historical calls immediately or only future analysis?
- Should users be able to version profiles?
- Should LLM evaluations be cached per call/profile version?
- Should recommendations automatically update the HighLevel agent prompt, or only suggest changes?

## 15. Proposed First Version

For the first local implementation:

- Store profiles locally in JSON.
- Add a profile editor inside the agent drawer.
- Support editing:
  - profile name
  - script summary
  - goals
  - negative signals
  - KPI label
  - KPI weight
  - pass keywords
  - recommendation
  - prompt patch
- Keep rule-based scoring.
- Re-run analysis on refresh using the saved profile.

This gets us a complete local loop:

```text
Set agent parameters
  -> refresh dashboard
  -> analyze calls using those parameters
  -> view recommendations
  -> update agent prompt/script
```
