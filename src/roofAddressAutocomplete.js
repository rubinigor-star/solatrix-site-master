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
  note.textContent = 'התחילו להקליד רחוב ובחרו את העיר מהרשימה. מומלץ להוסיף מספר בית.';
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
      closeSuggestions(input, list);
      return;
    }
    searchTimer = window.setTimeout(() => searchOfficialStreets({ input, list, note, query }), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => handleKeyboard(event, input, list));
  input.addEventListener('blur', () => window.setTimeout(() => closeSuggestions(input, list), 180));
}

async function searchOfficialStreets({ input, list, note, query }) {
  requestController?.abort();
  requestController = new AbortController();
  note.textContent = 'מחפשים רחובות ויישובים במאגר הממשלתי…';

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
    renderSuggestions({ input, list, note, suggestions });
  } catch (error) {
    if (error.name === 'AbortError') return;
    closeSuggestions(input, list);
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

function renderSuggestions({ input, list, note, suggestions }) {
  list.replaceChildren();
  if (!suggestions.length) {
    closeSuggestions(input, list);
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
    button.innerHTML = `<b>${escapeHtml(suggestion.street)}</b><span>${escapeHtml(suggestion.city)}</span>`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => chooseSuggestion(input, list, note, suggestion, number));
    list.appendChild(button);
  });

  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  note.textContent = 'בחרו רחוב ועיר מהרשימה.';
}

function chooseSuggestion(input, list, note, suggestion, number) {
  input.value = `${suggestion.street}${number ? ` ${number}` : ''}, ${suggestion.city}`;
  input.dataset.autocompleteSelecting = 'true';
  input.dataset.officialAddress = 'true';
  input.dataset.cityCode = String(suggestion.cityCode || '');
  input.dataset.streetCode = String(suggestion.streetCode || '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.officialAddress = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list);
  note.textContent = number
    ? 'הכתובת נבחרה מהמאגר הממשלתי ותועבר למפה.'
    : 'הרחוב והעיר נבחרו. הוסיפו מספר בית לדיוק מרבי.';
  input.focus();
}

function handleKeyboard(event, input, list) {
  if (list.hidden) return;
  const options = [...list.querySelectorAll('.roofAddressSuggestion')];
  if (!options.length) return;
  const active = document.activeElement;
  let index = options.indexOf(active);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    options[(index + 1 + options.length) % options.length].focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    options[(index - 1 + options.length) % options.length].focus();
  } else if (event.key === 'Escape') {
    closeSuggestions(input, list);
    input.focus();
  }
}

function closeSuggestions(input, list) {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

const style = document.createElement('style');
style.textContent = `
  .roofAddressAutocompleteHost{position:relative}
  .roofAddressSuggestions{position:absolute;z-index:30;top:calc(100% - 2px);right:0;left:0;max-height:310px;overflow:auto;border:1px solid rgba(30,43,55,.14);border-radius:18px;background:#fff;box-shadow:0 18px 45px rgba(26,35,44,.18);padding:7px;direction:rtl}
  .roofAddressSuggestion{display:flex;width:100%;align-items:center;justify-content:space-between;gap:16px;border:0;border-radius:12px;background:#fff;padding:12px 14px;color:#14283a;font:inherit;text-align:right;cursor:pointer}
  .roofAddressSuggestion:hover,.roofAddressSuggestion:focus{outline:none;background:#fff4df}
  .roofAddressSuggestion b{font-weight:900}.roofAddressSuggestion span{color:#647383;font-size:14px}
  .roofAddressAutocompleteNote{display:block;margin-top:8px;color:#6c7885;font-size:13px;line-height:1.5}
`;
document.head.appendChild(style);

const observer = new MutationObserver(installAutocomplete);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', installAutocomplete);
setTimeout(installAutocomplete, 0);

export { houseNumber, streetQuery, uniqueSuggestions };
