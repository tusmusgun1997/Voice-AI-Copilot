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

  const llmUseActions = relevantAnalyses.flatMap((analysis) =>
    (analysis.useActions ?? [])
      .filter(isOpenAction)
      .map((action) => {
        const call = callsById.get(analysis.callId);

        return {
          ...action,
          id: action.id || `${analysis.callId}-llm-action`,
          callId: analysis.callId,
          agentId: analysis.agentId,
          contactName: call?.contactName,
          createdAt: action.createdAt || analysis.analyzedAt || analysis.updatedAt,
          source: 'llm'
        };
      })
  );

  return {
    ...dashboard,
    summary: {
      ...dashboard.summary,
      followUpActions: (dashboard.summary?.followUpActions ?? 0) + llmUseActions.length
    },
    calls: (dashboard.calls ?? []).map((call) => {
      const analysis = analysesByCallId.get(call.id);
      if (!analysis) return call;

      return {
        ...call,
        llmAnalysisStatus: analysis.status,
        llmStage: analysis.stage,
        llmScore: analysis.score,
        llmSummary: analysis.summary,
        llmParameterResults: analysis.parameterResults,
        llmUseActions: (analysis.useActions ?? []).filter(isOpenAction)
      };
    }),
    recommendations: [],
    useActions: [...llmUseActions, ...(dashboard.useActions ?? [])],
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
        summary: analysis.summary,
        parameterResults: analysis.parameterResults,
        useActions: (analysis.useActions ?? []).filter(isOpenAction),
        errorMessage: analysis.errorMessage,
        attempts: analysis.attempts,
        maxAttempts: analysis.maxAttempts,
        nextRetryAt: analysis.nextRetryAt,
        updatedAt: analysis.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  };
}

function isOpenAction(action) {
  return !action?.status || ['open', 'in_review'].includes(action.status);
}

function toClientError(error) {
  return {
    message: error.message,
    status: error.status ?? null
  };
}
