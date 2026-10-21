// v1.3.43: Saved tile types (compact/full view), Make video on post page, layout-independent hotkeys + Grok layout bridge
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
function saved(){ const items=[{uuid:U(0),convId:'c1'}]; const r=load({items,url:'https://grok.com/imagine/saved'});
  Object.defineProperty(r.w.HTMLImageElement.prototype,'complete',{get(){return !!this.getAttribute('src')},configurable:true}); // jsdom: no image loading
  r.w.sessionStorage.removeItem('mossad_grok_imagine_collection'); return r; }
function tile(d,grid,i,{badge,make,video,img=true}={}){ const li=d.createElement('div'); li.setAttribute('role','listitem');
  const a=d.createElement('a'); a.href='/imagine/post/'+U(100+i); li.appendChild(a);
  if(img){ const im=d.createElement('img'); im.src='https://assets.grok.com/x/'+i+'.jpg'; a.appendChild(im); }
  if(video){ a.appendChild(d.createElement('video')); }
  if(badge){ const s=d.createElement('span'); s.className='tabular-nums'; s.textContent='0:06'; li.appendChild(s); }
  if(make){ const b=d.createElement('button'); if(make==='text') b.textContent='Make video'; else b.setAttribute('aria-label','Make Video'); b.innerHTML+='<svg class="lucide-play"></svg>'; li.appendChild(b); }
  grid.appendChild(li); return li; }
