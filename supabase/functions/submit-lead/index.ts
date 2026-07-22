import { createClient } from 'npm:@supabase/supabase-js@2';
import { lifecycleEventType, nextLeadStatus, normalizeLifecycleAction } from '../_shared/leadLifecycle.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-solatrix-client, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const allowedPropertyTypes = new Set(['בית פרטי', 'עסק', 'חקלאי', 'אחר', 'private-home', 'business', 'agriculture', 'other']);
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_NEW_LEADS_PER_IP_WINDOW = 12;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, code: 'method_not_allowed', message: 'Method not allowed.' }, 405);

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return json({ ok: false, code: 'payload_too_large', message: 'Request payload is too large.' }, 413);
    }
    let payload;
    try { payload = JSON.parse(rawBody); } catch { return json({ ok: false, code: 'invalid_json', message: 'Invalid JSON.' }, 400); }
    const lifecycleAction = normalizeLifecycleAction(payload.lifecycleAction);
    const validation = validatePayload(payload, lifecycleAction);
    if (!validation.ok) return json({ ok: false, code: 'validation_error', message: 'Invalid lead details.', details: validation.errors }, 400);
    if (String(payload.website || '').trim()) return json({ ok: true, ignored: true });

    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const now = new Date().toISOString();
    const normalizedPhone = normalizePhone(payload.phone);
    const sessionId = safeUuid(payload.sessionId);
    const attribution = payload.attribution || {};
    const lastTouch = attribution.lastTouch || {};
    const existingLead = await findExistingLead(supabase, sessionId, normalizedPhone, lifecycleAction);
    const clientIpHash = await hashValue(getClientIp(request));
    if (!existingLead && !(await isWithinLeadRateLimit(supabase, clientIpHash))) {
      return json({ ok: false, code: 'rate_limited', message: 'Too many requests. Please try again later.' }, 429);
    }
    const metadata = {
      ...(existingLead?.metadata || {}),
      ...(payload.metadata || {}),
      locale: payload.locale || 'he',
      firstTouch: attribution.firstTouch || null,
      clientIpHash,
      submittedAt: payload.submittedAt || now
    };

    const leadValues = {
      submission_id: safeUuid(payload.submissionId),
      session_id: sessionId,
      name: cleanText(payload.name, 160),
      phone: cleanText(payload.phone, 40),
      phone_normalized: normalizedPhone,
      email: cleanEmail(payload.email),
      city_or_address: cleanText(payload.cityOrAddress, 500),
      property_type: allowedPropertyTypes.has(payload.propertyType) ? payload.propertyType : cleanText(payload.propertyType, 80),
      monthly_bill: toNullableNumber(payload.monthlyBill),
      preferred_contact_time: cleanText(payload.preferredContactTime, 160),
      message: cleanText(payload.message, 3000),
      source_type: cleanText(payload.sourceType || 'site-form', 120),
      source_page: cleanText(payload.sourcePage || lastTouch.sourcePage || '', 500),
      referrer: cleanText(lastTouch.referrer || '', 1000),
      utm_source: cleanText(lastTouch.utmSource || '', 255),
      utm_medium: cleanText(lastTouch.utmMedium || '', 255),
      utm_campaign: cleanText(lastTouch.utmCampaign || '', 255),
      utm_content: cleanText(lastTouch.utmContent || '', 255),
      utm_term: cleanText(lastTouch.utmTerm || '', 255),
      gclid: cleanText(lastTouch.gclid || '', 255),
      fbclid: cleanText(lastTouch.fbclid || '', 255),
      consent_at: existingLead?.consent_at || now,
      last_submitted_at: lifecycleAction === 'complete' ? now : existingLead?.last_submitted_at || now,
      last_activity_at: now,
      calculator_step: cleanText(payload.calculatorStep, 120),
      metadata
    };

    let lead;
    let duplicate = Boolean(existingLead);
    let eventType = 'lead_started';
    if (existingLead) {
      const nextStatus = nextLeadStatus(existingLead.status, lifecycleAction);
      const updateValues = compactValues({
        ...leadValues,
        submission_id: leadValues.submission_id || undefined,
        session_id: sessionId || existingLead.session_id || undefined,
        status: nextStatus,
        completed_at: lifecycleAction === 'complete' ? now : existingLead.completed_at,
        abandoned_at: nextStatus === 'started' ? null : existingLead.abandoned_at,
        duplicate_count: lifecycleAction === 'complete' && existingLead.status === 'completed'
          ? Number(existingLead.duplicate_count || 0) + 1
          : Number(existingLead.duplicate_count || 0)
      });
      if (nextStatus === 'started') updateValues.abandoned_at = null;
      const { data, error } = await supabase.from('leads').update(updateValues).eq('id', existingLead.id).select('*').single();
      if (error) throw error;
      lead = data;
      eventType = lifecycleEventType(existingLead.status, nextStatus, lifecycleAction);
    } else {
      const status = lifecycleAction === 'complete' ? 'completed' : 'started';
      const { data, error } = await supabase.from('leads').insert({
        ...leadValues,
        name: leadValues.name || 'ללא שם',
        status,
        completed_at: status === 'completed' ? now : null
      }).select('*').single();
      if (error?.code === '23505' && sessionId) {
        const concurrentLead = await findExistingLead(supabase, sessionId, normalizedPhone, lifecycleAction);
        if (!concurrentLead) throw error;
        const recoveredStatus = nextLeadStatus(concurrentLead.status, lifecycleAction);
        const { data: recovered, error: recoveryError } = await supabase.from('leads').update(compactValues({
          ...leadValues,
          status: recoveredStatus,
          completed_at: lifecycleAction === 'complete' ? now : concurrentLead.completed_at
        })).eq('id', concurrentLead.id).select('*').single();
        if (recoveryError) throw recoveryError;
        lead = recovered;
        duplicate = true;
        eventType = lifecycleEventType(concurrentLead.status, recoveredStatus, lifecycleAction);
      } else {
        if (error) throw error;
        lead = data;
        eventType = lifecycleEventType(null, status, lifecycleAction, true);
      }
    }

    const { error: eventError } = await supabase.from('lead_events').insert({
      lead_id: lead.id,
      event_type: eventType,
      payload: {
        duplicate,
        lifecycleAction,
        calculatorStep: lead.calculator_step,
        sourceType: lead.source_type,
        sourcePage: lead.source_page,
        submissionId: payload.submissionId || null,
        sessionId: lead.session_id
      }
    });
    if (eventError) throw eventError;

    let reportId = null;
    let storagePath = null;
    if (lifecycleAction === 'complete' && payload.reportData && typeof payload.reportData === 'object') {
      const reportData = payload.reportData;
      const reportFile = payload.reportFile && typeof payload.reportFile === 'object' ? payload.reportFile : null;
      let originalFilename = null;
      let mimeType = null;

      if (reportFile?.base64) {
        const bytes = decodeBase64Pdf(reportFile.base64);
        originalFilename = sanitizeFilename(reportFile.filename || `solatrix-roof-check-${Date.now()}.pdf`);
        mimeType = 'application/pdf';
        storagePath = `${lead.id}/${crypto.randomUUID()}-${originalFilename}`;
        const { error: uploadError } = await supabase.storage.from('lead-reports').upload(storagePath, bytes, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false
        });
        if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);
      }

      const { data: report, error: reportError } = await supabase.from('reports').insert({
        lead_id: lead.id,
        report_type: cleanText(reportData.reportType || 'roof-check', 80),
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: mimeType,
        calculation: reportData.calculation || reportData.report || {},
        roof_data: reportData.roofData || reportData.state || {},
        metadata: {
          ...(reportData.metadata || {}),
          pdfGenerated: Boolean(storagePath),
          pdfGeneratedAt: storagePath ? new Date().toISOString() : null
        }
      }).select('id').single();
      if (reportError) {
        if (storagePath) await supabase.storage.from('lead-reports').remove([storagePath]);
        throw reportError;
      }
      reportId = report.id;
    }

    if (lifecycleAction === 'complete') {
      await Promise.allSettled([sendLeadEmail(lead, duplicate), appendLeadToGoogleSheets(lead, duplicate)]);
    }
    return json({
      ok: true,
      leadId: lead.id,
      leadNumber: lead.lead_number,
      status: lead.status,
      calculatorStep: lead.calculator_step,
      duplicate,
      reportId,
      storagePath
    });
  } catch (error) {
    console.error('submit-lead failed', error);
    return json({ ok: false, code: 'internal_error', message: 'Lead submission failed.' }, 500);
  }
});

