const FLAG = '__solatrixGovMapPointRenderFixV1';

function isMobileRoofMarking() {
  return location.pathname.includes('/roof-marking') && matchMedia('(max-width: 820px)').matches;
}

function diamondWkt(point, radius = 0.45) {
  const x = Number(point.x);
  const y = Number(point.y);
  return `POLYGON((${x} ${y + radius},${x + radius} ${y},${x} ${y - radius},${x - radius} ${y},${x} ${y + radius}))`;
}

function lineWkt(points) {
  return `LINESTRING(${points.map((point) => `${point.x} ${point.y}`).join(',')})`;
}

function polygonWkt(points) {
  const ring = [...points, points[0]];
  return `POLYGON((${ring.map((point) => `${point.x} ${point.y}`).join(',')}))`;
}

function render(points) {
  if (typeof window.govmap?.displayGeometries !== 'function') return;
  try { window.govmap.clearDrawings?.(); } catch {}
  if (!points.length) return;

  if (points.length >= 2) {
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

  window.govmap.displayGeometries({
    wkts: points.map((point) => diamondWkt(point)),
    names: points.map((_, index) => `solatrix-roof-point-${index + 1}`),
    geometryType: window.govmap.drawType?.Polygon ?? 3,
    defaultSymbol: { fillColor: [18,110,235,1], outlineColor: [255,255,255,1], outlineWidth: 2 },
    clearExisting: points.length < 2
  });
}

function install() {
  if (!isMobileRoofMarking()) return;
  const api = window.__solatrixGovMapManual;
  if (!api || api.__pointRenderFixed) return;

  const points = [];
  const originalAdd = api.addCenterPoint?.bind(api);
  const originalUndo = api.undoCenterPoint?.bind(api);
  const originalClear = api.clear?.bind(api);
  const originalRedraw = api.redraw?.bind(api);

  api.addCenterPoint = () => {
    const result = originalAdd?.();
    if (result?.ok && result.point) points.push({ x: Number(result.point.x), y: Number(result.point.y) });
    render(points);
    return result;
  };

  api.undoCenterPoint = () => {
    const result = originalUndo?.();
    points.pop();
    render(points);
    return result;
  };

  api.clear = () => {
    const result = originalClear?.();
    points.length = 0;
    render(points);
    return result;
  };

  api.redraw = () => {
    if (points.length) render(points);
    else originalRedraw?.();
  };

  api.__pointRenderFixed = true;
  try { window.govmap.clearDrawings?.(); } catch {}
}

if (!window[FLAG]) {
  window[FLAG] = true;
  install();
  addEventListener('pageshow', install);
  addEventListener('popstate', () => setTimeout(install, 50));
  setInterval(install, 250);
}
