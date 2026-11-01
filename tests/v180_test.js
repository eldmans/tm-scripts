// v1.3.80 — BSH (слайдшоу галереи Grok): звук/громкость сохраняются между слайдами. Run: node v180_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ grokSoundMarkGesture, grokReadSoundPref, toggleGrokSound };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v180.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'},{uuid:U(2),convId:'c'},{uuid:U(3),convId:'c'}];
const ev=(w,el,t)=>el.dispatchEvent(new w.Event(t));
(async()=>{ try {
 { const {w,T}=load({items}); await sleep(80); const d=w.document; const P=w.__P;
   w._mossadGalleryActive=true;
   // mock Grok mute button: toggles the current video (one toggle per gesture, like React)
   d.body.insertAdjacentHTML('beforeend','<button id="mb" aria-label="Unmute"></button>'); let clicks=0, last=0;
   d.getElementById('mb').addEventListener('click',()=>{ const n=Date.now(); if(n-last<5) return; last=n; clicks++; const v=d.querySelector('video'); v.muted=!v.muted; ev(w,v,'volumechange'); });
   const v1=d.querySelector('video'); v1.muted=true;
   ok('0 no preference at start', P.grokReadSoundPref()===null);
   P.grokSoundMarkGesture(); v1.muted=false; ev(w,v1,'volumechange');
   ok('1 user unmutes the playing slide → remembered {muted:false}', P.grokReadSoundPref() && P.grokReadSoundPref().muted===false, w.sessionStorage.getItem('mossad_grok_sound_pref'));
   // next slide: Grok mounts a new muted <video>
   const v2=w.__mountVideo(U(2)); v2.muted=true; ev(w,v2,'play'); await sleep(200);
   ok('2a new slide gets the sound back (via player button)', v2.muted===false && clicks===1, `${v2.muted} ${clicks}`);
   v2.muted=true; ev(w,v2,'volumechange'); // Grok re-mutes right after start (no user gesture)
   ok('2b Grok re-mute is not taken as user choice', P.grokReadSoundPref().muted===false);
   await sleep(1000); ok('2c re-check restores sound after Grok re-mute', v2.muted===false, v2.muted);
   // young video + gesture (e.g. "next" key) must not overwrite the choice
   P.grokSoundMarkGesture(); const v3=w.__mountVideo(U(3)); v3.muted=true; ev(w,v3,'volumechange');
   ok('3 volumechange of a fresh slide (<700ms) ignored', P.grokReadSoundPref().muted===false);
   ev(w,v3,'play'); await sleep(200); ok('3b fresh slide unmuted', v3.muted===false);
   // volume
   await sleep(800); P.grokSoundMarkGesture(); v3.volume=0.4; ev(w,v3,'volumechange');
   ok('4a volume remembered', Math.abs(P.grokReadSoundPref().volume-0.4)<0.001, JSON.stringify(P.grokReadSoundPref()));
   const v4=w.__mountVideo(U(1)); v4.muted=false; v4.volume=1; ev(w,v4,'play'); await sleep(50);
   ok('4b volume applied to next slide', Math.abs(v4.volume-0.4)<0.001, v4.volume);
   // hotkey path: toggleGrokSound remembers immediately
   await sleep(800); P.toggleGrokSound(); await sleep(250);
   ok('5 sound hotkey (toggleGrokSound) remembers muted', v4.muted===true && P.grokReadSoundPref().muted===true, `${v4.muted} ${JSON.stringify(P.grokReadSoundPref())}`);
   const v5=w.__mountVideo(U(2)); v5.muted=false; ev(w,v5,'play'); await sleep(250);
   ok('5b next slide muted too', v5.muted===true);
   // off when slideshow not running
   w._mossadGalleryActive=false; const v6=w.__mountVideo(U(3)); v6.muted=false; ev(w,v6,'play'); await sleep(250);
   ok('6 not in slideshow → video untouched', v6.muted===false);
   // option off
   w._mossadGalleryActive=true; T.config.grokKeepSound=false; const v7=w.__mountVideo(U(1)); v7.muted=false; ev(w,v7,'play'); await sleep(250);
   ok('7 grokKeepSound=false → untouched', v7.muted===false);
 }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
