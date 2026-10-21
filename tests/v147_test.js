const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const press=(w,o)=>{ const e=new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)); w.document.dispatchEvent(e); return e; };
const items=[0,1,2].map(i=>({uuid:U(i),convId:'c1'})).concat([3,4].map(i=>({uuid:U(i),convId:'c2'})));
const KEYS={
  next:{key:'ArrowRight',code:'ArrowRight'}, prev:{key:'ArrowLeft',code:'ArrowLeft'},
  nextGrp:{key:'PageDown',code:'PageDown',altKey:true}, prevGrp:{key:'PageUp',code:'PageUp',altKey:true},
  stop:{key:'F9',code:'F9'}, rewind:{key:'r',code:'KeyR',altKey:true}, dupNext:{key:' ',code:'Space',ctrlKey:true},
};
(async()=>{ try {
 const {w,T}=load({items}); const d=w.document; await sleep(1200);
 T.config.hk.galleryStop={key:'F9',ctrl:false,alt:false,shift:false};
 let opened=0; w.GM_openInTab=()=>{opened++;};
 const snap=()=>JSON.stringify([w.location.pathname, w.__clicks.length, w.__navs.length, w.sessionStorage.getItem('mossad_grok_imagine_ss')]);
 // ---- active + paused: keys are ours ----
 T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(1500);
 press(w,{key:'Insert',code:'Insert'}); await sleep(200); // pause → no auto-advance
 ok('0a big slideshow paused', !!w._mossadGalleryPaused && !!w._mossadGalleryActive);
 let s0=snap(); let e=press(w,KEYS.next); await sleep(400);
 ok('0b active: → prevented + navigates', e.defaultPrevented && snap()!==s0);
 s0=snap(); e=press(w,KEYS.nextGrp); await sleep(400);
 ok('0c active: Alt+PageDown prevented + navigates', e.defaultPrevented && snap()!==s0);
 // ---- stop via the bar button ----
 d.getElementById('mossad-gallery-stop').click(); await sleep(300);
 ok('1a stopped: stop & pause buttons hidden', d.getElementById('mossad-gallery-stop').style.display==='none' && d.getElementById('mossad-gallery-status').textContent==='Слайдшоу');
 ok('1b collection still present (old fallback trigger)', !!w.sessionStorage.getItem('mossad_grok_imagine_collection'));
 for (const [name,k] of Object.entries(KEYS)) {
   const before=snap(), op=opened; const ev=press(w,k); await sleep(400);
   ok(`2 stopped: ${name} not prevented, no action`, !ev.defaultPrevented && snap()===before && opened===op && !w._isRewinding && !T.active && !w._mossadGalleryActive, name);
 }
 // non-slideshow hotkeys still work
 let ev=press(w,{key:'F1',code:'F1',ctrlKey:true}); ok('3a Ctrl+F1 still works', ev.defaultPrevented && !!d.getElementById('mossad-hk-modal'));
 press(w,{key:'F1',code:'F1',ctrlKey:true});
 ev=press(w,{key:'ScrollLock',code:'ScrollLock'}); ok('3b sound hotkey still works', ev.defaultPrevented);
 // Insert starts again; then keys are ours again
 ev=press(w,{key:'Insert',code:'Insert'}); await sleep(1500);
 ok('3c Insert starts slideshow after stop', ev.defaultPrevented && !!w._mossadGalleryActive);
 press(w,{key:'Insert',code:'Insert'}); await sleep(200);
 s0=snap(); e=press(w,KEYS.prev); await sleep(400); ok('3d restarted: ← works again', e.defaultPrevented && snap()!==s0);
 // galleryStop hotkey itself stops
 e=press(w,KEYS.stop); await sleep(300); ok('3e F9 (galleryStop) stops while active', e.defaultPrevented && !w._mossadGalleryActive && !T.active);
 e=press(w,KEYS.next); ok('3f after hotkey stop: → passes through', !e.defaultPrevented);
 // ---- small slideshow (Shift+Insert) ----
 e=press(w,{key:'Insert',code:'Insert',shiftKey:true}); await sleep(600);
 ok('4a small slideshow started', T.active && !w._mossadGalleryActive);
 e=press(w,{key:'Insert',code:'Insert',shiftKey:true}); await sleep(300);
 ok('4b small slideshow stopped', !T.active);
 for (const name of ['next','prev','nextGrp','prevGrp','rewind','dupNext']) { const before=snap(); const ev2=press(w,KEYS[name]); await sleep(300);
   ok(`4c small stopped: ${name} passes through`, !ev2.defaultPrevented && snap()===before); }
 // page reload after stop: stale sessionStorage must not re-arm
 w.close();
 { const {w:w2,T:T2}=load({items}); await sleep(1200); const e2=press(w2,KEYS.next); ok('5 fresh page w/ collection, no slideshow: → passes through', !e2.defaultPrevented); w2.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
