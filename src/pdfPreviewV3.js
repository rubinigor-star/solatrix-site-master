import { createRoofCheckPdfV3 } from './reportPdfClientV3.js';

const viewer=document.querySelector('#viewer');
const download=document.querySelector('#download');
const refresh=document.querySelector('#refresh');
const status=document.querySelector('#status');
let objectUrl='';

const sample={
  customer:{name:'איגור רובין',phone:'052-513-8899'},
  reportData:{
    roofData:{address:'ויצו 24, חיפה',roofType:'residential',monthlyBill:850,surfaces:[{area:162}]},
    calculationModel:{roofArea:162,usableArea:133,panels:35,systemSizeKwp:22.1,monthlyBill:850,isCommercial:false}
  }
};

function ready(value){download.style.pointerEvents=value?'auto':'none';download.style.opacity=value?'1':'0.45';if(!value)download.removeAttribute('href');}
async function render(){
  status.textContent='מייצר גרסה 3…';refresh.disabled=true;ready(false);viewer.removeAttribute('src');
  try{
    const blob=await createRoofCheckPdfV3(sample);
    if(!(blob instanceof Blob)||blob.size<1000)throw new Error('Generated PDF is empty.');
    if(objectUrl)URL.revokeObjectURL(objectUrl);
    objectUrl=URL.createObjectURL(blob);viewer.src=objectUrl;download.href=objectUrl;ready(true);status.textContent='גרסה 3 מוכנה לבדיקה';
  }catch(error){console.error(error);status.textContent=`שגיאה: ${error instanceof Error?error.message:String(error)}`;}
  finally{refresh.disabled=false;}
}
refresh.addEventListener('click',render);
window.addEventListener('beforeunload',()=>objectUrl&&URL.revokeObjectURL(objectUrl));
ready(false);render();
