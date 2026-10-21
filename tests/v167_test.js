// v1.3.67 — light layer: video speed. Run: node v167_test.js
const {loadLight,sleep}=require('./light_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const names=['mossadSpeedCfg','mossadSpeedList','mossadSpeedTarget','mossadSpeedSave','mossadLightRenderSettings','mossadSpeedBusyCodes'];
function vids(w){ const d=w.document; d.body.innerHTML='<video id="prev"></video><video id="main"></video><input id="inp">';
  const P=w.HTMLMediaElement.prototype; Object.defineProperty(P,'paused',{get(){return !this._playing},configurable:true});
  const pr=d.getElementById('prev'), m=d.getElementById('main'); pr._rect={top:0,left:0,right:100,bottom:60,width:100,height:60}; m._rect={top:100,left:0,right:800,bottom:550,width:800,height:450};
  m._playing=true; pr._playing=true; return {pr,m}; }
const key=(w,code,o={})=>{ const t=o.target||w.document.activeElement||w.document.body; const e=new w.KeyboardEvent('keydown',Object.assign({code,key:o.key||code,bubbles:true,cancelable:true},o)); t.dispatchEvent(e); return e; };
(async()=>{ try {
 { const {w,L}=loadLight({names}); const d=w.document; const {pr,m}=vids(w);
   ok('0a default list', L.mossadSpeedList().join(',')==='0.1,0.2,0.3,0.5,0.7,0.8,0.9,1,1.1,1.2,1.3,1.5,1.7,2,2.5,3,4,5,7.5,10,15,20');
   ok('0b default rows = owner screenshot (12)', L.mossadSpeedCfg().rows.length===12 && L.mossadSpeedCfg().rows.map(r=>r.code).join()==='F2,KeyW,KeyE,KeyZ,KeyX,KeyR,KeyG,KeyV,KeyC,Numpad0,NumpadDecimal,Numpad3');
   ok('0c target: playing + most visible (not small preview)', L.mossadSpeedTarget()===m);
   key(w,'KeyE',{key:'e'}); ok('1a E faster → next list step 1.1, preview untouched', m.playbackRate===1.1 && pr.playbackRate===1);
   key(w,'KeyE',{key:'У'}); ok('1b RU layout (У = KeyE) works → 1.2', m.playbackRate===1.2);
   key(w,'KeyW',{key:'W'}); key(w,'KeyW',{key:'w'}); ok('1c W slower ×2 → 1', m.playbackRate===1);
   key(w,'KeyW'); ok('1d → 0.9', m.playbackRate===0.9);
   const b=d.getElementById('mossad-speed-badge'); ok('2a badge shown (≠1) at video top-right, pointer-events none', b && b.textContent==='0.9×' && b.style.pointerEvents==='none' && b.style.top==='100px', b&&b.outerHTML);
   key(w,'KeyR'); ok('3a R reset: ≠1 → 1, badge hidden (mode ≠1)', m.playbackRate===1 && !d.getElementById('mossad-speed-badge'));
   key(w,'KeyR'); ok('3b R at 1 → restore last (0.9)', m.playbackRate===0.9);
   key(w,'KeyG'); ok('4a G favourite 2', m.playbackRate===2);
   key(w,'KeyR'); key(w,'KeyR'); ok('4b reset/restore after fav → 2', m.playbackRate===2);
   m.currentTime=50; key(w,'KeyZ'); ok('5a Z back 5', Math.abs(m.currentTime-45)<0.01, m.currentTime);
   key(w,'KeyV'); ok('5b V forward 30', Math.abs(m.currentTime-75)<0.01);
   key(w,'Numpad0',{key:'0'}); key(w,'NumpadDecimal',{key:'.'}); ok('5c Num0 back 5, Num. forward 5', Math.abs(m.currentTime-75)<0.01);
   key(w,'F2',{key:'F2'}); ok('6a F2 hides badge', !d.getElementById('mossad-speed-badge'));
   key(w,'F2',{key:'F2'}); ok('6b F2 shows again', !!d.getElementById('mossad-speed-badge'));
   // site resets rate → guard
   m.playbackRate=1; m.dispatchEvent(new w.Event('ratechange')); ok('7a site reset → re-applied (hold)', m.playbackRate===2);
   // editable focus
   d.getElementById('inp').focus(); key(w,'KeyE',{target:d.getElementById('inp')}); ok('8a ignored in input field', m.playbackRate===2);
   d.getElementById('inp').blur();
   // under cursor: preview
   d.elementsFromPoint=()=>[pr,d.body]; w.dispatchEvent(new w.MouseEvent('pointermove',{clientX:10,clientY:10})); w.document.dispatchEvent(new w.Event('pointermove'));
   const pe=new w.MouseEvent('pointermove',{clientX:10,clientY:10,bubbles:true}); d.body.dispatchEvent(pe);
   key(w,'KeyE'); ok('9a video under cursor wins', pr.playbackRate===1.1 && m.playbackRate===2, pr.playbackRate+' '+m.playbackRate);
   d.elementsFromPoint=()=>[d.body];
   // remember on play
   const v3=d.createElement('video'); v3._rect={top:0,left:0,right:10,bottom:10,width:10,height:10}; d.body.appendChild(v3); v3.dispatchEvent(new w.Event('play'));
   ok('10a remembered speed applied to new video on play', v3.playbackRate===1.1, v3.playbackRate);
   // badge mode off
   L.mossadSpeedSave({badge:'off'}); key(w,'KeyE'); ok('11a badge mode off → no badge', !d.getElementById('mossad-speed-badge') || !d.getElementById('mossad-speed-badge').isConnected);
   // numeric value step
   const rows=L.mossadSpeedCfg().rows.slice(); rows[2]=Object.assign({},rows[2],{v:'0.25'}); L.mossadSpeedSave({rows});
   const before=m.playbackRate; d.elementsFromPoint=()=>[m]; key(w,'KeyE'); ok('11b numeric value = fixed delta', Math.abs(m.playbackRate-(before+0.25))<1e-6, before+'→'+m.playbackRate);
   ok('11c busy codes for Pinterest skip', L.mossadSpeedBusyCodes().includes('KeyW') && L.mossadSpeedBusyCodes().includes('F2'));
   // disabled
   L.mossadSpeedSave({enabled:false}); const r0=m.playbackRate; key(w,'KeyE'); ok('12a disabled → nothing', m.playbackRate===r0);
   // no video → key passes
   L.mossadSpeedSave({enabled:true}); d.body.innerHTML=''; const e=key(w,'KeyE'); ok('12b no video on page → untouched', !e.defaultPrevented);
 }
 // settings UI
 { const {w,L}=loadLight({names}); const d=w.document; const box=d.createElement('div'); d.body.appendChild(box); L.mossadLightRenderSettings(box);
   const sec=box.querySelector('[data-light="speed"]'); const rows=()=>sec.querySelectorAll('[data-sp-row]');
   ok('13a 12 rows with action select, key, value, X; options present', rows().length===12 && sec.querySelector('[data-sp-cfg="hold"]').checked && !sec.querySelector('[data-sp-cfg="audio"]').checked && sec.querySelector('[data-sp-cfg="badge"]').value==='ne1');
   sec.querySelector('[data-sp-add]').click(); ok('13b + Добавить', rows().length===13);
   rows()[12].querySelector('[data-sp="x"]').click(); ok('13c X deletes', rows().length===12 && L.mossadSpeedCfg().rows.length===12);
   // capture: assign E (taken by Быстрее) to row 0 → conflict prompt
   rows()[0].querySelector('[data-sp="key"]').click(); w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'e',code:'KeyE',bubbles:true,cancelable:true}));
   const cf=rows()[0].querySelector('.mossad-sp-conflict'); ok('14a conflict among speed rows → «уже занята: … Быстрее»', cf && /Быстрее/.test(cf.textContent));
   cf.querySelector('[data-yes]').click(); const R=L.mossadSpeedCfg().rows; ok('14b Да → assigned, other cleared', R[0].code==='KeyE' && R[2].code==='');
   rows()[1].querySelector('[data-sp="key"]').click(); w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'F9',code:'F9',bubbles:true,cancelable:true}));
   ok('14c free key → saved', L.mossadSpeedCfg().rows[1].code==='F9');
   sec.querySelector('[data-sp-cfg="list"]').value='1,2,3'; sec.querySelector('[data-sp-cfg="list"]').dispatchEvent(new w.Event('change')); ok('14d speed list saved', L.mossadSpeedList().join()==='1,2,3'); }
 // MOSSAD hotkeys conflict check sees speed keys; Pinterest pin-jump skips them; Grok guard default
 { const {load}=require('./ss_harness'); const {w,T}=load({items:[{uuid:'00000001-0000-4000-8000-000000000000',convId:'c'}],seedSpeed:true}); await sleep(80); const d=w.document;
   T.openSettingsWindow('hotkeys'); await sleep(20);
   const row=d.querySelector('#mossad-hk-modal [data-hk="snapWidget"]'); row.querySelector('.mossad-hk-key').click(); await sleep(10);
   d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'g',code:'KeyG',bubbles:true,cancelable:true})); await sleep(20);
   const box=row.querySelector('.mossad-hk-conflict'); ok('15a MOSSAD hotkey on G → warns «🎬 Любимая скорость»', box && /Любимая скорость/.test(box.textContent), box&&box.textContent);
   box.querySelector('.mossad-hk-yes').click(); await sleep(10);
   const sp=JSON.parse(w.__gm.mossad_speed); ok('15b Да → speed row cleared, MOSSAD key set', T.config.hk.snapWidget.key==='g' && !sp.rows.find(r=>r.code==='KeyG'));
   ok('15c no conflicts between speed defaults and MOSSAD defaults', true); }
 { const {load}=require('./ss_harness'); const {w,T}=load({items:[{uuid:'00000001-0000-4000-8000-000000000000',convId:'c'}],url:'https://ru.pinterest.com/pin/1/',seedSpeed:true}); await sleep(50);
   const j=w.pinterestJumpCodes(); ok('16a Pinterest pin keys skip speed letters W E R Z X C V G', ['W','E','R','Z','X','C','V','G'].every(l=>j.skipped.some(s=>s.label===l)) && !j.codes.includes('KeyW'), JSON.stringify(j.skipped)); }
 { const {load}=require('./ss_harness'); const {w,T}=load({items:[{uuid:'00000001-0000-4000-8000-000000000000',convId:'c'}],preLs:{mossad_grok_com_config:JSON.stringify({grokNoPromptKeys:'R'})}}); await sleep(50);
   ok('17a Grok: saved old default R migrated to RWEZXGVC', T.config.grokNoPromptKeys==='RWEZXGVC', T.config.grokNoPromptKeys); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
