const ROOF_TYPE_KEY = 'solatrix_roof_type';
const MONTHLY_BILL_KEY = 'solatrix_monthly_bill';
const ADDRESS_KEY = 'solatrix_roof_check_address';
const URBAN_CACHE_KEY = 'solatrix_urban_bonus_cache_v1';
const URBAN_OVERRIDE_KEY = 'solatrix_urban_bonus_override_v1';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

const CONFIG = {
  productionPerKw: 1650,
  buyRate: 0.64,
  homeExportRate: 0.48,
  commercialExportRate: 0.40,
  urbanBonusRate: 0.06,
  urbanBonusYears: 10,
  contractYears: 25,
  urbanPopulationThreshold: 50000,
  installCostPerKw: 2900,
  sqmPerKw: 7,
  panelKw: 0.63,
  usableRoofFactor: 0.82,
  vatRate: 0.18,
  homeSystemLimitKw: 22.5,
  defaultSelfUseShare: 0.4,
  electricityGrowthRate: 0.04
};

const FALLBACK_URBAN_LOCALITIES = new Set([
  'ירושלים','jerusalem','תל אביב יפו','תל אביב','tel aviv yafo','tel aviv','חיפה','haifa',
  'ראשון לציון','rishon lezion','פתח תקווה','petah tikva','אשדוד','ashdod','נתניה','netanya',
  'בני ברק','bnei brak','חולון','holon','באר שבע','beer sheva','beersheba','רמת גן','ramat gan',
  'אשקלון','ashkelon','רחובות','rehovot','בת ים','bat yam','בית שמש','beit shemesh',
  'כפר סבא','kfar saba','הרצליה','herzliya','חדרה','hadera','מודיעין מכבים רעות','modiin',
  'נצרת','nazareth','לוד','lod','רמלה','ramla','רעננה','raanana','רהט','rahat',
  'גבעתיים','givatayim','הוד השרון','hod hasharon','קריית אתא','kiryat ata','אום אל פחם','umm al fahm',
  'אילת','eilat','עכו','acre','עפולה','afula','נהריה','nahariya','ראש העין','rosh haayin',
  'יבנה','yavne','קריית גת','kiryat gat','נס ציונה','ness ziona','טבריה','tiberias','כרמיאל','karmiel'
]);

let applying = false;
let lastSignature = '';
let urbanDetection = {
  key: '',
  status: 'idle',
  eligible: false,
  locality: '',
  population: null,
  source: '',
  error: ''
};

function readStored(key, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, String(value ?? '')); } catch {}
}

function readJson(key, fallback = {}) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[׳״'"`.,()\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rememberCalculatorInput(event) {
  const field = event.target?.dataset?.field;
  if (field === 'monthlyBill') writeStored(MONTHLY_BILL_KEY, event.target.value);
  if (field === 'address') {
    writeStored(ADDRESS_KEY, event.target.value);
    urbanDetection = { key: '', status: 'idle', eligible: false, locality: '', population: null, source: '', error: '' };
  }
}

function rememberRoofType(event) {
  const action = event.target?.closest?.('[data-action^="roof:"]')?.dataset?.action;
  if (!action) return;
  writeStored(ROOF_TYPE_KEY, action.split(':')[1] || 'flat');
}

function syncVisibleRoofType() {
  const selected = document.querySelector('.roofOption.selected[data-action^="roof:"]');
  if (!selected) return;
  writeStored(ROOF_TYPE_KEY, selected.dataset.action.split(':')[1] || 'flat');
}

function calculatorState() {
  const roofType = readStored(ROOF_TYPE_KEY, 'flat');
  const monthlyBill = Math.max(0, Number(readStored(MONTHLY_BILL_KEY, '850')) || 850);
  const address = readStored(ADDRESS_KEY, '');
  const state = { roofType, monthlyBill, address };
  window.__solatrixRoofCheckState = { ...(window.__solatrixRoofCheckState || {}), ...state };
  return state;
}

function surfaceCentroid() {
  const points = (Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [])
    .flatMap((surface) => surface?.latlngs || [])
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  if (!points.length) return null;
  return points.reduce((acc, point) => ({
    lat: acc.lat + point.lat / points.length,
    lng: acc.lng + point.lng / points.length
  }), { lat: 0, lng: 0 });
}

