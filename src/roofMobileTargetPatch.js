const PATCH_ID = 'solatrix-mobile-target-roof-v3';
const MOBILE_BREAKPOINT = 820;
const NOMINATIM_PART = 'nominatim.openstreetmap.org/search';
const OVERPASS_PARTS = ['overpass-api.de/api/interpreter', 'overpass.kumi.systems/api/interpreter'];

const mobileState = {
  map: null,
  panel: null,
  selected: null,
  allowSyntheticPoint: false,
  autoStarted: false,
  lastSignature: ''
};

function isMobileMode() {
  return window.innerWidth <= MOBILE_BREAKPOINT ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
}

function isRoofMarkingPage() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function surfaces() {
  return Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [];
}

function isDrawing() {
  return document.body.classList.contains('solatrixDrawMode');
}

function mapInstance() {
  return window.__solatrixLeafletMap || null;
}

function stripAutomaticBuildingGeometry() {
  if (window.__solatrixMobileFetchGuardV3) return;
  window.__solatrixMobileFetchGuardV3 = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function mobileRoofFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const mobileRoofRequest = isMobileMode() && isRoofMarkingPage();

    if (mobileRoofRequest && OVERPASS_PARTS.some((part) => url.includes(part))) {
      return new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await originalFetch(input, init);
    if (!mobileRoofRequest || !url.includes(NOMINATIM_PART) || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      if (Array.isArray(payload)) payload.forEach((result) => { delete result.geojson; });
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch {
      return response;
    }
  };
}

stripAutomaticBuildingGeometry();

function addStyles() {
  if (document.getElementById(`${PATCH_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-style`;
  style.textContent = `
    body.solatrixMobileTargetActive .mapCard .drawFooter,
    body.solatrixMobileTargetActive .mapCard .markStatus,
    body.solatrixMobileTargetActive .mapCard .markHint,
    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapToolbar,
    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapHint,
    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapSurfaceList{
      display:none!important;
    }

    body.solatrixMobileTargetActive .mapCard{
      padding-bottom:26px!important;
    }

    .solatrixRealMapWrap.mobileTargetMode{
      height:min(64svh,610px)!important;
      min-height:500px!important;
      border-radius:22px!important;
      overflow:hidden!important;
    }

    .solatrixMobileTargetCrosshair{
      position:absolute;
      z-index:9000;
      left:50%;
      top:48%;
      width:68px;
      height:68px;
      transform:translate(-50%,-50%);
      pointer-events:none;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,.32));
    }

    .solatrixMobileTargetCrosshair i{
      position:absolute;
      left:24px;
      top:24px;
      width:20px;
      height:20px;
      border:2px solid rgba(11,111,255,.92);
      border-radius:50%;
      background:rgba(255,255,255,.08);
      box-shadow:0 0 0 1px rgba(255,255,255,.9);
    }

    .solatrixMobileTargetCrosshair .horizontal,
    .solatrixMobileTargetCrosshair .vertical{
      position:absolute;
      inset:0;
    }

    .solatrixMobileTargetCrosshair .horizontal:before,
    .solatrixMobileTargetCrosshair .horizontal:after,
    .solatrixMobileTargetCrosshair .vertical:before,
    .solatrixMobileTargetCrosshair .vertical:after{
      content:"";
      position:absolute;
      border-radius:999px;
      background:rgba(11,111,255,.88);
      box-shadow:0 0 0 1px rgba(255,255,255,.85);
    }

    .solatrixMobileTargetCrosshair .horizontal:before,
    .solatrixMobileTargetCrosshair .horizontal:after{
      top:33px;
      width:20px;
      height:2px;
    }
    .solatrixMobileTargetCrosshair .horizontal:before{left:0}
    .solatrixMobileTargetCrosshair .horizontal:after{right:0}

    .solatrixMobileTargetCrosshair .vertical:before,
    .solatrixMobileTargetCrosshair .vertical:after{
      left:33px;
      width:2px;
      height:20px;
    }
    .solatrixMobileTargetCrosshair .vertical:before{top:0}
    .solatrixMobileTargetCrosshair .vertical:after{bottom:0}

    .solatrixMobileTargetDock{
      position:fixed!important;
      z-index:2147483000!important;
      left:12px!important;
      right:12px!important;
      bottom:max(12px,env(safe-area-inset-bottom))!important;
      width:auto!important;
      max-width:560px;
      margin:0 auto;
      padding:10px;
      border-radius:23px;
      background:rgba(255,255,255,.94);
      border:1px solid rgba(7,27,47,.10);
      box-shadow:0 18px 46px rgba(7,27,47,.28);
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
      direction:rtl;
    }

    .solatrixMobileTargetStatus{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      min-height:28px;
      padding:0 5px 8px;
      color:#071b2f;
      font-size:13px;
      font-weight:900;
      line-height:1.35;
    }

    .solatrixMobileTargetStatus b{
      flex:0 0 auto;
      color:#0b6fff;
      white-space:nowrap;
      font-size:13px;
    }

    .solatrixMobileTargetButtons{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
    }

    .solatrixMobileTargetButtons button{
      min-width:0;
      min-height:48px;
      padding:10px 12px;
      border:1px solid #cbd8e6;
      border-radius:16px;
      background:#fff;
      color:#174b7d;
      font:inherit;
      font-size:15px;
      font-weight:950;
      line-height:1.15;
      touch-action:manipulation;
    }

    .solatrixMobileTargetButtons button.primary{
      grid-column:1/-1;
      min-height:60px;
      background:linear-gradient(135deg,#247fe8,#4b9bf5);
      border-color:#247fe8;
      color:#fff;
      font-size:19px;
      box-shadow:0 10px 24px rgba(36,127,232,.30);
    }

    .solatrixMobileTargetButtons button.continue{
      background:linear-gradient(135deg,#f5a11a,#ffc35a);
      border-color:#f5a11a;
      color:#241607;
    }

    .solatrixMobileTargetButtons button.danger{
      color:#9e3434;
      border-color:#efcece;
    }

    .solatrixMobileTargetButtons button:disabled{
      opacity:.42;
      box-shadow:none;
    }

    .solatrixRoofPoint.mobileTargetSelected{
      background:#ff9d00!important;
      box-shadow:0 0 0 7px rgba(255,157,0,.30),0 5px 16px rgba(0,0,0,.30)!important;
    }

    @supports(-webkit-touch-callout:none){
      .solatrixMobileTargetDock{
        bottom:calc(env(safe-area-inset-bottom) + 68px)!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function existingButton(action) {
  return document.querySelector(`[data-govmap-action="${action}"]`);
}

function totalArea() {
  return surfaces().reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
}

function formatArea(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('he-IL')} מ״ר`;
}

function savedPointCount() {
  return surfaces().reduce((sum, surface) => sum + (surface?.latlngs?.length || 0), 0);
}

function draftPointCount() {
  const visible = document.querySelectorAll('.solatrixRoofPoint').length;
  return Math.max(0, visible - savedPointCount());
}

function ensureUi() {
  if (!isMobileMode() || !isRoofMarkingPage()) return;
  const wrap = document.querySelector('.solatrixRealMapWrap');
  const map = mapInstance();
  if (!wrap || !map) return;

  mobileState.map = map;
  mobileState.panel = wrap;
  document.body.classList.add('solatrixMobileTargetActive');
  addStyles();
  wrap.classList.add('mobileTargetMode');

  if (!wrap.querySelector('.solatrixMobileTargetCrosshair')) {
    wrap.insertAdjacentHTML('beforeend', '<div class="solatrixMobileTargetCrosshair" aria-hidden="true"><i></i><span class="horizontal"></span><span class="vertical"></span></div>');
  }

  let dock = document.querySelector('.solatrixMobileTargetDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'solatrixMobileTargetDock';
    dock.innerHTML = '<div class="solatrixMobileTargetStatus"></div><div class="solatrixMobileTargetButtons"></div>';
    document.body.appendChild(dock);
  }

  installClickGate(map);
  startManualModeWhenReady();
  renderControls();
}

function normalizedClickHandlers(raw) {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((item) => typeof item?.fn === 'function');
}

function installClickGate(map) {
  if (map.__solatrixMobileTargetClickGateV3) return;
  const handlers = normalizedClickHandlers(map._events?.click);
  if (!handlers.length) return;

  map.off('click');
  map.on('click', (event) => {
    if (!isMobileMode() || mobileState.allowSyntheticPoint) {
      handlers.forEach((handler) => handler.fn.call(handler.ctx || map, event));
    }
  });
  map.__solatrixMobileTargetClickGateV3 = true;
}

function startManualModeWhenReady() {
  if (mobileState.autoStarted || surfaces().length || isDrawing()) return;
  const start = existingButton('start');
  if (!start || start.disabled) return;
  mobileState.autoStarted = true;
  start.click();
}

function setStatus(text, badge = '') {
  const status = document.querySelector('.solatrixMobileTargetStatus');
  if (!status) return;
  status.innerHTML = `<span>${text}</span>${badge ? `<b>${badge}</b>` : ''}`;
}

function setButtons(items) {
  const box = document.querySelector('.solatrixMobileTargetButtons');
  if (!box) return;
  box.innerHTML = items.map((item) => `<button type="button" class="${item.className || ''}" data-mobile-target-action="${item.action}" ${item.disabled ? 'disabled' : ''}>${item.label}</button>`).join('');
  box.querySelectorAll('[data-mobile-target-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.mobileTargetAction));
  });
}

function renderControls(force = false) {
  const dock = document.querySelector('.solatrixMobileTargetDock');
  if (!dock || !isRoofMarkingPage()) return;

  const currentSurfaces = surfaces();
  const points = draftPointCount();
  const signature = `${isDrawing()}|${points}|${currentSurfaces.length}|${mobileState.selected ? 'selected' : ''}`;
  if (!force && signature === mobileState.lastSignature) return;
  mobileState.lastSignature = signature;

  if (isDrawing()) {
    setStatus('הזיזו את המפה עד שהכוונת על הפינה ולחצו הוספת נקודה.', `נקודות: ${points}`);
    setButtons([
      { action: 'add', label: '＋ הוספת נקודה', className: 'primary' },
      { action: 'undo', label: 'ביטול נקודה', disabled: points < 1 },
      { action: 'finish', label: 'סיום שטח', className: 'continue', disabled: points < 3 }
    ]);
    return;
  }

  if (mobileState.selected) {
    setStatus('הזיזו את המפה כך שהכוונת תהיה במקום החדש.', formatArea(totalArea()));
    setButtons([
      { action: 'move-selected', label: 'העבר נקודה לכאן', className: 'primary' },
      { action: 'cancel-select', label: 'ביטול' },
      { action: 'redraw', label: 'התחלה מחדש', className: 'danger' }
    ]);
    return;
  }

  if (currentSurfaces.length) {
    setStatus('השטח נשמר. אפשר להמשיך או לתקן.', formatArea(totalArea()));
    setButtons([
      { action: 'continue', label: 'המשך לשלב הבא', className: 'primary continue' },
      { action: 'add-surface', label: 'הוספת שטח נוסף' },
      { action: 'select-nearest', label: 'תיקון נקודה' },
      { action: 'redraw', label: 'התחלה מחדש', className: 'danger' }
    ]);
    return;
  }

  setStatus('הזיזו את המפה אל הגג והתחילו לסמן באמצעות הכוונת.', '');
  setButtons([{ action: 'start', label: 'התחל סימון', className: 'primary' }]);
}

function firePointAtCenter() {
  const map = mobileState.map;
  if (!map) return;
  mobileState.allowSyntheticPoint = true;
  try {
    map.fire('click', { latlng: map.getCenter(), originalEvent: null, solatrixTargetPoint: true });
  } finally {
    mobileState.allowSyntheticPoint = false;
  }
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 70);
}

function nearestVertexToCenter() {
  const map = mobileState.map;
  if (!map) return null;
  const centerPoint = map.latLngToContainerPoint(map.getCenter());
  let nearest = null;
  let serial = 0;

  surfaces().forEach((surface, surfaceIndex) => {
    (surface.latlngs || []).forEach((point, pointIndex) => {
      const pixel = map.latLngToContainerPoint([point.lat, point.lng]);
      const distance = centerPoint.distanceTo(pixel);
      if (!nearest || distance < nearest.distance) nearest = { surfaceIndex, pointIndex, distance, serial };
      serial += 1;
    });
  });
  return nearest;
}

function clearSelectedHighlight() {
  document.querySelectorAll('.solatrixRoofPoint.mobileTargetSelected').forEach((node) => node.classList.remove('mobileTargetSelected'));
}

function selectNearestVertex() {
  const nearest = nearestVertexToCenter();
  if (!nearest || nearest.distance > 84) {
    setStatus('מקמו את הכוונת קרוב יותר לנקודה כחולה ולחצו שוב.', formatArea(totalArea()));
    return;
  }
  mobileState.selected = nearest;
  clearSelectedHighlight();
  document.querySelectorAll('.solatrixRoofPoint')[nearest.serial]?.classList.add('mobileTargetSelected');
  mobileState.lastSignature = '';
  renderControls(true);
}

function surfaceSnapshots() {
  return surfaces().map((surface) => (surface.latlngs || []).map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })));
}

