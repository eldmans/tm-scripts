// v1.3.54: проверка сжатия бандла (только CI, владельцу Node не нужен).
// Сравнивает AST несжатой сборки (python build.py --check --raw-out=raw.js) и mossad.user.js
// без позиций: совпадают — значит, сжатие убрало только комментарии/пробелы, код и строки те же.
// Запуск: NODE_PATH=<путь к node_modules с acorn@8> node tools/check_strip.js raw.js mossad.user.js
const acorn = require('acorn');
const fs = require('fs');
const norm = f => JSON.stringify(
    acorn.parse(fs.readFileSync(f, 'utf8'), { ecmaVersion: 'latest' }),
    (k, v) => (k === 'start' || k === 'end') ? undefined
        : typeof v === 'bigint' ? v + 'n' : v instanceof RegExp ? String(v) : v);
const a = norm(process.argv[2]), b = norm(process.argv[3]);
if (a !== b) {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.error('STRIP CHECK FAILED: AST differs near', JSON.stringify(a.slice(Math.max(0, i - 150), i + 150)));
    process.exit(1);
}
console.log(`STRIP CHECK OK: AST raw == bundle (${a.length} chars of AST JSON)`);
