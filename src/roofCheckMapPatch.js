import './roofGovMapVisualPatch.js';
import './roofMarkingHelp.js';
import './roofGovMapMobileUi.js';

const STYLE_ID = 'solatrix-govmap-only-guard';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';

function installGuard() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body:has(.mapPanel.interactiveMap:not([data-govmap-installed="true"])) .mapPanel.interactiveMap > * {
      visibility: hidden !important;
    }
    .mapPanel.interactiveMap:not([data-govmap-installed="true"]) {
      min-height: 520px;
      background: #d9e4ea !important;
    }
  `;
  document.head.appendChild(style);
}

function validItm(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000;
}

function findPoint(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 7) return null;
  if (typeof value === 'string') {
    const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (match) {
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (validItm(x, y)) return { x, y };
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
  const pairs = [[value.x, value.y], [value.X, value.Y], [value.easting, value.northing]];
  for (const pair of pairs) {
    const x = Number(pair[0]);
    const y = Number(pair[1]);
    if (validItm(x, y)) return { x, y };
  }
  for (const nested of Object.values(value)) {
    const point = findPoint(nested, depth + 1, seen);
    if (point) return point;
  }
  return null;
}

function savedAddressPoint() {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    return findPoint(saved?.result || saved);
  } catch {
    return null;
  }
}

function enforceAddressFocus() {
  if (!location.pathname.includes('/roof-marking')) return;
  const point = savedAddressPoint();
  if (!point || typeof window.govmap?.zoomToXY !== 'function') return;
  try {
    window.govmap.zoomToXY({ x: point.x, y: point.y, level: 12, marker: true });
  } catch (error) {
    console.warn('GovMap max-zoom focus failed', error);
  }
}

function restorePublishedGeometry() {
  if (Array.isArray(window.__solatrixRoofSurfaces) && window.__solatrixRoofSurfaces.length) return;
  try {
    const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || 'null');
    if (!Array.isArray(saved?.surfaces) || !saved.surfaces.length) return;
    window.__solatrixRoofSurfaces = saved.surfaces;
    window.__solatrixRoofGeometry = saved.geometry || null;
    window.__solatrixRoofCoordinates = saved.geometry?.centroid || null;
    window.__solatrixRoofMapProvider = 'govmap-official';
  } catch {}
}

installGuard();
restorePublishedGeometry();
window.addEventListener('pageshow', restorePublishedGeometry);
window.addEventListener('popstate', restorePublishedGeometry);

let attempts = 0;
const focusTimer = window.setInterval(() => {
  if (!location.pathname.includes('/roof-marking')) {
    attempts = 0;
    return;
  }
  attempts += 1;
  enforceAddressFocus();
  if (attempts >= 12) {
    window.clearInterval(focusTimer);
  }
}, 900);
