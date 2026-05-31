# Core Functionality Product Design

This document thinks through the Voice AI Observability Copilot from a product point of view. The goal is to design a useful observability layer for HighLevel Voice AI agents, not just a transcript viewer.

## 1. Product Goal

HighLevel users should be able to answer these questions quickly:

- Are my Voice AI agents doing their job?
- Which agents are failing most often?
- Which calls need human review?
- What prompt, script, or agent settings should I adjust?
- Did recent calls follow the agent's intended goals?

The product should close the loop:

```text
Call transcript
  -> KPI analysis
  -> failure detection
  -> recommendation
  -> human/script action
  -> improved future calls
```

## 2. Primary Users

### Agency Owner

Wants a cross-client or cross-location view of whether Voice AI is helping or hurting customer experience.

Needs:

- quick health summary
- agent comparison
- severe issue count
- proof that Voice AI is improving

### Operations Manager

Responsible for reviewing calls and improving scripts.

Needs:

- issue queue
- call snippets
- suggested prompt/script updates
- missed opportunities
- human follow-up actions

### Voice AI Builder

Creates and tunes Voice AI agents.

Needs:

- goal-by-goal scoring
- failed criteria
- transcript examples
- recommended prompt changes
- before/after testing loop

## 3. Core Product Loops

## Monitor Loop

The Monitor loop watches calls and checks whether each agent followed its intended behavior.

### Inputs

- Voice AI call logs
- transcripts
- summaries
- agent ID
- contact ID
- call duration
- executed call actions
- agent goals/script configuration

### Processing

For each call, the app should:

1. Normalize transcript format.
2. Identify speaker turns.
3. Match the call to the correct agent goal profile.
4. Score each KPI/check.
5. Detect failures, deviations, and missed opportunities.
6. Extract transcript snippets that support each finding.
7. Generate recommendations and Use Actions.

### Outputs

- call score
- passed/failed criteria
- issue severity
- recommendation
- human review action
- script training action
- agent-level rollups

## Analyze Loop

The Analyze loop turns individual call findings into a dashboard that helps users prioritize action.

### Dashboard should answer:

- Which agents are underperforming?
- Which KPI fails most often?
- Which calls are urgent?
- What exact script change should I make?
- Which calls need a human to intervene?

### Outputs

- agent performance table
- issue queue
- Use Actions queue
- goal/KPI breakdown
- recommendations
- trend/volume indicators

## 4. Observability Parameters

Observability should not be generic forever. It should be based on the agent's real goal.

Each agent should have a goal profile:

```json
{
  "agentId": "agent_id",
  "name": "Appointment Intake Agent",
  "scriptSummary": "Qualify caller, offer appointment, confirm next step.",
  "goals": [
    "Understand caller need",
    "Collect contact details",
    "Offer appointment",
    "Confirm next step"
  ],
  "criteria": [
    {
      "id": "qualification",
      "label": "Need captured",
      "weight": 25,
      "expectedBehavior": "Agent asks what service the caller needs.",
      "failureBehavior": "Agent answers too early or does not clarify need."
    }
  ]
}
```

## 5. KPI Categories

Recommended KPI categories:

### Opening

Checks whether the agent clearly greeted and oriented the caller.

Failure examples:

- no greeting
- wrong business name
- confusing first message
- robotic or abrupt opening

### Qualification

Checks whether the agent understood the caller's need.

Failure examples:

- did not ask what the caller needs
- skipped urgency/time preference
- gave pricing before qualifying
- failed to collect context

### Contact Capture

Checks whether required details were collected.

Failure examples:

- no phone/email collected
- caller gave incomplete details but agent accepted them
- agent did not confirm contact info

### Next Step

Checks whether the call ended with a clear action.

Failure examples:

- no appointment offered
- vague "someone will call you"
- no timeframe
- no owner assigned
- no booking/transfer/follow-up action

### Confirmation

Checks whether the agent repeated the outcome.

Failure examples:

- appointment not repeated
- callback not confirmed
- next step unclear
- no summary before closing

### Escalation

Checks whether risky calls were routed to a human.

Failure examples:

- billing complaint not escalated
- angry caller dismissed
- urgent request not prioritized
- legal/medical/financial concern handled by bot

### Compliance / Policy

Checks whether the agent stayed within safe boundaries.

Failure examples:

