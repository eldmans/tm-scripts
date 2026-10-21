const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const key=(w,o)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)));
const P=(w,type,target,y)=>{ const C=w.PointerEvent||w.MouseEvent; target.dispatchEvent(new C(type,{bubbles:true,cancelable:true,clientX:10,clientY:y,button:0})); };
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
(async()=>{ try {
 // ---- 1. migration: one binding ----
 { const gmHk={download:[null,{key:'d',ctrl:false,alt:false,shift:false}], nextSlide:[{key:'ArrowRight',ctrl:false,alt:false,shift:false},{key:' ',ctrl:false,alt:false,shift:false}],
     sound:[{key:'',ctrl:false,alt:false,shift:false},{key:'F9',ctrl:false,alt:false,shift:false}], deleteVid:[null,null]};
   const {w,T}=load({items, preGm:{mossad_hk_global:JSON.stringify(gmHk)}}); await sleep(1200);
   const hk=T.config.hk;
   ok('1a no arrays left in config.hk', Object.values(hk).every(v=>v && !Array.isArray(v) && !('0' in v)));
   ok('1b primary empty → secondary promoted (download=d)', hk.download.key==='d', JSON.stringify(hk.download));
   ok('1c primary kept (nextSlide=ArrowRight), Space dropped', hk.nextSlide.key==='ArrowRight');
   ok('1d empty "" primary → F9 promoted', hk.sound.key==='F9');
   ok('1e both empty → disabled', hk.deleteVid.key==='', JSON.stringify(hk.deleteVid));
   const gm=JSON.parse(w.__gm.mossad_hk_global); ok('1f GM rewritten clean', !Array.isArray(gm.download) && gm.download.key==='d' && !Array.isArray(gm.nextSlide));
   const ev=(k,c)=>({key:k,code:c,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false});
   ok('1g Space no longer matches nextSlide', !T.hotkeyMatches(ev(' ','Space'),hk.nextSlide) && T.hotkeyMatches(ev('ArrowRight','ArrowRight'),hk.nextSlide));
   ok('1h normalize: object with stray 0/1 props uses slots', T.normalizeHotkeyBinding({key:'PageDown',0:null,1:{key:'x'}}).key==='x');
   ok('1i normalize keeps code', T.normalizeHotkeyBinding({key:'b',code:'KeyB',ctrl:true}).code==='KeyB');
   w.close(); }
 // ---- 2. UI single slot, buttons ----
 { const {w,T}=load({items}); const d=w.document; await sleep(1200);
   T.openSettingsWindow('hotkeys'); const m=d.getElementById('mossad-hk-modal');
   const rows=[...m.querySelectorAll('#mossad-hk-list > [data-hk]')];
   ok('2a every row has exactly one key button', rows.length>10 && rows.every(r=>r.querySelectorAll('.mossad-hk-key').length===1));
   ok('2b no save buttons', !m.querySelector('#mossad-hk-save-close') && !m.querySelector('#mossad-hk-save-all') && ![...m.querySelectorAll('button')].some(b=>/Сохранить и закрыть/.test(b.textContent)));
   ok('2c reset button (v1.3.48: «Клавиши»)', m.querySelector('#mossad-hk-reset').textContent.trim()==='Клавиши');
   ok('2d single Закрыть', [...m.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Закрыть').length===1);
   ok('2e handle is label (grab), key btn not handle', rows[0].querySelector('.mossad-hk-handle').style.cursor==='grab' && !rows[0].querySelector('.mossad-hk-key').closest('.mossad-hk-handle'));
   // capture sets single object
   rows.find(r=>r.dataset.hk==='download').querySelector('.mossad-hk-key').click();
   key(w,{key:'k',code:'KeyK'}); ok('2f capture stores object', !Array.isArray(T.config.hk.download) && T.config.hk.download.key==='k' && T.config.hk.download.code==='KeyK');
   rows.find(r=>r.dataset.hk==='download').querySelector('.mossad-hk-key-off').click(); ok('2g disable', T.config.hk.download.key==='');
   rows.find(r=>r.dataset.hk==='download').querySelector('.mossad-hk-key-reset').click(); ok('2h reset to default', T.config.hk.download.key==='PageDown');
   // ---- 3. tab memory ----
   m.querySelector('[data-tab="defaults"]').click(); T.closeSettingsWindow(true);
   ok('3a stored in localStorage', w.localStorage.getItem('mossad_settings_tab')==='defaults');
   T.openSettingsWindow(); ok('3b reopens last tab', d.getElementById('mossad-hk-modal').dataset.tab==='defaults');
   key(w,{key:'Escape',code:'Escape'});
   key(w,{key:'F1',code:'F1',ctrlKey:true}); ok('3c Ctrl+F1 opens last tab', d.getElementById('mossad-hk-modal') && d.getElementById('mossad-hk-modal').dataset.tab==='defaults');
   key(w,{key:'F1',code:'F1',ctrlKey:true}); ok('3d Ctrl+F1 closes', !d.getElementById('mossad-hk-modal'));
   w.close(); }
 { const {w,T}=load({items, preLs:{mossad_settings_tab:'general'}}); const d=w.document; await sleep(1200);
   key(w,{key:'F1',code:'F1',ctrlKey:true}); ok('3e new page: remembered tab', d.getElementById('mossad-hk-modal').dataset.tab==='general');
   w.close(); }
 // ---- 4. reorder ----
 { const {w,T}=load({items}); const d=w.document; await sleep(1200);
   T.openSettingsWindow('hotkeys'); let m=d.getElementById('mossad-hk-modal'); const list=m.querySelector('#mossad-hk-list');
   const stub=()=>[...list.children].forEach(el=>{ el.getBoundingClientRect=()=>{ const sec=el.classList.contains('mossad-hk-sep')||el.classList.contains('mossad-hk-sec-site'); if(sec) return {top:-1000,bottom:-1000,height:0,left:0,right:300,width:300}; const i=[...list.children].filter(c=>!c.classList.contains('mossad-hk-sep')&&!c.classList.contains('mossad-hk-sec-site')).indexOf(el); return {top:i*40,bottom:i*40+40,height:40,left:0,right:300,width:300}; }; });
   const before=[...list.querySelectorAll('[data-hk]')].map(r=>r.dataset.hk);
   const lab=list.querySelector('[data-hk] .mossad-hk-handle'); stub();
   P(w,'pointerdown',lab,20); P(w,'pointermove',d,22); ok('4a <4px → no drag', !list.querySelector('.mossad-hk-placeholder'));
   P(w,'pointermove',d,30); stub(); ok('4b drag active: placeholder + grabbing', !!list.querySelector('.mossad-hk-placeholder') && d.body.style.cursor==='grabbing' && lab.style.cursor==='grabbing');
   P(w,'pointermove',d,150); stub(); P(w,'pointermove',d,150);
   P(w,'pointerup',d,150);
   const after=[...list.querySelectorAll('[data-hk]')].map(r=>r.dataset.hk);
   ok('4c placeholder removed, cursor restored', !list.querySelector('.mossad-hk-placeholder') && d.body.style.cursor==='' && lab.style.cursor==='grab');
   ok('4d moved first row down', after[0]!==before[0] && after.indexOf(before[0])>=2 && after.length===before.length, after.slice(0,5).join(','));
   const saved=JSON.parse(w.__gm.mossad_hk_order||'[]'); ok('4e order persisted in GM', saved.join()===after.join());
   T.closeSettingsWindow(true); T.openSettingsWindow('hotkeys'); m=d.getElementById('mossad-hk-modal');
   ok('4f order applied on render', [...m.querySelectorAll('#mossad-hk-list [data-hk]')].map(r=>r.dataset.hk).join()===after.join());
   // click on key button doesn't start drag
   P(w,'pointerdown',m.querySelector('[data-hk] .mossad-hk-key'),20); P(w,'pointermove',d,200); ok('4g key input is not a handle', !m.querySelector('.mossad-hk-placeholder')); P(w,'pointerup',d,200);
   m.querySelector('#mossad-hk-order-reset').click();
   ok('4h reset order', [...m.querySelectorAll('#mossad-hk-list [data-hk]')].map(r=>r.dataset.hk).join()===before.join() );
   w.close(); }
 { const {w,T}=load({items, preGm:{mossad_hk_order:JSON.stringify(['download','bogusAction','sound'])}}); const d=w.document; await sleep(1200);
   T.openSettingsWindow('hotkeys'); const ks=[...d.querySelectorAll('#mossad-hk-list [data-hk]')].map(r=>r.dataset.hk);
   ok('4i stored order first, unknown ignored, rest appended', ks[0]==='download'&&ks[1]==='sound'&&!ks.includes('bogusAction')&&ks.includes('nextSlide')&&new Set(ks).size===ks.length);
   ok('4j orderedHotkeyKeys new key at end', T.orderedHotkeyKeys(['a','b','c'],['c','x']).join()==='c,a,b');
   w.close(); }
 // ---- 5. every close path saves ----
 { const {w,T}=load({items}); const d=w.document; await sleep(1200);
   const mark=(v)=>{ T.config.hk.galleryStop={key:v,ctrl:false,alt:false,shift:false}; };
   const saved=(v)=>JSON.parse(w.__gm.mossad_hk_global).galleryStop.key===v;
   T.openSettingsWindow('hotkeys'); mark('F2'); d.getElementById('mossad-settings-x').click(); ok('5a × closes+saves', !d.getElementById('mossad-hk-modal') && saved('F2'));
   T.openSettingsWindow('hotkeys'); mark('F3'); key(w,{key:'Escape',code:'Escape'}); ok('5b Esc closes+saves', !d.getElementById('mossad-hk-modal') && saved('F3'));
   T.openSettingsWindow('hotkeys'); mark('F4'); d.getElementById('mossad-hk-close').click(); ok('5c Закрыть closes+saves', !d.getElementById('mossad-hk-modal') && saved('F4'));
   let m=T.openSettingsWindow('hotkeys'); mark('F5');
   d.body.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true})); d.body.click(); ok('5d untrusted page click does not close', !!d.getElementById('mossad-hk-modal'));
   m._mossadOnOutsidePointerDown({target:m}); m._mossadOnOutsideClick({isTrusted:true,target:m.querySelector('h3')}); ok('5e trusted click inside stays open', !!d.getElementById('mossad-hk-modal'));
   m._mossadOnOutsidePointerDown({target:d.body}); m._mossadOnOutsideClick({isTrusted:true,target:d.body}); ok('5f trusted outside click closes+saves', !d.getElementById('mossad-hk-modal') && saved('F5'));
   m=T.openSettingsWindow('general'); m.querySelector('#mossad-playlist-rows').value='77'; m.querySelector('#mossad-gh-token').value='tok123';
   key(w,{key:'Escape',code:'Escape'}); const ls=JSON.parse(w.localStorage.getItem(Object.keys(w.localStorage).find(k=>/_config$/.test(k))));
   ok('5g focused field flushed on close', T.config.playlistRows===77 && ls.playlistRows===77);
   ok('5h token flushed on close', T.config.githubToken==='tok123');
   // listeners removed: outside handler after close is inert
   ok('5i no modal leftover / listeners cleaned', !d.getElementById('mossad-hk-modal'));
   w.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
