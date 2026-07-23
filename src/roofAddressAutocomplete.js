const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GOVMAP_SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 320;

let requestController = null;
let searchTimer = 0;

function normalize(value = '') {
  return String(value).replace(/[،]/g, ',').replace(/\s+/g, ' ').trim();
}

function streetQuery(value = '') {
  return normalize(value);
}

function houseNumber(value = '') {
  return normalize(value).match(/\b\d+[א-תA-Za-z]?\b/)?.[0] || '';
}

function collectResults(payload, depth = 0, seen = new Set()) {
  if (payload == null || depth > 5) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object' || seen.has(payload)) return [];
  seen.add(payload);

  const preferred = ['results', 'items', 'suggestions', 'data', 'result', 'features'];
  for (const key of preferred) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if (Array.isArray(value)) return value;
    const nested = collectResults(value, depth + 1, seen);
    if (nested.length) return nested;
  }

  for (const value of Object.values(payload)) {
    const nested = collectResults(value, depth + 1, seen);
    if (nested.length) return nested;
  }
  return [];
}

function firstText(...values) {
  return values.map((value) => typeof value === 'string' || typeof value === 'number' ? normalize(value) : '').find(Boolean) || '';
}

function labelFromResult(result, fallback = '') {
  const primary = firstText(
    result?.text,
    result?.caption,
    result?.display_name,
    result?.displayName,
    result?.originalText,
    result?.title,
    result?.name,
    result?.address,
    result?.data?.text,
    result?.data?.caption,
    result?.data?.displayName,
    result?.data?.address,
    result?.data?.name
  );
  const secondary = firstText(
    result?.subtext,
    result?.description,
    result?.city,
    result?.locality,
    result?.settlement,
    result?.data?.subtext,
    result?.data?.description,
    result?.data?.city,
    result?.data?.locality,
    result?.data?.settlement,
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

function queryVariants(query) {
  const normalized = normalize(query);
  const variants = [normalized];
  const withoutComma = normalized.replace(/,/g, ' ');
  if (withoutComma !== normalized) variants.push(normalize(withoutComma));
  const number = houseNumber(normalized);
  if (number) {
    const noNumber = normalize(normalized.replace(new RegExp(`\\b${number}\\b`), ''));
    if (noNumber && noNumber !== normalized) variants.push(noNumber);
  }
  return [...new Set(variants.filter(Boolean))];
}

async function requestGovMap(searchText, signal, mode = 'minimal') {
  const body = { searchText };
  if (mode === 'extended') {
    body.language = 'he';
    body.maxResults = 15;
    body.isAccurate = true;
    if (GOVMAP_TOKEN) body.apiKey = GOVMAP_TOKEN;
  }

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
  if (!input || input.dataset.govMapAutocompleteInstalled === 'true') return;
  input.dataset.govMapAutocompleteInstalled = 'true';
  input.dataset.addressAutocomplete = 'true';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const host = input.closest('.fieldGroup');
  if (!host) return;
  host.classList.add('roofAddressAutocompleteHost');
  host.querySelectorAll('.roofAddressSuggestions,.roofAddressAutocompleteNote').forEach((node) => node.remove());

  const list = document.createElement('div');
  list.className = 'roofAddressSuggestions';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  host.appendChild(list);

  const note = document.createElement('small');
  note.className = 'roofAddressAutocompleteNote';
  note.textContent = 'הקלידו רחוב, מספר ועיר. אפשר לבחור תוצאה מ-GovMap או להמשיך עם הכתובת שהוקלדה.';
  host.appendChild(note);

  input.addEventListener('input', () => {
    if (input.dataset.autocompleteSelecting === 'true') {
      input.dataset.autocompleteSelecting = 'false';
      return;
    }
    input.dataset.officialAddress = '';
    input.dataset.manualAddressAllowed = 'true';
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

  try {
    const merged = [];
    for (const variant of queryVariants(query)) {
      if (requestController.signal.aborted) return;
      let results = await requestGovMap(variant, requestController.signal, 'minimal');
      if (!results.length) results = await requestGovMap(variant, requestController.signal, 'extended');
      merged.push(...results);
      if (uniqueSuggestions(merged, query).length >= 6) break;
    }
    renderSuggestions({ input, list, note, host, suggestions: uniqueSuggestions(merged, query), query });
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderSuggestions({ input, list, note, host, suggestions: [], query, apiFailed: true });
  }
}

function renderSuggestions({ input, list, note, host, suggestions, query, apiFailed = false }) {
  list.replaceChildren();

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
  input.dataset.manualAddressAllowed = 'true';
  note.textContent = suggestions.length
    ? 'בחרו תוצאה של GovMap. אם הכתובת אינה מופיעה, המשיכו עם הטקסט שהוקלד.'
    : apiFailed
      ? 'GovMap לא החזיר הצעות כרגע. אפשר להמשיך עם הכתובת המלאה והמפה תחפש אותה שוב.'
      : 'לא נמצאה הצעה מדויקת. אפשר להמשיך עם הכתובת המלאה והמפה תחפש אותה שוב.';
}

function chooseSuggestion(input, list, note, host, suggestion) {
  const chosenAddress = [suggestion.primary, suggestion.secondary].filter(Boolean).join(', ');
  input.value = chosenAddress;
  input.dataset.autocompleteSelecting = 'true';
  input.dataset.officialAddress = 'true';
  input.dataset.manualAddressAllowed = 'true';
  try { localStorage.setItem(GOVMAP_SELECTION_KEY, JSON.stringify({ address: chosenAddress, result: suggestion.result })); } catch {}
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.officialAddress = 'true';
  input.dataset.manualAddressAllowed = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list, host);
  note.textContent = 'הכתובת נבחרה ב-GovMap והנקודה תועבר למפה.';
  input.focus();
}

function chooseManualAddress(input, list, note, host) {
  input.dataset.manualAddressAllowed = 'true';
  input.dataset.officialAddress = '';
  try { localStorage.removeItem(GOVMAP_SELECTION_KEY); } catch {}
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  closeSuggestions(input, list, host);
  note.textContent = 'הכתובת תישלח כפי שהוקלדה לחיפוש נוסף במפת GovMap.';
  input.focus();
}

function handleKeyboard(event, input, list, host) {
  if (list.hidden) return;
  const options = [...list.querySelectorAll('.roofAddressSuggestion')];
  if (!options.length) return;
  const index = options.indexOf(document.activeElement);
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
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

const style = document.createElement('style');
style.textContent = `
  .roofAddressAutocompleteHost{position:relative;isolation:isolate}
  .roofAddressSuggestions[hidden]{display:none!important}
  .roofAddressSuggestions{position:relative;z-index:20;width:100%;max-height:330px;overflow-y:auto;margin-top:8px;border:1px solid rgba(30,43,55,.14);border-radius:16px;background:#fff;box-shadow:0 12px 28px rgba(26,35,44,.12);padding:6px;direction:rtl}
  .roofAddressSuggestion{display:grid;grid-template-columns:34px minmax(0,1fr);width:100%;align-items:center;gap:10px;border:0;border-bottom:1px solid rgba(30,43,55,.08);border-radius:10px;background:#fff;padding:11px 12px;color:#14283a;font:inherit;text-align:right;cursor:pointer;min-height:58px}
  .roofAddressSuggestion:last-child{border-bottom:0}.roofAddressSuggestion:hover,.roofAddressSuggestion:focus{outline:none;background:#fff4df}.roofAddressManualSuggestion{background:#f7fafc}
  .roofAddressSuggestionPin{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#fff4df;color:#e68a00;font-size:19px;font-weight:900}
  .roofAddressSuggestionText{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:2px}.roofAddressSuggestionText b,.roofAddressSuggestionText small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .roofAddressSuggestionText b{font-weight:900}.roofAddressSuggestionText small{color:#647383;font-size:13px}.roofAddressAutocompleteNote{display:block;margin-top:7px;color:#6c7885;font-size:13px;line-height:1.45}
  .roofAddressAutocompleteHost.suggestionsOpen>input{border-color:#f5a11a!important;box-shadow:0 0 0 3px rgba(245,161,26,.13)!important}
  @media(max-width:760px){.roofAddressSuggestions{max-height:260px}.roofAddressSuggestion{grid-template-columns:32px minmax(0,1fr);min-height:56px;padding:10px}.roofAddressSuggestionPin{width:28px;height:28px}.roofAddressAutocompleteNote{font-size:12px}}
`;
document.head.appendChild(style);

const observer = new MutationObserver(installAutocomplete);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', installAutocomplete);
setTimeout(installAutocomplete, 0);

export { houseNumber, streetQuery, uniqueSuggestions };
