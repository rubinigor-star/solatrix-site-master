import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || 'e2fe219a-b6be-40d4-b41d-b950ab8c02cf').trim();
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const MAP_ID = 'solatrix-official-govmap';

let installed = false;
let surfaces = [];
let drawing = false;

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

function address() {
  return document.querySelector('[data-field="address"]')?.value?.trim() || localStorage.getItem(ADDRESS_KEY)?.trim() || '';
}

function itmToWgs84(x, y) {
  window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
  const [lng, lat] = window.proj4('EPSG:2039', 'EPSG:4326', [Number(x), Number(y)]);
  return { lat, lng };
}

function parsePolygon(response) {
  const ring = response?.geometry?.rings?.[0];
  if (!Array.isArray(ring)) return [];
  const points = ring.map(([x, y]) => itmToWgs84(x, y)).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.abs(first.lat - last.lat) < 1e-10 && Math.abs(first.lng - last.lng) < 1e-10) points.pop();
  }
  return points;
}

function publish() {
  const geometry = buildRoofGeometry(surfaces, { address: address(), provider: 'govmap-official' });
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

function renderSummary() {
  const list = document.querySelector('.solatrixGovMapSurfaceList');
  if (!list) return;
  list.innerHTML = surfaces.map((surface, index) => `<div>שטח ${index + 1}: ${Math.round(surface.area).toLocaleString('he-IL')} מ״ר</div>`).join('');
  const hint = document.querySelector('.solatrixGovMapHint');
  if (hint) {
    hint.textContent = surfaces.length ? 'הגג סומן ונשמר. אפשר להמשיך לשלב הבא.' : 'התקרבו לגג ולחצו “סימון גג” כדי לצייר את השטח.';
    hint.classList.toggle('success', surfaces.length > 0);
  }
}

function clearAll() {
  surfaces = [];
  try { window.govmap.clearDrawings(); } catch {}
  publish();
}

function startDraw() {
  if (drawing || !window.govmap?.draw) return;
  drawing = true;
  const hint = document.querySelector('.solatrixGovMapHint');
  if (hint) hint.textContent = 'לחצו על פינות הגג. לחיצה כפולה מסיימת את הסימון.';
  const request = window.govmap.draw(window.govmap.drawType.Polygon);
  request.progress((response) => {
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
        points: points.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`).join(' '),
        latlngs: points
      }];
      publish();
    }
    drawing = false;
  });
}

function injectStyles() {
  if (document.getElementById('solatrix-govmap-visual-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-govmap-visual-style';
  style.textContent = `
    .solatrixGovMapWrap{position:relative;width:100%;height:clamp(420px,58vh,680px);border-radius:30px;overflow:hidden;background:#d9e4ea}
    #${MAP_ID}{position:absolute;inset:0;z-index:1;width:100%;height:100%;direction:ltr}
    .solatrixGovMapToolbar{position:absolute;z-index:20;right:16px;top:16px;display:flex;gap:10px;direction:rtl}
    .solatrixGovMapToolbar button{border:0;border-radius:999px;padding:11px 17px;font-family:inherit;font-weight:900;cursor:pointer;background:#fff;box-shadow:0 10px 24px rgba(0,0,0,.17)}
    .solatrixGovMapToolbar .primary{background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a}
    .solatrixGovMapToolbar .danger{color:#a52020}
    .solatrixGovMapHint{position:absolute;z-index:20;right:16px;bottom:16px;max-width:min(620px,calc(100% - 32px));border-radius:20px;padding:13px 16px;background:rgba(255,255,255,.95);font-weight:800;box-shadow:0 12px 28px rgba(0,0,0,.16)}
    .solatrixGovMapHint.success{background:rgba(232,251,242,.96);color:#16734a}
    .solatrixGovMapSurfaceList{position:absolute;z-index:20;left:16px;top:16px;display:grid;gap:8px}
    .solatrixGovMapSurfaceList div{border-radius:16px;background:rgba(255,255,255,.95);padding:10px 12px;font-weight:900;box-shadow:0 10px 22px rgba(0,0,0,.14)}
    @media(max-width:760px){.solatrixGovMapWrap{height:500px;border-radius:24px}.solatrixGovMapToolbar{right:10px;top:10px}.solatrixGovMapHint{right:10px;left:10px;bottom:10px}.solatrixGovMapSurfaceList{left:10px;top:auto;bottom:92px}}
  `;
  document.head.appendChild(style);
}

async function install() {
  if (installed || !location.pathname.includes('/roof-marking')) return;
  const panel = document.querySelector('.mapPanel.interactiveMap');
  if (!panel) return;
  installed = true;
  injectStyles();
  await Promise.all([
    loadScript(GOVMAP_SCRIPT, () => Boolean(window.govmap?.createMap)),
    loadScript(PROJ4_SCRIPT, () => Boolean(window.proj4))
  ]);
  panel.dataset.govmapInstalled = 'true';
  panel.classList.add('solatrixMapInjected');
  panel.innerHTML = `<div class="solatrixGovMapWrap"><div id="${MAP_ID}"></div><div class="solatrixGovMapToolbar"><button class="primary" data-govmap-official="draw">סימון גג</button><button class="danger" data-govmap-official="clear">נקה הכל</button></div><div class="solatrixGovMapSurfaceList"></div><div class="solatrixGovMapHint">טוענים את תצלום האוויר של GovMap…</div></div>`;
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
  setTimeout(() => { try { window.govmap.setBackground(1); window.govmap.refreshMap(); } catch {} }, 1200);
}

function tick() {
  if (!location.pathname.includes('/roof-marking')) { installed = false; return; }
  install().catch((error) => {
    installed = false;
    console.error('Official GovMap installation failed', error);
  });
}

setInterval(tick, 500);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
