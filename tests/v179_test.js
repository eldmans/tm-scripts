// v1.3.79 — ⛶ «Развернуть / полный экран» (config.hk.expand, F: f F а А). Run: node v179_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ openSettingsWindow, mossadToggleExpand, grokFindExpandButton };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v179.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const kd=(w,t,key,code,o={})=>{ const e=new w.KeyboardEvent('keydown',Object.assign({key,code,bubbles:true,cancelable:true},o)); t.dispatchEvent(e); return e; };
(async()=>{ try {
 { const {w,T}=load({items}); await sleep(80); const d=w.document; const C=T.config;
   ok('0a default expand = f (no modifiers)', C.hk.expand && C.hk.expand.key==='f' && !C.hk.expand.shift && !C.hk.expand.ctrl, JSON.stringify(C.hk.expand));
   ok('0b F in «не кидают в промт» on Grok', /F/.test(C.grokNoPromptKeys), C.grokNoPromptKeys);
   d.body.insertAdjacentHTML('beforeend','<div class="absolute"><span class="opacity-0"><button type="button" aria-label="Expand video" id="ex"><svg><g id="name=expand"><path/></g></svg></button></span></div>');
   let c=0; d.getElementById('ex').addEventListener('click',()=>c++);
   let e=kd(w,d.body,'f','KeyF'); await sleep(10);
   ok('1a f → Grok «Expand video» clicked, default prevented', c===1 && e.defaultPrevented, c);
   kd(w,d.body,'F','KeyF',{shiftKey:true}); await sleep(10); ok('1b Shift+F works too', c===2, c);
   kd(w,d.body,'а','KeyF'); await sleep(10); ok('1c Cyrillic а (KeyF) works', c===3, c);
   kd(w,d.body,'А','KeyF',{shiftKey:true}); await sleep(10); ok('1d Cyrillic А (Shift) works', c===4, c);
   await sleep(320); const ta=d.createElement('textarea'); d.body.appendChild(ta); ta.focus();
   kd(w,ta,'f','KeyF'); await sleep(10); ok('1e typing f in a text field is not hijacked', c===4, c); ta.blur(); ta.remove();
   kd(w,d.body,'f','KeyF',{ctrlKey:true}); await sleep(10); ok('1f Ctrl+F not taken', c===4, c);
   // icon-only (no aria-label) button
   d.getElementById('ex').remove(); d.body.insertAdjacentHTML('beforeend','<button id="ex2"><svg><g id="name=expand"></g></svg></button>');
   let c2=0; d.getElementById('ex2').addEventListener('click',()=>c2++);
   kd(w,d.body,'f','KeyF'); await sleep(10); ok('2 button found by svg g#name=expand', c2===1, c2); d.getElementById('ex2').remove();
   // already fullscreen → exit
   let exited=0; Object.defineProperty(d,'fullscreenElement',{get(){return d.body},configurable:true}); d.exitFullscreen=()=>{exited++; return Promise.resolve();};
   kd(w,d.body,'f','KeyF'); await sleep(10); ok('3 in fullscreen → exitFullscreen', exited===1, exited);
   Object.defineProperty(d,'fullscreenElement',{get(){return null},configurable:true});
   // fallback: active video fullscreen
   const v=d.querySelector('video'); let rq=0; v.requestFullscreen=()=>{rq++; return Promise.resolve();};
   const r=w.__P.mossadToggleExpand(); ok('4 no button → <video>.requestFullscreen', rq===1 && r==='video', r);
   // guard: Grok handlers on document (bubble) don't see Shift+F
   let seen=0; d.addEventListener('keydown',()=>seen++); kd(w,d.body,'F','KeyF',{shiftKey:true}); await sleep(5);
   ok('5 Shift+F stopped before Grok listeners (key guard)', seen===0, seen);
   // settings list
   w.__P.openSettingsWindow('hotkeys'); await sleep(30); const L=d.querySelector('#mossad-hk-modal #mossad-hk-list');
   ok('6a hotkey row «⛶ Развернуть» present with F', L.querySelector('[data-hk="expand"]') && /Развернуть/.test(L.querySelector('[data-hk="expand"]').textContent));
   { const r=L.querySelector('[data-hk="pinFullScale"]'); ok('6b pinFullScale row kept, labelled «устарело» (saved order = DOM order)', r && /устарело/.test(r.textContent)); }
 }
 { const {w,T}=load({items,url:'https://ru.pinterest.com/pin/1/'}); await sleep(80); const d=w.document;
   d.body.insertAdjacentHTML('beforeend','<div data-test-id="closeup-body"><button aria-label="Показать в полном масштабе" id="fsb">x</button></div>'); let c=0; d.getElementById('fsb').addEventListener('click',()=>c++);
   kd(w,d.body,'f','KeyF'); await sleep(20);
   ok('7 Pinterest: F → «Показать в полном масштабе» (same as pinFullScale)', c===1, c); }
 { // migration: saved Grok config with old list
   const {w,T}=load({items,preLs:{'mossad_config_grok.com':JSON.stringify({grokNoPromptKeys:'RW'})}}); await sleep(50);
   ok('8 migration appends F once', /F$/.test(T.config.grokNoPromptKeys) && T.config.npkExpandAdded===true, T.config.grokNoPromptKeys); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
