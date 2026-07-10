import './reportUxFix.css';
import { LeadSubmissionError, submitLead } from './lib/leadApi.js';
import { formatPublicLeadReference } from './lib/publicReference.js';
import { blobToBase64, createRoofCheckPdf } from './reportPdfClient.js';

const DRAFT_KEY = 'solatrix_roof_check_lead_draft';

function enhanceReportExperience() {
  const reportCard = document.querySelector('.reportCard');
  if (!reportCard || reportCard.dataset.reportUxFixed === 'true') return;

  const originalPdfButton = reportCard.querySelector('[data-action="generatePdf"]');
  const originalLeadFields = reportCard.querySelector('.leadFields');
  if (!originalPdfButton || !originalLeadFields) return;

  reportCard.dataset.reportUxFixed = 'true';
  reportCard.querySelectorAll('[data-request-whatsapp-report], .whatsappReportCard, .reportWhatsappOffer').forEach((node) => node.remove());
  originalPdfButton.hidden = true;
  originalPdfButton.setAttribute('aria-hidden', 'true');
  originalPdfButton.tabIndex = -1;
  originalLeadFields.hidden = true;

  const draft = readDraft();
  const originalName = originalLeadFields.querySelector('[data-field="leadName"]');
  const originalPhone = originalLeadFields.querySelector('[data-field="leadPhone"]');
  const originalEmail = originalLeadFields.querySelector('[data-stage-field="email"]');

  const offer = document.createElement('section');
  offer.className = 'reportWhatsappOffer';
  offer.innerHTML = `
    <div class="reportWhatsappIntro">
      <div class="reportWhatsappBadge">PDF</div>
      <div class="reportWhatsappCopy">
        <span>הדוח המלא שלכם</span>
        <h3>רוצים לקבל את הדוח המלא ב-WhatsApp?</h3>
        <p>נשמור את תוצאות הבדיקה ונכין עבורכם דוח מסודר עם כל הנתונים והחישובים.</p>
      </div>
      <button class="reportWhatsappOpen" type="button" data-open-report-form>קבלת הדוח ב-WhatsApp</button>
    </div>
    <div class="reportWhatsappForm" data-report-form>
      <p class="reportWhatsappFormIntro">מלאו את הפרטים ואשרו שנוכל לשלוח את הדוח ולחזור אליכם בנוגע לבדיקה ולהצעה.</p>
      <div class="reportWhatsappGrid">
        <label><span>שם מלא *</span><input name="name" autocomplete="name" value="${escapeAttr(originalName?.value || draft.name || '')}" /></label>
        <label><span>מספר WhatsApp *</span><input name="phone" autocomplete="tel" inputmode="tel" value="${escapeAttr(originalPhone?.value || draft.phone || '')}" /></label>
        <label class="wide"><span>אימייל (לא חובה)</span><input name="email" autocomplete="email" type="email" value="${escapeAttr(originalEmail?.value || draft.email || '')}" /></label>
      </div>
      <label class="reportWhatsappConsent"><input type="checkbox" name="consent" /><span>אני מבקש/ת לקבל את דוח ה-PDF ב-WhatsApp ומאשר/ת לנציג Solatrix Energy ליצור איתי קשר בנוגע לבדיקה ולהצעה.</span></label>
      <p class="reportWhatsappError" data-report-error hidden></p>
      <button class="reportWhatsappSubmit" type="button" data-submit-report-request>שליחת הדוח ל-WhatsApp</button>
      <div class="reportWhatsappSuccess" data-report-success hidden tabindex="-1"></div>
      <p class="reportWhatsappFinePrint">הדוח הוא הערכה דיגיטלית ראשונית. הצעה סופית כפופה לבדיקת שטח, חשמל וקונסטרוקציה.</p>
    </div>`;

  reportCard.appendChild(offer);
  offer.querySelector('[data-open-report-form]')?.addEventListener('click', () => {
    offer.classList.add('is-open');
    setTimeout(() => offer.querySelector('input[name="name"]')?.focus(), 50);
  });
  offer.querySelector('[data-submit-report-request]')?.addEventListener('click', () => {
    submitWhatsappReport({ offer, reportCard, originalName, originalPhone, originalEmail });
  });
}

