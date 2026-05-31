import { defaultGoalProfile, getAgentGoalProfile } from './agentGoals.js';

const MIN_ANALYZABLE_TURNS = 3;
const SHORT_CALL_SECONDS = 25;

const INTENT_WORDS = [
  'appointment',
  'available',
  'availability',
  'book',
  'buy',
  'consultation',
  'demo',
  'estimate',
  'price',
  'pricing',
  'quote',
  'schedule'
];

const HUMAN_REVIEW_CRITERIA = new Set(['escalation', 'negativeSignal', 'compliance']);

export function buildObservabilityDashboard(callLogs, goalProfiles, listedAgents = [], options = {}) {
  const profiles = goalProfiles ?? { profiles: [defaultGoalProfile], defaultProfile: defaultGoalProfile };
  const includeCallOnlyAgents = options.includeCallOnlyAgents !== false;
  const normalizedAgents = dedupeAgents(listedAgents.map(normalizeAgent));
  const agentsById = new Map(normalizedAgents.map((agent) => [agent.id, agent]));
  const normalizedCalls = dedupeCalls(callLogs.map(normalizeCall)).map((call) => enrichCallAgent(call, agentsById));
  const calls = normalizedCalls.map((call) => analyzeCall(call, getAgentGoalProfile(profiles, call)));
  const agents = buildAgentSummaries(calls, normalizedAgents, profiles, { includeCallOnlyAgents });
  const usedGoalProfiles = buildUsedGoalProfiles(calls);
  const useActions = calls.flatMap((call) => call.useActions);
  const issues = calls.flatMap((call) => flattenIssues(call));
  const recommendations = calls.flatMap((call) => flattenRecommendations(call));
  const kpiSummary = buildKpiSummary(calls);
  const dataStates = buildDataStates(calls);

  return {
    summary: {
      totalCalls: calls.length,
      analyzedCalls: calls.filter((call) => call.analysisState === 'analyzed').length,
      pendingCalls: calls.filter((call) => call.analysisState !== 'analyzed').length,
      averageScore: average(calls.map((call) => call.score).filter((score) => score !== null)),
      criticalIssues: issues.filter((issue) => issue.severity === 'critical').length,
      followUpActions: useActions.length,
      monitoredAgents: agents.length,
      topFailedKpi: kpiSummary.find((kpi) => kpi.failed > 0)?.label ?? 'No failed KPI yet'
    },
    agents,
    calls,
    issues: issues.sort(sortBySeverityAndDate),
    recommendations: recommendations.sort(sortBySeverityAndDate),
    useActions: useActions.sort(sortBySeverityAndDate),
    kpiSummary,
    dataStates,
    goalProfiles: usedGoalProfiles,
    observabilityParameters: usedGoalProfiles.flatMap((profile) =>
      profile.criteria.map(({ id, label, weight }) => ({
        id: `${profile.id}-${id}`,
        criterionId: id,
        profileId: profile.id,
        profileName: profile.name,
        label,
        weight
      }))
    )
  };
}

function normalizeCall(raw) {
  const transcript = normalizeTranscript(raw.transcript ?? raw.messages ?? raw.conversation ?? '');
  const transcriptTurns = parseTranscriptTurns(transcript);
  const fallbackName = raw.agentId ? `Agent ${raw.agentId}` : 'Voice AI Agent';
  const createdAt = raw.createdAt ?? raw.dateAdded ?? raw.startTime ?? new Date().toISOString();

  return {
    id: raw.callId ?? raw.id ?? raw.callLogId ?? cryptoSafeId(),
    agentId: raw.agentId ?? raw.agent?.id ?? 'unknown-agent',
    agentName: raw.agentName ?? raw.agent?.name ?? fallbackName,
    contactId: raw.contactId ?? raw.contact?.id ?? null,
    contactName: raw.contactName ?? raw.contact?.name ?? raw.customerName ?? 'Unknown contact',
    callType: raw.callType ?? raw.direction ?? raw.type ?? 'voice',
    durationSeconds: normalizeDuration(raw.duration ?? raw.durationSeconds ?? raw.callDuration),
    createdAt,
    summary: raw.summary ?? raw.callSummary ?? '',
    transcript,
    transcriptTurns,
    executedCallActions: normalizeActions(raw.executedCallActions ?? raw.actions ?? [])
  };
}

