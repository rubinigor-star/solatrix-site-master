import { defineConfig } from 'vite';

const SITE_WIDE_SCRIPT_SKIP = new Set(['roof-check.html', 'roof-check/index.html', 'admin.html']);
const HOMEPAGE_SECTION_TEXTS_TO_REMOVE = [
  'הבעיה היא לא המערכת',
  'כל גג נראה אחרת'
];

const HERO_PREVIEW_MARKUP = `
  <div class="hero-preview-card" aria-label="הדגמת בדיקת גג סולארית">
    <div class="hero-preview-photo"></div>
    <div class="hero-preview-overlay"></div>
    <div class="hero-preview-top">
      <span>SOLATRIX ROOF CHECK</span>
      <span class="hero-preview-status">LIVE ROOF ANALYSIS</span>
    </div>
    <div class="hero-preview-frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <div class="hero-preview-scan"></div>
      <div class="hero-preview-target">ROOF AREA DETECTED</div>
    </div>
    <div class="hero-preview-coordinates">32.7940° N · 34.9896° E</div>
    <div class="hero-preview-stats">
      <div class="hero-preview-stat"><span>שטח גג</span><b>182 מ״ר</b></div>
      <div class="hero-preview-stat"><span>גודל מערכת</span><b>28.4 kW</b></div>
      <div class="hero-preview-stat"><span>ייצור שנתי</span><b>46,900 kWh</b></div>
      <div class="hero-preview-stat"><span>החזר השקעה</span><b>4.3 שנים</b></div>
    </div>
  </div>`;

const HERO_PREVIEW_STYLES = `
.solatrix-v34-visual{position:relative!important;min-height:500px!important;overflow:hidden!important;border-radius:30px!important;background:#081b29!important;box-shadow:0 34px 88px rgba(6,40,64,.22),0 0 0 1px rgba(255,255,255,.62)!important;border:1px solid rgba(255,255,255,.56)!important}
.solatrix-v34-visual>:not(.hero-preview-card){display:none!important}
.hero-preview-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit;color:#fff;font-family:Assistant,system-ui,sans-serif;background:#071c2b}
.hero-preview-photo{position:absolute;inset:0;background-image:url('./assets/solatrix-approved-hero-image.jpg');background-size:cover;background-position:center 44%;filter:saturate(.92) contrast(1.06) brightness(.78);transform:scale(1.035)}
.hero-preview-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,19,31,.72) 0%,rgba(3,19,31,.15) 34%,rgba(3,19,31,.18) 63%,rgba(3,19,31,.82) 100%),linear-gradient(90deg,rgba(5,27,43,.22),transparent 38%,transparent 70%,rgba(5,27,43,.2));box-shadow:inset 0 0 90px rgba(1,13,22,.5)}
.hero-preview-card:before{content:"";position:absolute;z-index:2;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:36px 36px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.75),transparent 70%);pointer-events:none}
.hero-preview-top{position:relative;z-index:5;display:flex;justify-content:space-between;align-items:center;padding:19px 22px;border-bottom:1px solid rgba(255,255,255,.13);font-size:13px;font-weight:900;letter-spacing:.08em;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.hero-preview-status{display:flex;align-items:center;gap:8px;font-size:10px;color:rgba(255,255,255,.78);letter-spacing:.1em}
.hero-preview-status:before{content:"";width:7px;height:7px;border-radius:50%;background:#f7b719;box-shadow:0 0 0 6px rgba(247,183,25,.13),0 0 22px rgba(247,183,25,.72)}
.hero-preview-frame{position:absolute;z-index:4;left:13%;right:11%;top:19%;bottom:25%;border:1px solid rgba(255,221,117,.45);box-shadow:0 0 30px rgba(255,211,80,.08),inset 0 0 32px rgba(255,211,80,.04)}
.corner{position:absolute;width:34px;height:34px;border-color:#ffd45c;filter:drop-shadow(0 0 7px rgba(255,212,92,.8))}.corner.tl{left:-2px;top:-2px;border-left:3px solid;border-top:3px solid}.corner.tr{right:-2px;top:-2px;border-right:3px solid;border-top:3px solid}.corner.bl{left:-2px;bottom:-2px;border-left:3px solid;border-bottom:3px solid}.corner.br{right:-2px;bottom:-2px;border-right:3px solid;border-bottom:3px solid}
.hero-preview-scan{position:absolute;left:0;right:0;height:2px;top:12%;background:linear-gradient(90deg,transparent,#ffd45c 18%,#fff2b4 50%,#ffd45c 82%,transparent);box-shadow:0 0 13px #ffd45c,0 0 30px rgba(255,212,92,.52);animation:heroScan 4s ease-in-out infinite}
.hero-preview-scan:after{content:"";position:absolute;left:0;right:0;top:-28px;height:58px;background:linear-gradient(to bottom,transparent,rgba(255,218,100,.1),transparent)}
@keyframes heroScan{0%,100%{top:12%;opacity:.35}50%{top:88%;opacity:1}}
.hero-preview-target{position:absolute;right:14px;top:14px;padding:8px 11px;border-radius:8px;background:rgba(5,25,39,.76);border:1px solid rgba(255,217,101,.45);font-size:9px;font-weight:900;letter-spacing:.1em;color:#ffe080;backdrop-filter:blur(8px)}
.hero-preview-coordinates{position:absolute;z-index:5;left:22px;bottom:105px;padding:7px 9px;border-radius:8px;background:rgba(4,22,35,.66);border:1px solid rgba(255,255,255,.15);font-size:9px;font-weight:800;letter-spacing:.08em;color:rgba(255,255,255,.78);backdrop-filter:blur(8px)}
.hero-preview-stats{position:absolute;left:18px;right:18px;bottom:16px;z-index:5;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.hero-preview-stat{padding:10px 10px 9px;border-radius:12px;background:rgba(248,250,251,.9);color:#062840;border:1px solid rgba(255,255,255,.72);box-shadow:0 12px 28px rgba(0,0,0,.18);backdrop-filter:blur(12px)}
.hero-preview-stat span{display:block;font-size:9px;font-weight:800;color:#7a858c}.hero-preview-stat b{display:block;margin-top:2px;font-size:15px;white-space:nowrap;letter-spacing:-.02em}
@media(max-width:900px){.solatrix-v34-visual{min-height:430px!important;border-radius:24px!important}.hero-preview-photo{background-position:center}.hero-preview-top{padding:16px 17px;font-size:11px}.hero-preview-status{font-size:8px}.hero-preview-frame{left:9%;right:9%;top:18%;bottom:38%}.hero-preview-coordinates{left:13px;bottom:164px}.hero-preview-stats{left:13px;right:13px;bottom:13px;grid-template-columns:repeat(2,1fr);gap:7px}.hero-preview-stat{padding:9px}.hero-preview-stat b{font-size:14px}}
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
