// v1.3.81 — Тудушки: черновик новой задачи и тексты сохраняются сами; превью фото — только у редактируемой задачи. Run: node v181_test.js
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
const IMG='data:image/png;base64,QQ==';
(async()=>{ try {
 const preGm={ mossad_todos: JSON.stringify([
   {id:'a',text:'открытая с фото',done:false,imgs:[{id:'ia',bytes:10}]},
   {id:'b',text:'вторая открытая',done:false,imgs:[{id:'ib',bytes:10},{id:'ib2',bytes:10}]},
   {id:'c',text:'выполненная',done:true,imgs:[{id:'ic',bytes:10}]} ]),
   mossad_todo_img_ia:IMG, mossad_todo_img_ib:IMG, mossad_todo_img_ib2:IMG, mossad_todo_img_ic:IMG };
 { const {w,T}=load({items,preGm}); const d=w.document; await sleep(300); w.confirm=()=>true;
   w.createImageBitmap=async()=>({width:10,height:10,close(){}}); w.FileReader=class{readAsDataURL(){ this.result=IMG; setTimeout(()=>this.onload&&this.onload()); }};
   T.openSettingsWindow('todos'); let m=d.getElementById('mossad-hk-modal');
   const row=(id)=>m.querySelector(`[data-todo="${id}"]`); const th=(id)=>row(id).querySelectorAll('.mossad-todo-thumb').length;
   const badge=(id)=>row(id).querySelector('.mossad-todo-imgs-badge');
   ok('1a no previews on open; badges «🖼 N»', th('a')===0 && th('b')===0 && th('c')===0 && badge('b').textContent==='🖼 2' && badge('c').style.display!=='none');
   row('a').querySelector('.mossad-todo-text').focus(); await sleep(10);
   ok('1b focus item a → only a shows previews', th('a')===1 && th('b')===0 && badge('a').style.display==='none');
   row('b').querySelector('.mossad-todo-text').focus(); await sleep(10);
   ok('1c focus item b → b shows, a folds back to badge', th('b')===2 && th('a')===0 && badge('a').style.display!=='none' && badge('a').textContent==='🖼 1');
   row('c').querySelector('.mossad-todo-text').focus(); await sleep(10);
   ok('1d done item: focusing does NOT show previews', th('c')===0, th('c'));
   badge('c').click(); ok('1e done item: badge click shows them on demand', th('c')===1);
   m.querySelector('#mossad-todo-new-text').focus(); await sleep(10);
   ok('1f focus new-task box → item previews folded', th('a')+th('b')+th('c')===0);
   // ---- autosave: row text on input (debounced), no change event ----
   const ta=row('a').querySelector('.mossad-todo-text'); ta.value='отредактировано'; ta.dispatchEvent(new w.Event('input',{bubbles:true}));
   await sleep(600); ok('2a item text saved on input (no change/blur)', JSON.parse(w.__gm.mossad_todos)[0].text==='отредактировано');
   // ---- new task draft ----
   const nt=m.querySelector('#mossad-todo-new-text'); nt.value='черновик задачи'; nt.dispatchEvent(new w.Event('input',{bubbles:true}));
   await sleep(600); ok('3a draft text saved to GM', JSON.parse(w.__gm.mossad_todo_draft).text==='черновик задачи', w.__gm.mossad_todo_draft);
   const n=await m._mossadTodoAddImages([new w.File([new Uint8Array(10)],'s.png',{type:'image/png'})], null);
   const dr=JSON.parse(w.__gm.mossad_todo_draft);
   ok('3b draft photo saved at once (own GM key)', n===1 && dr.imgs.length===1 && w.__gm['mossad_todo_img_'+dr.imgs[0].id]===IMG, w.__gm.mossad_todo_draft);
   nt.value='черновик задачи!'; nt.dispatchEvent(new w.Event('input',{bubbles:true}));
   T.closeSettingsWindow(); await sleep(20);
   ok('3c close window right away → latest text flushed', JSON.parse(w.__gm.mossad_todo_draft).text==='черновик задачи!');
   ok('3d settings window closed', !d.getElementById('mossad-hk-modal'));
 }
 { const gm={ ...preGm, mossad_todo_img_d1:IMG, mossad_todo_draft: JSON.stringify({text:'после перезагрузки',imgs:[{id:'d1',bytes:4}]}) };
   const {w,T}=load({items,preGm:gm}); const d=w.document; await sleep(300); w.confirm=()=>true;
   T.openSettingsWindow('todos'); const m=d.getElementById('mossad-hk-modal');
   ok('4a draft restored: text + photo preview', m.querySelector('#mossad-todo-new-text').value==='после перезагрузки' && m.querySelectorAll('#mossad-todo-new .mossad-todo-thumb').length===1);
   m.querySelector('#mossad-todo-add').click(); const L=JSON.parse(w.__gm.mossad_todos);
   ok('4b Add → task with photo, draft cleared', L.length===4 && L[3].text==='после перезагрузки' && L[3].imgs[0].id==='d1' && !w.__gm.mossad_todo_draft, w.__gm.mossad_todo_draft);
   // remove a pending photo deletes its GM key
   m.querySelector('#mossad-todo-new-text').value='x'; m.querySelector('#mossad-todo-new-text').dispatchEvent(new w.Event('input',{bubbles:true}));
   w.createImageBitmap=async()=>({width:10,height:10,close(){}}); w.FileReader=class{readAsDataURL(){ this.result=IMG; setTimeout(()=>this.onload&&this.onload()); }};
   await m._mossadTodoAddImages([new w.File([new Uint8Array(10)],'s.png',{type:'image/png'})], null);
   const pid=JSON.parse(w.__gm.mossad_todo_draft).imgs[0].id;
   m.querySelector(`#mossad-todo-new [data-img="${pid}"] .mossad-todo-img-del`).click();
   ok('4c remove draft photo → its GM key deleted, draft updated', !w.__gm['mossad_todo_img_'+pid] && JSON.parse(w.__gm.mossad_todo_draft).imgs.length===0);
   // photo pasted into an item → that item shows previews
   await m._mossadTodoAddImages([new w.File([new Uint8Array(10)],'s.png',{type:'image/png'})], 'b');
   ok('5 photo added to item b → b previews shown (3)', m.querySelectorAll('[data-todo="b"] .mossad-todo-thumb').length===3);
 }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
