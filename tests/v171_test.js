// v1.3.71 — кнопки «По умолчанию» в рамке, розовая «Для всех {домен}», красная «Сохранить как умолчание» с окном выбора. Run: node v171_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ openSettingsWindow, mossadHkSiteKeys, mossadHkGlobalTable, getHotkeyPinned, saveHotkeyPinned };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v171.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const B=(key)=>({key,ctrl:false,alt:false,shift:false});
const siteGm=(w)=>JSON.parse(w.__gm.mossad_hk_site||'{}'); const glob=(w)=>JSON.parse(w.__gm.mossad_hk_global||'{}');
const preSites={'grok.com':{hk:{grokCycle:B('\\')},order:['grokCycle']},'pinterest.com':{hk:{pinFullScale:B('F2'),sound:B('F9')},order:['pinFullScale','sound']}};
const kd=(w,el,key)=>el.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
(async()=>{ try {
 const {w,T}=load({items,url:'https://grok.com/imagine',preGm:{mossad_hk_site:JSON.stringify(preSites)}}); await sleep(80); const P=w.__P; const d=w.document;
 P.openSettingsWindow('hotkeys'); await sleep(30); const m=d.getElementById('mossad-hk-modal');
 const box=m.querySelector('#mossad-hk-defaults-box');
 ok('1a frame contains label «По умолчанию» on top + Клавиши + Порядок', box && /border/.test(box.getAttribute('style')) && box.firstElementChild.textContent==='По умолчанию' && box.querySelector('#mossad-hk-reset') && box.querySelector('#mossad-hk-order-reset') && box.style.alignItems==='center');
 const pink=m.querySelector('#mossad-hk-apply-domain');
 ok('1b pink «Для всех grok» outside the frame', pink && pink.textContent==='Для всех grok' && !box.contains(pink) && /#831843/i.test(pink.getAttribute('style')));
 const red=m.querySelector('#mossad-hk-save-defaults');
 ok('1c «Сохранить как умолчание» is red, blue «Применить на всех сайтах» kept', /#7f1d1d/.test(red.getAttribute('style')) && m.querySelector('#mossad-hk-apply-all').textContent==='Применить на всех сайтах');
 // pink
 T.config.hk.history=B('F8'); w.confirm=()=>false; pink.click(); await sleep(5);
 ok('2a pink Cancel → nothing', P.mossadHkSiteKeys().join()==='grokCycle');
 const g0=w.__gm.mossad_hk_global; w.confirm=(t)=>/Для всех grok\?/.test(t); pink.click(); await sleep(5);
 const s=siteGm(w)['grok.com'];
 ok('2b pink: all actions own for grok.com with current keys; global & defaults untouched', P.mossadHkSiteKeys().length>10 && s.hk.history.key==='F8' && s.hk.grokCycle.key==='\\' && w.__gm.mossad_hk_global===g0 && !w.__gm.mossad_hk_defaults && !w.__gm.mossad_hk_defaults_site, JSON.stringify(Object.keys(s.hk)));
 ok('2c other site untouched', JSON.stringify(siteGm(w)['pinterest.com'])===JSON.stringify(preSites['pinterest.com']));
 // red dialog
 red.click(); await sleep(5); let dlg=d.getElementById('mossad-hk-defdlg');
 ok('3a dialog: «Вы уверены? Вы точно уверены?» + 4 choices, domain green', dlg && /Вы уверены\? Вы точно уверены\?/.test(dlg.textContent) && dlg.querySelectorAll('[data-mode]').length===4 && /#065f46/.test(dlg.querySelector('[data-mode=domain]').getAttribute('style')) && dlg.querySelector('[data-mode=domain]').textContent==='Для grok.com');
 kd(w,dlg.querySelector('[data-mode]'),'Escape'); await sleep(5);
 ok('3b Esc closes only the dialog, settings stay open', !d.getElementById('mossad-hk-defdlg') && d.getElementById('mossad-hk-modal'));
 // domain: no math
 T.config.hk.history=B('F7'); red.click(); dlg=d.getElementById('mossad-hk-defdlg'); dlg.querySelector('[data-mode=domain]').click(); await sleep(5);
 const sd=JSON.parse(w.__gm.mossad_hk_defaults_site||'{}');
 ok('4a «Для grok.com» saves site baseline without math, no broadcast', !d.getElementById('mossad-hk-defdlg') && sd['grok.com'] && sd['grok.com'].hk.history.key==='F7' && !w.__gm.mossad_hk_defaults);
 w.confirm=()=>true; T.config.hk.history=B('F3'); m.querySelector('#mossad-hk-reset').click(); await sleep(5);
 ok('4b reset «Клавиши» returns to the domain baseline', T.config.hk.history.key==='F7', JSON.stringify(T.config.hk.history));
 // all: math required
 T.config.hk.history=B('F6'); red.click(); dlg=d.getElementById('mossad-hk-defdlg'); dlg.querySelector('[data-mode=all]').click(); await sleep(5);
 const sum=+dlg.dataset.sum; const q=dlg.querySelector('[data-q]').textContent; const [x,y]=q.match(/(\d+) \+ (\d+)/).slice(1).map(Number);
 ok('5a math step: two-digit addends, sum matches', x>=10&&x<=99&&y>=10&&y<=99&&x+y===sum && dlg.querySelector('[data-step=math]').style.display==='block');
 const inp=dlg.querySelector('[data-ans]'); inp.value=String(sum+1); dlg.querySelector('[data-ok]').click(); await sleep(5);
 ok('5b wrong answer → dialog stays, nothing saved', d.getElementById('mossad-hk-defdlg') && !w.__gm.mossad_hk_defaults);
 inp.value=String(sum); kd(w,inp,'Enter'); await sleep(5);
 const rec=JSON.parse(w.__gm.mossad_hk_defaults||'null');
 ok('5c right answer (Enter) → ДЛЯ ВСЕГО: pushed + defaults', !d.getElementById('mossad-hk-defdlg') && rec && rec.hk.history.key==='F6' && glob(w).history.key==='F6' && !rec.only && d.getElementById('mossad-hk-modal'));
 // unpinned
 P.saveHotkeyPinned(['history']); T.config.hk.history=B('F5'); T.config.hk.sound=B('F11');
 red.click(); dlg=d.getElementById('mossad-hk-defdlg'); dlg.querySelector('[data-mode=unpinned]').click(); dlg.querySelector('[data-ans]').value=dlg.dataset.sum; dlg.querySelector('[data-ok]').click(); await sleep(5);
 const r2=JSON.parse(w.__gm.mossad_hk_defaults);
 ok('6a НЕ ЗАКРЕПЛЁННЫХ: pinned history keeps old default and global; unpinned sound pushed', r2.hk.history.key==='F6' && r2.hk.sound.key==='F11' && Array.isArray(r2.only) && !r2.only.includes('history') && glob(w).history.key==='F6' && glob(w).sound.key==='F11' && siteGm(w)['pinterest.com'].hk.sound.key==='F11', JSON.stringify([r2.hk.history,glob(w).history]));
 // common
 T.config.hk.sound=B('F12'); red.click(); dlg=d.getElementById('mossad-hk-defdlg'); dlg.querySelector('[data-mode=common]').click(); dlg.querySelector('[data-ans]').value=dlg.dataset.sum; dlg.querySelector('[data-ok]').click(); await sleep(5);
 const r3=JSON.parse(w.__gm.mossad_hk_defaults);
 ok('7a ОБЩИХ: defaults saved, other sites not pushed', r3.id!==r2.id && siteGm(w)['pinterest.com'].hk.sound.key==='F11');
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
