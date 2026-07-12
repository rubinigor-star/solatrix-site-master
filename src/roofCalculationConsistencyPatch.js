const ROOF_TYPE_KEY = 'solatrix_roof_type';
const MONTHLY_BILL_KEY = 'solatrix_monthly_bill';
const ADDRESS_KEY = 'solatrix_roof_check_address';

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
  electricityGrowthRate: 0.04
};

let applying = false;
let lastSignature = '';

function readStored(key, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, String(value ?? '')); } catch {}
}

function rememberCalculatorInput(event) {
  const field = event.target?.dataset?.field;
  if (field === 'monthlyBill') writeStored(MONTHLY_BILL_KEY, event.target.value);
  if (field === 'address') writeStored(ADDRESS_KEY, event.target.value);
}

function rememberRoofType(event) {
  const action = event.target?.closest?.('[data-action^="roof:"]')?.dataset?.action;
  if (!action) return;
  writeStored(ROOF_TYPE_KEY, action.split(':')[1] || 'flat');
}

function syncVisibleRoofType() {
  const selected = document.querySelector('.roofOption.selected[data-action^="roof:"]');
  if (!selected) return;
  writeStored(ROOF_TYPE_KEY, selected.dataset.action.split(':')[1] || 'flat');
}

function calculatorState() {
  const roofType = readStored(ROOF_TYPE_KEY, 'flat');
  const monthlyBill = Math.max(0, Number(readStored(MONTHLY_BILL_KEY, '850')) || 850);
  const address = readStored(ADDRESS_KEY, '');
  const state = { roofType, monthlyBill, address };
  window.__solatrixRoofCheckState = { ...(window.__solatrixRoofCheckState || {}), ...state };
  return state;
}

function calculate() {
  const surfaces = Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [];
  const roofArea = surfaces.reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
  if (!(roofArea > 0)) return null;

  const { roofType, monthlyBill, address } = calculatorState();
  const usableArea = roofArea * CONFIG.usableRoofFactor;
  const roofPotentialKw = usableArea / CONFIG.sqmPerKw;
  const isCommercial = roofType === 'commercial';
  const systemKw = isCommercial
    ? roofPotentialKw
    : Math.min(roofPotentialKw, CONFIG.homeSystemLimitKw);
  const annualProduction = systemKw * CONFIG.productionPerKw;
  const annualConsumption = (monthlyBill * 12) / CONFIG.buyRate;
  const selfConsumed = Math.min(annualProduction * CONFIG.defaultSelfUseShare, annualConsumption);
  const exported = Math.max(annualProduction - selfConsumed, 0);
  const annualSavings = selfConsumed * CONFIG.buyRate + exported * CONFIG.sellRate;
  const effectiveTariff = annualSavings / Math.max(annualProduction, 1);
  const costBeforeVat = systemKw * CONFIG.installCostPerKw;
  const costWithVat = costBeforeVat * (1 + CONFIG.vatRate);
  const paybackBeforeVat = costBeforeVat / Math.max(annualSavings, 1);
  const paybackWithVat = costWithVat / Math.max(annualSavings, 1);
  let gross25 = 0;
  for (let year = 0; year < 25; year += 1) {
    gross25 += selfConsumed * CONFIG.buyRate * Math.pow(1 + CONFIG.electricityGrowthRate, year) + exported * CONFIG.sellRate;
  }
  const profit25WithVat = gross25 - costWithVat;
  const panels = Math.max(Math.floor(systemKw / CONFIG.panelKw), 1);

  const report = {
    roofType,
    address,
    monthlyBill,
    roofArea,
    usableArea,
    roofPotentialKw,
    systemKw,
    annualProduction,
    annualConsumption,
    selfConsumed,
    exported,
    annualSavings,
    effectiveTariff,
    costBeforeVat,
    costWithVat,
    paybackBeforeVat,
    paybackWithVat,
    gross25,
    profit25WithVat,
    panels,
    limitApplied: !isCommercial && roofPotentialKw > CONFIG.homeSystemLimitKw
  };

  window.__solatrixRoofCalculation = report;
  return report;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('he-IL');
}

function formatMoney(value) {
  return `₪${formatNumber(value)}`;
}

function ensureHiddenContext(reportCard, report) {
  let context = reportCard.querySelector('[data-solatrix-report-context]');
  if (!context) {
    context = document.createElement('div');
    context.dataset.solatrixReportContext = 'true';
    context.hidden = true;
    context.innerHTML = '<input data-field="address"><input data-field="monthlyBill"><input data-field="roofType">';
    reportCard.appendChild(context);
  }
  context.querySelector('[data-field="address"]').value = report.address || '';
  context.querySelector('[data-field="monthlyBill"]').value = String(report.monthlyBill || '');
  context.querySelector('[data-field="roofType"]').value = report.roofType;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function applyReport() {
  if (applying || !(location.pathname || '').includes('/report')) return;
  const reportCard = document.querySelector('.reportCard');
  if (!reportCard) return;
  const report = calculate();
  if (!report) return;

  const signature = [
    report.roofType,
    report.monthlyBill,
    report.roofArea.toFixed(2),
    report.systemKw.toFixed(3),
    report.annualSavings.toFixed(2)
  ].join('|');

  applying = true;
  try {
    const title = reportCard.querySelector('h2');
    setText(title, `הגג מתאים למערכת של כ-${report.systemKw.toFixed(1)} kW`);

    const hero = [...reportCard.querySelectorAll('.reportHeroGraphic > div')];
    setText(hero[0]?.querySelector('strong'), formatMoney(report.annualSavings));
    setText(hero[0]?.querySelector('span'), 'חיסכון שנתי');
    setText(hero[1]?.querySelector('strong'), report.paybackWithVat.toFixed(1));
    setText(hero[1]?.querySelector('span'), 'החזר כולל מע״מ');

    const rows = [...reportCard.querySelectorAll('.resultsGrid > div')];
    const values = [
      ['עלות לפני מע״מ', formatMoney(report.costBeforeVat)],
      ['עלות כולל מע״מ', formatMoney(report.costWithVat)],
      ['ייצור שנתי', `${formatNumber(report.annualProduction)} kWh`],
      ['ערך קוט״ש ממוצע', `₪${report.effectiveTariff.toFixed(3)}`],
      ['החזר לפני מע״מ', `${report.paybackBeforeVat.toFixed(1)} שנים`],
      ['רווח 25 שנים', formatMoney(report.profit25WithVat)]
    ];
    rows.forEach((row, index) => {
      const item = values[index];
      if (!item) return;
      setText(row.querySelector('span'), item[0]);
      setText(row.querySelector('b'), item[1]);
    });

    reportCard.dataset.roofType = report.roofType;
    reportCard.dataset.systemKw = report.systemKw.toFixed(3);
    reportCard.dataset.calculationSignature = signature;
    ensureHiddenContext(reportCard, report);
    lastSignature = signature;
  } finally {
    applying = false;
  }
}

function tick() {
  syncVisibleRoofType();
  calculatorState();
  applyReport();
}

document.addEventListener('input', rememberCalculatorInput, true);
document.addEventListener('click', rememberRoofType, true);

const observer = new MutationObserver(() => {
  if (!applying && (location.pathname || '').includes('/report')) queueMicrotask(applyReport);
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

window.addEventListener('popstate', () => setTimeout(tick, 50));
setInterval(tick, 250);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
