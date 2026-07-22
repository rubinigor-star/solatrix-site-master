// Single financial authority for Solatrix Roof Check.
// UI, CRM payloads and PDF generators must consume this module instead of
// reimplementing tariffs, VAT, payback or the 25-year projection.

export const ROOF_CHECK_DEFAULTS = Object.freeze({
  annualYieldKwhPerKwp: 1650,
  smallSystemMaxKwp: 15,
  residentialMaxKwp: 22.5,
  smallSystemPricePerKwp: 3200,
  standardSystemPricePerKwp: 2900,
  vatRate: 0.18,
  selfConsumptionShare: 0.35,
  selfConsumptionValuePerKwh: 0.64,
  gridExportTariffPerKwh: 0.48,
  commercialTariffPerKwh: 0.39,
  annualElectricityPriceGrowth: 0.04,
  annualPanelDegradation: 0.004,
  urbanBonusRatePerKwh: 0.06,
  urbanBonusYears: 10,
  projectionYears: 25,
});

export function calculateRoofCheckEconomics(input = {}, overrides = {}) {
  const cfg = { ...ROOF_CHECK_DEFAULTS, ...overrides };
  const systemSizeKwp = positiveNumber(input.systemSizeKwp ?? input.systemKw);
  const isCommercial = input.isCommercial === true || systemSizeKwp > cfg.residentialMaxKwp;

  if (!systemSizeKwp) return emptyResult(cfg, isCommercial);

  const pricePerKwp = systemSizeKwp <= cfg.smallSystemMaxKwp
    ? cfg.smallSystemPricePerKwp
    : cfg.standardSystemPricePerKwp;
  const annualProduction = systemSizeKwp * cfg.annualYieldKwhPerKwp;
  const monthlyBill = nonNegativeNumber(input.monthlyBill);
  const annualConsumption = !isCommercial && monthlyBill > 0
    ? (monthlyBill * 12) / cfg.selfConsumptionValuePerKwh
    : 0;

  let selfConsumedKwh = 0;
  if (!isCommercial) {
    const targetSelfConsumption = annualProduction * cfg.selfConsumptionShare;
    selfConsumedKwh = annualConsumption > 0
      ? Math.min(targetSelfConsumption, annualConsumption)
      : targetSelfConsumption;
  }
  const exportedKwh = Math.max(annualProduction - selfConsumedKwh, 0);
  const urbanEligible = input.urbanEligible === true;
  const yearlyProjection = [];
  let cumulativeIncome = 0;

  for (let year = 1; year <= cfg.projectionYears; year += 1) {
    const productionFactor = Math.pow(1 - cfg.annualPanelDegradation, year - 1);
    const productionKwh = annualProduction * productionFactor;
    const selfConsumedYearKwh = selfConsumedKwh * productionFactor;
    const exportedYearKwh = exportedKwh * productionFactor;
    const selfConsumptionRate = cfg.selfConsumptionValuePerKwh
      * Math.pow(1 + cfg.annualElectricityPriceGrowth, year - 1);
    const exportRate = (isCommercial ? cfg.commercialTariffPerKwh : cfg.gridExportTariffPerKwh)
      + (urbanEligible && year <= cfg.urbanBonusYears ? cfg.urbanBonusRatePerKwh : 0);
    const selfConsumptionSavings = isCommercial ? 0 : selfConsumedYearKwh * selfConsumptionRate;
    const exportIncome = exportedYearKwh * exportRate;
    const income = selfConsumptionSavings + exportIncome;
    cumulativeIncome += income;
    yearlyProjection.push({
      year,
      productionFactor,
      productionKwh,
      selfConsumedKwh: selfConsumedYearKwh,
      exportedKwh: exportedYearKwh,
      selfConsumptionRate,
      exportRate,
      selfConsumptionSavings,
      exportIncome,
      income,
      cumulativeIncome,
    });
  }

  const firstYear = yearlyProjection[0];
  const selfConsumptionSavings = firstYear.selfConsumptionSavings;
  const exportIncome = firstYear.exportIncome;
  const annualSavings = firstYear.income;
  const costBeforeVat = systemSizeKwp * pricePerKwp;
  const costWithVat = costBeforeVat * (1 + cfg.vatRate);
  const paybackBeforeVat = annualSavings > 0 ? costBeforeVat / annualSavings : 0;
  const paybackWithVat = annualSavings > 0 ? costWithVat / annualSavings : 0;
  const totalIncome25 = cumulativeIncome;
  const netProfit25 = totalIncome25 - costWithVat;
  const roi25 = costWithVat > 0 ? (netProfit25 / costWithVat) * 100 : 0;
  const effectiveTariff = annualProduction > 0 ? annualSavings / annualProduction : 0;
  const actualSelfConsumptionShare = annualProduction > 0 ? selfConsumedKwh / annualProduction : 0;
  const actualGridExportShare = 1 - actualSelfConsumptionShare;

  return {
    modelVersion: isCommercial ? 'commercial-v2' : 'residential-v2',
    isCommercial,
    urbanEligible,
    monthlyBill,
    systemSizeKwp,
    systemKw: systemSizeKwp,
    pricePerKwp,
    cost: costBeforeVat,
    costBeforeVat,
    costWithVat,
    annualProduction,
    annualConsumption,
    selfConsumptionShare: actualSelfConsumptionShare,
    gridExportShare: actualGridExportShare,
    selfUseShare: actualSelfConsumptionShare * 100,
    exportShare: actualGridExportShare * 100,
    selfConsumedKwh,
    selfConsumed: selfConsumedKwh,
    exportedKwh,
    exported: exportedKwh,
    selfConsumptionSavings,
    exportIncome,
    annualSavings,
    effectiveTariff,
    payback: paybackWithVat,
    paybackBeforeVat,
    paybackWithVat,
    yearlyProjection,
    annualRevenueByYear: yearlyProjection.map((item) => item.income),
    totalIncome25,
    gross25: totalIncome25,
    netProfit25,
    profit25: netProfit25,
    profit25WithVat: netProfit25,
    roi25,
    avgTariff25: totalIncome25 / Math.max(
      yearlyProjection.reduce((sum, item) => sum + item.productionKwh, 0),
      1,
    ),
    urbanBonusTotal: yearlyProjection.reduce((sum, item) => {
      const baseRate = isCommercial ? cfg.commercialTariffPerKwh : cfg.gridExportTariffPerKwh;
      return sum + item.exportedKwh * Math.max(item.exportRate - baseRate, 0);
    }, 0),
    assumptions: cfg,
  };
}

