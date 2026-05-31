export function createHealthController() {
  function getHealth(_request, response) {
    response.json({
      ok: true,
      service: 'voice-ai-observability-copilot',
      generatedAt: new Date().toISOString()
    });
  }

  return {
    getHealth
  };
}
