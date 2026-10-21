// v1.3.65 — separator when inserting template tags. Run: node v165_test.js
const fs=require('fs'); const path=require('path');
const src=fs.readFileSync(process.env.BUNDLE_SRC||require('path').join(__dirname,'..','mossad.user.js'),'utf8');
const extra=`window.__P={ mossadTplInsertText, mossadTplSep, openSettingsWindow };\n`;
const i0=src.lastIndexOf('} // /mossadMain'); const tmp=path.join(__dirname,'.bundle_v165.js');
fs.writeFileSync(tmp, src.slice(0,i0)+extra+src.slice(i0)); process.env.BUNDLE=tmp;
const {load,sleep,U}=require('./ss_harness');
const res=[]; const ok=(n,c,i='')=>{res.push(c);console.log(c?'PASS':'FAIL',n,c?'':i);};
const items=[{uuid:U(1),convId:'c'}];
(async()=>{ try {
 const {w,T}=load({items}); await sleep(80); const P=w.__P, d=w.document;
 ok('1a empty field → no separator', P.mossadTplInsertText('','{id}','~')==='{id}');
 ok('1b ends with tag } → separator first', P.mossadTplInsertText('{conv4}','{id4}','~')==='~{id4}');
 ok('1c ends with separator → none', P.mossadTplInsertText('{conv4}-','{id4}','~')==='{id4}' && P.mossadTplInsertText('{conv4}~','{id4}','~')==='{id4}');
 ok('1d ends with plain text → separator', P.mossadTplInsertText('abc','{id4}','~')==='~{id4}');
 ok('1e empty separator → none', P.mossadTplInsertText('{a}','{b}','')==='{b}');
 ok('1f default separator ~', P.mossadTplSep()==='~');
 P.openSettingsWindow('general'); await sleep(20);
 const inp=d.getElementById('mossad-gen-tpl'); inp.value='{conv4}'; inp.setSelectionRange(7,7);
 d.querySelector('.mossad-tpl-help-btn[data-for="mossad-gen-tpl"]').click(); await sleep(30);
 const box=d.getElementById('mossad-tpl-help'); const sep=box.querySelector('[data-th="sep"]');
 ok('2a separator input at top of popup, value ~', sep && sep.value==='~' && box.textContent.indexOf('Разделитель')<box.textContent.indexOf('Шаблон:'));
 box.querySelector('[data-th-ins]').click();
 ok('2b click inserts ~{tag}', /^\{conv4\}~\{[a-z]+\}$/.test(inp.value), inp.value);
 sep.value='_'; sep.dispatchEvent(new w.Event('input'));
 ok('2c separator stored globally (GM)', w.__gm.mossad_tpl_sep==='_');
 inp.setSelectionRange(inp.value.length,inp.value.length); box.querySelector('[data-th-ins]').click();
 ok('2d new separator used', /\}_\{[a-z]+\}$/.test(inp.value), inp.value);
 } catch(e){ console.log('FAIL exception', e.stack); res.push(false); }
 const f=res.filter(x=>!x).length; console.log(`\n${res.length-f}/${res.length} passed`); process.exit(f?1:0);
})();
