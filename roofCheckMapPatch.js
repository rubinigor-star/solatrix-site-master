import { buildFullPdfReport } from './pdfReport.js';

const PATCH_ID = 'solatrix-blue-point-roof-drawing-v3';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LOGO_SRC = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';

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
  defaultPhone: '972547299727'
};

const patchState = { map: null, layerGroup: null, currentPoints: [], surfaces: [], drawing: false };

function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('he-IL'); }
function formatMoney(value) { return '₪' + formatNumber(value); }
function publishSurfaces() { window.__solatrixRoofSurfaces = patchState.surfaces.map((surface) => ({ ...surface })); }

function injectStyles() {
  if (document.getElementById(`${PATCH_ID}-style`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-style`;
  style.textContent = `
    .solatrixRealMapWrap{position:relative;width:100%;height:clamp(360px,52vh,620px);border-radius:30px;overflow:hidden;background:#e8ddd0;box-shadow:inset 0 0 0 1px rgba(47,35,22,.1)}
    .solatrixRealMap{position:absolute;inset:0;z-index:1;direction:ltr}
    .solatrixMapToolbar{position:absolute;z-index:3;right:16px;top:16px;display:flex;flex-wrap:wrap;gap:10px;direction:rtl;max-width:min(460px,calc(100% - 32px))}
    .solatrixMapToolbar button{border:0;border-radius:999px;padding:10px 15px;font-family:inherit;font-weight:900;cursor:pointer;background:#fff;color:#241a10;box-shadow:0 10px 24px rgba(25,18,10,.12)}
    .solatrixMapToolbar button.primary{background:linear-gradient(135deg,var(--orange,#f5a11a),var(--orange2,#ffbd55));color:#17100a}
    .solatrixMapToolbar button.danger{background:#fff1f1;color:#b02b2b}
    .solatrixMapHint{position:absolute;z-index:3;right:16px;bottom:16px;max-width:min(520px,calc(100% - 32px));border-radius:22px;padding:13px 16px;background:rgba(255,255,255,.92);box-shadow:0 12px 28px rgba(30,20,10,.12);font-size:15px;font-weight:800;color:#4a3b2a;direction:rtl}
    .solatrixMapHint.success{background:rgba(232,251,242,.95);color:#16734a}
    .solatrixMapSurfaceList{position:absolute;z-index:3;left:16px;top:16px;display:grid;gap:8px;direction:rtl;max-width:240px}
    .solatrixMapSurfaceList div{border-radius:18px;background:rgba(255,255,255,.92);padding:10px 12px;font-size:14px;font-weight:900;color:#31251a;box-shadow:0 10px 22px rgba(25,18,10,.11)}
    .leaflet-container{font-family:inherit;background:#e8ddd0}
    .solatrixRoofPoint{width:9px!important;height:9px!important;border-radius:50%;background:#0b6fff;border:2px solid #fff;box-shadow:0 0 0 2px rgba(11,111,255,.35),0 4px 12px rgba(0,0,0,.25)}
    .solatrixDrawMode .leaflet-container{cursor:crosshair!important}
    .mapPanel.solatrixMapInjected{background:transparent;padding:0;min-height:360px;overflow:hidden;cursor:default!important}
    .mapPanel.solatrixMapInjected::before,.mapPanel.solatrixMapInjected .scanPulse,.mapPanel.solatrixMapInjected .roofCanvas,.mapPanel.solatrixMapInjected .mapBadge{display:none!important}
    .markStatus.solatrixPatched{background:#eaf7ff;border:1px solid rgba(11,111,255,.2);color:#145ea8}
    .nextTextBtn[data-action="next"]:not([disabled]){background:linear-gradient(135deg,var(--orange,#f5a11a),var(--orange2,#ffbd55))!important;color:#17100a!important;box-shadow:0 12px 28px rgba(245,161,26,.22)!important}
    @media(max-width:760px){.solatrixRealMapWrap{height:460px;border-radius:24px}.solatrixMapToolbar{right:10px;left:10px;top:10px}.solatrixMapHint{right:10px;left:10px;bottom:10px}.solatrixMapSurfaceList{left:10px;top:auto;bottom:88px}}
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
  const address = (document.querySelector('[data-field="address"]')?.value || '').toLowerCase();
  if (address.includes('ירושלים') || address.includes('jerusalem')) return [31.778, 35.225];
  if (address.includes('תל') || address.includes('tel aviv')) return [32.0853, 34.7818];
  if (address.includes('חיפה') || address.includes('haifa') || address.includes('חרמון')) return [32.7937, 34.9892];
  if (address.includes('באר') || address.includes('beer')) return [31.2529, 34.7915];
  return [32.7937, 34.9892];
}

function polygonAreaM2(latlngs) {
  if (!latlngs || latlngs.length < 3) return 0;
  const earth = 6378137;
  const lat0 = latlngs.reduce((sum, p) => sum + p.lat, 0) / latlngs.length * Math.PI / 180;
  const pts = latlngs.map((p) => ({ x: earth * p.lng * Math.PI / 180 * Math.cos(lat0), y: earth * p.lat * Math.PI / 180 }));
  let sum = 0;
  pts.forEach((p, i) => { const n = pts[(i + 1) % pts.length]; sum += p.x * n.y - n.x * p.y; });
  return Math.abs(sum / 2);
}

function surfaceFromLatLngs(latlngs) {
  const area = Math.max(1, polygonAreaM2(latlngs));
  return { id: patchState.surfaces.length + 1, name: `Roof ${patchState.surfaces.length + 1}`, area, orientation: 'South', factor: 1, points: latlngs.map((p) => `${p.lat.toFixed(7)},${p.lng.toFixed(7)}`).join(' '), latlngs: latlngs.map((p) => ({ lat: p.lat, lng: p.lng })) };
}

function drawSurfaces() {
  if (!patchState.layerGroup || !window.L) return;
  patchState.layerGroup.clearLayers();
  patchState.surfaces.forEach((surface) => {
    const latlngs = surface.latlngs.map((p) => window.L.latLng(p.lat, p.lng));
    window.L.polygon(latlngs, { color: '#0b6fff', weight: 2, opacity: 0.95, fillColor: '#0b6fff', fillOpacity: 0.28 }).addTo(patchState.layerGroup);
    latlngs.forEach((point) => window.L.marker(point, { icon: window.L.divIcon({ className: 'solatrixRoofPoint', html: '', iconSize: [9, 9], iconAnchor: [4, 4] }) }).addTo(patchState.layerGroup));
  });
  patchState.currentPoints.forEach((point) => window.L.marker(point, { icon: window.L.divIcon({ className: 'solatrixRoofPoint', html: '', iconSize: [9, 9], iconAnchor: [4, 4] }) }).addTo(patchState.layerGroup));
  if (patchState.currentPoints.length > 1) window.L.polyline(patchState.currentPoints, { color: '#0b6fff', weight: 2, dashArray: '5,5' }).addTo(patchState.layerGroup);
}

function hasReadyDraft() { return patchState.currentPoints.length >= 3; }
function canContinue() { return patchState.surfaces.length > 0 || hasReadyDraft(); }

function calculatePatchReport() {
  const roofArea = patchState.surfaces.reduce((sum, surface) => sum + Number(surface.area || 0), 0);
  const usableArea = roofArea * CONFIG.usableRoofFactor;
  const potentialKw = usableArea / CONFIG.sqmPerKw;
  const systemKw = Math.min(potentialKw, CONFIG.homeSystemLimitKw);
  const annualProduction = systemKw * CONFIG.productionPerKw;
  const monthlyBill = Number(document.querySelector('[data-field="monthlyBill"]')?.value || 850);
  const annualConsumption = (monthlyBill * 12) / CONFIG.buyRate;
  const selfConsumed = Math.min(annualProduction * CONFIG.defaultSelfUseShare, annualConsumption);
  const exported = Math.max(annualProduction - selfConsumed, 0);
  const annualSavings = selfConsumed * CONFIG.buyRate + exported * CONFIG.sellRate;
  const effectiveTariff = annualSavings / Math.max(annualProduction, 1);
  const selfUseShare = annualProduction ? selfConsumed / annualProduction * 100 : 0;
  const exportShare = Math.max(0, 100 - selfUseShare);
  const costBeforeVat = systemKw * CONFIG.installCostPerKw;
  const costWithVat = costBeforeVat * (1 + CONFIG.vatRate);
  const paybackBeforeVat = costBeforeVat / Math.max(annualSavings, 1);
  const paybackWithVat = costWithVat / Math.max(annualSavings, 1);
  let gross25 = 0;
  for (let y = 0; y < 25; y += 1) gross25 += selfConsumed * CONFIG.buyRate * Math.pow(1 + CONFIG.electricityGrowthRate, y) + exported * CONFIG.sellRate;
  const profit25WithVat = gross25 - costWithVat;
  const panels = Math.max(Math.floor(systemKw / CONFIG.panelKw), 1);
  return { roofArea, usableArea, roofPotentialKw: potentialKw, systemKw, annualProduction, annualSavings, effectiveTariff, selfUseShare, exportShare, cost: costBeforeVat, costBeforeVat, costWithVat, payback: paybackWithVat, paybackBeforeVat, paybackWithVat, gross25, profit25: profit25WithVat, profit25WithVat, panels };
}

function updateMapText(message, success = false) {
  const hint = document.querySelector('.solatrixMapHint');
  if (hint) { hint.textContent = message; hint.classList.toggle('success', success); }
  const status = document.querySelector('.markStatus');
  if (status) {
    status.classList.add('solatrixPatched');
    if (patchState.surfaces.length) status.textContent = `סומנו ${patchState.surfaces.length} שטחי גג — ${formatNumber(calculatePatchReport().roofArea)} מ״ר בסך הכל`;
    else if (hasReadyDraft()) status.textContent = `סומנו ${patchState.currentPoints.length} נקודות. אפשר ללחוץ “סיימתי” כדי לשמור את שטח הגג ולהמשיך.`;
    else if (patchState.currentPoints.length) status.textContent = `נוספו ${patchState.currentPoints.length} נקודות. צריך לפחות 3 נקודות כדי להמשיך.`;
    else status.textContent = 'עדיין לא סומן שטח גג. התחילו סימון ולחצו על פינות הגג.';
  }
  const nextBtn = document.querySelector('.nextTextBtn[data-action="next"]');
  if (nextBtn) {
    if (canContinue()) nextBtn.removeAttribute('disabled');
    else nextBtn.setAttribute('disabled', 'disabled');
  }
  const list = document.querySelector('.solatrixMapSurfaceList');
  if (list) list.innerHTML = patchState.surfaces.map((surface, index) => `<div>שטח ${index + 1}: ${formatNumber(surface.area)} מ״ר</div>`).join('');
}

function startDrawing(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  patchState.drawing = true;
  patchState.currentPoints = [];
  document.body.classList.add('solatrixDrawMode');
  updateMapText('מצב סימון פעיל: לחצו על פינות הגג. אחרי 3 נקודות אפשר ללחוץ “סיימתי”.', false);
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
  updateMapText('השטח נשמר. אפשר להמשיך לשלב הבא.', true);
  return true;
}

function removeLastPoint(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  patchState.currentPoints.pop(); drawSurfaces(); updateMapText(`נותרו ${patchState.currentPoints.length} נקודות בסימון הנוכחי.`, false);
}
function clearAll(event) {
  event?.preventDefault?.(); event?.stopPropagation?.();
  patchState.surfaces = []; patchState.currentPoints = []; patchState.drawing = false; document.body.classList.remove('solatrixDrawMode'); publishSurfaces(); drawSurfaces(); updateMapText('נוקה הסימון. התחילו סימון חדש.', false);
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
      const html = buildFullPdfReport({ report, state: { address: document.querySelector('[data-field="address"]')?.value || '', leadName: document.querySelector('[data-field="leadName"]')?.value || '', leadPhone: document.querySelector('[data-field="leadPhone"]')?.value || '', monthlyBill: document.querySelector('[data-field="monthlyBill"]')?.value || 850 }, config: CONFIG, logoSrc: LOGO_SRC, formatNumber, formatMoney });
      const win = window.open('', '_blank'); if (!win) return; win.document.open(); win.document.write(html); win.document.close();
    }, true);
  }
}

async function installMapIntoOriginalScreen() {
  const panel = document.querySelector('.mapPanel.interactiveMap');
  if (!panel || panel.dataset.govmapInstalled === 'true') return;
  injectStyles();
  panel.dataset.govmapInstalled = 'true';
  panel.classList.add('solatrixMapInjected');
  panel.removeAttribute('data-action');
  panel.innerHTML = `<div class="solatrixRealMapWrap"><div id="solatrix-real-roof-map" class="solatrixRealMap"></div><div class="solatrixMapToolbar"><button class="primary" data-govmap-action="start">התחל סימון</button><button data-govmap-action="finish">סיים שטח</button><button data-govmap-action="undo">בטל נקודה</button><button class="danger" data-govmap-action="clear">נקה הכל</button></div><div class="solatrixMapSurfaceList"></div><div class="solatrixMapHint">הזיזו וקרבו את המפה. לחצו “התחל סימון”, סמנו פינות, ואז “סיימתי”.</div></div>`;
  const L = await loadLeaflet();
  const center = getAddressCenter();
  patchState.map = L.map('solatrix-real-roof-map', { zoomControl: true, attributionControl: true, maxZoom: 20 }).setView(center, 18);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, attribution: 'Imagery © Esri' }).addTo(patchState.map);
  patchState.layerGroup = L.layerGroup().addTo(patchState.map);
  patchState.map.on('click', (event) => {
    if (!patchState.drawing) return;
    patchState.currentPoints.push(event.latlng);
    drawSurfaces();
    updateMapText(`נוספה נקודה ${patchState.currentPoints.length}.`, false);
  });
  panel.querySelector('[data-govmap-action="start"]').addEventListener('click', startDrawing);
  panel.querySelector('[data-govmap-action="finish"]').addEventListener('click', finishDrawing);
  panel.querySelector('[data-govmap-action="undo"]').addEventListener('click', removeLastPoint);
  panel.querySelector('[data-govmap-action="clear"]').addEventListener('click', clearAll);
  drawSurfaces(); updateMapText('המפה הוטענה. לחצו “התחל סימון”, ואז סמנו את פינות הגג בנקודות כחולות.', false);
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
patchOriginalButtons(); watchRouter();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
