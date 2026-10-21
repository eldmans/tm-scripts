// v1.3.64 — Grok «клавиши, которые не кидают в промт». Run: node v164_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ mossadParseKeyList, grokNoPromptKeyMatch, openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v164.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
// Модель Grok: «стелер фокуса» на document (bubble) / window (bubble) / корне React (#root, bubble)
function grokPage(w,where){ const d=w.document; const root=d.createElement('div'); root.id='root'; root.innerHTML='<textarea id="prompt"></textarea><button id="btn">b</button>'; d.body.appendChild(root);
  const ta=d.getElementById('prompt'); w.__stolen=0;
  const steal=(e)=>{ if(e.key && e.key.length===1 && !e.ctrlKey && !e.altKey && d.activeElement!==ta){ w.__stolen++; ta.focus(); } };
  ({document:()=>d.addEventListener('keydown',steal), window:()=>w.addEventListener('keydown',steal), root:()=>root.addEventListener('keydown',steal)})[where]();
  // «другое расширение» (Speed Control): document capture и window capture
  w.__ext=[]; d.addEventListener('keydown',e=>w.__ext.push('doc:'+e.code),true); w.addEventListener('keydown',e=>w.__ext.push('win:'+e.code),true);
  return {ta,btn:d.getElementById('btn')}; }
const press=(w,t,o)=>{ const e=new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},o)); t.dispatchEvent(e); return e; };
(async()=>{ try {
 { const {w}=load({items,url:'https://grok.com/imagine'}); await sleep(50); const P=w.__P;
   const p=P.mossadParseKeyList('Rк {Enter} {F5}{comma}1');
   ok('1a parse: letters by physical key (R and RU к both KeyR), space=Space, {Name}, digit', p.codes.has('KeyR') && p.codes.has('Space') && p.codes.has('Enter') && p.codes.has('F5') && p.codes.has('Digit1') && p.codes.has('Comma'), JSON.stringify([...p.codes]));
   ok('1b CapsLock / RU layout: К (key К, code KeyR) matches default R', P.grokNoPromptKeyMatch({key:'К',code:'KeyR'}) && P.grokNoPromptKeyMatch({key:'r',code:'KeyR',shiftKey:true}) && !P.grokNoPromptKeyMatch({key:'r',code:'KeyR',ctrlKey:true})); }
 for (const where of ['document','window','root']) {
   const {w,T}=load({items,url:'https://grok.com/imagine'}); await sleep(50); const d=w.document; const {ta,btn}=grokPage(w,where);
   btn.focus();
   press(w,btn,{key:'к',code:'KeyR'}); await sleep(10);
   ok(`2a [Grok listener on ${where}] R (RU К) outside fields: focus stays out of the prompt`, d.activeElement!==ta, d.activeElement&&d.activeElement.id);
   ok(`2b [${where}] other extension still sees the key (document+window capture)`, w.__ext.includes('doc:KeyR') && w.__ext.includes('win:KeyR'), JSON.stringify(w.__ext));
   await sleep(350); btn.focus(); w.__stolen=0;
   press(w,btn,{key:'t',code:'KeyT'}); await sleep(10);
   ok(`2c [${where}] unlisted letter: Grok behaviour unchanged (focus → prompt)`, d.activeElement===ta);
   await sleep(350); ta.focus();
   const e=press(w,ta,{key:'r',code:'KeyR'});
   ok(`2d [${where}] typing R inside the prompt is untouched`, !e.defaultPrevented && d.activeElement===ta);
 }
 // MOSSAD hotkey Shift+«+» (upscale) must not throw focus into the prompt
 { const {w,T}=load({items}); await sleep(80); const d=w.document; const {ta,btn}=grokPage(w,'document'); btn.focus();
   T.config.grokNoPromptKeys='';
   const e=press(w,btn,{key:'+',code:'Equal',shiftKey:true}); await sleep(10);
   ok('3a Upscale Shift+«+» handled by MOSSAD, focus not moved to prompt', e.defaultPrevented && d.activeElement!==ta, d.activeElement&&d.activeElement.id); }
 { const {w,T}=load({items}); await sleep(80); const d=w.document; const {ta,btn}=grokPage(w,'root'); btn.focus();
   T.config.grokNoPromptKeys='';
   press(w,btn,{key:'+',code:'Equal',shiftKey:true}); await sleep(10);
   ok('3b same with Grok listener on the React root (focus guard)', d.activeElement!==ta); }
 // settings field + «?» popup
 { const {w,T}=load({items,url:'https://grok.com/imagine'}); await sleep(50); const d=w.document; w.__P.openSettingsWindow('general'); await sleep(20);
   const inp=d.getElementById('mossad-gen-nokeys'); ok('4a field shown on Grok with default RWEZXGVC (v1.3.67)', inp && inp.value==='RWEZXGVC');
   d.getElementById('mossad-gen-nokeys-help').click(); const box=d.getElementById('mossad-key-help');
   ok('4b «?» popup lists named keys', box && /Backspace/.test(box.textContent) && /F12/.test(box.textContent) && /PageDown/.test(box.textContent));
   box.querySelector('[data-kh-ins="{Enter}"]').click();
   ok('4c click appends token and saves', inp.value==='RWEZXGVC{Enter}' && T.config.grokNoPromptKeys==='RWEZXGVC{Enter}', inp.value+' / '+T.config.grokNoPromptKeys); }
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/1/'}); await sleep(50); w.__P.openSettingsWindow('general'); await sleep(20);
   ok('4d field not shown on Pinterest', !w.document.getElementById('mossad-gen-nokeys')); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
