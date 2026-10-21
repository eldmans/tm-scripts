// v1.3.62 — Pinterest ScrollLock sound. Run: node v162_sound_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestSoundVideo, pinterestSoundButton, pinterestToggleSound };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v162.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const SL=(w)=>{ const e=new w.KeyboardEvent('keydown',{key:'ScrollLock',code:'ScrollLock',bubbles:true,cancelable:true}); (w.document.activeElement||w.document.body).dispatchEvent(e); return e; };
function page(w,{btn=true,pinRevert=false}={}){ const d=w.document; d.getElementById('stage').innerHTML='';
  d.body.insertAdjacentHTML('beforeend',`<div data-grid-item id="mainTile"><div id="player"><video id="main" elementtiming="closeup-video-main-MainPinImage" src="blob:x"></video>${btn?'<div><button id="mbtn" aria-label="Включить звук"></button></div>':''}</div></div>
   <div data-test-id="relatedPins"><div data-grid-item><div><video id="rel" elementtiming="gestalt-video"></video><button aria-label="Unmute" id="relbtn"></button></div></div></div>`);
  const v=d.getElementById('main'); v.muted=true; d.getElementById('rel').muted=true;
  if(btn){ const b=d.getElementById('mbtn'); b.tabIndex=0; w.__btnClicks=0; b.addEventListener('click',()=>{ w.__btnClicks++; v.muted=!v.muted; b.setAttribute('aria-label',v.muted?'Включить звук':'Выключить звук'); }); }
  if(pinRevert){ v.addEventListener('volumechange',()=>{ if(!w.__reverted){ w.__reverted=true; setTimeout(()=>{ v.muted=true; },10); } }); }
  return v; }
(async()=>{ try {
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/123/'}); await sleep(80); const d=w.document; const v=page(w);
   w.__toasts=[]; new w.MutationObserver(()=>{ const t=d.getElementById('mossad-sound-toast'); if(t) w.__toasts.push(t.textContent); }).observe(d.body,{subtree:true,childList:true,characterData:true});
   ok('1a picks main pin video, not related', w.__P.pinterestSoundVideo()===v);
   ok('1b finds main pin sound button (not related one)', w.__P.pinterestSoundButton(v)===d.getElementById('mbtn'));
   const e=SL(w); await sleep(20);
   ok('2a ScrollLock unmutes main video via Pinterest button (one click)', !v.muted && w.__btnClicks===1 && e.defaultPrevented, `${v.muted} ${w.__btnClicks}`);
   ok('2b related video untouched', d.getElementById('rel').muted===true);
   ok('2c toast «Звук вкл»', w.__toasts.some(t=>/Звук вкл/.test(t)), JSON.stringify(w.__toasts));
   ok('2d focus not moved to the button', d.activeElement!==d.getElementById('mbtn'));
   SL(w); await sleep(20); ok('3a second press mutes', v.muted && w.__btnClicks===2, v.muted+' '+w.__btnClicks+' '+(d.activeElement&&d.activeElement.outerHTML.slice(0,80)));
   // owner case: button had focus from a manual click, then ScrollLock
   d.getElementById('mbtn').focus(); SL(w); await sleep(20); ok('3b button focused beforehand: still toggles', !v.muted && w.__btnClicks===3);
 }
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/123/'}); await sleep(80); const v=page(w,{btn:false});
   SL(w); await sleep(20); ok('4a hidden/absent button → video.muted toggled directly', v.muted===false); }
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/123/'}); await sleep(80); const v=page(w,{btn:false,pinRevert:true});
   SL(w); await sleep(120); ok('5a Pinterest re-mutes within 1.5s → guard re-applies', v.muted===false && w.__reverted); }
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/123/'}); await sleep(80); const d=w.document; const v=page(w);
   d.body.insertAdjacentHTML('beforeend','<div role="dialog" id="dlg"><video id="ov"></video></div>'); const ov=d.getElementById('ov'); ov.muted=true;
   SL(w); await sleep(20); ok('6a full-scale overlay (dialog) video preferred', ov.muted===false && v.muted===true); }
 { const {w}=load({items,url:'https://ru.pinterest.com/pin/123/'}); await sleep(80); const d=w.document; const v=page(w,{btn:false});
   Object.defineProperty(d,'fullscreenElement',{get:()=>d.getElementById('mainTile'),configurable:true});
   SL(w); await sleep(20); ok('7a fullscreen: video inside fullscreen element', v.muted===false);
   ok('7b toast lives inside fullscreen element', !!d.getElementById('mainTile').querySelector('#mossad-sound-toast')); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
