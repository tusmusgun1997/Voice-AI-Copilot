import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { getCallAnalysis, listCallAnalyses } from './analysisStore.js';
import { loadAgentGoalProfiles } from './agentGoals.js';
import { createCallAnalysisQueue } from './callAnalysisQueue.js';
import { fetchVoiceAiAgent, fetchVoiceAiAgents, fetchVoiceAiCallLogs, patchVoiceAiAgent } from './highlevelClient.js';
import { demoCallLogs } from './mockData.js';
import { buildObservabilityDashboard } from './observability.js';
import {
  getAgentObservabilityProfile,
  listSavedObservabilityProfiles,
  loadObservabilityProfiles,
  saveAgentObservabilityProfile
} from './observabilityProfiles.js';
import { exchangeHighLevelCode } from './oauthClient.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(currentDir, '..', 'dist');
const analysisQueue = createCallAnalysisQueue({
  highLevelToken: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
  locationId: process.env.GHL_LOCATION_ID,
  highLevelVersion: process.env.GHL_API_VERSION,
  highLevelBaseUrl: process.env.GHL_API_BASE_URL,
  callType: process.env.GHL_CALL_TYPE,
  observabilityProfilesFile: process.env.OBSERVABILITY_PROFILES_FILE,
  analysisResultsFile: process.env.CALL_ANALYSIS_RESULTS_FILE,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  maxAttempts: process.env.ANALYSIS_JOB_MAX_ATTEMPTS,
  retryDelayMs: process.env.ANALYSIS_JOB_RETRY_DELAY_MS
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'voice-ai-observability-copilot',
    generatedAt: new Date().toISOString()
  });
});

