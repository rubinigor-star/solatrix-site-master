import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import familyUrl from './assets/roof-check-report/roof-check-family.webp';

const REPORT_TEMPLATE_VERSION = 'roof-check-vector-v2';
const reportLogoUrl = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const HEEBO_REGULAR_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Regular.ttf';
const HEEBO_BOLD_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/static/Heebo-Bold.ttf';

const C = {
  bg: [255, 250, 242],
  navy: [6, 29, 51],
  blue: [16, 75, 122],
  orange: [245, 161, 26],
  grey: [119, 131, 141],
  lightBorder: [234, 219, 199],
  white: [255, 255, 255],
  paleOrange: [255, 241, 204],
  paleGreen: [234, 249, 242],
  greenBorder: [168, 224, 201]
};

export async function createRoofCheckPdf({ customer = {}, reportData = {} } = {}) {
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

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
  await installFonts(pdf);
  const [logo, cover, installers, family] = await Promise.all([
    loadImageData(reportLogoUrl, 1200),
    loadImageData(coverHeroUrl, 3000),
    loadImageData(installersUrl, 2400),
    loadImageData(familyUrl, 3000)
  ]);

  drawPageOne(pdf, { customer, roof, model, values, generatedAt, firstYearLabel, logo, cover });
  pdf.addPage('a4', 'portrait');
  drawPageTwo(pdf, { customer, values, firstYearLabel, tariffText, urbanText, logo, installers });
  pdf.addPage('a4', 'portrait');
  drawPageThree(pdf, { logo, family });

  pdf.setProperties({
    title: 'Solatrix Roof Check',
    subject: `Solatrix Roof Check - ${REPORT_TEMPLATE_VERSION}`,
    author: 'Solatrix Energy',
    creator: 'Solatrix Roof Check'
  });
  return pdf.output('blob');
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('Unable to read PDF blob.'));
    reader.readAsDataURL(blob);
  });
}

function drawPageOne(pdf, ctx) {
  pageBase(pdf, 'בדיקת גג סולארית ראשונית', 1, ctx.logo);
  addCoverImage(pdf, ctx.cover, 18, 36, 174, 66, 8);

  const cards = [
    [ctx.firstYearLabel, formatMoney(ctx.values.annualSavings)],
    ['החזר כולל מע״מ', `${ctx.values.paybackWithVat.toFixed(1)} שנים`],
    ['עלות לפני מע״מ', formatMoney(ctx.values.costBeforeVat)],
    ['עלות כולל מע״מ', formatMoney(ctx.values.costWithVat)]
  ];
  cards.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 107 : 18;
    const y = i < 2 ? 109 : 136;
    metricCard(pdf, x, y, 85, 22, label, value);
  });

  gradientBand(pdf, 18, 165, 174, 34, 'סיכום הבדיקה',
    'הנתונים מציגים סדר גודל ראשוני של התאמת הגג, הייצור, החיסכון והחזר ההשקעה. החישוב ישמש בסיס לשיחה מקצועית עם נציג Solatrix Energy.');

  const facts = [
    ['שם הלקוח', ctx.customer.name || '—'],
    ['כתובת', ctx.roof.address || ctx.model.address || '—'],
    ['שטח שסומן', ctx.values.roofArea ? `${formatNumber(ctx.values.roofArea)} m²` : '—'],
    ['הופק בתאריך', ctx.generatedAt]
  ];
  facts.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 107 : 18;
    const y = i < 2 ? 207 : 232;
    factCard(pdf, x, y, 85, 20, label, value);
  });
}