function normalizeAgent(raw) {
  const id = raw.id ?? raw.agentId ?? raw._id ?? null;

  return {
    id,
    name: raw.agentName ?? raw.name ?? raw.title ?? (id ? `Agent ${id}` : 'Voice AI Agent'),
    businessName: raw.businessName ?? null,
    welcomeMessage: raw.welcomeMessage ?? null,
    agentPrompt: raw.agentPrompt ?? raw.prompt ?? null,
    locationId: raw.locationId ?? null,
    voiceId: raw.voiceId ?? null,
    language: raw.language ?? null,
    responsiveness: raw.responsiveness ?? null,
    maxCallDuration: raw.maxCallDuration ?? null,
    timezone: raw.timezone ?? null,
    inboundNumber: raw.inboundNumber ?? raw.inboundNumbers?.[0] ?? null,
    inboundNumbers: raw.inboundNumbers ?? [],
    sendUserIdleReminders: raw.sendUserIdleReminders ?? null,
    reminderAfterIdleTimeSeconds: raw.reminderAfterIdleTimeSeconds ?? null,
    toolCallStrictMode: raw.toolCallStrictMode ?? null,
    translation: raw.translation ?? null,
    sendPostCallNotificationTo: raw.sendPostCallNotificationTo ?? null,
    agentWorkingHours: raw.agentWorkingHours ?? [],
    prompts: raw.prompts ?? null,
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    actionCount: Array.isArray(raw.actions) ? raw.actions.length : 0,
    raw
  };
}

function enrichCallAgent(call, agentsById) {
  const agent = agentsById.get(call.agentId);
  if (!agent) return call;

  return {
    ...call,
    agentName: agent.name || call.agentName
  };
}

function analyzeCall(call, goalProfile) {
  const text = `${call.summary}\n${call.transcript}`.toLowerCase();
  const dataQuality = assessDataQuality(call);
  const analysisState = getAnalysisState(call, dataQuality);

  if (analysisState !== 'analyzed') {
    return buildUnanalyzedCall(call, goalProfile, analysisState, dataQuality);
  }

  const criteria = goalProfile.criteria.map((criterion) => testCriterion(criterion, text, call));
  const missedWeight = criteria.filter((criterion) => criterion.passed === false).reduce((sum, criterion) => sum + criterion.weight, 0);
  const negativeSignals = findSignals(text, goalProfile.negativeSignals ?? []);
  const negativePenalty = negativeSignals.length > 0 ? 10 : 0;
  const score = clamp(100 - missedWeight - negativePenalty, 0, 100);
  const issues = buildIssues(call, goalProfile, criteria, negativeSignals, score);
  const missedOpportunities = buildMissedOpportunities(call, text, issues);
  const recommendations = buildRecommendations(issues, missedOpportunities, score, call);
  const useActions = buildUseActions(call, goalProfile, issues, missedOpportunities);

  return {
    ...call,
    goalProfile: summarizeGoalProfile(goalProfile),
    analysisState,
    dataQuality,
    score,
    status: score >= 80 ? 'healthy' : score >= 60 ? 'watch' : 'attention',
    criteria,
    issues,
    missedOpportunities,
    recommendations,
    useActions
  };
}

