// v1.3.75 — теги со страницы: {meta:…}, {ld:…}, {css:…}, {re:…} + список в окне «?». Run: node v175_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||path.join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ renderFilenameTemplate, buildFilenameVars, mossadTemplateUnknownTags, mossadTemplateTagIssues, mossadPageTagCatalog, mossadToggleTplHelp };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v175.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 const {w}=load({items}); await sleep(80); const P=w.__P; const d=w.document;
 const head=d.head;
 head.insertAdjacentHTML('beforeend','<meta property="og:title" content="Pppe 062 en"/><meta name="twitter:Title" content="TW: a/b"/>');
 const sc=d.createElement('script'); sc.type='application/ld+json';
 sc.textContent=JSON.stringify([{"@context":"https://schema.org","@type":"WebPage","name":"Site page"},
   {"@context":"https://schema.org","@type":"VideoObject","name":"Pppe 062 en","description":"Pppe 062 en watch online hight quality video","author":{"@type":"Person","name":"Bob"},"thumbnailUrl":["t1.jpg","t2.jpg"]}]);
 head.appendChild(sc);
 const sc2=d.createElement('script'); sc2.type='application/ld+json'; sc2.textContent='{"@graph":[{"@type":"Organization","name":"Org","logo":{"url":"L"}}]}'; head.appendChild(sc2);
 d.body.insertAdjacentHTML('beforeend','<div class="info"><h1 class="t--x"> Big  Title </h1><span itemprop="name">Span Name</span><video poster="p.jpg"></video></div>');
 const v=P.buildFilenameVars({postId:'abcdef1234567890',junk:''});
 const R=(t)=>P.renderFilenameTemplate(t,v,false,'','mp4');
 ok('1a {meta:og:title}', R('{meta:og:title}')==='Pppe 062 en.jpg', R('{meta:og:title}'));
 ok('1b meta name= case-insensitive + safe name', R('{meta:twitter:title}')==='TW a b.jpg', R('{meta:twitter:title}'));
 ok('2a {ld:name} prefers VideoObject', R('{ld:name}')==='Pppe 062 en.jpg', R('{ld:name}'));
 ok('2b {ld:description--…}', R('{ld:description--watch online hight quality video}')==='Pppe 062 en.jpg', R('{ld:description--watch online hight quality video}'));
 ok('2c dotted path + array index + array default', R('{ld:author.name}~{ld:thumbnailUrl.1}~{ld:thumbnailUrl}')==='Bob~t2.jpg~t1.jpg', R('{ld:author.name}~{ld:thumbnailUrl.1}~{ld:thumbnailUrl}'));
 ok('2d @graph searched as fallback', R('{ld:logo.url}')==='L.jpg', R('{ld:logo.url}'));
 ok('3a {css:h1} trimmed', R('{css:h1}')==='Big Title.jpg', R('{css:h1}'));
 ok('3b css with spaces and [attr]', R('{css:div.info [itemprop=name]}')==='Span Name.jpg', R('{css:div.info [itemprop=name]}'));
 ok('3c css @attr', R('{css:.info video@poster}')==='p.jpg', R('{css:.info video@poster}'));
 ok('3d quoted css with --, plus modifiers', R('{css:"h1.t--x"[[1]]}')==='Big.jpg', R('{css:"h1.t--x"[[1]]}'));
 ok('4a regex example', R('{re:ld:description/^(.+?) watch online/$1}')==='Pppe 062 en.jpg', R('{re:ld:description/^(.+?) watch online/$1}'));
 ok('4b groups any order, case-insensitive', R('{re:meta:og:title/^(\\w+) (\\d+)/$2 - $1}')==='062 - Pppe.jpg', R('{re:meta:og:title/^(\\w+) (\\d+)/$2 - $1}'));
 ok('4c nested braces in regex + no repl = group1', R('{re:ld:description/(\\d{3})}')==='062.jpg', R('{re:ld:description/(\\d{3})}'));
 ok('4d no match → empty; modifiers after extra /', R('{id4}~{re:title/zzz(q)/$1}')==='abcd.jpg' && R('{re:ld:description/^(.+) video$/$1/[[2]]}')==='Pppe 062.jpg', R('{re:ld:description/^(.+) video$/$1/[[2]]}'));
 const iss=P.mossadTemplateTagIssues('{re:title/(/$1}{css:##}{meta:}{ld:nothing}{meta:og:title[[2]]}',v);
 ok('5a invalid regex / selector flagged; missing page value is not an error', iss.length===3 && /регулярк/.test(iss[0].err) && /CSS/.test(iss[1].err), JSON.stringify(iss));
 ok('5b invalid regex → empty in name', R('{id4}~{re:title/(/$1}')==='abcd.jpg', R('{id4}~{re:title/(/$1}'));
 const cat=P.mossadPageTagCatalog(d);
 ok('6a catalog lists meta + ld fields', cat.meta.some(x=>x[0]==='og:title'&&x[1]==='Pppe 062 en') && cat.ld.some(x=>x[0]==='description') && cat.ld.some(x=>x[0]==='author.name'&&x[1]==='Bob') && !cat.ld.some(x=>x[0]==='@context'), JSON.stringify(cat.ld.slice(0,6)));
 ok('6b VideoObject fields first', cat.ld[0][0]==='@type' && cat.ld[0][1]==='VideoObject', JSON.stringify(cat.ld[0]));
 // popup
 const inp=d.createElement('input'); d.body.appendChild(inp); inp.value='{re:title/(/$1}';
 P.mossadToggleTplHelp(d.body, inp); await sleep(100); const box=d.getElementById('mossad-tpl-help');
 ok('7a help has page-tag syntax + example', /Теги со страницы/.test(box.textContent) && box.querySelector('[data-th-ins="{re:ld:description/^(.+?) watch online/$1}"]') && /\$2 - \$1/.test(box.textContent));
 ok('7b invalid regex red in preview', /line-through/.test(box.querySelector('[data-th="tpl"]').innerHTML) && /регулярк/.test(box.querySelector('[data-th="warn"]').textContent));
 const ins=box.querySelector('[data-th="pagelist"] [data-th-ins="{meta:og:title}"]');
 ok('7c page list shows meta with value', ins && /Pppe 062 en/.test(ins.closest('tr').textContent));
 inp.value=''; ins.click(); ok('7d click inserts page tag', inp.value==='{meta:og:title}', inp.value);
 ok('7e preview evaluates live', box.querySelector('[data-th="name"]').textContent==='Pppe 062 en.mp4' || /^Pppe 062 en\./.test(box.querySelector('[data-th="name"]').textContent), box.querySelector('[data-th="name"]').textContent);
 ok('7f ld field clickable', box.querySelector('[data-th="pagelist"] [data-th-ins="{ld:author.name}"]'));
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
