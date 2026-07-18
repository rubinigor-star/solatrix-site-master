const FONT_LINK_ID = 'solatrix-report-fonts-v1';
const STYLE_ID = 'solatrix-report-typography-v1';
const HEEBO_VARIABLE_FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';

function installPdfFontFetchPatch() {
  if (window.__solatrixPdfFontFetchPatched) return;
  window.__solatrixPdfFontFetchPatched = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (requestUrl.includes('/ofl/heebo/static/Heebo-Regular.ttf') || requestUrl.includes('/ofl/heebo/static/Heebo-Bold.ttf')) {
      return nativeFetch(HEEBO_VARIABLE_FONT_URL, init);
    }
    return nativeFetch(input, init);
  };
}

function installReportFonts() {
  installPdfFontFetchPatch();

  if (!document.getElementById(FONT_LINK_ID)) {
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = 'https://fonts.gstatic.com';
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);

    const link = document.createElement('link');
    link.id = FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&family=Inter:wght@500;600;700;800;900&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pdfPage {
        font-family: "Heebo", "Noto Sans Hebrew", Arial, sans-serif !important;
        font-synthesis: none;
      }

      .pdfPage .metricCard b,
      .pdfPage .centralCard b,
      .pdfPage .numberRow b,
      .pdfPage .smallFact b,
      .pdfPage .processCard i,
      .pdfPage .pdfFooter {
        font-family: "Inter", "Heebo", Arial, sans-serif !important;
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: "tnum" 1, "lnum" 1;
      }
    `;
    document.head.appendChild(style);
  }
}

installReportFonts();
