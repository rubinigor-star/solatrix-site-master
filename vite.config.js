import { defineConfig } from 'vite';

const SITE_WIDE_SCRIPT_SKIP = new Set(['roof-check.html', 'roof-check/index.html', 'admin.html', 'pdf-preview.html']);
const HOMEPAGE_SECTION_TEXTS_TO_REMOVE = ['הבעיה היא לא המערכת', 'כל גג נראה אחרת'];

const PDF_IMAGE_MODULES = new Map([
  ['./assets/roof-check-report/roof-check-cover-hero.webp', '\0solatrix-pdf-cover'],
  ['./assets/roof-check-report/roof-check-installers.webp', '\0solatrix-pdf-installers'],
  ['./assets/roof-check-report/roof-check-family.webp', '\0solatrix-pdf-family']
]);

const PDF_IMAGE_URLS = {
  '\0solatrix-pdf-cover': 'https://raw.githubusercontent.com/rubinigor-star/solatrix-site-master/main/roof-check/pdf%201%20update.jpg?v=4',
  '\0solatrix-pdf-installers': 'https://rubinigor-star.github.io/solatrix-site-master/assets/hero/pdf2.jpg?v=4',
  '\0solatrix-pdf-family': 'https://rubinigor-star.github.io/solatrix-site-master/assets/hero/pdf3.jpg?v=4'
};

const PDF_COPY_REPLACEMENTS = [
  ['סיכום הבדיקה', 'סיכום ראשוני'],
  ['הנתונים מציגים סדר גודל ראשוני של התאמת הגג, הייצור, החיסכון והחזר ההשקעה. החישוב ישמש בסיס לשיחה מקצועית עם נציג Solatrix Energy.', 'הנתונים שלפניכם מציגים הערכה ראשונית של פוטנציאל המערכת הסולארית על גגכם. לאחר בדיקה מקצועית ניתן יהיה להכין תכנון מלא, הצעת מחיר מדויקת וליווי מלא עד להפעלת המערכת.'],
  ['החזר כולל מע״מ', 'תקופת החזר השקעה'],
  ["['כתובת',", "['כתובת הנכס',"],
  ["['שטח שסומן',", "['שטח הגג שסומן',"],
  ["['הופק בתאריך',", "['תאריך הפקה',"],
  ['המספר המרכזי', 'תפוקת חשמל שנתית'],
  ['ייצור שנתי משוער של המערכת בהתאם להספק ולשטח הגג.', 'ייצור החשמל השנתי הצפוי בהתאם לשטח הגג, הספק המערכת ותנאי ההתקנה.'],
  ['המספרים מאחורי ההערכה', 'פירוט התוצאות'],
  ['נתוני גג ותעריף', 'נתוני הפרויקט'],
  ['העתק הדוח נשמר בכרטיס הלקוח וניתן יהיה לשלוח אותו ל-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.', 'עותק הדוח נשמר בכרטיס הלקוח וניתן יהיה לשלוח אותו ב-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.'],
  ['מערכות סולאריות, אגירה וליווי מקצועי משלב הבדיקה ועד הפעלת המערכת.', 'תכנון, התקנה וליווי מקצועי של מערכות סולאריות ואגירת אנרגיה משלב הבדיקה ועד הפעלת המערכת.']
];

