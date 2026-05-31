import { fetchVoiceAiAgent, fetchVoiceAiAgents, fetchVoiceAiCallLogs, patchVoiceAiAgent } from '../highlevelClient.js';
import { boundedNumber, cleanString } from '../utils/http.js';

export function createHighLevelService(config = {}) {
  function hasConfig() {
    return Boolean(config.token && config.locationId);
  }

  async function loadCallLogs(query = {}) {
    const page = boundedNumber(query.page, 1, 1, 500);
    const pageSize = boundedNumber(query.pageSize, 50, 1, 100);

    return fetchVoiceAiCallLogs({
      token: config.token,
      locationId: config.locationId,
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
    return fetchVoiceAiAgents({
      token: config.token,
      locationId: config.locationId,
      version: config.version,
      baseUrl: config.baseUrl,
      page: 1,
      pageSize: 50
    });
  }

  async function getAgent(agentId) {
    const result = await fetchVoiceAiAgent({
      token: config.token,
      locationId: config.locationId,
      agentId,
      version: config.version,
      baseUrl: config.baseUrl
    });

    return result.agent;
  }

  async function updateAgent(agentId, patch) {
    const result = await patchVoiceAiAgent({
      token: config.token,
      locationId: config.locationId,
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
