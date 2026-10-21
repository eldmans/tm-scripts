// v1.3.56 — «После скачивания» rework. Run: node v156_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ triggerDownload, setSlideshowPaused, mossadPdAction, mossadAnySlideshowActive, openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v156.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const URL0='https://www.pinterest.com/pin/111/', cfgKey='mossad_pinterest_com_config';
const related=(n,start=900)=>Array.from({length:n},(_,k)=>`<div data-grid-item="true"><a href="/pin/${start+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg"></a></div>`).join('');
const page=w=>{ w.document.body.innerHTML=`<div role="main"><div data-test-id="closeup-body"><img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/main.jpg"></div><div data-test-id="relatedPins">${related(5)}</div></div>`; w.__dl=[];
  w.fetch=async()=>({ok:true,status:200,json:async()=>({resource_response:{status:'success',data:{id:'111',images:{orig:{url:'https://i.pinimg.com/originals/aa/bb/cc/o.jpg'}}}}})});
  w.eval(`GM_download=function(o){ window.__dl.push(o.url); setTimeout(()=>o.onload&&o.onload(),10); };`); };
(async()=>{ try {
 // ---- 1. defaults + migration ----
 { const {T}=load({items,url:URL0,pre:page}); await sleep(100); ok('1a fresh default = upns («Не СШ +1»)', T.config.pdAction==='upns', T.config.pdAction); }
 { const {w,T}=load({items,url:URL0,pre:page,preLs:{[cfgKey]:JSON.stringify({pdAction:'up'})},preGm:{mossad_global_defaults:JSON.stringify({pdAction:'up',videoLoops:2})}}); await sleep(100);
   ok('1b old +1 → upns in config, saved config and GM defaults', T.config.pdAction==='upns' && JSON.parse(w.localStorage.getItem(cfgKey)).pdAction==='upns' && JSON.parse(w.__gm.mossad_global_defaults).pdAction==='upns', JSON.stringify([T.config.pdAction,w.localStorage.getItem(cfgKey),w.__gm.mossad_global_defaults])); }
 for (const v of ['none','del','always']) { const {T}=load({items,url:URL0,pre:page,preLs:{[cfgKey]:JSON.stringify({pdAction:v})}}); await sleep(50); ok(`1c ${v} kept`, T.config.pdAction===v, T.config.pdAction); }
 // ---- 2. upns: +1 without slideshow, none while slideshow paused ----
 { const {w,T,navs}=load({items,url:URL0,pre:page}); await sleep(200);
   w.__P.triggerDownload(); await sleep(1200);
   ok('2a upns, no slideshow: download → +1 (one navigation)', w.__dl.length===1 && navs.length===1, `dl=${w.__dl.length} navs=${navs.length}`); }
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:30}}}); await sleep(200);
   T.startSlideshow(); await sleep(200); w.__P.setSlideshowPaused(true); await sleep(100);
   ok('2b paused slideshow counts as active', w.__P.mossadAnySlideshowActive()===true);
   w.__P.triggerDownload(); await sleep(1200);
   ok('2c upns, slideshow paused: manual download → NO +1', w.__dl.length===1 && navs.length===0, `dl=${w.__dl.length} navs=${navs.length}`); }
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:30}}}); await sleep(200);
   T.startSlideshow(); await sleep(200); w.__P.triggerDownload(); await sleep(1200);
   ok('2d upns, slideshow running: manual download → NO +1', w.__dl.length===1 && navs.length===0, `navs=${navs.length}`);
   }
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:30}}}); await sleep(200);
   T.startSlideshow(); await sleep(200); T.startSlideshow(); await sleep(100);
   ok('2e stopped slideshow = inactive', T.active===false && w.__P.mossadAnySlideshowActive()===false);
   w.__P.triggerDownload(); await sleep(1500);
   ok('2f after stop: +1 again', navs.length===1, `navs=${navs.length}`); }
 // ---- 3. always ----
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:30,pdAction:'always'}}}); await sleep(200);
   T.startSlideshow(); await sleep(200); w.__P.setSlideshowPaused(true); w.__P.triggerDownload(); await sleep(1200);
   ok('3a always, slideshow paused: manual download → +1', navs.length===1, `navs=${navs.length}`); }
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:0,pdAction:'always',downloadType:'all'}}}); await sleep(200);
   T.config.downloadType='all'; T.startSlideshow(); await sleep(2500);
   ok('3b always + slideshow auto-download: exactly ONE step (no double)', w.__dl.length===1 && navs.length===1, `dl=${w.__dl.length} navs=${navs.length}`); }
 { const {w,T,navs}=load({items,url:URL0,pre:page,cfg:{config:{slideshowDelay:0,downloadType:'all'}}}); await sleep(200);
   T.config.downloadType='all'; T.startSlideshow(); await sleep(2500);
   ok('3c upns + slideshow auto-download: exactly ONE step', w.__dl.length===1 && navs.length===1, `dl=${w.__dl.length} navs=${navs.length}`); }
 // ---- 4. UI ----
 { const {w,T}=load({items,url:URL0,pre:page}); await sleep(200); w.widgetState='panel'; w.updateWidgetUI(); await sleep(50);
   const sel=w.document.getElementById('mossad-sel-pd'); const opts=Array.from(sel.options).map(o=>o.value+':'+o.textContent);
   const lbl=sel.parentElement.querySelector('[data-mossad-label="pdLabel"]');
   ok('4a Pinterest: separate label + options —/Не СШ +1/+1 всегда, no Delete, upns selected', lbl && lbl.textContent==='После скачивания:' && JSON.stringify(opts)==='["none:—","upns:Не СШ +1","always:+1 всегда"]' && sel.value==='upns', JSON.stringify(opts));
   sel.value='always'; sel.dispatchEvent(new w.Event('change')); ok('4b selecting saves', T.config.pdAction==='always');
   w.__P.openSettingsWindow(); await sleep(50); const d=w.document.getElementById('mossad-def-pdAction');
   ok('4c 🌐 defaults tab options', d && JSON.stringify(Array.from(d.options).map(o=>o.value))==='["none","upns","always","del"]', d&&d.innerHTML); }
 { const {w}=load({items}); await sleep(200); w.widgetState='panel'; w.updateWidgetUI(); await sleep(50);
   const sel=w.document.getElementById('mossad-sel-pd');
   ok('4d Grok: Delete option present', sel && Array.from(sel.options).some(o=>o.value==='del' && o.textContent==='Delete')); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
