const {load,U,sleep}=require('./ss_harness');
const results=[]; const ok=(name,cond,info='')=>{results.push([cond?'PASS':'FAIL',name,info]); console.log(cond?'PASS':'FAIL',name,info);};
const OLD=!!process.env.BUNDLE;
async function t1(){ // AudioContext
  const items=[0,1].map(i=>({uuid:U(i),convId:'c1'})); const {w,T}=load({items});
  for(let i=0;i<50;i++) T.playCircleDoneSound(); await sleep(2100); for(let i=0;i<5;i++) T.playCircleDoneSound();
  ok('T1 AudioContext: 55 circle sounds -> contexts created', w.__audio.created<=1, `created=${w.__audio.created}`); w.close(); }
async function t2(){ // single nav per step under concurrent triggers (same conv, filmstrip)
  const items=[0,1,2,3,4,5].map(i=>({uuid:U(i),convId:'c1'}));
  const {w,T}=load({items, cfg:{grpMode:'rnd',itemMode:'rnd',config:{videoLoops:999}}});
  const st=T.grokGetPlaylistStructure(); T.grokStartGallerySlideshowFrom(st.items[0]); await sleep(1000);
  w.__clicks.length=0; w.__arriveMs=200;
  for(let i=0;i<10;i++){ T.triggerNextSlide('burst'+i); if(T.grokGalleryStepNext) T.grokGalleryStepNext('burstB'+i); }
  setTimeout(()=>T.triggerNextSlide('late-50ms'),50); setTimeout(()=>T.triggerNextSlide('late-150ms'),150);
  setTimeout(()=>T.triggerNextSlide('late-350ms-after-arrival'),350);
  await sleep(500);
  ok('T2a concurrent triggers (filmstrip) -> navigations', w.__clicks.length===1, `clicks=${w.__clicks.length}`);
  // after arrival a new step is allowed again
  await sleep(700); w.__clicks.length=0; T.triggerNextSlide('after-arrival'); await sleep(400);
  ok('T2b next step after arrival allowed', w.__clicks.length===1, `clicks=${w.__clicks.length}`); w.close();
  // full-navigation path (different conversations)
  const items2=[0,1,2,3,4,5].map(i=>({uuid:U(i),convId:'c'+i}));
  const r=load({items:items2, cfg:{grpMode:'rnd',itemMode:'rnd',config:{videoLoops:999}}});
  const st2=r.T.grokGetPlaylistStructure(); r.T.grokStartGallerySlideshowFrom(st2.items[0]); await sleep(10); r.navs.length=0;
  // pretend we're already there: tick arrival
  await sleep(800); const cnt=()=>r.T.mossadDumpDebugLog().filter(e=>/location\.href/.test(e.msg)).length; const before=cnt();
  r.T.config.debugSlideshow=true;
  // simulate: start nav never "arrives" (page would unload) -> bursts during the lock must not navigate again
  for(let i=0;i<10;i++) r.T.triggerNextSlide('burst'+i);
  setTimeout(()=>r.T.triggerNextSlide('late'),200); await sleep(500);
  ok('T2c 11 triggers, cross-conversation (location.href) -> navigations', cnt()-before===1, `href navs for 11 triggers=${cnt()-before}, total=${cnt()}`);
  r.w.close(); }
