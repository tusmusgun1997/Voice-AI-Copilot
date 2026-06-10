import { exchangeHighLevelCode } from '../oauthClient.js';
import {
  isSupabaseStoreEnabled,
  saveSupabaseOAuthToken,
  upsertSupabaseInstallation
} from '../services/supabaseStore.js';

export function createOAuthController({ oauthConfig }) {
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
      const locationId = token?.locationId || token?.location_id;
      const companyId = token?.companyId || token?.company_id;
      const userType = token?.userType || token?.user_type || request.query.userType || oauthConfig.userType;
      const installation = isSupabaseStoreEnabled() && locationId
        ? await upsertSupabaseInstallation({
            locationId,
            companyId,
            userType,
            displayName: token?.locationName || token?.location_name || token?.companyName || token?.company_name,
            isSandbox: String(process.env.SUPABASE_IS_SANDBOX || 'true') === 'true',
            connectionStatus: 'connected'
          })
        : null;

      if (installation) {
        await saveSupabaseOAuthToken({
          installationId: installation.id,
          token
        });
      }

      params.set('installed', 'true');
      params.set('oauth', 'connected');

      if (installation?.id) params.set('installationId', installation.id);
      if (locationId) params.set('locationId', locationId);
      if (companyId) params.set('companyId', companyId);
      if (userType) params.set('userType', userType);

      console.log(
        `HighLevel OAuth connected: userType=${userType || 'unknown'} locationId=${locationId || 'n/a'}`
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
    callback
  };
}
