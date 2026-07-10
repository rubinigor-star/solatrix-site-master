import './contactPage.css';
import { LeadSubmissionError, submitLead } from './lib/leadApi.js';

const form = document.querySelector('[data-contact-page-form]');
const successPanel = document.querySelector('[data-contact-success]');
const generalError = document.querySelector('[data-contact-general-error]');
const submitButton = form?.querySelector('[type="submit"]');
const formStartedAt = new Date().toISOString();

form?.addEventListener('submit', handleSubmit);
form?.addEventListener('input', (event) => clearFieldError(event.target?.name));

async function handleSubmit(event) {
  event.preventDefault();
  clearAllErrors();
  setSubmitting(true);

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await submitLead({
      ...data,
      consent: form.elements.consent.checked,
      formStartedAt,
      sourceType: 'contact-page',
      sourcePage: window.location.pathname
    });

    form.reset();
    form.hidden = true;
    successPanel.hidden = false;
    const reference = successPanel.querySelector('[data-lead-reference]');
    if (reference && result.leadNumber) reference.textContent = `מספר פנייה: ${result.leadNumber}`;
    successPanel.focus();
  } catch (error) {
    if (error instanceof LeadSubmissionError && error.code === 'validation_error') {
      renderFieldErrors(error.details || {});
      focusFirstInvalidField(error.details || {});
    } else {
      generalError.textContent = error?.message || 'לא הצלחנו לשלוח את הפרטים. נסו שוב או פנו אלינו ב-WhatsApp.';
      generalError.hidden = false;
      generalError.focus();
    }
  } finally {
    setSubmitting(false);
  }
}

function renderFieldErrors(errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const errorNode = document.querySelector(`[data-error-for="${field}"]`);
    const input = form.elements[field];
    if (errorNode) {
      errorNode.textContent = message;
      errorNode.hidden = false;
    }
    input?.setAttribute('aria-invalid', 'true');
  });
}

function clearFieldError(field) {
  if (!field) return;
  const errorNode = document.querySelector(`[data-error-for="${field}"]`);
  if (errorNode) errorNode.hidden = true;
  form.elements[field]?.removeAttribute('aria-invalid');
}

function clearAllErrors() {
  form.querySelectorAll('[data-field-error]').forEach((node) => {
    node.hidden = true;
    node.textContent = '';
  });
  form.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute('aria-invalid'));
  generalError.hidden = true;
  generalError.textContent = '';
}

function focusFirstInvalidField(errors) {
  const [firstField] = Object.keys(errors);
  form.elements[firstField]?.focus();
}

function setSubmitting(isSubmitting) {
  if (!submitButton) return;
  submitButton.disabled = isSubmitting;
  submitButton.setAttribute('aria-busy', String(isSubmitting));
  submitButton.querySelector('[data-submit-label]').textContent = isSubmitting ? 'שולחים...' : 'שליחת פרטים';
}
