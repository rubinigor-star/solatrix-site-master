import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import familyUrl from './assets/roof-check-report/roof-check-family.webp';
import { calculateCommercialEconomics, calculateResidentialEconomics } from './roofCheckEconomics.js';

const LOGO_URL='https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const FONT_URL='https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';
const C={paper:[250,249,246],navy:[7,31,50],navy2:[12,43,66],orange:[247,163,24],ink:[23,37,48],muted:[88,99,108],line:[222,219,211],white:[255,255,255],blue:[26,94,138],green:[35,163,93],grid:[228,231,233]};

export async function createRoofCheckPdfV3({customer={},reportData={}}={}){
  const roof=reportData.roofData||{};
  const values=buildValues(reportData.calculationModel||{},roof);
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  await installFonts(pdf);
  const [logo,hero,installers,family]=await Promise.all([loadImage(LOGO_URL,1200),loadImage(coverHeroUrl,2800),loadImage(installersUrl,2400),loadImage(familyUrl,2800)]);
  pageOne(pdf,{customer,roof,values,logo,hero});
  pdf.addPage(); pageTwo(pdf,{customer,values,logo,installers});
  pdf.addPage(); pageThree(pdf,{values,logo});
  pdf.addPage(); pageFour(pdf,{family,logo});
  pdf.setProperties({title:'Solatrix Roof Check V3',subject:'Premium solar feasibility report',author:'Solatrix Energy'});
  return pdf.output('blob');
}

function buildValues(model,roof){
  const roofArea=n(model.roofArea||(roof.surfaces||[]).reduce((s,v)=>s+n(v?.area),0));
  const usableArea=n(model.usableArea||roofArea*.82);
  const panels=n(model.panels||Math.floor(usableArea/4.7));
  const systemSizeKwp=n(model.systemSizeKwp||model.systemSize||model.dcSizeKwp||(panels*.63));
  const isCommercial=model.isCommercial===true||roof.roofType==='commercial'||systemSizeKwp>22.5;
  const economics=isCommercial?calculateCommercialEconomics({systemSizeKwp}):calculateResidentialEconomics({systemSizeKwp});
  return {...economics,roofArea,usableArea,panels,isCommercial,monthlyBill:n(model.monthlyBill||roof.monthlyBill)};
}

function pageOne(pdf,c){
  background(pdf); header(pdf,c.logo,'בדיקת כדאיות סולארית');
  imageCover(pdf,c.hero,15,34,180,72,7);
  pill(pdf,15,111,180,11,c.values.isCommercial?'מערכת מסחרית':'מערכת ביתית');
  const cards=[
    ['הספק מערכת',one(c.values.systemSizeKwp),'kWp'],
    ['ייצור שנתי',num(c.values.annualProduction),'kWh'],
    ['עלות לפני מע״מ',money(c.values.costBeforeVat),''],
    ['החזר השקעה )שנים(',one(c.values.paybackWithVat),'']
  ];
  cards.forEach((it,i)=>metricCard(pdf,15+i*45,128,41,31,it[0],it[1],it[2]));
  darkPanel(pdf,15,166,180,34,'האם הגג מתאים למערכת סולארית?','כן. לפי השטח שסומן, ניתן להקים מערכת יעילה עם פוטנציאל כלכלי משמעותי לאורך 25 שנה.');
  infoCard(pdf,15,207,87,28,'כתובת הנכס',c.roof.address||'—');
  infoCard(pdf,108,207,87,28,'שם הלקוח',c.customer.name||'—');
  infoCard(pdf,15,241,87,25,'שטח גג שסומן',`${num(c.values.roofArea)} מ״ר`);
  infoCard(pdf,108,241,87,25,'מספר פאנלים משוער',num(c.values.panels));
  footer(pdf,1);
}

