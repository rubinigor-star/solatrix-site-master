const CALCULATOR_MASTER_VERSION = 'roof-check-master-v1';
const calculatorPath = 'roof-check/';
const calculatorKeywords = [
  /roof\s*check/i,
  /check\s*roof/i,
  /בדיקת\s*גג/,
  /בדקו\s*את\s*הגג/,
  /בדקו\s*גג/,
  /התחילו\s*בבדיקת\s*הגג/,
  /הגג\s*שלכם/,
  /בדיקה\s*חכמה/,
  /חישוב\s*גג/,
  /קבלו\s*בדיקה/,
  /ראו\s*את\s*הגג/,
  /תראו\s*את\s*הגג/,
  /צפו\s*בגג/,
  /בדקו\s*התאמה/,
  /расч[её]т/i,
  /посмотр/i,
  /провер/i,
  /кры/i
];

const contactKeywords = [
  /צור\s*קשר/,
  /השאירו\s*פרטים/,
  /קבלו\s*הצעה/,
  /השארת\s*פרטים/,
  /консульта/i,
  /заяв/i
];

function isCalculatorPage() {
  return /\/roof-check\/?$/.test(window.location.pathname) || /\/roof-check\//.test(window.location.pathname);
}

function isHomePage() {
  const path = window.location.pathname.replace(/\/index\.html$/, '/');
  return path.endsWith('/roof-check-by-solatrix/') || path === '/' || path.endsWith('/solatrix-site-master/');
}

function siteRootUrl() {
  const path = window.location.pathname;
  const marker = '/roof-check-by-solatrix/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex >= 0) return `${window.location.origin}${path.slice(0, markerIndex + marker.length)}`;
  if (path.includes('/roof-check/')) return new URL('../', window.location.href).href;
  return new URL('./', window.location.href).href;
}

function calculatorUrl() {
  const url = new URL(calculatorPath, siteRootUrl());
  url.searchParams.set('v', CALCULATOR_MASTER_VERSION);
  return url.href;
}

function textMatches(text = '', patterns = calculatorKeywords) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return patterns.some((pattern) => pattern.test(clean));
}

function hrefMatchesCalculator(href = '') {
  return /roof-check(?:\.html|\/)?/i.test(href) || /#.*roof/i.test(href) || /#.*גג/i.test(href);
}

function injectDecisionBlockStyles() {
  if (document.getElementById('solatrix-decision-block-master-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-decision-block-master-style';
  style.textContent = `
    #decision .decision-grid-v2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:26px 0 22px}
    #decision .decision-card-v2{background:#fff;border:1px solid var(--line);border-radius:26px;padding:24px 24px 22px;box-shadow:0 18px 46px rgba(42,33,24,.06)}
    #decision .decision-card-v2 span{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:15px;background:#fff3df;color:#a76200;font-size:22px;font-weight:950;margin-bottom:14px}
    #decision .decision-card-v2 h3{font-size:24px;line-height:1.12;margin:0 0 10px;color:#17120d;letter-spacing:-.018em}
    #decision .decision-card-v2 p{font-size:18px;line-height:1.55;margin:0;color:#5f564c;font-weight:700}
    #decision .decision-bottom-v2{display:grid;gap:16px;margin-top:20px}
    #decision .decision-bottom-v2 .soft-note{font-size:19px;line-height:1.55}
    #decision .decision-cta-v2{display:inline-flex;align-items:center;justify-content:center;width:max-content;max-width:100%;border-radius:999px;padding:15px 26px;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#16100a;font-weight:950;text-decoration:none;box-shadow:0 16px 34px rgba(245,161,26,.22)}
    @media(max-width:900px){#decision .decision-grid-v2{grid-template-columns:1fr}#decision .decision-card-v2{padding:22px}#decision .decision-cta-v2{width:100%}}
  `;
  document.head.appendChild(style);
}

function replaceDecisionBlock() {
  if (!isHomePage()) return;
  const section = document.getElementById('decision');
  if (!section || section.dataset.solatrixDecisionMaster === 'true') return;
  section.dataset.solatrixDecisionMaster = 'true';
  injectDecisionBlockStyles();
  section.innerHTML = `
    <div class="container statement-grid">
      <div class="sticky-title">
        <div class="kicker dark">הסיבה האמיתית לגגות הריקים</div>
        <h2>למה אנשים עדיין לא שמים מערכת סולארית, גם כשהמספרים נראים טוב?</h2>
      </div>
      <div class="statement-card">
        <p>ברוב המקרים זה לא בגלל שהשמש לא מספיקה. זה בגלל שאין תשובות ברורות לשאלות שבאמת קובעות אם כדאי להתקדם.</p>
        <div class="decision-grid-v2">
          <div class="decision-card-v2"><span>01</span><h3>כמה הגג שלי באמת יכול לייצר?</h3><p>לא לפי ניחוש כללי — אלא לפי סימון גג, שטח, כיוון ומבנה.</p></div>
          <div class="decision-card-v2"><span>02</span><h3>מה המחיר האמיתי של מערכת כזו?</h3><p>החישוב מחובר למחיר בסיס שקוף: ₪2,900 לקילוואט לפני מע״מ.</p></div>
          <div class="decision-card-v2"><span>03</span><h3>תוך כמה זמן ההשקעה חוזרת?</h3><p>המערכת מחשבת חיסכון, מכירה לרשת, מע״מ והחזר השקעה.</p></div>
          <div class="decision-card-v2"><span>04</span><h3>איך מקבלים דוח מסודר?</h3><p>בסוף הבדיקה נפתח דוח Master בן 3 עמודים עם בסיס החישוב.</p></div>
        </div>
        <div class="decision-bottom-v2">
          <div class="soft-note">בדיוק בשביל זה בנינו את Solatrix Roof Check Master: קודם לראות את התמונה, אחר כך לקבל החלטה.</div>
          <a class="decision-cta-v2" href="${calculatorUrl()}" data-solatrix-master-roof-check="true">בדקו את הגג שלכם</a>
        </div>
      </div>
    </div>
  `;
}

function removeRedundantHomepageSections() {
  if (!isHomePage()) return;

  document.getElementById('decision')?.remove();

  const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
  const targets = [
    'הבעיה היא לא המערכת',
    'כל גג נראה אחרת'
  ];

  targets.forEach((target) => {
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5')]
      .filter((heading) => normalize(heading.textContent).includes(target));

    headings.forEach((heading) => {
      const section = heading.closest('section');
      if (section) {
        section.remove();
        return;
      }

      let block = heading.parentElement;
      while (block?.parentElement && block.parentElement !== document.body && block.parentElement.tagName !== 'MAIN') {
        if (block.getBoundingClientRect().height >= 320 && block.parentElement.children.length > 1) break;
        block = block.parentElement;
      }
      block?.remove();
    });
  });
}

function connectRoofCheckLinks() {
  if (isCalculatorPage()) return;

  const target = calculatorUrl();

  document.querySelectorAll('a').forEach((link) => {
    const label = link.textContent || '';
    const href = link.getAttribute('href') || '';
    if (textMatches(label) || hrefMatchesCalculator(href)) {
      link.setAttribute('href', target);
      link.setAttribute('data-solatrix-linked-calculator', CALCULATOR_MASTER_VERSION);
    } else if (textMatches(label, contactKeywords) && !/wa\.me|whatsapp/i.test(href)) {
      link.setAttribute('href', '#lead-form');
      link.setAttribute('data-solatrix-open-lead-form', 'true');
    }
  });

  document.querySelectorAll('button, [role="button"]').forEach((button) => {
    const label = button.textContent || '';
    if (textMatches(label)) {
      button.setAttribute('data-solatrix-linked-calculator', CALCULATOR_MASTER_VERSION);
      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = target;
      });
    } else if (textMatches(label, contactKeywords)) {
      button.setAttribute('data-solatrix-open-lead-form', 'true');
    }
  });
}