function buildUnanalyzedCall(call, goalProfile, analysisState, dataQuality) {
  const reason =
    analysisState === 'transcript_missing'
      ? 'Transcript is not available yet.'
      : 'Call is too short or incomplete for reliable scoring.';

  const issue = {
    id: `${call.id}-${analysisState}`,
    criterionId: analysisState,
    label: analysisState === 'transcript_missing' ? 'Transcript unavailable' : 'Incomplete call',
    category: 'data_quality',
    message: reason,
    recommendation: 'Retry analysis after transcript processing completes, or exclude this call from coaching metrics.',
    promptPatch: null,
    evidence: call.summary || 'No transcript evidence available.',
    confidence: 'high',
    severity: 'info'
  };

  return {
    ...call,
    goalProfile: summarizeGoalProfile(goalProfile),
    analysisState,
    dataQuality,
    score: null,
    status: analysisState === 'transcript_missing' ? 'pending' : 'incomplete',
    criteria: goalProfile.criteria.map(({ id, label, weight }) => ({
      id,
      label,
      weight: Number(weight) || 0,
      passed: null,
      evidence: 'Not analyzed',
      confidence: 'low'
    })),
    issues: [issue],
    missedOpportunities: [],
    recommendations: [
      {
        id: `${call.id}-retry-analysis`,
        title: 'Retry analysis later',
        detail: issue.recommendation,
        promptPatch: null,
        targetType: 'observability_parameter',
        targetAction: 'update',
        targetId: analysisState,
        suggestedChange: 'Wait for the transcript before changing the agent setup.',
        reviewStatus: 'needs_human_review',
        confidence: 'high',
        severity: 'info',
        sourceIssueId: issue.id
      }
    ],
    useActions: []
  };
}

function buildIssues(call, goalProfile, criteria, negativeSignals, score) {
  const failedCriteria = criteria.filter((criterion) => criterion.passed === false);
  const issues = failedCriteria.map((criterion) => {
    const source = goalProfile.criteria.find((item) => item.id === criterion.id) ?? {};
    const severity = getIssueSeverity(criterion, score);

    return {
      id: `${call.id}-${criterion.id}`,
      criterionId: criterion.id,
      label: source.label ?? criterion.label,
      category: source.category ?? criterion.id,
      message: source.issue ?? `${criterion.label} did not pass.`,
      recommendation: source.recommendation ?? 'Review the script and add clearer guidance for this behavior.',
      promptPatch: source.promptPatch ?? buildPromptPatch(source),
      evidence: criterion.evidence,
      confidence: criterion.confidence,
      severity
    };
  });

  if (negativeSignals.length > 0) {
    issues.push({
      id: `${call.id}-negative-signal`,
      criterionId: 'negativeSignal',
      label: 'Negative caller signal',
      category: 'experience',
      message: `Detected risky language: ${negativeSignals.slice(0, 3).join(', ')}.`,
      recommendation: 'Add a recovery branch that acknowledges the issue and routes the caller to a clear owner.',
      promptPatch:
        'If the caller sounds frustrated, reports a billing issue, or repeats an unresolved problem, acknowledge it and offer a named human follow-up before closing.',
      evidence: findSnippet(call.transcript, negativeSignals),
      confidence: 'medium',
      severity: score < 65 ? 'critical' : 'warning'
    });
  }

  return issues;
}

function buildMissedOpportunities(call, text, issues) {
  const opportunities = [];
  const intentSignals = findSignals(text, INTENT_WORDS);
  const missedNextStep = issues.find((issue) => issue.criterionId === 'nextStep');

  if (intentSignals.length > 0 && missedNextStep) {
    opportunities.push({
      id: `${call.id}-intent-no-next-step`,
      type: 'conversion',
      label: 'High-intent caller did not receive a clear next step',
      severity: 'critical',
      evidence: findSnippet(call.transcript, intentSignals),
      recommendation:
        'Add a branch that converts pricing, availability, quote, or appointment intent into a specific booking or callback offer.'
    });
  }

  return opportunities;
}

