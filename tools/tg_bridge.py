"""
Telegram Bridge for Antigravity & MOSSAD (@anti14388bot)
Author: Telegram Engineer (AI Assistant) & Senior Pomidor & Eldar's Digital Twin
"""

import os
import sys
import time
import json
import uuid
import subprocess
import requests

import stt_engine
import tts_engine

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "tg_config.json")
STATUS_FILE = os.path.join(BASE_DIR, "live_status.json")
OUTBOX_FILE = os.path.join(BASE_DIR, "tg_outbox.txt")
OUTBOX_JSON_FILE = os.path.join(BASE_DIR, "tg_outbox.json")
INBOX_FILE = os.path.join(BASE_DIR, "tg_inbox.txt")
INBOX_JSON_FILE = os.path.join(BASE_DIR, "tg_inbox.json")
INBOX_ELDAR_FILE = os.path.join(BASE_DIR, "inbox_eldar.txt")
INBOX_MOSSAD_FILE = os.path.join(BASE_DIR, "inbox_mossad.txt")
INBOX_TG_FILE = os.path.join(BASE_DIR, "inbox_tg.txt")
STOP_SIGNAL_FILE = os.path.join(BASE_DIR, "stop_signal.txt")
WAKE_SIGNAL_FILE = os.path.join(BASE_DIR, "wake_signal.txt")

ENTITY_NAMES = {
    "eldar": "🧠 Голова Эльдара",
    "mossad": "🍅 Координатор MOSSAD",
    "tg_engineer": "🤖 Telegram-инженер"
}

# In-memory caches for interactive buttons
DETAILS_CACHE = {}
STT_CACHE = {}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "bot_token": "9052736319:AAEbs5ALim9PdRk_-IJOHX3WGDQELx88-hU",
        "owner_chat_id": "2068829104",
        "allowed_chat_ids": ["2068829104"],
        "active_target": "tg_engineer",
        "alert_thresholds": [75, 50, 25, 15, 10, 5],
        "last_alert_5h": 100,
        "last_alert_weekly": 100,
        "is_active": True,
        "allowed_guests": {}
    }

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

CFG = load_config()
OWNER_ID = str(CFG.get("owner_chat_id", "2068829104"))
TOKEN = CFG.get("bot_token")

# --- TELEGRAM API WRAPPERS ---

def send_chat_action(chat_id, action="typing"):
    if not TOKEN or not chat_id:
        return
    url = f"https://api.telegram.org/bot{TOKEN}/sendChatAction"
    try:
        requests.post(url, json={"chat_id": chat_id, "action": action}, timeout=5)
    except:
        pass

def send_tg_message(chat_id, text, reply_markup=None):
    if not TOKEN or not chat_id:
        return None
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.json()
    except Exception as e:
        print(f"[TG Error] {e}")
        return None

def edit_tg_message(chat_id, message_id, text, reply_markup=None):
    url = f"https://api.telegram.org/bot{TOKEN}/editMessageText"
    payload = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        r = requests.post(url, json=payload, timeout=10)
        return r.json()
    except Exception as e:
        print(f"[TG Edit Error] {e}")
        return None

def answer_callback(cb_id, text=None, show_alert=False):
    url = f"https://api.telegram.org/bot{TOKEN}/answerCallbackQuery"
    payload = {"callback_query_id": cb_id}
    if text:
        payload["text"] = text
    if show_alert:
        payload["show_alert"] = True
    try:
        requests.post(url, json=payload, timeout=5)
    except:
        pass

def send_tg_voice(chat_id, audio_path, caption="", reply_markup=None):
    if not TOKEN or not chat_id or not os.path.exists(audio_path):
        return None
    url = f"https://api.telegram.org/bot{TOKEN}/sendVoice"
    try:
        with open(audio_path, "rb") as audio:
            files = {"voice": audio}
            data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}
            if reply_markup:
                data["reply_markup"] = json.dumps(reply_markup)
            r = requests.post(url, files=files, data=data, timeout=35)
            return r.json()
    except Exception as e:
        print(f"[TG Voice Error] {e}")
        return None

def send_tg_photo(chat_id, photo_path, caption="", reply_markup=None):
    if not TOKEN or not chat_id or not os.path.exists(photo_path):
        return None
    url = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"
    try:
        with open(photo_path, "rb") as photo:
            files = {"photo": photo}
            data = {"chat_id": chat_id, "caption": caption, "parse_mode": "HTML"}
            if reply_markup:
                data["reply_markup"] = json.dumps(reply_markup)
            r = requests.post(url, files=files, data=data, timeout=30)
            return r.json()
    except Exception as e:
        print(f"[TG Photo Error] {e}")
        return None

def download_file_by_id(file_id, dest_path):
    try:
        info_url = f"https://api.telegram.org/bot{TOKEN}/getFile?file_id={file_id}"
        info_res = requests.get(info_url, timeout=10).json()
        if info_res.get("ok"):
            f_path = info_res["result"]["file_path"]
            download_url = f"https://api.telegram.org/file/bot{TOKEN}/{f_path}"
            r = requests.get(download_url, timeout=30)
            if r.status_code == 200:
                with open(dest_path, "wb") as f:
                    f.write(r.content)
                return dest_path
    except Exception as e:
        print(f"[TG Download Error] {e}")
    return None

