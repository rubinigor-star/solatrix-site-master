const PHONE = '972547299727';
const LOGO_SRC = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';

const WHATSAPP_ICON = `
  <svg class="waIcon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.45L3.5 20.5l1.45-4.25A8.5 8.5 0 1 1 20.5 11.7Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8.55 8.2c.18-.4.37-.41.69-.42h.58c.19 0 .43.07.55.36l.78 1.88c.1.27.08.47-.08.67l-.65.78c-.2.23-.2.42-.03.72.45.8 1.1 1.5 1.88 2.03.34.23.57.2.78-.05l.83-.98c.21-.26.43-.29.72-.16l1.85.87c.3.14.42.3.42.54 0 .67-.32 1.42-.8 1.85-.53.48-1.28.75-2.05.62-1.2-.2-2.72-.93-4.03-2.1-1.27-1.14-2.15-2.58-2.5-3.84-.22-.8-.08-1.47.3-1.98.24-.33.5-.62.76-.79Z" fill="currentColor"/>
  </svg>`;

const publicNav = [
  ['דף הבית', 'index.html'],
  ['בתים פרטיים', 'private-homes.html'],
  ['מחיר שקוף', 'solar-price.html'],
  ['בדיקת גג', 'roof-check/'],
  ['אגירה', 'storage.html'],
  ['עסקים ומסחר', 'business.html'],
  ['חקלאות', 'agriculture.html'],
  ['שאלות', 'faq.html']
];

function rootBase() {
  const path = window.location.pathname;
  const calcIndex = path.lastIndexOf('/roof-check/');
  if (calcIndex >= 0) return `${window.location.origin}${path.slice(0, calcIndex + 1)}`;
  return new URL('./', window.location.href).href;
}

const ROOT = rootBase();

function pageUrl(path = '') {
  return new URL(path, ROOT).href;
}