function buildRecommendations(issues, missedOpportunities, score, call) {
  const recommendations = [];

  if (score < 60) {
    recommendations.push({
      id: `${call.id}-qa-review`,
      title: 'Review this call in QA',
      detail: `Prioritize ${call.agentName}; this call missed multiple KPI checkpoints.`,
      promptPatch: null,
      targetType: 'agent_profile',
      targetAction: 'update',
      targetId: call.agentId,
      suggestedChange: 'Review the agent profile and prompt against the missed call behaviors before editing.',
      reviewStatus: 'needs_human_review',
      confidence: 'high',
      severity: 'critical',
      sourceIssueId: null
    });
  }

  for (const issue of issues.slice(0, 4)) {
    recommendations.push({
      id: `${issue.id}-recommendation`,
      title: issue.label,
      detail: issue.recommendation,
      promptPatch: issue.promptPatch,
      targetType: 'agent_profile',
      targetAction: 'update',
      targetId: call.agentId,
      suggestedChange: issue.promptPatch ?? issue.recommendation,
      reviewStatus: 'needs_human_review',
      confidence: issue.confidence,
      severity: issue.severity,
      sourceIssueId: issue.id
    });
  }

  for (const opportunity of missedOpportunities) {
    recommendations.push({
      id: `${opportunity.id}-recommendation`,
      title: opportunity.label,
      detail: opportunity.recommendation,
      promptPatch:
        'When a caller expresses buying, scheduling, quote, or pricing intent, ask one closing question and offer a concrete next step.',
      targetType: 'agent_profile',
      targetAction: 'update',
      targetId: call.agentId,
      suggestedChange:
        'When a caller expresses buying, scheduling, quote, or pricing intent, ask one closing question and offer a concrete next step.',
      reviewStatus: 'needs_human_review',
      confidence: 'medium',
      severity: opportunity.severity,
      sourceIssueId: opportunity.id
    });
  }

  return recommendations;
}

function buildUseActions(call, goalProfile, issues, missedOpportunities) {
  const actions = [];

  for (const issue of issues) {
    const criterion = goalProfile.criteria.find((item) => item.id === issue.criterionId);
    const actionType = criterion?.useActionType ?? (HUMAN_REVIEW_CRITERIA.has(issue.criterionId) ? 'QA review' : null);

    if (!actionType) continue;

    actions.push({
      id: `${call.id}-${issue.criterionId}-action`,
      callId: call.id,
      agentId: call.agentId,
      agentName: call.agentName,
      contactName: call.contactName,
      createdAt: call.createdAt,
      severity: actionType === 'Human handoff' ? 'critical' : issue.severity,
      type: actionType,
      status: 'open',
      reason: issue.message,
      snippet: issue.evidence,
      recommendation: issue.recommendation
    });
  }

  for (const opportunity of missedOpportunities) {
    actions.push({
      id: `${opportunity.id}-action`,
      callId: call.id,
      agentId: call.agentId,
      agentName: call.agentName,
      contactName: call.contactName,
      createdAt: call.createdAt,
      severity: opportunity.severity,
      type: 'Script training',
      status: 'open',
      reason: opportunity.label,
      snippet: opportunity.evidence,
      recommendation: opportunity.recommendation
    });
  }

  return dedupeBy(actions, (action) => `${action.callId}-${action.type}-${action.reason}`);
}

