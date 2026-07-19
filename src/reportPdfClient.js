import { jsPDF } from 'jspdf';
import coverHeroUrl from './assets/roof-check-report/roof-check-cover-hero.webp';
import installersUrl from './assets/roof-check-report/roof-check-installers.webp';
import familyUrl from './assets/roof-check-report/roof-check-family.webp';

const reportLogoUrl = 'https://static.wixstatic.com/media/e34422_f461fb2e8382455e8d0d7ba9d71eca1e~mv2.png/v1/fill/w_596,h_388,al_c,q_100/Solatrix%20Logo%20Sait%20Main.png';
const HEEBO_REGULAR_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/Heebo%5Bwght%5D.ttf';
const HEEBO_BOLD_URL = HEEBO_REGULAR_URL;
const C = { bg:[255,251,244], navy:[5,35,59], blue:[15,82,132], orange:[247,163,24], grey:[109,120,130], border:[232,221,205], white:[255,255,255], pale:[246,248,249], green:[20,184,82] };

export async function createRoofCheckPdf({ customer = {}, reportData = {} } = {}) {
  const calculation = reportData.calculation || {};
  const model = reportData.calculationModel || {};
  const roof = reportData.roofData || {};
  const entries = Object.entries(calculation);
  const surfaceArea = (Array.isArray(roof.surfaces) ? roof.surfaces : []).reduce((s,v)=>s+Number(v?.area||0),0);
  const v = createReportValues({ model, entries, roof, surfaceArea });
  const generatedAt = new Date().toLocaleString('he-IL',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const pdf = new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  await installFonts(pdf);
  const [logo, cover, installers, family] = await Promise.all([
    loadImageData(reportLogoUrl,1200), loadImageData(coverHeroUrl,3200), loadImageData(installersUrl,2600), loadImageData(familyUrl,3200)
  ]);
  page1(pdf,{customer,roof,model,v,generatedAt,logo,cover});
  pdf.addPage(); page2(pdf,{customer,v,logo,installers});
  pdf.addPage(); page3(pdf,{family});
  pdf.setProperties({title:'Solatrix Roof Check',subject:'Roof Check Report v1.0',author:'Solatrix Energy'});
  return pdf.output('blob');
}

export async function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||'').split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}

function base(pdf,page,logo){
  pdf.setFillColor(...C.bg); pdf.rect(0,0,210,297,'F');
  if(logo) contain(pdf,logo,158,7,34,19);
  pdf.setDrawColor(...C.orange); pdf.setLineWidth(.35); pdf.line(18,30,192,30);
  pdf.setDrawColor(220,216,207); pdf.setLineWidth(.25); pdf.line(18,286,192,286);
  ltr(pdf,`${page} / 3`,18,291.5,3.2,'normal',C.grey,'left');
  ltr(pdf,'Solatrix Energy • Roof Check',192,291.5,3.2,'normal',C.grey,'right');
}

function page1(pdf,c){
  base(pdf,1,c.logo);
  cover(pdf,c.cover,18,36,174,78,5);
  metric(pdf,18,119,84,28,'תקופת החזר השקעה',c.v.paybackWithVat.toFixed(1),'שנים','clock');
  metric(pdf,108,119,84,28,'חיסכון בשנה הראשונה',money(c.v.annualSavings),'','coins');
  metric(pdf,18,152,84,28,'עלות כולל מע״מ',money(c.v.costWithVat),'','calc');
  metric(pdf,108,152,84,28,'עלות לפני מע״מ',money(c.v.costBeforeVat),'','tag');
  band(pdf,18,185,174,35,'סיכום ראשוני','הנתונים שלפניכם מציגים הערכה ראשונית של פוטנציאל המערכת הסולארית על גגכם. לאחר בדיקה מקצועית ניתן יהיה להכין תכנון מלא, הצעת מחיר מדויקת וליווי מלא עד להפעלת המערכת.');
  fact(pdf,18,226,84,22,'כתובת הנכס',c.roof.address||c.model.address||'—','pin');
  fact(pdf,108,226,84,22,'שם הלקוח',c.customer.name||'—','user');
  fact(pdf,18,253,84,22,'תאריך הפקה',c.generatedAt,'calendar',true);
  fact(pdf,108,253,84,22,'שטח הגג שסומן',num(c.v.roofArea),'area',true,'מ״ר');
}