function useUploadedPdfImages() {
  return {
    name: 'solatrix-uploaded-pdf-images',
    enforce: 'pre',
    resolveId(source) { return PDF_IMAGE_MODULES.get(source) || null; },
    load(id) { const url = PDF_IMAGE_URLS[id]; return url ? `export default ${JSON.stringify(url)};` : null; },
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/reportPdfClient.js')) return null;
      let patched = code;
      for (const [from, to] of PDF_COPY_REPLACEMENTS) patched = patched.split(from).join(to);

      patched = patched
        .replace("function note(pdf,x,y,w,h,title,text){ card(pdf,x,y,w,h,4); rtl(pdf,title,x+w-6,y+6.5,3.3,'bold',C.navy); rtl(pdf,text,x+w-6,y+12.5,3.4,'normal',C.grey,w-12); }", "function note(pdf,x,y,w,h,title,text){ card(pdf,x,y,w,h,4); rtl(pdf,title,x+w-6,y+5.5,3.3,'bold',C.navy); rtl(pdf,text,x+w-6,y+9.5,3.2,'normal',C.grey,w-12); }")
        .replace("pageBase(pdf, 'בדיקת גג סולארית ראשונית', 1, ctx.logo);", "pageBase(pdf, '', 1, ctx.logo);")
        .replace("`${ctx.values.paybackWithVat.toFixed(1)} שנים`", "ctx.values.paybackWithVat.toFixed(1)")
        .replace("rtlText(pdf, title, 60, 19, 4.8, 'bold', [114, 128, 140]);", "if (title) rtlText(pdf, title, 60, 19, 4.8, 'bold', [114, 128, 140]);")
        .replace("ltrText(pdf, value, x + w - 5, y + 17.2, 7.2, 'bold', C.navy, 'right');", "ltrText(pdf, value, x + w / 2, y + 17.2, 7.2, 'bold', C.navy, 'center');")
        .replace("rtlText(pdf, String(value), x + w - 5, y + 15.2, 5.2, 'bold', C.navy, w - 10);", "centerValue(pdf, String(value), x + w / 2, y + 15.2, 5.2, C.navy);")
        .replace("ltrText(pdf, value, x + 5, y + 6.8, 4.1, 'bold', C.navy, 'left');", "ltrText(pdf, value, x + w / 2, y + 6.8, 4.1, 'bold', C.navy, 'center');")
        .replace("rtlText(pdf, String(value), x + w - 5, y + 13, 5.4, 'bold', C.navy, w - 10);", "centerValue(pdf, String(value), x + w / 2, y + 13, 5.4, C.navy);")
        .replace("addCoverImage(pdf, ctx.family, 18, 148, 174, 52, 7);", "addCoverImage(pdf, ctx.family, 18, 151, 174, 46, 7);")
        .replace("roundedBox(pdf, 18, 207, 174, 31, C.paleGreen, C.greenBorder, 6);", "roundedBox(pdf, 18, 203, 174, 31, C.paleGreen, C.greenBorder, 6);")
        .replace("rtlText(pdf, 'הדוח נשמר ב-Solatrix', 187, 220, 7.2, 'bold', C.navy);", "rtlText(pdf, 'הדוח נשמר', 187, 216, 7.2, 'bold', C.navy);")
        .replace("187, 230, 4.2", "187, 226, 4.2")
        .replace("gradientBand(pdf, 18, 245, 174, 34", "gradientBand(pdf, 18, 241, 174, 38")
        .replace("monthlyChart(pdf,25,105,160,45,projection.months);\n  ltr(pdf,`Total: ${num(c.v.annualProduction)} kWh`,25,155,3.3,'bold',C.navy,'left');", "monthlyChart(pdf,25,105,160,43,projection.months);\n  round(pdf,25,100,48,7,C.pale,C.border,3); ltr(pdf,`${num(c.v.annualProduction)} kWh`,49,104.7,3.1,'bold',C.navy,'center'); rtl(pdf,'ייצור שנתי',69,104.7,2.6,'normal',C.grey);")
        .replace("cashflowChart(pdf,25,190,160,37,projection.cashflow,c.v.paybackWithVat);", "cashflowChartV2(pdf,25,195,160,31,projection.cashflow,c.v.paybackWithVat);")
        .replace("cashflowChart(pdf,25,191,160,36,projection.cashflow,c.v.paybackWithVat);", "cashflowChartV2(pdf,25,195,160,31,projection.cashflow,c.v.paybackWithVat);")
        .replace("summaryBand(pdf,18,243,174,35,projection,c.v);", "summaryCardsV2(pdf,18,242,174,36,projection,c.v);")
        .replace("['תקופת החזר',`${c.v.paybackWithVat.toFixed(1)} שנים`]", "['תקופת החזר',c.v.paybackWithVat.toFixed(1),'שנים']")
        .replace("cards.forEach((item,i)=>analyticsMetric(pdf,18+i*44.5,49,40.5,24,item[0],item[1]));", "cards.forEach((item,i)=>analyticsMetricV2(pdf,18+i*44.5,49,40.5,24,item[0],item[1],item[2]||''));");

      patched = patched.replace(/\s*ltr\(pdf,'Solatrix Energy • Roof Check'[^\n]*\);/g, '');

      patched += `
function analyticsMetricV2(pdf,x,y,w,h,label,value,suffix=''){
  card(pdf,x,y,w,h,4);
  rtlCenterV2(pdf,label,x+w/2,y+8,3.15,'normal',C.grey);
  ltr(pdf,value,x+w/2,y+17.6,5.25,'bold',C.navy,'center');
  if(suffix) rtlCenterV2(pdf,suffix,x+w/2,y+21.3,2.55,'normal',C.grey);
}

function cashflowChartV2(pdf,x,y,w,h,points,payback){
  const values=points.map(p=>p.value),actualMin=Math.min(...values),actualMax=Math.max(...values);
  const min=actualMin*1.12,max=actualMax*1.06,range=Math.max(max-min,1);
  const px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h,zeroY=py(0),bx=px(payback);

  pdf.setDrawColor(...C.grid);pdf.setLineWidth(.18);
  [0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+4.1,2.25,'normal',C.grey,'center');});

  pdf.setDrawColor(...C.orange);pdf.setLineWidth(.4);pdf.setLineDashPattern([1.4,1.2],0);pdf.line(x,zeroY,x+w,zeroY);pdf.setLineDashPattern([],0);
  ltr(pdf,'0 ₪',x+w,zeroY-1.1,2,'bold',C.orange,'right');

  const before=points.filter(p=>p.year<=Math.ceil(payback));
  pdf.setDrawColor(151,162,171);pdf.setLineWidth(1.05);
  for(let i=1;i<before.length;i++)pdf.line(px(before[i-1].year),py(before[i-1].value),px(before[i].year),py(before[i].value));

  const after=points.filter(p=>p.year>=Math.floor(payback));
  pdf.setDrawColor(...C.blue);pdf.setLineWidth(1.25);
  for(let i=1;i<after.length;i++)pdf.line(px(after[i-1].year),py(after[i-1].value),px(after[i].year),py(after[i].value));

  pdf.setDrawColor(...C.orange);pdf.setLineWidth(.35);pdf.setLineDashPattern([1.1,1],0);pdf.line(bx,y+3,bx,zeroY);pdf.setLineDashPattern([],0);
  pdf.setFillColor(...C.orange);pdf.circle(bx,zeroY,2.25,'F');

  round(pdf,bx-17,y-1,34,10,C.white,C.border,3);
  rtlCenterV2(pdf,'תקופת החזר',bx,y+3.1,2.15,'bold',C.grey);
  ltr(pdf,payback.toFixed(1),bx-1.8,y+7.4,2.95,'bold',C.navy,'right');
  rtl(pdf,'שנים',bx+9.5,y+7.4,2.1,'normal',C.grey);

  rtlCenterV2(pdf,'שנים',x+w/2,y+h+8.1,2.25,'normal',C.grey);
}

function summaryCardsV2(pdf,x,y,w,h,p,v){
  const items=[
    ['השקעה ראשונית',money(v.costWithVat)],
    ['תקופת החזר',v.paybackWithVat.toFixed(1),'שנים'],
    ['רווח נקי ל־25 שנה',money(p.netProfit25)],
    ['תשואה כוללת',`${Math.round(p.roi25)}%`,'']
  ];
  const gap=4,colW=(w-gap*3)/4;
  items.forEach((it,i)=>{
    const cx=x+i*(colW+gap);
    card(pdf,cx,y,colW,h,4);
    pdf.setFillColor(...C.orange);pdf.roundedRect(cx,y,colW,2.2,2.2,2.2,'F');
    rtlCenterV2(pdf,it[0],cx+colW/2,y+10,2.65,'bold',C.navy);
    ltr(pdf,it[1],cx+colW/2,y+23,4.15,'bold',C.navy,'center');
    if(it[2]) rtlCenterV2(pdf,it[2],cx+colW/2,y+29,2.2,'normal',C.grey);
  });
}

function rtlCenterV2(pdf,text,x,y,size,style='normal',color=C.navy){
  pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);pdf.text(String(text??''),x,y,{align:'center'});pdf.setR2L(false);
}
`;

      patched = patched.replace(
        /function addCoverImage\(pdf, image, x, y, w, h, radius = 0\) \{[\s\S]*?\n\}\n\nfunction addContainImage/,
        `function addCoverImage(pdf, image, x, y, w, h, radius = 0) {
  if (!image) return;
  pdf.addImage(image.data, 'JPEG', x, y, w, h, undefined, 'NONE');
}

function centerValue(pdf, value, x, y, size, color = C.navy) {
  const text = String(value ?? '');
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  if (hasHebrew) rtlText(pdf, text, x, y, size, 'bold', color);
  else ltrText(pdf, text, x, y, size, 'bold', color, 'center');
}

function addContainImage`
      );

      return { code: patched, map: null };
    }
  };
}

