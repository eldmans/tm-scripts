// v1.3.53 — filename template. Run: node v153_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ getDefaultFilenameTemplate, renderFilenameTemplate, buildFilenameVars, mossadTemplateUnknownTags, mossadFilenameContext, grokFilenameContext, grokAccountEmail, grokRefreshAccount, triggerDownload, mossadToggleTplHelp, mossadSaveSiteTemplate, MOSSAD_TPL_TAGS };\n`;
const i0=src.lastIndexOf(src.includes('} // /mossadMain')?'} // /mossadMain':'})();'); const tmp=path.join(__dirname,'.bundle_v153.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
const OLD='{id8}-{domain[4]}~{RadugaStud}';
const PIN='1137088605945274141', URLR=`https://ru.pinterest.com/pin/${PIN}/`;
const H='dde055aabbccddeeff00112233445566', HLS=`https://v1.pinimg.com/videos/iht/hls/dd/e0/55/${H}.m3u8`;
const api=(title)=>({resource_response:{status:'success',data:{id:PIN,title:'',grid_title:title,images:{orig:{url:'https://i.pinimg.com/originals/aa/bb/cc/cover.jpg'}},
  story_pin_data:{pages:[{blocks:[{video:{video_list:{V_HLSV3_MOBILE:{url:HLS,width:720,height:1280,duration:14233}}}}]}]}}}});
const BODY=`<div role="main"><div data-grid-item="true"><video data-test-id="duplo-hls-video" elementtiming="closeup-video-main-MainPinImage" src="blob:https://ru.pinterest.com/main"></video></div></div>`;
const pinSetup=(title)=>w=>{ w.document.body.innerHTML=BODY; w.__dl=[]; w.__fetches=0;
  w.fetch=async()=>{ w.__fetches++; return {ok:true,status:200,json:async()=>api(title)}; };
  w.eval(`GM_download=function(o){ window.__dl.push(o.name); setTimeout(()=>o.onload&&o.onload(),10); };`); };
(async()=>{ try {
 // ---- 1. domain word / domainfull / date on ru.pinterest.com ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('t')}); await sleep(200); const P=w.__P;
   const v=P.buildFilenameVars({postId:PIN,type:'photo',ext:'jpg'});
   ok('1a {domain}=pinterest, {domainfull}=pinterest.com on ru. subdomain', v.domain==='pinterest' && v.domainfull==='pinterest.com', v.domain+'/'+v.domainfull);
   ok('1b {date} = dd.mm.yy', /^\d\d\.\d\d\.\d\d$/.test(v.date), v.date);
   ok('1c default template (non-Grok) = {id8}-{domain}, no {date}/{desc}', P.getDefaultFilenameTemplate()==='{id8}-{domain}');
   ok('1d default name', P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v,false,'','jpg')==='11370886-pinterest.jpg', P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v,false,'','jpg'));
   ok('1e DEFAULT_CONFIG template empty (= site default)', T.config.filenameTemplate==='', T.config.filenameTemplate);
   // ---- 2. ext rule ----
   const R=(t,e='jpg')=>P.renderFilenameTemplate(t,v,false,'',e);
   ok('2a dot in name is not an extension: {id8}.final → .final.jpg', R('{id8}.final')==='11370886.final.jpg', R('{id8}.final'));
   ok('2b name ending with date dd.mm.yy still gets .jpg', /^11370886-\d\d\.\d\d\.\d\d\.jpg$/.test(R('{id8}-{date}')), R('{id8}-{date}'));
   ok('2c already ends with known ext → not doubled', R('{id8}.jpg')==='11370886.jpg' && R('{id8}.MP4','mp4')==='11370886.MP4', R('{id8}.jpg')+' '+R('{id8}.MP4','mp4'));
   ok('2d aliases + case: {UUID8}-{Site}-{HASH[4]}', R('{UUID8}-{Site}-{HASH[4]}')==='11370886-pinterest-1137.jpg', R('{UUID8}-{Site}-{HASH[4]}'));
   // ---- 3. unknown tags ----
   ok('3a unknown tag dropped + separators cleaned', R('{id8}-{RadugaStud}~{foo}')==='11370886.jpg', R('{id8}-{RadugaStud}~{foo}'));
   const un=P.mossadTemplateUnknownTags('{id8}-{foo}{bar3}{desc5}',v);
   ok('3b unknown tag list', JSON.stringify(un)==='["{foo}","{bar3}"]', JSON.stringify(un));
   ok('3c long name capped to 200 + ext', R('{id}'.repeat(20)).length<=204, String(R('{id}'.repeat(20)).length));
   const d2=P.renderFilenameTemplate('{id8}-{dbl}',P.buildFilenameVars({postId:PIN,dblSuffix:' (abc) DBL'}),true,' (abc) DBL','jpg');
   ok('3d {dbl} kept once, before extension', d2==='11370886- (abc) DBL.jpg' || d2==='11370886-(abc) DBL.jpg' || /DBL\.jpg$/.test(d2) && d2.split('DBL').length===2, d2);
 }
 // ---- 4. migration of the old default ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('t'),preLs:{mossad_pinterest_com_config:JSON.stringify({filenameTemplate:OLD,slideshowDelay:4})},
     preGm:{'mossad_tpl_pinterest.com':OLD, mossad_global_defaults:JSON.stringify({filenameTemplate:OLD,videoLoops:3})}}); await sleep(100);
   const ls=JSON.parse(w.localStorage.getItem('mossad_pinterest_com_config'));
   const gd=JSON.parse(w.__gm.mossad_global_defaults);
   ok('4a old default → "" in config, saved site config, GM site tpl, GM defaults', T.config.filenameTemplate==='' && ls.filenameTemplate==='' && w.__gm['mossad_tpl_pinterest.com']==='' && gd.filenameTemplate==='' && gd.videoLoops===3 && ls.slideshowDelay===4, JSON.stringify([T.config.filenameTemplate,ls,w.__gm['mossad_tpl_pinterest.com'],gd]));
 }
 { const {T}=load({items,url:URLR,pre:pinSetup('t'),preGm:{'mossad_tpl_pinterest.com':'{id8}-mine'}}); await sleep(50);
   ok('4b custom GM template kept', T.config.filenameTemplate==='{id8}-mine', T.config.filenameTemplate); }
 // ---- 5. {desc} from Pinterest API, sanitized, truncation, real download uses shared vars ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('Do you: like/flared "sleeves"?  The Willow top...')}); await sleep(200); const P=w.__P;
   T.config.filenameTemplateEnabled=true; T.config.filenameTemplate='{desc}';
   P.triggerDownload(); await sleep(400);
   ok('5a {desc} from API grid_title, Windows-safe', w.__dl[0]==='Do you like flared sleeves The Willow top.mp4', JSON.stringify(w.__dl));
   ok('5c API fetched once for resolve + download', w.__fetches===1, String(w.__fetches));
 }
 for (const [tpl,exp,name] of [['{desc10}_{id8}-{domain}-{domainfull}','Do you lik_11370886-pinterest-pinterest.com.mp4','5b {descN} truncation + domain/domainfull in real download'],
                               ['{description}{account}','Do you like flared sleeves The Willow top.mp4','5d {description} alias; {account} empty off Grok']]) {
   const {w,T}=load({items,url:URLR,pre:pinSetup('Do you: like/flared "sleeves"?  The Willow top...')}); await sleep(200);
   T.config.filenameTemplateEnabled=true; T.config.filenameTemplate=tpl; w.__P.triggerDownload(); await sleep(400);
   ok(name, w.__dl[0]===exp, JSON.stringify(w.__dl));
 }
 // ---- 6. Grok default with {account} ----
 { const {w,T}=load({items,preLs:{mossad_grok_account:'me@example.com'}}); await sleep(200); const P=w.__P;
   ok('6a Grok default = {id8}-{domain}~{account}', P.getDefaultFilenameTemplate()==='{id8}-{domain}~{account}');
   const v=P.buildFilenameVars(P.grokFilenameContext({type:'video',ext:'mp4'}));
   ok('6b Grok vars: domain=grok, account from cache', v.domain==='grok' && v.account==='me@example.com' && v.id===U(1), JSON.stringify([v.domain,v.account,v.id]));
   ok('6c Grok default name', P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v,false,'','mp4')===`${U(1).slice(0,8)}-grok~me@example.com.mp4`, P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v,false,'','mp4'));
 }
 { const {w}=load({items,pre:w=>{ w.__f=0; w.fetch=async(u)=>{ w.__f++; w.__fu=String(u); return {ok:true,json:async()=>({user:{profile:{email:'acc@grok.test'}}})}; }; }}); await sleep(100); const P=w.__P;
   const v0=P.buildFilenameVars(P.grokFilenameContext({type:'photo',ext:'jpg'}));
   ok('6d empty account → "{id8}-grok" (trailing ~ cleaned)', P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v0,false,'','jpg')===`${U(1).slice(0,8)}-grok.jpg`, P.renderFilenameTemplate(P.getDefaultFilenameTemplate(),v0,false,'','jpg'));
   const e=await P.grokRefreshAccount(false); const e2=await P.grokRefreshAccount(false);
   ok('6e /rest/user once per session, email deep-found, cached in localStorage', e==='acc@grok.test' && e2==='acc@grok.test' && w.__f===1 && w.__fu==='/rest/user' && w.localStorage.getItem('mossad_grok_account')==='acc@grok.test', JSON.stringify([e,e2,w.__f]));
 }
 { const {w}=load({items,pre:w=>{ w.fetch=async()=>({ok:false,json:async()=>null}); }}); await sleep(50);
   const b=w.document.createElement('button'); b.setAttribute('aria-label','Account dom@user.io'); w.document.body.appendChild(b);
   ok('6f DOM fallback (aria-label with e-mail)', w.__P.grokAccountEmail()==='dom@user.io', w.__P.grokAccountEmail()); }
 // ---- 7. "?" popup ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('Willow top')}); await sleep(200); const P=w.__P;
   T.config.filenameTemplateEnabled=true;
   w.widgetState='panel'; w.updateWidgetUI(); await sleep(50);
   const inp=w.document.getElementById('mossad-in-fn-tpl'); const btn=w.document.querySelector('.mossad-tpl-help-btn[data-for="mossad-in-fn-tpl"]');
   ok('7a "?" button next to panel template input', !!inp && !!btn && btn.textContent==='?');
   btn.click(); await sleep(300);
   const box=()=>w.document.getElementById('mossad-tpl-help');
   const nm=()=>box().querySelector('[data-th="name"]').textContent;
   ok('7b popup opens, preview = real default name', !!box() && nm()==='11370886-pinterest.mp4', box()&&nm());
   ok('7c tag table: aliases + N range', /\{desc\[1\.\.10\]\}/.test(box().textContent) && /\{description\}/.test(box().textContent) && /\{id\[1\.\.19\]\}/.test(box().textContent), box().textContent.slice(0,400));
   inp.value='{desc}-{bogus}'; inp.dispatchEvent(new w.Event('input')); await sleep(10);
   const warn=box().querySelector('[data-th="warn"]');
   ok('7d live recompute + unknown tag red warning', nm()==='Willow top.mp4' && warn.style.display!=='none' && /\{bogus\}/.test(warn.textContent) && /f87171/.test(box().querySelector('[data-th="tpl"]').innerHTML), nm()+' | '+warn.textContent);
   inp.value=''; inp.setSelectionRange(0,0); box().querySelector('[data-th-ins="{id}"]').click(); await sleep(10);
   ok('7e click tag inserts into template + saves', inp.value==='{id}' && T.config.filenameTemplate==='{id}' && nm()==='1137088605945274141.mp4', inp.value+' / '+T.config.filenameTemplate+' / '+nm());
   w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   ok('7f Esc closes', !box());
   inp.dispatchEvent(new w.Event('input')); ok('7g listeners removed (no reopen)', !box());
   btn.click(); await sleep(50); ok('7h reopen', !!box());
   w.document.body.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
   ok('7i outside pointerdown closes', !box());
   btn.click(); await sleep(20); btn.click(); ok('7j second click on "?" toggles closed', !box());
 }
 // ---- 8. settings window per-site field + GM tpl sync ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('x'),preGm:{'mossad_tpl_pinterest.com':'{id8}-g'}}); await sleep(200);
   T.openSettingsWindow(); await sleep(50);
   const f=w.document.getElementById('mossad-gen-tpl'); const b=w.document.querySelector('.mossad-tpl-help-btn[data-for="mossad-gen-tpl"]');
   ok('8a per-site template field + "?" in settings', !!f && !!b && f.value==='{id8}-g' && f.placeholder==='{id8}-{domain}', f&&f.value);
   f.value='{id8}-{desc}'; f.dispatchEvent(new w.Event('change'));
   ok('8b saving updates config and existing GM site template', T.config.filenameTemplate==='{id8}-{desc}' && w.__gm['mossad_tpl_pinterest.com']==='{id8}-{desc}', T.config.filenameTemplate+' / '+w.__gm['mossad_tpl_pinterest.com']);
   b.click(); await sleep(300); const box=w.document.getElementById('mossad-tpl-help');
   ok('8c "?" from settings opens popup; Esc closes popup only, not settings', !!box && (w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})),true) && !w.document.getElementById('mossad-tpl-help') && !!w.document.getElementById('mossad-hk-modal'));
   const dbtn=w.document.querySelector('.mossad-tpl-help-btn[data-for="mossad-def-filenameTemplate"]');
   ok('8d "?" next to template in 🌐 defaults tab', !!dbtn && w.document.getElementById('mossad-def-filenameTemplate').placeholder==='пусто = шаблон сайта');
 }
 // ---- 9. no-template name on Pinterest uses id8-domainClean (unchanged) & desc not in defaults ----
 { const {w,T}=load({items,url:URLR,pre:pinSetup('Willow')}); await sleep(200);
   T.config.filenameTemplateEnabled=false; w.__P.triggerDownload(); await sleep(400);
   ok('9a template off → legacy {id8}-{root} name', w.__dl[0]==='11370886-pinterest.com.mp4', JSON.stringify(w.__dl)); }
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
