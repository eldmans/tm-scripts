const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
(async()=>{ try {
 const {w,T}=load({items}); const d=w.document; await sleep(1200); w.confirm=()=>true;
 // ---- mocks: canvas / bitmap / blob url / GM_getValue counter ----
 let bmp={width:3000,height:1500}; let drawn=null, enc=null;
 w.createImageBitmap=async()=>Object.assign({close(){}},bmp);
 w.HTMLCanvasElement.prototype.getContext=function(){ const c=this; return {fillRect(){}, drawImage(src,x,y,ww,hh){ drawn=[ww,hh,c.width,c.height]; }, set fillStyle(v){}}; };
 w.HTMLCanvasElement.prototype.toDataURL=function(t,q){ enc=[t,q]; return 'data:image/jpeg;base64,'+'A'.repeat(4000); };
 w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
 let imgReads=0; const gget=w.GM_getValue; w.GM_getValue=(k,dv)=>{ if(String(k).startsWith('mossad_todo_img_')) imgReads++; return gget(k,dv); };
 const file=(name,type,size=1000)=>new w.File([new Uint8Array(size)],name,{type});
 // ---- 2DO button + lazy ----
 const b2=d.getElementById('mossad-btn-todo'); const kids=[...b2.parentNode.children];
 ok('1a 2DO button right of 🔄', b2.textContent==='2DO' && kids[kids.indexOf(b2)-1].textContent==='🔄');
 w.__gm.mossad_todos=JSON.stringify([{id:'old1',text:'старое',done:false,imgs:[{id:'oi1',bytes:10}]}]); w.__gm.mossad_todo_img_oi1='data:image/jpeg;base64,QQ==';
 T.openSettingsWindow('general'); ok('1b images not read until tab opened', imgReads===0);
 b2.click(); let m=d.getElementById('mossad-hk-modal');
 ok('1c 2DO opens settings on todos tab', m && m.dataset.tab==='todos' && !!m.querySelector('#mossad-todo-list'));
 ok('1d images loaded lazily on tab open, thumb 64px', imgReads===1 && m.querySelector('[data-todo="old1"] .mossad-todo-thumb img').style.width==='64px');
 ok('1e labels', T.L('tabTodos')==='📝 Тудушки' && T.L('todoGitHub')==='📤 На GitHub' && T.L('todoBtn')==='2DO');
 // ---- add with downscaled image ----
 const n=await m._mossadTodoAddImages([file('big.jpg','image/jpeg',500000)], null);
 ok('2a downscale 3000x1500 → 1280x640 JPEG 0.8', n===1 && drawn && drawn[0]===1280 && drawn[1]===640 && enc[0]==='image/jpeg' && enc[1]===0.8, JSON.stringify([drawn,enc]));
 bmp={width:100,height:80}; enc=null; await m._mossadTodoAddImages([file('s.png','image/png',2000)], null);
 const pend=[...m.querySelectorAll('#mossad-todo-new .mossad-todo-thumb img')];
 ok('2b small PNG kept as PNG (no canvas)', enc===null && pend.length===2 && pend[1].src.startsWith('data:image/png'));
 m.querySelector('#mossad-todo-new-text').value='Новая задача\nвторая строка'; m.querySelector('#mossad-todo-add').click();
 let L=JSON.parse(w.__gm.mossad_todos); const nt=L[1];
 ok('2c item stored small; images in separate GM keys', L.length===2 && nt.imgs.length===2 && !w.__gm.mossad_todos.includes('base64') && nt.imgs.every(i=>(w.__gm['mossad_todo_img_'+i.id]||'').startsWith('data:image/')));
 // ---- paste & drop into an item ----
 const row=m.querySelector(`[data-todo="${nt.id}"]`); const ta=row.querySelector('.mossad-todo-text');
 bmp={width:2000,height:2000};
 const pe=new w.Event('paste',{bubbles:true,cancelable:true}); Object.defineProperty(pe,'clipboardData',{value:{files:[file('p.jpg','image/jpeg',300000)]}}); ta.dispatchEvent(pe); await sleep(100);
 ok('3a Ctrl+V image into item', pe.defaultPrevented && JSON.parse(w.__gm.mossad_todos)[1].imgs.length===3 && row.querySelectorAll('.mossad-todo-thumb').length===3);
 const te=new w.Event('paste',{bubbles:true,cancelable:true}); Object.defineProperty(te,'clipboardData',{value:{files:[]}}); ta.dispatchEvent(te);
 ok('3b plain-text paste untouched', !te.defaultPrevented);
 const de=new w.Event('drop',{bubbles:true,cancelable:true}); Object.defineProperty(de,'dataTransfer',{value:{files:[file('d.jpg','image/jpeg',1000)],types:['Files']}}); row.dispatchEvent(de); await sleep(100);
 ok('3c drag-drop image into item', de.defaultPrevented && JSON.parse(w.__gm.mossad_todos)[1].imgs.length===4);
 // ---- overlay ----
 row.querySelector('.mossad-todo-thumb').click(); const ov=d.getElementById('mossad-todo-overlay');
 ok('4a thumb click → full overlay', !!ov && ov.querySelector('img').src.startsWith('data:image/'));
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 ok('4b Esc closes overlay only (settings stay open)', !d.getElementById('mossad-todo-overlay') && !!d.getElementById('mossad-hk-modal'));
 // ---- remove one image ----
 const firstImg=JSON.parse(w.__gm.mossad_todos)[1].imgs[0].id; row.querySelector(`[data-img="${firstImg}"] .mossad-todo-img-del`).click();
 ok('4c remove photo deletes its GM key', JSON.parse(w.__gm.mossad_todos)[1].imgs.length===3 && !w.__gm['mossad_todo_img_'+firstImg]);
 // ---- copy / export ----
 m.querySelector('#mossad-todo-copy').click();
 ok('5a copy: numbered open items', m._mossadTodoLastCopy==='1. старое [фото: 1]\n2. Новая задача\n   вторая строка [фото: 3]', JSON.stringify(m._mossadTodoLastCopy));
 m.querySelector('#mossad-todo-export').click();
 ok('5b export: single HTML with embedded images', /<!doctype html>/.test(m._mossadTodoLastExport) && (m._mossadTodoLastExport.match(/<img src="data:image/g)||[]).length===4);
 // ---- done / reorder / clear done ----
 const cb=m.querySelector('[data-todo="old1"] .mossad-todo-done'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
 ok('6a done saved', JSON.parse(w.__gm.mossad_todos)[0].done===true);
 m.querySelector('#mossad-todo-copy').click(); ok('6b copy skips done', !/старое/.test(m._mossadTodoLastCopy));
 const list=m.querySelector('#mossad-todo-list'); const stub=()=>[...list.children].forEach(el=>{ el.getBoundingClientRect=()=>{ const i=[...list.children].indexOf(el); return {top:i*50,bottom:i*50+50,height:50,left:0,right:300,width:300}; }; });
 const C=w.PointerEvent||w.MouseEvent; const P=(t,el,y)=>el.dispatchEvent(new C(t,{bubbles:true,cancelable:true,clientY:y,button:0}));
 stub(); P('pointerdown',m.querySelector('[data-todo="old1"] .mossad-todo-handle'),20); P('pointermove',d,30); stub(); P('pointermove',d,140); stub(); P('pointermove',d,140); P('pointerup',d,140);
 ok('6c drag reorder persisted', JSON.parse(w.__gm.mossad_todos).map(t=>t.id).join()===`${nt.id},old1`);
 m.querySelector('#mossad-todo-clear-done').click();
 ok('6d clear done removes item + its images', JSON.parse(w.__gm.mossad_todos).length===1 && !w.__gm.mossad_todo_img_oi1);
 // ---- size warning ----
 const LL=JSON.parse(w.__gm.mossad_todos); LL[0].imgs[0].bytes=21*1048576; w.__gm.mossad_todos=JSON.stringify(LL); m._mossadRenderTodos();
 ok('7 storage warning > 20 MB', /⚠️/.test(m.querySelector('#mossad-todo-size').textContent));
 LL[0].imgs[0].bytes=4000; w.__gm.mossad_todos=JSON.stringify(LL); m._mossadRenderTodos();
 // ---- GitHub ----
 const calls=[]; let routes={};
 w.GM_xmlhttpRequest=(o)=>{ calls.push(o.method+' '+o.url.replace('https://api.github.com','')+(o.data?' '+o.data.slice(0,0):'')); const key=o.method+' '+o.url.replace('https://api.github.com/repos/eldmans/tm-scripts',''); const r=(Object.entries(routes).find(([k])=>key.startsWith(k))||[])[1]||{status:500};
   setTimeout(()=>o.onload({status:r.status,responseText:JSON.stringify(r.json||{}),responseHeaders:r.headers||''}),1); calls[calls.length-1]+=' '+(o.data?JSON.parse(o.data).branch||JSON.parse(o.data).title||'':''); w.__lastBody=w.__lastBody||{}; if(o.data) w.__lastBody[o.method+' '+key.split('/')[1]]=JSON.parse(o.data); };
 T.config.githubToken='';
 m.querySelector('#mossad-todo-gh').click(); let r=await m._mossadTodoLastSend; ok('8a no token → clear error', !r.ok && /токен/.test(r.error));
 T.config.githubToken='tok';
 routes={'GET /git/ref/heads/todo-assets':{status:404},'GET /git/ref/heads/grok':{status:200,json:{object:{sha:'abc'}}},'POST /git/refs':{status:201},'PUT /contents/':{status:201},'POST /labels':{status:201},'POST /issues':{status:201,json:{number:77,html_url:'https://github.com/eldmans/tm-scripts/issues/77'}},'GET ':{status:200,json:{default_branch:'grok'}}};
 m.querySelector('#mossad-todo-gh').click(); r=await m._mossadTodoLastSend;
 const flow=calls.map(c=>c.split(' ').slice(0,2).join(' ').replace('/repos/eldmans/tm-scripts',''));
 ok('8b API flow', r.ok && flow[0]==='GET /git/ref/heads/todo-assets' && flow[1]==='GET ' && flow[2]==='GET /git/ref/heads/grok' && flow[3]==='POST /git/refs' && flow.filter(f=>f.startsWith('PUT /contents/todo/')).length===3 && flow.slice(-2).join()==='POST /labels,POST /issues', flow.join(' | '));
 const ib=w.__lastBody['POST issues']; const pb=w.__lastBody['PUT contents'];
 ok('8c issue: title 2DO <date>, label, numbered body with raw links', /^2DO \d{4}-\d{2}-\d{2}$/.test(ib.title) && ib.labels[0]==='mossad-todo' && /^1\. Новая задача/.test(ib.body) && /raw\.githubusercontent\.com\/eldmans\/tm-scripts\/todo-assets\/todo\/\d{4}-\d{2}-\d{2}\//.test(ib.body), ib.body.slice(0,200));
 ok('8d image PUT: base64 + branch todo-assets', pb.branch==='todo-assets' && /^[A-Za-z0-9+/=]+$/.test(pb.content) && !pb.content.startsWith('data:'));
 ok('8e items marked sent with badge, kept', JSON.parse(w.__gm.mossad_todos)[0].sent.n===77 && m.querySelector('.mossad-todo-sent').textContent==='📤 #77');
 calls.length=0; m.querySelector('#mossad-todo-gh').click(); r=await m._mossadTodoLastSend; ok('8f already sent → not resent', !r.ok && calls.length===0);
 // errors: new item, 403 on issues with header, 404 repo
 m.querySelector('#mossad-todo-new-text').value='ещё'; m.querySelector('#mossad-todo-add').click();
 routes={'POST /labels':{status:403},'POST /issues':{status:403,json:{message:'Resource not accessible by personal access token'},headers:'x-accepted-github-permissions: issues=write\r\n'}};
 m.querySelector('#mossad-todo-gh').click(); r=await m._mossadTodoLastSend;
 ok('9a 403 → clear message with needed permission', !r.ok && /403/.test(r.error) && /issues=write/.test(r.error) && /Issues/.test(r.error), r.error);
 bmp={width:10,height:10}; const lastId=JSON.parse(w.__gm.mossad_todos).slice(-1)[0].id; await m._mossadTodoAddImages([file('x.jpg','image/jpeg')], lastId);
 routes={'GET /git/ref/heads/todo-assets':{status:404},'GET ':{status:404,json:{message:'Not Found'}}};
 m.querySelector('#mossad-todo-gh').click(); r=await m._mossadTodoLastSend;
 ok('9b 404 → repo access hint', !r.ok && /404/.test(r.error) && /Repository access/.test(r.error), r.error);
 ok('9c failed send leaves item unsent', !JSON.parse(w.__gm.mossad_todos).slice(-1)[0].sent);
 // ---- hotkey ----
 T.closeSettingsWindow(true);
 ok('10a openTodos default empty', T.config.hk.openTodos && T.config.hk.openTodos.key==='');
 T.config.hk.openTodos={key:'F10',ctrl:false,alt:false,shift:false};
 d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'F10',code:'F10',bubbles:true,cancelable:true}));
 ok('10b hotkey opens todos tab', d.getElementById('mossad-hk-modal') && d.getElementById('mossad-hk-modal').dataset.tab==='todos');
 T.openSettingsWindow('hotkeys'); ok('10c openTodos row in hotkeys list', !!d.querySelector('#mossad-hk-list [data-hk="openTodos"]'));
 w.close();
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
