// v1.3.59 — Pinterest jump-to-related by key. Run: node v159_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestJumpCodes, pinterestJumpApply, openSettingsWindow, Settings };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v159.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:'x',convId:'c'}];
const URL0='https://ru.pinterest.com/pin/111/';
const related=(n,start=900)=>Array.from({length:n},(_,k)=>`<div data-grid-item="true" data-k="${k}"><a href="/pin/${start+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg"></a></div>`).join('');
const render=(w,n,start)=>{ w.document.body.innerHTML=`<div role="main"><div data-test-id="closeup-body"><img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/main.jpg"><input id="inp"></div><div data-test-id="relatedPins"><div class="grid">${related(n,start)}</div></div></div>`; };
const page=(n=14,start=900)=>w=>{ render(w,n,start);
  const orig=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){ if(this.hasAttribute&&this.hasAttribute('data-grid-item')){ const k=+this.dataset.k; const top=k===3?5000:100+k*10; return {left:20*k,top,right:20*k+200,bottom:top+300,width:200,height:300}; } return orig.call(this); };
  w.innerWidth=1200; w.innerHeight=800; };
const key=(w,code,k,o={},target)=>{ const e=new w.KeyboardEvent('keydown',Object.assign({code,key:k,bubbles:true,cancelable:true},o)); (target||w.document.body).dispatchEvent(e); return e; };
const keyup=(w,code,k,o={})=>w.document.body.dispatchEvent(new w.KeyboardEvent('keyup',Object.assign({code,key:k,bubbles:true},o)));
const last=T=>T.config.pinterestHistory.map(u=>(u.match(/pin\/(\d+)/)||[])[1]);
const layer=w=>w.document.getElementById('mossad-pin-badges');
(async()=>{ try {
 // ---- 1. off (default) ----
 { const {w,T,navs}=load({items,url:URL0,pre:page()}); await sleep(300);
   key(w,'Digit1','1'); await sleep(100);
   ok('1a default OFF: key does nothing, no badges', T.config.pinterestJumpKeys==='off' && navs.length===0 && !layer(w), 'navs='+navs.length); }
 // ---- 2. keys ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'keys'}}}); await sleep(200); w.__P.pinterestJumpApply(); await sleep(50);
   key(w,'Digit1','1',{},w.document.getElementById('inp')); key(w,'Digit1','1',{ctrlKey:true}); key(w,'Digit1','1',{altKey:true}); await sleep(100);
   ok('2a typing in input / Ctrl / Alt ignored', navs.length===0, 'navs='+navs.length);
   const e=key(w,'KeyW','ц'); await sleep(100);
   ok('2b RU layout: KeyW (ц) = 12th key → 12th related pin, history current → target', navs.length===1 && e.defaultPrevented && JSON.stringify(last(T))==='["111","911"]', JSON.stringify(last(T))+' navs='+navs.length);
   ok('2c keys mode: no badge layer', !layer(w)); }
 { const {w,T,navs}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'keys'}}}); await sleep(200); w.__P.pinterestJumpApply();
   key(w,'Digit0','0'); await sleep(100);
   ok('2d Digit0 = 10th', navs.length===1 && last(T)[1]==='909', JSON.stringify(last(T)));
 }
 { const {w,T,navs}=load({items,url:URL0,pre:page(3),cfg:{config:{pinterestJumpKeys:'keys'}}}); await sleep(200); w.__P.pinterestJumpApply();
   key(w,'Digit9','9'); await sleep(100); ok('2e key beyond candidates → no navigation (toast)', navs.length===0); }
 // ---- 3. busy keys skipped ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'keys'}}}); await sleep(200);
   T.config.hk=Object.assign({},T.config.hk,{zzTest:{key:'q',ctrl:false,alt:false,shift:false},zzCtrl:{key:'w',ctrl:true,alt:false,shift:false}}); w.__P.pinterestJumpApply();
   const {codes,skipped}=w.__P.pinterestJumpCodes();
   ok('3a hotkey "q" skipped (KeyQ), Ctrl+W not', skipped.some(s=>s.code==='KeyQ') && codes[10]==='KeyW' && codes.includes('KeyW'), JSON.stringify(skipped));
   key(w,'KeyQ','й'); await sleep(50); ok('3b skipped key does not jump', navs.length===0);
   w.__P.openSettingsWindow(); await sleep(50);
   const sk=w.document.getElementById('mossad-gen-pjump-skip');
   ok('3c settings show skipped keys', sk && /Q/.test(sk.textContent) && /пропущен/.test(sk.textContent), sk&&sk.textContent); }
 // ---- 4. badges ----
 { const {w,T}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'badges'}}}); await sleep(200); w.__P.pinterestJumpApply(); await sleep(50);
   const b=()=>Array.from(layer(w)?layer(w).querySelectorAll('[data-pin-badge]'):[]).map(x=>x.textContent);
   ok('4a badges on visible candidates in keyboard order, off-screen tile skipped', JSON.stringify(b().slice(0,5))==='["1","2","3","5","6"]' && b().length===13 && b()[9]==='Q', JSON.stringify(b()));
   w.document.querySelector('.grid').insertAdjacentHTML('beforeend',related(2,980).replace(/data-k="(\d)"/g,(m,d)=>`data-k="${14+ +d}"`)); await sleep(450);
   ok('4b new tiles → badges updated (observer, throttled)', b().length===15, String(b().length));
   w.history.pushState(null,'','/pin/222/'); render(w,4,700); await sleep(1300);
   ok('4c navigation: old badges cleaned, new ones for the new page', b().length===3, JSON.stringify(b()));
   T.config.pinterestJumpKeys='off'; w.__P.pinterestJumpApply(); ok('4d switch to off removes layer', !layer(w)); }
 // ---- 5. shift / CapsLock ----
 { const {w,T}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'shift'}}}); await sleep(200); w.__P.pinterestJumpApply(); await sleep(50);
   ok('5a hidden by default', !layer(w));
   key(w,'ShiftLeft','Shift',{shiftKey:true}); await sleep(30); ok('5b Shift down → badges', !!layer(w) && layer(w).children.length>0);
   keyup(w,'ShiftLeft','Shift'); await sleep(30); ok('5c Shift up → hidden', !layer(w));
   key(w,'ShiftLeft','Shift',{shiftKey:true}); w.dispatchEvent(new w.Event('blur')); await sleep(30); ok('5d blur → hidden', !layer(w));
   key(w,'CapsLock','CapsLock',{modifierCapsLock:true}); await sleep(30); ok('5e CapsLock on → badges', !!layer(w));
   keyup(w,'CapsLock','CapsLock',{modifierCapsLock:true}); await sleep(30); ok('5f still shown while CapsLock on', !!layer(w));
   key(w,'KeyA','A',{modifierCapsLock:false}); await sleep(30); ok('5g CapsLock off → hidden', !layer(w)); }
 // ---- 6. during slideshow ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(),cfg:{config:{pinterestJumpKeys:'keys',slideshowDelay:30}}}); await sleep(200); w.__P.pinterestJumpApply();
   T.startSlideshow(); await sleep(200); key(w,'Digit2','2'); await sleep(100);
   ok('6a works during slideshow; slideshow continues on the new pin (navigating flag)', navs.length===1 && w.sessionStorage.getItem('mossad_navigating')==='true' && last(T)[1]==='901', JSON.stringify(last(T))); }
 // ---- 7. panel select ----
 { const {w,T}=load({items,url:URL0,pre:page()}); await sleep(200); w.widgetState='panel'; w.updateWidgetUI(); await sleep(50);
   const s=w.document.getElementById('mossad-sel-pjump');
   ok('7a panel selector with 5 modes (Фокус second)', s && JSON.stringify(Array.from(s.options).map(o=>o.textContent))==='["Выкл","Фокус","Переход","Переход + номера","Переход, номера по Shift"]', s&&s.innerHTML);
   s.value='badges'; s.dispatchEvent(new w.Event('change')); await sleep(50);
   ok('7b selecting "Переход + номера" applies immediately', T.config.pinterestJumpKeys==='badges' && !!layer(w)); }
 // ---- 8. FOCUS mode ----
 { const tile=(k,vid)=>`<div data-grid-item="true" data-k="${k}"><div tabindex="0" class="outer" data-test-id="pin"><a class="link" href="/pin/${800+k}/" aria-label="Pin ${k}"><div class="PinImage">${vid?'<video src="blob:x"></video>':`<img src="https://i.pinimg.com/236x/f${k}.jpg">`}</div></a><button class="menu" aria-label="Ещё">…</button></div></div>`;
   const fpage=w=>{ page()(w); w.document.querySelector('[data-test-id="relatedPins"]').innerHTML=`<div class="grid">${[0,1,2].map(k=>tile(k,k===1)).join('')}</div>`; w.__sv=[]; w.HTMLElement.prototype.scrollIntoView=function(o){ w.__sv.push(o&&o.block); }; };
   const {w,T,navs}=load({items,url:URL0,pre:fpage,cfg:{config:{pinterestJumpKeys:'focus',hk:undefined}}}); await sleep(200); w.__P.pinterestJumpApply();
   const e=key(w,'Digit2','2'); await sleep(50);
   const a=w.document.activeElement;
   ok('8a focus mode: key 2 focuses the inner link wrapping the video (not outer tile/menu), no navigation', a && a.classList.contains('link') && a.getAttribute('href')==='/pin/801/' && navs.length===0 && e.defaultPrevented && w.__sv[0]==='nearest', a&&a.outerHTML.slice(0,80));
   key(w,'Digit1','1'); await sleep(30);
   ok('8b key 1 → first tile link (image)', w.document.activeElement.getAttribute('href')==='/pin/800/');
   ok('8c focus mode: no badge layer', !layer(w));
   T.config.hk=Object.assign({},T.config.hk,{playPause:{key:' ',ctrl:false,alt:false,shift:false}});
   const sp=new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,cancelable:true}); w.document.activeElement.dispatchEvent(sp);
   ok('8d Space bound to MOSSAD playPause: on focused tile goes to the site (not prevented)', !sp.defaultPrevented && navs.length===0);
   w.document.activeElement.blur(); const sp2=new w.KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,cancelable:true}); w.document.body.dispatchEvent(sp2);
   ok('8e control: same Space without tile focus IS taken by playPause', sp2.defaultPrevented);
 }
 { const {w,T,navs}=load({items,url:'https://ru.pinterest.com/',pre:page(),cfg:{config:{pinterestJumpKeys:'focus'}}}); await sleep(200); w.__P.pinterestJumpApply();
   key(w,'Digit3','3'); await sleep(30);
   ok('8f focus mode also works on feed pages (no pin open)', w.document.activeElement.getAttribute('href')==='/pin/902/' && navs.length===0, w.document.activeElement.outerHTML.slice(0,60)); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
