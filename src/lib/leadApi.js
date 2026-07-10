import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const FIRST_TOUCH_KEY = 'solatrix_first_touch_attribution';
const DEVELOPMENT_LEADS_KEY = 'solatrix_development_leads';

export class LeadSubmissionError extends Error {
  constructor(message, code = 'lead_submission_failed', details = null) {
    super(message);
    this.name = 'LeadSubmissionError';
    this.code = code;
    this.details = details;
  }
}

export function collectAttribution() {
  const params = new URLSearchParams(window.location.search);
  const current = {
    sourcePage: window.location.pathname,
    referrer: document.referrer || '',
    utmSource: params.get('utm_source') || '',
    utmMedium: params.get('utm_medium') || '',
    utmCampaign: params.get('utm_campaign') || '',
    utmContent: params.get('utm_content') || '',
    utmTerm: params.get('utm_term') || '',
    gclid: params.get('gclid') || '',
    fbclid: params.get('fbclid') || ''
  };

  const stored = readJson(FIRST_TOUCH_KEY);
  if (!stored) {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify({ ...current, capturedAt: new Date().toISOString() }));
  }

  return {
    firstTouch: stored || { ...current, capturedAt: new Date().toISOString() },
    lastTouch: current
  };
}

export function normalizeLeadPayload(input = {}) {
  const attribution = collectAttribution();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const monthlyBillRaw = String(input.monthlyBill ?? input.monthly_electricity_bill ?? '').replace(/[^0-9.]/g, '');
  const monthlyBill = monthlyBillRaw ? Number(monthlyBillRaw) : null;

  return {
    submissionId: input.submissionId || crypto.randomUUID(),
    formStartedAt: input.formStartedAt || null,
    submittedAt: new Date().toISOString(),
    website: String(input.website || ''),
    name: String(input.name || input.fullName || '').trim(),
    phone,
    email,
    cityOrAddress: String(input.cityOrAddress || input.city_or_address || input.address || '').trim(),
    propertyType: String(input.propertyType || input.property_type || '').trim(),
    monthlyBill: Number.isFinite(monthlyBill) ? monthlyBill : null,
    preferredContactTime: String(input.preferredContactTime || input.preferred_contact_time || '').trim(),
    message: String(input.message || '').trim(),
    consent: input.consent === true || input.consent === 'true' || input.consent === 'on',
    sourceType: String(input.sourceType || input.source_type || inferSourceType()).trim(),
    sourcePage: String(input.sourcePage || input.source_page || window.location.pathname).trim(),
    locale: document.documentElement.lang || 'he',
    attribution,
    reportData: input.reportData || input.report_data || null,
    metadata: {
      ...(input.metadata || {}),
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    }
  };
}

export function validateLeadPayload(payload) {
  const errors = {};

  if (!payload.name || payload.name.length < 2) errors.name = 'נא להזין שם מלא.';
  if (!isValidIsraeliPhone(payload.phone)) errors.phone = 'נא להזין מספר טלפון תקין.';
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) errors.email = 'כתובת האימייל אינה תקינה.';
  if (!payload.consent) errors.consent = 'יש לאשר את העברת הפרטים כדי שנוכל לחזור אליכם.';

  return errors;
}

export async function submitLead(input = {}) {
  const payload = normalizeLeadPayload(input);
  const validationErrors = validateLeadPayload(payload);

  if (Object.keys(validationErrors).length) {
    throw new LeadSubmissionError('Please correct the highlighted fields.', 'validation_error', validationErrors);
  }

  if (payload.website) {
    return { ok: true, ignored: true };
  }

  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) return persistDevelopmentLead(payload);
    throw new LeadSubmissionError(
      'מערכת שליחת הפרטים עדיין אינה מחוברת. אפשר לפנות אלינו ב-WhatsApp.',
      'backend_not_configured'
    );
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('submit-lead', {
    body: payload
  });

  if (error) {
    throw new LeadSubmissionError(
      'לא הצלחנו לשלוח את הפרטים. נסו שוב או פנו אלינו ב-WhatsApp.',
      'edge_function_error',
      error
    );
  }

  if (!data?.ok) {
    throw new LeadSubmissionError(
      data?.message || 'לא הצלחנו לשלוח את הפרטים.',
      data?.code || 'lead_submission_failed',
      data?.details || null
    );
  }

  return data;
}

function isValidIsraeliPhone(value = '') {
  const digits = String(value).replace(/\D/g, '');
  return /^(?:9725\d{8}|05\d{8})$/.test(digits);
}

function inferSourceType() {
  if (/contact\.html/.test(window.location.pathname)) return 'contact-page';
  if (/roof-check/.test(window.location.pathname)) return 'roof-check';
  return 'site-form';
}

function persistDevelopmentLead(payload) {
  const existing = readJson(DEVELOPMENT_LEADS_KEY) || [];
  const next = [{ ...payload, developmentOnly: true }, ...existing].slice(0, 100);
  localStorage.setItem(DEVELOPMENT_LEADS_KEY, JSON.stringify(next));
  return Promise.resolve({ ok: true, leadId: payload.submissionId, developmentOnly: true });
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}