function buildAgentSummaries(calls, listedAgents, goalProfiles, options = {}) {
  const byAgent = new Map();
  const includeCallOnlyAgents = options.includeCallOnlyAgents !== false;

  for (const listedAgent of listedAgents) {
    if (!listedAgent.id) continue;

    byAgent.set(listedAgent.id, {
      id: listedAgent.id,
      name: listedAgent.name,
      goalProfileName: getAgentGoalProfile(goalProfiles, {
        agentId: listedAgent.id,
        agentName: listedAgent.name
      }).name,
      calls: [],
      issueCount: 0,
      useActionCount: 0,
      metadata: listedAgent
    });
  }

  for (const call of calls) {
    if (!byAgent.has(call.agentId)) {
      if (!includeCallOnlyAgents) continue;

      byAgent.set(call.agentId, {
        id: call.agentId,
        name: call.agentName,
        goalProfileName: call.goalProfile.name,
        calls: [],
        issueCount: 0,
        useActionCount: 0,
        metadata: null
      });
    }

    const agent = byAgent.get(call.agentId);
    agent.name = call.agentName || agent.name;
    agent.goalProfileName = call.goalProfile.name || agent.goalProfileName;
    agent.calls.push(call);
    agent.issueCount += call.issues.filter((issue) => issue.severity !== 'info').length;
    agent.useActionCount += call.useActions.length;
  }

  return Array.from(byAgent.values())
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      goalProfileName: agent.goalProfileName,
      callCount: agent.calls.length,
      analyzedCallCount: agent.calls.filter((call) => call.analysisState === 'analyzed').length,
      averageScore:
        agent.calls.length === 0 ? null : average(agent.calls.map((call) => call.score).filter((score) => score !== null)),
      issueCount: agent.issueCount,
      useActionCount: agent.useActionCount,
      topFailedKpi: agent.calls.length === 0 ? 'No calls yet' : pickTopFailedKpi(agent.calls),
      topRecommendation: agent.calls.length === 0 ? 'Run a test call to start observability scoring.' : pickTopRecommendation(agent.calls),
      businessName: agent.metadata?.businessName ?? null,
      description: agent.metadata?.agentPrompt ?? null,
      welcomeMessage: agent.metadata?.welcomeMessage ?? null,
      language: agent.metadata?.language ?? null,
      responsiveness: agent.metadata?.responsiveness ?? null,
      maxCallDuration: agent.metadata?.maxCallDuration ?? null,
      timezone: agent.metadata?.timezone ?? null,
      inboundNumber: agent.metadata?.inboundNumber ?? null,
      voiceId: agent.metadata?.voiceId ?? null,
      sendUserIdleReminders: agent.metadata?.sendUserIdleReminders ?? null,
      reminderAfterIdleTimeSeconds: agent.metadata?.reminderAfterIdleTimeSeconds ?? null,
      toolCallStrictMode: agent.metadata?.toolCallStrictMode ?? null,
      translation: agent.metadata?.translation ?? null,
      sendPostCallNotificationTo: agent.metadata?.sendPostCallNotificationTo ?? null,
      agentWorkingHours: agent.metadata?.agentWorkingHours ?? [],
      prompts: agent.metadata?.prompts ?? null,
      actions: Array.isArray(agent.metadata?.actions) ? agent.metadata.actions : [],
      configuredActionCount: Array.isArray(agent.metadata?.actions)
        ? agent.metadata.actions.length
        : agent.metadata?.actionCount ?? 0
    }))
    .sort((a, b) => sortNullableScores(a.averageScore, b.averageScore) || a.name.localeCompare(b.name));
}

function buildKpiSummary(calls) {
  const byKpi = new Map();

  for (const call of calls) {
    for (const criterion of call.criteria) {
      if (criterion.passed === null) continue;

      if (!byKpi.has(criterion.id)) {
        byKpi.set(criterion.id, {
          id: criterion.id,
          label: criterion.label,
          weight: criterion.weight,
          passed: 0,
          failed: 0,
          evidence: []
        });
      }

      const item = byKpi.get(criterion.id);
      if (criterion.passed) item.passed += 1;
      else {
        item.failed += 1;
        item.evidence.push(criterion.evidence);
      }
    }
  }

  return Array.from(byKpi.values())
    .map((kpi) => ({
      ...kpi,
      failureRate: kpi.passed + kpi.failed === 0 ? 0 : Math.round((kpi.failed / (kpi.passed + kpi.failed)) * 100),
      sampleEvidence: kpi.evidence.find(Boolean) ?? null
    }))
    .sort((a, b) => b.failureRate - a.failureRate || b.failed - a.failed);
}

function buildDataStates(calls) {
  const states = {
    analyzed: 0,
    transcript_missing: 0,
    incomplete: 0
  };

  for (const call of calls) {
    states[call.analysisState] = (states[call.analysisState] ?? 0) + 1;
  }

  return states;
}

function flattenIssues(call) {
  return call.issues.map((issue) => ({
    ...issue,
    callId: call.id,
    agentId: call.agentId,
    agentName: call.agentName,
    contactName: call.contactName,
    createdAt: call.createdAt,
    score: call.score,
    status: call.status,
    goalProfileName: call.goalProfile.name
  }));
}

