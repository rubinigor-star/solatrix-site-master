import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const FLAG = '__solatrixGovMapMobileManualPolygonV3';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';

let points = [];
let dragState = null;

function isMobileRoofPage() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function getWrap() {
  return document.querySelector('.solatrixGovMapWrap');
}

function getAddress() {
  try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; }
}

function ensureOverlay() {
  const wrap = getWrap();
  if (!wrap) return null;

  let svg = wrap.querySelector('.solatrixStableMobilePolygon');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('solatrixStableMobilePolygon');
    svg.setAttribute('aria-hidden', 'true');
    wrap.appendChild(svg);
  }

  let badge = wrap.querySelector('.solatrixStablePointBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'solatrixStablePointBadge';
    badge.hidden = true;
    wrap.appendChild(badge);
  }

  return { wrap, svg, badge };
}

function render() {
  const ui = ensureOverlay();
  if (!ui) return;
  const { wrap, svg, badge } = ui;
  const rect = wrap.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);

  const coords = points.map((point) => `${point.x},${point.y}`).join(' ');
  const shape = points.length >= 3
    ? `<polygon points="${coords}"/>`
    : points.length > 1
      ? `<polyline points="${coords}"/>`
      : '';
  const markers = points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="7"/><text x="${point.x}" y="${point.y - 14}">${index + 1}</text>`).join('');
  svg.innerHTML = `${shape}${markers}`;

  badge.hidden = points.length === 0;
  badge.textContent = `${points.length} נקודות`;

  const done = document.querySelector('.nextTextBtn[data-action="next"]');
  if (done) points.length >= 3 ? done.removeAttribute('disabled') : done.setAttribute('disabled', 'disabled');
}

function validItm(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000;
}

function extractCenter(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 7) return null;
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (validItm(x, y)) return { x, y };
  }

  const pairs = [
    [value.x, value.y],
    [value.X, value.Y],
    [value.centerX, value.centerY],
    [value.mapCenterX, value.mapCenterY]
  ];
  for (const [a, b] of pairs) {
    const x = Number(a);
    const y = Number(b);
    if (validItm(x, y)) return { x, y };
  }

  for (const nested of Object.values(value)) {
    const center = extractCenter(nested, depth + 1, seen);
    if (center) return center;
  }
  return null;
}

async function readCenterQuickly() {
  const candidates = ['getCenter', 'getXY', 'getMapStatus', 'getMapState'];
  for (const name of candidates) {
    const fn = window.govmap?.[name];
    if (typeof fn !== 'function') continue;
    try {
      const result = fn.call(window.govmap);
      const resolved = await Promise.race([
        Promise.resolve(result),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 250))
      ]);
      const center = extractCenter(resolved);
      if (center) return center;
    } catch {}
  }
  return null;
}

function itmToWgs84(x, y) {
  if (!window.proj4) return null;
  try {
    window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
    const [lng, lat] = window.proj4('EPSG:2039', 'EPSG:4326', [x, y]);
    return { lat, lng };
  } catch {
    return null;
  }
}

function setHint(text, success = false) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('success', success);
}

function addPoint() {
  const ui = ensureOverlay();
  if (!ui) return;
  const rect = ui.wrap.getBoundingClientRect();
  const point = {
    x: rect.width / 2,
    y: rect.height / 2,
    itm: null
  };

  points.push(point);
  render();
  ui.wrap.classList.add('stable-point-added');
  window.setTimeout(() => ui.wrap.classList.remove('stable-point-added'), 220);
  setHint(`נוספה נקודה ${points.length}. הזיזו את המפה לפינה הבאה.`, true);
  try { navigator.vibrate?.(25); } catch {}

  readCenterQuickly().then((center) => {
    if (center && points.includes(point)) point.itm = center;
  });
}

function clearPoints() {
  points = [];
  render();
  try { window.govmap?.clearDrawings?.(); } catch {}
  setHint('הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.');
}

function finishArea() {
  if (points.length < 3) {
    setHint('סמנו לפחות שלוש פינות.');
    return;
  }

  const latlngs = points.map((point) => point.itm ? itmToWgs84(point.itm.x, point.itm.y) : null).filter(Boolean);
  if (latlngs.length < 3) {
    setHint('הנקודות סומנו, אך נתוני המפה עדיין נטענים. המתינו רגע ולחצו שוב על סיום.');
    points.forEach((point) => {
      if (!point.itm) readCenterQuickly().then((center) => { if (center) point.itm = center; });
    });
    return;
  }

  const area = Math.max(1, polygonAreaM2(latlngs));
  const surfaces = [{
    id: 1,
    name: 'Roof 1',
    area,
    orientation: 'South',
    factor: 1,
    source: 'govmap-mobile-center',
    latlngs,
    points: latlngs.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join(' ')
  }];
  const geometry = buildRoofGeometry(surfaces, { address: getAddress(), provider: 'govmap-official' });
  window.__solatrixRoofSurfaces = surfaces;
  window.__solatrixRoofGeometry = geometry;
  window.__solatrixRoofCoordinates = geometry.centroid;
  window.__solatrixRoofMapProvider = 'govmap-official';
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify({ surfaces, geometry })); } catch {}
  window.dispatchEvent(new CustomEvent('solatrix:roof-geometry-changed', { detail: geometry }));
  setHint(`הגג סומן: ${Math.round(area).toLocaleString('he-IL')} מ״ר`, true);
}

function handleClick(event) {
  if (!isMobileRoofPage()) return;
  const button = event.target?.closest?.('button');
  if (!button) return;
  const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();

  if (text.includes('הוסף נקודה')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    addPoint();
  } else if (text.includes('נקה סימון') || text.includes('נקה הכל')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    clearPoints();
  } else if (text.includes('סיים שטח')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    finishArea();
  }
}

function installDragTracking() {
  const ui = ensureOverlay();
  if (!ui || ui.wrap.dataset.stablePolygonDrag === 'true') return;
  ui.wrap.dataset.stablePolygonDrag = 'true';

  ui.wrap.addEventListener('pointerdown', (event) => {
    if (!points.length) return;
    dragState = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, true);

  ui.wrap.addEventListener('pointermove', (event) => {
    if (!dragState || dragState.id !== event.pointerId) return;
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    dragState.x = event.clientX;
    dragState.y = event.clientY;
    points = points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy }));
    render();
  }, true);

  const end = (event) => {
    if (dragState?.id === event.pointerId) dragState = null;
  };
  ui.wrap.addEventListener('pointerup', end, true);
  ui.wrap.addEventListener('pointercancel', end, true);
}

function injectStyles() {
  if (document.getElementById('solatrix-stable-mobile-polygon-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-stable-mobile-polygon-style';
  style.textContent = `
    .solatrixStableMobilePolygon{position:absolute;inset:0;z-index:24;width:100%;height:100%;pointer-events:none;overflow:hidden}
    .solatrixStableMobilePolygon polyline,.solatrixStableMobilePolygon polygon{fill:rgba(18,110,235,.18);stroke:#126eeb;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 2px #fff)}
    .solatrixStableMobilePolygon circle{fill:#fff;stroke:#126eeb;stroke-width:5;vector-effect:non-scaling-stroke;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .solatrixStableMobilePolygon text{font:900 15px Assistant,sans-serif;fill:#126eeb;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:4px}
    .solatrixStablePointBadge{position:absolute;z-index:26;left:12px;top:12px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.95);color:#126eeb;font-weight:900;box-shadow:0 8px 18px rgba(0,0,0,.18);pointer-events:none}
    .solatrixGovMapWrap.stable-point-added .solatrixGovMapCrosshair{transform:translate(-50%,-50%) scale(1.14)}
  `;
  document.head.appendChild(style);
}

function tick() {
  if (!isMobileRoofPage()) return;
  injectStyles();
  ensureOverlay();
  installDragTracking();
  render();
}

if (!window[FLAG]) {
  window[FLAG] = true;
  document.addEventListener('click', handleClick, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('popstate', () => window.setTimeout(tick, 120));
  window.addEventListener('resize', render);
  window.setInterval(tick, 500);
}
