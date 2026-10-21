const {load,U,sleep}=require('./ss_harness');
const document_hk=(d)=>d.querySelector('#mossad-gallery-row #mossad-gallery-hk');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const key=(w,o)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)));
(async()=>{ try {
  // ---- A. Insert: collect then start ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T,navs}=load({items, url:'https://grok.com/imagine/saved'});
    const d=w.document; w.sessionStorage.removeItem('mossad_grok_imagine_collection');
    const grid=d.createElement('div'); d.body.appendChild(grid);
    const add=(i)=>{ const a=d.createElement('a'); a.href='/imagine/post/'+U(100+i); a.innerHTML='<video></video>'; grid.appendChild(a); };
    add(1); await sleep(1500);
    const count=()=>{ try{return JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection')).items.length}catch(e){return 0} };
    key(w,{key:'Insert',code:'Insert'});
    const toast=(d.getElementById('mossad-toast')||{}).textContent||'';
    ok('A1 1st Insert (no links) collects + opens watch, no start', T.grokIsCollectWatching() && count()===1 && !w._mossadGalleryActive && /ещё раз/.test(toast), `count=${count()} toast="${toast}"`);
    add(2); await sleep(1200);
    ok('A2 scrolled-in link added during watch', count()===2, `count=${count()}`);
    const n0=navs.length; key(w,{key:'Insert',code:'Insert'}); await sleep(600);
    ok('A3 2nd Insert starts slideshow + stops watch', !T.grokIsCollectWatching() && (navs.length>n0 || !!w._mossadGalleryActive), `navs=${navs.length-n0} active=${w._mossadGalleryActive}`);
    w.close(); }
  { const items=[0,1,2].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T,navs}=load({items, url:'https://grok.com/imagine/saved'});
    await sleep(1500); const n0=navs.length;
    key(w,{key:'Insert',code:'Insert'}); await sleep(600);
    ok('A4 links exist → 1st Insert starts at once', !T.grokIsCollectWatching() && (navs.length>n0 || !!w._mossadGalleryActive), `navs=${navs.length-n0}`);
    w.close(); }
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T}=load({items}); const d=w.document; w.sessionStorage.removeItem('mossad_grok_imagine_collection'); await sleep(1500);
    key(w,{key:'Insert',code:'Insert'});
    const toast=(d.getElementById('mossad-toast')||{}).textContent||'';
    ok('A5 not on Saved + no links → old hint, no watch', !T.grokIsCollectWatching() && /Сначала соберите/.test(toast), toast);
    w.close(); }
  // ---- B. playlist ----
  { const items=Array.from({length:60},(_,i)=>({uuid:U(i),convId:'c'+i}));
    const {w,T}=load({items}); const d=w.document; await sleep(1500);
    const RH=14, HH=30;
    const orig=w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect=function(){
      if(this.classList&&this.classList.contains('mossad-playlist-item')) return {top:0,left:0,right:200,bottom:RH-1,width:200,height:RH-1};
      if(this.id==='mossad-playlist-panel'){ const W=parseFloat(this.style.width)||300, H=parseFloat(this.style.height)||500; return {top:100,left:100,right:100+W,bottom:100+H,width:W,height:H}; }
      if(this.parentNode&&this.parentNode.id==='mossad-playlist-panel'&&this===this.parentNode.firstElementChild) return {top:0,left:0,right:0,bottom:HH,width:200,height:HH};
      if(this.id==='mossad-widget-container') return {top:50,left:100,right:400,bottom:700,width:300,height:650};
      return orig.call(this); };
    Object.defineProperty(w.HTMLElement.prototype,'scrollHeight',{get(){return this.classList&&this.classList.contains('mossad-playlist-body')?60*RH:0},configurable:true});
    w.localStorage.removeItem('mossad_playlist_height'); w.localStorage.removeItem('mossad_playlist_width'); T.config.playlistWidth=0;
    const pl0=d.getElementById('mossad-playlist-panel'); if(pl0) pl0.remove();
    T.grokTogglePlaylistPanel(true);
    const pl=d.getElementById('mossad-playlist-panel');
    const expH=HH+4+30*RH+2;
    ok('B1 opens at 30 rows (default)', pl && pl.style.height===expH+'px' && pl.style.width==='100%', `h=${pl&&pl.style.height} exp=${expH} w=${pl&&pl.style.width}`);
    ok('B2 no CSS resize grip; body scrolls', !/resize:\s*both/.test(pl.style.cssText) && pl.querySelector('.mossad-playlist-body').style.overflowY==='auto');
    const hdr=pl.firstElementChild, kids=[...hdr.children]; const iR=kids.findIndex(k=>k.id==='mossad-playlist-reset-size');
    ok('B3 ⤢ between A+ group and ×', iR>0 && kids[iR+1].textContent==='×' && kids.slice(0,iR).some(k=>/A\+/.test(k.textContent)), kids.map(k=>k.textContent).join('|'));
    const ev=(t,x,y,el)=>(el||pl).dispatchEvent(new w.MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0}));
    // hover right edge → cursor
    const r=pl.getBoundingClientRect(); ev('mousemove', r.right-2, r.top+100);
    ok('B4 hover edge sets resize cursor', pl.dataset.edge==='e', pl.dataset.edge);
    ev('mousedown', r.right-2, r.top+100); ev('mousemove', r.right+48, r.top+100, d); ev('mouseup', r.right+48, r.top+100, d);
    ok('B5 drag right edge → width persisted', w.localStorage.getItem('mossad_playlist_width')===String(Math.round(r.width+50)) && T.config.playlistWidth===Math.round(r.width+50), `ls=${w.localStorage.getItem('mossad_playlist_width')}`);
    const c=d.getElementById('mossad-widget-container'); const r2=pl.getBoundingClientRect();
    ev('mousedown', r2.left+2, r2.top+2); ev('mousemove', r2.left-18, r2.top-28, d); ev('mouseup', r2.left-18, r2.top-28, d);
    ok('B6 drag top-left corner → w/h grow, widget shifts, height persisted', parseFloat(pl.style.width)===Math.round(r2.width+20) && parseFloat(pl.style.height)===Math.round(r2.height+30) && c.style.left==='80px' && c.style.top==='20px' && w.localStorage.getItem('mossad_playlist_height')===String(Math.round(r2.height+30)), `w=${pl.style.width} h=${pl.style.height} L=${c.style.left} T=${c.style.top}`);
    ev('mousemove', r2.left+50, r2.top+80); ok('B7 inside → no edge', !pl.dataset.edge);
    T.config.playlistRows=10;
    hdr.querySelector('span').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
    const exp10=HH+4+10*RH+2;
    ok('B8 dblclick title → N rows (F1) + default width, storage cleared', pl.style.height===exp10+'px' && pl.style.width==='100%' && !w.localStorage.getItem('mossad_playlist_width') && !w.localStorage.getItem('mossad_playlist_height') && T.config.playlistWidth===0, `h=${pl.style.height} exp=${exp10} w=${pl.style.width}`);
    pl.style.width='500px'; pl.style.height='200px'; pl.dataset.autoHeight='0'; T.config.playlistRows=30;
    d.getElementById('mossad-playlist-reset-size').click();
    ok('B9 ⤢ button → same reset (30 rows)', pl.style.height===expH+'px' && pl.style.width==='100%', pl.style.height);
    // reopen keeps manual size
    w.localStorage.setItem('mossad_playlist_height','333'); pl.remove(); T.grokTogglePlaylistPanel(true);
    ok('B10 reopen honours saved manual height', d.getElementById('mossad-playlist-panel').style.height==='333px');
    w.close(); }
  // ---- C. settings window + bar ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items}); const d=w.document; await sleep(1500);
    const tb=d.getElementById('mossad-top-bar'); const kids=[...tb.children];
    const iU=kids.findIndex(k=>k.innerHTML==='🔄'), iH=kids.findIndex(k=>k.id==='mossad-btn-hk-settings');
    ok('C1 (v1.3.41) ⌨ back in top row, not in 2nd bar', iU>=0 && iH===-1 && !!document_hk(d), kids.map(k=>k.id||k.innerHTML).join('|'));
    const row=d.getElementById('mossad-gallery-row');
    ok('C2 top row: no 6s/10s, × last', row && !d.getElementById('mossad-grok-vid6') && !d.getElementById('mossad-grok-vid10') && !/\b(6s|10s)\b/.test(row.textContent) && row.lastElementChild.id==='mossad-btn-close', row&&[...row.children].map(k=>k.textContent).join('|'));
    ok('C3 no videoGen hotkeys / functions', !('videoGen6s' in T.config.hk) && !('videoGen10s' in T.config.hk) && typeof w.triggerGrokVideoGeneration==='undefined' && typeof w.grokNavigateToSaved==='function');
    d.getElementById('mossad-gallery-hk').click();
    let m=d.getElementById('mossad-hk-modal');
    const vis=(p)=>m.querySelector(`[data-pane="${p}"]`).style.display!=='none';
    ok('C4 ⌨ opens window on Hotkeys tab', m && m.dataset.tab==='hotkeys' && vis('hotkeys') && !vis('general') && m.querySelectorAll('#mossad-hk-list > *').length>10 && !m.textContent.includes('Видео 6с'));
    ok('C5 centered', m.style.top==='50%' && m.style.left==='50%' && /translate\(-50%,\s*-50%\)/.test(m.style.transform));
    m.querySelector('[data-tab="general"]').click();
    ok('C6 tab switch → General (GitHub, checkboxes, rows input)', m.dataset.tab==='general' && vis('general') && !vis('hotkeys') && !!m.querySelector('[data-pane="general"] #mossad-gh-token') && !!m.querySelector('[data-pane="general"] #mossad-playlist-rows'));
    const inp=m.querySelector('#mossad-playlist-rows'); inp.value='42'; inp.dispatchEvent(new w.Event('change'));
    ok('C7 rows setting saved', T.config.playlistRows===42);
    d.getElementById('mossad-gallery-hk').click();
    ok('C8 ⌨ while open on General → switches to Hotkeys', d.getElementById('mossad-hk-modal') && d.getElementById('mossad-hk-modal').dataset.tab==='hotkeys');
    d.getElementById('mossad-gallery-hk').click();
    ok('C9 ⌨ again → closes', !d.getElementById('mossad-hk-modal'));
    key(w,{key:'F1',code:'F1',ctrlKey:true}); m=d.getElementById('mossad-hk-modal');
    ok('C10 Ctrl+F1 opens Hotkeys tab', m && m.dataset.tab==='hotkeys');
    key(w,{key:'F1',code:'F1',ctrlKey:true});
    ok('C11 Ctrl+F1 closes', !d.getElementById('mossad-hk-modal'));
    // Ctrl+Shift+Insert assigned to help slot 2 still works
    T.config.hk.help=[T.config.hk.help, {key:'Insert',ctrl:true,alt:false,shift:true}];
    key(w,{key:'Insert',code:'Insert',ctrlKey:true,shiftKey:true});
    ok('C12 Ctrl+Shift+Insert (help slot) opens window', !!d.getElementById('mossad-hk-modal'));
    key(w,{key:'Escape',code:'Escape'}); ok('C13 Esc closes', !d.getElementById('mossad-hk-modal'));
    let threw=false; try { key(w,{key:'Escape',code:'Escape'}); } catch(e){threw=true}
    d.getElementById('mossad-btn-toggle-panel').click(); await sleep(300); const btnSet=d.getElementById('mossad-btn-hk'); btnSet.click(); m=d.getElementById('mossad-hk-modal');
    ok('C14 ⚙ Настройки (panel) opens last tab (v1.3.45)', m && m.dataset.tab==='hotkeys' && !threw);
    m.querySelector('#mossad-hk-close').click(); ok('C15 Закрыть closes', !d.getElementById('mossad-hk-modal'));
    w.close(); }
 } catch(e){ console.log('EXC',e.stack); res.push(false); }
 console.log(`${res.filter(Boolean).length}/${res.length}`); process.exit(0); })();
