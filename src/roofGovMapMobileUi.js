const FLAG = '__solatrixGovMapMobileUiV2';
const STYLE_ID = 'solatrix-govmap-mobile-ui-style-v2';

let drawingStarted = false;
let pointCount = 0;
let lastActionAt = 0;

function isRoofMarkingPage() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function isMobile() {
  return window.matchMedia('(max-width: 820px)').matches;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .solatrixGovMapCrosshair,.solatrixGovMapMobileActions,.solatrixGovMapMobileCounter{display:none}
    @media(max-width:820px){
      .solatrixGovMapToolbar{display:none!important}
      .mapScreen .markStatus{display:none!important}
      .mapScreen .drawFooter{display:none!important}
      .solatrixGovMapWrap{height:calc(100dvh - 245px)!important;min-height:430px!important;max-height:650px!important;border-radius:24px!important}
      .solatrixGovMapCrosshair{display:block;position:absolute;z-index:40;left:50%;top:50%;width:82px;height:82px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 3px 5px rgba(0,0,0,.3))}
      .solatrixGovMapCrosshair:before,.solatrixGovMapCrosshair:after{content:"";position:absolute;left:50%;top:50%;background:#126eeb;border:2px solid #fff;border-radius:5px;transform:translate(-50%,-50%)}
      .solatrixGovMapCrosshair:before{width:82px;height:5px}.solatrixGovMapCrosshair:after{width:5px;height:82px}
      .solatrixGovMapCrosshairRing{position:absolute;left:50%;top:50%;width:38px;height:38px;transform:translate(-50%,-50%);border:5px solid #126eeb;outline:3px solid #fff;border-radius:50%;background:rgba(255,255,255,.2)}
      .solatrixGovMapCrosshairDot{position:absolute;left:50%;top:50%;width:11px;height:11px;transform:translate(-50%,-50%);border-radius:50%;background:#126eeb;border:3px solid #fff;box-sizing:content-box}
      .solatrixGovMapMobileCounter{display:flex;position:absolute;z-index:41;left:12px;top:12px;align-items:center;gap:7px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.96);color:#126eeb;font:900 14px Assistant,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.16);pointer-events:none}
      .solatrixGovMapMobileActions{display:grid;position:sticky;z-index:100;bottom:max(8px,env(safe-area-inset-bottom));grid-template-columns:1fr auto;gap:10px;width:calc(100% - 16px);margin:10px auto 0;padding:9px;border-radius:22px;background:rgba(255,255,255,.98);box-shadow:0 16px 42px rgba(8,29,52,.24);backdrop-filter:blur(12px);direction:rtl}
      .solatrixGovMapMobileActions button{min-height:58px;border-radius:17px;border:0;font:900 18px Assistant,sans-serif;cursor:pointer}
      .solatrixGovMapMobileActions .add{background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a;padding:0 22px}
      .solatrixGovMapMobileActions .clear{background:#fff;color:#a52020;border:1px solid rgba(165,32,32,.2);padding:0 15px;font-size:15px}
      .solatrixGovMapHint{right:10px!important;left:10px!important;bottom:10px!important;padding:9px 12px!important;font-size:14px!important;max-width:none!important}
    }
  `;
  document.head.appendChild(style);
}

function ensureCrosshair(wrap) {
  if (wrap.querySelector('.solatrixGovMapCrosshair')) return;
  const crosshair = document.createElement('div');
  crosshair.className = 'solatrixGovMapCrosshair';
  crosshair.setAttribute('aria-hidden', 'true');
  crosshair.innerHTML = '<span class="solatrixGovMapCrosshairRing"></span><span class="solatrixGovMapCrosshairDot"></span>';
  wrap.appendChild(crosshair);
}

function ensureCounter(wrap) {
  let counter = wrap.querySelector('.solatrixGovMapMobileCounter');
  if (!counter) {
    counter = document.createElement('div');
    counter.className = 'solatrixGovMapMobileCounter';
    wrap.appendChild(counter);
  }
  counter.textContent = `${pointCount} נקודות`;
}

function centerTarget(wrap) {
  const rect = wrap.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const candidates = document.elementsFromPoint(x, y).filter((node) => node !== wrap.querySelector('.solatrixGovMapCrosshair') && !node.closest?.('.solatrixGovMapMobileActions'));
  return { x, y, target: candidates.find((node) => node.closest?.('#solatrix-official-govmap')) || candidates[0] || wrap };
}

function dispatchMapPoint(wrap, finish = false) {
  const { x, y, target } = centerTarget(wrap);
  const common = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 1, pointerId: 1, pointerType: 'touch', isPrimary: true };
  try { target.dispatchEvent(new PointerEvent('pointerdown', common)); } catch {}
  try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch {}
  try { target.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 })); } catch {}
  try { target.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 })); } catch {}
  try { target.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 })); } catch {}
  if (finish) {
    try { target.dispatchEvent(new MouseEvent('dblclick', { ...common, buttons: 0, detail: 2 })); } catch {}
  }
}

function setHint(text) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (hint) hint.textContent = text;
}

function addPoint(panel, wrap) {
  const now = Date.now();
  if (now - lastActionAt < 350) return;
  lastActionAt = now;

  const draw = panel.querySelector('[data-govmap-official="draw"]');
  if (!draw) return;

  if (!drawingStarted) {
    drawingStarted = true;
    draw.click();
    setTimeout(() => {
      dispatchMapPoint(wrap, false);
      pointCount += 1;
      ensureCounter(wrap);
      setHint('הנקודה נוספה. הזיזו את המפה לפינה הבאה ולחצו שוב.');
    }, 650);
    return;
  }

  dispatchMapPoint(wrap, false);
  pointCount += 1;
  ensureCounter(wrap);
  setHint(pointCount >= 3 ? 'אפשר להמשיך לסמן, או ללחוץ פעמיים על הנקודה האחרונה לסיום.' : 'הנקודה נוספה. הזיזו את המפה לפינה הבאה.');
}

function clearAll(panel, wrap) {
  const clear = panel.querySelector('[data-govmap-official="clear"]');
  clear?.click();
  drawingStarted = false;
  pointCount = 0;
  ensureCounter(wrap);
  setHint('הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת, ואז לחצו על הוסף נקודה.');
}

function ensureActions(panel, wrap) {
  let actions = panel.parentElement?.querySelector('.solatrixGovMapMobileActions');
  if (actions) return;
  actions = document.createElement('div');
  actions.className = 'solatrixGovMapMobileActions';
  actions.innerHTML = '<button type="button" class="add">＋ הוסף נקודה</button><button type="button" class="clear">נקה</button>';
  panel.insertAdjacentElement('afterend', actions);
  actions.querySelector('.add')?.addEventListener('click', () => addPoint(panel, wrap));
  actions.querySelector('.clear')?.addEventListener('click', () => clearAll(panel, wrap));
}

function tick() {
  if (!isRoofMarkingPage() || !isMobile()) return;
  injectStyles();
  const panel = document.querySelector('.mapPanel.interactiveMap[data-govmap-installed="true"]');
  const wrap = panel?.querySelector('.solatrixGovMapWrap');
  if (!panel || !wrap) return;
  ensureCrosshair(wrap);
  ensureCounter(wrap);
  ensureActions(panel, wrap);
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('pageshow', tick);
  window.addEventListener('popstate', () => setTimeout(tick, 50));
  window.addEventListener('resize', tick);
  setInterval(tick, 400);
}
