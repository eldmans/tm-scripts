const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const P=(w,type,target,y)=>{ const C=w.PointerEvent||w.MouseEvent; target.dispatchEvent(new C(type,{bubbles:true,cancelable:true,clientX:10,clientY:y,button:0})); };
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
(async()=>{ try {
 const {w,T}=load({items}); const d=w.document; await sleep(1200);
 T.openSettingsWindow('hotkeys'); let m=d.getElementById('mossad-hk-modal'); let list=m.querySelector('#mossad-hk-list');
 const keys=()=>[...list.querySelectorAll('[data-hk]')].map(r=>r.dataset.hk);
 const row=k=>list.querySelector(`[data-hk="${k}"]`);
 const k0=keys();
 const r0=row(k0[0]); const btns=[...r0.querySelector('.mossad-hk-key').parentNode.children];
 const iOff=btns.findIndex(b=>b.classList&&b.classList.contains('mossad-hk-key-off'));
 ok('1a ⤒ ⤓ 🔒 right of the red — ', btns[iOff+2].classList.contains('mossad-hk-top') && btns[iOff+3].classList.contains('mossad-hk-bottom') && btns[iOff+4].classList.contains('mossad-hk-pin') && btns[iOff+2].textContent==='⤒' && btns[iOff+3].textContent==='⤓' && btns[iOff+4].textContent==='🔒');
 row(k0[5]).querySelector('.mossad-hk-top').click();
 ok('2a ⤒ moves to top', keys()[0]===k0[5] && keys().length===k0.length);
 ok('2b order persisted', JSON.parse(w.__gm.mossad_hk_order)[0]===k0[5]);
 row(k0[0]).querySelector('.mossad-hk-bottom').click();
 ok('2c ⤓ moves to bottom', keys()[keys().length-1]===k0[0]);
 // pin the row at index 2
 const pk=keys()[2]; row(pk).querySelector('.mossad-hk-pin').click();
 ok('3a pin toggles 🔓, persisted, ⤒⤓ disabled', row(pk).querySelector('.mossad-hk-pin').textContent==='🔓' && JSON.parse(w.__gm.mossad_hk_pinned).includes(pk) && row(pk).querySelector('.mossad-hk-top').disabled && row(pk).querySelector('.mossad-hk-handle').style.cursor==='default');
 const before=keys().join(); row(pk).querySelector('.mossad-hk-top').click(); ok('3b ⤒ on pinned does nothing', keys().join()===before);
 // ⤒ another row: pinned stays at index 2
 const other=keys()[8]; row(other).querySelector('.mossad-hk-top').click();
 ok('3c ⤒ of other row keeps pinned at index 2', keys()[0]===other && keys()[2]===pk);
 // drag pinned → no drag
 const stub=()=>[...list.children].forEach(el=>{ el.getBoundingClientRect=()=>{ const sec=el.classList.contains('mossad-hk-sep')||el.classList.contains('mossad-hk-sec-site'); if(sec) return {top:-1000,bottom:-1000,height:0,left:0,right:300,width:300}; const i=[...list.children].filter(c=>!c.classList.contains('mossad-hk-sep')&&!c.classList.contains('mossad-hk-sec-site')).indexOf(el); return {top:i*40,bottom:i*40+40,height:40,left:0,right:300,width:300}; }; });
 stub(); P(w,'pointerdown',row(pk).querySelector('.mossad-hk-handle'),100); P(w,'pointermove',d,300); stub();
 ok('4a pinned row not draggable', !list.querySelector('.mossad-hk-placeholder')); P(w,'pointerup',d,300);
 // drag row 0 down past pinned → pinned stays at 2
 const first=keys()[0]; stub(); P(w,'pointerdown',row(first).querySelector('.mossad-hk-handle'),20); P(w,'pointermove',d,30); stub(); P(w,'pointermove',d,230); stub(); P(w,'pointermove',d,230); P(w,'pointerup',d,230);
 ok('4b drag across pinned: pinned keeps its slot, dragged row moved', keys()[2]===pk && keys().indexOf(first)>2, keys().slice(0,7).join(','));
 ok('4c saved order matches DOM', JSON.parse(w.__gm.mossad_hk_order).join()===keys().join());
 // reopen: pinned state + order restored
 const snapK=keys().join(); T.closeSettingsWindow(true); T.openSettingsWindow('hotkeys'); m=d.getElementById('mossad-hk-modal'); list=m.querySelector('#mossad-hk-list');
 ok('5a reopen restores order + pin', keys().join()===snapK && row(pk).dataset.pinned==='1' && row(pk).querySelector('.mossad-hk-pin').textContent==='🔓');
 row(pk).querySelector('.mossad-hk-pin').click();
 ok('5b unpin → 🔒, ⤒ works again', row(pk).querySelector('.mossad-hk-pin').textContent==='🔒' && !JSON.parse(w.__gm.mossad_hk_pinned).includes(pk) && (row(pk).querySelector('.mossad-hk-top').click(), keys()[0]===pk));
 ok('5c labels in L()', T.L('hkTop')==='⤒' && T.L('hkPin')==='🔒' && T.L('hkUnpin')==='🔓');
 ok('5d modal still open after mini-button clicks', !!d.getElementById('mossad-hk-modal'));
 w.close();
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
