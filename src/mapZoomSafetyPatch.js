const PATCH_FLAG = '__solatrixMapZoomSafetyInstalledV2';
const ESRI_IMAGERY_PART = 'World_Imagery/MapServer/tile';
const LAST_RELIABLE_NATIVE_ZOOM = 18;
const DISPLAY_MAX_ZOOM = 20;

if (!window[PATCH_FLAG]) {
  window[PATCH_FLAG] = true;
  installLeafletHook();
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
  if (!L || L.__solatrixMapZoomSafetyPatchedV2) return;
  L.__solatrixMapZoomSafetyPatchedV2 = true;

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
