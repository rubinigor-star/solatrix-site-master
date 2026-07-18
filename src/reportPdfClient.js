import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import familyUrl from './assets/roof-check-report/roof-check-family.webp';

const REPORT_TEMPLATE_VERSION = 'roof-check-premium-v1';
const reportLogoUrl = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';

export async function createRoofCheckPdf({ customer = {}, reportData = {} } = {}) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:794px;background:#fffaf2;z-index:-1;';
  host.innerHTML = buildReportMarkup(customer, reportData);
  document.body.appendChild(host);

  try {
    await document.fonts?.ready;
    await waitForImages(host);
    const pages = [...host.querySelectorAll('.pdfPage')];
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await html2canvas(pages[index], {
        scale: 1.7,
        backgroundColor: '#fffaf2',
        useCORS: true,
        logging: false,
        windowWidth: 794,
        windowHeight: 1123
      });
      const image = canvas.toDataURL('image/jpeg', 0.92);
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    pdf.setProperties({
      title: 'Solatrix Roof Check',
      subject: `Solatrix Roof Check - ${REPORT_TEMPLATE_VERSION}`,
      author: 'Solatrix Energy',
      creator: 'Solatrix Roof Check'
    });
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Unable to read PDF blob.'));
    reader.readAsDataURL(blob);
  });
}

function waitForImages(root) {
  const images = [...root.querySelectorAll('img')];
  return Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
}

