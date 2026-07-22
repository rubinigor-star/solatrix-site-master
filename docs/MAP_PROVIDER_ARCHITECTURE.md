# Roof map provider boundary

The current Roof Check map remains the existing Leaflet flow. Address lookup uses Nominatim, optional building outlines use Overpass, and the aerial layer uses the existing Esri World Imagery configuration. No GovMap token is read, added, or required by this stage.

`src/lib/roofMapProvider.js` is the provider boundary. The map asks this module for tile URL, attribution, and supported zoom instead of embedding provider details in the calculator. A future GovMap API adapter can be registered there without changing drawing, area calculation, CRM persistence, or PDF generation.

`src/lib/roofGeometry.js` is provider-independent. It converts the existing roof surfaces into a GeoJSON `FeatureCollection` and calculates:

- area in square metres;
- centroid coordinates;
- bounding coordinates;
- one closed polygon feature per marked roof surface.

The browser keeps this geometry with the selected address, sends it in debounced lead activity, stores it in the existing lead metadata, stores the full geometry in the completed report `roof_data`, exposes it in CRM, and prints the centroid coordinates in PDF Version 2.

The current imagery source is retained as-is. This implementation makes no claim that a future GovMap API would improve imagery quality; that must be verified against an actual approved API and layer before switching providers.
