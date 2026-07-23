import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';
const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const MAP_ID = 'solatrix-official-govmap';
const ADDRESS_ZOOM_LEVEL = 11;

let installed = false;
let surfaces = [];
let drawing = false;
let lastFocusedAddress = '';

function loadScript(src, globalCheck) {
  return new Promise((resolve, reject) => {
    if (globalCheck()) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function getAddress() {
  const inputValue = document.querySelector('[data-field="address"]')?.value?.trim();
  if (inputValue) return inputValue;
  try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; }
}

function defineProjections() {
  if (!window.proj4) throw new Error('proj4 is not available');
  window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
}

function wgs84ToItm(lng, lat) {
  defineProjections();
  const [x, y] = window.proj4('EPSG:4326', 'EPSG:2039', [Number(lng), Number(lat)]);
  return { x, y };
}

function itmToWgs84(x, y) {
  defineProjections();
  const [lng, lat] = window.proj4('EPSG:2039', 'EPSG:4326', [Number(x), Number(y)]);
  return { lat, lng };
}

function webMercatorToItm(x, y) {
  defineProjections();
  const [itmX, itmY] = window.proj4('EPSG:3857', 'EPSG:2039', [Number(x), Number(y)]);
  return { x: itmX, y: itmY };
}

function classifyCoordinatePair(first, second) {
  const x = Number(first);
  const y = Number(second);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  if (x >= 33 && x <= 37 && y >= 28 && y <= 34) return wgs84ToItm(x, y);
  if (y >= 33 && y <= 37 && x >= 28 && x <= 34) return wgs84ToItm(y, x);
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };
  if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) return webMercatorToItm(x, y);
  return null;
}

function parsePointText(value = '') {
  const text = String(value);
  const pointMatch = text.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (pointMatch) return classifyCoordinatePair(pointMatch[1], pointMatch[2]);
  const pairMatch = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  return pairMatch ? classifyCoordinatePair(pairMatch[1], pairMatch[2]) : null;
}

function pointFromCandidate(candidate, depth = 0, seen = new Set()) {
  if (candidate == null || depth > 6) return null;
  if (typeof candidate === 'string') return parsePointText(candidate);
  if (typeof candidate !== 'object' || seen.has(candidate)) return null;
  seen.add(candidate);

  if (Array.isArray(candidate)) {
    if (candidate.length >= 2) {
      const direct = classifyCoordinatePair(candidate[0], candidate[1]);
      if (direct) return direct;
    }
    for (const item of candidate) {
      const nested = pointFromCandidate(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }

  const directPairs = [
    [candidate.x, candidate.y],
    [candidate.X, candidate.Y],
    [candidate.lon ?? candidate.lng ?? candidate.longitude, candidate.lat ?? candidate.latitude],
    [candidate.easting, candidate.northing]
  ];
  for (const pair of directPairs) {
    const direct = classifyCoordinatePair(pair[0], pair[1]);
    if (direct) return direct;
  }

  const preferredKeys = ['shape', 'geometry', 'coordinates', 'coordinate', 'centroid', 'center', 'point', 'location', 'data', 'result'];
  for (const key of preferredKeys) {
    if (!(key in candidate)) continue;
    const nested = pointFromCandidate(candidate[key], depth + 1, seen);
    if (nested) return nested;
  }

  for (const value of Object.values(candidate)) {
    const nested = pointFromCandidate(value, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function collectSearchResults(payload) {
  if (Array.isArray(payload)) return payload;
  const direct = [payload?.results, payload?.data?.results, payload?.data, payload?.result, payload?.items];
  for (const value of direct) if (Array.isArray(value)) return value;
  return payload && typeof payload === 'object' ? [payload] : [];
}

function setHint(text, success = false) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('success', success);
}

async function searchAddressOnGovMap(searchText) {
  if (!GOVMAP_TOKEN) throw new Error('GovMap token is missing from the production build');
  const response = await fetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchText,
      language: 'he',
      filterType: 'address',
      maxResults: 10,
      isAccurate: true,
      apiKey: GOVMAP_TOKEN
    })
  });
  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  const payload = await response.json();
  const results = collectSearchResults(payload);
  for (const result of results) {
    const point = pointFromCandidate(result);
    if (point) return { point, result };
  }
  const fallbackPoint = pointFromCandidate(payload);
  return fallbackPoint ? { point: fallbackPoint, result: payload } : null;
}

