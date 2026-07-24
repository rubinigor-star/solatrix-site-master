const MOBILE_GOVMAP_STABILITY_FLAG = '__solatrixMobileGovMapStabilityV1';
const MAP_ID = 'solatrix-official-govmap';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';

function isMobileRoofPage() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function setHint(text) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (hint) hint.textContent = text;
}

function classifyPair(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x >= 100000 && x <= 350000 && y >= 350000 && y <= 850000) return { x, y };
  if (window.proj4 && x >= 33 && x <= 37 && y >= 28 && y <= 34) {
    const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [x, y]);
    return { x: itmX, y: itmY };
  }
  if (window.proj4 && y >= 33 && y <= 37 && x >= 28 && x <= 34) {
    const [itmX, itmY] = window.proj4('EPSG:4326', 'EPSG:2039', [y, x]);
    return { x: itmX, y: itmY };
  }
  return null;
}

function pointFromCandidate(value, depth = 0, seen = new Set()) {
  if (value == null || depth > 7) return null;
  if (typeof value === 'string') {
    const point = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
    if (point) return classifyPair(point[1], point[2]);
    return null;
  }
  if (typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length >= 2) {
      const direct = classifyPair(value[0], value[1]);
      if (direct) return direct;
    }
    for (const item of value) {
      const nested = pointFromCandidate(item, depth + 1, seen);
      if (nested) return nested;
    }
    return null;
  }
  const pairs = [
    [value.x, value.y],
    [value.X, value.Y],
    [value.lon ?? value.lng ?? value.longitude, value.lat ?? value.latitude],
    [value.easting, value.northing]
  ];
  for (const pair of pairs) {
    const direct = classifyPair(pair[0], pair[1]);
    if (direct) return direct;
  }
  for (const nestedValue of Object.values(value)) {
    const nested = pointFromCandidate(nestedValue, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function savedPoint() {
  try {
    const selection = JSON.parse(localStorage.getItem(SELECTION_KEY) || 'null');
    return pointFromCandidate(selection?.result || selection);
  } catch {
    return null;
  }
}

function mapHasVisual(root) {
  if (!root) return false;
  const visual = root.querySelector('canvas, img, iframe, svg, [role="application"]');
  if (visual) return true;
  return root.childElementCount > 0 && root.textContent?.trim() !== '';
}

function refreshGovMap(point) {
  try { window.govmap?.setBackground?.(1); } catch {}
  try { window.govmap?.resize?.(); } catch {}
  try { window.govmap?.refresh?.(); } catch {}
  try { window.govmap?.invalidateSize?.(); } catch {}
  if (point && typeof window.govmap?.zoomToXY === 'function') {
    try {
      window.govmap.zoomToXY({ x: point.x, y: point.y, level: 12, marker: true });
    } catch {}
  }
}

function restartOnce(root) {
  if (!root || root.dataset.mobileGovmapRestarted === 'true') return;
  if (typeof window.govmap?.createMap !== 'function') return;
  root.dataset.mobileGovmapRestarted = 'true';
  root.replaceChildren();
  try {
    window.govmap.createMap(MAP_ID, {
      token: String(window.__SOLATRIX_CONFIG__?.govMapApiToken || '').trim(),
      layers: [],
      showXY: false,
      identifyOnClick: false,
      isEmbeddedToggle: false,
      background: '1',
      layersMode: 1,
      zoomButtons: true
    });
  } catch (error) {
    console.warn('Mobile GovMap restart failed', error);
  }
}

function supervise() {
  if (!isMobileRoofPage()) return;
  const root = document.getElementById(MAP_ID);
  const wrap = document.querySelector('.solatrixGovMapWrap');
  if (!root || !wrap || root.dataset.mobileGovmapSupervised === 'true') return;

  root.dataset.mobileGovmapSupervised = 'true';
  const point = savedPoint();
  const started = Date.now();
  let stableVisualChecks = 0;

  const observer = new ResizeObserver(() => refreshGovMap(point));
  observer.observe(wrap);

  const timer = window.setInterval(() => {
    if (!isMobileRoofPage() || !document.body.contains(root)) {
      window.clearInterval(timer);
      observer.disconnect();
      return;
    }

    const elapsed = Date.now() - started;
    const hasVisual = mapHasVisual(root);
    refreshGovMap(point);

    if (hasVisual) {
      stableVisualChecks += 1;
      if (stableVisualChecks >= 2) {
        wrap.classList.add('ready');
        setHint('הכתובת נמצאה. הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת.');
      }
    } else {
      stableVisualChecks = 0;
      setHint('טוענים את GovMap…');
      if (elapsed > 9000) restartOnce(root);
    }

    if (elapsed > 42000) {
      window.clearInterval(timer);
      observer.disconnect();
      if (!mapHasVisual(root)) setHint('GovMap לא נטען. רעננו את הדף ונסו שוב.');
    }
  }, 1400);
}

function tick() {
  if (!isMobileRoofPage()) return;
  supervise();
}

if (!window[MOBILE_GOVMAP_STABILITY_FLAG]) {
  window[MOBILE_GOVMAP_STABILITY_FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('pageshow', () => window.setTimeout(tick, 150));
  window.addEventListener('popstate', () => window.setTimeout(tick, 150));
  window.setInterval(tick, 700);
}
