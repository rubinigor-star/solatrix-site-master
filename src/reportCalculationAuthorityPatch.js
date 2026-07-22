import { calculateRoofCheckEconomics } from './roofCheckEconomics.js';

const PATCH_ID = 'solatrix-report-calculation-authority-v1';
const MANUAL_CHOICE_KEY = 'solatrix_urban_manual_choice_v1';
const MANUAL_IDENTITY_KEY = 'solatrix_urban_manual_identity_v1';
const OVERRIDE_MAP_KEY = 'solatrix_urban_bonus_override_v1';
const ADDRESS_KEY = 'solatrix_roof_check_address';

let applying = false;
let queued = false;

function readStored(key, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try {
    if (value === '' || value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {}
}

function readJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[׳״'"`.,()\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addressIdentity() {
  const address = normalize(readStored(ADDRESS_KEY, ''));
  if (address) return `address:${address}`;
  const center = surfaceCentroid();
  return center ? `point:${center.lat.toFixed(3)},${center.lng.toFixed(3)}` : 'current-report';
}

function surfaceCentroid() {
  const points = (Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [])
    .flatMap((surface) => surface?.latlngs || [])
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (!points.length) return null;
  return points.reduce((result, point) => ({
    lat: result.lat + point.lat / points.length,
    lng: result.lng + point.lng / points.length
  }), { lat: 0, lng: 0 });
}

function currentLocationKeys() {
  const keys = new Set();
  const center = surfaceCentroid();
  if (center) keys.add(`${center.lat.toFixed(4)},${center.lng.toFixed(4)}`);
  const address = normalize(readStored(ADDRESS_KEY, ''));
  if (address) keys.add(address);
  return [...keys];
}

function currentManualChoice() {
  const identity = addressIdentity();
  const storedIdentity = readStored(MANUAL_IDENTITY_KEY, '');
  if (storedIdentity && storedIdentity !== identity) {
    writeStored(MANUAL_CHOICE_KEY, '');
    writeStored(MANUAL_IDENTITY_KEY, identity);
    return '';
  }
  if (!storedIdentity) writeStored(MANUAL_IDENTITY_KEY, identity);
  const choice = readStored(MANUAL_CHOICE_KEY, '');
  return ['yes', 'no'].includes(choice) ? choice : '';
}

function persistChoice(choice) {
  const identity = addressIdentity();
  writeStored(MANUAL_IDENTITY_KEY, identity);
  writeStored(MANUAL_CHOICE_KEY, ['yes', 'no'].includes(choice) ? choice : '');
  syncOverrideMap(choice);
}

function syncOverrideMap(forcedChoice) {
  const choice = forcedChoice === undefined ? currentManualChoice() : forcedChoice;
  const overrides = readJson(OVERRIDE_MAP_KEY, {});
  currentLocationKeys().forEach((key) => {
    if (choice === 'yes' || choice === 'no') overrides[key] = choice;
    else delete overrides[key];
  });
  writeJson(OVERRIDE_MAP_KEY, overrides);
}

function recalculateForChoice(choice) {
  const model = window.__solatrixRoofCalculation;
  if (!model || !['yes', 'no'].includes(choice)) return;

  const eligible = choice === 'yes';
  const isCommercial = model.isCommercial === true;
  const economics = calculateRoofCheckEconomics({
    systemSizeKwp: Number(model.systemSizeKwp || model.systemKw || 0),
    isCommercial,
    monthlyBill: Number(model.monthlyBill || 0),
    urbanEligible: eligible
  });

  Object.assign(model, {
    ...economics,
    urbanEligible: eligible,
    urbanDetectionMode: 'manual'
  });
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('he-IL');
}

function formatMoney(value) {
  return `₪${formatNumber(value)}`;
}

function reportRows(model) {
  return [
    ['עלות לפני מע״מ', formatMoney(model.costBeforeVat)],
    ['עלות כולל מע״מ', formatMoney(model.costWithVat)],
    ['שטח גג מסומן', `${formatNumber(model.roofArea)} m²`],
    ['שטח גג שמיש', `${formatNumber(model.usableArea)} m²`],
    ['מספר פאנלים', formatNumber(model.panels)],
    ['ייצור שנתי', `${formatNumber(model.annualProduction)} kWh`],
    ['תעריף ממוצע בשנה 1', `₪${Number(model.effectiveTariff || 0).toFixed(3)}`],
    [model.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה', formatMoney(model.annualSavings)],
    ['החזר לפני מע״מ', `${Number(model.paybackBeforeVat || 0).toFixed(1)} שנים`],
    ['החזר כולל מע״מ', `${Number(model.paybackWithVat || 0).toFixed(1)} שנים`],
    [model.isCommercial ? 'הכנסה מצטברת ל-25 שנים' : 'ערך מצטבר ל-25 שנים', formatMoney(model.gross25)],
    ['רווח 25 שנים', formatMoney(model.profit25WithVat)]
  ];
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function applyAuthoritativeReport() {
  if (applying || !(location.pathname || '').includes('/report')) return;
  const card = document.querySelector('.reportCard');
  const model = window.__solatrixRoofCalculation;
  if (!card || !model) return;

  applying = true;
  try {
    const title = card.querySelector('h2');
    setText(title, `הגג מתאים למערכת של כ-${Number(model.systemKw || 0).toFixed(1)} kW`);

    const hero = [...card.querySelectorAll('.reportHeroGraphic > div')];
    setText(hero[0]?.querySelector('strong'), formatMoney(model.annualSavings));
    setText(hero[0]?.querySelector('span'), model.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה');
    setText(hero[1]?.querySelector('strong'), Number(model.paybackWithVat || 0).toFixed(1));
    setText(hero[1]?.querySelector('span'), 'החזר כולל מע״מ');

    const rows = reportRows(model);
    [...card.querySelectorAll('.resultsGrid > div')].forEach((row, index) => {
      if (!rows[index]) return;
      setText(row.querySelector('span'), rows[index][0]);
      setText(row.querySelector('b'), rows[index][1]);
    });

    const choice = currentManualChoice();
    card.querySelectorAll('[data-urban-override]').forEach((button) => {
      const value = button.dataset.urbanOverride || 'auto';
      const active = choice ? value === choice : value === 'auto';
      button.classList.toggle('active', active);
    });
    card.dataset.authoritativeCalculation = PATCH_ID;
  } finally {
    applying = false;
  }
}

function scheduleApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applyAuthoritativeReport();
  });
}

function handleChoice(event) {
  const button = event.target?.closest?.('[data-urban-override]');
  if (!button) return;
  const choice = button.dataset.urbanOverride || 'auto';
  persistChoice(choice);
  if (choice === 'yes' || choice === 'no') recalculateForChoice(choice);
  scheduleApply();
  setTimeout(scheduleApply, 50);
  setTimeout(scheduleApply, 450);
}

document.addEventListener('click', handleChoice, true);
document.addEventListener('input', (event) => {
  if (event.target?.dataset?.field !== 'address') return;
  writeStored(MANUAL_CHOICE_KEY, '');
  writeStored(MANUAL_IDENTITY_KEY, '');
}, true);

const observer = new MutationObserver(() => {
  if (!applying) scheduleApply();
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

setInterval(() => {
  if (!(location.pathname || '').includes('/report')) return;
  syncOverrideMap();
  applyAuthoritativeReport();
}, 120);

window.addEventListener('popstate', () => setTimeout(scheduleApply, 80));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleApply); else scheduleApply();