function buildReportMarkup(customer, reportData) {
  const calculation = reportData.calculation || {};
  const model = reportData.calculationModel || {};
  const roof = reportData.roofData || {};
  const entries = Object.entries(calculation);
  const surfaces = Array.isArray(roof.surfaces) ? roof.surfaces : [];
  const surfaceArea = surfaces.reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
  const values = createReportValues({ model, entries, roof, surfaceArea });
  const generatedAt = new Date().toLocaleString('he-IL', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const firstYearLabel = values.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה';
  const tariffText = values.isCommercial
    ? '₪0.40 קבוע לקוט״ש למשך 25 שנה'
    : '₪0.48 לקוט״ש שנמכר + עליית 4% לערך הצריכה העצמית';
  const urbanText = values.urbanEligible
    ? `כן - תוספת ₪0.06 לקוט״ש ב-10 השנים הראשונות${values.urbanLocality ? ` (${values.urbanLocality})` : ''}`
    : 'לא חושבה תוספת אורבנית';

  return `
  <style>
    *{box-sizing:border-box}
    .pdfPage{width:794px;height:1123px;background:#fffaf2;color:#061d33;font-family:Assistant,"Noto Sans Hebrew",Arial,sans-serif;direction:rtl;position:relative;overflow:hidden;padding:46px 56px 36px}
    .pdfPage+.pdfPage{margin-top:18px}
    .pdfHeader{height:70px;display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid rgba(245,161,26,.58);padding-bottom:14px}
    .pdfLogoImage{display:block;width:160px;height:78px;object-fit:contain;object-position:right center}
    .pdfType{font-size:14px;color:#72808c;font-weight:850}
    .pdfFooter{position:absolute;left:56px;right:56px;bottom:24px;border-top:1px solid rgba(7,27,47,.12);padding-top:10px;display:flex;justify-content:space-between;color:#76838d;font-size:11px;font-weight:800;direction:ltr}
    .pdfFooter span:first-child{direction:ltr}.pdfFooter span:last-child{direction:ltr}

    .coverHero{height:250px;margin-top:25px;border-radius:28px;overflow:hidden;box-shadow:0 9px 22px rgba(7,27,47,.08)}
    .coverHero img{width:100%;height:100%;display:block;object-fit:cover}
    .metricGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:22px}
    .metricCard,.factCard{background:#fff;border:1px solid #eadbc7;border-radius:22px;box-shadow:0 8px 20px rgba(7,27,47,.045)}
    .metricCard{height:82px;padding:17px 20px;display:flex;flex-direction:column;justify-content:center}
    .metricCard span,.factCard span{color:#7b8790;font-size:13px;font-weight:850}
    .metricCard b{display:block;margin-top:5px;color:#061d33;font-size:25px;font-weight:950;line-height:1;direction:ltr;text-align:right}
    .summaryBand{position:relative;overflow:hidden;margin-top:22px;background:linear-gradient(135deg,#061d33,#104b7a);color:#fff;border-radius:25px;padding:22px 25px;min-height:104px}
    .summaryBand:before{content:"";position:absolute;width:125px;height:125px;left:-47px;top:-33px;border-radius:50%;background:rgba(245,161,26,.12)}
    .summaryBand h2{font-size:27px;margin:0;position:relative}.summaryBand p{font-size:15px;line-height:1.55;color:#dce6ed;margin:9px 0 0;position:relative;font-weight:650}
    .factGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;margin-top:20px}
    .factCard{height:72px;padding:14px 18px}.factCard b{display:block;margin-top:5px;font-size:19px;font-weight:950;line-height:1.05;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

    .page2Top{display:grid;grid-template-columns:1.22fr .9fr;gap:16px;margin-top:23px;direction:ltr}
    .installerPhoto{height:181px;border-radius:25px;overflow:hidden;box-shadow:0 8px 20px rgba(7,27,47,.08)}
    .installerPhoto img{width:100%;height:100%;display:block;object-fit:cover}
    .centralCard{height:181px;border-radius:25px;background:linear-gradient(145deg,#061d33,#0c3f68);color:white;padding:25px 25px;text-align:right;direction:rtl;box-shadow:0 10px 24px rgba(7,27,47,.13)}
    .centralCard span{display:block;font-size:16px;color:#edf4f8}.centralCard b{display:block;margin-top:10px;font-size:30px;color:#f5a11a;direction:ltr;text-align:right}.centralCard p{margin:14px 0 0;color:#dbe6ed;font-size:14px;line-height:1.5;font-weight:650}
    .sectionTitle{font-size:36px;line-height:1.05;margin:27px 0 16px;color:#061d33;font-weight:950;letter-spacing:-.025em}
    .numberRows{display:grid;gap:8px}
    .numberRow{height:41px;display:flex;justify-content:space-between;align-items:center;padding:0 17px;border:1px solid #eadbc7;background:#fff;border-radius:15px;box-shadow:0 5px 12px rgba(7,27,47,.035)}
    .numberRow span{font-size:13px;color:#77838d;font-weight:850}.numberRow b{font-size:14px;font-weight:950;direction:ltr;text-align:left}
    .tariffNotice{margin-top:17px;border-radius:19px;background:#fff1cc;border:1px solid #f0c568;padding:14px 18px;color:#59636b;font-size:13px;line-height:1.5;font-weight:750}
    .tariffNotice b{color:#3e4850}
    .roofSectionTitle{font-size:27px;margin:16px 0 10px;font-weight:950}
    .smallFacts{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
    .smallFact{height:63px;background:#fff;border:1px solid #eadbc7;border-radius:17px;padding:12px 16px;box-shadow:0 5px 12px rgba(7,27,47,.035)}
    .smallFact span{display:block;font-size:12px;color:#7b8790;font-weight:850}.smallFact b{display:block;margin-top:4px;font-size:19px;line-height:1;font-weight:950}

    .processTitle{font-size:37px;margin:28px 0 18px;font-weight:950;letter-spacing:-.025em}
    .processGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    .processCard{position:relative;height:131px;background:#fff;border:1px solid #eadbc7;border-radius:22px;padding:24px 22px 17px;box-shadow:0 8px 18px rgba(7,27,47,.045);overflow:hidden}
    .processCard:before{content:"";position:absolute;width:100px;height:100px;left:-34px;bottom:-38px;border-radius:50%;background:#fbf3e7}
    .processCard i{position:absolute;right:17px;top:16px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#f5a11a;color:white;font-style:normal;font-size:19px;font-weight:950}
    .processCard h3{font-size:21px;margin:38px 0 5px;font-weight:950;position:relative}.processCard p{font-size:13px;line-height:1.45;color:#6f7c86;font-weight:700;margin:0;position:relative}
    .familyBanner{height:186px;margin-top:18px;border-radius:24px;overflow:hidden;box-shadow:0 8px 20px rgba(7,27,47,.08)}
    .familyBanner img{display:block;width:100%;height:100%;object-fit:cover}
    .savedNotice{margin-top:18px;border:1px solid #a8e0c9;background:#eaf9f2;border-radius:20px;padding:17px 22px;text-align:right}
    .savedNotice h3{font-size:22px;margin:0}.savedNotice p{font-size:13px;line-height:1.5;color:#47705f;font-weight:700;margin:6px 0 0}
    .closingBand{position:relative;overflow:hidden;margin-top:18px;background:linear-gradient(135deg,#061d33,#104b7a);border-radius:23px;padding:20px 24px;color:white;min-height:91px}
    .closingBand:before{content:"";position:absolute;width:125px;height:125px;left:-47px;top:-33px;border-radius:50%;background:rgba(245,161,26,.12)}
    .closingBand h3{font-size:25px;margin:0;position:relative}.closingBand p{font-size:14px;color:#dce6ed;margin:7px 0 0;position:relative;font-weight:650}
  </style>

  <section class="pdfPage" data-template-version="${REPORT_TEMPLATE_VERSION}">
    ${header('בדיקת גג סולארית ראשונית')}
    <div class="coverHero"><img src="${coverHeroUrl}" alt="Roof Check by Solatrix" /></div>
    <div class="metricGrid">
      ${metric(firstYearLabel, formatMoney(values.annualSavings))}
      ${metric('החזר כולל מע״מ', `${values.paybackWithVat.toFixed(1)} שנים`)}
      ${metric('עלות לפני מע״מ', formatMoney(values.costBeforeVat))}
      ${metric('עלות כולל מע״מ', formatMoney(values.costWithVat))}
    </div>
    <div class="summaryBand"><h2>סיכום הבדיקה</h2><p>הנתונים מציגים סדר גודל ראשוני של התאמת הגג, הייצור, החיסכון והחזר ההשקעה. החישוב ישמש בסיס לשיחה מקצועית עם נציג Solatrix Energy.</p></div>
    <div class="factGrid">
      ${fact('שם הלקוח', customer.name || '—')}
      ${fact('כתובת', roof.address || model.address || '—')}
      ${fact('שטח שסומן', values.roofArea ? `${formatNumber(values.roofArea)} m²` : '—')}
      ${fact('הופק בתאריך', generatedAt)}
    </div>
    ${footer('1')}
  </section>

  <section class="pdfPage" data-template-version="${REPORT_TEMPLATE_VERSION}">
    ${header('נתוני החישוב')}
    <div class="page2Top">
      <div class="installerPhoto"><img src="${installersUrl}" alt="Solatrix installers" /></div>
      <div class="centralCard"><span>המספר המרכזי</span><b>${formatNumber(values.annualProduction)} kWh</b><p>ייצור שנתי משוער של המערכת בהתאם להספק ולשטח הגג.</p></div>
    </div>
    <h2 class="sectionTitle">המספרים מאחורי ההערכה</h2>
    <div class="numberRows">
      ${numberRow(firstYearLabel, formatMoney(values.annualSavings))}
      ${numberRow('החזר כולל מע״מ', values.paybackWithVat.toFixed(1))}
      ${numberRow('עלות לפני מע״מ', formatMoney(values.costBeforeVat))}
      ${numberRow('עלות כולל מע״מ', formatMoney(values.costWithVat))}
      ${numberRow('שטח גג מסומן', `${formatNumber(values.roofArea)} m²`)}
      ${numberRow('שטח גג שמיש', `${formatNumber(values.usableArea)} m²`)}
      ${numberRow('מספר פאנלים', formatNumber(values.panels))}
      ${numberRow('ייצור שנתי', `${formatNumber(values.annualProduction)} kWh`)}
    </div>
    <div class="tariffNotice"><b>מודל תעריף:</b> ${escapeHtml(tariffText)}.<br><b>תוספת אורבנית:</b> ${escapeHtml(urbanText)}.</div>
    <h2 class="roofSectionTitle">נתוני גג ותעריף</h2>
    <div class="smallFacts">
      ${smallFact('סוג גג', values.isCommercial ? 'מסחרי' : 'ביתי')}
      ${smallFact('תוספת אורבנית', values.urbanEligible ? 'כן' : 'לא')}
      ${smallFact('חשבון חודשי', values.monthlyBill ? `₪${formatNumber(values.monthlyBill)}` : '—')}
      ${smallFact('מספר WhatsApp', customer.phone || '—')}
    </div>
    ${footer('2')}
  </section>

  <section class="pdfPage" data-template-version="${REPORT_TEMPLATE_VERSION}">
    ${header('השלבים הבאים')}
    <h2 class="processTitle">איך מתקדמים מכאן?</h2>
    <div class="processGrid">
      ${step(1,'שיחת היכרות','נציג Solatrix יעבור איתכם על הנתונים ויבין את מטרות הפרויקט.')}
      ${step(2,'בדיקת מסמכים','נבדוק חשבונות חשמל, בעלות, חיבור קיים ונתוני הגג.')}
      ${step(3,'בדיקת שטח','מודד או מהנדס יבדוק את השטח, ההצללות, החשמל והקונסטרוקציה.')}
      ${step(4,'הצעה מלאה','תקבלו תכנון והצעה מסודרת עם ציוד, מחיר, לוחות זמנים ותשואה.')}
    </div>
    <div class="familyBanner"><img src="${familyUrl}" alt="From roof check to working solar system" /></div>
    <div class="savedNotice"><h3>הדוח נשמר ב-Solatrix</h3><p>העתק הדוח נשמר בכרטיס הלקוח וניתן יהיה לשלוח אותו ל-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.</p></div>
    <div class="closingBand"><h3>Solatrix Energy</h3><p>מערכות סולאריות, אגירה וליווי מקצועי משלב הבדיקה ועד הפעלת המערכת.</p></div>
    ${footer('3')}
  </section>`;
}

function createReportValues({ model, entries, roof, surfaceArea }) {
  const map = new Map(entries.map(([label, value]) => [String(label).trim(), value]));
  const find = (...parts) => {
    const match = entries.find(([label]) => parts.every((part) => String(label).includes(part)));
    return match?.[1];
  };
  const value = (modelValue, fallback, defaultValue = 0) => {
    const number = Number(modelValue);
    if (Number.isFinite(number)) return number;
    const parsed = parseNumeric(fallback);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  };

  const roofArea = value(model.roofArea, find('שטח גג', 'מסומן') || find('שטח גג') || surfaceArea, surfaceArea);
  const usableArea = value(model.usableArea, find('שטח גג', 'שמיש') || find('שטח שימושי'), roofArea * 0.82);
  const annualProduction = value(model.annualProduction, find('ייצור שנתי'));
  const annualSavings = value(model.annualSavings, find('חיסכון בשנה הראשונה') || find('הכנסה בשנה הראשונה') || find('חיסכון/הכנסה שנתית') || find('metric_'));
  const costBeforeVat = value(model.costBeforeVat, find('עלות לפני מע״מ'));
  const costWithVat = value(model.costWithVat, find('עלות כולל מע״מ'), costBeforeVat * 1.18);
  const paybackWithVat = value(model.paybackWithVat, find('החזר כולל מע״מ') || find('החזר השקעה'), annualSavings ? costWithVat / annualSavings : 0);
  const panels = value(model.panels, find('מספר פאנלים') || find('פאנלים'));
  const monthlyBill = value(model.monthlyBill, roof.monthlyBill);

  return {
    roofArea,
    usableArea,
    annualProduction,
    annualSavings,
    costBeforeVat,
    costWithVat,
    paybackWithVat,
    panels,
    monthlyBill,
    isCommercial: model.isCommercial === true || roof.roofType === 'commercial',
    urbanEligible: model.urbanEligible === true || roof.urbanEligible === true,
    urbanLocality: model.urbanLocality || roof.urbanLocality || ''
  };
}

function header(type) {
  return `<div class="pdfHeader"><img class="pdfLogoImage" src="${reportLogoUrl}" alt="Solatrix Energy" /><div class="pdfType">${escapeHtml(type)}</div></div>`;
}
function footer(page) { return `<div class="pdfFooter"><span>${page} / 3</span><span>Solatrix Energy • Roof Check</span></div>`; }
function metric(label, value) { return `<div class="metricCard"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function fact(label, value) { return `<div class="factCard"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function numberRow(label, value) { return `<div class="numberRow"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function smallFact(label, value) { return `<div class="smallFact"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function step(number, title, text) { return `<div class="processCard"><i>${number}</i><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`; }
function parseNumeric(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  return normalized ? Number(normalized) : NaN;
}
function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('he-IL'); }
function formatMoney(value) { return `₪${formatNumber(value)}`; }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
