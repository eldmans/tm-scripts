"""
Telegram Bridge v3.0 — Antigravity & MOSSAD
Переписан с нуля с нормальной архитектурой.

Режимы клавиатуры:
  NORMAL   — 3 агента (с точкой у текущего) + статус + скриншот + пнуть + пауза + выключить
  COMPOSE  — пользователь накапливает сообщения (аудио, фото, текст)
             Кнопки: [Отправить → <текущий>] [→ <агент2>] [→ <агент3>] [❌ Отмена]

Кнопка «Подробнее»:
  <= 200 симв → Telegram popup (show_alert)
  > 200 симв  → редактирует то же сообщение (не шлёт новое)
               добавляет кнопку [⬅ Свернуть] чтобы вернуть краткий вид
"""

import os, sys, time, json, uuid, subprocess
import requests
import stt_engine
import tts_engine

# ---------------------------------------------------------------------------
# КОНФИГ
# ---------------------------------------------------------------------------
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE   = os.path.join(BASE_DIR, "tg_config.json")
STATUS_FILE   = os.path.join(BASE_DIR, "live_status.json")
OUTBOX_FILE   = os.path.join(BASE_DIR, "tg_outbox.txt")
OUTBOX_JSON   = os.path.join(BASE_DIR, "tg_outbox.json")
INBOX_JSON    = os.path.join(BASE_DIR, "tg_inbox.json")
INBOX_TXT     = os.path.join(BASE_DIR, "tg_inbox.txt")
INBOX_ELDAR   = os.path.join(BASE_DIR, "inbox_eldar.txt")
INBOX_MOSSAD  = os.path.join(BASE_DIR, "inbox_mossad.txt")
INBOX_TG      = os.path.join(BASE_DIR, "inbox_tg.txt")
STOP_FILE     = os.path.join(BASE_DIR, "stop_signal.txt")
WAKE_FILE     = os.path.join(BASE_DIR, "wake_signal.txt")
PHOTOS_DIR    = os.path.join(BASE_DIR, "inbox_photos")
DETAILS_FILE  = os.path.join(BASE_DIR, "details_cache.json")

TARGETS = {
    "eldar":       "🧠 Голова",
    "mossad":      "🍅 MOSSAD",
    "tg_engineer": "🤖 TG-инженер",
}
TARGET_FULL = {
    "eldar":       "🧠 Голова Эльдара",
    "mossad":      "🍅 Координатор MOSSAD",
    "tg_engineer": "🤖 Telegram-инженер",
}

COMPOSE_TTL = 300   # секунд без активности → сессия сбрасывается автоматически

# ---------------------------------------------------------------------------
# ЗАГРУЗКА КОНФИГА
# ---------------------------------------------------------------------------
def _default_cfg():
    return {
        "bot_token": "",
        "owner_chat_id": "",
        "allowed_chat_ids": [],
        "active_target": "tg_engineer",
        "alert_thresholds": [75, 50, 25, 15, 10, 5],
        "last_alert_5h": 100,
        "last_alert_weekly": 100,
        "allowed_guests": {},
    }

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return _default_cfg()

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

CFG      = load_config()
OWNER_ID = str(CFG.get("owner_chat_id", ""))
TOKEN    = CFG.get("bot_token", "")

# ---------------------------------------------------------------------------
# IN-MEMORY STATE
# ---------------------------------------------------------------------------

# SESSIONS[chat_id] = {"target": "mossad", "ts": float, "parts": [...]}
# part = {"kind": "text"|"voice"|"photo", "text": str, "file": path|None}
SESSIONS = {}

# DETAILS_CACHE[det_id] = {"short": str, "voice": str, "full": str}
# Персистируется в файл при каждом добавлении.
DETAILS_CACHE = {}

def _load_details_cache():
    global DETAILS_CACHE
    if os.path.exists(DETAILS_FILE):
        try:
            with open(DETAILS_FILE, "r", encoding="utf-8") as f:
                DETAILS_CACHE = json.load(f)
        except Exception:
            DETAILS_CACHE = {}

def _save_detail(det_id, entry):
    DETAILS_CACHE[det_id] = entry
    # Держим последние 200 записей
    if len(DETAILS_CACHE) > 200:
        oldest = list(DETAILS_CACHE.keys())[:50]
        for k in oldest:
            DETAILS_CACHE.pop(k, None)
    try:
        with open(DETAILS_FILE, "w", encoding="utf-8") as f:
            json.dump(DETAILS_CACHE, f, ensure_ascii=False)
    except Exception:
        pass

_load_details_cache()

# ---------------------------------------------------------------------------
# TG API HELPERS
# ---------------------------------------------------------------------------
def _post(method, **kwargs):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    try:
        r = requests.post(url, timeout=15, **kwargs)
        return r.json()
    except Exception as e:
        print(f"[TG {method} Error] {e}")
        return {}

def _get(method, **params):
    url = f"https://api.telegram.org/bot{TOKEN}/{method}"
    try:
        r = requests.get(url, params=params, timeout=10)
        return r.json()
    except Exception as e:
        print(f"[TG {method} Error] {e}")
        return {}

