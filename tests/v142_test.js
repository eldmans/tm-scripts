// v1.3.42: fast photo/video detection on Grok post pages
const {load,U,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
// kinds: 'photo' | 'video' | {late:ms} (img first, video mounts after ms) | {muteThenVideo:ms}
function setup(kinds,{collType=true,musicBtn=true,cfg={}}={}){
  const items=kinds.map((k,i)=>({uuid:U(i),convId:'c1'}));
  const r=load({items,cfg:{config:Object.assign({videoLoops:1,delayAfterVideo:0,slideshowDelay:0},cfg)}});
  const {w}=r; const d=w.document;
  const kindOf=uuid=>kinds[items.findIndex(it=>it.uuid===uuid)];
  w.__times=[]; const t0=Date.now(); w.__t0=t0;
  const mountVideoRaw=(uuid,dur)=>{ const st=d.getElementById('stage');
    const v=d.createElement('video'); v.setAttribute('src','https://assets.grok.com/generated/'+uuid+'/v.mp4'); v.loop=true; if(dur) v._dur=dur;
    st.querySelectorAll('img').forEach(x=>x.remove()); st.appendChild(v); v.play(); return v; };
  const mountImg=uuid=>{ const img=d.createElement('img'); img.src='https://assets.grok.com/users/x/generated/'+uuid+'/image.jpg'; d.getElementById('stage').appendChild(img); };
  const addMute=()=>{ const b=d.createElement('button'); b.setAttribute('aria-label','Unmute'); b.style.display='none'; d.getElementById('stage').appendChild(b); };
  w.__mountVideo=(uuid,o={})=>{ const st=d.getElementById('stage'); st.innerHTML='';
    if(musicBtn){ const m=d.createElement('button'); m.setAttribute('aria-label','Sound'); m.textContent='\u266A Sound'; st.appendChild(m);
                  const m2=d.createElement('button'); m2.setAttribute('aria-label','Sound'); st.appendChild(m2); } // music-note + icon-only weak "Sound"
    w.__times.push([uuid,Date.now()-t0]);
    const k=kindOf(uuid);
    if(k==='video') return mountVideoRaw(uuid,1.2);
    mountImg(uuid);
    if(k&&k.late) setTimeout(()=>{ if(w.document && w.location.pathname.includes(uuid)) mountVideoRaw(uuid,1.2); }, k.late);
    if(k&&k.mute){ addMute(); setTimeout(()=>{ if(w.document && w.location.pathname.includes(uuid)) mountVideoRaw(uuid,1.2); }, k.mute); }
    if(k&&k.stale){ /* keep previous video for k.stale ms */ }
  };
  const ty=k=>k==='video'?'video':(k==='photo'?'photo':(k&&k.typ)||'photo');
  const coll=JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection'));
  coll.items.forEach((it,i)=>{ if(collType) it.type=ty(kinds[i]); else delete it.type; });
  w.sessionStorage.setItem('mossad_grok_imagine_collection',JSON.stringify(coll));
  w.__mountVideo(items[0].uuid);
  return Object.assign(r,{items});
}
const gaps=w=>{ const t=w.__times; const g=[]; for(let i=1;i<t.length;i++) g.push(t[i][1]-t[i-1][1]); return g; };
const log=(T,re)=>T.mossadDumpDebugLog().filter(e=>re.test(e.msg));
(async()=>{ try{
  // A: photos, photo=0 s, collection type 'photo', page also has music-note "Sound" buttons
  { const r=setup(['photo','photo','photo','photo','photo']); const {w,T}=r;
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(4000);
    const g=gaps(w); ok('A photo=0, type photo: dwell per slide < 1000 ms', g.length>=3 && g.every(x=>x<1000), `slides=${w.__times.length} gaps=${g}`);
    ok('A dwell respects min 600 ms', g.every(x=>x>=600), `gaps=${g}`); w.close(); }
  // B: photos, collection has NO type (unknown) -> still < 1 s
  { const r=setup(['photo','photo','photo','photo'],{collType:false}); const {w,T}=r;
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(4000);
    const g=gaps(w); ok('B photo=0, type unknown: dwell per slide < 1100 ms', g.length>=3 && g.every(x=>x<1100), `slides=${w.__times.length} gaps=${g}`); w.close(); }
  // C: photo=1 s -> ~1.5 s per slide (old: ~7 s)
  { const r=setup(['photo','photo','photo','photo'],{cfg:{slideshowDelay:1}}); const {w,T}=r;
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(5000);
    const g=gaps(w); ok('C photo=1 s: per slide 1000..1900 ms', g.length>=2 && g.every(x=>x>=1000&&x<1900), `gaps=${g}`); w.close(); }
  // D: video detected immediately (loops start right after cycle start)
  { const r=setup(['photo','video','photo']); const {w,T}=r;
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(3500);
    const L=T.mossadDumpDebugLog(); const v=L.find(e=>/Grok: видео найдено/.test(e.msg));
    ok('D video detected immediately', v && v.data.ms<=150, `ms=${v&&v.data.ms}`);
    const g=gaps(w); ok('D video slide plays 1 loop (~1.2 s) before next', g[1]>=1100 && g[1]<2200, `gaps=${g}`); w.close(); }
  // E: late video mount (1200 ms) on a slide collected as photo, photo=3 s -> switches to video
  { const r=setup(['photo',{late:1200,typ:'photo'},'photo'],{cfg:{slideshowDelay:3}}); const {w,T}=r;
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(3600+3000);
    const L=T.mossadDumpDebugLog(); const loops=L.filter(e=>/старт подсчёта кругов видео/.test(e.msg)).length;
    const g=gaps(w); ok('E late video during photo timer -> counted as video', loops>=1, `videoStarts=${loops} gaps=${g}`);
    ok('E advanced after video loop, not after 3 s photo timer', g[1]!==undefined && g[1]<3000, `slide2 dwell=${g[1]}`); w.close(); }
  // F: hidden Unmute button, video mounts after 800 ms, no type -> wait for video, not photo
  { const r=setup(['photo',{mute:800,typ:''},'photo'],{collType:true}); const {w,T}=r;
    const coll=JSON.parse(w.sessionStorage.getItem('mossad_grok_imagine_collection')); delete coll.items[1].type; w.sessionStorage.setItem('mossad_grok_imagine_collection',JSON.stringify(coll));
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(4500);
    const L=T.mossadDumpDebugLog(); const v=L.find(e=>/Grok: видео найдено/.test(e.msg));
    const g=gaps(w); ok('F hidden mute btn -> waits and plays video', !!v && g[1]>=1800, `found=${!!v} ms=${v&&v.data.ms} gaps=${g}`); w.close(); }
  // G: video -> photo where old <video> (same src) lingers 1000 ms -> photo after it's gone, < 1.8 s
  { const r=setup(['video','photo','photo']); const {w,T}=r; const d=w.document;
    const orig=w.__mountVideo; w.__mountVideo=(uuid,o)=>{ const old=d.querySelector('#stage video');
      if(old && uuid===U(1)){ const keep=old; orig(uuid,o); d.getElementById('stage').appendChild(keep); setTimeout(()=>keep.remove(),1000); return; } return orig(uuid,o); };
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(5000);
    const g=gaps(w); ok('G stale video lingering 1 s -> photo, no loops of old video', g[1]!==undefined && g[1]>=900 && g[1]<2000, `gaps=${g}`); w.close(); }
  // H: filmstrip contains <video> thumbnails -> photo is still photo
  { const r=setup(['photo','photo','photo']); const {w,T}=r; const d=w.document;
    d.querySelectorAll('[data-filmstrip-item]').forEach(b=>{ const v=d.createElement('video'); v.setAttribute('src','https://assets.grok.com/generated/thumb/'+b.dataset.uuid+'.mp4'); b.appendChild(v); });
    await sleep(100); T.grokStartGallerySlideshowFrom(T.grokGetPlaylistStructure().items[0]); await sleep(3000);
    const g=gaps(w); ok('H filmstrip <video> thumbs ignored: photo < 1 s', g.length>=2 && g.every(x=>x<1000), `gaps=${g}`); w.close(); }
  }catch(e){ console.log('ERR',e); }
  console.log(res.filter(x=>!x).length+' failed of '+res.length); process.exit(0);
})();
