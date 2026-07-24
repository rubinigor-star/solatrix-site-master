const KEY='solatrix_govmap_address_selection_v1';
function pointFrom(o){
  if(!o||typeof o!=='object') return null;
  const x=Number(o.x??o.X??o.data?.x??o.data?.X);
  const y=Number(o.y??o.Y??o.data?.y??o.data?.Y);
  if(Number.isFinite(x)&&Number.isFinite(y)) return {x,y};
  for(const v of Object.values(o)){
    if(v&&typeof v==='object'){
      const p=pointFrom(v);
      if(p) return p;
    }
  }
  return null;
}
function savedPoint(){
  try{return pointFrom(JSON.parse(localStorage.getItem(KEY)||'null')?.result);}catch{return null;}
}
function apply(){
  if(!(location.pathname||'').includes('/roof-marking')) return;
  const wrap=document.querySelector('.solatrixGovMapWrap');
  if(wrap){
    const all=[...wrap.querySelectorAll('.solatrixGovMapCrosshair')];
    all.slice(1).forEach(n=>n.remove());
    const c=all[0];
    if(c){c.style.display='block';c.style.visibility='visible';c.style.opacity='1';}
  }
  const p=savedPoint();
  if(!p||typeof window.govmap?.zoomToXY!=='function') return;
  try{window.govmap.zoomToXY({x:p.x,y:p.y,level:12,marker:true});}catch{}
}
if(!window.__solatrixGovMapAddressFocusPatchV1){
  window.__solatrixGovMapAddressFocusPatchV1=true;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
  setInterval(apply,900);
}
