const PATCH_ID = 'solatrix-report-metrics-grid-v1';
let applying = false;

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('he-IL');
}

function formatMoney(value) {
  return `₪${formatNumber(value)}`;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function metricRows(model) {
  const firstYearLabel = model.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה';
  const grossLabel = model.isCommercial ? 'הכנסה מצטברת ל-25 שנים' : 'ערך מצטבר ל-25 שנים';

  return [
    ['עלות לפני מע״מ', formatMoney(model.costBeforeVat)],
    ['עלות כולל מע״מ', formatMoney(model.costWithVat)],
    ['שטח גג מסומן', `${formatNumber(model.roofArea)} m²`],
    ['שטח גג שמיש', `${formatNumber(model.usableArea)} m²`],
    ['מספר פאנלים', formatNumber(model.panels)],
    ['ייצור שנתי', `${formatNumber(model.annualProduction)} kWh`],
    ['תעריף ממוצע בשנה 1', `₪${Number(model.effectiveTariff || 0).toFixed(3)}`],
    [firstYearLabel, formatMoney(model.annualSavings)],
    ['החזר לפני מע״מ', `${Number(model.paybackBeforeVat || 0).toFixed(1)} שנים`],
    ['החזר כולל מע״מ', `${Number(model.paybackWithVat || 0).toFixed(1)} שנים`],
    [grossLabel, formatMoney(model.gross25)],
    ['רווח 25 שנים', formatMoney(model.profit25WithVat)]
  ];
}

function applyMetricGrid() {
  if (applying || !(location.pathname || '').includes('/report')) return;
  const reportCard = document.querySelector('.reportCard');
  const model = window.__solatrixRoofCalculation;
  if (!reportCard || !model) return;

  const cards = [...reportCard.querySelectorAll('.resultsGrid > div')];
  if (!cards.length) return;

  applying = true;
  try {
    const rows = metricRows(model);
    cards.forEach((card, index) => {
      const row = rows[index];
      if (!row) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      setText(card.querySelector('span'), row[0]);
      setText(card.querySelector('b'), row[1]);
      card.dataset.metricIndex = String(index);
    });
    reportCard.dataset.metricsGridPatched = PATCH_ID;
  } finally {
    applying = false;
  }
}

const observer = new MutationObserver(() => {
  if (!applying) queueMicrotask(applyMetricGrid);
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

window.addEventListener('popstate', () => setTimeout(applyMetricGrid, 80));
setInterval(applyMetricGrid, 250);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMetricGrid); else applyMetricGrid();
