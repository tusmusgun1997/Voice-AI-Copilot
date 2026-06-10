import { getCallOutcome } from '../analysisOutcome.js';
import { listCallAnalyses } from '../analysisStore.js';
import { demoCallLogs } from '../mockData.js';
import { buildObservabilityDashboard } from '../observability.js';
import { loadObservabilityProfiles } from '../observabilityProfiles.js';
import { cleanupDeletedAgentData } from './agentCleanupService.js';
import { getAgentId, getCallAgentId } from './highLevelService.js';

export function createDashboardService({
  highLevelService,
  localDataFile,
  locationId,
  useDemoDataWhenEmpty = true,
  showDeletedAgentCalls = false
} = {}) {
  async function getDashboard(query = {}) {
    const mode = String(query.mode || 'auto');
    let liveResult = null;
    let agentsResult = null;
    let liveError = null;
    let agentsError = null;

    if (mode !== 'demo' && highLevelService.hasConfig()) {
      try {
        liveResult = await highLevelService.loadCallLogs(query);
      } catch (error) {
        liveError = toClientError(error);
      }

      try {
        agentsResult = await highLevelService.loadAgents();
      } catch (error) {
        agentsError = toClientError(error);
      }
    }

    const liveLogs = liveResult?.callLogs ?? [];
    const shouldUseDemo = mode === 'demo' || (useDemoDataWhenEmpty && liveLogs.length === 0);
    const hasLiveAgentDirectory = mode !== 'demo' && agentsResult && !agentsError;
    const hasAuthoritativeAgentDirectory = !shouldUseDemo && hasLiveAgentDirectory;
    const activeAgentIds = new Set((agentsResult?.agents ?? []).map((agent) => getAgentId(agent)).filter(Boolean));

    if (hasLiveAgentDirectory) {
      await cleanupDeletedAgentData({
        activeAgentIds: Array.from(activeAgentIds),
        localDataFile,
        locationId,
        allowEmptyActiveSet: true
      });
    }

    const goalProfiles = await loadObservabilityProfiles(localDataFile, localDataFile);
    const filteredLiveLogs =
      hasAuthoritativeAgentDirectory && !showDeletedAgentCalls
        ? liveLogs.filter((call) => activeAgentIds.has(getCallAgentId(call)))
        : liveLogs;
    const callLogs = shouldUseDemo ? demoCallLogs : filteredLiveLogs;
    const dashboard = buildObservabilityDashboard(callLogs, goalProfiles, shouldUseDemo ? [] : agentsResult?.agents ?? [], {
      includeCallOnlyAgents: !hasAuthoritativeAgentDirectory
    });
    const storedAnalyses = await listCallAnalyses(localDataFile);
    const enrichedDashboard = applyStoredAnalyses(dashboard, storedAnalyses, locationId);

    return {
      dataSource: shouldUseDemo ? 'demo' : liveLogs.length > 0 ? 'highlevel' : 'empty',
      generatedAt: new Date().toISOString(),
      locationId: locationId || null,
      liveRecordCount: liveResult?.totalRecords ?? liveLogs.length,
      visibleRecordCount: callLogs.length,
      liveAgentCount: agentsResult?.totalRecords ?? agentsResult?.agents?.length ?? null,
      hiddenDeletedAgentCallCount: shouldUseDemo ? 0 : Math.max(0, liveLogs.length - filteredLiveLogs.length),
      liveError,
      agentsError,
      ...enrichedDashboard
    };
  }

  return {
    getDashboard
  };
}

