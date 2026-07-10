import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient.js';

let selectedLeadId = null;
let requestToken = 0;

if (isSupabaseConfigured()) {
  document.addEventListener('click', (event) => {
    const row = event.target.closest?.('[data-lead-id]');
    if (row?.dataset.leadId) {
      selectedLeadId = row.dataset.leadId;
      scheduleRender();
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (selectedLeadId && document.querySelector('.crmDrawer')) scheduleRender();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function scheduleRender() {
  const token = ++requestToken;
  setTimeout(() => renderReportsForLead(selectedLeadId, token), 180);
}

async function renderReportsForLead(leadId, token) {
  if (!leadId || token !== requestToken) return;
  const section = findReportsSection();
  if (!section) return;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (token !== requestToken || !findReportsSection()) return;
  const currentSection = findReportsSection();
  if (error) {
    currentSection.insertAdjacentHTML('beforeend', `<p class="crmReportPatchError">Не удалось загрузить отчёты: ${escapeHtml(error.message)}</p>`);
    return;
  }

  const reports = data || [];
  currentSection.querySelectorAll('.crmReportList, .crmReportPatchEmpty, .crmReportPatchError').forEach((node) => node.remove());
  const oldEmpty = [...currentSection.querySelectorAll('p')].find((node) => node.textContent.includes('Отчётов пока нет'));
  oldEmpty?.remove();

  if (!reports.length) {
    currentSection.insertAdjacentHTML('beforeend', '<p class="crmReportPatchEmpty">Отчётов пока нет.</p>');
    return;
  }

  currentSection.insertAdjacentHTML('beforeend', `<div class="crmReportList crmReportPatchList">${reports.map(renderReportCard).join('')}</div>`);
  injectStyles();
}

function findReportsSection() {
  return [...document.querySelectorAll('.crmDrawerSection')]
    .find((section) => section.querySelector('h3')?.textContent?.trim() === 'Отчёты Roof Check');
}

function renderReportCard(report) {
  const calculation = report.calculation && typeof report.calculation === 'object' ? report.calculation : {};
  const roofData = report.roof_data && typeof report.roof_data === 'object' ? report.roof_data : {};
  const metadata = report.metadata && typeof report.metadata === 'object' ? report.metadata : {};
  const metrics = Object.entries(calculation).filter(([, value]) => value !== '' && value != null);
  const deliveryStatus = metadata.deliveryStatus === 'pending_whatsapp_connection'
    ? 'Ожидает отправки в WhatsApp'
    : metadata.deliveryStatus || 'Данные сохранены';

  return `
    <article class="crmReport crmReportPatchCard">
      <div class="crmReportHead">
        <div><b>Roof Check</b><small>${formatDateTime(report.created_at)}</small></div>
        <span class="crmReportPatchStatus">${escapeHtml(deliveryStatus)}</span>
      </div>
      ${metrics.length ? `<div class="crmReportPatchMetrics">${metrics.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`).join('')}</div>` : '<p>Расчёт сохранён без сводных показателей.</p>'}
      <div class="crmReportPatchMeta">
        <span><b>Адрес:</b> ${escapeHtml(roofData.address || '—')}</span>
        <span><b>WhatsApp:</b> ${escapeHtml(metadata.recipientPhone || '—')}</span>
      </div>
      ${report.storage_path
        ? `<button class="crmSecondary" data-action="open-report" data-report-path="${escapeAttribute(report.storage_path)}">Открыть PDF</button>`
        : '<div class="crmReportPatchNotice">Расчёт и запрос сохранены. Сам PDF-файл ещё не сформирован и не загружен в хранилище.</div>'}
      <details><summary>Все технические данные</summary><pre class="crmJson">${escapeHtml(JSON.stringify({ calculation, roofData, metadata }, null, 2))}</pre></details>
    </article>`;
}

function injectStyles() {
  if (document.getElementById('crm-report-patch-styles')) return;
  const style = document.createElement('style');
  style.id = 'crm-report-patch-styles';
  style.textContent = `
    .crmReportPatchList{display:grid;gap:12px}.crmReportPatchCard{padding:16px;border:1px solid #dbe5ec;border-radius:18px;background:#fbfdff}
    .crmReportPatchCard .crmReportHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.crmReportPatchCard .crmReportHead div{display:grid;gap:3px}
    .crmReportPatchStatus{padding:6px 9px;border-radius:999px;background:#fff2d8;color:#8a5700;font-size:11px;font-weight:800}
    .crmReportPatchMetrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:13px 0}.crmReportPatchMetrics div{padding:10px;border-radius:12px;background:white;border:1px solid #e7edf2;display:grid;gap:4px}.crmReportPatchMetrics span{font-size:11px;color:var(--crm-muted)}.crmReportPatchMetrics b{font-size:13px;word-break:break-word}
    .crmReportPatchMeta{display:grid;gap:5px;font-size:12px;color:var(--crm-muted);margin:10px 0}.crmReportPatchNotice{margin:11px 0;padding:10px 12px;border-radius:12px;background:#eef6ff;color:#315b7a;font-size:12px;line-height:1.45}.crmReportPatchCard details{margin-top:10px}.crmReportPatchEmpty,.crmReportPatchError{margin:0;color:var(--crm-muted)}.crmReportPatchError{color:#a72c2c}
    @media(max-width:620px){.crmReportPatchMetrics{grid-template-columns:1fr}.crmReportPatchCard .crmReportHead{display:grid}}
  `;
  document.head.appendChild(style);
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}