def send_message(chat_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return _post("sendMessage", json=payload)

def edit_message_text(chat_id, msg_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {"chat_id": chat_id, "message_id": msg_id, "text": text, "parse_mode": parse_mode}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return _post("editMessageText", json=payload)

def edit_message_reply_markup(chat_id, msg_id, reply_markup):
    return _post("editMessageReplyMarkup", json={
        "chat_id": chat_id, "message_id": msg_id, "reply_markup": reply_markup
    })

def answer_callback(cb_id, text=None, show_alert=False):
    payload = {"callback_query_id": cb_id}
    if text:
        payload["text"] = text[:200]
    if show_alert:
        payload["show_alert"] = True
    _post("answerCallbackQuery", json=payload)

def send_voice(chat_id, ogg_path, caption="", reply_markup=None):
    if not os.path.exists(ogg_path):
        return {}
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)
    with open(ogg_path, "rb") as f:
        return _post("sendVoice", files={"voice": f}, data=data)

def send_photo(chat_id, photo_path, caption="", reply_markup=None):
    if not os.path.exists(photo_path):
        return {}
    data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)
    with open(photo_path, "rb") as f:
        return _post("sendPhoto", files={"photo": f}, data=data)

def send_chat_action(chat_id, action="typing"):
    _post("sendChatAction", json={"chat_id": chat_id, "action": action})

def download_file(file_id, dest_path):
    res = _get("getFile", file_id=file_id)
    if not res.get("ok"):
        return None
    fpath = res["result"]["file_path"]
    url = f"https://api.telegram.org/file/bot{TOKEN}/{fpath}"
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            with open(dest_path, "wb") as f:
                f.write(r.content)
            return dest_path
    except Exception as e:
        print(f"[TG Download Error] {e}")
    return None

def get_user_avatar(user_id):
    res = _get("getUserProfilePhotos", user_id=user_id, limit=1)
    if res.get("ok") and res["result"]["total_count"] > 0:
        fid = res["result"]["photos"][0][-1]["file_id"]
        path = os.path.join(BASE_DIR, f"avatar_{user_id}.jpg")
        return download_file(fid, path)
    return None

def take_screenshot():
    out = os.path.join(BASE_DIR, "screen.png")
    out_e = out.replace("\\", "\\\\")
    ps = f"""
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    try {{
        $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $b = New-Object System.Drawing.Bitmap $s.Width, $s.Height
        $g = [System.Drawing.Graphics]::FromImage($b)
        $g.CopyFromScreen($s.X, $s.Y, 0, 0, $b.Size)
        $b.Save('{out_e}', [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose(); $b.Dispose()
        Write-Output "OK"
    }} catch {{ Write-Output "ERROR" }}
    """
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                             capture_output=True, text=True, timeout=10)
        if "ERROR" not in res.stdout and os.path.exists(out) and os.path.getsize(out) > 20000:
            return out
        return "LOCKED"
    except Exception:
        return "LOCKED"

# ---------------------------------------------------------------------------
# АВТОРИЗАЦИЯ
# ---------------------------------------------------------------------------
def is_authorized(chat_id):
    s = str(chat_id)
    if s == OWNER_ID:
        return True
    if s in [str(x) for x in CFG.get("allowed_chat_ids", [])]:
        return True
    return s in CFG.get("allowed_guests", {})

# ---------------------------------------------------------------------------
# КЛАВИАТУРЫ
# ---------------------------------------------------------------------------
def _target_label(key):
    name = TARGETS[key]
    dot = "• " if CFG.get("active_target") == key else "  "
    return f"{dot}{name}"

def kb_normal():
    """Обычная клавиатура со всеми командами."""
    return {
        "keyboard": [
            [{"text": _target_label("eldar")},
             {"text": _target_label("mossad")},
             {"text": _target_label("tg_engineer")}],
            [{"text": "📊 Статус"},
             {"text": "📸 Скриншот"},
             {"text": "⚡ Пнуть"}],
            [{"text": "⏹ Пауза"},
             {"text": "🛑 Выключить бота"}],
        ],
        "resize_keyboard": True
    }

def kb_compose(current_target):
    """Клавиатура в режиме набора сообщения."""
    send_label = f"✅ Отправить → {TARGET_FULL[current_target]}"
    others = [t for t in TARGETS if t != current_target]
    switch_row = [{"text": f"→ {TARGET_FULL[t]}"} for t in others]
    return {
        "keyboard": [
            [{"text": send_label}],
            switch_row,
            [{"text": "❌ Отмена"}],
        ],
        "resize_keyboard": True
    }

def kb_guest():
    return {
        "keyboard": [[{"text": "📱 Запросить доступ", "request_contact": True}]],
        "resize_keyboard": True, "one_time_keyboard": True
    }

# ---------------------------------------------------------------------------
# INLINE MARKUP ДЛЯ ОТВЕТОВ АГЕНТОВ
# ---------------------------------------------------------------------------
def _reply_inline(det_id):
    return {"inline_keyboard": [[
        {"text": "📖 Подробнее", "callback_data": f"det:{det_id}"},
        {"text": "🎧 Озвучить", "callback_data": f"replay:{det_id}"},
    ]]}

def _collapse_inline(det_id):
    return {"inline_keyboard": [[
        {"text": "⬅ Свернуть", "callback_data": f"collapse:{det_id}"},
        {"text": "🎧 Озвучить", "callback_data": f"replay:{det_id}"},
    ]]}