function validatePayload(payload: Record<string, unknown>, lifecycleAction: string) {
  const errors: Record<string, string> = {};
  const name = String(payload?.name || '').trim();
  const phone = String(payload?.phone || '').trim();
  const email = String(payload?.email || '').trim();
  if ((lifecycleAction === 'complete' && name.length < 2) || name.length > 160) errors.name = 'invalid_name';
  if (!/^(?:9725\d{8}|05\d{8})$/.test(phone.replace(/\D/g, ''))) errors.phone = 'invalid_phone';
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'invalid_email';
  if (payload?.consent !== true) errors.consent = 'consent_required';
  return { ok: Object.keys(errors).length === 0, errors };
}

async function findExistingLead(supabase: ReturnType<typeof createClient>, sessionId: string | null, normalizedPhone: string, lifecycleAction: string) {
  const fields = 'id, lead_number, duplicate_count, status, session_id, last_submitted_at, completed_at, abandoned_at, consent_at, metadata';
  if (sessionId) {
    const { data, error } = await supabase
      .from('leads')
      .select(fields)
      .eq('session_id', sessionId)
      .is('archived_at', null)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    return null;
  }

  const duplicateSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from('leads')
    .select(fields)
    .eq('phone_normalized', normalizedPhone)
    .gte('created_at', duplicateSince)
    .is('archived_at', null);
  if (lifecycleAction !== 'complete') query = query.in('status', ['started', 'abandoned']);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function compactValues(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== null));
}

