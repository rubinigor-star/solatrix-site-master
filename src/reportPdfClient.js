import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function createRoofCheckPdf({ customer = {}, reportData = {} } = {}) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:794px;background:#eef1f4;z-index:-1;';
  host.innerHTML = buildReportMarkup(customer, reportData);
  document.body.appendChild(host);

  try {
    await document.fonts?.ready;
    const pages = [...host.querySelectorAll('.pdfPage')];
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    for (let index = 0; index < pages.length; index += 1) {
      const canvas = await html2canvas(pages[index], {
        scale: 1.6,
        backgroundColor: '#fffdf8',
        useCORS: true,
        logging: false,
        windowWidth: 794,
        windowHeight: 1123
      });
      const image = canvas.toDataURL('image/jpeg', 0.9);
      if (index > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(image, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

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

function buildReportMarkup(customer, reportData) {
  const calculation = reportData.calculation || {};
  const model = reportData.calculationModel || {};
  const roof = reportData.roofData || {};
  const entries = Object.entries(calculation);
  const keyMetrics = entries.slice(0, 8);
  const surfaces = Array.isArray(roof.surfaces) ? roof.surfaces : [];
  const obstacles = Array.isArray(roof.obstacles) ? roof.obstacles : [];
  const totalArea = surfaces.reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
  const generatedAt = new Date().toLocaleString('he-IL');
  const tariffText = model.isCommercial
    ? '₪0.40 קבוע לקוט״ש למשך 25 שנה'
    : '₪0.48 לקוט״ש שנמכר + עליית 4% לערך הצריכה העצמית';
  const urbanText = model.urbanEligible
    ? `כן — תוספת ₪0.06 לקוט״ש ב-10 השנים הראשונות${model.urbanLocality ? ` (${model.urbanLocality})` : ''}`
    : 'לא חושבה תוספת אורבנית';

  return `
  <style>
    .pdfPage{width:794px;height:1123px;background:#fffdf8;color:#071b2f;font-family:Assistant,Arial,sans-serif;direction:rtl;box-sizing:border-box;padding:58px 62px;position:relative;overflow:hidden}
    .pdfPage+ .pdfPage{margin-top:18px}.pdfGlow{position:absolute;width:390px;height:390px;border-radius:50%;background:radial-gradient(circle,rgba(245,161,26,.25),transparent 70%);left:-160px;bottom:-170px}
    .pdfHeader{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid rgba(245,161,26,.42);padding-bottom:18px;position:relative;z-index:2}.pdfLogo{font-size:30px;font-weight:950;direction:ltr}.pdfLogo small{display:block;font-size:9px;letter-spacing:.25em;color:#7c8791;text-align:left}.pdfType{font-size:14px;color:#6e7880;font-weight:850}
    .pdfKicker{margin-top:44px;color:#a96a05;font-size:14px;font-weight:950;letter-spacing:.08em}.pdfTitle{font-size:58px;line-height:.98;margin:10px 0 0;font-weight:950;letter-spacing:-.04em}.pdfTitle em{font-style:normal;color:#f5a11a}.pdfLead{font-size:20px;line-height:1.5;color:#53606b;font-weight:700;margin-top:22px}
    .pdfHeroGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:34px}.pdfMetric{background:#fff;border:1px solid #eadbc7;border-radius:24px;padding:22px;box-shadow:0 12px 28px rgba(7,27,47,.07)}.pdfMetric span{display:block;color:#7c8791;font-weight:850;font-size:14px}.pdfMetric b{display:block;font-size:29px;margin-top:8px;direction:ltr;text-align:right}
    .pdfBand{margin-top:28px;background:linear-gradient(135deg,#071b2f,#0e3657);color:#fff;border-radius:28px;padding:28px}.pdfBand h2{font-size:30px;margin:0}.pdfBand p{font-size:16px;line-height:1.55;color:#dbe7ef;margin:12px 0 0}.pdfFacts{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:28px}.pdfFact{background:#fff;border:1px solid #eadbc7;border-radius:20px;padding:18px}.pdfFact span{font-size:13px;color:#7c8791;font-weight:850}.pdfFact b{display:block;font-size:22px;margin-top:6px}
    .pdfSectionTitle{font-size:34px;margin:36px 0 18px;font-weight:950}.pdfTable{display:grid;gap:11px}.pdfRow{display:flex;justify-content:space-between;gap:20px;padding:16px 18px;border:1px solid #eadbc7;background:#fff;border-radius:16px}.pdfRow span{color:#6f7982;font-weight:800}.pdfRow b{font-weight:950;text-align:left;direction:ltr}
    .pdfNotice{margin-top:24px;background:#fff3dc;border:1px solid #f0d29a;border-radius:20px;padding:20px;font-size:16px;line-height:1.55;color:#4d5964;font-weight:700}.pdfProcess{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:20px}.pdfStep{background:#fff;border:1px solid #eadbc7;border-radius:20px;padding:20px}.pdfStep i{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#f5a11a;color:#fff;font-style:normal;font-weight:950}.pdfStep h3{font-size:19px;margin:12px 0 6px}.pdfStep p{margin:0;color:#65717b;line-height:1.45;font-weight:700}
    .pdfFooter{position:absolute;right:62px;left:62px;bottom:32px;border-top:1px solid rgba(7,27,47,.12);padding-top:12px;display:flex;justify-content:space-between;color:#7b858d;font-size:12px;font-weight:800}.pdfContact{margin-top:30px;background:#eaf9ef;border:1px solid #bee7cd;border-radius:24px;padding:24px}.pdfContact h3{font-size:25px;margin:0}.pdfContact p{margin:10px 0 0;font-size:16px;line-height:1.5;color:#37624a;font-weight:750}
  </style>
  <section class="pdfPage"><div class="pdfGlow"></div>${header('בדיקת גג סולארית ראשונית')}
    <div class="pdfKicker">ROOF CHECK BY SOLATRIX</div><h1 class="pdfTitle">הגג שלכם<br><em>יכול להתחיל לחסוך</em></h1>
    <p class="pdfLead">דוח ראשוני המבוסס על הנתונים שהוזנו במחשבון. לפני הצעה סופית נבצע בדיקת שטח, חשמל וקונסטרוקציה.</p>
    <div class="pdfHeroGrid">${keyMetrics.slice(0,4).map(([label,value])=>metric(label,value)).join('')}</div>
    <div class="pdfBand"><h2>סיכום הבדיקה</h2><p>הנתונים מציגים סדר גודל ראשוני של התאמת הגג, הייצור, החיסכון והחזר ההשקעה. החישוב ישמש בסיס לשיחה מקצועית עם נציג Solatrix Energy.</p></div>
    <div class="pdfFacts"><div class="pdfFact"><span>שם הלקוח</span><b>${escapeHtml(customer.name || '—')}</b></div><div class="pdfFact"><span>כתובת</span><b>${escapeHtml(roof.address || '—')}</b></div><div class="pdfFact"><span>שטח שסומן</span><b>${totalArea ? `${formatNumber(totalArea)} m²` : '—'}</b></div><div class="pdfFact"><span>הופק בתאריך</span><b>${escapeHtml(generatedAt)}</b></div></div>
    ${footer('1')}
  </section>
  <section class="pdfPage">${header('נתוני החישוב')}
    <h2 class="pdfSectionTitle">המספרים מאחורי ההערכה</h2>
    <div class="pdfTable">${entries.map(([label,value])=>row(label,value)).join('') || row('נתוני החישוב','נשמרו במערכת')}</div>
    <div class="pdfNotice"><b>מודל תעריף:</b> ${escapeHtml(tariffText)}.<br><b>תוספת אורבנית:</b> ${escapeHtml(urbanText)}.</div>
    <h2 class="pdfSectionTitle" style="font-size:28px">נתוני גג ותעריף</h2>
    <div class="pdfFacts"><div class="pdfFact"><span>סוג גג</span><b>${escapeHtml(model.isCommercial ? 'מסחרי' : 'ביתי')}</b></div><div class="pdfFact"><span>תוספת אורבנית</span><b>${escapeHtml(model.urbanEligible ? 'כן' : 'לא')}</b></div><div class="pdfFact"><span>חשבון חודשי</span><b>${roof.monthlyBill ? `₪${formatNumber(roof.monthlyBill)}` : '—'}</b></div><div class="pdfFact"><span>מספר WhatsApp</span><b>${escapeHtml(customer.phone || '—')}</b></div></div>
    ${footer('2')}
  </section>
  <section class="pdfPage">${header('השלבים הבאים')}
    <h2 class="pdfSectionTitle">איך מתקדמים מכאן?</h2>
    <div class="pdfProcess">${step(1,'שיחת היכרות','נציג Solatrix יעבור איתכם על הנתונים ויבין את מטרות הפרויקט.')}${step(2,'בדיקת מסמכים','נבדוק חשבונות חשמל, בעלות, חיבור קיים ונתוני הגג.')}${step(3,'בדיקת שטח','מודד או מהנדס יבדוק את השטח, ההצללות, החשמל והקונסטרוקציה.')}${step(4,'הצעה מלאה','תקבלו תכנון והצעה מסודרת עם ציוד, מחיר, לוחות זמנים ותשואה.')}</div>
    <div class="pdfContact"><h3>הדוח נשמר ב-Solatrix</h3><p>העתק הדוח נשמר בכרטיס הלקוח וניתן יהיה לשלוח אותו ל-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.</p></div>
    <div class="pdfBand" style="margin-top:30px"><h2>Solatrix Energy</h2><p>מערכות סולאריות, אגירה וליווי מקצועי משלב הבדיקה ועד הפעלת המערכת.</p></div>
    ${footer('3')}
  </section>`;
}

function header(type) { return `<div class="pdfHeader"><div class="pdfLogo">SOLATRIX<small>ENERGY</small></div><div class="pdfType">${escapeHtml(type)}</div></div>`; }
function footer(page) { return `<div class="pdfFooter"><span>Solatrix Energy · Roof Check</span><span>${page} / 3</span></div>`; }
function metric(label, value) { return `<div class="pdfMetric"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function row(label, value) { return `<div class="pdfRow"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function step(number, title, text) { return `<div class="pdfStep"><i>${number}</i><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></div>`; }
function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('he-IL'); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }
