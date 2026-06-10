import { fetchVoiceAiAgent, fetchVoiceAiAgents, fetchVoiceAiCallLogs, patchVoiceAiAgent } from '../highlevelClient.js';
import { getSupabaseHighLevelAuthContext, isSupabaseStoreEnabled } from './supabaseStore.js';
import { boundedNumber, cleanString } from '../utils/http.js';

export function createHighLevelService(config = {}) {
  function hasConfig() {
    return isSupabaseStoreEnabled() || Boolean(config.token && config.locationId);
  }

  async function loadCallLogs(query = {}) {
    const page = boundedNumber(query.page, 1, 1, 500);
    const pageSize = boundedNumber(query.pageSize, 50, 1, 100);
    const auth = await resolveAuthContext(query);

    return fetchVoiceAiCallLogs({
      token: auth.token,
      locationId: auth.locationId,
      version: config.version,
      baseUrl: config.baseUrl,
      page,
      pageSize,
      agentId: query.agentId,
      contactId: query.contactId,
      callType: query.callType || config.callType,
      actionType: query.actionType,
      startDate: query.startDate,
      endDate: query.endDate,
      sortBy: query.sortBy || 'createdAt',
      sort: query.sort || 'descend'
    });
  }

  async function loadAgents() {
    const auth = await resolveAuthContext();

    return fetchVoiceAiAgents({
      token: auth.token,
      locationId: auth.locationId,
      version: config.version,
      baseUrl: config.baseUrl,
      page: 1,
      pageSize: 50
    });
  }

  async function getAgent(agentId) {
    const auth = await resolveAuthContext();
    const result = await fetchVoiceAiAgent({
      token: auth.token,
      locationId: auth.locationId,
      agentId,
      version: config.version,
      baseUrl: config.baseUrl
    });

    return result.agent;
  }

  async function updateAgent(agentId, patch) {
    const auth = await resolveAuthContext();
    const result = await patchVoiceAiAgent({
      token: auth.token,
      locationId: auth.locationId,
      agentId,
      version: config.version,
      baseUrl: config.baseUrl,
      patch
    });

    return result.agent;
  }

  return {
    hasConfig,
    loadAgents,
    loadCallLogs,
    getAgent,
    updateAgent
  };

  async function resolveAuthContext(query = {}) {
    const supabaseAuth = isSupabaseStoreEnabled()
      ? await getSupabaseHighLevelAuthContext({ locationId: query.locationId })
      : null;
    const token = supabaseAuth?.token || config.token;
    const locationId = supabaseAuth?.locationId || cleanString(query.locationId) || config.locationId;

    if (!token || !locationId) {
      const error = new Error('HighLevel auth is missing for this installation. Reinstall or reconnect the app.');
      error.status = 401;
      throw error;
    }

    return {
      token,
      locationId
    };
  }
}

export function sanitizeAgentPatch(body = {}) {
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

export function getAgentId(agent = {}) {
  return cleanString(agent.id ?? agent.agentId ?? agent._id);
}

export function getCallAgentId(call = {}) {
  return cleanString(call.agentId ?? call.agent?.id);
}