const typeOf=(items,i)=>{ const it=items.find(x=>x.url.includes(U(100+i))); return it?it.type:'missing'; };
(async()=>{ try{
  // 1. compact view
  { const {w,T}=saved(); const d=w.document; const g=d.createElement('div'); d.body.appendChild(g);
    tile(d,g,1,{badge:true}); tile(d,g,2,{}); tile(d,g,3,{badge:true,video:true}); tile(d,g,4,{});
    const it=T.grokCollectLinks();
    ok('1a compact: view detected', T.grokSavedViewMode()==='compact');
    ok('1b compact: badge=video, no badge=photo', typeOf(it,1)==='video'&&typeOf(it,2)==='photo'&&typeOf(it,3)==='video'&&typeOf(it,4)==='photo', it.map(x=>x.type).join(',')); w.close(); }
  // 2. full view
  { const {w,T}=saved(); const d=w.document; const g=d.createElement('div'); d.body.appendChild(g);
    tile(d,g,1,{make:'aria'}); tile(d,g,2,{video:true}); tile(d,g,3,{}); tile(d,g,4,{make:'text'}); tile(d,g,5,{img:false});
    const it=T.grokCollectLinks();
    ok('2a full: view detected', T.grokSavedViewMode()==='full');
    ok('2b full: Make video (aria / text, any case) = photo', typeOf(it,1)==='photo'&&typeOf(it,4)==='photo', `${typeOf(it,1)},${typeOf(it,4)}`);
    ok('2c full: <video> = video; rendered w/o Make video = video', typeOf(it,2)==='video'&&typeOf(it,3)==='video', `${typeOf(it,2)},${typeOf(it,3)}`);
    ok('2d full: not rendered = untyped (null)', typeOf(it,5)===null, String(typeOf(it,5)));
    const L=T.mossadDumpDebugLog().filter(e=>e.msg==='типы плиток'); ok('2e debug log has untyped count', L.length && L[L.length-1].data.untyped===1, JSON.stringify(L[L.length-1]&&L[L.length-1].data));
    w.close(); }
  // 3. lazy tile re-checked after ~500 ms
  { const {w,T}=saved(); const d=w.document; const g=d.createElement('div'); d.body.appendChild(g); T.config.collectWatchSec=5;
    tile(d,g,1,{make:'aria'}); const lazy=tile(d,g,2,{img:false});
    T.grokSaveCollection(d.getElementById('mossad-gallery-collect'));
    const coll=()=>JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection')).items;
    ok('3a lazy tile untyped at first', typeOf(coll(),2)===null, String(typeOf(coll(),2)));
    setTimeout(()=>{ const b=d.createElement('button'); b.setAttribute('aria-label','Make video'); lazy.appendChild(b); const im=d.createElement('img'); im.src='https://assets.grok.com/x/2.jpg'; lazy.querySelector('a').appendChild(im); },300);
    await sleep(1300);
    ok('3b lazy tile typed after re-check', typeOf(coll(),2)==='photo', String(typeOf(coll(),2)));
    const L=T.mossadDumpDebugLog().filter(e=>/перепроверка типов/.test(e.msg)); ok('3c re-check logged', L.length>=1, JSON.stringify(L.map(e=>e.data)));
    T.grokStopCollectWatch('test'); w.close(); }
  // 4. post page: Make video = immediate photo; never a sound/video control
  { const items=[0,1,2].map(i=>({uuid:U(i),convId:'c1'}));
    const r=load({items,cfg:{config:{slideshowDelay:0,videoLoops:1,delayAfterVideo:0}}}); const {w,T}=r; const d=w.document;
    w.__mountVideo=(uuid)=>{ const st=d.getElementById('stage'); st.innerHTML=''; w.__times=(w.__times||[]); w.__times.push(Date.now());
      const im=d.createElement('img'); im.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; st.appendChild(im);
      const b=d.createElement('button'); b.setAttribute('aria-label','Make video'); b.innerHTML='<svg class="lucide-play"></svg>'; st.appendChild(b); };
    const c=JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection')); c.items.forEach(it=>delete it.type); w.sessionStorage.setItem('mossad_grok_imagine_collection',JSON.stringify(c));
    w.__mountVideo(U(0));
    ok('4a sound finder ignores Make video', T.findGrokSoundToggleButton({includeHidden:true})===null);
    const dm=T.grokDetectSlideMedia(''); ok('4b detect: makeVideoBtn found, no video', !!dm.makeVideoBtn && !dm.video && !dm.soundBtn);
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(3000);
    const L=T.mossadDumpDebugLog().filter(e=>/фото: старт таймера/.test(e.msg));
    ok('4c Make video -> photo decided by button', L.some(e=>/Make video/.test(e.data.why)), L.map(e=>e.data.why).join(' | '));
    const t=w.__times; const g=t.slice(1).map((x,i)=>x-t[i]); ok('4d unknown type + Make video: dwell < 800 ms', g.length>=3 && g.slice(1).every(x=>x<800), `gaps=${g}`); w.close(); }
  // 5. hotkeys: layout independent
  { const items=[{uuid:U(0),convId:'c1'}]; const {w,T}=load({items}); const KE=(o)=>new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o));
    const m=T.hotkeyMatches;
    ok('5a Ctrl+B hotkey, RU (и/KeyB)', m(KE({key:'и',code:'KeyB',ctrlKey:true}),{key:'b',ctrl:true}));
    ok('5b Ctrl+/ hotkey, RU (./Slash)', m(KE({key:'.',code:'Slash',ctrlKey:true}),{key:'/',ctrl:true}));
    ok('5c hotkey recorded in RU w/o code (и) works in EN', m(KE({key:'b',code:'KeyB',ctrlKey:true}),{key:'и',ctrl:true}));
    ok('5d "." hotkey (Period) not fired by RU Slash-"." mismatch? (RU "." is a real "." key press)', m(KE({key:'.',code:'Slash'}),{key:'.'}));
    ok('5e "/" hotkey not fired by Period key', !m(KE({key:'.',code:'Period',ctrlKey:true}),{key:'/',ctrl:true}));
    ok('5f modifiers still required', !m(KE({key:'и',code:'KeyB'}),{key:'b',ctrl:true}));
    ok('5g codes: б→Comma ю→Period х→BracketLeft ё→Backquote', T.mossadCodeForKey('б')==='Comma'&&T.mossadCodeForKey('ю')==='Period'&&T.mossadCodeForKey('х')==='BracketLeft'&&T.mossadCodeForKey('ё')==='Backquote');
    // audit defaults: RU-layout event for each default key
    const RU={KeyR:'к'}; const bad=[];
    for(const [name,v] of Object.entries(T.config.hk)){ for(const hk of [].concat(v)){ if(!hk||!hk.key) continue;
      const code=hk.key.length===1?(T.mossadCodeForKey(hk.key)||''):hk.key; const key=hk.key.length===1?(RU[code]||hk.key):hk.key;
      const ev=KE({key,code:code==='Space'?'Space':(hk.key==='+'?'Equal':code),ctrlKey:!!hk.ctrl,altKey:!!hk.alt,shiftKey:!!hk.shift});
      if(!m(ev,hk)) bad.push(name+':'+hk.key); } }
    ok('5h all default hotkeys match in RU layout', bad.length===0, bad.join(','));
    // Grok layout bridge: shadcn-like site handler compares e.key
    let sb=0, sl=0, keys=[]; w.document.addEventListener('keydown',e=>{ keys.push(e.key); if((e.ctrlKey||e.metaKey)&&e.key==='b'){e.preventDefault(); sb++;} if(e.ctrlKey&&e.key==='/'){ sl++; } });
    const o1=KE({key:'и',code:'KeyB',ctrlKey:true}); w.document.body.dispatchEvent(o1);
    ok('5i bridge: RU Ctrl+B reaches site as "b" once, original default prevented', sb===1 && o1.defaultPrevented, `sb=${sb} prevented=${o1.defaultPrevented} keys=${keys}`);
    const o2=KE({key:'.',code:'Slash',ctrlKey:true}); w.document.body.dispatchEvent(o2);
    ok('5j bridge: RU Ctrl+/ reaches site as "/", not cancelled (site did not cancel)', sl===1 && !o2.defaultPrevented, `sl=${sl}`);
    keys=[]; w.document.body.dispatchEvent(KE({key:'b',code:'KeyB',ctrlKey:true}));
    ok('5k EN Ctrl+B not duplicated', sb===2 && keys.length===1, `sb=${sb} keys=${keys}`);
    keys=[]; const o3=KE({key:'с',code:'KeyC',ctrlKey:true}); w.document.body.dispatchEvent(o3);
    ok('5l RU Ctrl+C untouched (not bridged)', keys.join()==='с' && !o3.defaultPrevented, `keys=${keys}`);
    w.close(); }
  }catch(e){ console.log('ERR',e); }
  console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0);
})();
