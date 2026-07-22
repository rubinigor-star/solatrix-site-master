import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import familyUrl from './assets/roof-check-report/roof-check-family.webp';
import { calculateCommercialEconomics, calculateResidentialEconomics, validateEconomics } from './roofCheckEconomics.js';
import { coordinateText } from './lib/roofGeometry.js';

const LOGO_URL = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';
const SOLATRIX_WHATSAPP = '054-279-0088';
const C = { bg:[252,250,245], navy:[7,31,50], blue:[22,85,128], orange:[247,163,24], grey:[78,91,101], border:[218,214,205], white:[255,255,255], pale:[245,247,248], green:[34,166,91], grid:[224,228,231] };

export async function createRoofCheckPdf({ customer = {}, reportData = {} } = {}) {
  customer = { ...customer, name: safePdfText(customer.name, 160), phone: safePdfText(customer.phone, 40), email: safePdfText(customer.email, 320) };
  const roof = { ...(reportData.roofData || {}), address: safePdfText(reportData.roofData?.address, 500) };
  const values = buildValues(reportData.calculationModel || {}, reportData.calculation || {}, roof);
  const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true, putOnlyUsedFonts:true });
  await installFonts(pdf);
  const [logo, coverImage, installers, family] = await Promise.all([
    loadImage(LOGO_URL, 1200), loadImage(coverHeroUrl, 2800), loadImage(installersUrl, 2400), loadImage(familyUrl, 2800)
  ]);
  const generatedAt = new Date().toLocaleString('he-IL', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  page1(pdf, { customer, roof, values, generatedAt, logo, cover:coverImage });
  pdf.addPage(); page2(pdf, { customer, roof, values, logo, installers });
  pdf.addPage(); page3(pdf, { values, logo });
  pdf.addPage(); page4(pdf, { family });
  pdf.setProperties({ title:'Solatrix Roof Check', subject:'Professional solar roof feasibility report', author:'Solatrix Energy' });
  return pdf.output('blob');
}

export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '').split(',')[1] || ''); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
}

function buildValues(model, calculation, roof) {
  const entries = Object.entries(calculation || {});
  const find = (...parts) => entries.find(([label]) => parts.every(p => String(label).includes(p)))?.[1];
  const num = (a, b, d = 0) => { const n = Number(a); if (Number.isFinite(n)) return n; const p = parseNumeric(b); return Number.isFinite(p) ? p : d; };
  const roofArea = num(model.roofArea, find('שטח גג'), (roof.surfaces || []).reduce((s,v)=>s+Number(v?.area||0),0));
  const usableArea = num(model.usableArea, find('שטח שימושי'), roofArea * 0.82);
  const panels = num(model.panels, find('פאנלים'));
  const size = num(model.systemSizeKwp ?? model.systemSize ?? model.dcSizeKwp, null, panels ? panels * 0.63 : num(model.annualProduction, find('ייצור שנתי')) / 1650);
  const isCommercial = model.isCommercial === true || roof.roofType === 'commercial' || size > 22.5;
  const economicsInput = {
    systemSizeKwp: size,
    monthlyBill: num(model.monthlyBill, roof.monthlyBill),
    urbanEligible: model.urbanEligible === true || roof.urbanEligible === true
  };
  const economics = isCommercial
    ? calculateCommercialEconomics(economicsInput)
    : calculateResidentialEconomics(economicsInput);
  return {
    ...economics,
    roofArea, usableArea, panels: panels || Math.max(0, Math.round(size / 0.63)),
    monthlyBill: num(model.monthlyBill, roof.monthlyBill),
    isCommercial,
    validation: validateEconomics(economics)
  };
}

