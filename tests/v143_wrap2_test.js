// v1.3.43: exact owner sequence  wrap -> photo (0 s) -> video -> video
// Model: Grok keeps the last 2 visited <video> elements in DOM (before the viewer), "frozen": not paused,
// currentTime stuck (source detached). Each photo visit evicts one. So mid-list videos after 2-3 photos are fine,
// but after the wrap only ONE photo passes before two adjacent videos.
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const kinds=['photo','video','video','photo','photo','photo','video','video'];
function setup(small){
  const items=kinds.map((k,i)=>({uuid:U(i),convId:'c1'}));
  const r=load({items,cfg:{config:{videoLoops:1,delayAfterVideo:0,slideshowDelay:0,loopFeed:true,slideshowDirections:['right']}}});
  const {w}=r; const d=w.document; const cache=d.createElement('div'); d.body.insertBefore(cache,d.body.firstChild);
  const lru=[]; w.__times=[]; const t0=Date.now();
  const freeze=v=>{ const ct=v.currentTime; Object.defineProperty(v,'currentTime',{get(){return ct},set(){},configurable:true}); v.play=()=>Promise.resolve(); };
  w.__mountVideo=(uuid)=>{ const st=d.getElementById('stage'); const old=st.querySelector('video');
    if(old){ freeze(old); cache.appendChild(old); lru.push(old); while(lru.length>2) lru.shift().remove(); }
    st.innerHTML=''; w.__times.push([uuid,Date.now()-t0]);
    const k=kinds[items.findIndex(it=>it.uuid===uuid)];
    if(k==='photo'){ const x=lru.shift(); if(x) x.remove(); const im=d.createElement('img'); im.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; st.appendChild(im); return; }
    const v=d.createElement('video'); v.setAttribute('src','https://assets.grok.com/users/x/generated/'+uuid+'/generated_video.mp4'); v.loop=true; v._dur=1.2; st.appendChild(v); v.play(); };
  w.sessionStorage.setItem('mossad_grok_imagine_collection', JSON.stringify({items:items.map((it,i)=>({url:'https://grok.com/imagine/post/'+it.uuid,convId:'c1',type:kinds[i]})),grpMode:'seq',itemMode:'fwd'}));
  w.__mountVideo(U(0));
  return r;
}
function report(tag,w,pMax=1000){ const seq=w.__times.map(x=>parseInt(x[0].slice(0,8))); const g=w.__times.slice(1).map((x,i)=>x[1]-w.__times[i][1]);
  const wrap=seq.indexOf(0,1);
  ok(tag+' wrapped to start', wrap>0, `seq=${seq}`);
  // after wrap: P0 (0 s) -> V1 -> V2 -> P3
  const after=seq.slice(wrap,wrap+4).join(); ok(tag+' wrap -> P0 -> V1 -> V2 -> P3 reached', after==='0,1,2,3', `after=${after}`);
  const dw=g.slice(wrap,wrap+3); ok(tag+` P0 < ${pMax} ms, V1 and V2 play ~1 loop (< 3 s each)`, dw.length===3 && dw[0]<pMax && dw[1]<3000 && dw[2]<3000, `dwell P0,V1,V2=${dw}`);
  return seq; }
(async()=>{ try{
  { const {w,T}=setup(false); await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(17000);
    report('BIG',w); w.close(); }
  { const {w,T}=setup(true); await sleep(100); T.startSlideshow(); await sleep(17000);
    report('SMALL',w,1200); w.close(); }
 }catch(e){console.log('ERR',e);}
 console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0); })();