function drawPageTwo(pdf, ctx) {
  pageBase(pdf, 'נתוני החישוב', 2, ctx.logo);
  addCoverImage(pdf, ctx.installers, 18, 36, 106, 48, 7);
  darkCard(pdf, 128, 36, 64, 48, 'המספר המרכזי', `${formatNumber(ctx.values.annualProduction)} kWh`,
    'ייצור שנתי משוער של המערכת בהתאם להספק ולשטח הגג.');

  rtlText(pdf, 'המספרים מאחורי ההערכה', 192, 100, 10, 'bold', C.navy);
  const rows = [
    [ctx.firstYearLabel, formatMoney(ctx.values.annualSavings)],
    ['החזר כולל מע״מ', ctx.values.paybackWithVat.toFixed(1)],
    ['עלות לפני מע״מ', formatMoney(ctx.values.costBeforeVat)],
    ['עלות כולל מע״מ', formatMoney(ctx.values.costWithVat)],
    ['שטח גג מסומן', `${formatNumber(ctx.values.roofArea)} m²`],
    ['שטח גג שמיש', `${formatNumber(ctx.values.usableArea)} m²`],
    ['מספר פאנלים', formatNumber(ctx.values.panels)],
    ['ייצור שנתי', `${formatNumber(ctx.values.annualProduction)} kWh`]
  ];
  rows.forEach(([label, value], index) => numberRow(pdf, 18, 109 + index * 13, 174, 10.5, label, value));

  roundedBox(pdf, 18, 216, 174, 25, C.paleOrange, [240, 197, 104], 5);
  rtlText(pdf, `מודל תעריף: ${ctx.tariffText}.`, 187, 225, 4.1, 'bold', [89, 99, 107]);
  rtlText(pdf, `תוספת אורבנית: ${ctx.urbanText}.`, 187, 232, 4.1, 'bold', [89, 99, 107]);

  rtlText(pdf, 'נתוני גג ותעריף', 192, 251, 7.6, 'bold', C.navy);
  const small = [
    ['סוג גג', ctx.values.isCommercial ? 'מסחרי' : 'ביתי'],
    ['תוספת אורבנית', ctx.values.urbanEligible ? 'כן' : 'לא'],
    ['חשבון חודשי', ctx.values.monthlyBill ? `₪${formatNumber(ctx.values.monthlyBill)}` : '—'],
    ['מספר WhatsApp', ctx.customer.phone || '—']
  ];
  small.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 107 : 18;
    const y = i < 2 ? 256 : 275;
    smallFact(pdf, x, y, 85, 16, label, value);
  });
}

function drawPageThree(pdf, ctx) {
  pageBase(pdf, 'השלבים הבאים', 3, ctx.logo);
  rtlText(pdf, 'איך מתקדמים מכאן?', 192, 55, 11.2, 'bold', C.navy);

  const steps = [
    [1, 'שיחת היכרות', 'נציג Solatrix יעבור איתכם על הנתונים ויבין את מטרות הפרויקט.'],
    [2, 'בדיקת מסמכים', 'נבדוק חשבונות חשמל, בעלות, חיבור קיים ונתוני הגג.'],
    [3, 'בדיקת שטח', 'מודד או מהנדס יבדוק את השטח, ההצללות, החשמל והקונסטרוקציה.'],
    [4, 'הצעה מלאה', 'תקבלו תכנון והצעה מסודרת עם ציוד, מחיר, לוחות זמנים ותשואה.']
  ];
  steps.forEach(([number, title, text], i) => {
    const x = i % 2 === 0 ? 107 : 18;
    const y = i < 2 ? 64 : 104;
    processCard(pdf, x, y, 85, 35, number, title, text);
  });

  addCoverImage(pdf, ctx.family, 18, 148, 174, 52, 7);
  roundedBox(pdf, 18, 207, 174, 31, C.paleGreen, C.greenBorder, 6);
  rtlText(pdf, 'הדוח נשמר ב-Solatrix', 187, 220, 7.2, 'bold', C.navy);
  rtlText(pdf, 'העתק הדוח נשמר בכרטיס הלקוח וניתן יהיה לשלוח אותו ל-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.', 187, 230, 4.2, 'bold', [71, 112, 95], 160);
  gradientBand(pdf, 18, 245, 174, 34, 'Solatrix Energy',
    'מערכות סולאריות, אגירה וליווי מקצועי משלב הבדיקה ועד הפעלת המערכת.');
}

