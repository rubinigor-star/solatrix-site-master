const BEFORE = './assets/hero/igor-before.jpg';
const AFTER = './assets/hero/igor-after.jpg';

function mountApprovedRoofAnimation() {
  if (document.querySelector('.igor-approved-before-after')) return;

  const trigger = [...document.querySelectorAll('a,button')].find((element) =>
    /ראו\s*את\s*הגג\s*שלכם/.test((element.textContent || '').replace(/\s+/g, ' '))
  );
  const scope = trigger?.closest('section') || trigger?.parentElement?.parentElement || document;
  const candidates = [...scope.querySelectorAll('div,figure')]
    .filter((element) => {
      if (element === scope || element.closest('a,button')) return false;
      const rect = element.getBoundingClientRect();
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const style = getComputedStyle(element);
      return rect.width > 260
        && rect.height > 220
        && text.length < 35
        && (parseFloat(style.borderRadius) > 12 || style.overflow === 'hidden');
    })
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

  const target = candidates[0];
  if (!target) return;

  target.innerHTML = '';
  target.classList.add('igor-approved-before-after');
  target.innerHTML = [
    `<img class="igor-before" src="${BEFORE}" alt="הגג לפני התקנת מערכת סולארית">`,
    `<div class="igor-after-wrap"><img class="igor-after" src="${AFTER}" alt="הגג אחרי התקנת מערכת סולארית"></div>`,
    '<div class="igor-divider"><span>↔</span></div>',
    '<span class="igor-label igor-label-before">לפני</span>',
    '<span class="igor-label igor-label-after">אחרי</span>'
  ].join('');

  const style = document.createElement('style');
  style.id = 'igor-approved-before-after-style';
  style.textContent = `
    .igor-approved-before-after{position:relative!important;overflow:hidden!important;min-height:320px!important;background:#10283b!important;border-radius:28px!important}
    .igor-approved-before-after>img,.igor-approved-before-after .igor-after{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block!important}
    .igor-approved-before-after .igor-after-wrap{position:absolute;inset:0;overflow:hidden;clip-path:inset(0 50% 0 0);animation:igorRoofReveal 7s ease-in-out infinite alternate}
    .igor-approved-before-after .igor-divider{position:absolute;top:0;bottom:0;left:50%;width:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.12),0 0 20px rgba(0,0,0,.28);transform:translateX(-50%);animation:igorDividerMove 7s ease-in-out infinite alternate;z-index:4}
    .igor-approved-before-after .igor-divider span{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:#f5a11a;color:#071b2f;font-size:22px;font-weight:900;box-shadow:0 10px 28px rgba(0,0,0,.28)}
    .igor-approved-before-after .igor-label{position:absolute;bottom:14px;z-index:5;padding:7px 13px;border-radius:999px;background:rgba(7,27,47,.82);color:#fff;font-weight:800;font-size:14px;backdrop-filter:blur(6px)}
    .igor-approved-before-after .igor-label-before{right:14px}.igor-approved-before-after .igor-label-after{left:14px}
    @keyframes igorRoofReveal{0%,12%{clip-path:inset(0 88% 0 0)}88%,100%{clip-path:inset(0 12% 0 0)}}
    @keyframes igorDividerMove{0%,12%{left:12%}88%,100%{left:88%}}
    @media(max-width:760px){.igor-approved-before-after{min-height:300px!important;border-radius:24px!important}.igor-approved-before-after .igor-divider span{width:42px;height:42px}.igor-approved-before-after .igor-label{font-size:12px;padding:6px 10px}}
    @media(prefers-reduced-motion:reduce){.igor-approved-before-after .igor-after-wrap{animation:none;clip-path:inset(0 50% 0 0)}.igor-approved-before-after .igor-divider{animation:none;left:50%}}
  `;
  document.head.appendChild(style);
}

function scheduleMount() {
  setTimeout(mountApprovedRoofAnimation, 150);
  setTimeout(mountApprovedRoofAnimation, 700);
  setTimeout(mountApprovedRoofAnimation, 1600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleMount, { once: true });
} else {
  scheduleMount();
}
