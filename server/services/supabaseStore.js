const SUPABASE_STORE = 'supabase';
const DEFAULT_LOCATION_ID = 'local-demo-location';
let installationCache = null;

export function isSupabaseStoreEnabled() {
  return String(process.env.DATA_STORE || '').toLowerCase() === SUPABASE_STORE;
}

export async function readSupabaseCollection(key) {
  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);

  if (key === 'versions') return readVersions(client, installation.id);
  if (key === 'profiles') return readProfiles(client, installation.id);
  if (key === 'analyses') return readAnalyses(client, installation.id);

  return [];
}

export async function writeSupabaseCollection(key, items) {
  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);
  const safeItems = Array.isArray(items) ? items : [];

  if (key === 'versions') return writeVersions(client, installation.id, safeItems);
  if (key === 'profiles') return writeProfiles(client, installation.id, safeItems);
  if (key === 'analyses') return writeAnalyses(client, installation.id, safeItems);

  return [];
}

export async function insertSupabaseWebhookEvent(event = {}) {
  if (!isSupabaseStoreEnabled()) return null;

  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);
  const created = await client.insert('webhook_events', {
    id: event.id || `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    installation_id: installation.id,
    event_type: cleanString(event.eventType || event.type || 'VoiceAiCallEnd'),
    ghl_location_id: cleanString(event.locationId),
    ghl_agent_id: cleanString(event.agentId),
    ghl_call_id: cleanString(event.callId),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {}
  });

  return created[0] ?? null;
}

export async function listSupabaseAnalysisJobs() {
  if (!isSupabaseStoreEnabled()) return [];

  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);
  const rows = await client.select('call_analysis_jobs', {
    installation_id: `eq.${installation.id}`,
    order: 'queued_at.desc'
  });

  return rows.map(rowToAnalysisJob);
}

export async function upsertSupabaseAnalysisJob(job = {}) {
  if (!isSupabaseStoreEnabled() || !job.id) return null;

  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);
  const rows = await client.upsert('call_analysis_jobs', {
    id: job.id,
    installation_id: installation.id,
    webhook_event_id: job.webhookEventId || null,
    ghl_location_id: cleanString(job.locationId),
    ghl_agent_id: cleanString(job.agentId),
    ghl_call_id: cleanString(job.callId),
    event_type: cleanString(job.eventType),
    queued_reason: cleanString(job.queuedReason || 'webhook'),
    status: cleanString(job.status || 'queued'),
    stage: cleanString(job.stage || 'analysis_pending'),
    attempts: Number.isFinite(Number(job.attempts)) ? Number(job.attempts) : 0,
    max_attempts: Number.isFinite(Number(job.maxAttempts)) ? Number(job.maxAttempts) : 5,
    next_retry_at: job.nextRetryAt || null,
    error_message: cleanString(job.errorMessage),
    queued_at: job.queuedAt || new Date().toISOString(),
    started_at: job.startedAt || null,
    completed_at: job.completedAt || null,
    updated_at: new Date().toISOString()
  });

  return rows[0] ? rowToAnalysisJob(rows[0]) : null;
}

function createSupabaseRestClient() {
  const url = cleanUrl(process.env.SUPABASE_URL);
  const serviceRoleKey = cleanString(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || !serviceRoleKey) {
    const error = new Error('DATA_STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    error.status = 500;
    throw error;
  }

  async function request(table, { method = 'GET', params = {}, body, prefer = '' } = {}) {
    const endpoint = new URL(`${url}/rest/v1/${table}`);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') endpoint.searchParams.set(key, value);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    const parsed = parseJson(text);

    if (!response.ok) {
      const detail = parsed?.message || parsed?.hint || text || response.statusText;
      const error = new Error(`Supabase ${method} ${table} failed: ${detail}`);
      error.status = response.status;
      throw error;
    }

    return parsed ?? [];
  }

  return {
    select(table, params = {}) {
      return request(table, {
        params: {
          select: '*',
          ...params
        }
      });
    },
    insert(table, rows) {
      return request(table, {
        method: 'POST',
        body: rows,
        prefer: 'return=representation'
      });
    },
    upsert(table, rows, conflictColumn = 'id') {
      return request(table, {
        method: 'POST',
        params: {
          on_conflict: conflictColumn
        },
        body: rows,
        prefer: 'resolution=merge-duplicates,return=representation'
      });
    },
    update(table, params, patch) {
      return request(table, {
        method: 'PATCH',
        params,
        body: patch,
        prefer: 'return=representation'
      });
    },
    delete(table, params) {
      return request(table, {
        method: 'DELETE',
        params
      });
    }
  };
}

export async function updateSupabaseHumanAction(actionId, patch = {}) {
  if (!isSupabaseStoreEnabled() || !actionId) return null;

  const client = createSupabaseRestClient();
  const rows = await client.update(
    'human_actions',
    {
      id: `eq.${actionId}`
    },
    {
      status: cleanString(patch.status) || 'open',
      updated_at: new Date().toISOString()
    }
  );

  return rows[0] ? rowToAction(rows[0]) : null;
}

export async function deleteSupabaseHumanAction(actionId) {
  if (!isSupabaseStoreEnabled() || !actionId) return false;

  const client = createSupabaseRestClient();
  await client.delete('human_actions', {
    id: `eq.${actionId}`
  });

  return true;
}

export async function cleanupSupabaseDeletedAgents({ activeAgentIds = [], locationId, allowEmptyActiveSet = false } = {}) {
  if (!isSupabaseStoreEnabled()) return { deletedAgentIds: [], deletedCount: 0 };

  const client = createSupabaseRestClient();
  const installation = await getInstallation(client);
  const activeSet = new Set((activeAgentIds ?? []).map(cleanString).filter(Boolean));
  if (activeSet.size === 0 && !allowEmptyActiveSet) return { deletedAgentIds: [], deletedCount: 0 };

  const [profiles, analyses, jobs, events] = await Promise.all([
    client.select('agent_observability_profiles', {
      installation_id: `eq.${installation.id}`,
      select: 'ghl_agent_id'
    }),
    client.select('call_analyses', {
      installation_id: `eq.${installation.id}`,
      select: 'ghl_agent_id'
    }),
    client.select('call_analysis_jobs', {
      installation_id: `eq.${installation.id}`,
      select: 'ghl_agent_id'
    }),
    client.select('webhook_events', {
      installation_id: `eq.${installation.id}`,
      select: 'ghl_agent_id'
    })
  ]);

  const knownAgentIds = Array.from(
    new Set(
      [...profiles, ...analyses, ...jobs, ...events]
        .map((row) => cleanString(row.ghl_agent_id))
        .filter(Boolean)
    )
  );
  const deletedAgentIds = knownAgentIds.filter((agentId) => !activeSet.has(agentId));

  for (const agentId of deletedAgentIds) {
    await cleanupSupabaseAgentData({ agentId, locationId, client, installationId: installation.id });
  }

  return {
    deletedAgentIds,
    deletedCount: deletedAgentIds.length
  };
}

export async function cleanupSupabaseAgentData({ agentId, locationId, client: existingClient, installationId } = {}) {
  const cleanAgentId = cleanString(agentId);
  if (!isSupabaseStoreEnabled() || !cleanAgentId) return { deletedAgentIds: [], deletedCount: 0 };

  const client = existingClient || createSupabaseRestClient();
  const installation = installationId ? { id: installationId } : await getInstallation(client);
  const params = {
    installation_id: `eq.${installation.id}`,
    ghl_agent_id: `eq.${cleanAgentId}`
  };

  await Promise.all([
    client.delete('agent_observability_profiles', params),
    client.delete('call_analyses', params),
    client.delete('call_analysis_jobs', params),
    client.delete('webhook_events', params)
  ]);

  return {
    deletedAgentIds: [cleanAgentId],
    deletedCount: 1
  };
}

async function getInstallation(client) {
  const locationId = cleanString(process.env.SUPABASE_GHL_LOCATION_ID || process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID);

  if (installationCache?.ghl_location_id === locationId) return installationCache;

  const existing = await client.select('app_installations', {
    ghl_location_id: `eq.${locationId}`,
    limit: '1'
  });

  if (existing[0]) {
    installationCache = existing[0];
    return installationCache;
  }

  const created = await client.insert('app_installations', {
    ghl_company_id: cleanString(process.env.GHL_COMPANY_ID),
    ghl_location_id: locationId,
    ghl_user_type: cleanString(process.env.GHL_OAUTH_USER_TYPE) || 'Location',
    display_name: cleanString(process.env.SUPABASE_INSTALLATION_NAME || process.env.GHL_LOCATION_NAME),
    is_sandbox: String(process.env.SUPABASE_IS_SANDBOX || 'true') === 'true'
  });

  installationCache = created[0];
  return installationCache;
}

async function readVersions(client, installationId) {
  const versions = await client.select('llm_parameter_versions', {
    installation_id: `eq.${installationId}`,
    is_default: 'eq.false',
    order: 'created_at.asc'
  });

  const parameterGroups = await Promise.all(
    versions.map(async (version) => {
      const parameters = await client.select('llm_parameters', {
        version_id: `eq.${version.id}`,
        order: 'sort_order.asc'
      });

      return [version.id, parameters];
    })
  );
  const parametersByVersionId = new Map(parameterGroups);

  return versions.map((version) => ({
    id: version.id,
    name: version.name || '',
    versionLabel: version.version_label || '',
    description: version.description || '',
    sourceTemplateId: version.source_version_id || '',
    parameters: (parametersByVersionId.get(version.id) ?? []).map(rowToParameter),
    createdAt: version.created_at,
    updatedAt: version.updated_at
  }));
}

async function writeVersions(client, installationId, versions) {
  if (versions.length === 0) return [];

  const now = new Date().toISOString();

  await client.upsert(
    'llm_parameter_versions',
    versions.map((version) => ({
      id: version.id,
      installation_id: installationId,
      name: version.name || 'LLM parameter version',
      version_label: version.versionLabel || 'v1',
      description: version.description || '',
      source_version_id: version.sourceTemplateId || null,
      is_default: false,
      is_locked: false,
      created_at: version.createdAt || now,
      updated_at: now
    }))
  );

  for (const version of versions) {
    await client.delete('llm_parameters', {
      version_id: `eq.${version.id}`
    });

    const parameters = (version.parameters ?? []).map((parameter, index) => parameterToRow(parameter, version.id, index));
    if (parameters.length > 0) {
      await client.insert('llm_parameters', parameters);
    }
  }

  return versions;
}

async function readProfiles(client, installationId) {
  const rows = await client.select('agent_observability_profiles', {
    installation_id: `eq.${installationId}`,
    order: 'created_at.asc'
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.profile_label || '',
    agentIds: [row.ghl_agent_id].filter(Boolean),
    agentNames: [row.agent_name_snapshot].filter(Boolean),
    scriptSummary: '',
    goals: [],
    negativeSignals: [],
    parameterVersionId: row.parameter_version_id || '',
    parameterVersionName: '',
    parameterVersionDescription: '',
    parameters: [],
    configured: Boolean(row.configured)
  }));
}

async function writeProfiles(client, installationId, profiles) {
  if (profiles.length === 0) return [];

  const now = new Date().toISOString();
  const rows = profiles
    .map((profile) => {
      const agentId = profile.agentIds?.[0];
      if (!agentId) return null;

      return {
        id: profile.id || `profile-${agentId}`,
        installation_id: installationId,
        ghl_agent_id: agentId,
        agent_name_snapshot: profile.agentNames?.[0] || '',
        parameter_version_id: profile.parameterVersionId || null,
        profile_label: profile.name || '',
        configured: Boolean(profile.configured),
        created_at: profile.createdAt || now,
        updated_at: now
      };
    })
    .filter(Boolean);

  if (rows.length > 0) {
    await client.upsert('agent_observability_profiles', rows);
  }

  return profiles;
}

async function readAnalyses(client, installationId) {
  const analyses = await client.select('call_analyses', {
    installation_id: `eq.${installationId}`,
    order: 'updated_at.desc'
  });

  const hydrated = await Promise.all(
    analyses.map(async (analysis) => {
      const [parameterResults, recommendations, useActions] = await Promise.all([
        client.select('call_parameter_results', {
          analysis_id: `eq.${analysis.id}`,
          order: 'created_at.asc'
        }),
        client.select('call_recommendations', {
          analysis_id: `eq.${analysis.id}`,
          order: 'created_at.asc'
        }),
        client.select('human_actions', {
          analysis_id: `eq.${analysis.id}`,
          order: 'created_at.asc'
        })
      ]);

      return rowToAnalysis(analysis, parameterResults, recommendations, useActions);
    })
  );

  return hydrated;
}

async function writeAnalyses(client, installationId, analyses) {
  if (analyses.length === 0) return [];

  const now = new Date().toISOString();

  await client.upsert(
    'call_analyses',
    analyses.map((analysis) => ({
      id: analysis.id,
      installation_id: installationId,
      job_key: analysis.jobId || '',
      parameter_version_id: analysis.parameterVersionId || null,
      ghl_location_id: analysis.locationId || '',
      ghl_agent_id: analysis.agentId || '',
      agent_name_snapshot: analysis.agentName || '',
      ghl_call_id: analysis.callId,
      call_created_at: analysis.callCreatedAt || null,
      duration_seconds: analysis.durationSeconds,
      status: analysis.status || 'queued',
      stage: analysis.stage || 'analysis_pending',
      score: analysis.score,
      summary: analysis.summary || '',
      model: analysis.model || '',
      error_message: analysis.errorMessage || '',
      analyzed_at: analysis.analyzedAt,
      created_at: analysis.createdAt || now,
      updated_at: now
    }))
  );

  for (const analysis of analyses) {
    await Promise.all([
      client.delete('call_parameter_results', { analysis_id: `eq.${analysis.id}` }),
      client.delete('call_recommendations', { analysis_id: `eq.${analysis.id}` }),
      client.delete('human_actions', { analysis_id: `eq.${analysis.id}` })
    ]);

    const parameterResults = (analysis.parameterResults ?? []).map((result, index) =>
      parameterResultToRow(result, analysis.id, index)
    );
    const recommendations = (analysis.recommendations ?? []).map((recommendation) =>
      recommendationToRow(recommendation, installationId, analysis)
    );
    const actions = (analysis.useActions ?? []).map((action) => actionToRow(action, installationId, analysis));

    await Promise.all([
      parameterResults.length ? client.insert('call_parameter_results', parameterResults) : Promise.resolve([]),
      recommendations.length ? client.insert('call_recommendations', recommendations) : Promise.resolve([]),
      actions.length ? client.insert('human_actions', actions) : Promise.resolve([])
    ]);
  }

  return analyses;
}

function rowToParameter(row) {
  return {
    id: row.parameter_key || row.id,
    title: row.title || '',
    description: row.description_for_llm || '',
    category: row.category || 'custom',
    successSignals: row.success_signal_hints ?? [],
    failureSignals: row.failure_signal_hints ?? [],
    recommendation: row.recommendation_when_missed || '',
    promptGuidance: row.prompt_or_script_guidance || '',
    requiresHumanReview: Boolean(row.requires_human_review),
    useActionType: row.use_action_type || '',
    enabled: row.is_enabled !== false
  };
}

function parameterToRow(parameter, versionId, index) {
  const parameterKey = parameter.id || slug(parameter.title || `parameter-${index + 1}`);

  return {
    id: `${versionId}-${parameterKey}`,
    version_id: versionId,
    parameter_key: parameterKey,
    title: parameter.title || '',
    description_for_llm: parameter.description || '',
    category: parameter.category || 'custom',
    success_signal_hints: parameter.successSignals ?? [],
    failure_signal_hints: parameter.failureSignals ?? [],
    recommendation_when_missed: parameter.recommendation || '',
    prompt_or_script_guidance: parameter.promptGuidance || '',
    requires_human_review: Boolean(parameter.requiresHumanReview),
    use_action_type: parameter.useActionType || '',
    is_enabled: parameter.enabled !== false,
    sort_order: index
  };
}

function rowToAnalysis(row, parameterResults, recommendations, useActions) {
  return {
    id: row.id,
    jobId: row.job_key || '',
    locationId: row.ghl_location_id || '',
    agentId: row.ghl_agent_id || '',
    agentName: row.agent_name_snapshot || '',
    callId: row.ghl_call_id || '',
    parameterVersionId: row.parameter_version_id || '',
    callCreatedAt: row.call_created_at || '',
    durationSeconds: row.duration_seconds,
    status: row.status || 'queued',
    stage: row.stage || 'analysis_pending',
    score: row.score,
    summary: row.summary || '',
    parameterResults: parameterResults.map(rowToParameterResult),
    recommendations: recommendations.map(rowToRecommendation),
    useActions: useActions.map(rowToAction),
    errorMessage: row.error_message || '',
    model: row.model || '',
    queuedReason: row.queued_reason || '',
    attempts: row.attempts || 0,
    maxAttempts: row.max_attempts,
    nextRetryAt: row.next_retry_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analyzedAt: row.analyzed_at
  };
}

function rowToParameterResult(row) {
  return {
    parameterId: row.parameter_key || '',
    title: row.title || '',
    status: row.status || 'unknown',
    confidence: row.confidence || 'medium',
    evidence: row.evidence || '',
    reasoningSummary: row.reasoning_summary || ''
  };
}

function parameterResultToRow(result, analysisId, index) {
  const parameterKey = result.parameterId || `parameter-${index + 1}`;

  return {
    id: `${analysisId}-result-${parameterKey}`,
    analysis_id: analysisId,
    parameter_key: parameterKey,
    title: result.title || '',
    status: result.status || 'unknown',
    confidence: result.confidence || 'medium',
    evidence: result.evidence || '',
    reasoning_summary: result.reasoningSummary || ''
  };
}

function rowToRecommendation(row) {
  return {
    id: row.id,
    callId: row.ghl_call_id,
    agentId: row.ghl_agent_id,
    parameterId: row.parameter_key || '',
    title: row.title || '',
    detail: row.detail || '',
    severity: row.severity || 'info',
    promptPatch: row.prompt_patch || '',
    targetType: row.target_type || 'observability_parameter',
    targetAction: row.target_action || 'update',
    targetId: row.target_id || '',
    suggestedChange: row.suggested_change || '',
    reviewStatus: row.review_status || 'needs_human_review'
  };
}

function recommendationToRow(recommendation, installationId, analysis) {
  return {
    id: recommendation.id || `${analysis.id}-recommendation-${slug(recommendation.title || Date.now())}`,
    analysis_id: analysis.id,
    installation_id: installationId,
    ghl_agent_id: recommendation.agentId || analysis.agentId || '',
    ghl_call_id: recommendation.callId || analysis.callId || '',
    parameter_key: recommendation.parameterId || '',
    title: recommendation.title || '',
    detail: recommendation.detail || '',
    severity: recommendation.severity || 'info',
    prompt_patch: recommendation.promptPatch || recommendation.promptGuidance || '',
    target_type: recommendation.targetType || 'observability_parameter',
    target_action: recommendation.targetAction || 'update',
    target_id: recommendation.targetId || '',
    suggested_change: recommendation.suggestedChange || recommendation.promptPatch || recommendation.detail || '',
    review_status: recommendation.reviewStatus || 'needs_human_review'
  };
}

function rowToAction(row) {
  return {
    id: row.id,
    callId: row.ghl_call_id,
    agentId: row.ghl_agent_id,
    parameterId: row.parameter_key || '',
    title: row.title || '',
    type: row.action_type || '',
    category: row.action_category || actionCategoryFromSignals(row.action_type, row.target_type),
    reason: row.reason || '',
    suggestion: row.suggestion || '',
    snippet: row.transcript_snippet || '',
    severity: row.severity || 'info',
    targetType: row.target_type || '',
    targetId: row.target_id || '',
    status: row.status || 'open',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToAnalysisJob(row) {
  return {
    id: row.id,
    webhookEventId: row.webhook_event_id || '',
    locationId: row.ghl_location_id || '',
    agentId: row.ghl_agent_id || '',
    callId: row.ghl_call_id || '',
    eventType: row.event_type || '',
    queuedReason: row.queued_reason || '',
    status: row.status || 'queued',
    stage: row.stage || 'analysis_pending',
    attempts: Number.isFinite(Number(row.attempts)) ? Number(row.attempts) : 0,
    maxAttempts: Number.isFinite(Number(row.max_attempts)) ? Number(row.max_attempts) : null,
    nextRetryAt: row.next_retry_at || null,
    errorMessage: row.error_message || '',
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

function actionToRow(action, installationId, analysis) {
  return {
    id: action.id || `${analysis.id}-action-${slug(action.type || Date.now())}`,
    analysis_id: analysis.id,
    installation_id: installationId,
    ghl_agent_id: action.agentId || analysis.agentId || '',
    ghl_call_id: action.callId || analysis.callId || '',
    parameter_key: action.parameterId || '',
    title: action.title || action.reason || 'Human review needed',
    action_type: action.type || 'human_review',
    action_category: action.category || actionCategoryFromSignals(action.type, action.targetType),
    reason: action.reason || '',
    suggestion: action.suggestion || '',
    transcript_snippet: action.snippet || '',
    severity: action.severity || 'info',
    target_type: action.targetType || 'human_follow_up',
    target_id: action.targetId || action.parameterId || '',
    status: action.status || 'open'
  };
}

function cleanUrl(value) {
  return cleanString(value).replace(/\/+$/, '');
}

function actionCategoryFromSignals(type, targetType) {
  if (targetType === 'human_follow_up' || type === 'follow_up') return 'customer';
  return 'system';
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