function rebuildSurfaces(snapshot) {
  const map = mobileState.map;
  const clear = existingButton('clear');
  const start = existingButton('start');
  const finish = existingButton('finish');
  if (!map || !clear || !start || !finish) return;

  clear.click();
  snapshot.filter((points) => points.length >= 3).forEach((points) => {
    start.click();
    points.forEach((point) => {
      mobileState.allowSyntheticPoint = true;
      try { map.fire('click', { latlng: window.L.latLng(point.lat, point.lng), solatrixTargetPoint: true }); }
      finally { mobileState.allowSyntheticPoint = false; }
    });
    finish.click();
  });
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 100);
}

function moveSelectedVertex() {
  if (!mobileState.selected || !mobileState.map) return;
  const snapshot = surfaceSnapshots();
  const point = mobileState.map.getCenter();
  const target = snapshot[mobileState.selected.surfaceIndex]?.[mobileState.selected.pointIndex];
  if (!target) return;
  target.lat = point.lat;
  target.lng = point.lng;
  mobileState.selected = null;
  clearSelectedHighlight();
  rebuildSurfaces(snapshot);
}

function startFreshDrawing(clearExisting = true) {
  mobileState.selected = null;
  clearSelectedHighlight();
  if (clearExisting) existingButton('clear')?.click();
  existingButton('start')?.click();
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 80);
}

