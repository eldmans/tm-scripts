# -*- coding: utf-8 -*-
import os, sys, re, datetime

BANNER_FILE = "src/banner.js"
OUTPUT_FILE = "mossad.user.js"

MODULES = [
    "src/core/domain.js",
    "src/core/config.js",
    "src/core/sync.js",
    "src/core/utils.js",
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
    "src/engines/grok/video-gen.js",
    "src/engines/grok/delete.js",
    "src/engines/grok/collect.js",
    "src/engines/grok/queue.js",
    "src/engines/grok/loop.js",
    "src/engines/grok/slideshow.js",
    "src/engines/grok/ui-bar.js",
    "src/engines/grok/ui-playlist.js",
    "src/engines/instagram.js",
    "src/engines/redgifs.js",
    "src/download/router.js",
    "src/slideshow/engine.js",
    "src/engines/pinterest.js",
    "src/ui/panel.js",
    "src/core/hotkeys.js"
]

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
            
    # 3. Update panel.js (footer date)
    panel_path = "src/ui/panel.js"
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
        
    body_parts = []
    for mod in MODULES:
        if not os.path.exists(mod):
            print(f"ERROR: Module not found: {mod}")
            sys.exit(1)
        with open(mod, "r", encoding="utf-8") as f:
            body_parts.append(f.read().strip())
            
    code = banner + "\n\n(function () {\n    'use strict';\n\n"
    code += "\n\n".join(body_parts)
    code += "\n\n})();\n"
    
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
        print(f"CHECK OK: {len(MODULES)} modules, version {version}, {len(raw_bytes)} bytes.")
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
        print(f"VERIFY OK: {OUTPUT_FILE} == build of src/ (v{version}, {len(raw_bytes)} bytes, {len(MODULES)} modules)")
        return
        
    with open(OUTPUT_FILE, "wb") as f:
        f.write(raw_bytes)
        
    print(f"BUILD SUCCESS: {OUTPUT_FILE} (v{version}, {len(raw_bytes)} bytes, {len(MODULES)} modules)")

if __name__ == "__main__":
    # Не падаем на Windows-консолях без UTF-8 при печати эмодзи/кириллицы в диффе
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")
        except Exception:
            pass
    build()
