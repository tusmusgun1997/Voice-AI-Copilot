import { exchangeHighLevelCode } from '../oauthClient.js';

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
    callback
  };
}
