import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import { calculateCommercialEconomics, calculateResidentialEconomics } from './roofCheckEconomics.js';

const LOGO_URL='https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const FONT_URL='https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';
const C={paper:[250,249,246],navy:[5,31,50],orange:[248,162,20],ink:[21,35,47],muted:[91,101,110],line:[219,217,210],white:[255,255,255],grid:[228,231,233]};

export async function createRoofCheckPdfV3({customer={},reportData={}}={}){
  const roof=reportData.roofData||{};
  const v=buildValues(reportData.calculationModel||{},roof);
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  await installFonts(pdf);
  const [logo,hero,installers]=await Promise.all([loadImage(LOGO_URL,1200),loadImage(coverHeroUrl,2400),loadImage(installersUrl,2200)]);
  const generatedAt=new Date().toLocaleString('he-IL',{year:'numeric',month:'2-digit',day:'2-digit'});
  pageOne(pdf,{customer,roof,v,logo,hero,generatedAt});
  pdf.addPage();
  pageTwo(pdf,{customer,v,logo,installers});
  pdf.setProperties({title:'Solatrix Roof Check V3 Premium',subject:'Two-page premium solar feasibility report',author:'Solatrix Energy'});
  return pdf.output('blob');
}

function buildValues(model,roof){
  const roofArea=n(model.roofArea||(roof.surfaces||[]).reduce((s,x)=>s+n(x?.area),0));
  const usableArea=n(model.usableArea||roofArea*.82);
  const panels=n(model.panels||Math.floor(usableArea/4.7));
  const systemSizeKwp=n(model.systemSizeKwp||model.systemSize||model.dcSizeKwp||(panels*.63));
  const isCommercial=model.isCommercial===true||roof.roofType==='commercial'||systemSizeKwp>22.5;
  const economics=isCommercial?calculateCommercialEconomics({systemSizeKwp}):calculateResidentialEconomics({systemSizeKwp});
  return {...economics,roofArea,usableArea,panels,systemSizeKwp,isCommercial,monthlyBill:n(model.monthlyBill||roof.monthlyBill)};
}

function pageOne(pdf,c){
  bg(pdf);
  if(c.hero)pdf.addImage(c.hero.data,'JPEG',6,6,198,91,undefined,'FAST');
  softOverlay(pdf,6,6,198,91);
  whiteLogoPlate(pdf,8,8,49,24);
  if(c.logo)contain(pdf,c.logo,12,9,39,20);
  ltr(pdf,'ROOF CHECK BY SOLATRIX',198,15,2.4,'bold',C.orange,'right');
  rtl(pdf,'כמה כסף הגג שלך יכול לייצר?',198,31,8.4,'bold',C.white);
  rtl(pdf,'הערכה ראשונית, מקצועית וללא התחייבות',198,43,3.4,'normal',C.white);
  darkBadge(pdf,13,70,66,18,'בדיקת התאמה ראשונית','למערכת סולארית');

  orangeBand(pdf,6,102,198,12,c.v.isCommercial?'בדיקת כדאיות למערכת מסחרית':'בדיקת כדאיות למערכת ביתית');

  const annual=money(c.v.annualSavings||0);
  primaryMoneyCard(pdf,6,120,98,44,'הכנסה וחיסכון צפויים בשנה',annual);
  compactCard(pdf,108,120,46,44,'עלות מערכת',money(c.v.costWithVat||c.v.costBeforeVat),'wallet');
  compactCard(pdf,158,120,46,44,'החזר השקעה',`${one(c.v.paybackWithVat)} שנים`,'clock');

  const secondary=[
    ['הספק מערכת',`${one(c.v.systemSizeKwp)} kWp`,'bolt'],
    ['ייצור שנתי',`${num(c.v.annualProduction)} kWh`,'panel'],
    ['שטח גג',`${num(c.v.roofArea)} מ״ר`,'grid']
  ];
  secondary.forEach((x,i)=>miniStat(pdf,6+i*67,170,63,28,...x));

  darkSummary(pdf,6,204,198,33,'מה זה אומר עבורך?',`לפי הנתונים שסומנו, המערכת צפויה לייצר עבורך ערך של כ־${annual} בכל שנה, לפני עלויות מימון ותחזוקה חריגות.`);

  const facts=[
    ['כתובת הנכס',c.roof.address||'—'],
    ['שם הלקוח',c.customer.name||'—'],
    ['תאריך הדוח',c.generatedAt],
    ['מספר פאנלים',num(c.v.panels)]
  ];
  facts.forEach((x,i)=>fact(pdf,6+i*50,243,47,25,x[0],x[1]));

  footer(pdf,1);
}

