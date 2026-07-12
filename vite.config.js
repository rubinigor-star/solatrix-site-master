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
.solatrix-v34-visual{position:relative!important;min-height:500px!important;overflow:hidden!important;border-radius:30px!important;background:linear-gradient(145deg,#061f33 0%,#0b4163 56%,#08263c 100%)!important;box-shadow:0 34px 88px rgba(6,40,64,.24),0 0 0 1px rgba(255,255,255,.55)!important;border:1px solid rgba(255,255,255,.52)!important}
.solatrix-v34-visual>:not(.hero-preview-card){display:none!important}
.hero-preview-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit;color:#fff;font-family:Assistant,system-ui,sans-serif}
.hero-preview-card:before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),radial-gradient(circle at 78% 10%,rgba(247,183,25,.32),transparent 22%);background-size:30px 30px,30px 30px,auto}
.hero-preview-top{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.09);font-size:14px;font-weight:900;letter-spacing:.02em}
.hero-preview-status{display:flex;align-items:center;gap:8px;font-size:11px;color:rgba(255,255,255,.74)}
.hero-preview-status:before{content:"";width:7px;height:7px;border-radius:50%;background:#f7b719;box-shadow:0 0 0 6px rgba(247,183,25,.12),0 0 18px rgba(247,183,25,.55)}
.hero-preview-map{position:absolute;left:22px;right:22px;top:68px;bottom:122px;border-radius:20px;overflow:hidden;background:linear-gradient(145deg,#687061 0%,#485547 43%,#747d6c 100%);box-shadow:inset 0 0 90px rgba(0,0,0,.42),0 16px 36px rgba(0,0,0,.18)}
.hero-preview-map:before{content:"";position:absolute;inset:-50px;background:linear-gradient(28deg,transparent 46%,rgba(205,197,176,.29) 47%,rgba(205,197,176,.29) 52%,transparent 53%),linear-gradient(118deg,transparent 46%,rgba(232,224,205,.20) 47%,rgba(232,224,205,.20) 51%,transparent 52%),radial-gradient(circle at 20% 28%,rgba(35,54,38,.55) 0 7%,transparent 8%),radial-gradient(circle at 78% 74%,rgba(35,54,38,.48) 0 9%,transparent 10%);background-size:125px 125px,125px 125px,180px 180px,220px 220px;transform:rotate(-7deg);filter:saturate(.85) contrast(1.08)}
.hero-preview-map:after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.08),transparent 34%),radial-gradient(circle at 50% 48%,transparent 0 28%,rgba(6,31,51,.18) 62%,rgba(6,31,51,.42) 100%);pointer-events:none}
.hero-preview-roof{position:absolute;left:50%;top:49%;width:52%;height:48%;transform:translate(-50%,-50%) rotate(-7deg);clip-path:polygon(9% 0,100% 11%,91% 100%,0 84%);background:linear-gradient(145deg,#d1c0a5 0%,#b69c7b 48%,#92785d 100%);box-shadow:0 30px 46px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.18)}
.hero-preview-roof:before{content:"";position:absolute;inset:6%;border:2px solid #ffd75c;clip-path:inherit;filter:drop-shadow(0 0 10px rgba(255,215,92,.75))}
.hero-preview-panels{position:absolute;inset:17% 14% 15%;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:5px}
.hero-preview-panels i{border-radius:3px;background:linear-gradient(90deg,transparent 48%,rgba(255,255,255,.13) 49%,rgba(255,255,255,.13) 51%,transparent 52%),linear-gradient(180deg,transparent 48%,rgba(255,255,255,.11) 49%,rgba(255,255,255,.11) 51%,transparent 52%),linear-gradient(145deg,#0a2944,#15527b);border:1px solid rgba(255,255,255,.13);box-shadow:0 4px 8px rgba(0,0,0,.22),inset 0 0 12px rgba(38,118,169,.16)}
.hero-preview-scan{position:absolute;left:8%;right:8%;height:2px;top:20%;z-index:4;background:linear-gradient(90deg,transparent,#ffe07b 22%,#fff1ad 50%,#ffe07b 78%,transparent);box-shadow:0 0 12px #ffd75c,0 0 26px rgba(255,215,92,.5);animation:heroScan 4s ease-in-out infinite}
.hero-preview-scan:after{content:"";position:absolute;left:0;right:0;top:-26px;height:54px;background:linear-gradient(to bottom,transparent,rgba(255,215,92,.08),transparent)}
@keyframes heroScan{0%,100%{top:18%;opacity:.32}50%{top:82%;opacity:1}}
.hero-preview-badge{position:absolute;z-index:5;top:86px;right:7px;padding:10px 13px;border-radius:12px;background:linear-gradient(135deg,#f7b719,#ffd15b);color:#18212a;font-size:11px;font-weight:900;box-shadow:0 12px 28px rgba(0,0,0,.2),0 0 0 1px rgba(255,255,255,.38);transform:rotate(1.5deg)}
.hero-preview-stats{position:absolute;left:22px;right:22px;bottom:18px;z-index:4;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.hero-preview-stat{padding:11px 11px 10px;border-radius:13px;background:rgba(255,255,255,.94);color:#062840;box-shadow:0 12px 26px rgba(0,0,0,.14);backdrop-filter:blur(10px)}
.hero-preview-stat span{display:block;font-size:10px;font-weight:800;color:#758089}.hero-preview-stat b{display:block;margin-top:2px;font-size:16px;white-space:nowrap;letter-spacing:-.02em}
@media(max-width:900px){.solatrix-v34-visual{min-height:430px!important;border-radius:24px!important}.hero-preview-top{padding:16px 17px}.hero-preview-map{left:13px;right:13px;top:62px;bottom:174px}.hero-preview-roof{width:60%;height:48%}.hero-preview-stats{left:13px;right:13px;bottom:13px;grid-template-columns:repeat(2,1fr);gap:7px}.hero-preview-stat{padding:10px}.hero-preview-badge{top:76px;right:3px}.hero-preview-stat b{font-size:15px}}
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
