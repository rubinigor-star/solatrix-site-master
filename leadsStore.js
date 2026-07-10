const STORAGE_KEY = 'solatrix_roof_check_leads';

export const LEAD_STATUSES = ['חדש', 'נוצר קשר', 'נקבע סיור', 'נשלחה הצעה', 'עסקה', 'לא רלוונטי'];

export function getLeads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeLead) : [];
  } catch {
    return [];
  }
}

export function saveLead(lead = {}) {
  const leads = getLeads();
  const existingIndex = leads.findIndex((item) => item.id === lead.id);
  const nextLead = normalizeLead({
    ...lead,
    id: lead.id || createLeadId(leads.length + 1),
    status: lead.status || 'חדש',
    createdAt: lead.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  if (existingIndex >= 0) leads[existingIndex] = nextLead;
  else leads.unshift(nextLead);
  persist(leads);
  window.dispatchEvent(new CustomEvent('solatrix:leads-updated', { detail: nextLead }));
  return nextLead;
}

export function updateLeadStatus(id, status) {
  const leads = getLeads();
  const next = leads.map((lead) => lead.id === id ? normalizeLead({ ...lead, status, updatedAt: new Date().toISOString() }) : lead);
  persist(next);
  return next.find((lead) => lead.id === id);
}

export function updateLeadNotes(id, notes) {
  const leads = getLeads();
  const next = leads.map((lead) => lead.id === id ? normalizeLead({ ...lead, notes, updatedAt: new Date().toISOString() }) : lead);
  persist(next);
  return next.find((lead) => lead.id === id);
}

export function deleteLead(id) {
  persist(getLeads().filter((lead) => lead.id !== id));
}

export function getLead(id) {
  return getLeads().find((lead) => lead.id === id);
}

export function clearLeads() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('solatrix:leads-updated'));
}

export function seedDemoLeads() {
  if (getLeads().length) return getLeads();
  const now = new Date().toISOString();
  const demoLeads = [
    normalizeLead({
      id: 'SOL-DEMO-00001',
      name: 'משפחת לוי',
      phone: '054-729-9727',
      email: 'levi@example.com',
      cityOrAddress: 'החרמון 10, חיפה',
      monthlyBill: 920,
      propertyType: 'בית פרטי',
      roofType: 'flat',
      systemKw: 8.7,
      panels: 14,
      annualProduction: 13940,
      annualSavings: 7240,
      payback: 3.5,
      profit25: 155600,
      status: 'חדש',
      notes: 'ביקשו שיחה אחרי 18:00',
      sourcePage: '/roof-check/report',
      sourceType: 'roof-check',
      createdAt: now,
      updatedAt: now
    }),
    normalizeLead({
      id: 'SOL-DEMO-00002',
      name: 'אבו סאלח חקלאות',
      phone: '052-410-7788',
      email: '',
      cityOrAddress: 'משק בגליל מערבי',
      monthlyBill: 2400,
      propertyType: 'חקלאי',
      roofType: 'commercial',
      systemKw: 23.4,
      panels: 37,
      annualProduction: 37440,
      annualSavings: 18600,
      payback: 3.6,
      profit25: 397200,
      status: 'נקבע סיור',
      notes: 'גג פח גדול, צריך לבדוק קונסטרוקציה',
      sourcePage: '/roof-check/report',
      sourceType: 'roof-check',
      createdAt: now,
      updatedAt: now
    }),
    normalizeLead({
      id: 'SOL-DEMO-00003',
      name: 'כהן נכסים',
      phone: '050-333-2211',
      email: 'office@example.com',
      cityOrAddress: 'אזור תעשייה חיפה',
      monthlyBill: 5100,
      propertyType: 'עסק',
      roofType: 'commercial',
      systemKw: 47.1,
      panels: 75,
      annualProduction: 75280,
      annualSavings: 35900,
      payback: 3.8,
      profit25: 760000,
      status: 'נשלחה הצעה',
      notes: 'מבקש סימולציה של 100kW בהמשך',
      sourcePage: '/admin',
      sourceType: 'site-form',
      createdAt: now,
      updatedAt: now
    })
  ];
  persist(demoLeads);
  return demoLeads;
}

export function exportLeadsCsv() {
  const headers = ['id','createdAt','status','name','phone','email','cityOrAddress','propertyType','monthlyBill','sourceType','sourcePage','systemKw','panels','annualProduction','annualSavings','payback','profit25','notes'];
  const rows = getLeads().map((lead) => headers.map((key) => csvCell(lead[key])).join(','));
  return `\ufeff${headers.join(',')}\n${rows.join('\n')}`;
}

export function normalizeLead(lead = {}) {
  const address = lead.cityOrAddress || lead.address || '';
  const sourceType = lead.sourceType || lead.source || 'site-form';
  return {
    id: lead.id || '',
    createdAt: lead.createdAt || '',
    updatedAt: lead.updatedAt || '',
    name: lead.name || lead.fullName || '',
    phone: lead.phone || '',
    email: lead.email || '',
    cityOrAddress: address,
    address,
    propertyType: lead.propertyType || lead.projectType || '',
    projectType: lead.projectType || lead.propertyType || '',
    monthlyBill: lead.monthlyBill || '',
    message: lead.message || '',
    sourcePage: lead.sourcePage || safePath(),
    sourceType,
    source: sourceType,
    status: LEAD_STATUSES.includes(lead.status) ? lead.status : 'חדש',
    notes: lead.notes || '',
    roofType: lead.roofType || '',
    surfaces: lead.surfaces || [],
    obstacles: lead.obstacles || [],
    systemKw: numericOrBlank(lead.systemKw),
    panels: numericOrBlank(lead.panels),
    annualProduction: numericOrBlank(lead.annualProduction),
    annualSavings: numericOrBlank(lead.annualSavings),
    payback: numericOrBlank(lead.payback),
    profit25: numericOrBlank(lead.profit25)
  };
}

function persist(leads) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.map(normalizeLead)));
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function createLeadId(index) {
  const year = new Date().getFullYear();
  return `SOL-${year}-${String(index).padStart(5, '0')}`;
}

function numericOrBlank(value) {
  if (value === '' || value == null || Number.isNaN(Number(value))) return '';
  return Number(value);
}

function safePath() {
  try { return window.location.pathname || '/'; }
  catch { return '/'; }
}