function flattenRecommendations(call) {
  return call.recommendations.map((recommendation) => ({
    ...recommendation,
    callId: call.id,
    agentId: call.agentId,
    agentName: call.agentName,
    contactName: call.contactName,
    createdAt: call.createdAt,
    score: call.score,
    status: call.status,
    goalProfileName: call.goalProfile.name
  }));
}

function testCriterion(criterion, text, call) {
  const weight = Number(criterion.weight) || 0;
  const label = criterion.label ?? criterion.id;
  const hasRuleSignals =
    (Array.isArray(criterion.keywordsAny) && criterion.keywordsAny.length > 0) ||
    (Array.isArray(criterion.requiredWhenAny) && criterion.requiredWhenAny.length > 0) ||
    (Array.isArray(criterion.passWhenAny) && criterion.passWhenAny.length > 0) ||
    criterion.allowExecutedAction;

  if (!hasRuleSignals && criterion.llmDescription) {
    return {
      id: criterion.id,
      label,
      weight,
      passed: null,
      evidence: 'Configured for LLM evaluation. Rule-based scoring does not have enough signal hints yet.',
      confidence: 'low'
    };
  }

  if (Array.isArray(criterion.requiredWhenAny) && criterion.requiredWhenAny.length > 0) {
    const applies = containsAny(text, criterion.requiredWhenAny);

    if (!applies) {
      return {
        id: criterion.id,
        label,
        weight,
        passed: true,
        evidence: 'Condition did not apply in this call.',
        confidence: 'high'
      };
    }

    const passSignals = findSignals(text, criterion.passWhenAny ?? []);
    const passed = passSignals.length > 0 || (criterion.allowExecutedAction && hasExecutedAction(call));

    return {
      id: criterion.id,
      label,
      weight,
      passed,
      evidence: passed
        ? findSnippet(call.transcript, passSignals)
        : findSnippet(call.transcript, criterion.requiredWhenAny),
      confidence: passed ? 'medium' : 'high'
    };
  }

  const matchedSignals = findSignals(text, criterion.keywordsAny ?? []);
  const passed = matchedSignals.length > 0 || (criterion.allowExecutedAction && hasExecutedAction(call));

  return {
    id: criterion.id,
    label,
    weight,
    passed,
    evidence: passed ? findSnippet(call.transcript, matchedSignals) : findMostRelevantFallback(call),
    confidence: matchedSignals.length > 0 ? 'medium' : 'high'
  };
}

function summarizeGoalProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    scriptSummary: profile.scriptSummary,
    goals: profile.goals,
    criteria: profile.criteria.map(({ id, label, weight, llmDescription }) => ({ id, label, weight, llmDescription })),
    parameters: profile.parameters ?? []
  };
}

function buildUsedGoalProfiles(calls) {
  const byId = new Map();

  for (const call of calls) {
    if (!byId.has(call.goalProfile.id)) {
      byId.set(call.goalProfile.id, {
        ...call.goalProfile,
        agentCount: 0,
        callCount: 0
      });
    }

    byId.get(call.goalProfile.id).callCount += 1;
  }

  for (const profile of byId.values()) {
    profile.agentCount = new Set(calls.filter((call) => call.goalProfile.id === profile.id).map((call) => call.agentId)).size;
  }

  return Array.from(byId.values());
}

function assessDataQuality(call) {
  const hasTranscript = call.transcript.trim().length > 0;
  const turnCount = call.transcriptTurns.length;
  const isShort = call.durationSeconds > 0 && call.durationSeconds < SHORT_CALL_SECONDS;

  return {
    hasTranscript,
    turnCount,
    isShort,
    wordCount: call.transcript.split(/\s+/).filter(Boolean).length,
    level: !hasTranscript ? 'missing' : isShort || turnCount < MIN_ANALYZABLE_TURNS ? 'limited' : 'usable'
  };
}

function getAnalysisState(call, dataQuality) {
  if (!dataQuality.hasTranscript) return 'transcript_missing';
  if (dataQuality.isShort || dataQuality.turnCount < MIN_ANALYZABLE_TURNS) return 'incomplete';
  return 'analyzed';
}

