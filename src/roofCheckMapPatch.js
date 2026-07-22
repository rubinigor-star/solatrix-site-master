import { buildFullPdfReport } from './pdfReport.js';
import { calculateRoofCheckEconomics } from './roofCheckEconomics.js';
import { buildRoofGeometry, polygonAreaM2 } from './lib/roofGeometry.js';
import { getRoofMapProvider } from './lib/roofMapProvider.js';

const PATCH_ID = 'solatrix-blue-point-roof-drawing-v4';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LOGO_SRC = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const GEOMETRY_KEY = 'solatrix_roof_geometry_v1';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const CONFIG = {
  productionPerKw: 1650,
  buyRate: 0.64,
  sellRate: 0.48,
  installCostPerKw: 2900,
  sqmPerKw: 7,
  panelKw: 0.63,
  usableRoofFactor: 0.82,
  vatRate: 0.18,
  homeSystemLimitKw: 22.5,
  defaultSelfUseShare: 0.4,
  electricityGrowthRate: 0.04,
  defaultPhone: '972542790088'
};

const patchState = {
  map: null,
  layerGroup: null,
  currentPoints: [],
  surfaces: [],
  drawing: false,
  autoDetecting: false,
  addressResolved: false,
  resolvedAddress: ''
};
const mapProvider = getRoofMapProvider();

function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('he-IL'); }
function formatMoney(value) { return '₪' + formatNumber(value); }
function publishSurfaces() {
  const surfaces = patchState.surfaces.map((surface) => ({ ...surface, latlngs: (surface.latlngs || []).map((point) => ({ ...point })) }));
  const geometry = buildRoofGeometry(surfaces, { address: getEnteredAddress(), provider: mapProvider.id });
  window.__solatrixRoofSurfaces = surfaces;
  window.__solatrixRoofGeometry = geometry;
  window.__solatrixRoofCoordinates = geometry.centroid;
  window.__solatrixRoofMapProvider = mapProvider.id;
  try { localStorage.setItem(GEOMETRY_KEY, JSON.stringify({ surfaces, geometry })); } catch {}
  window.dispatchEvent(new CustomEvent('solatrix:roof-geometry-changed', { detail: geometry }));
}

function restoreSurfaces() {
  if (patchState.surfaces.length) return;
  try {
    const saved = JSON.parse(localStorage.getItem(GEOMETRY_KEY) || 'null');
    if (!saved || saved.geometry?.address !== getEnteredAddress() || !Array.isArray(saved.surfaces)) return;
    patchState.surfaces = saved.surfaces.filter((surface) => Array.isArray(surface?.latlngs) && surface.latlngs.length >= 3);
    if (patchState.surfaces.length) publishSurfaces();
  } catch {}
}

function getEnteredAddress() {
  const current = document.querySelector('[data-field="address"]')?.value?.trim();
  if (current) return current;
  try { return localStorage.getItem(ADDRESS_KEY)?.trim() || ''; } catch { return ''; }
}

function rememberAddress(event) {
  const input = event.target?.closest?.('[data-field="address"]');
  if (!input) return;
  const nextAddress = String(input.value || '').trim();
  if (patchState.resolvedAddress && nextAddress !== patchState.resolvedAddress) {
    patchState.surfaces = [];
    patchState.currentPoints = [];
    patchState.drawing = false;
    patchState.addressResolved = false;
    patchState.resolvedAddress = '';
    try { localStorage.removeItem(GEOMETRY_KEY); } catch {}
    publishSurfaces();
  }
  try { localStorage.setItem(ADDRESS_KEY, nextAddress); } catch {}
}