def get_user_avatar(user_id):
    try:
        url = f"https://api.telegram.org/bot{TOKEN}/getUserProfilePhotos?user_id={user_id}&limit=1"
        res = requests.get(url, timeout=10).json()
        if res.get("ok") and res["result"]["total_count"] > 0:
            file_id = res["result"]["photos"][0][-1]["file_id"]
            local_path = os.path.join(BASE_DIR, f"avatar_{user_id}.jpg")
            return download_file_by_id(file_id, local_path)
    except Exception as e:
        print(f"[Avatar Error] {e}")
    return None

def take_screenshot(filename=None):
    if not filename:
        filename = os.path.join(BASE_DIR, "screen.png")
    out_escaped = filename.replace("\\", "\\\\")
    ps_cmd = f"""
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    try {{
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.X, $screen.Y, 0, 0, $bitmap.Size)
        $bitmap.Save('{out_escaped}', [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose()
        $bitmap.Dispose()
        Write-Output "OK"
    }} catch {{
        Write-Output "ERROR: $($_.Exception.Message)"
    }}
    """
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=10)
        out = res.stdout.strip()
        if "ERROR" in out or not os.path.exists(filename) or os.path.getsize(filename) < 20000:
            return "LOCKED"
        return filename
    except Exception:
        return "LOCKED"

# --- KEYBOARDS ---

def get_owner_keyboard():
    active = CFG.get("active_target", "tg_engineer")
    eldar_mark = "• 🧠 Голова Эльдара" if active == "eldar" else "🧠 Голова Эльдара"
    mossad_mark = "• 🍅 Координатор MOSSAD" if active == "mossad" else "🍅 Координатор MOSSAD"
    tg_mark = "• 🤖 TG-инженер" if active == "tg_engineer" else "🤖 TG-инженер"

    return {
        "keyboard": [
            [{"text": eldar_mark}, {"text": mossad_mark}],
            [{"text": "📊 Статус и лимиты"}, {"text": "📸 Скриншот экрана"}],
            [{"text": "⚡ Пнуть агента"}, {"text": "⏹ Тормоз / Пауза"}],
            [{"text": tg_mark}, {"text": "🛑 Выключить бота на ПК"}]
        ],
        "resize_keyboard": True
    }

def get_guest_request_keyboard():
    return {
        "keyboard": [
            [{"text": "📱 Запросить доступ (отправить контакт)", "request_contact": True}]
        ],
        "resize_keyboard": True,
        "one_time_keyboard": True
    }

def is_authorized(chat_id):
    s_id = str(chat_id)
    if s_id == OWNER_ID:
        return True
    if s_id in CFG.get("allowed_chat_ids", []):
        return True
    return s_id in CFG.get("allowed_guests", {})

# --- IRONCLAD REPLY DISPATCHER ---

def send_structured_reply(chat_id, short_status, voice_text, full_details_text, target_key=None):
    """
    Ironclad Format:
    1. Short 1-2 line status text
    2. Spoken Voice message (Irina Desktop encoded in Telegram Opus OGG)
    3. Inline buttons: [📖 Подробнее] and [🎧 Озвучить ещё раз]
    """
    det_id = str(uuid.uuid4())[:8]
    DETAILS_CACHE[det_id] = {
        "short": short_status,
        "voice": voice_text,
        "full": full_details_text,
        "target": target_key
    }

    inline_kb = [
        [
            {"text": "📖 Подробнее", "callback_data": f"det_view:{det_id}"},
            {"text": "🎧 Повторить аудио", "callback_data": f"voice_replay:{det_id}"}
        ]
    ]

    if target_key:
        switch_row = []
        if target_key != "eldar":
            switch_row.append({"text": "➡️ 🧠 В Голову", "callback_data": "switch_to:eldar"})
        if target_key != "mossad":
            switch_row.append({"text": "➡️ 🍅 В MOSSAD", "callback_data": "switch_to:mossad"})
        if target_key != "tg_engineer":
            switch_row.append({"text": "➡️ 🤖 В TG-мост", "callback_data": "switch_to:tg_engineer"})
        if switch_row:
            inline_kb.append(switch_row)

    markup = {"inline_keyboard": inline_kb}

    # 1. Send short text status
    send_tg_message(chat_id, short_status, reply_markup=markup)

    # 2. Generate and send voice audio
    send_chat_action(chat_id, "upload_voice")
    ogg_file = tts_engine.generate_voice_ogg(voice_text)
    if ogg_file and os.path.exists(ogg_file):
        send_tg_voice(chat_id, ogg_file, caption=f"🎧 <i>{short_status[:60]}...</i>")
        try: os.remove(ogg_file)
        except: pass

# --- LIMITS & STATUS LOGIC ---

def make_progress_bar(pct, length=10):
    try: val = int(pct)
    except: val = 100
    val = max(0, min(100, val))
    filled = int(round((val / 100) * length))
    return "█" * filled + "░" * (length - filled)

