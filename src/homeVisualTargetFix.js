function findHeroVisualTarget() {
  const hero = document.querySelector('.hero, main > section:first-of-type');
  if (!hero) return null;

  const explicit = hero.querySelector('.visual-stage, .hero-visual, .tool-demo, .demo-panel, .visual-panel');
  if (explicit) return explicit;

  const candidates = [...hero.querySelectorAll('div')]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const text = (element.textContent || '').trim();
      const childrenWithText = [...element.children].some((child) => (child.textContent || '').trim().length > 25);
      return rect.width > 260
        && rect.height > 260
        && text.length < 80
        && !childrenWithText
        && (parseFloat(style.borderRadius) > 12 || style.border !== '0px none rgb(0, 0, 0)');
    })
    .sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });

  return candidates[0] || null;
}

function roofCheckMarkup() {
  return `
    <div class="svr-demo" aria-label="הדגמת בדיקת גג סולארית">
      <div class="svr-demo-top">
        <span class="svr-demo-title">SOLATRIX ROOF CHECK</span>
        <span class="svr-demo-status">ניתוח גג פעיל</span>
      </div>
      <div class="svr-map">
        <div class="svr-roof">
          <div class="svr-panels">
            ${Array.from({ length: 12 }, () => '<i class="svr-panel"></i>').join('')}
          </div>
        </div>
        <div class="svr-scanline"></div>
      </div>
      <div class="svr-float">✓ התאמה ראשונית נמצאה</div>
      <div class="svr-side-note">דו״ח PDF מוכן תוך דקות</div>
      <div class="svr-stats">
        <div class="svr-stat"><span>שטח גג</span><b>182 מ״ר</b></div>
        <div class="svr-stat"><span>גודל מערכת</span><b>28.4 kW</b></div>
        <div class="svr-stat"><span>ייצור שנתי</span><b>46,900 kWh</b></div>
        <div class="svr-stat"><span>החזר השקעה</span><b>4.3 שנים</b></div>
      </div>
    </div>
  `;
}

function mountRoofCheckVisual() {
  const target = findHeroVisualTarget();
  if (!target || target.querySelector('.svr-demo')) return;

  target.classList.add('visual-stage', 'svr-live-target');
  target.style.position = 'relative';
  target.style.minHeight = window.innerWidth <= 560 ? '470px' : '590px';
  target.style.overflow = 'visible';
  target.innerHTML = roofCheckMarkup();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    mountRoofCheckVisual();
    setTimeout(mountRoofCheckVisual, 500);
    setTimeout(mountRoofCheckVisual, 1400);
  }, { once: true });
} else {
  mountRoofCheckVisual();
  setTimeout(mountRoofCheckVisual, 500);
  setTimeout(mountRoofCheckVisual, 1400);
}
