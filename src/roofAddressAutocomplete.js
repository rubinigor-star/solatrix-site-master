const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GOVMAP_SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 280;

let requestController = null;
let searchTimer = 0;

function normalize(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function streetQuery(value = '') {
  return normalize(value);
}

function houseNumber(value = '') {
  return normalize(value).match(/\b\d+[א-תA-Za-z]?\b/)?.[0] || '';
}

function collectResults(payload) {
  if (Array.isArray(payload)) return payload;
  const candidates = [payload?.results, payload?.data?.results, payload?.data, payload?.result, payload?.items];
  for (const candidate of candidates) if (Array.isArray(candidate)) return candidate;
  return [];
}

function firstText(...values) {
  return values.map(normalize).find(Boolean) || '';
}

function labelFromResult(result, fallback = '') {
  const primary = firstText(
    result?.text,
    result?.caption,
    result?.display_name,
    result?.originalText,
    result?.name,
    result?.address,
    result?.data?.text,
    result?.data?.caption,
    result?.data?.address,
    result?.data?.name
  );
  const secondary = firstText(
    result?.subtext,
    result?.description,
    result?.city,
    result?.locality,
    result?.data?.subtext,
    result?.data?.description,
    result?.data?.city,
    result?.data?.locality,
    result?.data?.יישוב
  );
  return { primary: primary || fallback, secondary };
}

function uniqueSuggestions(results, query) {
  const seen = new Set();
  return results
    .map((result) => ({ result, ...labelFromResult(result, query) }))
    .filter((item) => item.primary)
    .filter((item) => {
      const key = `${item.primary}|${item.secondary}`.toLocaleLowerCase('he');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function requestGovMap(searchText, signal, filterType = 'address') {
  const body = {
    searchText,
    language: 'he',
    maxResults: 12,
    isAccurate: true,
    apiKey: GOVMAP_TOKEN
  };
  if (filterType) body.filterType = filterType;

  const response = await fetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  return collectResults(await response.json());
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
  note.textContent = 'הקלידו רחוב, מספר ועיר. אפשר לבחור תוצאה מ-GovMap או להמשיך עם כתובת מלאה שהוזנה ידנית.';
  host.appendChild(note);

  input.addEventListener('input', () => {
    if (input.dataset.autocompleteSelecting === 'true') {
      input.dataset.autocompleteSelecting = 'false';
      return;
    }
    input.dataset.officialAddress = '';
    try { localStorage.removeItem(GOVMAP_SELECTION_KEY); } catch {}
    window.clearTimeout(searchTimer);
    const query = streetQuery(input.value);
    if (query.length < MIN_QUERY_LENGTH) {
      closeSuggestions(input, list, host);
      note.textContent = 'הקלידו רחוב, מספר ועיר לקבלת תוצאות מדויקות.';
      return;
    }
    searchTimer = window.setTimeout(() => searchGovMapAddresses({ input, list, note, host, query }), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (event) => handleKeyboard(event, input, list, host));
  input.addEventListener('blur', () => window.setTimeout(() => closeSuggestions(input, list, host), 180));
}

async function searchGovMapAddresses({ input, list, note, host, query }) {
  requestController?.abort();
  requestController = new AbortController();
  note.textContent = 'מחפשים את הכתובת ב-GovMap…';

  if (!GOVMAP_TOKEN) {
    closeSuggestions(input, list, host);
    note.textContent = 'אפשר להזין כתובת מלאה ולהמשיך. מפתח GovMap אינו זמין כרגע להצגת הצעות.';
    return;
  }

  try {
    let results = await requestGovMap(query, requestController.signal, 'address');
    if (!results.length) results = await requestGovMap(query, requestController.signal, '');
    const suggestions = uniqueSuggestions(results, query);
    renderSuggestions({ input, list, note, host, suggestions, query });
  } catch (error) {
    if (error.name === 'AbortError') return;
    closeSuggestions(input, list, host);
    note.textContent = 'לא הצלחנו לטעון הצעות כרגע. הזינו רחוב, מספר ועיר והמשיכו - המפה תנסה לאתר את הכתובת שוב.';
  }
}

function renderSuggestions({ input, list, note, host, suggestions, query }) {
  list.replaceChildren();
  if (!suggestions.length) {
    closeSuggestions(input, list, host);
    note.textContent = 'לא נמצאה הצעה מדויקת. אפשר להשאיר את הכתובת המלאה כפי שהוקלדה ולהמשיך למפה.';
    input.dataset.manualAddressAllowed = 'true';
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roofAddressSuggestion';
    button.setAttribute('role', 'option');
    button.dataset.index = String(index);
    button.innerHTML = `<span class="roofAddressSuggestionPin" aria-hidden="true">⌖</span><span class="roofAddressSuggestionText"><b>${escapeHtml(suggestion.primary)}</b>${suggestion.secondary ? `<small>${escapeHtml(suggestion.secondary)}</small>` : ''}</span>`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => chooseSuggestion(input, list, note, host, suggestion));
    list.appendChild(button);
  });

  const manual = document.createElement('button');
  manual.type = 'button';
  manual.className = 'roofAddressSuggestion roofAddressManualSuggestion';
  manual.innerHTML = `<span class="roofAddressSuggestionPin" aria-hidden="true">✎</span><span class="roofAddressSuggestionText"><b>המשך עם הכתובת שהוקלדה</b><small>${escapeHtml(query)}</small></span>`;
  manual.addEventListener('mousedown', (event) => event.preventDefault());
  manual.addEventListener('click', () => chooseManualAddress(input, list, note, host));
  list.appendChild(manual);

  list.hidden = false;
  host.classList.add('suggestionsOpen');
  input.setAttribute('aria-expanded', 'true');
  note.textContent = 'בחרו תוצאה של GovMap. אם הכתובת אינה מופיעה, אפשר להמשיך עם הטקסט שהוקלד.';
}

function chooseSuggestion(input, list, note, host, suggestion) {
  const chosenAddress = [suggestion.primary, suggestion.secondary].filter(Boolean).join(', ');
  input.value = chosenAddress;
  input.dataset.autocompleteSelecting = 'true';
  input.dataset.officialAddress = 'true';
  input.dataset.manualAddressAllowed = '';
  try {
    localStorage.setItem(GOVMAP_SELECTION_KEY, JSON.stringify({ address: chosenAddress, result: suggestion.result }));
  } catch {}
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.officialAddress = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list, host);
  note.textContent = 'הכתובת נבחרה ב-GovMap והנקודה המדויקת תועבר למפה.';
  input.focus();
}

function chooseManualAddress(input, list, note, host) {
  input.dataset.manualAddressAllowed = 'true';
  input.dataset.officialAddress = '';
  try { localStorage.removeItem(GOVMAP_SELECTION_KEY); } catch {}
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list, host);
  note.textContent = 'הכתובת תישלח כפי שהוקלדה לחיפוש נוסף במפת GovMap.';
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
  .roofAddressSuggestions{position:relative;z-index:5;width:100%;max-height:330px;overflow-y:auto;overscroll-behavior:contain;margin-top:8px;border:1px solid rgba(30,43,55,.14);border-radius:16px;background:#fff;box-shadow:0 12px 28px rgba(26,35,44,.12);padding:6px;direction:rtl;scrollbar-width:thin}
  .roofAddressSuggestion{display:grid;grid-template-columns:34px minmax(0,1fr);width:100%;align-items:center;gap:10px;border:0;border-bottom:1px solid rgba(30,43,55,.08);border-radius:10px;background:#fff;padding:11px 12px;color:#14283a;font:inherit;text-align:right;cursor:pointer;min-height:58px}
  .roofAddressSuggestion:last-child{border-bottom:0}
  .roofAddressSuggestion:hover,.roofAddressSuggestion:focus{outline:none;background:#fff4df}
  .roofAddressManualSuggestion{background:#f7fafc}
  .roofAddressSuggestionPin{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#fff4df;color:#e68a00;font-size:19px;font-weight:900}
  .roofAddressSuggestionText{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:2px}
  .roofAddressSuggestionText b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900;line-height:1.3}
  .roofAddressSuggestionText small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#647383;font-size:13px;line-height:1.35}
  .roofAddressAutocompleteNote{display:block;margin-top:7px;color:#6c7885;font-size:13px;line-height:1.45}
  .roofAddressAutocompleteHost.suggestionsOpen>input{border-color:#f5a11a!important;box-shadow:0 0 0 3px rgba(245,161,26,.13)!important}
  @media (max-width:760px){
    .roofAddressSuggestions{max-height:260px;margin-top:7px;border-radius:14px;padding:5px;box-shadow:0 10px 22px rgba(26,35,44,.11)}
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