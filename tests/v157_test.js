// v1.3.57 — Pinterest auto «Показать в полном масштабе». Run: node v157_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestFindFullScaleButton, Settings };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v157.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:'x',convId:'c'}];
const URL0='https://ru.pinterest.com/pin/111/';
const related=(n,start=900,btn=false)=>Array.from({length:n},(_,k)=>`<div data-grid-item="true"><a href="/pin/${start+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg"></a>${btn?`<button class="relbtn" aria-label="Показать в полном масштабе"></button>`:''}</div>`).join('');
const BTN_RU='<button id="fs" aria-label="Показать в полном масштабе" style="opacity:0;visibility:hidden"><svg viewBox="0 0 24 24"></svg></button>';
const BTN_EN='<div role="button" id="fs"><svg aria-label="Show in full size"></svg></div>';
const render=(w,btn,rel)=>{ w.document.body.innerHTML=`<div role="main"><div data-test-id="relatedPins">${rel}</div><div data-test-id="closeup-body"><img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/main.jpg">${btn}<button aria-label="Ещё" id="more"></button></div></div>`;
  w.__fs=0; w.__rel=0; w.__other=0; if(!w.__lst) (w.__lst=1, w.document.body.addEventListener('click',e=>{ if(e.target.closest('#fs')) w.__fs++; else if(e.target.closest('.relbtn')) w.__rel++; else if(e.target.closest('#more')) w.__other++; }, true)); };
const page=(btn,rel=related(4))=>w=>{ render(w,btn,rel); w.fetch=async()=>({ok:true,status:200,json:async()=>({resource_response:{data:{id:'1',images:{orig:{url:'https://i.pinimg.com/originals/aa/bb/cc/o.jpg'}}}}})}); };
(async()=>{ try {
 { const {w,T}=load({items,url:URL0,pre:page(BTN_RU)}); await sleep(1500);
   ok('1a default OFF: no click', T.config.pinterestAutoFS===false && w.__fs===0, 'fs='+w.__fs);
   w.widgetState='panel'; w.updateWidgetUI(); await sleep(50);
   const cb=w.document.getElementById('mossad-cb-fs'); ok('1b checkbox visible in Pinterest block with label', !!cb && /FS/.test(cb.parentElement.textContent), cb&&cb.parentElement.textContent);
   cb.checked=true; cb.dispatchEvent(new w.Event('change')); await sleep(1500);
   ok('1c turning ON → hidden (opacity/visibility) main button clicked once', T.config.pinterestAutoFS===true && w.__fs===1 && w.__other===0, 'fs='+w.__fs);
   await sleep(2000); ok('1d still once per pin', w.__fs===1, 'fs='+w.__fs);
   w.history.pushState(null,'','/pin/222/'); render(w,BTN_RU,related(4)); await sleep(1500);
   ok('1e SPA navigation to a new pin → clicked once again', w.__fs===1, 'fs(new page)='+w.__fs); }
 { const {w}=load({items,url:URL0,pre:page(BTN_EN),cfg:{config:{pinterestAutoFS:true}}}); await sleep(1200);
   ok('2a English "Show in full size" on svg inside role=button → button clicked', w.__fs===1, 'fs='+w.__fs); }
 { const {w}=load({items,url:URL0,pre:page(BTN_RU,related(4,900,true)),cfg:{config:{pinterestAutoFS:true}}}); await sleep(1200);
   ok('3a same button in related grid (earlier in DOM) NOT clicked; main one is', w.__fs===1 && w.__rel===0, `fs=${w.__fs} rel=${w.__rel}`); }
 { const {w}=load({items,url:URL0,pre:page(''),cfg:{config:{pinterestAutoFS:true}}}); await sleep(2000);
   w.document.querySelector('[data-test-id="closeup-body"]').insertAdjacentHTML('beforeend',BTN_RU); await sleep(800);
   ok('4a button appearing late (2 s) → clicked', w.__fs===1, 'fs='+w.__fs); }
 { const {w}=load({items,url:URL0,pre:page(''),cfg:{config:{pinterestAutoFS:true}}}); await sleep(9000);
   w.document.querySelector('[data-test-id="closeup-body"]').insertAdjacentHTML('beforeend',BTN_RU); await sleep(1500);
   ok('4b no button within 8 s → polling stops (late button not clicked)', w.__fs===0, 'fs='+w.__fs); }
 { const {w,T,navs}=load({items,url:URL0,pre:page(BTN_RU,related(5)),cfg:{config:{pinterestAutoFS:true,slideshowDelay:0,autoFS:true}}}); await sleep(300);
   T.startSlideshow(); await sleep(2200);
   ok('5a slideshow with FS ON (+ universal autoFS): advances normally, button clicked exactly once', navs.length===1 && T.active && w.__fs===1 && w.__rel===0, `navs=${navs.length} fs=${w.__fs}`); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
