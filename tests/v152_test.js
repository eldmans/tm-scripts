// v1.3.52 — Pinterest download via PinResource API. Run: node v152_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestResolveMedia, pinterestFetchPinInfo, pinterestParsePinData, pinterestVideoHashFromUrl, getPinMediaType, triggerDownload };\n`;
const i0=src.lastIndexOf(src.includes('} // /mossadMain')?'} // /mossadMain':'})();'); const tmp=path.join(__dirname,'.bundle_v152.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:'x',convId:'c'}];
const PIN='1137088605945274141', URLR=`https://ru.pinterest.com/pin/${PIN}/`;
const H='dde055aabbccddeeff00112233445566';
const HLS=`https://v1.pinimg.com/videos/iht/hls/dd/e0/55/${H}.m3u8`;
const MP4_720=`https://v1.pinimg.com/videos/iht/expMp4/dd/e0/55/${H}_720w.mp4`, MP4_360=MP4_720.replace('_720w','_360w');
const apiVideo={resource_response:{status:'success',data:{id:PIN,title:'',grid_title:'Do you like flared sleeves The Willow top',description:'x',images:{orig:{url:'https://i.pinimg.com/originals/aa/bb/cc/cover.jpg'}},videos:undefined,
  story_pin_data:{pages:[{blocks:[{video:{video_list:{V_HLSV3_MOBILE:{url:HLS,width:720,height:1280,duration:14233,thumbnail:'t'}}}}]}]}}}};
const apiPhoto={resource_response:{status:'success',data:{id:PIN,title:'Nice pic',images:{orig:{url:'https://i.pinimg.com/originals/11/22/33/orig.jpg'},'736x':{url:'https://i.pinimg.com/736x/11/22/33/orig.jpg'}}}}};
const LIVE_VIDEO=(poster='')=>`<div role="main"><div data-grid-item="true"><a href="/pin/777/"><div data-test-id="video-player"><video data-test-id="duplo-hls-video" elementtiming="gestalt-video" src="blob:https://ru.pinterest.com/rel" poster="https://i.pinimg.com/videos/thumbnails/originals/99/99/99/99999999999999999999999999999999.0000000.jpg"></video></div></a></div>`+
  `<div data-grid-item="true"><div><video data-test-id="duplo-hls-video" elementtiming="closeup-video-main-MainPinImage" src="blob:https://ru.pinterest.com/main" ${poster?`poster="${poster}"`:''}></video></div></div>`+
  `<div data-grid-item="true"><a href="/pin/778/"><img src="https://i.pinimg.com/236x/q.jpg"></a></div></div>`;
const LIVE_PHOTO=`<div role="main"><div data-grid-item="true"><a href="/pin/778/"><img src="https://i.pinimg.com/236x/related.jpg"></a></div><div data-grid-item="true"><img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/44/55/66/main.jpg"></div></div>`;
function setup({body, api, gmFail=[], xhrStatus=200}){ return w=>{
  w.document.body.innerHTML=body; w.__fetches=0; w.__dl=[]; w.__toasts=[];
  new w.MutationObserver(()=>{ const t=w.document.getElementById('mossad-toast'); if(t&&t.textContent!==w.__lastT){ w.__lastT=t.textContent; w.__toasts.push(t.textContent);} }).observe(w.document.documentElement,{subtree:true,childList:true,characterData:true});
  w.fetch=async(url,opts)=>{ w.__fetches++; w.__lastFetch={url:String(url),opts}; if(api==='fail') throw new Error('net'); return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(api))}; };
  w.__gmFail=gmFail; w.__xhrStatus=xhrStatus;
  w.eval(`GM_download=function(o){ window.__dl.push(o.url+' => '+o.name); setTimeout(()=>{ if(window.__gmFail.some(s=>o.url.includes(s))) o.onerror&&o.onerror({error:'403'}); else o.onload&&o.onload(); },20); };
          GM_xmlhttpRequest=function(o){ setTimeout(()=>o.onload&&o.onload({status:window.__gmFail.some(s=>o.url.includes(s))?403:200,response:null}),10); };`);
}; }
(async()=>{ try {
 // ---- 1. owner's live video story pin: API (HLS only) → expMp4 _720w ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_VIDEO(),api:apiVideo})}); await sleep(300); const P=w.__P;
   const m=await P.pinterestResolveMedia();
   ok('1a API story pin (HLS only) → _720w then _360w mp4', m.type==='video' && m.urls[0]===MP4_720 && m.urls[1]===MP4_360, JSON.stringify(m));
   ok('1b same-origin request with PWS-Handler header, id in data', /^\/resource\/PinResource\/get\/\?/.test(w.__lastFetch.url) && w.__lastFetch.opts.headers['X-Pinterest-PWS-Handler']==='www/pin/[id].js' && decodeURIComponent(w.__lastFetch.url).includes(`"id":"${PIN}"`));
   ok('1c desc parsed (grid_title)', m.desc==='Do you like flared sleeves The Willow top', m.desc);
   P.triggerDownload(); await sleep(400);
   ok('1d download → GM_download of main video _720w as .mp4', w.__dl.length===1 && w.__dl[0].startsWith(MP4_720) && /\.mp4$/.test(w.__dl[0]), JSON.stringify(w.__dl));
   ok('1e API cached: one request for two resolves', w.__fetches===1);
 }
 // ---- 2. _720w fails → _360w ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_VIDEO(),api:apiVideo,gmFail:['_720w']})}); await sleep(300);
   let done=0; w.__P.triggerDownload(false,null,()=>done++); await sleep(600);
   ok('2a _720w 403 → falls back to _360w, done callback once on success', w.__dl.length===2 && w.__dl[1].startsWith(MP4_360) && done===1, JSON.stringify([w.__dl,done]));
 }
 // ---- 3. API down → hash from main <video> poster (not the related one) ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_VIDEO(`https://i.pinimg.com/videos/thumbnails/originals/dd/e0/55/${H}.0000000.jpg`),api:'fail'})}); await sleep(300);
   const m=await w.__P.pinterestResolveMedia();
   ok('3a API down → hash from main video poster → _720w', m.type==='video' && m.urls[0]===MP4_720, JSON.stringify(m));
 }
 // ---- 4. API down, main video w/o hash → "video not found", NEVER a photo ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_VIDEO(),api:'fail'})}); await sleep(300);
   let done=0; w.__P.triggerDownload(false,null,()=>done++); await sleep(400);
   ok('4a known video pin without URL → no download, toast "Видео не найдено", slideshow callback', w.__dl.length===0 && /Видео не найдено/.test(w.document.getElementById('mossad-toast').textContent) && done===1, JSON.stringify([w.__dl,w.__toasts,done]));
 }
 // ---- 5. photo pin via API ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_PHOTO,api:apiPhoto})}); await sleep(300);
   w.__P.triggerDownload(); await sleep(400);
   ok('5a API photo → images.orig as .jpg', w.__dl.length===1 && w.__dl[0].startsWith('https://i.pinimg.com/originals/11/22/33/orig.jpg') && /\.jpg$/.test(w.__dl[0]), JSON.stringify(w.__dl));
 }
 // ---- 6. photo pin, API down → main image (closeup marker), not related (first in DOM) ----
 { const {w}=load({items,url:URLR,pre:setup({body:LIVE_PHOTO,api:'fail'})}); await sleep(300);
   const m=await w.__P.pinterestResolveMedia();
   ok('6a API down → main closeup image → originals, not related', m.type==='photo' && m.urls[0]==='https://i.pinimg.com/originals/44/55/66/main.jpg', JSON.stringify(m));
 }
 // ---- 7. slideshow uses API cache for type ----
 { const {w,T}=load({items,url:URLR,pre:setup({body:LIVE_PHOTO.replace('elementtiming="closeup-image-main-MainPinImage" ',''),api:apiPhoto})}); await sleep(300);
   const t0=w.__P.getPinMediaType(); await sleep(50); const t1=w.__P.getPinMediaType();
   ok('7a first call starts API fetch, then type comes from API cache', w.__fetches===1 && t1==='image', JSON.stringify([t0,t1]));
 }
 { const {w}=load({items,url:URLR,pre:setup({body:'<div role="main"></div>',api:apiVideo})}); await sleep(300);
   w.__P.getPinMediaType(); await sleep(50);
   ok('7b API video pin → "video" before player mounts', w.__P.getPinMediaType()==='video');
 }
 // ---- 8. slideshow + download: advances on success, not after 8 s ----
 { const {w,T,navs}=load({items,url:URLR,pre:setup({body:LIVE_PHOTO,api:apiPhoto}),cfg:{config:{slideshowDelay:0,downloadType:'all'}}}); await sleep(300);
   T.startSlideshow(); await sleep(2500);
   ok('8a slideshow downloads then navigates within 2.5 s (not 8 s safety)', w.__dl.length===1 && navs.length===1, JSON.stringify([w.__dl,navs.length,w.__toasts]));
 }
 // ---- 9. helpers ----
 { const {w}=load({items,url:URLR,pre:setup({body:'',api:'fail'})}); const P=w.__P;
   ok('9a hash from hls / expMp4 / thumbnail', P.pinterestVideoHashFromUrl(HLS)===H && P.pinterestVideoHashFromUrl(MP4_720)===H && P.pinterestVideoHashFromUrl(`https://i.pinimg.com/videos/thumbnails/originals/dd/e0/55/${H}.0000000.jpg`)===H && P.pinterestVideoHashFromUrl('https://i.pinimg.com/736x/dd/e0/55/'+H+'.jpg')===null);
   const inf=P.pinterestParsePinData({videos:{video_list:{V_720P:{url:'https://v1.pinimg.com/videos/mc/720p/aa/bb/cc/x.mp4',width:720},V_HLSV4:{url:HLS}}},images:{orig:{url:'o.jpg'}},closeup_unified_description:'  a   b '});
   ok('9b regular video pin: hash urls first, direct mp4 kept as extra; desc collapsed', inf.isVideo && inf.mp4Urls[0]===MP4_720 && inf.mp4Urls.includes('https://v1.pinimg.com/videos/mc/720p/aa/bb/cc/x.mp4') && inf.desc==='a b', JSON.stringify(inf));
 }
} catch(e){ console.log('EXC',e); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
