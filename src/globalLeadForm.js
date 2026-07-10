import './globalLeadForm.css';
import { LeadSubmissionError, submitLead } from './lib/leadApi.js';
import { formatPublicLeadReference } from './lib/publicReference.js';

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
let modalForm;
let lastContext = {};
let formStartedAt = new Date().toISOString();

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
  const floatingButton = isContactPage()
    ? ''
    : '<button class="solatrixLeadFab" type="button" data-solatrix-open-lead-form>השאירו פרטים</button>';

  root.innerHTML = `
    ${floatingButton}
    <div class="solatrixLeadModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="solatrix-lead-title">
      <div class="solatrixLeadBackdrop" data-solatrix-close-lead-form></div>
      <form class="solatrixLeadPanel" data-solatrix-lead-form novalidate>
        <button class="solatrixLeadClose" type="button" aria-label="סגירה" data-solatrix-close-lead-form>×</button>
        <p class="solatrixLeadEyebrow">Solatrix Energy</p>
        <h2 id="solatrix-lead-title">השאירו פרטים</h2>
        <p class="solatrixLeadIntro">נבדוק את התאמת הגג ונחזור אליכם עם המשך תהליך ברור.</p>
        <div class="solatrixLeadGrid">
          <label>שם מלא<input name="name" autocomplete="name" required maxlength="160" /><small data-error-for="name" hidden></small></label>
          <label>טלפון<input name="phone" autocomplete="tel" required inputmode="tel" /><small data-error-for="phone" hidden></small></label>
          <label>אימייל<input name="email" autocomplete="email" inputmode="email" type="email" /><small data-error-for="email" hidden></small></label>
          <label>עיר / כתובת<input name="cityOrAddress" autocomplete="street-address" maxlength="500" /></label>
          <label>סוג נכס<select name="propertyType"><option value="">בחרו סוג נכס</option>${PROPERTY_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}</select></label>
          <label>חשבון חשמל חודשי משוער<input name="monthlyBill" inputmode="decimal" placeholder="₪" /></label>
          <label class="solatrixLeadWide">מתי נוח לחזור אליכם?<select name="preferredContactTime"><option value="">אין העדפה</option><option value="בוקר">בוקר</option><option value="צהריים">צהריים</option><option value="ערב">ערב</option><option value="WhatsApp תחילה">WhatsApp תחילה</option></select></label>
          <label class="solatrixLeadWide">הודעה<textarea name="message" rows="3" maxlength="3000"></textarea></label>
          <label class="solatrixLeadHoneypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" /></label>
        </div>
        <label class="solatrixLeadConsent"><input type="checkbox" name="consent" /><span>אני מאשר/ת להעביר את הפרטים ל-Solatrix Energy כדי שיחזרו אליי.</span></label>
        <small class="solatrixLeadFieldError" data-error-for="consent" hidden></small>
        <div class="solatrixLeadError" tabindex="-1" hidden></div>
        <button class="solatrixLeadSubmit" type="submit"><span data-submit-label>שליחת פרטים</span></button>
        <div class="solatrixLeadSuccess" tabindex="-1" hidden>תודה, הפרטים התקבלו. נציג Solatrix יחזור אליכם בהקדם.</div>
      </form>
    </div>`;

  document.body.appendChild(root);
  modal = root.querySelector('.solatrixLeadModal');
  modalForm = root.querySelector('[data-solatrix-lead-form]');
  modalForm.addEventListener('submit', handleSubmit);
  modalForm.addEventListener('input', (event) => clearFieldError(event.target?.name));
  root.querySelectorAll('[data-solatrix-close-lead-form]').forEach((node) => node.addEventListener('click', closeLeadForm));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLeadForm();
  });
}

function handleDocumentClick(event) {
  const trigger = event.target.closest('[data-solatrix-open-lead-form]');
  if (!trigger) return;
  event.preventDefault();
  openLeadForm({ sourceType: trigger.getAttribute('data-source-type') || 'site-form' });
}

function bindContactCtas() {
  document.querySelectorAll('a, button, [role="button"]').forEach((node) => {
    if (node.closest('[data-solatrix-global-lead-root]')) return;
    const href = node.getAttribute?.('href') || '';
    if (/wa\.me|whatsapp|tel:|mailto:/i.test(href)) return;
    const label = (node.textContent || node.getAttribute?.('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!CONTACT_KEYWORDS.some((pattern) => pattern.test(label))) return;
    node.setAttribute('data-solatrix-open-lead-form', 'true');
    node.setAttribute('data-source-type', inferSourceType());
    if (node.tagName === 'A') node.setAttribute('href', '#lead-form');
  });
}

function bindExistingForms() {
  document.querySelectorAll('form').forEach((form) => {
    if (form.matches('[data-solatrix-lead-form], [data-contact-page-form]') || form.dataset.solatrixLeadBound) return;
    const text = form.textContent || '';
    const looksLikeContact = /טלפון|אימייל|שם|contact|phone|email/i.test(text);
    if (!looksLikeContact) return;

    form.dataset.solatrixLeadBound = 'true';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      openLeadForm({
        sourcePage: window.location.pathname,
        sourceType: inferSourceType(),
        prefill: {
          name: getFirst(formData, ['name', 'fullName', 'שם מלא', 'שם']),
          phone: getFirst(formData, ['phone', 'tel', 'טלפון']),
          email: getFirst(formData, ['email', 'אימייל']),
          cityOrAddress: getFirst(formData, ['address', 'city', 'עיר / כתובת', 'כתובת']),
          propertyType: getFirst(formData, ['propertyType', 'סוג נכס']),
          monthlyBill: getFirst(formData, ['monthlyBill', 'חשבון חשמל חודשי משוער']),
          message: getFirst(formData, ['message', 'הודעה'])
        }
      });
    });
  });
}

