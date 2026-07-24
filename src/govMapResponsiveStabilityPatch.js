const FLAG = '__solatrixGovMapResponsiveStabilityV1';
const MAP_ID = 'solatrix-official-govmap';

function isRoofMarking() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function isMobile() {
  return window.matchMedia('(max-width: 820px)').matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
}

function installStyles() {
  if (document.getElementById('solatrix-govmap-responsive-stability-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-govmap-responsive-stability-style';
  style.textContent = `
    @media (min-width:821px) {
      .solatrixGovMapCrosshair,
      .solatrixMobileTargetCrosshair {
        display:none!important;
        visibility:hidden!important;
        opacity:0!important;
      }
    }
    @media (max-width:820px) {
      .solatrixGovMapWrap {
        min-height:520px!important;
        contain:layout paint;
      }
      #${MAP_ID} {
        min-width:100%!important;
        min-height:100%!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function mapHasRenderedContent(mapNode) {
  if (!mapNode) return false;
  if (mapNode.querySelector('canvas, iframe, img, .ol-viewport, .esri-view-root')) return true;
  return mapNode.childElementCount > 0 && mapNode.getBoundingClientRect().height > 100;
}

function recreateMobileMap(reason) {
  if (!isRoofMarking() || !isMobile()) return false;
  const oldMap = document.getElementById(MAP_ID);
  const wrap = oldMap?.closest('.solatrixGovMapWrap');
  if (!oldMap || !wrap || typeof window.govmap?.createMap !== 'function') return false;

  const rect = wrap.getBoundingClientRect();
  if (rect.width < 200 || rect.height < 300) return false;

  const replacement = document.createElement('div');
  replacement.id = MAP_ID;
  replacement.style.position = 'absolute';
  replacement.style.inset = '0';
  replacement.style.width = '100%';
  replacement.style.height = '100%';
  replacement.style.direction = 'ltr';
  replacement.dataset.recoveryReason = reason;
  oldMap.replaceWith(replacement);

  try {
    window.govmap.createMap(MAP_ID, {
      token: String(window.__SOLATRIX_CONFIG__?.govMapApiToken || import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim(),
      layers: [],
      showXY: false,
      identifyOnClick: false,
      isEmbeddedToggle: false,
      background: '1',
      layersMode: 1,
      zoomButtons: true
    });
    window.setTimeout(() => {
      try { window.govmap?.setBackground?.(1); } catch {}
      window.dispatchEvent(new CustomEvent('solatrix:govmap-mobile-recreated'));
    }, 250);
    return true;
  } catch (error) {
    console.warn('GovMap mobile recreation failed', error);
    return false;
  }
}

function ensureMobileMap() {
  if (!isRoofMarking() || !isMobile()) return;
  const mapNode = document.getElementById(MAP_ID);
  if (!mapNode) return;
  if (mapHasRenderedContent(mapNode)) return;

  const attempts = Number(mapNode.dataset.mobileRecoveryAttempts || 0);
  if (attempts >= 3) return;
  mapNode.dataset.mobileRecoveryAttempts = String(attempts + 1);
  recreateMobileMap(`empty-map-attempt-${attempts + 1}`);
}

function tick() {
  if (!isRoofMarking()) return;
  installStyles();

  if (!isMobile()) {
    document.querySelectorAll('.solatrixGovMapCrosshair,.solatrixMobileTargetCrosshair').forEach((node) => {
      node.setAttribute('aria-hidden', 'true');
    });
    return;
  }

  window.requestAnimationFrame(() => {
    const mapNode = document.getElementById(MAP_ID);
    if (!mapNode) return;
    const rect = mapNode.getBoundingClientRect();
    if (rect.width > 200 && rect.height > 300) {
      window.setTimeout(ensureMobileMap, 900);
    }
  });
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  window.addEventListener('popstate', () => window.setTimeout(tick, 120));
  window.addEventListener('pageshow', () => window.setTimeout(tick, 120));
  window.addEventListener('orientationchange', () => window.setTimeout(tick, 350));
  window.addEventListener('solatrix:govmap-mobile-recreated', () => window.setTimeout(ensureMobileMap, 1400));
  window.setInterval(tick, 1800);
}
