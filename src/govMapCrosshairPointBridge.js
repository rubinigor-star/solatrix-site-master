const FLAG = '__solatrixGovMapCrosshairPointBridgeV1';

function onRoofMarking() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function govMapWrap() {
  return document.querySelector('.solatrixGovMapWrap');
}

function govMapTargetAtCenter() {
  const wrap = govMapWrap();
  if (!wrap) return null;
  const rect = wrap.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const target = document.elementFromPoint(x, y) || wrap.querySelector('#solatrix-official-govmap') || wrap;
  return { wrap, target, x, y };
}

function dispatchPointerSequence({ target, x, y }, doubleClick = false) {
  const common = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1, detail: doubleClick ? 2 : 1, view: window };
  try { target.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerId: 1, pointerType: 'touch', isPrimary: true })); } catch {}
  target.dispatchEvent(new MouseEvent('mousedown', common));
  try { target.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0, pointerId: 1, pointerType: 'touch', isPrimary: true })); } catch {}
  target.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
  target.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 }));
  if (doubleClick) target.dispatchEvent(new MouseEvent('dblclick', { ...common, buttons: 0, detail: 2 }));
}

function ensureOfficialDrawStarted(callback) {
  const wrap = govMapWrap();
  if (!wrap) return;
  if (wrap.classList.contains('isDrawing')) {
    callback();
    return;
  }
  const draw = wrap.querySelector('[data-govmap-official="draw"]');
  if (!draw || draw.disabled) return;
  draw.click();
  window.setTimeout(callback, 140);
}

function flashCrosshair() {
  const crosshair = govMapWrap()?.querySelector('.solatrixGovMapCrosshair');
  if (!crosshair) return;
  crosshair.animate?.([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: 'translate(-50%,-50%) scale(1.22)' },
    { transform: 'translate(-50%,-50%) scale(1)' }
  ], { duration: 260, easing: 'ease-out' });
  try { navigator.vibrate?.(18); } catch {}
}

function addPoint() {
  ensureOfficialDrawStarted(() => {
    const target = govMapTargetAtCenter();
    if (!target) return;
    dispatchPointerSequence(target, false);
    flashCrosshair();
  });
}

function finishPolygon() {
  ensureOfficialDrawStarted(() => {
    const target = govMapTargetAtCenter();
    if (!target) return;
    dispatchPointerSequence(target, true);
  });
}

function install() {
  if (!onRoofMarking()) return;
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mobile-target-action]');
    if (!button || !govMapWrap()) return;
    const action = button.dataset.mobileTargetAction;
    if (action === 'add') {
      event.preventDefault();
      event.stopImmediatePropagation();
      addPoint();
    } else if (action === 'finish') {
      event.preventDefault();
      event.stopImmediatePropagation();
      finishPolygon();
    }
  }, true);
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