function openLeadForm(context = {}) {
  lastContext = { ...lastContext, ...context };
  formStartedAt = new Date().toISOString();
  resetMessages();

  if (modalForm && context.prefill) {
    Object.entries(context.prefill).forEach(([key, value]) => {
      if (modalForm.elements[key] && value != null) modalForm.elements[key].value = value;
    });
  }

  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('solatrixLeadModalOpen');
  setTimeout(() => modalForm?.elements?.name?.focus(), 30);
}

function closeLeadForm() {
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('solatrixLeadModalOpen');
}

async function handleSubmit(event) {
  event.preventDefault();
  resetMessages();
  setSubmitting(true);
  const data = Object.fromEntries(new FormData(modalForm).entries());

  try {
    const result = await submitLead({
      ...lastContext.reportData,
      ...data,
      consent: modalForm.elements.consent.checked,
      formStartedAt,
      cityOrAddress: data.cityOrAddress || lastContext.cityOrAddress || '',
      propertyType: data.propertyType || lastContext.propertyType || '',
      monthlyBill: data.monthlyBill || lastContext.monthlyBill || '',
      sourcePage: lastContext.sourcePage || window.location.pathname,
      sourceType: lastContext.sourceType || inferSourceType(),
      message: data.message || lastContext.notes || '',
      reportData: lastContext.reportData || null,
      metadata: lastContext.metadata || {}
    });

    modalForm.reset();
    const success = modalForm.querySelector('.solatrixLeadSuccess');
    const publicReference = formatPublicLeadReference(result.leadNumber);
    success.textContent = publicReference
      ? `תודה, הפרטים התקבלו. מספר פנייה: ${publicReference}`
      : 'תודה, הפרטים התקבלו. נציג Solatrix יחזור אליכם בהקדם.';
    success.hidden = false;
    success.focus();
    window.dispatchEvent(new CustomEvent('solatrix:lead-submitted', { detail: result }));
    setTimeout(closeLeadForm, 2200);
  } catch (error) {
    if (error instanceof LeadSubmissionError && error.code === 'validation_error') {
      renderFieldErrors(error.details || {});
      focusFirstInvalidField(error.details || {});
    } else {
      const errorNode = modalForm.querySelector('.solatrixLeadError');
      errorNode.textContent = error?.message || 'לא הצלחנו לשלוח את הפרטים. נסו שוב או פנו אלינו ב-WhatsApp.';
      errorNode.hidden = false;
      errorNode.focus();
    }
  } finally {
    setSubmitting(false);
  }
}

function renderFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const node = modalForm.querySelector(`[data-error-for="${field}"]`);
    if (node) {
      node.textContent = message;
      node.hidden = false;
    }
    modalForm.elements[field]?.setAttribute('aria-invalid', 'true');
  });
}

function clearFieldError(field) {
  if (!field || !modalForm) return;
  const node = modalForm.querySelector(`[data-error-for="${field}"]`);
  if (node) node.hidden = true;
  modalForm.elements[field]?.removeAttribute('aria-invalid');
}

function focusFirstInvalidField(errors) {
  const [firstField] = Object.keys(errors);
  modalForm.elements[firstField]?.focus();
}

function resetMessages() {
  if (!modalForm) return;
  modalForm.querySelectorAll('[data-error-for]').forEach((node) => {
    node.hidden = true;
    node.textContent = '';
  });
  modalForm.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute('aria-invalid'));
  const error = modalForm.querySelector('.solatrixLeadError');
  const success = modalForm.querySelector('.solatrixLeadSuccess');
  error.hidden = true;
  error.textContent = '';
  success.hidden = true;
}

function setSubmitting(isSubmitting) {
  const button = modalForm?.querySelector('.solatrixLeadSubmit');
  if (!button) return;
  button.disabled = isSubmitting;
  button.setAttribute('aria-busy', String(isSubmitting));
  button.querySelector('[data-submit-label]').textContent = isSubmitting ? 'שולחים...' : 'שליחת פרטים';
}

function getFirst(formData, keys) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value) return String(value).trim();
  }
  return '';
}

function inferSourceType() {
  if (isContactPage()) return 'contact-page';
  if (/roof-check/.test(window.location.pathname)) return 'roof-check';
  return 'site-form';
}

function isContactPage() {
  return /contact\.html/.test(window.location.pathname);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGlobalLeadForm);
} else {
  initGlobalLeadForm();
}
