import { defineConfig } from 'vite';

const SITE_WIDE_SCRIPT_SKIP = new Set(['roof-check.html', 'roof-check/index.html', 'admin.html']);
const HOMEPAGE_SECTION_TEXTS_TO_REMOVE = [
  'הבעיה היא לא המערכת',
  'כל גג נראה אחרת'
];

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

    spans.push({
      start: opening.start,
      end: tagPattern.lastIndex,
      openTag: opening.openTag
    });
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
      const cleanedHtml = isHomepageFile(filename)
        ? stripUnwantedHomepageSections(html)
        : html;

      if ([...SITE_WIDE_SCRIPT_SKIP].some((page) => filename.endsWith(page))) {
        return cleanedHtml;
      }

      return {
        html: cleanedHtml,
        tags: [
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
