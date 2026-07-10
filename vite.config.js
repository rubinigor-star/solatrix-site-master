import { defineConfig } from 'vite';

const SITE_WIDE_SCRIPT_SKIP = new Set(['roof-check.html', 'roof-check/index.html', 'admin.html']);

function injectSolatrixScripts() {
  return {
    name: 'solatrix-site-wide-scripts',
    transformIndexHtml(html, context) {
      const filename = String(context?.filename || '').replace(/\\/g, '/');
      if ([...SITE_WIDE_SCRIPT_SKIP].some((page) => filename.endsWith(page))) return [];
      return [
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
      ];
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [injectSolatrixScripts()],
  resolve: {
    alias: [
      { find: './src/pdfReport.js', replacement: '/src/pdfReportHotfix.js' }
    ]
  },
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
