import { buildFullPdfReport } from './pdfReport.js';

const params = new URLSearchParams(window.location.search);
const isPdfPreview = params.get('preview') === 'pdf';

if (isPdfPreview) {
  const productionPerKwp = 1650;
  const dcCapacityKwp = 22.5;
  const annualProduction = dcCapacityKwp * productionPerKwp;
  const selfUseShare = 1 / 3;
  const selfConsumed = annualProduction * selfUseShare;
  const exported = annualProduction - selfConsumed;
  const annualSavings = selfConsumed * 0.64 + exported * 0.48;
  const degradation = 0.004;

  const yearly = Array.from({ length: 25 }, (_, index) => {
    const productionKwh = annualProduction * Math.pow(1 - degradation, index);
    const selfConsumedKwh = productionKwh * selfUseShare;
    const exportedKwh = productionKwh - selfConsumedKwh;
    return {
      year: index + 1,
      productionKwh,
      selfConsumedKwh,
      exportedKwh,
      value: selfConsumedKwh * 0.64 + exportedKwh * 0.48
    };
  });

  const gross25 = yearly.reduce((sum, row) => sum + row.value, 0);
  const totalProduction25 = yearly.reduce((sum, row) => sum + row.productionKwh, 0);
  const costBeforeVat = dcCapacityKwp * 2900;
  const costWithVat = costBeforeVat * 1.18;

  const report = {
    calculationMode: 'residential',
    isResidential: true,
    isCommercial: false,
    systemKw: dcCapacityKwp,
    dcCapacityKwp,
    roofArea: 192,
    usableArea: 157,
    panels: 36,
    annualProduction,
    annualProductionYear1: annualProduction,
    annualConsumption: 15000,
    annualConsumptionKwh: 15000,
    selfConsumed,
    selfConsumedYear1: selfConsumed,
    exported,
    exportedYear1: exported,
    selfUseShare,
    exportShare: 1 - selfUseShare,
    annualSavings,
    annualValueYear1: annualSavings,
    effectiveTariff: annualSavings / annualProduction,
    effectiveTariffYear1: annualSavings / annualProduction,
    tariffUsed: 0.48,
    buyRateUsed: 0.64,
    panelDegradationRate: degradation,
    costBeforeVat,
    costWithVat,
    paybackBeforeVat: costBeforeVat / annualSavings,
    paybackWithVat: costWithVat / annualSavings,
    gross25,
    totalProduction25,
    avgTariff25: gross25 / totalProduction25,
    profit25WithVat: gross25 - costWithVat,
    yearly
  };

  const state = {
    leadName: 'לקוח לדוגמה',
    leadPhone: '054-729-9727',
    address: 'החרמון 10, חיפה',
    monthlyBill: 850,
    roofType: 'flat',
    obstacles: []
  };

  const config = {
    productionPerKwp,
    productionPerKw: productionPerKwp,
    residentialLimitKwp: 22.5,
    residentialSelfUseShare: selfUseShare,
    residentialBuyRate: 0.64,
    residentialExportRate: 0.48,
    industrialExportRate: 0.39,
    annualPanelDegradation: degradation,
    defaultPhone: '972547299727'
  };

  const formatNumber = (value) => Math.round(Number(value) || 0).toLocaleString('he-IL');
  const formatMoney = (value) => `₪${formatNumber(value)}`;
  const logoSrc = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';

  document.open();
  document.write(buildFullPdfReport({
    report,
    state,
    config,
    logoSrc,
    formatNumber,
    formatMoney
  }));
  document.close();
}