function page2(pdf,c){
  base(pdf,2,c.logo);
  rtl(pdf,'נתוני החישוב',192,42,10,'bold',C.navy);
  darkMain(pdf,18,49,68,73,'תפוקת חשמל שנתית',num(c.v.annualProduction),'kWh','ייצור החשמל השנתי הצפוי בהתאם לשטח הגג, הספק המערכת ותנאי ההתקנה.');
  cover(pdf,c.installers,90,49,102,73,5);
  sectionTitle(pdf,'פירוט התוצאות',120,133); sectionTitle(pdf,'נתוני הפרויקט',192,133);
  const rows=[
    ['חיסכון בשנה הראשונה',money(c.v.annualSavings),''],
    ['תקופת החזר השקעה',c.v.paybackWithVat.toFixed(1),'שנים'],
    ['עלות לפני מע״מ',money(c.v.costBeforeVat),''],
    ['עלות כולל מע״מ',money(c.v.costWithVat),''],
    ['שטח גג מסומן',num(c.v.roofArea),'מ״ר'],
    ['שטח גג שמיש',num(c.v.usableArea),'מ״ר'],
    ['מספר פאנלים',num(c.v.panels),''],
    ['ייצור שנתי',num(c.v.annualProduction),'kWh']
  ];
  rows.forEach((r,i)=>resultRow(pdf,18,139+i*13,102,11,r[0],r[1],r[2]));
  projectFact(pdf,125,139,67,24,'סוג גג',c.v.isCommercial?'מסחרי':'ביתי','home');
  projectFact(pdf,125,167,67,24,'תוספת אורבנית',c.v.urbanEligible?'כן':'לא','building');
  projectFact(pdf,125,195,67,24,'חשבון חשמל חודשי',money(c.v.monthlyBill||0),'bill',true);
  projectFact(pdf,125,223,67,24,'WhatsApp',c.customer.phone||'—','whatsapp',true,true);
  note(pdf,18,249,174,17,'מודל תעריף','₪0.48 לקוט״ש שנמכר + עלייה של כ-4% לערך הצריכה העצמית.');
  note(pdf,18,270,174,12,'תוספת אורבנית',c.v.urbanEligible?`כן — תוספת ₪0.06 לקוט״ש ב-10 השנים הראשונות${c.v.urbanLocality?` (${c.v.urbanLocality})`:''}.`:'לא חושבה תוספת אורבנית.');
}

function page3(pdf,c){
  base(pdf,3,null);
  rtl(pdf,'איך מתקדמים מכאן?',192,45,11,'bold',C.navy);
  const steps=[
    [1,'שיחת היכרות','נציג Solatrix יעבור איתכם על הנתונים ויבין את מטרות הפרויקט.','users'],
    [2,'בדיקת מסמכים','נבדוק חשבונות חשמל, בעלות, חיבור קיים ונתוני הגג.','doc'],
    [3,'בדיקת שטח','מודד או מהנדס יבדוק את השטח, ההצללות, החשמל והקונסטרוקציה.','worker'],
    [4,'הצעה מלאה','תקבלו תכנון והצעה מסודרת עם ציוד, מחיר, לוחות זמנים ותשואה.','check']
  ];
  steps.forEach((s,i)=>step(pdf,18,54+i*31,174,27,...s));
  cover(pdf,c.family,18,182,174,48,5);
  whatsappBand(pdf,18,235,174,20);
  contactBand(pdf,18,260,174,20);
}

