const VAT_RATE = 0.18;
const HOME_SYSTEM_LIMIT_KW = 22.5;
const DEFAULT_SELF_USE_SHARE = 0.4;
const DEFAULT_ELECTRICITY_GROWTH = 0.04;

export function buildFullPdfReport({ report = {}, state = {}, config = {}, logoSrc = '', formatNumber, formatMoney } = {}) {
  const number = formatNumber || ((value) => Math.round(Number(value) || 0).toLocaleString('he-IL'));
  const money = formatMoney || ((value) => `₪${number(value)}`);
  const calc = buildCalculation(report, state, config);
  const customerName = state.leadName || 'משפחת לקוח';
  const address = state.address || 'כתובת הגג שהוזנה בבדיקה';
  const coordinates = coordinateText(state) || 'ייקבע לפי סימון המפה';
  const defaultPhone = digitsOnly(config.defaultPhone || '972547299727');
  const whatsappUrl = `https://wa.me/${defaultPhone}`;
  const logo = logoSrc
    ? `<img class="brandLogo" src="${escapeAttribute(logoSrc)}" alt="Solatrix Energy" />`
    : '<div class="textLogo">SOLATRIX<small>ENERGY</small></div>';
  const mapPlaceholder = state.roofScreenshot
    ? `<img class="mapImage" src="${escapeAttribute(state.roofScreenshot)}" alt="סימון הגג במפה" />`
    : `<div class="placeholder"><div><b>צילום המפה יופיע כאן</b><span>סימון הגג, השטח המחושב והכיוון המשוער יגיעו ישירות מהקלculator.</span></div></div>`;

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Solatrix Roof Check - 3 Page Report</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html{direction:rtl}
body{margin:0;background:#eee;color:#071b2f;font-family:Assistant,"Noto Sans Hebrew",Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;background:#fffdf8;page-break-after:always}
.inner{padding:14mm 15mm 16mm;height:100%;position:relative;z-index:2}
.glow{position:absolute;right:-28mm;bottom:-36mm;width:125mm;height:125mm;border-radius:50%;background:radial-gradient(circle,rgba(245,161,26,.25),transparent 70%)}
.header{display:flex;justify-content:space-between;align-items:center;padding-bottom:6mm;margin-bottom:7mm;border-bottom:1.4px solid rgba(245,161,26,.48)}
.brand{display:flex;align-items:center;justify-content:flex-start;min-width:145px;background:transparent;border:0;box-shadow:none}
.brandLogo{width:142px;max-height:54px;object-fit:contain;display:block;background:transparent;border:0;box-shadow:none;padding:0}
.textLogo{direction:ltr;font-weight:950;font-size:25px;line-height:1;letter-spacing:.02em;color:#071b2f}.textLogo small{display:block;font-size:8px;letter-spacing:.22em;color:#6d7b88;font-weight:900;margin-top:2px}
.docType{font-size:12px;color:#6d7b88;font-weight:900}
.footer{position:absolute;left:15mm;right:15mm;bottom:7mm;height:11mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(7,27,47,.09);padding-top:3.5mm;font-size:12px;color:#6d7b88;font-weight:850;z-index:3}.footer b{font-size:20px;color:#f5a11a}
h1,h2,h3,p{margin:0}h1{font-size:53px;line-height:.98;letter-spacing:-.045em;font-weight:950;color:#071b2f}h2{font-size:34px;line-height:1.05;letter-spacing:-.03em;font-weight:950;color:#071b2f}h3{font-size:20px;line-height:1.15;font-weight:950;color:#071b2f}.lead{font-size:18px;line-height:1.43;color:#465564;font-weight:760}.kicker{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:#a96a05;font-weight:950;direction:ltr}.accent{color:#f5a11a}
.split{display:grid;grid-template-columns:1fr 1fr;gap:7mm;align-items:stretch}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm}.card{background:#fff;border:1px solid #eadbc7;border-radius:20px;padding:5mm;box-shadow:0 10px 25px rgba(7,27,47,.055)}.metric{text-align:center;display:grid;align-content:center;min-height:34mm}.metric span{font-weight:900;color:#6d7b88;font-size:13px}.metric b{display:block;font-size:24px;font-weight:950;direction:ltr}.metric small{display:block;color:#6d7b88;font-size:11px;font-weight:850}.icon{width:11.5mm;height:11.5mm;border-radius:50%;border:1.6px solid #f5a11a;display:grid;place-items:center;margin:0 auto 2.5mm;color:#f5a11a;font-weight:950}
.note{background:linear-gradient(135deg,#fff3dc,#fff);border:1px solid #eadbc7;border-radius:20px;padding:5mm 6mm;color:#465564;font-size:16px;line-height:1.43;font-weight:770}.priceBox{background:linear-gradient(135deg,#071b2f,#0c3150);color:white;border-radius:28px;padding:7mm;box-shadow:0 22px 55px rgba(7,27,47,.2)}.priceBox h2{color:white}.priceRows{display:grid;gap:3mm;margin-top:5mm}.priceRow{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.16);padding-bottom:3mm}.priceRow:last-child{border-bottom:0}.priceRow span{color:#dbe7ef;font-weight:850}.priceRow b{font-size:22px;color:#ffc86b;direction:ltr}
.calcBox{background:#fff;border:1px solid #eadbc7;border-radius:20px;padding:4.5mm;box-shadow:0 8px 22px rgba(7,27,47,.045)}.calcBox h3{margin-bottom:3mm}.formula{direction:ltr;text-align:left;font-weight:900;color:#071b2f;background:#fff3dc;border-radius:14px;padding:3mm;margin-top:2mm;font-size:14px}.fact{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eadbc7;padding:2.8mm 0}.fact span{color:#6d7b88;font-weight:850}.fact b{font-size:18px;direction:ltr;color:#071b2f}.placeholder{height:87mm;border-radius:24px;border:2px dashed rgba(245,161,26,.45);background:linear-gradient(135deg,#fff,#fff3dc);display:grid;place-items:center;text-align:center;padding:10mm;color:#465564;font-weight:850}.placeholder b{font-size:26px;color:#071b2f;display:block;margin-bottom:4mm}.placeholder span{display:block;line-height:1.45}.mapImage{width:100%;height:87mm;object-fit:cover;border-radius:24px;border:1px solid #eadbc7;display:block}
.systemBox{background:linear-gradient(135deg,#fff3dc,#fff);border:2px solid rgba(245,161,26,.65);border-radius:26px;padding:6mm;min-height:66mm;display:grid;align-content:center}.kw{font-size:50px;line-height:.92;font-weight:950;direction:ltr;color:#071b2f}.label{font-size:17px;font-weight:950;color:#a96a05;margin-top:2.5mm}.assumptions{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:5mm}.assumption{background:#fff;border:1px solid #eadbc7;border-radius:16px;padding:3.5mm}.assumption span{display:block;color:#6d7b88;font-weight:850;font-size:12px}.assumption b{display:block;font-size:17px;font-weight:950;direction:ltr;color:#071b2f}
.timeline{display:grid;gap:2.5mm}.timeRow{display:grid;grid-template-columns:26mm 1fr 32mm;gap:4mm;align-items:center;background:#fff;border:1px solid #eadbc7;border-radius:16px;padding:3.3mm}.timeRow span{font-weight:900;color:#6d7b88}.timeBar{height:6mm;border-radius:999px;background:linear-gradient(90deg,#f5a11a,#ffc86b)}.timeRow b{font-size:17px;direction:ltr;color:#071b2f}.checkGrid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.check{display:grid;grid-template-columns:12mm 1fr;gap:3.5mm;align-items:center;background:#fff;border:1px solid #eadbc7;border-radius:18px;padding:3.2mm}.checkIcon{width:10.5mm;height:10.5mm;border-radius:50%;background:#fff3dc;color:#f5a11a;display:grid;place-items:center;font-weight:950}.check h3{font-size:17px}.check p{font-size:12.5px;line-height:1.25;color:#465564;font-weight:760;margin-top:1mm}
.process{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm;margin-top:4mm}.step{background:#fff;border:1px solid #eadbc7;border-radius:16px;padding:3mm 2.5mm;text-align:center;min-height:46mm}.num{width:9mm;height:9mm;border-radius:50%;background:#f5a11a;color:#fff;display:grid;place-items:center;margin:0 auto 2mm;font-weight:950}.step h3{font-size:13.5px}.step p{font-size:10.5px;line-height:1.22;color:#6d7b88;font-weight:760;margin-top:2mm}.ctaBand{margin-top:5mm;background:linear-gradient(135deg,#071b2f,#0c3150);color:white;border-radius:22px;padding:5mm 6mm;display:grid;grid-template-columns:1.05fr .95fr;gap:6mm;align-items:center;overflow:visible}.ctaBand h2{color:white;font-size:25px}.ctaBand .lead{color:#dbe7ef;font-size:14px;line-height:1.28}.contact{display:grid;gap:2mm}.contact a{font-size:14px;line-height:1.25;font-weight:900;color:white;text-decoration:none;display:block}.whatsapp{display:inline-flex;align-items:center;justify-content:center;min-height:10.5mm;line-height:1.1;margin-top:3mm;background:#25D366;color:white;border-radius:999px;padding:8px 15px;font-weight:950;text-decoration:none;white-space:nowrap;box-shadow:0 10px 24px rgba(37,211,102,.22)}
@media print{body{background:white}.page{margin:0;box-shadow:none}}@media screen{.page{margin:0 auto 24px;box-shadow:0 22px 70px rgba(7,27,47,.13)}}
</style>
</head>
<body>
<main class="report">
<section class="page"><div class="glow"></div><div class="inner">
<div class="header"><div class="brand">${logo}</div><div class="docType">בדיקת גג סולארית ראשונית</div></div>
<div class="kicker">Transparent calculation</div><h1 style="margin-top:3mm">הגג שלכם<br><span class="accent">יכול להתחיל לחסוך</span></h1>
<p class="lead" style="margin-top:4mm;max-width:150mm">הדוח מציג גם את המספרים וגם את הדרך שבה חישבנו אותם: מחיר מערכת, ייצור שנתי, ערך הקוט״ש והחזר השקעה.</p>
<div class="grid4" style="margin-top:7mm"><div class="card metric"><div class="icon">₪</div><span>עלות לפני מע״מ</span><b>${money(calc.costBeforeVat)}</b><small>${calc.systemKw.toFixed(1)}×${number(calc.pricePerKw)}</small></div><div class="card metric"><div class="icon">⚡</div><span>הספק מערכת</span><b>${calc.systemKw.toFixed(1)} kW</b></div><div class="card metric"><div class="icon">☀</div><span>חיסכון שנתי</span><b>${money(calc.annualSavings)}</b><small>שנה ראשונה</small></div><div class="card metric"><div class="icon">↺</div><span>החזר כולל מע״מ</span><b>${calc.paybackWithVat.toFixed(1)} שנים</b><small>לפי שנה 1</small></div></div>
<div class="split" style="margin-top:7mm"><div class="priceBox"><h2>סדר גודל מחיר</h2><div class="priceRows"><div class="priceRow"><span>מחיר לקילוואט</span><b>${money(calc.pricePerKw)}</b></div><div class="priceRow"><span>עלות לפני מע״מ</span><b>${money(calc.costBeforeVat)}</b></div><div class="priceRow"><span>עלות כולל 18% מע״מ</span><b>${money(calc.costWithVat)}</b></div><div class="priceRow"><span>החזר לפני / כולל מע״מ</span><b>${calc.paybackBeforeVat.toFixed(1)} / ${calc.paybackWithVat.toFixed(1)}</b></div></div></div><div class="calcBox"><h3>איך חישבנו חיסכון שנתי?</h3><div class="fact"><span>ייצור שנתי</span><b>${number(calc.annualProduction)} kWh</b></div><div class="fact"><span>ערך ממוצע לקוט״ש</span><b>₪${calc.effectiveTariff.toFixed(3)}</b></div><div class="formula">${number(calc.annualProduction)} × ₪${calc.effectiveTariff.toFixed(3)} = ${money(calc.annualSavings)}/year</div><p class="lead" style="font-size:14px;margin-top:3mm">החישוב מבוסס על צריכה עצמית ${Math.round(calc.selfUseShare * 100)}% ומכירה לרשת ${Math.round(calc.exportShare * 100)}% בתעריף ביתי ₪${calc.sellRate.toFixed(2)}.</p></div></div>
<div class="note" style="margin-top:6mm">בדוח הזה מערכת ביתית מחושבת לפי תעריף מכירה לרשת של ₪0.48 לקוט״ש, ולא לפי תעריפים של מערכות תעשייתיות.</div>
</div><div class="footer"><span>מחיר, חיסכון והנחות החישוב במקום אחד</span><b>01</b></div></section>

<section class="page"><div class="glow"></div><div class="inner">
<div class="header"><div class="brand">${logo}</div><div class="docType">בסיס החישוב</div></div>
<div class="split"><div><div class="kicker">Calculation basis</div><h2 style="margin-top:3mm">מאיפה הנתונים מגיעים?</h2><p class="lead" style="margin-top:4mm">כאן יופיע צילום מסך מהמפה עם השטח שסימנתם. בנוסף, הדוח מציג את הקואורדינטות וההנחות שעליהן מבוסס החישוב.</p><div style="margin-top:7mm">${mapPlaceholder}</div></div><div><div class="card"><div class="fact"><span>שם לקוח</span><b>${escapeHtml(customerName)}</b></div><div class="fact"><span>כתובת</span><b>${escapeHtml(address)}</b></div><div class="fact"><span>קואורדינטות</span><b>${escapeHtml(coordinates)}</b></div><div class="fact"><span>שטח גג מסומן</span><b>${number(calc.roofArea)} מ״ר</b></div><div class="fact"><span>שטח שימושי</span><b>${number(calc.usableArea)} מ״ר</b></div><div class="fact"><span>מערכת מוצעת</span><b>${calc.systemKw.toFixed(1)} kW</b></div></div><div class="systemBox" style="margin-top:5mm"><div class="kw">${calc.systemKw.toFixed(1)} kW</div><div class="label">מערכת מוצעת לבדיקה ראשונית</div><p class="lead" style="font-size:15px;margin-top:5mm">הגודל הסופי ייקבע לפי סוג הנכס, הגג, הצריכה והכללים הרלוונטיים.</p></div></div></div>
<div class="assumptions"><div class="assumption"><span>תפוקה בסיסית</span><b>${number(calc.productionPerKw)} kWh/kWp</b></div><div class="assumption"><span>ייצור שנתי</span><b>${number(calc.annualProduction)} kWh</b></div><div class="assumption"><span>צריכה עצמית</span><b>${Math.round(calc.selfUseShare * 100)}%</b></div><div class="assumption"><span>מכירה לרשת</span><b>${Math.round(calc.exportShare * 100)}%</b></div><div class="assumption"><span>קוט״ש שנחסך בבית</span><b>₪${calc.buyRate.toFixed(2)}</b></div><div class="assumption"><span>קוט״ש שנמכר לרשת</span><b>₪${calc.sellRate.toFixed(2)}</b></div><div class="assumption"><span>עליית מחיר חשמל</span><b>${Math.round(calc.electricityGrowth * 100)}%/year</b></div><div class="assumption"><span>ערך ממוצע שנה 1</span><b>₪${calc.effectiveTariff.toFixed(3)}</b></div></div><div class="note" style="margin-top:5mm">בעתיד ניתן להוסיף תרחיש סוללה. סוללה תעלה את אחוז הצריכה העצמית, ולכן יכולה להגדיל את ערך הקוט״ש הממוצע — אבל זה צריך להיות חישוב נפרד.</div>
</div><div class="footer"><span>קואורדינטות, גג והנחות פיננסיות</span><b>02</b></div></section>

<section class="page"><div class="glow"></div><div class="inner">
<div class="header"><div class="brand">${logo}</div><div class="docType">החזר, בדיקות והשלב הבא</div></div>
<div class="split"><div><div class="kicker">25 year view</div><h2 style="margin-top:3mm">מה קורה לאורך 25 שנה?</h2><p class="lead" style="margin-top:4mm">הקוט״ש שנמכר לרשת מחושב לפי ₪0.48. הקוט״ש שנחסך בבית מתחיל ב-₪0.64 ועולה לפי הנחת 4% בשנה.</p><div class="timeline" style="margin-top:6mm"><div class="timeRow"><span>שנה 1</span><div class="timeBar" style="width:28%"></div><b>${money(calc.annualSavings)}</b></div><div class="timeRow"><span>ממוצע קוט״ש 25 שנה</span><div class="timeBar" style="width:58%"></div><b>₪${calc.avgTariff25.toFixed(3)}</b></div><div class="timeRow"><span>חיסכון 25 שנה</span><div class="timeBar" style="width:100%"></div><b>${money(calc.gross25)}</b></div><div class="timeRow"><span>רווח נטו כולל מע״מ</span><div class="timeBar" style="width:88%"></div><b>${money(calc.profit25WithVat)}</b></div></div></div><div><h2>מה בודקים לפני הצעה סופית?</h2><div class="checkGrid" style="margin-top:5mm"><div class="check"><div class="checkIcon">☀</div><div><h3>הצללות</h3><p>עצים, בניינים, דודים ומכשולים שעלולים להשפיע על הייצור.</p></div></div><div class="check"><div class="checkIcon">⌂</div><div><h3>מצב הגג</h3><p>סוג הגג, יציבות, איטום וגישה בטוחה להתקנה.</p></div></div><div class="check"><div class="checkIcon">⚡</div><div><h3>חיבור חשמל</h3><p>בדיקה ראשונית של לוח החשמל והתאמה לחיבור.</p></div></div><div class="check"><div class="checkIcon">✓</div><div><h3>אישורים</h3><p>התאמת התכנון לכללים ולדרישות הרלוונטיות.</p></div></div></div></div></div>
<h2 style="margin-top:7mm">איך ממשיכים מכאן?</h2><div class="process"><div class="step"><div class="num">1</div><h3>בודקים</h3><p>מאמתים את נתוני הגג והצריכה.</p></div><div class="step"><div class="num">2</div><h3>מסבירים</h3><p>עוברים יחד על מחיר, חיסכון והחזר.</p></div><div class="step"><div class="num">3</div><h3>מתכננים</h3><p>מכינים תכנון מתאים לנכס.</p></div><div class="step"><div class="num">4</div><h3>מתקינים</h3><p>התקנה מסודרת ובטוחה.</p></div><div class="step"><div class="num">5</div><h3>מלווים</h3><p>מעקב גם אחרי ההפעלה.</p></div></div><div class="ctaBand"><div><h2 style="color:white">מחיר ברור. החלטה רגועה.</h2><p class="lead">בלי הבטחות מוגזמות, בלי מחיר מוסתר ובלי לחץ.</p><a class="whatsapp" href="${escapeAttribute(whatsappUrl)}" target="_blank" rel="noopener">WhatsApp · דברו איתנו</a></div><div class="contact"><a href="tel:+${defaultPhone}">☎ 054-729-9727</a><a href="mailto:info@solatrix.energy">✉ info@solatrix.energy</a><a href="https://solatrix.energy" target="_blank" rel="noopener">🌐 solatrix.energy</a></div></div>
</div><div class="footer"><span>חישוב שקוף + בדיקה מקצועית לפני הצעה מחייבת</span><b>03</b></div></section>
</main>
</body>
</html>`;
}

function buildCalculation(report, state, config) {
  const productionPerKw = toNumber(config.productionPerKw, 1650);
  const buyRate = toNumber(config.buyRate, 0.64);
  const sellRate = toNumber(config.sellRate, 0.48);
  const pricePerKw = toNumber(config.installCostPerKw, 2900);
  const electricityGrowth = toNumber(config.electricityGrowthRate, DEFAULT_ELECTRICITY_GROWTH);
  const roofArea = toNumber(report.roofArea, 0);
  const usableArea = toNumber(report.usableArea, 0);
  const roofPotentialKw = Math.max(toNumber(report.systemKw, HOME_SYSTEM_LIMIT_KW), 0);
  const systemLimit = toNumber(config.homeSystemLimitKw, HOME_SYSTEM_LIMIT_KW);
  const systemKw = Math.min(roofPotentialKw || systemLimit, systemLimit);
  const factor = toNumber(report.weightedFactor, 1);
  const annualProduction = systemKw * productionPerKw * factor;
  const annualConsumption = (toNumber(state.monthlyBill, 850) * 12) / buyRate;
  const targetSelf = annualProduction * toNumber(config.defaultSelfUseShare, DEFAULT_SELF_USE_SHARE);
  const selfConsumed = Math.min(targetSelf, annualConsumption);
  const exported = Math.max(annualProduction - selfConsumed, 0);
  const selfUseShare = annualProduction ? selfConsumed / annualProduction : DEFAULT_SELF_USE_SHARE;
  const exportShare = Math.max(0, 1 - selfUseShare);
  const annualSavings = selfConsumed * buyRate + exported * sellRate;
  const effectiveTariff = annualSavings / Math.max(annualProduction, 1);
  const costBeforeVat = systemKw * pricePerKw;
  const costWithVat = costBeforeVat * (1 + VAT_RATE);
  const paybackBeforeVat = costBeforeVat / Math.max(annualSavings, 1);
  const paybackWithVat = costWithVat / Math.max(annualSavings, 1);
  let gross25 = 0;
  for (let year = 0; year < 25; year += 1) {
    gross25 += selfConsumed * buyRate * Math.pow(1 + electricityGrowth, year) + exported * sellRate;
  }
  const avgTariff25 = gross25 / Math.max(annualProduction * 25, 1);
  return {
    systemKw, productionPerKw, annualProduction, annualConsumption, selfConsumed, exported,
    selfUseShare, exportShare, annualSavings, effectiveTariff, buyRate, sellRate, pricePerKw,
    costBeforeVat, costWithVat, paybackBeforeVat, paybackWithVat, roofArea, usableArea,
    electricityGrowth, gross25, avgTariff25, profit25BeforeVat: gross25 - costBeforeVat,
    profit25WithVat: gross25 - costWithVat
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function digitsOnly(value) { return String(value || '').replace(/\D/g, ''); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function coordinateText(state = {}) {
  if (state.coordinates) return String(state.coordinates);
  if (state.lat && state.lng) return `${Number(state.lat).toFixed(5)}, ${Number(state.lng).toFixed(5)}`;
  if (state.mapCenter?.lat && state.mapCenter?.lng) return `${Number(state.mapCenter.lat).toFixed(5)}, ${Number(state.mapCenter.lng).toFixed(5)}`;
  return '';
}
