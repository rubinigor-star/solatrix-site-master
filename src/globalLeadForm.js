import './globalLeadForm.css';
import { saveLead } from './leadsStore.js';

const CONTACT_KEYWORDS = [
  /צור\s*קשר/,
  /השאירו\s*פרטים/,
  /השארת\s*פרטים/,
  /קבלו\s*הצעה/,
  /קבל\s*הצעה/,
  /ייעוץ/,
  /консульта/i,
  /заяв/i,
  /contact/i
];

const PROPERTY_TYPES = ['בית פרטי', 'עסק', 'חקלאי', 'אחר'];
let modal;
let lastContext = {};

function initGlobalLeadForm() {
  if (document.querySelector('[data-solatrix-global-lead-root]')) return;
  injectModal();
  bindContactCtas();
  bindExistingForms();
  window.openSolatrixLeadForm = openLeadForm;
  document.addEventListener('click', handleDocumentClick, true);
}

function injectModal() {
  const root = document.createElement('div');
  root.setAttribute('data-solatrix-global-lead-root', 'true');
  root.dir = 'rtl';
  root.innerHTML = `
    <button class="solatrixLeadFab" type="button" data-solatrix-open-lead-form>השאירו פרטים</button>
    <div class="solatrixLeadModal" aria-hidden="true" role="dialog" aria-modal="true" aria-label="השאירו פרטים">
      <div class="solatrixLeadBackdrop" data-solatrix-close-lead-form></div>
      <form class="solatrixLeadPanel" data-solatrix-lead-form novalidate>
        <button class="solatrixLeadClose" type="button" aria-label="סגירה" data-solatrix-close-lead-form>×</button>
        <p class="solatrixLeadEyebrow">Solatrix Energy</p>
        <h2>השאירו פרטים</h2>
        <p class="solatrixLeadIntro">נבדוק את התאמת הגג ונחזור אליכם עם המשך תהליך ברור.</p>
        <div class="solatrixLeadGrid">
          <label>שם מלא<input name="name" autocomplete="name" required /></label>
          <label>טלפון<input name="phone" autocomplete="tel" required inputmode="tel" /></label>
          <label>אימייל<input name="email" autocomplete="email" inputmode="email" /></label>
          <label>עיר / כתובת<input name="cityOrAddress" autocomplete="street-address" /></label>
          <label>סוג נכס<select name="propertyType">${PROPERTY_TYPES.map((type) => `<option>${type}</option>`).join('')}</select></label>
          <label>חשבון חשמל חודשי משוער<input name="monthlyBill" inputmode="numeric" placeholder="₪" /></label>
          <label class="solatrixLeadWide">הודעה<textarea name="message" rows="3"></textarea></label>
        </div>
        <div class="solatrixLeadError" hidden>אנא מלאו שם וטלפון כדי לשלוח.</div>
        <button class="solatrixLeadSubmit" type="submit">שליחת פרטים</button>
        <div class="solatrixLeadSuccess" hidden>תודה, הפרטים נשמרו. נציג Solatrix יחזור אליכם בהקדם.</div>
      </form>
    </div>`;
  document.body.appendChild(root);
  modal = root.querySelector('.solatrixLeadModal');
  root.querySelector('[data-solatrix-lead-form]').addEventListener('submit', handleSubmit);
  root.querySelectorAll('[data-solatrix-close-lead-form]').forEach((node) => node.addEventListener('click', closeLeadForm));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLeadForm();
  });
}

function handleDocumentClick(event) {
  const trigger = event.target.closest('[data-solatrix-open-lead-form]');
  if (trigger) {
    event.preventDefault();
    openLeadForm({ sourceType: trigger.getAttribute('data-source-type') || 'site-form' });
  }
}

function bindContactCtas() {
  document.querySelectorAll('a, button, [role="button"]').forEach((node) => {
    if (node.closest('[data-solatrix-global-lead-root]')) return;
    const href = node.getAttribute?.('href') || '';
    if (/wa\.me|whatsapp/i.test(href)) return;
    const label = (node.textContent || node.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!CONTACT_KEYWORDS.some((pattern) => pattern.test(label))) return;
    node.setAttribute('data-solatrix-open-lead-form', 'true');
    node.setAttribute('data-source-type', inferSourceType());
    if (node.tagName === 'A') node.setAttribute('href', '#lead-form');
  });
}

function bindExistingForms() {
  document.querySelectorAll('form').forEach((form) => {
    if (form.matches('[data-solatrix-lead-form]') || form.dataset.solatrixLeadBound) return;
    const text = form.textContent || '';
    const looksLikeContact = /טלפון|אימייל|שם|contact|phone|email/i.test(text);
    if (!looksLikeContact) return;
    form.dataset.solatrixLeadBound = 'true';
    form.addEventListener('submit', (event) => {
      const formData = new FormData(form);
      const name = getFirst(formData, ['name', 'fullName', 'שם מלא', 'שם']);
      const phone = getFirst(formData, ['phone', 'tel', 'טלפון']);
      if (!name || !phone) return;
      event.preventDefault();
      saveLead({
        name,
        phone,
        email: getFirst(formData, ['email', 'אימייל']),
        cityOrAddress: getFirst(formData, ['address', 'city', 'עיר / כתובת', 'כתובת']),
        propertyType: getFirst(formData, ['propertyType', 'סוג נכס']),
        monthlyBill: getFirst(formData, ['monthlyBill', 'חשבון חשמל חודשי משוער']),
        message: getFirst(formData, ['message', 'הודעה']),
        sourcePage: location.pathname,
        sourceType: inferSourceType(),
        status: 'חדש',
        notes: ''
      });
      form.reset();
      openLeadForm();
      showSuccess();
    });
  });
}

function openLeadForm(context = {}) {
  lastContext = { ...lastContext, ...context };
  const form = document.querySelector('[data-solatrix-lead-form]');
  if (form && context.prefill) {
    Object.entries(context.prefill).forEach(([key, value]) => {
      if (form.elements[key] && value != null) form.elements[key].value = value;
    });
  }
  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden', 'false');
  setTimeout(() => form?.elements?.name?.focus(), 30);
}

function closeLeadForm() {
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
}

function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const error = form.querySelector('.solatrixLeadError');
  if (!String(data.name || '').trim() || !String(data.phone || '').trim()) {
    error.hidden = false;
    return;
  }
  error.hidden = true;
  saveLead({
    ...lastContext.reportData,
    id: lastContext.id,
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: String(data.email || '').trim(),
    cityOrAddress: String(data.cityOrAddress || lastContext.cityOrAddress || '').trim(),
    propertyType: String(data.propertyType || lastContext.propertyType || '').trim(),
    monthlyBill: String(data.monthlyBill || lastContext.monthlyBill || '').trim(),
    message: String(data.message || '').trim(),
    sourcePage: lastContext.sourcePage || location.pathname,
    sourceType: lastContext.sourceType || inferSourceType(),
    status: 'חדש',
    notes: lastContext.notes || ''
  });
  form.reset();
  showSuccess();
}

function showSuccess() {
  const success = document.querySelector('.solatrixLeadSuccess');
  if (!success) return;
  success.hidden = false;
  setTimeout(() => { success.hidden = true; }, 4500);
}

function getFirst(formData, keys) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value) return String(value).trim();
  }
  return '';
}

function inferSourceType() {
  if (/contact\.html/.test(location.pathname)) return 'contact-page';
  if (/roof-check/.test(location.pathname)) return 'roof-check';
  return 'site-form';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalLeadForm);
} else {
  initGlobalLeadForm();
}