function metric(pdf,x,y,w,h,label,value,suffix,icon){ card(pdf,x,y,w,h); iconDraw(pdf,icon,x+10,y+h/2); rtl(pdf,label,x+w-7,y+10,4,'bold',C.grey); ltr(pdf,value,x+w/2+5,y+21,8.2,'bold',C.navy,'center'); if(suffix) rtl(pdf,suffix,x+w/2+17,y+25.5,3.2,'normal',C.grey); }
function fact(pdf,x,y,w,h,label,value,icon,isLtr=false,suffix=''){ card(pdf,x,y,w,h); iconDraw(pdf,icon,x+10,y+h/2); rtl(pdf,label,x+w-7,y+8,3.5,'normal',C.grey); if(isLtr){ ltr(pdf,value,x+w-7,y+16.5,5,'bold',C.navy,'right'); if(suffix) rtl(pdf,suffix,x+w-28,y+16.5,3.7,'normal',C.grey); } else rtl(pdf,value,x+w-7,y+16.5,5,'bold',C.navy,w-24); }
function band(pdf,x,y,w,h,title,text){ round(pdf,x,y,w,h,C.navy,C.navy,6); rtl(pdf,title,x+w-8,y+13,7,'bold',C.white); rtl(pdf,text,x+w-8,y+23,4,'normal',[230,237,242],w-16); }
function darkMain(pdf,x,y,w,h,title,value,unit,text){ round(pdf,x,y,w,h,C.navy,C.navy,6); iconDraw(pdf,'bolt',x+w/2,y+13,C.orange); rtl(pdf,title,x+w-8,y+31,5,'bold',C.white); ltr(pdf,value,x+w/2,y+44,8.2,'bold',C.white,'center'); ltr(pdf,unit,x+w/2,y+50,3.2,'normal',[225,233,239],'center'); rtl(pdf,text,x+w-8,y+59,3.8,'normal',[225,233,239],w-16); }
function resultRow(pdf,x,y,w,h,label,value,unit=''){ card(pdf,x,y,w,h,3); rtl(pdf,label,x+w-5,y+7,3.4,'normal',C.grey); ltr(pdf,value,x+5,y+7,4,'bold',C.navy,'left'); if(unit){ const shift=Math.min(31,5+String(value).length*2.2); if(/[֐-׿]/.test(unit)) rtl(pdf,unit,x+shift+12,y+7,3.2,'normal',C.grey); else ltr(pdf,unit,x+shift,y+7,3.2,'normal',C.grey,'left'); } }
function projectFact(pdf,x,y,w,h,label,value,icon,isLtr=false,labelIsLtr=false){ card(pdf,x,y,w,h,4); iconDraw(pdf,icon,x+9,y+h/2); if(labelIsLtr) ltr(pdf,label,x+w-6,y+8,3.4,'bold',C.grey,'right'); else rtl(pdf,label,x+w-6,y+8,3.4,'bold',C.grey); if(isLtr) ltr(pdf,value,x+w-6,y+17,4.6,'bold',C.navy,'right'); else rtl(pdf,value,x+w-6,y+17,4.8,'bold',C.navy); }
function note(pdf,x,y,w,h,title,text){ card(pdf,x,y,w,h,4); rtl(pdf,title,x+w-6,y+6.5,3.3,'bold',C.navy); rtl(pdf,text,x+w-6,y+12.5,3.4,'normal',C.grey,w-12); }
function sectionTitle(pdf,text,x,y){ rtl(pdf,text,x,y,5.4,'bold',C.navy); }
function step(pdf,x,y,w,h,n,title,text,icon){ card(pdf,x,y,w,h,5); pdf.setFillColor(...C.navy); pdf.circle(x+w-10,y+h/2,6,'F'); ltr(pdf,String(n),x+w-10,y+h/2+1.8,5,'bold',C.white,'center'); iconDraw(pdf,icon,x+11,y+h/2); rtl(pdf,title,x+w-22,y+10,5.3,'bold',C.navy); rtl(pdf,text,x+w-22,y+18,3.5,'normal',C.grey,w-45); }
function whatsappBand(pdf,x,y,w,h){ round(pdf,x,y,w,h,C.navy,C.navy,5); pdf.setDrawColor(...C.green); pdf.setLineWidth(1); pdf.circle(x+10,y+h/2,5,'S'); ltr(pdf,'✓',x+10,y+h/2+1.7,4.5,'bold',C.green,'center'); rtl(pdf,'עותק הדוח נשמר בכרטיס הלקוח',x+w-8,y+8,5,'bold',C.white); rtl(pdf,'וניתן יהיה לשלוח אותו ב-WhatsApp לאחר חיבור ערוץ ההודעות העסקי.',x+w-8,y+15,3.7,'normal',[230,237,242],w-26); }
function contactBand(pdf,x,y,w,h){ round(pdf,x,y,w,h,C.navy,C.navy,5); rtl(pdf,'יצירת קשר',x+w-8,y+7,4.5,'bold',C.orange); rtl(pdf,'טלפון:',x+w-8,y+14,3.5,'normal',C.white); ltr(pdf,'__________',x+w-35,y+14,3.5,'normal',C.white,'right'); ltr(pdf,'WhatsApp:',x+62,y+7,3.4,'bold',C.white,'right'); ltr(pdf,'__________',x+62,y+14,3.5,'normal',C.white,'right'); ltr(pdf,'solatrix.energy',x+8,y+14,3.5,'bold',C.orange,'left'); }