function injectStyles() {
  if (document.getElementById(`${PATCH_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-style`;
  style.textContent = `
    .solatrixRealMapWrap{position:relative;width:100%;height:clamp(360px,52vh,620px);border-radius:30px;overflow:hidden;background:#e8ddd0;box-shadow:inset 0 0 0 1px rgba(47,35,22,.1)}
    .solatrixRealMap{position:absolute;inset:0;z-index:1;direction:ltr}
    .solatrixMapToolbar{position:absolute;z-index:3;right:16px;top:16px;display:flex;flex-wrap:wrap;gap:10px;direction:rtl;max-width:min(560px,calc(100% - 32px))}
    .solatrixMapToolbar button{border:0;border-radius:999px;padding:10px 15px;font-family:inherit;font-weight:900;cursor:pointer;background:#fff;color:#241a10;box-shadow:0 10px 24px rgba(25,18,10,.12)}
    .solatrixMapToolbar button.primary{background:linear-gradient(135deg,var(--orange,#f5a11a),var(--orange2,#ffbd55));color:#17100a}
    .solatrixMapToolbar button.danger{background:#fff1f1;color:#b02b2b}
    .solatrixMapToolbar button:disabled{opacity:.55;cursor:wait}
    .solatrixMapHint{position:absolute;z-index:3;right:16px;bottom:16px;max-width:min(620px,calc(100% - 32px));border-radius:22px;padding:13px 16px;background:rgba(255,255,255,.94);box-shadow:0 12px 28px rgba(30,20,10,.12);font-size:15px;font-weight:800;color:#4a3b2a;direction:rtl}
    .solatrixMapHint.success{background:rgba(232,251,242,.96);color:#16734a}
    .solatrixMapSurfaceList{position:absolute;z-index:3;left:16px;top:16px;display:grid;gap:8px;direction:rtl;max-width:260px}
    .solatrixMapSurfaceList div{border-radius:18px;background:rgba(255,255,255,.94);padding:10px 12px;font-size:14px;font-weight:900;color:#31251a;box-shadow:0 10px 22px rgba(25,18,10,.11)}
    .leaflet-container{font-family:inherit;background:#e8ddd0}
    .solatrixRoofPoint{width:9px!important;height:9px!important;border-radius:50%;background:#0b6fff;border:2px solid #fff;box-shadow:0 0 0 2px rgba(11,111,255,.35),0 4px 12px rgba(0,0,0,.25)}
    .solatrixRoofPoint.first{width:13px!important;height:13px!important;background:#ff9d00;box-shadow:0 0 0 3px rgba(255,157,0,.25),0 4px 12px rgba(0,0,0,.25)}
    .solatrixDrawMode .leaflet-container{cursor:crosshair!important}
    .mapPanel.solatrixMapInjected{background:transparent;padding:0;min-height:360px;overflow:hidden;cursor:default!important}
    .mapPanel.solatrixMapInjected::before,.mapPanel.solatrixMapInjected .scanPulse,.mapPanel.solatrixMapInjected .roofCanvas,.mapPanel.solatrixMapInjected .mapBadge{display:none!important}
    .markStatus.solatrixPatched{background:#eaf7ff;border:1px solid rgba(11,111,255,.2);color:#145ea8}
    .nextTextBtn[data-action="next"]:not([disabled]){background:linear-gradient(135deg,var(--orange,#f5a11a),var(--orange2,#ffbd55))!important;color:#17100a!important;box-shadow:0 12px 28px rgba(245,161,26,.22)!important}
    @media(max-width:760px){.solatrixRealMapWrap{height:460px;border-radius:24px}.solatrixMapToolbar{right:10px;left:10px;top:10px}.solatrixMapHint{right:10px;left:10px;bottom:10px}.solatrixMapSurfaceList{left:10px;top:auto;bottom:105px}}
  `;
  document.head.appendChild(style);
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = LEAFLET_CSS; document.head.appendChild(link);
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); existing.addEventListener('error', reject); return; }
    const script = document.createElement('script'); script.src = LEAFLET_JS; script.defer = true; script.onload = () => resolve(window.L); script.onerror = reject; document.head.appendChild(script);
  });
}

