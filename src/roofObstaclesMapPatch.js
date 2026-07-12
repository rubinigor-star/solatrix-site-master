const PATCH_ID = 'solatrix-obstacles-real-map-v1';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const activeMaps = [];
let mapSequence = 0;

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.defer = true;
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function addStyles() {
  if (document.getElementById(`${PATCH_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-style`;
  style.textContent = `
    .mapPanel.solatrixObstaclesRealMap{
      height:clamp(330px,46vh,560px);
      min-height:330px;
      background:#ded6cc;
      border-radius:28px;
      overflow:hidden;
      box-shadow:inset 0 0 0 1px rgba(7,27,47,.12);
    }
    .solatrixObstaclesMapCanvas{position:absolute;inset:0;z-index:1;direction:ltr}
    .solatrixObstaclesMapBadge{
      position:absolute;
      z-index:3;
      top:14px;
      right:14px;
      max-width:calc(100% - 28px);
      padding:10px 14px;
      border-radius:999px;
      background:rgba(255,255,255,.94);
      color:#071b2f;
      font-weight:950;
      font-size:14px;
      box-shadow:0 10px 24px rgba(7,27,47,.16);
      direction:rtl;
    }
    .solatrixObstaclesMapEmpty{
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      padding:24px;
      text-align:center;
      color:#071b2f;
      background:linear-gradient(135deg,#fff7e8,#fff);
      font-weight:900;
      direction:rtl;
    }
    .mapPanel.solatrixObstaclesRealMap .leaflet-control-attribution{font-size:9px}
    @media(max-width:760px){
      .mapScreen .mapCard{padding-top:24px}
      .mapPanel.solatrixObstaclesRealMap{height:390px;min-height:390px;border-radius:22px}
      .solatrixObstaclesMapBadge{top:10px;right:10px;font-size:13px;padding:9px 12px}
    }
  `;
  document.head.appendChild(style);
}

function cleanupDetachedMaps() {
  for (let index = activeMaps.length - 1; index >= 0; index -= 1) {
    const item = activeMaps[index];
    if (item.container.isConnected) continue;
    try { item.map.remove(); } catch {}
    activeMaps.splice(index, 1);
  }
}

function readSurfaces() {
  return (Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [])
    .map((surface) => ({
      ...surface,
      latlngs: (surface?.latlngs || [])
        .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    }))
    .filter((surface) => surface.latlngs.length >= 3);
}

async function installRealMap() {
  if (!(window.location.pathname || '').includes('/obstacles')) return;
  cleanupDetachedMaps();

  const panel = document.querySelector('.mapScreen .mapPanel:not(.interactiveMap)');
  if (!panel || panel.dataset.obstaclesRealMap === 'true') return;

  addStyles();
  panel.dataset.obstaclesRealMap = 'true';
  panel.classList.add('solatrixObstaclesRealMap');
  panel.innerHTML = '';

  const surfaces = readSurfaces();
  if (!surfaces.length) {
    panel.innerHTML = '<div class="solatrixObstaclesMapEmpty">לא נמצא סימון גג שמור. חזרו שלב אחד וסמנו את שטח הגג.</div>';
    return;
  }

  const mapId = `solatrix-obstacles-map-${++mapSequence}`;
  panel.innerHTML = `<div id="${mapId}" class="solatrixObstaclesMapCanvas"></div><div class="solatrixObstaclesMapBadge">הגג שסומן — בחרו מה נמצא עליו</div>`;

  try {
    const L = await loadLeaflet();
    if (!panel.isConnected) return;

    const mapContainer = panel.querySelector(`#${mapId}`);
    const map = L.map(mapId, {
      zoomControl: true,
      attributionControl: true,
      maxZoom: 21,
      doubleClickZoom: false
    });
    activeMaps.push({ map, container: mapContainer });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 21,
      attribution: 'Imagery © Esri'
    }).addTo(map);

    const allPoints = [];
    surfaces.forEach((surface) => {
      const points = surface.latlngs.map((point) => L.latLng(point.lat, point.lng));
      allPoints.push(...points);
      L.polygon(points, {
        color: '#0b6fff',
        weight: 3,
        opacity: 1,
        fillColor: '#0b6fff',
        fillOpacity: 0.28
      }).addTo(map);
    });

    const bounds = L.latLngBounds(allPoints);
    map.fitBounds(bounds.pad(0.28), { maxZoom: 20 });
    setTimeout(() => map.invalidateSize(), 120);
  } catch (error) {
    console.warn('Solatrix obstacles map failed', error);
    panel.innerHTML = '<div class="solatrixObstaclesMapEmpty">המפה לא נטענה. אפשר עדיין לבחור את הפריטים שנמצאים על הגג ולהמשיך.</div>';
  }
}

function tick() {
  installRealMap();
}

const pushState = history.pushState;
history.pushState = function (...args) {
  const result = pushState.apply(this, args);
  setTimeout(tick, 100);
  return result;
};
window.addEventListener('popstate', () => setTimeout(tick, 100));
setInterval(tick, 650);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
