// Centralized calculation model for Solatrix Roof Check.
// The approved report layout stays independent from these assumptions.

export const ROOF_CHECK_DEFAULTS = Object.freeze({
  annualYieldKwhPerKwp: 1650,
  smallSystemMaxKwp: 15,
  residentialMaxKwp: 22.5,
  smallSystemPricePerKwp: 3200,
  standardSystemPricePerKwp: 2900,
  vatRate: 0.18,
  selfConsumptionShare: 0.35,
  gridExportShare: 0.65,
  selfConsumptionValuePerKwh: 0.64,
  gridExportTariffPerKwh: 0.48,
  commercialTariffPerKwh: 0.39,
  annualPanelDegradation: 0.004,
  projectionYears: 25,
});

export function calculateRoofCheckEconomics(input = {}, overrides = {}) {
  const cfg = { ...ROOF_CHECK_DEFAULTS, ...overrides };
  const systemSizeKwp = positiveNumber(input.systemSizeKwp);
  const isCommercial = input.isCommercial === true || systemSizeKwp > cfg.residentialMaxKwp;

  if (!systemSizeKwp) return emptyResult(cfg, isCommercial);

  const pricePerKwp = systemSizeKwp <= cfg.smallSystemMaxKwp
    ? cfg.smallSystemPricePerKwp
    : cfg.standardSystemPricePerKwp;
  const annualProduction = systemSizeKwp * cfg.annualYieldKwhPerKwp;

  let selfConsumedKwh = 0;
  let exportedKwh = annualProduction;
  let selfConsumptionSavings = 0;
  let exportIncome = 0;

  if (isCommercial) {
    exportIncome = annualProduction * cfg.commercialTariffPerKwh;
  } else {
    selfConsumedKwh = annualProduction * cfg.selfConsumptionShare;
    exportedKwh = annualProduction * cfg.gridExportShare;
    selfConsumptionSavings = selfConsumedKwh * cfg.selfConsumptionValuePerKwh;
    exportIncome = exportedKwh * cfg.gridExportTariffPerKwh;
  }

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

  const totalIncome25 = cumulativeIncome;
  const netProfit25 = totalIncome25 - costWithVat;
  const roi25 = costWithVat > 0 ? (netProfit25 / costWithVat) * 100 : 0;

  return {
    modelVersion: isCommercial ? 'commercial-v1' : 'residential-v1',
    isCommercial,
    systemSizeKwp,
    pricePerKwp,
    costBeforeVat,
    costWithVat,
    annualProduction,
    selfConsumptionShare: isCommercial ? 0 : cfg.selfConsumptionShare,
    gridExportShare: isCommercial ? 1 : cfg.gridExportShare,
    selfConsumedKwh,
    exportedKwh,
    selfConsumptionSavings,
    exportIncome,
    annualSavings,
    paybackBeforeVat,
    paybackWithVat,
    yearlyProjection,
    totalIncome25,
    netProfit25,
    roi25,
    assumptions: cfg,
  };
}

export const calculateResidentialEconomics = calculateRoofCheckEconomics;

export function validateRoofCheckEconomics(result) {
  const issues = [];
  const close = (a, b, tolerance = 0.01) => Math.abs(Number(a) - Number(b)) <= tolerance;
  const cfg = result.assumptions || ROOF_CHECK_DEFAULTS;

  if (!close(result.selfConsumptionShare + result.gridExportShare, 1, 0.0001)) {
    issues.push('Energy shares must total 100%.');
  }
  if (!close(result.selfConsumedKwh + result.exportedKwh, result.annualProduction)) {
    issues.push('Energy split does not match annual production.');
  }
  if (!close(result.selfConsumptionSavings + result.exportIncome, result.annualSavings)) {
    issues.push('First-year financial components do not match annual savings.');
  }
  if (!close(result.costBeforeVat * (1 + cfg.vatRate), result.costWithVat)) {
    issues.push('VAT calculation is inconsistent.');
  }
  if (result.yearlyProjection?.length !== cfg.projectionYears) {
    issues.push('Projection length is inconsistent.');
  }
  return { valid: issues.length === 0, issues };
}

export const validateResidentialEconomics = validateRoofCheckEconomics;

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function emptyResult(cfg, isCommercial = false) {
  return {
    modelVersion: isCommercial ? 'commercial-v1' : 'residential-v1',
    isCommercial,
    systemSizeKwp: 0,
    pricePerKwp: cfg.smallSystemPricePerKwp,
    costBeforeVat: 0,
    costWithVat: 0,
    annualProduction: 0,
    selfConsumptionShare: isCommercial ? 0 : cfg.selfConsumptionShare,
    gridExportShare: isCommercial ? 1 : cfg.gridExportShare,
    selfConsumedKwh: 0,
    exportedKwh: 0,
    selfConsumptionSavings: 0,
    exportIncome: 0,
    annualSavings: 0,
    paybackBeforeVat: 0,
    paybackWithVat: 0,
    yearlyProjection: [],
    totalIncome25: 0,
    netProfit25: 0,
    roi25: 0,
    assumptions: cfg,
  };
}
