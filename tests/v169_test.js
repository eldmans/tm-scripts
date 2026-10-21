// v1.3.69 — Grok «\» cycle: skip unavailable steps, composer scope, arrows in duration/aspect. Run: node v169_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ grokFindComposer, grokCycleFocus, _mossadGrokCtlArrow, grokComposerArrowCtl };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v169.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const key=(w,t,o={})=>{ const e=new w.KeyboardEvent('keydown',Object.assign({key:'\\',code:'Backslash',bubbles:true,cancelable:true},o)); (t||w.document.activeElement||w.document.body).dispatchEvent(e); return e; };
const arrow=(w,k,t)=>key(w,t,{key:k,code:k});
const G=async(fn)=>{ const {w,T}=load({items,url:'https://grok.com/imagine/post/'+U(2)}); await sleep(80); const d=w.document; w.__toasts=[];
  new w.MutationObserver(()=>{ const t=d.getElementById('mossad-toast'); if(t) w.__toasts.push(t.textContent); }).observe(d.body,{subtree:true,childList:true,characterData:true});
  await fn(w,d,T); };
const radio=(id,txt,on)=>`<button role="radio" id="${id}" aria-checked="${!!on}">${txt}</button>`;
function radiosClick(w,ids){ const d=w.document; ids.forEach(id=>{ const b=d.getElementById(id); if(b) b.addEventListener('click',()=>{ ids.forEach(j=>{ const x=d.getElementById(j); if(x) x.setAttribute('aria-checked',String(j===id)); }); w.__clicked=(w.__clicked||[]).concat(id); }); }); }
const warns=[]; const ow=console.warn; console.warn=(...a)=>{ if(String(a[0]).includes('grokCycle')) warns.push(a); else ow(...a); };
(async()=>{ try {
 // ---- Bug 1a: duration menu open (composer aria-hidden), focus on option → Escape closes, prompt found ----
 await G(async(w,d)=>{ d.body.innerHTML=`<div id="root"><form id="bar"><textarea aria-label="Imagine prompt">cat</textarea><div role="radiogroup">${radio('rImg','Image')}${radio('rVid','Video',1)}</div><button id="dur" aria-label="Video duration" aria-haspopup="menu">6s</button></form></div>`;
   const menu=d.createElement('div'); menu.setAttribute('role','menu'); menu.setAttribute('data-state','open'); menu.innerHTML='<div role="menuitemradio" id="o6" tabindex="-1">6s</div><div role="menuitemradio" id="o10" tabindex="-1">10s</div>'; d.body.appendChild(menu);
   d.getElementById('root').setAttribute('aria-hidden','true'); let esc=0;
   d.addEventListener('keydown',(e)=>{ if(e.key==='Escape'){ esc++; menu.remove(); d.getElementById('root').removeAttribute('aria-hidden'); } });
   d.getElementById('o10').focus(); key(w); await sleep(150);
   ok('1a option focused in open duration menu → Escape closes it, prompt focused, no error toast', esc===1 && d.activeElement===d.querySelector('textarea') && !w.__toasts.some(t=>/⚠️/.test(t)), JSON.stringify({esc,ae:d.activeElement&&d.activeElement.tagName,t:w.__toasts})); });
 // ---- Bug 1b: video page: only Video + Bot radios → mode step skipped, bot never pressed ----
 await G(async(w,d)=>{ d.body.innerHTML=`<form><textarea aria-label="Imagine prompt">x</textarea><div role="radiogroup">${radio('rVid','Video',1)}${radio('rBot','Bot')}</div><div role="radiogroup" aria-label="Video duration">${radio('d6','6s',1)}${radio('d10','10s')}</div></form>`; radiosClick(w,['rVid','rBot','d6','d10']);
   const ta=d.querySelector('textarea'); ta.focus(); key(w,ta); await sleep(30);
   ok('1b only video (+bot) → mode skipped, focus → duration; bot not pressed; no toast', d.activeElement===d.getElementById('d6') && !(w.__clicked||[]).length && !w.__toasts.some(t=>/⚠️/.test(t)), d.activeElement&&d.activeElement.id);
   key(w); await sleep(20); ok('1c next → prompt (cycle among available only)', d.activeElement===ta);
   d.getElementById('rVid').setAttribute('aria-checked','true'); const ph=d.createElement('button'); ph.setAttribute('role','radio'); ph.id='rImg'; ph.textContent='Image'; ph.disabled=true; d.getElementById('rVid').before(ph);
   key(w); await sleep(30); ok('1d photo present but disabled → still skipped', d.activeElement===d.getElementById('d6') && !(w.__clicked||[]).length); });
 // ---- Bug 1e: mode dropdown with Video + Bot only ----
 await G(async(w,d)=>{ d.body.innerHTML=`<form><textarea aria-label="Imagine prompt">x</textarea><button id="trig" aria-haspopup="menu">Video</button><div role="radiogroup" aria-label="Video duration">${radio('d6','6s',1)}${radio('d10','10s')}</div></form>`;
   let opened=0, bot=0, esc=0; d.getElementById('trig').addEventListener('click',()=>{ opened++; const m=d.createElement('div'); m.setAttribute('role','menu'); m.id='mm'; m.innerHTML='<div role="menuitem" id="iv">Video</div><div role="menuitem" id="ib">Bot</div>'; m.querySelector('#ib').addEventListener('click',()=>bot++); d.body.appendChild(m); });
   d.addEventListener('keydown',e=>{ if(e.key==='Escape'){ esc++; const m=d.getElementById('mm'); if(m) m.remove(); } });
   const ta=d.querySelector('textarea'); ta.focus(); key(w,ta); await sleep(1000);
   ok('1e menu has no photo → closed with Escape, bot not picked, falls through to duration', opened===1 && bot===0 && esc===1 && !d.getElementById('mm') && d.activeElement===d.getElementById('d6'), JSON.stringify({opened,bot,esc,ae:d.activeElement&&d.activeElement.id}));
   ta.focus(); key(w,ta); await sleep(50); ok('1f next time on this page: menu not reopened', opened===1 && d.activeElement===d.getElementById('d6')); });
 // ---- Bug 2a: aspect in composer vs right panel (aside / role=complementary / dialog) ----
 await G(async(w,d)=>{ d.body.innerHTML=`<main><div id="wrap"><div id="comp"><textarea aria-label="Imagine prompt">x</textarea><div role="radiogroup">${radio('rImg','Image',1)}${radio('rVid','Video')}</div><button id="arC" aria-haspopup="menu">2:3</button></div><aside id="panel"><button id="arP" aria-label="Aspect ratio">16:9</button><div role="radiogroup">${radio('pImg','Image')}${radio('pVid','Video')}</div></aside></div></main>`;
   let regen=0; d.getElementById('arP').addEventListener('click',()=>regen++); d.getElementById('arP').addEventListener('focus',()=>regen++);
   ok('2a composer = wrapper of prompt, stops before the side panel', w.__P.grokFindComposer()===d.getElementById('comp'), w.__P.grokFindComposer()&&w.__P.grokFindComposer().id);
   d.getElementById('rImg').focus(); key(w); await sleep(20);
   ok('2b photo → aspect step targets the composer 2:3, not the panel (even though panel has aria-label "Aspect ratio")', d.activeElement===d.getElementById('arC') && regen===0, d.activeElement&&d.activeElement.id); });
 await G(async(w,d)=>{ d.body.innerHTML=`<div id="page"><div id="comp"><textarea aria-label="Imagine prompt">x</textarea><div role="radiogroup">${radio('rImg','Image',1)}${radio('rVid','Video')}</div><button id="arC" aria-haspopup="menu">2:3</button></div><div id="drawer"><button id="arP" aria-label="Aspect ratio">16:9</button></div></div>`;
   Object.defineProperty(w,'innerWidth',{value:1200,configurable:true});
   const R=(l,r)=>()=>({left:l,right:r,top:500,bottom:540,width:r-l,height:40});
   d.querySelector('textarea').getBoundingClientRect=R(300,700); d.getElementById('arP').getBoundingClientRect=R(1000,1100); d.getElementById('arC').getBoundingClientRect=R(600,640);
   d.getElementById('rImg').focus(); key(w); await sleep(20);
   ok('2c drawer without role but at the right edge (outside composer bar) → excluded', d.activeElement===d.getElementById('arC'), d.activeElement&&d.activeElement.id); });
 await G(async(w,d)=>{ d.body.innerHTML=`<aside><button id="arP" aria-label="Aspect ratio">16:9</button><div role="radiogroup">${radio('pImg','Image',1)}${radio('pVid','Video')}</div></aside>`;
   let regen=0; d.getElementById('arP').addEventListener('click',()=>regen++); radiosClick(w,['pImg','pVid']);
   key(w,d.body); await sleep(500);
   ok('2d no composer (no prompt) → no page-wide fallback: panel untouched, one toast', regen===0 && !(w.__clicked||[]).length && d.activeElement!==d.getElementById('arP') && w.__toasts.some(t=>/не нашёл ни промт/.test(t)), JSON.stringify(w.__toasts)); });
 // ---- Arrows ----
 await G(async(w,d,T)=>{ d.body.innerHTML=`<div id="root"><form><textarea aria-label="Imagine prompt">x</textarea><div role="radiogroup">${radio('rImg','Image')}${radio('rVid','Video',1)}</div><div role="radiogroup" id="durg" aria-label="Video duration">${radio('d6','6s',1)}${radio('d10','10s')}</div></form></div>`;
   radiosClick(w,['d6','d10','rImg','rVid']);
   // React-like delegation at root: arrows move the check (like Radix RadioGroup)
   let reactRuns=0; d.getElementById('root').addEventListener('keydown',e=>{ const t=e.target; if(t.getAttribute('role')!=='radio'||!/Arrow/.test(e.key)) return; reactRuns++; const g=[...t.parentElement.querySelectorAll('[role=radio]')]; const i=g.indexOf(t); const n=g[(i+(e.key==='ArrowDown'?1:g.length-1))%g.length]; n.click(); n.focus(); });
   let slidesW=0, slidesD=0; w.addEventListener('keydown',e=>{ if(/Arrow(Up|Down)/.test(e.key)) slidesW++; }); d.addEventListener('keydown',e=>{ if(/Arrow(Up|Down)/.test(e.key)) slidesD++; });
   d.getElementById('d6').focus(); const e1=arrow(w,'ArrowDown');
   ok('3a ArrowDown in composer duration: value 6s→10s (exactly one step), page slide handlers (window+document) not reached', d.getElementById('d10').getAttribute('aria-checked')==='true' && d.activeElement===d.getElementById('d10') && slidesW===0 && slidesD===0 && reactRuns===0 && e1.defaultPrevented, JSON.stringify({slidesW,slidesD,reactRuns}));
   arrow(w,'ArrowUp'); ok('3b ArrowUp → back to 6s, still no slide', d.getElementById('d6').getAttribute('aria-checked')==='true' && slidesW===0);
   ok('3c MOSSAD own arrow hotkeys skip it', w.__P._mossadGrokCtlArrow(new w.KeyboardEvent('keydown',{key:'ArrowDown'}))===true);
   // elsewhere: unchanged
   d.getElementById('rVid').focus(); arrow(w,'ArrowDown'); ok('4a arrows on the mode radios → page receives as before', slidesW===1 && slidesD===1 && reactRuns===1);
   d.body.focus(); d.activeElement.blur&&d.activeElement.blur(); const e2=arrow(w,'ArrowDown',d.body); ok('4b arrows on page body → reach slide handlers, not prevented by the guard', slidesW===2 && w.__P._mossadGrokCtlArrow(new w.KeyboardEvent('keydown',{key:'ArrowDown'}))===false);
   d.querySelector('textarea').focus(); arrow(w,'ArrowUp'); ok('4c arrows in prompt textarea → unchanged', slidesW===3);
   d.getElementById('d6').focus(); arrow(w,'ArrowLeft'); ok('4d ArrowLeft/Right are not touched (only ↑/↓)', reactRuns===2);
   // reference: why not window-capture stopPropagation — React-delegated handler never runs
   const stopper=(e)=>e.stopPropagation(); d.getElementById('d10').setAttribute('aria-checked','false'); d.getElementById('d6').setAttribute('aria-checked','true');
   w.addEventListener('keydown',stopper,true); const r0=reactRuns; const x=d.createElement('div'); x.setAttribute('role','radiogroup'); x.innerHTML=radio('q1','a',1)+radio('q2','b'); d.getElementById('root').appendChild(x); d.getElementById('q1').focus(); arrow(w,'ArrowDown');
   ok('5a reference: plain stopPropagation at window capture would kill a root-delegated control handler (value unchanged) → not used', reactRuns===r0 && d.getElementById('q1').getAttribute('aria-checked')==='true'); w.removeEventListener('keydown',stopper,true); });
 await G(async(w,d)=>{ d.body.innerHTML=`<form><textarea aria-label="Imagine prompt">x</textarea><button id="arC" aria-haspopup="listbox" aria-label="Aspect ratio">2:3</button><select id="sel" aria-label="Video duration"><option>6s</option><option>10s</option></select></form>`;
   let slides=0; w.addEventListener('keydown',e=>{ if(/Arrow(Up|Down)/.test(e.key)) slides++; });
   let opened=0; d.getElementById('arC').addEventListener('click',()=>{ opened++; const l=d.createElement('div'); l.setAttribute('role','listbox'); l.innerHTML='<div role="option" id="a1">2:3</div><div role="option" id="a2">16:9</div><div role="option" id="a3">1:1</div>'; d.body.appendChild(l); });
   d.getElementById('arC').focus(); const e1=arrow(w,'ArrowDown'); ok('6a ArrowDown on composer aspect trigger → opens its list, no slide', opened===1 && slides===0 && e1.defaultPrevented);
   d.getElementById('a1').setAttribute('tabindex','-1'); d.getElementById('a1').focus(); arrow(w,'ArrowDown'); ok('6b in open aspect list: focus moves to next option, no slide', d.activeElement===d.getElementById('a2') && slides===0);
   arrow(w,'ArrowUp'); arrow(w,'ArrowUp'); ok('6c wraps around', d.activeElement===d.getElementById('a3') && slides===0);
   const sel=d.getElementById('sel'); sel.focus(); const e3=arrow(w,'ArrowDown'); ok('6d native <select>: default kept (not prevented), no slide', !e3.defaultPrevented && slides===0); });
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