function getAddressCenter() {
  const address = getEnteredAddress().toLowerCase();
  if (address.includes('ירושלים') || address.includes('jerusalem')) return [31.778, 35.225];
  if (address.includes('תל') || address.includes('tel aviv')) return [32.0853, 34.7818];
  if (address.includes('חיפה') || address.includes('haifa') || address.includes('חרמון')) return [32.7937, 34.9892];
  if (address.includes('באר') || address.includes('beer')) return [31.2529, 34.7915];
  return [32.7937, 34.9892];
}

function surfaceFromLatLngs(latlngs, source = 'manual') {
  const normalized = latlngs
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  const area = Math.max(1, polygonAreaM2(normalized));
  return {
    id: patchState.surfaces.length + 1,
    name: `Roof ${patchState.surfaces.length + 1}`,
    area,
    orientation: 'South',
    factor: 1,
    source,
    points: normalized.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`).join(' '),
    latlngs: normalized
  };
}

function pointIcon(index) {
  return window.L.divIcon({
    className: `solatrixRoofPoint${index === 0 ? ' first' : ''}`,
    html: '',
    iconSize: index === 0 ? [13, 13] : [9, 9],
    iconAnchor: index === 0 ? [6, 6] : [4, 4]
  });
}

function drawSurfaces() {
  if (!patchState.layerGroup || !window.L) return;
  patchState.layerGroup.clearLayers();
  patchState.surfaces.forEach((surface) => {
    const latlngs = surface.latlngs.map((p) => window.L.latLng(p.lat, p.lng));
    window.L.polygon(latlngs, { color: '#0b6fff', weight: 2.5, opacity: 0.95, fillColor: '#0b6fff', fillOpacity: 0.3 }).addTo(patchState.layerGroup);
    latlngs.forEach((point, index) => window.L.marker(point, { icon: pointIcon(index) }).addTo(patchState.layerGroup));
  });

  patchState.currentPoints.forEach((point, index) => window.L.marker(point, { icon: pointIcon(index) }).addTo(patchState.layerGroup));
  if (patchState.currentPoints.length >= 3) {
    window.L.polygon(patchState.currentPoints, {
      color: '#0b6fff',
      weight: 2.5,
      dashArray: '6,5',
      fillColor: '#0b6fff',
      fillOpacity: 0.2
    }).addTo(patchState.layerGroup);
  } else if (patchState.currentPoints.length > 1) {
    window.L.polyline(patchState.currentPoints, { color: '#0b6fff', weight: 2.5, dashArray: '6,5' }).addTo(patchState.layerGroup);
  }
}

function hasReadyDraft() { return patchState.currentPoints.length >= 3; }
function canContinue() { return patchState.surfaces.length > 0 || hasReadyDraft(); }

function calculatePatchReport() {
  const draftArea = hasReadyDraft() ? polygonAreaM2(patchState.currentPoints) : 0;
  const roofArea = patchState.surfaces.reduce((sum, surface) => sum + Number(surface.area || 0), 0) + draftArea;
  const usableArea = roofArea * CONFIG.usableRoofFactor;
  const potentialKw = usableArea / CONFIG.sqmPerKw;
  const isCommercial = window.__solatrixRoofCheckState?.roofType === 'commercial';
  const systemKw = isCommercial ? potentialKw : Math.min(potentialKw, CONFIG.homeSystemLimitKw);
  const monthlyBill = Number(window.__solatrixRoofCheckState?.monthlyBill || document.querySelector('[data-field="monthlyBill"]')?.value || 850);
  const economics = calculateRoofCheckEconomics({ systemSizeKwp: systemKw, isCommercial, monthlyBill });
  const panels = Math.max(Math.floor(systemKw / CONFIG.panelKw), 1);
  return { ...economics, roofArea, usableArea, roofPotentialKw: potentialKw, systemKw, panels };
}

function updateMapText(message, success = false) {
  const hint = document.querySelector('.solatrixMapHint');
  if (hint) { hint.textContent = message; hint.classList.toggle('success', success); }
  const status = document.querySelector('.markStatus');
  if (status) {
    status.classList.add('solatrixPatched');
    if (patchState.surfaces.length) {
      const auto = patchState.surfaces.some((surface) => surface.source === 'auto');
      status.textContent = `${auto ? 'זוהה אוטומטית' : 'סומנו'} ${patchState.surfaces.length} שטחי גג — ${formatNumber(calculatePatchReport().roofArea)} מ״ר בסך הכל`;
    } else if (hasReadyDraft()) {
      status.textContent = `השטח נסגר ומודגש. לחצו על הנקודה הכתומה או על “סיימתי” כדי לשמור.`;
    } else if (patchState.currentPoints.length) {
      status.textContent = `נוספו ${patchState.currentPoints.length} נקודות. צריך לפחות 3 נקודות כדי לסגור שטח.`;
    } else {
      status.textContent = patchState.autoDetecting ? 'מאתרים את קווי המתאר של הבניין...' : 'לא זוהה שטח אוטומטי. אפשר לסמן ידנית את פינות הגג.';
    }
  }
  const nextBtn = document.querySelector('.nextTextBtn[data-action="next"]');
  if (nextBtn) {
    if (canContinue()) nextBtn.removeAttribute('disabled');
    else nextBtn.setAttribute('disabled', 'disabled');
  }
  const list = document.querySelector('.solatrixMapSurfaceList');
  if (list) list.innerHTML = patchState.surfaces.map((surface, index) => `<div>${surface.source === 'auto' ? 'זוהה אוטומטית' : `שטח ${index + 1}`}: ${formatNumber(surface.area)} מ״ר</div>`).join('');
}

function setStartButtonMode(replace = false) {
  const button = document.querySelector('[data-govmap-action="start"]');
  if (!button) return;
  button.dataset.replace = replace ? 'true' : 'false';
  button.textContent = replace ? 'תיקון ידני' : 'התחל סימון';
}

function startDrawing(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  const replaceExisting = event?.currentTarget?.dataset?.replace === 'true';
  if (replaceExisting) {
    patchState.surfaces = [];
    publishSurfaces();
  }
  patchState.drawing = true;
  patchState.currentPoints = [];
  document.body.classList.add('solatrixDrawMode');
  setStartButtonMode(false);
  updateMapText('מצב סימון פעיל: לחצו על פינות הגג לפי הסדר. אחרי 3 נקודות השטח ייסגר ויודגש אוטומטית.', false);
  drawSurfaces();
}

function finishDrawing(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  if (patchState.currentPoints.length < 3) { updateMapText('צריך לפחות 3 נקודות כדי לסיים שטח.', false); return false; }
  patchState.surfaces.push(surfaceFromLatLngs(patchState.currentPoints));
  patchState.currentPoints = [];
  patchState.drawing = false;
  document.body.classList.remove('solatrixDrawMode');
  publishSurfaces();
  drawSurfaces();
  updateMapText('השטח נסגר, הודגש ונשמר. אפשר להמשיך לשלב הבא.', true);
  return true;
}

function removeLastPoint(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  patchState.currentPoints.pop(); drawSurfaces(); updateMapText(`נותרו ${patchState.currentPoints.length} נקודות בסימון הנוכחי.`, false);
}

function clearAll(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  patchState.surfaces = [];
  patchState.currentPoints = [];
  patchState.drawing = false;
  patchState.addressResolved = true;
  document.body.classList.remove('solatrixDrawMode');
  setStartButtonMode(false);
  publishSurfaces();
  drawSurfaces();
  updateMapText('הסימון נוקה. לחצו “התחל סימון” וסמנו את פינות הגג.', false);
}

function ringFromGeoJson(geometry) {
  if (!geometry) return [];
  let rings = [];
  if (geometry.type === 'Polygon') rings = geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') rings = (geometry.coordinates || []).flatMap((polygon) => polygon || []);
  const candidates = rings
    .map((ring) => ring.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)))
    .map((ring) => {
      if (ring.length > 1) {
        const first = ring[0]; const last = ring[ring.length - 1];
        if (first.lat === last.lat && first.lng === last.lng) return ring.slice(0, -1);
      }
      return ring;
    })
    .filter((ring) => ring.length >= 3)
    .sort((a, b) => polygonAreaM2(b) - polygonAreaM2(a));
  return candidates[0] || [];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng; const yi = polygon[i].lat;
    const xj = polygon[j].lng; const yj = polygon[j].lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat)) && (point.lng < (xj - xi) * (point.lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function centroid(polygon) {
  return polygon.reduce((acc, point) => ({ lat: acc.lat + point.lat / polygon.length, lng: acc.lng + point.lng / polygon.length }), { lat: 0, lng: 0 });
}

function distanceMeters(a, b) {
  const earth = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeAddress(address) {
  const params = new URLSearchParams({
    q: address,
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'il',
    polygon_geojson: '1',
    addressdetails: '1',
    'accept-language': 'he'
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  const results = await response.json();
  if (!Array.isArray(results) || !results[0]) return null;
  return results[0];
}

async function queryNearbyBuildings(point) {
  const query = `[out:json][timeout:14];way(around:90,${point.lat},${point.lng})["building"];out geom;`;
  let lastError = null;
  for (const endpoint of OVERPASS_URLS) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Overpass failed: ${response.status}`);
      const payload = await response.json();
      return (payload.elements || [])
        .map((element) => (element.geometry || []).map((node) => ({ lat: Number(node.lat), lng: Number(node.lon) })))
        .map((ring) => {
          if (ring.length > 1) {
            const first = ring[0]; const last = ring[ring.length - 1];
            if (first.lat === last.lat && first.lng === last.lng) return ring.slice(0, -1);
          }
          return ring;
        })
        .filter((ring) => ring.length >= 3)
        .filter((ring) => {
          const area = polygonAreaM2(ring);
          return area >= 12 && area <= 100000;
        });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function chooseBuilding(point, polygons) {
  if (!polygons.length) return [];
  const containing = polygons.filter((polygon) => pointInPolygon(point, polygon));
  const candidates = containing.length ? containing : polygons;
  return candidates
    .map((polygon) => ({ polygon, distance: distanceMeters(point, centroid(polygon)), area: polygonAreaM2(polygon) }))
    .filter((candidate) => containing.length || candidate.distance <= 90)
    .sort((a, b) => a.distance - b.distance || b.area - a.area)[0]?.polygon || [];
}

async function autoDetectRoof(panel) {
  if (patchState.autoDetecting || patchState.addressResolved || patchState.surfaces.length) return;
  const address = getEnteredAddress();
  if (!address) {
    patchState.addressResolved = true;
    updateMapText('לא נמצאה כתובת שמורה. אפשר לסמן את הגג ידנית.', false);
    return;
  }

  patchState.autoDetecting = true;
  patchState.resolvedAddress = address;
  const startButton = panel.querySelector('[data-govmap-action="start"]');
  if (startButton) startButton.disabled = true;
  updateMapText(`מאתרים אוטומטית את קווי המתאר של הבניין בכתובת: ${address}`, false);

  try {
    const result = await geocodeAddress(address);
    if (!result) throw new Error('Address not found');
    const point = { lat: Number(result.lat), lng: Number(result.lon) };
    let polygon = ringFromGeoJson(result.geojson);

    if (polygon.length < 3 || polygonAreaM2(polygon) < 12) {
      const buildings = await queryNearbyBuildings(point);
      polygon = chooseBuilding(point, buildings);
    }

    patchState.map.setView([point.lat, point.lng], mapProvider.maxZoom);
    if (polygon.length < 3) {
      patchState.addressResolved = true;
      updateMapText('מצאנו את הכתובת, אבל לא נמצאו קווי מתאר אמינים של הבניין. סמנו את הגג ידנית.', false);
      return;
    }

    patchState.surfaces = [surfaceFromLatLngs(polygon, 'auto')];
    patchState.addressResolved = true;
    publishSurfaces();
    drawSurfaces();
    patchState.map.fitBounds(window.L.latLngBounds(polygon.map((p) => [p.lat, p.lng])).pad(0.35), { maxZoom: mapProvider.maxZoom });
    setStartButtonMode(true);
    updateMapText('זיהינו וסימנו אוטומטית את שטח הבניין. בדקו שהמסגרת הכחולה נכונה; לתיקון לחצו “תיקון ידני”.', true);
  } catch (error) {
    console.warn('Automatic building outline failed', error);
    patchState.addressResolved = true;
    updateMapText('לא הצלחנו לזהות את קווי המתאר אוטומטית. אפשר לסמן את הגג ידנית בכמה לחיצות.', false);
  } finally {
    patchState.autoDetecting = false;
    if (startButton) startButton.disabled = false;
  }
}

function patchReportScreen() {
  if (!patchState.surfaces.length) return;
  const report = calculatePatchReport();
  const reportCard = document.querySelector('.reportCard');
  if (!reportCard) return;
  const title = reportCard.querySelector('h2'); if (title) title.textContent = `הגג מתאים למערכת של כ-${report.systemKw.toFixed(1)} kW`;
  const heroStrong = reportCard.querySelector('.reportHeroGraphic strong'); if (heroStrong) heroStrong.textContent = formatMoney(report.annualSavings);
  const cells = [...reportCard.querySelectorAll('.resultsGrid > div')];
  const values = [formatMoney(report.costBeforeVat), formatMoney(report.costWithVat), `${formatNumber(report.roofArea)} m²`, `${formatNumber(report.usableArea)} m²`, `${report.panels}`, `${formatNumber(report.annualProduction)} kWh`, `₪${report.effectiveTariff.toFixed(3)}`, formatMoney(report.annualSavings), `${report.paybackBeforeVat.toFixed(1)} שנים`, `${report.paybackWithVat.toFixed(1)} שנים`, formatMoney(report.gross25), formatMoney(report.profit25WithVat)];
  cells.forEach((cell, index) => { const b = cell.querySelector('b'); if (b && values[index]) b.textContent = values[index]; });
  const pdfBtn = reportCard.querySelector('[data-action="generatePdf"]');
  if (pdfBtn && pdfBtn.dataset.blueMapPdf !== 'true') {
    pdfBtn.dataset.blueMapPdf = 'true';
    pdfBtn.addEventListener('click', (event) => {
      event.preventDefault(); event.stopImmediatePropagation();
      const html = buildFullPdfReport({ report, state: { address: getEnteredAddress(), leadName: document.querySelector('[data-field="leadName"]')?.value || '', leadPhone: document.querySelector('[data-field="leadPhone"]')?.value || '', monthlyBill: window.__solatrixRoofCheckState?.monthlyBill || 850 }, config: CONFIG, logoSrc: LOGO_SRC, formatNumber, formatMoney });
      const win = window.open('', '_blank'); if (!win) return; win.document.open(); win.document.write(html); win.document.close();
    }, true);
  }
}

async function installMapIntoOriginalScreen() {
  const panel = document.querySelector('.mapPanel.interactiveMap');
  if (!panel || panel.dataset.govmapInstalled === 'true') return;
  injectStyles();
  restoreSurfaces();
  panel.dataset.govmapInstalled = 'true';
  panel.classList.add('solatrixMapInjected');
  panel.removeAttribute('data-action');
  panel.innerHTML = `<div class="solatrixRealMapWrap"><div id="solatrix-real-roof-map" class="solatrixRealMap"></div><div class="solatrixMapToolbar"><button class="primary" data-govmap-action="start">התחל סימון</button><button data-govmap-action="finish">סיים שטח</button><button data-govmap-action="undo">בטל נקודה</button><button class="danger" data-govmap-action="clear">נקה הכל</button></div><div class="solatrixMapSurfaceList"></div><div class="solatrixMapHint">מאתרים את הגג לפי הכתובת שהוזנה...</div></div>`;
  const L = await loadLeaflet();
  const center = getAddressCenter();
  if (patchState.map) {
    try { patchState.map.remove(); } catch {}
  }
  patchState.map = L.map('solatrix-real-roof-map', { zoomControl: true, attributionControl: true, maxZoom: mapProvider.maxZoom, doubleClickZoom: false }).setView(center, 18);
  L.tileLayer(mapProvider.tileUrl, { maxZoom: mapProvider.maxZoom, attribution: mapProvider.attribution }).addTo(patchState.map);
  patchState.layerGroup = L.layerGroup().addTo(patchState.map);
  patchState.map.on('click', (event) => {
    if (!patchState.drawing) return;
    if (patchState.currentPoints.length >= 3) {
      const first = patchState.map.latLngToContainerPoint(patchState.currentPoints[0]);
      const clicked = patchState.map.latLngToContainerPoint(event.latlng);
      if (first.distanceTo(clicked) <= 20) {
        finishDrawing();
        return;
      }
    }
    patchState.currentPoints.push(event.latlng);
    drawSurfaces();
    updateMapText(patchState.currentPoints.length >= 3
      ? `נוספה נקודה ${patchState.currentPoints.length}. השטח נסגר ומודגש אוטומטית; לחצו על הנקודה הכתומה לסיום.`
      : `נוספה נקודה ${patchState.currentPoints.length}.`, false);
  });
  patchState.map.on('dblclick', () => {
    if (hasReadyDraft()) finishDrawing();
  });
  panel.querySelector('[data-govmap-action="start"]').addEventListener('click', startDrawing);
  panel.querySelector('[data-govmap-action="finish"]').addEventListener('click', finishDrawing);
  panel.querySelector('[data-govmap-action="undo"]').addEventListener('click', removeLastPoint);
  panel.querySelector('[data-govmap-action="clear"]').addEventListener('click', clearAll);
  drawSurfaces();
  if (patchState.surfaces.length) {
    const allPoints = patchState.surfaces.flatMap((surface) => surface.latlngs || []);
    if (allPoints.length) patchState.map.fitBounds(L.latLngBounds(allPoints.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: mapProvider.maxZoom });
    setStartButtonMode(patchState.surfaces.some((surface) => surface.source === 'auto'));
    updateMapText('הסימון הקודם נטען. בדקו את המסגרת הכחולה והמשיכו.', true);
  } else {
    updateMapText('מאתרים את קווי המתאר של הבניין לפי הכתובת...', false);
    autoDetectRoof(panel);
  }
  setTimeout(() => patchState.map.invalidateSize(), 150);
}

function patchOriginalButtons() {
  document.addEventListener('click', (event) => {
    const nextBtn = event.target.closest('.nextTextBtn[data-action="next"]');
    if (nextBtn && (window.location.pathname || '').includes('/roof-marking') && hasReadyDraft()) {
      finishDrawing();
      return;
    }
    if (event.target.closest('.solatrixRealMapWrap') || event.target.closest('[data-govmap-action]')) return;
    const markBtn = event.target.closest('[data-action="markRoof"]');
    if (markBtn && document.querySelector('.mapPanel.interactiveMap')) {
      event.preventDefault(); event.stopImmediatePropagation(); startDrawing(event);
    }
  }, true);
}

function tick() {
  const path = window.location.pathname || '';
  if (path.includes('/roof-marking')) installMapIntoOriginalScreen().catch((error) => console.warn('Solatrix map patch failed', error));
  if (path.includes('/report')) patchReportScreen();
}

function watchRouter() {
  const pushState = history.pushState;
  history.pushState = function (...args) { const result = pushState.apply(this, args); setTimeout(tick, 80); return result; };
  window.addEventListener('popstate', () => setTimeout(tick, 80));
  setInterval(tick, 700);
}

document.addEventListener('input', rememberAddress, true);
patchOriginalButtons();
watchRouter();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
