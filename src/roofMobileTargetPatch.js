const PATCH_ID = 'solatrix-mobile-target-roof-v4';
const MOBILE_BREAKPOINT = 820;
const NOMINATIM_PART = 'nominatim.openstreetmap.org/search';
const OVERPASS_PARTS = ['overpass-api.de/api/interpreter', 'overpass.kumi.systems/api/interpreter'];

const mobileState = {
  map: null,
  wrap: null,
  allowSyntheticPoint: false,
  autoStarted: false,
  lastSignature: '',
  invalidated: false
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
  if (window.__solatrixMobileFetchGuardV4) return;
  window.__solatrixMobileFetchGuardV4 = true;
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
    body.solatrixMobileTargetActive{
      overflow:hidden!important;
      overscroll-behavior:none!important;
    }

    body.solatrixMobileTargetActive .siteHeader{
      z-index:2147482000!important;
    }

    body.solatrixMobileTargetActive .mapScreen{
      position:fixed!important;
      z-index:2147481000!important;
      top:var(--solatrix-mobile-editor-top,120px)!important;
      right:0!important;
      bottom:0!important;
      left:0!important;
      width:100%!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      overflow:hidden!important;
      background:#f7f3ec!important;
    }

    body.solatrixMobileTargetActive .mapCard{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      max-width:none!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      box-shadow:none!important;
      background:transparent!important;
      overflow:hidden!important;
    }

    body.solatrixMobileTargetActive .mapCard > :not(.mapPanel){
      display:none!important;
    }

    body.solatrixMobileTargetActive .mapPanel.solatrixMapInjected{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      max-width:none!important;
      min-height:0!important;
      margin:0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      overflow:hidden!important;
    }

    body.solatrixMobileTargetActive .solatrixRealMapWrap.mobileTargetMode{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:auto!important;
      min-height:0!important;
      border-radius:0!important;
      overflow:hidden!important;
    }

    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapToolbar,
    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapHint,
    body.solatrixMobileTargetActive .solatrixRealMapWrap .solatrixMapSurfaceList{
      display:none!important;
    }

    .solatrixMobileTargetCrosshair{
      position:absolute;
      z-index:10000;
      left:50%;
      top:43%;
      width:72px;
      height:72px;
      transform:translate(-50%,-50%);
      pointer-events:none;
      opacity:1;
      transition:opacity .18s ease,transform .18s ease;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,.28));
    }

    body:not(.solatrixTargetDrawing) .solatrixMobileTargetCrosshair{
      opacity:0;
      transform:translate(-50%,-50%) scale(.85);
    }

    .solatrixMobileTargetCrosshair::before{
      content:"";
      position:absolute;
      left:24px;
      top:24px;
      width:20px;
      height:20px;
      border:2px solid rgba(18,110,235,.94);
      border-radius:50%;
      background:transparent;
      box-shadow:0 0 0 2px rgba(255,255,255,.92);
    }

    .solatrixMobileTargetCrosshair::after{
      content:"";
      position:absolute;
      left:34px;
      top:34px;
      width:4px;
      height:4px;
      margin:-2px 0 0 -2px;
      border-radius:50%;
      background:rgba(18,110,235,.95);
      box-shadow:0 0 0 1px #fff;
    }

    .solatrixMobileTargetCrosshair i,
    .solatrixMobileTargetCrosshair i::before,
    .solatrixMobileTargetCrosshair i::after{
      position:absolute;
      content:"";
      display:block;
      background:rgba(18,110,235,.92);
      border-radius:999px;
      box-shadow:0 0 0 1px rgba(255,255,255,.9);
    }

    .solatrixMobileTargetCrosshair i{
      left:0;
      top:35px;
      width:19px;
      height:2px;
      box-shadow:53px 0 0 rgba(18,110,235,.92),0 0 0 1px rgba(255,255,255,.9),53px 0 0 1px rgba(255,255,255,.9);
    }

    .solatrixMobileTargetCrosshair i::before{
      left:34px;
      top:-35px;
      width:2px;
      height:19px;
    }

    .solatrixMobileTargetCrosshair i::after{
      left:34px;
      top:51px;
      width:2px;
      height:19px;
    }

    .solatrixMobileTargetHud{
      position:absolute;
      z-index:10001;
      top:12px;
      left:50%;
      width:min(88%,520px);
      transform:translateX(-50%);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      padding:10px 13px;
      border-radius:17px;
      background:rgba(255,255,255,.91);
      border:1px solid rgba(7,27,47,.10);
      box-shadow:0 9px 24px rgba(7,27,47,.18);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
      color:#071b2f;
      direction:rtl;
      pointer-events:none;
    }

    .solatrixMobileTargetHud span{
      font-size:13px;
      font-weight:900;
      line-height:1.25;
    }

    .solatrixMobileTargetHud b{
      flex:0 0 auto;
      padding:5px 9px;
      border-radius:999px;
      background:#eaf3ff;
      color:#126eeb;
      font-size:13px;
      white-space:nowrap;
    }

    .solatrixMobileTargetDock{
      position:fixed!important;
      z-index:2147483000!important;
      left:10px!important;
      right:10px!important;
      bottom:max(10px,env(safe-area-inset-bottom))!important;
      width:auto!important;
      max-width:600px;
      margin:0 auto;
      padding:8px;
      border-radius:21px;
      background:rgba(255,255,255,.94);
      border:1px solid rgba(7,27,47,.12);
      box-shadow:0 18px 46px rgba(7,27,47,.28);
      backdrop-filter:blur(18px);
      -webkit-backdrop-filter:blur(18px);
      direction:rtl;
    }

    .solatrixMobileTargetButtons{
      display:grid;
      grid-template-columns:minmax(0,1.7fr) minmax(0,.75fr) minmax(0,.9fr);
      gap:7px;
    }

    .solatrixMobileTargetButtons button{
      min-width:0;
      min-height:56px;
      padding:9px 8px;
      border:1px solid #cbd8e6;
      border-radius:15px;
      background:#fff;
      color:#174b7d;
      font:inherit;
      font-size:14px;
      font-weight:950;
      line-height:1.1;
      touch-action:manipulation;
      white-space:nowrap;
    }

    .solatrixMobileTargetButtons button.primary{
      background:linear-gradient(135deg,#247fe8,#4b9bf5);
      border-color:#247fe8;
      color:#fff;
      font-size:18px;
      box-shadow:0 9px 20px rgba(36,127,232,.29);
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

    body.solatrixMobileTargetActive .solatrixRoofPoint{
      width:22px!important;
      height:22px!important;
      margin-left:-11px!important;
      margin-top:-11px!important;
      border:2px solid #126eeb!important;
      border-radius:50%!important;
      background:rgba(255,255,255,.08)!important;
      box-shadow:0 0 0 2px rgba(255,255,255,.92),0 3px 9px rgba(0,0,0,.28)!important;
      overflow:visible!important;
    }

    body.solatrixMobileTargetActive .solatrixRoofPoint::before,
    body.solatrixMobileTargetActive .solatrixRoofPoint::after{
      content:"";
      position:absolute;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      background:#126eeb;
      border-radius:999px;
    }

    body.solatrixMobileTargetActive .solatrixRoofPoint::before{
      width:30px;
      height:2px;
    }

    body.solatrixMobileTargetActive .solatrixRoofPoint::after{
      width:2px;
      height:30px;
    }

    body.solatrixMobileTargetActive .solatrixRoofPoint.first{
      border-color:#f29a13!important;
      background:rgba(255,255,255,.08)!important;
    }

    body.solatrixMobileTargetActive .solatrixRoofPoint.first::before,
    body.solatrixMobileTargetActive .solatrixRoofPoint.first::after{
      background:#f29a13!important;
    }

    .solatrixMobileTargetCrosshair.pointAdded{
      animation:solatrixTargetConfirm .34s ease;
    }

    @keyframes solatrixTargetConfirm{
      0%{transform:translate(-50%,-50%) scale(1)}
      45%{transform:translate(-50%,-50%) scale(1.22)}
      100%{transform:translate(-50%,-50%) scale(1)}
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

function draftPointCount() {
  const draft = window.__solatrixRoofDraftPoints;
  if (Array.isArray(draft)) return draft.filter(Boolean).length;
  const saved = surfaces().reduce((sum, surface) => sum + (surface?.latlngs?.length || 0), 0);
  return Math.max(0, document.querySelectorAll('.solatrixRoofPoint').length - saved);
}

function updateEditorTop() {
  const header = document.querySelector('.siteHeader');
  const bottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
  document.documentElement.style.setProperty('--solatrix-mobile-editor-top', `${bottom}px`);
}

function ensureUi() {
  if (!isMobileMode() || !isRoofMarkingPage()) return;
  const wrap = document.querySelector('.solatrixRealMapWrap');
  const map = mapInstance();
  if (!wrap || !map) return;

  mobileState.map = map;
  mobileState.wrap = wrap;
  document.body.classList.add('solatrixMobileTargetActive');
  document.body.classList.toggle('solatrixTargetDrawing', isDrawing());
  updateEditorTop();
  addStyles();
  wrap.classList.add('mobileTargetMode');

  if (!wrap.querySelector('.solatrixMobileTargetCrosshair')) {
    wrap.insertAdjacentHTML('beforeend', '<div class="solatrixMobileTargetCrosshair" aria-hidden="true"><i></i></div>');
  }

  if (!wrap.querySelector('.solatrixMobileTargetHud')) {
    wrap.insertAdjacentHTML('beforeend', '<div class="solatrixMobileTargetHud"><span></span><b></b></div>');
  }

  let dock = document.querySelector('.solatrixMobileTargetDock');
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'solatrixMobileTargetDock';
    dock.innerHTML = '<div class="solatrixMobileTargetButtons"></div>';
    document.body.appendChild(dock);
  }

  installClickGate(map);
  startManualModeWhenReady();
  renderControls();

  if (!mobileState.invalidated) {
    mobileState.invalidated = true;
    setTimeout(() => map.invalidateSize(), 120);
  }
}

function normalizedClickHandlers(raw) {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((item) => typeof item?.fn === 'function');
}

function installClickGate(map) {
  if (map.__solatrixMobileTargetClickGateV4) return;
  const handlers = normalizedClickHandlers(map._events?.click);
  if (!handlers.length) return;

  map.off('click');
  map.on('click', (event) => {
    const synthetic = mobileState.allowSyntheticPoint || !event?.originalEvent;
    if (!isMobileMode() || synthetic) {
      handlers.forEach((handler) => handler.fn.call(handler.ctx || map, event));
    }
  });
  map.__solatrixMobileTargetClickGateV4 = true;
}

function startManualModeWhenReady() {
  if (mobileState.autoStarted || surfaces().length || isDrawing()) return;
  const start = existingButton('start');
  if (!start || start.disabled) return;
  mobileState.autoStarted = true;
  start.click();
}

function setHud(text, badge = '') {
  const hud = document.querySelector('.solatrixMobileTargetHud');
  if (!hud) return;
  const label = hud.querySelector('span');
  const count = hud.querySelector('b');
  if (label) label.textContent = text;
  if (count) {
    count.textContent = badge;
    count.style.display = badge ? '' : 'none';
  }
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

  document.body.classList.toggle('solatrixTargetDrawing', isDrawing());
  const currentSurfaces = surfaces();
  const points = draftPointCount();
  const signature = `${isDrawing()}|${points}|${currentSurfaces.length}|${Math.round(totalArea())}`;
  if (!force && signature === mobileState.lastSignature) return;
  mobileState.lastSignature = signature;

  if (isDrawing()) {
    setHud('הזיזו את המפה עד שהכוונת בדיוק על פינת הגג', `נקודה ${points + 1}`);
    setButtons([
      { action: 'add', label: '＋ הוסף נקודה', className: 'primary' },
      { action: 'undo', label: '↶ בטל', disabled: points < 1 },
      { action: 'finish', label: 'סיים שטח', className: 'continue', disabled: points < 3 }
    ]);
    return;
  }

  if (currentSurfaces.length) {
    setHud('השטח נשמר. אפשר לגרור כל כוונת קטנה לתיקון', formatArea(totalArea()));
    setButtons([
      { action: 'continue', label: 'המשך', className: 'primary continue' },
      { action: 'add-surface', label: 'עוד שטח' },
      { action: 'redraw', label: 'התחל מחדש', className: 'danger' }
    ]);
    return;
  }

  setHud('הזיזו את המפה אל הגג והתחילו לסמן', '');
  setButtons([
    { action: 'start', label: 'התחל סימון', className: 'primary' },
    { action: 'noop', label: '', disabled: true },
    { action: 'noop', label: '', disabled: true }
  ]);
}

function crosshairLatLng() {
  const map = mobileState.map;
  const wrap = mobileState.wrap;
  const crosshair = wrap?.querySelector('.solatrixMobileTargetCrosshair');
  const container = map?.getContainer?.();
  if (!map || !crosshair || !container) return map?.getCenter?.() || null;

  const crosshairRect = crosshair.getBoundingClientRect();
  const mapRect = container.getBoundingClientRect();
  const x = crosshairRect.left + crosshairRect.width / 2 - mapRect.left;
  const y = crosshairRect.top + crosshairRect.height / 2 - mapRect.top;
  const clampedX = Math.max(0, Math.min(mapRect.width, x));
  const clampedY = Math.max(0, Math.min(mapRect.height, y));
  return map.containerPointToLatLng(window.L.point(clampedX, clampedY));
}

function flashPointAdded() {
  const crosshair = document.querySelector('.solatrixMobileTargetCrosshair');
  if (!crosshair) return;
  crosshair.classList.remove('pointAdded');
  void crosshair.offsetWidth;
  crosshair.classList.add('pointAdded');
  setTimeout(() => crosshair.classList.remove('pointAdded'), 360);
  try { navigator.vibrate?.(18); } catch {}
}

function firePointAtCrosshair() {
  const map = mobileState.map;
  const latlng = crosshairLatLng();
  if (!map || !latlng) return;

  mobileState.allowSyntheticPoint = true;
  try {
    map.fire('click', { latlng, originalEvent: null, solatrixTargetPoint: true });
  } finally {
    mobileState.allowSyntheticPoint = false;
  }
  flashPointAdded();
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 70);
}

function startFreshDrawing(clearExisting = true) {
  if (clearExisting) existingButton('clear')?.click();
  existingButton('start')?.click();
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 80);
}

