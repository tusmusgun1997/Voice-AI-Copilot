import { sanitizeAgentPatch } from '../services/highLevelService.js';
import { extractLocationId } from '../utils/http.js';

export function createAgentController({ highLevelService }) {
  async function getAgent(request, response) {
    const locationId = extractLocationId(request);
    const agent = await highLevelService.getAgent(request.params.agentId, locationId);
    response.json({ agent });
  }

  async function updateAgent(request, response) {
    const locationId = extractLocationId(request);
    const patch = sanitizeAgentPatch(request.body);

    if (Object.keys(patch).length === 0) {
      response.status(400).json({
        message: 'No editable agent fields were provided.',
        status: 400
      });
      return;
    }

    const agent = await highLevelService.updateAgent(request.params.agentId, patch, locationId);

    response.json({
      updated: true,
      agent
    });
  }

  return {
    getAgent,
    updateAgent
  };
}
