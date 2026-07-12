const PATCH_FLAG = '__solatrixMapZoomSafetyInstalledV3';
const ESRI_IMAGERY_PART = 'World_Imagery/MapServer/tile';
const LAST_RELIABLE_NATIVE_ZOOM = 17;
const DISPLAY_MAX_ZOOM = 19;
const INITIAL_SAFE_ZOOM = 17;

if (!window[PATCH_FLAG]) {
  window[PATCH_FLAG] = true;
  installLeafletHook();
}

function isMobileRoofMarking() {
  const mobile = window.innerWidth <= 820 || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
  return mobile && (window.location.pathname || '').includes('/roof-marking');
}

function installLeafletHook() {
  const existingDescriptor = Object.getOwnPropertyDescriptor(window, 'L');

  if (window.L) {
    patchLeaflet(window.L);
    return;
  }

  if (existingDescriptor?.set || existingDescriptor?.get) {
    Object.defineProperty(window, 'L', {
      configurable: true,
      enumerable: true,
      get() {
        return existingDescriptor.get ? existingDescriptor.get.call(window) : undefined;
      },
      set(value) {
        if (existingDescriptor.set) existingDescriptor.set.call(window, value);
        patchLeaflet(value);
      }
    });
    return;
  }

  let leafletValue;
  Object.defineProperty(window, 'L', {
    configurable: true,
    enumerable: true,
    get() { return leafletValue; },
    set(value) {
      leafletValue = value;
      patchLeaflet(value);
    }
  });
}

function patchLeaflet(L) {
  if (!L || L.__solatrixMapZoomSafetyPatchedV3) return;
  L.__solatrixMapZoomSafetyPatchedV3 = true;

  const originalMapFactory = L.map;
  L.map = function (...args) {
    const [target, options = {}] = args;
    const map = originalMapFactory.call(this, target, {
      ...options,
      maxZoom: Math.min(Number(options.maxZoom || DISPLAY_MAX_ZOOM), DISPLAY_MAX_ZOOM),
      zoomSnap: options.zoomSnap ?? 0.25,
      zoomDelta: options.zoomDelta ?? 0.5,
      bounceAtZoomLimits: false
    });

    const originalSetView = map.setView.bind(map);
    const createdAt = Date.now();
    let userInteracted = false;
    const container = map.getContainer?.();
    const markInteraction = () => { userInteracted = true; };
    container?.addEventListener('pointerdown', markInteraction, { passive: true });
    container?.addEventListener('touchstart', markInteraction, { passive: true });
    container?.addEventListener('wheel', markInteraction, { passive: true });

    map.setView = function (center, zoom, setViewOptions) {
      let safeZoom = zoom;
      const initialAutomaticMove = !userInteracted && Date.now() - createdAt < 12000;
      if (isMobileRoofMarking() && initialAutomaticMove && Number(safeZoom) > INITIAL_SAFE_ZOOM) {
        safeZoom = INITIAL_SAFE_ZOOM;
      }
      if (Number(safeZoom) > DISPLAY_MAX_ZOOM) safeZoom = DISPLAY_MAX_ZOOM;
      return originalSetView(center, safeZoom, setViewOptions);
    };

    map.on('zoomend', () => {
      if (map.getZoom() > DISPLAY_MAX_ZOOM) {
        map.setZoom(DISPLAY_MAX_ZOOM, { animate: false });
      }
    });
    return map;
  };

  const originalTileLayerFactory = L.tileLayer;
  L.tileLayer = function (url, options = {}) {
    const isSatellite = String(url || '').includes(ESRI_IMAGERY_PART);
    const safeOptions = isSatellite
      ? {
          ...options,
          maxNativeZoom: LAST_RELIABLE_NATIVE_ZOOM,
          maxZoom: DISPLAY_MAX_ZOOM,
          keepBuffer: Math.max(Number(options.keepBuffer || 0), 5),
          updateWhenZooming: false,
          updateWhenIdle: true,
          noWrap: true
        }
      : options;

    const layer = originalTileLayerFactory.call(this, url, safeOptions);
    if (!isSatellite) return layer;

    let consecutiveErrors = 0;
    layer.on('tileload', () => {
      consecutiveErrors = 0;
    });
    layer.on('tileerror', () => {
      consecutiveErrors += 1;
      const map = layer._map;
      if (!map || consecutiveErrors < 2) return;
      consecutiveErrors = 0;
      if (map.getZoom() > LAST_RELIABLE_NATIVE_ZOOM) {
        map.setZoom(LAST_RELIABLE_NATIVE_ZOOM, { animate: false });
      }
    });

    return layer;
  };
}
