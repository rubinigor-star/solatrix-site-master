import '../styles.css';

const REPO_BASE = window.location.hostname.endsWith('github.io') ? '/solatrix-site-master' : '';
const HOME = `${REPO_BASE}/`;
const BASE = `${REPO_BASE}/roof-check`;
const LOGO = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_298,h_194,al_c,q_90,enc_avif,quality_auto/Solatrix%20Logo%20Sait%20Main.png';

const routes = ['', 'address', 'roof-type', 'roof-marking', 'obstacles', 'analysis', 'report'];
const state = { step: 0, address: '', monthlyBill: 850, roofType: 'flat', points: [], obstacles: [] };

function stepFromPath() {
  const path = location.pathname.replace(/\/$/, '');
  const index = routes.findIndex((route) => route && path.endsWith(`/${route}`));
  return index > 0 ? index : 0;
}

state.step = stepFromPath();

function routeUrl(step) {
  return routes[step] ? `${BASE}/${routes[step]}` : `${BASE}/`;
}

function go(step) {
  state.step = Math.max(0, Math.min(routes.length - 1, Number(step)));
  history.pushState({ step: state.step }, '', routeUrl(state.step));
  render();
  if (state.step === 5) setTimeout(() => go(6), 900);
}

function header() {
  return `<header class="siteHeader"><div class="headerInner"><a class="brand" href="${HOME}" aria-label="Solatrix Energy דף הבית"><div class="logoMark"><img class="logoImage" src="${LOGO}" alt="Solatrix Energy"></div></a><div class="headerActions"><a class="headerCta" href="https://wa.me/972547299727" target="_blank" rel="noreferrer">WhatsApp</a></div></div></header>`;
}

function actions(label) {
  return `<div class="actions"><button class="primaryBtn" data-next>${label}</button>${state.step > 1 ? '<button class="ghostBtn" data-prev>חזרה</button>' : ''}</div>`;
}

