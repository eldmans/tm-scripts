// v1.3.74 — модификаторы тегов шаблона (--минус, [[слова]], [символы]) + минус-слова сайта. Run: node v174_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ renderFilenameTemplate, buildFilenameVars, mossadTemplateUnknownTags, mossadTemplateTagIssues, mossadTplScan, mossadParseJunkList, mossadSetJunkText, mossadJunkText, mossadToggleTplHelp, getDefaultFilenameTemplate, openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v174.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 const {w}=load({items}); await sleep(80); const P=w.__P;
 const T='Pppe 062 en - Watch Online - Brave';
 const v=P.buildFilenameVars({postId:'abcdef1234567890',title:T,desc:'one two three four five',junk:''});
 const R=(t)=>P.renderFilenameTemplate(t,v,false,'','mp4');
 ok('1a minus single', R('{title--Watch Online}')==='Pppe 062 en - Brave.jpg', R('{title--Watch Online}'));
 ok('1b minus multiple + case-insensitive', R('{title--watch online--BRAVE}')==='Pppe 062 en.jpg', R('{title--watch online--BRAVE}'));
 ok('1c quoted minus with own dashes', R('{title--" - Brave"}')==='Pppe 062 en - Watch Online.jpg', R('{title--" - Brave"}'));
 ok('1d all occurrences', P.renderFilenameTemplate('{desc--o}',P.buildFilenameVars({desc:'foo boo',junk:''}),false,'','mp4')==='f b.jpg', P.renderFilenameTemplate('{desc--o}',P.buildFilenameVars({desc:'foo boo',junk:''}),false,'','mp4'));
 ok('2a [[2]] first 2 words', R('{desc[[2]]}')==='one two.jpg', R('{desc[[2]]}'));
 ok('2b [[-2]] last 2', R('{desc[[-2]]}')==='four five.jpg', R('{desc[[-2]]}'));
 ok('2c [[2:]] drop first 2', R('{desc[[2:]]}')==='three four five.jpg', R('{desc[[2:]]}'));
 ok('2d [[:-2]] drop last 2', R('{desc[[:-2]]}')==='one two three.jpg', R('{desc[[:-2]]}'));
 ok('2e [[1:3]] slice', R('{desc[[1:3]]}')==='two three.jpg', R('{desc[[1:3]]}'));
 ok('2f original separators kept', R('{title[[3:5]]}')==='Watch Online.jpg' && R('{title[[2:4]]}')==='en - Watch.jpg', R('{title[[2:4]]}'));
 ok('3a old {id8} / {id[4]} still work', R('{id8}')==='abcdef12.jpg' && R('{id[4]}')==='abcd.jpg', R('{id8}'));
 ok('3b combination {title--Watch Online[[3]][40]}', R('{title--Watch Online[[3]][40]}')==='Pppe 062 en.jpg', R('{title--Watch Online[[3]][40]}'));
 ok('3c fixed order regardless of writing: chars after words', R('{title[5][[2]]}')==='Pppe .jpg'.replace(' .','.') , R('{title[5][[2]]}'));
 { const h=P.renderFilenameTemplate('{hf}-{space}-{subtype}-{id8}.{ext}',v,false,'','mp4'); ok('3d HF default template still renders', /^HF-.*abcdef12\.jpg$/.test(h), h); }
 const un=P.mossadTemplateUnknownTags('{id8}-{foo}{bar3}{desc5}{title--x}{title[[2]]}{title[[x]]}{title-x}',v);
 ok('4a unknown/bad tags detected, new syntax understood', JSON.stringify(un)==='["{foo}","{bar3}","{title[[x]]}","{title-x}"]', JSON.stringify(un));
 ok('4b bad tag dropped from name', R('{id8}~{title[[x]]}')==='abcdef12.jpg', R('{id8}~{title[[x]]}'));
 ok('4c scan respects nested braces', P.mossadTplScan('a{x{2}}b').length===3);
 // junk list
 ok('5a junk list parse with quotes', JSON.stringify(P.mossadParseJunkList('Watch Online, " - Brave", ,HD, HD'))==='["Watch Online"," - Brave","HD"]', JSON.stringify(P.mossadParseJunkList('Watch Online, " - Brave", ,HD, HD')));
 P.mossadSetJunkText('Watch Online, " - Brave"');
 const v2=P.buildFilenameVars({postId:'x',title:T,desc:'Clip watch online'});
 ok('5b junk removed from title and desc always', v2.title==='Pppe 062 en' && v2.desc==='Clip', v2.title+' | '+v2.desc);
 ok('5c junk stored per site (GM key by domain)', P.mossadJunkText()==='Watch Online, " - Brave"');
 // settings field
 P.openSettingsWindow('general'); await sleep(20); const d=w.document; const jf=d.getElementById('mossad-gen-junk');
 ok('6a settings field near template', jf && jf.value==='Watch Online, " - Brave"' && jf.parentNode.previousElementSibling.querySelector('#mossad-gen-tpl'));
 jf.value='Foo'; jf.dispatchEvent(new w.Event('input')); ok('6b field saves', P.mossadJunkText()==='Foo');
 // help popup
 const inp=d.getElementById('mossad-gen-tpl'); inp.value='{title--Watch Online}{nope}';
 P.mossadToggleTplHelp(d.body, inp); await sleep(100); const box=d.getElementById('mossad-tpl-help');
 ok('7a help explains modifiers', box && /Модификаторы/.test(box.textContent) && box.querySelector('[data-th-ins="{title[[-2]]}"]') && box.querySelector('[data-th-ins=\'{title--" - Brave"}\']'));
 ok('7b preview marks bad tag red, good tag blue', /line-through[^>]*>\{nope\}/.test(box.querySelector('[data-th="tpl"]').innerHTML.replace(/title="[^"]*"/g,'')) && /#93c5fd;">\{title--Watch Online\}/.test(box.querySelector('[data-th="tpl"]').innerHTML));
 inp.value=''; box.querySelector('[data-th-ins="{title[[2]]}"]').click(); ok('7c click example inserts', inp.value==='{title[[2]]}', inp.value);
 const jb=box.querySelector('[data-th="junk"]'); ok('7d junk field in popup', jb && jb.value==='Foo');
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
