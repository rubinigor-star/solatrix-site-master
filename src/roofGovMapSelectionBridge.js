const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const PROJ4_SCRIPT = 'https://cdn.jsdelivr.net/npm/proj4@2.11.0/dist/proj4.js';

function isRoofPage() {
  return (location.pathname || '').includes('/roof-marking');
}

function loadProj4() {
  return new Promise((resolve, reject) => {
    if (window.proj4) return resolve();
    const existing = document.querySelector(`script[src="${PROJ4_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = PROJ4_SCRIPT;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function defineProjection() {
  window.proj4?.defs('EPSG:2039', '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs');
}

function classify(first, second) {
  const x = Number(first);
  const y = Number(second);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };
  if (x >= 33 && x <= 37 && y >= 28 && y <= 34) {
    defineProjection();
    const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [x, y]);
    return { x: itmX, y: itmY };
  }
  if (y >= 33 && y <= 37 && x >= 28 && x <= 34) {
    defineProjection();
    const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [y, x]);
    return { x: itmX, y: itmY };
  }
  return null;
}

function findPoint(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 8) return null;
  if (typeof value === 'string') {
    const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    return match ? classify(match[1], match[2]) : null;
  }
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const direct = classify(value[0], value[1]);
      if (direct) return direct;
    }
    for (const item of value) {
      const nested = findPoint(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }
  for (const pair of [
    [value.x, value.y], [value.X, value.Y],
    [value.lon ?? value.lng ?? value.longitude, value.lat ?? value.latitude],
    [value.easting, value.northing]
  ]) {
    const direct = classify(pair[0], pair[1]);
    if (direct) return direct;
  }
  for (const nested of Object.values(value)) {
    const point = findPoint(nested, depth + 1, seen);
    if (point) return point;
  }
  return null;
}

function readSelection() {
  try { return JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null'); } catch { return null; }
}

async function applySelectedPoint() {
  if (!isRoofPage()) return;
  const selection = readSelection();
  if (!selection?.result) return;
  await loadProj4();
  const point = findPoint(selection.result);
  if (!point) return;
  window.__solatrixGovMapCenterItm = { ...point };
  const tryZoom = () => {
    if (!isRoofPage() || typeof window.govmap?.zoomToXY !== 'function') return false;
    try {
      window.govmap.setBackground?.(1);
      window.govmap.zoomToXY({ x: point.x, y: point.y, level: 11, marker: false });
      window.dispatchEvent(new CustomEvent('solatrix:govmap-center-changed', { detail: point }));
      return true;
    } catch {
      return false;
    }
  };
  [300, 900, 1600, 2600].forEach((delay) => setTimeout(tryZoom, delay));
}

window.addEventListener('popstate', () => setTimeout(applySelectedPoint, 50));
window.addEventListener('pageshow', applySelectedPoint);
setInterval(() => { if (isRoofPage()) applySelectedPoint(); }, 2500);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applySelectedPoint); else applySelectedPoint();