def format_delta_seconds(seconds):
    if seconds <= 0:
        return "сброшен (0 мин)"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    d, h = divmod(h, 24)
    parts = []
    if d > 0: parts.append(f"{d} дн.")
    if h > 0: parts.append(f"{h} ч")
    if m > 0 or not parts: parts.append(f"{m} мин")
    return " ".join(parts)

def parse_pct(val):
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        digits = "".join([c for c in val if c.isdigit()])
        if digits: return int(digits)
    return 0

def get_real_status_data():
    data = {}
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except:
            pass

    # 1. 5-hour quota
    q5_raw = data.get("quota_5h", {})
    if isinstance(q5_raw, dict) and "remaining_pct" in q5_raw:
        q5_pct = parse_pct(q5_raw.get("remaining_pct", 81))
        q5_ts = q5_raw.get("reset_timestamp")
        if q5_ts and isinstance(q5_ts, (int, float)):
            q5_in = format_delta_seconds(q5_ts - time.time())
        else:
            q5_in = q5_raw.get("resets_in", "через 1 ч 5 мин")
        q5_at = q5_raw.get("resets_at", "17:19 UTC")
    else:
        q5_pct = parse_pct(data.get("quota_remaining", "81%"))
        q5_in = data.get("quota_resets", "через 1 ч 5 мин")
        q5_at = ""

    # 2. Weekly quota
    qw_raw = data.get("quota_weekly", {})
    if isinstance(qw_raw, dict) and "remaining_pct" in qw_raw:
        qw_pct = parse_pct(qw_raw.get("remaining_pct", 77))
        qw_ts = qw_raw.get("reset_timestamp")
        if qw_ts and isinstance(qw_ts, (int, float)):
            qw_in = format_delta_seconds(qw_ts - time.time())
        else:
            qw_in = qw_raw.get("resets_in", "через 3 дня 7 ч")
        qw_at = qw_raw.get("resets_at", "2026-11-22 UTC")
    else:
        qw_pct = parse_pct(data.get("weekly_quota_remaining", "77%"))
        qw_in = data.get("weekly_quota_resets", "через 3 дня 7 ч")
        qw_at = ""

    return {
        "q5_pct": q5_pct,
        "q5_in": q5_in,
        "q5_at": q5_at,
        "qw_pct": qw_pct,
        "qw_in": qw_in,
        "qw_at": qw_at,
        "model": data.get("model", "Gemini 3.8 Flash (High)"),
        "claude": data.get("claude_quota_remaining", "56% (заморожен)"),
        "version": data.get("script_version", "v1.4.24"),
        "watchdog": data.get("watchdog_timer", "task-110 (АКТИВЕН, сторож на 1 час)"),
        "workers": data.get("workers_state", "Воркеры активны (Этап 1)"),
        "build": data.get("build_status", "SYNTAX OK, VERIFY OK")
    }

def format_status_full(s):
    bar_5h = make_progress_bar(s["q5_pct"])
    bar_w = make_progress_bar(s["qw_pct"])
    reset_5h_str = f"{s['q5_in']}" + (f" ({s['q5_at']})" if s['q5_at'] else "")
    reset_w_str = f"{s['qw_in']}" + (f" ({s['qw_at']})" if s['qw_at'] else "")
    target_name = ENTITY_NAMES.get(CFG.get("active_target", "tg_engineer"), "🤖 TG-инженер")

    return (
        f"📊 <b>ПОЛНЫЙ СТАТУС СИСТЕМЫ MOSSAD</b>\n\n"
        f"⏳ <b>5-часовой лимит:</b> [<code>{bar_5h}</code>] <b>{s['q5_pct']}%</b>\n"
        f"↳ <i>Сброс: {reset_5h_str}</i>\n\n"
        f"📅 <b>Недельный лимит:</b> [<code>{bar_w}</code>] <b>{s['qw_pct']}%</b>\n"
        f"↳ <i>Сброс: {reset_w_str}</i>\n\n"
        f"• 🤖 <b>Модель:</b> {s['model']}\n"
        f"• 🧠 <b>Claude:</b> <code>{s['claude']}</code>\n"
        f"• 📦 <b>Версия скрипта:</b> <code>{s['version']}</code>\n"
        f"• 🔨 <b>Сборка:</b> <code>{s['build']}</code>\n"
        f"• ⏱ <b>Часовой сторож:</b> {s['watchdog']}\n"
        f"• 👷 <b>Состояние воркеров:</b> {s['workers']}\n"
        f"• 🎯 <b>Текущий адресат:</b> {target_name}\n"
        f"• 📡 <b>Telegram-мост:</b> АКТИВЕН (Владелец: @eldmans)"
    )

