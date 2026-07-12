const PATCH_FLAG = '__solatrixMapZoomSafetyInstalledV1';
const ESRI_IMAGERY_PART = 'World_Imagery/MapServer/tile';
const NATIVE_IMAGERY_ZOOM = 19;
const DISPLAY_MAX_ZOOM = 21;

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
  if (!L || L.__solatrixMapZoomSafetyPatched) return;
  L.__solatrixMapZoomSafetyPatched = true;

  const originalMapFactory = L.map;
  L.map = function (...args) {
    const [target, options = {}] = args;
    const map = originalMapFactory.call(this, target, {
      ...options,
      maxZoom: Math.min(Number(options.maxZoom || DISPLAY_MAX_ZOOM), DISPLAY_MAX_ZOOM),
      zoomSnap: options.zoomSnap ?? 0.25,
      zoomDelta: options.zoomDelta ?? 0.5
    });

    map.on('zoomend', () => {
      if (map.getZoom() > DISPLAY_MAX_ZOOM) map.setZoom(DISPLAY_MAX_ZOOM, { animate: false });
    });
    return map;
  };

  const originalTileLayerFactory = L.tileLayer;
  L.tileLayer = function (url, options = {}) {
    const isSatellite = String(url || '').includes(ESRI_IMAGERY_PART);
    const safeOptions = isSatellite
      ? {
          ...options,
          maxNativeZoom: Math.min(Number(options.maxNativeZoom || NATIVE_IMAGERY_ZOOM), NATIVE_IMAGERY_ZOOM),
          maxZoom: DISPLAY_MAX_ZOOM,
          keepBuffer: Math.max(Number(options.keepBuffer || 0), 4),
          updateWhenZooming: false,
          updateWhenIdle: true
        }
      : options;

    const layer = originalTileLayerFactory.call(this, url, safeOptions);
    if (!isSatellite) return layer;

    let tileErrors = 0;
    layer.on('tileload', () => { tileErrors = Math.max(0, tileErrors - 1); });
    layer.on('tileerror', () => {
      tileErrors += 1;
      const map = layer._map;
      if (!map || tileErrors < 3) return;
      tileErrors = 0;
      const safeZoom = Math.min(map.getZoom(), NATIVE_IMAGERY_ZOOM);
      if (map.getZoom() > safeZoom) map.setZoom(safeZoom, { animate: false });
    });

    return layer;
  };
}
