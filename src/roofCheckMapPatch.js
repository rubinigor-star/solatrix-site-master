import './roofGovMapVisualPatch.js';
import './roofGovMapPointRenderFix.js';
import './roofMarkingHelp.js';
import './roofGovMapMobileUi.js';

const STYLE_ID = 'solatrix-govmap-only-guard';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';

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

function restorePublishedGeometry() {
  if (Array.isArray(window.__solatrixRoofSurfaces) && window.__solatrixRoofSurfaces.length) return;
  try {
    const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || 'null');
    if (!Array.isArray(saved?.surfaces) || !saved.surfaces.length) return;
    window.__solatrixRoofSurfaces = saved.surfaces;
    window.__solatrixRoofGeometry = saved.geometry || null;
    window.__solatrixRoofCoordinates = saved.geometry?.centroid || null;
    window.__solatrixRoofMapProvider = 'govmap-official';
  } catch {}
}

installGuard();
restorePublishedGeometry();
window.addEventListener('pageshow', restorePublishedGeometry);
window.addEventListener('popstate', restorePublishedGeometry);
