import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-solatrix-client, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const allowedPropertyTypes = new Set(['בית פרטי', 'עסק', 'חקלאי', 'אחר', 'private-home', 'business', 'agriculture', 'other']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, code: 'method_not_allowed', message: 'Method not allowed.' }, 405);
  }

  try {
    const payload = await request.json();
    const validation = validatePayload(payload);

    if (!validation.ok) {
      return json({
        ok: false,
        code: 'validation_error',
        message: 'Invalid lead details.',
        details: validation.errors
      }, 400);
    }

    if (String(payload.website || '').trim()) {
      return json({ ok: true, ignored: true });
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const normalizedPhone = normalizePhone(payload.phone);
    const attribution = payload.attribution || {};
    const lastTouch = attribution.lastTouch || {};
    const metadata = {
      ...(payload.metadata || {}),
      locale: payload.locale || 'he',
      firstTouch: attribution.firstTouch || null,
      clientIpHash: await hashValue(getClientIp(request)),
      submittedAt: payload.submittedAt || new Date().toISOString()
    };

    const duplicateSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingLead, error: existingError } = await supabase
      .from('leads')
      .select('id, lead_number, duplicate_count, status')
      .eq('phone_normalized', normalizedPhone)
      .gte('created_at', duplicateSince)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    const leadValues = {
      submission_id: safeUuid(payload.submissionId),
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
      consent_at: new Date().toISOString(),
      last_submitted_at: new Date().toISOString(),
      metadata
    };

    let lead;
    let duplicate = false;

    if (existingLead) {
      duplicate = true;
      const { data, error } = await supabase
        .from('leads')
        .update({
          ...leadValues,
          submission_id: leadValues.submission_id || undefined,
          duplicate_count: Number(existingLead.duplicate_count || 0) + 1
        })
        .eq('id', existingLead.id)
        .select('*')
        .single();

      if (error) throw error;
      lead = data;
    } else {
      const { data, error } = await supabase
        .from('leads')
        .insert({ ...leadValues, status: 'new' })
        .select('*')
        .single();

      if (error) throw error;
      lead = data;
    }

    const eventPayload = {
      duplicate,
      sourceType: lead.source_type,
      sourcePage: lead.source_page,
      submissionId: payload.submissionId || null
    };

    const { error: eventError } = await supabase.from('lead_events').insert({
      lead_id: lead.id,
      event_type: duplicate ? 'lead_resubmitted' : 'lead_created',
      payload: eventPayload
    });

    if (eventError) console.error('lead_events insert failed', eventError);

    if (payload.reportData && typeof payload.reportData === 'object') {
      const reportData = payload.reportData;
      const { error: reportError } = await supabase.from('reports').insert({
        lead_id: lead.id,
        report_type: cleanText(reportData.reportType || 'roof-check', 80),
        calculation: reportData.calculation || reportData.report || {},
        roof_data: reportData.roofData || reportData.state || {},
        metadata: reportData.metadata || {}
      });

      if (reportError) console.error('report insert failed', reportError);
    }

    await Promise.allSettled([
      sendLeadEmail(lead, duplicate),
      appendLeadToGoogleSheets(lead, duplicate)
    ]);

    return json({
      ok: true,
      leadId: lead.id,
      leadNumber: lead.lead_number,
      duplicate
    });
  } catch (error) {
    console.error('submit-lead failed', error);
    return json({
      ok: false,
      code: 'internal_error',
      message: 'Lead submission failed.'
    }, 500);
  }
});

function validatePayload(payload: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const name = String(payload?.name || '').trim();
  const phone = String(payload?.phone || '').trim();
  const email = String(payload?.email || '').trim();

  if (name.length < 2 || name.length > 160) errors.name = 'invalid_name';
  if (!/^(?:9725\d{8}|05\d{8})$/.test(phone.replace(/\D/g, ''))) errors.phone = 'invalid_phone';
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'invalid_email';
  if (payload?.consent !== true) errors.consent = 'consent_required';

  return { ok: Object.keys(errors).length === 0, errors };
}

function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

function cleanText(value: unknown, maxLength: number) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return email ? email.slice(0, 320) : null;
}

function toNullableNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeUuid(value: unknown) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function getClientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || 'unknown';
}

async function hashValue(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sendLeadEmail(lead: Record<string, unknown>, duplicate: boolean) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('LEAD_NOTIFICATION_EMAIL');
  const from = Deno.env.get('LEAD_FROM_EMAIL');
  if (!apiKey || !to || !from) return;

  const subject = `${duplicate ? 'עדכון ליד' : 'ליד חדש'} #${lead.lead_number} — ${lead.name}`;
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#172c3f">
      <h2>${escapeHtml(subject)}</h2>
      <p><strong>שם:</strong> ${escapeHtml(lead.name)}</p>
      <p><strong>טלפון:</strong> ${escapeHtml(lead.phone)}</p>
      <p><strong>אימייל:</strong> ${escapeHtml(lead.email || '-')}</p>
      <p><strong>כתובת:</strong> ${escapeHtml(lead.city_or_address || '-')}</p>
      <p><strong>סוג נכס:</strong> ${escapeHtml(lead.property_type || '-')}</p>
      <p><strong>חשבון חודשי:</strong> ${escapeHtml(lead.monthly_bill || '-')}</p>
      <p><strong>מקור:</strong> ${escapeHtml(lead.source_type || '-')}</p>
      <p><strong>הודעה:</strong><br>${escapeHtml(lead.message || '-')}</p>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  });

  if (!response.ok) {
    console.error('Resend failed', response.status, await response.text());
  }
}

async function appendLeadToGoogleSheets(lead: Record<string, unknown>, duplicate: boolean) {
  const webhookUrl = Deno.env.get('GOOGLE_SHEETS_WEBHOOK_URL');
  if (!webhookUrl) return;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: Deno.env.get('GOOGLE_SHEETS_WEBHOOK_SECRET') || '',
      duplicate,
      lead
    })
  });

  if (!response.ok) {
    console.error('Google Sheets webhook failed', response.status, await response.text());
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character] || character);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
