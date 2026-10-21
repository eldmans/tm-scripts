// v1.3.66 — light layer: DND Ctrl+click download / Ctrl+right-click menu. Run: node v166_test.js
const {loadLight,sleep}=require('./light_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const names=['mossadDndNormFolder','mossadDndFileName','mossadMediaAt','mossadCopyFrame','mossadLightRenderSettings','mossadDndCfg'];
const click=(w,el,o={})=>{ const e=new w.MouseEvent(o.type||'click',Object.assign({bubbles:true,cancelable:true,button:o.type==='contextmenu'?2:0,clientX:5,clientY:5},o)); el.dispatchEvent(e); return e; };
(async()=>{ try {
 { const {w,L,logs}=loadLight({names}); const d=w.document;
   ok('0a works on a NON-listed site (mossadMain not run)', !!L.mossadDndCfg && !d.getElementById('mossad-widget') && !logs.some(l=>/ERR/.test(l)), logs.filter(l=>/ERR/.test(l)).join('|'));
   ok('0b menu command registered', w.__menu.some(m=>/видео и DND/.test(m.t)));
   ok('0c folder normalize', L.mossadDndNormFolder('DND')==='DND/' && L.mossadDndNormFolder('/a\\b/../c/')==='a/b/c/' && L.mossadDndNormFolder('')==='');
   ok('0d filename from URL; ext added when missing', L.mossadDndFileName('https://x.com/i/cat.png?x=1')==='cat.png' && /\.mp4$/.test(L.mossadDndFileName('https://x.com/v/stream',{tagName:'VIDEO'})));
   d.body.innerHTML='<a href="/next"><img id="im" src="https://cdn.example.com/p/photo.jpg"></a><div id="plain">t</div>';
   const im=d.getElementById('im');
   let e=click(w,im); await sleep(20);
   ok('1a plain click untouched', !e.defaultPrevented && w.__dl.length===0);
   e=click(w,im,{ctrlKey:true}); await sleep(20);
   ok('1b Ctrl+click on image → GM_download into DND/, link not opened', e.defaultPrevented && w.__dl.length===1 && w.__dl[0].name==='DND/photo.jpg' && w.__dl[0].url==='https://cdn.example.com/p/photo.jpg', JSON.stringify(w.__dl));
   ok('1c success toast', /DND\/photo\.jpg/.test((d.getElementById('mossad-light-toast')||{}).textContent||''));
   e=click(w,d.getElementById('plain'),{ctrlKey:true}); ok('1d Ctrl+click not on media → untouched', !e.defaultPrevented && w.__dl.length===1);
   // overlay above media: elementsFromPoint
   d.body.insertAdjacentHTML('beforeend','<div id="ov"></div><video id="vid" src="https://cdn.example.com/v/clip.mp4"></video>');
   d.elementsFromPoint=()=>[d.getElementById('ov'),d.getElementById('vid'),d.body];
   e=click(w,d.getElementById('ov'),{ctrlKey:true}); await sleep(10);
   ok('1e overlay over video: media found under cursor', w.__dl.length===2 && w.__dl[1].name==='DND/clip.mp4');
   // context menu
   e=click(w,d.getElementById('ov'),{type:'contextmenu',ctrlKey:true}); const m=d.getElementById('mossad-dnd-menu');
   ok('2a Ctrl+right-click → menu Скачать / Папка… / Копировать кадр', e.defaultPrevented && m && /Скачать/.test(m.textContent) && /Папка/.test(m.textContent) && /Копировать кадр/.test(m.textContent));
   w.prompt=()=>'Media\\Pins'; m.querySelector('[data-dnd="folder"]').click();
   ok('2b Папка… saves normalized folder globally', L.mossadDndCfg().folder==='Media/Pins/' && !d.getElementById('mossad-dnd-menu'));
   click(w,d.getElementById('ov'),{type:'contextmenu',ctrlKey:true}); d.getElementById('mossad-dnd-menu').querySelector('[data-dnd="dl"]').click(); await sleep(10);
   ok('2c Скачать from menu uses new folder', w.__dl[2] && w.__dl[2].name==='Media/Pins/clip.mp4');
   const e2=click(w,d.getElementById('ov'),{type:'contextmenu'}); ok('2d plain right-click untouched', !e2.defaultPrevented);
   await sleep(10); w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'})); ok('2e Esc closes menu', !d.getElementById('mossad-dnd-menu'));
   // copy frame: jsdom canvas has no 2d context → readable toast, no exception
   const v=d.getElementById('vid'); Object.defineProperty(v,'videoWidth',{value:640}); Object.defineProperty(v,'videoHeight',{value:360});
   L.mossadCopyFrame(v); await sleep(20); ok('3a copy frame failure → clear toast, no crash', /Кадр/.test(d.getElementById('mossad-light-toast').textContent), d.getElementById('mossad-light-toast').textContent);
   // tainted canvas simulation
   w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}}); w.HTMLCanvasElement.prototype.toBlob=function(){ const er=new Error('The operation is insecure.'); er.name='SecurityError'; throw er; };
   L.mossadCopyFrame(v); await sleep(20); ok('3b CORS-tainted → «защищает кадр (CORS)» toast', /CORS/.test(d.getElementById('mossad-light-toast').textContent));
   w.HTMLCanvasElement.prototype.toBlob=function(cb){ cb(new w.Blob(['x'],{type:'image/png'})); }; let wrote=null;
   w.ClipboardItem=function(o){this.o=o;}; Object.defineProperty(w.navigator,'clipboard',{value:{write:(a)=>{wrote=a;return Promise.resolve();}},configurable:true});
   L.mossadCopyFrame(v); await sleep(20); ok('3c ClipboardItem path writes PNG', wrote && wrote[0].o['image/png'] && /скопирован/.test(d.getElementById('mossad-light-toast').textContent));
   // disabled
   w.__gm.mossad_dnd=JSON.stringify({enabled:false,folder:'DND/'}); const n=w.__dl.length; e=click(w,im,{ctrlKey:true}); ok('4a disabled → Ctrl+click passes to site', !e.defaultPrevented && w.__dl.length===n);
   // settings render
   const box=d.createElement('div'); d.body.appendChild(box); L.mossadLightRenderSettings(box);
   ok('5a settings section renders (enabled + folder)', box.querySelector('[data-dnd-cfg="enabled"]') && box.querySelector('[data-dnd-cfg="folder"]').value==='DND/');
   w.__menu.find(m=>/DND/.test(m.t)).f(); ok('5b menu command opens floating panel', !!d.getElementById('mossad-light-panel'));
 }
 // MOSSAD settings tab on a listed site
 { const {load}=require('./ss_harness'); const {w,T}=load({items:[{uuid:'00000001-0000-4000-8000-000000000000',convId:'c'}]}); await sleep(80);
   T.openSettingsWindow('video'); await sleep(20);
   ok('6a MOSSAD settings tab «🎬 Видео» shows the DND section', !!w.document.querySelector('#mossad-hk-modal [data-pane="video"] [data-light="dnd"]')); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
