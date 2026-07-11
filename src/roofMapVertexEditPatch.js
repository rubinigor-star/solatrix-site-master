const PATCH_FLAG = '__solatrixRoofVertexEditingInstalledV2';

if (!window[PATCH_FLAG]) {
  window[PATCH_FLAG] = true;
  installLeafletHook();
  installVertexStyles();
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
    }, 40);
  }
}

function patchLeaflet(L) {
  if (!L || L.__solatrixVertexEditingPatchedV2) return;
  L.__solatrixVertexEditingPatchedV2 = true;

  let roofPointSequence = 0;
  let roofPolygonSequence = 0;
  let draftPolygon = null;
  let draftPoints = [];
  let rebuilding = false;
  const savedPolygons = new Map();

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
      draftPolygon = null;
      draftPoints = [];
      savedPolygons.clear();
      return originalClearLayers.apply(this, args);
    };
  }

  const originalPolygonFactory = L.polygon;
  L.polygon = function (latlngs, options = {}) {
    const polygon = originalPolygonFactory.call(this, latlngs, options);
    if (options?.color !== '#0b6fff') return polygon;

    const surfaces = currentSurfaces();
    if (roofPolygonSequence < surfaces.length) {
      savedPolygons.set(roofPolygonSequence, polygon);
    } else {
      draftPolygon = polygon;
    }
    roofPolygonSequence += 1;
    return polygon;
  };

  const originalMarkerFactory = L.marker;
  L.marker = function (latlng, options = {}) {
    const className = options?.icon?.options?.className || '';
    const isRoofPoint = className.includes('solatrixRoofPoint');
    const marker = originalMarkerFactory.call(this, latlng, isRoofPoint
      ? { ...options, draggable: true, keyboard: false, autoPan: true }
      : options);

    if (!isRoofPoint) return marker;

    const savedPointCount = totalSavedPointCount();
    const serial = roofPointSequence;
    roofPointSequence += 1;

    if (serial < savedPointCount) {
      const location = locateSavedSurfacePoint(serial);
      if (!location) return marker;
      marker.__solatrixPointKind = 'saved';
      marker.__solatrixSurfaceIndex = location.surfaceIndex;
      marker.__solatrixPointIndex = location.pointIndex;
    } else {
      const draftIndex = serial - savedPointCount;
      marker.__solatrixPointKind = 'draft';
      marker.__solatrixPointIndex = draftIndex;
      draftPoints[draftIndex] = L.latLng(latlng);
    }

    marker.on('dragstart', () => {
      marker._map?.dragging?.disable?.();
      document.body.classList.add('solatrixVertexDragging');
    });

    marker.on('drag', () => {
      updatePoint(marker, L);
      updateVisiblePolygon(marker);
    });

    marker.on('dragend', () => {
      marker._map?.dragging?.enable?.();
      document.body.classList.remove('solatrixVertexDragging');
      updatePoint(marker, L);
      updateVisiblePolygon(marker);
      if (!rebuilding) rebuildAllGeometry(marker._map || window.__solatrixLeafletMap, L, marker.__solatrixPointKind === 'draft');
    });

    return marker;
  };

  function updateVisiblePolygon(marker) {
    if (marker.__solatrixPointKind === 'saved') {
      const surface = currentSurfaces()[marker.__solatrixSurfaceIndex];
      const polygon = savedPolygons.get(marker.__solatrixSurfaceIndex);
      if (surface?.latlngs && polygon) polygon.setLatLngs(surface.latlngs);
      return;
    }
    if (draftPolygon && draftPoints.length >= 3) draftPolygon.setLatLngs(draftPoints.filter(Boolean));
  }

  function rebuildAllGeometry(map, leaflet, keepDraftOpen) {
    const clearButton = document.querySelector('[data-govmap-action="clear"]');
    const startButton = document.querySelector('[data-govmap-action="start"]');
    const finishButton = document.querySelector('[data-govmap-action="finish"]');
    if (!map || !clearButton || !startButton || !finishButton) return;

    const savedSnapshot = currentSurfaces()
      .map((surface) => (surface.latlngs || []).map((point) => leaflet.latLng(point.lat, point.lng)))
      .filter((points) => points.length >= 3);
    const draftSnapshot = draftPoints.filter(Boolean).map((point) => leaflet.latLng(point.lat, point.lng));

    rebuilding = true;
    clearButton.click();

    savedSnapshot.forEach((points) => {
      startButton.click();
      points.forEach((point) => map.fire('click', { latlng: point }));
      finishButton.click();
    });

    if (keepDraftOpen && draftSnapshot.length) {
      startButton.click();
      draftSnapshot.forEach((point) => map.fire('click', { latlng: point }));
    }

    rebuilding = false;
    setTimeout(() => {
      const hint = document.querySelector('.solatrixMapHint');
      if (hint) {
        hint.textContent = keepDraftOpen
          ? 'הנקודה הוזזה. אפשר להמשיך לגרור נקודות או לסיים את השטח.'
          : 'הנקודה הוזזה והשטח עודכן. אפשר לגרור כל נקודה שוב כדי לדייק.';
        hint.classList.add('success');
      }
    }, 80);
  }
}

