// READ-ONLY diagnosis tests for Pinterest issues (v1.3.49). Run: node pin_diag_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestResolveMedia, findMediaForDownload, getPinterestMainPinData, getPinMediaType, getPinterestCandidatePins, getActiveVideo };\n`;
const i=src.lastIndexOf(src.includes('} // /mossadMain')?'} // /mossadMain':'})();'); const tmp=path.join(__dirname,'bundle_patched.js');
fs.writeFileSync(tmp, src.slice(0,i)+extra+src.slice(i)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const ok=(n,c,i='')=>console.log(c?'PASS':'FAIL',n,i);
const items=[{uuid:'x',convId:'c'}];
const related=(n,{video=false}={})=>Array.from({length:n},(_,k)=>`<div data-grid-item="true"><a href="/pin/${900+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg" width="236" height="300"></a>${video&&k===0?'<video src="https://v1.pinimg.com/videos/iht/expMp4/11/22/33/1122330000000000000000000000abcd_t1.mp4"></video>':''}</div>`).join('');
function page(mainHtml, rel){ return w=>{ w.document.body.innerHTML=`<div role="main"><div data-test-id="closeup-body">${mainHtml}</div><div data-test-id="relatedPins">${rel}</div></div>`;
  w.__toasts=[]; new w.MutationObserver(()=>{ const t=w.document.getElementById('mossad-toast'); if(t&&t.textContent!==w.__lastT){ w.__lastT=t.textContent; w.__toasts.push(t.textContent);} }).observe(w.document.documentElement,{subtree:true,childList:true,characterData:true}); }; }
(async()=>{
 // ---- 1. Slideshow with default D-pad direction on Pinterest ----
 { const {w,T,navs}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('<img src="https://i.pinimg.com/736x/main.jpg">',related(12)),cfg:{config:{slideshowDelay:0}}});
   await sleep(300); w.widgetState='panel'; w.updateWidgetUI();
   ok('1a fresh Pinterest config: slideshowDirections', true, JSON.stringify(T.config.slideshowDirections));
   ok('1b Pinterest panel has its own ◀/▶ direction toggle', w.document.querySelectorAll('.mossad-pdir').length===2);
   T.startSlideshow(); await sleep(6500);
   ok('1c FIXED: slideshow still active after ~6s', T.active===true);
   ok('1d FIXED: navigated forward to a related pin', navs.length===1, 'navs='+navs.length);
   ok('1e FIXED: no "конец ленты"', !w.__toasts.some(t=>/конец ленты/.test(t)), JSON.stringify(w.__toasts));
 }
 // ---- 1'. Same page, direction 'down' → navigates to related pin ----
 { const {w,T,navs}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('<img src="https://i.pinimg.com/736x/main.jpg">',related(12)),cfg:{config:{slideshowDelay:0,slideshowDirections:['down'],pinterestMode:'3'}}});
   await sleep(300); T.startSlideshow(); await sleep(1500);
   ok("1f with direction 'down' slideshow navigates to a related pin", navs.length>=1 && T.active, JSON.stringify(w.__toasts));
 }
 // ---- 1''. related pins not rendered yet (lazy) → 'next' finds nothing → stops after 3 tries ----
 { const {w,T,navs}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('<img src="https://i.pinimg.com/736x/main.jpg">',''),cfg:{config:{slideshowDelay:0,slideshowDirections:['down']}}});
   await sleep(300); T.startSlideshow(); await sleep(6500);
   ok("1g FIXED: related grid not loaded for 5s → still waiting, not stopped", T.active, JSON.stringify(w.__toasts));
 }
 // ---- 2. Mode highlight ----
 { const {w,T}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('',''),preLs:{'mossad_pinterest_com_config':JSON.stringify({pinterestMode:'3'})}});
   await sleep(300); w.widgetState='panel'; w.updateWidgetUI();
   const btns=[...w.document.querySelectorAll('.mossad-pmode[data-mode="rand"],.mossad-pmode[data-mode="+1"]')]; const inN=w.document.getElementById('mossad-in-pmode-n');
   ok('2a mode persisted after reload', T.config.pinterestMode==='3');
   ok('2b FIXED: number mode chip highlighted', !!w.document.querySelector('.mossad-pmode[data-mode="n"].mossad-seg-on'));
 }
 // ---- 3. Download on a VIDEO pin (HLS → blob: src) ----
 { const {w}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('<div data-test-id="video-player"><video src="blob:https://www.pinterest.com/abc" poster="https://i.pinimg.com/videos/thumbnails/originals/aa/bb/cc/x.0000000.jpg"></video></div>',related(6))});
   await sleep(300); const m=w.__P.findMediaForDownload(); const pd=w.__P.getPinterestMainPinData();
   ok('3a page type = video (blob src)', w.__P.getPinMediaType()==='video', JSON.stringify(pd));
   const rm=await w.__P.pinterestResolveMedia(); ok('3b FIXED: video pin w/o URL → video-not-found, never related photo', rm && rm.error==='video-not-found', JSON.stringify(rm));
 }
 // ---- 3'. PHOTO pin whose related grid has an autoplaying video preview ----
 { const {w}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('<img src="https://i.pinimg.com/736x/main.jpg">',related(6,{video:true}))});
   await sleep(300); const pd=w.__P.getPinterestMainPinData(); const m=w.__P.findMediaForDownload();
   ok("3c FIXED: photo pin not 'video' despite related <video>", pd.type!=='video', JSON.stringify(pd));
   const rm2=await w.__P.pinterestResolveMedia(); ok("3d FIXED: download = main photo, not related video", rm2 && rm2.type==='photo' && /main\.jpg/.test(rm2.urls[rm2.urls.length-1]), JSON.stringify(rm2));
 }
 // ---- 4. Filename template ----
 { const {w}=load({items,url:'https://www.pinterest.com/pin/111/',pre:page('','')});
   const R=w.renderFilenameTemplate; const vars={id:'1234567890123456789',id8:'12345678',domain:'pinterest.com',ext:'jpg',username:'12345678',n:'123456',dbl:'',oldname:'',title:'Pin on X',date:'2026-10-21',time:'13-00-00',conv:''};
   const V=w.buildFilenameVars({postId:'1234567890123456789',type:'photo',ext:'jpg'});
   const a=R('{id8}-{domain[4]}~{RadugaStud}',V,false,'','jpg');
   ok('4a FIXED: unknown {RadugaStud} dropped, {domain}=word', a==='12345678-pint.jpg' && R('{id8}-{domain}',V,false,'','jpg')==='12345678-pinterest.jpg', a);
   const b=R('{id8}-{domain}.v2',V,false,'','jpg');
   ok("4b FIXED: '.v2' is not an extension → .jpg appended", b==='12345678-pinterest.v2.jpg', b);
   const c=R('{id[3]}_{id5}_{date}',vars,false,'','jpg'); ok('4c {id[3]} / {id5} truncation', c==='123_12345_2026-10-21.jpg', c);
 }
 process.exit(0);
})();
