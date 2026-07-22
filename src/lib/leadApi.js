import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

const FIRST_TOUCH_KEY = 'solatrix_first_touch_attribution';
const DEVELOPMENT_LEADS_KEY = 'solatrix_development_leads';
const ROOF_CHECK_SESSION_KEY = 'solatrix_roof_check_lifecycle';

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
  if (!stored) localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify({ ...current, capturedAt: new Date().toISOString() }));
  return { firstTouch: stored || { ...current, capturedAt: new Date().toISOString() }, lastTouch: current };
}

export function normalizeLeadPayload(input = {}) {
  const attribution = collectAttribution();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const monthlyBillRaw = String(input.monthlyBill ?? input.monthly_electricity_bill ?? '').replace(/[^0-9.]/g, '');
  const monthlyBill = monthlyBillRaw ? Number(monthlyBillRaw) : null;

  return {
    submissionId: input.submissionId || crypto.randomUUID(),
    sessionId: input.sessionId || null,
    lifecycleAction: ['start', 'activity', 'complete'].includes(input.lifecycleAction) ? input.lifecycleAction : 'complete',
    calculatorStep: String(input.calculatorStep || '').trim(),
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
    reportFile: input.reportFile || input.report_file || null,
    metadata: {
      ...(input.metadata || {}),
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    }
  };
}

export function validateLeadPayload(payload) {
  const errors = {};
  if (payload.lifecycleAction === 'complete' && (!payload.name || payload.name.length < 2)) errors.name = 'נא להזין שם מלא.';
  if (!isValidIsraeliPhone(payload.phone)) errors.phone = 'נא להזין מספר טלפון תקין.';
  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) errors.email = 'כתובת האימייל אינה תקינה.';
  if (!payload.consent) errors.consent = 'יש לאשר את העברת הפרטים כדי שנוכל לחזור אליכם.';
  return errors;
}

export async function submitLead(input = {}) {
  const payload = normalizeLeadPayload(input);
  const validationErrors = validateLeadPayload(payload);
  if (Object.keys(validationErrors).length) throw new LeadSubmissionError('Please correct the highlighted fields.', 'validation_error', validationErrors);
  if (payload.website) return { ok: true, ignored: true };

  if (!isSupabaseConfigured()) {
    if (import.meta.env.DEV) return persistDevelopmentLead(payload);
    throw new LeadSubmissionError('מערכת שליחת הפרטים עדיין אינה מחוברת. אפשר לפנות אלינו ב-WhatsApp.', 'backend_not_configured');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('submit-lead', { body: payload });
  if (error) throw new LeadSubmissionError('לא הצלחנו לשלוח את הפרטים. נסו שוב או פנו אלינו ב-WhatsApp.', 'edge_function_error', error);
  if (!data?.ok) throw new LeadSubmissionError(data?.message || 'לא הצלחנו לשלוח את הפרטים.', data?.code || 'lead_submission_failed', data?.details || null);
  return data;
}

export function getRoofCheckLifecycleSession() {
  const stored = readJson(ROOF_CHECK_SESSION_KEY) || {};
  const session = {
    sessionId: isUuid(stored.sessionId) ? stored.sessionId : crypto.randomUUID(),
    submissionId: isUuid(stored.submissionId) ? stored.submissionId : crypto.randomUUID(),
    phone: String(stored.phone || ''),
    consent: stored.consent === true,
    verified: stored.verified === true,
    leadId: stored.leadId || null,
    leadNumber: stored.leadNumber || null,
    status: stored.status || null
  };
  localStorage.setItem(ROOF_CHECK_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function updateRoofCheckLifecycleSession(update = {}) {
  const next = { ...getRoofCheckLifecycleSession(), ...update };
  localStorage.setItem(ROOF_CHECK_SESSION_KEY, JSON.stringify(next));
  return next;
}

export async function syncRoofCheckLead(input = {}) {
  const session = getRoofCheckLifecycleSession();
  const result = await submitLead({
    ...input,
    name: input.name || '',
    phone: input.phone || session.phone,
    consent: input.consent ?? session.consent,
    sessionId: session.sessionId,
    submissionId: session.submissionId,
    lifecycleAction: input.lifecycleAction || (session.verified ? 'activity' : 'start'),
    sourceType: input.sourceType || 'roof-check',
    sourcePage: input.sourcePage || window.location.pathname
  });
  updateRoofCheckLifecycleSession({
    phone: input.phone || session.phone,
    consent: input.consent ?? session.consent,
    verified: true,
    leadId: result.leadId || session.leadId,
    leadNumber: result.leadNumber || session.leadNumber,
    status: result.status || session.status
  });
  return result;
}

export function isValidIsraeliPhone(value = '') { return /^(?:9725\d{8}|05\d{8})$/.test(String(value).replace(/\D/g, '')); }
function inferSourceType() { if (/contact\.html/.test(window.location.pathname)) return 'contact-page'; if (/roof-check/.test(window.location.pathname)) return 'roof-check'; return 'site-form'; }
function persistDevelopmentLead(payload) { const existing = readJson(DEVELOPMENT_LEADS_KEY) || []; const index = payload.sessionId ? existing.findIndex((lead) => lead.sessionId === payload.sessionId) : -1; const lead = { ...(index >= 0 ? existing[index] : {}), ...payload, developmentOnly: true, leadId: index >= 0 ? existing[index].leadId : payload.submissionId, status: payload.lifecycleAction === 'complete' ? 'completed' : 'started' }; const next = index >= 0 ? existing.map((item, itemIndex) => itemIndex === index ? lead : item) : [lead, ...existing]; localStorage.setItem(DEVELOPMENT_LEADS_KEY, JSON.stringify(next.slice(0, 100))); return Promise.resolve({ ok: true, leadId: lead.leadId, status: lead.status, developmentOnly: true }); }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }
function readJson(key) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; } }
