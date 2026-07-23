const GOVMAP_AUTOCOMPLETE_URL = 'https://www.govmap.gov.il/api/search-service/autocomplete';
const GOVMAP_SELECTION_KEY = 'solatrix_govmap_address_selection_v1';
const INSTALL_FLAG = '__solatrixGovMapAutocompleteBridgeV1';

function normalize(value = '') {
  return String(value).replace(/[،]/g, ',').replace(/\s+/g, ' ').trim();
}

function selectedResultFor(searchText) {
  try {
    const saved = JSON.parse(localStorage.getItem(GOVMAP_SELECTION_KEY) || 'null');
    if (!saved?.result) return null;
    const selectedAddress = normalize(saved.address);
    const requestedAddress = normalize(searchText);
    if (!selectedAddress || !requestedAddress) return null;
    if (selectedAddress === requestedAddress || selectedAddress.includes(requestedAddress) || requestedAddress.includes(selectedAddress)) {
      return saved.result;
    }
  } catch {}
  return null;
}

function responseWithResults(results) {
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function installGovMapAutocompleteBridge() {
  if (typeof window === 'undefined' || window[INSTALL_FLAG]) return;
  window[INSTALL_FLAG] = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function solatrixGovMapAutocompleteFetch(input, init = {}) {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    let parsedUrl;
    try { parsedUrl = new URL(requestUrl, location.href); } catch { return originalFetch(input, init); }

    if (parsedUrl.href !== GOVMAP_AUTOCOMPLETE_URL) return originalFetch(input, init);

    let requestBody = {};
    try { requestBody = typeof init.body === 'string' ? JSON.parse(init.body) : (init.body || {}); } catch {}
    const searchText = normalize(requestBody.searchText || parsedUrl.searchParams.get('searchText') || '');
    if (!searchText) return originalFetch(input, init);

    const selected = selectedResultFor(searchText);
    if (selected) return responseWithResults([selected]);

    const normalizedInit = {
      ...init,
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchText })
    };

    const response = await originalFetch(GOVMAP_AUTOCOMPLETE_URL, normalizedInit);
    if (response.ok) return response;

    const token = String(import.meta.env.VITE_GOVMAP_API_TOKEN || '').trim();
    if (!token) return response;
    return originalFetch(GOVMAP_AUTOCOMPLETE_URL, {
      ...normalizedInit,
      body: JSON.stringify({ searchText, apiKey: token })
    });
  };
}

installGovMapAutocompleteBridge();

export { installGovMapAutocompleteBridge };