function screen() {
  if (state.step === 0) return `<section class="screen heroScreen"><div class="heroGrid"><div class="card centerCard heroCard"><div class="eyebrow">Roof Check by Solatrix</div><h1>בדיקת גג סולארית</h1><p class="heroText">תוך דקה מקבלים הערכה ראשונית.</p><div class="featureChips"><span>☀️ חישוב מהיר</span><span>📍 לפי כתובת</span><span>📄 דוח PDF מלא</span></div><button class="primaryBtn large" data-next>התחילו בדיקת גג</button></div><div class="visualCard"><div class="miniRoof"><div class="roofTop"></div><div class="panelRows"><span></span><span></span><span></span><span></span></div></div></div></div></section>`;
  if (state.step === 1) return `<section class="screen"><div class="card focusCard"><div class="screenIcon">📍</div><h2>כתובת וחשבון חשמל</h2><div class="fieldGroup"><label>כתובת הגג</label><input data-field="address" value="${state.address}" placeholder="לדוגמה: החרמון 10, חיפה"></div><div class="fieldGroup"><label>חשבון חשמל חודשי</label><input data-field="monthlyBill" value="${state.monthlyBill}" inputmode="numeric"></div>${actions('מצא את הגג')}</div></section>`;
  if (state.step === 2) return `<section class="screen"><div class="card focusCard"><div class="screenIcon">🏠</div><h2>איזה סוג גג?</h2><div class="roofOptions"><button class="roofOption ${state.roofType === 'flat' ? 'selected' : ''}" data-roof="flat"><span>▰</span><b>גג שטוח</b><small>עד 22.5 kW ביתי</small></button><button class="roofOption ${state.roofType === 'sloped' ? 'selected' : ''}" data-roof="sloped"><span>◭</span><b>כמה צדדים</b><small>נסמן כל צד</small></button><button class="roofOption ${state.roofType === 'commercial' ? 'selected' : ''}" data-roof="commercial"><span>▦</span><b>גג מסחרי</b><small>ללא מגבלת 22.5</small></button></div>${actions('המשך לסימון')}</div></section>`;
  if (state.step === 3) return `<section class="screen mapScreen"><div class="card mapCard"><div class="screenIcon">✏️</div><h2>סמנו את שטח הגג</h2><p class="subText">לחצו על פינות הגג לפי הסדר. כל לחיצה מוסיפה נקודה קטנה וקו כחול.</p><div class="mapPanel interactiveMap" data-map><svg class="roofCanvas" viewBox="0 0 100 100"><rect width="100" height="100" class="mapBase"></rect><path class="building" d="M12 14 L86 9 L92 82 L18 90 Z"></path><polyline class="draftLine" points="${state.points.map(p => `${p.x},${p.y}`).join(' ')}"></polyline>${state.points.map((p, i) => `<g class="draftPoint"><circle cx="${p.x}" cy="${p.y}" r="3"></circle><text x="${p.x}" y="${p.y - 4}" text-anchor="middle">${i + 1}</text></g>`).join('')}</svg></div><div class="markStatus">${state.points.length ? `סומנו ${state.points.length} נקודות` : 'לחצו על פינות הגג כדי להתחיל סימון.'}</div>${actions('סיימתי')}</div></section>`;
  if (state.step === 4) return `<section class="screen mapScreen"><div class="card mapCard"><div class="screenIcon">🧩</div><h2>מה נמצא על הגג?</h2><div class="obstacleGrid">${[['ac','מזגן','❄️'],['boiler','דוד','💧'],['shade','צל','🌳'],['access','יציאה לגג','🚪'],['solar','קולטים קיימים','☀️']].map(([key,label,icon]) => `<button class="obstacle ${state.obstacles.includes(key) ? 'selected' : ''}" data-obstacle="${key}"><span>${icon}</span>${label}</button>`).join('')}</div>${actions('המשך')}</div></section>`;
  if (state.step === 5) return `<section class="screen"><div class="card centerCard analysisCard"><div class="loader"></div><h2>מנתחים את הגג...</h2><p class="subText">בודקים שטח, ייצור, תעריף משולב ו-ROI.</p></div></section>`;
  const monthly = Number(state.monthlyBill || 850);
  const system = state.roofType === 'commercial' ? 42 : 15;
  const annual = Math.round(system * 1650);
  const savings = Math.round(annual * .52);
  return `<section class="screen reportScreen"><div class="card reportCard"><div class="eyebrow">דוח סולארי ראשוני</div><h2>הגג מתאים למערכת של כ-${system.toFixed(1)} kW</h2><div class="reportHeroGraphic"><div><strong>₪${savings.toLocaleString('he-IL')}</strong><span>חיסכון שנתי</span></div><div><strong>${Math.max(4.5, (system * 2900 * 1.18 / savings)).toFixed(1)}</strong><span>החזר כולל מע״מ</span></div></div><div class="resultsGrid"><div><span>ייצור שנתי</span><b>${annual.toLocaleString('he-IL')} kWh</b></div><div><span>חשבון חודשי</span><b>₪${monthly.toLocaleString('he-IL')}</b></div></div><a class="primaryBtn large" href="https://wa.me/972547299727" target="_blank" rel="noreferrer">קבלו דוח PDF מלא</a></div></section>`;
}

function render() {
  const root = document.getElementById('root');
  root.innerHTML = `${header()}<main class="appShell">${screen()}</main>`;
  root.querySelector('[data-next]')?.addEventListener('click', () => go(state.step + 1));
  root.querySelector('[data-prev]')?.addEventListener('click', () => go(state.step - 1));
  root.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', () => { state[input.dataset.field] = input.value; }));
  root.querySelectorAll('[data-roof]').forEach(button => button.addEventListener('click', () => { state.roofType = button.dataset.roof; render(); }));
  root.querySelectorAll('[data-obstacle]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.obstacle; state.obstacles = state.obstacles.includes(key) ? state.obstacles.filter(v => v !== key) : [...state.obstacles, key]; render(); }));
  root.querySelector('[data-map]')?.addEventListener('click', event => { const rect = event.currentTarget.getBoundingClientRect(); state.points.push({ x: ((event.clientX - rect.left) / rect.width * 100).toFixed(1), y: ((event.clientY - rect.top) / rect.height * 100).toFixed(1) }); render(); });
}

addEventListener('popstate', () => { state.step = stepFromPath(); render(); });
render();