async function isWithinLeadRateLimit(supabase: ReturnType<typeof createClient>, clientIpHash: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('metadata->>clientIpHash', clientIpHash)
    .gte('created_at', since);
  if (error) throw error;
  return Number(count || 0) < MAX_NEW_LEADS_PER_IP_WINDOW;
}

function decodeBase64Pdf(value: unknown) {
  const base64 = String(value || '').replace(/^data:application\/pdf;base64,/, '').replace(/\s/g, '');
  if (!base64 || base64.length > Math.ceil(MAX_PDF_BYTES * 4 / 3) + 16) throw new Error('PDF is empty or too large.');
  const binary = atob(base64);
  if (binary.length > MAX_PDF_BYTES) throw new Error('PDF exceeds maximum size.');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF file.');
  return bytes;
}

function sanitizeFilename(value: unknown) {
  const name = String(value || 'solatrix-roof-check.pdf').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 180);
  return name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`;
}
function normalizePhone(value: unknown) { const digits = String(value || '').replace(/\D/g, ''); if (digits.startsWith('972')) return digits; if (digits.startsWith('0')) return `972${digits.slice(1)}`; return digits; }
function cleanText(value: unknown, maxLength: number) { const text = String(value || '').trim(); return text ? text.slice(0, maxLength) : null; }
function cleanEmail(value: unknown) { const email = String(value || '').trim().toLowerCase(); return email ? email.slice(0, 320) : null; }
function toNullableNumber(value: unknown) { if (value === '' || value === null || value === undefined) return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function safeUuid(value: unknown) { const text = String(value || '').trim(); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null; }
function requireEnv(name: string) { const value = Deno.env.get(name); if (!value) throw new Error(`Missing environment variable: ${name}`); return value; }
function getClientIp(request: Request) { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'; }
async function hashValue(value: string) { const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join(''); }

async function sendLeadEmail(lead: Record<string, unknown>, duplicate: boolean) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('LEAD_NOTIFICATION_EMAIL');
  const from = Deno.env.get('LEAD_FROM_EMAIL');
  if (!apiKey || !to || !from) return;
  const subject = `${duplicate ? 'עדכון ליד' : 'ליד חדש'} #${lead.lead_number} — ${lead.name}`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#172c3f"><h2>${escapeHtml(subject)}</h2><p><strong>שם:</strong> ${escapeHtml(lead.name)}</p><p><strong>טלפון:</strong> ${escapeHtml(lead.phone)}</p><p><strong>אימייל:</strong> ${escapeHtml(lead.email || '-')}</p><p><strong>כתובת:</strong> ${escapeHtml(lead.city_or_address || '-')}</p><p><strong>מקור:</strong> ${escapeHtml(lead.source_type || '-')}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) console.error('Resend failed', response.status, await response.text());
}

async function appendLeadToGoogleSheets(lead: Record<string, unknown>, duplicate: boolean) {
  const webhookUrl = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');
  if (!webhookUrl) return;
  const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: Deno.env.get('GOOGLE_SHEETS_WEBHOOK_SECRET') || '', duplicate, lead }) });
  if (!response.ok) console.error('Google Sheets webhook failed', response.status, await response.text());
}
function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }); }