export function applyStoredAnalyses(dashboard, analyses, locationId) {
  const callsById = new Map((dashboard.calls ?? []).map((call) => [call.id, call]));
  const callIds = new Set(callsById.keys());
  const locationAnalyses = analyses.filter(
    (analysis) => !locationId || !analysis.locationId || analysis.locationId === locationId
  );
  const relevantAnalyses = locationAnalyses.filter((analysis) => callIds.has(analysis.callId));
  const analysesByCallId = new Map(relevantAnalyses.map((analysis) => [analysis.callId, analysis]));
  const systemImprovements = buildAgentSystemImprovements(relevantAnalyses, callsById).filter(isOpenImprovement);
  const agentMetrics = buildAgentMetrics(dashboard.agents ?? [], relevantAnalyses, systemImprovements);
  const totalAnalyzed = relevantAnalyses.filter((analysis) => Number.isFinite(Number(analysis.score))).length;
  const passedCalls = relevantAnalyses.filter((analysis) => getCallOutcome(analysis.score) === 'passed').length;
  const failedCalls = relevantAnalyses.filter((analysis) => getCallOutcome(analysis.score) === 'failed').length;

  return {
    ...dashboard,
    summary: {
      ...dashboard.summary,
      analyzedCalls: totalAnalyzed || dashboard.summary?.analyzedCalls || 0,
      passedCalls,
      failedCalls,
      passRate: totalAnalyzed === 0 ? 0 : Math.round((passedCalls / totalAnalyzed) * 100),
      followUpActions: systemImprovements.length,
      systemImprovementCount: systemImprovements.length
    },
    agents: (dashboard.agents ?? []).map((agent) => ({
      ...agent,
      ...(agentMetrics.get(agent.id) ?? emptyAgentMetric()),
      useActionCount: agentMetrics.get(agent.id)?.systemImprovementCount ?? 0,
      systemImprovementCount: agentMetrics.get(agent.id)?.systemImprovementCount ?? 0
    })),
    calls: (dashboard.calls ?? []).map((call) => {
      const analysis = analysesByCallId.get(call.id);
      if (!analysis) return { ...call, outcome: 'pending' };

      const score = analysis.score;
      const outcome = analysis.outcome || getCallOutcome(score);

      return {
        ...call,
        score: Number.isFinite(Number(score)) ? Number(score) : call.score,
        outcome,
        status: outcome === 'passed' ? 'healthy' : outcome === 'failed' ? 'attention' : call.status,
        llmAnalysisStatus: analysis.status,
        llmStage: analysis.stage,
        llmScore: score,
        llmOutcome: outcome,
        llmSummary: analysis.summary,
        llmParameterResults: analysis.parameterResults,
        llmSystemImprovements: []
      };
    }),
    recommendations: [],
    useActions: systemImprovements,
    systemImprovements,
    llmAnalyses: locationAnalyses
      .map((analysis) => ({
        jobId: analysis.jobId,
        callId: analysis.callId,
        agentId: analysis.agentId,
        agentName: analysis.agentName,
        parameterVersionId: analysis.parameterVersionId,
        status: analysis.status,
        stage: analysis.stage,
        score: analysis.score,
        outcome: analysis.outcome || getCallOutcome(analysis.score),
        summary: analysis.summary,
        parameterResults: analysis.parameterResults,
        systemImprovements: analysis.systemImprovements ?? [],
        useActions: [],
        errorMessage: analysis.errorMessage,
        attempts: analysis.attempts,
        maxAttempts: analysis.maxAttempts,
        nextRetryAt: analysis.nextRetryAt,
        updatedAt: analysis.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  };
}

function buildAgentSystemImprovements(analyses, callsById) {
  const byKey = new Map();

  for (const analysis of analyses) {
    for (const improvement of analysis.systemImprovements ?? []) {
      const key = [
        analysis.agentId || improvement.agentId || '',
        improvement.type || 'prompt_update',
        improvement.parameterId || '',
        improvement.targetType || 'agent_profile',
        improvement.targetId || improvement.parameterId || '',
        improvement.title || ''
      ].join('|');
      const call = callsById.get(analysis.callId);

      if (!byKey.has(key)) {
        byKey.set(key, {
          ...improvement,
          id: `improvement-${slug(key)}`,
          agentId: improvement.agentId || analysis.agentId,
          agentName: improvement.agentName || analysis.agentName,
          sourceCallIds: [],
          sourceCalls: [],
          sourceCallCount: 0,
          callId: '',
          contactName: '',
          createdAt: improvement.createdAt || analysis.analyzedAt || analysis.updatedAt,
          updatedAt: improvement.updatedAt || analysis.updatedAt,
          source: 'llm'
        });
      }

      const current = byKey.get(key);
      current.sourceCallIds = Array.from(new Set([...(current.sourceCallIds ?? []), ...(improvement.sourceCallIds ?? []), analysis.callId].filter(Boolean)));
      current.sourceCallCount = current.sourceCallIds.length;
      current.callId = current.sourceCallIds[0] || '';
      current.contactName = callsById.get(current.callId)?.contactName || '';
      if (call && !current.sourceCalls.some((item) => item.id === call.id)) {
        current.sourceCalls.push({
          id: call.id,
          contactName: call.contactName,
          createdAt: call.createdAt,
          score: analysis.score,
          outcome: analysis.outcome || getCallOutcome(analysis.score)
        });
      }
      current.severity = higherSeverity(current.severity, improvement.severity);
    }
  }

  return Array.from(byKey.values()).sort(sortBySeverityAndDate);
}

function buildAgentMetrics(agents, analyses, systemImprovements) {
  const metrics = new Map(agents.map((agent) => [agent.id, emptyAgentMetric()]));

  for (const analysis of analyses) {
    if (!analysis.agentId) continue;
    if (!metrics.has(analysis.agentId)) metrics.set(analysis.agentId, emptyAgentMetric());
    const metric = metrics.get(analysis.agentId);
    const score = Number(analysis.score);
    if (!Number.isFinite(score)) continue;

    metric.analyzedCallCount += 1;
    metric.totalAnalyzedCalls += 1;
    metric.scoreSum += score;
    metric.averageScore = Math.round(metric.scoreSum / metric.totalAnalyzedCalls);

    if (getCallOutcome(score) === 'passed') metric.passedCallCount += 1;
    if (getCallOutcome(score) === 'failed') metric.failedCallCount += 1;
    metric.passRate = Math.round((metric.passedCallCount / metric.totalAnalyzedCalls) * 100);
  }

  for (const improvement of systemImprovements) {
    if (!improvement.agentId) continue;
    if (!metrics.has(improvement.agentId)) metrics.set(improvement.agentId, emptyAgentMetric());
    metrics.get(improvement.agentId).systemImprovementCount += 1;
  }

  for (const metric of metrics.values()) {
    delete metric.scoreSum;
  }

  return metrics;
}

function emptyAgentMetric() {
  return {
    totalAnalyzedCalls: 0,
    analyzedCallCount: 0,
    passedCallCount: 0,
    failedCallCount: 0,
    passRate: 0,
    averageScore: null,
    systemImprovementCount: 0,
    scoreSum: 0
  };
}

function isOpenImprovement(improvement) {
  return !improvement?.status || ['open', 'in_review'].includes(improvement.status);
}

function higherSeverity(current = 'info', next = 'info') {
  const rank = { critical: 3, warning: 2, info: 1 };
  return (rank[next] ?? 1) > (rank[current] ?? 1) ? next : current;
}

function sortBySeverityAndDate(a, b) {
  const rank = { critical: 3, warning: 2, info: 1 };
  return (rank[b.severity] ?? 1) - (rank[a.severity] ?? 1) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toClientError(error) {
  return {
    message: error.message,
    status: error.status ?? null
  };
}
