import { cleanupAgentData } from '../services/agentCleanupService.js';
import {
  insertSupabaseWebhookEvent,
  isSupabaseStoreEnabled,
  upsertSupabaseInstallation
} from '../services/supabaseStore.js';

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

    if (isAppInstallEvent(eventType)) {
      await appInstall(request, response);
      return;
    }

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

  async function appInstall(request, response) {
    const details = extractInstallDetails(request.body);

    if (!details.locationId) {
      response.status(202).json({
        accepted: true,
        ignored: true,
        event: request.body?.type ?? 'AppInstall',
        reason: 'Install payload did not include a locationId.',
        receivedAt: new Date().toISOString()
      });
      return;
    }

    const installation = isSupabaseStoreEnabled()
      ? await upsertSupabaseInstallation({
          locationId: details.locationId,
          companyId: details.companyId,
          userType: details.userType,
          displayName: details.displayName,
          isSandbox: details.isSandbox,
          connectionStatus: 'connected'
        })
      : null;

    const event = isSupabaseStoreEnabled()
      ? await insertSupabaseWebhookEvent({
          eventType: request.body?.type ?? request.body?.eventType ?? 'AppInstall',
          externalEventId: details.eventId,
          companyId: details.companyId,
          locationId: details.locationId,
          payload: request.body
        })
      : null;

    response.status(202).json({
      accepted: true,
      event: request.body?.type ?? 'AppInstall',
      installationId: installation?.id || null,
      webhookEventId: event?.id || null,
      locationId: details.locationId,
      processedExistingCalls: false,
      receivedAt: new Date().toISOString()
    });
  }

  return {
    appInstall,
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

function isAppInstallEvent(eventType) {
  return /app\s*install|appinstall|app_installed|app_install/i.test(eventType);
}

function extractInstallDetails(payload = {}) {
  const data = payload.data ?? payload;
  const location = data.location ?? payload.location ?? {};
  const company = data.company ?? payload.company ?? {};

  return {
    eventId: cleanString(payload.eventId ?? payload.id ?? data.eventId ?? data.id),
    locationId: cleanString(
      payload.locationId ??
        payload.location_id ??
        data.locationId ??
        data.location_id ??
        location.id
    ),
    companyId: cleanString(
      payload.companyId ??
        payload.company_id ??
        data.companyId ??
        data.company_id ??
        company.id
    ),
    userType: cleanString(payload.userType ?? payload.user_type ?? data.userType ?? data.user_type) || 'Location',
    displayName: cleanString(
      payload.locationName ??
        payload.location_name ??
        data.locationName ??
        data.location_name ??
        location.name ??
        payload.companyName ??
        payload.company_name ??
        data.companyName ??
        data.company_name ??
        company.name
    ),
    isSandbox: Boolean(payload.isSandbox ?? payload.is_sandbox ?? data.isSandbox ?? data.is_sandbox ?? false)
  };
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
