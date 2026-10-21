// v1.3.44: leak probe — active timers / intervals / observers / listeners / DOM nodes stay flat across slides and wraps
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
function instrument(w){
  const P={iv:new Set(),to:new Set(),obs:new Set(),lst:0,raf:0};
  const sI=w.setInterval, cI=w.clearInterval, sT=w.setTimeout, cT=w.clearTimeout;
  w.setInterval=function(f,ms,...a){ const id=sI.call(w,f,ms,...a); P.iv.add(id); return id; };
  w.clearInterval=function(id){ P.iv.delete(id); return cI.call(w,id); };
  w.setTimeout=function(f,ms,...a){ let id; id=sT.call(w,function(){ P.to.delete(id); return typeof f==='function'?f.apply(this,arguments):undefined; },ms,...a); P.to.add(id); return id; };
  w.clearTimeout=function(id){ P.to.delete(id); return cT.call(w,id); };
  const MO=w.MutationObserver; w.MutationObserver=class extends MO{ observe(...a){ P.obs.add(this); return super.observe(...a);} disconnect(){ P.obs.delete(this); return super.disconnect(); } };
  const ET=w.EventTarget.prototype, add=ET.addEventListener, rem=ET.removeEventListener;
  ET.addEventListener=function(...a){ P.lst++; return add.apply(this,a); }; ET.removeEventListener=function(...a){ P.lst--; return rem.apply(this,a); };
  w.__P=P; }
(async()=>{ try{
  const kinds=['photo','video','video','photo','photo','video','photo','video'];
  const items=kinds.map((k,i)=>({uuid:U(i),convId:'c1'}));
  const r=load({items,pre:instrument,cfg:{config:{videoLoops:1,delayAfterVideo:0,slideshowDelay:0}}}); const {w,T}=r; const d=w.document;
  w.__mountVideo=(uuid)=>{ const st=d.getElementById('stage'); st.innerHTML=''; w.__n=(w.__n||0)+1;
    const k=kinds[items.findIndex(it=>it.uuid===uuid)];
    if(k==='photo'){ const im=d.createElement('img'); im.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; st.appendChild(im); return; }
    const v=d.createElement('video'); v.setAttribute('src','https://assets.grok.com/users/x/generated/'+uuid+'/v.mp4'); v.loop=true; v._dur=0.6; st.appendChild(v); v.play(); };
  w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.map((it,i)=>({url:'https://grok.com/imagine/post/'+it.uuid,convId:'c1',type:kinds[i]})),grpMode:'seq',itemMode:'fwd'}));
  w.__mountVideo(U(0));
  await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]);
  const snap=()=>{ const P=w.__P; let ss={}; try{ss=JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_ss'))}catch(e){}
    return {slides:w.__n, iv:P.iv.size, to:P.to.size, obs:P.obs.size, lst:P.lst, nodes:d.getElementsByTagName('*').length, toasts:d.querySelectorAll('[id^="mossad-toast"], .mossad-toast').length, hist:(ss.history||[]).length, circle:ss.circle, log:T.mossadDumpDebugLog().length}; };
  await sleep(4000); const a=snap(); await sleep(16000); const b=snap(); await sleep(16000); const c=snap();
  console.log('snap A',JSON.stringify(a)); console.log('snap B',JSON.stringify(b)); console.log('snap C',JSON.stringify(c));
  ok('L0 several circles ran', c.circle>=4, `circle=${c.circle} slides=${c.slides}`);
  ok('L1 intervals constant', b.iv===a.iv && c.iv===a.iv, `${a.iv}/${b.iv}/${c.iv}`);
  ok('L2 observers constant', b.obs===a.obs && c.obs===a.obs, `${a.obs}/${b.obs}/${c.obs}`);
  ok('L3 pending timeouts bounded', c.to<=a.to+5, `${a.to}/${b.to}/${c.to}`);
  ok('L4 listeners constant', c.lst-b.lst<=2, `${a.lst}/${b.lst}/${c.lst}`);
  ok('L5 DOM nodes constant', Math.abs(c.nodes-b.nodes)<=5, `${a.nodes}/${b.nodes}/${c.nodes}`);
  ok('L6 history bounded', c.hist<=200, `${a.hist}/${b.hist}/${c.hist}`);
  const S=T.mossadDumpDebugLog().filter(e=>e.source==='perf'&&e.msg==='срез');
  ok('L7 perf snapshots in debug log (slide + circle)', S.some(e=>e.data.where==='slide')&&S.some(e=>e.data.where==='circle'), `n=${S.length} last=${JSON.stringify(S[S.length-1]&&S[S.length-1].data)}`);
  const ivs=S.slice(-10).map(e=>e.data.intervals); ok('L8 in-bundle interval count flat (transient waitForCondition ≤ +1)', Math.max(...ivs)-Math.min(...ivs)<=1 && Math.max(...ivs)<=4, ivs.join(','));
  // main-thread block -> lag warning
  const t=Date.now(); while(Date.now()-t<450){} await sleep(600);
  ok('L9 lag > 200 ms logged', T.mossadDumpDebugLog().some(e=>e.source==='perf'&&/лаг/.test(e.msg)&&e.data.ms>=200));
  w.close();
  // small slideshow (filmstrip loop)
  { const r2=load({items,pre:instrument,cfg:{config:{videoLoops:1,delayAfterVideo:0,slideshowDelay:0,loopFeed:true,slideshowDirections:['right']}}}); const w2=r2.w, d2=w2.document;
    w2.__mountVideo=(uuid)=>{ const st=d2.getElementById('stage'); st.innerHTML=''; w2.__n=(w2.__n||0)+1; const k=kinds[items.findIndex(it=>it.uuid===uuid)];
      if(k==='photo'){ const im=d2.createElement('img'); im.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; st.appendChild(im); return; }
      const v=d2.createElement('video'); v.setAttribute('src','https://assets.grok.com/users/x/generated/'+uuid+'/v.mp4'); v.loop=true; v._dur=0.6; st.appendChild(v); v.play(); };
    w2.__mountVideo(U(0)); await sleep(100); r2.T.startSlideshow();
    const sn=()=>({n:w2.__n,iv:w2.__P.iv.size,obs:w2.__P.obs.size,lst:w2.__P.lst,to:w2.__P.to.size,nodes:d2.getElementsByTagName('*').length});
    await sleep(5000); const x=sn(); await sleep(15000); const y=sn(); console.log('small',JSON.stringify(x),JSON.stringify(y));
    ok('L10 small slideshow: several wraps, timers/listeners/nodes flat', y.n>=x.n+8 && y.iv===x.iv && y.obs===x.obs && y.lst===x.lst && y.to<=x.to+5 && Math.abs(y.nodes-x.nodes)<=5, `${JSON.stringify(x)} -> ${JSON.stringify(y)}`);
    w2.close(); }
 }catch(e){console.log('ERR',e);}
 console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0); })();