async function submitWhatsappReport({ offer, reportCard, originalName, originalPhone, originalEmail }) {
  const name = offer.querySelector('input[name="name"]')?.value?.trim() || '';
  const phone = offer.querySelector('input[name="phone"]')?.value?.trim() || '';
  const email = offer.querySelector('input[name="email"]')?.value?.trim() || '';
  const consent = offer.querySelector('input[name="consent"]')?.checked === true;
  const button = offer.querySelector('[data-submit-report-request]');
  const errorNode = offer.querySelector('[data-report-error]');
  const successNode = offer.querySelector('[data-report-success]');

  errorNode.hidden = true;
  successNode.hidden = true;
  const errors = [];
  if (name.length < 2) errors.push('נא להזין שם מלא.');
  if (!/^(?:9725\d{8}|05\d{8})$/.test(phone.replace(/\D/g, ''))) errors.push('נא להזין מספר WhatsApp תקין.');
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push('כתובת האימייל אינה תקינה.');
  if (!consent) errors.push('כדי לקבל את הדוח יש לאשר את הבקשה ואת יצירת הקשר.');
  if (errors.length) {
    errorNode.textContent = errors.join(' ');
    errorNode.hidden = false;
    return;
  }

  button.disabled = true;
  button.textContent = 'מכינים ושומרים את הדוח...';
  syncOriginalField(originalName, name);
  syncOriginalField(originalPhone, phone);
  if (originalEmail) syncOriginalField(originalEmail, email);
  writeDraft({ ...readDraft(), name, phone, email });

  const reportData = collectReportData(reportCard, phone);

  try {
    const pdfBlob = await createRoofCheckPdf({ customer: { name, phone, email }, reportData });
    const reportFileBase64 = await blobToBase64(pdfBlob);
    const safeName = name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer';
    const filename = `solatrix-roof-check-${safeName}-${Date.now()}.pdf`;

    const result = await submitLead({
      name,
      phone,
      email,
      consent: true,
      sourceType: 'roof-check-whatsapp-report',
      sourcePage: location.pathname,
      cityOrAddress: document.querySelector('[data-field="address"]')?.value || '',
      monthlyBill: document.querySelector('[data-field="monthlyBill"]')?.value || '',
      message: 'הלקוח ביקש לקבל את דוח ה-PDF ב-WhatsApp ואישר יצירת קשר.',
      reportData,
      reportFile: {
        base64: reportFileBase64,
        filename,
        mimeType: 'application/pdf'
      },
      metadata: {
        whatsappReportRequested: true,
        recipientPhone: normalizePhone(phone)
      }
    });

    const reference = formatPublicLeadReference(result.leadNumber);
    successNode.innerHTML = `<b>הבקשה התקבלה${reference ? ` — מספר פנייה ${reference}` : ''}.</b><br>תודה. הדוח נשמר ויישלח למספר ה-WhatsApp שהזנתם לאחר השלמת ההכנה.`;
    successNode.hidden = false;
    successNode.focus();
  } catch (error) {
    errorNode.textContent = error instanceof LeadSubmissionError
      ? error.message
      : 'לא הצלחנו להכין או לשמור את הדוח. נסו שוב או פנו אלינו ב-WhatsApp.';
    errorNode.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'שליחת הדוח ל-WhatsApp';
  }
}

function collectReportData(reportCard, phone) {
  const calculation = {};
  reportCard.querySelectorAll('.resultsGrid > div, .reportHeroGraphic > div').forEach((node, index) => {
    const label = node.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim() || `metric_${index + 1}`;
    const value = node.querySelector('b, strong')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (value) calculation[label] = value;
  });
  return {
    reportType: 'roof-check',
    calculation,
    roofData: {
      address: document.querySelector('[data-field="address"]')?.value || '',
      monthlyBill: document.querySelector('[data-field="monthlyBill"]')?.value || '',
      surfaces: Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [],
      obstacles: [...document.querySelectorAll('.obstacle.selected')].map((node) => node.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean)
    },
    metadata: {
      deliveryRequested: true,
      deliveryChannel: 'whatsapp',
      deliveryStatus: 'pending_whatsapp_connection',
      recipientPhone: normalizePhone(phone),
      consentTextVersion: 'whatsapp-report-v3',
      consentAt: new Date().toISOString(),
      calculatorVersion: new URLSearchParams(location.search).get('v') || 'roof-check-master-v1',
      capturedAt: new Date().toISOString()
    }
  };
}

function syncOriginalField(field, value) { if (field) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); } }
function normalizePhone(value) { const digits = String(value || '').replace(/\D/g, ''); return digits.startsWith('0') ? `972${digits.slice(1)}` : digits; }
function readDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
function writeDraft(draft) { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }
function escapeAttr(value = '') { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

const observer = new MutationObserver(enhanceReportExperience);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhanceReportExperience);
setTimeout(enhanceReportExperience, 0);
