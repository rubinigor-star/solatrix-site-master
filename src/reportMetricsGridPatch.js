const PATCH_ID = 'solatrix-report-metrics-grid-v2';
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

function installHeroStyles() {
  if (document.getElementById(`${PATCH_ID}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${PATCH_ID}-styles`;
  style.textContent = `
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
      align-items: stretch !important;
      gap: 0 !important;
      direction: rtl !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric {
      display: flex !important;
      min-width: 0 !important;
      flex-direction: column !important;
      align-items: flex-start !important;
      justify-content: center !important;
      gap: 4px !important;
      padding: 22px 26px !important;
      text-align: right !important;
      direction: rtl !important;
    }
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric + .solatrixHeroMetric {
      border-inline-start: 1px solid rgba(255,255,255,.15) !important;
    }
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric span {
      display: block !important;
      width: 100% !important;
      color: #f3d79f !important;
      font-size: clamp(14px, 1.2vw, 18px) !important;
      font-weight: 850 !important;
      line-height: 1.25 !important;
      text-align: right !important;
    }
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric strong {
      display: block !important;
      width: 100% !important;
      margin: 0 !important;
      color: #fff !important;
      font-size: clamp(30px, 3vw, 44px) !important;
      font-weight: 950 !important;
      line-height: 1 !important;
      letter-spacing: -.03em !important;
      text-align: right !important;
      white-space: nowrap !important;
    }
    .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric small {
      display: block !important;
      width: 100% !important;
      color: #f3d79f !important;
      font-size: 14px !important;
      font-weight: 800 !important;
      text-align: right !important;
    }
    @media (max-width: 640px) {
      .reportHeroGraphic[data-solatrix-hero-metrics="true"] {
        grid-template-columns: 1fr !important;
      }
      .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric {
        padding: 18px 20px !important;
      }
      .reportHeroGraphic[data-solatrix-hero-metrics="true"] .solatrixHeroMetric + .solatrixHeroMetric {
        border-inline-start: 0 !important;
        border-top: 1px solid rgba(255,255,255,.15) !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function applyHeroMetrics(reportCard, model) {
  const hero = reportCard.querySelector('.reportHeroGraphic');
  if (!hero) return;

  const firstYearLabel = model.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה';
  const annualValue = formatMoney(model.annualSavings);
  const paybackValue = Number(model.paybackWithVat || 0).toFixed(1);
  const signature = `${firstYearLabel}|${annualValue}|${paybackValue}`;

  if (hero.dataset.heroMetricSignature === signature) return;
  hero.dataset.solatrixHeroMetrics = 'true';
  hero.dataset.heroMetricSignature = signature;
  hero.innerHTML = `
    <div class="solatrixHeroMetric solatrixHeroMetricPrimary">
      <span>${firstYearLabel}</span>
      <strong>${annualValue}</strong>
    </div>
    <div class="solatrixHeroMetric solatrixHeroMetricPayback">
      <span>החזר כולל מע״מ</span>
      <strong>${paybackValue}</strong>
      <small>שנים</small>
    </div>`;
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
    installHeroStyles();
    applyHeroMetrics(reportCard, model);

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