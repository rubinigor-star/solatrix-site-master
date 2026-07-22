import './adminApp.css';
import { getSupabaseClient, isSupabaseConfigured } from './lib/supabaseClient.js';
import { coordinateText } from './lib/roofGeometry.js';

const root = document.getElementById('admin-root');
const STATUS_LABELS = {
  completed: 'Completed',
  started: 'In Progress',
  abandoned: 'Abandoned',
  contacted: 'Contacted',
  qualified: 'Qualified',
  lost: 'Lost'
};

const state = {
  supabase: null,
  session: null,
  profile: null,
  leads: [],
  selectedLead: null,
  reports: [],
  tasks: [],
  events: [],
  search: '',
  status: 'all',
  source: 'all',
  loading: false,
  toast: null
};

init();

async function init() {
  if (!isSupabaseConfigured()) {
    renderSetupRequired();
    return;
  }

  state.supabase = getSupabaseClient();
  const { data } = await state.supabase.auth.getSession();
  await applySession(data.session);

  state.supabase.auth.onAuthStateChange(async (_event, session) => {
    await applySession(session);
  });
}

async function applySession(session) {
  state.session = session;
  state.profile = null;
  state.selectedLead = null;

  if (!session) {
    renderLogin();
    return;
  }

  const { data: profile, error } = await state.supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile?.is_active) {
    renderAccessDenied(session.user.email, error?.message);
    return;
  }

  state.profile = profile;
  await loadLeads();
}

function renderSetupRequired() {
  root.innerHTML = `
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${authBrand()}
        <h1>CRM ещё не подключена</h1>
        <p>Интерфейс уже подготовлен, но для входа нужны публичные параметры проекта Supabase.</p>
        <code class="crmSetupCode">VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY</code>
        <p style="margin-top:18px">Инструкция находится в <b>docs/SUPABASE_SETUP.md</b>.</p>
        <a class="crmSecondary" href="./index.html" style="display:inline-flex">Вернуться на сайт</a>
      </section>
    </main>`;
}

function renderLogin(message = '') {
  root.innerHTML = `
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${authBrand()}
        <h1>Вход в CRM</h1>
        <p>Используйте email и пароль, созданные для вашего аккаунта Solatrix.</p>
        <form data-login-form>
          <label class="crmField">Email<input name="email" type="email" autocomplete="username" required /></label>
          <label class="crmField">Пароль<input name="password" type="password" autocomplete="current-password" required /></label>
          <div class="crmFormError" data-login-error ${message ? '' : 'hidden'}>${escapeHtml(message)}</div>
          <button class="crmPrimary" type="submit" style="width:100%;margin-top:14px">Войти</button>
        </form>
      </section>
    </main>`;

  root.querySelector('[data-login-form]')?.addEventListener('submit', handleLogin);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  const errorNode = form.querySelector('[data-login-error]');
  const values = Object.fromEntries(new FormData(form).entries());

  button.disabled = true;
  button.textContent = 'Входим...';
  errorNode.hidden = true;

  const { error } = await state.supabase.auth.signInWithPassword({
    email: String(values.email || '').trim(),
    password: String(values.password || '')
  });

  if (error) {
    errorNode.textContent = 'Неверный email или пароль.';
    errorNode.hidden = false;
    button.disabled = false;
    button.textContent = 'Войти';
  }
}

function renderAccessDenied(email, details = '') {
  root.innerHTML = `
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${authBrand()}
        <h1>Нет доступа</h1>
        <p>Аккаунт <b>${escapeHtml(email || '')}</b> существует, но не активирован для CRM.</p>
        ${details ? `<div class="crmFormError">${escapeHtml(details)}</div>` : ''}
        <button class="crmSecondary" data-action="logout" style="margin-top:16px">Выйти</button>
      </section>
    </main>`;
  root.querySelector('[data-action="logout"]')?.addEventListener('click', logout);
}

async function loadLeads() {
  state.loading = true;
  renderApp();

  const { data, error } = await state.supabase
    .from('leads')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(2000);

  state.loading = false;
  if (error) {
    showToast(`Не удалось загрузить лиды: ${error.message}`, true);
    state.leads = [];
  } else {
    state.leads = data || [];
  }
  renderApp();
}

