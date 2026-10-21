const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
(async()=>{ try {
  // ---- 1. collect watch window ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {w,T}=load({items, url:'https://grok.com/imagine/saved'});
    w.sessionStorage.removeItem('mossad_grok_imagine_collection');
    const d=w.document; const grid=d.createElement('div'); d.body.appendChild(grid);
    const add=(i)=>{ const a=d.createElement('a'); a.href='/imagine/post/'+U(100+i); a.innerHTML='<video></video>'; grid.appendChild(a); };
    add(1); add(2);
    const count=()=>{ try{return JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection')).items.length}catch(e){return 0} };
    await sleep(2500);
    ok('1a no auto start before click', count()===0, `items=${count()}`);
    T.config.collectWatchSec=5;
    T.grokSaveCollection(d.getElementById("mossad-gallery-collect"));
    ok('1b click collects visible', count()===2, `items=${count()}`);
    const ind=()=>(d.getElementById('mossad-collect-watch')||{}).textContent||'';
    add(3); add(4); await sleep(1200);
    ok('1c scrolled-in links picked up during window', count()===4, `items=${count()} indicator="${ind()}"`);
    await sleep(5000); add(5); await sleep(1500);
    ok('1d window closed after timeout (no more pickup)', count()===4 && !ind(), `items=${count()} indicator="${ind()}"`);
    T.grokSaveCollection(d.getElementById("mossad-gallery-collect")); // reopen
    add(6); await sleep(800);
    w._mossadGalleryActive=true; await sleep(1300); add(7); await sleep(1200);
    ok('1e window closes when slideshow starts', !ind() && count()===6, `items=${count()} (#7 must not be added)`);
    w.close(); }
  // ---- 2. sound toast ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items});
    const d=w.document; T.showSoundToast("🔊 Звук включен");
    let t=d.getElementById('mossad-sound-toast'); ok('2a sound toast shown with ×', !!t && t.querySelector('button').textContent==='×');
    t.querySelector('button').click(); await sleep(400);
    ok('2b × closes current toast', !d.getElementById('mossad-sound-toast'));
    T.showSoundToast("🔇 Звук выключен"); ok('2c next toggle shows toast again (nothing persisted)', !!d.getElementById('mossad-sound-toast'));
    T.config.showSoundToast=false; d.getElementById('mossad-sound-toast').remove(); T.showSoundToast("x");
    ok('2d F1 off -> no toast', !d.getElementById('mossad-sound-toast')); w.close(); }
  // ---- 3. upscale hotkey ----
  { const items=[0].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items});
    const m=(o)=>T.hotkeyMatches(o, T.config.hk.upscale);
    ok('3a default = Shift+«+»', T.formatHotkey(T.config.hk.upscale)==='Shift+«+»', T.formatHotkey(T.config.hk.upscale));
    ok('3b Shift+Equal (US "+")', m({key:'+',code:'Equal',shiftKey:true}));
    ok('3c Shift+NumpadAdd', m({key:'+',code:'NumpadAdd',shiftKey:true}));
    ok('3d Shift+Equal other layout (key "`")', m({key:'`',code:'Equal',shiftKey:true}));
    ok('3e Ctrl+PageUp no longer upscale', !m({key:'PageUp',code:'PageUp',ctrlKey:true}));
    ok('3f plain "=" not upscale', !m({key:'=',code:'Equal'}));
    w.close(); }
  // migration: old default stored -> migrated once; custom kept
  for (const [name, stored, expect] of [
     ['old default object', {key:'PageUp',ctrl:true,alt:false,shift:false}, 'Shift+«+»'],
     ['old default slot array', [{key:'PageUp',ctrl:true,alt:false,shift:false}, null], 'Shift+«+»'],
     ['custom Alt+U', {key:'u',ctrl:false,alt:true,shift:false}, 'Alt+u']]) {
    const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
    const {JSDOM}=require('jsdom'); // reuse harness by pre-seeding GM before eval
    const h=require('./ss_harness'); const orig=h.load;
    const r=orig({items, preGm:{'mossad_hk_global':JSON.stringify({upscale:stored})}});
    const got=(u=>r.T.formatHotkey(Array.isArray(u)?u.find(Boolean):u))(r.T.config.hk.upscale);
    const flag=r.w.__gm['mossad_mig_upscale_v1339'];
    ok(`3g migration: ${name}`, got===expect && flag===true, `got=${got} flag=${flag} gm=${(r.w.__gm['mossad_hk_global']||'').slice(0,70)}`); r.w.close(); }
  } catch(e){ console.log('EXC',e.stack); }
  console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0);
})();
