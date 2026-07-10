import { clearLeads, exportLeadsCsv, seedDemoLeads } from './leadsStore.js';
import { LeadSubmissionError, submitLead } from './lib/leadApi.js';
import { formatPublicLeadReference } from './lib/publicReference.js';

const DRAFT_KEY = 'solatrix_roof_check_lead_draft';
const MAIN_SITE_LINKS = [
  ['./', 'ראשי'],
  ['./private-homes.html', 'בתים פרטיים'],
  ['./business.html', 'עסקים'],
  ['./storage.html', 'אגירה'],
  ['./contact.html', 'צור קשר'],
  ['./admin.html', 'CRM']
];

function enhance() {
  enhanceHeader();
  enhanceLeadForm();
  enhanceCrm();
  removeRedundantHomepageSections();
}

function enhanceHeader() {
  const headerInner = document.querySelector('.headerInner');
  if (!headerInner || headerInner.querySelector('.desktopNav')) return;
  const base = location.pathname.includes('/roof-check') ? `${location.pathname.split('/roof-check')[0] || ''}/` : './';
  const nav = document.createElement('nav');
  nav.className = 'desktopNav';
  nav.innerHTML = MAIN_SITE_LINKS.map(([href, label]) => `<a href="${new URL(href, location.origin + base).pathname}">${label}</a>`).join('') + '<a href="#admin" data-stage-admin>CRM פנימי</a>';
  headerInner.querySelector('.brand')?.after(nav);
  nav.querySelector('[data-stage-admin]')?.addEventListener('click', (event) => {
    event.preventDefault();
    history.pushState({ step: 7 }, '', `${resolveRoofPath()}/admin`);
    location.reload();
  });
}

function enhanceLeadForm() {
  const reportCard = document.querySelector('.reportCard');
  const leadFields = reportCard?.querySelector('.leadFields');
  if (!reportCard || !leadFields || leadFields.dataset.stagePolished) return;
  leadFields.dataset.stagePolished = 'true';

  const draft = readDraft();
  const nameInput = leadFields.querySelector('[data-field="leadName"]');
  const phoneInput = leadFields.querySelector('[data-field="leadPhone"]');
  if (nameInput) nameInput.value = nameInput.value || draft.name || '';
  if (phoneInput) phoneInput.value = phoneInput.value || draft.phone || '';

  leadFields.insertAdjacentHTML('beforeend', `
    <input type="email" placeholder="אימייל (לא חובה)" value="${escapeAttr(draft.email || '')}" data-stage-field="email" autocomplete="email" />
  `);

  const originalPdfButton = reportCard.querySelector('[data-action="generatePdf"]');
  if (!originalPdfButton) return;

  // Keep the original button and its click handler only as an internal PDF generator.
  // The visible clone preserves the old design but first saves the lead and consent.
  originalPdfButton.hidden = true;
  originalPdfButton.setAttribute('aria-hidden', 'true');
  originalPdfButton.tabIndex = -1;

  const requestButton = originalPdfButton.cloneNode(true);
  requestButton.hidden = false;
  requestButton.removeAttribute('aria-hidden');
  requestButton.removeAttribute('data-action');
  requestButton.removeAttribute('tabindex');
  requestButton.type = 'button';
  requestButton.setAttribute('data-request-whatsapp-report', 'true');
  requestButton.innerHTML = '<span data-report-button-label>קבלת דוח PDF מלא ב-WhatsApp</span>';
  originalPdfButton.insertAdjacentElement('afterend', requestButton);

  requestButton.insertAdjacentHTML('afterend', `
    <section class="whatsappReportCard whatsappReportCardCompact" data-whatsapp-report-card>
      <div class="whatsappReportCopy">
        <span class="whatsappReportKicker">שליחת הדוח</span>
        <h3>קבלת הדוח המלא ב-WhatsApp</h3>
        <p>לאחר אישור הבקשה נשמור את תוצאות הבדיקה ונכין את הדוח המלא למספר שהזנתם.</p>
      </div>
      <label class="whatsappReportConsent">
        <input type="checkbox" data-report-consent />
        <span>אני מבקש/ת לקבל את דוח ה-PDF ב-WhatsApp ומאשר/ת לנציג Solatrix Energy ליצור איתי קשר בנוגע לבדיקה ולהצעה.</span>
      </label>
      <p class="whatsappReportError" data-report-error hidden></p>
      <div class="whatsappReportSuccess" data-report-success hidden tabindex="-1"></div>
      <p class="stageFinePrint">הדוח הוא הערכה דיגיטלית ראשונית. הצעה סופית כפופה לבדיקת שטח, חשמל וקונסטרוקציה.</p>
    </section>
  `);

  const syncDraft = () => {
    writeDraft({
      ...readDraft(),
      name: nameInput?.value || '',
      phone: phoneInput?.value || '',
      email: leadFields.querySelector('[data-stage-field="email"]')?.value || ''
    });
  };

  leadFields.querySelectorAll('[data-field], [data-stage-field]').forEach((input) => input.addEventListener('input', syncDraft));
  requestButton.addEventListener('click', () => requestWhatsappReport(reportCard, originalPdfButton, requestButton));
}