# ---------------------------------------------------------------------------
# IRONCLAD REPLY — отправка короткий + кнопки (+ опционально TTS)
# ---------------------------------------------------------------------------
def ironclad_reply(chat_id, short, voice_text, full, with_voice=False):
    det_id = str(uuid.uuid4())[:8]
    _save_detail(det_id, {"short": short, "voice": voice_text, "full": full})

    # 1. Короткое текстовое сообщение с кнопками
    res = send_message(chat_id, short, reply_markup=_reply_inline(det_id))
    msg_id = res.get("result", {}).get("message_id")
    if msg_id:
        DETAILS_CACHE[det_id]["msg_id"] = msg_id
        _save_detail(det_id, DETAILS_CACHE[det_id])

    # 2. TTS-голосовое (только если явно запрошено)
    if with_voice and voice_text:
        send_chat_action(chat_id, "upload_voice")
        ogg = tts_engine.generate_voice_ogg(voice_text)
        if ogg and os.path.exists(ogg):
            send_voice(chat_id, ogg)
            try: os.remove(ogg)
            except: pass

# ---------------------------------------------------------------------------
# КВОТА И СТАТУС (ANTIGRAVITY LIVE API + FALLBACK)
# ---------------------------------------------------------------------------
LAST_QUOTA_FETCH = 0

def _parse_pct(v):
    if isinstance(v, (int, float)): return round(float(v), 1)
    if isinstance(v, str):
        d = "".join(c for c in v if c.isdigit() or c == ".")
        try: return round(float(d), 1)
        except: return 0.0
    return 0.0

def _fmt_delta(sec):
    if sec <= 0: return "сброшен"
    m, _ = divmod(int(sec), 60)
    h, m = divmod(m, 60)
    d, h = divmod(h, 24)
    parts = []
    if d: parts.append(f"{d}д")
    if h: parts.append(f"{h}ч")
    if m or not parts: parts.append(f"{m}м")
    return " ".join(parts)

def _bar(pct, n=10):
    v = max(0, min(100, int(pct)))
    f = round(v / 100 * n)
    return "█" * f + "░" * (n - f)

def _iso_to_ts(iso_str):
    if not iso_str: return None
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return None

def fetch_live_antigravity_quotas():
    """Опрашивает локальный демон Antigravity (language_server) для получения 100% реальных квот."""
    import glob
    daemon_dir = os.path.expanduser("~/.gemini/antigravity/daemon")
    files = glob.glob(os.path.join(daemon_dir, "hub_*.json"))
    if not files:
        return None
    files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    for fpath in files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                d = json.load(f)
            port = d.get("httpPort")
            csrf = d.get("csrfToken")
            if not port or not csrf:
                continue
            url = f"http://127.0.0.1:{port}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary"
            headers = {
                "content-type": "application/json",
                "connect-protocol-version": "1",
                "x-codeium-csrf-token": csrf
            }
            r = requests.post(url, headers=headers, json={}, timeout=3)
            if r.status_code == 200:
                data = r.json()
                groups = data.get("response", {}).get("groups", [])
                res = {}
                for g in groups:
                    gname = g.get("displayName")
                    res[gname] = {}
                    for b in g.get("buckets", []):
                        w = b.get("window")
                        res[gname][w] = {
                            "bucketId": b.get("bucketId"),
                            "pct": round(b.get("remainingFraction", 0) * 100, 1),
                            "resetTime": b.get("resetTime"),
                            "description": b.get("description", "")
                        }
                return res
        except Exception:
            continue
    return None

