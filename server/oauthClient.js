const DEFAULT_BASE_URL = 'https://services.leadconnectorhq.com';

export function getHighLevelAuthUrl({ clientId, redirectUri, scopes = [], userType = 'Location' }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: Array.isArray(scopes) ? scopes.join(' ') : scopes,
    user_type: userType
  });

  return `https://marketplace.gohighlevel.com/oauth/chooselocation?${params}`;
}

export async function exchangeHighLevelCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  userType = 'Location',
  baseUrl = DEFAULT_BASE_URL
}) {
  if (!code) throw new Error('Missing OAuth code');
  if (!clientId) throw new Error('Missing GHL_CLIENT_ID');
  if (!clientSecret) throw new Error('Missing GHL_CLIENT_SECRET');
  if (!redirectUri) throw new Error('Missing GHL_OAUTH_REDIRECT_URL');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    user_type: userType,
    redirect_uri: redirectUri
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const text = await response.text();
  const parsed = parseJson(text);

  if (!response.ok) {
    const detail = parsed?.message || parsed?.error || text || response.statusText;
    const error = new Error(`HighLevel OAuth token exchange failed: ${detail}`);
    error.status = response.status;
    error.body = parsed;
    throw error;
  }

  return parsed;
}

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
