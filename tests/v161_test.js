// v1.3.61 — Grok «\» cycle: prompt → photo/video → duration/aspect. Run: node v161_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ grokFindPromptInput, grokFindModeSwitch, grokFindDurationControl, grokFindAspectControl, grokCycleFocus, openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v161.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
function mountBar(w,{menu=false,mode='photo'}={}){ const d=w.document; const bar=d.createElement('form'); bar.id='bar';
  bar.innerHTML=`<textarea aria-label="Imagine prompt">cat</textarea>`+
   (menu?`<button id="modeTrig" aria-haspopup="menu">${mode==='video'?'Video':'Image'}</button>`
        :`<div role="radiogroup"><button role="radio" id="rImg" aria-checked="${mode==='photo'}">Image</button><button role="radio" id="rVid" aria-checked="${mode==='video'}">Video</button></div>`)+
   `<div id="params"></div>`;
  d.body.appendChild(bar);
  const params=()=>{ const cur=menu?(d.getElementById('modeTrig').textContent==='Video'?'video':'photo'):(d.getElementById('rVid').getAttribute('aria-checked')==='true'?'video':'photo');
    d.getElementById('params').innerHTML= cur==='video'
      ? `<div role="radiogroup" aria-label="Video duration"><button role="radio" id="d6" aria-checked="true">6s</button><button role="radio" id="d10" aria-checked="false">10s</button></div>`
      : `<button id="ar" aria-haspopup="menu">2:3</button>`; };
  w.__clicks=0;
  if(!menu){ ['rImg','rVid'].forEach(id=>d.getElementById(id).addEventListener('click',()=>{ w.__clicks++; d.getElementById('rImg').setAttribute('aria-checked',String(id==='rImg')); d.getElementById('rVid').setAttribute('aria-checked',String(id==='rVid')); params(); })); }
  else { d.getElementById('modeTrig').addEventListener('click',()=>{ const m=d.createElement('div'); m.setAttribute('role','menu'); m.innerHTML='<div role="menuitem">Image</div><div role="menuitem">Video</div>';
      m.querySelectorAll('[role=menuitem]').forEach(it=>it.addEventListener('click',()=>{ w.__clicks++; d.getElementById('modeTrig').textContent=it.textContent; m.remove(); params(); })); d.body.appendChild(m); }); }
  params(); return bar; }
