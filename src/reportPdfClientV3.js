import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import { calculateCommercialEconomics, calculateResidentialEconomics } from './roofCheckEconomics.js';

const LOGO_URL='https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const FONT_URL='https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';
const C={paper:[250,249,246],navy:[6,31,50],orange:[247,163,24],ink:[22,36,48],muted:[88,99,108],line:[220,218,211],white:[255,255,255],blue:[24,91,136],grid:[228,231,233],green:[35,163,93]};

export async function createRoofCheckPdfV3({customer={},reportData={}}={}){
  const roof=reportData.roofData||{};
  const values=buildValues(reportData.calculationModel||{},roof);
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  await installFonts(pdf);
  const [logo,hero,installers]=await Promise.all([loadImage(LOGO_URL,1200),loadImage(coverHeroUrl,2800),loadImage(installersUrl,2400)]);
  const generatedAt=new Date().toLocaleString('he-IL',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  pageOne(pdf,{customer,roof,values,logo,hero,generatedAt});
  pdf.addPage();
  pageTwo(pdf,{customer,values,logo,installers});
  pdf.setProperties({title:'Solatrix Roof Check V3 Executive',subject:'Two-page premium solar feasibility report',author:'Solatrix Energy'});
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
  background(pdf);
  imageCover(pdf,c.hero,6,6,198,92,7);
  pdf.setFillColor(...C.white);pdf.roundedRect(6,6,48,23,7,7,'F');
  if(c.logo)contain(pdf,c.logo,11,7,36,20);
  ltr(pdf,'ROOF CHECK BY SOLATRIX',198,15,2.5,'bold',C.orange,'right');
  rtl(pdf,'הגיע הזמן לחסוך',198,29,8.3,'bold',C.white);
  rtl(pdf,'בחשמל',198,40,10.5,'bold',C.orange);
  rtl(pdf,'דוח מקצועי ואמין לבדיקת כדאיות',198,49,3.3,'normal',C.white);
  rtl(pdf,'להתקנת מערכת סולארית.',198,55,3.3,'normal',C.white);
  darkBadge(pdf,12,72,63,19,'בדיקת התאמה ראשונית','וללא התחייבות');

  round(pdf,6,102,198,12,C.orange,C.orange,5);
  rtlCenter(pdf,c.values.isCommercial?'בדיקת כדאיות למערכת מסחרית':'בדיקת כדאיות למערכת ביתית',105,110,5.0,'bold',C.navy);

  const cards=[
    ['הספק מערכת משוער',one(c.values.systemSizeKwp),'kWp','bolt'],
    ['ייצור שנתי צפוי',num(c.values.annualProduction),'kWh','panel'],
    ['עלות לפני מע״מ',money(c.values.costBeforeVat),'','wallet'],
    ['החזר השקעה',one(c.values.paybackWithVat),'שנים','clock']
  ];
  cards.forEach((it,i)=>kpiCard(pdf,6+i*50,120,47,34,...it));

  round(pdf,6,160,198,31,C.navy,C.navy,6);
  icon(pdf,'question',20,175,C.white,7);
  rtl(pdf,'מה בדקנו?',197,171,5.0,'bold',C.white);
  rtl(pdf,'הדוח מתרגם את שטח הגג שסומן להספק מערכת, ייצור שנתי, ערך כספי, עלות הקמה ותחזית ל־25 שנה.',197,182,3.3,'normal',[229,236,241],160);

  const facts=[
    ['כתובת הנכס',c.roof.address||'—','pin'],
    ['שם הלקוח',c.customer.name||'—','user'],
    ['תאריך הפקה',c.generatedAt,'calendar'],
    ['שטח גג שסומן',`${num(c.values.roofArea)} מ״ר`,'grid']
  ];
  facts.forEach((it,i)=>factStrip(pdf,6+i*50,198,47,28,...it));

  round(pdf,6,234,198,34,C.navy,C.navy,6);
  rtl(pdf,'סיכום ראשוני',197,246,5.2,'bold',C.orange);
  rtl(pdf,'הגג שנבדק מתאים להמשך בדיקה מקצועית ותכנון מערכת סולארית. הנתונים הם אומדן ראשוני וייבדקו בשטח.',197,258,3.4,'normal',C.white,180);
  footer(pdf,1);
}

function pageTwo(pdf,c){
  background(pdf);
  header(pdf,c.logo,'כך בנוי החישוב');
  darkMetric(pdf,6,32,62,61,'ייצור שנתי',num(c.values.annualProduction),'kWh',`${one(c.values.systemSizeKwp)} kWp × 1,650`);
  imageCover(pdf,c.installers,74,32,130,61,7);

  sectionTitle(pdf,'פירוט הפרויקט',202,106);
  const rows=[
    ['שטח גג מסומן',`${num(c.values.roofArea)} מ״ר`],
    ['שטח גג שמיש',`${num(c.values.usableArea)} מ״ר`],
    ['מספר פאנלים משוער',num(c.values.panels)],
    ['הספק מערכת',`${one(c.values.systemSizeKwp)} kWp`],
    ['ייצור שנתי',`${num(c.values.annualProduction)} kWh`],
    ['עלות לפני מע״מ',money(c.values.costBeforeVat)],
    ['עלות כולל מע״מ',money(c.values.costWithVat)],
    ['החזר השקעה (שנים)',one(c.values.paybackWithVat)],
    ['סוג מערכת',c.values.isCommercial?'מסחרית':'ביתית']
  ];
  rows.forEach((r,i)=>tableRow(pdf,6,112+i*9.4,116,8.2,r[0],r[1]));
  sideCard(pdf,128,112,76,25,'חשבון חודשי משוער',money(c.values.monthlyBill||0),'bill');
  sideCard(pdf,128,142,76,25,'WhatsApp',c.customer.phone||'—','whatsapp');
  sideCard(pdf,128,172,76,25,'תקינות חישוב','נבדק','check');

  const p=projection(c.values);
  chartCard(pdf,6,205,96,54,'ייצור חשמל חודשי (kWh)');
  monthlyChart(pdf,12,222,84,27,p.months);
  chartCard(pdf,108,205,96,54,'תזרים מצטבר והחזר השקעה');
  cashflowChart(pdf,115,222,82,27,p.cashflow,c.values.paybackWithVat);

  summaryBand(pdf,6,265,198,23,p,c.values);
  footer(pdf,2);
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

function header(pdf,logo,title){if(logo)contain(pdf,logo,158,5,40,22);rtl(pdf,title,202,26,7.4,'bold',C.navy);pdf.setDrawColor(...C.orange);pdf.setLineWidth(.55);pdf.line(6,29,204,29);}
function darkBadge(pdf,x,y,w,h,title,text){round(pdf,x,y,w,h,C.navy,C.orange,5);icon(pdf,'check',x+9,y+h/2,C.orange,4.8);rtl(pdf,title,x+w-6,y+7.3,3.1,'bold',C.white);rtl(pdf,text,x+w-6,y+13.5,2.9,'bold',C.white);}
function kpiCard(pdf,x,y,w,h,label,value,unit,ic){card(pdf,x,y,w,h,5);icon(pdf,ic,x+8,y+h/2,C.orange,5);rtl(pdf,label,x+w-5,y+8,2.7,'bold',C.muted);ltr(pdf,value,x+w/2+3,y+21,5.5,'bold',C.navy,'center');if(unit){hasHebrew(unit)?rtlCenter(pdf,unit,x+w/2+3,y+28,2.4,'bold',C.navy):ltr(pdf,unit,x+w/2+3,y+28,2.4,'bold',C.navy,'center');}}
function factStrip(pdf,x,y,w,h,label,value,ic){icon(pdf,ic,x+7,y+14,C.navy,4);if(x>6){pdf.setDrawColor(...C.line);pdf.line(x,y+3,x,y+h-3);}rtl(pdf,label,x+w-4,y+9,2.6,'normal',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-4,y+19,3.0,'bold',C.navy,w-14):ltr(pdf,value,x+w-4,y+19,3.0,'bold',C.navy,'right');}
function darkMetric(pdf,x,y,w,h,label,value,unit,formula){round(pdf,x,y,w,h,C.navy,C.navy,6);rtlCenter(pdf,label,x+w/2,y+16,3.5,'bold',C.white);ltr(pdf,value,x+w/2,y+33,7.0,'bold',C.white,'center');ltr(pdf,unit,x+w/2,y+43,3.1,'bold',C.white,'center');ltr(pdf,formula,x+w/2,y+53,2.5,'bold',[226,234,239],'center');}
function tableRow(pdf,x,y,w,h,label,value){pdf.setDrawColor(...C.line);pdf.setLineWidth(.2);pdf.line(x,y+h,x+w,y+h);rtl(pdf,label,x+w-3,y+5.8,2.7,'normal',C.muted);hasHebrew(value)?rtl(pdf,value,x+44,y+5.8,2.9,'bold',C.navy):ltr(pdf,value,x+3,y+5.8,2.9,'bold',C.navy,'left');}
function sideCard(pdf,x,y,w,h,label,value,ic){card(pdf,x,y,w,h,5);icon(pdf,ic,x+10,y+h/2,C.orange,5);rtl(pdf,label,x+w-6,y+8,2.8,'bold',C.muted);hasHebrew(value)?rtl(pdf,value,x+w-6,y+18,3.7,'bold',C.navy):ltr(pdf,value,x+w-6,y+18,3.7,'bold',C.navy,'right');}
function chartCard(pdf,x,y,w,h,title){card(pdf,x,y,w,h,5);rtlCenter(pdf,title,x+w/2,y+9,3.0,'bold',C.navy);}
function monthlyChart(pdf,x,y,w,h,months){const max=Math.max(...months.map(m=>m.kwh),1),bw=4.1,g=2.7,base=y+h;pdf.setDrawColor(...C.grid);for(let i=0;i<4;i++)pdf.line(x,y+i*h/3,x+w,y+i*h/3);months.forEach((m,i)=>{const bx=x+i*(bw+g)+1,bh=(m.kwh/max)*(h-7);pdf.setFillColor(...C.orange);pdf.roundedRect(bx,base-bh,bw,bh,.7,.7,'F');rtlCenter(pdf,m.label,bx+bw/2,base+3.3,1.45,'bold',C.muted);});}
function cashflowChart(pdf,x,y,w,h,points,payback){const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1),px=yr=>x+(yr/25)*w,py=v=>y+h-((v-min)/range)*h;pdf.setDrawColor(...C.grid);pdf.line(x,py(0),x+w,py(0));[0,5,10,15,20,25].forEach(yr=>{pdf.line(px(yr),y,px(yr),y+h);ltr(pdf,String(yr),px(yr),y+h+3.3,1.55,'normal',C.muted,'center');});pdf.setDrawColor(...C.navy);pdf.setLineWidth(.8);for(let i=1;i<points.length;i++)pdf.line(px(points[i-1].year),py(points[i-1].value),px(points[i].year),py(points[i].value));pdf.setFillColor(...C.orange);pdf.circle(px(Math.min(payback,25)),py(0),1.4,'F');}
function summaryBand(pdf,x,y,w,h,p,v){round(pdf,x,y,w,h,C.navy,C.navy,5);const items=[['הכנסה מצטברת',money(p.totalIncome25)],['השקעה',money(v.costWithVat)],['רווח נקי',money(p.netProfit25)],['ROI',`${Math.round(p.roi25)}%`]];const col=w/4;items.forEach((it,i)=>{const cx=x+col*i+col/2;if(i){pdf.setDrawColor(58,79,96);pdf.line(x+col*i,y+4,x+col*i,y+h-4);}ltr(pdf,it[1],cx,y+9,3.5,'bold',C.white,'center');pdf.setDrawColor(...C.orange);pdf.setLineWidth(.6);pdf.line(cx-10,y+12,cx+10,y+12);it[0]==='ROI'?ltr(pdf,it[0],cx,y+19,2.4,'bold',[229,236,241],'center'):rtlCenter(pdf,it[0],cx,y+19,2.4,'bold',[229,236,241]);});}
function sectionTitle(pdf,text,x,y){rtl(pdf,text,x,y,4.5,'bold',C.navy);}
function footer(pdf,page){pdf.setDrawColor(...C.line);pdf.line(6,292,204,292);ltr(pdf,`${page} / 2`,7,296,2.2,'normal',C.muted,'left');ltr(pdf,'solatrix.energy',203,296,2.2,'bold',C.muted,'right');}
function background(pdf){pdf.setFillColor(...C.paper);pdf.rect(0,0,210,297,'F');}
function card(pdf,x,y,w,h,r=5){round(pdf,x,y,w,h,C.white,C.line,r);}
function round(pdf,x,y,w,h,fill,stroke,r){pdf.setFillColor(...fill);pdf.setDrawColor(...stroke);pdf.setLineWidth(.25);pdf.roundedRect(x,y,w,h,r,r,'FD');}
function rtl(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'right'});pdf.setR2L(false);}
function rtlCenter(pdf,text,x,y,size,style='normal',color=C.ink,maxWidth){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const out=maxWidth?pdf.splitTextToSize(String(text??''),maxWidth):String(text??'');pdf.text(out,x,y,{align:'center'});pdf.setR2L(false);}
function ltr(pdf,text,x,y,size,style='normal',color=C.ink,align='left'){pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(false);pdf.text(String(text??''),x,y,{align});}
function icon(pdf,type,x,y,color=C.navy,s=5){pdf.setDrawColor(...color);pdf.setFillColor(...color);pdf.setLineWidth(.7);if(type==='check'){pdf.circle(x,y,s,'S');pdf.line(x-s*.45,y,x-s*.08,y+s*.35);pdf.line(x-s*.08,y+s*.35,x+s*.55,y-s*.4);}else if(type==='question'){pdf.circle(x,y,s,'S');ltr(pdf,'?',x,y+s*.35,s*.75,'bold',color,'center');}else if(type==='bolt'){pdf.line(x+s*.2,y-s,x-s*.2,y);pdf.line(x-s*.2,y,x+s*.15,y);pdf.line(x+s*.15,y,x-s*.25,y+s);}else if(type==='clock'){pdf.circle(x,y,s,'S');pdf.line(x,y,x,y-s*.55);pdf.line(x,y,x+s*.45,y+s*.2);}else if(type==='panel'){pdf.rect(x-s,y-s*.7,s*2,s*1.4,'S');pdf.line(x-s*.35,y-s*.7,x-s*.35,y+s*.7);pdf.line(x+s*.35,y-s*.7,x+s*.35,y+s*.7);pdf.line(x-s,y,x+s,y);}else if(type==='wallet'){pdf.roundedRect(x-s,y-s*.65,s*2,s*1.3,1,1,'S');pdf.line(x+s*.15,y-s*.2,x+s,y-s*.2);pdf.circle(x+s*.55,y-s*.2,.3,'F');}else if(type==='pin'){pdf.circle(x,y-s*.15,s*.55,'S');pdf.circle(x,y-s*.15,s*.15,'S');pdf.line(x-s*.35,y+s*.25,x,y+s);pdf.line(x,y+s,x+s*.35,y+s*.25);}else if(type==='user'){pdf.circle(x,y-s*.45,s*.35,'S');pdf.arc(x,y+s*.55,s*.7,s*.55,200,340,'S');}else if(type==='calendar'){pdf.rect(x-s*.75,y-s*.65,s*1.5,s*1.35,'S');pdf.line(x-s*.75,y-s*.2,x+s*.75,y-s*.2);}else if(type==='grid'){pdf.rect(x-s*.7,y-s*.7,s*1.4,s*1.4,'S');pdf.line(x,y-s*.7,x,y+s*.7);pdf.line(x-s*.7,y,x+s*.7,y);}else if(type==='bill'){pdf.rect(x-s*.6,y-s*.8,s*1.2,s*1.6,'S');pdf.line(x-s*.3,y-s*.3,x+s*.3,y-s*.3);pdf.line(x-s*.3,y,x+s*.3,y);pdf.line(x-s*.3,y+s*.3,x+s*.3,y+s*.3);}else if(type==='whatsapp'){pdf.circle(x,y,s*.8,'S');pdf.line(x-s*.5,y+s*.55,x-s*.75,y+s);}else if(type==='tag'){pdf.rect(x-s*.7,y-s*.45,s*1.4,s*.9,'S');pdf.circle(x-s*.35,y,.25,'S');}}
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
