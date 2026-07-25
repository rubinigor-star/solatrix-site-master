const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_TOKEN = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
const GOVMAP_SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 320;

let controller = null;
let timer = 0;

function normalize(value = '') {
  return String(value).replace(/[،]/g, ',').replace(/\s+/g, ' ').trim();
}

function hasHebrew(value = '') {
  return /[\u0590-\u05FF]/.test(String(value));
}

function hasLatin(value = '') {
  return /[A-Za-z]/.test(String(value));
}

function cleanHebrew(value = '') {
  const text = normalize(value);
  if (!hasHebrew(text)) return '';
  return normalize(text.replace(/[A-Za-z]+(?:[\s-]+[A-Za-z]+)*/g, '').replace(/\s*,\s*,+/g, ',').replace(/^\s*,|,\s*$/g, ''));
}

function collectResults(payload, depth = 0, seen = new Set()) {
  if (payload == null || depth > 6) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object' || seen.has(payload)) return [];
  seen.add(payload);
  for (const key of ['results', 'items', 'suggestions', 'data', 'result', 'features']) {
    if (!(key in payload)) continue;
    const nested = collectResults(payload[key], depth + 1, seen);
    if (nested.length) return nested;
  }
  for (const value of Object.values(payload)) {
    const nested = collectResults(value, depth + 1, seen);
    if (nested.length) return nested;
  }
  return [];
}

function textCandidates(result = {}) {
  const data = result?.data || {};
  return [
    result.addressHebrew, result.hebrewAddress, result.text, result.caption,
    result.displayName, result.originalText, result.address, result.title, result.name,
    data.addressHebrew, data.hebrewAddress, data.text, data.caption,
    data.displayName, data.address, data.name
  ];
}

function cityCandidates(result = {}) {
  const data = result?.data || {};
  return [
    result.cityHebrew, result.settlementHebrew, result.city, result.locality,
    result.settlement, result.subtext, data.cityHebrew, data.settlementHebrew,
    data.city, data.locality, data.settlement, data.יישוב, data.subtext
  ];
}

function suggestionFromResult(result) {
  const primary = textCandidates(result).map(cleanHebrew).find(Boolean) || '';
  if (!primary || hasLatin(primary)) return null;
  let secondary = cityCandidates(result).map(cleanHebrew).find(Boolean) || '';
  if (secondary && primary.includes(secondary)) secondary = '';
  if (hasLatin(secondary)) secondary = '';
  return { result, primary, secondary };
}

