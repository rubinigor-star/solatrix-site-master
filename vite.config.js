import { defineConfig } from 'vite';

const SITE_WIDE_SCRIPT_SKIP = new Set(['roof-check.html', 'roof-check/index.html', 'admin.html']);
const HOMEPAGE_SECTION_TEXTS_TO_REMOVE = [
  'הבעיה היא לא המערכת',
  'כל גג נראה אחרת'
];

const HERO_PREVIEW_MARKUP = `
  <div class="hero-preview-card" aria-label="הדגמת בדיקת גג סולארית">
    <div class="hero-preview-top">
      <span>SOLATRIX ROOF CHECK</span>
      <span class="hero-preview-status">ניתוח גג פעיל</span>
    </div>
    <div class="hero-preview-map">
      <div class="hero-preview-roof">
        <div class="hero-preview-panels">
          ${Array.from({ length: 12 }, () => '<i></i>').join('')}
        </div>
      </div>
      <div class="hero-preview-scan"></div>
    </div>
    <div class="hero-preview-badge">✓ התאמה ראשונית נמצאה</div>
    <div class="hero-preview-stats">
      <div class="hero-preview-stat"><span>שטח גג</span><b>182 מ״ר</b></div>
      <div class="hero-preview-stat"><span>גודל מערכת</span><b>28.4 kW</b></div>
      <div class="hero-preview-stat"><span>ייצור שנתי</span><b>46,900 kWh</b></div>
      <div class="hero-preview-stat"><span>החזר השקעה</span><b>4.3 שנים</b></div>
    </div>
  </div>`;

const HERO_PREVIEW_STYLES = `
.solatrix-v34-visual{position:relative!important;min-height:560px!important;overflow:hidden!important;border-radius:32px!important;background:linear-gradient(145deg,#062840 0%,#0c4a70 58%,#09283d 100%)!important;box-shadow:0 38px 95px rgba(6,40,64,.28)!important;border:1px solid rgba(255,255,255,.5)!important}
.solatrix-v34-visual>:not(.hero-preview-card){display:none!important}
.hero-preview-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit;color:#fff;font-family:Assistant,system-ui,sans-serif}
.hero-preview-card:before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px),radial-gradient(circle at 82% 12%,rgba(247,183,25,.38),transparent 24%);background-size:34px 34px,34px 34px,auto}
.hero-preview-top{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:20px 22px;border-bottom:1px solid rgba(255,255,255,.1);font-weight:900}
.hero-preview-status{display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,.75)}
.hero-preview-status:before{content:"";width:8px;height:8px;border-radius:50%;background:#f7b719;box-shadow:0 0 0 7px rgba(247,183,25,.13)}
.hero-preview-map{position:absolute;left:24px;right:24px;top:76px;bottom:150px;border-radius:22px;overflow:hidden;background:linear-gradient(135deg,#78816f,#4c5848 48%,#697460);box-shadow:inset 0 0 70px rgba(0,0,0,.32)}
.hero-preview-map:before{content:"";position:absolute;inset:-70px;background:linear-gradient(27deg,transparent 47%,rgba(220,210,188,.36) 48%,rgba(220,210,188,.36) 52%,transparent 53%),linear-gradient(117deg,transparent 47%,rgba(210,199,174,.28) 48%,rgba(210,199,174,.28) 52%,transparent 53%);background-size:130px 130px;transform:rotate(-8deg)}
.hero-preview-roof{position:absolute;left:50%;top:50%;width:58%;height:55%;transform:translate(-50%,-50%) rotate(-8deg);clip-path:polygon(10% 0,100% 12%,92% 100%,0 84%);background:linear-gradient(145deg,#c9b79e,#9e876b);box-shadow:0 30px 48px rgba(0,0,0,.32)}
.hero-preview-roof:before{content:"";position:absolute;inset:7%;border:2px solid #ffd75c;clip-path:inherit;filter:drop-shadow(0 0 8px rgba(255,215,92,.62))}
.hero-preview-panels{position:absolute;inset:17% 14% 15%;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:6px}
.hero-preview-panels i{border-radius:3px;background:linear-gradient(90deg,transparent 48%,rgba(255,255,255,.16) 49%,rgba(255,255,255,.16) 51%,transparent 52%),linear-gradient(180deg,transparent 48%,rgba(255,255,255,.13) 49%,rgba(255,255,255,.13) 51%,transparent 52%),linear-gradient(145deg,#0b2c47,#174f75);border:1px solid rgba(255,255,255,.16);box-shadow:0 4px 8px rgba(0,0,0,.18)}
.hero-preview-scan{position:absolute;left:6%;right:6%;height:2px;top:18%;background:linear-gradient(90deg,transparent,#ffd75c,transparent);box-shadow:0 0 18px #ffd75c;animation:heroScan 4.4s ease-in-out infinite}
@keyframes heroScan{0%,100%{top:18%;opacity:.25}50%{top:82%;opacity:1}}
.hero-preview-badge{position:absolute;z-index:5;top:98px;right:6px;padding:11px 14px;border-radius:13px;background:#f7b719;color:#18212a;font-size:12px;font-weight:900;box-shadow:0 14px 32px rgba(0,0,0,.18);transform:rotate(2deg)}
.hero-preview-stats{position:absolute;left:24px;right:24px;bottom:20px;z-index:4;display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.hero-preview-stat{padding:14px 12px;border-radius:15px;background:rgba(255,255,255,.95);color:#062840;box-shadow:0 14px 30px rgba(0,0,0,.16)}
.hero-preview-stat span{display:block;font-size:11px;font-weight:800;color:#6c7880}.hero-preview-stat b{display:block;margin-top:3px;font-size:18px;white-space:nowrap}
@media(max-width:900px){.solatrix-v34-visual{min-height:470px!important}.hero-preview-map{left:14px;right:14px;top:70px;bottom:206px}.hero-preview-stats{left:14px;right:14px;bottom:14px;grid-template-columns:repeat(2,1fr)}.hero-preview-badge{top:86px}.hero-preview-stat b{font-size:16px}}
`;