app.get('/api/call-logs', async (request, response, next) => {
  try {
    const result = await loadHighLevelCallLogs(request.query);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/call-analyses', async (_request, response, next) => {
  try {
    const analyses = await listCallAnalyses(process.env.CALL_ANALYSIS_RESULTS_FILE);
    response.json({
      analyses,
      total: analyses.length
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/call-analyses/:callId', async (request, response, next) => {
  try {
    const analysis = await getCallAnalysis(request.params.callId, process.env.CALL_ANALYSIS_RESULTS_FILE);

    if (!analysis) {
      response.status(404).json({
        message: 'Call analysis was not found.',
        status: 404
      });
      return;
    }

    response.json({ analysis });
  } catch (error) {
    next(error);
  }
});

app.post('/api/call-analyses/sync-latest', async (request, response, next) => {
  try {
    if (!hasHighLevelConfig()) {
      response.status(400).json({
        message: 'HighLevel token and location ID are required before syncing calls.',
        status: 400
      });
      return;
    }

    const pageSize = boundedNumber(request.query.pageSize || request.body?.pageSize, 25, 1, 50);
    const force = Boolean(request.body?.force || request.query.force === 'true');
    const showDeletedAgentCalls = String(process.env.SHOW_DELETED_AGENT_CALLS || 'false') === 'true';
    const agentsResult = await loadHighLevelAgents();
    const activeAgentIds = new Set((agentsResult.agents ?? []).map((agent) => getAgentId(agent)).filter(Boolean));
    const existingAnalyses = await listCallAnalyses(process.env.CALL_ANALYSIS_RESULTS_FILE);
    const completedCallIds = new Set(
      existingAnalyses
        .filter((analysis) => ['running', 'retrying', 'succeeded'].includes(analysis.status))
        .map((analysis) => analysis.callId)
    );
    const latest = await loadHighLevelCallLogs({ page: 1, pageSize });
    const candidates = latest.callLogs
      .map(toCallAnalysisCandidate)
      .filter((candidate) => candidate.callId)
      .filter((candidate) => showDeletedAgentCalls || activeAgentIds.has(candidate.agentId));
    const jobs = [];

    for (const candidate of candidates) {
      if (!force && completedCallIds.has(candidate.callId)) continue;

      const job = await analysisQueue.enqueueWebhookAnalysis(
        {
          locationId: candidate.locationId || process.env.GHL_LOCATION_ID,
          agentId: candidate.agentId,
          callId: candidate.callId,
          type: 'SandboxLatestCallSync'
        },
        'sandbox-sync'
      );
      jobs.push(job);
    }

    response.status(202).json({
      accepted: true,
      scanned: latest.callLogs.length,
      eligible: candidates.length,
      enqueued: jobs.length,
      skippedDeletedAgentCalls: latest.callLogs.length - candidates.length,
      jobs: jobs.map((job) => ({
        jobId: job.id,
        callId: job.callId,
        agentId: job.agentId,
        status: job.status
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/analysis-jobs', (_request, response) => {
  response.json({
    jobs: analysisQueue.listJobs()
  });
});

app.get('/api/agent-goals', async (_request, response, next) => {
  try {
    const goalProfiles = await loadAgentGoalProfiles(process.env.AGENT_GOALS_FILE);
    response.json(goalProfiles);
  } catch (error) {
    next(error);
  }
});

app.get('/api/agent-observability-profiles', async (_request, response, next) => {
  try {
    const result = await listSavedObservabilityProfiles(process.env.OBSERVABILITY_PROFILES_FILE);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get('/api/agent-observability-profiles/:agentId', async (request, response, next) => {
  try {
    const profile = await getAgentObservabilityProfile(
      {
        id: request.params.agentId,
        name: request.query.agentName
      },
      process.env.OBSERVABILITY_PROFILES_FILE
    );

    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

app.put('/api/agent-observability-profiles/:agentId', async (request, response, next) => {
  try {
    const profile = await saveAgentObservabilityProfile(
      request.params.agentId,
      request.body,
      process.env.OBSERVABILITY_PROFILES_FILE
    );

    response.json({
      saved: true,
      profile
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/agents/:agentId', async (request, response, next) => {
  try {
    const result = await fetchVoiceAiAgent({
      token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
      locationId: process.env.GHL_LOCATION_ID,
      agentId: request.params.agentId,
      version: process.env.GHL_API_VERSION,
      baseUrl: process.env.GHL_API_BASE_URL
    });

    response.json({
      agent: result.agent
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/agents/:agentId', async (request, response, next) => {
  try {
    const patch = sanitizeAgentPatch(request.body);

    if (Object.keys(patch).length === 0) {
      response.status(400).json({
        message: 'No editable agent fields were provided.',
        status: 400
      });
      return;
    }

    const result = await patchVoiceAiAgent({
      token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
      locationId: process.env.GHL_LOCATION_ID,
      agentId: request.params.agentId,
      version: process.env.GHL_API_VERSION,
      baseUrl: process.env.GHL_API_BASE_URL,
      patch
    });

    response.json({
      updated: true,
      agent: result.agent
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/oauth/callback', async (request, response) => {
  const params = new URLSearchParams();

  try {
    const token = await exchangeHighLevelCode({
      code: request.query.code,
      clientId: process.env.GHL_CLIENT_ID,
      clientSecret: process.env.GHL_CLIENT_SECRET,
      redirectUri: process.env.GHL_OAUTH_REDIRECT_URL,
      userType: request.query.userType || process.env.GHL_OAUTH_USER_TYPE || 'Location',
      baseUrl: process.env.GHL_API_BASE_URL
    });

    params.set('installed', 'true');
    params.set('oauth', 'connected');

    if (token?.locationId) params.set('locationId', token.locationId);
    if (token?.companyId) params.set('companyId', token.companyId);
    if (token?.userType) params.set('userType', token.userType);

    console.log(
      `HighLevel OAuth connected: userType=${token?.userType || 'unknown'} locationId=${token?.locationId || 'n/a'}`
    );
  } catch (error) {
    params.set('installed', 'false');
    params.set('oauth', 'failed');
    params.set('reason', error.message);

    console.error(error.message);
  }

  response.redirect(`/?${params}`);
});

app.get('/api/observability', async (request, response, next) => {
  try {
    const mode = String(request.query.mode || 'auto');
    const useDemoWhenEmpty = String(process.env.USE_DEMO_DATA_WHEN_EMPTY || 'true') === 'true';
    const goalProfiles = await loadObservabilityProfiles(process.env.OBSERVABILITY_PROFILES_FILE);
    let liveResult = null;
    let agentsResult = null;
    let liveError = null;
    let agentsError = null;

    if (mode !== 'demo' && hasHighLevelConfig()) {
      try {
        liveResult = await loadHighLevelCallLogs(request.query);
      } catch (error) {
        liveError = {
          message: error.message,
          status: error.status ?? null
        };
      }

      try {
        agentsResult = await loadHighLevelAgents();
      } catch (error) {
        agentsError = {
          message: error.message,
          status: error.status ?? null
        };
      }
    }

    const liveLogs = liveResult?.callLogs ?? [];
    const shouldUseDemo = mode === 'demo' || (useDemoWhenEmpty && liveLogs.length === 0);
    const hasAuthoritativeAgentDirectory = !shouldUseDemo && agentsResult && !agentsError;
    const activeAgentIds = new Set((agentsResult?.agents ?? []).map((agent) => getAgentId(agent)).filter(Boolean));
    const showDeletedAgentCalls = String(process.env.SHOW_DELETED_AGENT_CALLS || 'false') === 'true';
    const filteredLiveLogs =
      hasAuthoritativeAgentDirectory && !showDeletedAgentCalls
        ? liveLogs.filter((call) => activeAgentIds.has(getCallAgentId(call)))
        : liveLogs;
    const callLogs = shouldUseDemo ? demoCallLogs : filteredLiveLogs;
    const dashboard = buildObservabilityDashboard(callLogs, goalProfiles, shouldUseDemo ? [] : agentsResult?.agents ?? [], {
      includeCallOnlyAgents: !hasAuthoritativeAgentDirectory
    });
    const storedAnalyses = await listCallAnalyses(process.env.CALL_ANALYSIS_RESULTS_FILE);
    const enrichedDashboard = applyStoredAnalyses(dashboard, storedAnalyses, process.env.GHL_LOCATION_ID);

    response.json({
      dataSource: shouldUseDemo ? 'demo' : liveLogs.length > 0 ? 'highlevel' : 'empty',
      generatedAt: new Date().toISOString(),
      locationId: process.env.GHL_LOCATION_ID || null,
      liveRecordCount: liveResult?.totalRecords ?? liveLogs.length,
      visibleRecordCount: callLogs.length,
      liveAgentCount: agentsResult?.totalRecords ?? agentsResult?.agents?.length ?? null,
      hiddenDeletedAgentCallCount: shouldUseDemo ? 0 : Math.max(0, liveLogs.length - filteredLiveLogs.length),
      liveError,
      agentsError,
      ...enrichedDashboard
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/webhooks/voice-ai-call-end', async (request, response, next) => {
  try {
    const job = await analysisQueue.enqueueWebhookAnalysis(request.body, request.body?.type ?? 'VoiceAiCallEnd');

    response.status(202).json({
      accepted: true,
      event: request.body?.type ?? 'VoiceAiCallEnd',
      jobId: job.id,
      callId: job.callId,
      agentId: job.agentId,
      status: job.status,
      receivedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error.status === 400) {
      response.status(400).json({
        message: error.message,
        status: 400
      });
      return;
    }

    next(error);
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^\/(?!api\/).*/, (_request, response) => {
    response.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error, _request, response, _next) => {
  const status = error.status || 500;
  const isVoiceAiScopeError =
    status === 401 &&
    /not authorized for this scope/i.test(error.message || '') &&
    /HighLevel API/i.test(error.message || '');

  response.status(status).json({
    message: isVoiceAiScopeError
      ? 'HighLevel rejected this edit because the token is missing the voice-ai-agents.write scope. Add that scope to the Private Integration or Marketplace app, regenerate/reinstall the token, and update the local .env token.'
      : error.message || 'Unexpected server error',
    detail: error.message || null,
    requiredScope: isVoiceAiScopeError ? 'voice-ai-agents.write' : undefined,
    status
  });
});

app.listen(port, () => {
  console.log(`Voice AI Observability backend listening on http://localhost:${port}`);
});

async function loadHighLevelCallLogs(query = {}) {
  const page = boundedNumber(query.page, 1, 1, 500);
  const pageSize = boundedNumber(query.pageSize, 50, 1, 100);

  return fetchVoiceAiCallLogs({
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
    locationId: process.env.GHL_LOCATION_ID,
    version: process.env.GHL_API_VERSION,
    baseUrl: process.env.GHL_API_BASE_URL,
    page,
    pageSize,
    agentId: query.agentId,
    contactId: query.contactId,
    callType: query.callType || process.env.GHL_CALL_TYPE,
    actionType: query.actionType,
    startDate: query.startDate,
    endDate: query.endDate,
    sortBy: query.sortBy || 'createdAt',
    sort: query.sort || 'descend'
  });
}

async function loadHighLevelAgents() {
  return fetchVoiceAiAgents({
    token: process.env.GHL_PRIVATE_INTEGRATION_TOKEN,
    locationId: process.env.GHL_LOCATION_ID,
    version: process.env.GHL_API_VERSION,
    baseUrl: process.env.GHL_API_BASE_URL,
    page: 1,
    pageSize: 50
  });
}

function hasHighLevelConfig() {
  return Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_LOCATION_ID);
}

function sanitizeAgentPatch(body = {}) {
  const allowed = ['agentName', 'businessName', 'welcomeMessage', 'agentPrompt'];
  const patch = {};

  for (const field of allowed) {
    if (typeof body[field] === 'string') {
      const value = body[field].trim();
      if (value) patch[field] = value;
    }
  }

  return patch;
}

function applyStoredAnalyses(dashboard, analyses, locationId) {
  const callsById = new Map((dashboard.calls ?? []).map((call) => [call.id, call]));
  const callIds = new Set(callsById.keys());
  const locationAnalyses = analyses.filter(
    (analysis) => !locationId || !analysis.locationId || analysis.locationId === locationId
  );
  const relevantAnalyses = locationAnalyses.filter((analysis) => callIds.has(analysis.callId));
  const analysesByCallId = new Map(relevantAnalyses.map((analysis) => [analysis.callId, analysis]));

  const llmRecommendations = relevantAnalyses.flatMap((analysis) =>
    (analysis.recommendations ?? []).map((recommendation) => {
      const call = callsById.get(analysis.callId);

      return {
        ...recommendation,
        id: recommendation.id || `${analysis.callId}-llm-recommendation`,
        callId: analysis.callId,
        agentId: analysis.agentId,
        contactName: call?.contactName,
        score: analysis.score,
        status: analysis.stage,
        createdAt: analysis.analyzedAt || analysis.updatedAt,
        confidence: 'medium',
        source: 'llm'
      };
    })
  );

  const llmUseActions = relevantAnalyses.flatMap((analysis) =>
    (analysis.useActions ?? []).map((action) => {
      const call = callsById.get(analysis.callId);

      return {
        ...action,
        id: action.id || `${analysis.callId}-llm-action`,
        callId: analysis.callId,
        agentId: analysis.agentId,
        contactName: call?.contactName,
        createdAt: analysis.analyzedAt || analysis.updatedAt,
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
        llmParameterResults: analysis.parameterResults
      };
    }),
    recommendations: [...llmRecommendations, ...(dashboard.recommendations ?? [])],
    useActions: [...llmUseActions, ...(dashboard.useActions ?? [])],
    llmAnalyses: locationAnalyses
      .map((analysis) => ({
        jobId: analysis.jobId,
        callId: analysis.callId,
        agentId: analysis.agentId,
        agentName: analysis.agentName,
        status: analysis.status,
        stage: analysis.stage,
        score: analysis.score,
        summary: analysis.summary,
        errorMessage: analysis.errorMessage,
        attempts: analysis.attempts,
        maxAttempts: analysis.maxAttempts,
        nextRetryAt: analysis.nextRetryAt,
        updatedAt: analysis.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  };
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function toCallAnalysisCandidate(call = {}) {
  return {
    locationId: cleanString(call.locationId ?? call.location?.id ?? process.env.GHL_LOCATION_ID),
    agentId: getCallAgentId(call),
    callId: cleanString(call.callId ?? call.id ?? call.callLogId ?? call._id)
  };
}

function getAgentId(agent = {}) {
  return cleanString(agent.id ?? agent.agentId ?? agent._id);
}

function getCallAgentId(call = {}) {
  return cleanString(call.agentId ?? call.agent?.id);
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
