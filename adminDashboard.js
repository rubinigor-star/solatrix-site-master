import '../styles.css';
import './globalLeadForm.css';
import { deleteLead, exportLeadsCsv, getLeads, LEAD_STATUSES, seedDemoLeads, updateLeadNotes, updateLeadStatus } from './leadsStore.js';

const PHONE = '972547299727';
const root = document.getElementById('admin-root');

function money(value) {
  const number = Number(value || 0);
  return `₪${Math.round(number).toLocaleString('he-IL')}`;
}

function num(value, digits = 0) {
  const number = Number(value || 0);
  return number ? number.toLocaleString('he-IL', { maximumFractionDigits: digits }) : '-';
}

function sourceLabel(sourceType) {
  return ({ 'site-form': 'site-form', 'roof-check': 'roof-check', 'contact-page': 'contact-page' })[sourceType] || sourceType || 'site-form';
}

function render() {
  const leads = getLeads();
  const stats = [
    ['סה״כ לידים', leads.length],
    ['חדשים', leads.filter((lead) => lead.status === 'חדש').length],
    ['סיורים', leads.filter((lead) => lead.status === 'נקבע סיור').length],
    ['עסקאות', leads.filter((lead) => lead.status === 'עסקה').length]
  ];

  root.innerHTML = `
    <header class="adminTopbar">
      <a class="adminBrand" href="./"><strong>Solatrix Energy</strong><span>CRM Mock</span></a>
      <nav><a href="./">ראשי</a><a href="./roof-check/">Roof Check</a><a href="./contact.html">צור קשר</a></nav>
    </header>
    <main class="adminPage">
      <section class="adminHero">
        <p class="eyebrow">Staging only · localStorage</p>
        <h1>ניהול לידים Solatrix</h1>
        <p>מסך mock לבדיקת הזרימה עד לחיבור API אמיתי. הלידים נשמרים בדפדפן המקומי בלבד.</p>
        <div class="adminHeroActions">
          <button data-action="seed">Demo leads</button>
          <button data-action="export">Export CSV</button>
          <a href="./roof-check/">בדיקת גג</a>
        </div>
      </section>
      <section class="adminStatsGrid">${stats.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</section>
      <section class="adminLeadsCard">
        <div class="adminCardHead"><h2>רשימת לידים</h2><span>${leads.length} רשומות</span></div>
        ${leads.length ? `<div class="adminTableWrap"><table class="adminTable"><thead><tr><th>תאריך</th><th>שם</th><th>טלפון</th><th>אימייל</th><th>עיר / כתובת</th><th>מקור</th><th>חישוב</th><th>סטטוס</th><th>פעולות</th></tr></thead><tbody>${leads.map(row).join('')}</tbody></table></div>` : `<div class="emptyState"><h3>אין עדיין לידים</h3><p>פתחו את הטופס הגלובלי או הפיקו דוח ב-Roof Check כדי לראות כאן ליד ראשון.</p><a href="./roof-check/">להתחיל בדיקת גג</a></div>`}
      </section>
    </main>`;
}

function row(lead) {
  const date = lead.createdAt ? new Date(lead.createdAt).toLocaleString('he-IL') : '-';
  const whatsapp = whatsappHref(lead);
  const calc = lead.systemKw ? `<b>${num(lead.systemKw, 1)} kW</b><small>${num(lead.panels)} פאנלים · ${money(lead.annualSavings)} שנתי · ${num(lead.payback, 1)} שנים</small>` : '<small>ללא חישוב</small>';
  return `<tr>
    <td>${date}</td>
    <td><b>${escapeHtml(lead.name || '-')}</b></td>
    <td dir="ltr">${escapeHtml(lead.phone || '-')}</td>
    <td dir="ltr">${escapeHtml(lead.email || '-')}</td>
    <td>${escapeHtml(lead.cityOrAddress || lead.address || '-')}</td>
    <td><span class="sourcePill">${escapeHtml(sourceLabel(lead.sourceType))}</span></td>
    <td class="calcCell">${calc}</td>
    <td><select data-status="${lead.id}">${LEAD_STATUSES.map((status) => `<option ${status === lead.status ? 'selected' : ''}>${status}</option>`).join('')}</select></td>
    <td class="actionsCell"><a href="${whatsapp}" target="_blank" rel="noreferrer">WhatsApp</a><button data-note="${lead.id}">הערה</button><button data-delete="${lead.id}">מחיקה</button></td>
  </tr>
  <tr class="notesRow"><td colspan="9"><label>הערות ל-${escapeHtml(lead.name || 'ליד')}<textarea data-notes="${lead.id}" rows="2">${escapeHtml(lead.notes || '')}</textarea></label></td></tr>`;
}

function whatsappHref(lead) {
  const message = [`Solatrix lead`, `Name: ${lead.name || '-'}`, `Phone: ${lead.phone || '-'}`, `Address: ${lead.cityOrAddress || lead.address || '-'}`, `Source: ${sourceLabel(lead.sourceType)}`].join('\n');
  const phone = String(lead.phone || '').replace(/\D/g, '') || PHONE;
  const normalized = phone.startsWith('0') ? `972${phone.slice(1)}` : phone;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
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

root.addEventListener('click', (event) => {
  const seed = event.target.closest('[data-action="seed"]');
  const exportButton = event.target.closest('[data-action="export"]');
  const deleteButton = event.target.closest('[data-delete]');
  const noteButton = event.target.closest('[data-note]');
  if (seed) { seedDemoLeads(); render(); }
  if (exportButton) downloadCsv();
  if (deleteButton) { deleteLead(deleteButton.dataset.delete); render(); }
  if (noteButton) {
    const textarea = root.querySelector(`[data-notes="${noteButton.dataset.note}"]`);
    updateLeadNotes(noteButton.dataset.note, textarea?.value || '');
    render();
  }
});

root.addEventListener('change', (event) => {
  if (event.target.matches('[data-status]')) {
    updateLeadStatus(event.target.dataset.status, event.target.value);
    render();
  }
});

render();

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
