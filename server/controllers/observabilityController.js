export function createObservabilityController({ dashboardService }) {
  async function getDashboard(request, response) {
    const dashboard = await dashboardService.getDashboard(request.query);
    response.json(dashboard);
  }

  return {
    getDashboard
  };
}
