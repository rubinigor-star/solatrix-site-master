const FLAG = '__solatrixGovMapMobileUiV3';
const STYLE_ID = 'solatrix-govmap-mobile-ui-style-v3';

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
      .solatrixGovMapSurfaceList{display:none!important}
      .solatrixGovMapWrap{height:calc(100dvh - 300px)!important;min-height:410px!important;max-height:620px!important;border-radius:24px!important}
      .solatrixGovMapCrosshair{display:block;position:absolute;z-index:60;left:50%;top:50%;width:88px;height:88px;transform:translate(-50%,-50%);pointer-events:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.34))}
      .solatrixGovMapCrosshair:before,.solatrixGovMapCrosshair:after{content:"";position:absolute;left:50%;top:50%;background:#126eeb;border:2px solid #fff;border-radius:5px;transform:translate(-50%,-50%)}
      .solatrixGovMapCrosshair:before{width:88px;height:5px}.solatrixGovMapCrosshair:after{width:5px;height:88px}
      .solatrixGovMapCrosshairRing{position:absolute;left:50%;top:50%;width:40px;height:40px;transform:translate(-50%,-50%);border:5px solid #126eeb;outline:3px solid #fff;border-radius:50%;background:rgba(255,255,255,.22)}
      .solatrixGovMapCrosshairDot{position:absolute;left:50%;top:50%;width:11px;height:11px;transform:translate(-50%,-50%);border-radius:50%;background:#126eeb;border:3px solid #fff;box-sizing:content-box}
      .solatrixGovMapMobileCounter{display:flex;position:absolute;z-index:61;left:12px;top:12px;align-items:center;gap:7px;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.96);color:#126eeb;font:900 14px Assistant,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.16);pointer-events:none}
      .solatrixGovMapHint{right:10px!important;left:10px!important;bottom:10px!important;padding:9px 12px!important;font-size:14px!important;max-width:none!important}
      .solatrixGovMapMobileActions{display:grid;position:sticky;z-index:120;bottom:max(8px,env(safe-area-inset-bottom));grid-template-columns:1fr 1fr;gap:9px;width:calc(100% - 16px);margin:10px auto 0;padding:9px;border-radius:22px;background:rgba(255,255,255,.98);box-shadow:0 16px 42px rgba(8,29,52,.24);backdrop-filter:blur(12px);direction:rtl}
      .solatrixGovMapMobileActions button{min-height:54px;border-radius:17px;border:0;font:900 16px Assistant,sans-serif;cursor:pointer}
      .solatrixGovMapMobileActions .add{grid-column:1/-1;background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a;font-size:19px;padding:0 22px}
      .solatrixGovMapMobileActions .undo{background:#fff;color:#17334f;border:1px solid rgba(23,51,79,.16)}
      .solatrixGovMapMobileActions .clear{background:#fff;color:#a52020;border:1px solid rgba(165,32,32,.18)}
      .solatrixGovMapMobileActions .finish{grid-column:1/-1;background:#092b4c;color:#fff;font-size:18px}
      .solatrixGovMapMobileActions .finish[disabled],.solatrixGovMapMobileActions .undo[disabled]{opacity:.38;cursor:not-allowed}
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
  const count = Number(window.__solatrixGovMapManual?.getCount?.() || 0);
  counter.textContent = `${count} נקודות`;
}

function setHint(text, success = false) {
  const hint = document.querySelector('.solatrixGovMapHint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.toggle('success', success);
}

function updateActions(actions, wrap) {
  const count = Number(window.__solatrixGovMapManual?.getCount?.() || 0);
  actions.querySelector('.undo')?.toggleAttribute('disabled', count === 0);
  actions.querySelector('.finish')?.toggleAttribute('disabled', count < 3);
  ensureCounter(wrap);
}

function addPoint(actions, wrap) {
  const api = window.__solatrixGovMapManual;
  if (!api?.addCenterPoint) {
    setHint('המפה עדיין נטענת. נסו שוב בעוד רגע.');
    return;
  }
  const result = api.addCenterPoint();
  if (!result?.ok) {
    setHint('לא הצלחנו לקרוא את מרכז המפה. הזיזו מעט את המפה ונסו שוב.');
    return;
  }
  updateActions(actions, wrap);
  setHint(result.count >= 3 ? 'הנקודה נוספה. אפשר להוסיף עוד נקודות או לסיים את הסימון.' : 'הנקודה נוספה. הזיזו את המפה לפינה הבאה ולחצו שוב.');
}

function undoPoint(actions, wrap) {
  window.__solatrixGovMapManual?.undoCenterPoint?.();
  updateActions(actions, wrap);
  setHint('הנקודה האחרונה בוטלה.');
}

function clearAll(actions, wrap) {
  window.__solatrixGovMapManual?.clear?.();
  updateActions(actions, wrap);
  setHint('הסימון נוקה. הזיזו את המפה והציבו את הכוונת על פינת הגג.');
}

function finish(actions, wrap) {
  const result = window.__solatrixGovMapManual?.finish?.();
  if (!result?.ok) {
    setHint('צריך לסמן לפחות שלוש פינות של הגג.');
    updateActions(actions, wrap);
    return;
  }
  updateActions(actions, wrap);
  setHint('הגג סומן ונשמר. אפשר להמשיך.', true);
  const next = document.querySelector('.nextTextBtn[data-action="next"]');
  next?.removeAttribute('disabled');
  next?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function ensureActions(panel, wrap) {
  let actions = panel.parentElement?.querySelector('.solatrixGovMapMobileActions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'solatrixGovMapMobileActions';
    actions.innerHTML = `
      <button type="button" class="add">＋ הוסף נקודה</button>
      <button type="button" class="undo" disabled>בטל נקודה אחרונה</button>
      <button type="button" class="clear">נקה הכל</button>
      <button type="button" class="finish" disabled>סיים סימון</button>`;
    panel.insertAdjacentElement('afterend', actions);
    actions.querySelector('.add')?.addEventListener('click', () => addPoint(actions, wrap));
    actions.querySelector('.undo')?.addEventListener('click', () => undoPoint(actions, wrap));
    actions.querySelector('.clear')?.addEventListener('click', () => clearAll(actions, wrap));
    actions.querySelector('.finish')?.addEventListener('click', () => finish(actions, wrap));
  }
  updateActions(actions, wrap);
}

function removeLegacyControls(panel) {
  panel.querySelectorAll('[data-govmap-official="draw"],[data-govmap-official="clear"]').forEach((node) => node.setAttribute('aria-hidden', 'true'));
}

function tick() {
  if (!isRoofMarkingPage() || !isMobile()) return;
  injectStyles();
  const panel = document.querySelector('.mapPanel.interactiveMap[data-govmap-installed="true"]');
  const wrap = panel?.querySelector('.solatrixGovMapWrap');
  if (!panel || !wrap) return;
  removeLegacyControls(panel);
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
  window.addEventListener('solatrix:govmap-center-changed', tick);
  window.addEventListener('solatrix:roof-geometry-changed', tick);
  setInterval(tick, 400);
}
