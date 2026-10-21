process.on('unhandledRejection',()=>{});
// Full-bundle jsdom harness for MOSSAD Grok slideshow (v1.3.38)
const {JSDOM, VirtualConsole}=require('jsdom'); const fs=require('fs');
const U=i=>`${String(i).padStart(8,'0')}-0000-4000-8000-000000000000`;
function load({items, startIdx=0, cfg={}, ss=null, audioCount}){
  let bundle=fs.readFileSync(process.env.BUNDLE||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
  const expose=`window.__T={ mossadHostMatches: typeof mossadHostMatches!=='undefined'?mossadHostMatches:null, mossadNormSite: typeof mossadNormSite!=='undefined'?mossadNormSite:null, mossadIsHostAllowed: typeof mossadIsHostAllowed!=='undefined'?mossadIsHostAllowed:null, mossadReadUserSites: typeof mossadReadUserSites!=='undefined'?mossadReadUserSites:null, updateGalleryStatusBtn: typeof updateGalleryStatusBtn!=='undefined'?updateGalleryStatusBtn:null, mossadUnlabelEl: typeof mossadUnlabelEl!=='undefined'?mossadUnlabelEl:null, mossadApplyLabels: typeof mossadApplyLabels!=='undefined'?mossadApplyLabels:null, L: typeof L!=='undefined'?L:null, mossadParseLabelsText: typeof mossadParseLabelsText!=='undefined'?mossadParseLabelsText:null, mossadLabelsToText: typeof mossadLabelsToText!=='undefined'?mossadLabelsToText:null, LABEL_DEFAULTS: typeof LABEL_DEFAULTS!=='undefined'?LABEL_DEFAULTS:null, normalizeHotkeyBinding: typeof normalizeHotkeyBinding!=='undefined'?normalizeHotkeyBinding:null, orderedHotkeyKeys: typeof orderedHotkeyKeys!=='undefined'?orderedHotkeyKeys:null, startSlideshow: typeof startSlideshow!=='undefined'?startSlideshow:(()=>[]), grokCollectLinks: typeof grokCollectLinks!=='undefined'?grokCollectLinks:(()=>[]), grokClassifySavedTile: typeof grokClassifySavedTile!=='undefined'?grokClassifySavedTile:(()=>[]), grokSavedViewMode: typeof grokSavedViewMode!=='undefined'?grokSavedViewMode:(()=>[]), findGrokSoundToggleButton: typeof findGrokSoundToggleButton!=='undefined'?findGrokSoundToggleButton:(()=>[]), mossadCodeForKey: typeof mossadCodeForKey!=='undefined'?mossadCodeForKey:(()=>[]), grokDetectSlideMedia: typeof grokDetectSlideMedia!=='undefined'?grokDetectSlideMedia:(()=>[]), cancelSlideTimers: typeof cancelSlideTimers!=='undefined'?cancelSlideTimers:(()=>[]),GlobalDefaults: typeof GlobalDefaults!=='undefined'?GlobalDefaults:(()=>[]), grokHandleGalleryPlayPause: typeof grokHandleGalleryPlayPause!=='undefined'?grokHandleGalleryPlayPause:(()=>[]), grokGetNextSlideItem: typeof grokGetNextSlideItem!=='undefined'?grokGetNextSlideItem:(()=>[]), grokSyncSlidePosition: typeof grokSyncSlidePosition!=='undefined'?grokSyncSlidePosition:(()=>[]), grokInsertCollectOrStart: typeof grokInsertCollectOrStart!=='undefined'?grokInsertCollectOrStart:(()=>[]), grokIsCollectWatching: typeof grokIsCollectWatching!=='undefined'?grokIsCollectWatching:(()=>[]), grokStopCollectWatch: typeof grokStopCollectWatch!=='undefined'?grokStopCollectWatch:(()=>[]), grokTogglePlaylistPanel: typeof grokTogglePlaylistPanel!=='undefined'?grokTogglePlaylistPanel:(()=>[]), openSettingsWindow: typeof openSettingsWindow!=='undefined'?openSettingsWindow:(()=>[]), closeSettingsWindow: typeof closeSettingsWindow!=='undefined'?closeSettingsWindow:(()=>[]), toggleSettingsWindow: typeof toggleSettingsWindow!=='undefined'?toggleSettingsWindow:(()=>[]), grokApplyPlaylistAutoHeight: typeof grokApplyPlaylistAutoHeight!=='undefined'?grokApplyPlaylistAutoHeight:(()=>[]),config: typeof config!=='undefined'?config:(()=>[]), grokStartGallerySlideshowFrom: typeof grokStartGallerySlideshowFrom!=='undefined'?grokStartGallerySlideshowFrom:(()=>[]), grokGalleryStepNext: typeof grokGalleryStepNext!=='undefined'?grokGalleryStepNext:(()=>[]), triggerNextSlide: typeof triggerNextSlide!=='undefined'?triggerNextSlide:(()=>[]), grokGetNextSlideItem: typeof grokGetNextSlideItem!=='undefined'?grokGetNextSlideItem:(()=>[]), playCircleDoneSound: typeof playCircleDoneSound!=='undefined'?playCircleDoneSound:(()=>[]), scheduleNextSlideCycle: typeof scheduleNextSlideCycle!=='undefined'?scheduleNextSlideCycle:(()=>[]), requestSlideCycle: typeof requestSlideCycle!=='undefined'?requestSlideCycle:(()=>[]), playerStepSlide: typeof playerStepSlide!=='undefined'?playerStepSlide:(()=>[]), grokGetPlaylistStructure: typeof grokGetPlaylistStructure!=='undefined'?grokGetPlaylistStructure:(()=>[]), grokSyncSlidePosition: typeof grokSyncSlidePosition!=='undefined'?grokSyncSlidePosition:(()=>[]), runSmartDelete: typeof runSmartDelete!=='undefined'?runSmartDelete:(()=>[]), mossadDumpDebugLog: typeof mossadDumpDebugLog!=='undefined'?mossadDumpDebugLog:(()=>[]), grokSaveCollection: typeof grokSaveCollection!=='undefined'?grokSaveCollection:(()=>[]), showSoundToast: typeof showSoundToast!=='undefined'?showSoundToast:(()=>[]), hotkeyMatches: typeof hotkeyMatches!=='undefined'?hotkeyMatches:(()=>[]), formatHotkey: typeof formatHotkey!=='undefined'?formatHotkey:(()=>[]), waitForCondition: typeof waitForCondition!=='undefined'?waitForCondition:(()=>[]),
    get loops(){return currentLoopCount}, get counting(){return isCountingDown}, get node(){return currentVideoNode},
    get active(){return slideshowActive}};\n`;
  const i=bundle.lastIndexOf(bundle.includes('} // /mossadMain')?'} // /mossadMain':'})();'); bundle=bundle.slice(0,i)+expose+bundle.slice(i);
  const vc=new VirtualConsole(); const navs=[]; const logs=[];
  vc.on('jsdomError',e=>{ if(/navigation/i.test(e.message)) navs.push('href'); else logs.push('ERR '+e.message); });
  vc.on('log',(...a)=>logs.push(a.join(' '))); vc.on('warn',(...a)=>logs.push('W '+a.join(' '))); vc.on('error',(...a)=>logs.push('E '+a.join(' ')));
  const cur=items[startIdx];
  const dom=new JSDOM(`<!doctype html><body><main id="stage"></main><div id="strip"></div></body>`,{url: (arguments[0].url || 'https://grok.com/imagine/post/'+cur.uuid), runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:vc});
  const w=dom.window; w.__navs=navs; w.__clicks=[];
  // ---- fake media ----
  const P=w.HTMLMediaElement.prototype;
  Object.defineProperty(P,'duration',{get(){return this._dur===undefined?1.2:this._dur}, configurable:true});
  Object.defineProperty(P,'paused',{get(){return !this._playing}, configurable:true});
  Object.defineProperty(P,'currentSrc',{get(){return this.getAttribute('src')||''}, configurable:true});
  Object.defineProperty(P,'ended',{get(){ if(this.loop||!this._playing) return !!this._ended; return this._raw()>=this.duration; }, configurable:true});
  P._raw=function(){return this._playing?(w.performance.now()-this._t0)/1000+(this._off||0):(this._ct||0)};
  Object.defineProperty(P,'currentTime',{get(){const r=this._raw(); return this.loop? r%this.duration : Math.min(r,this.duration)}, set(v){this._off=v; this._t0=w.performance.now(); this._ct=v}, configurable:true});
  P.play=function(){ if(!this._playing){this._playing=true; this._t0=w.performance.now(); this._off=this._ct||0;} return Promise.resolve(); };
  P.pause=function(){ this._ct=this.currentTime; this._playing=false; };
  w.HTMLElement.prototype.getBoundingClientRect=function(){ return this.tagName==='VIDEO'&&this.isConnected?{top:0,left:0,right:800,bottom:600,width:800,height:600}:{top:0,left:0,right:0,bottom:0,width:0,height:0}; };
  Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',{get(){return 10}, configurable:true});
  // ---- audio mock ----
  w.__audio={created:0};
  w.AudioContext=class{constructor(){w.__audio.created++; this.state='running'; this.currentTime=0; this.destination={};}
    createOscillator(){return {connect(){},disconnect(){},frequency:{},start(){},stop(){}}} createGain(){return {connect(){},disconnect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}
    resume(){return Promise.resolve()} close(){this.state='closed'; return Promise.resolve()}};
  // ---- Grok page model ----
  w.__mountVideo=(uuid,{loop=true,dur}={})=>{ const st=w.document.getElementById('stage'); st.innerHTML='';
    const v=w.document.createElement('video'); v.setAttribute('src','https://assets.grok.com/generated/'+uuid+'/v.mp4'); v.loop=loop; if(dur) v._dur=dur;
    st.appendChild(v); v.play(); return v; };
  const strip=w.document.getElementById('strip');
  const conv=cur.convId;
  items.filter(it=>it.convId===conv).forEach(it=>{ const b=w.document.createElement('button'); b.setAttribute('data-filmstrip-item','true'); b.dataset.uuid=it.uuid;
    b.addEventListener('click',()=>{ w.__clicks.push(it.uuid); setTimeout(()=>{ if(!w.document) return; w.history.replaceState(null,'','/imagine/post/'+it.uuid); w.__mountVideo(it.uuid,{dur:it.dur}); },w.__arriveMs||40); }); strip.appendChild(b); });
  w.__mountVideo(cur.uuid,{dur:cur.dur});
  w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.map(it=>({url:'https://grok.com/imagine/post/'+it.uuid, convId:it.convId, type:'video'})), grpMode:cfg.grpMode||'seq', itemMode:cfg.itemMode||'fwd'}));
  if(ss) w.sessionStorage.setItem('mossad_grok_imagine_ss', JSON.stringify(ss));
  // v1.3.63: старые тесты рассчитаны на один общий список клавиш — по умолчанию у Grok нет «своих» клавиш (seedSiteHk:true — заводской посев)
  w.__gm=Object.assign(arguments[0].seedSiteHk?{}:{mossad_hk_site:JSON.stringify({'grok.com':{hk:{},order:[]}})}, arguments[0].seedSpeed?{}:{mossad_speed:JSON.stringify({rows:[]})}, arguments[0].preGm||{});
  if(arguments[0].preLs) for(const [k,v] of Object.entries(arguments[0].preLs)) w.localStorage.setItem(k,v);
  w.indexedDB={open(){const r={error:new Error('noidb')}; setTimeout(()=>{r.onerror&&r.onerror({target:r})}); return r;}};
  w.eval(`function GM_getValue(k,d){return k in window.__gm?window.__gm[k]:d} function GM_setValue(k,v){const o=window.__gm[k]; window.__gm[k]=v; (window.__gmL[k]||[]).forEach(f=>{try{f(k,o,v,false)}catch(e){}})} window.__gmL={}; function GM_addValueChangeListener(k,f){(window.__gmL[k]=window.__gmL[k]||[]).push(f); return 1}
          function GM_openInTab(){} function GM_download(){} function GM_xmlhttpRequest(){} var GM_info={script:{version:'test'}};`);
  if(typeof arguments[0].pre==="function") arguments[0].pre(w);
  w.eval(bundle);
  Object.assign(w.__T.config, {debugSlideshow:true, autoFS:false, pinterestAutoFS:false, downloadType:'none', stopOnTabSwitch:false, stopOnBrsrSwitch:false}, cfg.config||{});
  return {w, T:w.__T, navs, logs, dom};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
module.exports={load,U,sleep};
