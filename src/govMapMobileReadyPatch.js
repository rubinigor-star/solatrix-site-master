const FLAG = '__solatrixGovMapMobileReadyPatchV1';
const MAP_ID = 'solatrix-official-govmap';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';

function isMobileRoofPage() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function classifyPoint(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };
  return null;
}

function findPoint(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 7) return null;
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const direct = classifyPoint(value[0], value[1]);
      if (direct) return direct;
    }
    for (const item of value) {
      const nested = findPoint(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }

  const direct = classifyPoint(value.x ?? value.X, value.y ?? value.Y);
  if (direct) return direct;
  for (const nestedValue of Object.values(value)) {
    const nested = findPoint(nestedValue, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function savedPoint() {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    return findPoint(saved?.result || saved);
  } catch {
    return null;
  }
}

function revealMap() {
  const wrap = document.querySelector('.solatrixGovMapWrap');
  if (!wrap) return false;
  wrap.classList.add('ready');
  const loading = wrap.querySelector('.solatrixGovMapLoading');
  if (loading) {
    loading.style.opacity = '0';
    loading.style.pointerEvents = 'none';
    window.setTimeout(() => loading.remove(), 250);
  }
  return true;
}

function refocus() {
  const point = savedPoint();
  if (!point || typeof window.govmap?.zoomToXY !== 'function') return;
  try {
    window.govmap.setBackground?.(1);
    window.govmap.zoomToXY({ x: point.x, y: point.y, level: 12, marker: true });
  } catch (error) {
    console.warn('GovMap mobile refocus failed', error);
  }
}

function install() {
  if (!isMobileRoofPage()) return;
  const wrap = document.querySelector('.solatrixGovMapWrap');
  const map = document.getElementById(MAP_ID);
  if (!wrap || !map) return;

  // GovMap can render successfully on iOS without exposing a canvas/img directly.
  // Never let the diagnostic loading layer block the interactive map indefinitely.
  window.setTimeout(revealMap, 1800);
  window.setTimeout(refocus, 2000);
  window.setTimeout(refocus, 3200);
  window.setTimeout(revealMap, 4000);
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.addEventListener('popstate', () => window.setTimeout(install, 120));
  setInterval(install, 700);
}
