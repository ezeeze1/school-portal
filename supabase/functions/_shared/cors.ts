export function buildCorsHeaders(requestOrigin: string | null, allowedOriginsRaw?: string): Record<string, string> {
  const allowedList = (allowedOriginsRaw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  let allowOrigin = '*';
  if (allowedList.length > 0) {
    if (requestOrigin && allowedList.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = allowedList[0];
    }
  } else if (requestOrigin) {
    allowOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