function normalizeVisibleText(fragment = '') {
  return fragment
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function findSectionSpans(html) {
  const tagPattern = /<\/?section\b[^>]*>/gi;
  const stack = [];
  const spans = [];
  let match;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const isClosingTag = /^<\/section/i.test(tag);

    if (!isClosingTag) {
      stack.push({ start: match.index, openTag: tag });
      continue;
    }

    const opening = stack.pop();
    if (!opening) continue;

    spans.push({ start: opening.start, end: tagPattern.lastIndex, openTag: opening.openTag });
  }

  return spans;
}

function stripUnwantedHomepageSections(html) {
  const spans = findSectionSpans(html);
  const removals = [];

  const decisionSection = spans
    .filter(({ openTag }) => /\bid\s*=\s*["']decision["']/i.test(openTag))
    .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];

  if (decisionSection) removals.push(decisionSection);

  HOMEPAGE_SECTION_TEXTS_TO_REMOVE.forEach((targetText) => {
    const matchingSection = spans
      .filter(({ start, end }) => normalizeVisibleText(html.slice(start, end)).includes(targetText))
      .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];

    if (matchingSection) removals.push(matchingSection);
  });

  const uniqueRemovals = [...new Map(
    removals.map((span) => [`${span.start}:${span.end}`, span])
  ).values()].sort((a, b) => b.start - a.start);

  return uniqueRemovals.reduce(
    (result, { start, end }) => result.slice(0, start) + result.slice(end),
    html
  );
}

function injectHeroPreview(html) {
  const openingTag = /(<div\s+class=["'][^"']*\bsolatrix-v34-visual\b[^"']*["'][^>]*>)/i;
  if (!openingTag.test(html)) {
    throw new Error('Homepage solatrix-v34-visual container was not found');
  }
  return html.replace(openingTag, `$1${HERO_PREVIEW_MARKUP}`);
}

function isHomepageFile(filename) {
  const normalized = filename.replace(/^\.\//, '');
  return normalized === 'index.html'
    || (normalized.endsWith('/index.html') && !normalized.endsWith('/roof-check/index.html'));
}

function injectSolatrixScripts() {
  return {
    name: 'solatrix-site-wide-scripts',
    transformIndexHtml(html, context) {
      const filename = String(context?.filename || '').replace(/\\/g, '/');
      const homepage = isHomepageFile(filename);
      let cleanedHtml = homepage ? stripUnwantedHomepageSections(html) : html;
      if (homepage) cleanedHtml = injectHeroPreview(cleanedHtml);

      const homepageTags = homepage
        ? [{ tag: 'style', children: HERO_PREVIEW_STYLES, injectTo: 'head' }]
        : [];

      if ([...SITE_WIDE_SCRIPT_SKIP].some((page) => filename.endsWith(page))) {
        return homepageTags.length ? { html: cleanedHtml, tags: homepageTags } : cleanedHtml;
      }

      return {
        html: cleanedHtml,
        tags: [
          ...homepageTags,
          {
            tag: 'script',
            attrs: { type: 'module', src: './src/siteLinkBridge.js' },
            injectTo: 'body'
          },
          {
            tag: 'script',
            attrs: { type: 'module', src: './src/globalLeadForm.js' },
            injectTo: 'body'
          }
        ]
      };
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [injectSolatrixScripts()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        privateHomes: 'private-homes.html',
        solarPrice: 'solar-price.html',
        roofCheckRedirect: 'roof-check.html',
        roofCheckApp: 'roof-check/index.html',
        storage: 'storage.html',
        business: 'business.html',
        agriculture: 'agriculture.html',
        faq: 'faq.html',
        contact: 'contact.html',
        admin: 'admin.html'
      }
    }
  }
});