function page1(pdf, c) {
  base(pdf, 1, c.logo);
  cover(pdf, c.cover, 18, 36, 174, 72, 6);
  ribbon(pdf, 18, 112, 174, 12, c.values.isCommercial ? 'בדיקת כדאיות למערכת מסחרית' : 'בדיקת כדאיות למערכת ביתית');
  metric(pdf, 18, 130, 84, 29, 'הספק מערכת משוער', one(c.values.systemSizeKwp), 'kWp', 'bolt');
  metric(pdf, 108, 130, 84, 29, 'ייצור שנתי צפוי', number(c.values.annualProduction), 'kWh', 'sun');
  metric(pdf, 18, 165, 84, 29, 'עלות משוערת לפני מע״מ', money(c.values.costBeforeVat), '', 'tag');
  metric(pdf, 108, 165, 84, 29, 'תקופת החזר משוערת', one(c.values.paybackWithVat), 'שנים', 'clock');
  band(pdf, 18, 200, 174, 31, 'מה בדקנו?', 'הדוח מתרגם את שטח הגג שסומן להספק מערכת משוער, ייצור חשמל שנתי, ערך כספי, עלות הקמה ותחזית ל־25 שנה.');
  addressFact(pdf, 18, 238, 84, 20, 'כתובת הנכס', c.roof.address || '—', 'pin');
  fact(pdf, 108, 238, 84, 20, 'שם הלקוח', c.customer.name || '—', 'user');
  fact(pdf, 18, 263, 84, 17, 'תאריך הפקה', c.generatedAt, 'calendar', true);
  numericFact(pdf, 108, 263, 84, 17, 'שטח גג שסומן', number(c.values.roofArea), 'מ״ר', 'area');
}

function page2(pdf, c) {
  base(pdf, 2, c.logo);
  title(pdf, 'כך בנוי החישוב', 42);
  darkMain(pdf, 18, 50, 67, 69, 'ייצור שנתי', number(c.values.annualProduction), 'kWh', one(c.values.systemSizeKwp));
  cover(pdf, c.installers, 90, 50, 102, 69, 6);
  section(pdf, 'פירוט הפרויקט', 132);
  const rows = [
    ['שטח גג מסומן (מ״ר)', number(c.values.roofArea)],
    ['שטח גג שמיש (מ״ר)', number(c.values.usableArea)],
    ['מספר פאנלים משוער', number(c.values.panels)],
    ['הספק מערכת', `${one(c.values.systemSizeKwp)} kWp`],
    ['ייצור שנתי', `${number(c.values.annualProduction)} kWh`],
    ['עלות לפני מע״מ', money(c.values.costBeforeVat)],
    ['עלות כולל מע״מ', money(c.values.costWithVat)],
    ['החזר השקעה (שנים)', one(c.values.paybackWithVat)]
  ];
  rows.forEach((r,i) => resultRow(pdf, 18, 140 + i * 13.5, 102, 11.5, r[0], r[1]));
  projectFact(pdf, 126, 140, 66, 23, 'סוג מערכת', c.values.isCommercial ? 'מסחרית' : 'ביתית', 'home');
  projectFact(pdf, 126, 168, 66, 23, 'חשבון חודשי', money(c.values.monthlyBill || 0), 'bill', true);
  projectFact(pdf, 126, 196, 66, 23, 'וואטסאפ', SOLATRIX_WHATSAPP, 'whatsapp', true);
  projectFact(pdf, 126, 224, 66, 23, 'קואורדינטות', coordinateText(c.roof.geometry || { centroid: c.roof.coordinates }) || '—', 'pin', true);
  note(pdf, 18, 251, 174, 18, 'מודל פיננסי', c.values.isCommercial
    ? 'כל הייצור מחושב לפי ערך של 0.39 ₪ לקוט״ש.'
    : '35% מהייצור מחושב כחיסכון עצמי לפי 0.64 ₪ לקוט״ש, ו־65% כמכירה לרשת לפי 0.48 ₪ לקוט״ש.');
  note(pdf, 18, 269, 174, 14, 'הערה', 'המחיר הוא אומדן ראשוני להתקנה סטנדרטית וללא עבודות חריגות.');
}

