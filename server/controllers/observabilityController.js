import { extractLocationId } from '../utils/http.js';

export function createObservabilityController({ dashboardService }) {
  async function getDashboard(request, response) {
    const locationId = extractLocationId(request);
    const dashboard = await dashboardService.getDashboard(request.query, locationId);
    response.json(dashboard);
  }

  return {
    getDashboard
  };
}
