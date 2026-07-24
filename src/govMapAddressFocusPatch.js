const FLAG = '__solatrixGovMapAddressFocusPatchV2';
const STORAGE_KEY = 'solatrix_govmap_address_selection_v1';
const TARGET_ZOOM = 12;

function isRoofMarkingPage() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function defineProjection() {
  if (!window.proj4) return false;
  try {
    window.proj4.defs(
      'EPSG:2039',
      '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +units=m +no_defs'
    );
    return true;
  } catch {
    return false;
  }
}

function classifyPair(first, second) {
  const x = Number(first);
  const y = Number(second);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // Israeli Transverse Mercator (EPSG:2039) — GovMap native coordinates.
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };

  if (!defineProjection()) return null;

  try {
    // WGS84 longitude / latitude.
    if (x >= 33 && x <= 37 && y >= 28 && y <= 34) {
      const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [x, y]);
      return { x: itmX, y: itmY };
    }

    // WGS84 latitude / longitude in reversed order.
    if (y >= 33 && y <= 37 && x >= 28 && x <= 34) {
      const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [y, x]);
      return { x: itmX, y: itmY };
    }

    // Web Mercator.
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000) {
      const [itmX, itmY] = window.proj4('EPSG:3857', 'EPSG:2039', [x, y]);
      return { x: itmX, y: itmY };
    }
  } catch {}

  return null;
}

function parsePointText(value) {
  const text = String(value || '');
  const point = text.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  if (point) return classifyPair(point[1], point[2]);

  const pair = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  return pair ? classifyPair(pair[1], pair[2]) : null;
}

function pointFrom(candidate, depth = 0, seen = new Set()) {
  if (candidate == null || depth > 7) return null;
  if (typeof candidate === 'string') return parsePointText(candidate);
  if (typeof candidate !== 'object' || seen.has(candidate)) return null;
  seen.add(candidate);

  if (Array.isArray(candidate)) {
    if (candidate.length >= 2) {
      const direct = classifyPair(candidate[0], candidate[1]);
      if (direct) return direct;
    }
    for (const item of candidate) {
      const nested = pointFrom(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }

  const directPairs = [
    [candidate.x, candidate.y],
    [candidate.X, candidate.Y],
    [candidate.lon ?? candidate.lng ?? candidate.longitude, candidate.lat ?? candidate.latitude],
    [candidate.easting, candidate.northing]
  ];
  for (const pair of directPairs) {
    const direct = classifyPair(pair[0], pair[1]);
    if (direct) return direct;
  }

  const preferred = ['shape', 'geometry', 'coordinates', 'coordinate', 'centroid', 'center', 'point', 'location', 'data', 'result'];
  for (const key of preferred) {
    if (!(key in candidate)) continue;
    const nested = pointFrom(candidate[key], depth + 1, seen);
    if (nested) return nested;
  }

  for (const value of Object.values(candidate)) {
    const nested = pointFrom(value, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function selectedPoint() {
  const live = pointFrom(window.__solatrixGovMapLastAddress);
  if (live) return live;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return pointFrom(saved?.result) || pointFrom(saved);
  } catch {
    return null;
  }
}

function keepOneCrosshair() {
  const wrap = document.querySelector('.solatrixGovMapWrap');
  if (!wrap) return;
  const crosshairs = [...wrap.querySelectorAll('.solatrixGovMapCrosshair')];
  crosshairs.slice(1).forEach((node) => node.remove());
  const crosshair = crosshairs[0];
  if (crosshair) {
    crosshair.style.display = 'block';
    crosshair.style.visibility = 'visible';
    crosshair.style.opacity = '1';
  }
}

function focusAddress() {
  if (!isRoofMarkingPage()) return false;
  keepOneCrosshair();

  const point = selectedPoint();
  if (!point || typeof window.govmap?.zoomToXY !== 'function') return false;

  try {
    window.govmap.zoomToXY({ x: point.x, y: point.y, level: TARGET_ZOOM, marker: true });
    window.__solatrixGovMapAddressFocused = true;
    return true;
  } catch {
    return false;
  }
}

function scheduleFastFocus() {
  [0, 120, 300, 650, 1200, 2200].forEach((delay) => window.setTimeout(focusAddress, delay));
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleFastFocus);
  else scheduleFastFocus();
  window.addEventListener('popstate', scheduleFastFocus);
  window.addEventListener('pageshow', scheduleFastFocus);
  window.setInterval(() => {
    keepOneCrosshair();
    if (!window.__solatrixGovMapAddressFocused) focusAddress();
  }, 1000);
}