function page3(pdf, c) {
  base(pdf, 3, c.logo);
  title(pdf, 'תחזית ייצור וביצועים פיננסיים', 42);
  const p = projection(c.values);
  const cards = [
    ['השקעה כוללת', money(c.values.costWithVat)],
    ['שנה ראשונה', money(c.values.annualSavings)],
    ['החזר השקעה (שנים)', one(c.values.paybackWithVat)],
    ['רווח נקי ל־25 שנה', money(p.netProfit25)]
  ];
  cards.forEach((x,i) => analyticsMetric(pdf, 18 + i * 44.5, 50, 40.5, 24, x[0], x[1]));
  chartCard(pdf, 18, 81, 174, 77);
  rtl(pdf, 'ייצור חשמל חודשי צפוי', 186, 93, 5.3, 'bold', C.navy);
  monthlyChart(pdf, 25, 107, 160, 40, p.months);
  chartCard(pdf, 18, 165, 174, 70);
  rtl(pdf, 'תזרים מצטבר והחזר השקעה', 186, 178, 5.3, 'bold', C.navy);
  cashflowChart(pdf, 25, 191, 160, 34, p.cashflow, c.values.paybackWithVat);
  summaryBand(pdf, 18, 242, 174, 36, p, c.values);
}

function page4(pdf, c) {
  base(pdf, 4, null);
  title(pdf, 'איך מתקדמים מכאן?', 45);
  const steps = [
    [1,'שיחת היכרות','עוברים יחד על הדוח ועל מטרות הפרויקט.','users'],
    [2,'בדיקת מסמכים','בודקים חשבון חשמל, חיבור קיים ובעלות.','doc'],
    [3,'בדיקת שטח','מוודאים הצללות, חשמל וקונסטרוקציה.','worker'],
    [4,'הצעה מלאה','מקבלים תכנון, ציוד, מחיר ולוחות זמנים.','check']
  ];
  steps.forEach((s,i) => step(pdf, 18, 55 + i * 31, 174, 27, ...s));
  cover(pdf, c.family, 18, 183, 174, 47, 6);
  whatsappBand(pdf, 18, 236, 174, 19);
  contactBand(pdf, 18, 262, 174, 18);
}

function projection(v) {
  const labels=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'];
  const weights=[.055,.063,.081,.095,.108,.112,.115,.108,.091,.075,.055,.042];
  const months=weights.map((w,i)=>({label:labels[i],kwh:Math.round(v.annualProduction*w)}));
  const yearly = Array.isArray(v.yearlyProjection) ? v.yearlyProjection : [];
  const cashflow=[{year:0,value:-v.costWithVat}]; let cumulative=-v.costWithVat;
  yearly.forEach(y=>{ cumulative += y.income; cashflow.push({year:y.year,value:cumulative}); });
  const totalIncome25 = yearly.reduce((s,y)=>s+y.income,0);
  return { months, cashflow, totalIncome25, netProfit25:totalIncome25-v.costWithVat, roi25:v.costWithVat?((totalIncome25-v.costWithVat)/v.costWithVat)*100:0 };
}

