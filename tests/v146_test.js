const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const key=(w,o)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)));
const items=[0,1].map(i=>({uuid:U(i),convId:'c1'}));
(async()=>{ try {
 { const {w,T}=load({items}); const d=w.document; await sleep(1200);
   const st=d.getElementById('mossad-gallery-status'), col=d.getElementById('mossad-gallery-collect');
   ok('1a defaults unchanged', T.L('slideshow')==='Слайдшоу' && st.textContent==='Слайдшоу' && d.getElementById('mossad-btn-start').textContent==='🚀' && d.getElementById('mossad-gallery-grmode').textContent.startsWith('Gr'));
   ok('1b unknown key → empty', T.L('noSuchKey')==='');
   const txt=T.mossadLabelsToText();
   ok('1c text has comment + key line for every label', Object.keys(T.LABEL_DEFAULTS).every(k=>new RegExp('^'+k+' = ','m').test(txt)) && /^# кнопка запуска слайд-шоу/m.test(txt));
   const p=T.mossadParseLabelsText('# c\nslideshow = Пуск\nbogus = x\nstart =   \nstop=STOP\nnoeq\ncollect = Собрать\n');
   ok('1d parse: only changed known keys, empty=default, unknown reported', JSON.stringify(p.overrides)==='{"slideshow":"Пуск","stop":"STOP"}' && p.unknown.join()==='bogus', JSON.stringify(p));
   // open tab lazily
   T.openSettingsWindow('general'); let m=d.getElementById('mossad-hk-modal');
   ok('2a labels pane not built until opened', !m.querySelector('#mossad-labels-ta'));
   m.querySelector('[data-tab="labels"]').click();
   const ta=m.querySelector('#mossad-labels-ta'), pal=m.querySelector('#mossad-labels-palette');
   ok('2b tab built: textarea prefilled, palette present', ta && ta.value.includes('slideshow = Слайдшоу') && pal.querySelectorAll('[data-emo]').length>100);
   ok('2c palette includes MOSSAD icons + extras', ['💾','🚀','🔀','⌨','⇄','⤤','📹','🖼','❔','⏸','⏹','⏭','🔇','🗑','⭐','❤','🔥','📁','⚡','🔒','🕒','✔','✖'].every(e=>pal.querySelector(`[data-emo="${e}"]`)));
   // caret insert
   const pos=ta.value.indexOf('Слайдшоу')+0; ta.focus(); ta.setSelectionRange(pos,pos); ta.dispatchEvent(new w.Event('select'));
   pal.querySelector('[data-emo="🚀"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
   ok('3a click inserts at caret', ta.value.includes('slideshow = 🚀Слайдшоу') && ta.selectionStart===pos+2 && d.activeElement===ta);
   ta.setSelectionRange(ta.value.indexOf('A−'), ta.value.indexOf('A−')+2); ta.dispatchEvent(new w.Event('select'));
   pal.querySelector('[data-emo="➖"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
   ok('3b selection replaced', ta.value.includes('fontDec = ➖'));
   // save
   ta.value=ta.value.replace('stop = ■','stop = STOP').replace('collect = Собрать','collect = ').concat('\nfoo = bar\n');
   m.querySelector('#mossad-labels-save').click();
   const gm=JSON.parse(w.__gm.mossad_labels);
   ok('4a only changed keys stored in GM', JSON.stringify(Object.keys(gm).sort())===JSON.stringify(['fontDec','slideshow','stop']), JSON.stringify(gm));
   ok('4b live re-render', st.textContent==='🚀Слайдшоу' && d.getElementById('mossad-gallery-stop').textContent==='STOP' && (col.dataset.mossadLabel ? col.textContent==='Собрать' : /^\d+$/.test(col.textContent)), st.textContent+'|'+d.getElementById('mossad-gallery-stop').textContent+'|'+col.textContent);
   ok('4c status shows unknown', /foo/.test(m.querySelector('#mossad-labels-status').textContent));
   // apply on close without pressing save
   ta.value=ta.value.replace('start = 🚀','start = GO'); key(w,{key:'Escape',code:'Escape'});
   ok('5a close saves labels', JSON.parse(w.__gm.mossad_labels).start==='GO' && d.getElementById('mossad-btn-start').textContent==='GO');
   // state switches use L
   T.config; T.updateGalleryStatusBtn('playing'); ok('5b status state uses L (pause default)', st.textContent==='❚❚');
   T.updateGalleryStatusBtn('idle'); ok('5c idle → custom slideshow label', st.textContent==='🚀Слайдшоу');
   // panel re-render picks labels
   d.getElementById('mossad-btn-toggle-panel').click(); await sleep(200);
   ok('5d panel buttons labelled', d.getElementById('mossad-btn-hk').textContent==='⚙ Настройки');
   // collect count is not overwritten
   col.textContent='0'; T.mossadUnlabelEl(col).textContent='42'; T.mossadApplyLabels();
   ok('5e numeric collect not overwritten', col.textContent==='42');
   // reset
   T.openSettingsWindow('labels'); m=d.getElementById('mossad-hk-modal'); ok('6a remembered labels tab', m.dataset.tab==='labels');
   w.confirm=()=>true; m.querySelector('#mossad-labels-reset').click();
   ok('6b reset → defaults, GM empty', JSON.stringify(JSON.parse(w.__gm.mossad_labels))==='{}' && d.getElementById('mossad-btn-start').textContent==='🚀' && st.textContent==='Слайдшоу' && m.querySelector('#mossad-labels-ta').value.includes('start = 🚀'));
   T.closeSettingsWindow(true);
   w.close(); }
 // stored overrides from another container; garbage tolerated
 { const {w,T}=load({items, preGm:{mossad_labels:JSON.stringify({slideshow:'Поехали', bogus:'x', stop:'', fontInc:42})}}); const d=w.document; await sleep(1200);
   ok('7a stored override applied on load', d.getElementById('mossad-gallery-status').textContent==='Поехали' && d.getElementById('mossad-gallery-stop').textContent==='■');
   w.close(); }
 { const {w,T}=load({items, preGm:{mossad_labels:'not json{'}}); await sleep(1000); ok('7b broken GM value → defaults', T.L('slideshow')==='Слайдшоу'); w.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
