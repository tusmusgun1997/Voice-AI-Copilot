import { deleteHumanAction, getCallAnalysis, listCallAnalyses, updateHumanAction } from '../analysisStore.js';
import {
  deleteSupabaseHumanAction,
  isSupabaseStoreEnabled,
  updateSupabaseHumanAction
} from '../services/supabaseStore.js';
import { cleanString, extractLocationId } from '../utils/http.js';

export function createCallController({ analysisQueue, highLevelService, localDataFile, defaultLocationId }) {
  async function listCallLogs(request, response) {
    const locationId = extractLocationId(request);
    const result = await highLevelService.loadCallLogs(request.query, locationId);
    response.json(result);
  }

  async function listAnalyses(request, response) {
    const locationId = extractLocationId(request);
    const analyses = await listCallAnalyses(localDataFile, locationId);
    response.json({
      analyses,
      total: analyses.length
    });
  }

  async function getAnalysis(request, response) {
    const locationId = extractLocationId(request);
    const analysis = await getCallAnalysis(request.params.callId, localDataFile, locationId);

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
    const locationId = extractLocationId(request) || defaultLocationId;

    if (!highLevelService.hasConfig(locationId)) {
      response.status(400).json({
        message: 'HighLevel token and location ID are required before analyzing a call.',
        status: 400
      });
      return;
    }

    const callId = cleanString(request.params.callId);
    const agentId = cleanString(request.body?.agentId || request.query.agentId);

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

  async function listAnalysisJobs(request, response) {
    const locationId = extractLocationId(request);
    response.json({
      jobs: await analysisQueue.listJobs(locationId)
    });
  }

  async function updateAction(request, response) {
    const actionId = cleanString(request.params.actionId);
    const status = cleanString(request.body?.status);
    const allowedStatuses = new Set(['open', 'in_review', 'done', 'dismissed']);

    if (!actionId || !allowedStatuses.has(status)) {
      response.status(400).json({
        message: 'A valid actionId and status are required.',
        status: 400
      });
      return;
    }

    const action = isSupabaseStoreEnabled()
      ? await updateSupabaseHumanAction(actionId, { status })
      : await updateHumanAction(actionId, { status }, localDataFile);

    if (!action) {
      response.status(404).json({
        message: 'Human action was not found.',
        status: 404
      });
      return;
    }

    response.json({
      updated: true,
      action
    });
  }

  async function deleteAction(request, response) {
    const actionId = cleanString(request.params.actionId);

    if (!actionId) {
      response.status(400).json({
        message: 'Missing actionId.',
        status: 400
      });
      return;
    }

    const deleted = isSupabaseStoreEnabled()
      ? await deleteSupabaseHumanAction(actionId)
      : await deleteHumanAction(actionId, localDataFile);

    if (!deleted) {
      response.status(404).json({
        message: 'Human action was not found.',
        status: 404
      });
      return;
    }

    response.json({
      deleted: true,
      actionId
    });
  }

  return {
    listCallLogs,
    listAnalyses,
    getAnalysis,
    analyzeCall,
    listAnalysisJobs,
    updateAction,
    deleteAction
  };
}
