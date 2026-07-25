const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const MAP_ID = 'solatrix-obstacles-govmap';
const STYLE_ID = 'solatrix-obstacles-govmap-style-v2';

let installing = false;
let installedPanel = null;

function isObstaclesPage() {
  return (location.pathname || '').includes('/obstacles');
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
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function readSavedGeometry() {
  try {
    const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || 'null');
    const surface = saved?.surfaces?.[0];
    const latlngs = Array.isArray(surface?.latlngs) ? surface.latlngs : [];
    return { surface, latlngs, geometry: saved?.geometry || null };
  } catch {
    return { surface: null, latlngs: [], geometry: null };
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .solatrixObstaclesGovMapWrap{position:relative;width:100%;height:clamp(360px,52dvh,520px);border-radius:28px;overflow:hidden;background:#d9e4ea}
    #${MAP_ID}{position:absolute;inset:0;width:100%;height:100%;direction:ltr}
    .solatrixObstaclesGovMapBadge{position:absolute;z-index:20;top:14px;left:14px;padding:9px 13px;border-radius:999px;background:rgba(255,255,255,.95);color:#126eeb;font-weight:900;box-shadow:0 8px 20px rgba(0,0,0,.16)}
    @media(max-width:820px){.solatrixObstaclesGovMapWrap{height:440px;border-radius:24px}.mapScreen .mapPanel[data-obstacles-govmap="true"]{margin-bottom:18px}}
  `;
  document.head.appendChild(style);
}

function defineProjection() {
  window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
}

function toItm(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !window.proj4) return null;
  const [x, y] = window.proj4('EPSG:4326', 'EPSG:2039', [lng, lat]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function savedRoofShape(latlngs, geometry) {
  const points = latlngs.map(toItm).filter(Boolean);
  if (points.length >= 3) {
    const ring = [...points, points[0]].map((point) => `${point.x} ${point.y}`).join(',');
    const center = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    return { wkt: `POLYGON((${ring}))`, center };
  }

  const centroid = geometry?.centroid;
  const converted = toItm(centroid);
  if (converted) return { wkt: null, center: converted };
  if (Number.isFinite(centroid?.x) && Number.isFinite(centroid?.y)) return { wkt: null, center: { x: Number(centroid.x), y: Number(centroid.y) } };
  return { wkt: null, center: null };
}

function showSavedRoof(shape) {
  if (!shape?.center) return;
  try {
    window.govmap?.zoomToXY?.({ x: shape.center.x, y: shape.center.y, level: 12, marker: false });
  } catch {}
  if (!shape.wkt) return;
  try {
    window.govmap?.displayGeometries?.({
      wkts: [shape.wkt],
      names: ['solatrix-marked-roof-obstacles'],
      geometryType: window.govmap.drawType?.Polygon ?? 3,
      defaultSymbol: { fillColor: [18,110,235,0.10], outlineColor: [18,110,235,1], outlineWidth: 2 },
      clearExisting: true
    });
  } catch {}
}

async function install() {
  if (!isObstaclesPage() || installing) return;
  const panel = document.querySelector('.mapScreen .mapPanel');
  if (!panel || panel.dataset.obstaclesGovmap === 'true') return;
  installing = true;
  try {
    if (!GOVMAP_TOKEN) throw new Error('VITE_GOVMAP_API_TOKEN is missing');
    await Promise.all([
      loadScript(GOVMAP_SCRIPT, () => Boolean(window.govmap?.createMap)),
      loadScript(PROJ4_SCRIPT, () => Boolean(window.proj4))
    ]);
    defineProjection();
    injectStyles();

    const { latlngs, geometry } = readSavedGeometry();
    const shape = savedRoofShape(latlngs, geometry);
    panel.removeAttribute('data-action');
    panel.dataset.obstaclesGovmap = 'true';
    panel.innerHTML = `<div class="solatrixObstaclesGovMapWrap"><div id="${MAP_ID}"></div><div class="solatrixObstaclesGovMapBadge">הגג שסומן</div></div>`;
    installedPanel = panel;

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

    [700, 1300, 2200].forEach((delay) => window.setTimeout(() => {
      try { window.govmap?.setBackground?.(1); } catch {}
      showSavedRoof(shape);
    }, delay));
  } catch (error) {
    console.error('Obstacles GovMap install failed', error);
    if (panel) panel.innerHTML = '<div style="padding:24px;font-weight:800">לא הצלחנו לטעון את מפת הגג. חזרו שלב אחד ונסו שוב.</div>';
  } finally {
    installing = false;
  }
}

function tick() {
  if (!isObstaclesPage()) {
    installedPanel = null;
    return;
  }
  if (installedPanel && !document.contains(installedPanel)) installedPanel = null;
  install();
}

setInterval(tick, 400);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
window.addEventListener('popstate', () => setTimeout(tick, 50));
