const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';

export async function fetchVoiceAiCallLogs({
  token,
  locationId,
  version = '2023-02-21',
  baseUrl = DEFAULT_BASE_URL,
  page = 1,
  pageSize = 50,
  agentId,
  contactId,
  callType,
  actionType,
  startDate,
  endDate,
  sortBy,
  sort
}) {
  if (!token) {
    throw new Error('Missing GHL_PRIVATE_INTEGRATION_TOKEN');
  }

  if (!locationId) {
    throw new Error('Missing GHL_LOCATION_ID');
  }

  const params = new URLSearchParams({
    locationId,
    page: String(page),
    pageSize: String(pageSize)
  });

  if (agentId) params.set('agentId', agentId);
  if (contactId) params.set('contactId', contactId);
  if (callType) params.set('callType', callType);
  if (actionType) params.set('actionType', actionType);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (sortBy) params.set('sortBy', sortBy);
  if (sort) params.set('sort', sort);

  const response = await fetch(`${baseUrl}/voice-ai/dashboard/call-logs?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  const body = parseJson(bodyText);

  if (!response.ok) {
    const detail = body?.message || bodyText || response.statusText;
    const error = new Error(`HighLevel API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    raw: body,
    callLogs: extractCallLogs(body),
    totalRecords: body?.totalRecords ?? body?.total ?? null
  };
}

export async function fetchVoiceAiAgents({
  token,
  locationId,
  version = '2023-02-21',
  baseUrl = DEFAULT_BASE_URL,
  page = 1,
  pageSize = 50
}) {
  if (!token) {
    throw new Error('Missing GHL_PRIVATE_INTEGRATION_TOKEN');
  }

  if (!locationId) {
    throw new Error('Missing GHL_LOCATION_ID');
  }

  const params = new URLSearchParams({
    locationId,
    page: String(page),
    pageSize: String(pageSize)
  });

  const response = await fetch(`${baseUrl}/voice-ai/agents?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  const body = parseJson(bodyText);

  if (!response.ok) {
    const detail = body?.message || bodyText || response.statusText;
    const error = new Error(`HighLevel API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    raw: body,
    agents: extractAgents(body),
    totalRecords: body?.totalRecords ?? body?.total ?? null
  };
}

export async function fetchVoiceAiAgent({
  token,
  locationId,
  agentId,
  version = '2023-02-21',
  baseUrl = DEFAULT_BASE_URL
}) {
  if (!token) {
    throw new Error('Missing GHL_PRIVATE_INTEGRATION_TOKEN');
  }

  if (!locationId) {
    throw new Error('Missing GHL_LOCATION_ID');
  }

  if (!agentId) {
    throw new Error('Missing agentId');
  }

  const params = new URLSearchParams({ locationId });
  const response = await fetch(`${baseUrl}/voice-ai/agents/${agentId}?${params}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json'
    }
  });

  const bodyText = await response.text();
  const body = parseJson(bodyText);

  if (!response.ok) {
    const detail = body?.message || bodyText || response.statusText;
    const error = new Error(`HighLevel API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    raw: body,
    agent: body?.agent ?? body?.data ?? body
  };
}

export async function patchVoiceAiAgent({
  token,
  locationId,
  agentId,
  version = '2023-02-21',
  baseUrl = DEFAULT_BASE_URL,
  patch
}) {
  if (!token) {
    throw new Error('Missing GHL_PRIVATE_INTEGRATION_TOKEN');
  }

  if (!locationId) {
    throw new Error('Missing GHL_LOCATION_ID');
  }

  if (!agentId) {
    throw new Error('Missing agentId');
  }

  const params = new URLSearchParams({ locationId });
  const response = await fetch(`${baseUrl}/voice-ai/agents/${agentId}?${params}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: version,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patch)
  });

  const bodyText = await response.text();
  const body = parseJson(bodyText);

  if (!response.ok) {
    const detail = body?.message || bodyText || response.statusText;
    const error = new Error(`HighLevel API ${response.status}: ${detail}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return {
    raw: body,
    agent: body?.agent ?? body?.data ?? body
  };
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function extractCallLogs(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.callLogs)) return body.callLogs;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.calls)) return body.calls;
  return [];
}

function extractAgents(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.agents)) return body.agents;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}
