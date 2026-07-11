const PATCH_FLAG = '__solatrixRoofVertexEditingInstalled';

if (!window[PATCH_FLAG]) {
  window[PATCH_FLAG] = true;
  installLeafletHook();
  installMobileVertexStyles();
  watchRoofEditor();
}

function installLeafletHook() {
  if (window.L) {
    patchLeaflet(window.L);
    return;
  }

  let leafletValue;
  try {
    Object.defineProperty(window, 'L', {
      configurable: true,
      enumerable: true,
      get() { return leafletValue; },
      set(nextValue) {
        leafletValue = nextValue;
        patchLeaflet(nextValue);
      }
    });
  } catch {
    const timer = setInterval(() => {
      if (!window.L) return;
      clearInterval(timer);
      patchLeaflet(window.L);
    }, 50);
  }
}

function patchLeaflet(L) {
  if (!L || L.__solatrixVertexEditingPatched) return;
  L.__solatrixVertexEditingPatched = true;

  let roofPointSequence = 0;
  let roofPolygonSequence = 0;
  const roofPolygons = new Map();

  const originalMapFactory = L.map;
  L.map = function (...args) {
    const map = originalMapFactory.apply(this, args);
    window.__solatrixLeafletMap = map;
    return map;
  };

  const originalClearLayers = L.LayerGroup?.prototype?.clearLayers;
  if (originalClearLayers) {
    L.LayerGroup.prototype.clearLayers = function (...args) {
      roofPointSequence = 0;
      roofPolygonSequence = 0;
      roofPolygons.clear();
      return originalClearLayers.apply(this, args);
    };
  }

  const originalPolygonFactory = L.polygon;
  L.polygon = function (latlngs, options = {}) {
    const polygon = originalPolygonFactory.call(this, latlngs, options);
    const surfaces = currentSurfaces();
    if (options?.color === '#0b6fff' && roofPolygonSequence < surfaces.length) {
      polygon.__solatrixSurfaceIndex = roofPolygonSequence;
      roofPolygons.set(roofPolygonSequence, polygon);
      roofPolygonSequence += 1;
    }
    return polygon;
  };

  const originalMarkerFactory = L.marker;
  L.marker = function (latlng, options = {}) {
    const className = options?.icon?.options?.className || '';
    const isRoofPoint = className.includes('solatrixRoofPoint');
    const isSavedSurfacePoint = isRoofPoint && !document.body.classList.contains('solatrixDrawMode');
    const markerOptions = isSavedSurfacePoint ? { ...options, draggable: true, keyboard: false } : options;
    const marker = originalMarkerFactory.call(this, latlng, markerOptions);

    if (!isSavedSurfacePoint) return marker;

    const location = locateSurfacePoint(roofPointSequence);
    roofPointSequence += 1;
    if (!location) return marker;

    marker.__solatrixSurfaceIndex = location.surfaceIndex;
    marker.__solatrixPointIndex = location.pointIndex;

    marker.on('dragstart', () => {
      marker._map?.dragging?.disable?.();
      document.body.classList.add('solatrixVertexDragging');
    });

    marker.on('drag', () => {
      updateSharedSurfacePoint(marker);
      const surface = currentSurfaces()[marker.__solatrixSurfaceIndex];
      const polygon = roofPolygons.get(marker.__solatrixSurfaceIndex);
      if (surface?.latlngs && polygon) polygon.setLatLngs(surface.latlngs);
    });

    marker.on('dragend', () => {
      marker._map?.dragging?.enable?.();
      document.body.classList.remove('solatrixVertexDragging');
      updateSharedSurfacePoint(marker);
      rebuildSurfaceFromDraggedPoints(marker.__solatrixSurfaceIndex, marker._map || window.__solatrixLeafletMap, L);
    });

    return marker;
  };
}

function currentSurfaces() {
  return Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [];
}

function locateSurfacePoint(serial) {
  let offset = serial;
  const surfaces = currentSurfaces();
  for (let surfaceIndex = 0; surfaceIndex < surfaces.length; surfaceIndex += 1) {
    const pointCount = Array.isArray(surfaces[surfaceIndex]?.latlngs) ? surfaces[surfaceIndex].latlngs.length : 0;
    if (offset < pointCount) return { surfaceIndex, pointIndex: offset };
    offset -= pointCount;
  }
  return null;
}

function updateSharedSurfacePoint(marker) {
  const surface = currentSurfaces()[marker.__solatrixSurfaceIndex];
  if (!surface?.latlngs?.[marker.__solatrixPointIndex]) return;
  const point = marker.getLatLng();
  surface.latlngs[marker.__solatrixPointIndex] = { lat: point.lat, lng: point.lng };
}

function rebuildSurfaceFromDraggedPoints(surfaceIndex, map, L) {
  const surface = currentSurfaces()[surfaceIndex];
  if (!surface?.latlngs?.length || !map || !L) return;
  const points = surface.latlngs.map((point) => L.latLng(point.lat, point.lng));

  const clearButton = document.querySelector('[data-govmap-action="clear"]');
  const startButton = document.querySelector('[data-govmap-action="start"]');
  const finishButton = document.querySelector('[data-govmap-action="finish"]');
  if (!clearButton || !startButton || !finishButton) return;

  clearButton.click();
  startButton.click();
  points.forEach((latlng) => map.fire('click', { latlng }));
  finishButton.click();

  setTimeout(() => {
    const hint = document.querySelector('.solatrixMapHint');
    if (hint) {
      hint.textContent = 'הנקודות עודכנו. אפשר לגרור כל נקודה כחולה שוב כדי לדייק, או להמשיך לשלב הבא.';
      hint.classList.add('success');
    }
  }, 60);
}

function installMobileVertexStyles() {
  if (document.getElementById('solatrix-roof-vertex-edit-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-roof-vertex-edit-style';
  style.textContent = `
    .solatrixRoofPoint{
      width:14px!important;
      height:14px!important;
      margin-left:-7px!important;
      margin-top:-7px!important;
      cursor:grab!important;
      touch-action:none!important;
      background:#0b6fff!important;
      border:3px solid #fff!important;
      box-shadow:0 0 0 3px rgba(11,111,255,.28),0 5px 14px rgba(0,0,0,.28)!important;
    }
    .solatrixRoofPoint.first{
      width:16px!important;
      height:16px!important;
      margin-left:-8px!important;
      margin-top:-8px!important;
      background:#ff9d00!important;
    }
    .solatrixVertexDragging .leaflet-marker-icon{cursor:grabbing!important}
    @media(max-width:760px){
      .solatrixRoofPoint{
        width:20px!important;
        height:20px!important;
        margin-left:-10px!important;
        margin-top:-10px!important;
        border-width:4px!important;
      }
      .solatrixRoofPoint.first{
        width:22px!important;
        height:22px!important;
        margin-left:-11px!important;
        margin-top:-11px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function watchRoofEditor() {
  const refreshHint = () => {
    if (!(location.pathname || '').includes('/roof-marking')) return;
    const surfaces = currentSurfaces();
    if (!surfaces.length || document.body.classList.contains('solatrixDrawMode')) return;
    const hint = document.querySelector('.solatrixMapHint');
    if (!hint || hint.dataset.vertexEditingHint === 'true') return;
    hint.textContent = 'אפשר לגרור כל נקודה כחולה כדי לדייק את קווי המתאר. אין צורך למחוק ולסמן מחדש.';
    hint.classList.add('success');
    hint.dataset.vertexEditingHint = 'true';
  };

  const observer = new MutationObserver(refreshHint);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => setTimeout(refreshHint, 120));
  setInterval(refreshHint, 700);
  refreshHint();
}