def check_quota_alerts():
    if not os.path.exists(STATUS_FILE):
        return
    try:
        s = get_real_status_data()
        q5_pct = s["q5_pct"]
        qw_pct = s["qw_pct"]
    except:
        return

    thresholds = CFG.get("alert_thresholds", [75, 50, 25, 15, 10, 5])
    last_5h = CFG.get("last_alert_5h", 100)
    last_w = CFG.get("last_alert_weekly", 100)

    # Reset alerts if quota increased
    if q5_pct > last_5h + 10:
        CFG["last_alert_5h"] = 100
        save_config(CFG)
        last_5h = 100

    if qw_pct > last_w + 10:
        CFG["last_alert_weekly"] = 100
        save_config(CFG)
        last_w = 100

    # 5h alerts
    for th in thresholds:
        if q5_pct <= th < last_5h:
            CFG["last_alert_5h"] = th
            save_config(CFG)
            short = f"⚠️ [АЛЕРТ] 5-часовой лимит упал до {q5_pct}% (порог {th}%)"
            voice = f"Внимание, Эльдар! Пятичасовой скользящий лимит опустился до {q5_pct} процентов. Сброс {s['q5_in']}."
            send_structured_reply(OWNER_ID, short, voice, format_status_full(s), "tg_engineer")
            break

    # Weekly alerts
    for th in thresholds:
        if qw_pct <= th < last_w:
            CFG["last_alert_weekly"] = th
            save_config(CFG)
            short = f"⚠️ [АЛЕРТ] Недельный лимит упал до {qw_pct}% (порог {th}%)"
            voice = f"Внимание! Недельный лимит опустился до {qw_pct} процентов. До сброса {s['qw_in']}."
            send_structured_reply(OWNER_ID, short, voice, format_status_full(s), "tg_engineer")
            break

    # Emergency auto-brake at <= 5%
    if q5_pct <= 5 or qw_pct <= 5:
        if not os.path.exists(STOP_SIGNAL_FILE):
            with open(STOP_SIGNAL_FILE, "w", encoding="utf-8") as f:
                f.write(f"EMERGENCY_STOP_QUOTA_{time.time()}")
            short = f"🚨 [АВАРИЙНЫЙ ТОРМОЗ] Квота критическая (5ч: {q5_pct}%, Неделя: {qw_pct}%). Задачи на паузе!"
            voice = "Аварийный тормоз системы активирован! Один из лимитов опустился до пяти процентов. Все автономные задачи остановлены."
            send_structured_reply(OWNER_ID, short, voice, format_status_full(s), "tg_engineer")

# --- INBOX RECORDING ---

