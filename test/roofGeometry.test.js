import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoofGeometry, coordinateText, polygonAreaM2 } from '../src/lib/roofGeometry.js';

const square = [
  { lat: 32.00000, lng: 34.00000 },
  { lat: 32.00000, lng: 34.00010 },
  { lat: 32.00010, lng: 34.00010 },
  { lat: 32.00010, lng: 34.00000 }
];

test('roof polygon area is calculated in square metres', () => {
  const area = polygonAreaM2(square);
  assert.ok(area > 100 && area < 120);
});

test('roof surfaces are serialized as closed GeoJSON polygons', () => {
  const result = buildRoofGeometry([{ id: 1, source: 'manual', latlngs: square }], { address: 'Haifa' });
  const ring = result.geojson.features[0].geometry.coordinates[0];
  assert.deepEqual(ring[0], ring.at(-1));
  assert.equal(result.address, 'Haifa');
  assert.ok(result.areaM2 > 100);
  assert.deepEqual(result.bounds, { west: 34, south: 32, east: 34.0001, north: 32.0001 });
});

test('geometry exposes stable coordinates for CRM and PDF', () => {
  const result = buildRoofGeometry([{ latlngs: square }]);
  assert.equal(coordinateText(result), '32.00005, 34.00005');
});
