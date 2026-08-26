const GOVMAP_SCRIPT = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const MAP_ID = 'solatrix-obstacles-govmap';
const STYLE_ID = 'solatrix-obstacles-govmap-style-v5';

let installing = false;
let installedPanel = null;
let currentExtent = null;
let savedShape = null;

function isObstaclesPage() {
  return (location.pathname || '').includes('/obstacles');
}

function loadScript(src, ready, timeoutMs = 10000) {
  if (ready()) return Promise.resolve();
  let script = document.querySelector(`script[src="${src}"]`);
  if (!script) {
    script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let timer = 0;
    const probe = () => {
      if (ready()) return resolve();
      if (Date.now() - startedAt >= timeoutMs) return reject(new Error(`Timed out waiting for ${src}`));
      timer = window.setTimeout(probe, 80);
    };
    script.addEventListener('error', () => {
      window.clearTimeout(timer);
      reject(new Error(`Failed to load ${src}`));
    }, { once: true });
    timer = window.setTimeout(probe, 0);
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
    #${MAP_ID}{position:absolute;inset:0;width:100%;height:100%;direction:ltr;z-index:1}
    .solatrixRoofOverlay{position:absolute;inset:0;z-index:65;pointer-events:none;width:100%;height:100%}
    .solatrixRoofOverlay polygon{fill:rgba(18,110,235,.18);stroke:#126eeb;stroke-width:4;vector-effect:non-scaling-stroke;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
    .solatrixRoofOverlay circle{fill:#126eeb;stroke:#fff;stroke-width:3;vector-effect:non-scaling-stroke}
    .solatrixObstaclesGovMapBadge{position:absolute;z-index:70;top:14px;left:14px;padding:9px 13px;border-radius:999px;background:rgba(255,255,255,.95);color:#126eeb;font-weight:900;box-shadow:0 8px 20px rgba(0,0,0,.16)}
    @media(max-width:820px){.solatrixObstaclesGovMapWrap{height:440px;border-radius:24px}.mapScreen .mapPanel[data-obstacles-govmap="true"]{margin-bottom:18px}}
  `;
  document.head.appendChild(style);
}

function defineProjection() {
  if (!window.proj4) return;
  window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
}

function toItm(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !window.proj4) return null;
  const [x, y] = window.proj4('EPSG:4326', 'EPSG:2039', [lng, lat]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function buildShape(latlngs, geometry) {
  const points = latlngs.map(toItm).filter(Boolean);
  let center = null;
  if (points.length >= 3) {
    center = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length }), { x: 0, y: 0 });
  } else {
    const centroid = geometry?.centroid;
    center = toItm(centroid);
    if (!center && Number.isFinite(centroid?.x) && Number.isFinite(centroid?.y)) center = { x: Number(centroid.x), y: Number(centroid.y) };
  }
  return { points, center };
}

function findExtent(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  const xmin = Number(value.xmin ?? value.xMin ?? value.XMin);
  const xmax = Number(value.xmax ?? value.xMax ?? value.XMax);
  const ymin = Number(value.ymin ?? value.yMin ?? value.YMin);
  const ymax = Number(value.ymax ?? value.yMax ?? value.YMax);
  if ([xmin, xmax, ymin, ymax].every(Number.isFinite) && xmax > xmin && ymax > ymin) return { xmin, xmax, ymin, ymax };
  for (const nested of Object.values(value)) {
    const result = findExtent(nested, depth + 1, seen);
    if (result) return result;
  }
  return null;
}

function fallbackExtent(shape) {
  if (!shape?.center) return null;
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const spanX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const spanY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
  const half = Math.max(55, spanX * 2.2, spanY * 2.2);
  return { xmin: shape.center.x - half, xmax: shape.center.x + half, ymin: shape.center.y - half, ymax: shape.center.y + half };
}

function drawOverlay() {
  const svg = document.querySelector('.solatrixRoofOverlay');
  const wrap = svg?.closest('.solatrixObstaclesGovMapWrap');
  if (!svg || !wrap || !savedShape?.points?.length) return;
  const extent = currentExtent || fallbackExtent(savedShape);
  if (!extent) return;
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const project = (p) => ({
    x: ((p.x - extent.xmin) / (extent.xmax - extent.xmin)) * width,
    y: height - ((p.y - extent.ymin) / (extent.ymax - extent.ymin)) * height
  });
  const screenPoints = savedShape.points.map(project);
  const polygon = svg.querySelector('polygon');
  if (polygon) polygon.setAttribute('points', screenPoints.map((p) => `${p.x},${p.y}`).join(' '));
  const circles = screenPoints.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="6"></circle>`).join('');
  svg.querySelector('.solatrixRoofVertices').innerHTML = circles;
}

function rememberExtent(...args) {
  for (const arg of args) {
    const extent = findExtent(arg);
    if (extent) {
      currentExtent = extent;
      drawOverlay();
      return;
    }
  }
  window.setTimeout(drawOverlay, 80);
}

async function install() {
  if (!isObstaclesPage() || installing) return;
  const panel = document.querySelector('.mapScreen .mapPanel');
  if (!panel || panel.dataset.obstaclesGovmap === 'true') return;
  installing = true;
  try {
    injectStyles();
    if (!GOVMAP_TOKEN) throw new Error('VITE_GOVMAP_API_TOKEN is missing');
    await Promise.all([
      loadScript(GOVMAP_SCRIPT, () => Boolean(window.govmap?.createMap)),
      loadScript(PROJ4_SCRIPT, () => Boolean(window.proj4))
    ]);
    defineProjection();
    const { latlngs, geometry } = readSavedGeometry();
    savedShape = buildShape(latlngs, geometry);
    currentExtent = null;

    panel.removeAttribute('data-action');
    panel.dataset.obstaclesGovmap = 'true';
    panel.dataset.mapProvider = 'govmap-official-fresh-overlay';
    panel.innerHTML = `<div class="solatrixObstaclesGovMapWrap"><div id="${MAP_ID}"></div><svg class="solatrixRoofOverlay" aria-hidden="true"><polygon></polygon><g class="solatrixRoofVertices"></g></svg><div class="solatrixObstaclesGovMapBadge">הגג שסומן</div></div>`;
    installedPanel = panel;

    window.govmap.createMap(MAP_ID, {
      token: GOVMAP_TOKEN,
      layers: [],
      showXY: false,
      identifyOnClick: false,
      isEmbeddedToggle: false,
      background: '1',
      layersMode: 1,
      zoomButtons: true,
      onPan: (...args) => rememberExtent(...args),
      onZoom: (...args) => rememberExtent(...args)
    });

    if (savedShape?.center) {
      window.setTimeout(() => {
        try { window.govmap?.setBackground?.(1); } catch {}
        try { window.govmap?.zoomToXY?.({ x: savedShape.center.x, y: savedShape.center.y, level: 11, marker: false }); } catch {}
        window.setTimeout(drawOverlay, 250);
        window.setTimeout(drawOverlay, 700);
        window.setTimeout(drawOverlay, 1400);
      }, 750);
    }
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
    savedShape = null;
    currentExtent = null;
    return;
  }
  if (installedPanel && !document.contains(installedPanel)) installedPanel = null;
  install();
}

setInterval(tick, 400);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
window.addEventListener('popstate', () => setTimeout(tick, 50));
window.addEventListener('resize', () => setTimeout(drawOverlay, 50));
