import { sanitizeAgentPatch } from '../services/highLevelService.js';

export function createAgentController({ highLevelService }) {
  async function getAgent(request, response) {
    const agent = await highLevelService.getAgent(request.params.agentId);
    response.json({ agent });
  }

  async function updateAgent(request, response) {
    const patch = sanitizeAgentPatch(request.body);

    if (Object.keys(patch).length === 0) {
      response.status(400).json({
        message: 'No editable agent fields were provided.',
        status: 400
      });
      return;
    }

    const agent = await highLevelService.updateAgent(request.params.agentId, patch);

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