function renderApp() {
  if (!state.profile) return;
  const visibleLeads = filteredLeads();
  const stats = calculateStats(state.leads);

  root.innerHTML = `
    <div class="crmApp">
      <header class="crmTopbar">
        <a class="crmBrand" href="./index.html">
          <span class="crmBrandMark">S</span>
          <span><b>Solatrix CRM</b><small>Клиенты и Roof Check</small></span>
        </a>
        <div class="crmUser">
          <div class="crmUserText"><b>${escapeHtml(state.profile.full_name || state.session?.user?.email || '')}</b><span>${escapeHtml(state.profile.role)}</span></div>
          <button class="crmSecondary" data-action="logout">Выйти</button>
        </div>
      </header>

      <main class="crmMain">
        <div class="crmPageHead">
          <div><h1>Клиентская база</h1><p>Новые заявки, отчёты Roof Check, задачи и история контактов.</p></div>
          <div class="crmHeadActions">
            <button class="crmSecondary" data-action="refresh">Обновить</button>
            <button class="crmSecondary" data-action="export-csv">CSV</button>
            <button class="crmPrimary" data-action="export-excel">Excel</button>
          </div>
        </div>

        <section class="crmStats">
          <div class="crmStat"><span>Всего активных</span><b>${stats.total}</b></div>
          <div class="crmStat"><span>Completed</span><b>${stats.completed}</b></div>
          <div class="crmStat"><span>In Progress</span><b>${stats.started}</b></div>
          <div class="crmStat"><span>Abandoned</span><b>${stats.abandoned}</b></div>
        </section>

        <section class="crmPanel">
          <div class="crmFilters">
            <input data-filter="search" value="${escapeAttribute(state.search)}" placeholder="Поиск по имени, телефону, email или адресу" />
            <select data-filter="status">${statusFilterOptions()}</select>
            <select data-filter="source">${sourceFilterOptions()}</select>
          </div>
          ${state.loading ? '<div class="crmLoading">Загружаем клиентскую базу...</div>' : renderLeadsTable(visibleLeads)}
        </section>
      </main>
    </div>
    ${state.selectedLead ? renderLeadDrawer(state.selectedLead) : ''}
    ${state.toast ? `<div class="crmToast${state.toast.error ? ' error' : ''}">${escapeHtml(state.toast.message)}</div>` : ''}`;

  bindAppEvents();
}