function fixCalculatorPath(url) {
  if (typeof url !== 'string') return url;
  if (!window.location.hostname.endsWith('github.io')) return url;
  if (url.startsWith('/roof-check/')) return pageUrl(url.replace(/^\//, ''));
  return url;
}

const originalPushState = window.history.pushState.bind(window.history);
const originalReplaceState = window.history.replaceState.bind(window.history);
window.history.pushState = function pushStateWithRepoRoot(state, title, url) {
  return originalPushState(state, title, fixCalculatorPath(url));
};
window.history.replaceState = function replaceStateWithRepoRoot(state, title, url) {
  return originalReplaceState(state, title, fixCalculatorPath(url));
};

function addHeaderStyles() {
  if (document.getElementById('solatrix-public-calculator-header-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-public-calculator-header-style';
  style.textContent = `
    .siteHeader.calculatorPublicHeader{background:rgba(255,250,241,.94);border-bottom:1px solid rgba(42,33,24,.08);backdrop-filter:blur(20px)}
    .siteHeader.calculatorPublicHeader .headerInner{width:min(1180px,calc(100% - 52px));min-height:84px;display:flex;align-items:center;justify-content:space-between;gap:24px;margin:auto}
    .siteHeader.calculatorPublicHeader .brand{height:auto;text-decoration:none;display:inline-flex;align-items:center}
    .siteHeader.calculatorPublicHeader .logoMark{width:190px;height:74px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    .siteHeader.calculatorPublicHeader .logoImage{width:178px;max-height:70px;object-fit:contain;object-position:center}
    .siteHeader.calculatorPublicHeader .desktopNav{display:flex;align-items:center;justify-content:center;gap:24px;flex:1;font-weight:900;color:#342a20}
    .siteHeader.calculatorPublicHeader .desktopNav a{text-decoration:none;border:0;background:transparent;color:inherit;opacity:.82;white-space:nowrap;padding:8px 0;border-radius:0}
    .siteHeader.calculatorPublicHeader .desktopNav a:hover,.siteHeader.calculatorPublicHeader .desktopNav a.active{opacity:1;color:#111;background:transparent}
    .siteHeader.calculatorPublicHeader .headerActions{display:flex;align-items:center;gap:10px;direction:ltr}
    .siteHeader.calculatorPublicHeader .headerCta{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:#25D366;color:#fff;border-radius:999px;padding:15px 27px;font-weight:950;text-decoration:none;box-shadow:0 16px 34px rgba(37,211,102,.24)}
    .siteHeader.calculatorPublicHeader .waIcon{width:20px;height:20px;display:block;flex:0 0 20px}
    .siteHeader.calculatorPublicHeader .menuBtn{width:44px;height:44px;border-radius:16px;border:1px solid #eadbc7;background:white;color:#071b2f;font-size:21px;font-weight:950;display:none;place-items:center;line-height:1}
    .siteHeader.calculatorPublicHeader .mobileMenu{width:min(1080px,calc(100% - 28px));margin:0 auto;display:grid;grid-template-columns:1fr;gap:8px;max-height:0;overflow:hidden;opacity:0;transform:translateY(-8px);transition:max-height .22s ease,opacity .18s ease,transform .18s ease;padding:0;direction:rtl}
    .siteHeader.calculatorPublicHeader.menuOpen .mobileMenu{max-height:560px;opacity:1;transform:translateY(0);padding:0 0 14px}
    .siteHeader.calculatorPublicHeader .mobileMenu a{width:100%;border:1px solid rgba(234,219,199,.95);background:rgba(255,255,255,.92);border-radius:18px;padding:15px 18px;text-align:center;text-decoration:none;color:#071b2f;font-size:17px;font-weight:950;box-shadow:0 10px 24px rgba(28,20,12,.06)}
    .siteHeader.calculatorPublicHeader .mobileMenu a.whatsappMobile{display:flex;align-items:center;justify-content:center;gap:9px;background:#25D366;color:#fff}

    /* The calculator already contains contextual CTAs; never cover content with a persistent action dock. */
    [data-solatrix-persistent-actions],
    .mobileBottomBar,
    .mobile-bottom-bar,
    .bottomActionBar,
    .bottom-action-bar,
    .stickyActions,
    .sticky-actions,
    .floatingActionBar,
    .floating-action-bar,
    .quickContactBar,
    .quick-contact-bar{display:none !important}

    @media(max-width:980px){.siteHeader.calculatorPublicHeader .headerInner{width:min(100% - 28px,1180px);min-height:72px}.siteHeader.calculatorPublicHeader .desktopNav{display:none}.siteHeader.calculatorPublicHeader .menuBtn{display:grid}.siteHeader.calculatorPublicHeader .logoMark{width:150px;height:58px}.siteHeader.calculatorPublicHeader .logoImage{width:146px;max-height:54px}.siteHeader.calculatorPublicHeader .headerCta{padding:11px 16px}.siteHeader.calculatorPublicHeader .waIcon{width:21px;height:21px;flex-basis:21px}}
  `;
  document.head.appendChild(style);
}

function navLink([label, path]) {
  return `<a class="${path === 'roof-check/' ? 'active' : ''}" href="${pageUrl(path)}">${label}</a>`;
}

function replaceCalculatorHeader() {
  const header = document.querySelector('.siteHeader');
  if (!header || header.dataset.publicCalculatorHeader === 'true') return;
  addHeaderStyles();
  header.dataset.publicCalculatorHeader = 'true';
  header.className = `siteHeader calculatorPublicHeader${header.classList.contains('menuOpen') ? ' menuOpen' : ''}`;
  header.innerHTML = `
    <div class="headerInner">
      <a class="brand" href="${pageUrl('index.html')}" aria-label="Solatrix Energy דף הבית">
        <div class="logoMark"><img class="logoImage" src="${LOGO_SRC}" alt="Solatrix Energy" loading="eager" /></div>
      </a>
      <nav class="desktopNav" aria-label="ניווט ראשי">${publicNav.map(navLink).join('')}</nav>
      <div class="headerActions">
        <a class="headerCta" href="https://wa.me/${PHONE}" target="_blank" rel="noreferrer">${WHATSAPP_ICON}<span>וואטסאפ</span></a>
        <button class="menuBtn" type="button" aria-label="Menu">☰</button>
      </div>
    </div>
    <nav class="mobileMenu" aria-label="ניווט מובייל">
      ${publicNav.map(navLink).join('')}
      <a class="whatsappMobile" href="https://wa.me/${PHONE}" target="_blank" rel="noreferrer">${WHATSAPP_ICON}<span>וואטסאפ</span></a>
    </nav>
  `;
  const menuBtn = header.querySelector('.menuBtn');
  menuBtn?.addEventListener('click', () => {
    header.classList.toggle('menuOpen');
    menuBtn.textContent = header.classList.contains('menuOpen') ? '×' : '☰';
  });
}

function removePersistentActionBars() {
  const candidates = document.querySelectorAll('body *');
  candidates.forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    if (element.closest('.siteHeader')) return;

    const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 100) return;

    const hasRoofCheck = text.includes('בדיקת גג');
    const hasWhatsApp = /whatsapp/i.test(text);
    const hasContact = text.includes('שיחה') || text.includes('צור קשר') || text.includes('התקשר');
    if (!(hasRoofCheck && hasWhatsApp && hasContact)) return;

    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const isDock = styles.position === 'fixed' || styles.position === 'sticky' || rect.bottom >= window.innerHeight - 40;
    if (!isDock) return;

    element.dataset.solatrixPersistentActions = 'true';
    element.remove();
  });
}

function maintainPublicChrome() {
  replaceCalculatorHeader();
  removePersistentActionBars();
}

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(maintainPublicChrome);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    maintainPublicChrome();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  maintainPublicChrome();
  observer.observe(document.body, { childList: true, subtree: true });
}
