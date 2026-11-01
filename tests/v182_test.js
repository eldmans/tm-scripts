// v1.3.82 — 🔔 сигналы скачивания (dup / start), настройки в «⚙ Общие», видимость «Уже скачивался». Run: node v182_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ mossadBeep, mossadBeepsRead, mossadBeepsWrite, mossadBeepLog, showDuplicateDownloadNotice, triggerDownload, openSettingsWindow, closeSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v182.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 { const {w,T}=load({items}); await sleep(80); const d=w.document; const P=w.__P;
   const osc=[]; const AP=w.AudioContext.prototype; const co=AP.createOscillator; AP.createOscillator=function(){ const o=co.call(this); o.frequency={}; osc.push(o); return o; };
   const B=P.mossadBeepsRead();
   ok('1 defaults: on, vol 40, dup 330Hz×2 90ms, start 1320Hz×1 90ms', B.on && B.volume===40 && B.dup.hz===330 && B.dup.count===2 && B.dup.ms===90 && B.start.hz===1320 && B.start.count===1, JSON.stringify(B));
   ok('2a dup beep → 2 low oscillators', P.mossadBeep('dup')===true && osc.length===2 && osc.every(o=>o.frequency.value===330), osc.length);
   ok('2b same signal again at once → deduped', P.mossadBeep('dup')===false && osc.length===2);
   osc.length=0; ok('2c start beep → 1 high oscillator', P.mossadBeep('start')===true && osc.length===1 && osc[0].frequency.value===1320);
   // settings UI
   P.openSettingsWindow('general'); const m=d.getElementById('mossad-hk-modal'); const q=id=>m.querySelector('#'+id);
   ok('3a UI: master, volume, per-event on/Hz/count/ms text fields and ▶', q('mossad-beep-on') && q('mossad-beep-volume').type==='text' && ['dup','start'].every(k=>q(`mossad-beep-${k}-on`) && q(`mossad-beep-${k}-hz`).type==='text' && q(`mossad-beep-${k}-count`) && q(`mossad-beep-${k}-ms`) && q(`mossad-beep-${k}-test`)));
   const set=(id,v)=>{ q(id).value=v; q(id).dispatchEvent(new w.Event('change',{bubbles:true})); };
   set('mossad-beep-dup-hz','500'); set('mossad-beep-dup-count','3'); set('mossad-beep-dup-ms','abc'); set('mossad-beep-volume','150');
   const G=JSON.parse(w.__gm.mossad_beeps);
   ok('3b fields saved to GM (global), bad values normalized', G.dup.hz===500 && G.dup.count===3 && G.dup.ms===90 && G.volume===100 && q('mossad-beep-dup-ms').value==='90' && q('mossad-beep-volume').value==='100', w.__gm.mossad_beeps);
   osc.length=0; q('mossad-beep-start-hz').value='2000'; q('mossad-beep-start-test').click();
   ok('3c ▶ plays current (unsaved) field values', osc.length===1 && osc[0].frequency.value===2000 && JSON.parse(w.__gm.mossad_beeps).start.hz===1320);
   q('mossad-beep-start-test').click(); ok('3d ▶ not deduped (test)', osc.length===2);
   q('mossad-beep-start-on').checked=false; q('mossad-beep-start-on').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(450);
   osc.length=0; ok('4a event off → no start beep', P.mossadBeep('start')===false && osc.length===0);
   q('mossad-beep-dup-test').click(); ok('4b ▶ still plays when event is off? (dup on) yes', osc.length===3);
   q('mossad-beep-on').checked=false; q('mossad-beep-on').dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(450);
   osc.length=0; ok('4c master off → no dup beep', P.mossadBeep('dup')===false && osc.length===0);
   q('mossad-beep-dup-test').click(); ok('4d ▶ works with master off', osc.length===3);
   q('mossad-beep-on').checked=true; q('mossad-beep-on').dispatchEvent(new w.Event('change',{bubbles:true}));
   set('mossad-beep-volume','0'); await sleep(450); osc.length=0; ok('4e volume 0 → silent', P.mossadBeep('dup')===false && osc.length===0);
   set('mossad-beep-volume','40'); q('mossad-beep-start-on').checked=true; q('mossad-beep-start-on').dispatchEvent(new w.Event('change',{bubbles:true}));
   q('mossad-beep-start-hz').value='1500'; P.closeSettingsWindow(); ok('4f closing window saves typed field', JSON.parse(w.__gm.mossad_beeps).start.hz===1500);
   // duplicate notice visibility
   await sleep(450); const wc=d.getElementById('mossad-widget-container');
   wc.style.display='none'; osc.length=0;
   P.showDuplicateDownloadNotice({filename:'a.mp4',date:'вчера'}, ()=>{}, 'u1','m1');
   let n=d.getElementById('mossad-dup-warning');
   ok('5a widget hidden → notice on body, fixed, visible + dup beep', n && n.parentNode===d.body && n.style.position==='fixed' && osc.length===3, n&&n.parentNode&&n.parentNode.id);
   wc.style.display='flex'; await sleep(450);
   P.showDuplicateDownloadNotice({filename:'a.mp4',date:'вчера'}, ()=>{}, 'u1','m1'); n=d.getElementById('mossad-dup-warning');
   ok('5b widget shown → notice inside widget (as before), clickable', n.parentNode===wc && n.style.pointerEvents==='auto');
   Object.defineProperty(d,'fullscreenElement',{get(){return d.getElementById('stage')},configurable:true});
   P.showDuplicateDownloadNotice({filename:'a.mp4'}, ()=>{}, 'u1','m1'); n=d.getElementById('mossad-dup-warning');
   ok('5c fullscreen → notice inside fullscreen element', n.parentNode===d.getElementById('stage'));
   Object.defineProperty(d,'fullscreenElement',{get(){return null},configurable:true});
   T.config.allowDuplicates=true; await sleep(450); osc.length=0; let dl=0;
   P.showDuplicateDownloadNotice({filename:'a.mp4'}, ()=>{dl++;}, 'u1','m1');
   ok('5d «Качать дубли» on → still dup beep, downloads', osc.length===3 && dl===1);
 }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