function renderLeadsTable(leads) {
  if (!leads.length) return '<div class="crmEmpty">По выбранным фильтрам лидов нет.</div>';
  return `
    <div class="crmTableWrap">
      <table class="crmTable">
        <thead><tr><th>№ / дата</th><th>Клиент</th><th>Контакты</th><th>Объект</th><th>Источник</th><th>Статус</th><th>Следующий контакт</th></tr></thead>
        <tbody>${leads.map((lead) => `
          <tr data-lead-id="${lead.id}">
            <td><b>#${lead.lead_number || '—'}</b><span class="crmLeadMeta">${formatDate(lead.created_at)}</span></td>
            <td><span class="crmLeadName">${escapeHtml(lead.name)}</span><span class="crmLeadMeta">${escapeHtml(lead.city_or_address || '')}</span></td>
            <td>${escapeHtml(lead.phone)}<span class="crmLeadMeta">${escapeHtml(lead.email || '')}</span></td>
            <td>${escapeHtml(lead.property_type || '—')}<span class="crmLeadMeta">${lead.monthly_bill ? `₪${formatNumber(lead.monthly_bill)}/мес.` : ''}</span></td>
            <td><span class="crmSource">${escapeHtml(lead.source_type || 'site-form')}</span></td>
            <td><span class="crmStatus" data-status="${escapeAttribute(lead.status)}">${escapeHtml(STATUS_LABELS[lead.status] || lead.status)}</span></td>
            <td>${lead.next_follow_up_at ? formatDateTime(lead.next_follow_up_at) : '—'}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function renderLeadDrawer(lead) {
  const canEdit = ['admin', 'manager'].includes(state.profile.role);
  const tags = Array.isArray(lead.tags) ? lead.tags.join(', ') : '';
  const roofGeometry = lead.metadata?.roofGeometry || null;
  return `
    <div class="crmDrawerBackdrop" data-action="close-drawer"></div>
    <aside class="crmDrawer" aria-label="Карточка клиента">
      <header class="crmDrawerHead">
        <div><h2>${escapeHtml(lead.name)}</h2><p>Лид #${lead.lead_number || '—'} · ${formatDateTime(lead.created_at)}</p></div>
        <button class="crmIconButton" data-action="close-drawer" aria-label="Закрыть">×</button>
      </header>
      <div class="crmDrawerBody">
        <section class="crmDrawerSection">
          <h3>Контактные данные</h3>
          <div class="crmInfoGrid">
            ${infoCell('Телефон', lead.phone, `tel:${lead.phone}`)}
            ${infoCell('Email', lead.email || '—', lead.email ? `mailto:${lead.email}` : '')}
            ${infoCell('Адрес', lead.city_or_address || '—')}
            ${infoCell('Объект', lead.property_type || '—')}
            ${infoCell('Счёт за электричество', lead.monthly_bill ? `₪${formatNumber(lead.monthly_bill)}` : '—')}
            ${infoCell('Удобное время', lead.preferred_contact_time || '—')}
            ${infoCell('Шаг калькулятора', lead.calculator_step || '—')}
            ${infoCell('Последняя активность', formatDateTime(lead.last_activity_at))}
          </div>
          <div class="crmQuickActions">
            <a href="tel:${escapeAttribute(lead.phone)}">Позвонить</a>
            <a class="whatsapp" href="https://wa.me/${normalizePhone(lead.phone)}" target="_blank" rel="noreferrer">WhatsApp</a>
            ${lead.email ? `<a href="mailto:${escapeAttribute(lead.email)}">Email</a>` : ''}
          </div>
        </section>

        <section class="crmDrawerSection">
          <h3>Карта и геометрия крыши</h3>
          <div class="crmInfoGrid">
            ${infoCell('Площадь', roofGeometry?.areaM2 ? `${formatNumber(roofGeometry.areaM2)} м²` : '—')}
            ${infoCell('Координаты', coordinateText(roofGeometry) || '—')}
            ${infoCell('Провайдер карты', roofGeometry?.provider || '—')}
            ${infoCell('Полигонов', roofGeometry?.geojson?.features?.length || '—')}
          </div>
          ${roofGeometry?.geojson ? `<details style="margin-top:12px"><summary>GeoJSON</summary><pre class="crmJson">${escapeHtml(JSON.stringify(roofGeometry.geojson, null, 2))}</pre></details>` : ''}
        </section>

        <section class="crmDrawerSection">
          <h3>Работа с лидом</h3>
          <form data-lead-edit-form>
            <div class="crmDetailGrid">
              <label class="crmField">Статус<select name="status" ${canEdit ? '' : 'disabled'}>${statusEditOptions(lead.status)}</select></label>
              <label class="crmField">Следующий контакт<input name="next_follow_up_at" type="datetime-local" value="${toDateTimeLocal(lead.next_follow_up_at)}" ${canEdit ? '' : 'disabled'} /></label>
              <label class="crmField wide">Теги через запятую<input name="tags" value="${escapeAttribute(tags)}" ${canEdit ? '' : 'disabled'} /></label>
              <label class="crmField wide">Внутренние заметки<textarea name="internal_notes" rows="5" ${canEdit ? '' : 'disabled'}>${escapeHtml(lead.internal_notes || '')}</textarea></label>
              <label class="crmField wide">Причина отказа<textarea name="lost_reason" rows="2" ${canEdit ? '' : 'disabled'}>${escapeHtml(lead.lost_reason || '')}</textarea></label>
            </div>
            ${canEdit ? '<div class="crmSaveRow"><button class="crmPrimary" type="submit">Сохранить</button></div>' : ''}
          </form>
        </section>

        <section class="crmDrawerSection">
          <h3>Сообщение клиента</h3>
          <p style="white-space:pre-wrap;margin:0;color:var(--crm-muted)">${escapeHtml(lead.message || 'Нет сообщения')}</p>
        </section>

        <section class="crmDrawerSection">
          <h3>Отчёты Roof Check</h3>
          ${renderReports()}
        </section>

        <section class="crmDrawerSection">
          <h3>Задачи</h3>
          ${renderTasks(canEdit)}
        </section>

        <section class="crmDrawerSection">
          <h3>История lead_events</h3>
          ${renderEvents()}
        </section>

        <section class="crmDrawerSection">
          <h3>Источник</h3>
          <div class="crmInfoGrid">
            ${infoCell('Тип', lead.source_type || '—')}
            ${infoCell('Страница', lead.source_page || '—')}
            ${infoCell('UTM campaign', lead.utm_campaign || '—')}
            ${infoCell('UTM source', lead.utm_source || '—')}
          </div>
        </section>
      </div>
    </aside>`;
}

function renderReports() {
  if (!state.reports.length) return '<p style="margin:0;color:var(--crm-muted)">Отчётов пока нет.</p>';
  return `<div class="crmReportList">${state.reports.map((report) => `
    <div class="crmReport">
      <div class="crmReportHead"><b>${escapeHtml(report.report_type || 'roof-check')}</b><small>${formatDateTime(report.created_at)}</small></div>
      ${report.storage_path ? `<button class="crmSecondary" data-action="open-report" data-report-path="${escapeAttribute(report.storage_path)}" style="margin-top:9px">Открыть PDF</button>` : ''}
      <details style="margin-top:9px"><summary>Данные расчёта</summary><pre class="crmJson">${escapeHtml(JSON.stringify(report.calculation || {}, null, 2))}</pre></details>
    </div>`).join('')}</div>`;
}

function renderEvents() {
  if (!state.events.length) return '<p style="margin:0;color:var(--crm-muted)">Событий пока нет.</p>';
  return `<div class="crmEventList">${state.events.map((event) => `
    <div class="crmEvent">
      <div class="crmEventHead"><b>${escapeHtml(event.event_type)}</b><small>${formatDateTime(event.created_at)}</small></div>
      ${event.payload && Object.keys(event.payload).length ? `<pre class="crmJson">${escapeHtml(JSON.stringify(event.payload, null, 2))}</pre>` : ''}
    </div>`).join('')}</div>`;
}

function renderTasks(canEdit) {
  const list = state.tasks.length
    ? `<div class="crmTaskList">${state.tasks.map((task) => `
        <div class="crmTask${task.status === 'completed' ? ' crmTaskDone' : ''}">
          <div class="crmTaskHead"><b>${escapeHtml(task.title)}</b><small>${task.due_at ? formatDateTime(task.due_at) : 'Без срока'}</small></div>
          ${task.description ? `<p style="margin:7px 0 0;color:var(--crm-muted);font-size:12px">${escapeHtml(task.description)}</p>` : ''}
          ${canEdit && task.status === 'open' ? `<button class="crmSecondary" data-action="complete-task" data-task-id="${task.id}" style="margin-top:9px">Выполнено</button>` : ''}
        </div>`).join('')}</div>`
    : '<p style="margin:0;color:var(--crm-muted)">Задач пока нет.</p>';

  if (!canEdit) return list;
  return `${list}
    <form class="crmTaskForm" data-task-form>
      <input name="title" placeholder="Новая задача" required />
      <input name="due_at" type="datetime-local" />
      <button class="crmPrimary" type="submit">Добавить</button>
    </form>`;
}

function bindAppEvents() {
  root.querySelectorAll('[data-action="logout"]').forEach((button) => button.addEventListener('click', logout));
  root.querySelector('[data-action="refresh"]')?.addEventListener('click', loadLeads);
  root.querySelector('[data-action="export-csv"]')?.addEventListener('click', exportCsv);
  root.querySelector('[data-action="export-excel"]')?.addEventListener('click', exportExcel);
  root.querySelectorAll('[data-lead-id]').forEach((row) => row.addEventListener('click', () => selectLead(row.dataset.leadId)));
  root.querySelectorAll('[data-action="close-drawer"]').forEach((node) => node.addEventListener('click', closeDrawer));
  root.querySelector('[data-lead-edit-form]')?.addEventListener('submit', saveLeadDetails);
  root.querySelector('[data-task-form]')?.addEventListener('submit', addTask);
  root.querySelectorAll('[data-action="complete-task"]').forEach((button) => button.addEventListener('click', () => completeTask(button.dataset.taskId)));
  root.querySelectorAll('[data-action="open-report"]').forEach((button) => button.addEventListener('click', () => openReport(button.dataset.reportPath)));

  root.querySelector('[data-filter="search"]')?.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderApp();
    requestAnimationFrame(() => {
      const input = root.querySelector('[data-filter="search"]');
      input?.focus();
      input?.setSelectionRange(state.search.length, state.search.length);
    });
  });
  root.querySelector('[data-filter="status"]')?.addEventListener('change', (event) => {
    state.status = event.target.value;
    renderApp();
  });
  root.querySelector('[data-filter="source"]')?.addEventListener('change', (event) => {
    state.source = event.target.value;
    renderApp();
  });
}

