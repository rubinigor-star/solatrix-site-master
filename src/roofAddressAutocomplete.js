const DATASTORE_URL = 'https://data.gov.il/api/3/action/datastore_search';
const STREET_RESOURCE_ID = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 280;

let requestController = null;
let searchTimer = 0;

function normalize(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function streetQuery(value = '') {
  return normalize(value)
    .replace(/\b\d+[א-תA-Za-z]?\b/g, ' ')
    .replace(/[,،]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function houseNumber(value = '') {
  return normalize(value).match(/\b\d+[א-תA-Za-z]?\b/)?.[0] || '';
}

function installAutocomplete() {
  const input = document.querySelector('[data-field="address"]');
  if (!input || input.dataset.addressAutocomplete === 'true') return;
  input.dataset.addressAutocomplete = 'true';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const host = input.closest('.fieldGroup');
  if (!host) return;
  host.classList.add('roofAddressAutocompleteHost');

  const list = document.createElement('div');
  list.className = 'roofAddressSuggestions';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  host.appendChild(list);

  const note = document.createElement('small');
  note.className = 'roofAddressAutocompleteNote';
  note.textContent = 'התחילו להקליד רחוב ובחרו כתובת מהרשימה. מומלץ להוסיף מספר בית.';
  host.appendChild(note);

  input.addEventListener('input', () => {
    if (input.dataset.autocompleteSelecting === 'true') {
      input.dataset.autocompleteSelecting = 'false';
      return;
    }
    input.dataset.officialAddress = '';
    window.clearTimeout(searchTimer);
    const query = streetQuery(input.value);
    if (query.length < MIN_QUERY_LENGTH) {
      closeSuggestions(input, list, host);
      note.textContent = 'התחילו להקליד רחוב ובחרו כתובת מהרשימה. מומלץ להוסיף מספר בית.';
      return;
    }
    searchTimer = window.setTimeout(() => searchOfficialStreets({ input, list, note, host, query }), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => handleKeyboard(event, input, list, host));
  input.addEventListener('blur', () => window.setTimeout(() => closeSuggestions(input, list, host), 180));
}

async function searchOfficialStreets({ input, list, note, host, query }) {
  requestController?.abort();
  requestController = new AbortController();
  note.textContent = 'מחפשים כתובות במאגר הממשלתי…';

  const params = new URLSearchParams({
    resource_id: STREET_RESOURCE_ID,
    q: query,
    limit: '18'
  });

  try {
    const response = await fetch(`${DATASTORE_URL}?${params}`, {
      headers: { Accept: 'application/json' },
      signal: requestController.signal
    });
    if (!response.ok) throw new Error(`Street search failed: ${response.status}`);
    const payload = await response.json();
    const suggestions = uniqueSuggestions(payload?.result?.records || [], query).slice(0, 8);
    renderSuggestions({ input, list, note, host, suggestions });
  } catch (error) {
    if (error.name === 'AbortError') return;
    closeSuggestions(input, list, host);
    note.textContent = 'לא הצלחנו לטעון הצעות כרגע. אפשר להזין רחוב, מספר ועיר באופן ידני.';
  }
}

function uniqueSuggestions(records, query) {
  const normalizedQuery = normalize(query);
  const seen = new Set();
  return records
    .map((record) => ({
      street: normalize(record['שם_רחוב']),
      city: normalize(record['שם_ישוב']),
      streetCode: record['סמל_רחוב'],
      cityCode: record['סמל_ישוב']
    }))
    .filter(({ street, city }) => street && city)
    .filter((item) => {
      const key = `${item.street}|${item.city}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const aExact = a.street === normalizedQuery ? 0 : a.street.startsWith(normalizedQuery) ? 1 : 2;
      const bExact = b.street === normalizedQuery ? 0 : b.street.startsWith(normalizedQuery) ? 1 : 2;
      return aExact - bExact || a.street.localeCompare(b.street, 'he') || a.city.localeCompare(b.city, 'he');
    });
}

function renderSuggestions({ input, list, note, host, suggestions }) {
  list.replaceChildren();
  if (!suggestions.length) {
    closeSuggestions(input, list, host);
    note.textContent = 'לא נמצאו הצעות. נסו להוסיף או לשנות את שם העיר.';
    return;
  }

  const number = houseNumber(input.value);
  suggestions.forEach((suggestion, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roofAddressSuggestion';
    button.setAttribute('role', 'option');
    button.dataset.index = String(index);
    button.innerHTML = `<span class="roofAddressSuggestionPin" aria-hidden="true">⌖</span><span class="roofAddressSuggestionText"><b>${escapeHtml(suggestion.street)}${number ? ` ${escapeHtml(number)}` : ''}</b><small>${escapeHtml(suggestion.city)}</small></span>`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => chooseSuggestion(input, list, note, host, suggestion, number));
    list.appendChild(button);
  });

  list.hidden = false;
  host.classList.add('suggestionsOpen');
  input.setAttribute('aria-expanded', 'true');
  note.textContent = 'בחרו את הכתובת המתאימה מהרשימה.';
}

function chooseSuggestion(input, list, note, host, suggestion, number) {
  input.value = `${suggestion.street}${number ? ` ${number}` : ''}, ${suggestion.city}`;
  input.dataset.autocompleteSelecting = 'true';
  input.dataset.officialAddress = 'true';
  input.dataset.cityCode = String(suggestion.cityCode || '');
  input.dataset.streetCode = String(suggestion.streetCode || '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.officialAddress = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list, host);
  note.textContent = number
    ? 'הכתובת נבחרה ותועבר למפה.'
    : 'הרחוב והעיר נבחרו. הוסיפו מספר בית לדיוק מרבי.';
  input.focus();
}

function handleKeyboard(event, input, list, host) {
  if (list.hidden) return;
  const options = [...list.querySelectorAll('.roofAddressSuggestion')];
  if (!options.length) return;
  const active = document.activeElement;
  const index = options.indexOf(active);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    options[(index + 1 + options.length) % options.length].focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    options[(index - 1 + options.length) % options.length].focus();
  } else if (event.key === 'Enter' && index >= 0) {
    event.preventDefault();
    options[index].click();
  } else if (event.key === 'Escape') {
    closeSuggestions(input, list, host);
    input.focus();
  }
}

function closeSuggestions(input, list, host) {
  list.hidden = true;
  host?.classList.remove('suggestionsOpen');
  input.setAttribute('aria-expanded', 'false');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

const style = document.createElement('style');
style.textContent = `
  .roofAddressAutocompleteHost{position:relative;isolation:isolate}
  .roofAddressSuggestions[hidden]{display:none!important}
  .roofAddressSuggestions{position:relative;z-index:1;width:100%;max-height:300px;overflow-y:auto;overscroll-behavior:contain;margin-top:8px;border:1px solid rgba(30,43,55,.14);border-radius:16px;background:#fff;box-shadow:0 12px 28px rgba(26,35,44,.12);padding:6px;direction:rtl;scrollbar-width:thin}
  .roofAddressSuggestion{display:grid;grid-template-columns:34px minmax(0,1fr);width:100%;align-items:center;gap:10px;border:0;border-bottom:1px solid rgba(30,43,55,.08);border-radius:10px;background:#fff;padding:11px 12px;color:#14283a;font:inherit;text-align:right;cursor:pointer;min-height:58px}
  .roofAddressSuggestion:last-child{border-bottom:0}
  .roofAddressSuggestion:hover,.roofAddressSuggestion:focus{outline:none;background:#fff4df}
  .roofAddressSuggestionPin{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#fff4df;color:#e68a00;font-size:19px;font-weight:900}
  .roofAddressSuggestionText{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:2px}
  .roofAddressSuggestionText b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900;line-height:1.3}
  .roofAddressSuggestionText small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#647383;font-size:13px;line-height:1.35}
  .roofAddressAutocompleteNote{display:block;margin-top:7px;color:#6c7885;font-size:13px;line-height:1.45}
  .roofAddressAutocompleteHost.suggestionsOpen>input{border-color:#f5a11a!important;box-shadow:0 0 0 3px rgba(245,161,26,.13)!important}
  @media (max-width:760px){
    .roofAddressSuggestions{max-height:238px;margin-top:7px;border-radius:14px;padding:5px;box-shadow:0 10px 22px rgba(26,35,44,.11)}
    .roofAddressSuggestion{grid-template-columns:32px minmax(0,1fr);gap:9px;min-height:56px;padding:10px}
    .roofAddressSuggestionPin{width:28px;height:28px;border-radius:9px;font-size:18px}
    .roofAddressSuggestionText b{font-size:15px}
    .roofAddressSuggestionText small{font-size:12.5px}
    .roofAddressAutocompleteNote{font-size:12px;margin-top:6px}
  }
`;
document.head.appendChild(style);

const observer = new MutationObserver(installAutocomplete);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', installAutocomplete);
setTimeout(installAutocomplete, 0);

export { houseNumber, streetQuery, uniqueSuggestions };
