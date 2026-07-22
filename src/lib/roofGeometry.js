export function polygonAreaM2(points = []) {
  const normalized = normalizePoints(points);
  if (normalized.length < 3) return 0;
  const earth = 6378137;
  const latitude = normalized.reduce((sum, point) => sum + point.lat, 0) / normalized.length * Math.PI / 180;
  const projected = normalized.map((point) => ({
    x: earth * point.lng * Math.PI / 180 * Math.cos(latitude),
    y: earth * point.lat * Math.PI / 180
  }));
  const twiceArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(twiceArea / 2);
}

export function buildRoofGeometry(surfaces = [], options = {}) {
  const features = surfaces.map((surface, index) => {
    const points = normalizePoints(surface?.latlngs);
    if (points.length < 3) return null;
    const area = polygonAreaM2(points);
    const ring = points.map((point) => [point.lng, point.lat]);
    ring.push([...ring[0]]);
    return {
      type: 'Feature',
      properties: {
        id: surface.id || index + 1,
        name: surface.name || `Roof ${index + 1}`,
        source: surface.source || 'manual',
        areaM2: area
      },
      geometry: { type: 'Polygon', coordinates: [ring] }
    };
  }).filter(Boolean);

  const allPoints = features.flatMap((feature) => feature.geometry.coordinates[0].slice(0, -1));
  const centroid = allPoints.length ? {
    lat: allPoints.reduce((sum, point) => sum + point[1], 0) / allPoints.length,
    lng: allPoints.reduce((sum, point) => sum + point[0], 0) / allPoints.length
  } : null;
  const bounds = allPoints.length ? {
    west: Math.min(...allPoints.map((point) => point[0])),
    south: Math.min(...allPoints.map((point) => point[1])),
    east: Math.max(...allPoints.map((point) => point[0])),
    north: Math.max(...allPoints.map((point) => point[1]))
  } : null;

  return {
    provider: options.provider || 'existing-imagery',
    address: String(options.address || ''),
    areaM2: features.reduce((sum, feature) => sum + feature.properties.areaM2, 0),
    centroid,
    bounds,
    geojson: { type: 'FeatureCollection', features }
  };
}

export function coordinateText(geometry, precision = 5) {
  const lat = Number(geometry?.centroid?.lat);
  const lng = Number(geometry?.centroid?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(precision)}, ${lng.toFixed(precision)}` : '';
}

function normalizePoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}
