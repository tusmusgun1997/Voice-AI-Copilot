import jwt from 'jsonwebtoken';

export function createAuthMiddleware(jwtSecret) {
  return (request, response, next) => {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return response.status(401).json({ message: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      request.user = decoded;
      // Also set locationId on request if present in token
      if (decoded.locationId) {
        request.locationId = decoded.locationId;
      }
      next();
    } catch (error) {
      return response.status(403).json({ message: 'Invalid or expired session' });
    }
  };
}

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

export function extractLocationId(request) {
  const fromHeader = request.headers['x-location-id'] || request.headers['x-ghl-location-id'];
  if (fromHeader) return cleanString(fromHeader);

  const fromQuery = request.query.locationId || request.query.location_id;
  if (fromQuery) return cleanString(fromQuery);

  const fromBody = request.body?.locationId || request.body?.location_id;
  if (fromBody) return cleanString(fromBody);

  return '';
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
