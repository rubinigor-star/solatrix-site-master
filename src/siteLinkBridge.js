const CALCULATOR_MASTER_VERSION='roof-check-master-v1';
const calculatorKeywords=[/roof\s*check/i,/check\s*roof/i,/בדיקת\s*גג/,/בדקו\s*את\s*הגג/,/בדקו\s*גג/,/התחילו\s*בבדיקת\s*הגג/,/הגג\s*שלכם/,/בדיקה\s*חכמה/,/חישוב\s*גג/,/קבלו\s*בדיקה/,/ראו\s*את\s*הגג/,/תראו\s*את\s*הגג/,/צפו\s*בגג/,/בדקו\s*התאמה/,/расч[её]т/i,/посмотр/i,/провер/i,/кры/i];
const contactKeywords=[/צור\s*קשר/,/השאירו\s*פרטים/,/קבלו\s*הצעה/,/השארת\s*פרטים/,/консульта/i,/заяв/i];
const BEFORE='./assets/hero/igor-before.jpg';
const AFTER='./assets/hero/igor-after.jpg';

function isCalculatorPage(){return /\/roof-check\/?$/.test(location.pathname)||/\/roof-check\//.test(location.pathname)}
function isPrivateHomesPage(){return /\/private-homes(?:\.html)?\/?$/.test(location.pathname)}
function siteRootUrl(){return new URL('./',location.href).href.replace(/private-homes\.html.*$/,'')}
function calculatorUrl(){const u=new URL('roof-check/',siteRootUrl());u.searchParams.set('v',CALCULATOR_MASTER_VERSION);return u.href}
function matches(text,patterns){const clean=(text||'').replace(/\s+/g,' ').trim();return patterns.some(p=>p.test(clean))}

function injectStyles(){
  if(document.getElementById('solatrix-runtime-fix'))return;
  const s=document.createElement('style');
  s.id='solatrix-runtime-fix';
  s.textContent=`
    a{text-decoration:none!important}
    .topbar a,.links a,.nav a,.nav-cta{text-decoration:none!important}
    .mobile-bottom-cta,.mobileBottomCta,[class*="mobile-bottom-cta"]{display:none!important;visibility:hidden!important;pointer-events:none!important}
    @media(max-width:980px){body{padding-bottom:0!important}}
    .igor-approved-before-after{position:relative!important;overflow:hidden!important;min-height:320px!important;background:#10283b!important;border-radius:28px!important}
    .igor-approved-before-after>img,.igor-approved-before-after .igor-after{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block!important}
    .igor-approved-before-after .igor-after-wrap{position:absolute;inset:0;overflow:hidden;clip-path:inset(0 50% 0 0);animation:igorRoofReveal 7s ease-in-out infinite alternate}
    .igor-approved-before-after .igor-divider{position:absolute;top:0;bottom:0;left:50%;width:3px;background:#fff;transform:translateX(-50%);box-shadow:0 0 20px rgba(0,0,0,.3);animation:igorDividerMove 7s ease-in-out infinite alternate;z-index:4}
    .igor-approved-before-after .igor-divider span{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#f5a11a;color:#071b2f;font-size:22px;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.28)}
    .igor-approved-before-after .igor-label{position:absolute;bottom:14px;z-index:5;padding:7px 13px;border-radius:999px;background:rgba(7,27,47,.82);color:#fff;font-weight:800;font-size:14px}
    .igor-label-before{right:14px}.igor-label-after{left:14px}
    @keyframes igorRoofReveal{0%,12%{clip-path:inset(0 88% 0 0)}88%,100%{clip-path:inset(0 12% 0 0)}}
    @keyframes igorDividerMove{0%,12%{left:12%}88%,100%{left:88%}}
    @media(max-width:760px){.igor-approved-before-after{min-height:300px!important;border-radius:24px!important}.igor-approved-before-after .igor-divider span{width:42px;height:42px}.igor-approved-before-after .igor-label{font-size:12px;padding:6px 10px}}
  `;
  document.head.appendChild(s);
}

function normalizeOfficialUrl(){
  if(!isPrivateHomesPage())return;
  const params=new URLSearchParams(location.search);
  if(params.get('official')==='1')history.replaceState({},'',new URL('./',location.href).pathname);
}

function connectLinks(){
  if(isCalculatorPage())return;
  const target=calculatorUrl();
  document.querySelectorAll('a').forEach(link=>{
    const label=link.textContent||'';
    const href=link.getAttribute('href')||'';
    if(matches(label,calculatorKeywords)||/roof-check(?:\.html|\/)?/i.test(href)||/#.*(?:roof|גג)/i.test(href))link.href=target;
    else if(matches(label,contactKeywords)&&!/wa\.me|whatsapp/i.test(href))link.href='#lead-form';
  });
}

function findRoofTarget(){
  const trigger=[...document.querySelectorAll('a,button')].find(el=>/ראו\s*את\s*הגג\s*שלכם/.test((el.textContent||'').replace(/\s+/g,' ')));
  const scope=trigger?.closest('section')||document;
  const direct=scope.querySelector('.roof-selected,.roof-map-image-placeholder,.selected-visual,.demo-map');
  if(direct)return direct;
  return [...scope.querySelectorAll('div,figure')].filter(el=>{
    const r=el.getBoundingClientRect();
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    return r.width>260&&r.height>220&&text.length<40;
  }).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return br.width*br.height-ar.width*ar.height})[0]||null;
}

function mountRoofAnimation(){
  if(!isPrivateHomesPage()||document.querySelector('.igor-approved-before-after'))return;
  const target=findRoofTarget();
  if(!target)return;
  target.classList.add('igor-approved-before-after');
  target.innerHTML=`<img src="${BEFORE}" alt="הגג לפני התקנת מערכת סולארית"><div class="igor-after-wrap"><img class="igor-after" src="${AFTER}" alt="הגג אחרי התקנת מערכת סולארית"></div><div class="igor-divider"><span>↔</span></div><span class="igor-label igor-label-before">לפני</span><span class="igor-label igor-label-after">אחרי</span>`;
}

function removeDock(){document.querySelectorAll('.mobile-bottom-cta,.mobileBottomCta,[class*="mobile-bottom-cta"]').forEach(el=>el.remove())}
function init(){injectStyles();normalizeOfficialUrl();removeDock();connectLinks();mountRoofAnimation();setTimeout(mountRoofAnimation,500);setTimeout(mountRoofAnimation,1400)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();