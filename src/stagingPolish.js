import { clearLeads, exportLeadsCsv, getLeads, saveLead, seedDemoLeads } from './leadsStore.js';

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
  if (!leadFields || leadFields.dataset.stagePolished) return;
  leadFields.dataset.stagePolished = 'true';
  const draft = readDraft();
  leadFields.insertAdjacentHTML('beforeend', `
    <input placeholder="אימייל" value="${escapeAttr(draft.email || '')}" data-stage-field="email" />
    <input placeholder="הערות / זמן נוח לשיחה" value="${escapeAttr(draft.notes || '')}" data-stage-field="notes" />
  `);
  const pdfButton = reportCard.querySelector('[data-action="generatePdf"]');
  pdfButton?.insertAdjacentHTML('afterend', `
    <div class="stageReportActions">
      <button class="ghostBtn" type="button" data-stage-open-lead>השאירו פרטים</button>
      <a class="ghostBtn stageWhatsapp" target="_blank" rel="noreferrer">WhatsApp</a>
    </div>
    <p class="stageFinePrint">הדוח הוא הערכה דיגיטלית ראשונית. לפני הצעה סופית נבצע בדיקת שטח, חשמל וקונסטרוקציה.</p>
  `);
  refreshWhatsAppLink();
  leadFields.querySelectorAll('[data-stage-field]').forEach((input) => input.addEventListener('input', () => {
    const nextDraft = readDraft();
    nextDraft[input.dataset.stageField] = input.value;
    writeDraft(nextDraft);
    refreshWhatsAppLink();
  }));
  leadFields.querySelectorAll('[data-field], [data-stage-field]').forEach((input) => input.addEventListener('input', refreshWhatsAppLink));
  reportCard.querySelector('[data-stage-open-lead]')?.addEventListener('click', () => openGlobalLeadForm());
  pdfButton?.addEventListener('click', () => {
    const draft = readDraft();
    setTimeout(() => enrichLatestLead(draft), 250);
  }, true);
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

function openGlobalLeadForm() {
  const draft = readDraft();
  const name = document.querySelector('[data-field="leadName"]')?.value || '';
  const phone = document.querySelector('[data-field="leadPhone"]')?.value || '';
  const address = document.querySelector('[data-field="address"]')?.value || '';
  window.openSolatrixLeadForm?.({
    sourceType: 'roof-check',
    sourcePage: location.pathname,
    notes: draft.notes || '',
    prefill: { name, phone, email: draft.email || '', cityOrAddress: address, message: draft.notes || '' }
  });
}

function enrichLatestLead(draft) {
  const [latest] = getLeads();
  if (!latest) return;
  saveLead({
    ...latest,
    email: draft.email || latest.email || '',
    notes: draft.notes || latest.notes || '',
    sourceType: 'roof-check',
    sourcePage: location.pathname
  });
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

function refreshWhatsAppLink() {
  const link = document.querySelector('.stageWhatsapp');
  if (!link) return;
  const name = document.querySelector('[data-field="leadName"]')?.value || '';
  const phone = document.querySelector('[data-field="leadPhone"]')?.value || '';
  const address = document.querySelector('[data-field="address"]')?.value || '';
  const draft = readDraft();
  const message = [`Roof Check lead`, `Name: ${name || '-'}`, `Phone: ${phone || '-'}`, `Email: ${draft.email || '-'}`, `Address: ${address || '-'}`, `Notes: ${draft.notes || '-'}`].join('\n');
  link.href = `https://wa.me/972547299727?text=${encodeURIComponent(message)}`;
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
