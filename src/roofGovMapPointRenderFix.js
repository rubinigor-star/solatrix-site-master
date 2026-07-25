const FLAG = '__solatrixGovMapPointRenderFixV8';

function isMobileRoofMarking() {
  return location.pathname.includes('/roof-marking') && matchMedia('(max-width: 820px)').matches;
}

function lineWkt(points) {
  return `LINESTRING(${points.map((point) => `${point.x} ${point.y}`).join(',')})`;
}

function polygonWkt(points) {
  const ring = [...points, points[0]];
  return `POLYGON((${ring.map((point) => `${point.x} ${point.y}`).join(',')}))`;
}

function firstPointWkt(point, radius = 0.35) {
  const x = Number(point.x);
  const y = Number(point.y);
  return `POLYGON((${x} ${y + radius},${x + radius} ${y},${x} ${y - radius},${x - radius} ${y},${x} ${y + radius}))`;
}

function clearVisuals() {
  try { window.govmap?.clearDrawings?.(); } catch {}
  try {
    window.govmap?.displayGeometries?.({
      wkts: ['LINESTRING(0 0,0.001 0.001)'],
      names: ['solatrix-empty-outline'],
      geometryType: window.govmap.drawType?.Polyline ?? 2,
      defaultSymbol: { outlineColor: [0,0,0,0], outlineWidth: 0 },
      clearExisting: true
    });
  } catch {}
}

function renderFirstPoint(point) {
  if (!point || typeof window.govmap?.displayGeometries !== 'function') return;
  window.govmap.displayGeometries({
    wkts: [firstPointWkt(point)],
    names: ['solatrix-first-roof-point'],
    geometryType: window.govmap.drawType?.Polygon ?? 3,
    defaultSymbol: {
      fillColor: [220,38,38,0.95],
      outlineColor: [255,255,255,0.95],
      outlineWidth: 1
    },
    clearExisting: true
  });
}

function renderOutline(points) {
  if (typeof window.govmap?.displayGeometries !== 'function') return;
  clearVisuals();
  if (!points.length) return;

  if (points.length === 1) {
    renderFirstPoint(points[0]);
    return;
  }

  const closed = points.length >= 3;
  window.govmap.displayGeometries({
    wkts: [closed ? polygonWkt(points) : lineWkt(points)],
    names: ['solatrix-roof-outline'],
    geometryType: closed ? (window.govmap.drawType?.Polygon ?? 3) : (window.govmap.drawType?.Polyline ?? 2),
    defaultSymbol: closed
      ? { fillColor: [18,110,235,0.08], outlineColor: [18,110,235,0.9], outlineWidth: 3 }
      : { outlineColor: [18,110,235,0.9], outlineWidth: 3 },
    clearExisting: true
  });
}

function redrawReliably(points) {
  renderOutline(points);
  setTimeout(() => renderOutline(points), 100);
  setTimeout(() => renderOutline(points), 300);
}

function clearReliably() {
  clearVisuals();
  setTimeout(clearVisuals, 60);
  setTimeout(clearVisuals, 180);
  setTimeout(clearVisuals, 420);
}

function withoutGovMapPointRendering(callback) {
  const display = window.govmap?.displayGeometries;
  if (typeof display !== 'function') return callback?.();

  window.govmap.displayGeometries = function filteredDisplay(options = {}) {
    const type = Number(options.geometryType);
    const pointType = Number(window.govmap.drawType?.Point ?? 1);
    const containsPointWkt = Array.isArray(options.wkts) && options.wkts.some((wkt) => /^\s*POINT\s*\(/i.test(String(wkt)));
    if (type === pointType || containsPointWkt) return undefined;
    return display.call(window.govmap, options);
  };

  try {
    return callback?.();
  } finally {
    window.govmap.displayGeometries = display;
  }
}

function install() {
  if (!isMobileRoofMarking()) return;
  const api = window.__solatrixGovMapManual;
  if (!api || api.__pointRenderFixedV8) return;

  const points = [];
  const originalAdd = api.addCenterPoint?.bind(api);
  const originalUndo = api.undoCenterPoint?.bind(api);
  const originalClear = api.clear?.bind(api);

  api.addCenterPoint = () => {
    const result = withoutGovMapPointRendering(() => originalAdd?.());
    if (result?.ok && result.point) points.push({ x: Number(result.point.x), y: Number(result.point.y) });
    redrawReliably(points);
    return result;
  };

  api.undoCenterPoint = () => {
    if (points.length) points.pop();
    const result = withoutGovMapPointRendering(() => originalUndo?.());
    points.length ? redrawReliably(points) : clearReliably();
    return result;
  };

  api.clear = () => {
    points.length = 0;
    const result = originalClear?.();
    clearReliably();
    return result;
  };

  api.redraw = () => points.length ? redrawReliably(points) : clearReliably();
  api.__pointRenderFixedV8 = true;
  clearReliably();
}

if (!window[FLAG]) {
  window[FLAG] = true;
  install();
  addEventListener('pageshow', install);
  addEventListener('popstate', () => setTimeout(install, 50));
  setInterval(install, 250);
}
