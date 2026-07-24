const FLAG = '__solatrixGovMapApprovedControlsPatchV1';

function onRoofMarking() {
  return (window.location.pathname || '').includes('/roof-marking');
}

function clickOfficial(action) {
  const button = document.querySelector(`[data-govmap-official="${action}"]`);
  if (button && !button.disabled) button.click();
}

function installControls() {
  if (!onRoofMarking()) return;
  const wrap = document.querySelector('.solatrixGovMapWrap');
  const footer = document.querySelector('.drawFooter');
  if (!wrap || !footer) return;

  const actions = footer.querySelector('.compactActions') || footer.querySelector('.actions');
  if (!actions) return;

  let start = actions.querySelector('.primaryBtn[data-action="markRoof"], .primaryBtn[data-govmap-ui="start"]');
  if (!start) {
    start = document.createElement('button');
    start.type = 'button';
    start.className = 'primaryBtn';
    actions.prepend(start);
  }
  start.dataset.govmapUi = 'start';
  start.removeAttribute('data-action');
  start.textContent = 'התחל סימון';
  start.disabled = false;
  start.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clickOfficial('draw');
  };

  let clear = actions.querySelector('.ghostBtn[data-govmap-ui="clear"]');
  if (!clear) {
    clear = actions.querySelector('.ghostBtn');
  }
  if (!clear) {
    clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'ghostBtn';
    actions.appendChild(clear);
  }
  clear.dataset.govmapUi = 'clear';
  clear.removeAttribute('data-action');
  clear.textContent = 'נקה סימון';
  clear.disabled = false;
  clear.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clickOfficial('clear');
  };

  actions.querySelectorAll('button').forEach((button) => {
    if (button !== start && button !== clear) button.remove();
  });

  const done = footer.querySelector('.nextTextBtn[data-action="next"]');
  if (done) done.textContent = 'סיימתי';

  footer.dataset.govmapControlsReady = 'true';
}

if (!window[FLAG]) {
  window[FLAG] = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControls);
  else installControls();
  window.addEventListener('popstate', () => setTimeout(installControls, 100));
  setInterval(installControls, 350);
}