function pageTwo(pdf,c){
  background(pdf); header(pdf,c.logo,'פירוט החישוב');
  darkMetric(pdf,15,38,60,64,'ייצור שנתי',num(c.values.annualProduction),'kWh');
  imageCover(pdf,c.installers,81,38,114,64,7);
  sectionTitle(pdf,'נתוני הפרויקט',195,116);
  const rows=[
    ['שטח גג מסומן',`${num(c.values.roofArea)} מ״ר`],
    ['שטח גג שמיש',`${num(c.values.usableArea)} מ״ר`],
    ['מספר פאנלים',num(c.values.panels)],
    ['הספק מערכת',`${one(c.values.systemSizeKwp)} kWp`],
    ['ייצור שנתי',`${num(c.values.annualProduction)} kWh`],
    ['עלות לפני מע״מ',money(c.values.costBeforeVat)],
    ['עלות כולל מע״מ',money(c.values.costWithVat)],
    ['החזר השקעה )שנים(',one(c.values.paybackWithVat)]
  ];
  rows.forEach((r,i)=>tableRow(pdf,15,124+i*15,115,12,r[0],r[1]));
  smallCard(pdf,137,124,58,27,'סוג מערכת',c.values.isCommercial?'מסחרית':'ביתית');
  smallCard(pdf,137,157,58,27,'חשבון חודשי',money(c.values.monthlyBill));
  smallCard(pdf,137,190,58,27,'טלפון',c.customer.phone||'—');
  smallCard(pdf,137,223,58,27,'מודל','נבדק');
  noteCard(pdf,15,253,180,22,'איך חישבנו?',c.values.isCommercial?'כל הייצור מחושב לפי תעריף מסחרי של 0.39 ₪ לקוט״ש.':'35% מהייצור מחושב כחיסכון עצמי לפי 0.64 ₪ לקוט״ש ו־65% כמכירה לרשת לפי 0.48 ₪ לקוט״ש.');
  footer(pdf,2);
}

function pageThree(pdf,c){
  background(pdf); header(pdf,c.logo,'תחזית ייצור וביצועים פיננסיים');
  const p=projection(c.values);
  const cards=[['השקעה כוללת',money(c.values.costWithVat)],['שנה ראשונה',money(c.values.annualSavings)],['החזר השקעה )שנים(',one(c.values.paybackWithVat)],['רווח נקי ל־25 שנה',money(p.netProfit25)]];
  cards.forEach((it,i)=>metricCard(pdf,15+i*45,39,41,29,it[0],it[1],''));
  chartShell(pdf,15,76,180,73,'ייצור חשמל חודשי צפוי'); monthlyChart(pdf,24,100,162,37,p.months);
  chartShell(pdf,15,157,180,68,'תזרים מצטבר והחזר השקעה'); cashflowChart(pdf,24,181,162,31,p.cashflow,c.values.paybackWithVat);
  summaryBand(pdf,15,233,180,39,p,c.values);
  footer(pdf,3);
}

function pageFour(pdf,c){
  background(pdf); header(pdf,c.logo,'איך מתקדמים מכאן?');
  const steps=[['1','שיחת היכרות','עוברים יחד על הדוח ועל מטרות הפרויקט.'],['2','בדיקת מסמכים','בודקים חשבון חשמל, חיבור קיים ובעלות.'],['3','בדיקת שטח','מוודאים הצללות, חשמל וקונסטרוקציה.'],['4','הצעה מלאה','מקבלים תכנון, ציוד, מחיר ולוחות זמנים.']];
  steps.forEach((s,i)=>stepCard(pdf,15+i*45,44,41,83,...s));
  imageCover(pdf,c.family,15,138,180,67,7);
  darkPanel(pdf,15,213,180,31,'דוח מקצועי ומוכן לשיתוף','הקובץ כולל את כל הנתונים, ההנחות והתחזית הפיננסית ומוכן לשליחה ללקוח.');
  brandBand(pdf,15,252,180,24);
  footer(pdf,4);
}

function projection(v){
  const labels=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'];
  const weights=[.055,.063,.081,.095,.108,.112,.115,.108,.091,.075,.055,.042];
  const months=weights.map((w,i)=>({label:labels[i],kwh:Math.round(v.annualProduction*w)}));
  const yearly=Array.isArray(v.yearlyProjection)?v.yearlyProjection:[];
  const cashflow=[{year:0,value:-v.costWithVat}];let cumulative=-v.costWithVat;
  yearly.forEach(y=>{cumulative+=y.income;cashflow.push({year:y.year,value:cumulative});});
  const totalIncome25=yearly.reduce((s,y)=>s+y.income,0);
  return{months,cashflow,totalIncome25,netProfit25:totalIncome25-v.costWithVat,roi25:v.costWithVat?((totalIncome25-v.costWithVat)/v.costWithVat)*100:0};
}