async function focusEnteredAddress(force = false) {
  const searchText = getAddress();
  if (!searchText || (!force && searchText === lastFocusedAddress)) return false;
  setHint('מחפשים את הכתובת וממקדים את תצלום האוויר של GovMap…');

  const match = await searchAddressOnGovMap(searchText);
  if (!match) {
    setHint('לא הצלחנו למצוא את הכתובת ב-GovMap. חזרו לשלב הקודם ובדקו רחוב, מספר ועיר.');
    return false;
  }

  lastFocusedAddress = searchText;
  if (typeof window.govmap?.zoomToXY !== 'function') throw new Error('GovMap zoomToXY is unavailable');
  window.govmap.zoomToXY({
    x: match.point.x,
    y: match.point.y,
    level: ADDRESS_ZOOM_LEVEL,
    marker: true
  });
  setHint('הכתובת נמצאה ב-GovMap. סמנו את פינות הגג על גבי תצלום האוויר.', true);
  return true;
}

function parsePolygon(response) {
  const rings = response?.geometry?.rings || response?.rings || response?.data?.geometry?.rings;
  const ring = Array.isArray(rings?.[0]) ? rings[0] : [];
  const points = ring
    .map((pair) => Array.isArray(pair) ? itmToWgs84(pair[0], pair[1]) : null)
    .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.lat - last.lat) < 1e-10 && Math.abs(first.lng - last.lng) < 1e-10) points.pop();
  }
  return points;
}

function publish() {
  const geometry = buildRoofGeometry(surfaces, { address: getAddress(), provider: 'govmap-official' });
  window.__solatrixRoofSurfaces = surfaces;
  window.__solatrixRoofGeometry = geometry;
  window.__solatrixRoofCoordinates = geometry.centroid;
  window.__solatrixRoofMapProvider = 'govmap-official';
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify({ surfaces, geometry })); } catch {}
  window.dispatchEvent(new CustomEvent('solatrix:roof-geometry-changed', { detail: geometry }));
  const next = document.querySelector('.nextTextBtn[data-action="next"]');
  if (next) surfaces.length ? next.removeAttribute('disabled') : next.setAttribute('disabled', 'disabled');
  renderSummary();
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || 'null');
    if (saved?.geometry?.provider === 'govmap-official' && saved.geometry?.address === getAddress() && Array.isArray(saved.surfaces)) {
      surfaces = saved.surfaces;
    }
  } catch {}
}

function renderSummary() {
  const list = document.querySelector('.solatrixGovMapSurfaceList');
  if (list) list.innerHTML = surfaces.map((surface, index) => `<div>שטח ${index + 1}: ${Math.round(surface.area).toLocaleString('he-IL')} מ״ר</div>`).join('');
  if (surfaces.length) setHint('הגג סומן ונשמר. אפשר להמשיך לשלב הבא.', true);
}

function clearAll() {
  surfaces = [];
  try { window.govmap?.clearDrawings?.(); } catch {}
  publish();
  focusEnteredAddress(true).catch((error) => console.warn('GovMap refocus failed', error));
}

function startDraw() {
  if (drawing || typeof window.govmap?.draw !== 'function') {
    setHint('כלי הסימון של GovMap עדיין נטען. נסו שוב בעוד רגע.');
    return;
  }
  drawing = true;
  setHint('לחצו על פינות הגג. לחיצה כפולה מסיימת את הסימון.');
  const drawType = window.govmap.drawType?.Polygon ?? 3;
  const request = window.govmap.draw(drawType);
  const onResult = (response) => {
    const points = parsePolygon(response);
    if (points.length >= 3) {
      const area = Math.max(1, polygonAreaM2(points));
      surfaces = [{
        id: 1,
        name: 'Roof 1',
        area,
        orientation: 'South',
        factor: 1,
        source: 'govmap-manual',
        points: points.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join(' '),
        latlngs: points
      }];
      publish();
    } else {
      setHint('הסימון לא הושלם. סמנו לפחות שלוש פינות של הגג.');
    }
    drawing = false;
  };
  if (typeof request?.progress === 'function') request.progress(onResult);
  else if (typeof request?.then === 'function') request.then(onResult).catch((error) => { drawing = false; console.warn('GovMap drawing failed', error); });
  else drawing = false;
}

