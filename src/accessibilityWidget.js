const STORAGE_KEY='solatrix-accessibility-v1';
const DEFAULTS={fontScale:1,contrast:false,links:false,motion:false};
let state={...DEFAULTS};
try{state={...DEFAULTS,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{}
state.links=false;

const style=document.createElement('style');
style.textContent=`
:root{--solatrix-a11y-scale:1}
html{font-size:calc(100% * var(--solatrix-a11y-scale))}
html.solatrix-a11y-contrast{filter:contrast(1.28)}
html.solatrix-a11y-contrast body{background:#fff!important;color:#000!important}
html.solatrix-a11y-contrast a,html.solatrix-a11y-contrast button{outline-color:#000!important}
html.solatrix-a11y-links a{outline:2px solid currentColor!important;outline-offset:3px!important;text-decoration:none!important}
html:not(.solatrix-a11y-links) a,html:not(.solatrix-a11y-links) a:hover,html:not(.solatrix-a11y-links) a:focus{text-decoration:none!important}
html.solatrix-a11y-motion *,html.solatrix-a11y-motion *::before,html.solatrix-a11y-motion *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}
.solatrix-a11y-trigger{position:fixed;left:18px;bottom:18px;z-index:99998;width:54px;height:54px;border:0;border-radius:50%;display:grid;place-items:center;background:transparent!important;color:#0a2f4a;box-shadow:none!important;font-size:27px;cursor:pointer;padding:0}
.solatrix-a11y-trigger:focus-visible,.solatrix-a11y-panel button:focus-visible{outline:3px solid #ffbf54;outline-offset:3px}
.solatrix-a11y-panel{position:fixed;left:18px;bottom:82px;z-index:99999;width:min(310px,calc(100vw - 36px));padding:18px;border-radius:20px;background:#fff;color:#17212b;box-shadow:0 20px 60px rgba(0,0,0,.3);border:1px solid rgba(0,0,0,.12);font-family:Assistant,Arial,sans-serif;direction:rtl;display:none}
.solatrix-a11y-panel[data-open="true"]{display:block}
.solatrix-a11y-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.solatrix-a11y-head strong{font-size:20px}.solatrix-a11y-close{border:0;background:transparent;font-size:24px;cursor:pointer}
.solatrix-a11y-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.solatrix-a11y-panel button{min-height:48px;border:1px solid #d8dee5;border-radius:13px;background:#f7f9fb;color:#17212b;font:inherit;font-weight:800;cursor:pointer;padding:9px}.solatrix-a11y-panel button[aria-pressed="true"]{background:#0a2f4a;color:#fff;border-color:#0a2f4a}.solatrix-a11y-reset{grid-column:1/-1;background:#fff4dc!important;color:#5b3a00!important;border-color:#f0c56d!important}
@media(max-width:600px){.solatrix-a11y-trigger{left:14px;bottom:14px}.solatrix-a11y-panel{left:14px;bottom:76px;width:calc(100vw - 28px)}}`;
document.head.appendChild(style);

const panel=document.createElement('section');
panel.className='solatrix-a11y-panel';
panel.id='solatrix-a11y-panel';
panel.setAttribute('role','dialog');
panel.setAttribute('aria-modal','false');
panel.setAttribute('aria-label','אפשרויות נגישות');
panel.dataset.open='false';
panel.innerHTML=`<div class="solatrix-a11y-head"><strong>אפשרויות נגישות</strong><button class="solatrix-a11y-close" type="button" aria-label="סגירה">×</button></div><div class="solatrix-a11y-grid"><button type="button" data-action="font-down">הקטנת טקסט</button><button type="button" data-action="font-up">הגדלת טקסט</button><button type="button" data-toggle="contrast" aria-pressed="false">ניגודיות גבוהה</button><button type="button" data-toggle="links" aria-pressed="false">הדגשת קישורים</button><button type="button" data-toggle="motion" aria-pressed="false">עצירת אנימציות</button><button type="button" class="solatrix-a11y-reset" data-action="reset">איפוס הגדרות</button></div>`;

const trigger=document.createElement('button');
trigger.type='button';
trigger.className='solatrix-a11y-trigger';
trigger.setAttribute('aria-label','פתיחת אפשרויות נגישות');
trigger.setAttribute('aria-controls',panel.id);
trigger.setAttribute('aria-expanded','false');
trigger.textContent='♿';

document.body.append(panel,trigger);

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function apply(){
 document.documentElement.style.setProperty('--solatrix-a11y-scale',String(state.fontScale));
 document.documentElement.classList.toggle('solatrix-a11y-contrast',state.contrast);
 document.documentElement.classList.toggle('solatrix-a11y-links',state.links);
 document.documentElement.classList.toggle('solatrix-a11y-motion',state.motion);
 panel.querySelector('[data-toggle="contrast"]').setAttribute('aria-pressed',String(state.contrast));
 panel.querySelector('[data-toggle="links"]').setAttribute('aria-pressed',String(state.links));
 panel.querySelector('[data-toggle="motion"]').setAttribute('aria-pressed',String(state.motion));
 save();
}
function setOpen(open){panel.dataset.open=String(open);trigger.setAttribute('aria-expanded',String(open));if(open)panel.querySelector('.solatrix-a11y-close').focus();else trigger.focus()}
trigger.addEventListener('click',()=>setOpen(panel.dataset.open!=='true'));
panel.querySelector('.solatrix-a11y-close').addEventListener('click',()=>setOpen(false));
panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const toggle=b.dataset.toggle;if(toggle){state[toggle]=!state[toggle];apply();return}switch(b.dataset.action){case'font-up':state.fontScale=Math.min(1.3,Math.round((state.fontScale+.1)*10)/10);break;case'font-down':state.fontScale=Math.max(.9,Math.round((state.fontScale-.1)*10)/10);break;case'reset':state={...DEFAULTS};break;default:return}apply()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.dataset.open==='true')setOpen(false)});
apply();