- promised unavailable service
- gave inaccurate pricing
- made unsupported guarantees
- collected sensitive information unnecessarily

### Sentiment / Experience

Checks whether the caller experience degraded.

Failure examples:

- caller repeats themselves
- caller sounds frustrated
- agent loops or misunderstands
- call ends unresolved

## 6. Cases The App Should Handle

## Case 1: Good Call

Signals:

- agent greets clearly
- qualifies need
- offers next step
- confirms outcome
- no unresolved risk

App behavior:

- high score
- status `healthy`
- no critical Use Actions
- recommendation: keep current script path

## Case 2: Missed Booking Opportunity

Signals:

- caller shows intent
- asks availability/pricing
- agent answers but does not ask to book

App behavior:

- fail `nextStep`
- show snippet where caller expressed intent
- recommendation: add appointment-offer branch
- Use Action: script training

## Case 3: Caller Needs Human Help

Signals:

- billing issue
- complaint
- refund request
- angry/frustrated caller
- repeated confusion

App behavior:

- fail `escalation`
- severity `critical`
- Use Action: human handoff
- recommendation: add escalation rule

## Case 4: Agent Collects Data But Does Not Confirm

Signals:

- caller gives phone/email/date
- agent does not repeat or verify

App behavior:

- fail `confirmation`
- recommendation: add confirmation line
- show snippet with collected detail

## Case 5: Call Has No Transcript

Reasons:

- call still processing
- failed transcription
- API returned incomplete data

App behavior:

- show call as `pending analysis`
- do not assign harsh score
- retry later
- display "Transcript unavailable"

## Case 6: Very Short Call

Signals:

- call duration under threshold
- no meaningful transcript

App behavior:

- classify as `incomplete`
- separate from normal failures
- show possible reasons: hangup, voicemail, test call
- avoid over-recommending script changes

## Case 7: Wrong Agent Goal Profile

Signals:

- unknown agent ID
- no matching custom config

App behavior:

- use default profile
- mark profile as `Default`
- suggest creating a custom goal profile

## Case 8: Multiple Agents

Signals:

- call logs from many agent IDs

App behavior:

- group by agent
- show average score
- show most common failed KPI
- allow filtering by agent

## Case 9: High Call Volume

Signals:

- hundreds/thousands of calls

App behavior:

- paginate calls
- show aggregate dashboard first
- prioritize critical actions
- avoid loading full transcripts until needed

## Case 10: Duplicate Logs

Reasons:

- webhook and polling both ingest same call
- retries

App behavior:

- deduplicate by call ID
- latest analysis wins
- avoid duplicate Use Actions

## Case 11: Test Calls vs Live Calls

Signals:

- `TRIAL` calls from Web Call testing
- `LIVE` calls from real phone numbers

App behavior:

- allow call type filter
- visually indicate trial/live mode
- default sandbox to `TRIAL`
- default production to `LIVE`

## Case 12: Recommendation Confidence Is Low

Signals:

- transcript is messy
- caller speech is unclear
- KPI evidence is weak

App behavior:

- show low-confidence marker
- avoid aggressive recommendation
- ask for human QA review

## 7. Use Actions

Use Actions are the most important output because they turn analysis into work.

Types:

### Human Handoff

Used when a person should contact the caller.

Examples:

- billing complaint
- frustrated customer
- urgent support issue
- incomplete appointment booking

### Script Training

Used when the agent needs prompt/script improvement.

Examples:

- no appointment offer
- weak qualification
- no confirmation
- vague closing language

### QA Review

Used when the call should be manually audited.

Examples:

- low confidence
- unusual transcript
- repeated misunderstanding
- compliance concern

### Agent Goal Update

Used when the current observability profile does not match real behavior.

Examples:

- new agent created
- wrong goal profile
- business changed script

## 8. Recommendation Design

Recommendations should be immediate and specific.

Bad recommendation:

```text
Improve the agent script.
```

Good recommendation:

```text
Add a required booking branch after pricing questions:
"I can help you schedule that. Would morning or afternoon work better?"
```

Each recommendation should include:

- issue detected
- supporting transcript snippet
- why it matters
- suggested script/prompt change
- expected improvement

## 9. Dashboard Design

## Overview

Purpose:

Show high-level system health.

Should include:

- total monitored calls
- average score
- critical issues
- Use Actions count
- agent performance summary
- latest calls

