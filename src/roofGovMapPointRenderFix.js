const FLAG = '__solatrixGovMapPointRenderFixV2';

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

function renderOutline(points) {
  if (typeof window.govmap?.displayGeometries !== 'function') return;
  try { window.govmap.clearDrawings?.(); } catch {}
  if (points.length < 2) return;

  const closed = points.length >= 3;
  window.govmap.displayGeometries({
    wkts: [closed ? polygonWkt(points) : lineWkt(points)],
    names: ['solatrix-roof-outline'],
    geometryType: closed ? (window.govmap.drawType?.Polygon ?? 3) : (window.govmap.drawType?.Polyline ?? 2),
    defaultSymbol: closed
      ? { fillColor: [18,110,235,0.12], outlineColor: [18,110,235,1], outlineWidth: 4 }
      : { outlineColor: [18,110,235,1], outlineWidth: 4 },
    clearExisting: true
  });
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
  if (!api || api.__pointRenderFixedV2) return;

  const points = [];
  const originalAdd = api.addCenterPoint?.bind(api);
  const originalUndo = api.undoCenterPoint?.bind(api);
  const originalClear = api.clear?.bind(api);

  api.addCenterPoint = () => {
    const result = withoutGovMapPointRendering(() => originalAdd?.());
    if (result?.ok && result.point) points.push({ x: Number(result.point.x), y: Number(result.point.y) });
    renderOutline(points);
    return result;
  };

  api.undoCenterPoint = () => {
    const result = withoutGovMapPointRendering(() => originalUndo?.());
    points.pop();
    renderOutline(points);
    return result;
  };

  api.clear = () => {
    const result = originalClear?.();
    points.length = 0;
    try { window.govmap.clearDrawings?.(); } catch {}
    return result;
  };

  api.redraw = () => renderOutline(points);
  api.__pointRenderFixedV2 = true;
  try { window.govmap.clearDrawings?.(); } catch {}
}

if (!window[FLAG]) {
  window[FLAG] = true;
  install();
  addEventListener('pageshow', install);
  addEventListener('popstate', () => setTimeout(install, 50));
  setInterval(install, 250);
}
