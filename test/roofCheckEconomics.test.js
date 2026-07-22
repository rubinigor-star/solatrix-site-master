import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOF_CHECK_DEFAULTS,
  calculateCommercialEconomics,
  calculateResidentialEconomics,
  validateRoofCheckEconomics,
} from '../src/roofCheckEconomics.js';

const closeTo = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

test('residential pricing, VAT and first-year split use the central assumptions', () => {
  const result = calculateResidentialEconomics({ systemSizeKwp: 10, monthlyBill: 850 });
  assert.equal(result.modelVersion, 'residential-v2');
  assert.equal(result.pricePerKwp, 3200);
  assert.equal(result.costBeforeVat, 32000);
  assert.equal(result.costWithVat, 37760);
  assert.equal(result.annualProduction, 16500);
  closeTo(result.selfConsumedKwh, 5775);
  closeTo(result.exportedKwh, 10725);
  closeTo(result.annualSavings, 8844);
  closeTo(result.paybackWithVat, 37760 / 8844);
  assert.deepEqual(validateRoofCheckEconomics(result), { valid: true, issues: [] });
});

test('monthly consumption caps residential self-consumption', () => {
  const result = calculateResidentialEconomics({ systemSizeKwp: 10, monthlyBill: 100 });
  closeTo(result.annualConsumption, 1875);
  closeTo(result.selfConsumedKwh, 1875);
  closeTo(result.exportedKwh, 14625);
});

test('commercial calculation exports all production at the commercial tariff', () => {
  const result = calculateCommercialEconomics({ systemSizeKwp: 100 });
  assert.equal(result.modelVersion, 'commercial-v2');
  assert.equal(result.pricePerKwp, 2900);
  assert.equal(result.costBeforeVat, 290000);
  assert.equal(result.costWithVat, 342200);
  assert.equal(result.selfConsumedKwh, 0);
  assert.equal(result.exportedKwh, 165000);
  closeTo(result.annualSavings, 64350);
  assert.deepEqual(validateRoofCheckEconomics(result), { valid: true, issues: [] });
});

test('urban premium is applied only to exported energy for the configured years', () => {
  const result = calculateResidentialEconomics({ systemSizeKwp: 10, monthlyBill: 850, urbanEligible: true });
  closeTo(result.yearlyProjection[0].exportRate, 0.54);
  closeTo(result.yearlyProjection[9].exportRate, 0.54);
  closeTo(result.yearlyProjection[10].exportRate, 0.48);
  assert.ok(result.urbanBonusTotal > 0);
});

test('25-year projection applies panel degradation and preserves all totals', () => {
  const result = calculateResidentialEconomics({ systemSizeKwp: 22.5, monthlyBill: 850 });
  assert.equal(result.yearlyProjection.length, 25);
  closeTo(
    result.yearlyProjection[1].productionKwh,
    result.yearlyProjection[0].productionKwh * (1 - ROOF_CHECK_DEFAULTS.annualPanelDegradation),
  );
  closeTo(
    result.totalIncome25,
    result.yearlyProjection.reduce((sum, year) => sum + year.income, 0),
  );
  closeTo(result.netProfit25, result.totalIncome25 - result.costWithVat);
  closeTo(result.roi25, (result.netProfit25 / result.costWithVat) * 100);
  assert.deepEqual(validateRoofCheckEconomics(result), { valid: true, issues: [] });
});

test('zero-sized systems return a safe empty result', () => {
  const result = calculateResidentialEconomics({ systemSizeKwp: 0 });
  assert.equal(result.annualProduction, 0);
  assert.equal(result.paybackWithVat, 0);
  assert.equal(result.yearlyProjection.length, 0);
});