const HERO_PREVIEW_MARKUP = `
  <div class="hero-preview-card" aria-label="הדגמת מערכת סולארית ביתית של 22.5 קילוואט לפני ואחרי">
    <div class="hero-preview-photo hero-preview-before" aria-hidden="true"></div>
    <div class="hero-preview-photo hero-preview-after" aria-hidden="true"></div>
    <div class="hero-preview-top"><span>SOLATRIX ROOF CHECK</span><span class="hero-preview-status">LIVE ROOF ANALYSIS</span></div>
    <div class="hero-preview-before-label">לפני</div><div class="hero-preview-after-label">אחרי</div>
    <div class="hero-preview-scan" aria-hidden="true"><span>‹ ›</span></div>
    <div class="hero-preview-coordinates">32.0853° N · 34.7818° E</div>
    <div class="hero-preview-stats">
      <div class="hero-preview-stat"><span>שטח גג</span><b>94 מ״ר</b></div><div class="hero-preview-stat"><span>גודל מערכת</span><b>22.5 kWp</b></div><div class="hero-preview-stat"><span>ייצור שנתי</span><b>37,400 kWh</b></div><div class="hero-preview-stat"><span>החזר השקעה</span><b>4.2 שנים</b></div>
    </div>
  </div>`;

const HERO_PREVIEW_STYLES = `
.solatrix-v34-visual{position:relative!important;min-height:500px!important;overflow:hidden!important;border-radius:30px!important;background:#071b29!important}.solatrix-v34-visual>:not(.hero-preview-card){display:none!important}.hero-preview-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit;color:#fff;font-family:Assistant,system-ui,sans-serif;background:#071c2b}.hero-preview-photo{position:absolute;left:18px;right:18px;top:68px;bottom:112px;border-radius:20px;background-size:cover;background-position:center}.hero-preview-before{background-image:url('./assets/hero/hero%20before.jpg')}.hero-preview-after{background-image:url('./assets/hero/hero%20after.jpg');clip-path:inset(0 0 0 100%);animation:igorReveal 7s ease-in-out infinite}@keyframes igorReveal{0%,100%{clip-path:inset(0 0 0 100%)}50%{clip-path:inset(0 0 0 0)}}.hero-preview-top{position:relative;z-index:6;display:flex;justify-content:space-between;padding:19px 22px;font-size:13px;font-weight:900}.hero-preview-before-label,.hero-preview-after-label{position:absolute;z-index:7;top:88px;padding:8px 13px;border-radius:999px;background:rgba(4,20,32,.74);font-size:11px;font-weight:900}.hero-preview-before-label{left:34px}.hero-preview-after-label{right:34px}.hero-preview-scan{position:absolute;z-index:8;top:68px;bottom:112px;left:0;width:3px;background:#ffd45c;animation:igorScan 7s ease-in-out infinite}@keyframes igorScan{0%,100%{left:0}50%{left:100%}}.hero-preview-scan span{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#fff;color:#0a2030}.hero-preview-coordinates{position:absolute;z-index:7;left:32px;bottom:124px}.hero-preview-stats{position:absolute;left:18px;right:18px;bottom:16px;z-index:7;display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.hero-preview-stat{padding:10px;border-radius:12px;background:#fff;color:#062840}.hero-preview-stat span{display:block;font-size:9px}.hero-preview-stat b{display:block;font-size:15px}@media(max-width:900px){.solatrix-v34-visual{min-height:430px!important}.hero-preview-stats{grid-template-columns:repeat(2,1fr)}}`;