export function calculateResidentialEconomics(input = {}, overrides = {}) {
  return calculateRoofCheckEconomics({ ...input, isCommercial: false }, overrides);
}

export function calculateCommercialEconomics(input = {}, overrides = {}) {
  return calculateRoofCheckEconomics({ ...input, isCommercial: true }, overrides);
}

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
  const projectedIncome = (result.yearlyProjection || []).reduce((sum, item) => sum + item.income, 0);
  if (!close(projectedIncome, result.totalIncome25)) {
    issues.push('Projection income does not match the 25-year total.');
  }
  if (!close(result.totalIncome25 - result.costWithVat, result.netProfit25)) {
    issues.push('Net profit does not match income less VAT-inclusive cost.');
  }
  return { valid: issues.length === 0, issues };
}

export const validateResidentialEconomics = validateRoofCheckEconomics;
export const validateEconomics = validateRoofCheckEconomics;

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function emptyResult(cfg, isCommercial = false) {
  return {
    modelVersion: isCommercial ? 'commercial-v2' : 'residential-v2',
    isCommercial,
    urbanEligible: false,
    monthlyBill: 0,
    systemSizeKwp: 0,
    systemKw: 0,
    pricePerKwp: cfg.smallSystemPricePerKwp,
    cost: 0,
    costBeforeVat: 0,
    costWithVat: 0,
    annualProduction: 0,
    annualConsumption: 0,
    selfConsumptionShare: isCommercial ? 0 : cfg.selfConsumptionShare,
    gridExportShare: isCommercial ? 1 : 1 - cfg.selfConsumptionShare,
    selfUseShare: isCommercial ? 0 : cfg.selfConsumptionShare * 100,
    exportShare: isCommercial ? 100 : (1 - cfg.selfConsumptionShare) * 100,
    selfConsumedKwh: 0,
    selfConsumed: 0,
    exportedKwh: 0,
    exported: 0,
    selfConsumptionSavings: 0,
    exportIncome: 0,
    annualSavings: 0,
    effectiveTariff: 0,
    payback: 0,
    paybackBeforeVat: 0,
    paybackWithVat: 0,
    yearlyProjection: [],
    annualRevenueByYear: [],
    totalIncome25: 0,
    gross25: 0,
    netProfit25: 0,
    profit25: 0,
    profit25WithVat: 0,
    roi25: 0,
    avgTariff25: 0,
    urbanBonusTotal: 0,
    assumptions: cfg,
  };
}
