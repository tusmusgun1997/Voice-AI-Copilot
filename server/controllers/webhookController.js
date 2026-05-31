export function createWebhookController({ analysisQueue }) {
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

  return {
    voiceAiCallEnd
  };
}
