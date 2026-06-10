const STORAGE_KEY = 'voice-ai-copilot-installation-context';

export function captureInstallationContextFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = {
    installationId: clean(params.get('installationId') || params.get('installation_id')),
    locationId: clean(params.get('locationId') || params.get('location_id')),
    companyId: clean(params.get('companyId') || params.get('company_id')),
    userType: clean(params.get('userType') || params.get('user_type'))
  };
  const hasContext = Object.values(next).some(Boolean);

  if (hasContext) {
    const previous = getStoredInstallationContext();
    const merged = {
      ...previous,
      ...Object.fromEntries(Object.entries(next).filter(([, value]) => Boolean(value)))
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }

  return getStoredInstallationContext();
}

export function getStoredInstallationContext() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      installationId: clean(parsed.installationId),
      locationId: clean(parsed.locationId),
      companyId: clean(parsed.companyId),
      userType: clean(parsed.userType)
    };
  } catch {
    return {};
  }
}

export function apiFetch(input, options = {}) {
  const context = getStoredInstallationContext();
  const headers = new Headers(options.headers || {});

  if (context.installationId) headers.set('X-App-Installation-Id', context.installationId);
  if (context.locationId) headers.set('X-GHL-Location-Id', context.locationId);
  if (context.companyId) headers.set('X-GHL-Company-Id', context.companyId);
  if (context.userType) headers.set('X-GHL-User-Type', context.userType);

  return fetch(withContextQuery(input, context), {
    ...options,
    headers
  });
}

function withContextQuery(input, context) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) return input;

  const url = new URL(input, window.location.origin);
  const entries = {
    installationId: context.installationId,
    locationId: context.locationId,
    companyId: context.companyId,
    userType: context.userType
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}
