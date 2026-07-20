import { buildFullPdfReport } from './pdfReport.js';

const IS_PDF_PREVIEW = new URLSearchParams(window.location.search).get('preview') === 'pdf';

if (IS_PDF_PREVIEW) {
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
  document.write(buildFullPdfReport({ report, state, config, logoSrc, formatNumber, formatMoney }));
  document.close();
} else {
  const PATCH_ID = 'solatrix-report-calculation-authority-v2';

  const CONFIG = Object.freeze({
    productionPerKwp: 1650,
    residentialLimitKwp: 22.5,
    residentialSelfUseShare: 1 / 3,
    residentialBuyRate: 0.64,
    residentialExportRate: 0.48,
    industrialExportRate: 0.39,
    annualPanelDegradation: 0.004,
    contractYears: 25
  });

  let applying = false;
  let queued = false;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatNumber(value) {
    return Math.round(number(value)).toLocaleString('he-IL');
  }

  function formatMoney(value) {
    return `₪${formatNumber(value)}`;
  }

  function calculateAuthoritativeModel(source) {
    if (!source) return null;
    const dcCapacityKwp = Math.max(number(source.systemKw || source.dcCapacityKwp), 0);
    if (!(dcCapacityKwp > 0)) return null;
    const isResidential = dcCapacityKwp <= CONFIG.residentialLimitKwp;
    const annualProductionYear1 = dcCapacityKwp * CONFIG.productionPerKwp;
    const annualConsumptionKwh = Math.max(number(source.annualConsumption), 0);
    let selfConsumedYear1 = 0;
    let exportedYear1 = annualProductionYear1;
    let annualValueYear1 = annualProductionYear1 * CONFIG.industrialExportRate;
    let effectiveTariffYear1 = CONFIG.industrialExportRate;
    if (isResidential) {
      const targetSelfConsumption = annualProductionYear1 * CONFIG.residentialSelfUseShare;
      selfConsumedYear1 = annualConsumptionKwh > 0 ? Math.min(targetSelfConsumption, annualConsumptionKwh) : targetSelfConsumption;
      exportedYear1 = Math.max(annualProductionYear1 - selfConsumedYear1, 0);
      annualValueYear1 = selfConsumedYear1 * CONFIG.residentialBuyRate + exportedYear1 * CONFIG.residentialExportRate;
      effectiveTariffYear1 = annualValueYear1 / Math.max(annualProductionYear1, 1);
    }
    const annualRevenueByYear = [];
    const productionByYear = [];
    let gross25 = 0;
    let totalProduction25 = 0;
    for (let yearIndex = 0; yearIndex < CONFIG.contractYears; yearIndex += 1) {
      const degradationFactor = Math.pow(1 - CONFIG.annualPanelDegradation, yearIndex);
      const productionKwh = annualProductionYear1 * degradationFactor;
      let selfConsumedKwh = 0;
      let exportedKwh = productionKwh;
      let annualValue = productionKwh * CONFIG.industrialExportRate;
      if (isResidential) {
        const targetSelfConsumption = productionKwh * CONFIG.residentialSelfUseShare;
        selfConsumedKwh = annualConsumptionKwh > 0 ? Math.min(targetSelfConsumption, annualConsumptionKwh) : targetSelfConsumption;
        exportedKwh = Math.max(productionKwh - selfConsumedKwh, 0);
        annualValue = selfConsumedKwh * CONFIG.residentialBuyRate + exportedKwh * CONFIG.residentialExportRate;
      }
      productionByYear.push(productionKwh);
      annualRevenueByYear.push(annualValue);
      gross25 += annualValue;
      totalProduction25 += productionKwh;
    }
    const costBeforeVat = Math.max(number(source.costBeforeVat), 0);
    const costWithVat = Math.max(number(source.costWithVat), 0);
    return {
      ...source,
      calculationMode: isResidential ? 'residential' : 'industrial',
      isResidential,
      isCommercial: !isResidential,
      systemKw: dcCapacityKwp,
      dcCapacityKwp,
      annualProduction: annualProductionYear1,
      annualProductionYear1,
      selfConsumed: selfConsumedYear1,
      exported: exportedYear1,
      selfUseShare: annualProductionYear1 ? selfConsumedYear1 / annualProductionYear1 : 0,
      exportShare: annualProductionYear1 ? exportedYear1 / annualProductionYear1 : 1,
      baseExportRate: isResidential ? CONFIG.residentialExportRate : CONFIG.industrialExportRate,
      tariffUsed: isResidential ? CONFIG.residentialExportRate : CONFIG.industrialExportRate,
      buyRateUsed: isResidential ? CONFIG.residentialBuyRate : null,
      annualSavings: annualValueYear1,
      annualValueYear1,
      annualRevenueByYear,
      productionByYear,
      totalProduction25,
      effectiveTariff: effectiveTariffYear1,
      paybackBeforeVat: costBeforeVat / Math.max(annualValueYear1, 1),
      paybackWithVat: costWithVat / Math.max(annualValueYear1, 1),
      gross25,
      profit25WithVat: gross25 - costWithVat,
      panelDegradationRate: CONFIG.annualPanelDegradation,
      consumerTariffGrowthRate: 0,
      urbanEligible: false,
      urbanBonusRate: 0,
      urbanBonusYears: 0,
      urbanBonusTotal: 0,
      tariffContractYears: CONFIG.contractYears
    };
  }

  function reportRows(model) {
    return [
      ['עלות לפני מע״מ', formatMoney(model.costBeforeVat)],
      ['עלות כולל מע״מ', formatMoney(model.costWithVat)],
      ['שטח גג מסומן', `${formatNumber(model.roofArea)} m²`],
      ['שטח גג שמיש', `${formatNumber(model.usableArea)} m²`],
      ['מספר פאנלים', formatNumber(model.panels)],
      ['ייצור שנה 1', `${formatNumber(model.annualProduction)} kWh`],
      ['תעריף ממוצע בשנה 1', `₪${number(model.effectiveTariff).toFixed(3)}`],
      [model.isResidential ? 'חיסכון בשנה הראשונה' : 'הכנסה בשנה הראשונה', formatMoney(model.annualSavings)],
      ['החזר לפני מע״מ', `${number(model.paybackBeforeVat).toFixed(1)} שנים`],
      ['החזר כולל מע״מ', `${number(model.paybackWithVat).toFixed(1)} שנים`],
      ['ייצור מצטבר ל-25 שנים', `${formatNumber(model.totalProduction25)} kWh`],
      ['רווח 25 שנים', formatMoney(model.profit25WithVat)]
    ];
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function tariffExplanation(model) {
    if (model.isResidential) {
      return `<h3>מודל התעריף שחושב</h3><p><strong>מערכת ביתית עד 22.5 kWp:</strong> ${Math.round(model.selfUseShare * 100)}% מהייצור מחושב כצריכה עצמית לפי ₪${CONFIG.residentialBuyRate.toFixed(2)}, והיתרה נמכרת לפי ₪${CONFIG.residentialExportRate.toFixed(2)} לקוט״ש.</p><p><strong>ירידת תפוקה:</strong> 0.4% בכל שנה, החל מהשנה השנייה.</p>`;
    }
    return `<h3>מודל התעריף שחושב</h3><p><strong>מערכת מעל 22.5 kWp:</strong> כל הייצור מחושב לפי תעריף תעשייתי ממוצע של ₪${CONFIG.industrialExportRate.toFixed(2)} לקוט״ש.</p><p><strong>ירידת תפוקה:</strong> 0.4% בכל שנה, החל מהשנה השנייה.</p>`;
  }

  function ensureTariffCard(card, model) {
    let tariffCard = card.querySelector('.solatrixTariffModel');
    if (!tariffCard) {
      tariffCard = document.createElement('section');
      tariffCard.className = 'solatrixTariffModel';
      card.querySelector('h2')?.insertAdjacentElement('afterend', tariffCard);
    }
    tariffCard.innerHTML = tariffExplanation(model);
    tariffCard.querySelectorAll('.solatrixTariffActions,[data-urban-override]').forEach((node) => node.remove());
  }

  function applyAuthoritativeReport() {
    if (applying || !(location.pathname || '').includes('/report')) return;
    const card = document.querySelector('.reportCard');
    const current = window.__solatrixRoofCalculation;
    if (!card || !current) return;
    const model = calculateAuthoritativeModel(current);
    if (!model) return;
    applying = true;
    try {
      window.__solatrixRoofCalculation = model;
      setText(card.querySelector('h2'), `הגג מתאים למערכת של כ-${number(model.systemKw).toFixed(1)} kWp`);
      const hero = [...card.querySelectorAll('.reportHeroGraphic > div')];
      setText(hero[0]?.querySelector('strong'), formatMoney(model.annualSavings));
      setText(hero[0]?.querySelector('span'), model.isResidential ? 'חיסכון בשנה הראשונה' : 'הכנסה בשנה הראשונה');
      setText(hero[1]?.querySelector('strong'), number(model.paybackWithVat).toFixed(1));
      setText(hero[1]?.querySelector('span'), 'החזר כולל מע״מ');
      const rows = reportRows(model);
      [...card.querySelectorAll('.resultsGrid > div')].forEach((row, index) => {
        if (!rows[index]) return;
        setText(row.querySelector('span'), rows[index][0]);
        setText(row.querySelector('b'), rows[index][1]);
      });
      ensureTariffCard(card, model);
      card.dataset.authoritativeCalculation = PATCH_ID;
      card.dataset.calculationMode = model.calculationMode;
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

  const observer = new MutationObserver(() => {
    if (!applying) scheduleApply();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  setInterval(() => {
    if ((location.pathname || '').includes('/report')) applyAuthoritativeReport();
  }, 120);

  window.addEventListener('popstate', () => setTimeout(scheduleApply, 80));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleApply);
  else scheduleApply();
}
