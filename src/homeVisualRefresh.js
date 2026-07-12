import './homeVisualRefresh.css';

document.documentElement.classList.add('solatrix-preview-design');

const previewStyle = document.createElement('style');
previewStyle.textContent = `
  html.solatrix-preview-design body {
    background: #eef3f5 !important;
  }

  html.solatrix-preview-design body::before {
    content: "PREVIEW DESIGN v4";
    position: fixed;
    left: 18px;
    bottom: 18px;
    z-index: 999999;
    padding: 9px 13px;
    border-radius: 10px;
    background: #062840;
    color: #fff;
    font: 800 12px/1.2 system-ui, sans-serif;
    letter-spacing: .08em;
    box-shadow: 0 12px 30px rgba(0,0,0,.2);
  }

  html.solatrix-preview-design header,
  html.solatrix-preview-design .topbar {
    background: rgba(255,255,255,.94) !important;
    border-bottom: 1px solid rgba(6,40,64,.12) !important;
    box-shadow: 0 12px 35px rgba(6,40,64,.08) !important;
  }

  html.solatrix-preview-design main > section:first-of-type,
  html.solatrix-preview-design .hero {
    background: linear-gradient(135deg,#f9fbfb 0%,#e8f0f3 100%) !important;
    border-bottom: 6px solid #f7b719 !important;
  }
`;
document.head.appendChild(previewStyle);