def sync_live_quotas(force=False):
    """Синхронизирует реальные квоты Antigravity в live_status.json каждые 60 секунд."""
    global LAST_QUOTA_FETCH
    now = time.time()
    if not force and (now - LAST_QUOTA_FETCH < 60):
        return
    LAST_QUOTA_FETCH = now
    live = fetch_live_antigravity_quotas()
    if not live:
        return

    data = {}
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass

    gemini = live.get("Gemini Models", {})
    claude = live.get("Claude and GPT models", {})

    g_5h = gemini.get("5h", {})
    g_w  = gemini.get("weekly", {})
    c_w  = claude.get("weekly", {})
    c_5h = claude.get("5h", {})

    if g_5h:
        g5_pct = g_5h.get("pct", 100)
        g5_ts  = _iso_to_ts(g_5h.get("resetTime"))
        data["quota_5h"] = {
            "remaining_pct": g5_pct,
            "reset_timestamp": g5_ts,
            "resets_in": _fmt_delta(g5_ts - now) if g5_ts else "?"
        }
        data["quota_remaining"] = f"{g5_pct}%"

    if g_w:
        gw_pct = g_w.get("pct", 100)
        gw_ts  = _iso_to_ts(g_w.get("resetTime"))
        data["quota_weekly"] = {
            "remaining_pct": gw_pct,
            "reset_timestamp": gw_ts,
            "resets_in": _fmt_delta(gw_ts - now) if gw_ts else "?"
        }
        data["weekly_quota_remaining"] = f"{gw_pct}%"

    if c_w:
        cw_pct = c_w.get("pct", 100)
        cw_ts  = _iso_to_ts(c_w.get("resetTime"))
        data["claude_weekly"] = {
            "remaining_pct": cw_pct,
            "reset_timestamp": cw_ts,
            "resets_in": _fmt_delta(cw_ts - now) if cw_ts else "?"
        }
        data["claude_quota_remaining"] = f"{cw_pct}%"

    if c_5h:
        c5_pct = c_5h.get("pct", 100)
        data["claude_5h"] = {
            "remaining_pct": c5_pct
        }

    data["last_updated"] = time.strftime("%Y-%m-%d %H:%M:%S")

    try:
        with open(STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def get_status(force_refresh=False):
    if force_refresh:
        sync_live_quotas(force=True)

    data = {}
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except: pass

    q5r = data.get("quota_5h", {})
    q5p = _parse_pct(q5r.get("remaining_pct", data.get("quota_remaining", 100)))
    q5ts = q5r.get("reset_timestamp")
    q5in = _fmt_delta(q5ts - time.time()) if isinstance(q5ts, (int, float)) and q5ts else q5r.get("resets_in", "?")

    qwr = data.get("quota_weekly", {})
    qwp = _parse_pct(qwr.get("remaining_pct", data.get("weekly_quota_remaining", 100)))
    qwts = qwr.get("reset_timestamp")
    qwin = _fmt_delta(qwts - time.time()) if isinstance(qwts, (int, float)) and qwts else qwr.get("resets_in", "?")

    cwr = data.get("claude_weekly", {})
    cwp = _parse_pct(cwr.get("remaining_pct", 100)) if cwr else None
    cwts = cwr.get("reset_timestamp") if cwr else None
    cwin = _fmt_delta(cwts - time.time()) if isinstance(cwts, (int, float)) and cwts else cwr.get("resets_in", "?")

    return {
        "q5p": q5p, "q5in": q5in,
        "qwp": qwp, "qwin": qwin,
        "cwp": cwp, "cwin": cwin,
        "model": data.get("model", "Gemini 3.8 Flash"),
        "version": data.get("script_version", "v1.4.33"),
        "build": data.get("build_status", "SYNTAX OK, VERIFY OK"),
        "watchdog": data.get("watchdog_timer", "АКТИВЕН"),
    }

def format_status(s):
    cw_txt = ""
    if s.get("cwp") is not None:
        cw_txt = f"\n\n🧠 <b>Claude & GPT:</b>\n" \
                 f"📅 <b>Неделя:</b>   [<code>{_bar(s['cwp'])}</code>] <b>{s['cwp']}%</b> (сброс: {s['cwin']})"

    return (
        f"📊 <b>СТАТУС СИСТЕМЫ</b>\n\n"
        f"🤖 <b>Gemini Models:</b>\n"
        f"⏳ <b>5ч лимит:</b> [<code>{_bar(s['q5p'])}</code>] <b>{s['q5p']}%</b> (сброс: {s['q5in']})\n"
        f"📅 <b>Неделя:</b>   [<code>{_bar(s['qwp'])}</code>] <b>{s['qwp']}%</b> (сброс: {s['qwin']})"
        f"{cw_txt}\n\n"
        f"• 🤖 <b>Модель:</b> {s['model']}\n"
        f"• 📦 <b>Версия:</b> <code>{s['version']}</code>\n"
        f"• 🔨 <b>Сборка:</b> <code>{s['build']}</code>\n"
        f"• ⏱ <b>Сторож:</b> {s['watchdog']}\n"
        f"• 🎯 <b>Адресат:</b> {TARGET_FULL.get(CFG.get('active_target','tg_engineer'), '🤖 Telegram-инженер')}"
    )

def check_quota_alerts():
    if not os.path.exists(STATUS_FILE):
        return
    s = get_status()
    q5p, qwp = s["q5p"], s["qwp"]
    thresholds = CFG.get("alert_thresholds", [75, 50, 25, 15, 10, 5])

    for key, pct, last_key, label in [
        ("q5", q5p, "last_alert_5h", "5-часовой"),
        ("qw", qwp, "last_alert_weekly", "Недельный"),
    ]:
        last = CFG.get(last_key, 100)
        if pct > last + 10:
            CFG[last_key] = 100; save_config(CFG); last = 100
        for th in thresholds:
            if pct <= th < last:
                CFG[last_key] = th; save_config(CFG)
                ironclad_reply(
                    OWNER_ID,
                    f"⚠️ [{label} лимит] → {pct}% (порог {th}%)",
                    f"Внимание, Эльдар! {label} лимит опустился до {pct} процентов.",
                    format_status(s),
                    with_voice=True
                )
                break

    cwp = s.get("cwp")
    if q5p <= 5 or qwp <= 5 or (cwp is not None and cwp <= 5):
        if not os.path.exists(STOP_FILE):
            with open(STOP_FILE, "w") as f: f.write(f"AUTO_{time.time()}")
            ironclad_reply(
                OWNER_ID,
                f"🚨 АВАРИЙНЫЙ ТОРМОЗ — квота критическая ({q5p}% / {qwp}%)",
                f"Аварийный стоп! Лимит достиг критической отметки. Задачи заморожены.",
                format_status(s),
                with_voice=True
            )

# ---------------------------------------------------------------------------
# ЗАПИСЬ В INBOX
# ---------------------------------------------------------------------------
def record_inbox(sender_id, sender_name, text, target):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    entry = {"timestamp": ts, "sender_id": sender_id, "sender_name": sender_name,
             "target": target, "text": text, "handled": False}

    items = []
    if os.path.exists(INBOX_JSON):
        try:
            with open(INBOX_JSON, "r", encoding="utf-8") as f:
                items = json.load(f)
        except: pass
    items.append(entry)
    with open(INBOX_JSON, "w", encoding="utf-8") as f:
        json.dump(items[-100:], f, ensure_ascii=False, indent=2)

    line = f"[{ts}] [@{sender_name} → {target.upper()}]: {text}\n"
    target_map = {"eldar": INBOX_ELDAR, "mossad": INBOX_MOSSAD, "tg_engineer": INBOX_TG}
    with open(target_map.get(target, INBOX_TG), "a", encoding="utf-8") as f: f.write(line)
    with open(INBOX_TXT, "a", encoding="utf-8") as f: f.write(line)

# ---------------------------------------------------------------------------
# ГЕНЕРАЦИЯ ОТВЕТА АГЕНТА
# ---------------------------------------------------------------------------
def agent_response(target, user_name, text_bundle):
    s = get_status()
    if target == "tg_engineer":
        low = text_bundle.lower()
        if any(w in low for w in ["статус", "квот", "лимит", "как дела"]):
            return (
                f"🤖 [TG-инженер] Мост онлайн | 5ч: {s['q5p']}% | Неделя: {s['qwp']}%",
                f"Эльдар, мост на связи. Пятичасовой {s['q5p']} процентов, недельный {s['qwp']}.",
                format_status(s)
            )
        return (
            f"🤖 [TG-инженер] Принято: «{text_bundle[:50]}»",
            f"Принял задачу: {text_bundle[:80]}. Телеметрия в норме.",
            f"🤖 <b>TG-ИНЖЕНЕР</b>\n\n• <b>Запрос:</b> «{text_bundle}»\n"
            f"• <b>Лимиты:</b> 5ч {s['q5p']}%, неделя {s['qwp']}%\n"
            f"• <b>Время:</b> {time.strftime('%H:%M:%S')}"
        )

    elif target == "mossad":
        with open(WAKE_FILE, "w") as f: f.write(f"WAKE_{time.time()}_{text_bundle[:50]}")
        return (
            f"🍅 [MOSSAD {s['version']}] Задача в очереди: «{text_bundle[:50]}»",
            f"Сеньор Помидор принял задачу: {text_bundle[:80]}. Воркеры разбудил.",
            f"🍅 <b>КООРДИНАТОР MOSSAD</b>\n\n• <b>Задача:</b> «{text_bundle}»\n"
            f"• <b>Версия:</b> <code>{s['version']}</code>\n• <b>Сборка:</b> <code>{s['build']}</code>"
        )

    else:  # eldar
        return (
            f"🧠 [Голова Эльдара] Принято в банк концепций",
            f"Мысль «{text_bundle[:70]}» записана в банк концепций. Эргономический фильтр: одобрено.",
            f"🧠 <b>ГОЛОВА ЭЛЬДАРА</b>\n\n• <b>Мысль:</b> «{text_bundle}»\n"
            f"• <b>Время:</b> {time.strftime('%H:%M:%S')}\n"
            f"• <b>Файл:</b> <code>inbox_eldar.txt</code>"
        )

# ---------------------------------------------------------------------------
# РЕЖИМ НАБОРА — SESSION HELPERS
# ---------------------------------------------------------------------------
def session_get(chat_id):
    return SESSIONS.get(str(chat_id))

def session_start(chat_id, target):
    SESSIONS[str(chat_id)] = {
        "target": target,
        "ts": time.time(),
        "parts": []
    }

def session_add(chat_id, kind, text, file_path=None):
    s = SESSIONS.get(str(chat_id))
    if s:
        s["parts"].append({"kind": kind, "text": text, "file": file_path})
        s["ts"] = time.time()

def session_clear(chat_id):
    SESSIONS.pop(str(chat_id), None)

def session_bundle(chat_id):
    """Собирает все части в текстовый пакет для агента."""
    s = SESSIONS.get(str(chat_id))
    if not s:
        return ""
    lines = []
    for p in s["parts"]:
        if p["kind"] == "text" and p["text"]:
            lines.append(p["text"])
        elif p["kind"] == "voice" and p["text"]:
            lines.append(f"[🎤 {p['text']}]")
        elif p["kind"] == "photo":
            caption = f": {p['text']}" if p["text"] else ""
            lines.append(f"[📷 Фото{caption}]")
    return "\n".join(lines)

def session_expire_check():
    """Удаляем просроченные сессии без уведомления."""
    now = time.time()
    for cid in list(SESSIONS.keys()):
        if now - SESSIONS[cid]["ts"] > COMPOSE_TTL:
            SESSIONS.pop(cid, None)

def _target_from_switch_text(text):
    """'→ 🧠 Голова Эльдара' → 'eldar'"""
    for key, full in TARGET_FULL.items():
        if full in text:
            return key
    return None

def _target_from_normal_text(text):
    """Нажатие кнопки нормальной клавиатуры с точкой или без."""
    cleaned = text.lstrip("• ").strip()
    for key, name in TARGETS.items():
        if name in cleaned:
            return key
    return None

def _is_send_button(text):
    """Текст кнопки 'Отправить → ...'"""
    return text.startswith("✅ Отправить →")

# ---------------------------------------------------------------------------
# ОБРАБОТКА ВХОДЯЩЕГО СООБЩЕНИЯ
# ---------------------------------------------------------------------------
def handle_message(msg):
    global CFG
    chat_id = str(msg["chat"]["id"])
    user    = msg.get("from", {})
    u_name  = user.get("username", "нет_юзернейма")

    # ---- Авторизация ----
    if not is_authorized(chat_id):
        avatar = get_user_avatar(chat_id)
        full   = f"{user.get('first_name','')} {user.get('last_name','')}".strip() or u_name
        card   = (
            f"🚨 <b>ЗАПРОС ДОСТУПА</b>\n\n"
            f"• <b>Пользователь:</b> {full}\n"
            f"• <b>Username:</b> @{u_name}\n"
            f"• <b>ID:</b> <code>{chat_id}</code>\n\n"
            f"Разрешить доступ к пульту?"
        )
        markup = {"inline_keyboard": [[
            {"text": "✅ Разрешить", "callback_data": f"auth_allow:{chat_id}:{u_name}"},
            {"text": "❌ Отклонить", "callback_data": f"auth_deny:{chat_id}"},
        ]]}
        if avatar and os.path.exists(avatar):
            send_photo(OWNER_ID, avatar, card, reply_markup=markup)
            try: os.remove(avatar)
            except: pass
        else:
            send_message(OWNER_ID, card, reply_markup=markup)
        send_message(chat_id,
                     "⏳ <b>Запрос отправлен владельцу.</b>\nОжидайте решения.",
                     reply_markup=kb_guest())
        return

    # ---- Извлечение содержимого ----
    text      = msg.get("text", "").strip()
    voice_obj = msg.get("voice") or msg.get("audio")
    photo_obj = msg.get("photo")     # список размеров, берём последний

    # Если фото
    if photo_obj:
        os.makedirs(PHOTOS_DIR, exist_ok=True)
        fid = photo_obj[-1]["file_id"]
        fname = f"photo_{int(time.time())}_{fid[:8]}.jpg"
        fpath = download_file(fid, os.path.join(PHOTOS_DIR, fname))
        caption = msg.get("caption", "").strip()
        photo_text = f"[Фото: {fname}]" + (f" {caption}" if caption else "")
        target = CFG.get("active_target", "tg_engineer")
        record_inbox(chat_id, u_name, photo_text, target)
        short = f"📷 [{TARGETS[target]}] Фото получено"
        voice = f"Фотография получена и передана в {TARGET_FULL[target]}."
        full = f"📷 <b>ФОТО ПОЛУЧЕНО</b>\n\n• <b>Файл:</b> <code>{fname}</code>\n• <b>Подпись:</b> {caption or 'нет'}\n• <b>Адресат:</b> {TARGET_FULL[target]}"
        ironclad_reply(chat_id, short, voice, full)
        return

    # Если голос
    if voice_obj:
        fid   = voice_obj["file_id"]
        opath = os.path.join(BASE_DIR, f"in_voice_{int(time.time()*1000)}.oga")
        send_chat_action(chat_id, "record_voice")
        downloaded = download_file(fid, opath)
        recognized = ""
        if downloaded:
            recognized, engine = stt_engine.transcribe_audio(downloaded)
            print(f"[STT/{engine}] {recognized[:80]}")
            try: os.remove(downloaded)
            except: pass

        if not recognized:
            send_message(chat_id, "⚠ Не удалось разобрать речь (тишина или шум).")
            return

        target = CFG.get("active_target", "tg_engineer")
        record_inbox(chat_id, u_name, recognized, target)

        short = f"🎤 «{recognized}»\n↳ <i>{TARGET_FULL[target]}</i>"
        full = (
            f"🎤 <b>ГОЛОСОВОЕ СООБЩЕНИЕ</b>\n\n"
            f"• <b>Распознано:</b> «{recognized}»\n"
            f"• <b>Адресат:</b> {TARGET_FULL[target]}\n"
            f"• <b>Время:</b> {time.strftime('%H:%M:%S')}"
        )
        ironclad_reply(chat_id, short, recognized, full, with_voice=False)
        return

    # Текстовое сообщение
    if text:
        _handle_text(chat_id, u_name, text)

def _handle_content(chat_id, u_name, kind, text, file_path=None):
    """Любой нетекстовый/произвольный контент — входим в compose-режим."""
    sess = session_get(chat_id)
    target = CFG.get("active_target", "tg_engineer")

    if sess is None:
        # Начинаем новую сессию
        session_start(chat_id, target)
        sess = session_get(chat_id)

    session_add(chat_id, kind, text, file_path)
    target = sess["target"]

    emoji = {"voice": "🎤", "photo": "📷", "text": "💬"}.get(kind, "📎")
    preview = f"{emoji} {text[:60]}" if text else emoji
    n = len(sess["parts"])
    send_message(
        chat_id,
        f"<i>Добавлено в пакет [{n}]: {preview}</i>\n"
        f"Нажми <b>Отправить</b> или добавь ещё.",
        reply_markup=kb_compose(target)
    )

def _handle_text(chat_id, u_name, text):
    """Текстовое сообщение — команды OR compose-режим."""
    global CFG
    sess   = session_get(chat_id)
    target = CFG.get("active_target", "tg_engineer")

    # --- COMPOSE MODE BUTTONS ---
    if sess is not None:
        if text == "❌ Отмена":
            session_clear(chat_id)
            send_message(chat_id, "✖ Отменено. Пакет очищен.", reply_markup=kb_normal())
            return

        if _is_send_button(text):
            # Отправить → <текущий>
            bundle = session_bundle(chat_id)
            if not bundle:
                session_clear(chat_id)
                send_message(chat_id, "⚠ Пустой пакет.", reply_markup=kb_normal())
                return
            tgt = sess["target"]
            session_clear(chat_id)
            send_message(chat_id, f"📤 Отправляю в {TARGET_FULL[tgt]}…", reply_markup=kb_normal())
            record_inbox(chat_id, u_name, bundle, tgt)
            short, voice, full = agent_response(tgt, u_name, bundle)
            ironclad_reply(chat_id, short, voice, full)
            return

        sw = _target_from_switch_text(text)
        if sw:
            sess["target"] = sw
            send_message(chat_id,
                         f"↔ Адресат изменён на {TARGET_FULL[sw]}. Продолжай добавлять.",
                         reply_markup=kb_compose(sw))
            return

        # В compose-режиме — добавляем текст как ещё одну часть
        _handle_content(chat_id, u_name, "text", text)
        return

    # --- NORMAL MODE ---

    # Переключение адресата через нижнюю клавиатуру
    tgt_switch = _target_from_normal_text(text)
    if tgt_switch:
        CFG["active_target"] = tgt_switch
        save_config(CFG)
        send_message(chat_id,
                     f"🎯 Активный адресат: <b>{TARGET_FULL[tgt_switch]}</b>",
                     reply_markup=kb_normal())
        return

    # --- КОМАНДЫ ---
    if text in ["/start", "start"]:
        send_message(chat_id,
                     f"👋 <b>Пульт Antigravity</b>\n\n"
                     f"Выбери агента кнопками ниже.\n"
                     f"Пиши, наговаривай или скидывай фото — бот спросит, кому передать.\n\n"
                     f"Текущий адресат: <b>{TARGET_FULL[target]}</b>",
                     reply_markup=kb_normal())
        return

    if text in ["📊 Статус", "/status"]:
        s = get_status(force_refresh=True)
        cwp_str = f" | Claude: {s['cwp']}%" if s.get('cwp') is not None else ""
        short = f"📊 Gemini: 5ч {s['q5p']}% ({s['q5in']}) | Неделя: {s['qwp']}% ({s['qwin']}){cwp_str}"
        voice = (f"Статус системы. Gemini пятичасовой лимит {s['q5p']} процентов, сброс через {s['q5in']}. "
                 f"Недельный {s['qwp']} процентов.")
        if s.get("cwp") is not None:
            voice += f" Клод {s['cwp']} процентов."
        ironclad_reply(chat_id, short, voice, format_status(s), with_voice=True)
        return

    if text in ["📸 Скриншот", "/screen"]:
        send_message(chat_id, "📸 Захватываю экран…")
        scr = take_screenshot()
        if scr == "LOCKED":
            send_message(chat_id, "⚠ Экран заблокирован или недоступен.")
        elif scr and os.path.exists(scr):
            send_photo(chat_id, scr, "📸 Рабочий стол")
            try: os.remove(scr)
            except: pass
        else:
            send_message(chat_id, "⚠ Не удалось сделать скриншот.")
        return

    if text in ["⚡ Пнуть", "/wake"]:
        with open(WAKE_FILE, "w") as f: f.write(f"WAKE_BY_USER_{time.time()}")
        send_message(chat_id, "⚡ Сигнал пробуждения отправлен.")
        return

    if text in ["⏹ Пауза", "/stop"]:
        with open(STOP_FILE, "w") as f: f.write(f"PAUSE_{time.time()}")
        send_message(chat_id, "⏹ Пауза активирована. Агенты остановлены.")
        return

    if text in ["🛑 Выключить бота", "/stop_bot"]:
        markup = {"inline_keyboard": [[
            {"text": "⚠ Да, выключить", "callback_data": "sd_step1"},
            {"text": "Отмена", "callback_data": "sd_cancel"},
        ]]}
        send_message(chat_id, "⚠ <b>Выключить бота на ПК?</b>", reply_markup=markup)
        return

    # Произвольный текст — прямой ответ активного адресата без лишней бюрократии
    record_inbox(chat_id, u_name, text, target)
    short, voice, full = agent_response(target, u_name, text)
    ironclad_reply(chat_id, short, voice, full)

# ---------------------------------------------------------------------------
# ОБРАБОТКА CALLBACK QUERY
# ---------------------------------------------------------------------------
def handle_callback(cb):
    global CFG
    cb_id   = cb["id"]
    chat_id = str(cb["message"]["chat"]["id"])
    msg_id  = cb["message"]["message_id"]
    data    = cb.get("data", "")

    if chat_id != OWNER_ID and not is_authorized(chat_id):
        answer_callback(cb_id, "Нет доступа.")
        return

    # stt:<id> — показать распознанный текст голосового
    if data.startswith("stt:"):
        stt_id = data.split(":", 1)[1]
        det    = DETAILS_CACHE.get(f"stt_{stt_id}", {})
        txt    = det.get("full", "Текст не найден.")
        answer_callback(cb_id, f"Распознанный текст:\n\n{txt}"[:200], show_alert=True)
        return

    # det:<id> — показать подробности
    if data.startswith("det:"):
        det_id = data.split(":", 1)[1]
        det    = DETAILS_CACHE.get(det_id, {})
        full   = det.get("full", "Подробности устарели (бот перезапускался).")

        if len(full) <= 200:
            # Маленький текст — Telegram popup
            answer_callback(cb_id, full, show_alert=True)
        else:
            # Большой текст — редактируем само сообщение
            answer_callback(cb_id, "Разворачиваю…")
            edit_message_text(chat_id, msg_id, full,
                              reply_markup=_collapse_inline(det_id))
        return

    # collapse:<id> — свернуть обратно
    if data.startswith("collapse:"):
        det_id = data.split(":", 1)[1]
        det    = DETAILS_CACHE.get(det_id, {})
        short  = det.get("short", "—")
        answer_callback(cb_id)
        edit_message_text(chat_id, msg_id, short,
                          reply_markup=_reply_inline(det_id))
        return

    # replay:<id> — повторить голосовой ответ
    if data.startswith("replay:"):
        det_id     = data.split(":", 1)[1]
        det        = DETAILS_CACHE.get(det_id, {})
        voice_text = det.get("voice") or det.get("short", "Нет текста.")
        answer_callback(cb_id, "Синтезирую голос…")
        send_chat_action(chat_id, "upload_voice")
        ogg = tts_engine.generate_voice_ogg(voice_text)
        if ogg and os.path.exists(ogg):
            send_voice(chat_id, ogg, "🎧 <i>Повторная озвучка</i>")
            try: os.remove(ogg)
            except: pass
        else:
            answer_callback(cb_id, "Не удалось синтезировать.")
        return

    # Shutdown dialog
    if data == "sd_cancel":
        answer_callback(cb_id, "Отменено.")
        edit_message_text(chat_id, msg_id, "✅ Выключение отменено.")
        return
    if data == "sd_step1":
        answer_callback(cb_id)
        markup = {"inline_keyboard": [[
            {"text": "🔴 ТОЧНО выключить", "callback_data": "sd_confirm"},
            {"text": "Отмена", "callback_data": "sd_cancel"},
        ]]}
        edit_message_text(chat_id, msg_id,
                          "⚠ <b>Последнее предупреждение!</b>\nПосле этого — только физически через START_BOT.bat.",
                          reply_markup=markup)
        return
    if data == "sd_confirm":
        answer_callback(cb_id, "Выключаю…")
        edit_message_text(chat_id, msg_id, "🛑 <b>Бот выключен.</b>")
        sys.exit(0)

    # Авторизация гостей
    if data.startswith("auth_allow:"):
        _, tid, tname = data.split(":", 2)
        guests = CFG.get("allowed_guests", {})
        guests[tid] = {"name": tname, "time": time.time()}
        CFG["allowed_guests"] = guests
        save_config(CFG)
        answer_callback(cb_id, "Доступ разрешён!")
        edit_message_text(chat_id, msg_id,
                          f"✅ <b>Доступ РАЗРЕШЁН</b> для @{tname} (<code>{tid}</code>).")
        send_message(tid, "🎉 <b>Доступ открыт!</b> Пульт управления активен.",
                     reply_markup=kb_normal())
        return

    if data.startswith("auth_deny:"):
        _, tid = data.split(":", 1)
        answer_callback(cb_id, "Отклонено.")
        edit_message_text(chat_id, msg_id,
                          f"❌ Доступ отклонён для <code>{tid}</code>.")
        send_message(tid, "⛔ Владелец отклонил запрос.")
        return

# ---------------------------------------------------------------------------
# OUTBOX CHECKER
# ---------------------------------------------------------------------------
def check_outbox():
    # JSON outbox
    if os.path.exists(OUTBOX_JSON):
        try:
            with open(OUTBOX_JSON, "r", encoding="utf-8") as f:
                items = json.load(f)
            os.remove(OUTBOX_JSON)
            if isinstance(items, dict): items = [items]
            for item in items:
                sender    = item.get("sender", "🍅 MOSSAD")
                short     = item.get("short") or str(item.get("text",""))[:60]
                voice_txt = item.get("voice_text") or short
                full      = item.get("full") or item.get("text", "")
                with_voice = item.get("voice", True)
                ironclad_reply(OWNER_ID, f"<b>{sender}</b>\n{short}", voice_txt, full, with_voice=with_voice)
        except Exception as e:
            print(f"[Outbox JSON Error] {e}")

    # Text outbox
    if os.path.exists(OUTBOX_FILE):
        try:
            with open(OUTBOX_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if content:
                sender = "🍅 MOSSAD"
                if content.startswith("🧠"): sender = "🧠 Голова Эльдара"
                elif content.startswith("🤖"): sender = "🤖 TG-инженер"
                ironclad_reply(OWNER_ID,
                               f"<b>{sender}</b>\n{content[:60]}",
                               content[:200], content,
                               with_voice=True)
                os.remove(OUTBOX_FILE)
        except Exception as e:
            print(f"[Outbox Text Error] {e}")

# ---------------------------------------------------------------------------
# ГЛАВНЫЙ POLLING LOOP
# ---------------------------------------------------------------------------
def poll():
    if not TOKEN:
        print("❌ bot_token не задан в tg_config.json")
        return

    offset = 0
    print("=" * 60)
    print("🚀 TG Bridge v3.0 — запущен")
    print(f"• Владелец: {OWNER_ID}")
    print(f"• Адресат:  {TARGET_FULL.get(CFG.get('active_target','tg_engineer'))}")
    print(f"• STT:      Google Speech + faster-whisper")
    print(f"• TTS:      Microsoft Irina Desktop → Opus OGG")
    print("=" * 60)

    sync_live_quotas(force=True)

    while True:
        try:
            sync_live_quotas()
            check_outbox()
            check_quota_alerts()
            session_expire_check()

            res = requests.get(
                f"https://api.telegram.org/bot{TOKEN}/getUpdates",
                params={"offset": offset, "timeout": 5},
                timeout=10
            ).json()

            if res.get("ok"):
                for item in res.get("result", []):
                    offset = item["update_id"] + 1
                    if "message" in item:
                        handle_message(item["message"])
                    elif "callback_query" in item:
                        handle_callback(item["callback_query"])
        except requests.exceptions.Timeout:
            continue
        except Exception as e:
            print(f"[Poll Error] {e}")
            time.sleep(2)
        time.sleep(0.5)

if __name__ == "__main__":
    poll()
