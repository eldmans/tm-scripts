// v1.3.77 — список (плейлист): высота = N строк из настроек И колесо прокручивает остальное внутри списка. Run: node v177_test.js
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(!!c);console.log(c?'PASS':'FAIL',n,c?'':i);};
(async()=>{ try {
  const items=Array.from({length:128},(_,i)=>({uuid:U(i),convId:'c'+Math.floor(i/8)}));
  const {w,T}=load({items, ss:{active:true,circle:1}}); const d=w.document; await sleep(1500);
  const RH=16, HH=30; const orig=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.classList&&(this.classList.contains('mossad-playlist-item')||this.classList.contains('mossad-playlist-grp-header'))) return {top:0,left:0,right:200,bottom:RH-1,width:200,height:RH-1};
    if(this.parentNode&&this.parentNode.id==='mossad-playlist-panel'&&this===this.parentNode.firstElementChild) return {top:0,left:0,right:0,bottom:HH,width:200,height:HH};
    return orig.call(this); };
  const pl0=d.getElementById('mossad-playlist-panel'); if(pl0) pl0.remove();
  w.localStorage.removeItem('mossad_playlist_height'); w.localStorage.removeItem('mossad_playlist_width'); T.config.playlistWidth=0; T.config.playlistRows=30;
  T.grokTogglePlaylistPanel(true);
  let pl=d.getElementById('mossad-playlist-panel'); let body=pl.querySelector('.mossad-playlist-body');
  const EXP=HH+4+30*RH+2, EXPB=4+30*RH;
  ok('1a 128 items (16 groups) → panel height = 30 rows', pl.style.height===EXP+'px', `h=${pl.style.height} exp=${EXP}`);
  ok('1b list body itself capped at 30 rows', body.style.maxHeight===EXPB+'px' && body.style.overflowY==='auto', `mh=${body.style.maxHeight}`);
  ok('1c panel is a flex column', pl.style.display==='flex' && pl.style.flexDirection==='column');
  // bug A (earlier): widget state update set display:block → body lost its limit, rows cut off, no scroll
  for (const st of ['bar','panel']) { w.widgetState=st; w.updateWidgetUI(); }
  pl=d.getElementById('mossad-playlist-panel'); body=pl.querySelector('.mossad-playlist-body');
  ok('2a after widget bar/panel switch: still flex (was block)', pl.style.display==='flex', pl.style.display);
  ok('2b after switch: height and body limit kept', pl.style.height===EXP+'px' && body.style.maxHeight===EXPB+'px', `${pl.style.height} ${body.style.maxHeight}`);
  // bug B (now): panel height lost (auto) → body limit still holds; reopen (slideshow forceOpen) restores height
  pl.style.height='auto';
  ok('3a panel height lost → body still limited to N rows', body.style.maxHeight===EXPB+'px');
  T.grokTogglePlaylistPanel(true);
  ok('3b slideshow forceOpen on existing list re-applies N rows', pl.style.height===EXP+'px', pl.style.height);
  pl.style.display='block'; T.grokTogglePlaylistPanel(true);
  ok('3c forced display:block repaired to flex', pl.style.display==='flex');
  // wheel
  let st=0; Object.defineProperty(body,'scrollHeight',{configurable:true,get:()=>128*RH+16*RH});
  Object.defineProperty(body,'clientHeight',{configurable:true,get:()=>EXPB});
  Object.defineProperty(body,'scrollTop',{configurable:true,get:()=>st,set:v=>{st=v;}});
  let siteCapture=0, siteBubble=0;
  w.addEventListener('wheel',e=>{siteCapture++; e.preventDefault();},{capture:true,passive:false}); // сайт глушит прокрутку
  w.addEventListener('wheel',()=>{siteBubble++;});
  const item=body.querySelectorAll('.mossad-playlist-item')[3];
  const wh=(o)=>{ const e=new w.WheelEvent('wheel',Object.assign({bubbles:true,cancelable:true},o)); item.dispatchEvent(e); return e; };
  let e=wh({deltaY:100});
  ok('4a wheel scrolls the list even when site cancels wheel', st===100, `st=${st}`);
  ok('4b wheel not passed on to page handlers', siteBubble===0 && e.defaultPrevented);
  wh({deltaY:3,deltaMode:1}); ok('4c line-mode delta (Firefox) → 3 lines', st===148, `st=${st}`);
  wh({deltaY:-1000}); ok('4d scroll up clamps at 0', st===0, `st=${st}`);
  const MAX=144*RH-EXPB; wh({deltaY:99999}); ok('4e scroll down reaches last row', st===MAX, `st=${st} max=${MAX}`);
  e=wh({deltaY:50}); ok('4f at bottom: stays, page not scrolled', st===MAX && e.defaultPrevented && siteBubble===0);
  Object.defineProperty(body,'scrollHeight',{configurable:true,get:()=>EXPB});
  e=wh({deltaY:50}); ok('4g list without overflow: wheel left to the page', siteBubble===1 && st===MAX, `bubble=${siteBubble}`);
  // setting change applies live
  T.openSettingsWindow('general'); const rin=d.getElementById('mossad-playlist-rows'); rin.value='10'; rin.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok('5a "visible rows" setting applies to open list at once', pl.style.height===(HH+4+10*RH+2)+'px' && body.style.maxHeight===(4+10*RH)+'px', `${pl.style.height} ${body.style.maxHeight}`);
  // manual size → no body limit; few items → auto
  pl.dataset.autoHeight='0'; pl.style.height='300px'; T.grokTogglePlaylistPanel(true);
  ok('6a manual height: kept, body limit removed', pl.style.height==='300px' && body.style.maxHeight==='');
  pl.remove(); w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.slice(0,5).map(it=>({url:'https://grok.com/imagine/post/'+it.uuid,convId:it.convId,type:'video'}))}));
  T.grokTogglePlaylistPanel(true); pl=d.getElementById('mossad-playlist-panel');
  ok('6b fewer rows than N → auto, no body limit', pl.style.height==='auto' && pl.querySelector('.mossad-playlist-body').style.maxHeight==='');
  w.close();
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