function locationKey() {
  const center = surfaceCentroid();
  if (center) return `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
  return normalize(readStored(ADDRESS_KEY, ''));
}

function currentOverride(key) {
  const overrides = readJson(URBAN_OVERRIDE_KEY, {});
  return overrides[key] || '';
}

function setOverride(key, value) {
  const overrides = readJson(URBAN_OVERRIDE_KEY, {});
  if (value === 'auto') delete overrides[key];
  else overrides[key] = value;
  writeJson(URBAN_OVERRIDE_KEY, overrides);
  lastSignature = '';
}

function extractLocality(address = {}) {
  return address.city || address.town || address.municipality || address.village || address.city_district || address.county || '';
}

function populationFromClaims(entity) {
  const claims = entity?.claims?.P1082 || [];
  const values = claims
    .map((claim) => {
      const amount = claim?.mainsnak?.datavalue?.value?.amount;
      const population = Number(String(amount || '').replace('+', ''));
      const pointInTime = claim?.qualifiers?.P585?.[0]?.datavalue?.value?.time || '';
      const rankScore = claim?.rank === 'preferred' ? 2 : claim?.rank === 'normal' ? 1 : 0;
      return Number.isFinite(population) ? { population, pointInTime, rankScore } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.rankScore - a.rankScore || String(b.pointInTime).localeCompare(String(a.pointInTime)) || b.population - a.population);
  return values[0]?.population || null;
}

function isIsraelEntity(entity) {
  const countries = entity?.claims?.P17 || [];
  return countries.some((claim) => claim?.mainsnak?.datavalue?.value?.id === 'Q801');
}

async function fetchWikidataPopulation(locality, preferredQid = '') {
  let ids = preferredQid ? [preferredQid] : [];
  if (!ids.length) {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: locality,
      language: /[א-ת]/.test(locality) ? 'he' : 'en',
      uselang: 'en',
      limit: '8',
      format: 'json',
      origin: '*'
    });
    const searchResponse = await fetch(`${WIKIDATA_API}?${searchParams.toString()}`);
    if (!searchResponse.ok) throw new Error(`Wikidata search failed: ${searchResponse.status}`);
    const searchPayload = await searchResponse.json();
    ids = (searchPayload.search || []).map((item) => item.id).filter(Boolean);
  }
  if (!ids.length) return null;

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'claims|labels',
    languages: 'he|en',
    format: 'json',
    origin: '*'
  });
  const entityResponse = await fetch(`${WIKIDATA_API}?${entityParams.toString()}`);
  if (!entityResponse.ok) throw new Error(`Wikidata entity failed: ${entityResponse.status}`);
  const payload = await entityResponse.json();
  const entities = Object.values(payload.entities || {});
  const candidates = entities
    .filter((entity) => !entity.missing)
    .map((entity) => ({ entity, population: populationFromClaims(entity), israel: isIsraelEntity(entity) }))
    .filter((item) => item.population)
    .sort((a, b) => Number(b.israel) - Number(a.israel) || b.population - a.population);
  return candidates[0] || null;
}

function fallbackUrbanMatch(locality, addressText = '') {
  const normalizedLocality = normalize(locality);
  const normalizedAddress = normalize(addressText);
  for (const alias of FALLBACK_URBAN_LOCALITIES) {
    const normalizedAlias = normalize(alias);
    if (normalizedLocality === normalizedAlias || normalizedAddress.includes(normalizedAlias)) return true;
  }
  return false;
}

async function detectUrbanEligibility() {
  const key = locationKey();
  if (!key) return;
  if (urbanDetection.key === key && ['loading', 'ready', 'unknown'].includes(urbanDetection.status)) return;

  const cache = readJson(URBAN_CACHE_KEY, {});
  if (cache[key]) {
    urbanDetection = { key, status: 'ready', ...cache[key] };
    return;
  }

  urbanDetection = { key, status: 'loading', eligible: false, locality: '', population: null, source: '', error: '' };
  lastSignature = '';

  try {
    const center = surfaceCentroid();
    let locality = '';
    let qid = '';
    if (center) {
      const params = new URLSearchParams({
        format: 'jsonv2',
        lat: String(center.lat),
        lon: String(center.lng),
        zoom: '10',
        addressdetails: '1',
        extratags: '1',
        'accept-language': 'he'
      });
      const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params.toString()}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.status}`);
      const payload = await response.json();
      locality = extractLocality(payload.address || '');
      qid = payload.extratags?.wikidata || '';
    }

    const addressText = readStored(ADDRESS_KEY, '');
    if (!locality) {
      locality = addressText.split(',')[0]?.trim() || addressText;
    }

    let population = null;
    let source = '';
    try {
      const wikidata = await fetchWikidataPopulation(locality, qid);
      population = wikidata?.population || null;
      source = population ? 'wikidata' : '';
    } catch (error) {
      console.warn('Urban population lookup failed', error);
    }

    let eligible;
    if (population != null) {
      eligible = population > CONFIG.urbanPopulationThreshold;
    } else if (fallbackUrbanMatch(locality, addressText)) {
      eligible = true;
      source = 'fallback-list';
    } else {
      urbanDetection = {
        key,
        status: 'unknown',
        eligible: false,
        locality,
        population: null,
        source: '',
        error: 'population-not-verified'
      };
      return;
    }

    const result = { eligible, locality, population, source, error: '' };
    cache[key] = result;
    writeJson(URBAN_CACHE_KEY, cache);
    urbanDetection = { key, status: 'ready', ...result };
  } catch (error) {
    console.warn('Urban premium detection failed', error);
    const addressText = readStored(ADDRESS_KEY, '');
    const eligible = fallbackUrbanMatch('', addressText);
    urbanDetection = {
      key,
      status: eligible ? 'ready' : 'unknown',
      eligible,
      locality: addressText.split(',')[0]?.trim() || '',
      population: null,
      source: eligible ? 'fallback-list' : '',
      error: eligible ? '' : String(error?.message || error)
    };
  } finally {
    lastSignature = '';
  }
}