function card(pdf,x,y,w,h,r=5){ round(pdf,x,y,w,h,C.white,C.border,r); }
function round(pdf,x,y,w,h,fill,stroke,r){ pdf.setFillColor(...fill); pdf.setDrawColor(...stroke); pdf.setLineWidth(.25); pdf.roundedRect(x,y,w,h,r,r,'FD'); }

function iconDraw(pdf,type,cx,cy,color=C.orange){ pdf.setDrawColor(...color); pdf.setTextColor(...color); pdf.setLineWidth(.6);
  if(type==='coins'){pdf.circle(cx-1,cy-2,3,'S');pdf.ellipse(cx-1,cy+1,3,1.2,'S');pdf.ellipse(cx-1,cy+4,3,1.2,'S');}
  else if(type==='clock'){pdf.circle(cx,cy,4,'S');pdf.line(cx,cy,cx,cy-2.5);pdf.line(cx,cy,cx+2,cy+1);}
  else if(type==='calc'){pdf.rect(cx-3,cy-4,6,8,'S');pdf.line(cx-2,cy-1,cx+2,cy-1);}
  else if(type==='tag'){pdf.rect(cx-3,cy-3,6,6,'S');pdf.circle(cx+1.5,cy-1.5,.5,'S');}
  else if(type==='pin'){pdf.circle(cx,cy-1,3,'S');pdf.line(cx-2,cy+1,cx,cy+5);pdf.line(cx+2,cy+1,cx,cy+5);}
  else if(type==='user'){pdf.circle(cx,cy-2,2,'S');pdf.line(cx-4,cy+4,cx-2.5,cy+1.5);pdf.line(cx-2.5,cy+1.5,cx+2.5,cy+1.5);pdf.line(cx+2.5,cy+1.5,cx+4,cy+4);}
  else if(type==='calendar'){pdf.rect(cx-4,cy-3,8,7,'S');pdf.line(cx-4,cy-1,cx+4,cy-1);}
  else if(type==='area'){pdf.rect(cx-4,cy-4,8,8,'S');pdf.line(cx-4,cy,cx+4,cy);pdf.line(cx,cy-4,cx,cy+4);}
  else if(type==='bolt'){ltr(pdf,'⚡',cx,cy+2,8,'bold',color,'center');}
  else if(type==='home'){pdf.line(cx-4,cy,cx,cy-4);pdf.line(cx,cy-4,cx+4,cy);pdf.rect(cx-3,cy,6,4,'S');}
  else if(type==='building'){pdf.rect(cx-3,cy-4,6,8,'S');pdf.line(cx,cy-4,cx,cy+4);}
  else if(type==='bill'){pdf.rect(cx-3,cy-4,6,8,'S');pdf.line(cx-2,cy-1,cx+2,cy-1);pdf.line(cx-2,cy+1,cx+2,cy+1);}
  else if(type==='whatsapp'){pdf.circle(cx,cy,4,'S');ltr(pdf,'✓',cx,cy+1.5,4,'bold',color,'center');}
  else if(type==='users'){pdf.circle(cx-2,cy-2,1.5,'S');pdf.circle(cx+2,cy-2,1.5,'S');pdf.line(cx-4,cy+3,cx+4,cy+3);}
  else if(type==='doc'){pdf.rect(cx-3,cy-4,6,8,'S');pdf.line(cx-2,cy-1,cx+2,cy-1);}
  else if(type==='worker'){pdf.circle(cx,cy-2,2,'S');pdf.line(cx-4,cy+4,cx-2.5,cy+1.5);pdf.line(cx-2.5,cy+1.5,cx+2.5,cy+1.5);pdf.line(cx+2.5,cy+1.5,cx+4,cy+4);pdf.line(cx-3,cy-4,cx+3,cy-4);}
  else if(type==='check'){pdf.rect(cx-3,cy-4,6,8,'S');ltr(pdf,'✓',cx,cy+1.5,4,'bold',color,'center');}
}

