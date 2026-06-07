import { fetchVoiceAiAgent, fetchVoiceAiAgents, fetchVoiceAiCallLogs, patchVoiceAiAgent } from '../highlevelClient.js';
import { getGhlAccessToken } from '../utils/ghlAuth.js';
import { boundedNumber, cleanString } from '../utils/http.js';

export function createHighLevelService(config = {}) {
  function hasConfig(locationId) {
    return Boolean(locationId || (config.token && config.locationId));
  }

  async function loadCallLogs(query = {}, locationId) {
    const page = boundedNumber(query.page, 1, 1, 500);
    const pageSize = boundedNumber(query.pageSize, 50, 1, 100);
    const effectiveLocationId = locationId || config.locationId;
    const token = await getGhlAccessToken(effectiveLocationId, config.oauth || config);

    return fetchVoiceAiCallLogs({
      token: token || config.token,
      locationId: effectiveLocationId,
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

  async function loadAgents(locationId) {
    const effectiveLocationId = locationId || config.locationId;
    const token = await getGhlAccessToken(effectiveLocationId, config.oauth || config);

    return fetchVoiceAiAgents({
      token: token || config.token,
      locationId: effectiveLocationId,
      version: config.version,
      baseUrl: config.baseUrl,
      page: 1,
      pageSize: 50
    });
  }

  async function getAgent(agentId, locationId) {
    const effectiveLocationId = locationId || config.locationId;
    const token = await getGhlAccessToken(effectiveLocationId, config.oauth || config);

    const result = await fetchVoiceAiAgent({
      token: token || config.token,
      locationId: effectiveLocationId,
      agentId,
      version: config.version,
      baseUrl: config.baseUrl
    });

    return result.agent;
  }

  async function updateAgent(agentId, patch, locationId) {
    const effectiveLocationId = locationId || config.locationId;
    const token = await getGhlAccessToken(effectiveLocationId, config.oauth || config);

    const result = await patchVoiceAiAgent({
      token: token || config.token,
      locationId: effectiveLocationId,
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
