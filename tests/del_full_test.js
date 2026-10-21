const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
// Grok-like viewer: post viewer is [role=dialog] with its own "Delete video" trigger; trigger TOGGLES the alertdialog (Radix-like)
function setupViewer(w,{toggle=true}={}){
  const d=w.document; const viewer=d.createElement('div'); viewer.setAttribute('role','dialog'); viewer.id='viewer';
  const del=d.createElement('button'); del.setAttribute('aria-label','Delete video'); del.textContent=''; viewer.appendChild(del); d.body.appendChild(viewer);
  w.__deleted=0; let dlg=null;
  del.addEventListener('click',()=>{
    if(dlg && dlg.isConnected){ if(toggle){ dlg.remove(); dlg=null; } return; }
    dlg=d.createElement('div'); dlg.setAttribute('role','alertdialog'); dlg.setAttribute('aria-modal','true'); dlg.setAttribute('data-state','open');
    dlg.innerHTML='<h2>Delete video?</h2><p>This can’t be undone.</p><button id="c">Cancel</button><button id="ok">Delete video</button>';
    d.body.appendChild(dlg); const cancel=dlg.querySelector('#c'); setTimeout(()=>cancel.focus(),0); // Radix focuses Cancel
    dlg.querySelector('#ok').addEventListener('click',()=>{ w.__deleted++; const cur=w.location.pathname.split('/').pop();
      setTimeout(()=>{ dlg&&dlg.remove(); // remove the filmstrip frame of deleted item
        const b=d.querySelector(`[data-filmstrip-item][data-uuid="${cur}"]`); if(b) b.remove(); },120); });
    cancel.addEventListener('click',()=>setTimeout(()=>dlg&&dlg.remove(),80));
  });
}
(async()=>{
  const items=[0,1,2,3].map(i=>({uuid:U(i),convId:'c1'}));
  // A: hold post ON (autoconfirm) -> confirms once, waits for removal, then moves to neighbour frame
  { const {w,T}=load({items,startIdx:1,cfg:{config:{deleteHoldpost:true,deleteAutoconfirm:true,slideshowDirections:['down'],loopFeed:false}}});
    setupViewer(w); const t0=Date.now(); await T.runSmartDelete(); const ms=Date.now()-t0; await sleep(200);
    const log=T.mossadDumpDebugLog().filter(e=>e.source==='delete').map(e=>e.msg);
    ok('A hold post ON: deleted exactly once', w.__deleted===1, `deleted=${w.__deleted}`);
    ok('A hold post ON: moved to neighbour frame #3 after removal', w.__clicks[0]===U(2), `clicked=${w.__clicks[0]&&parseInt(w.__clicks[0])} in ${ms}ms`);
    ok('A dialog closed', !w.document.querySelector('[role=alertdialog]'));
    console.log('   debug:', log.join(' | ')); w.close(); }
  // B: hold post OFF -> focus on "Delete video", Enter confirms, no navigation
  { const {w,T}=load({items,startIdx:1,cfg:{config:{deleteHoldpost:false,deleteAutoconfirm:false}}});
    setupViewer(w); const p=T.runSmartDelete(); await sleep(600);
    const ae=w.document.activeElement; ok('B hold post OFF: focus on "Delete video"', ae && ae.textContent==='Delete video', `focused=${ae&&ae.textContent}`);
    ae.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true})); ae.click(); // browser turns Enter on a button into click
    await p; await sleep(200);
    ok('B Enter -> deleted once, no navigation', w.__deleted===1 && w.__clicks.length===0, `deleted=${w.__deleted} clicks=${w.__clicks.length}`); w.close(); }
  // C: hold post ON, user-cancel scenario impossible (autoconfirm) -> instead: dialog never appears
  { const {w,T}=load({items,startIdx:1,cfg:{config:{deleteHoldpost:true,deleteAutoconfirm:true}}});
    const d=w.document; const b=d.createElement('button'); b.setAttribute('aria-label','Delete video'); d.body.appendChild(b);
    await T.runSmartDelete(); ok('C no dialog & no removal -> no navigation', w.__clicks.length===0, `clicks=${w.__clicks.length}`); w.close(); }
  console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0);
})();