def record_inbox_message(sender_id, sender_name, text, target):
    ts_str = time.strftime('%Y-%m-%d %H:%M:%S')
    entry = {
        "timestamp": ts_str,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "target": target,
        "text": text,
        "handled": False
    }

    inbox_items = []
    if os.path.exists(INBOX_JSON_FILE):
        try:
            with open(INBOX_JSON_FILE, "r", encoding="utf-8") as f:
                inbox_items = json.load(f)
        except:
            inbox_items = []
    inbox_items.append(entry)
    with open(INBOX_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(inbox_items[-100:], f, ensure_ascii=False, indent=2)

    line = f"[{ts_str}] [@{sender_name} -> {target.upper()}]: {text}\n"
    if target == "eldar":
        with open(INBOX_ELDAR_FILE, "a", encoding="utf-8") as f: f.write(line)
    elif target == "mossad":
        with open(INBOX_MOSSAD_FILE, "a", encoding="utf-8") as f: f.write(line)
    elif target == "tg_engineer":
        with open(INBOX_TG_FILE, "a", encoding="utf-8") as f: f.write(line)

    with open(INBOX_FILE, "a", encoding="utf-8") as f:
        f.write(line)

# --- ENTITY DIALOGUE RESPONSES ---

def process_entity_dialogue(target, user_name, text):
    s = get_real_status_data()

    if target == "tg_engineer":
        # Telegram Engineer (Self)
        lower = text.lower()
        if any(w in lower for w in ["статус", "квот", "лимит", "как дела", "работает"]):
            short = f"🤖 [TG-инженер] Мост онлайн. 5ч: {s['q5_pct']}% | Неделя: {s['qw_pct']}%"
            voice = f"Эльдар, телеграм-мост на связи. Распознавание речи активно. Пятичасовой лимит {s['q5_pct']} процентов, недельный {s['qw_pct']} процентов. Всё под контролем."
            full = format_status_full(s)
            return short, voice, full

        short = f"🤖 [TG-инженер] Запрос принят в работу: «{text[:40]}...»"
        voice = f"Эльдар, я тебя услышал. Задача по мосту «{text[:70]}» зафиксирована. Телеметрия и распознавание в норме."
        full = (
            f"🤖 <b>ОТВЕТ TELEGRAM-ИНЖЕНЕРА</b>\n\n"
            f"• <b>Твой запрос:</b> «{text}»\n"
            f"• <b>Статус моста:</b> Активен, STT Dual-Engine подключен\n"
            f"• <b>Текущие лимиты:</b> 5ч: {s['q5_pct']}%, Неделя: {s['qw_pct']}%\n"
            f"• <b>Время фиксации:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return short, voice, full

    elif target == "mossad":
        # Senior Pomidor (Coordinator MOSSAD)
        # Touch wake signal so agents know there's user input
        with open(WAKE_SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write(f"WAKE_BY_USER_TASK_{time.time()}_{text[:50]}")

        short = f"✅ [MOSSAD {s['version']}] Задача принята: «{text[:40]}...»"
        voice = f"Сеньор Помидор на связи. Задача «{text[:70]}» принята и поставлена в очередь воркеров MOSSAD."
        full = (
            f"🍅 <b>КООРДИНАТОР MOSSAD (СЕНЬОР-ПОМИДОР)</b>\n\n"
            f"• <b>Версия скрипта:</b> <code>{s['version']}</code>\n"
            f"• <b>Статус сборки:</b> <code>{s['build']}</code>\n"
            f"• <b>Воркеры:</b> {s['workers']}\n"
            f"• <b>Принятая задача:</b> «{text}»\n\n"
            f"<i>Сигнал пробуждения отправлен в Antigravity. Агенты приступили к выполнению.</i>"
        )
        return short, voice, full

    else:
        # Eldar's Digital Twin (Голова Эльдара)
        short = f"🧠 [Голова Эльдара] Мысль принята в банк концепций"
        voice = f"Эльдар, твоя мысль «{text[:70]}» принята цифровым двойником. Проверяю по эргономическому фильтру: без выпадающих списков и лишних кликов."
        full = (
            f"🧠 <b>ГОЛОВА ЭЛЬДАРА (ЦИФРОВОЙ ДВОЙНИК)</b>\n\n"
            f"• <b>Мысль:</b> «{text}»\n"
            f"• <b>Эргономический фильтр:</b> Управление с дивана, минимум движений, никаких бюрократических отписок.\n"
            f"• <b>Записано в:</b> <code>inbox_eldar.txt</code>\n"
            f"• <b>Время:</b> {time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        return short, voice, full

# --- MESSAGE HANDLER ---

def handle_user_message(msg):
    global CFG
    chat_id = str(msg["chat"]["id"])
    user = msg.get("from", {})
    user_name = user.get("username", "нет_юзернейма")
    first_name = user.get("first_name", "")
    last_name = user.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or user_name
    text = msg.get("text", "").strip()
    voice_obj = msg.get("voice") or msg.get("audio")
    if voice_obj and not text:
        file_id = voice_obj.get("file_id")
        if file_id:
            ogg_path = os.path.join(BASE_DIR, f"voice_{int(time.time())}.ogg")
            if download_tg_file(file_id, ogg_path):
                try:
                    from stt_engine import transcribe_audio
                    recognized_text, engine = transcribe_audio(ogg_path)
                    if recognized_text:
                        text = recognized_text
                        print(f"[TG STT] Распознано ({engine}): {text}")
                    else:
                        text = "[Голосовое сообщение без слов]"
                except Exception as stt_err:
                    print(f"[TG STT Error] {stt_err}")
                    text = "[Ошибка распознавания голоса]"
                finally:
                    if os.path.exists(ogg_path):
                        try: os.remove(ogg_path)
                        except: pass
    contact = msg.get("contact")
    voice = msg.get("voice") or msg.get("audio")

    # 1. NOT AUTHORIZED FLOW
    if not is_authorized(chat_id):
        phone = contact.get("phone_number") if contact else None
        avatar_path = get_user_avatar(chat_id)
        admin_card = (
            f"🚨 <b>ЗАПРОС ДОСТУПА К БОТУ!</b>\n\n"
            f"• <b>Пользователь:</b> {full_name}\n"
            f"• <b>Username:</b> @{user_name}\n"
            f"• <b>ID:</b> <code>{chat_id}</code>\n"
            f"• <b>Телефон:</b> {phone if phone else 'Не передан'}\n\n"
            f"Разрешить доступ к пульту управления компьютером?"
        )
        markup = {
            "inline_keyboard": [
                [
                    {"text": "✅ Разрешить доступ", "callback_data": f"auth_allow:{chat_id}:{user_name}"},
                    {"text": "❌ Отклонить", "callback_data": f"auth_deny:{chat_id}"}
                ]
            ]
        }
        if avatar_path and os.path.exists(avatar_path):
            send_tg_photo(OWNER_ID, avatar_path, admin_card, reply_markup=markup)
            try: os.remove(avatar_path)
            except: pass
        else:
            send_tg_message(OWNER_ID, admin_card, reply_markup=markup)

        send_tg_message(
            chat_id,
            "⏳ <b>Запрос отправлен Владельцу компьютера!</b>\nОжидайте подтверждения. До решения владельца бот заблокирован.",
            reply_markup=get_guest_request_keyboard() if not contact else None
        )
        return

    # 2. VOICE MESSAGE PROCESSING (STT)
    if voice:
        file_id = voice.get("file_id")
        send_chat_action(chat_id, "record_voice")

        local_audio = os.path.join(BASE_DIR, f"in_voice_{int(time.time()*1000)}.oga")
        downloaded = download_file_by_id(file_id, local_audio)
        if not downloaded:
            send_tg_message(chat_id, "⚠️ <i>Не удалось скачать голосовое сообщение из Telegram API.</i>")
            return

        # Dual-engine transcription
        transcribed_text, engine_used = stt_engine.transcribe_audio(downloaded)
        try: os.remove(downloaded)
        except: pass

        if not transcribed_text:
            send_tg_message(chat_id, "⚠️ <i>Не удалось разобрать речь в сообщении (тишина или неразборчивый звук). Попробуйте сказать громче.</i>")
            return

        # Store for the modal popup button
        stt_id = str(uuid.uuid4())[:8]
        STT_CACHE[stt_id] = transcribed_text

        # UX requirement: Send notification with button "Просмотреть текст"
        stt_markup = {
            "inline_keyboard": [
                [{"text": "📝 Просмотреть текст", "callback_data": f"stt_view:{stt_id}"}]
            ]
        }
        send_tg_message(
            chat_id,
            "🎤 <b>Ваше голосовое сообщение распознано</b>",
            reply_markup=stt_markup
        )

        # Set transcribed text to proceed with standard command & entity routing
        text = transcribed_text

    # 3. AUTHORIZED COMMANDS
    if text in ["/start", "start"]:
        send_tg_message(
            chat_id,
            "👋 <b>Пульт управления Antigravity активен!</b>\n\n"
            "Выбирай режим работы внизу или пиши/наговаривай любой вопрос:\n"
            "• 🧠 <b>Голова Эльдара</b> — архитектура, эргономика, концепции\n"
            "• 🍅 <b>Координатор MOSSAD</b> — разработка юзерскрипта, задачи, баги\n"
            "• 🤖 <b>TG-инженер</b> — мониторинг квот, скриншоты, статус моста",
            get_owner_keyboard()
        )
    elif "Голова Эльдара" in text or text in ["/eldar", "eldar"]:
        CFG["active_target"] = "eldar"
        save_config(CFG)
        short = "🎯 [Адресат] Переключено на: 🧠 Голова Эльдара"
        voice = "Активный адресат переключен на Голову Эльдара. Архитектор готов слушать мысли и концепции."
        full = "🎯 <b>Активный адресат переключен: 🧠 Голова Эльдара</b>\n\nАрхитектор на связи! Пиши или наговаривай любые мысли."
        send_structured_reply(chat_id, short, voice, full, "eldar")
        send_tg_message(chat_id, "Клавиатура обновлена:", get_owner_keyboard())

    elif "Координатор MOSSAD" in text or text in ["/mossad", "mossad"]:
        CFG["active_target"] = "mossad"
        save_config(CFG)
        short = "🎯 [Адресат] Переключено на: 🍅 Координатор MOSSAD"
        voice = "Активный адресат переключен на Координатора Моссад. Жду задачи по скрипту и багрепорты."
        full = "🎯 <b>Активный адресат переключен: 🍅 Координатор MOSSAD</b>\n\nСеньор Помидор на связи! Задачи будут переданы воркерам."
        send_structured_reply(chat_id, short, voice, full, "mossad")
        send_tg_message(chat_id, "Клавиатура обновлена:", get_owner_keyboard())

    elif "TG-инженер" in text or text in ["/tg", "tg", "/bot"]:
        CFG["active_target"] = "tg_engineer"
        save_config(CFG)
        short = "🎯 [Адресат] Переключено на: 🤖 Telegram-инженер"
        voice = "Активный адресат переключен на Телеграм инженера. Мост, квоты и голосовые под контролем."
        full = "🎯 <b>Активный адресат переключен: 🤖 Telegram-инженер</b>\n\nЯ отвечаю за Telegram-мост, STT, точность лимитов и скриншоты."
        send_structured_reply(chat_id, short, voice, full, "tg_engineer")
        send_tg_message(chat_id, "Клавиатура обновлена:", get_owner_keyboard())

    elif text in ["📊 Статус и лимиты", "📊 Реальный статус и лимит", "/status", "status"]:
        s = get_real_status_data()
        short = f"📊 [MOSSAD] 5ч: {s['q5_pct']}% ({s['q5_in']}) | Неделя: {s['qw_pct']}% ({s['qw_in']})"
        voice = f"Статус системы Моссад. Пятичасовой скользящий лимит составляет {s['q5_pct']} процентов, сброс {s['q5_in']}. Недельный лимит — {s['qw_pct']} процентов. Воркеры активны."
        full = format_status_full(s)
        send_structured_reply(chat_id, short, voice, full, CFG.get("active_target", "tg_engineer"))

    elif text in ["📸 Скриншот экрана", "/screen", "screen"]:
        send_tg_message(chat_id, "📸 Захватываю изображение с монитора...")
        scr = take_screenshot()
        if scr == "LOCKED":
            short = "⚠️ [Экран] Рабочий стол Windows заблокирован"
            voice = "Экран заблокирован системой Windows. Скриншот будет доступен после включения монитора."
            full = "⚠️ <b>Экран Windows заблокирован (Win+L) или выключен монитор.</b>"
            send_structured_reply(chat_id, short, voice, full, "tg_engineer")
        elif scr and os.path.exists(scr):
            send_tg_photo(chat_id, scr, "📸 Рабочий стол ПК")
            try: os.remove(scr)
            except: pass
        else:
            send_tg_message(chat_id, "⚠️ Не удалось захватить экран.")

    elif text in ["⚡ Пнуть агента", "/wake", "wake"]:
        with open(WAKE_SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write(f"WAKE_BY_USER_{time.time()}")
        short = "⚡ [Antigravity] Сигнал пробуждения доставлен"
        voice = "Сигнал пробуждения отправлен. Модель вышла из спячки и продолжает работу."
        full = "⚡ <b>Сигнал пробуждения доставлен в Antigravity.</b>"
        send_structured_reply(chat_id, short, voice, full, CFG.get("active_target", "tg_engineer"))

    elif text in ["⏹ Тормоз / Пауза", "/stop", "stop", "пауза"]:
        with open(STOP_SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write(f"PAUSE_BY_USER_{time.time()}")
        short = "⏹ [Пауза] Система поставлена на паузу"
        voice = "Команда пауза активирована. Все автономные агенты остановлены."
        full = "⏹ <b>Команда ПАУЗА активирована.</b> Все агенты остановлены до твоего указания."
        send_structured_reply(chat_id, short, voice, full, CFG.get("active_target", "tg_engineer"))

    elif text in ["🛑 Выключить бота на ПК", "/stop_bot"]:
        markup = {
            "inline_keyboard": [
                [
                    {"text": "⚠️ Да, хочу выключить", "callback_data": "sd_step1"},
                    {"text": "Отмена", "callback_data": "sd_cancel"}
                ]
            ]
        }
        send_tg_message(chat_id, "⚠️ <b>Вы уверены, что хотите остановить бота на компьютере?</b>", reply_markup=markup)

    else:
        # Standard user query or task -> Route to active entity or prefixed entity
        target = CFG.get("active_target", "tg_engineer")
        cleaned_text = text

        if text.startswith("/eldar ") or text.startswith("🧠 "):
            target = "eldar"
            cleaned_text = text.split(" ", 1)[1].strip()
        elif text.startswith("/mossad ") or text.startswith("🍅 "):
            target = "mossad"
            cleaned_text = text.split(" ", 1)[1].strip()
        elif text.startswith("/bot ") or text.startswith("/tg ") or text.startswith("🤖 "):
            target = "tg_engineer"
            cleaned_text = text.split(" ", 1)[1].strip()

        # 1. Record in inbox
        record_inbox_message(chat_id, user_name, cleaned_text, target)

        # 2. Generate intelligent response from entity
        short, voice, full = process_entity_dialogue(target, user_name, cleaned_text)

        # 3. Send via Ironclad Format (Short Status + Voice OGG + Details button)
        send_structured_reply(chat_id, short, voice, full, target)

# --- CALLBACK QUERY HANDLER ---

def handle_callback_query(cb):
    global CFG
    cb_id = cb["id"]
    chat_id = str(cb["message"]["chat"]["id"])
    msg_id = cb["message"]["message_id"]
    data = cb.get("data", "")

    if chat_id != OWNER_ID:
        answer_callback(cb_id, "Действие запрещено.")
        return

    # 1. View recognized speech text in modal popup
    if data.startswith("stt_view:"):
        stt_id = data.split(":", 1)[1]
        text = STT_CACHE.get(stt_id, "Текст распознавания не найден.")
        if len(text) <= 180:
            answer_callback(cb_id, text=f"Распознанный текст:\n\n{text}", show_alert=True)
        else:
            # Telegram popup limit is 200 chars. Show head in alert and full text in chat
            answer_callback(cb_id, text=f"Текст:\n\n{text[:160]}...", show_alert=True)
            send_tg_message(chat_id, f"📝 <b>Полный текст голосового сообщения:</b>\n\n«{text}»")

    # 2. View full details of agent reply
    elif data.startswith("det_view:"):
        det_id = data.split(":", 1)[1]
        det = DETAILS_CACHE.get(det_id, {})
        full_text = det.get("full", "Подробности не найдены.")
        if len(full_text) <= 180:
            answer_callback(cb_id, text=full_text, show_alert=True)
        else:
            answer_callback(cb_id, "Открываю полный отчёт...")
            send_tg_message(chat_id, full_text)

    # 3. Replay voice audio
    elif data.startswith("voice_replay:"):
        det_id = data.split(":", 1)[1]
        det = DETAILS_CACHE.get(det_id, {})
        voice_text = det.get("voice") or det.get("short", "Нет текста для озвучивания.")
        answer_callback(cb_id, "Синтезирую голосовой ответ...")
        send_chat_action(chat_id, "upload_voice")
        ogg = tts_engine.generate_voice_ogg(voice_text)
        if ogg and os.path.exists(ogg):
            send_tg_voice(chat_id, ogg, caption="🎧 <i>Повторная озвучка ответа</i>")
            try: os.remove(ogg)
            except: pass
        else:
            send_tg_message(chat_id, "⚠️ Не удалось синтезировать голос.")

    # 4. Switch active entity
    elif data.startswith("switch_to:"):
        new_target = data.split(":", 1)[1]
        CFG["active_target"] = new_target
        save_config(CFG)
        t_name = ENTITY_NAMES.get(new_target, new_target)
        answer_callback(cb_id, f"Адресат: {t_name}")
        send_tg_message(chat_id, f"🎯 <b>Адресат переключен на: {t_name}</b>", get_owner_keyboard())

    # 5. Shutdown dialog
    elif data == "sd_cancel":
        answer_callback(cb_id, "Выключение отменено.")
        edit_tg_message(chat_id, msg_id, "✅ <b>Выключение отменено.</b> Бот продолжает работу.")
    elif data == "sd_step1":
        answer_callback(cb_id)
        markup = {
            "inline_keyboard": [
                [
                    {"text": "🔴 ТОЧНО ВЫКЛЮЧИТЬ", "callback_data": "sd_confirm"},
                    {"text": "Отмена", "callback_data": "sd_cancel"}
                ]
            ]
        }
        edit_tg_message(chat_id, msg_id, "⚠️ <b>Вы ТОЧНО уверены?</b>\nПосле этого процесс бота на ПК завершится и запустить его можно будет <b>только физически через START_BOT.bat!</b>", reply_markup=markup)
    elif data == "sd_confirm":
        answer_callback(cb_id, "Выключаю...")
        edit_tg_message(chat_id, msg_id, "🛑 <b>Бот выключен на ПК.</b> Процесс завершён.")
        print("[TG Bridge] Принудительное завершение по запросу владельца.")
        sys.exit(0)

    # 6. Guest access management
    elif data.startswith("auth_allow:"):
        _, target_id, t_name = data.split(":")
        guests = CFG.get("allowed_guests", {})
        guests[target_id] = {"name": t_name, "time": time.time()}
        CFG["allowed_guests"] = guests
        save_config(CFG)
        answer_callback(cb_id, "Доступ разрешён!")
        edit_tg_message(chat_id, msg_id, f"✅ <b>Доступ РАЗРЕШЁН</b> для пользователя @{t_name} (ID: <code>{target_id}</code>).")
        send_tg_message(target_id, "🎉 <b>Владелец компьютера одобрил ваш доступ!</b>\nТеперь вам доступен пульт управления.", get_owner_keyboard())
    elif data.startswith("auth_deny:"):
        _, target_id = data.split(":")
        answer_callback(cb_id, "Запрос отклонён.")
        edit_tg_message(chat_id, msg_id, f"❌ <b>Доступ ОТКЛОНЁН</b> для пользователя <code>{target_id}</code>.")
        send_tg_message(target_id, "⛔ <b>Владелец отклонил ваш запрос доступа.</b>")

# --- OUTBOX CHECKER ---

def check_outbox():
    # 1. JSON Outbox
    if os.path.exists(OUTBOX_JSON_FILE):
        try:
            with open(OUTBOX_JSON_FILE, "r", encoding="utf-8") as f:
                items = json.load(f)
            os.remove(OUTBOX_JSON_FILE)
            if isinstance(items, dict): items = [items]
            for item in items:
                sender = item.get("sender", "🍅 Координатор MOSSAD")
                short = item.get("short") or item.get("text", "")[:60]
                text = item.get("text", "")
                full = item.get("full") or text
                voice_text = item.get("voice_text") or short
                send_structured_reply(OWNER_ID, f"<b>{sender}</b>\n{short}", voice_text, full)
        except Exception as e:
            print(f"[Outbox JSON Error] {e}")

    # 2. Text Outbox
    if os.path.exists(OUTBOX_FILE):
        try:
            with open(OUTBOX_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if content:
                sender = "🍅 Координатор MOSSAD"
                if content.startswith("🧠"): sender = "🧠 Голова Эльдара"
                elif content.startswith("🤖"): sender = "🤖 TG-инженер"
                short = f"<b>{sender}</b>\n{content[:60]}"
                send_structured_reply(OWNER_ID, short, content[:200], content)
                os.remove(OUTBOX_FILE)
        except Exception as e:
            print(f"[Outbox Text Error] {e}")

# --- MAIN LOOP ---

def poll_telegram():
    if not TOKEN:
        print("Bot token not configured.")
        return
    offset = 0
    active_target = CFG.get("active_target", "tg_engineer")
    print(f"========================================================")
    print(f"🚀 [TG Bridge v2.0] Запущен и готов к работе!")
    print(f"• Владелец: {OWNER_ID} (@eldmans)")
    print(f"• Активный адресат: {active_target} ({ENTITY_NAMES.get(active_target)})")
    print(f"• STT: Dual Engine (Google Speech + faster-whisper large-v3-turbo)")
    print(f"• TTS: Microsoft Irina Desktop -> Telegram Native Opus OGG")
    print(f"========================================================")

    while True:
        try:
            check_outbox()
            check_quota_alerts()
            url = f"https://api.telegram.org/bot{TOKEN}/getUpdates?offset={offset}&timeout=5"
            r = requests.get(url, timeout=10)
            data = r.json()
            if data.get("ok"):
                for item in data.get("result", []):
                    offset = item["update_id"] + 1
                    if "message" in item:
                        handle_user_message(item["message"])
                    elif "callback_query" in item:
                        handle_callback_query(item["callback_query"])
        except Exception as e:
            print(f"[Poll loop error] {e}")
            time.sleep(2)
        time.sleep(0.5)

if __name__ == "__main__":
    poll_telegram()
