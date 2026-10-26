# -*- coding: utf-8 -*-
import os, sys, re, datetime

BANNER_FILE = "src/banner.js"
OUTPUT_FILE = "mossad.user.js"

# v1.3.54: GATE_MODULES выполняются на КАЖДОЙ странице (проверка сайта + команда меню Tampermonkey).
# Всё из MODULES build() кладёт внутрь `function mossadMain() { … }`, которая вызывается только после
# `if (!_isAllowed) return;` в domain.js. На сайтах не из списка V8 лишь пред-разбирает (pre-parse) её тело:
# ни байткода, ни сотен функций-замыканий, ни объектов верхнего уровня.
# ⚠️ Код в GATE_MODULES НЕ видит функций/переменных из MODULES (только наоборот) — см. src/core/boot.js.
GATE_MODULES = [
    # v1.3.66: лёгкий слой — работает на ВСЕХ страницах (до выхода «сайт не в списке»), держать крошечным
    "src/light/dnd.js",
    "src/light/speed.js",
    "src/light/ui.js",
    "src/core/domain.js",
]

MODULES = [
    "src/core/boot.js",
    "src/core/config.js",
    "src/core/sync.js",
    "src/core/utils.js",
    "src/ui/labels.js",
    "src/engines/noodle.js",
    "src/download/blob.js",
    "src/download/history.js",
    "src/download/metadata.js",
    "src/engines/grok/constants.js",
    "src/engines/grok/helpers.js",
    "src/engines/grok/sound.js",
    "src/engines/grok/upscale.js",
    "src/engines/grok/media.js",
    "src/engines/grok/download.js",
    "src/engines/grok/filmstrip.js",
    "src/engines/grok/navigation.js",
    "src/engines/grok/delete.js",
    "src/engines/grok/collect.js",
    "src/engines/grok/queue.js",
    "src/engines/grok/loop.js",
    "src/engines/grok/slideshow.js",
    "src/engines/grok/ui-bar.js",
    "src/engines/grok/ui-playlist.js",
    "src/engines/grok/prompt-cycle.js",
    "src/engines/grok/key-guard.js",
    "src/engines/instagram.js",
    "src/engines/redgifs.js",
    "src/engines/huggingface.js",
    "src/download/router.js",
    "src/slideshow/engine.js",
    "src/engines/pinterest.js",
    "src/engines/pinterest-keys.js",
    "src/ui/tpl-help.js",
    "src/ui/panel.js",
    "src/ui/todos.js",
    "src/ui/sites.js",
    "src/ui/settings-modal.js",
    "src/core/hotkeys.js"
]

# ── v1.3.54: облегчённый бандл ──────────────────────────────────────────────────────────────────
# STRIP_COMMENTS: из бандла выкидываются комментарии, отступы, пустые строки и повторные пробелы.
# Читаемый исходник остаётся в src/ — правки только там. Переносы строк между инструкциями сохраняются
# (ASI не меняется), содержимое строк/шаблонов `…`/регэкспов копируется байт-в-байт.
# Аварийный выключатель: STRIP_COMMENTS = False → `python build.py` (бандл станет как до v1.3.54, ~+40%).
STRIP_COMMENTS = True

_KW_BEFORE_REGEX = {"return", "typeof", "instanceof", "in", "of", "new", "delete", "void",
                    "throw", "case", "do", "else", "yield", "await"}
_PAREN_KW = {"if", "while", "for", "with"}
_PUNCT3 = (">>>=", "...", "===", "!==", "**=", "<<=", ">>=", ">>>", "&&=", "||=", "??=")
_PUNCT2 = ("=>", "==", "!=", "<=", ">=", "&&", "||", "??", "?.", "++", "--", "+=", "-=", "*=",
           "/=", "%=", "&=", "|=", "^=", "<<", ">>", "**")
_NL = "\n\u2028\u2029"
_WS = " \t\r\f\v\u00a0\ufeff"


class StripError(Exception):
    pass


def _is_word_char(c):
    return c.isalnum() or c in "_$\\" or ord(c) > 127 and c not in _NL and c not in _WS


