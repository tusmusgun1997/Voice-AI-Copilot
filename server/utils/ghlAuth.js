import { exchangeHighLevelCode } from '../oauthClient.js';
import { getSupabaseInstallationByLocation, upsertSupabaseInstallation } from '../services/supabaseStore.js';

export async function getGhlAccessToken(locationId, oauthConfig) {
  if (!locationId) {
    return process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  }

  const installation = await getSupabaseInstallationByLocation(locationId);
  if (!installation || !installation.access_token) {
    return process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
  }

  const expiresAt = installation.expires_at ? new Date(installation.expires_at) : null;
  const isExpired = expiresAt && expiresAt < new Date(Date.now() + 60000); // 1 minute buffer

  if (isExpired && installation.refresh_token) {
    try {
      const token = await refreshGhlToken(installation.refresh_token, oauthConfig);
      
      await upsertSupabaseInstallation({
        ghl_location_id: locationId,
        ghl_company_id: installation.ghl_company_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null
      });

      return token.access_token;
    } catch (error) {
      console.error(`Failed to refresh GHL token for ${locationId}: ${error.message}`);
      return installation.access_token; // Fallback to old token if refresh fails
    }
  }

  return installation.access_token;
}

async function refreshGhlToken(refreshToken, oauthConfig) {
  const body = new URLSearchParams({
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    user_type: oauthConfig.userType || 'Location'
  });

  const baseUrl = oauthConfig.baseUrl || 'https://services.leadconnectorhq.com';
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GHL token refresh failed: ${text}`);
  }

  return JSON.parse(text);
}
