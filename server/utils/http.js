export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function createErrorHandler() {
  return (error, _request, response, _next) => {
    const status = error.status || 500;
    const isVoiceAiScopeError =
      status === 401 &&
      /not authorized for this scope/i.test(error.message || '') &&
      /HighLevel API/i.test(error.message || '');

    response.status(status).json({
      message: isVoiceAiScopeError
        ? 'HighLevel rejected this edit because the token is missing the voice-ai-agents.write scope. Add that scope to the Private Integration or Marketplace app, regenerate/reinstall the token, and update the local .env token.'
        : error.message || 'Unexpected server error',
      detail: error.message || null,
      requiredScope: isVoiceAiScopeError ? 'voice-ai-agents.write' : undefined,
      status
    });
  };
}

export function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}
