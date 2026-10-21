// v1.3.60 — hotkey conflict prevention. Run: node v160_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ openSettingsWindow, closeSettingsWindow, hotkeyComboId, normalizeHotkeyBinding, Settings };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v160.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const row=(w,k)=>w.document.querySelector(`#mossad-hk-modal [data-hk="${k}"]`);
const capture=async(w,k,ev)=>{ row(w,k).querySelector('.mossad-hk-key').click(); await sleep(10); w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},ev))); await sleep(20); };
const hk=(T,k)=>T.config.hk[k]&&T.config.hk[k].key||'';
(async()=>{ try {
 // ---- 1. combo id mirrors hotkeyMatches ----
 { const {w}=load({items}); await sleep(100); const P=w.__P;
   ok('1a RU letter and Latin letter with same code = same combo', P.hotkeyComboId({key:'b',ctrl:true})===P.hotkeyComboId({key:'и',code:'KeyB',ctrl:true}));
   ok('1b modifiers matter', P.hotkeyComboId({key:'b',ctrl:true})!==P.hotkeyComboId({key:'b',ctrl:true,shift:true}));
   ok('1c + main row = numpad +', P.hotkeyComboId({key:'+',code:'Equal'})===P.hotkeyComboId({key:'+',code:'NumpadAdd'}));
   ok('1d empty binding has no combo', P.hotkeyComboId({key:''})===''); }
 // ---- 2. assigning a taken combo → inline confirm ----
 { const {w,T}=load({items}); await sleep(100); w.__P.openSettingsWindow(); await sleep(50);
   await capture(w,'snapWidget',{key:'Pause',code:'Pause'});
   const box=row(w,'snapWidget').querySelector('.mossad-hk-conflict');
   ok('2a conflict warning names the other action, nothing saved yet', box && /Эта клавиша уже занята:/.test(box.textContent) && /Переназначить\?/.test(box.textContent) && hk(T,'snapWidget')==='F8' && hk(T,'playPause')==='Pause', box&&box.textContent);
   box.querySelector('.mossad-hk-no').click(); await sleep(10);
   ok('2b Отмена → reverted, both unchanged', !row(w,'snapWidget').querySelector('.mossad-hk-conflict') && hk(T,'snapWidget')==='F8' && hk(T,'playPause')==='Pause' && row(w,'snapWidget').querySelector('.mossad-hk-key').textContent==='F8', row(w,'snapWidget').querySelector('.mossad-hk-key').textContent);
   await capture(w,'snapWidget',{key:'Pause',code:'Pause'});
   row(w,'snapWidget').querySelector('.mossad-hk-yes').click(); await sleep(20);
   ok('2c Да → this action gets the key, the other is cleared, saved', hk(T,'snapWidget')==='Pause' && hk(T,'playPause')==='' && /Pause/.test(row(w,'snapWidget').querySelector('.mossad-hk-key').textContent), hk(T,'snapWidget')+'/'+hk(T,'playPause'));
   const ls=JSON.parse(w.localStorage.getItem('mossad_grok_com_config')||'{}');
   ok('2d persisted', ls.hk && ls.hk.snapWidget && ls.hk.snapWidget.key==='Pause' && !(ls.hk.playPause&&ls.hk.playPause.key), JSON.stringify(ls.hk&&[ls.hk.snapWidget,ls.hk.playPause]));
   await capture(w,'playPause',{key:'F9',code:'F9'});
   ok('2e free key → saved directly, no warning', hk(T,'playPause')==='F9' && !row(w,'playPause').querySelector('.mossad-hk-conflict')); }
 // ---- 3. pinned conflicting row: still warn, confirm clears it ----
 { const {w,T}=load({items,preGm:{mossad_hk_pinned:JSON.stringify(['playPause'])}}); await sleep(100); w.__P.openSettingsWindow(); await sleep(50);
   await capture(w,'snapWidget',{key:'Pause',code:'Pause'});
   const box=row(w,'snapWidget').querySelector('.mossad-hk-conflict'); ok('3a pinned row still reported', !!box);
   box.querySelector('.mossad-hk-yes').click(); await sleep(20);
   ok('3b confirm clears the pinned row key (pin = order only)', hk(T,'playPause')==='' && hk(T,'snapWidget')==='Pause'); }
 // ---- 4. RU layout physical match ----
 { const {w,T}=load({items}); await sleep(100); T.config.hk.openTodos={key:'b',ctrl:true,alt:false,shift:false}; w.__P.openSettingsWindow(); await sleep(50);
   await capture(w,'snapWidget',{key:'и',code:'KeyB',ctrlKey:true});
   ok('4a Ctrl+И (RU) conflicts with Ctrl+B', !!row(w,'snapWidget').querySelector('.mossad-hk-conflict')); }
 // ---- 5. existing duplicates highlighted, not auto-cleared ----
 { const {w,T}=load({items}); await sleep(100); T.config.hk.snapWidget={key:'Pause',ctrl:false,alt:false,shift:false}; w.__P.openSettingsWindow(); await sleep(50);
   const a=row(w,'snapWidget').querySelector('.mossad-hk-key'), b=row(w,'playPause').querySelector('.mossad-hk-key');
   ok('5a both duplicate rows red with hint naming the other', /ef4444/.test(a.style.outline+a.style.outlineColor)||a.style.outline.includes('rgb(239, 68, 68)') , a.style.outline);
   ok('5b hint text', /Дубликат/.test(a.title) && b.title.length>0, a.title);
   ok('5c not auto-cleared', hk(T,'snapWidget')==='Pause' && hk(T,'playPause')==='Pause'); }
 // ---- 6. reset keys never creates duplicates ----
 { const {w,T}=load({items,preGm:{mossad_hk_pinned:JSON.stringify(['playPause'])}}); await sleep(100);
   T.config.hk.playPause={key:'F8',ctrl:false,alt:false,shift:false}; T.config.hk.snapWidget={key:'F2',ctrl:false,alt:false,shift:false};
   w.confirm=()=>true; w.__P.openSettingsWindow(); await sleep(50);
   w.document.getElementById('mossad-hk-reset').click(); await sleep(50);
   const ids=Object.keys(T.config.hk).map(k=>w.__P.hotkeyComboId(T.config.hk[k])).filter(Boolean);
   ok('6a pinned keeps F8; reset snapWidget (default F8) cleared instead of duplicating', hk(T,'playPause')==='F8' && hk(T,'snapWidget')==='', hk(T,'playPause')+'/'+hk(T,'snapWidget'));
   ok('6b no duplicate combos after reset', new Set(ids).size===ids.length, JSON.stringify(ids)); }
 // ---- 7. per-row ↺ uses the same check ----
 { const {w,T}=load({items}); await sleep(100); T.config.hk.playPause={key:'F8',ctrl:false,alt:false,shift:false}; T.config.hk.snapWidget={key:'F2',ctrl:false,alt:false,shift:false};
   w.__P.openSettingsWindow(); await sleep(50);
   row(w,'snapWidget').querySelector('.mossad-hk-key-reset').click(); await sleep(20);
   ok('7a ↺ to a default that is taken → warning, not silently duplicated', !!row(w,'snapWidget').querySelector('.mossad-hk-conflict') && hk(T,'snapWidget')==='F2'); }
 // ---- 8. Pinterest pin-jump interplay ----
 { const {w,T}=load({items,url:'https://www.pinterest.com/pin/1/',cfg:{config:{pinterestJumpKeys:'focus'}}}); await sleep(100); w.__P.openSettingsWindow(); await sleep(50);
   w.__toasts=[]; new w.MutationObserver(()=>{ const t=w.document.getElementById('mossad-toast'); if(t) w.__toasts.push(t.textContent); }).observe(w.document.body,{subtree:true,childList:true,characterData:true});
   await capture(w,'openTodos',{key:'g',code:'KeyG'}); await sleep(30);
   ok('8a assigning a pin-jump key on Pinterest: saved + note that pin keys skip it', hk(T,'openTodos')==='g' && w.__toasts.some(t=>/пропущена/.test(t)), JSON.stringify(w.__toasts)); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
