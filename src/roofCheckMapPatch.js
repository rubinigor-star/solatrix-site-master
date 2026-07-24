import './roofGovMapVisualPatch.js';

const STYLE_ID = 'solatrix-govmap-only-guard';

function installGuard() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body:has(.mapPanel.interactiveMap:not([data-govmap-installed="true"])) .mapPanel.interactiveMap > * {
      visibility: hidden !important;
    }
    .mapPanel.interactiveMap:not([data-govmap-installed="true"]) {
      min-height: 520px;
      background: #d9e4ea !important;
    }
  `;
  document.head.appendChild(style);
}

installGuard();