function base(pdf,page,logo){pdf.setFillColor(...C.bg);pdf.rect(0,0,210,297,'F');if(logo)contain(pdf,logo,158,7,34,19);pdf.setDrawColor(...C.orange);pdf.setLineWidth(.45);pdf.line(18,30,192,30);pdf.setDrawColor(...C.border);pdf.setLineWidth(.25);pdf.line(18,286,192,286);ltr(pdf,`${page} / 4`,18,292,3.1,'normal',C.grey,'left');ltr(pdf,'Solatrix Energy • Roof Check',192,292,3.1,'normal',C.grey,'right');}
function title(pdf,text,y){rtl(pdf,text,192,y,9.5,'bold',C.navy);}
function ribbon(pdf,x,y,w,h,text){round(pdf,x,y,w,h,C.orange,C.orange,4);rtl(pdf,text,x+w-7,y+8,4.2,'bold',C.navy);}
function metric(pdf,x,y,w,h,label,value,suffix,icon){card(pdf,x,y,w,h,5);iconDraw(pdf,icon,x+11,y+h/2);rtl(pdf,label,x+w-7,y+9,3.8,'bold',C.grey);ltr(pdf,value,x+w/2+4,y+21,7.3,'bold',C.navy,'center');if(suffix){if(hasHebrew(suffix))rtlCenter(pdf,suffix,x+w/2+4,y+27,3.1,'normal',C.grey);else ltr(pdf,suffix,x+w/2+4,y+27,3.1,'normal',C.grey,'center');}}
function fact(pdf,x,y,w,h,label,value,icon,isLtr=false){card(pdf,x,y,w,h,4);iconDraw(pdf,icon,x+9,y+h/2);rtl(pdf,label,x+w-6,y+7,3.3,'bold',C.grey);isLtr?ltr(pdf,value,x+w-6,y+15,4.1,'bold',C.navy,'right'):rtl(pdf,value,x+w-6,y+15,4.2,'bold',C.navy,w-22);}
function addressFact(pdf,x,y,w,h,label,value,icon){card(pdf,x,y,w,h,4);iconDraw(pdf,icon,x+9,y+h/2);rtl(pdf,label,x+w-6,y+7,3.3,'bold',C.grey);const parts=String(value||'—').split(',').map(s=>s.trim()).filter(Boolean);if(parts.length>1){rtl(pdf,parts[0],x+w-6,y+13.5,3.7,'bold',C.navy,w-22);rtlMixed(pdf,parts.slice(1).join(', '),x+w-6,y+18,3.7,'bold',C.navy);}else{rtlMixed(pdf,String(value||'—'),x+w-6,y+15,4,'bold',C.navy);}}
function numericFact(pdf,x,y,w,h,label,value,unit,icon){card(pdf,x,y,w,h,4);iconDraw(pdf,icon,x+9,y+h/2);rtl(pdf,label,x+w-6,y+7,3.3,'bold',C.grey);ltr(pdf,value,x+w-14,y+15,4.2,'bold',C.navy,'right');rtl(pdf,unit,x+w-6,y+15,3.6,'normal',C.grey);}
function band(pdf,x,y,w,h,titleText,text){round(pdf,x,y,w,h,C.navy,C.navy,6);rtl(pdf,titleText,x+w-8,y+11,6,'bold',C.white);rtl(pdf,text,x+w-8,y+21,3.8,'normal',[232,238,242],w-16);}
function darkMain(pdf,x,y,w,h,titleText,value,unit,size){round(pdf,x,y,w,h,C.navy,C.navy,6);iconDraw(pdf,'sun',x+w/2,y+13,C.orange);rtlCenter(pdf,titleText,x+w/2,y+29,4.8,'bold',C.white);ltr(pdf,value,x+w/2,y+44,7.6,'bold',C.white,'center');ltr(pdf,unit,x+w/2,y+51,3,'normal',[225,233,239],'center');ltr(pdf,`${size} kWp × 1,650 kWh`,x+w/2,y+59,2.9,'normal',[225,233,239],'center');rtlCenter(pdf,'לשנה',x+w/2,y+65,3,'normal',[225,233,239]);}
function section(pdf,text,y){rtl(pdf,text,192,y,5.4,'bold',C.navy);}
function resultRow(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,3);rtl(pdf,label,x+w-5,y+7.3,3.4,'bold',C.grey);ltr(pdf,value,x+5,y+7.3,3.9,'bold',C.navy,'left');}
function projectFact(pdf,x,y,w,h,label,value,icon,isLtr=false){card(pdf,x,y,w,h,4);iconDraw(pdf,icon,x+9,y+h/2);rtl(pdf,label,x+w-6,y+8,3.3,'bold',C.grey);isLtr?ltr(pdf,value,x+w-6,y+17,4.2,'bold',C.navy,'right'):rtl(pdf,value,x+w-6,y+17,4.4,'bold',C.navy);}
function note(pdf,x,y,w,h,titleText,text){card(pdf,x,y,w,h,4);rtl(pdf,titleText,x+w-6,y+6.5,3.3,'bold',C.navy);rtl(pdf,text,x+w-6,y+12.5,3.05,'normal',C.grey,w-12);}
function analyticsMetric(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,4);rtlCenter(pdf,label,x+w/2,y+8,3.15,'bold',C.grey);ltr(pdf,value,x+w/2,y+18,5.2,'bold',C.navy,'center');}
function chartCard(pdf,x,y,w,h){card(pdf,x,y,w,h,5);}
function monthlyChart(pdf,x,y,w,h,months){const max=Math.max(...months.map(m=>m.kwh),1),bw=8.4,gap=4.5,baseY=y+h;pdf.setDrawColor(...C.grid);for(let i=0;i<4;i++)pdf.line(x,y+i*h/3,x+w,y+i*h/3);months.forEach((m,i)=>{const bx=x+i*(bw+gap)+2,bh=(m.kwh/max)*(h-8);pdf.setFillColor(...C.orange);pdf.roundedRect(bx,baseY-bh,bw,bh,1.2,1.2,'F');rtlCenter(pdf,m.label,bx+bw/2,baseY+5,2.5,'bold',C.grey);ltr(pdf,number(m.kwh),bx+bw/2,baseY-bh-2,2.2,'bold',C.navy,'center');});}
function cashflowChart(pdf,x,y,w,h,points,payback){const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1),px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h;pdf.setDrawColor(...C.grid);pdf.line(x,py(0),x+w,py(0));[0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+5,2.4,'normal',C.grey,'center');});pdf.setDrawColor(...C.blue);pdf.setLineWidth(1);for(let i=1;i<points.length;i++)pdf.line(px(points[i-1].year),py(points[i-1].value),px(points[i].year),py(points[i].value));pdf.setFillColor(...C.orange);pdf.circle(px(Math.min(payback,25)),py(0),2.1,'F');}
function summaryBand(pdf,x,y,w,h,p,v){round(pdf,x,y,w,h,C.navy,C.navy,5);rtlCenter(pdf,'סיכום פיננסי ל־25 שנה',x+w/2,y+8.5,4.3,'bold',C.orange);const items=[['הכנסה מצטברת',money(p.totalIncome25)],['השקעה',money(v.costWithVat)],['רווח נקי',money(p.netProfit25)],['ROI',`${Math.round(p.roi25)}%`]];const col=w/4;items.forEach((it,i)=>{const cx=x+col*i+col/2;if(i>0){pdf.setDrawColor(65,86,103);pdf.setLineWidth(.25);pdf.line(x+col*i,y+13,x+col*i,y+h-5);}ltr(pdf,it[1],cx,y+21,4.3,'bold',C.white,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(.45);pdf.line(cx-13,y+23,cx+13,y+23);if(it[0]==='ROI')ltr(pdf,it[0],cx,y+30,2.9,'bold',[225,233,239],'center');else rtlCenter(pdf,it[0],cx,y+30,2.9,'bold',[225,233,239]);});}
function step(pdf,x,y,w,h,n,titleText,text,icon){card(pdf,x,y,w,h,5);pdf.setFillColor(...C.navy);pdf.circle(x+w-10,y+h/2,6,'F');ltr(pdf,String(n),x+w-10,y+h/2+1.8,5,'bold',C.white,'center');iconDraw(pdf,icon,x+11,y+h/2);rtl(pdf,titleText,x+w-22,y+10,5,'bold',C.navy);rtl(pdf,text,x+w-22,y+18,3.45,'normal',C.grey,w-45);}
function whatsappBand(pdf,x,y,w,h){round(pdf,x,y,w,h,C.navy,C.navy,5);iconDraw(pdf,'whatsapp',x+11,y+h/2,C.green);rtl(pdf,'דוח מקצועי ומוכן לשיתוף',x+w-8,y+8,4.8,'bold',C.white);rtl(pdf,'הקובץ כולל את כל הנתונים, ההנחות והתחזית הפיננסית.',x+w-8,y+14.5,3.45,'normal',[230,237,242],w-66);ltr(pdf,SOLATRIX_WHATSAPP,x+25,y+14.5,3.45,'bold',[230,237,242],'left');}
function contactBand(pdf,x,y,w,h){round(pdf,x,y,w,h,C.navy,C.navy,5);ltr(pdf,'Solatrix Energy',x+w-8,y+8,4.3,'bold',C.orange,'right');ltr(pdf,'solatrix.energy',x+8,y+13,3.6,'bold',C.orange,'left');}
function card(pdf,x,y,w,h,r=5){round(pdf,x,y,w,h,C.white,C.border,r);}
function round(pdf,x,y,w,h,fill,stroke,r){pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.25);pdf.roundedRect(x,y,w,h,r,r,'FD');}
function iconDraw(pdf,type,cx,cy,color=C.orange){pdf.setDrawColor(...color);pdf.setTextColor(...color);pdf.setLineWidth(.6);if(type==='clock'){pdf.circle(cx,cy,4,'S');pdf.line(cx,cy,cx,cy-2.5);pdf.line(cx,cy,cx+2,cy+1);}else if(type==='tag'){pdf.rect(cx-3,cy-3,6,6,'S');pdf.circle(cx+1.5,cy-1.5,.5,'S');}else if(type==='pin'){pdf.circle(cx,cy-1,3,'S');pdf.line(cx-2,cy+1,cx,cy+5);pdf.line(cx+2,cy+1,cx,cy+5);}else if(type==='user'){pdf.circle(cx,cy-2,2,'S');pdf.line(cx-4,cy+4,cx-2.5,cy+1.5);pdf.line(cx-2.5,cy+1.5,cx+2.5,cy+1.5);pdf.line(cx+2.5,cy+1.5,cx+4,cy+4);}else if(type==='calendar'){pdf.rect(cx-4,cy-3,8,7,'S');pdf.line(cx-4,cy-1,cx+4,cy-1);}else if(type==='area'){pdf.rect(cx-4,cy-4,8,8,'S');pdf.line(cx-4,cy,cx+4,cy);pdf.line(cx,cy-4,cx,cy+4);}else if(type==='home'){pdf.line(cx-4,cy,cx,cy-4);pdf.line(cx,cy-4,cx+4,cy);pdf.rect(cx-3,cy,6,4,'S');}else if(type==='bill'||type==='doc'){pdf.rect(cx-3,cy-4,6,8,'S');pdf.line(cx-2,cy-1,cx+2,cy-1);}else if(type==='whatsapp'){pdf.circle(cx,cy,4,'S');ltr(pdf,'✓',cx,cy+1.5,4,'bold',color,'center');}else if(type==='users'){pdf.circle(cx-2,cy-2,1.5,'S');pdf.circle(cx+2,cy-2,1.5,'S');pdf.line(cx-4,cy+3,cx+4,cy+3);}else if(type==='worker'){pdf.circle(cx,cy-2,2,'S');pdf.line(cx-4,cy+4,cx-2.5,cy+1.5);pdf.line(cx-2.5,cy+1.5,cx+2.5,cy+1.5);pdf.line(cx+2.5,cy+1.5,cx+4,cy+4);}else if(type==='check'){pdf.rect(cx-3,cy-4,6,8,'S');ltr(pdf,'✓',cx,cy+1.5,4,'bold',color,'center');}else{ltr(pdf,type==='sun'?'☀':'⚡',cx,cy+2,7,'bold',color,'center');}}
function rtl(pdf,text,x,y,size,style='normal',color=C.navy,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const normalized=fixRtlParentheses(String(text??''));const lines=maxWidth?pdf.splitTextToSize(normalized,maxWidth):normalized;pdf.text(lines,x,y,{align:'right'});pdf.setR2L(false);}
function rtlCenter(pdf,text,x,y,size,style='normal',color=C.navy){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);pdf.text(fixRtlParentheses(String(text??'')),x,y,{align:'center'});pdf.setR2L(false);}
function rtlMixed(pdf,text,x,y,size,style='normal',color=C.navy){const s=String(text??'');const match=s.match(/^(.*?)(\d[\d\-\/.]*)$/);if(match&&match[1].trim()){rtl(pdf,match[1].trim(),x,y,size,style,color);const hebrewWidth=textWidth(pdf,match[1].trim(),size,style);ltr(pdf,match[2],x-hebrewWidth-1.2,y,size,style,color,'right');}else rtl(pdf,s,x,y,size,style,color);}
function ltr(pdf,text,x,y,size,style='normal',color=C.navy,align='left'){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(false);pdf.text(String(text??''),x,y,{align});}
function textWidth(pdf,text,size,style='normal'){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));return pdf.getTextWidth(String(text??''));}
function hasHebrew(text){return /[\u0590-\u05FF]/.test(String(text||''));}
function fixRtlParentheses(value){return /[\u0590-\u05FF]/.test(value)&&/[()]/.test(value)?value.replace(/\(/g,'\uFFF0').replace(/\)/g,'(').replace(/\uFFF0/g,')'):value;}
function mm(v){return v*2.8346457;}
async function installFonts(pdf){const b=await fetchBase64(FONT_URL);pdf.addFileToVFS('Heebo-Regular.ttf',b);pdf.addFileToVFS('Heebo-Bold.ttf',b);pdf.addFont('Heebo-Regular.ttf','Heebo','normal');pdf.addFont('Heebo-Bold.ttf','Heebo','bold');}
async function fetchBase64(url){const res=await fetch(url,{mode:'cors',cache:'force-cache'});if(!res.ok)throw new Error(`Font request failed: ${res.status}`);const bytes=new Uint8Array(await res.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
async function loadImage(url,max=3000){try{const res=await fetch(url,{mode:'cors',cache:'no-cache'});if(!res.ok)throw new Error(res.status);const blob=await res.blob();const bitmap=await createImageBitmap(blob);const scale=Math.min(1,max/bitmap.width),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();return{data:canvas.toDataURL('image/jpeg',.96),width:w,height:h};}catch(e){console.warn('Image load failed',url,e);return null;}}
function cover(pdf,image,x,y,w,h,r=0){if(!image)return;const sr=image.width/image.height,tr=w/h;let dw=w,dh=h,dx=x,dy=y;if(sr>tr){dw=h*sr;dx=x-(dw-w)/2;}else{dh=w/sr;dy=y-(dh-h)/2;}pdf.saveGraphicsState();pdf.roundedRect(x,y,w,h,r,r,null);pdf.clip();pdf.discardPath();pdf.addImage(image.data,'JPEG',dx,dy,dw,dh,undefined,'NONE');pdf.restoreGraphicsState();}
function contain(pdf,image,x,y,w,h){if(!image)return;const ratio=Math.min(w/image.width,h/image.height),dw=image.width*ratio,dh=image.height*ratio;pdf.addImage(image.data,'JPEG',x+(w-dw)/2,y+(h-dh)/2,dw,dh,undefined,'NONE');}
function parseNumeric(v){if(typeof v==='number')return v;const s=String(v??'').replace(/,/g,'').replace(/[^0-9.\-]/g,'');return s?Number(s):NaN;}
function number(v){return Math.round(Number(v)||0).toLocaleString('he-IL');}
function money(v){return `₪${number(v)}`;}
function one(v){return (Number(v)||0).toFixed(1);}
function safePdfText(value,maxLength){return String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').slice(0,maxLength);}
