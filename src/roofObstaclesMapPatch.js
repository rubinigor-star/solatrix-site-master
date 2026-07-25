const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const MAP_ID = 'solatrix-obstacles-govmap';
const STYLE_ID = 'solatrix-obstacles-govmap-style';

let installing = false;
let installedPanel = null;

function isObstaclesPage() {
  return (location.pathname || '').includes('/obstacles');
}

function loadGovMap() {
  return new Promise((resolve, reject) => {
    if (window.govmap?.createMap) return resolve();
    const existing = document.querySelector(`script[src="${GOVMAP_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GOVMAP_SCRIPT;
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
    const geometry = saved?.geometry || null;
    return { surface, latlngs, geometry };
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

function polygonWktFromLatLngs(latlngs) {
  const itmPoints = [];
  const proj4 = window.proj4;
  if (!proj4) return null;
  try {
    proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
    for (const point of latlngs) {
      const [x, y] = proj4('EPSG:4326', 'EPSG:2039', [Number(point.lng), Number(point.lat)]);
      if (Number.isFinite(x) && Number.isFinite(y)) itmPoints.push({ x, y });
    }
  } catch {
    return null;
  }
  if (itmPoints.length < 3) return null;
  const ring = [...itmPoints, itmPoints[0]].map((point) => `${point.x} ${point.y}`).join(',');
  return { wkt: `POLYGON((${ring}))`, center: itmPoints.reduce((acc, point) => ({ x: acc.x + point.x / itmPoints.length, y: acc.y + point.y / itmPoints.length }), { x: 0, y: 0 }) };
}

async function install() {
  if (!isObstaclesPage() || installing) return;
  const panel = document.querySelector('.mapScreen .mapPanel');
  if (!panel || panel.dataset.obstaclesGovmap === 'true') return;
  installing = true;
  try {
    if (!GOVMAP_TOKEN) throw new Error('VITE_GOVMAP_API_TOKEN is missing');
    await loadGovMap();
    injectStyles();

    const { latlngs, geometry } = readSavedGeometry();
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

    window.setTimeout(() => {
      try { window.govmap?.setBackground?.(1); } catch {}
      const polygon = polygonWktFromLatLngs(latlngs);
      const fallback = geometry?.centroid;
      const center = polygon?.center || (fallback && Number.isFinite(fallback.x) && Number.isFinite(fallback.y) ? fallback : null);
      if (center) {
        try { window.govmap?.zoomToXY?.({ x: center.x, y: center.y, level: 12, marker: false }); } catch {}
      }
      if (polygon?.wkt) {
        window.setTimeout(() => {
          try {
            window.govmap?.displayGeometries?.({
              wkts: [polygon.wkt],
              names: ['solatrix-marked-roof-obstacles'],
              geometryType: window.govmap.drawType?.Polygon ?? 3,
              defaultSymbol: { fillColor: [18,110,235,0.10], outlineColor: [18,110,235,1], outlineWidth: 2 },
              clearExisting: true
            });
          } catch {}
        }, 500);
      }
    }, 1200);
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