function handleAction(action) {
  switch (action) {
    case 'start': startFreshDrawing(false); return;
    case 'add': firePointAtCenter(); return;
    case 'undo': existingButton('undo')?.click(); break;
    case 'finish': existingButton('finish')?.click(); break;
    case 'continue': document.querySelector('.nextTextBtn[data-action="next"]')?.click(); return;
    case 'add-surface': startFreshDrawing(false); return;
    case 'redraw': startFreshDrawing(true); return;
    case 'select-nearest': selectNearestVertex(); return;
    case 'move-selected': moveSelectedVertex(); return;
    case 'cancel-select': mobileState.selected = null; clearSelectedHighlight(); break;
    default: return;
  }
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 80);
}

function cleanup() {
  if (isMobileMode() && isRoofMarkingPage()) return;
  document.body.classList.remove('solatrixMobileTargetActive');
  document.querySelector('.solatrixMobileTargetDock')?.remove();
  document.querySelectorAll('.solatrixRealMapWrap.mobileTargetMode').forEach((node) => node.classList.remove('mobileTargetMode'));
  mobileState.selected = null;
  mobileState.panel = null;
  mobileState.map = null;
  mobileState.autoStarted = false;
  mobileState.lastSignature = '';
}

function tick() {
  cleanup();
  ensureUi();
  if (mobileState.panel?.isConnected) renderControls();
}

const pushState = history.pushState;
history.pushState = function (...args) {
  const result = pushState.apply(this, args);
  setTimeout(tick, 110);
  return result;
};
window.addEventListener('popstate', () => setTimeout(tick, 110));
window.addEventListener('resize', () => setTimeout(tick, 80));
setInterval(tick, 350);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