## Calls

Purpose:

Inspect individual calls.

Should include:

- call score
- contact
- agent
- duration
- summary
- passed/failed criteria
- transcript preview

## Issues

Purpose:

Prioritize failures.

Should include:

- severity
- failed KPI
- recommendation
- transcript snippet
- agent/contact/date

## Actions

Purpose:

Show work queue.

Should include:

- action type
- reason
- snippet
- owner/status in future
- call link

## Goals

Purpose:

Make observability transparent.

Should include:

- active goal profiles
- scoring criteria
- weights
- associated agents
- script summary

## Setup

Purpose:

Help with debugging and demo readiness.

Should include:

- data source
- location ID
- live record count
- generated timestamp
- API errors

## 10. Severity Model

Suggested severity levels:

### Healthy

No major issue. Call met expected behavior.

### Warning

Something was missed, but caller risk is low.

Examples:

- weak confirmation
- minor qualification gap

### Critical

Likely business impact or customer experience risk.

Examples:

- no next step for high-intent caller
- angry caller not escalated
- appointment request ignored
- compliance risk

## 11. Scoring Model

Each goal profile has weighted criteria.

Example:

```text
Opening: 10%
Qualification: 25%
Next Step: 30%
Confirmation: 20%
Escalation: 15%
```

Call score:

```text
100 - missed criterion weights - penalty signals
```

Status:

```text
80-100: healthy
60-79: watch
0-59: attention
```

Future improvement:

- use confidence score
- trend score by agent
- compare before/after prompt changes

## 12. Data States

The app should clearly handle:

```text
Loading
No calls yet
Live HighLevel data available
Demo data mode
API error
OAuth connected
OAuth failed
Transcript pending
Transcript unavailable
Unknown agent
```

Each state should tell the user what is happening and what to do next.

## 13. Real-Time vs Batch

## Batch / Polling

Current behavior:

- backend fetches call logs from HighLevel API
- dashboard analyzes current results

Good for:

- MVP
- demo
- historical analysis

## Real-Time / Webhook

Future behavior:

- HighLevel sends `VoiceAiCallEnd` webhook
- backend stores call event
- dashboard updates without manual refresh

Good for:

- real observability
- immediate human handoff
- alerts

## 14. Future Production Design

For production, the app should move from local PIT to real OAuth storage.

Current sandbox:

```text
One fixed location ID
One sandbox PIT
Temporary tunnel URL
Local machine backend
```

Production:

```text
Stable hosted backend
OAuth install per location/company
Encrypted token storage
Database for calls and analyses
Webhook ingestion
Custom page served from stable HTTPS domain
```

## 15. Suggested Data Model

### AgentProfile

```text
id
locationId
agentId
name
scriptSummary
goals
criteria
createdAt
updatedAt
```

### CallAnalysis

```text
id
locationId
callId
agentId
contactId
score
status
summary
criteriaResults
issues
recommendations
useActions
analyzedAt
```

### UseAction

```text
id
callId
type
severity
reason
snippet
status
owner
createdAt
resolvedAt
```

## 16. Product Priorities

### Must Have

- ingest HighLevel Voice AI call logs
- analyze transcripts
- use agent goal profiles
- detect failed KPIs
- show dashboard across agents
- provide recommendations
- show Use Actions

### Should Have

- custom goal profiles per agent
- filters by agent/status/type
- clear trial/live data state
- transcript snippets
- webhook receiver

### Could Have

- trend charts
- assignment/workflow status for Use Actions
- prompt version history
- before/after improvement tracking
- AI-generated rewritten prompt blocks

### Not Now

- automatically editing HighLevel agents
- complex multi-tenant token storage
- billing/subscription logic
- public marketplace approval

## 17. Demo Narrative

The demo should tell this story:

1. A Voice AI call happened in HighLevel.
2. The Copilot ingests the transcript.
3. The call is scored against the agent's goals.
4. The dashboard shows the issue.
5. The Copilot recommends a prompt/script adjustment.
6. A Use Action shows exactly where a human or trainer should intervene.

This proves the loop:

```text
Raw transcript -> observability -> insight -> action
```

## 18. Design Principle

The dashboard should not feel like a transcript archive.

It should feel like an operational command center:

- what is broken
- why it matters
- where it happened
- what to change next

That is the product value of the Copilot.
