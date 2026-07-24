import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const FLAG = '__solatrixGovMapMobilePolygonReliableV3';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const ZOOM_LEVEL = 12;
const METERS_PER_PIXEL = 0.28;

let points = [];
let currentCenter = null;
let drag = null;
let lastActionAt = 0;
let pendingMapRefresh = 0;

function isMobileRoofPage() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function wrap() {
  return document.querySelector('.solatrixGovMapWrap');
}

function address() {
  try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; }
}

function validItm(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000;
}

function extractPoint(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 8) return null;
  if (typeof value === 'string') {
    const point = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (point) {
      const x = Number(point[1]);
      const y = Number(point[2]);
      return validItm(x, y) ? { x, y } : null;
    }
    return null;
  }
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
    const point = extractPoint(nested, depth + 1, seen);
    if (point) return point;
  }
  return null;
}

function savedCenter() {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    return extractPoint(saved?.result || saved);
  } catch {
    return null;
  }
}

function ensureUi() {
  const host = wrap();
  if (!host) return null;

  if (host.dataset.reliableLegacyCleaned !== 'true') {
    host.querySelectorAll('.solatrixStableMobilePolygon,.solatrixStablePointBadge').forEach((node) => node.remove());
    host.dataset.reliableLegacyCleaned = 'true';
  }

  let panSurface = host.querySelector('.solatrixMobilePanSurface');
  if (!panSurface) {
    panSurface = document.createElement('div');
    panSurface.className = 'solatrixMobilePanSurface';
    panSurface.setAttribute('aria-label', 'הזזת המפה');
    host.appendChild(panSurface);
  }

  let svg = host.querySelector('.solatrixReliableMobilePolygon');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('solatrixReliableMobilePolygon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('preserveAspectRatio', 'none');
    host.appendChild(svg);
  }

  let badge = host.querySelector('.solatrixReliablePointBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'solatrixReliablePointBadge';
    badge.hidden = true;
    host.appendChild(badge);
  }

  return { host, panSurface, svg, badge };
}

function screenPoint(point, rect) {
  if (!currentCenter) return { x: rect.width / 2, y: rect.height / 2 };
  return {
    x: rect.width / 2 + (point.x - currentCenter.x) / METERS_PER_PIXEL,
    y: rect.height / 2 - (point.y - currentCenter.y) / METERS_PER_PIXEL
  };
}

