const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const NOMINATIM_HOST = 'nominatim.openstreetmap.org';
const INSTALL_FLAG = '__solatrixGovMapFetchBridgeInstalled';

function getGovMapToken() {
  return String(
    window.__SOLATRIX_CONFIG__?.govMapApiToken ||
    import.meta.env.VITE_GOVMAP_API_TOKEN ||
    ''
  ).trim();
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
  const shapePoint = parsePointWkt(result?.shape);
  if (shapePoint) return shapePoint;

  const candidates = [
    result?.data?.coordinates,
    result?.data?.point,
    result?.data?.centroid,
    result?.coordinates,
    result?.centroid
  ];

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

async function searchGovMapAddress(searchText, originalFetch, signal) {
  const token = getGovMapToken();
  if (!token || !searchText) return null;

  const response = await originalFetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      searchText,
      language: 'he',
      filterType: 'address',
      maxResults: 8,
      isAccurate: true,
      apiKey: token
    }),
    signal
  });

  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];

  for (const result of results) {
    const point = pointFromResult(result);
    if (!point) continue;
    return {
      display_name: result.text || result.originalText || searchText,
      lat: String(point.lat),
      lon: String(point.lng),
      type: result.type || 'address',
      class: 'place',
      address: result.data || {},
      govmap: {
        id: result.id || '',
        layerId: result.layerId || '',
        objectId: result.objectId || ''
      }
    };
  }

  return null;
}

function installGovMapFetchBridge() {
  if (typeof window === 'undefined' || window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function solatrixGovMapFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    let parsedUrl = null;
    try { parsedUrl = new URL(requestUrl, window.location.href); } catch {}

    if (parsedUrl?.host === NOMINATIM_HOST && parsedUrl.pathname.includes('/search')) {
      const searchText = parsedUrl.searchParams.get('q') || '';
      try {
        const result = await searchGovMapAddress(searchText, originalFetch, init?.signal);
        if (result) {
          window.__solatrixGovMapLastAddress = result;
          return new Response(JSON.stringify([result]), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        }
      } catch (error) {
        console.warn('GovMap address lookup failed; falling back to Nominatim.', error);
      }
    }

    return originalFetch(input, init);
  };
}

installGovMapFetchBridge();

export { getGovMapToken, installGovMapFetchBridge, mercatorToWgs84, parsePointWkt, pointFromResult };
