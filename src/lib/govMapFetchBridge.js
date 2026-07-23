import './govMapAutocompleteBridge.js';

const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const NOMINATIM_HOST = 'nominatim.openstreetmap.org';
const OVERPASS_HOSTS = new Set(['overpass-api.de', 'overpass.kumi.systems']);
const OVERPASS_TIMEOUT_MS = 3500;
const INSTALL_FLAG = '__solatrixGovMapFetchBridgeInstalled';
const OFFICIAL_MAP_BOOTSTRAP_FLAG = '__solatrixOfficialGovMapBootstrapRequested';

function getGovMapToken() {
  return String(window.__SOLATRIX_CONFIG__?.govMapApiToken || import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
}

function bootstrapOfficialGovMap() {
  if (typeof window === 'undefined' || window[OFFICIAL_MAP_BOOTSTRAP_FLAG]) return;
  window[OFFICIAL_MAP_BOOTSTRAP_FLAG] = true;
  import('../roofGovMapVisualPatch.js').catch((error) => {
    window[OFFICIAL_MAP_BOOTSTRAP_FLAG] = false;
    console.error('Official GovMap visual engine failed to load.', error);
  });
}

function mercatorToWgs84(x, y) {
  const lng = Number(x) * 180 / 20037508.34;
  const lat = Math.atan(Math.exp(Number(y) * Math.PI / 20037508.34)) * 360 / Math.PI - 90;
  return { lat, lng };
}

function parsePointWkt(value = '') {
  const match = String(value).match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { lat: y, lng: x };
  return mercatorToWgs84(x, y);
}

function pointFromResult(result) {
  const shapePoint = parsePointWkt(result?.shape || result?.geometry || result?.data?.shape);
  if (shapePoint) return shapePoint;
  const candidates = [result?.data?.coordinates, result?.data?.point, result?.data?.centroid, result?.coordinates, result?.centroid];
  for (const value of candidates) {
    if (!Array.isArray(value) || value.length < 2) continue;
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { lat: y, lng: x };
    return mercatorToWgs84(x, y);
  }
  const x = Number(result?.data?.x ?? result?.x);
  const y = Number(result?.data?.y ?? result?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { lat: y, lng: x };
    return mercatorToWgs84(x, y);
  }
  return null;
}

function collectResults(payload) {
  if (Array.isArray(payload)) return payload;
  const values = [payload?.results, payload?.data?.results, payload?.data, payload?.result, payload?.items];
  return values.find(Array.isArray) || [];
}

async function searchGovMapAddress(searchText, originalFetch, signal) {
  if (!searchText) return null;
  const response = await originalFetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchText }),
    signal
  });
  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  const results = collectResults(await response.json());
  for (const result of results) {
    const point = pointFromResult(result);
    if (!point) continue;
    return {
      display_name: result.text || result.originalText || result.caption || searchText,
      lat: String(point.lat),
      lon: String(point.lng),
      type: result.type || 'address',
      class: 'place',
      address: result.data || {},
      govmap: { id: result.id || '', layerId: result.layerId || '', objectId: result.objectId || '' }
    };
  }
  return null;
}

function emptyOverpassResponse(reason) {
  console.warn('Overpass outline lookup skipped; manual roof marking remains available.', reason);
  return new Response(JSON.stringify({ elements: [] }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function fetchOverpassWithoutBlocking(input, init, originalFetch) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener?.('abort', abortFromExternalSignal, { once: true });
  try {
    const response = await originalFetch(input, { ...init, signal: controller.signal });
    if (!response.ok) return emptyOverpassResponse(`HTTP ${response.status}`);
    return response;
  } catch (error) {
    return emptyOverpassResponse(error?.name === 'AbortError' ? 'timeout' : error);
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener?.('abort', abortFromExternalSignal);
  }
}

function installGovMapFetchBridge() {
  if (typeof window === 'undefined' || window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;
  bootstrapOfficialGovMap();
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function solatrixGovMapFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    let parsedUrl = null;
    try { parsedUrl = new URL(requestUrl, window.location.href); } catch {}
    if (parsedUrl && OVERPASS_HOSTS.has(parsedUrl.host) && parsedUrl.pathname.includes('/api/interpreter')) {
      return fetchOverpassWithoutBlocking(input, init, originalFetch);
    }
    if (parsedUrl?.host === NOMINATIM_HOST && parsedUrl.pathname.includes('/search')) {
      const searchText = parsedUrl.searchParams.get('q') || '';
      try {
        const result = await searchGovMapAddress(searchText, originalFetch, init?.signal);
        if (result) {
          window.__solatrixGovMapLastAddress = result;
          return new Response(JSON.stringify([result]), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }
      } catch (error) {
        console.warn('GovMap address lookup failed; falling back to Nominatim.', error);
      }
    }
    return originalFetch(input, init);
  };
}

installGovMapFetchBridge();

export { bootstrapOfficialGovMap, getGovMapToken, installGovMapFetchBridge, mercatorToWgs84, parsePointWkt, pointFromResult };
