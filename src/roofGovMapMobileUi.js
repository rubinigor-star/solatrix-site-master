const FLAG = '__solatrixGovMapMobileUiV1';
const STYLE_ID = 'solatrix-govmap-mobile-ui-style';

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
    .solatrixGovMapCrosshair{display:none}
    .solatrixGovMapMobileActions{display:none}

    @media(max-width:820px){
      .solatrixGovMapToolbar{display:none!important}
      .mapScreen .markStatus{display:none!important}
      .mapScreen .drawFooter .compactActions{display:none!important}
      .solatrixGovMapWrap{padding-bottom:0!important}

      .solatrixGovMapCrosshair{
        display:block;
        position:absolute;
        z-index:25;
        left:50%;
        top:50%;
        width:86px;
        height:86px;
        transform:translate(-50%,-50%);
        pointer-events:none;
        filter:drop-shadow(0 3px 5px rgba(0,0,0,.28));
      }
      .solatrixGovMapCrosshair::before,
      .solatrixGovMapCrosshair::after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        background:#1670dc;
        border:2px solid #fff;
        border-radius:4px;
        transform:translate(-50%,-50%);
      }
      .solatrixGovMapCrosshair::before{width:86px;height:6px}
      .solatrixGovMapCrosshair::after{width:6px;height:86px}
      .solatrixGovMapCrosshairRing{
        position:absolute;
        left:50%;
        top:50%;
        width:42px;
        height:42px;
        transform:translate(-50%,-50%);
        border:5px solid #1670dc;
        outline:3px solid #fff;
        border-radius:50%;
        background:rgba(255,255,255,.28);
      }
      .solatrixGovMapCrosshairDot{
        position:absolute;
        left:50%;
        top:50%;
        width:10px;
        height:10px;
        transform:translate(-50%,-50%);
        border-radius:50%;
        background:#1670dc;
        border:3px solid #fff;
        box-sizing:content-box;
      }

      .solatrixGovMapMobileActions{
        display:grid;
        position:sticky;
        z-index:80;
        bottom:max(10px,env(safe-area-inset-bottom));
        grid-template-columns:1fr auto;
        gap:10px;
        width:calc(100% - 20px);
        margin:12px auto 0;
        padding:10px;
        border-radius:24px;
        background:rgba(255,255,255,.97);
        box-shadow:0 16px 42px rgba(8,29,52,.24);
        backdrop-filter:blur(12px);
        direction:rtl;
      }
      .solatrixGovMapMobileActions button{
        min-height:58px;
        border-radius:18px;
        border:0;
        font:900 18px Assistant,sans-serif;
        cursor:pointer;
      }
      .solatrixGovMapMobileActions .primary{
        background:linear-gradient(135deg,#f5a11a,#ffbd55);
        color:#17100a;
        padding:0 22px;
      }
      .solatrixGovMapMobileActions .clear{
        background:#fff;
        color:#a52020;
        border:1px solid rgba(165,32,32,.2);
        padding:0 16px;
      }
      .solatrixGovMapMobileHint{
        position:absolute;
        z-index:24;
        left:12px;
        right:12px;
        bottom:12px;
        padding:10px 14px;
        border-radius:16px;
        background:rgba(255,255,255,.93);
        color:#17334f;
        font:800 14px Assistant,sans-serif;
        text-align:center;
        pointer-events:none;
        box-shadow:0 10px 24px rgba(0,0,0,.15);
      }
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

function ensureHint(wrap) {
  if (wrap.querySelector('.solatrixGovMapMobileHint')) return;
  const hint = document.createElement('div');
  hint.className = 'solatrixGovMapMobileHint';
  hint.textContent = 'הזיזו את המפה כך שפינת הגג תהיה מתחת לכוונת, ואז התחילו לסמן.';
  wrap.appendChild(hint);
}

function ensureActions(panel) {
  let actions = panel.parentElement?.querySelector('.solatrixGovMapMobileActions');
  if (actions) return;

  const draw = panel.querySelector('[data-govmap-official="draw"]');
  const clear = panel.querySelector('[data-govmap-official="clear"]');
  if (!draw || !clear) return;

  actions = document.createElement('div');
  actions.className = 'solatrixGovMapMobileActions';
  actions.innerHTML = `
    <button type="button" class="primary">התחילו סימון</button>
    <button type="button" class="clear">נקה הכל</button>`;
  panel.insertAdjacentElement('afterend', actions);
  actions.querySelector('.primary')?.addEventListener('click', () => draw.click());
  actions.querySelector('.clear')?.addEventListener('click', () => clear.click());
}

function tick() {
  if (!isRoofMarkingPage() || !isMobile()) return;
  injectStyles();
  const panel = document.querySelector('.mapPanel.interactiveMap[data-govmap-installed="true"]');
  const wrap = panel?.querySelector('.solatrixGovMapWrap');
  if (!panel || !wrap) return;
  ensureCrosshair(wrap);
  ensureHint(wrap);
  ensureActions(panel);
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
