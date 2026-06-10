import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export function createRequestContextMiddleware(defaults = {}) {
  return (request, _response, next) => {
    storage.run(extractRequestContext(request, defaults), next);
  };
}

export function runWithRequestContext(context, callback) {
  return storage.run(normalizeContext(context), callback);
}

export function getRequestContext() {
  return storage.getStore() ?? {};
}

export function extractRequestContext(request, defaults = {}) {
  const source = request?.body && typeof request.body === 'object' ? request.body : {};
  const query = request?.query ?? {};

  return normalizeContext({
    installationId:
      header(request, 'x-app-installation-id') ||
      query.installationId ||
      query.installation_id ||
      source.installationId ||
      source.installation_id ||
      defaults.installationId,
    locationId:
      header(request, 'x-ghl-location-id') ||
      query.locationId ||
      query.location_id ||
      source.locationId ||
      source.location_id ||
      source.location?.id ||
      source.data?.locationId ||
      source.data?.location_id ||
      defaults.locationId,
    companyId:
      header(request, 'x-ghl-company-id') ||
      query.companyId ||
      query.company_id ||
      source.companyId ||
      source.company_id ||
      source.company?.id ||
      source.data?.companyId ||
      source.data?.company_id ||
      defaults.companyId,
    userType:
      header(request, 'x-ghl-user-type') ||
      query.userType ||
      query.user_type ||
      source.userType ||
      source.user_type ||
      defaults.userType
  });
}

function normalizeContext(context = {}) {
  return {
    installationId: cleanString(context.installationId),
    locationId: cleanString(context.locationId),
    companyId: cleanString(context.companyId),
    userType: cleanString(context.userType) || 'Location'
  };
}

function header(request, name) {
  return request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
