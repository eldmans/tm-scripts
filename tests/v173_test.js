// v1.3.73 — вкладки окна настроек: «Тудушки» щёлкаются после ухода, только значки (+подсказка), листание ←/→ и б/ю по кругу. Run: node v173_test.js
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 const todos=JSON.stringify([{id:'t1',text:'первая',done:false,ts:1,imgs:[]},{id:'t2',text:'вторая',done:false,ts:2,imgs:[]}]);
 const {w,T,logs}=load({items,preGm:{mossad_todos:todos}}); await sleep(80); const d=w.document;
 T.openSettingsWindow('todos'); await sleep(10); const m=d.getElementById('mossad-hk-modal');
 const pane=()=>m.querySelector('[data-pane="todos"]'); const btn=(t)=>m.querySelector(`#mossad-settings-tabs [data-tab="${t}"]`);
 ok('1a todos tab open', m.dataset.tab==='todos' && pane().style.display==='flex');
 const rows0=pane().querySelectorAll('[data-todo]').length;
 pane().querySelector('[data-todo] .mossad-todo-text').value='первая (правка)';
 btn('general').click(); ok('1b switched away', m.dataset.tab==='general' && pane().style.display==='none');
 let err=null; try { btn('todos').click(); } catch(e){ err=e; }
 ok('1c todos tab clickable again, list re-rendered (no ReferenceError)', !err && m.dataset.tab==='todos' && pane().style.display==='flex' && pane().querySelectorAll('[data-todo]').length===rows0, String(err));
 ok('1d unsaved text kept across tab switch', pane().querySelector('[data-todo] .mossad-todo-text').value==='первая (правка)');
 // icons only
 const tabs=[...m.querySelectorAll('#mossad-settings-tabs [data-tab]')];
 ok('2a tabs show only icon, full name in tooltip', tabs.length===7 && tabs.every(b=>!/\s/.test(b.textContent.trim()) && b.textContent.trim().length<=3 && b.title.length>3) && btn('todos').textContent==='📝' && /Тудушки/.test(btn('todos').title) && /Горячие клавиши/.test(btn('hotkeys').title), tabs.map(b=>b.textContent+'|'+b.title).join(' ; '));
 T.mossadApplyLabels(); ok('2b label refresh keeps icon-only', btn('todos').textContent==='📝' && /Тудушки/.test(btn('todos').title));
 // cycling
 const order=tabs.map(b=>b.dataset.tab);
 const key=(code,key,o={},target=d.body)=>{ const e=new w.KeyboardEvent('keydown',Object.assign({code,key,bubbles:true,cancelable:true},o)); target.dispatchEvent(e); return e; };
 if (d.activeElement && d.activeElement.blur) d.activeElement.blur();
 T.openSettingsWindow(order[order.length-1]);
 let e=key('ArrowRight','ArrowRight'); ok('3a → from last wraps to first', m.dataset.tab===order[0] && e.defaultPrevented, m.dataset.tab);
 key('ArrowLeft','ArrowLeft'); ok('3b ← from first wraps to last', m.dataset.tab===order[order.length-1]);
 key('Period','ю'); ok('3c ю (Period) → next', m.dataset.tab===order[0]);
 key('Comma','Б',{shiftKey:true}); ok('3d Б (Shift+Comma) → previous', m.dataset.tab===order[order.length-1]);
 key('Period','.'); key('Period','.'); ok('3e . twice', m.dataset.tab===order[1]);
 const inp=d.createElement('input'); m.appendChild(inp); inp.focus(); const before=m.dataset.tab; e=key('ArrowRight','ArrowRight',{},inp);
 ok('3f in a text field arrows are not stolen', m.dataset.tab===before && !e.defaultPrevented); inp.remove();
 key('ArrowRight','ArrowRight',{ctrlKey:true}); ok('3g with Ctrl → ignored', m.dataset.tab===before);
 T.closeSettingsWindow(false); e=key('ArrowRight','ArrowRight');
 ok('3h window closed → arrows untouched', !e.defaultPrevented && !d.getElementById('mossad-hk-modal'));
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