def js_tokens(src, name="?"):
    """Минимальный JS-лексер: (текст, был_перенос_перед, был_пробел_перед). Комментарии/пробелы — не токены.
    Строки, шаблоны (вместе с ${…}) и регэкспы — одним токеном-куском. При любой странности — StripError."""
    toks = []
    i, n = 0, len(src)
    regex_ok = True
    stack = []          # '(' / '(kw' / '[' / '{' / '${'
    nl = sp = False
    last_word = None

    def err(msg, pos):
        line = src.count("\n", 0, pos) + 1
        raise StripError(f"{name}:{line}: {msg}")

    def scan_template(j):
        # j — позиция сразу после ` или после } закрывающего ${…}; возвращает (конец, закрыт_ли_шаблон)
        while j < n:
            c = src[j]
            if c == "\\":
                j += 2
            elif c == "`":
                return j + 1, True
            elif c == "$" and j + 1 < n and src[j + 1] == "{":
                return j + 2, False
            else:
                j += 1
        err("незакрытый шаблон `", j)

    while i < n:
        c = src[i]
        if c in _NL:
            nl = True; i += 1; continue
        if c in _WS:
            sp = True; i += 1; continue
        if c == "/" and src.startswith("//", i):
            while i < n and src[i] not in _NL:
                i += 1
            sp = True; continue
        if c == "/" and src.startswith("/*", i):
            j = src.find("*/", i + 2)
            if j < 0:
                err("незакрытый /* комментарий", i)
            if any(ch in src[i:j] for ch in _NL):
                nl = True
            sp = True; i = j + 2; continue
        start = i
        if c == "/" and regex_ok:
            j = i + 1; in_cls = False
            while True:
                if j >= n or src[j] in _NL:
                    err("незакрытый регэксп", i)
                ch = src[j]
                if ch == "\\":
                    j += 2; continue
                if ch == "[":
                    in_cls = True
                elif ch == "]":
                    in_cls = False
                elif ch == "/" and not in_cls:
                    break
                j += 1
            j += 1
            while j < n and (src[j].isalnum() or src[j] == "_"):
                j += 1
            i = j; regex_ok = False
        elif c in "'\"":
            j = i + 1
            while True:
                if j >= n or src[j] in "\n":
                    err("незакрытая строка", i)
                if src[j] == "\\":
                    j += 2; continue
                if src[j] == c:
                    break
                j += 1
            i = j + 1; regex_ok = False
        elif c == "`" or (c == "}" and stack and stack[-1] == "${"):
            if c == "}":
                stack.pop()
            j, closed = scan_template(i + 1)
            if not closed:
                stack.append("${")
            i = j; regex_ok = not closed
        elif _is_word_char(c):
            j = i
            while j < n and _is_word_char(src[j]):
                j += 1
            word = src[i:j]
            if j < n and src[j] == "." and word.isdigit():   # 1.5, 1.e3
                j += 1
                while j < n and _is_word_char(src[j]):
                    j += 1
            i = j
            regex_ok = word in _KW_BEFORE_REGEX and not (toks and toks[-1][0] in (".", "?."))
            last_word = word
            toks.append((src[start:i], nl, sp)); nl = sp = False
            continue
        else:
            tok = next((p for p in _PUNCT3 if src.startswith(p, i)), None) or \
                  next((p for p in _PUNCT2 if src.startswith(p, i)), None) or c
            if tok == "." and i + 1 < n and src[i + 1].isdigit():   # .5
                j = i + 1
                while j < n and _is_word_char(src[j]):
                    j += 1
                i = j; regex_ok = False
                toks.append((src[start:i], nl, sp)); nl = sp = False
                continue
            i += len(tok)
            if tok == "(":
                stack.append("(kw" if (toks and toks[-1][0] in _PAREN_KW) else "(")
                regex_ok = True
            elif tok == "[" or tok == "{":
                stack.append(tok); regex_ok = True
            elif tok in ")]}":
                want = {")": "(", "]": "[", "}": "{"}[tok]
                if not stack or stack[-1].rstrip("kw") != want:
                    err(f"непарная скобка {tok}", start)
                top = stack.pop()
                regex_ok = (tok == ")" and top == "(kw") or tok == "}"
            elif tok in ("++", "--"):
                regex_ok = False
            else:
                regex_ok = True
        toks.append((src[start:i], nl, sp)); nl = sp = False
    if stack:
        err(f"незакрытые скобки в конце файла: {''.join(stack)}", n)
    return toks


def strip_js(src, name="?"):
    """Выкинуть комментарии/отступы/пустые строки. Перенос строки сохраняется везде, где он был между
    токенами (ASI), пробел — одним символом. Проверка: токены до и после совпадают 1:1."""
    toks = js_tokens(src, name)
    out = []
    for k, (text, nl, sp) in enumerate(toks):
        if out:
            if nl:
                out.append("\n")
            elif sp:
                out.append(" ")
        out.append(text)
    res = "".join(out)
    again = js_tokens(res, name + " (после сжатия)")
    if [t[0] for t in again] != [t[0] for t in toks]:
        raise StripError(f"{name}: токены после сжатия не совпали — сжатие небезопасно")
    return res