function pageBase(pdf, title, page, logo) {
  pdf.setFillColor(...C.bg);
  pdf.rect(0, 0, 210, 297, 'F');
  if (logo) addContainImage(pdf, logo, 158, 10, 34, 18);
  rtlText(pdf, title, 60, 19, 4.8, 'bold', [114, 128, 140]);
  pdf.setDrawColor(245, 161, 26);
  pdf.setLineWidth(0.35);
  pdf.line(18, 30, 192, 30);
  pdf.setDrawColor(220, 216, 207);
  pdf.setLineWidth(0.25);
  pdf.line(18, 286, 192, 286);
  ltrText(pdf, `${page} / 3`, 18, 291.5, 3.3, 'bold', [118, 131, 141]);
  ltrText(pdf, 'Solatrix Energy • Roof Check', 192, 291.5, 3.3, 'bold', [118, 131, 141], 'right');
}

function metricCard(pdf, x, y, w, h, label, value) {
  roundedBox(pdf, x, y, w, h, C.white, C.lightBorder, 6);
  rtlText(pdf, label, x + w - 5, y + 8, 4, 'bold', C.grey);
  ltrText(pdf, value, x + w - 5, y + 17.2, 7.2, 'bold', C.navy, 'right');
}

function factCard(pdf, x, y, w, h, label, value) {
  roundedBox(pdf, x, y, w, h, C.white, C.lightBorder, 6);
  rtlText(pdf, label, x + w - 5, y + 7, 3.7, 'bold', C.grey);
  rtlText(pdf, String(value), x + w - 5, y + 15.2, 5.2, 'bold', C.navy, w - 10);
}

function numberRow(pdf, x, y, w, h, label, value) {
  roundedBox(pdf, x, y, w, h, C.white, C.lightBorder, 4);
  rtlText(pdf, label, x + w - 4, y + 6.8, 3.7, 'bold', C.grey);
  ltrText(pdf, value, x + 5, y + 6.8, 4.1, 'bold', C.navy, 'left');
}

function smallFact(pdf, x, y, w, h, label, value) {
  roundedBox(pdf, x, y, w, h, C.white, C.lightBorder, 5);
  rtlText(pdf, label, x + w - 5, y + 6, 3.4, 'bold', C.grey);
  rtlText(pdf, String(value), x + w - 5, y + 13, 5.4, 'bold', C.navy, w - 10);
}

function processCard(pdf, x, y, w, h, number, title, text) {
  roundedBox(pdf, x, y, w, h, C.white, C.lightBorder, 6);
  pdf.setFillColor(...C.orange);
  pdf.circle(x + w - 10, y + 10, 5.5, 'F');
  ltrText(pdf, String(number), x + w - 10, y + 11.7, 5.3, 'bold', C.white, 'center');
  rtlText(pdf, title, x + w - 8, y + 22, 6.2, 'bold', C.navy);
  rtlText(pdf, text, x + w - 8, y + 29.5, 3.7, 'bold', [111, 124, 134], w - 16);
}

function darkCard(pdf, x, y, w, h, label, value, text) {
  roundedBox(pdf, x, y, w, h, C.navy, C.navy, 7);
  rtlText(pdf, label, x + w - 7, y + 12, 4.6, 'normal', C.white);
  ltrText(pdf, value, x + w - 7, y + 24, 8.5, 'bold', C.orange, 'right');
  rtlText(pdf, text, x + w - 7, y + 35, 4.1, 'bold', [220, 230, 237], w - 14);
}

function gradientBand(pdf, x, y, w, h, title, text) {
  roundedBox(pdf, x, y, w, h, C.blue, C.blue, 7);
  pdf.setFillColor(...C.navy);
  pdf.roundedRect(x, y, w * 0.58, h, 7, 7, 'F');
  pdf.setFillColor(245, 161, 26);
  pdf.setGState?.(new pdf.GState({ opacity: 0.12 }));
  pdf.circle(x + 6, y + 4, 18, 'F');
  pdf.setGState?.(new pdf.GState({ opacity: 1 }));
  rtlText(pdf, title, x + w - 7, y + 14, 7.4, 'bold', C.white);
  rtlText(pdf, text, x + w - 7, y + 24, 4.2, 'bold', [220, 230, 237], w - 14);
}