function uniqueSuggestions(results) {
  const seen = new Set();
  return results
    .map(suggestionFromResult)
    .filter(Boolean)
    .filter((item) => {
      const key = `${item.primary}|${item.secondary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

async function requestGovMap(searchText, signal) {
  const body = {
    searchText: normalize(searchText),
    language: 'he',
    filterType: 'address',
    maxResults: 20,
    isAccurate: true
  };
  if (GOVMAP_TOKEN) body.apiKey = GOVMAP_TOKEN;
  const response = await fetch(GOVMAP_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) throw new Error(`GovMap address search failed: ${response.status}`);
  return collectResults(await response.json());
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function close(input, list, host) {
  list.hidden = true;
  host.classList.remove('suggestionsOpen');
  input.setAttribute('aria-expanded', 'false');
}

function choose(input, list, note, host, suggestion) {
  const address = [suggestion.primary, suggestion.secondary].filter(Boolean).join(', ');
  input.value = address;
  input.dataset.autocompleteSelecting = 'true';
  input.dataset.officialAddress = 'true';
  try { localStorage.setItem(GOVMAP_SELECTION_KEY, JSON.stringify({ address, result: suggestion.result })); } catch {}
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.officialAddress = 'true';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  close(input, list, host);
  note.textContent = 'הכתובת נבחרה מתוך GovMap והמיקום המדויק יועבר למפה.';
}

function render({ input, list, note, host, suggestions }) {
  list.replaceChildren();
  suggestions.forEach((suggestion) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'roofAddressSuggestion';
    button.innerHTML = `<span class="roofAddressSuggestionPin">⌖</span><span class="roofAddressSuggestionText"><b>${escapeHtml(suggestion.primary)}</b>${suggestion.secondary ? `<small>${escapeHtml(suggestion.secondary)}</small>` : ''}</span>`;
    button.addEventListener('mousedown', (e) => e.preventDefault());
    button.addEventListener('click', () => choose(input, list, note, host, suggestion));
    list.appendChild(button);
  });
  list.hidden = suggestions.length === 0;
  host.classList.toggle('suggestionsOpen', suggestions.length > 0);
  input.setAttribute('aria-expanded', suggestions.length ? 'true' : 'false');
  note.textContent = suggestions.length
    ? 'בחרו כתובת רשמית בעברית מתוך GovMap.'
    : 'לא נמצאה כתובת רשמית בעברית. בדקו רחוב, מספר ועיר.';
}

async function search({ input, list, note, host, query }) {
  controller?.abort();
  controller = new AbortController();
  note.textContent = 'מחפשים כתובת רשמית ב-GovMap…';
  try {
    const results = await requestGovMap(query, controller.signal);
    render({ input, list, note, host, suggestions: uniqueSuggestions(results) });
  } catch (error) {
    if (error.name !== 'AbortError') render({ input, list, note, host, suggestions: [] });
  }
}

function install() {
  const input = document.querySelector('[data-field="address"]');
  if (!input || input.dataset.govMapAutocompleteInstalled === 'hebrew-v2') return;
  input.dataset.govMapAutocompleteInstalled = 'hebrew-v2';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('lang', 'he');
  input.setAttribute('dir', 'rtl');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  const host = input.closest('.fieldGroup');
  if (!host) return;
  host.classList.add('roofAddressAutocompleteHost');
  host.querySelectorAll('.roofAddressSuggestions,.roofAddressAutocompleteNote').forEach((node) => node.remove());

  const list = document.createElement('div');
  list.className = 'roofAddressSuggestions';
  list.hidden = true;
  host.appendChild(list);

  const note = document.createElement('small');
  note.className = 'roofAddressAutocompleteNote';
  note.textContent = 'הקלידו כתובת בעברית: רחוב, מספר ועיר.';
  host.appendChild(note);

  input.addEventListener('input', () => {
    if (input.dataset.autocompleteSelecting === 'true') {
      input.dataset.autocompleteSelecting = 'false';
      return;
    }
    input.dataset.officialAddress = '';
    try { localStorage.removeItem(GOVMAP_SELECTION_KEY); } catch {}
    clearTimeout(timer);
    const query = normalize(input.value);
    if (query.length < MIN_QUERY_LENGTH) {
      close(input, list, host);
      return;
    }
    timer = setTimeout(() => search({ input, list, note, host, query }), DEBOUNCE_MS);
  });
  input.addEventListener('blur', () => setTimeout(() => close(input, list, host), 180));
}

const style = document.createElement('style');
style.textContent = `
.roofAddressAutocompleteHost{position:relative;isolation:isolate}
.roofAddressSuggestions[hidden]{display:none!important}
.roofAddressSuggestions{position:relative;z-index:30;width:100%;max-height:300px;overflow:auto;margin-top:8px;border:1px solid rgba(30,43,55,.14);border-radius:16px;background:#fff;box-shadow:0 12px 28px rgba(26,35,44,.12);padding:6px;direction:rtl}
.roofAddressSuggestion{display:grid;grid-template-columns:34px 1fr;width:100%;align-items:center;gap:10px;border:0;border-bottom:1px solid rgba(30,43,55,.08);border-radius:10px;background:#fff;padding:11px 12px;color:#14283a;font:inherit;text-align:right;cursor:pointer;min-height:58px}
.roofAddressSuggestion:hover,.roofAddressSuggestion:focus{outline:none;background:#fff4df}
.roofAddressSuggestionPin{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#fff4df;color:#e68a00;font-size:19px;font-weight:900}
.roofAddressSuggestionText{display:flex;min-width:0;flex-direction:column;align-items:flex-start;gap:2px}.roofAddressSuggestionText b,.roofAddressSuggestionText small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roofAddressSuggestionText small{color:#647383;font-size:13px}.roofAddressAutocompleteNote{display:block;margin-top:7px;color:#6c7885;font-size:13px;line-height:1.45}
`;
document.head.appendChild(style);

const observer = new MutationObserver(install);
observer.observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();

export { uniqueSuggestions };
