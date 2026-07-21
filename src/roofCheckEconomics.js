// Centralized calculation model for Solatrix Roof Check.
// All assumptions live here so they can be tested and changed without redesigning the PDF.

export const ROOF_CHECK_DEFAULTS = Object.freeze({
  annualYieldKwhPerKwp: 1650,
  smallSystemMaxKwp: 15,
  smallSystemPricePerKwp: 3200,
  standardSystemPricePerKwp: 2900,
  vatRate: 0.18,
  selfConsumptionShare: 0.35,
  gridExportShare: 0.65,
  selfConsumptionValuePerKwh: 0.64,
  gridExportTariffPerKwh: 0.48,
  annualPanelDegradation: 0.004,
  projectionYears: 25,
});

export function calculateResidentialEconomics(input = {}, overrides = {}) {
  const cfg = { ...ROOF_CHECK_DEFAULTS, ...overrides };
  const systemSizeKwp = positiveNumber(input.systemSizeKwp);

  if (!systemSizeKwp) {
    return emptyResult(cfg);
  }

  const pricePerKwp = systemSizeKwp <= cfg.smallSystemMaxKwp
    ? cfg.smallSystemPricePerKwp
    : cfg.standardSystemPricePerKwp;

  const annualProduction = systemSizeKwp * cfg.annualYieldKwhPerKwp;
  const selfConsumedKwh = annualProduction * cfg.selfConsumptionShare;
  const exportedKwh = annualProduction * cfg.gridExportShare;
  const selfConsumptionSavings = selfConsumedKwh * cfg.selfConsumptionValuePerKwh;
  const exportIncome = exportedKwh * cfg.gridExportTariffPerKwh;
  const annualSavings = selfConsumptionSavings + exportIncome;
  const costBeforeVat = systemSizeKwp * pricePerKwp;
  const costWithVat = costBeforeVat * (1 + cfg.vatRate);
  const paybackBeforeVat = annualSavings > 0 ? costBeforeVat / annualSavings : 0;
  const paybackWithVat = annualSavings > 0 ? costWithVat / annualSavings : 0;

  const yearlyProjection = [];
  let cumulativeIncome = 0;
  for (let year = 1; year <= cfg.projectionYears; year += 1) {
    const productionFactor = Math.pow(1 - cfg.annualPanelDegradation, year - 1);
    const productionKwh = annualProduction * productionFactor;
    const income = annualSavings * productionFactor;
    cumulativeIncome += income;
    yearlyProjection.push({ year, productionKwh, income, cumulativeIncome });
  }

  return {
    modelVersion: 'residential-v1',
    systemSizeKwp,
    pricePerKwp,
    costBeforeVat,
    costWithVat,
    annualProduction,
    selfConsumptionShare: cfg.selfConsumptionShare,
    gridExportShare: cfg.gridExportShare,
    selfConsumedKwh,
    exportedKwh,
    selfConsumptionSavings,
    exportIncome,
    annualSavings,
    paybackBeforeVat,
    paybackWithVat,
    yearlyProjection,
    assumptions: cfg,
  };
}

export function validateResidentialEconomics(result) {
  const issues = [];
  const close = (a, b, tolerance = 0.01) => Math.abs(Number(a) - Number(b)) <= tolerance;

  if (!close(result.selfConsumptionShare + result.gridExportShare, 1, 0.0001)) {
    issues.push('Energy shares must total 100%.');
  }
  if (!close(result.selfConsumedKwh + result.exportedKwh, result.annualProduction)) {
    issues.push('Energy split does not match annual production.');
  }
  if (!close(result.selfConsumptionSavings + result.exportIncome, result.annualSavings)) {
    issues.push('First-year financial components do not match annual savings.');
  }
  if (!close(result.costBeforeVat * 1.18, result.costWithVat)) {
    issues.push('VAT calculation is inconsistent.');
  }
  return { valid: issues.length === 0, issues };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function emptyResult(cfg) {
  return {
    modelVersion: 'residential-v1',
    systemSizeKwp: 0,
    pricePerKwp: cfg.smallSystemPricePerKwp,
    costBeforeVat: 0,
    costWithVat: 0,
    annualProduction: 0,
    selfConsumptionShare: cfg.selfConsumptionShare,
    gridExportShare: cfg.gridExportShare,
    selfConsumedKwh: 0,
    exportedKwh: 0,
    selfConsumptionSavings: 0,
    exportIncome: 0,
    annualSavings: 0,
    paybackBeforeVat: 0,
    paybackWithVat: 0,
    yearlyProjection: [],
    assumptions: cfg,
  };
}
