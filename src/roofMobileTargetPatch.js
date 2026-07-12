const PATCH_ID = 'solatrix-mobile-target-roof-v1';
const MOBILE_QUERY = '(max-width: 760px) and (pointer: coarse)';

const mobileState = {
  map: null,
  panel: null,
  selected: null,
  clickGateInstalled: false,
  rebuilding: false,
  allowSyntheticPoint: false
};

function isMobileMode() {
  return window.matchMedia(MOBILE_QUERY).matches;
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

function addStyles() {
  if (document.getElementById(`${PATCH_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-style`;
  style.textContent = `
    @media(max-width:760px) and (pointer:coarse){
      .solatrixRealMapWrap.mobileTargetMode{height:calc(100svh - 190px);min-height:520px;border-radius:22px}
      .solatrixRealMapWrap.mobileTargetMode .solatrixMapToolbar{display:none!important}
      .solatrixRealMapWrap.mobileTargetMode .solatrixMapHint{display:none!important}
      .solatrixRealMapWrap.mobileTargetMode .solatrixMapSurfaceList{top:12px;left:12px;max-width:170px;z-index:5}
      .solatrixMobileTargetCrosshair{position:absolute;z-index:6;left:50%;top:50%;width:58px;height:58px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 4px 8px rgba(0,0,0,.28))}
      .solatrixMobileTargetCrosshair:before,.solatrixMobileTargetCrosshair:after{content:"";position:absolute;background:#fff;border:2px solid #0b6fff;border-radius:999px}
      .solatrixMobileTargetCrosshair:before{width:58px;height:4px;left:0;top:27px}
      .solatrixMobileTargetCrosshair:after{width:4px;height:58px;left:27px;top:0}
      .solatrixMobileTargetCrosshair i{position:absolute;left:16px;top:16px;width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.92);border:4px solid #0b6fff;box-shadow:0 0 0 4px rgba(7,27,47,.55)}
      .solatrixMobileTargetSheet{position:absolute;z-index:7;left:10px;right:10px;bottom:10px;padding:14px;border-radius:24px;background:rgba(255,255,255,.97);box-shadow:0 18px 42px rgba(7,27,47,.24);direction:rtl;border:1px solid rgba(7,27,47,.08)}
      .solatrixMobileTargetStatus{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;color:#071b2f;font-weight:900;font-size:14px;line-height:1.35}
      .solatrixMobileTargetStatus b{white-space:nowrap;color:#0b6fff}
      .solatrixMobileTargetButtons{display:grid;grid-template-columns:1.45fr 1fr;gap:9px}
      .solatrixMobileTargetButtons button{min-height:52px;border-radius:17px;border:1px solid #c9d7e6;background:#fff;color:#0b4b8b;font:inherit;font-size:16px;font-weight:950;padding:10px 12px}
      .solatrixMobileTargetButtons button.primary{background:#438cf0;border-color:#438cf0;color:#fff;box-shadow:0 10px 24px rgba(67,140,240,.28)}
      .solatrixMobileTargetButtons button.wide{grid-column:1/-1}
      .solatrixMobileTargetButtons button.danger{color:#a32f2f;border-color:#efcaca}
      .solatrixRoofPoint.mobileTargetSelected{background:#ff9d00!important;box-shadow:0 0 0 7px rgba(255,157,0,.28),0 5px 16px rgba(0,0,0,.3)!important}
      .mapCard .markStatus.solatrixPatched{display:none!important}
    }
  `;
  document.head.appendChild(style);
}

function totalArea() {
  return surfaces().reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
}

function formatArea(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('he-IL')} מ״ר`;
}

function ensureUi() {
  if (!isMobileMode() || !isRoofMarkingPage()) return;
  const wrap = document.querySelector('.solatrixRealMapWrap');
  const map = mapInstance();
  if (!wrap || !map) return;

  mobileState.map = map;
  mobileState.panel = wrap;
  addStyles();
  wrap.classList.add('mobileTargetMode');

  if (!wrap.querySelector('.solatrixMobileTargetCrosshair')) {
    wrap.insertAdjacentHTML('beforeend', '<div class="solatrixMobileTargetCrosshair" aria-hidden="true"><i></i></div>');
  }

  let sheet = wrap.querySelector('.solatrixMobileTargetSheet');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'solatrixMobileTargetSheet';
    sheet.innerHTML = '<div class="solatrixMobileTargetStatus"></div><div class="solatrixMobileTargetButtons"></div>';
    wrap.appendChild(sheet);
  }

  installClickGate(map);
  renderControls();
}

function normalizedClickHandlers(raw) {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).filter((item) => typeof item?.fn === 'function');
}

function installClickGate(map) {
  if (map.__solatrixMobileTargetClickGate) return;
  const handlers = normalizedClickHandlers(map._events?.click);
  if (!handlers.length) return;

  map.off('click');
  map.on('click', (event) => {
    if (!isMobileMode() || mobileState.allowSyntheticPoint) {
      handlers.forEach((handler) => handler.fn.call(handler.ctx || map, event));
    }
  });
  map.__solatrixMobileTargetClickGate = true;
  mobileState.clickGateInstalled = true;
}

function setStatus(text, badge = '') {
  const status = mobileState.panel?.querySelector('.solatrixMobileTargetStatus');
  if (!status) return;
  status.innerHTML = `<span>${text}</span>${badge ? `<b>${badge}</b>` : ''}`;
}

function setButtons(items) {
  const box = mobileState.panel?.querySelector('.solatrixMobileTargetButtons');
  if (!box) return;
  box.innerHTML = items.map((item) => `<button type="button" class="${item.className || ''}" data-mobile-target-action="${item.action}">${item.label}</button>`).join('');
  box.querySelectorAll('[data-mobile-target-action]').forEach((button) => {
    button.addEventListener('click', () => handleAction(button.dataset.mobileTargetAction));
  });
}

function renderControls() {
  if (!mobileState.panel?.isConnected) return;
  const currentSurfaces = surfaces();
  const drawing = isDrawing();

  if (drawing) {
    setStatus('הזיזו את המפה עד שהכוונת נמצאת בדיוק על הפינה, ואז הוסיפו נקודה.', currentSurfaces.length ? formatArea(totalArea()) : '');
    setButtons([
      { action: 'add', label: 'הוספת נקודה +', className: 'primary' },
      { action: 'finish', label: 'סיום שטח' },
      { action: 'undo', label: 'ביטול נקודה' },
      { action: 'cancel-drawing', label: 'ניקוי והתחלה מחדש', className: 'danger' }
    ]);
    return;
  }

  if (mobileState.selected) {
    setStatus('הנקודה נבחרה. הזיזו את המפה עד שהכוונת במקום החדש ולחצו עדכון.', formatArea(totalArea()));
    setButtons([
      { action: 'move-selected', label: 'העבר נקודה לכאן', className: 'primary' },
      { action: 'cancel-select', label: 'ביטול בחירה' },
      { action: 'redraw', label: 'סימון מחדש', className: 'danger wide' }
    ]);
    return;
  }

  if (currentSurfaces.length) {
    setStatus('לתיקון מדויק: מקמו את הכוונת מעל נקודה קיימת ולחצו “בחר נקודה”.', formatArea(totalArea()));
    setButtons([
      { action: 'select-nearest', label: 'בחר נקודה קרובה', className: 'primary' },
      { action: 'redraw', label: 'סימון מחדש' }
    ]);
    return;
  }

  setStatus('הזיזו את המפה אל הגג ולחצו להתחלת סימון באמצעות הכוונת.', '');
  setButtons([
    { action: 'start', label: 'התחל סימון', className: 'primary wide' }
  ]);
}

function existingButton(action) {
  return document.querySelector(`[data-govmap-action="${action}"]`);
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
  setTimeout(renderControls, 60);
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
      if (!nearest || distance < nearest.distance) {
        nearest = { surfaceIndex, pointIndex, distance, serial };
      }
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
  if (!nearest || nearest.distance > 72) {
    setStatus('מקמו את הכוונת קרוב יותר לאחת הנקודות הכחולות ולחצו שוב.', formatArea(totalArea()));
    return;
  }

  mobileState.selected = nearest;
  clearSelectedHighlight();
  const markers = document.querySelectorAll('.solatrixRoofPoint');
  markers[nearest.serial]?.classList.add('mobileTargetSelected');
  renderControls();
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

  mobileState.rebuilding = true;
  clear.click();
  snapshot.filter((points) => points.length >= 3).forEach((points) => {
    start.click();
    points.forEach((point) => {
      mobileState.allowSyntheticPoint = true;
      try { map.fire('click', { latlng: map.options.crs ? window.L.latLng(point.lat, point.lng) : point, solatrixTargetPoint: true }); }
      finally { mobileState.allowSyntheticPoint = false; }
    });
    finish.click();
  });
  mobileState.rebuilding = false;
  setTimeout(renderControls, 90);
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

function startFreshDrawing() {
  mobileState.selected = null;
  clearSelectedHighlight();
  existingButton('clear')?.click();
  existingButton('start')?.click();
  setTimeout(renderControls, 60);
}

function handleAction(action) {
  switch (action) {
    case 'start':
      existingButton('start')?.click();
      break;
    case 'add':
      firePointAtCenter();
      break;
    case 'finish':
      existingButton('finish')?.click();
      break;
    case 'undo':
      existingButton('undo')?.click();
      break;
    case 'cancel-drawing':
    case 'redraw':
      startFreshDrawing();
      break;
    case 'select-nearest':
      selectNearestVertex();
      return;
    case 'move-selected':
      moveSelectedVertex();
      return;
    case 'cancel-select':
      mobileState.selected = null;
      clearSelectedHighlight();
      break;
    default:
      return;
  }
  setTimeout(renderControls, 70);
}

function cleanup() {
  if (isMobileMode() && isRoofMarkingPage()) return;
  document.querySelectorAll('.solatrixRealMapWrap.mobileTargetMode').forEach((node) => node.classList.remove('mobileTargetMode'));
  mobileState.selected = null;
  mobileState.panel = null;
  mobileState.map = null;
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
window.matchMedia(MOBILE_QUERY).addEventListener?.('change', tick);
setInterval(tick, 550);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
