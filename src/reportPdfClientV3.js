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
  const generatedAt=new Date().toLocaleDateString('he-IL');
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
  drawImageCover(pdf,c.hero,6,6,198,92);

  // logo cut-out matching approved reference
  pdf.setFillColor(...C.white);pdf.roundedRect(6,6,52,25,0,0,'F');
  if(c.logo)contain(pdf,c.logo,12,8,38,20);

  ltr(pdf,'ROOF CHECK BY SOLATRIX',198,14,2.35,'bold',C.orange,'right');
  rtl(pdf,'הגיע הזמן לחסוך',198,29,8.0,'bold',C.white);
  rtl(pdf,'בחשמל',198,41,10.0,'bold',C.orange);
  rtl(pdf,'דוח מקצועי ואמין לבדיקת כדאיות',198,50,3.2,'normal',C.white);
  rtl(pdf,'להתקנת מערכת סולארית.',198,56,3.2,'normal',C.white);

  // single validation badge only
  panel(pdf,13,74,67,18,C.navy,C.orange,5);
  markCheck(pdf,23,83,C.orange,4.5);
  rtl(pdf,'בדיקת התאמה ראשונית',74,81,3.0,'bold',C.white);
  rtl(pdf,'וללא התחייבות',74,87,2.8,'bold',C.white);

  panel(pdf,6,103,198,12,C.orange,C.orange,5);
  rtlCenter(pdf,c.v.isCommercial?'בדיקת כדאיות למערכת מסחרית':'בדיקת כדאיות למערכת ביתית',105,111,5.0,'bold',C.navy);

  // money-first hierarchy
  moneyHero(pdf,6,121,92,39,'הכנסה וחיסכון צפויים בשנה',money(c.v.annualSavings));
  metric(pdf,104,121,48,39,'עלות מערכת',money(c.v.costWithVat));
  metric(pdf,156,121,48,39,'החזר השקעה',`${one(c.v.paybackWithVat)} שנים`);

  metric(pdf,6,166,62,31,'הספק מערכת',`${one(c.v.systemSizeKwp)} kWp`);
  metric(pdf,74,166,62,31,'ייצור שנתי',`${num(c.v.annualProduction)} kWh`);
  metric(pdf,142,166,62,31,'שטח גג',`${num(c.v.roofArea)} מ״ר`);

  panel(pdf,6,204,198,30,C.navy,C.navy,6);
  rtl(pdf,'מה זה אומר עבורך?',197,216,5.0,'bold',C.orange);
  rtl(pdf,`לפי הנתונים שסומנו, המערכת צפויה לייצר עבורך ערך של כ־${money(c.v.annualSavings)} בכל שנה, לפני עלויות מימון ותחזוקה חריגות.`,197,226,3.25,'normal',C.white,181);

  const facts=[
    ['כתובת הנכס',c.roof.address||'—'],
    ['שם הלקוח',c.customer.name||'—'],
    ['תאריך הדוח',c.generatedAt],
    ['מספר פאנלים',num(c.v.panels)]
  ];
  facts.forEach((f,i)=>fact(pdf,6+i*49.5,240,49.5,28,f[0],f[1],i>0));
  footer(pdf,1);
}

function pageTwo(pdf,c){
  bg(pdf);
  if(c.logo)contain(pdf,c.logo,160,6,36,18);
  rtl(pdf,'כך בנוי החישוב',202,27,7.0,'bold',C.navy);
  pdf.setDrawColor(...C.orange);pdf.setLineWidth(.55);pdf.line(6,30,204,30);

  panel(pdf,6,37,62,62,C.navy,C.navy,7);
  rtlCenter(pdf,'הכנסה וחיסכון שנתי',37,55,3.5,'bold',C.white);
  ltr(pdf,money(c.v.annualSavings),37,76,7.4,'bold',C.white,'center');
  rtlCenter(pdf,'בשנה',37,88,2.8,'bold',C.orange);
  drawImageCover(pdf,c.installers,74,37,130,62);

  rtl(pdf,'פירוט הפרויקט',202,112,5.8,'bold',C.navy);
  const rows=[
    ['שטח גג שסומן',`${num(c.v.roofArea)} מ״ר`],['שטח גג שמיש',`${num(c.v.usableArea)} מ״ר`],['מספר פאנלים',num(c.v.panels)],['הספק מערכת',`${one(c.v.systemSizeKwp)} kWp`],['ייצור חשמל שנתי',`${num(c.v.annualProduction)} kWh`],['עלות לפני מע״מ',money(c.v.costBeforeVat)],['עלות כולל מע״מ',money(c.v.costWithVat)],['תקופת החזר השקעה',`${one(c.v.paybackWithVat)} שנים`],['סוג מערכת',c.v.isCommercial?'מסחרית':'ביתית']
  ];
  rows.forEach((r,i)=>row(pdf,6,119+i*9.2,116,8,r[0],r[1]));
  side(pdf,128,119,76,25,'חשבון חודשי',money(c.v.monthlyBill||0));
  side(pdf,128,149,76,25,'טלפון',c.customer.phone||'—');
  side(pdf,128,179,76,25,'סטטוס חישוב','נבדק');

  const p=projection(c.v);
  chartBox(pdf,6,211,96,46,'ייצור חשמל חודשי');
  monthlyChart(pdf,12,225,84,23,p.months);
  chartBox(pdf,108,211,96,46,'תזרים מצטבר והחזר השקעה');
  cashChart(pdf,114,225,84,23,p.cashflow,c.v.paybackWithVat);

  summary(pdf,6,264,198,24,p,c.v);
  footer(pdf,2);
}

