// v1.3.50: список сайтов (суффикс, GM mossad_sites, миграция), команда меню TM, Delete на не-Grok, вкладка «🌍 Сайты»
const {load,U,sleep}=require('./ss_harness');
const {JSDOM, VirtualConsole}=require('jsdom'); const fs=require('fs');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,i);};
const items=[0].map(i=>({uuid:U(i),convId:'c1'}));
const bundle=fs.readFileSync(process.env.BUNDLE||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const menuStub=(w)=>{ w.__menu=[]; w.__unreg=[]; let id=0; w.eval(`function GM_registerMenuCommand(t,f){ if(/^🎬/.test(t)){ window.__lightMenu=(window.__lightMenu||0)+1; return 999; } const i=++window.__menuId; window.__menu.push({t,f,i}); return i } function GM_unregisterMenuCommand(i){ window.__unreg.push(i); window.__menu=window.__menu.filter(m=>m.i!==i) } window.__menuId=0;`); };
// Голая загрузка для сайта не из списка (harness ждёт __T, а там скрипт выходит сразу)
function bare(url, preGm={}, preLs={}){
  const vc=new VirtualConsole(); const dom=new JSDOM('<!doctype html><body><p id="x">hi</p></body>',{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window; w.__gm=Object.assign({},preGm); for(const [k,v] of Object.entries(preLs)) w.localStorage.setItem(k,v);
  w.eval(`function GM_getValue(k,d){return k in window.__gm?window.__gm[k]:d} function GM_setValue(k,v){window.__gm[k]=v} function GM_addValueChangeListener(){window.__gml=(window.__gml||0)+1} var GM_info={script:{version:'test'}};`);
  menuStub(w);
  let listeners=0; const P=w.EventTarget.prototype, a=P.addEventListener;
  w.__ls=[]; P.addEventListener=function(t){ const st=new Error().stack.split('\n').slice(2).join(' | '); if(!/node_modules/.test(st.split(' | ')[0])) { listeners++; w.__ls.push(t+' @ '+st.slice(0,200)); } return a.apply(this,arguments); }; // jsdom сам вешает 'load'
  const before=w.document.querySelectorAll('*').length;
  w.eval(bundle);
  return {w, listeners, gml:w.__gml||0, domAdded: w.document.querySelectorAll('*').length-before};
}
(async()=>{ try {
 // ---- 1. not listed: only menu command ----
 let b=bare('https://example.org/page');
 ok('1a non-listed: one menu command «➕ Добавить этот сайт в MOSSAD»', b.w.__menu.length===1 && b.w.__menu[0].t==='➕ Добавить этот сайт в MOSSAD', JSON.stringify(b.w.__menu.map(m=>m.t)));
 ok('1b non-listed: no DOM, only the light layer (v1.3.66 click+contextmenu, v1.3.67 keydown/pointermove/ratechange/play, 🎬 menu), ≤1 GM listener (speed cfg cache), no floating button', b.domAdded===0 && b.w.__ls.every(l=>/^(click|contextmenu|keydown|pointermove|ratechange|play) /.test(l)) && b.listeners<=6 && b.w.__lightMenu===1 && b.gml<=1 && !b.w.document.getElementById('mossad-add-site'), JSON.stringify({d:b.domAdded,l:b.listeners,g:b.gml,ls:b.w.__ls}));
 { const g=bare('https://grok.com/imagine'); ok('1b2 counter sanity: listed site does add listeners', g.listeners>0, String(g.listeners)); }
 let asked=''; b.w.confirm=(m)=>{asked=m; return false;};
 b.w.__menu[0].f();
 ok('1c menu click adds to GM mossad_sites + asks reload', JSON.parse(b.w.__gm.mossad_sites).includes('example.org') && /перезагрузить/i.test(asked));
 ok('1d menu re-registered as «➖ Убрать этот сайт из MOSSAD»', b.w.__unreg.length===1 && b.w.__menu.length===1 && b.w.__menu[0].t==='➖ Убрать этот сайт из MOSSAD');
 b.w.__menu[0].f();
 ok('1e «➖» removes it again', JSON.parse(b.w.__gm.mossad_sites).length===0 && b.w.__menu[0].t==='➕ Добавить этот сайт в MOSSAD');
 // www. stripped on add
 b=bare('https://www.foo-bar.net/'); b.w.confirm=()=>false; b.w.__menu[0].f();
 ok('1f www. stripped when adding current site', b.w.__gm.mossad_sites==='["foo-bar.net"]', b.w.__gm.mossad_sites);
 // ---- 2. suffix matching ----
 b=bare('https://grok.com.evil.net/');
 ok('2a grok.com.evil.net NOT allowed (was includes)', b.w.__menu[0].t.startsWith('➕') && b.domAdded===0);
 b=bare('https://notgrok.com/');
 ok('2b notgrok.com NOT allowed', b.w.__menu[0].t.startsWith('➕'));
 b=bare('https://sub.example.org/', {mossad_sites:'["example.org"]'});
 ok('2c subdomain of user site allowed (menu «➖»)', b.w.__menu[0].t.startsWith('➖'));
 b=bare('https://example.org.evil.io/', {mossad_sites:'["example.org"]'});
 ok('2d example.org.evil.io NOT allowed', b.w.__menu[0].t.startsWith('➕'));
 // ---- 3. legacy per-site allowedDomains migration ----
 b=bare('https://legacy.example.com/', {}, {mossad_example_com_config: JSON.stringify({allowedDomains:['grok.com','legacy.example.com','https://other.io/path']})});
 ok('3a legacy allowedDomains migrated to GM (normalized, built-ins skipped)', JSON.stringify(JSON.parse(b.w.__gm.mossad_sites))==='["legacy.example.com","other.io"]', b.w.__gm.mossad_sites);
 ok('3b legacy site allowed right away; legacy-only localStorage removed', b.w.__menu[0].t.startsWith('➖') && b.w.localStorage.getItem('mossad_example_com_config')===null);
 b=bare('https://a.example.com/', {}, {mossad_example_com_config: JSON.stringify({allowedDomains:['a.example.com'], videoLoops:3})});
 ok('3c other keys kept, allowedDomains stripped', JSON.stringify(JSON.parse(b.w.localStorage.getItem('mossad_example_com_config')))==='{"videoLoops":3}');
 // ---- 4. full harness on listed sites ----
 let {w,T}=load({items, url:'https://grok.com/imagine/post/'+U(0), pre:menuStub}); await sleep(600);
 ok('4a built-in site: menu «🌍 Сайты MOSSAD»', w.__menu.length===1 && w.__menu[0].t==='🌍 Сайты MOSSAD');
 ok('4b pure helpers', T.mossadHostMatches('m.pinterest.com','pinterest.com') && !T.mossadHostMatches('pinterest.com.evil','pinterest.com') && T.mossadNormSite(' HTTPS://www.Ex.com:8080/a?b ')==='ex.com' && T.mossadNormSite('a b')==='' && T.mossadNormSite('*.x.io')==='x.io');
 let e=new w.KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true,cancelable:true}); w.document.body.dispatchEvent(e);
 ok('4c Grok post: Delete handled (preventDefault)', e.defaultPrevented);
 w.close();
 ({w,T}=load({items, url:'https://www.redgifs.com/watch/abc', pre:menuStub})); await sleep(600);
 e=new w.KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true,cancelable:true}); w.document.body.dispatchEvent(e);
 ok('4d non-Grok (redgifs): Delete passes through to site', !e.defaultPrevented);
 const inp=w.document.createElement('input'); w.document.body.appendChild(inp); inp.focus();
 e=new w.KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true,cancelable:true}); inp.dispatchEvent(e);
 ok('4e non-Grok input: Delete not swallowed', !e.defaultPrevented);
 w.close();
 // ---- 5. sites tab ----
 ({w,T}=load({items, url:'https://sub.mysite.io/x', pre:menuStub, preGm:{mossad_sites:'["mysite.io","zzz.org"]'}})); await sleep(600);
 ok('5a user site loads full MOSSAD; menu «➖»', !!T && w.__menu[0].t==='➖ Убрать этот сайт из MOSSAD');
 T.openSettingsWindow('general'); let m=w.document.getElementById('mossad-hk-modal');
 ok('5b sites pane lazy (empty until opened)', m.querySelector('[data-pane="sites"]').innerHTML==='' && !!m.querySelector('[data-tab="sites"]') && m.querySelector('[data-tab="sites"]').textContent==='🌍 Сайты');
 m.querySelector('[data-tab="sites"]').click();
 const pane=m.querySelector('[data-pane="sites"]');
 ok('5c built-ins read-only, user sites with ✕, current marked', pane.querySelectorAll('#mossad-sites-builtin > div').length===9 && !pane.querySelector('#mossad-sites-builtin [data-site-del]') && pane.querySelectorAll('#mossad-sites-user [data-site-del]').length===2 && /здесь/.test(pane.querySelector('[data-site="mysite.io"]').textContent));
 ok('5d «➕ Этот сайт» disabled (already listed); reload hint shown', pane.querySelector('#mossad-sites-add-current').disabled && /перезагрузи/i.test(pane.textContent));
 const ti=pane.querySelector('#mossad-sites-input'); ti.value='https://www.New-Site.com/a'; pane.querySelector('#mossad-sites-add').click();
 ok('5e add from input → normalized into GM + list', JSON.parse(w.__gm.mossad_sites).includes('new-site.com') && !!pane.querySelector('[data-site="new-site.com"]') && ti.value==='');
 ti.value='pinterest.com'; pane.querySelector('#mossad-sites-add').click();
 ok('5f built-in not duplicated into user list', !JSON.parse(w.__gm.mossad_sites).includes('pinterest.com') && /встроенный/.test(pane.querySelector('#mossad-sites-status').textContent));
 ti.value='bad domain!'; pane.querySelector('#mossad-sites-add').click();
 ok('5g garbage rejected', /Не похоже/.test(pane.querySelector('#mossad-sites-status').textContent));
 pane.querySelector('[data-site-del="mysite.io"]').click();
 ok('5h ✕ removes; menu flips to «➕»; add-current re-enabled', !JSON.parse(w.__gm.mossad_sites).includes('mysite.io') && w.__menu[w.__menu.length-1].t.startsWith('➕') && !pane.querySelector('#mossad-sites-add-current').disabled);
 pane.querySelector('#mossad-sites-add-current').click();
 ok('5i «➕ Этот сайт» adds sub.mysite.io', JSON.parse(w.__gm.mossad_sites).includes('sub.mysite.io'));
 // remote change → rerender
 w.__gm.mossad_sites='["only.one"]'; (w.__gmL.mossad_sites||[]).forEach(f=>f('mossad_sites','x','["only.one"]',true));
 ok('5j GM change from another tab re-renders list', pane.querySelectorAll('#mossad-sites-user [data-site]').length===1 && !!pane.querySelector('[data-site="only.one"]'));
 T.closeSettingsWindow(true);
 const lsCfg=JSON.parse(w.localStorage.getItem('mossad_mysite_io_config')||'{}');
 ok('5k allowedDomains not written to per-site localStorage', !('allowedDomains' in lsCfg) && !('allowedDomains' in T.config));
 ok('5l labels', T.L('tabSites')==='🌍 Сайты' && T.L('sitesAddCurrent')==='➕ Этот сайт');
} catch(err){ console.log('FAIL exception', err && err.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
