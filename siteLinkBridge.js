const calculatorPath = 'roof-check/';
const calculatorKeywords = [
  /roof\s*check/i,
  /check\s*roof/i,
  /בדיקת\s*גג/,
  /בדקו\s*את\s*הגג/,
  /בדקו\s*גג/,
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

const indexSectionRemovalRules = [
  {
    name: 'uncertainty-block',
    markers: ['חוסר הוודאות', 'הבעיה היא לא המערכת']
  },
  {
    name: 'decision-journey-block',
    markers: ['שמעתי שזה משתלם', 'דחיתי את ההחלטה', 'קודם מבינים']
  },
  {
    name: 'project-examples-block',
    markers: ['בתים פרטיים', 'עסקים ומסחר', 'חקלאות'],
    excludeSelectors: ['header', 'nav']
  },
  {
    name: 'project-examples-alt-block',
    markers: ['בית פרטי', 'מסחרי', 'תעשייה']
  }
];

function isCalculatorPage() {
  return /\/roof-check\/?$/.test(window.location.pathname) || /\/roof-check\//.test(window.location.pathname);
}

function isHomePage() {
  const path = window.location.pathname.replace(/\/index\.html$/, '/');
  return path.endsWith('/roof-check-by-solatrix/') || path === '/' || path.endsWith('/');
}

function siteRootUrl() {
  const path = window.location.pathname;
  const marker = '/roof-check-by-solatrix/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex >= 0) return `${window.location.origin}${path.slice(0, markerIndex + marker.length)}`;
  if (path.includes('/roof-check/')) return new URL('../', window.location.href).href;
  return new URL('./', window.location.href).href;
}

function indexUrl() {
  const url = new URL(siteRootUrl());
  url.searchParams.set('v', 'index-master');
  return url.href;
}

function calculatorUrl() {
  return new URL(calculatorPath, siteRootUrl()).href;
}

function textMatches(text = '', patterns = calculatorKeywords) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return patterns.some((pattern) => pattern.test(clean));
}

function hrefMatchesCalculator(href = '') {
  return /roof-check\.html/i.test(href) || /#.*roof/i.test(href) || /#.*גג/i.test(href);
}

function closestContentSection(node) {
  let current = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== document.body) {
    if (current.matches?.('header, nav')) return null;
    if (current.tagName === 'SECTION' || current.classList.contains('section')) return current;
    current = current.parentElement;
  }
  return null;
}

function findSectionByMarkers(markers) {
  const candidates = [...document.querySelectorAll('section, .section')]
    .filter((node) => !node.closest('header, nav'))
    .filter((node) => {
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      return markers.every((marker) => text.includes(marker));
    })
    .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);

  if (candidates.length) return candidates[0];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue || '';
      return markers.some((marker) => text.includes(marker)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  let textNode = walker.nextNode();
  while (textNode) {
    const section = closestContentSection(textNode);
    if (section) {
      const text = (section.textContent || '').replace(/\s+/g, ' ');
      if (markers.every((marker) => text.includes(marker))) return section;
    }
    textNode = walker.nextNode();
  }

  return null;
}

function simplifyIndexSections() {
  if (!isHomePage()) return;
  const removed = new Set();

  indexSectionRemovalRules.forEach((rule) => {
    const section = findSectionByMarkers(rule.markers);
    if (!section || removed.has(section)) return;
    section.remove();
    removed.add(section);
  });
}

function connectIndexLinks() {
  const target = indexUrl();
  document.querySelectorAll('a').forEach((link) => {
    const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
    const href = link.getAttribute('href') || '';
    const isLogo = link.classList.contains('brand') || link.querySelector('img[alt*="Solatrix"], .logoImage, .logoMark');
    const isHome = label === 'דף הבית' || label === 'ראשי' || link.classList.contains('home-link');
    const pointsToIndex = /(^|\/)index\.html(?:$|[?#])/.test(href) || href === './' || href === '/';
    if (isLogo || isHome || pointsToIndex) {
      link.setAttribute('href', target);
      link.setAttribute('data-solatrix-index-link', 'true');
    }
  });
}

function connectRoofCheckLinks() {
  if (isCalculatorPage()) return;

  const target = calculatorUrl();

  document.querySelectorAll('a').forEach((link) => {
    const label = link.textContent || '';
    const href = link.getAttribute('href') || '';
    if (link.getAttribute('data-solatrix-index-link') === 'true') return;
    if (textMatches(label) || hrefMatchesCalculator(href)) {
      link.setAttribute('href', target);
      link.setAttribute('data-solatrix-linked-calculator', 'true');
    } else if (textMatches(label, contactKeywords) && !/wa\.me|whatsapp/i.test(href)) {
      link.setAttribute('href', '#lead-form');
      link.setAttribute('data-solatrix-open-lead-form', 'true');
    }
  });

  document.querySelectorAll('button, [role="button"]').forEach((button) => {
    const label = button.textContent || '';
    if (textMatches(label)) {
      button.setAttribute('data-solatrix-linked-calculator', 'true');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.href = target;
      });
    } else if (textMatches(label, contactKeywords)) {
      button.setAttribute('data-solatrix-open-lead-form', 'true');
    }
  });
}

function initSolatrixSiteLinks() {
  simplifyIndexSections();
  connectIndexLinks();
  connectRoofCheckLinks();
  setTimeout(simplifyIndexSections, 250);
  setTimeout(simplifyIndexSections, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSolatrixSiteLinks);
} else {
  initSolatrixSiteLinks();
}