async function t3(){ // loops across element swaps
  const items=[0,1,2].map(i=>({uuid:U(i),convId:'c1'}));
  const {w,T}=load({items, cfg:{config:{videoLoops:2, delayAfterVideo:0}}});
  const st=T.grokGetPlaylistStructure(); T.grokStartGallerySlideshowFrom(st.items[0]);
  const t0=Date.now(); w.__clicks.length=0;
  setTimeout(()=>w.__mountVideo(U(0)),600); setTimeout(()=>w.__mountVideo(U(0)),2000);
  let tAdv=null; while(Date.now()-t0<6000){ await sleep(50); if(w.__clicks.length){tAdv=Date.now()-t0;break;} }
  // expected ~3.2-3.6s (2 real loops, swaps do not reset); old code resets count on swap -> ~4.4s+
  ok('T3 videoLoops=2 with 2 <video> remounts -> advance time', tAdv!==null && tAdv>2700 && tAdv<4000, `advanced at ${tAdv}ms (expect ~3300)`);
  // and with no swaps loops=1 advances after ~1 loop
  w.close();
  const r=load({items, cfg:{config:{videoLoops:1, delayAfterVideo:0}}}); const s2=r.T.grokGetPlaylistStructure(); r.T.grokStartGallerySlideshowFrom(s2.items[0]);
  const t1=Date.now(); let ta=null; while(Date.now()-t1<4000){ await sleep(50); if(r.w.__clicks.length){ta=Date.now()-t1;break;} }
  ok('T3b videoLoops=1 no swaps -> advance time', ta!==null && ta>1000 && ta<2200, `advanced at ${ta}ms (expect ~1500)`); r.w.close();
  // ended (non-looping) video counted once per loop
  const r3=load({items, cfg:{config:{videoLoops:3, delayAfterVideo:0}}}); 
  r3.w.__mountVideo(U(0),{loop:false}); const s3=r3.T.grokGetPlaylistStructure();
  r3.T.grokStartGallerySlideshowFrom(s3.items[0]); await sleep(50); r3.w.__mountVideo(U(0),{loop:false});
  const t3=Date.now(); let tb=null; while(Date.now()-t3<6000){ await sleep(50); if(r3.w.__clicks.length){tb=Date.now()-t3;break;} }
  ok('T3c non-looping video, videoLoops=3 -> not instant', tb!==null && tb>3000, `advanced at ${tb}ms (expect ~3600)`); r3.w.close(); }
async function t4(){ // prev in random uses history
  const items=[0,1,2,3,4,5,6,7].map(i=>({uuid:U(i),convId:'c1'}));
  const {w,T}=load({items, cfg:{grpMode:'seq',itemMode:'rnd',config:{videoLoops:999}}});
  const st=T.grokGetPlaylistStructure(); T.grokStartGallerySlideshowFrom(st.items[0]); await sleep(800);
  const seq=[U(0)];
  for(let k=0;k<4;k++){ w.__clicks.length=0; T.triggerNextSlide('auto'); await sleep(750); seq.push(w.__clicks[0]); }
  const back=[]; for(let k=0;k<3;k++){ w.__clicks.length=0; T.playerStepSlide('prev'); await sleep(750); back.push(w.__clicks[0]); }
  const expect=[seq[3],seq[2],seq[1]];
  ok('T4 random: prev x3 retraces history', JSON.stringify(back)===JSON.stringify(expect), `shown=${seq.map(x=>x&&x.slice(7,8))} back=${back.map(x=>x&&x.slice(7,8))}`);
  w.close(); }
async function t5(){ // manual pick then next -> picked+1
  const items=Array.from({length:12},(_,i)=>({uuid:U(i),convId:'c1'}));
  for(const mode of ['seq','off']){
    const {w,T}=load({items, cfg:{grpMode:mode,itemMode:'fwd',config:{videoLoops:999}}});
    const st=T.grokGetPlaylistStructure(); T.grokStartGallerySlideshowFrom(st.items[3]); await sleep(800);
    T.triggerNextSlide('auto'); await sleep(10);            // a step to 4 is in flight...
    T.grokStartGallerySlideshowFrom(st.items[10]);           // ...user picks item 10
    setTimeout(()=>T.triggerNextSlide('stale-timer'),60);   // stale trigger from previous slide
    await sleep(900); w.__clicks.length=0;
    T.triggerNextSlide('auto'); await sleep(400);
    ok(`T5 grpMode=${mode}: pick #10 then next -> #11`, w.__clicks[0]===U(11), `next=${w.__clicks[0]&&parseInt(w.__clicks[0].slice(0,8))}`);
    w.close(); }
}
(async()=>{ console.log(OLD?'=== OLD BUNDLE '+process.env.BUNDLE:'=== NEW BUNDLE');
  await t1(); await t2(); await t3(); await t4(); await t5();
  console.log(results.filter(r=>r[0]==='FAIL').length+' failed of '+results.length); process.exit(0); })();
