import jwt from 'jsonwebtoken';
import { exchangeHighLevelCode, getHighLevelAuthUrl } from '../oauthClient.js';
import { upsertSupabaseInstallation } from '../services/supabaseStore.js';

export function createOAuthController({ oauthConfig, authConfig }) {
  async function getAuthUrl(_request, response) {
    const url = getHighLevelAuthUrl({
      clientId: oauthConfig.clientId,
      redirectUri: oauthConfig.redirectUri,
      scopes: [
        'voice-ai-agents.readonly',
        'voice-ai-agents.write',
        'locations/customValues.readonly',
        'locations/customValues.write',
        'contacts.readonly'
      ],
      userType: oauthConfig.userType
    });

    response.json({ url });
  }

  async function callback(request, response) {
    const params = new URLSearchParams();

    try {
      const token = await exchangeHighLevelCode({
        code: request.query.code,
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        redirectUri: oauthConfig.redirectUri,
        userType: request.query.userType || oauthConfig.userType,
        baseUrl: oauthConfig.baseUrl
      });

      if (token?.locationId) {
        await upsertSupabaseInstallation({
          ghl_location_id: token.locationId,
          ghl_company_id: token.companyId,
          ghl_user_type: token.userType,
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
          is_sandbox: Boolean(request.query.sandbox === 'true' || token.isSandbox)
        });

        const sessionToken = jwt.sign(
          {
            locationId: token.locationId,
            companyId: token.companyId,
            userType: token.userType
          },
          authConfig.jwtSecret,
          { expiresIn: '7d' }
        );

        params.set('token', sessionToken);
      }

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
  }

  return {
    getAuthUrl,
    callback
  };
}
