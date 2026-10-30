// v1.3.72 — «Кнопки скачивания работают даже в поле промпта»: галочка + список хоткеев, «?» — выбор кликами. Run: node v172_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`triggerDownload=function(){ window.__dl=(window.__dl||0)+1; };\nwindow.__P={ openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v172.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 const {w,T}=load({items}); await sleep(80); const d=w.document; const C=T.config;
 ok('0 defaults: on, list = download', C.promptHotkeysOn===true && C.promptHotkeys==='download');
 const ta=d.createElement('textarea'); d.body.appendChild(ta); ta.focus();
 const kd=(key,code,o={})=>{ const e=new w.KeyboardEvent('keydown',Object.assign({key,code,bubbles:true,cancelable:true},o)); ta.dispatchEvent(e); return e; };
 C.hk.download={key:'PageDown',code:'PageDown',ctrl:false,alt:false,shift:false};
 w.__dl=0; let e=kd('PageDown','PageDown');
 ok('1a in prompt field: download hotkey works (and default prevented)', w.__dl===1 && e.defaultPrevented, String(w.__dl));
 C.promptHotkeysOn=false; w.__dl=0; kd('PageDown','PageDown');
 ok('1b checkbox off → old behaviour (ignored in field)', w.__dl===0);
 C.promptHotkeysOn=true; C.promptHotkeys='upscale'; w.__dl=0; kd('PageDown','PageDown');
 ok('1c download not in list → ignored in field', w.__dl===0);
 C.promptHotkeys='download'; C.hk.download={key:'d',code:'KeyD',ctrl:false,alt:false,shift:false}; w.__dl=0; kd('d','KeyD');
 ok('1d letter hotkey in list works in field', w.__dl===1);
 C.hk.download={key:'PageDown',code:'PageDown',ctrl:false,alt:false,shift:false}; w.__dl=0; kd('x','KeyX');
 ok('1e other typing keys untouched', w.__dl===0);
 ta.blur(); w.__dl=0; d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'PageDown',code:'PageDown',bubbles:true,cancelable:true}));
 ok('1f outside fields works as before', w.__dl===1);
 // settings UI
 w.__P.openSettingsWindow('general'); await sleep(20); const m=d.getElementById('mossad-hk-modal');
 const cb=m.querySelector('#mossad-gen-prompthk-on'), inp=m.querySelector('#mossad-gen-prompthk');
 ok('2a checkbox + text field in «Общие» with label', cb && cb.checked && inp && inp.value==='download' && /Кнопки скачивания работают даже в поле промпта/.test(cb.parentNode.textContent));
 const nok=m.querySelector('#mossad-gen-nokeys');
 ok('2b placed right under «Клавиши, которые не кидают в промт» (grok)', nok && nok.parentNode.nextElementSibling===cb.closest('[title]'));
 m.querySelector('#mossad-gen-prompthk-help').click(); await sleep(5);
 const box=d.getElementById('mossad-key-help');
 ok('2c «?» popup lists hotkeys', box && box.querySelector('[data-kh-ins="upscale"]') && box.querySelector('[data-kh-ins="download"]') && /Хоткеи/.test(box.textContent));
 box.querySelector('[data-kh-ins="upscale"]').click(); box.querySelector('[data-kh-ins="upscale"]').click(); box.querySelector('[data-kh-ins="download"]').click();
 ok('2d click appends with comma, no duplicates; config updated', inp.value==='download, upscale' && C.promptHotkeys==='download, upscale', inp.value);
 cb.click();
 ok('2e checkbox toggles config', C.promptHotkeysOn===false);
 inp.value='download,,history  sound'; inp.dispatchEvent(new w.Event('change'));
 ok('2f manual edit normalized to comma list', C.promptHotkeys==='download, history, sound', C.promptHotkeys);
 // old «?» for nokeys still appends raw tokens
 m.querySelector('#mossad-gen-nokeys-help').click(); await sleep(5); const b2=d.getElementById('mossad-key-help'); const v0=nok.value; b2.querySelector('[data-kh-ins="{Enter}"]').click();
 ok('3 nokeys «?» unchanged (appends token without separator)', nok.value===v0+'{Enter}');
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
