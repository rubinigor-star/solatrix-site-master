const FONT_LINK_ID = 'solatrix-report-fonts-v1';
const STYLE_ID = 'solatrix-report-typography-v1';

function installReportFonts() {
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