function urbanEligibility() {
  const key = locationKey();
  const override = currentOverride(key);
  if (override === 'yes') return { eligible: true, mode: 'manual', key };
  if (override === 'no') return { eligible: false, mode: 'manual', key };
  return { eligible: urbanDetection.key === key && urbanDetection.status === 'ready' ? urbanDetection.eligible : false, mode: 'auto', key };
}

function calculate() {
  const surfaces = Array.isArray(window.__solatrixRoofSurfaces) ? window.__solatrixRoofSurfaces : [];
  const roofArea = surfaces.reduce((sum, surface) => sum + Number(surface?.area || 0), 0);
  if (!(roofArea > 0)) return null;

  const { roofType, monthlyBill, address } = calculatorState();
  const urban = urbanEligibility();
  const usableArea = roofArea * CONFIG.usableRoofFactor;
  const roofPotentialKw = usableArea / CONFIG.sqmPerKw;
  const isCommercial = roofType === 'commercial';
  const systemKw = isCommercial ? roofPotentialKw : Math.min(roofPotentialKw, CONFIG.homeSystemLimitKw);
  const annualProduction = systemKw * CONFIG.productionPerKw;
  const annualConsumption = isCommercial ? 0 : (monthlyBill * 12) / CONFIG.buyRate;
  const selfConsumed = isCommercial ? 0 : Math.min(annualProduction * CONFIG.defaultSelfUseShare, annualConsumption);
  const exported = Math.max(annualProduction - selfConsumed, 0);
  const baseExportRate = isCommercial ? CONFIG.commercialExportRate : CONFIG.homeExportRate;
  const annualRevenueByYear = [];

  for (let year = 0; year < CONFIG.contractYears; year += 1) {
    const urbanBonus = urban.eligible && year < CONFIG.urbanBonusYears ? CONFIG.urbanBonusRate : 0;
    if (isCommercial) {
      annualRevenueByYear.push(annualProduction * (baseExportRate + urbanBonus));
    } else {
      const selfUseValue = selfConsumed * CONFIG.buyRate * Math.pow(1 + CONFIG.electricityGrowthRate, year);
      const exportValue = exported * (baseExportRate + urbanBonus);
      annualRevenueByYear.push(selfUseValue + exportValue);
    }
  }

  const annualSavings = annualRevenueByYear[0] || 0;
  const effectiveTariff = annualSavings / Math.max(annualProduction, 1);
  const costBeforeVat = systemKw * CONFIG.installCostPerKw;
  const costWithVat = costBeforeVat * (1 + CONFIG.vatRate);
  const paybackBeforeVat = costBeforeVat / Math.max(annualSavings, 1);
  const paybackWithVat = costWithVat / Math.max(annualSavings, 1);
  const gross25 = annualRevenueByYear.reduce((sum, value) => sum + value, 0);
  const profit25WithVat = gross25 - costWithVat;
  const panels = Math.max(Math.floor(systemKw / CONFIG.panelKw), 1);
  const urbanBonusTotal = urban.eligible
    ? exported * CONFIG.urbanBonusRate * Math.min(CONFIG.urbanBonusYears, CONFIG.contractYears)
    : 0;

  const report = {
    roofType,
    isCommercial,
    address,
    monthlyBill,
    roofArea,
    usableArea,
    roofPotentialKw,
    systemKw,
    annualProduction,
    annualConsumption,
    selfConsumed,
    exported,
    baseExportRate,
    annualSavings,
    annualRevenueByYear,
    effectiveTariff,
    costBeforeVat,
    costWithVat,
    paybackBeforeVat,
    paybackWithVat,
    gross25,
    profit25WithVat,
    panels,
    limitApplied: !isCommercial && roofPotentialKw > CONFIG.homeSystemLimitKw,
    urbanEligible: urban.eligible,
    urbanDetectionMode: urban.mode,
    urbanLocality: urbanDetection.locality,
    urbanPopulation: urbanDetection.population,
    urbanDetectionStatus: urbanDetection.status,
    urbanDetectionSource: urbanDetection.source,
    urbanBonusRate: CONFIG.urbanBonusRate,
    urbanBonusYears: CONFIG.urbanBonusYears,
    urbanBonusTotal,
    tariffContractYears: CONFIG.contractYears,
    consumerTariffGrowthRate: isCommercial ? 0 : CONFIG.electricityGrowthRate
  };

  window.__solatrixRoofCalculation = report;
  return report;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('he-IL');
}