function background(pdf){pdf.setFillColor(...C.paper);pdf.rect(0,0,210,297,'F');}
function header(pdf,logo,title){if(logo)contain(pdf,logo,158,8,37,18);rtl(pdf,title,195,26,9.5,'bold',C.navy);pdf.setDrawColor(...C.orange);pdf.setLineWidth(.6);pdf.line(15,31,195,31);}
function footer(pdf,page){pdf.setDrawColor(...C.line);pdf.line(15,282,195,282);ltr(pdf,`${page} / 4`,15,290,3.1,'normal',C.muted,'left');ltr(pdf,'Solatrix Energy • Roof Check V3',195,290,3.1,'normal',C.muted,'right');}
function sectionTitle(pdf,text,x,y){rtl(pdf,text,x,y,5.8,'bold',C.navy);}
function pill(pdf,x,y,w,h,text){round(pdf,x,y,w,h,C.orange,C.orange,5);rtlCenter(pdf,text,x+w/2,y+7.3,4.2,'bold',C.navy);}
function metricCard(pdf,x,y,w,h,label,value,unit){card(pdf,x,y,w,h,6);rtlCenter(pdf,label,x+w/2,y+8,3.2,'bold',C.muted);ltr(pdf,value,x+w/2,y+20,5.8,'bold',C.navy,'center');if(unit)ltr(pdf,unit,x+w/2,y+27,2.9,'normal',C.muted,'center');}
function darkPanel(pdf,x,y,w,h,title,text){round(pdf,x,y,w,h,C.navy,C.navy,7);rtl(pdf,title,x+w-8,y+12,5.6,'bold',C.orange);rtl(pdf,text,x+w-8,y+23,3.8,'normal',[232,238,242],w-16);}
function infoCard(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,6);rtl(pdf,label,x+w-7,y+9,3.2,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-7,y+19,4.2,'bold',C.navy,w-14):ltr(pdf,value,x+w-7,y+19,4.2,'bold',C.navy,'right');}
function darkMetric(pdf,x,y,w,h,label,value,unit){round(pdf,x,y,w,h,C.navy,C.navy,7);rtlCenter(pdf,label,x+w/2,y+19,4.5,'bold',C.white);ltr(pdf,value,x+w/2,y+38,8,'bold',C.white,'center');ltr(pdf,unit,x+w/2,y+49,3.2,'normal',[224,233,239],'center');}
function tableRow(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,3);rtl(pdf,label,x+w-6,y+7.7,3.25,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+38,y+7.7,3.8,'bold',C.navy):ltr(pdf,value,x+6,y+7.7,3.8,'bold',C.navy,'left');}
function smallCard(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,5);rtl(pdf,label,x+w-6,y+9,3.1,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-6,y+19,4.2,'bold',C.navy):ltr(pdf,value,x+w-6,y+19,4.2,'bold',C.navy,'right');}
function noteCard(pdf,x,y,w,h,title,text){card(pdf,x,y,w,h,5);rtl(pdf,title,x+w-7,y+8,3.5,'bold',C.navy);rtl(pdf,text,x+w-7,y+16,3.1,'normal',C.muted,w-14);}
function chartShell(pdf,x,y,w,h,title){card(pdf,x,y,w,h,6);rtl(pdf,title,x+w-8,y+12,5,'bold',C.navy);}
function monthlyChart(pdf,x,y,w,h,months){const max=Math.max(...months.map(m=>m.kwh),1),bw=8.2,g=5.3,base=y+h;pdf.setDrawColor(...C.grid);for(let i=0;i<4;i++)pdf.line(x,y+i*h/3,x+w,y+i*h/3);months.forEach((m,i)=>{const bx=x+i*(bw+g)+2,bh=(m.kwh/max)*(h-9);pdf.setFillColor(...C.orange);pdf.roundedRect(bx,base-bh,bw,bh,1.5,1.5,'F');rtlCenter(pdf,m.label,bx+bw/2,base+5,2.4,'bold',C.muted);ltr(pdf,num(m.kwh),bx+bw/2,base-bh-2,2.1,'bold',C.navy,'center');});}
function cashflowChart(pdf,x,y,w,h,points,payback){const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1),px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h;pdf.setDrawColor(...C.grid);pdf.line(x,py(0),x+w,py(0));[0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+5,2.4,'normal',C.muted,'center');});pdf.setDrawColor(...C.blue);pdf.setLineWidth(1.1);for(let i=1;i<points.length;i++)pdf.line(px(points[i-1].year),py(points[i-1].value),px(points[i].year),py(points[i].value));pdf.setFillColor(...C.orange);pdf.circle(px(Math.min(payback,25)),py(0),2.1,'F');}
function summaryBand(pdf,x,y,w,h,p,v){round(pdf,x,y,w,h,C.navy,C.navy,6);rtlCenter(pdf,'סיכום פיננסי ל־25 שנה',x+w/2,y+9,4.2,'bold',C.orange);const items=[['הכנסה מצטברת',money(p.totalIncome25)],['השקעה',money(v.costWithVat)],['רווח נקי',money(p.netProfit25)],['ROI',`${Math.round(p.roi25)}%`]];const col=w/4;items.forEach((it,i)=>{const cx=x+col*i+col/2;if(i>0){pdf.setDrawColor(60,82,100);pdf.line(x+col*i,y+13,x+col*i,y+h-5);}ltr(pdf,it[1],cx,y+23,4.4,'bold',C.white,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(.5);pdf.line(cx-13,y+25,cx+13,y+25);if(it[0]==='ROI')ltr(pdf,it[0],cx,y+33,2.8,'bold',[227,234,239],'center');else rtlCenter(pdf,it[0],cx,y+33,2.8,'bold',[227,234,239]);});}
function stepCard(pdf,x,y,w,h,n,title,text){card(pdf,x,y,w,h,7);pdf.setFillColor(...C.navy);pdf.circle(x+w/2,y+13,7,'F');ltr(pdf,n,x+w/2,y+15,5.2,'bold',C.white,'center');rtlCenter(pdf,title,x+w/2,y+34,4.5,'bold',C.navy);rtlCenter(pdf,text,x+w/2,y+47,3.1,'normal',C.muted,w-10);}
function brandBand(pdf,x,y,w,h){round(pdf,x,y,w,h,C.navy,C.navy,6);ltr(pdf,'Solatrix Energy',x+w-8,y+10,4.6,'bold',C.orange,'right');ltr(pdf,'solatrix.energy',x+8,y+16,3.7,'bold',C.orange,'left');}
function card(pdf,x,y,w,h,r=5){round(pdf,x,y,w,h,C.white,C.line,r);}
function round(pdf,x,y,w,h,fill,stroke,r){pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.25);pdf.roundedRect(x,y,w,h,r,r,'FD');}
function rtl(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'right'});pdf.setR2L(false);}
function rtlCenter(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'center'});pdf.setR2L(false);}
function ltr(pdf,text,x,y,size,style='normal',color=C.ink,align='left'){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(false);pdf.text(String(text??''),x,y,{align});}
function hasHebrew(v){return /[\u0590-\u05ff]/.test(String(v??''));}
function mm(v){return v*2.8346457;}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}
function num(v){return Math.round(n(v)).toLocaleString('he-IL');}
function one(v){return n(v).toFixed(1);}
function money(v){return `₪${num(v)}`;}
async function installFonts(pdf){const b=await fetchBase64(FONT_URL);pdf.addFileToVFS('Heebo-Regular.ttf',b);pdf.addFileToVFS('Heebo-Bold.ttf',b);pdf.addFont('Heebo-Regular.ttf','Heebo','normal');pdf.addFont('Heebo-Bold.ttf','Heebo','bold');}
async function fetchBase64(url){const res=await fetch(url,{mode:'cors',cache:'force-cache'});if(!res.ok)throw new Error(`Font request failed: ${res.status}`);const bytes=new Uint8Array(await res.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
async function loadImage(url,max=3000){try{const res=await fetch(url,{mode:'cors',cache:'no-cache'});if(!res.ok)throw new Error(res.status);const blob=await res.blob();const bitmap=await createImageBitmap(blob);const scale=Math.min(1,max/bitmap.width),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();return{data:canvas.toDataURL('image/jpeg',.96),width:w,height:h};}catch(e){console.warn('Image load failed',url,e);return null;}}
function imageCover(pdf,image,x,y,w,h,r=0){if(!image)return;const sr=image.width/image.height,tr=w/h;let dw=w,dh=h,dx=x,dy=y;if(sr>tr){dw=h*sr;dx=x-(dw-w)/2;}else{dh=w/sr;dy=y-(dh-h)/2;}pdf.saveGraphicsState();pdf.roundedRect(x,y,w,h,r,r,null);pdf.clip();pdf.discardPath();pdf.addImage(image.data,'JPEG',dx,dy,dw,dh,undefined,'NONE');pdf.restoreGraphicsState();}
function contain(pdf,image,x,y,w,h){if(!image)return;const ratio=Math.min(w/image.width,h/image.height),dw=image.width*ratio,dh=image.height*ratio;pdf.addImage(image.data,'JPEG',x+(w-dw)/2,y+(h-dh)/2,dw,dh,undefined,'NONE');}
