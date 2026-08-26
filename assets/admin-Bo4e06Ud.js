import"./preload-helper-C6XEuiEO.js";import{n as e}from"./roofGeometry-ChKfTo8G.js";import{n as t,t as n}from"./supabaseClient-BrGzaSkb.js";var r=document.getElementById(`admin-root`),i={completed:`Completed`,started:`In Progress`,abandoned:`Abandoned`,contacted:`Contacted`,qualified:`Qualified`,lost:`Lost`},a={supabase:null,session:null,profile:null,leads:[],selectedLead:null,reports:[],tasks:[],events:[],search:``,status:`all`,source:`all`,loading:!1,toast:null};o();async function o(){if(!t()){c();return}a.supabase=n();let{data:e}=await a.supabase.auth.getSession();await s(e.session),a.supabase.auth.onAuthStateChange(async(e,t)=>{await s(t)})}async function s(e){if(a.session=e,a.profile=null,a.selectedLead=null,!e){l();return}let{data:t,error:n}=await a.supabase.from(`profiles`).select(`*`).eq(`id`,e.user.id).single();if(n||!t?.is_active){d(e.user.email,n?.message);return}a.profile=t,await f()}function c(){r.innerHTML=`
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${P()}
        <h1>CRM ещё не подключена</h1>
        <p>Интерфейс уже подготовлен, но для входа нужны публичные параметры проекта Supabase.</p>
        <code class="crmSetupCode">VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co\nVITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY</code>
        <p style="margin-top:18px">Инструкция находится в <b>docs/SUPABASE_SETUP.md</b>.</p>
        <a class="crmSecondary" href="./index.html" style="display:inline-flex">Вернуться на сайт</a>
      </section>
    </main>`}function l(e=``){r.innerHTML=`
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${P()}
        <h1>Вход в CRM</h1>
        <p>Используйте email и пароль, созданные для вашего аккаунта Solatrix.</p>
        <form data-login-form>
          <label class="crmField">Email<input name="email" type="email" autocomplete="username" required /></label>
          <label class="crmField">Пароль<input name="password" type="password" autocomplete="current-password" required /></label>
          <div class="crmFormError" data-login-error ${e?``:`hidden`}>${G(e)}</div>
          <button class="crmPrimary" type="submit" style="width:100%;margin-top:14px">Войти</button>
        </form>
      </section>
    </main>`,r.querySelector(`[data-login-form]`)?.addEventListener(`submit`,u)}async function u(e){e.preventDefault();let t=e.currentTarget,n=t.querySelector(`button`),r=t.querySelector(`[data-login-error]`),i=Object.fromEntries(new FormData(t).entries());n.disabled=!0,n.textContent=`Входим...`,r.hidden=!0;let{error:o}=await a.supabase.auth.signInWithPassword({email:String(i.email||``).trim(),password:String(i.password||``)});o&&(r.textContent=`Неверный email или пароль.`,r.hidden=!1,n.disabled=!1,n.textContent=`Войти`)}function d(e,t=``){r.innerHTML=`
    <main class="crmCentered">
      <section class="crmAuthCard">
        ${P()}
        <h1>Нет доступа</h1>
        <p>Аккаунт <b>${G(e||``)}</b> существует, но не активирован для CRM.</p>
        ${t?`<div class="crmFormError">${G(t)}</div>`:``}
        <button class="crmSecondary" data-action="logout" style="margin-top:16px">Выйти</button>
      </section>
    </main>`,r.querySelector(`[data-action="logout"]`)?.addEventListener(`click`,E)}async function f(){a.loading=!0,p();let{data:e,error:t}=await a.supabase.from(`leads`).select(`*`).is(`archived_at`,null).order(`created_at`,{ascending:!1}).limit(2e3);a.loading=!1,t?(F(`Не удалось загрузить лиды: ${t.message}`,!0),a.leads=[]):a.leads=e||[],p()}function p(){if(!a.profile)return;let e=D(),t=O(a.leads);r.innerHTML=`
    <div class="crmApp">
      <header class="crmTopbar">
        <a class="crmBrand" href="./index.html">
          <span class="crmBrandMark">S</span>
          <span><b>Solatrix CRM</b><small>Клиенты и Roof Check</small></span>
        </a>
        <div class="crmUser">
          <div class="crmUserText"><b>${G(a.profile.full_name||a.session?.user?.email||``)}</b><span>${G(a.profile.role)}</span></div>
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
          <div class="crmStat"><span>Всего активных</span><b>${t.total}</b></div>
          <div class="crmStat"><span>Completed</span><b>${t.completed}</b></div>
          <div class="crmStat"><span>In Progress</span><b>${t.started}</b></div>
          <div class="crmStat"><span>Abandoned</span><b>${t.abandoned}</b></div>
        </section>

        <section class="crmPanel">
          <div class="crmFilters">
            <input data-filter="search" value="${K(a.search)}" placeholder="Поиск по имени, телефону, email или адресу" />
            <select data-filter="status">${k()}</select>
            <select data-filter="source">${te()}</select>
          </div>
          ${a.loading?`<div class="crmLoading">Загружаем клиентскую базу...</div>`:m(e)}
        </section>
      </main>
    </div>
    ${a.selectedLead?h(a.selectedLead):``}
    ${a.toast?`<div class="crmToast${a.toast.error?` error`:``}">${G(a.toast.message)}</div>`:``}`,y()}function m(e){return e.length?`
    <div class="crmTableWrap">
      <table class="crmTable">
        <thead><tr><th>№ / дата</th><th>Клиент</th><th>Контакты</th><th>Объект</th><th>Источник</th><th>Статус</th><th>Следующий контакт</th></tr></thead>
        <tbody>${e.map(e=>`
          <tr data-lead-id="${e.id}">
            <td><b>#${e.lead_number||`—`}</b><span class="crmLeadMeta">${B(e.created_at)}</span></td>
            <td><span class="crmLeadName">${G(e.name)}</span><span class="crmLeadMeta">${G(e.city_or_address||``)}</span></td>
            <td>${G(e.phone)}<span class="crmLeadMeta">${G(e.email||``)}</span></td>
            <td>${G(e.property_type||`—`)}<span class="crmLeadMeta">${e.monthly_bill?`₪${U(e.monthly_bill)}/мес.`:``}</span></td>
            <td><span class="crmSource">${G(e.source_type||`site-form`)}</span></td>
            <td><span class="crmStatus" data-status="${K(e.status)}">${G(i[e.status]||e.status)}</span></td>
            <td>${e.next_follow_up_at?V(e.next_follow_up_at):`—`}</td>
          </tr>`).join(``)}</tbody>
      </table>
    </div>`:`<div class="crmEmpty">По выбранным фильтрам лидов нет.</div>`}function h(t){let n=[`admin`,`manager`].includes(a.profile.role),r=Array.isArray(t.tags)?t.tags.join(`, `):``,i=t.metadata?.roofGeometry||null;return`
    <div class="crmDrawerBackdrop" data-action="close-drawer"></div>
    <aside class="crmDrawer" aria-label="Карточка клиента">
      <header class="crmDrawerHead">
        <div><h2>${G(t.name)}</h2><p>Лид #${t.lead_number||`—`} · ${V(t.created_at)}</p></div>
        <button class="crmIconButton" data-action="close-drawer" aria-label="Закрыть">×</button>
      </header>
      <div class="crmDrawerBody">
        <section class="crmDrawerSection">
          <h3>Контактные данные</h3>
          <div class="crmInfoGrid">
            ${N(`Телефон`,t.phone,`tel:${t.phone}`)}
            ${N(`Email`,t.email||`—`,t.email?`mailto:${t.email}`:``)}
            ${N(`Адрес`,t.city_or_address||`—`)}
            ${N(`Объект`,t.property_type||`—`)}
            ${N(`Счёт за электричество`,t.monthly_bill?`₪${U(t.monthly_bill)}`:`—`)}
            ${N(`Удобное время`,t.preferred_contact_time||`—`)}
            ${N(`Шаг калькулятора`,t.calculator_step||`—`)}
            ${N(`Последняя активность`,V(t.last_activity_at))}
          </div>
          <div class="crmQuickActions">
            <a href="tel:${K(t.phone)}">Позвонить</a>
            <a class="whatsapp" href="https://wa.me/${z(t.phone)}" target="_blank" rel="noreferrer">WhatsApp</a>
            ${t.email?`<a href="mailto:${K(t.email)}">Email</a>`:``}
          </div>
        </section>

        <section class="crmDrawerSection">
          <h3>Карта и геометрия крыши</h3>
          <div class="crmInfoGrid">
            ${N(`Площадь`,i?.areaM2?`${U(i.areaM2)} м²`:`—`)}
            ${N(`Координаты`,e(i)||`—`)}
            ${N(`Провайдер карты`,i?.provider||`—`)}
            ${N(`Полигонов`,i?.geojson?.features?.length||`—`)}
          </div>
          ${i?.geojson?`<details style="margin-top:12px"><summary>GeoJSON</summary><pre class="crmJson">${G(JSON.stringify(i.geojson,null,2))}</pre></details>`:``}
        </section>

        <section class="crmDrawerSection">
          <h3>Работа с лидом</h3>
          <form data-lead-edit-form>
            <div class="crmDetailGrid">
              <label class="crmField">Статус<select name="status" ${n?``:`disabled`}>${ee(t.status)}</select></label>
              <label class="crmField">Следующий контакт<input name="next_follow_up_at" type="datetime-local" value="${H(t.next_follow_up_at)}" ${n?``:`disabled`} /></label>
              <label class="crmField wide">Теги через запятую<input name="tags" value="${K(r)}" ${n?``:`disabled`} /></label>
              <label class="crmField wide">Внутренние заметки<textarea name="internal_notes" rows="5" ${n?``:`disabled`}>${G(t.internal_notes||``)}</textarea></label>
              <label class="crmField wide">Причина отказа<textarea name="lost_reason" rows="2" ${n?``:`disabled`}>${G(t.lost_reason||``)}</textarea></label>
            </div>
            ${n?`<div class="crmSaveRow"><button class="crmPrimary" type="submit">Сохранить</button></div>`:``}
          </form>
        </section>

        <section class="crmDrawerSection">
          <h3>Сообщение клиента</h3>
          <p style="white-space:pre-wrap;margin:0;color:var(--crm-muted)">${G(t.message||`Нет сообщения`)}</p>
        </section>

        <section class="crmDrawerSection">
          <h3>Отчёты Roof Check</h3>
          ${g()}
        </section>

        <section class="crmDrawerSection">
          <h3>Задачи</h3>
          ${v(n)}
        </section>

        <section class="crmDrawerSection">
          <h3>История lead_events</h3>
          ${_()}
        </section>

        <section class="crmDrawerSection">
          <h3>Источник</h3>
          <div class="crmInfoGrid">
            ${N(`Тип`,t.source_type||`—`)}
            ${N(`Страница`,t.source_page||`—`)}
            ${N(`UTM campaign`,t.utm_campaign||`—`)}
            ${N(`UTM source`,t.utm_source||`—`)}
          </div>
        </section>
      </div>
    </aside>`}function g(){return a.reports.length?`<div class="crmReportList">${a.reports.map(e=>`
    <div class="crmReport">
      <div class="crmReportHead"><b>${G(e.report_type||`roof-check`)}</b><small>${V(e.created_at)}</small></div>
      ${e.storage_path?`<button class="crmSecondary" data-action="open-report" data-report-path="${K(e.storage_path)}" style="margin-top:9px">Открыть PDF</button>`:``}
      <details style="margin-top:9px"><summary>Данные расчёта</summary><pre class="crmJson">${G(JSON.stringify(e.calculation||{},null,2))}</pre></details>
    </div>`).join(``)}</div>`:`<p style="margin:0;color:var(--crm-muted)">Отчётов пока нет.</p>`}function _(){return a.events.length?`<div class="crmEventList">${a.events.map(e=>`
    <div class="crmEvent">
      <div class="crmEventHead"><b>${G(e.event_type)}</b><small>${V(e.created_at)}</small></div>
      ${e.payload&&Object.keys(e.payload).length?`<pre class="crmJson">${G(JSON.stringify(e.payload,null,2))}</pre>`:``}
    </div>`).join(``)}</div>`:`<p style="margin:0;color:var(--crm-muted)">Событий пока нет.</p>`}function v(e){let t=a.tasks.length?`<div class="crmTaskList">${a.tasks.map(t=>`
        <div class="crmTask${t.status===`completed`?` crmTaskDone`:``}">
          <div class="crmTaskHead"><b>${G(t.title)}</b><small>${t.due_at?V(t.due_at):`Без срока`}</small></div>
          ${t.description?`<p style="margin:7px 0 0;color:var(--crm-muted);font-size:12px">${G(t.description)}</p>`:``}
          ${e&&t.status===`open`?`<button class="crmSecondary" data-action="complete-task" data-task-id="${t.id}" style="margin-top:9px">Выполнено</button>`:``}
        </div>`).join(``)}</div>`:`<p style="margin:0;color:var(--crm-muted)">Задач пока нет.</p>`;return e?`${t}
    <form class="crmTaskForm" data-task-form>
      <input name="title" placeholder="Новая задача" required />
      <input name="due_at" type="datetime-local" />
      <button class="crmPrimary" type="submit">Добавить</button>
    </form>`:t}function y(){r.querySelectorAll(`[data-action="logout"]`).forEach(e=>e.addEventListener(`click`,E)),r.querySelector(`[data-action="refresh"]`)?.addEventListener(`click`,f),r.querySelector(`[data-action="export-csv"]`)?.addEventListener(`click`,A),r.querySelector(`[data-action="export-excel"]`)?.addEventListener(`click`,j),r.querySelectorAll(`[data-lead-id]`).forEach(e=>e.addEventListener(`click`,()=>b(e.dataset.leadId))),r.querySelectorAll(`[data-action="close-drawer"]`).forEach(e=>e.addEventListener(`click`,x)),r.querySelector(`[data-lead-edit-form]`)?.addEventListener(`submit`,S),r.querySelector(`[data-task-form]`)?.addEventListener(`submit`,C),r.querySelectorAll(`[data-action="complete-task"]`).forEach(e=>e.addEventListener(`click`,()=>w(e.dataset.taskId))),r.querySelectorAll(`[data-action="open-report"]`).forEach(e=>e.addEventListener(`click`,()=>T(e.dataset.reportPath))),r.querySelector(`[data-filter="search"]`)?.addEventListener(`input`,e=>{a.search=e.target.value,p(),requestAnimationFrame(()=>{let e=r.querySelector(`[data-filter="search"]`);e?.focus(),e?.setSelectionRange(a.search.length,a.search.length)})}),r.querySelector(`[data-filter="status"]`)?.addEventListener(`change`,e=>{a.status=e.target.value,p()}),r.querySelector(`[data-filter="source"]`)?.addEventListener(`change`,e=>{a.source=e.target.value,p()})}async function b(e){if(a.selectedLead=a.leads.find(t=>t.id===e)||null,a.reports=[],a.tasks=[],a.events=[],p(),!a.selectedLead)return;let[t,n,r]=await Promise.all([a.supabase.from(`reports`).select(`*`).eq(`lead_id`,e).order(`created_at`,{ascending:!1}),a.supabase.from(`tasks`).select(`*`).eq(`lead_id`,e).order(`created_at`,{ascending:!1}),a.supabase.from(`lead_events`).select(`*`).eq(`lead_id`,e).order(`created_at`,{ascending:!1})]);a.reports=t.data||[],a.tasks=n.data||[],a.events=r.data||[],t.error&&F(t.error.message,!0),n.error&&F(n.error.message,!0),r.error&&F(r.error.message,!0),p()}function x(){a.selectedLead=null,a.reports=[],a.tasks=[],a.events=[],p()}async function S(e){if(e.preventDefault(),!a.selectedLead)return;let t=e.currentTarget,n=Object.fromEntries(new FormData(t).entries()),r=String(n.tags||``).split(`,`).map(e=>e.trim()).filter(Boolean),i={status:n.status,next_follow_up_at:n.next_follow_up_at?new Date(n.next_follow_up_at).toISOString():null,internal_notes:String(n.internal_notes||``).trim()||null,lost_reason:String(n.lost_reason||``).trim()||null,tags:r,last_contacted_at:[`contacted`,`qualified`].includes(n.status)?new Date().toISOString():a.selectedLead.last_contacted_at,completed_at:n.status===`completed`?a.selectedLead.completed_at||new Date().toISOString():a.selectedLead.completed_at,abandoned_at:n.status===`abandoned`?a.selectedLead.abandoned_at||new Date().toISOString():n.status===`started`?null:a.selectedLead.abandoned_at},{data:o,error:s}=await a.supabase.from(`leads`).update(i).eq(`id`,a.selectedLead.id).select(`*`).single();if(s){F(`Не удалось сохранить: ${s.message}`,!0);return}let c={lead_id:o.id,actor_id:a.profile.id,event_type:a.selectedLead.status===o.status?`lead_updated`:`lead_status_changed`,payload:{...i,previousStatus:a.selectedLead.status}},{data:l}=await a.supabase.from(`lead_events`).insert(c).select(`*`).single();a.leads=a.leads.map(e=>e.id===o.id?o:e),a.selectedLead=o,l&&(a.events=[l,...a.events]),F(`Карточка сохранена.`),p()}async function C(e){if(e.preventDefault(),!a.selectedLead)return;let t=e.currentTarget,n=Object.fromEntries(new FormData(t).entries()),r=String(n.title||``).trim();if(!r)return;let{data:i,error:o}=await a.supabase.from(`tasks`).insert({lead_id:a.selectedLead.id,assigned_to:a.profile.id,title:r,due_at:n.due_at?new Date(n.due_at).toISOString():null}).select(`*`).single();if(o){F(`Не удалось добавить задачу: ${o.message}`,!0);return}a.tasks=[i,...a.tasks],F(`Задача добавлена.`),p()}async function w(e){let{data:t,error:n}=await a.supabase.from(`tasks`).update({status:`completed`,completed_at:new Date().toISOString()}).eq(`id`,e).select(`*`).single();if(n){F(n.message,!0);return}a.tasks=a.tasks.map(n=>n.id===e?t:n),F(`Задача выполнена.`),p()}async function T(e){let{data:t,error:n}=await a.supabase.storage.from(`lead-reports`).createSignedUrl(e,60);if(n||!t?.signedUrl){F(n?.message||`Не удалось открыть файл.`,!0);return}window.open(t.signedUrl,`_blank`,`noopener,noreferrer`)}async function E(){await a.supabase?.auth.signOut()}function D(){let e=a.search.trim().toLowerCase();return a.leads.filter(t=>{let n=!e||[t.name,t.phone,t.email,t.city_or_address,t.lead_number].some(t=>String(t||``).toLowerCase().includes(e)),r=a.status===`all`||t.status===a.status,i=a.source===`all`||t.source_type===a.source;return n&&r&&i})}function O(e){return{total:e.length,completed:e.filter(e=>e.status===`completed`).length,started:e.filter(e=>e.status===`started`).length,abandoned:e.filter(e=>e.status===`abandoned`).length}}function k(){return`<option value="all">Все статусы</option>${Object.entries(i).map(([e,t])=>`<option value="${e}" ${a.status===e?`selected`:``}>${t}</option>`).join(``)}`}function ee(e){return Object.entries(i).map(([t,n])=>`<option value="${t}" ${e===t?`selected`:``}>${n}</option>`).join(``)}function te(){return`<option value="all">Все источники</option>${[...new Set(a.leads.map(e=>e.source_type).filter(Boolean))].sort().map(e=>`<option value="${K(e)}" ${a.source===e?`selected`:``}>${G(e)}</option>`).join(``)}`}function A(){let e=M(),t=D().map(t=>e.map(e=>L(e.value(t))).join(`,`));I(`\ufeff${e.map(e=>L(e.label)).join(`,`)}\n${t.join(`
`)}`,`solatrix-leads-${W()}.csv`,`text/csv;charset=utf-8`)}function j(){let e=M(),t=D();I(`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Leads"><Table>${[e.map(e=>R(e.label)).join(``),...t.map(t=>e.map(e=>R(e.value(t))).join(``))].map(e=>`<Row>${e}</Row>`).join(``)}</Table></Worksheet>
    </Workbook>`,`solatrix-leads-${W()}.xls`,`application/vnd.ms-excel;charset=utf-8`)}function M(){return[{label:`Номер`,value:e=>e.lead_number},{label:`Дата`,value:e=>e.created_at},{label:`Статус`,value:e=>i[e.status]||e.status},{label:`Имя`,value:e=>e.name},{label:`Телефон`,value:e=>e.phone},{label:`Email`,value:e=>e.email},{label:`Адрес`,value:e=>e.city_or_address},{label:`Тип объекта`,value:e=>e.property_type},{label:`Счёт`,value:e=>e.monthly_bill},{label:`Источник`,value:e=>e.source_type},{label:`UTM source`,value:e=>e.utm_source},{label:`UTM campaign`,value:e=>e.utm_campaign},{label:`Следующий контакт`,value:e=>e.next_follow_up_at},{label:`Шаг калькулятора`,value:e=>e.calculator_step},{label:`Последняя активность`,value:e=>e.last_activity_at},{label:`Заметки`,value:e=>e.internal_notes}]}function N(e,t,n=``){let r=G(t||`—`);return`<div class="crmInfo"><span>${G(e)}</span>${n?`<a href="${K(n)}">${r}</a>`:`<b>${r}</b>`}</div>`}function P(){return`<div class="crmAuthBrand"><span class="crmAuthMark">S</span><span><b>Solatrix CRM</b><span>Закрытая клиентская база</span></span></div>`}function F(e,t=!1){a.toast={message:e,error:t},p(),window.clearTimeout(F.timer),F.timer=window.setTimeout(()=>{a.toast=null,p()},3200)}function I(e,t,n){let r=new Blob([e],{type:n}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=t,document.body.appendChild(a),a.click(),a.remove(),URL.revokeObjectURL(i)}function L(e){return`"${String(e??``).replace(/"/g,`""`)}"`}function R(e){return`<Cell><Data ss:Type="String">${q(e??``)}</Data></Cell>`}function z(e){let t=String(e||``).replace(/\D/g,``);return t.startsWith(`0`)?`972${t.slice(1)}`:t}function B(e){return e?new Intl.DateTimeFormat(`ru-RU`,{dateStyle:`short`}).format(new Date(e)):`—`}function V(e){return e?new Intl.DateTimeFormat(`ru-RU`,{dateStyle:`short`,timeStyle:`short`}).format(new Date(e)):`—`}function H(e){if(!e)return``;let t=new Date(e),n=t.getTimezoneOffset();return new Date(t.getTime()-n*6e4).toISOString().slice(0,16)}function U(e){return Number(e||0).toLocaleString(`he-IL`,{maximumFractionDigits:2})}function W(){return new Date().toISOString().slice(0,10)}function G(e){return String(e??``).replace(/[&<>'"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,"'":`&#39;`,'"':`&quot;`})[e])}function K(e){return G(e).replace(/`/g,`&#96;`)}function q(e){return String(e??``).replace(/[&<>'"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,"'":`&apos;`,'"':`&quot;`})[e])}var J=null,Y=0;t()&&(document.addEventListener(`click`,e=>{let t=e.target.closest?.(`[data-lead-id]`);t?.dataset.leadId&&(J=t.dataset.leadId,X())},!0),new MutationObserver(()=>{J&&document.querySelector(`.crmDrawer`)&&X()}).observe(document.documentElement,{childList:!0,subtree:!0}));function X(){let e=++Y;setTimeout(()=>Z(J,e),180)}async function Z(e,t){if(!e||t!==Y||!Q())return;let{data:r,error:i}=await n().from(`reports`).select(`*`).eq(`lead_id`,e).order(`created_at`,{ascending:!1});if(t!==Y||!Q())return;let a=Q();if(i){a.insertAdjacentHTML(`beforeend`,`<p class="crmReportPatchError">Не удалось загрузить отчёты: ${$(i.message)}</p>`);return}let o=r||[];if(a.querySelectorAll(`.crmReportList, .crmReportPatchEmpty, .crmReportPatchError`).forEach(e=>e.remove()),[...a.querySelectorAll(`p`)].find(e=>e.textContent.includes(`Отчётов пока нет`))?.remove(),!o.length){a.insertAdjacentHTML(`beforeend`,`<p class="crmReportPatchEmpty">Отчётов пока нет.</p>`);return}a.insertAdjacentHTML(`beforeend`,`<div class="crmReportList crmReportPatchList">${o.map(ne).join(``)}</div>`),re()}function Q(){return[...document.querySelectorAll(`.crmDrawerSection`)].find(e=>e.querySelector(`h3`)?.textContent?.trim()===`Отчёты Roof Check`)}function ne(e){let t=e.calculation&&typeof e.calculation==`object`?e.calculation:{},n=e.roof_data&&typeof e.roof_data==`object`?e.roof_data:{},r=e.metadata&&typeof e.metadata==`object`?e.metadata:{},i=Object.entries(t).filter(([,e])=>e!==``&&e!=null),a=r.deliveryStatus===`pending_whatsapp_connection`?`Ожидает отправки в WhatsApp`:r.deliveryStatus||`Данные сохранены`;return`
    <article class="crmReport crmReportPatchCard">
      <div class="crmReportHead">
        <div><b>Roof Check</b><small>${ie(e.created_at)}</small></div>
        <span class="crmReportPatchStatus">${$(a)}</span>
      </div>
      ${i.length?`<div class="crmReportPatchMetrics">${i.map(([e,t])=>`<div><span>${$(e)}</span><b>${$(String(t))}</b></div>`).join(``)}</div>`:`<p>Расчёт сохранён без сводных показателей.</p>`}
      <div class="crmReportPatchMeta">
        <span><b>Адрес:</b> ${$(n.address||`—`)}</span>
        <span><b>WhatsApp:</b> ${$(r.recipientPhone||`—`)}</span>
      </div>
      ${e.storage_path?`<button class="crmSecondary" data-action="open-report" data-report-path="${ae(e.storage_path)}">Открыть PDF</button>`:`<div class="crmReportPatchNotice">Расчёт и запрос сохранены. Сам PDF-файл ещё не сформирован и не загружен в хранилище.</div>`}
      <details><summary>Все технические данные</summary><pre class="crmJson">${$(JSON.stringify({calculation:t,roofData:n,metadata:r},null,2))}</pre></details>
    </article>`}function re(){if(document.getElementById(`crm-report-patch-styles`))return;let e=document.createElement(`style`);e.id=`crm-report-patch-styles`,e.textContent=`
    .crmReportPatchList{display:grid;gap:12px}.crmReportPatchCard{padding:16px;border:1px solid #dbe5ec;border-radius:18px;background:#fbfdff}
    .crmReportPatchCard .crmReportHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.crmReportPatchCard .crmReportHead div{display:grid;gap:3px}
    .crmReportPatchStatus{padding:6px 9px;border-radius:999px;background:#fff2d8;color:#8a5700;font-size:11px;font-weight:800}
    .crmReportPatchMetrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:13px 0}.crmReportPatchMetrics div{padding:10px;border-radius:12px;background:white;border:1px solid #e7edf2;display:grid;gap:4px}.crmReportPatchMetrics span{font-size:11px;color:var(--crm-muted)}.crmReportPatchMetrics b{font-size:13px;word-break:break-word}
    .crmReportPatchMeta{display:grid;gap:5px;font-size:12px;color:var(--crm-muted);margin:10px 0}.crmReportPatchNotice{margin:11px 0;padding:10px 12px;border-radius:12px;background:#eef6ff;color:#315b7a;font-size:12px;line-height:1.45}.crmReportPatchCard details{margin-top:10px}.crmReportPatchEmpty,.crmReportPatchError{margin:0;color:var(--crm-muted)}.crmReportPatchError{color:#a72c2c}
    @media(max-width:620px){.crmReportPatchMetrics{grid-template-columns:1fr}.crmReportPatchCard .crmReportHead{display:grid}}
  `,document.head.appendChild(e)}function ie(e){return e?new Intl.DateTimeFormat(`ru-RU`,{dateStyle:`short`,timeStyle:`short`}).format(new Date(e)):`—`}function $(e=``){return String(e).replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e])}function ae(e=``){return $(e)}async function oe(e){let t=e.target?.closest?.(`[data-action="open-report"][data-report-path]`);if(!t||(e.preventDefault(),e.stopImmediatePropagation(),t.dataset.downloading===`true`))return;let r=t.dataset.reportPath,i=t.textContent;t.dataset.downloading=`true`,t.disabled=!0,t.textContent=`Подготавливаем PDF...`;try{let{data:e,error:a}=await n().storage.from(`lead-reports`).createSignedUrl(r,120);if(a||!e?.signedUrl)throw a||Error(`Не удалось получить ссылку на PDF.`);let o=await fetch(e.signedUrl);if(!o.ok)throw Error(`PDF download failed: ${o.status}`);let s=await o.blob(),c=URL.createObjectURL(s),l=document.createElement(`a`);l.href=c,l.download=se(r),l.style.display=`none`,document.body.appendChild(l),l.click(),l.remove(),setTimeout(()=>URL.revokeObjectURL(c),1e3),t.textContent=`PDF скачан`,setTimeout(()=>{t.textContent=i},1800)}catch(e){console.error(`Report download failed`,e),t.textContent=`Ошибка загрузки`,alert(`Не удалось скачать PDF. Обновите CRM и попробуйте ещё раз.`),setTimeout(()=>{t.textContent=i},2200)}finally{t.dataset.downloading=`false`,t.disabled=!1}}function se(e=``){let t=String(e).split(`/`).pop()||`solatrix-roof-check-${Date.now()}.pdf`;return t.toLowerCase().endsWith(`.pdf`)?t:`${t}.pdf`}document.addEventListener(`click`,oe,!0);