function normalizeTranscript(transcript) {
  if (typeof transcript === 'string') return transcript.trim();
  if (Array.isArray(transcript)) {
    return transcript
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const speaker = entry.speaker ?? entry.role ?? entry.from ?? 'Speaker';
        const text = entry.text ?? entry.message ?? entry.content ?? '';
        return `${speaker}: ${text}`;
      })
      .join('\n')
      .trim();
  }
  if (transcript && typeof transcript === 'object') {
    return JSON.stringify(transcript);
  }
  return '';
}

function parseTranscriptTurns(transcript) {
  return transcript
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^([^:]{1,32}):\s*(.*)$/);
      return {
        index,
        speaker: match ? match[1].trim().toLowerCase() : 'unknown',
        text: match ? match[2].trim() : trimmed,
        raw: trimmed
      };
    })
    .filter(Boolean);
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action, index) => ({
    id: action.id ?? `action-${index + 1}`,
    type: action.type ?? action.actionType ?? 'action',
    status: action.status ?? 'unknown',
    label: action.label ?? action.name ?? action.type ?? 'Call action'
  }));
}

function normalizeDuration(value) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  return 0;
}

function hasExecutedAction(call) {
  return call.executedCallActions.some((action) => ['completed', 'success', 'executed'].includes(String(action.status).toLowerCase()));
}

function getIssueSeverity(criterion, score) {
  if (criterion.weight >= 22 || score < 60) return 'critical';
  return 'warning';
}

function buildPromptPatch(source) {
  if (!source?.label) return null;
  return `Add an explicit instruction for "${source.label}" and require the agent to satisfy it before ending the call.`;
}

function pickTopRecommendation(calls) {
  const issue = calls.flatMap((call) => call.issues).find((item) => item.severity !== 'info');
  return issue?.recommendation ?? 'No immediate script changes needed.';
}

function pickTopFailedKpi(calls) {
  const failed = new Map();

  for (const call of calls) {
    for (const criterion of call.criteria) {
      if (criterion.passed === false) {
        failed.set(criterion.label, (failed.get(criterion.label) ?? 0) + 1);
      }
    }
  }

  return Array.from(failed.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No failed KPI yet';
}

function findSignals(text, words) {
  return Array.from(new Set((words ?? []).filter((word) => word && text.includes(String(word).toLowerCase()))));
}

function containsAny(text, words) {
  return findSignals(text, words).length > 0;
}

function findSnippet(transcript, words) {
  const signals = (words ?? []).map((word) => String(word).toLowerCase()).filter(Boolean);
  const lines = transcript.split('\n').map((line) => line.trim()).filter(Boolean);

  if (signals.length === 0) return lines.at(-1) ?? 'No transcript snippet available.';

  const match = lines.find((line) => containsAny(line.toLowerCase(), signals));
  return match ?? lines.at(-1) ?? 'No transcript snippet available.';
}

function findMostRelevantFallback(call) {
  const humanLine = call.transcriptTurns.findLast((turn) => ['human', 'caller', 'customer', 'user'].includes(turn.speaker));
  return humanLine?.raw ?? call.transcriptTurns.at(-1)?.raw ?? call.summary ?? 'No transcript snippet available.';
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function severityRank(severity) {
  return severity === 'critical' ? 3 : severity === 'warning' ? 2 : severity === 'info' ? 1 : 0;
}

function sortBySeverityAndDate(a, b) {
  return severityRank(b.severity) - severityRank(a.severity) || new Date(b.createdAt) - new Date(a.createdAt);
}

function dedupeCalls(calls) {
  return dedupeBy(calls, (call) => call.id);
}

function dedupeAgents(agents) {
  return dedupeBy(
    agents.filter((agent) => agent.id),
    (agent) => agent.id
  );
}

function dedupeBy(items, getKey) {
  const seen = new Map();
  for (const item of items) {
    seen.set(getKey(item), item);
  }
  return Array.from(seen.values());
}

function sortNullableScores(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function cryptoSafeId() {
  return `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
