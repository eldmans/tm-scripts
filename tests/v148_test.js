const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
const H=(key,o={})=>Object.assign({key,ctrl:false,alt:false,shift:false},o);
(async()=>{ try {
 const {w,T}=load({items}); const d=w.document; await sleep(1200); w.confirm=()=>true;
 T.openSettingsWindow('hotkeys'); let m=d.getElementById('mossad-hk-modal'); const list=()=>m.querySelector('#mossad-hk-list');
 const keys=()=>[...list().querySelectorAll('[data-hk]')].map(r=>r.dataset.hk);
 const row=k=>list().querySelector(`[data-hk="${k}"]`);
 const k0=keys();
 // footer
 const foot=m.querySelector('#mossad-hk-reset').parentNode;
 ok('1a footer: «По умолчанию:» + Клавиши / Порядок / Применить на всех сайтах / Сохранить как умолчание (v1.3.68)', /^По умолчанию:/.test(foot.textContent.trim()) && m.querySelector('#mossad-hk-reset').textContent==='Клавиши' && m.querySelector('#mossad-hk-order-reset').textContent==='Порядок' && m.querySelector('#mossad-hk-save-defaults').textContent==='Сохранить как умолчание' && m.querySelector('#mossad-hk-apply-all').textContent==='Применить на всех сайтах' && !/↺ По умолчанию|↕ Порядок/.test(foot.textContent));
 ok('1b labels in L()', T.L('hkResetKeys')==='Клавиши' && T.L('hkSaveDefaults')==='Сохранить как умолчание' && T.L('hkApplyAll')==='Применить на всех сайтах' && T.L('hkDefaultsLabel')==='По умолчанию:');
 // change keys + pin sound at its slot
 T.config.hk.download=H('F2'); T.config.hk.sound=H('F3');
 row('sound').querySelector('.mossad-hk-pin').click();
 const soundIdx=keys().indexOf('sound');
 row('rewind').querySelector('.mossad-hk-top').click();
 // factory reset of keys: pinned sound keeps F3
 m.querySelector('#mossad-hk-reset').click(); m=d.getElementById('mossad-hk-modal');
 ok('2a Клавиши (factory): unpinned reset, pinned kept', T.config.hk.download.key==='PageDown' && T.config.hk.sound.key==='F3');
 ok('2b row ↺ disabled on pinned', row('sound').querySelector('.mossad-hk-key-reset').disabled);
 m.querySelector('#mossad-hk-order-reset').click();
 ok('2c Порядок (factory): order restored, pinned stays in place', keys()[soundIdx]==='sound' && keys().filter(k=>k!=='sound').join()===k0.filter(k=>k!=='sound').join(), keys().slice(0,9).join());
 // custom state → Сохранить это
 T.config.hk.download=H('F4'); T.config.hk.prevSlide=H('F6');
 row('snapWidget').querySelector('.mossad-hk-top').click();
 const savedOrder=keys().slice();
 m.querySelector('#mossad-hk-save-defaults').click();
 const rec=JSON.parse(w.__gm.mossad_hk_defaults);
 ok('3a saved defaults record: hk + order + pinned + id', rec.hk.download.key==='F4' && rec.order.join()===savedOrder.join() && rec.pinned.includes('sound') && !!rec.id);
 // now change and reset → saved defaults used
 T.config.hk.download=H('F7'); row('rewind').querySelector('.mossad-hk-top').click();
 m.querySelector('#mossad-hk-reset').click(); m=d.getElementById('mossad-hk-modal');
 ok('3b Клавиши uses saved defaults', T.config.hk.download.key==='F4' && T.config.hk.prevSlide.key==='F6');
 m.querySelector('#mossad-hk-order-reset').click();
 ok('3c Порядок uses saved order', keys().join()===savedOrder.join());
 T.config.hk.download=H('F8'); row('download').querySelector('.mossad-hk-key-reset').click();
 ok('3d row ↺ uses saved default', T.config.hk.download.key==='F4');
 T.closeSettingsWindow(true); w.close();
 // ---- receiving container (other tab): broadcast must not touch its pinned rows ----
 const {w:w2,T:T2}=load({items, preGm:{mossad_hk_pinned:JSON.stringify(['download'])}}); await sleep(1200);
 T2.config.hk.download=H('F11'); T2.config.hk.sound=H('F12');
 T2.openSettingsWindow('hotkeys'); const m2=w2.document.getElementById('mossad-hk-modal');
 const keys2=()=>[...m2.querySelectorAll('#mossad-hk-list [data-hk]')].map(r=>r.dataset.hk);
 const dlIdx=keys2().indexOf('download');
 const rec2={id:'remote1',ts:Date.now(),hk:Object.assign(JSON.parse(JSON.stringify(T2.config.hk)),{download:H('X'),sound:H('Y'),prevSlide:H('Z')}),order:['snapWidget','download','rewind'],pinned:['history']};
 const v=JSON.stringify(rec2); w2.__gm.mossad_hk_defaults=v; (w2.__gmL.mossad_hk_defaults||[]).forEach(f=>f('mossad_hk_defaults',null,v,true));
 await sleep(50);
 ok('4a broadcast applied live (unpinned keys)', T2.config.hk.sound.key==='Y' && T2.config.hk.prevSlide.key==='Z');
 ok('4b broadcast did not touch local pinned key', T2.config.hk.download.key==='F11');
 ok('4c pinned row keeps position; order applied; list re-rendered', keys2()[dlIdx]==='download' && keys2()[0]==='snapWidget', keys2().slice(0,4).join());
 ok('4d pins merged', JSON.parse(w2.__gm.mossad_hk_pinned).includes('history') && JSON.parse(w2.__gm.mossad_hk_pinned).includes('download'));
 ok('4e applied id remembered + GM hk_global updated', w2.localStorage.getItem('mossad_hk_defaults_applied')==='remote1' && JSON.parse(w2.__gm.mossad_hk_global).sound.key==='Y');
 const before=JSON.stringify(T2.config.hk); (w2.__gmL.mossad_hk_defaults||[]).forEach(f=>f('mossad_hk_defaults',null,v,true));
 ok('4f same id not re-applied', JSON.stringify(T2.config.hk)===before);
 w2.close();
 // ---- container not open: applies on next load, once ----
 const rec3={id:'r3',ts:1,hk:{download:H('F9'),sound:H('F10')},order:[],pinned:[]};
 { const {w:w3,T:T3}=load({items, preGm:{mossad_hk_defaults:JSON.stringify(rec3)}}); await sleep(1000);
   ok('5a applied on load', T3.config.hk.download.key==='F9' && w3.localStorage.getItem('mossad_hk_defaults_applied')==='r3'); w3.close(); }
 { const {w:w4,T:T4}=load({items, preGm:{mossad_hk_defaults:JSON.stringify(rec3), mossad_hk_global:JSON.stringify({download:H('F1',{shift:true})})}, preLs:{mossad_hk_defaults_applied:'r3'}}); await sleep(1000);
   ok('5b already applied → not re-applied on load', T4.config.hk.download.key==='F1' && T4.config.hk.download.shift); w4.close(); }
 { const {w:w5,T:T5}=load({items, preGm:{mossad_hk_defaults:JSON.stringify(rec3), mossad_hk_pinned:JSON.stringify(['download']), mossad_hk_global:JSON.stringify({download:H('F5')})}}); await sleep(1000);
   ok('5c load apply skips pinned', T5.config.hk.download.key==='F5' && T5.config.hk.sound.key==='F10'); w5.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
