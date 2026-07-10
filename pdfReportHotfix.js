import { buildFullPdfReport as baseBuildFullPdfReport } from './pdfReport.js';

const oldPagePadding = 'padding:12mm 13mm 27mm;page-break-after:always}';
const newPagePadding = 'padding:12mm 13mm 45mm;page-break-after:always}';

const oldFooter = '.bottomWave{position:absolute;left:0;right:0;bottom:0;height:44mm;background:linear-gradient(135deg,#041c33,#07385f);clip-path:ellipse(76% 57% at 50% 100%);z-index:2}';
const newFooter = '.bottomWave{position:absolute;left:8mm;right:8mm;bottom:8mm;height:30mm;background:linear-gradient(135deg,#041c33,#07385f);border-radius:26mm 26mm 8mm 8mm;clip-path:none;z-index:2;overflow:hidden}';

const oldFooterLine = '.bottomWave::before{content:"";position:absolute;left:-5%;right:-5%;top:3mm;height:2mm;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px}';
const newFooterLine = '.bottomWave::before{content:"";position:absolute;left:0;right:0;top:0;height:1.8mm;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:99px}';

const oldFooterItems = '.bottomFeatures{position:absolute;right:18mm;left:18mm;bottom:9mm;z-index:3;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10mm;color:#fff;text-align:center}';
const newFooterItems = '.bottomFeatures{position:absolute;right:22mm;left:22mm;bottom:14mm;z-index:3;display:grid;grid-template-columns:1fr 1fr 1fr;gap:10mm;color:#fff;text-align:center}';

const oldSavingsIcon = [
  '<', 'path d="M5 12a6 5 0 0 1 6-5h4a4 4 0 0 1 4 4v5h-2l-1 3h-3l-1-2H9l-1 2H5l1-3H4v-4h1Z"/', '>',
  '<', 'path d="M15 9h.01M8 7l-2-2"/', '>'
].join('');

const newSavingsIcon = [
  '<', 'path d="M4 7h14a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12"/', '>',
  '<', 'path d="M16 12h4v4h-4z"/', '>',
  '<', 'circle cx="8" cy="12" r="1.4"/', '>',
  '<', 'path d="M7 16h6"/', '>'
].join('');

const leadStyles = `.leadPdfBox{margin-top:6mm;padding:5mm;border:1px solid rgba(242,138,0,.35);border-radius:14px;background:#fff9ec;display:grid;grid-template-columns:1fr 1fr;gap:3mm}.leadPdfBox b{display:block;color:var(--navy);font-size:13px}.leadPdfBox span{display:block;color:var(--muted);font-size:11px;font-weight:760;direction:ltr;text-align:right}.leadPdfDisclaimer{margin-top:4mm;color:var(--muted);font-size:10px;font-weight:760;line-height:1.4}`;

export function buildFullPdfReport(args) {
  const state = args?.state || {};
  const leadBox = `<div class="leadPdfBox"><div><b>איש קשר</b><span>${escapeHtml(state.leadName || '—')}</span></div><div><b>טלפון</b><span>${escapeHtml(state.leadPhone || '—')}</span></div><div><b>אימייל</b><span>${escapeHtml(state.leadEmail || '—')}</span></div><div><b>מקור</b><span>Roof Check staging</span></div></div><div class="leadPdfDisclaimer">הדוח הוא הערכה ראשונית בלבד. לפני הצעה סופית נדרש סיור מקצועי, בדיקת חשמל, קונסטרוקציה ואישור חיבור.</div>`;

  return baseBuildFullPdfReport(args)
    .replace(oldPagePadding, newPagePadding)
    .replace(oldFooter, newFooter)
    .replace(oldFooterLine, newFooterLine)
    .replace(oldFooterItems, newFooterItems)
    .replace('</style>', `${leadStyles}</style>`)
    .replace('<div class="summaryStrip card">', `<div class="summaryStrip card">${leadBox}`)
    .split(oldSavingsIcon)
    .join(newSavingsIcon);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