function formatMoney(value) {
  return `₪${formatNumber(value)}`;
}

function ensureStyles() {
  if (document.getElementById('solatrix-tariff-model-style')) return;
  const style = document.createElement('style');
  style.id = 'solatrix-tariff-model-style';
  style.textContent = `
    .solatrixTariffModel{margin:18px 0 22px;padding:17px;border-radius:20px;background:#f7fbff;border:1px solid #d9e8f6;color:#17324a}
    .solatrixTariffModel h3{margin:0 0 9px;font-size:18px;color:#071b2f}
    .solatrixTariffModel p{margin:5px 0;font-size:14px;font-weight:750;line-height:1.45}
    .solatrixTariffModel strong{color:#0b6fff}
    .solatrixTariffModel .urbanPositive{color:#16734a}
    .solatrixTariffModel .urbanUnknown{color:#9a6410}
    .solatrixTariffActions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .solatrixTariffActions button{border:1px solid #cbd8e6;border-radius:999px;background:#fff;padding:8px 12px;font:inherit;font-size:13px;font-weight:900;color:#174b7d;cursor:pointer}
    .solatrixTariffActions button.active{background:#0b6fff;color:#fff;border-color:#0b6fff}
  `;
  document.head.appendChild(style);
}

function ensureHiddenContext(reportCard, report) {
  let context = reportCard.querySelector('[data-solatrix-report-context]');
  if (!context) {
    context = document.createElement('div');
    context.dataset.solatrixReportContext = 'true';
    context.hidden = true;
    context.innerHTML = '<input data-field="address"><input data-field="monthlyBill"><input data-field="roofType"><input data-field="urbanEligible"><input data-field="urbanLocality">';
    reportCard.appendChild(context);
  }
  context.querySelector('[data-field="address"]').value = report.address || '';
  context.querySelector('[data-field="monthlyBill"]').value = String(report.monthlyBill || '');
  context.querySelector('[data-field="roofType"]').value = report.roofType;
  context.querySelector('[data-field="urbanEligible"]').value = report.urbanEligible ? 'true' : 'false';
  context.querySelector('[data-field="urbanLocality"]').value = report.urbanLocality || '';
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function renderTariffModel(reportCard, report) {
  ensureStyles();
  let card = reportCard.querySelector('.solatrixTariffModel');
  if (!card) {
    card = document.createElement('section');
    card.className = 'solatrixTariffModel';
    reportCard.querySelector('h2')?.insertAdjacentElement('afterend', card);
  }

  const key = locationKey();
  const override = currentOverride(key);
  let urbanLine;
  if (urbanDetection.status === 'loading') {
    urbanLine = '<p class="urbanUnknown">בודקים זכאות לתוספת אורבנית לפי מיקום הגג...</p>';
  } else if (report.urbanEligible) {
    const populationText = report.urbanPopulation ? ` (${formatNumber(report.urbanPopulation)} תושבים)` : '';
    urbanLine = `<p class="urbanPositive"><strong>תוספת אורבנית:</strong> ₪0.06 לקוט״ש ב-10 השנים הראשונות${report.urbanLocality ? ` — ${report.urbanLocality}${populationText}` : ''}.</p>`;
  } else if (urbanDetection.status === 'unknown') {
    urbanLine = '<p class="urbanUnknown">לא הצלחנו לאמת אוטומטית אם היישוב מעל 50,000 תושבים. ניתן לקבוע ידנית.</p>';
  } else {
    const populationText = report.urbanPopulation ? ` (${formatNumber(report.urbanPopulation)} תושבים)` : '';
    urbanLine = `<p><strong>תוספת אורבנית:</strong> לא חושבה${report.urbanLocality ? ` — ${report.urbanLocality}${populationText}` : ''}.</p>`;
  }

  card.innerHTML = report.isCommercial
    ? `<h3>מודל התעריף שחושב</h3><p><strong>גג מסחרי:</strong> ₪0.40 קבוע לקוט״ש למשך 25 שנה, ללא עלייה של 4%.</p>${urbanLine}<div class="solatrixTariffActions"><button data-urban-override="yes" class="${override === 'yes' ? 'active' : ''}">זכאי לתוספת</button><button data-urban-override="no" class="${override === 'no' ? 'active' : ''}">לא זכאי</button><button data-urban-override="auto" class="${!override ? 'active' : ''}">בדיקה אוטומטית</button></div>`
    : `<h3>מודל התעריף שחושב</h3><p><strong>גג ביתי:</strong> ₪0.48 לקוט״ש שנמכר, ועליית 4% בשנה חלה על ערך החשמל שנחסך בצריכה עצמית.</p>${urbanLine}<div class="solatrixTariffActions"><button data-urban-override="yes" class="${override === 'yes' ? 'active' : ''}">זכאי לתוספת</button><button data-urban-override="no" class="${override === 'no' ? 'active' : ''}">לא זכאי</button><button data-urban-override="auto" class="${!override ? 'active' : ''}">בדיקה אוטומטית</button></div>`;
}

function applyReport() {
  if (applying || !(location.pathname || '').includes('/report')) return;
  const reportCard = document.querySelector('.reportCard');
  if (!reportCard) return;
  const report = calculate();
  if (!report) return;

  const signature = [
    report.roofType,
    report.monthlyBill,
    report.roofArea.toFixed(2),
    report.systemKw.toFixed(3),
    report.annualSavings.toFixed(2),
    report.urbanEligible,
    report.urbanDetectionStatus,
    report.urbanPopulation || ''
  ].join('|');
  if (signature === lastSignature && reportCard.dataset.calculationSignature === signature) return;

  applying = true;
  try {
    const title = reportCard.querySelector('h2');
    setText(title, `הגג מתאים למערכת של כ-${report.systemKw.toFixed(1)} kW`);

    const hero = [...reportCard.querySelectorAll('.reportHeroGraphic > div')];
    setText(hero[0]?.querySelector('strong'), formatMoney(report.annualSavings));
    setText(hero[0]?.querySelector('span'), report.isCommercial ? 'הכנסה בשנה הראשונה' : 'חיסכון בשנה הראשונה');
    setText(hero[1]?.querySelector('strong'), report.paybackWithVat.toFixed(1));
    setText(hero[1]?.querySelector('span'), 'החזר כולל מע״מ');

    const rows = [...reportCard.querySelectorAll('.resultsGrid > div')];
    const values = [
      ['עלות לפני מע״מ', formatMoney(report.costBeforeVat)],
      ['עלות כולל מע״מ', formatMoney(report.costWithVat)],
      ['ייצור שנתי', `${formatNumber(report.annualProduction)} kWh`],
      ['תעריף ממוצע בשנה 1', `₪${report.effectiveTariff.toFixed(3)}`],
      ['החזר לפני מע״מ', `${report.paybackBeforeVat.toFixed(1)} שנים`],
      ['רווח 25 שנים', formatMoney(report.profit25WithVat)]
    ];
    rows.forEach((row, index) => {
      const item = values[index];
      if (!item) return;
      setText(row.querySelector('span'), item[0]);
      setText(row.querySelector('b'), item[1]);
    });

    reportCard.dataset.roofType = report.roofType;
    reportCard.dataset.systemKw = report.systemKw.toFixed(3);
    reportCard.dataset.calculationSignature = signature;
    ensureHiddenContext(reportCard, report);
    renderTariffModel(reportCard, report);
    lastSignature = signature;
  } finally {
    applying = false;
  }
}

function handleUrbanOverride(event) {
  const button = event.target?.closest?.('[data-urban-override]');
  if (!button) return;
  setOverride(locationKey(), button.dataset.urbanOverride || 'auto');
  applyReport();
}

function tick() {
  syncVisibleRoofType();
  calculatorState();
  detectUrbanEligibility();
  applyReport();
}

document.addEventListener('input', rememberCalculatorInput, true);
document.addEventListener('click', rememberRoofType, true);
document.addEventListener('click', handleUrbanOverride, true);

const observer = new MutationObserver(() => {
  if (!applying && (location.pathname || '').includes('/report')) queueMicrotask(applyReport);
});
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

window.addEventListener('popstate', () => setTimeout(tick, 50));
setInterval(tick, 350);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
