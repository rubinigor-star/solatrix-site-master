import './homeVisualRefresh.css';

document.documentElement.classList.add('solatrix-preview-design');

const marker = document.createElement('div');
marker.className = 'solatrix-preview-marker';
marker.textContent = 'PREVIEW DESIGN v4';
marker.setAttribute('aria-hidden', 'true');
document.body.appendChild(marker);