function roundedBox(pdf, x, y, w, h, fill, stroke, radius) {
  pdf.setFillColor(...fill);
  pdf.setDrawColor(...stroke);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(x, y, w, h, radius, radius, 'FD');
}

function rtlText(pdf, text, x, y, size, style = 'normal', color = C.navy, maxWidth) {
  pdf.setFont('Heebo', style);
  pdf.setFontSize(mmToPt(size));
  pdf.setTextColor(...color);
  pdf.setR2L(true);
  const value = String(text ?? '');
  const lines = maxWidth ? pdf.splitTextToSize(value, maxWidth) : value;
  pdf.text(lines, x, y, { align: 'right', baseline: 'alphabetic' });
  pdf.setR2L(false);
}

function ltrText(pdf, text, x, y, size, style = 'normal', color = C.navy, align = 'left') {
  pdf.setFont('Heebo', style);
  pdf.setFontSize(mmToPt(size));
  pdf.setTextColor(...color);
  pdf.setR2L(false);
  pdf.text(String(text ?? ''), x, y, { align, baseline: 'alphabetic' });
}

function mmToPt(mm) { return mm * 2.8346457; }

async function installFonts(pdf) {
  try {
    const [regular, bold] = await Promise.all([fetchBase64(HEEBO_REGULAR_URL), fetchBase64(HEEBO_BOLD_URL)]);
    pdf.addFileToVFS('Heebo-Regular.ttf', regular);
    pdf.addFileToVFS('Heebo-Bold.ttf', bold);
    pdf.addFont('Heebo-Regular.ttf', 'Heebo', 'normal');
    pdf.addFont('Heebo-Bold.ttf', 'Heebo', 'bold');
  } catch (error) {
    console.error('Unable to embed Heebo in PDF.', error);
    throw new Error('לא ניתן לטעון את הגופן הדרוש ליצירת הדוח. נסו שוב.');
  }
}

async function fetchBase64(url) {
  const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

async function loadImageData(url, maxPixelsWide = 3000) {
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxPixelsWide / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return { data: canvas.toDataURL('image/jpeg', 0.98), width, height };
  } catch (error) {
    console.warn('Unable to load PDF image:', url, error);
    return null;
  }
}

function addCoverImage(pdf, image, x, y, w, h, radius = 0) {
  if (!image) return;
  const sourceRatio = image.width / image.height;
  const targetRatio = w / h;
  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;
  if (sourceRatio > targetRatio) {
    drawW = h * sourceRatio;
    drawX = x - (drawW - w) / 2;
  } else {
    drawH = w / sourceRatio;
    drawY = y - (drawH - h) / 2;
  }
  pdf.saveGraphicsState();
  pdf.roundedRect(x, y, w, h, radius, radius, null);
  pdf.clip();
  pdf.addImage(image.data, 'JPEG', drawX, drawY, drawW, drawH, undefined, 'NONE');
  pdf.restoreGraphicsState();
}

function addContainImage(pdf, image, x, y, w, h) {
  if (!image) return;
  const ratio = Math.min(w / image.width, h / image.height);
  const drawW = image.width * ratio;
  const drawH = image.height * ratio;
  pdf.addImage(image.data, 'JPEG', x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH, undefined, 'NONE');
}

function createReportValues({ model, entries, roof, surfaceArea }) {
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

function parseNumeric(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '').replace(/,/g, '').replace(/[^0-9.\-]/g, '');
  return normalized ? Number(normalized) : NaN;
}
function formatNumber(value) { return Math.round(Number(value) || 0).toLocaleString('he-IL'); }
function formatMoney(value) { return `₪${formatNumber(value)}`; }
