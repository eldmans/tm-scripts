// v1.3.55 — Pinterest ratio balancing + manual navigation during slideshow. Run: node v155_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ pinterestPhotoProbability, pinterestChooseCandidate, pinterestRecordShown };\n`;
const i0=src.lastIndexOf(src.includes('} // /mossadMain')?'} // /mossadMain':'})();'); const tmp=path.join(__dirname,'.bundle_v155.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:'x',convId:'c'}];
const URL0='https://www.pinterest.com/pin/111/';
const related=(n,start=900)=>Array.from({length:n},(_,k)=>`<div data-grid-item="true"><a href="/pin/${start+k}/"><img src="https://i.pinimg.com/236x/r${k}.jpg" width="236" height="300"></a></div>`).join('');
const PHOTO=(n='main')=>`<img elementtiming="closeup-image-main-MainPinImage" src="https://i.pinimg.com/736x/${n}.jpg">`;
const render=(w,main,rel)=>{ w.document.body.innerHTML=`<div role="main"><div data-test-id="closeup-body">${main}</div><div data-test-id="relatedPins">${rel}</div></div>`; };
const page=(main,rel,{dlHang=false}={})=>w=>{ render(w,main,rel); w.__dl=[];
  w.fetch=async(u)=>({ok:true,status:200,json:async()=>({resource_response:{status:'success',data:{id:'1',title:'p',images:{orig:{url:'https://i.pinimg.com/originals/aa/bb/cc/o.jpg'}}}}})});
  w.__dlHang=dlHang; w.eval(`GM_download=function(o){ window.__dl.push(o.url); if(!window.__dlHang) setTimeout(()=>o.onload&&o.onload(),10); };`); };
const spaGo=(w,id,rel)=>{ w.history.pushState(null,'',`/pin/${id}/`); render(w,PHOTO('m'+id),rel); };
const cfgKey='mossad_pinterest_com_config';
function sim(P,pct,D,balanced){ let h=[],ph=0,maxS=0,cur=0,prev=null;
  for(let i=0;i<D;i++){ const p=balanced?P(h,pct):pct/100; const x=Math.random()<p?'image':'video'; h.push(x); if(h.length>20)h.shift(); if(x==='image')ph++; cur=x===prev?cur+1:1; prev=x; if(cur>maxS)maxS=cur; }
  return {share:ph/D,maxS}; }
(async()=>{ try {
 // ---- 1. formula ----
 { const {w}=load({items,url:URL0,pre:page(PHOTO(),related(6))}); await sleep(200); const P=w.__P.pinterestPhotoProbability;
   const bal=Array(17).fill(0).map((_,i)=>i%2?'image':'video');
   const pv3=1-P([...bal,'image','image','image'],50), pv2=1-P([...bal,'video','image','image'],50), pv1=1-P([...bal,'video','video','image'],50);
   ok('1a 50/50: after 3 photos P(video)≈0.8, after 2 ≈0.64, single photo ≈0.5', pv3>0.75&&pv3<0.88 && pv2>0.58&&pv2<0.7 && pv1>0.4&&pv1<0.6, [pv3,pv2,pv1].map(x=>x.toFixed(2)).join(' '));
   const pp3=P([...bal,'image','video','video','video'],50); ok('1b symmetric: after 3 videos P(photo)≈0.8', pp3>0.75&&pp3<0.88, pp3.toFixed(2));
   ok('1c empty memory = target; 0% / 100% exact', P([],30)===0.3 && P(['image','image'],0)===0 && P(['video','video'],100)===1);
   // ---- 2. distribution over many draws ----
   for (const pct of [20,50,80]) {
     const b=sim(P,pct,20000,true), c=sim(P,pct,20000,false);
     ok(`2 ${pct}% photo: share ≈ target (${b.share.toFixed(3)}), max streak ${b.maxS} vs coin ${c.maxS}`, Math.abs(b.share-pct/100)<0.03 && b.maxS<c.maxS);
   }
   const b50=sim(P,50,20000,true); ok('2d 50/50 longest run bounded (≤ 8 in 20000 draws; coin flip ≈ 14)', b50.maxS<=8, String(b50.maxS));
 }
 // ---- 3. chooser uses memory (sessionStorage) ----
 { const {w,T}=load({items,url:URL0,pre:page(PHOTO(),related(6)),cfg:{config:{pinterestFilterType:'ratio',pinterestPhotoPercent:50}}}); await sleep(200); const P=w.__P;
   ['1','2','3'].forEach(id=>P.pinterestRecordShown(id,'image')); P.pinterestRecordShown('3','image');
   const mem=JSON.parse(w.sessionStorage.getItem('mossad_pin_types'));
   ok('3a memory: one entry per pin id, in sessionStorage', mem.length===3 && mem.every(x=>x.t==='image'), JSON.stringify(mem));
   const cands=Array.from({length:10},(_,k)=>({pinId:String(500+k),url:'https://www.pinterest.com/pin/'+(500+k)+'/',type:k%2?'video':'image'}));
   let v=0; for(let i=0;i<400;i++){ if(P.pinterestChooseCandidate(cands).target.type==='video') v++; }
   ok('3b after 3 photos the chooser picks video most of the time', v/400>0.75 && v/400<0.95, String(v/400));
 }
 // ---- 4. slideshow step records the actual type of the shown pin ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO(),related(6)),cfg:{config:{slideshowDelay:0}}}); await sleep(300);
   T.startSlideshow(); await sleep(1800);
   const mem=JSON.parse(w.sessionStorage.getItem('mossad_pin_types')||'[]');
   ok('4a shown photo pin 111 recorded as image', navs.length===1 && mem.length===1 && mem[0].id==='111' && mem[0].t==='image', JSON.stringify(mem));
 }
 // ---- 5. manual click DURING the wait for related pins ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO(),''),cfg:{config:{slideshowDelay:0}}}); await sleep(300);
   T.startSlideshow(); await sleep(1600);
   ok('5a waiting for related pins (no nav yet)', navs.length===0 && T.active);
   spaGo(w,222,''); await sleep(600);
   const h=T.config.pinterestHistory.map(u=>(u.match(/pin\/(\d+)/)||[])[1]);
   ok('5b new pin added to history after the old one, idx at top, no navigation of its own', JSON.stringify(h)==='["111","222"]' && T.config.pinterestHistoryIdx===1 && navs.length===0, JSON.stringify(h)+' navs='+navs.length);
   render(w,PHOTO('m222'),related(5,700)); await sleep(2500);
   const h2=T.config.pinterestHistory.map(u=>(u.match(/pin\/(\d+)/)||[])[1]);
   ok('5c slideshow continues FROM the new pin: exactly one navigation, to its related pin', navs.length===1 && T.active && h2.length===3 && h2[1]==='222' && /^7\d\d$/.test(h2[2]), JSON.stringify(h2)+' navs='+navs.length);
   const dead=JSON.parse(w.sessionStorage.getItem('mossad_pin_dead')||'[]');
   ok('5d old pin not marked as dead end, no "шаг назад"', !dead.includes('111') && !dead.includes('222'), JSON.stringify(dead));
   await sleep(16000);
   ok('5e stale wait of the old pin never fires (still one navigation after 15 s+)', navs.length===1, 'navs='+navs.length);
 }
 // ---- 6. manual click during a photo countdown (general case) ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO(),related(5)),cfg:{config:{slideshowDelay:3}}}); await sleep(300);
   T.startSlideshow(); await sleep(1200);
   spaGo(w,333,related(5,600)); await sleep(1500);
   ok('6a countdown restarted on the new pin (no step yet)', navs.length===0 && T.active, 'navs='+navs.length);
   await sleep(3500);
   const h=T.config.pinterestHistory.map(u=>(u.match(/pin\/(\d+)/)||[])[1]);
   ok('6b next step goes from the new pin: one navigation, history 111 → 333 → 6xx', navs.length===1 && JSON.stringify(h.slice(0,2))==='["111","333"]' && /^6\d\d$/.test(h[2]), JSON.stringify(h)+' navs='+navs.length);
 }
 // ---- 7. manual click while the step waits for the download (8 s safety timer) ----
 { const {w,T,navs}=load({items,url:URL0,pre:page(PHOTO(),related(5),{dlHang:true}),cfg:{config:{slideshowDelay:0,downloadType:'all'}}}); await sleep(300);
   T.config.downloadType='all'; T.startSlideshow(); await sleep(1500);
   ok('7a download started, step waiting for it', w.__dl.length>=1 && navs.length===0, JSON.stringify(w.__dl));
   spaGo(w,444,related(5,800)); await sleep(7200);
   ok('7b old step\'s safety timer (8 s) does NOT step from the new pin', navs.length===0, 'navs='+navs.length);
   await sleep(3000);
   const h=T.config.pinterestHistory.map(u=>(u.match(/pin\/(\d+)/)||[])[1]);
   ok('7c the new pin\'s own step proceeds afterwards (one navigation, from 444)', navs.length===1 && h.includes('444') && /^8\d\d$/.test(h[h.length-1]), JSON.stringify(h)+' navs='+navs.length);
 }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
