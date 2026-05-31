import { getCallAnalysis, listCallAnalyses } from '../analysisStore.js';
import { cleanString } from '../utils/http.js';

export function createCallController({ analysisQueue, highLevelService, localDataFile, defaultLocationId }) {
  async function listCallLogs(request, response) {
    const result = await highLevelService.loadCallLogs(request.query);
    response.json(result);
  }

  async function listAnalyses(_request, response) {
    const analyses = await listCallAnalyses(localDataFile);
    response.json({
      analyses,
      total: analyses.length
    });
  }

  async function getAnalysis(request, response) {
    const analysis = await getCallAnalysis(request.params.callId, localDataFile);

    if (!analysis) {
      response.status(404).json({
        message: 'Call analysis was not found.',
        status: 404
      });
      return;
    }

    response.json({ analysis });
  }

  async function analyzeCall(request, response) {
    if (!highLevelService.hasConfig()) {
      response.status(400).json({
        message: 'HighLevel token and location ID are required before analyzing a call.',
        status: 400
      });
      return;
    }

    const callId = cleanString(request.params.callId);
    const agentId = cleanString(request.body?.agentId || request.query.agentId);
    const locationId = cleanString(request.body?.locationId || request.query.locationId || defaultLocationId);

    if (!callId) {
      response.status(400).json({
        message: 'Missing callId.',
        status: 400
      });
      return;
    }

    const job = await analysisQueue.enqueueWebhookAnalysis(
      {
        locationId,
        agentId,
        callId,
        type: 'ManualCallAnalysis'
      },
      'manual-call-analysis'
    );

    response.status(202).json({
      accepted: true,
      jobId: job.id,
      callId: job.callId,
      agentId: job.agentId,
      status: job.status,
      receivedAt: new Date().toISOString()
    });
  }

  async function listAnalysisJobs(_request, response) {
    response.json({
      jobs: await analysisQueue.listJobs()
    });
  }

  return {
    listCallLogs,
    listAnalyses,
    getAnalysis,
    analyzeCall,
    listAnalysisJobs
  };
}