function pageTwo(pdf,c){
  bg(pdf);
  if(c.logo)contain(pdf,c.logo,158,5,40,21);
  rtl(pdf,'כך בנוי החישוב',202,25,7.2,'bold',C.navy);
  pdf.setDrawColor(...C.orange);pdf.setLineWidth(.55);pdf.line(6,29,204,29);

  darkMetric(pdf,6,35,61,56,'הכנסה וחיסכון שנתי',money(c.v.annualSavings||0),'בשנה');
  if(c.installers)pdf.addImage(c.installers.data,'JPEG',73,35,131,56,undefined,'FAST');

  rtl(pdf,'פירוט הפרויקט',202,104,4.8,'bold',C.navy);
  const rows=[
    ['שטח גג שסומן',`${num(c.v.roofArea)} מ״ר`],
    ['שטח גג שמיש',`${num(c.v.usableArea)} מ״ר`],
    ['מספר פאנלים',num(c.v.panels)],
    ['הספק מערכת',`${one(c.v.systemSizeKwp)} kWp`],
    ['ייצור חשמל שנתי',`${num(c.v.annualProduction)} kWh`],
    ['עלות לפני מע״מ',money(c.v.costBeforeVat)],
    ['עלות כולל מע״מ',money(c.v.costWithVat)],
    ['תקופת החזר השקעה',`${one(c.v.paybackWithVat)} שנים`],
    ['סוג מערכת',c.v.isCommercial?'מסחרית':'ביתית']
  ];
  rows.forEach((r,i)=>tableRow(pdf,6,111+i*9.1,118,8,r[0],r[1]));

  sideInfo(pdf,130,111,74,25,'חשבון חודשי',money(c.v.monthlyBill||0));
  sideInfo(pdf,130,141,74,25,'טלפון',c.customer.phone||'—',true);
  sideInfo(pdf,130,171,74,25,'סטטוס חישוב','נבדק');

  const p=projection(c.v);
  chartShell(pdf,6,204,96,53,'ייצור חשמל חודשי');
  monthlyChart(pdf,12,221,84,26,p.months);
  chartShell(pdf,108,204,96,53,'תזרים מצטבר והחזר השקעה');
  cashflowChart(pdf,115,221,82,26,p.cashflow,c.v.paybackWithVat);

  summaryBand(pdf,6,263,198,24,p,c.v);
  footer(pdf,2);
}

function projection(v){
  const labels=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'];
  const weights=[.055,.063,.081,.095,.108,.112,.115,.108,.091,.075,.055,.042];
  const months=weights.map((w,i)=>({label:labels[i],kwh:Math.round(v.annualProduction*w)}));
  let yearly=Array.isArray(v.yearlyProjection)?v.yearlyProjection:[];
  if(!yearly.length){yearly=Array.from({length:25},(_,i)=>({year:i+1,income:(v.annualSavings||0)*Math.pow(.996,i)}));}
  const cashflow=[{year:0,value:-v.costWithVat}];let cumulative=-v.costWithVat;
  yearly.forEach(y=>{cumulative+=n(y.income);cashflow.push({year:y.year,value:cumulative});});
  const totalIncome25=yearly.reduce((s,y)=>s+n(y.income),0);
  return{months,cashflow,totalIncome25,netProfit25:totalIncome25-v.costWithVat,roi25:v.costWithVat?((totalIncome25-v.costWithVat)/v.costWithVat)*100:0};
}

