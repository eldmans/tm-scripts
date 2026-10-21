// v1.3.43: wrap (repeat) hang model — Grok keeps the previous-circle <video> of the same post in DOM (paused at ~1 s)
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
(async()=>{ try{
  const kinds=['video','photo','video','photo'];
  const items=kinds.map((k,i)=>({uuid:U(i),convId:'c1'}));
  const {w,T}=load({items,cfg:{config:{videoLoops:1,delayAfterVideo:0,slideshowDelay:0}}}); const d=w.document;
  const cache=d.createElement('div'); cache.id='grok-cache'; d.body.insertBefore(cache,d.body.firstChild);
  const kept={}; w.__times=[]; const t0=Date.now();
  w.__mountVideo=(uuid)=>{ const st=d.getElementById('stage');
    // leaving a video post: Grok keeps its element (paused) in the cache
    const old=st.querySelector('video'); if(old){ old.pause(); old.currentTime=1; old.play=function(){return Promise.resolve();}; /* source detached: frozen at 1 s */ kept[old.dataset.uuid]=old; cache.appendChild(old); }
    if(kinds[items.findIndex(it=>it.uuid===uuid)]==='photo' && w.__evictOnPhoto) cache.innerHTML='';
    st.innerHTML=''; w.__times.push([uuid,Date.now()-t0]);
    const k=kinds[items.findIndex(it=>it.uuid===uuid)];
    if(k==='photo'){ const im=d.createElement('img'); im.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; st.appendChild(im); return; }
    const v=d.createElement('video'); v.dataset.uuid=uuid; v.setAttribute('src','https://assets.grok.com/users/x/generated/'+uuid+'/generated_video.mp4?r='+Math.random().toString(36).slice(2,6)); v.loop=true; v._dur=1.2;
    if(w.__lateFresh && kept[uuid]){ const c=kept[uuid]; st.appendChild(c); setTimeout(()=>{ if(!w.document) return; cache.appendChild(c); st.appendChild(v); v.play(); }, w.__lateFresh); return; }
    st.appendChild(v); v.play(); };
  w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.map((it,i)=>({url:'https://grok.com/imagine/post/'+it.uuid,convId:'c1',type:kinds[i]})),grpMode:'seq',itemMode:'fwd'}));
  w.__mountVideo(U(0)); cache.innerHTML='';
  await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]);
  await sleep(14000);
  const seq=w.__times.map(x=>parseInt(x[0].slice(0,8))); const gaps=w.__times.slice(1).map((x,i)=>x[1]-w.__times[i][1]);
  const wrapIdx=seq.indexOf(0,1);
  ok('W1 reached circle 2', wrapIdx>0, `seq=${seq}`);
  ok('W2 after wrap the first video does not hang (dwell < 3 s)', wrapIdx>0 && gaps[wrapIdx]!==undefined && gaps[wrapIdx]<3000, `gaps=${gaps}`);
  ok('W3 several circles completed', seq.filter(x=>x===0).length>=3, `visits of #0=${seq.filter(x=>x===0).length}`);
  // W4: on revisit Grok first re-shows the frozen element, the fresh player mounts 400 ms later
  w.__lateFresh=400; const n0=w.__times.length; await sleep(9000);
  const seq2=w.__times.slice(n0).map(x=>parseInt(x[0].slice(0,8))); const g2=w.__times.slice(n0).map((x,i,a)=>i?x[1]-a[i-1][1]:0).slice(1);
  ok('W4 frozen element shown first, fresh mounts later -> no hang', seq2.length>=6 && g2.every(x=>x<3500), `seq=${seq2} gaps=${g2}`);
  const L=T.mossadDumpDebugLog(); ok('W5 circle wrap resets slide memory', L.some(e=>/сброс состояния слайдов/.test(e.msg)&&e.data.reason==='circle'));
  w.close();
  // W6: small slideshow rewind (repeat) resets slide memory
  { const r=load({items:[{uuid:U(0),convId:'c1'}]}); let done=false; r.w.doRewind(()=>{done=true;}); await sleep(1600);
    const L2=r.T.mossadDumpDebugLog(); ok('W6 rewind complete resets slide memory', done && L2.some(e=>/сброс состояния слайдов/.test(e.msg)&&e.data.reason==='rewind'), `done=${done}`); r.w.close(); }
 }catch(e){console.log('ERR',e);}
 console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0); })();
