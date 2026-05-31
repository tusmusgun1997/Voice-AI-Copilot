import { upsertCallAnalysis } from './analysisStore.js';
import { fetchVoiceAiAgent, fetchVoiceAiAgents, fetchVoiceAiCallLogs } from './highlevelClient.js';
import { analyzeCallWithOpenAI } from './llmCallAnalyzer.js';
import { getAgentObservabilityProfile } from './observabilityProfiles.js';
import {
  insertSupabaseWebhookEvent,
  isSupabaseStoreEnabled,
  listSupabaseAnalysisJobs,
  upsertSupabaseAnalysisJob
} from './services/supabaseStore.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 12000;

export function createCallAnalysisQueue(config = {}) {
  const jobs = [];
  const jobStatus = new Map();
  let processing = false;

  async function enqueueWebhookAnalysis(payload, queuedReason = 'webhook') {
    const ids = extractWebhookIds(payload);

    if (!ids.callId) {
      const error = new Error('Webhook payload did not include a callId.');
      error.status = 400;
      throw error;
    }

    const webhookEvent = isSupabaseStoreEnabled()
      ? await insertSupabaseWebhookEvent({
          eventType: payload.type ?? payload.eventType ?? queuedReason,
          ...ids
        })
      : null;
    const job = {
      id: `job-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ...ids,
      webhookEventId: webhookEvent?.id || '',
      eventType: cleanString(payload.type ?? payload.eventType ?? queuedReason),
      queuedReason,
      attempts: 0,
      maxAttempts: resolveMaxAttempts(config),
      status: 'queued',
      stage: 'analysis_pending',
      queuedAt: new Date().toISOString()
    };

    jobs.push(job);
    jobStatus.set(job.id, job);
    await persistJob(job);

    await upsertCallAnalysis(
      {
        jobId: job.id,
        locationId: ids.locationId || config.locationId,
        agentId: ids.agentId,
        callId: ids.callId,
        status: 'queued',
        stage: 'analysis_pending',
        queuedReason,
        attempts: 0,
        maxAttempts: job.maxAttempts
      },
      config.analysisResultsFile
    );

    void processNext();
    return job;
  }

  async function listJobs() {
    if (isSupabaseStoreEnabled()) {
      return listSupabaseAnalysisJobs();
    }

    return Array.from(jobStatus.values()).sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
  }

  async function processNext() {
    if (processing) return;
    processing = true;

    while (jobs.length > 0) {
      const job = jobs.shift();
      await processJob(job);
    }

    processing = false;
  }

  async function processJob(job) {
    const attempts = Number(job.attempts || 0) + 1;
    markJob(job, {
      status: 'running',
      stage: 'analysis_running',
      attempts,
      maxAttempts: job.maxAttempts || resolveMaxAttempts(config),
      lastAttemptAt: new Date().toISOString(),
      startedAt: job.startedAt || new Date().toISOString(),
      nextRetryAt: null
    });
    await persistJob(job);

    try {
      await upsertCallAnalysis(
        {
          jobId: job.id,
          locationId: job.locationId || config.locationId,
          agentId: job.agentId,
          callId: job.callId,
          status: 'running',
          stage: 'analysis_running',
          queuedReason: job.queuedReason,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt: null
        },
        config.analysisResultsFile
      );

      const call = await fetchCallForJob(job, config);

      if (!call.transcript) {
        throw retryableError(`HighLevel transcript is not ready yet for callId=${job.callId}`);
      }

      const agent = await fetchAgentForCall(call, config);
      const profile = await getAgentObservabilityProfile(
        {
          id: call.agentId || job.agentId,
          name: agent?.name || call.agentName
        },
        config.observabilityProfilesFile,
        config.parameterVersionsFile
      );

      const analysis = await analyzeCallWithOpenAI({
        apiKey: config.openAiApiKey,
        model: config.openAiModel,
        call,
        agent,
        profile
      });

      await upsertCallAnalysis(
        {
          jobId: job.id,
          locationId: job.locationId || config.locationId,
          agentId: call.agentId || job.agentId,
          agentName: agent?.name || call.agentName,
          callId: call.id || job.callId,
          callCreatedAt: call.createdAt,
          durationSeconds: call.durationSeconds,
          status: analysis.status,
          stage: analysis.stage,
          score: analysis.score,
          summary: analysis.summary,
          parameterResults: analysis.parameterResults,
          recommendations: decorateRecommendations(analysis.recommendations, call),
          useActions: decorateUseActions(analysis.useActions, call),
          model: config.openAiModel,
          queuedReason: job.queuedReason,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt: null,
          analyzedAt: new Date().toISOString()
        },
        config.analysisResultsFile
      );

      markJob(job, { status: analysis.status, completedAt: new Date().toISOString() });
      await persistJob(job);
    } catch (error) {
      if (shouldRetry(error, job)) {
        await scheduleRetry(job, error, config);
        return;
      }

      await upsertCallAnalysis(
        {
          jobId: job.id,
          locationId: job.locationId || config.locationId,
          agentId: job.agentId,
          callId: job.callId,
          status: 'failed',
          stage: 'analysis_failed',
          errorMessage: error.message,
          queuedReason: job.queuedReason,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          nextRetryAt: null
        },
        config.analysisResultsFile
      );

      markJob(job, {
        status: 'failed',
        stage: 'analysis_failed',
        errorMessage: error.message,
        completedAt: new Date().toISOString()
      });
      await persistJob(job);
      console.error(`Call analysis job failed for callId=${job.callId}: ${error.message}`);
    }
  }

  async function scheduleRetry(job, error, config) {
    const delayMs = resolveRetryDelayMs(config, job.attempts);
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

    markJob(job, {
      status: 'retrying',
      stage: error.stage || 'waiting_for_call_log',
      errorMessage: error.message,
      nextRetryAt
    });
    await persistJob(job);

    await upsertCallAnalysis(
      {
        jobId: job.id,
        locationId: job.locationId || config.locationId,
        agentId: job.agentId,
        callId: job.callId,
        status: 'retrying',
        stage: error.stage || 'waiting_for_call_log',
        errorMessage: error.message,
        queuedReason: job.queuedReason,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        nextRetryAt
      },
      config.analysisResultsFile
    );

    setTimeout(() => {
      jobs.push(job);
      void processNext();
    }, delayMs);
  }

  return {
    enqueueWebhookAnalysis,
    listJobs
  };
}

async function fetchCallForJob(job, config) {
  const firstPass = await fetchVoiceAiCallLogs({
    token: config.highLevelToken,
    locationId: job.locationId || config.locationId,
    version: config.highLevelVersion,
    baseUrl: config.highLevelBaseUrl,
    page: 1,
    pageSize: 50,
    agentId: job.agentId,
    callType: config.callType,
    sortBy: 'createdAt',
    sort: 'descend'
  });

  let call = findCall(firstPass.callLogs, job.callId);

  if (!call && job.agentId) {
    const fallback = await fetchVoiceAiCallLogs({
      token: config.highLevelToken,
      locationId: job.locationId || config.locationId,
      version: config.highLevelVersion,
      baseUrl: config.highLevelBaseUrl,
      page: 1,
      pageSize: 50,
      callType: config.callType,
      sortBy: 'createdAt',
      sort: 'descend'
    });
    call = findCall(fallback.callLogs, job.callId);
  }

  if (!call) {
    throw retryableError(`Unable to find HighLevel call log for callId=${job.callId}`, 'waiting_for_call_log');
  }

  return normalizeCall(call);
}

async function fetchAgentForCall(call, config) {
  if (!call.agentId) return null;

  try {
    const result = await fetchVoiceAiAgent({
      token: config.highLevelToken,
      locationId: call.locationId || config.locationId,
      agentId: call.agentId,
      version: config.highLevelVersion,
      baseUrl: config.highLevelBaseUrl
    });

    return normalizeAgent(result.agent);
  } catch {
    // Fall back to the list endpoint when the detailed agent endpoint is missing a scope.
  }

  try {
    const result = await fetchVoiceAiAgents({
      token: config.highLevelToken,
      locationId: call.locationId || config.locationId,
      version: config.highLevelVersion,
      baseUrl: config.highLevelBaseUrl,
      page: 1,
      pageSize: 50
    });

    const agent = result.agents.find((item) => getId(item) === call.agentId);
    return agent ? normalizeAgent(agent) : { id: call.agentId, name: call.agentName };
  } catch {
    return { id: call.agentId, name: call.agentName };
  }
}

function findCall(callLogs, callId) {
  return callLogs.find((call) => getCallId(call) === callId) ?? null;
}

function normalizeCall(raw) {
  return {
    id: getCallId(raw),
    locationId: raw.locationId ?? raw.location?.id ?? '',
    agentId: raw.agentId ?? raw.agent?.id ?? 'unknown-agent',
    agentName: raw.agentName ?? raw.agent?.name ?? 'Voice AI Agent',
    durationSeconds: Number(raw.duration ?? raw.durationSeconds ?? raw.callDuration ?? 0) || 0,
    createdAt: raw.createdAt ?? raw.dateAdded ?? raw.startTime ?? new Date().toISOString(),
    summary: raw.summary ?? raw.callSummary ?? '',
    transcript: normalizeTranscript(raw.transcript ?? raw.messages ?? raw.conversation ?? '')
  };
}

function normalizeAgent(raw) {
  return {
    id: getId(raw),
    name: raw.agentName ?? raw.name ?? raw.title ?? 'Voice AI Agent',
    businessName: raw.businessName ?? '',
    welcomeMessage: raw.welcomeMessage ?? '',
    agentPrompt: raw.agentPrompt ?? raw.prompt ?? '',
    description: raw.description ?? '',
    language: raw.language ?? '',
    timezone: raw.timezone ?? '',
    maxCallDuration: raw.maxCallDuration ?? null,
    voiceId: raw.voiceId ?? '',
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    raw
  };
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
  if (transcript && typeof transcript === 'object') return JSON.stringify(transcript);
  return '';
}

function decorateRecommendations(recommendations, call) {
  return recommendations
    .filter((recommendation) => ['critical', 'warning'].includes(String(recommendation?.severity || '').toLowerCase()))
    .map((recommendation, index) => ({
      id: `${call.id}-llm-rec-${index + 1}`,
      callId: call.id,
      agentId: call.agentId,
      title: recommendation.title,
      detail: recommendation.detail,
      severity: recommendation.severity,
      promptPatch: recommendation.promptGuidance,
      parameterId: recommendation.parameterId,
      targetType: recommendation.targetType || 'observability_parameter',
      targetAction: recommendation.targetAction || 'update',
      targetId: recommendation.targetId || recommendation.parameterId || '',
      suggestedChange: recommendation.suggestedChange || recommendation.promptGuidance || recommendation.detail || '',
      reviewStatus: recommendation.reviewStatus || 'needs_human_review'
    }));
}

function decorateUseActions(useActions, call) {
  return useActions.map((action, index) => ({
    id: `${call.id}-llm-action-${index + 1}`,
    callId: call.id,
    agentId: call.agentId,
    type: action.type,
    reason: action.reason,
    snippet: action.snippet,
    severity: action.severity,
    parameterId: action.parameterId,
    status: 'open'
  }));
}

function extractWebhookIds(payload = {}) {
  const data = payload.data ?? payload.call ?? payload;

  return {
    locationId: cleanString(payload.locationId ?? data.locationId ?? payload.location?.id),
    agentId: cleanString(payload.agentId ?? data.agentId ?? data.agent?.id),
    callId: cleanString(payload.callId ?? payload.callLogId ?? data.callId ?? data.id ?? data.callLogId)
  };
}

function getCallId(call) {
  return cleanString(call.callId ?? call.id ?? call.callLogId ?? call._id);
}

function getId(item) {
  return cleanString(item.id ?? item.agentId ?? item._id);
}

function markJob(job, patch) {
  Object.assign(job, patch);
}

async function persistJob(job) {
  try {
    await upsertSupabaseAnalysisJob(job);
  } catch (error) {
    console.error(`Unable to persist analysis job ${job.id}: ${error.message}`);
  }
}

function shouldRetry(error, job) {
  return Boolean(error.retryable && Number(job.attempts || 0) < Number(job.maxAttempts || DEFAULT_MAX_ATTEMPTS));
}

function retryableError(message, stage = 'waiting_for_transcript') {
  const error = new Error(message);
  error.retryable = true;
  error.stage = stage;
  return error;
}

function resolveMaxAttempts(config = {}) {
  const parsed = Number(config.maxAttempts || process.env.ANALYSIS_JOB_MAX_ATTEMPTS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_MAX_ATTEMPTS;
}

function resolveRetryDelayMs(config = {}, attempt = 1) {
  const parsed = Number(config.retryDelayMs || process.env.ANALYSIS_JOB_RETRY_DELAY_MS);
  const baseDelay = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETRY_DELAY_MS;
  return Math.min(baseDelay * Math.max(1, Number(attempt || 1)), 60000);
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