function mountHeroRoofPhoto() {
  if (!isHomePage()) return;
  const map = document.querySelector('.hero-preview-map');
  if (!map || map.querySelector('.hero-real-photo')) return;

  const photo = document.createElement('img');
  photo.className = 'hero-real-photo';
  photo.alt = 'בית עם מערכת סולארית על הגג';
  photo.decoding = 'async';
  photo.loading = 'eager';
  photo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;filter:saturate(.9) contrast(1.04) brightness(.78);';

  const sources = [
    'https://raw.githubusercontent.com/rubinigor-star/solatrix-site-master/main/assets/solatrix-approved-hero-image.jpg',
    'https://raw.githubusercontent.com/rubinigor-star/solatrix-site-master/main/assets/solatrix-hero-real-home-v33.jpg',
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=85'
  ];
  let sourceIndex = 0;
  photo.onerror = () => {
    sourceIndex += 1;
    if (sourceIndex < sources.length) photo.src = sources[sourceIndex];
  };
  photo.src = sources[sourceIndex];

  map.prepend(photo);
}

function removePersistentContactDock() {
  const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
  const elements = [...document.querySelectorAll('body *')];

  elements.forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    if (element.closest('header, nav')) return;

    const text = normalize(element.innerText || '');
    if (!text || text.length > 120) return;

    const hasRoof = /בדיקת גג/.test(text);
    const hasWhatsApp = /whatsapp/i.test(text);
    const hasCall = /שיחה|התקשר|צור קשר/.test(text);
    if (!(hasRoof && hasWhatsApp && hasCall)) return;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const likelyDock =
      style.position === 'fixed' ||
      style.position === 'sticky' ||
      rect.width >= Math.min(window.innerWidth * 0.72, 420) ||
      element.querySelectorAll('a,button,[role="button"]').length >= 3;

    if (!likelyDock) return;

    element.setAttribute('data-solatrix-removed-contact-dock', 'true');
    element.remove();
  });
}

function initSolatrixSiteLinks() {
  removePersistentContactDock();
  removeRedundantHomepageSections();
  connectRoofCheckLinks();
  mountHeroRoofPhoto();
}

let maintenanceQueued = false;
const maintenanceObserver = new MutationObserver(() => {
  if (maintenanceQueued) return;
  maintenanceQueued = true;
  window.requestAnimationFrame(() => {
    maintenanceQueued = false;
    removePersistentContactDock();
    connectRoofCheckLinks();
  });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSolatrixSiteLinks();
    maintenanceObserver.observe(document.body, { childList: true, subtree: true });
  });
} else {
  initSolatrixSiteLinks();
  maintenanceObserver.observe(document.body, { childList: true, subtree: true });
}