const key=(w,t,o={})=>{ const e=new w.KeyboardEvent('keydown',Object.assign({key:'\\',code:'Backslash',bubbles:true,cancelable:true},o)); (t||w.document.activeElement||w.document.body).dispatchEvent(e); return e; };
(async()=>{ try {
 { const {w,T}=load({items,url:'https://grok.com/imagine'}); await sleep(80); const d=w.document; mountBar(w);
   ok('0a default binding \\ (Backslash)', T.config.hk.grokCycle && T.config.hk.grokCycle.key==='\\', JSON.stringify(T.config.hk.grokCycle));
   let e=key(w,d.body);
   const ta=d.querySelector('textarea');
   ok('1a press 1 from nowhere → prompt focused, caret at end', d.activeElement===ta && ta.selectionStart===3 && ta.selectionEnd===3);
   ok('1b event consumed', e.defaultPrevented);
   let seenBySite=false; ta.addEventListener('keydown',()=>{seenBySite=true;});
   e=key(w,ta);
   ok('2a press in prompt: prevented (no "\\" typed), site listener not reached', e.defaultPrevented && !seenBySite && ta.value==='cat');
   ok('2b photo→video immediately, focus on Video radio', d.getElementById('rVid').getAttribute('aria-checked')==='true' && d.activeElement===d.getElementById('rVid') && w.__clicks===1, d.activeElement&&d.activeElement.id);
   await sleep(80);
   key(w);
   ok('3a video mode → focus duration (checked 6s)', d.activeElement===d.getElementById('d6'), d.activeElement&&d.activeElement.id);
   key(w);
   ok('4a press 4 → back to prompt', d.activeElement===ta);
   key(w); await sleep(80); ok('5a again toggles video→photo', d.getElementById('rImg').getAttribute('aria-checked')==='true' && d.activeElement===d.getElementById('rImg'));
   key(w); ok('5b photo mode → focus aspect ratio', d.activeElement===d.getElementById('ar'), d.activeElement&&d.activeElement.id);
   // user clicked somewhere: focus on duration-like/aspect → next is prompt
   d.getElementById('rVid').focus(); key(w); await sleep(80);
   ok('6a focus on mode control (user) → next step = param (not toggle)', d.activeElement===d.getElementById('ar') && w.__clicks===2, d.activeElement&&d.activeElement.id);
   // RU layout + IntlBackslash
   d.body.focus(); ta.blur(); const e2=key(w,d.body,{key:'\\',code:'Backslash'}); ok('7a RU layout (key \\, code Backslash)', e2.defaultPrevented);
   const e3=key(w,d.body,{key:'|',code:'Backslash',shiftKey:true}); ok('7b Shift+\\ ( | ) not intercepted', !e3.defaultPrevented);
   const e4=key(w,d.body,{key:'\\',code:'IntlBackslash'}); ok('7c ISO IntlBackslash producing \\ also matches', e4.defaultPrevented);
   // MOSSAD own textarea: typing allowed
   const own=d.createElement('textarea'); own.id='mossad-todo-x'; d.body.appendChild(own); own.focus(); const e5=key(w,own); ok('8a MOSSAD own field: not intercepted', !e5.defaultPrevented);
   // disabled hotkey
   T.config.hk.grokCycle={key:'',ctrl:false,alt:false,shift:false}; ta.focus(); const e6=key(w,ta); ok('8b disabled → not intercepted', !e6.defaultPrevented);
   // settings row
   w.__P.openSettingsWindow('hotkeys'); await sleep(30); const row=d.querySelector('#mossad-hk-modal [data-hk="grokCycle"]');
   ok('9a settings row with Russian label', row && /промт → фото\/видео → длина\/соотношение/.test(row.textContent), row&&row.textContent);
 }
 { const {w}=load({items,url:'https://grok.com/imagine'}); await sleep(80); const d=w.document; mountBar(w,{menu:true});
   d.querySelector('textarea').focus(); key(w); await sleep(300);
   ok('10a dropdown variant: Image→Video via menu', d.getElementById('modeTrig').textContent==='Video' && w.__clicks===1, d.getElementById('modeTrig').textContent);
   await sleep(100); ok('10b focus on mode trigger', d.activeElement===d.getElementById('modeTrig'), d.activeElement&&d.activeElement.tagName);
   key(w); ok('10c → duration', d.activeElement===d.getElementById('d6')); }
 { const {w}=load({items,url:'https://www.pinterest.com/pin/1/'}); await sleep(80); const d=w.document; const ta=d.createElement('textarea'); d.body.appendChild(ta); ta.focus();
   const e=key(w,ta); ok('11a not Grok → key untouched', !e.defaultPrevented); }
 { const {w}=load({items,url:'https://grok.com/imagine'}); await sleep(80); const d=w.document; w.__toasts=[];
   new w.MutationObserver(()=>{ const t=d.getElementById('mossad-toast'); if(t) w.__toasts.push(t.textContent); }).observe(d.body,{subtree:true,childList:true,characterData:true});
   const ta=d.createElement('textarea'); d.body.appendChild(ta); ta.focus(); key(w,ta); await sleep(30);
   ok('12a (v1.3.69) no mode switch / params → silently back to prompt, no toast', d.activeElement===ta && !w.__toasts.some(t=>/⚠️/.test(t)), JSON.stringify(w.__toasts));
   ta.remove(); key(w,d.body); await sleep(500);
   ok('12b nothing available at all → one Russian toast', w.__toasts.some(t=>/не нашёл ни промт/.test(t)), JSON.stringify(w.__toasts)); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
