import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';
const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_TOKEN = String(window.__SOLATRIX_CONFIG__?.govMapApiToken || import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const MAP_ID = 'solatrix-official-govmap';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_ZOOM_LEVEL = 12;

let installed = false;
let drawing = false;
let surfaces = [];
let mapReady = false;
let addressFocused = false;

function isRoofPage() {
  return (location.pathname || '').includes('/roof-marking');
}

function isMobile() {
  return window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
}

function loadScript(src, ready) {
  return new Promise((resolve, reject) => {
    if (ready()) return resolve();
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function defineProjections() {
  if (!window.proj4) throw new Error('proj4 unavailable');
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

function classifyPair(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x >= 33 && x <= 37 && y >= 28 && y <= 34) return wgs84ToItm(x, y);
  if (y >= 33 && y <= 37 && x >= 28 && x <= 34) return wgs84ToItm(y, x);
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };
  if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) return webMercatorToItm(x, y);
  return null;
}

function pointFromCandidate(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 7) return null;
  if (typeof value === 'string') {
    const point = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (point) return classifyPair(point[1], point[2]);
    const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    return pair ? classifyPair(pair[1], pair[2]) : null;
  }
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const direct = classifyPair(value[0], value[1]);
      if (direct) return direct;
    }
    for (const item of value) {
      const nested = pointFromCandidate(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }
  const pairs = [
    [value.x, value.y], [value.X, value.Y],
    [value.lon ?? value.lng ?? value.longitude, value.lat ?? value.latitude],
    [value.easting, value.northing]
  ];
  for (const pair of pairs) {
    const direct = classifyPair(pair[0], pair[1]);
    if (direct) return direct;
  }
  const preferred = ['shape', 'geometry', 'coordinates', 'coordinate', 'centroid', 'center', 'point', 'location', 'data', 'result'];
  for (const key of preferred) {
    if (!(key in value)) continue;
    const nested = pointFromCandidate(value[key], depth + 1, seen);
    if (nested) return nested;
  }
  for (const nestedValue of Object.values(value)) {
    const nested = pointFromCandidate(nestedValue, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function getAddress() {
  const input = document.querySelector('[data-field="address"]')?.value?.trim();
  if (input) return input;
  try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; }
}

function getSavedSelection() {
  try { return JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null'); } catch { return null; }
}

async function findAddressPoint() {
  const selection = getSavedSelection();
  const savedPoint = pointFromCandidate(selection?.result);
  if (savedPoint) return savedPoint;

  const address = getAddress();
  if (!address) return null;
  const response = await fetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchText: address, language: 'he', filterType: 'address', maxResults: 15, isAccurate: true, ...(GOVMAP_TOKEN ? { apiKey: GOVMAP_TOKEN } : {}) })
  });
  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  return pointFromCandidate(await response.json());
}

function setHint(text, success = false) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('success', success);
}

function zoomToPoint(point) {
  if (!point || typeof window.govmap?.zoomToXY !== 'function') return false;
  window.govmap.zoomToXY({ x: point.x, y: point.y, level: ADDRESS_ZOOM_LEVEL, marker: true });
  return true;
}

async function focusAddress() {
  if (addressFocused) return;
  setHint('מחפשים את הכתובת וממקדים את המפה…');
  const point = await findAddressPoint();
  if (!point) {
    setHint('לא נמצאה נקודת כתובת מדויקת. חזרו לשלב הקודם ובחרו כתובת מרשימת GovMap.');
    return;
  }
  const delays = [0, 350, 900, 1700];
  delays.forEach((delay, index) => window.setTimeout(() => {
    if (zoomToPoint(point)) {
      addressFocused = true;
      if (index === 0) setHint(isMobile() ? 'הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.' : 'הכתובת נמצאה. לחצו על פינות הגג כדי לסמן אותו.', true);
    }
  }, delay));
}

function parsePolygon(response) {
  const rings = response?.geometry?.rings || response?.rings || response?.data?.geometry?.rings;
  const ring = Array.isArray(rings?.[0]) ? rings[0] : [];
  const points = ring.map((pair) => Array.isArray(pair) ? itmToWgs84(pair[0], pair[1]) : null).filter(Boolean);
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
}

