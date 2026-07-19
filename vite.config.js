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
  ['מערכות סולאריות, אגירה וליווי מקצועי משלב הבדיקה ועד הפעלת המערכת.', 'תכנון, התקנה וליווי מקצועי של מערכות סולאריות ואגירת אנרגיה משלב הבדיקה ועד להפעלת המערכת.']
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
        .replace("['תקופת החזר',`${c.v.paybackWithVat.toFixed(1)} שנים`]", "['תקופת החזר',c.v.paybackWithVat.toFixed(1),'שנים']")
        .replace("cards.forEach((item,i)=>analyticsMetric(pdf,18+i*44.5,49,40.5,24,item[0],item[1]));", "cards.forEach((item,i)=>analyticsMetricV2(pdf,18+i*44.5,49,40.5,24,item[0],item[1],item[2]||''));")
        .replace("cashflowChart(pdf,25,190,160,37,projection.cashflow,c.v.paybackWithVat);", "cashflowChartV2(pdf,25,195,160,31,projection.cashflow,c.v.paybackWithVat);")
        .replace("cashflowChart(pdf,25,191,160,36,projection.cashflow,c.v.paybackWithVat);", "cashflowChartV2(pdf,25,195,160,31,projection.cashflow,c.v.paybackWithVat);")
        .replace("summaryBand(pdf,18,243,174,35,projection,c.v);", "summaryCardsV2(pdf,18,242,174,36,projection,c.v);");

      patched = patched.replace(
        /metric\(pdf,108,152,84,28,[^;]+;/,
        "metric(pdf,108,152,84,28,'הספק המערכת',(c.v.annualProduction/1650).toFixed(1)+' kWp','','bolt');"
      );
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
    ['השקעה ראשונית',money(v.costWithVat),''],
    ['תקופת החזר',v.paybackWithVat.toFixed(1),'שנים'],
    ['רווח נקי ל־25 שנה',money(p.netProfit25),''],
    ['תשואה כוללת',String(Math.round(p.roi25))+'%','']
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

      return { code: patched, map: null };
    }
  };
}

function normalizeVisibleText(fragment = '') {return fragment.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim();}
function findSectionSpans(html){const tagPattern=/<\/?section\b[^>]*>/gi;const stack=[];const spans=[];let match;while((match=tagPattern.exec(html))!==null){const tag=match[0];if(!/^<\/section/i.test(tag)){stack.push({start:match.index,openTag:tag});continue;}const opening=stack.pop();if(opening)spans.push({start:opening.start,end:tagPattern.lastIndex,openTag:opening.openTag});}return spans;}
function stripUnwantedHomepageSections(html){const spans=findSectionSpans(html);const removals=[];const decision=spans.filter(({openTag})=>/\bid\s*=\s*["']decision["']/i.test(openTag)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];if(decision)removals.push(decision);HOMEPAGE_SECTION_TEXTS_TO_REMOVE.forEach(target=>{const section=spans.filter(({start,end})=>normalizeVisibleText(html.slice(start,end)).includes(target)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];if(section)removals.push(section);});return [...new Map(removals.map(span=>[`${span.start}:${span.end}`,span])).values()].sort((a,b)=>b.start-a.start).reduce((result,{start,end})=>result.slice(0,start)+result.slice(end),html);}
function fixHomepageCopy(html){return html.replace(/מובילים\s+מובילים/g,'מובילים');}
function removePersistentMobileDock(html){return html.replace(/\s*<div\b(?=[^>]*\bclass=["'][^"']*\bmobile-bottom-cta\b[^"']*["'])[^>]*>[\s\S]*?<\/div>\s*/gi,'\n');}
function isHomepageFile(filename){const normalized=filename.replace(/^\.\//,'');return normalized==='index.html'||(normalized.endsWith('/index.html')&&!normalized.endsWith('/roof-check/index.html'));}
function injectSolatrixScripts(){return{name:'solatrix-site-wide-scripts',transformIndexHtml(html,context){const filename=String(context?.filename||'').replace(/\\/g,'/');const homepage=isHomepageFile(filename);let cleanedHtml=removePersistentMobileDock(html);cleanedHtml=homepage?fixHomepageCopy(stripUnwantedHomepageSections(cleanedHtml)):cleanedHtml;const accessibilityTag=filename.endsWith('admin.html')?[]:[{tag:'script',attrs:{type:'module',src:'./src/accessibilityWidget.js'},injectTo:'body'}];if([...SITE_WIDE_SCRIPT_SKIP].some(page=>filename.endsWith(page)))return{html:cleanedHtml,tags:accessibilityTag};return{html:cleanedHtml,tags:[...accessibilityTag,{tag:'script',attrs:{type:'module',src:'./src/siteLinkBridge.js'},injectTo:'body'},{tag:'script',attrs:{type:'module',src:'./src/globalLeadForm.js'},injectTo:'body'}]};}};}

export default defineConfig({base:'./',plugins:[useUploadedPdfImages(),injectSolatrixScripts()],build:{rollupOptions:{input:{main:'index.html',privateHomes:'private-homes.html',solarPrice:'solar-price.html',roofCheckRedirect:'roof-check.html',roofCheckApp:'roof-check/index.html',pdfPreview:'pdf-preview.html',storage:'storage.html',business:'business.html',agriculture:'agriculture.html',faq:'faq.html',contact:'contact.html',admin:'admin.html'}}}});