function render() {
  const ui = ensureUi();
  if (!ui) return;
  const rect = ui.host.getBoundingClientRect();
  ui.svg.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);

  const visible = points.map((point) => screenPoint(point, rect));
  const coords = visible.map((point) => `${point.x},${point.y}`).join(' ');
  const shape = visible.length >= 3
    ? `<polygon points="${coords}"/>`
    : visible.length === 2
      ? `<polyline points="${coords}"/>`
      : '';
  const markers = visible.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="8"/><text x="${point.x}" y="${point.y - 16}">${index + 1}</text>`).join('');
  ui.svg.innerHTML = `${shape}${markers}`;
  ui.badge.hidden = points.length === 0;
  ui.badge.textContent = `${points.length} נקודות`;

  const done = document.querySelector('.nextTextBtn[data-action="next"]');
  if (done) points.length >= 3 ? done.removeAttribute('disabled') : done.setAttribute('disabled', 'disabled');
}

function setHint(text, success = false) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('success', success);
}

function refreshGovMap() {
  if (!currentCenter || typeof window.govmap?.zoomToXY !== 'function') return;
  cancelAnimationFrame(pendingMapRefresh);
  pendingMapRefresh = requestAnimationFrame(() => {
    try {
      window.govmap.zoomToXY({
        x: currentCenter.x,
        y: currentCenter.y,
        level: ZOOM_LEVEL,
        marker: false
      });
    } catch (error) {
      console.warn('GovMap mobile pan failed', error);
    }
  });
}

function addPoint() {
  if (!currentCenter) currentCenter = savedCenter();
  if (!currentCenter) {
    setHint('המפה עדיין נטענת. המתינו רגע ונסו שוב.');
    return;
  }
  points.push({ x: currentCenter.x, y: currentCenter.y });
  render();
  const ui = ensureUi();
  ui?.host.classList.add('reliable-point-added');
  setTimeout(() => ui?.host.classList.remove('reliable-point-added'), 180);
  setHint(`נוספה נקודה ${points.length}. הזיזו את המפה לפינה הבאה.`, true);
  try { navigator.vibrate?.(20); } catch {}
}

function clearPoints() {
  points = [];
  render();
  setHint('הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.');
}

function itmToWgs84(point) {
  if (!window.proj4) return null;
  try {
    window.proj4.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
    const [lng, lat] = window.proj4('EPSG:2039', 'EPSG:4326', [point.x, point.y]);
    return { lat, lng };
  } catch {
    return null;
  }
}

function finishArea() {
  if (points.length < 3) {
    setHint('סמנו לפחות שלוש פינות.');
    return;
  }

  const latlngs = points.map(itmToWgs84).filter(Boolean);
  if (latlngs.length < 3) {
    setHint('לא ניתן לחשב את השטח כרגע. רעננו את הדף ונסו שוב.');
    return;
  }

  const area = Math.max(1, polygonAreaM2(latlngs));
  const surfaces = [{
    id: 1,
    name: 'Roof 1',
    area,
    orientation: 'South',
    factor: 1,
    source: 'govmap-mobile-crosshair',
    latlngs,
    points: latlngs.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join(' ')
  }];
  const geometry = buildRoofGeometry(surfaces, { address: address(), provider: 'govmap-official' });
  window.__solatrixRoofSurfaces = surfaces;
  window.__solatrixRoofGeometry = geometry;
  window.__solatrixRoofCoordinates = geometry.centroid;
  window.__solatrixRoofMapProvider = 'govmap-official';
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify({ surfaces, geometry })); } catch {}
  window.dispatchEvent(new CustomEvent('solatrix:roof-geometry-changed', { detail: geometry }));
  setHint(`הגג סומן: ${Math.round(area).toLocaleString('he-IL')} מ״ר`, true);
}

function findButton(textPart) {
  return [...document.querySelectorAll('button')].find((button) => String(button.textContent || '').includes(textPart));
}

function replaceAndBindButton(textPart, handler, key) {
  const original = findButton(textPart);
  if (!original || original.dataset[key] === 'true') return;
  const button = original.cloneNode(true);
  button.dataset[key] = 'true';
  original.replaceWith(button);

  const act = (event) => {
    const now = Date.now();
    if (now - lastActionAt < 250) return;
    lastActionAt = now;
    event.preventDefault();
    event.stopPropagation();
    handler();
  };
  button.addEventListener('pointerup', act, { capture: true });
  button.addEventListener('touchend', act, { capture: true, passive: false });
  button.addEventListener('click', act, { capture: true });
}

function bindButtons() {
  replaceAndBindButton('הוסף נקודה', addPoint, 'reliableAdd');
  replaceAndBindButton('נקה סימון', clearPoints, 'reliableClear');
  replaceAndBindButton('נקה הכל', clearPoints, 'reliableClear');
  replaceAndBindButton('סיים שטח', finishArea, 'reliableFinish');
}

function installPanSurface() {
  const ui = ensureUi();
  if (!ui || ui.panSurface.dataset.bound === 'true') return;
  ui.panSurface.dataset.bound = 'true';

  const begin = (clientX, clientY, id) => {
    if (!currentCenter) currentCenter = savedCenter();
    if (!currentCenter) return;
    drag = { id, x: clientX, y: clientY };
  };

  const move = (clientX, clientY, id) => {
    if (!drag || drag.id !== id || !currentCenter) return;
    const dx = clientX - drag.x;
    const dy = clientY - drag.y;
    drag.x = clientX;
    drag.y = clientY;
    currentCenter = {
      x: currentCenter.x - dx * METERS_PER_PIXEL,
      y: currentCenter.y + dy * METERS_PER_PIXEL
    };
    render();
    refreshGovMap();
  };

  ui.panSurface.addEventListener('pointerdown', (event) => {
    begin(event.clientX, event.clientY, event.pointerId);
    try { ui.panSurface.setPointerCapture(event.pointerId); } catch {}
  });
  ui.panSurface.addEventListener('pointermove', (event) => move(event.clientX, event.clientY, event.pointerId));
  ui.panSurface.addEventListener('pointerup', (event) => {
    if (drag?.id === event.pointerId) drag = null;
    refreshGovMap();
  });
  ui.panSurface.addEventListener('pointercancel', () => { drag = null; });
}

function injectStyles() {
  if (document.getElementById('solatrix-reliable-mobile-polygon-style-v3')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-reliable-mobile-polygon-style-v3';
  style.textContent = `
    .solatrixMobilePanSurface{position:absolute;z-index:18;left:0;right:0;top:72px;bottom:0;touch-action:none;background:transparent;cursor:grab}
    .solatrixMobilePanSurface:active{cursor:grabbing}
    .solatrixReliableMobilePolygon{position:absolute;inset:0;z-index:24;width:100%;height:100%;pointer-events:none;overflow:hidden}
    .solatrixReliableMobilePolygon polyline,.solatrixReliableMobilePolygon polygon{fill:rgba(18,110,235,.18);stroke:#126eeb;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;filter:drop-shadow(0 1px 2px #fff)}
    .solatrixReliableMobilePolygon circle{fill:#fff;stroke:#126eeb;stroke-width:5;vector-effect:non-scaling-stroke;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
    .solatrixReliableMobilePolygon text{font:900 15px Assistant,sans-serif;fill:#126eeb;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:4px}
    .solatrixReliablePointBadge{position:absolute;z-index:26;left:12px;top:12px;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.96);color:#126eeb;font-weight:900;box-shadow:0 8px 18px rgba(0,0,0,.18);pointer-events:none}
    .solatrixGovMapWrap.reliable-point-added .solatrixGovMapCrosshair{transform:translate(-50%,-50%) scale(1.14)}
    @media(max-width:960px){.solatrixGovMapCrosshair:before{background:radial-gradient(circle,#126eeb 0 4px,#fff 5px 9px,transparent 10px)!important}}
  `;
  document.head.appendChild(style);
}

function tick() {
  if (!isMobileRoofPage()) return;
  if (!currentCenter) currentCenter = savedCenter();
  injectStyles();
  ensureUi();
  bindButtons();
  installPanSurface();
  render();
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('pageshow', () => setTimeout(tick, 100));
  window.addEventListener('popstate', () => setTimeout(tick, 100));
  window.addEventListener('resize', render);
  setInterval(tick, 500);
}