function projection(v){
  const labels=['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצ'];
  const weights=[.055,.063,.081,.095,.108,.112,.115,.108,.091,.075,.055,.042];
  const months=weights.map((w,i)=>({label:labels[i],kwh:Math.round(v.annualProduction*w)}));
  const yearly=Array.isArray(v.yearlyProjection)?v.yearlyProjection:[];
  const cashflow=[{year:0,value:-v.costWithVat}];let c=-v.costWithVat;
  yearly.forEach(y=>{c+=y.income;cashflow.push({year:y.year,value:c});});
  const totalIncome25=yearly.reduce((s,y)=>s+y.income,0);
  return{months,cashflow,totalIncome25,netProfit25:totalIncome25-v.costWithVat,roi25:v.costWithVat?((totalIncome25-v.costWithVat)/v.costWithVat)*100:0};
}

function moneyHero(pdf,x,y,w,h,label,value){panel(pdf,x,y,w,h,C.white,C.line,6);rtlCenter(pdf,label,x+w/2,y+10,3.2,'bold',C.muted);ltr(pdf,value,x+w/2,y+26,7.3,'bold',C.navy,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(.8);pdf.line(x+20,y+32,x+w-20,y+32);}
function metric(pdf,x,y,w,h,label,value){panel(pdf,x,y,w,h,C.white,C.line,6);rtlCenter(pdf,label,x+w/2,y+10,3.0,'bold',C.muted);hasHebrew(value)?rtlCenter(pdf,value,x+w/2,y+25,5.0,'bold',C.navy):ltr(pdf,value,x+w/2,y+25,5.0,'bold',C.navy,'center');}
function fact(pdf,x,y,w,h,label,value,divider){if(divider){pdf.setDrawColor(...C.line);pdf.line(x,y+3,x,y+h-3);}rtlCenter(pdf,label,x+w/2,y+9,2.6,'normal',C.muted);hasHebrew(value)?rtlCenter(pdf,value,x+w/2,y+19,3.1,'bold',C.navy,w-7):ltr(pdf,value,x+w/2,y+19,3.1,'bold',C.navy,'center');}
function row(pdf,x,y,w,h,label,value){pdf.setDrawColor(...C.line);pdf.line(x,y+h,x+w,y+h);rtl(pdf,label,x+w-3,y+5.6,2.65,'normal',C.muted);hasHebrew(value)?rtl(pdf,value,x+45,y+5.6,2.9,'bold',C.navy):ltr(pdf,value,x+3,y+5.6,2.9,'bold',C.navy,'left');}
function side(pdf,x,y,w,h,label,value){panel(pdf,x,y,w,h,C.white,C.line,5);rtl(pdf,label,x+w-6,y+8,2.8,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-6,y+18,3.8,'bold',C.navy):ltr(pdf,value,x+w-6,y+18,3.8,'bold',C.navy,'right');}
function chartBox(pdf,x,y,w,h,title){panel(pdf,x,y,w,h,C.white,C.line,5);rtlCenter(pdf,title,x+w/2,y+9,3.0,'bold',C.navy);}
function monthlyChart(pdf,x,y,w,h,months){const max=Math.max(...months.map(m=>m.kwh),1),bw=4.1,g=2.7,base=y+h;pdf.setDrawColor(...C.grid);for(let i=0;i<3;i++)pdf.line(x,y+i*h/2,x+w,y+i*h/2);months.forEach((m,i)=>{const bx=x+i*(bw+g)+1,bh=(m.kwh/max)*(h-6);pdf.setFillColor(...C.orange);pdf.rect(bx,base-bh,bw,bh,'F');rtlCenter(pdf,m.label,bx+bw/2,base+3,1.4,'bold',C.muted);});}
function cashChart(pdf,x,y,w,h,pts,payback){const vals=pts.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1),px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h;pdf.setDrawColor(...C.grid);[0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+3,1.5,'normal',C.muted,'center');});pdf.setDrawColor(...C.navy);pdf.setLineWidth(.8);for(let i=1;i<pts.length;i++)pdf.line(px(pts[i-1].year),py(pts[i-1].value),px(pts[i].year),py(pts[i].value));pdf.setFillColor(...C.orange);pdf.circle(px(Math.min(payback,25)),py(0),1.4,'F');}
function summary(pdf,x,y,w,h,p,v){panel(pdf,x,y,w,h,C.navy,C.navy,5);const items=[['הכנסה ל־25 שנה',money(p.totalIncome25)],['השקעה',money(v.costWithVat)],['רווח נקי',money(p.netProfit25)],['ROI',`${Math.round(p.roi25)}%`]],cw=w/4;items.forEach((it,i)=>{const cx=x+cw*i+cw/2;if(i){pdf.setDrawColor(61,82,99);pdf.line(x+cw*i,y+4,x+cw*i,y+h-4);}ltr(pdf,it[1],cx,y+9,3.5,'bold',C.white,'center');pdf.setDrawColor(...C.orange);pdf.line(cx-10,y+12,cx+10,y+12);it[0]==='ROI'?ltr(pdf,it[0],cx,y+19,2.4,'bold',C.white,'center'):rtlCenter(pdf,it[0],cx,y+19,2.4,'bold',C.white);});}
function markCheck(pdf,x,y,color,s){pdf.setDrawColor(...color);pdf.setLineWidth(.8);pdf.circle(x,y,s,'S');pdf.line(x-s*.45,y,x-s*.05,y+s*.35);pdf.line(x-s*.05,y+s*.35,x+s*.55,y-s*.35);}
function panel(pdf,x,y,w,h,fill,stroke,r){pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.25);pdf.roundedRect(x,y,w,h,r,r,'FD');}
function bg(pdf){pdf.setFillColor(...C.paper);pdf.rect(0,0,210,297,'F');}
function footer(pdf,page){pdf.setDrawColor(...C.line);pdf.line(6,292,204,292);ltr(pdf,`${page} / 2`,7,296,2.2,'normal',C.muted,'left');ltr(pdf,'solatrix.energy',203,296,2.2,'bold',C.muted,'right');}
function rtl(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(size*2.8346);pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'right'});pdf.setR2L(false);}
function rtlCenter(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(size*2.8346);pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'center'});pdf.setR2L(false);}
function ltr(pdf,text,x,y,size,style='normal',color=C.ink,align='left'){pdf.setFont('Heebo',style);pdf.setFontSize(size*2.8346);pdf.setTextColor(...color);pdf.setR2L(false);pdf.text(String(text??''),x,y,{align});}
function hasHebrew(v){return /[\u0590-\u05ff]/.test(String(v??''));}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0;}function num(v){return Math.round(n(v)).toLocaleString('he-IL');}function one(v){return n(v).toFixed(1);}function money(v){return `₪${num(v)}`;}
async function installFonts(pdf){const b=await fetchBase64(FONT_URL);pdf.addFileToVFS('Heebo-Regular.ttf',b);pdf.addFileToVFS('Heebo-Bold.ttf',b);pdf.addFont('Heebo-Regular.ttf','Heebo','normal');pdf.addFont('Heebo-Bold.ttf','Heebo','bold');}
async function fetchBase64(url){const r=await fetch(url,{mode:'cors',cache:'force-cache'});if(!r.ok)throw new Error(`Font request failed: ${r.status}`);const bytes=new Uint8Array(await r.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
async function loadImage(url,max=3000){try{const r=await fetch(url,{mode:'cors',cache:'no-cache'});if(!r.ok)throw new Error(r.status);const blob=await r.blob();const bmp=await createImageBitmap(blob);const scale=Math.min(1,max/bmp.width),w=Math.round(bmp.width*scale),h=Math.round(bmp.height*scale);const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);bmp.close?.();return{data:c.toDataURL('image/jpeg',.95),width:w,height:h};}catch(e){console.warn('Image load failed',url,e);return null;}}
function drawImageCover(pdf,img,x,y,w,h){if(!img)return;const sr=img.width/img.height,tr=w/h;let dw=w,dh=h,dx=x,dy=y;if(sr>tr){dw=h*sr;dx=x-(dw-w)/2;}else{dh=w/sr;dy=y-(dh-h)/2;}pdf.addImage(img.data,'JPEG',dx,dy,dw,dh,undefined,'NONE');}
function contain(pdf,img,x,y,w,h){if(!img)return;const k=Math.min(w/img.width,h/img.height),dw=img.width*k,dh=img.height*k;pdf.addImage(img.data,'JPEG',x+(w-dw)/2,y+(h-dh)/2,dw,dh,undefined,'NONE');}