function currentSurfaces() {
  return Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [];
}

function totalSavedPointCount() {
  return currentSurfaces().reduce((sum, surface) => sum + (Array.isArray(surface?.latlngs) ? surface.latlngs.length : 0), 0);
}

function locateSavedSurfacePoint(serial) {
  let offset = serial;
  const surfaces = currentSurfaces();
  for (let surfaceIndex = 0; surfaceIndex < surfaces.length; surfaceIndex += 1) {
    const pointCount = Array.isArray(surfaces[surfaceIndex]?.latlngs) ? surfaces[surfaceIndex].latlngs.length : 0;
    if (offset < pointCount) return { surfaceIndex, pointIndex: offset };
    offset -= pointCount;
  }
  return null;
}

function updatePoint(marker, L) {
  const point = marker.getLatLng();
  if (marker.__solatrixPointKind === 'saved') {
    const surface = currentSurfaces()[marker.__solatrixSurfaceIndex];
    if (!surface?.latlngs?.[marker.__solatrixPointIndex]) return;
    surface.latlngs[marker.__solatrixPointIndex] = { lat: point.lat, lng: point.lng };
    return;
  }

  if (!window.__solatrixRoofDraftPoints) window.__solatrixRoofDraftPoints = [];
  window.__solatrixRoofDraftPoints[marker.__solatrixPointIndex] = L.latLng(point.lat, point.lng);
}

function installVertexStyles() {
  if (document.getElementById('solatrix-roof-vertex-edit-style-v2')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-roof-vertex-edit-style-v2';
  style.textContent = `
    .solatrixRoofPoint{
      width:16px!important;
      height:16px!important;
      margin-left:-8px!important;
      margin-top:-8px!important;
      cursor:grab!important;
      touch-action:none!important;
      background:#0b6fff!important;
      border:3px solid #fff!important;
      box-shadow:0 0 0 4px rgba(11,111,255,.28),0 5px 14px rgba(0,0,0,.28)!important;
      z-index:1000!important;
    }
    .solatrixRoofPoint.first{
      width:18px!important;
      height:18px!important;
      margin-left:-9px!important;
      margin-top:-9px!important;
      background:#ff9d00!important;
    }
    .solatrixVertexDragging .leaflet-marker-icon{cursor:grabbing!important}
    @media(max-width:760px){
      .solatrixRoofPoint{
        width:28px!important;
        height:28px!important;
        margin-left:-14px!important;
        margin-top:-14px!important;
        border-width:5px!important;
        box-shadow:0 0 0 5px rgba(11,111,255,.26),0 6px 16px rgba(0,0,0,.3)!important;
      }
      .solatrixRoofPoint.first{
        width:30px!important;
        height:30px!important;
        margin-left:-15px!important;
        margin-top:-15px!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function watchRoofEditor() {
  const refreshHint = () => {
    if (!(location.pathname || '').includes('/roof-marking')) return;
    const hasSaved = currentSurfaces().length > 0;
    const hasDraft = document.querySelectorAll('.solatrixRoofPoint').length > 0;
    if ((!hasSaved && !hasDraft) || document.body.classList.contains('solatrixVertexDragging')) return;
    const hint = document.querySelector('.solatrixMapHint');
    if (!hint || hint.dataset.vertexEditingHintV2 === 'true') return;
    hint.textContent = 'לחצו והחזיקו נקודה כחולה, ואז גררו אותה למיקום המדויק. אפשר להזיז גם סימון אוטומטי וגם סימון ידני.';
    hint.classList.add('success');
    hint.dataset.vertexEditingHintV2 = 'true';
  };

  const observer = new MutationObserver(refreshHint);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', () => setTimeout(refreshHint, 120));
  setInterval(refreshHint, 500);
  refreshHint();
}
