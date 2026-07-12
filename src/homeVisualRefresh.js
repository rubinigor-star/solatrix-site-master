import './homeVisualRefresh.css';

document.documentElement.classList.add('solatrix-preview-design');

const previewStyle = document.createElement('style');
previewStyle.textContent = `
  html.solatrix-preview-design body { background:#f3f6f7 !important; }

  html.solatrix-preview-design .topbar {
    background:rgba(255,255,255,.96) !important;
    border-bottom:1px solid rgba(6,40,64,.10) !important;
    box-shadow:0 10px 34px rgba(6,40,64,.07) !important;
  }

  html.solatrix-preview-design .hero {
    min-height:calc(100vh - 84px) !important;
    padding:64px 0 84px !important;
    background:
      radial-gradient(circle at 8% 8%,rgba(247,183,25,.18),transparent 27%),
      radial-gradient(circle at 90% 90%,rgba(12,74,112,.10),transparent 28%),
      linear-gradient(135deg,#fbfcfc 0%,#edf3f5 58%,#e4edf1 100%) !important;
    border-bottom:1px solid rgba(6,40,64,.08) !important;
  }

  html.solatrix-preview-design .hero-bg-grid {
    background-size:42px 42px !important;
    opacity:.42 !important;
  }

  html.solatrix-preview-design .hero-grid {
    grid-template-columns:minmax(0,.93fr) minmax(520px,1.07fr) !important;
    gap:76px !important;
    align-items:center !important;
  }

  html.solatrix-preview-design h1 {
    font-size:clamp(58px,6.25vw,90px) !important;
    line-height:.95 !important;
    letter-spacing:-.055em !important;
    margin-bottom:26px !important;
  }

  html.solatrix-preview-design h1 strong { color:#082b45 !important; }

  html.solatrix-preview-design .lead {
    font-size:21px !important;
    line-height:1.72 !important;
    color:#52616b !important;
  }

  html.solatrix-preview-design .price-strip {
    border-radius:20px !important;
    border:1px solid rgba(6,40,64,.09) !important;
    box-shadow:0 18px 50px rgba(6,40,64,.08) !important;
    background:rgba(255,255,255,.82) !important;
    backdrop-filter:blur(12px);
  }

  html.solatrix-preview-design .btn,
  html.solatrix-preview-design .nav-cta {
    border-radius:14px !important;
  }

  html.solatrix-preview-design .visual-stage {
    min-height:600px !important;
    position:relative !important;
  }

  .svr-demo {
    position:absolute;
    inset:0;
    overflow:hidden;
    border-radius:34px;
    background:linear-gradient(145deg,#062840 0%,#0c4a70 58%,#09283d 100%);
    box-shadow:0 42px 100px rgba(6,40,64,.29);
    border:1px solid rgba(255,255,255,.54);
  }

  .svr-demo::before {
    content:"";
    position:absolute;
    inset:0;
    background:
      linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px),
      radial-gradient(circle at 82% 12%,rgba(247,183,25,.38),transparent 25%);
    background-size:34px 34px,34px 34px,auto;
  }

  .svr-demo-top {
    position:relative;
    z-index:3;
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:22px 24px;
    border-bottom:1px solid rgba(255,255,255,.10);
    color:#fff;
  }

  .svr-demo-title { font-size:14px; font-weight:900; letter-spacing:.09em; }
  .svr-demo-status {
    display:inline-flex;
    gap:8px;
    align-items:center;
    font-size:12px;
    font-weight:800;
    color:rgba(255,255,255,.76);
  }
  .svr-demo-status::before {
    content:"";
    width:8px;
    height:8px;
    border-radius:50%;
    background:#f7b719;
    box-shadow:0 0 0 7px rgba(247,183,25,.13);
  }

  .svr-map {
    position:absolute;
    left:28px;
    right:28px;
    top:82px;
    bottom:158px;
    overflow:hidden;
    border-radius:22px;
    background:
      linear-gradient(32deg,rgba(22,35,28,.20),rgba(0,0,0,.08)),
      linear-gradient(135deg,#75806f 0%,#4f5d4b 44%,#6e7865 100%);
    box-shadow:inset 0 0 75px rgba(0,0,0,.34),0 16px 34px rgba(0,0,0,.18);
  }

  .svr-map::before {
    content:"";
    position:absolute;
    inset:-70px;
    background:
      linear-gradient(27deg,transparent 47%,rgba(220,210,188,.36) 48%,rgba(220,210,188,.36) 52%,transparent 53%),
      linear-gradient(117deg,transparent 47%,rgba(210,199,174,.28) 48%,rgba(210,199,174,.28) 52%,transparent 53%);
    background-size:130px 130px;
    transform:rotate(-8deg);
  }

  .svr-map::after {
    content:"HAIFA • 32.7940° N, 34.9896° E";
    position:absolute;
    left:16px;
    bottom:14px;
    z-index:4;
    padding:7px 10px;
    border-radius:9px;
    background:rgba(4,27,43,.74);
    color:rgba(255,255,255,.82);
    font:800 10px/1.2 system-ui,sans-serif;
    letter-spacing:.05em;
    backdrop-filter:blur(8px);
  }

  .svr-roof {
    position:absolute;
    left:50%;
    top:50%;
    width:58%;
    height:55%;
    transform:translate(-50%,-50%) rotate(-8deg);
    clip-path:polygon(10% 0,100% 12%,92% 100%,0 84%);
    background:linear-gradient(145deg,#c9b79e,#9e876b);
    box-shadow:0 30px 48px rgba(0,0,0,.32);
  }

  .svr-roof::before {
    content:"";
    position:absolute;
    inset:7%;
    border:2px solid #ffd75c;
    clip-path:inherit;
    filter:drop-shadow(0 0 8px rgba(255,215,92,.62));
  }

  .svr-panels {
    position:absolute;
    inset:17% 14% 15%;
    display:grid;
    grid-template-columns:repeat(4,1fr);
    grid-template-rows:repeat(3,1fr);
    gap:6px;
  }

  .svr-panel {
    border-radius:3px;
    background:
      linear-gradient(90deg,transparent 48%,rgba(255,255,255,.16) 49%,rgba(255,255,255,.16) 51%,transparent 52%),
      linear-gradient(180deg,transparent 48%,rgba(255,255,255,.13) 49%,rgba(255,255,255,.13) 51%,transparent 52%),
      linear-gradient(145deg,#0b2c47,#174f75);
    border:1px solid rgba(255,255,255,.16);
    box-shadow:0 4px 8px rgba(0,0,0,.18);
    animation:svr-panel-in .7s ease both;
  }

  .svr-panel:nth-child(2n){animation-delay:.08s}
  .svr-panel:nth-child(3n){animation-delay:.16s}
  .svr-panel:nth-child(4n){animation-delay:.24s}

  @keyframes svr-panel-in {
    from{opacity:0;transform:translateY(8px) scale(.96)}
    to{opacity:1;transform:none}
  }

  .svr-scanline {
    position:absolute;
    left:6%;
    right:6%;
    height:2px;
    top:18%;
    background:linear-gradient(90deg,transparent,#ffd75c,transparent);
    box-shadow:0 0 18px #ffd75c;
    animation:svr-scan 4.4s ease-in-out infinite;
  }

  @keyframes svr-scan {
    0%,100% { top:18%; opacity:.25; }
    50% { top:82%; opacity:1; }
  }

  .svr-stats {
    position:absolute;
    left:28px;
    right:28px;
    bottom:24px;
    z-index:4;
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:10px;
  }

  .svr-stat {
    min-width:0;
    padding:15px 14px;
    border-radius:16px;
    background:rgba(255,255,255,.95);
    border:1px solid rgba(255,255,255,.78);
    box-shadow:0 14px 32px rgba(0,0,0,.17);
    backdrop-filter:blur(14px);
  }

  .svr-stat span { display:block; font-size:11px; font-weight:800; color:#6c7880; }
  .svr-stat b { display:block; margin-top:3px; font-size:20px; color:#062840; white-space:nowrap; }

  .svr-float {
    position:absolute;
    z-index:5;
    top:105px;
    right:8px;
    padding:12px 15px;
    border-radius:14px;
    background:#f7b719;
    color:#18212a;
    font-size:12px;
    font-weight:900;
    box-shadow:0 14px 32px rgba(0,0,0,.18);
    transform:rotate(2deg);
  }

  .svr-side-note {
    position:absolute;
    z-index:5;
    left:8px;
    top:138px;
    padding:11px 14px;
    border-radius:13px;
    background:rgba(255,255,255,.94);
    color:#082b45;
    font-size:12px;
    font-weight:900;
    box-shadow:0 14px 32px rgba(0,0,0,.16);
    transform:rotate(-2deg);
  }

  @media(max-width:900px){
    html.solatrix-preview-design .hero-grid{grid-template-columns:1fr !important;gap:38px !important}
    html.solatrix-preview-design .visual-stage{min-height:500px !important}
    html.solatrix-preview-design h1{font-size:58px !important;text-align:center}
    html.solatrix-preview-design .lead{font-size:19px !important;text-align:center;margin-inline:auto}
    .svr-stats{grid-template-columns:repeat(2,1fr)}
    .svr-map{bottom:220px}
  }

  @media(max-width:560px){
    html.solatrix-preview-design .hero{padding-top:38px !important}
    html.solatrix-preview-design .visual-stage{min-height:470px !important}
    .svr-demo{border-radius:22px}
    .svr-map{left:14px;right:14px;top:72px;bottom:214px}
    .svr-stats{left:14px;right:14px;bottom:14px;gap:8px}
    .svr-stat{padding:12px 10px}
    .svr-stat b{font-size:17px}
    .svr-float{right:4px;top:88px}
    .svr-side-note{left:4px;top:122px}
  }
`;
document.head.appendChild(previewStyle);

function buildHeroDemo() {
  const stage = document.querySelector('.hero .visual-stage');
  if (!stage) return;

  stage.innerHTML = `
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildHeroDemo, { once:true });
} else {
  buildHeroDemo();
}
