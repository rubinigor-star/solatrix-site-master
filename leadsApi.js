import { getLeads as getLocalLeads, saveLead as saveLocalLead, updateLeadStatus as updateLocalLeadStatus } from './leadsStore.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

export async function listLeads() {
  if (!isSupabaseConfigured) return getLocalLeads();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Supabase listLeads failed, using local fallback', error);
    return getLocalLeads();
  }
  return data.map(fromDbLead);
}

export async function createLead(lead) {
  if (!isSupabaseConfigured) return saveLocalLead(lead);
  const payload = toDbLead(lead);
  const { data, error } = await supabase
    .from('leads')
    .insert(payload)
    .select()
    .single();
  if (error) {
    console.warn('Supabase createLead failed, using local fallback', error);
    return saveLocalLead(lead);
  }
  return fromDbLead(data);
}

export async function changeLeadStatus(id, status) {
  if (!isSupabaseConfigured) return updateLocalLeadStatus(id, status);
  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.warn('Supabase changeLeadStatus failed, using local fallback', error);
    return updateLocalLeadStatus(id, status);
  }
  return fromDbLead(data);
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  return supabase.auth.signInWithOAuth({ provider: 'google' });
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  return supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function toDbLead(lead) {
  return {
    lead_number: lead.id || createLeadNumber(),
    name: lead.name,
    phone: lead.phone,
    address: lead.address,
    monthly_bill: lead.monthlyBill,
    status: lead.status || 'חדש',
    roof_type: lead.roofType,
    surfaces: lead.surfaces || [],
    obstacles: lead.obstacles || [],
    calculation: {
      systemKw: lead.systemKw,
      annualProduction: lead.annualProduction,
      annualSavings: lead.annualSavings,
      payback: lead.payback,
      profit25: lead.profit25
    },
    report_snapshot: lead.reportSnapshot || {}
  };
}

function fromDbLead(row) {
  return {
    id: row.id,
    leadNumber: row.lead_number,
    name: row.name || 'ללא שם',
    phone: row.phone || '',
    address: row.address || '',
    monthlyBill: row.monthly_bill,
    status: row.status,
    roofType: row.roof_type,
    surfaces: row.surfaces || [],
    obstacles: row.obstacles || [],
    systemKw: row.calculation?.systemKw,
    annualProduction: row.calculation?.annualProduction,
    annualSavings: row.calculation?.annualSavings,
    payback: row.calculation?.payback,
    profit25: row.calculation?.profit25,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createLeadNumber() {
  return `SOL-${new Date().getFullYear()}-${Date.now()}`;
}
