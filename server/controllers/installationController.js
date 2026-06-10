import { getSupabaseInstallationStatus } from '../services/supabaseStore.js';
import { getRequestContext } from '../services/requestContext.js';

export function createInstallationController() {
  async function getStatus(_request, response) {
    const context = getRequestContext();
    const status = await getSupabaseInstallationStatus(context);

    response.json({
      ...status,
      requestContext: {
        installationId: context.installationId || '',
        locationId: context.locationId || '',
        companyId: context.companyId || '',
        userType: context.userType || 'Location'
      }
    });
  }

  return {
    getStatus
  };
}