async function requestWhatsappReport(reportCard, originalPdfButton, requestButton) {
  const name = reportCard.querySelector('[data-field="leadName"]')?.value?.trim() || '';
  const phone = reportCard.querySelector('[data-field="leadPhone"]')?.value?.trim() || '';
  const email = reportCard.querySelector('[data-stage-field="email"]')?.value?.trim() || '';
  const consent = reportCard.querySelector('[data-report-consent]')?.checked === true;
  const errorNode = reportCard.querySelector('[data-report-error]');
  const successNode = reportCard.querySelector('[data-report-success]');
  const label = requestButton?.querySelector('[data-report-button-label]');

  errorNode.hidden = true;
  successNode.hidden = true;

  const errors = [];
  if (name.length < 2) errors.push('נא להזין שם מלא.');
  if (!/^(?:9725\d{8}|05\d{8})$/.test(phone.replace(/\D/g, ''))) errors.push('נא להזין מספר WhatsApp תקין.');
  if (!consent) errors.push('כדי לקבל את הדוח יש לאשר את הבקשה ואת יצירת הקשר.');

  if (errors.length) {
    errorNode.textContent = errors.join(' ');
    errorNode.hidden = false;
    return;
  }

  requestButton.disabled = true;
  label.textContent = 'מכינים את הדוח...';
  const reportData = collectRoofCheckReportData();
  reportData.metadata = {
    ...reportData.metadata,
    deliveryRequested: true,
    deliveryChannel: 'whatsapp',
    deliveryStatus: 'pending_whatsapp_connection',
    recipientPhone: normalizePhone(phone),
    consentTextVersion: 'whatsapp-report-v1',
    consentAt: new Date().toISOString()
  };

  try {
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
      metadata: {
        whatsappReportRequested: true,
        recipientPhone: normalizePhone(phone)
      }
    });

    writeDraft({ ...readDraft(), name, phone, email });
    originalPdfButton.click();

    const publicReference = formatPublicLeadReference(result.leadNumber);
    successNode.innerHTML = `
      <b>הבקשה התקבלה${publicReference ? ` — מספר פנייה ${publicReference}` : ''}.</b>
      <span>הדוח נפתח עכשיו לצפייה. שמרנו גם בקשה למסירה ב-WhatsApp.</span>
      <a href="${buildWhatsappFallbackUrl(publicReference)}" target="_blank" rel="noreferrer">פתיחת WhatsApp לאישור הבקשה</a>
    `;
    successNode.hidden = false;
    successNode.focus();
  } catch (error) {
    errorNode.textContent = error instanceof LeadSubmissionError
      ? error.message
      : 'לא הצלחנו לשמור את הבקשה. נסו שוב או פנו אלינו ב-WhatsApp.';
    errorNode.hidden = false;
  } finally {
    requestButton.disabled = false;
    label.textContent = 'קבלת דוח PDF מלא ב-WhatsApp';
  }
}

