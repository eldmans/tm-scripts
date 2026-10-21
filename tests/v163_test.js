// v1.3.63 — per-site hotkeys (sections, drag, ⤒/⤓ ceilings). Run: node v163_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ openSettingsWindow, closeSettingsWindow, mossadHkSiteKeys, mossadHkGlobalTable, mossadHkSetSite, Settings, hotkeyMatches };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v163.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const L=(w)=>w.document.querySelector('#mossad-hk-modal #mossad-hk-list');
const secs=(w)=>{ const o={site:[],global:[]}; let past=false; [...L(w).children].forEach(el=>{ if(el.classList.contains('mossad-hk-sep')){past=true;return;} if(el.dataset.hk) o[past?'global':'site'].push(el.dataset.hk); }); return o; };
const row=(w,k)=>L(w).querySelector(`[data-hk="${k}"]`);
const up=(w,k)=>row(w,k).querySelector('.mossad-hk-top').click();
const dn=(w,k)=>row(w,k).querySelector('.mossad-hk-bottom').click();
const siteGm=(w)=>JSON.parse(w.__gm.mossad_hk_site||'{}');
const glob=(w)=>JSON.parse(w.__gm.mossad_hk_global||'{}');
const capture=async(w,k,ev)=>{ row(w,k).querySelector('.mossad-hk-key').click(); await sleep(10); w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},ev))); await sleep(20); };
(async()=>{ try {
 // ---- 1. defaults: Grok → grokCycle site-specific; sections rendered ----
 { const {w,T}=load({items,url:'https://grok.com/imagine',seedSiteHk:true}); await sleep(80); const P=w.__P;
   ok('1a Grok seeds grokCycle as site-specific', JSON.stringify(P.mossadHkSiteKeys())==='["grokCycle"]' && siteGm(w)['grok.com'].hk.grokCycle.key==='\\', w.__gm.mossad_hk_site);
   P.openSettingsWindow('hotkeys'); await sleep(30);
   const h=L(w).querySelector('.mossad-hk-sec-site'), sep=L(w).querySelector('.mossad-hk-sep');
   ok('1b header «Только для этого сайта (grok.com)», separator «Общие для всех сайтов»', /Только для этого сайта \(grok\.com\)/.test(h.textContent) && /Общие для всех сайтов/.test(sep.textContent));
   const s=secs(w); ok('1c site section = [grokCycle], global has the rest', s.site.join()==='grokCycle' && s.global.includes('sound') && !s.global.includes('grokCycle'), JSON.stringify(s));
   // ---- 2. ⤒/⤓ ceilings ----
   const g0=secs(w).global; const k5=g0[5];
   up(w,k5); ok('2a ⤒ in global (not top) → top of global (under separator)', secs(w).global[0]===k5 && secs(w).site.join()==='grokCycle');
   up(w,k5); ok('2b ⤒ at top of global → END of site section (site-specific)', secs(w).site.join()===['grokCycle',k5].join() && P.mossadHkSiteKeys().includes(k5), JSON.stringify(secs(w)));
   up(w,k5); ok('2c ⤒ in site (not first) → START of site', secs(w).site[0]===k5);
   up(w,k5); ok('2d ⤒ at start of site → stays', secs(w).site[0]===k5 && secs(w).site.length===2);
   dn(w,k5); ok('2e ⤓ in site (not last) → END of site', secs(w).site.join()===['grokCycle',k5].join());
   dn(w,k5); ok('2f ⤓ last in site → START of global (global again)', secs(w).global[0]===k5 && !P.mossadHkSiteKeys().includes(k5) && secs(w).site.join()==='grokCycle');
   dn(w,k5); const gl=secs(w).global; ok('2g ⤓ in global (not last) → END of global', gl[gl.length-1]===k5);
   dn(w,k5); ok('2h ⤓ at end of global → stays', secs(w).global[secs(w).global.length-1]===k5);
   // order persistence across reopen
   up(w,'grokCycle'); // site has only grokCycle at start -> stays
   dn(w,'grokCycle'); ok('2i grokCycle ⤓ → global start', secs(w).global[0]==='grokCycle' && secs(w).site.length===0);
   ok('2j empty site section shows hint', /Перетащите сюда/.test(L(w).querySelector('.mossad-hk-sec-site').textContent));
   up(w,'grokCycle'); up(w,'sound'); up(w,'sound'); up(w,'download'); up(w,'download'); up(w,'download'); // site: grokCycle, sound, download → download to start
   const snap=JSON.stringify(secs(w)); P.closeSettingsWindow(true); P.openSettingsWindow('hotkeys'); await sleep(20);
   ok('2k order within sections persists after reopen', JSON.stringify(secs(w))===snap && secs(w).site[0]==='download', snap+' vs '+JSON.stringify(secs(w)));
 }
 // ---- 3. site override binding vs global ----
 { const {w,T}=load({items,url:'https://grok.com/imagine',seedSiteHk:true}); await sleep(80); const P=w.__P; P.openSettingsWindow('hotkeys'); await sleep(20);
   up(w,'sound'); const g=secs(w).global; up(w,'sound'); // to top then to site
   ok('3a sound now site-specific, initialized from global (ScrollLock)', P.mossadHkSiteKeys().includes('sound') && siteGm(w)['grok.com'].hk.sound.key==='ScrollLock');
   await capture(w,'sound',{key:'F9',code:'F9'});
   ok('3b assigning F9 changes site binding only; global stays ScrollLock', T.config.hk.sound.key==='F9' && siteGm(w)['grok.com'].hk.sound.key==='F9' && glob(w).sound.key==='ScrollLock', JSON.stringify([T.config.hk.sound,glob(w).sound]));
   const e=new w.KeyboardEvent('keydown',{key:'F9',code:'F9'}); ok('3c resolution: site override used', P.hotkeyMatches(e,T.config.hk.sound));
   // conflict check uses effective keys: assign ScrollLock to snapWidget → no conflict (sound effective is F9 here)
   await capture(w,'snapWidget',{key:'ScrollLock',code:'ScrollLock'});
   ok('3d conflict check uses effective (site) keys: ScrollLock free here', !row(w,'snapWidget').querySelector('.mossad-hk-conflict') && T.config.hk.snapWidget.key==='ScrollLock');
   await capture(w,'playPause',{key:'F9',code:'F9'});
   ok('3e F9 (site override of sound) reported as taken', !!row(w,'playPause').querySelector('.mossad-hk-conflict'));
   row(w,'playPause').querySelector('.mossad-hk-no').click(); await sleep(10);
   // move back to global → binding becomes the global value again
   const s=secs(w); for(let i=0;i<5 && P.mossadHkSiteKeys().includes('sound');i++) dn(w,'sound');
   ok('3f back to global → override dropped, global value (ScrollLock) restored', !P.mossadHkSiteKeys().includes('sound') && T.config.hk.sound.key==='ScrollLock' && !siteGm(w)['grok.com'].hk.sound);
   ok('3g duplicates painted with effective keys (ScrollLock now on sound+snapWidget)', row(w,'sound').dataset.dup==='1' && row(w,'snapWidget').dataset.dup==='1'); }
 // ---- 4. other site sees global; Pinterest seed ----
 { const pre={mossad_hk_site:JSON.stringify({'grok.com':{hk:{grokCycle:{key:'\\',ctrl:false,alt:false,shift:false},sound:{key:'F9',ctrl:false,alt:false,shift:false}},order:['grokCycle','sound']}}),
              mossad_hk_global:JSON.stringify({sound:{key:'ScrollLock',ctrl:false,alt:false,shift:false}})};
   const {w,T}=load({items,url:'https://ru.pinterest.com/pin/1/',preGm:pre}); await sleep(80); const P=w.__P;
   ok('4a Pinterest: global sound (ScrollLock), not Grok override', T.config.hk.sound.key==='ScrollLock');
   ok('4b Pinterest seeds pinFullScale as site-specific', JSON.stringify(P.mossadHkSiteKeys())==='["pinFullScale"]' && siteGm(w)['grok.com'].hk.sound.key==='F9');
   P.Settings.save(); ok('4c saving on Pinterest keeps global sound', glob(w).sound.key==='ScrollLock' && siteGm(w)['grok.com'].hk.sound.key==='F9'); }
 // ---- 5. Grok load with override: effective + global table ----
 { const pre={mossad_hk_site:JSON.stringify({'grok.com':{hk:{sound:{key:'F9',ctrl:false,alt:false,shift:false}},order:['sound']}})};
   const {w,T}=load({items,url:'https://grok.com/imagine',preGm:pre}); await sleep(80); const P=w.__P;
   ok('5a override applied at load', T.config.hk.sound.key==='F9');
   ok('5b no re-seed when entry exists (grokCycle stays global)', !P.mossadHkSiteKeys().includes('grokCycle'));
   ok('5c global table keeps default ScrollLock', P.mossadHkGlobalTable().sound.key==='ScrollLock');
   w.dispatchEvent(new w.Event('focus')); ok('5d focus re-sync keeps override', T.config.hk.sound.key==='F9'); }
 // ---- 6. drag across separator ----
 { const {w,T}=load({items,url:'https://grok.com/imagine',seedSiteHk:true}); await sleep(80); const P=w.__P; P.openSettingsWindow('hotkeys'); await sleep(20);
   const list=L(w); const stub=()=>[...list.children].forEach(el=>{ el.getBoundingClientRect=()=>{ const i=[...list.children].indexOf(el); return {top:i*40,bottom:i*40+40,height:40,left:0,right:300,width:300}; }; });
   const PE=(t,target,y)=>{ const C=w.PointerEvent||w.MouseEvent; target.dispatchEvent(new C(t,{bubbles:true,cancelable:true,clientX:10,clientY:y,button:0})); };
   // children: [siteHead, grokCycle, sep, ...global]; drag 'download' to y=50 (into site, after grokCycle? before sep)
   stub(); const idx=[...list.children].indexOf(row(w,'download')); PE('pointerdown',row(w,'download').querySelector('.mossad-hk-handle'),idx*40+20);
   PE('pointermove',w.document,idx*40+10); stub(); PE('pointermove',w.document,60); stub(); PE('pointermove',w.document,60); PE('pointerup',w.document,60);
   ok('6a drag above separator → site-specific', P.mossadHkSiteKeys().includes('download') && secs(w).site.includes('download'), JSON.stringify(secs(w)));
   stub(); const i2=[...list.children].indexOf(row(w,'download')); PE('pointerdown',row(w,'download').querySelector('.mossad-hk-handle'),i2*40+20);
   PE('pointermove',w.document,i2*40+30); stub(); PE('pointermove',w.document,400); stub(); PE('pointermove',w.document,400); PE('pointerup',w.document,400);
   ok('6b drag below separator → global again', !P.mossadHkSiteKeys().includes('download') && secs(w).global.includes('download'), JSON.stringify(secs(w))); }
 // ---- 7. pinFullScale hotkey ----
 { const {w,T}=load({items,url:'https://ru.pinterest.com/pin/1/'}); await sleep(80); const d=w.document;
   d.body.insertAdjacentHTML('beforeend','<div data-test-id="closeup-body"><button aria-label="Показать в полном масштабе" id="fsb">x</button></div>'); let c=0; d.getElementById('fsb').addEventListener('click',()=>c++);
   T.config.hk.pinFullScale={key:'F2',ctrl:false,alt:false,shift:false};
   d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'F2',code:'F2',bubbles:true,cancelable:true})); await sleep(20);
   ok('7a pinFullScale presses main pin «Показать в полном масштабе»', c===1, c); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