async function selectLead(id) {
  state.selectedLead = state.leads.find((lead) => lead.id === id) || null;
  state.reports = [];
  state.tasks = [];
  state.events = [];
  renderApp();
  if (!state.selectedLead) return;

  const [reportsResult, tasksResult, eventsResult] = await Promise.all([
    state.supabase.from('reports').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    state.supabase.from('tasks').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
    state.supabase.from('lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false })
  ]);

  state.reports = reportsResult.data || [];
  state.tasks = tasksResult.data || [];
  state.events = eventsResult.data || [];
  if (reportsResult.error) showToast(reportsResult.error.message, true);
  if (tasksResult.error) showToast(tasksResult.error.message, true);
  if (eventsResult.error) showToast(eventsResult.error.message, true);
  renderApp();
}

function closeDrawer() {
  state.selectedLead = null;
  state.reports = [];
  state.tasks = [];
  state.events = [];
  renderApp();
}

async function saveLeadDetails(event) {
  event.preventDefault();
  if (!state.selectedLead) return;
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const tags = String(values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const update = {
    status: values.status,
    next_follow_up_at: values.next_follow_up_at ? new Date(values.next_follow_up_at).toISOString() : null,
    internal_notes: String(values.internal_notes || '').trim() || null,
    lost_reason: String(values.lost_reason || '').trim() || null,
    tags,
    last_contacted_at: ['contacted', 'qualified'].includes(values.status)
      ? new Date().toISOString()
      : state.selectedLead.last_contacted_at,
    completed_at: values.status === 'completed' ? (state.selectedLead.completed_at || new Date().toISOString()) : state.selectedLead.completed_at,
    abandoned_at: values.status === 'abandoned' ? (state.selectedLead.abandoned_at || new Date().toISOString()) : values.status === 'started' ? null : state.selectedLead.abandoned_at
  };

  const { data, error } = await state.supabase
    .from('leads')
    .update(update)
    .eq('id', state.selectedLead.id)
    .select('*')
    .single();

  if (error) {
    showToast(`Не удалось сохранить: ${error.message}`, true);
    return;
  }

  const eventRecord = {
    lead_id: data.id,
    actor_id: state.profile.id,
    event_type: state.selectedLead.status === data.status ? 'lead_updated' : 'lead_status_changed',
    payload: { ...update, previousStatus: state.selectedLead.status }
  };
  const { data: savedEvent } = await state.supabase.from('lead_events').insert(eventRecord).select('*').single();

  state.leads = state.leads.map((lead) => lead.id === data.id ? data : lead);
  state.selectedLead = data;
  if (savedEvent) state.events = [savedEvent, ...state.events];
  showToast('Карточка сохранена.');
  renderApp();
}

async function addTask(event) {
  event.preventDefault();
  if (!state.selectedLead) return;
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const title = String(values.title || '').trim();
  if (!title) return;

  const { data, error } = await state.supabase
    .from('tasks')
    .insert({
      lead_id: state.selectedLead.id,
      assigned_to: state.profile.id,
      title,
      due_at: values.due_at ? new Date(values.due_at).toISOString() : null
    })
    .select('*')
    .single();

  if (error) {
    showToast(`Не удалось добавить задачу: ${error.message}`, true);
    return;
  }
  state.tasks = [data, ...state.tasks];
  showToast('Задача добавлена.');
  renderApp();
}

async function completeTask(id) {
  const { data, error } = await state.supabase
    .from('tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    showToast(error.message, true);
    return;
  }
  state.tasks = state.tasks.map((task) => task.id === id ? data : task);
  showToast('Задача выполнена.');
  renderApp();
}

async function openReport(path) {
  const { data, error } = await state.supabase.storage.from('lead-reports').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    showToast(error?.message || 'Не удалось открыть файл.', true);
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

async function logout() {
  await state.supabase?.auth.signOut();
}

function filteredLeads() {
  const search = state.search.trim().toLowerCase();
  return state.leads.filter((lead) => {
    const matchesSearch = !search || [lead.name, lead.phone, lead.email, lead.city_or_address, lead.lead_number]
      .some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = state.status === 'all' || lead.status === state.status;
    const matchesSource = state.source === 'all' || lead.source_type === state.source;
    return matchesSearch && matchesStatus && matchesSource;
  });
}

function calculateStats(leads) {
  return {
    total: leads.length,
    completed: leads.filter((lead) => lead.status === 'completed').length,
    started: leads.filter((lead) => lead.status === 'started').length,
    abandoned: leads.filter((lead) => lead.status === 'abandoned').length
  };
}

function statusFilterOptions() {
  return `<option value="all">Все статусы</option>${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`).join('')}`;
}

function statusEditOptions(current) {
  return Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
}

function sourceFilterOptions() {
  const sources = [...new Set(state.leads.map((lead) => lead.source_type).filter(Boolean))].sort();
  return `<option value="all">Все источники</option>${sources.map((source) => `<option value="${escapeAttribute(source)}" ${state.source === source ? 'selected' : ''}>${escapeHtml(source)}</option>`).join('')}`;
}

function exportCsv() {
  const columns = exportColumns();
  const rows = filteredLeads().map((lead) => columns.map((column) => csvCell(column.value(lead))).join(','));
  const csv = `\ufeff${columns.map((column) => csvCell(column.label)).join(',')}\n${rows.join('\n')}`;
  downloadBlob(csv, `solatrix-leads-${today()}.csv`, 'text/csv;charset=utf-8');
}

function exportExcel() {
  const columns = exportColumns();
  const rows = filteredLeads();
  const xmlRows = [
    columns.map((column) => excelCell(column.label)).join(''),
    ...rows.map((lead) => columns.map((column) => excelCell(column.value(lead))).join(''))
  ].map((cells) => `<Row>${cells}</Row>`).join('');
  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Leads"><Table>${xmlRows}</Table></Worksheet>
    </Workbook>`;
  downloadBlob(workbook, `solatrix-leads-${today()}.xls`, 'application/vnd.ms-excel;charset=utf-8');
}

function exportColumns() {
  return [
    { label: 'Номер', value: (lead) => lead.lead_number },
    { label: 'Дата', value: (lead) => lead.created_at },
    { label: 'Статус', value: (lead) => STATUS_LABELS[lead.status] || lead.status },
    { label: 'Имя', value: (lead) => lead.name },
    { label: 'Телефон', value: (lead) => lead.phone },
    { label: 'Email', value: (lead) => lead.email },
    { label: 'Адрес', value: (lead) => lead.city_or_address },
    { label: 'Тип объекта', value: (lead) => lead.property_type },
    { label: 'Счёт', value: (lead) => lead.monthly_bill },
    { label: 'Источник', value: (lead) => lead.source_type },
    { label: 'UTM source', value: (lead) => lead.utm_source },
    { label: 'UTM campaign', value: (lead) => lead.utm_campaign },
    { label: 'Следующий контакт', value: (lead) => lead.next_follow_up_at },
    { label: 'Шаг калькулятора', value: (lead) => lead.calculator_step },
    { label: 'Последняя активность', value: (lead) => lead.last_activity_at },
    { label: 'Заметки', value: (lead) => lead.internal_notes }
  ];
}

function infoCell(label, value, href = '') {
  const display = escapeHtml(value || '—');
  return `<div class="crmInfo"><span>${escapeHtml(label)}</span>${href ? `<a href="${escapeAttribute(href)}">${display}</a>` : `<b>${display}</b>`}</div>`;
}

function authBrand() {
  return '<div class="crmAuthBrand"><span class="crmAuthMark">S</span><span><b>Solatrix CRM</b><span>Закрытая клиентская база</span></span></div>';
}

function showToast(message, error = false) {
  state.toast = { message, error };
  renderApp();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    state.toast = null;
    renderApp();
  }, 3200);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function excelCell(value) {
  return `<Cell><Data ss:Type="String">${escapeXml(value ?? '')}</Data></Cell>`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeXml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;'
  })[character]);
}