function injectStyles() {
  if (document.getElementById('solatrix-govmap-visual-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-govmap-visual-style';
  style.textContent = `
    .solatrixGovMapWrap{position:relative;width:100%;height:clamp(440px,62vh,720px);border-radius:30px;overflow:hidden;background:#d9e4ea}
    #${MAP_ID}{position:absolute;inset:0;z-index:1;width:100%;height:100%;direction:ltr}
    .solatrixGovMapToolbar{position:absolute;z-index:20;right:16px;top:16px;display:flex;gap:10px;direction:rtl}
    .solatrixGovMapToolbar button{border:0;border-radius:999px;padding:11px 17px;font-family:inherit;font-weight:900;cursor:pointer;background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.17)}
    .solatrixGovMapToolbar .primary{background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a}
    .solatrixGovMapToolbar .danger{color:#a52020}
    .solatrixGovMapHint{position:absolute;z-index:20;right:16px;bottom:16px;max-width:min(680px,calc(100% - 32px));border-radius:20px;padding:13px 16px;background:rgba(255,255,255,.95);font-weight:800;box-shadow:0 12px 28px rgba(0,0,0,.16)}
    .solatrixGovMapHint.success{background:rgba(232,251,242,.96);color:#16734a}
    .solatrixGovMapSurfaceList{position:absolute;z-index:20;left:16px;top:16px;display:grid;gap:8px}
    .solatrixGovMapSurfaceList div{border-radius:16px;background:rgba(255,255,255,.95);padding:10px 12px;font-weight:900;box-shadow:0 10px 22px rgba(0,0,0,.14)}
    @media(max-width:760px){.solatrixGovMapWrap{height:520px;border-radius:24px}.solatrixGovMapToolbar{right:10px;top:10px}.solatrixGovMapHint{right:10px;left:10px;bottom:10px}.solatrixGovMapSurfaceList{left:10px;top:auto;bottom:100px}}
  `;
  document.head.appendChild(style);
}

async function install() {
  if (installed || !location.pathname.includes('/roof-marking')) return;
  const panel = document.querySelector('.mapPanel.interactiveMap');
  if (!panel) return;

  installed = true;
  panel.dataset.govmapInstalled = 'true';
  panel.dataset.mapProvider = 'govmap-official';
  injectStyles();
  restore();

  if (!GOVMAP_TOKEN) {
    panel.innerHTML = '<div class="solatrixGovMapHint">GovMap API token is missing from the production build.</div>';
    throw new Error('VITE_GOVMAP_API_TOKEN is missing');
  }

  await Promise.all([
    loadScript(GOVMAP_SCRIPT, () => Boolean(window.govmap?.createMap)),
    loadScript(PROJ4_SCRIPT, () => Boolean(window.proj4))
  ]);

  panel.classList.add('solatrixMapInjected');
  panel.removeAttribute('data-action');
  panel.innerHTML = `<div class="solatrixGovMapWrap"><div id="${MAP_ID}"></div><div class="solatrixGovMapToolbar"><button class="primary" data-govmap-official="draw">סימון גג</button><button class="danger" data-govmap-official="clear">נקה הכל</button></div><div class="solatrixGovMapSurfaceList"></div><div class="solatrixGovMapHint">טוענים את תצלום האוויר הרשמי של GovMap…</div></div>`;
  panel.querySelector('[data-govmap-official="draw"]').addEventListener('click', startDraw);
  panel.querySelector('[data-govmap-official="clear"]').addEventListener('click', clearAll);

  window.govmap.createMap(MAP_ID, {
    token: GOVMAP_TOKEN,
    layers: [],
    showXY: false,
    identifyOnClick: false,
    isEmbeddedToggle: false,
    background: '1',
    layersMode: 1,
    zoomButtons: true
  });

  renderSummary();
  window.setTimeout(() => {
    try { window.govmap?.setBackground?.(1); } catch (error) { console.warn('GovMap background selection failed', error); }
    focusEnteredAddress(true).catch((error) => {
      console.error('GovMap address focus failed', error);
      setHint('תצלום האוויר של GovMap נטען, אך לא הצלחנו להתמקד בכתובת. בדקו את הכתובת ונסו שוב.');
    });
  }, 1400);
}

function tick() {
  if (!location.pathname.includes('/roof-marking')) {
    installed = false;
    return;
  }
  install().catch((error) => {
    installed = false;
    console.error('Official GovMap installation failed', error);
  });
}

setInterval(tick, 500);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