function enhanceCrm() {
  const adminCard = document.querySelector('.adminCard');
  if (!adminCard || adminCard.dataset.stagePolished) return;
  adminCard.dataset.stagePolished = 'true';
  adminCard.querySelector('.eyebrow')?.insertAdjacentHTML('afterend', `
    <div class="adminActions">
      <button class="ghostBtn" data-stage-action="seed">Demo leads</button>
      <button class="ghostBtn" data-stage-action="export">Export CSV</button>
      <button class="ghostBtn danger" data-stage-action="clear">Clear mock</button>
      <a class="ghostBtn" href="../admin.html">CRM full page</a>
    </div>
  `);
  adminCard.querySelector('[data-stage-action="seed"]')?.addEventListener('click', () => { seedDemoLeads(); location.reload(); });
  adminCard.querySelector('[data-stage-action="clear"]')?.addEventListener('click', () => { clearLeads(); location.reload(); });
  adminCard.querySelector('[data-stage-action="export"]')?.addEventListener('click', downloadCsv);
  adminCard.querySelectorAll('.leadsTable tbody tr').forEach((row) => row.setAttribute('tabindex', '0'));
}

function removeRedundantHomepageSections() {
  if (location.pathname !== '/' && !location.pathname.endsWith('/solatrix-site-master/')) return;
  const targetTexts = ['הבעיה היא לא המערכת', 'כל גג נראה אחרת'];
  document.querySelectorAll('section, main > div').forEach((element) => {
    const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (targetTexts.some((target) => text.includes(target))) element.remove();
  });
}

function collectRoofCheckReportData() {
  const reportCard = document.querySelector('.reportCard');
  const metrics = {};

  reportCard?.querySelectorAll('.resultsGrid > div, .reportHeroGraphic > div').forEach((node, index) => {
    const label = node.querySelector('span')?.textContent?.replace(/\s+/g, ' ').trim() || `metric_${index + 1}`;
    const value = node.querySelector('b, strong')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (value) metrics[label] = value;
  });

  return {
    reportType: 'roof-check',
    calculation: metrics,
    roofData: {
      address: document.querySelector('[data-field="address"]')?.value || '',
      monthlyBill: document.querySelector('[data-field="monthlyBill"]')?.value || '',
      surfaces: Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [],
      obstacles: collectSelectedObstacles()
    },
    metadata: {
      pageTitle: document.title,
      calculatorVersion: new URLSearchParams(location.search).get('v') || 'roof-check-master-v1',
      capturedAt: new Date().toISOString()
    }
  };
}

function collectSelectedObstacles() {
  return [...document.querySelectorAll('.obstacle.selected')]
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function buildWhatsappFallbackUrl(reference) {
  const message = [
    'שלום Solatrix, ביקשתי לקבל את דוח ה-PDF של Roof Check ב-WhatsApp.',
    reference ? `מספר פנייה: ${reference}` : '',
    'אשמח לאישור שהבקשה התקבלה.'
  ].filter(Boolean).join('\n');
  return `https://wa.me/972547299727?text=${encodeURIComponent(message)}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
}

function downloadCsv() {
  const blob = new Blob([exportLeadsCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `solatrix-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function resolveRoofPath() {
  const marker = '/roof-check';
  const index = location.pathname.indexOf(marker);
  return index >= 0 ? location.pathname.slice(0, index + marker.length) : marker;
}

function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); }
  catch { return {}; }
}

function writeDraft(draft) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function escapeAttr(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

const observer = new MutationObserver(enhance);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', enhance);
setTimeout(enhance, 0);
