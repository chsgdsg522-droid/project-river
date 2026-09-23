const NAME_PATTERN = /[^a-zA-Z0-9 .:_-]/g;

function normalizeName(value) {
  const normalized = String(value ?? 'unknown').replace(NAME_PATTERN, '').slice(0, 64);
  return normalized || 'unknown';
}

function normalizeRoute(pathname) {
  const route = String(pathname ?? '/').split(/[?#]/, 1)[0].slice(0, 128);
  return route.replace(/^\/(room|game|results)\/[^/]+/, '/$1/:code');
}

function browserFamily(userAgent) {
  const value = String(userAgent ?? '');
  if (/Edg\//.test(value)) return 'Edge';
  if (/Firefox\//.test(value)) return 'Firefox';
  if (/Chrome\//.test(value)) return 'Chrome';
  if (/Safari\//.test(value)) return 'Safari';
  return 'Other';
}

export async function sendTelemetry(event, {
  fetchImpl = globalThis.fetch,
  pathname = globalThis.location?.pathname ?? '/',
  userAgent = globalThis.navigator?.userAgent ?? '',
  random = Math.random,
  performanceSampleRate = 0.1,
} = {}) {
  if (!event || !['error', 'performance'].includes(event.kind) || typeof fetchImpl !== 'function') return false;
  if (event.kind === 'performance' && random() >= performanceSampleRate) return false;
  const durationMs = Number.isFinite(event.durationMs)
    ? Math.max(0, Math.min(600_000, event.durationMs))
    : undefined;
  const body = {
    kind: event.kind,
    name: normalizeName(event.name),
    ...(durationMs === undefined ? {} : { durationMs }),
    route: normalizeRoute(pathname),
    browserFamily: browserFamily(userAgent),
  };
  try {
    await fetchImpl('/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return true;
  } catch {
    return false;
  }
}
