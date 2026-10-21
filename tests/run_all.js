// Запуск всех *_test.js по очереди. Использование: cd tests && npm install && node run_all.js [фильтр]
const {spawnSync}=require('child_process'); const fs=require('fs'); const path=require('path');
const filt=process.argv[2]||''; let failed=[];
for (const f of fs.readdirSync(__dirname).filter(n=>/_test\.js$/.test(n)&&n.includes(filt)).sort()) {
  const r=spawnSync(process.execPath,[path.join(__dirname,f)],{cwd:__dirname,encoding:'utf8',timeout:120000});
  const out=(r.stdout||'')+(r.stderr||''); const fails=(out.match(/^FAIL/mg)||[]).length;
  const bad=r.status!==0||fails>0; if(bad) failed.push(f);
  console.log((bad?'✗ ':'✓ ')+f+(bad?`  (exit ${r.status}, FAIL ${fails})`:''));
}
console.log(failed.length?`\nНе прошли: ${failed.join(', ')}`:'\nВсе тесты прошли.'); process.exit(failed.length?1:0);