function rtl(pdf,text,x,y,size,style='normal',color=C.navy,maxWidth){ pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(true);const t=String(text??'');const lines=maxWidth?pdf.splitTextToSize(t,maxWidth):t;pdf.text(lines,x,y,{align:'right'});pdf.setR2L(false); }
function ltr(pdf,text,x,y,size,style='normal',color=C.navy,align='left'){ pdf.setFont('Heebo',style);pdf.setFontSize(mm(size));pdf.setTextColor(...color);pdf.setR2L(false);pdf.text(String(text??''),x,y,{align}); }
function mm(v){return v*2.8346457;}

async function installFonts(pdf){const [r,b]=await Promise.all([fetchBase64(HEEBO_REGULAR_URL),fetchBase64(HEEBO_BOLD_URL)]);pdf.addFileToVFS('Heebo-Regular.ttf',r);pdf.addFileToVFS('Heebo-Bold.ttf',b);pdf.addFont('Heebo-Regular.ttf','Heebo','normal');pdf.addFont('Heebo-Bold.ttf','Heebo','bold');}
async function fetchBase64(url){const res=await fetch(url,{mode:'cors',cache:'force-cache'});if(!res.ok)throw new Error(`Font request failed: ${res.status}`);const bytes=new Uint8Array(await res.arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
async function loadImageData(url,max=3000){try{const res=await fetch(url,{mode:'cors',cache:'no-cache'});if(!res.ok)throw new Error(res.status);const blob=await res.blob();const bitmap=await createImageBitmap(blob);const scale=Math.min(1,max/bitmap.width);const w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();return{data:canvas.toDataURL('image/jpeg',.98),width:w,height:h};}catch(e){console.warn('Image load failed',url,e);return null;}}
function cover(pdf,image,x,y,w,h,r=0){if(!image)return;const sr=image.width/image.height,tr=w/h;let dw=w,dh=h,dx=x,dy=y;if(sr>tr){dw=h*sr;dx=x-(dw-w)/2;}else{dh=w/sr;dy=y-(dh-h)/2;}pdf.saveGraphicsState();pdf.roundedRect(x,y,w,h,r,r,null);pdf.clip();pdf.discardPath();pdf.addImage(image.data,'JPEG',dx,dy,dw,dh,undefined,'NONE');pdf.restoreGraphicsState();}
function contain(pdf,image,x,y,w,h){if(!image)return;const ratio=Math.min(w/image.width,h/image.height),dw=image.width*ratio,dh=image.height*ratio;pdf.addImage(image.data,'JPEG',x+(w-dw)/2,y+(h-dh)/2,dw,dh,undefined,'NONE');}

function createReportValues({model,entries,roof,surfaceArea}){const find=(...p)=>entries.find(([l])=>p.every(v=>String(l).includes(v)))?.[1];const val=(a,b,d=0)=>{const n=Number(a);if(Number.isFinite(n))return n;const q=parseNumeric(b);return Number.isFinite(q)?q:d;};const roofArea=val(model.roofArea,find('שטח גג','מסומן')||find('שטח גג')||surfaceArea,surfaceArea);const usableArea=val(model.usableArea,find('שטח גג','שמיש')||find('שטח שימושי'),roofArea*.82);const annualProduction=val(model.annualProduction,find('ייצור שנתי'));const annualSavings=val(model.annualSavings,find('חיסכון בשנה הראשונה')||find('הכנסה בשנה הראשונה')||find('חיסכון/הכנסה שנתית'));const costBeforeVat=val(model.costBeforeVat,find('עלות לפני מע״מ'));const costWithVat=val(model.costWithVat,find('עלות כולל מע״מ'),costBeforeVat*1.18);const paybackWithVat=val(model.paybackWithVat,find('החזר כולל מע״מ')||find('החזר השקעה'),annualSavings?costWithVat/annualSavings:0);return{roofArea,usableArea,annualProduction,annualSavings,costBeforeVat,costWithVat,paybackWithVat,panels:val(model.panels,find('מספר פאנלים')||find('פאנלים')),monthlyBill:val(model.monthlyBill,roof.monthlyBill),isCommercial:model.isCommercial===true||roof.roofType==='commercial',urbanEligible:model.urbanEligible===true||roof.urbanEligible===true,urbanLocality:model.urbanLocality||roof.urbanLocality||''};}
function parseNumeric(v){if(typeof v==='number')return v;const s=String(v??'').replace(/,/g,'').replace(/[^0-9.\-]/g,'');return s?Number(s):NaN;}
function num(v){return Math.round(Number(v)||0).toLocaleString('he-IL');}
function money(v){return `₪${num(v)}`;}