function normalizeVisibleText(fragment = '') {return fragment.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function findSectionSpans(html){const tagPattern=/<\/?section\b[^>]*>/gi;const stack=[];const spans=[];let match;while((match=tagPattern.exec(html))!==null){const tag=match[0];if(!/^<\/section/i.test(tag)){stack.push({start:match.index,openTag:tag});continue;}const opening=stack.pop();if(opening)spans.push({start:opening.start,end:tagPattern.lastIndex,openTag:opening.openTag});}return spans;}
function stripUnwantedHomepageSections(html){const spans=findSectionSpans(html);const removals=[];const decision=spans.filter(({openTag})=>/\bid\s*=\s*["']decision["']/i.test(openTag)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];if(decision)removals.push(decision);HOMEPAGE_SECTION_TEXTS_TO_REMOVE.forEach(target=>{const section=spans.filter(({start,end})=>normalizeVisibleText(html.slice(start,end)).includes(target)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];if(section)removals.push(section);});return [...new Map(removals.map(span=>[`${span.start}:${span.end}`,span])).values()].sort((a,b)=>b.start-a.start).reduce((result,{start,end})=>result.slice(0,start)+result.slice(end),html);}
function fixHomepageCopy(html){return html.replace(/מובילים\s+מובילים/g,'מובילים');}
function removePersistentMobileDock(html){return html.replace(/\s*<div\b(?=[^>]*\bclass=["'][^"']*\bmobile-bottom-cta\b[^"']*["'])[^>]*>[\s\S]*?<\/div>\s*/gi,'\n');}
function injectHeroPreview(html){const openingTag=/(<div\s+class=["'][^"']*\bsolatrix-v34-visual\b[^"']*["'][^>]*>)/i;if(!openingTag.test(html))return {html,injected:false};return {html:html.replace(openingTag,`$1${HERO_PREVIEW_MARKUP}`),injected:true};}
function isHomepageFile(filename){const normalized=filename.replace(/^\.\//,'');return normalized==='index.html'||(normalized.endsWith('/index.html')&&!normalized.endsWith('/roof-check/index.html'));}
function injectSolatrixScripts(){return{name:'solatrix-site-wide-scripts',transformIndexHtml(html,context){const filename=String(context?.filename||'').replace(/\\/g,'/');const homepage=isHomepageFile(filename);let cleanedHtml=removePersistentMobileDock(html);cleanedHtml=homepage?fixHomepageCopy(stripUnwantedHomepageSections(cleanedHtml)):cleanedHtml;let heroInjected=false;if(homepage){const result=injectHeroPreview(cleanedHtml);cleanedHtml=result.html;heroInjected=result.injected;}const homepageTags=homepage&&heroInjected?[{tag:'style',children:HERO_PREVIEW_STYLES,injectTo:'head'}]:[];const accessibilityTag=filename.endsWith('admin.html')?[]:[{tag:'script',attrs:{type:'module',src:'./src/accessibilityWidget.js'},injectTo:'body'}];if([...SITE_WIDE_SCRIPT_SKIP].some(page=>filename.endsWith(page)))return{html:cleanedHtml,tags:[...homepageTags,...accessibilityTag]};return{html:cleanedHtml,tags:[...homepageTags,...accessibilityTag,{tag:'script',attrs:{type:'module',src:'./src/siteLinkBridge.js'},injectTo:'body'},{tag:'script',attrs:{type:'module',src:'./src/globalLeadForm.js'},injectTo:'body'}]};}};}

export default defineConfig({base:'./',plugins:[useUploadedPdfImages(),injectSolatrixScripts()],build:{rollupOptions:{input:{main:'index.html',privateHomes:'private-homes.html',solarPrice:'solar-price.html',roofCheckRedirect:'roof-check.html',roofCheckApp:'roof-check/index.html',pdfPreview:'pdf-preview.html',storage:'storage.html',business:'business.html',agriculture:'agriculture.html',faq:'faq.html',contact:'contact.html',admin:'admin.html'}}}});
