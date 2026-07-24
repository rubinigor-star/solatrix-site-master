import helpImageBase64 from './assets/roof-marking-help.webp.b64?raw';

const FLAG = '__solatrixRoofMarkingHelpInstalledV1';
const STYLE_ID = 'solatrix-roof-marking-help-style';
const SEEN_KEY = 'solatrix_roof_marking_help_seen_v1';

function isRoofMarkingPage() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .roofHelpTrigger{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(28,111,212,.26);background:#fff;color:#1c6fd4;border-radius:999px;padding:10px 15px;font:800 15px Assistant,sans-serif;box-shadow:0 8px 20px rgba(18,55,90,.08);cursor:pointer}
    .roofHelpTrigger span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;border:2px solid currentColor;font-size:14px;line-height:1}
    .roofHelpTriggerWrap{display:flex;justify-content:center;margin:10px 0 14px;position:relative;z-index:8}
    .roofHelpBackdrop{position:fixed;inset:0;z-index:100000;background:rgba(5,18,34,.68);backdrop-filter:blur(5px);display:grid;place-items:center;padding:18px}
    .roofHelpBackdrop[hidden]{display:none!important}
    .roofHelpDialog{width:min(560px,100%);max-height:min(92vh,900px);overflow:auto;border-radius:28px;background:#fff;box-shadow:0 30px 90px rgba(0,0,0,.35);padding:18px;direction:rtl;font-family:Assistant,sans-serif}
    .roofHelpHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .roofHelpHeader h3{margin:0;color:#09243f;font-size:25px;line-height:1.15}
    .roofHelpClose{width:42px;height:42px;border:0;border-radius:50%;background:#f2f5f8;color:#17334f;font-size:26px;cursor:pointer}
    .roofHelpImage{display:block;width:100%;height:auto;border-radius:20px;border:1px solid rgba(10,39,70,.1);background:#f7f9fb}
    .roofHelpSteps{display:grid;gap:10px;margin:16px 0 14px;padding:0;list-style:none}
    .roofHelpSteps li{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center;text-align:right;color:#17334f;font-size:16px;font-weight:700;line-height:1.35}
    .roofHelpSteps b{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#eaf3ff;color:#1670dc;font-size:16px}
    .roofHelpConfirm{width:100%;min-height:54px;border:0;border-radius:18px;background:linear-gradient(135deg,#f5a11a,#ffbd55);color:#17100a;font:900 19px Assistant,sans-serif;cursor:pointer;box-shadow:0 14px 30px rgba(245,161,26,.28)}
    body.roofHelpOpen{overflow:hidden}
    @media(max-width:760px){
      .roofHelpTriggerWrap{margin:8px 0 10px}
      .roofHelpTrigger{padding:8px 13px;font-size:14px}
      .roofHelpBackdrop{padding:10px;align-items:end}
      .roofHelpDialog{width:100%;max-height:94vh;border-radius:26px 26px 18px 18px;padding:14px}
      .roofHelpHeader h3{font-size:22px}
      .roofHelpSteps li{font-size:15px}
    }
  `;
  document.head.appendChild(style);
}

function imageSrc() {
  return `data:image/webp;base64,${helpImageBase64.trim()}`;
}

function ensureModal() {
  let backdrop = document.querySelector('.roofHelpBackdrop');
  if (backdrop) return backdrop;

  backdrop = document.createElement('div');
  backdrop.className = 'roofHelpBackdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="roofHelpDialog" role="dialog" aria-modal="true" aria-labelledby="roofHelpTitle">
      <div class="roofHelpHeader">
        <h3 id="roofHelpTitle">איך מסמנים את הגג?</h3>
        <button class="roofHelpClose" type="button" aria-label="סגירה">×</button>
      </div>
      <img class="roofHelpImage" src="${imageSrc()}" alt="הדגמה של סימון פינות הגג בעזרת הכוונת" />
      <ol class="roofHelpSteps">
        <li><b>1</b><span>הזיזו את המפה עד שפינת הגג נמצאת בדיוק מתחת לכוונת.</span></li>
        <li><b>2</b><span>לחצו על <strong>הוסף נקודה</strong> והמשיכו לפינה הבאה.</span></li>
        <li><b>3</b><span>סמנו לפחות שלוש פינות, ואז לחצו על <strong>סיים סימון</strong>.</span></li>
      </ol>
      <button class="roofHelpConfirm" type="button">הבנתי, אפשר להתחיל</button>
    </section>`;
  document.body.appendChild(backdrop);

  const close = () => {
    backdrop.hidden = true;
    document.body.classList.remove('roofHelpOpen');
    try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
  };
  backdrop.querySelector('.roofHelpClose')?.addEventListener('click', close);
  backdrop.querySelector('.roofHelpConfirm')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !backdrop.hidden) close(); });
  return backdrop;
}

function openHelp() {
  const backdrop = ensureModal();
  backdrop.hidden = false;
  document.body.classList.add('roofHelpOpen');
  setTimeout(() => backdrop.querySelector('.roofHelpClose')?.focus(), 0);
}

function ensureTrigger() {
  const mapPanel = document.querySelector('.mapPanel.interactiveMap');
  if (!mapPanel || document.querySelector('.roofHelpTriggerWrap')) return false;

  const wrap = document.createElement('div');
  wrap.className = 'roofHelpTriggerWrap';
  wrap.innerHTML = '<button class="roofHelpTrigger" type="button"><span>i</span>איך מסמנים את הגג?</button>';
  mapPanel.parentElement?.insertBefore(wrap, mapPanel);
  wrap.querySelector('button')?.addEventListener('click', openHelp);
  return true;
}

function shouldAutoOpen() {
  try { return localStorage.getItem(SEEN_KEY) !== '1'; } catch { return true; }
}

let autoOpened = false;
function tick() {
  if (!isRoofMarkingPage()) {
    autoOpened = false;
    document.querySelector('.roofHelpTriggerWrap')?.remove();
    return;
  }
  injectStyles();
  ensureTrigger();
  ensureModal();
  if (!autoOpened && shouldAutoOpen() && document.querySelector('.solatrixGovMapWrap')) {
    autoOpened = true;
    setTimeout(openHelp, 650);
  }
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('pageshow', tick);
  window.addEventListener('popstate', () => setTimeout(tick, 50));
  setInterval(tick, 500);
}
