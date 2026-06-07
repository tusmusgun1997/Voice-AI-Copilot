import { cleanupAgentData } from '../services/agentCleanupService.js';

export function createWebhookController({ analysisQueue, localDataFile, locationId }) {
  async function voiceAiCallEnd(request, response) {
    try {
      const job = await analysisQueue.enqueueWebhookAnalysis(request.body, request.body?.type ?? 'VoiceAiCallEnd');

      response.status(202).json({
        accepted: true,
        event: request.body?.type ?? 'VoiceAiCallEnd',
        jobId: job.id,
        callId: job.callId,
        agentId: job.agentId,
        status: job.status,
        receivedAt: new Date().toISOString()
      });
    } catch (error) {
      if (error.status === 400) {
        response.status(400).json({
          message: error.message,
          status: 400
        });
        return;
      }

      throw error;
    }
  }

  async function voiceAiAgentDelete(request, response) {
    const agentId = extractAgentId(request.body);
    if (!agentId) {
      response.status(400).json({
        message: 'Webhook payload did not include an agentId.',
        status: 400
      });
      return;
    }

    const locationId = cleanString(request.body?.locationId || request.body?.data?.locationId);
    const result = await cleanupAgentData(agentId, { localDataFile, locationId });

    response.status(202).json({
      accepted: true,
      event: request.body?.type ?? 'VoiceAiAgentDelete',
      agentId,
      ...result,
      receivedAt: new Date().toISOString()
    });
  }

  async function highLevelEvent(request, response) {
    const eventType = String(request.body?.type || request.body?.event || request.body?.eventType || '');

    if (isAgentDeleteEvent(eventType)) {
      await voiceAiAgentDelete(request, response);
      return;
    }

    if (isVoiceAiCallEndEvent(eventType)) {
      await voiceAiCallEnd(request, response);
      return;
    }

    response.status(202).json({
      accepted: true,
      ignored: true,
      event: eventType || 'Unknown',
      receivedAt: new Date().toISOString()
    });
  }

  return {
    voiceAiCallEnd,
    voiceAiAgentDelete,
    highLevelEvent
  };
}

function extractAgentId(payload = {}) {
  const data = payload.data ?? payload.agent ?? payload;
  return cleanString(payload.agentId ?? payload.agent?.id ?? data.agentId ?? data.id ?? data._id);
}

function isAgentDeleteEvent(eventType) {
  return /voice\s*ai\s*agent\s*delete|voiceaiagentdelete|voice_ai_agent_delete|agentdeleted|agentdelete/i.test(eventType);
}

function isVoiceAiCallEndEvent(eventType) {
  return /voice\s*ai\s*call\s*end|voiceaicallend|voice_ai_call_end/i.test(eventType);
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
