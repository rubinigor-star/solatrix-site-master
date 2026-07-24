const FLAG = '__solatrixGovMapMobileReadyPatchV2';
const MAP_ID = 'solatrix-official-govmap';
const SELECTION_KEY = 'solatrix_govmap_address_selection_v1';

let mobileDrawStarted = false;
let mobilePointCount = 0;

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

function mapTargetsAtCrosshair() {
  const wrap = document.querySelector('.solatrixGovMapWrap');
  const map = document.getElementById(MAP_ID);
  if (!wrap || !map) return null;

  const rect = wrap.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const direct = document.elementFromPoint(clientX, clientY);
  const targets = [];
  const add = (target) => {
    if (!target || targets.includes(target)) return;
    if (target === map || map.contains(target)) targets.push(target);
  };

  add(direct);
  let parent = direct?.parentElement;
  while (parent && parent !== document.body) {
    add(parent);
    if (parent === map) break;
    parent = parent.parentElement;
  }
  add(map.querySelector('canvas'));
  add(map.querySelector('[role="application"]'));
  add(map.querySelector('.esri-view-surface'));
  add(map.querySelector('.esri-view-root'));
  add(map.querySelector('iframe'));
  add(map);

  return { targets, clientX, clientY };
}

function firePointerSequence(target, clientX, clientY, detail = 1) {
  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    detail,
    view: window
  };

  try {
    if (window.PointerEvent) {
      target.dispatchEvent(new PointerEvent('pointerdown', {
        ...common,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 1,
        pressure: 0.5
      }));
    }
  } catch {}

  try { target.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0, buttons: 1 })); } catch {}
  try { target.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0, buttons: 0 })); } catch {}

  try {
    if (window.PointerEvent) {
      target.dispatchEvent(new PointerEvent('pointerup', {
        ...common,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 0,
        pressure: 0
      }));
    }
  } catch {}

  try { target.dispatchEvent(new MouseEvent('click', { ...common, button: 0, buttons: 0 })); } catch {}
}

function dispatchCrosshairPoint(double = false) {
  const hit = mapTargetsAtCrosshair();
  if (!hit) return false;

  hit.targets.forEach((target) => firePointerSequence(target, hit.clientX, hit.clientY, 1));
  if (double) {
    window.setTimeout(() => {
      hit.targets.forEach((target) => {
        firePointerSequence(target, hit.clientX, hit.clientY, 2);
        try {
          target.dispatchEvent(new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clientX: hit.clientX,
            clientY: hit.clientY,
            detail: 2,
            button: 0,
            view: window
          }));
        } catch {}
      });
    }, 110);
  }
  return true;
}

function pulseCrosshair() {
  const crosshair = document.querySelector('.solatrixGovMapCrosshair');
  if (!crosshair) return;
  crosshair.animate?.([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: 'translate(-50%,-50%) scale(1.16)' },
    { transform: 'translate(-50%,-50%) scale(1)' }
  ], { duration: 240, easing: 'ease-out' });
}

function startMobileDraw() {
  if (mobileDrawStarted) return;
  mobileDrawStarted = true;
  document.querySelector('[data-govmap-official="draw"]')?.click();
}

function handleMobileDrawingButton(event) {
  if (!isMobileRoofPage()) return;
  const button = event.target?.closest?.('button');
  if (!button) return;
  const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();

  if (text.includes('הוסף נקודה')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const wasStarted = mobileDrawStarted;
    startMobileDraw();
    const delay = wasStarted ? 180 : 700;
    window.setTimeout(() => {
      if (dispatchCrosshairPoint(false)) {
        mobilePointCount += 1;
        pulseCrosshair();
        try { navigator.vibrate?.(20); } catch {}
        const hint = document.querySelector('.solatrixGovMapHint');
        if (hint) hint.textContent = `נוספה נקודה ${mobilePointCount}. הזיזו את המפה לפינה הבאה.`;
      }
    }, delay);
    return;
  }

  if (text.includes('נקה סימון')) {
    mobileDrawStarted = false;
    mobilePointCount = 0;
    return;
  }

  if (text.includes('סיים שטח') && mobileDrawStarted && mobilePointCount >= 3) {
    event.preventDefault();
    event.stopImmediatePropagation();
    dispatchCrosshairPoint(true);
  }
}

function install() {
  if (!isMobileRoofPage()) return;
  const wrap = document.querySelector('.solatrixGovMapWrap');
  const map = document.getElementById(MAP_ID);
  if (!wrap || !map) return;

  // Keep the proven mobile map-loading path untouched. This patch only retries
  // the background/address focus and translates the mobile button into a real
  // pointer sequence at the crosshair.
  window.setTimeout(revealMap, 1800);
  window.setTimeout(refocus, 2000);
  window.setTimeout(refocus, 3200);
  window.setTimeout(revealMap, 4000);
}

if (!window[FLAG]) {
  window[FLAG] = true;
  document.addEventListener('click', handleMobileDrawingButton, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  window.addEventListener('popstate', () => window.setTimeout(install, 120));
  setInterval(install, 700);
}
