export const SOLAR_DEFAULTS = {
  productionPerKw: 1650,
  buyRate: 0.64,
  sellRate: 0.48,
  installCostPerKw: 2900,
  sqmPerKw: 7,
  panelKw: 0.63,
  usableRoofFactor: 0.82,
  yearlyTariffGrowth: 0.04,
  yearlyPanelDegradation: 0.005
};

export function calculateSurface(surface, config = SOLAR_DEFAULTS) {
  const usableArea = Math.max(Number(surface.area || 0) * config.usableRoofFactor, 0);
  const kw = usableArea / config.sqmPerKw;
  const panels = Math.max(Math.floor(kw / config.panelKw), 1);
  return { usableArea, kw, panels };
}

export function calculateRoofReport(input, config = SOLAR_DEFAULTS) {
  const surfaces = input.surfaces || [];
  const monthlyBill = Number(input.monthlyBill || 0);
  const systemKw = surfaces.reduce((sum, surface) => sum + calculateSurface(surface, config).kw, 0);
  const annualProduction = systemKw * config.productionPerKw;
  const annualConsumption = (monthlyBill * 12) / config.buyRate;
  const selfConsumed = Math.min(annualProduction * 0.45, annualConsumption);
  const exported = Math.max(annualProduction - selfConsumed, 0);
  const annualBenefit = selfConsumed * config.buyRate + exported * config.sellRate;
  const effectiveTariff = annualBenefit / Math.max(annualProduction, 1);
  const cost = systemKw * config.installCostPerKw;
  const payback = cost / Math.max(annualBenefit, 1);
  const panels = surfaces.reduce((sum, surface) => sum + calculateSurface(surface, config).panels, 0);
  const roofArea = surfaces.reduce((sum, surface) => sum + Number(surface.area || 0), 0);
  const usableArea = surfaces.reduce((sum, surface) => sum + calculateSurface(surface, config).usableArea, 0);
  return { systemKw, annualProduction, annualConsumption, selfConsumed, exported, annualBenefit, effectiveTariff, cost, payback, panels, roofArea, usableArea };
}