def assemble(banner, gate_parts, main_parts, strip):
    """Бандл: шапка → IIFE → GATE_MODULES → `mossadMain();` → function mossadMain() { MODULES }."""
    def mod(path, text):
        if strip:
            return f"// ── {path} ──\n" + strip_js(text, path)
        return text
    gate = "\n\n".join(mod(p, t) for p, t in gate_parts)
    main = "\n\n".join(mod(p, t) for p, t in main_parts)
    code = banner + "\n\n(function () {\n    'use strict';\n\n"
    code += gate
    code += ("\n\n// ── v1.3.54: дальше — только на сайтах из списка (на остальных V8 тело лишь пред-разбирает) ──\n"
             "mossadMain();\nfunction mossadMain() {\n\n")
    code += main
    code += "\n\n} // /mossadMain\n})();\n"
    return code


def get_current_version():
    with open(BANNER_FILE, "r", encoding="utf-8") as f:
        m = re.search(r"//\s*@version\s+([\d\.]+)", f.read())
        return m.group(1) if m else "1.0.0"

def bump_version():
    old_ver = get_current_version()
    parts = [int(p) for p in old_ver.split(".")]
    parts[-1] += 1
    new_ver = ".".join(str(p) for p in parts)
    today = datetime.date.today().strftime("%Y-%m-%d")
    
    # 1. Update banner
    with open(BANNER_FILE, "r", encoding="utf-8") as f:
        banner = f.read()
    banner = re.sub(r"(//\s*@version\s+)[\d\.]+", rf"\g<1>{new_ver}", banner)
    with open(BANNER_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(banner)
        
    # 2. Update domain.js (SCRIPT_VERSION fallback)
    domain_path = "src/core/domain.js"
    if os.path.exists(domain_path):
        with open(domain_path, "r", encoding="utf-8") as f:
            d = f.read()
        d = re.sub(r"SCRIPT_VERSION\s*=\s*\(.*?\)\s*\?\s*GM_info\.script\.version\s*:\s*'[\d\.]+'",
                   rf"SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '{new_ver}'", d)
        with open(domain_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(d)
            
    # 3. Update settings-modal.js (footer date)
    panel_path = "src/ui/settings-modal.js"  # футер модалки настроек: vX.X.X · дата
    if os.path.exists(panel_path):
        with open(panel_path, "r", encoding="utf-8") as f:
            p = f.read()
        p = re.sub(r"v\$\{SCRIPT_VERSION\}\s*·\s*\d{4}-\d{2}-\d{2}", rf"v${{SCRIPT_VERSION}} · {today}", p)
        with open(panel_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(p)
            
    print(f"BUMPED: v{old_ver} -> v{new_ver} (date: {today})")
    return new_ver

def verify_syntax_node(code_str):
    """Кроссплатформенная проверка синтаксиса через `node --check`.
    Возвращает True/False, либо None если node не найден в PATH."""
    import shutil, subprocess, tempfile
    node_bin = shutil.which("node")
    if not node_bin:
        return None
    fd, temp_path = tempfile.mkstemp(prefix="mossad_syntax_", suffix=".js")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(code_str.encode("utf-8"))
        res = subprocess.run([node_bin, "--check", temp_path], capture_output=True, text=True,
                             encoding="utf-8", errors="ignore", timeout=60)
        if res.returncode != 0:
            print("CRITICAL ERROR: JS Syntax error detected (node --check):")
            print((res.stderr or res.stdout).strip())
            return False
        print("SYNTAX OK: node --check")
        return True
    except Exception as ex:
        print(f"Warning during node syntax check: {ex}")
        return None
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

def verify_syntax_browser(code_str):
    """Фолбэк для Windows: headless Chrome/Edge."""
    browsers = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    browser_bin = next((b for b in browsers if os.path.exists(b)), None)
    if not browser_bin:
        return None
    html = f"""<!DOCTYPE html>
<html><head><script>
window.__err = null;
window.addEventListener('error', function(e) {{ window.__err = e.message + ' at line ' + e.lineno; }});
</script><script>
{code_str}
</script></head><body><div id="res">CHECK</div><script>
document.getElementById("res").innerText = window.__err ? ("ERROR: " + window.__err) : "SUCCESS";
</script></body></html>"""
    temp_file = "temp_syntax_check.html"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            f.write(html)
        import subprocess
        res = subprocess.run([browser_bin, "--headless=new", "--dump-dom", temp_file], capture_output=True, text=True, encoding="utf-8", errors="ignore", timeout=10)
        if "ERROR:" in res.stdout:
            for l in res.stdout.splitlines():
                if "ERROR:" in l:
                    print(f"CRITICAL ERROR: JS Syntax error detected: {l.strip()}")
            return False
        print("SYNTAX OK: headless browser")
        return True
    except Exception as ex:
        print(f"Warning during syntax check: {ex}")
        return True
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

def verify_syntax(code_str):
    """Проверка синтаксиса: сначала `node --check` (любая ОС), затем Chrome/Edge (Windows).
    Если ни один инструмент не найден — предупреждение, сборка не блокируется
    (кроме режима --verify, см. build())."""
    res = verify_syntax_node(code_str)
    if res is None:
        res = verify_syntax_browser(code_str)
    if res is None:
        print("WARNING: syntax check skipped (no node in PATH, no Chrome/Edge found)")
        return None
    return res

def build():
    bump = "--bump" in sys.argv
    check_only = "--check" in sys.argv
    verify_only = "--verify" in sys.argv
    if verify_only and bump:
        print("ERROR: --verify нельзя совмещать с --bump")
        sys.exit(1)
    
    if bump:
        version = bump_version()
    else:
        version = get_current_version()
        
    with open(BANNER_FILE, "r", encoding="utf-8") as f:
        banner = f.read().strip()
        
    def read_parts(mods):
        parts = []
        for mod in mods:
            if not os.path.exists(mod):
                print(f"ERROR: Module not found: {mod}")
                sys.exit(1)
            with open(mod, "r", encoding="utf-8") as f:
                parts.append((mod, f.read().strip()))
        return parts
    gate_parts, main_parts = read_parts(GATE_MODULES), read_parts(MODULES)

    raw_out = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--raw-out=")), None)
    if raw_out:
        # Несжатая сборка (для проверки сжатия в CI: токены raw == токены бандла)
        with open(raw_out, "wb") as f:
            f.write(assemble(banner, gate_parts, main_parts, False).encode("utf-8"))
        print(f"RAW BUILD: {raw_out}")
    try:
        code = assemble(banner, gate_parts, main_parts, STRIP_COMMENTS)
    except StripError as ex:
        print(f"BUILD FAILED: сжатие бандла: {ex}")
        print("Если это ложная тревога лексера — STRIP_COMMENTS = False в build.py и пересобрать.")
        sys.exit(1)
    
    syntax_ok = verify_syntax(code)
    if syntax_ok is False:
        print("BUILD FAILED: Syntax verification failed! Fix the JavaScript error before building.")
        sys.exit(1)
    if syntax_ok is None and verify_only:
        print("VERIFY FAILED: no syntax checker available (install Node.js)")
        sys.exit(1)

    raw_bytes = code.encode("utf-8")
    
    required_emojis = ["❌", "✅", "🖼", "📹", "💾"]
    missing_emojis = [emo for emo in required_emojis if emo.encode("utf-8") not in raw_bytes]
    for emo in missing_emojis:
        print(f"WARNING: Emoji {emo} not found in output code!")
    if missing_emojis and verify_only:
        print("VERIFY FAILED: required emoji missing (UTF-8 corruption?)")
        sys.exit(1)
            
    if check_only:
        print(f"CHECK OK: {len(GATE_MODULES) + len(MODULES)} modules, version {version}, {len(raw_bytes)} bytes.")
        return

    if verify_only:
        # Сравниваем сборку из src/ с закоммиченным бандлом, ничего не записывая на диск.
        # CRLF нормализуем, чтобы проверка не ломалась на Windows с core.autocrlf=true.
        if not os.path.exists(OUTPUT_FILE):
            print(f"VERIFY FAILED: {OUTPUT_FILE} not found")
            sys.exit(1)
        with open(OUTPUT_FILE, "rb") as f:
            committed = f.read().replace(b"\r\n", b"\n")
        if committed != raw_bytes:
            import difflib
            diff = list(difflib.unified_diff(
                committed.decode("utf-8", errors="replace").splitlines(),
                code.splitlines(),
                fromfile=f"{OUTPUT_FILE} (committed)", tofile="build from src/", lineterm="", n=1))
            print(f"VERIFY FAILED: {OUTPUT_FILE} differs from build of src/ ({len(diff)} diff lines).")
            print("Не правьте бандл вручную: внесите правку в src/ и запустите `python build.py`.")
            for line in diff[:60]:
                print(line)
            if len(diff) > 60:
                print(f"... ({len(diff) - 60} more lines)")
            sys.exit(1)
        print(f"VERIFY OK: {OUTPUT_FILE} == build of src/ (v{version}, {len(raw_bytes)} bytes, {len(GATE_MODULES) + len(MODULES)} modules)")
        return
        
    with open(OUTPUT_FILE, "wb") as f:
        f.write(raw_bytes)
        
    print(f"BUILD SUCCESS: {OUTPUT_FILE} (v{version}, {len(raw_bytes)} bytes, {len(GATE_MODULES) + len(MODULES)} modules)")

if __name__ == "__main__":
    # Не падаем на Windows-консолях без UTF-8 при печати эмодзи/кириллицы в диффе
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")
        except Exception:
            pass
    build()
