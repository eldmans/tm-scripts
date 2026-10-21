// v1.3.68 — «Применить на всех сайтах» / «Сохранить как умолчание». Run: node v168_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ openSettingsWindow, mossadHkSiteKeys, mossadHkSetSite, mossadHkGlobalTable, Settings };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v168.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const B=(key)=>({key,ctrl:false,alt:false,shift:false});
const siteGm=(w)=>JSON.parse(w.__gm.mossad_hk_site||'{}'); const glob=(w)=>JSON.parse(w.__gm.mossad_hk_global||'{}');
const preSites={'grok.com':{hk:{grokCycle:B('\\'),sound:B('F10')},order:['grokCycle','sound']},'pinterest.com':{hk:{pinFullScale:B('F2'),sound:B('F9')},order:['pinFullScale','sound']},'example.org':{hk:{snapWidget:B('F6')},order:['snapWidget']}};
(async()=>{ try {
 let gmAfter;
 { const {w,T}=load({items,url:'https://grok.com/imagine',preGm:{mossad_hk_site:JSON.stringify(preSites)}}); await sleep(80); const P=w.__P; const d=w.document;
   T.config.hk.snapWidget=B('F4'); T.config.hk.history=B('F8');
   P.openSettingsWindow('hotkeys'); await sleep(30); const m=d.getElementById('mossad-hk-modal');
   ok('1a two buttons: «Применить на всех сайтах» + «Сохранить как умолчание»', m.querySelector('#mossad-hk-apply-all').textContent==='Применить на всех сайтах' && m.querySelector('#mossad-hk-save-defaults').textContent==='Сохранить как умолчание');
   let asked=''; w.confirm=(t)=>{asked=t;return false;};
   const before=JSON.stringify(siteGm(w)); m.querySelector('#mossad-hk-apply-all').click(); await sleep(10);
   ok('1b confirm shown; Cancel → nothing changed', /Применить на всех сайтах\?/.test(asked) && /не изменятся/.test(asked) && JSON.stringify(siteGm(w))===before && glob(w).snapWidget?.key!=='F4');
   w.confirm=()=>true; m.querySelector('#mossad-hk-apply-all').click(); await sleep(10);
   const g=glob(w), s=siteGm(w);
   ok('2a global = effective of this site (incl. own: sound F10, grokCycle \\\\)', g.snapWidget.key==='F4' && g.sound.key==='F10' && g.grokCycle.key==='\\' && g.history.key==='F8', JSON.stringify({s:g.snapWidget,so:g.sound,c:g.grokCycle}));
   ok('2b this site keeps its section (own actions stay own)', JSON.stringify(Object.keys(s['grok.com'].hk))==='["grokCycle","sound"]' && P.mossadHkSiteKeys().length===2 && P.mossadHkGlobalTable().sound.key==='F10');
   ok('2c other site override of a common action gets the pushed key (pinterest sound F9→F10; example.org snapWidget F6→F4), section kept', s['pinterest.com'].hk.sound.key==='F10' && s['example.org'].hk.snapWidget.key==='F4' && s['pinterest.com'].order.join()==='pinFullScale,sound');
   ok('2d site-only action of another site keeps its key (pinterest pinFullScale F2)', s['pinterest.com'].hk.pinFullScale.key==='F2');
   ok('2e reset baseline NOT changed', !w.__gm.mossad_hk_defaults);
   // clash: pushed history F7 vs pinterest's own pinFullScale F7 → cleared
   T.config.hk.history=B('F2'); m.querySelector('#mossad-hk-apply-all').click(); await sleep(10);
   ok('3a site-only key that clashes with a pushed key is cleared on that site', !siteGm(w)['pinterest.com'].hk.pinFullScale.key && glob(w).history.key==='F2', JSON.stringify(siteGm(w)['pinterest.com'].hk.pinFullScale));
   // save as default
   T.config.hk.history=B('F8'); let asked2=''; w.confirm=(t)=>{asked2=t;return true;};
   m.querySelector('#mossad-hk-save-defaults').click(); await sleep(10);
   const rec=JSON.parse(w.__gm.mossad_hk_defaults||'null');
   ok('4a «Сохранить как умолчание»: confirm mentions reset baseline; pushed + baseline stored (effective incl. own sound F10)', /Сохранить как умолчание\?/.test(asked2) && /сброс/.test(asked2) && rec && rec.hk.sound.key==='F10' && rec.hk.history.key==='F8' && glob(w).history.key==='F8' && Array.isArray(rec.order));
   T.config.hk.sound=B('F11'); T.config.hk.history=B('F12'); m.querySelector('#mossad-hk-reset').click(); await sleep(10);
   ok('4b «Клавиши» reset returns to that baseline', T.config.hk.sound.key==='F10' && T.config.hk.history.key==='F8', JSON.stringify([T.config.hk.sound,T.config.hk.history]));
   w.confirm=()=>false; const r0=w.__gm.mossad_hk_defaults; T.config.hk.history=B('F3'); m.querySelector('#mossad-hk-save-defaults').click(); await sleep(10);
   ok('4c Cancel on «Сохранить как умолчание» → nothing', w.__gm.mossad_hk_defaults===r0 && glob(w).history.key==='F8');
   gmAfter=Object.assign({},w.__gm); }
 // another site picks it up
 { const {w,T}=load({items,url:'https://www.pinterest.com/',seedSiteHk:true,preGm:{mossad_hk_site:gmAfter.mossad_hk_site,mossad_hk_global:gmAfter.mossad_hk_global}}); await sleep(80);
   ok('5a Pinterest load: own sound = pushed F10, common snapWidget F4, own pinFullScale (cleared by clash) empty', T.config.hk.sound.key==='F10' && T.config.hk.snapWidget.key==='F4' && !T.config.hk.pinFullScale.key, JSON.stringify([T.config.hk.sound,T.config.hk.snapWidget,T.config.hk.pinFullScale])); }
 { const {w,T}=load({items,url:'https://news.site.io/',preGm:{mossad_sites:'["site.io"]',mossad_hk_global:gmAfter.mossad_hk_global}}); await sleep(80);
   ok('5b a site without own keys: all from pushed global', T.config.hk.sound.key==='F10' && T.config.hk.history.key==='F8'); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