function softOverlay(pdf,x,y,w,h){pdf.setFillColor(4,22,36);pdf.setGState?.(new pdf.GState({opacity:.22}));pdf.rect(x,y,w,h,'F');pdf.setGState?.(new pdf.GState({opacity:1}));}
function whiteLogoPlate(pdf,x,y,w,h){pdf.setFillColor(...C.white);pdf.roundedRect(x,y,w,h,6,6,'F');}
function orangeBand(pdf,x,y,w,h,text){pdf.setFillColor(...C.orange);pdf.roundedRect(x,y,w,h,5,5,'F');rtlCenter(pdf,text,x+w/2,y+8.2,4.8,'bold',C.navy);}
function darkBadge(pdf,x,y,w,h,title,text){pdf.setFillColor(...C.navy);pdf.setDrawColor(...C.orange);pdf.roundedRect(x,y,w,h,5,5,'FD');rtl(pdf,title,x+w-6,y+7,3,'bold',C.white);rtl(pdf,text,x+w-6,y+13,2.8,'bold',C.white);}
function primaryMoneyCard(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,6);rtl(pdf,label,x+w-7,y+11,3.5,'bold',C.muted);ltr(pdf,value,x+w/2,y+29,9,'bold',C.navy,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(1);pdf.line(x+20,y+36,x+w-20,y+36);}
function compactCard(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,6);rtlCenter(pdf,label,x+w/2,y+11,3,'bold',C.muted);hasHebrew(value)?rtlCenter(pdf,value,x+w/2,y+28,5,'bold',C.navy):ltr(pdf,value,x+w/2,y+28,5,'bold',C.navy,'center');}
function miniStat(pdf,x,y,w,h,label,value){card(pdf,x,y,w,h,5);rtl(pdf,label,x+w-5,y+9,2.7,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-5,y+19,3.8,'bold',C.navy):ltr(pdf,value,x+w-5,y+19,3.8,'bold',C.navy,'right');}
function darkSummary(pdf,x,y,w,h,title,text){pdf.setFillColor(...C.navy);pdf.roundedRect(x,y,w,h,6,6,'F');rtl(pdf,title,x+w-7,y+11,4.7,'bold',C.orange);rtl(pdf,text,x+w-7,y+22,3.2,'normal',C.white,w-14);}
function fact(pdf,x,y,w,h,label,value){if(x>6){pdf.setDrawColor(...C.line);pdf.line(x,y+3,x,y+h-3);}rtl(pdf,label,x+w-4,y+8,2.6,'normal',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-4,y+18,3,'bold',C.navy,w-8):ltr(pdf,value,x+w-4,y+18,3,'bold',C.navy,'right');}
function darkMetric(pdf,x,y,w,h,label,value,suffix){pdf.setFillColor(...C.navy);pdf.roundedRect(x,y,w,h,6,6,'F');rtlCenter(pdf,label,x+w/2,y+15,3.4,'bold',C.white);ltr(pdf,value,x+w/2,y+34,7.3,'bold',C.white,'center');rtlCenter(pdf,suffix,x+w/2,y+46,2.8,'bold',C.orange);}
function tableRow(pdf,x,y,w,h,label,value){pdf.setDrawColor(...C.line);pdf.setLineWidth(.2);pdf.line(x,y+h,x+w,y+h);rtl(pdf,label,x+w-3,y+5.7,2.7,'normal',C.muted);if(hasHebrew(value))rtl(pdf,value,x+47,y+5.7,2.9,'bold',C.navy);else ltr(pdf,value,x+3,y+5.7,2.9,'bold',C.navy,'left');}
function sideInfo(pdf,x,y,w,h,label,value,isPhone=false){card(pdf,x,y,w,h,5);rtl(pdf,label,x+w-6,y+8,2.8,'bold',C.muted);if(isPhone)ltr(pdf,value,x+w-6,y+18,3.9,'bold',C.navy,'right');else if(hasHebrew(value))rtl(pdf,value,x+w-6,y+18,3.8,'bold',C.navy);else ltr(pdf,value,x+w-6,y+18,3.8,'bold',C.navy,'right');}
function chartShell(pdf,x,y,w,h,title){card(pdf,x,y,w,h,5);rtlCenter(pdf,title,x+w/2,y+9,3,'bold',C.navy);}
function monthlyChart(pdf,x,y,w,h,months){const max=Math.max(...months.map(m=>m.kwh),1),bw=4.2,g=2.55,base=y+h;pdf.setDrawColor(...C.grid);for(let i=0;i<4;i++)pdf.line(x,y+i*h/3,x+w,y+i*h/3);months.forEach((m,i)=>{const bx=x+i*(bw+g)+1,bh=Math.max(1,(m.kwh/max)*(h-7));pdf.setFillColor(...C.orange);pdf.rect(bx,base-bh,bw,bh,'F');rtlCenter(pdf,m.label,bx+bw/2,base+3.2,1.45,'bold',C.muted);});}
function cashflowChart(pdf,x,y,w,h,points,payback){const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1),px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h;pdf.setDrawColor(...C.grid);[0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+3.2,1.5,'normal',C.muted,'center');});pdf.setDrawColor(...C.navy);pdf.setLineWidth(.8);for(let i=1;i<points.length;i++)pdf.line(px(points[i-1].year),py(points[i-1].value),px(points[i].year),py(points[i].value));pdf.setFillColor(...C.orange);pdf.circle(px(Math.min(payback,25)),py(0),1.4,'F');}
function summaryBand(pdf,x,y,w,h,p,v){pdf.setFillColor(...C.navy);pdf.roundedRect(x,y,w,h,5,5,'F');const items=[['הכנסה ל־25 שנה',money(p.totalIncome25)],['השקעה',money(v.costWithVat)],['רווח נקי',money(p.netProfit25)],['ROI',`${Math.round(p.roi25)}%`]];const col=w/4;items.forEach((it,i)=>{const cx=x+col*i+col/2;if(i){pdf.setDrawColor(65,86,102);pdf.line(x+col*i,y+4,x+col*i,y+h-4);}ltr(pdf,it[1],cx,y+9,3.5,'bold',C.white,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(.6);pdf.line(cx-10,y+12,cx+10,y+12);it[0]==='ROI'?ltr(pdf,it[0],cx,y+19,2.4,'bold',C.white,'center'):rtlCenter(pdf,it[0],cx,y+19,2.4,'bold',C.white);});}
function footer(pdf,page){pdf.setDrawColor(...C.line);pdf.line(6,292,204,292);ltr(pdf,`${page} / 2`,7,296,2.2,'normal',C.muted,'left');ltr(pdf,'solatrix.energy',203,296,2.2,'bold',C.muted,'right');}
function bg(pdf){pdf.setFillColor(...C.paper);pdf.rect(0,0,210,297,'F');}
function card(pdf,x,y,w,h,r=5){pdf.setFillColor(...C.white);pdf.setDrawColor(...C.line);pdf.setLineWidth(.25);pdf.roundedRect(x,y,w,h,r,r,'FD');}
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
async function loadImage(url,max=2400){try{const res=await fetch(url,{mode:'cors',cache:'no-cache'});if(!res.ok)throw new Error(String(res.status));const blob=await res.blob();const bitmap=await createImageBitmap(blob);const scale=Math.min(1,max/bitmap.width),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();return{data:canvas.toDataURL('image/jpeg',.94),width:w,height:h};}catch(e){console.warn('Image load failed',url,e);return null;}}
function contain(pdf,image,x,y,w,h){if(!image)return;const ratio=Math.min(w/image.width,h/image.height),dw=image.width*ratio,dh=image.height*ratio;pdf.addImage(image.data,'JPEG',x+(w-dw)/2,y+(h-dh)/2,dw,dh,undefined,'FAST');}
