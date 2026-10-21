// v1.3.51 — Pinterest slideshow + mode UI. Run: node v151_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ findMediaForDownload, getPinterestMainPinData, getPinMediaType, getPinterestCandidatePins, getActiveVideo, pinterestChooseCandidate, selectNextPinterestPin, Settings };\n`;
const i0=src.lastIndexOf(src.includes('} // /mossadMain')?'} // /mossadMain':'})();'); const tmp=path.join(__dirname,'.bundle_v151.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:'x',convId:'c'}];
const URL0='https://www.pinterest.com/pin/111/';
const related=(n,{video=false,start=900}={})=>Array.from({length:n},(_,k)=>`<div data-grid-item="true"><a href="/pin/${start+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg" width="236" height="300"></a>${video&&k===0?'<video src="https://v1.pinimg.com/videos/iht/expMp4/11/22/33/1122330000000000000000000000abcd_t1.mp4"></video>':''}</div>`).join('');
const PHOTO='<img src="https://i.pinimg.com/736x/main.jpg">';
function page(mainHtml, rel, {gridFirst=false}={}){ return w=>{
  const grid=`<div data-test-id="relatedPins">${rel}</div>`, main=`<div data-test-id="closeup-body">${mainHtml}</div>`;
  w.document.body.innerHTML=`<div role="main">${gridFirst?grid+main:main+grid}</div>`;
  w.__toasts=[]; new w.MutationObserver(()=>{ const t=w.document.getElementById('mossad-toast'); if(t&&t.textContent!==w.__lastT){ w.__lastT=t.textContent; w.__toasts.push(t.textContent);} }).observe(w.document.documentElement,{subtree:true,childList:true,characterData:true});
  const d=Object.getOwnPropertyDescriptor(w.Element.prototype,'innerHTML'); w.__docHtmlReads=0;
  Object.defineProperty(w.Element.prototype,'innerHTML',{configurable:true,set:d.set,get(){ if(this===w.document.documentElement) w.__docHtmlReads++; return d.get.call(this);}});
}; }
const cfgKey='mossad_pinterest_com_config';
const lsCfg=w=>JSON.parse(w.localStorage.getItem(cfgKey)||'{}');
(async()=>{ try {
 // ---- 1. default D-pad ▲ no longer means "back": slideshow goes forward ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(12)),cfg:{config:{slideshowDelay:0}}});
   await sleep(300); ok('1a fresh config still has D-pad ▲ (irrelevant now)', T.config.slideshowDirections[0]==='up');
   T.startSlideshow(); await sleep(1800);
   ok('1b slideshow navigated forward to a related pin', navs.length===1 && T.active, JSON.stringify(w.__toasts));
   const h=T.config.pinterestHistory; ok('1c history: current + target, idx at top', h.length===2 && h[0]===URL0 && /\/pin\/9\d\d\//.test(h[1]) && T.config.pinterestHistoryIdx===1, JSON.stringify(h));
   ok('1d no full-document innerHTML reads', w.__docHtmlReads===0, w.__docHtmlReads);
   ok('1e history persisted to localStorage', (lsCfg(w).pinterestHistory||[]).length===2);
 }
 // ---- 2. direction ◀ with empty history: no stop, continues forward ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(5)),cfg:{config:{slideshowDelay:0,pinterestDir:'back'}}});
   await sleep(300); T.startSlideshow(); await sleep(1800);
   ok('2a ◀ at start of history → forward to a new pin, still active (no stop)', navs.length===1 && T.active && !w.__toasts.some(t=>/конец ленты/.test(t)), JSON.stringify(w.__toasts));
 }
 // ---- 2b. direction ◀ with history → goes back ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(5)),preLs:{[cfgKey]:JSON.stringify({pinterestHistory:['https://www.pinterest.com/pin/50/',URL0],pinterestHistoryIdx:1,pinterestDir:'back'})},cfg:{config:{slideshowDelay:0}}});
   await sleep(300); T.startSlideshow(); await sleep(1500);
   ok('2b ◀ with history → back one step', navs.length===1 && T.config.pinterestHistoryIdx===0 && T.active, JSON.stringify(w.__toasts));
 }
 // ---- 3. lazy related pins: appear after 3 s → still navigates, never stops ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,''),cfg:{config:{slideshowDelay:0}}});
   await sleep(300); T.startSlideshow(); await sleep(3000);
   ok('3a waiting (no stop, no nav) while related grid is empty', T.active && navs.length===0 && w.__toasts.some(t=>/Жду похожие/.test(t)), JSON.stringify(w.__toasts));
   w.document.querySelector('[data-test-id="relatedPins"]').innerHTML=related(4); await sleep(600);
   ok('3b grid appears → navigates', navs.length===1 && T.active);
 }
 // ---- 4. dead end with history → back one step, pin marked dead ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,''),preLs:{[cfgKey]:JSON.stringify({pinterestHistory:['https://www.pinterest.com/pin/50/',URL0],pinterestHistoryIdx:1})},cfg:{config:{slideshowDelay:0}}});
   await sleep(300); T.startSlideshow(); await sleep(16500);
   ok('4a 15 s without related → back one step, still active', navs.length===1 && T.config.pinterestHistoryIdx===0 && T.active, JSON.stringify(w.__toasts));
   ok('4b dead pin remembered', JSON.parse(w.sessionStorage.getItem('mossad_pin_dead')||'[]').includes('111'));
 }
 // ---- 5. dead end, no history → keeps waiting, never stops ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,''),cfg:{config:{slideshowDelay:0}}});
   await sleep(300); T.startSlideshow(); await sleep(16500);
   ok('5a no history, no related → not stopped, no "конец ленты"', T.active && navs.length===0 && !w.__toasts.some(t=>/конец ленты/.test(t)), JSON.stringify(w.__toasts));
   T.startSlideshow(); await sleep(400); ok('5b stop cancels the wait', !T.active);
 }
 // ---- 6. chooser: +1 persistent, № N, visited/dead skipped ----
 { const {w,T}=load({items,url:URL0,pre:page(PHOTO,related(6))});
   await sleep(300); const P=w.__P; const C=P.getPinterestCandidatePins();
   T.config.pinterestFilterType='all'; T.config.pinterestMode='+1'; T.config.pinterestHistory=[];
   const a=P.pinterestChooseCandidate(C).index, b=P.pinterestChooseCandidate(C).index, c=P.pinterestChooseCandidate(C).index;
   ok('6a +1: 1st, 2nd, 3rd… counter in sessionStorage', a===0&&b===1&&c===2 && w.sessionStorage.getItem('mossad_pin_seq')==='2', [a,b,c]);
   T.config.pinterestMode='3'; ok('6b № 3 → 3rd related', P.pinterestChooseCandidate(C).target.pinId==='902');
   T.config.pinterestHistory=['https://www.pinterest.com/pin/900/','https://www.pinterest.com/pin/901/']; T.config.pinterestMode='1';
   ok('6c recently visited pins skipped (no A↔B ping-pong)', P.pinterestChooseCandidate(C).target.pinId==='902');
   w.sessionStorage.setItem('mossad_pin_dead',JSON.stringify(['902'])); ok('6d dead pins skipped', P.pinterestChooseCandidate(C).target.pinId==='903');
   T.config.pinterestHistory=C.map(x=>x.url); w.sessionStorage.removeItem('mossad_pin_dead');
   ok('6e all visited → still picks something', !!P.pinterestChooseCandidate(C).target);
 }
 // ---- 7. detection restricted to closeup ----
 { const {w}=load({items,url:URL0,pre:page(PHOTO,related(6,{video:true}),{gridFirst:true})});
   await sleep(300); const P=w.__P;
   ok('7a photo pin + related video preview: not "video"', P.getPinMediaType()!=='video' && P.getActiveVideo()===null, P.getPinMediaType());
   ok('7b no full-document innerHTML reads', w.__docHtmlReads===0, w.__docHtmlReads);
 }
 { const {w}=load({items,url:URL0,pre:page('<video src="blob:https://www.pinterest.com/abc"></video>',related(6,{video:true}),{gridFirst:true})});
   await sleep(300); const P=w.__P; const v=P.getActiveVideo();
   ok('7c video pin: main <video> chosen, not grid preview (grid first in DOM)', v && v.getAttribute('src').startsWith('blob:') && P.getPinMediaType()==='video');
 }
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(6,{video:true}),{gridFirst:true}),cfg:{config:{slideshowDelay:0}}});
   await sleep(300); w.sessionStorage.setItem('mossad_expected_type','image'); T.startSlideshow(); await sleep(1500);
   ok('7d photo pin with related video: photo timer → navigates in <1.5 s', navs.length===1, JSON.stringify(w.__toasts));
 }
 // ---- 8. light history save: no Settings.save (no hk GM write / no re-render) ----
 { const {w,T}=load({items,url:URL0,pre:page(PHOTO,related(3))});
   await sleep(300); let hkWrites=0; const gs=w.GM_setValue; w.eval('GM_setValue=function(k,v){ if(k==="mossad_hk_global") window.__hkw=(window.__hkw||0)+1; window.__gm[k]=v; }');
   w.__P.selectNextPinterestPin('next',{isManual:false,fromSlideshow:false}); await sleep(200);
   ok('8a step writes no hk-global GM (Settings.save not used)', !w.__hkw, w.__hkw);
 }
 // ---- 9. manual arrows ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(3))});
   await sleep(300); const r=w.__P.selectNextPinterestPin('prev',{isManual:true});
   ok('9a manual ← at history start: warning, no nav', r===false && navs.length===0 && /начале истории/.test(w.document.getElementById('mossad-toast').textContent), JSON.stringify([r,navs.length,w.__toasts]));
 }
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(3)),preLs:{[cfgKey]:JSON.stringify({pinterestHistory:['https://www.pinterest.com/pin/50/',URL0,'https://www.pinterest.com/pin/60/'],pinterestHistoryIdx:1})}});
   await sleep(300); w.__P.selectNextPinterestPin('prev',{isManual:true});
   ok('9b manual ← with history → back', navs.length===1 && T.config.pinterestHistoryIdx===0);
 }
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO,related(3)),preLs:{[cfgKey]:JSON.stringify({pinterestHistory:['https://www.pinterest.com/pin/50/',URL0,'https://www.pinterest.com/pin/60/'],pinterestHistoryIdx:1})}});
   await sleep(300); w.__P.selectNextPinterestPin('next',{isManual:true});
   ok('9c manual → mid-history → forward in history', navs.length===1 && T.config.pinterestHistoryIdx===2);
 }
 // ---- 10. segmented control ----
 { const {w,T}=load({items,url:URL0,pre:page('',''),preLs:{[cfgKey]:JSON.stringify({pinterestMode:'3'})}});
   await sleep(300); w.widgetState='panel'; w.updateWidgetUI(); const d=w.document;
   const seg=m=>d.querySelector(`.mossad-pmode[data-mode="${m}"]`); const inN=d.getElementById('mossad-in-pmode-n');
   ok('10a after reload № 3 highlighted, rand/+1 not', seg('n').classList.contains('mossad-seg-on') && !seg('rand').classList.contains('mossad-seg-on') && !seg('+1').classList.contains('mossad-seg-on') && inN.value==='3');
   ok('10b highlight is visible (blue bg)', /37, 99, 235|2563eb/.test(seg('n').style.background));
   ok('10c ▶ direction highlighted by default', d.querySelector('.mossad-pdir[data-dir="fwd"]').classList.contains('mossad-seg-on'));
   seg('rand').click();
   ok('10d click rand → highlight moves, saved, panel not re-rendered', seg('rand').classList.contains('mossad-seg-on') && !seg('n').classList.contains('mossad-seg-on') && lsCfg(w).pinterestMode==='rand' && d.getElementById('mossad-in-pmode-n')===inN);
   inN.focus(); inN.value='7'; inN.dispatchEvent(new w.Event('input',{bubbles:true})); await sleep(400);
   ok('10e typing 7 → mode "7", № highlighted, same focused input', T.config.pinterestMode==='7' && seg('n').classList.contains('mossad-seg-on') && d.activeElement===inN && d.getElementById('mossad-in-pmode-n')===inN);
   seg('rand').click(); inN.click(); ok('10f click on number field selects № mode', T.config.pinterestMode==='7' && seg('n').classList.contains('mossad-seg-on'));
   d.querySelector('.mossad-pdir[data-dir="back"]').click();
   ok('10g ◀ toggle saved + highlighted', lsCfg(w).pinterestDir==='back' && d.querySelector('.mossad-pdir[data-dir="back"]').classList.contains('mossad-seg-on') && !d.querySelector('.mossad-pdir[data-dir="fwd"]').classList.contains('mossad-seg-on'));
 }
 { const {T}=load({items,url:URL0,pre:page('',''),preLs:{[cfgKey]:JSON.stringify({pinterestMode:'abc',pinterestDir:'x'})}});
   ok('11a garbage mode/dir sanitized', T.config.pinterestMode==='rand' && T.config.pinterestDir==='fwd');
 }
 { const {T}=load({items,url:URL0,pre:page('',''),preLs:{[cfgKey]:JSON.stringify({pinterestMode:'99'})}});
   ok('11b mode clamped to 30', T.config.pinterestMode==='30');
 }

 // ---- 12. LIVE DOM shape (ru.pinterest.com, 10.2026): BOTH <video> inside [data-grid-item], blob src, duplo-hls-video;
 //          main has elementtiming="closeup-video-main-MainPinImage", related "gestalt-video" ----
 { const URLR='https://ru.pinterest.com/pin/1137088605945274141/';
   const liveBody=w=>{ w.document.body.innerHTML=`<div role="main"><div data-grid-item="true"><a href="/pin/777/"><div data-test-id="video-player"><video data-test-id="duplo-hls-video" elementtiming="gestalt-video" src="blob:https://ru.pinterest.com/rel"></video></div></a></div>`+
     `<div data-grid-item="true"><div><video data-test-id="duplo-hls-video" elementtiming="closeup-video-main-MainPinImage" src="blob:https://ru.pinterest.com/main"></video></div></div>`+
     `<div data-grid-item="true"><a href="/pin/778/"><img src="https://i.pinimg.com/236x/q.jpg"></a></div></div>`; };
   const {w,T,navs}=load({items,url:URLR,pre:w=>{ page('','')(w); liveBody(w); },cfg:{config:{slideshowDelay:0}},preLs:{[cfgKey]:JSON.stringify({slideshowDirections:['up'],pinterestMode:4,pinterestHistory:['https://ru.pinterest.com/pin/1/','https://ru.pinterest.com/pin/2/','https://ru.pinterest.com/pin/3/','https://ru.pinterest.com/pin/4/','https://ru.pinterest.com/pin/5/',URLR],pinterestHistoryIdx:0})}});
   await sleep(300); const P=w.__P; const v=P.getActiveVideo();
   ok('12a ru.pinterest.com: main video found by elementtiming (inside grid item), not gestalt', v && v.getAttribute('src').endsWith('/main') && P.getPinMediaType()==='video', v&&v.getAttribute('src'));
   ok('12b owner config (mode 4 number, dirs up) loaded: mode "4"', T.config.pinterestMode==='4');
   const C=P.getPinterestCandidatePins(); ok('12c candidates = related pins only', C.map(c=>c.pinId).join()==='777,778', C.map(c=>c.pinId).join());
   v._dur=1.0; T.startSlideshow(); await sleep(3500);
   ok('12d owner state (idx 0, ▲): slideshow plays main video then goes FORWARD to a new pin, no stop', T.active && navs.length===1 && /\/pin\/77[78]\//.test(T.config.pinterestHistory[T.config.pinterestHistoryIdx]), JSON.stringify([w.__toasts,T.config.pinterestHistory]));
 }
 { const {w}=load({items,url:URL0,pre:w=>{ page('','')(w); w.document.body.innerHTML='<div data-grid-item="true"><img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/main.jpg"></div><div data-grid-item="true"><a href="/pin/5/"><div data-test-id="video-player"><video elementtiming="gestalt-video" src="blob:x"></video></div></a></div>'; }});
   await sleep(300); ok('12e photo pin inside grid item + related gestalt video → not video', w.__P.getPinMediaType()!=='video' && w.__P.getActiveVideo()===null, w.__P.getPinMediaType());
 }
} catch(e){ console.log('EXC',e); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
