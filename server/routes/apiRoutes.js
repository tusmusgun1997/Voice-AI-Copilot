import { Router } from 'express';
import { asyncHandler } from '../utils/http.js';

export function createApiRouter(controllers) {
  const router = Router();

  router.get('/health', controllers.health.getHealth);
  router.get('/call-logs', asyncHandler(controllers.calls.listCallLogs));
  router.get('/call-analyses', asyncHandler(controllers.calls.listAnalyses));
  router.get('/call-analyses/:callId', asyncHandler(controllers.calls.getAnalysis));
  router.post('/call-analyses/:callId/analyze', asyncHandler(controllers.calls.analyzeCall));
  router.get('/analysis-jobs', asyncHandler(controllers.calls.listAnalysisJobs));
  router.patch('/human-actions/:actionId', asyncHandler(controllers.calls.updateAction));
  router.delete('/human-actions/:actionId', asyncHandler(controllers.calls.deleteAction));

  router.get('/agent-observability-profiles', asyncHandler(controllers.observabilityProfiles.listProfiles));
  router.get('/agent-observability-profiles/:agentId', asyncHandler(controllers.observabilityProfiles.getProfile));
  router.put('/agent-observability-profiles/:agentId', asyncHandler(controllers.observabilityProfiles.saveProfile));

  router.get('/llm-parameter-versions', asyncHandler(controllers.parameterVersions.listVersions));
  router.post('/llm-parameter-versions', asyncHandler(controllers.parameterVersions.createVersion));
  router.put('/llm-parameter-versions/:versionId', asyncHandler(controllers.parameterVersions.updateVersion));

  router.get('/agents/:agentId', asyncHandler(controllers.agents.getAgent));
  router.patch('/agents/:agentId', asyncHandler(controllers.agents.updateAgent));

  router.get('/oauth/callback', asyncHandler(controllers.oauth.callback));
  router.get('/observability', asyncHandler(controllers.observability.getDashboard));
  router.post('/webhooks/highlevel', asyncHandler(controllers.webhooks.highLevelEvent));
  router.post('/webhooks/voice-ai-call-end', asyncHandler(controllers.webhooks.voiceAiCallEnd));
  router.post('/webhooks/voice-ai-agent-delete', asyncHandler(controllers.webhooks.voiceAiAgentDelete));

  return router;
}