function completeDrawing(response) {
  const points = parsePolygon(response);
  if (points.length < 3) {
    setHint('הסימון לא הושלם. סמנו לפחות שלוש פינות.');
    drawing = false;
    return;
  }
  const area = Math.max(1, polygonAreaM2(points));
  surfaces = [{ id: 1, name: 'Roof 1', area, orientation: 'South', factor: 1, source: 'govmap-manual', latlngs: points, points: points.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`).join(' ') }];
  publish();
  drawing = false;
  setHint(`הגג סומן: ${Math.round(area).toLocaleString('he-IL')} מ״ר`, true);
}

function startNativeDraw() {
  if (drawing) return;
  if (typeof window.govmap?.draw !== 'function') {
    setHint('כלי הסימון עדיין נטען. נסו שוב בעוד רגע.');
    return;
  }
  drawing = true;
  setHint(isMobile() ? 'מקמו כל פינה תחת הכוונת ולחצו על “הוסף נקודה”.' : 'לחצו על פינות הגג. לחיצה כפולה מסיימת את הסימון.');
  const request = window.govmap.draw(window.govmap.drawType?.Polygon ?? 3);
  const onResult = (result) => completeDrawing(result);
  if (typeof request?.progress === 'function') request.progress(onResult);
  else if (typeof request?.then === 'function') request.then(onResult).catch((error) => { drawing = false; console.error('GovMap draw failed', error); });
}

function dispatchCenterClick(double = false) {
  const map = document.getElementById(MAP_ID);
  if (!map) return;
  const target = map.querySelector('canvas') || map;
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const fire = (type, detail) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, detail, view: window }));
  fire('mousedown', 1); fire('mouseup', 1); fire('click', 1);
  if (double) { window.setTimeout(() => { fire('mousedown', 2); fire('mouseup', 2); fire('click', 2); fire('dblclick', 2); }, 80); }
}

function clearAll() {
  surfaces = [];
  drawing = false;
  try { window.govmap?.clearDrawings?.(); } catch {}
  publish();
  setHint(isMobile() ? 'הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.' : 'לחצו על “התחל סימון” ואז על פינות הגג.');
}

function wireApprovedFooter() {
  const footer = document.querySelector('.drawFooter');
  if (!footer) return;
  const actions = footer.querySelector('.compactActions') || footer.querySelector('.actions');
  if (!actions) return;
  actions.replaceChildren();

  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'primaryBtn';
  primary.textContent = isMobile() ? '+ הוסף נקודה' : 'התחל סימון';
  primary.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!drawing) startNativeDraw();
    if (isMobile()) window.setTimeout(() => dispatchCenterClick(false), 80);
  });

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'ghostBtn';
  clear.textContent = 'נקה סימון';
  clear.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); clearAll(); });

  actions.append(primary, clear);
  const done = footer.querySelector('.nextTextBtn[data-action="next"]');
  if (done) {
    done.textContent = isMobile() ? 'סיים שטח' : 'סיימתי';
    if (isMobile()) done.addEventListener('click', (event) => {
      if (!surfaces.length && drawing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dispatchCenterClick(true);
      }
    }, true);
  }
}

function injectStyles() {
  if (document.getElementById('solatrix-govmap-only-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-govmap-only-style';
  style.textContent = `
    .solatrixGovMapWrap{position:relative;width:100%;height:clamp(440px,62vh,720px);border-radius:30px;overflow:hidden;background:#d9e4ea}
    #${MAP_ID}{position:absolute;inset:0;width:100%;height:100%;direction:ltr}
    .solatrixGovMapLoading{position:absolute;inset:0;z-index:30;display:grid;place-items:center;background:#d9e4ea;color:#24445f;font-weight:900;transition:opacity .2s}
    .solatrixGovMapWrap.ready .solatrixGovMapLoading{opacity:0;pointer-events:none}
    .solatrixGovMapToolbar{position:absolute;z-index:20;right:16px;top:16px;display:flex;gap:10px;direction:rtl}
    .solatrixGovMapToolbar button{border:0;border-radius:999px;padding:11px 17px;font-family:inherit;font-weight:900;background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.17)}
    .solatrixGovMapToolbar .primary{background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a}
    .solatrixGovMapToolbar .danger{color:#a52020}
    .solatrixGovMapHint{position:absolute;z-index:20;right:16px;bottom:16px;max-width:min(680px,calc(100% - 32px));border-radius:16px;padding:10px 14px;background:rgba(255,255,255,.93);font-weight:800;box-shadow:0 8px 20px rgba(0,0,0,.14)}
    .solatrixGovMapHint.success{color:#16734a}
    .solatrixGovMapCrosshair{display:none;position:absolute;z-index:25;left:50%;top:50%;width:76px;height:76px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}
    .solatrixGovMapCrosshair:before{content:"";position:absolute;left:25px;top:25px;width:22px;height:22px;border:3px solid #126eeb;border-radius:50%;box-shadow:0 0 0 2px #fff}
    .solatrixGovMapCrosshair:after{content:"";position:absolute;left:37px;top:3px;width:3px;height:70px;background:linear-gradient(to bottom,#126eeb 0 20px,transparent 20px 50px,#126eeb 50px 70px)}
    .solatrixGovMapCrosshair i{position:absolute;left:3px;top:37px;width:70px;height:3px;background:linear-gradient(to right,#126eeb 0 20px,transparent 20px 50px,#126eeb 50px 70px)}
    @media(max-width:960px){
      .solatrixGovMapWrap{height:520px;border-radius:24px}
      .solatrixGovMapCrosshair{display:block}
      .solatrixGovMapToolbar{right:10px;top:10px}
      .solatrixGovMapHint{right:10px;left:10px;bottom:10px}
    }
  `;
  document.head.appendChild(style);
}

function waitForMapPixels(wrap) {
  const started = Date.now();
  const check = () => {
    const map = document.getElementById(MAP_ID);
    const visual = map?.querySelector('canvas, img');
    if (visual && visual.getBoundingClientRect().width > 100) {
      mapReady = true;
      wrap.classList.add('ready');
      focusAddress().catch((error) => { console.error('GovMap address focus failed', error); setHint('המפה נטענה, אך הכתובת לא מוקדה. בחרו כתובת מרשימת GovMap ונסו שוב.'); });
      return;
    }
    if (Date.now() - started > 12000) {
      setHint('טעינת GovMap מתעכבת. בדקו את החיבור ורעננו את הדף.');
      return;
    }
    requestAnimationFrame(check);
  };
  check();
}

async function install() {
  if (installed || !isRoofPage()) return;
  const panel = document.querySelector('.mapPanel.interactiveMap');
  if (!panel) return;
  installed = true;
  injectStyles();

  if (!GOVMAP_TOKEN) throw new Error('VITE_GOVMAP_API_TOKEN is missing');
  await Promise.all([
    loadScript(GOVMAP_SCRIPT, () => Boolean(window.govmap?.createMap)),
    loadScript(PROJ4_SCRIPT, () => Boolean(window.proj4))
  ]);

  panel.classList.add('solatrixMapInjected');
  panel.removeAttribute('data-action');
  panel.dataset.mapProvider = 'govmap-official';
  panel.innerHTML = `<div class="solatrixGovMapWrap"><div id="${MAP_ID}"></div><div class="solatrixGovMapLoading">טוענים את GovMap…</div><div class="solatrixGovMapToolbar"><button class="primary" data-govmap-official="draw">סימון גג</button><button class="danger" data-govmap-official="clear">נקה הכל</button></div><div class="solatrixGovMapCrosshair" aria-hidden="true"><i></i></div><div class="solatrixGovMapHint">טוענים את הכתובת…</div></div>`;
  const wrap = panel.querySelector('.solatrixGovMapWrap');
  panel.querySelector('[data-govmap-official="draw"]').addEventListener('click', startNativeDraw);
  panel.querySelector('[data-govmap-official="clear"]').addEventListener('click', clearAll);
  wireApprovedFooter();

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.govmap.createMap(MAP_ID, { token: GOVMAP_TOKEN, layers: [], showXY: false, identifyOnClick: false, isEmbeddedToggle: false, background: '1', layersMode: 1, zoomButtons: true });
  try { window.govmap.setBackground?.(1); } catch {}
  waitForMapPixels(wrap);
}

function tick() {
  if (!isRoofPage()) {
    installed = false;
    drawing = false;
    mapReady = false;
    addressFocused = false;
    return;
  }
  install().catch((error) => {
    installed = false;
    console.error('GovMap-only editor failed', error);
    setHint('GovMap לא נטען. רעננו את הדף ונסו שוב.');
  });
}

window.addEventListener('resize', () => { if (isRoofPage()) wireApprovedFooter(); });
window.addEventListener('popstate', () => setTimeout(tick, 80));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
setInterval(tick, 500);