function handleAction(action) {
  switch (action) {
    case 'start': startFreshDrawing(false); return;
    case 'add': firePointAtCrosshair(); return;
    case 'undo': existingButton('undo')?.click(); break;
    case 'finish': existingButton('finish')?.click(); break;
    case 'continue': document.querySelector('.nextTextBtn[data-action="next"]')?.click(); return;
    case 'add-surface': startFreshDrawing(false); return;
    case 'redraw': startFreshDrawing(true); return;
    default: return;
  }
  mobileState.lastSignature = '';
  setTimeout(() => renderControls(true), 80);
}

function cleanup() {
  if (isMobileMode() && isRoofMarkingPage()) return;
  document.body.classList.remove('solatrixMobileTargetActive', 'solatrixTargetDrawing');
  document.querySelector('.solatrixMobileTargetDock')?.remove();
  document.querySelectorAll('.solatrixRealMapWrap.mobileTargetMode').forEach((node) => node.classList.remove('mobileTargetMode'));
  document.documentElement.style.removeProperty('--solatrix-mobile-editor-top');
  mobileState.map = null;
  mobileState.wrap = null;
  mobileState.autoStarted = false;
  mobileState.lastSignature = '';
  mobileState.invalidated = false;
}

function tick() {
  cleanup();
  ensureUi();
  if (mobileState.wrap?.isConnected) renderControls();
}

const pushState = history.pushState;
history.pushState = function (...args) {
  const result = pushState.apply(this, args);
  setTimeout(tick, 110);
  return result;
};
window.addEventListener('popstate', () => setTimeout(tick, 110));
window.addEventListener('resize', () => {
  updateEditorTop();
  setTimeout(() => {
    mobileState.map?.invalidateSize?.();
    tick();
  }, 100);
});
window.addEventListener('scroll', updateEditorTop, { passive: true });
setInterval(tick, 300);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
