import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';

const FLAG = '__solatrixGovMapMobilePolygonReliableV2';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';

let points = [];
let drag = null;
let lastActionAt = 0;

function isMobileRoofPage() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function wrap() { return document.querySelector('.solatrixGovMapWrap'); }
function address() { try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; } }

function pointInsideWrap(clientX, clientY) {
  const host = wrap();
  if (!host) return false;
  const rect = host.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function ensureUi() {
  const host = wrap();
  if (!host) return null;
  if (host.dataset.reliableLegacyCleaned !== 'true') {
    host.querySelectorAll('.solatrixStableMobilePolygon,.solatrixStablePointBadge').forEach((node) => node.remove());
    host.dataset.reliableLegacyCleaned = 'true';
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
  return { host, svg, badge };
}

function render() {
  const ui = ensureUi();
  if (!ui) return;
  const rect = ui.host.getBoundingClientRect();
  ui.svg.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
  const coords = points.map((point) => `${point.x},${point.y}`).join(' ');
  const shape = points.length >= 3 ? `<polygon points="${coords}"/>` : points.length === 2 ? `<polyline points="${coords}"/>` : '';
  const markers = points.map((point, index) => `<circle cx="${point.x}" cy="${point.y}" r="8"/><text x="${point.x}" y="${point.y - 16}">${index + 1}</text>`).join('');
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

function addPoint() {
  const ui = ensureUi();
  if (!ui) return;
  const rect = ui.host.getBoundingClientRect();
  points.push({ x: rect.width / 2, y: rect.height / 2 });
  render();
  ui.host.classList.add('reliable-point-added');
  setTimeout(() => ui.host.classList.remove('reliable-point-added'), 180);
  setHint(`נוספה נקודה ${points.length}. הזיזו את המפה לפינה הבאה.`, true);
  try { navigator.vibrate?.(20); } catch {}
}

function clearPoints() {
  points = [];
  render();
  setHint('הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.');
}

function finishArea() {
  if (points.length < 3) { setHint('סמנו לפחות שלוש פינות.'); return; }
  const host = wrap();
  const rect = host?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return;
  const latlngs = points.map((point) => ({ lat: 32 + (0.5 - point.y / rect.height) * 0.001, lng: 34.8 + (point.x / rect.width - 0.5) * 0.001 }));
  const area = Math.max(1, polygonAreaM2(latlngs));
  const surfaces = [{ id: 1, name: 'Roof 1', area, orientation: 'South', factor: 1, source: 'govmap-mobile-visual', latlngs, points: latlngs.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join(' ') }];
  const geometry = buildRoofGeometry(surfaces, { address: address(), provider: 'govmap-official' });
  window.__solatrixRoofSurfaces = surfaces;
  window.__solatrixRoofGeometry = geometry;
  window.__solatrixRoofCoordinates = geometry.centroid;
  window.__solatrixRoofMapProvider = 'govmap-official';
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify({ surfaces, geometry })); } catch {}
  window.dispatchEvent(new CustomEvent('solatrix:roof-geometry-changed', { detail: geometry }));
  setHint('השטח סומן ונשמר.', true);
}

function findButton(textPart) { return [...document.querySelectorAll('button')].find((button) => String(button.textContent || '').includes(textPart)); }
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

function shiftExistingPoints(dx, dy) {
  if (!points.length || (!dx && !dy)) return;
  points = points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  render();
}
function startDrag(clientX, clientY, id, source, target) {
  if (!points.length || !pointInsideWrap(clientX, clientY)) return;
  if (target?.closest?.('button')) return;
  drag = { id, source, x: clientX, y: clientY };
}
function moveDrag(clientX, clientY, id, source) {
  if (!drag || drag.id !== id || drag.source !== source) return;
  const dx = clientX - drag.x;
  const dy = clientY - drag.y;
  drag.x = clientX;
  drag.y = clientY;
  shiftExistingPoints(dx, dy);
}
function stopDrag(id, source) { if (drag?.id === id && drag?.source === source) drag = null; }

function installGlobalPanTracking() {
  if (window.__solatrixReliableGlobalPanTrackingV2) return;
  window.__solatrixReliableGlobalPanTrackingV2 = true;
  document.addEventListener('pointerdown', (event) => {
    if (!isMobileRoofPage() || event.pointerType === 'touch') return;
    startDrag(event.clientX, event.clientY, event.pointerId, 'pointer', event.target);
  }, true);
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    moveDrag(event.clientX, event.clientY, event.pointerId, 'pointer');
  }, true);
  document.addEventListener('pointerup', (event) => stopDrag(event.pointerId, 'pointer'), true);
  document.addEventListener('pointercancel', (event) => stopDrag(event.pointerId, 'pointer'), true);
  document.addEventListener('touchstart', (event) => {
    if (!isMobileRoofPage() || event.touches.length !== 1) return;
    const touch = event.touches[0];
    startDrag(touch.clientX, touch.clientY, touch.identifier, 'touch', event.target);
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!drag || drag.source !== 'touch') return;
    const touch = [...event.touches].find((item) => item.identifier === drag.id);
    if (touch) moveDrag(touch.clientX, touch.clientY, touch.identifier, 'touch');
  }, { capture: true, passive: true });
  document.addEventListener('touchend', (event) => {
    if (!drag || drag.source !== 'touch') return;
    const ended = [...event.changedTouches].some((item) => item.identifier === drag.id);
    if (ended) drag = null;
  }, { capture: true, passive: true });
  document.addEventListener('touchcancel', () => { if (drag?.source === 'touch') drag = null; }, { capture: true, passive: true });
}

function injectStyles() {
  if (document.getElementById('solatrix-reliable-mobile-polygon-style-v2')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-reliable-mobile-polygon-style-v2';
  style.textContent = `
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
  injectStyles();
  ensureUi();
  bindButtons();
  installGlobalPanTracking();
  render();
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
  window.addEventListener('pageshow', () => setTimeout(tick, 100));
  window.addEventListener('popstate', () => setTimeout(tick, 100));
  window.addEventListener('resize', render);
  setInterval(tick, 500);
}
