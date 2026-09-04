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
    "src/engines/grok.js",
    "src/engines/instagram.js",
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

def build():
    bump = "--bump" in sys.argv
    check_only = "--check" in sys.argv
    
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
    
    raw_bytes = code.encode("utf-8")
    
    required_emojis = ["❌", "✅", "🖼", "📹", "💾"]
    for emo in required_emojis:
        if emo.encode("utf-8") not in raw_bytes:
            print(f"WARNING: Emoji {emo} not found in output code!")
            
    if check_only:
        print(f"CHECK OK: {len(MODULES)} modules, version {version}, {len(raw_bytes)} bytes.")
        return
        
    with open(OUTPUT_FILE, "wb") as f:
        f.write(raw_bytes)
        
    print(f"BUILD SUCCESS: {OUTPUT_FILE} (v{version}, {len(raw_bytes)} bytes, {len(MODULES)} modules)")

if __name__ == "__main__":
    build()
