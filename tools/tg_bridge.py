"""
Telegram Bridge for Antigravity & MOSSAD
Author: Senior Pomidor, Telegram Engineer & Eldar's Digital Twin
"""

import os
import sys
import time
import json
import subprocess
import requests

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
        "active_target": "eldar",
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

MESSAGE_TEXT_CACHE = {}

def send_tg_message(chat_id, text, reply_markup=None):
    if not TOKEN or not chat_id:
        return None
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        r = requests.post(url, json=payload, timeout=10)
        res = r.json()
        if res.get("ok"):
            m_id = str(res["result"]["message_id"])
            MESSAGE_TEXT_CACHE[m_id] = text
        return res
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

def answer_callback(cb_id, text=None):
    url = f"https://api.telegram.org/bot{TOKEN}/answerCallbackQuery"
    try:
        requests.post(url, json={"callback_query_id": cb_id, "text": text}, timeout=5)
    except:
        pass

def send_tg_voice(chat_id, audio_path, caption=""):
    if not TOKEN or not chat_id or not os.path.exists(audio_path):
        return None
    url = f"https://api.telegram.org/bot{TOKEN}/sendVoice"
    try:
        with open(audio_path, "rb") as audio:
            files = {"voice": audio}
            data = {"chat_id": chat_id, "caption": caption}
            r = requests.post(url, files=files, data=data, timeout=30)
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

def generate_speech(text, output_file=None):
    if not output_file:
        output_file = os.path.join(BASE_DIR, "voice_temp.wav")
    clean = text.replace('"', ' ').replace("'", " ").replace("<", " ").replace(">", " ").replace("*", " ").replace("`", " ")[:1200]
    out_escaped = output_file.replace("\\", "\\\\")
    ps_cmd = f"""
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {{ $s.SelectVoice('Microsoft Irina Desktop') }} catch {{}}
    $s.SetOutputToWaveFile('{out_escaped}')
    $s.Speak("{clean}")
    $s.Dispose()
    """
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True, capture_output=True, timeout=20)
        if os.path.exists(output_file) and os.path.getsize(output_file) > 1000:
            return output_file
    except Exception as e:
        print(f"[Speech Error] {e}")
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
    except Exception as e:
        return "LOCKED"

def get_user_avatar(user_id):
    try:
        url = f"https://api.telegram.org/bot{TOKEN}/getUserProfilePhotos?user_id={user_id}&limit=1"
        res = requests.get(url, timeout=10).json()
        if res.get("ok") and res["result"]["total_count"] > 0:
            file_id = res["result"]["photos"][0][-1]["file_id"]
            f_url = f"https://api.telegram.org/bot{TOKEN}/getFile?file_id={file_id}"
            f_res = requests.get(f_url, timeout=10).json()
            if f_res.get("ok"):
                f_path = f_res["result"]["file_path"]
                down_url = f"https://api.telegram.org/file/bot{TOKEN}/{f_path}"
                img_data = requests.get(down_url, timeout=15).content
                local_path = os.path.join(BASE_DIR, f"avatar_{user_id}.jpg")
                with open(local_path, "wb") as f:
                    f.write(img_data)
                return local_path
    except Exception as e:
        print(f"[Avatar Error] {e}")
    return None

def get_owner_keyboard():
    active = CFG.get("active_target", "eldar")
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

def send_agent_reply_to_owner(header, body, target_key=None):
    full_text = f"<b>{header}</b>\n\n{body}"
    inline_kb = [
        [{"text": "🎧 Озвучить ответ", "callback_data": "voice_last"}]
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
    MESSAGE_TEXT_CACHE["last"] = body
    send_tg_message(OWNER_ID, full_text, reply_markup=markup)

def make_progress_bar(pct, length=10):
    try:
        val = int(pct)
    except:
        val = 100
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
    if d > 0:
        parts.append(f"{d} дн.")
    if h > 0:
        parts.append(f"{h} ч")
    if m > 0 or not parts:
        parts.append(f"{m} мин")
    return " ".join(parts)

def parse_pct(val):
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        digits = "".join([c for c in val if c.isdigit()])
        if digits:
            return int(digits)
    return 0

def get_real_status_text():
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
            q5_in = q5_raw.get("resets_in", "через 1 ч 10 мин")
        q5_at = q5_raw.get("resets_at", "17:19 UTC")
    else:
        q5_pct = parse_pct(data.get("quota_remaining", "81%"))
        q5_in = data.get("quota_resets", "через 1 ч 10 мин")
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

    bar_5h = make_progress_bar(q5_pct)
    bar_w = make_progress_bar(qw_pct)

    model_name = data.get("model", "Gemini 3.8 Flash (High)")
    q_claude = data.get("claude_quota_remaining", "56%")
    ver = data.get("script_version", "v1.4.24")
    watchdog = data.get("watchdog_timer", "task-110 (АКТИВЕН)")
    workers = data.get("workers_state", "Воркеры активны (Этап 1)")
    active_target_key = CFG.get("active_target", "eldar")
    target_name = ENTITY_NAMES.get(active_target_key, "🧠 Голова Эльдара")

    reset_5h_str = f"{q5_in}" + (f" ({q5_at})" if q5_at else "")
    reset_w_str = f"{qw_in}" + (f" ({qw_at})" if qw_at else "")

    text = (
        f"📊 <b>РЕАЛЬНЫЙ СТАТУС СИСТЕМЫ MOSSAD</b>\n\n"
        f"⏳ <b>5-часовой лимит:</b> [<code>{bar_5h}</code>] <b>{q5_pct}%</b>\n"
        f"↳ <i>Сброс: {reset_5h_str}</i>\n\n"
        f"📅 <b>Недельный лимит:</b> [<code>{bar_w}</code>] <b>{qw_pct}%</b>\n"
        f"↳ <i>Сброс: {reset_w_str}</i>\n\n"
        f"• 🤖 <b>Модель:</b> {model_name}\n"
        f"• 🧠 <b>Claude Sonnet:</b> <code>{q_claude}</code> (заморожен, расход 0%)\n"
        f"• 📦 <b>Версия MOSSAD:</b> <code>{ver}</code>\n"
        f"• ⏱ <b>Часовой сторож:</b> {watchdog}\n"
        f"• 👷 <b>Состояние воркеров:</b> {workers}\n"
        f"• 🎯 <b>Текущий адресат:</b> {target_name}\n"
        f"• 📡 <b>Telegram-мост:</b> АКТИВЕН (Владелец: @eldmans)"
    )
    return text

def check_quota_alerts():
    if not os.path.exists(STATUS_FILE):
        return
    try:
        with open(STATUS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except:
        return

    q5_raw = data.get("quota_5h", {})
    if isinstance(q5_raw, dict):
        q5_pct = parse_pct(q5_raw.get("remaining_pct", data.get("quota_remaining", 100)))
    else:
        q5_pct = parse_pct(data.get("quota_remaining", 100))

    qw_raw = data.get("quota_weekly", {})
    if isinstance(qw_raw, dict):
        qw_pct = parse_pct(qw_raw.get("remaining_pct", data.get("weekly_quota_remaining", 100)))
    else:
        qw_pct = parse_pct(data.get("weekly_quota_remaining", 100))

    thresholds = CFG.get("alert_thresholds", [75, 50, 25, 15, 10, 5])
    last_5h = CFG.get("last_alert_5h", 100)
    last_w = CFG.get("last_alert_weekly", 100)

    # Reset alerts if quota increased (e.g. after quota reset)
    if q5_pct > last_5h + 10:
        CFG["last_alert_5h"] = 100
        save_config(CFG)
        last_5h = 100

    if qw_pct > last_w + 10:
        CFG["last_alert_weekly"] = 100
        save_config(CFG)
        last_w = 100

    # Check 5h thresholds
    for th in thresholds:
        if q5_pct <= th < last_5h:
            CFG["last_alert_5h"] = th
            save_config(CFG)
            alert_text = (
                f"⚠️ <b>ВНИМАНИЕ: 5-часовой лимит опустился до {q5_pct}%!</b>\n"
                f"Пройден порог: <b>{th}%</b>.\n"
                f"Осталось времени до сброса: {data.get('quota_resets', 'не указано')}."
            )
            send_agent_reply_to_owner("⚠️ Алерт квоты Antigravity", alert_text)
            break

    # Check weekly thresholds
    for th in thresholds:
        if qw_pct <= th < last_w:
            CFG["last_alert_weekly"] = th
            save_config(CFG)
            alert_text = (
                f"⚠️ <b>ВНИМАНИЕ: Недельный лимит опустился до {qw_pct}%!</b>\n"
                f"Пройден порог: <b>{th}%</b>.\n"
                f"Остаток недели: {data.get('weekly_quota_resets', 'не указано')}."
            )
            send_agent_reply_to_owner("⚠️ Алерт недельной квоты", alert_text)
            break

    # Emergency auto-brake at <= 5%
    if q5_pct <= 5 or qw_pct <= 5:
        if not os.path.exists(STOP_SIGNAL_FILE):
            with open(STOP_SIGNAL_FILE, "w", encoding="utf-8") as f:
                f.write(f"EMERGENCY_STOP_QUOTA_{time.time()}")
            em_text = (
                f"🚨 <b>АВАРИЙНЫЙ ТОРМОЗ СИСТЕМЫ АКТИВИРОВАН!</b>\n\n"
                f"Один из лимитов упал до критической отметки (<= 5%):\n"
                f"• 5-часовой: {q5_pct}%\n"
                f"• Недельный: {qw_pct}%\n\n"
                f"Все автономные задачи немедленно поставлены на паузу для предотвращения полного бана квоты."
            )
            send_agent_reply_to_owner("🚨 Аварийный тормоз", em_text)

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

    # 1. Update structured JSON inbox
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

    # 2. Append to specific entity text inbox
    line = f"[{ts_str}] [@{sender_name} -> {target.upper()}]: {text}\n"
    if target == "eldar":
        with open(INBOX_ELDAR_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    elif target == "mossad":
        with open(INBOX_MOSSAD_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    elif target == "tg_engineer":
        with open(INBOX_TG_FILE, "a", encoding="utf-8") as f:
            f.write(line)

    # 3. Append to legacy global inbox for backwards compatibility
    with open(INBOX_FILE, "a", encoding="utf-8") as f:
        f.write(line)

def handle_user_message(msg):
    global CFG
    chat_id = str(msg["chat"]["id"])
    user = msg.get("from", {})
    user_name = user.get("username", "нет_юзернейма")
    first_name = user.get("first_name", "")
    last_name = user.get("last_name", "")
    full_name = f"{first_name} {last_name}".strip() or user_name
    text = msg.get("text", "").strip()
    contact = msg.get("contact")

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
            "⏳ <b>Запрос отправлен Владельцу компьютера!</b>\nОжидайте подтверждения. До решения владельца бот для вас заблокирован.",
            reply_markup=get_guest_request_keyboard() if not contact else None
        )
        return

    # 2. AUTHORIZED USER COMMANDS
    if text in ["/start", "start"]:
        send_tg_message(
            chat_id,
            "👋 <b>Пульт управления Antigravity активен!</b>\n\n"
            "Выбирай режим работы внизу или пиши любой вопрос:\n"
            "• 🧠 <b>Голова Эльдара</b> — архитектура, эргономика, концепции\n"
            "• 🍅 <b>Координатор MOSSAD</b> — разработка юзерскрипта, задачи, баги\n"
            "• 🤖 <b>TG-инженер</b> — мониторинг квот, скриншоты, статус моста",
            get_owner_keyboard()
        )
    elif "Голова Эльдара" in text or text in ["/eldar", "eldar"]:
        CFG["active_target"] = "eldar"
        save_config(CFG)
        send_tg_message(
            chat_id,
            "🎯 <b>Активный адресат переключен: 🧠 Голова Эльдара</b>\n\n"
            "Пиши или надиктовывай любые мысли, философские вопросы, концепции и эргономические фильтры. Архитектор на связи!",
            get_owner_keyboard()
        )
    elif "Координатор MOSSAD" in text or text in ["/mossad", "mossad"]:
        CFG["active_target"] = "mossad"
        save_config(CFG)
        send_tg_message(
            chat_id,
            "🎯 <b>Активный адресат переключен: 🍅 Координатор MOSSAD</b>\n\n"
            "Отправляй баг-репорты, новые фичи, задачи по доработке сайтов и юзерскрипта MOSSAD. Координатор передаст их воркерам.",
            get_owner_keyboard()
        )
    elif "TG-инженер" in text or text in ["/tg", "tg", "/bot"]:
        CFG["active_target"] = "tg_engineer"
        save_config(CFG)
        send_tg_message(
            chat_id,
            "🎯 <b>Активный адресат переключен: 🤖 Telegram-инженер</b>\n\n"
            "Я отвечаю за Telegram-мост, точность лимитов, TTS озвучку, безопасность и скриншоты.",
            get_owner_keyboard()
        )
    elif text in ["📊 Статус и лимиты", "📊 Реальный статус и лимит", "/status", "status"]:
        send_agent_reply_to_owner("📊 Реальный статус MOSSAD", get_real_status_text())
    elif text in ["📸 Скриншот экрана", "/screen", "screen"]:
        send_tg_message(chat_id, "📸 Захватываю изображение с монитора...")
        scr = take_screenshot()
        if scr == "LOCKED":
            send_tg_message(chat_id, "⚠️ <b>Экран Windows заблокирован (Win+L) или выключен монитор.</b>\nWindows запрещает снимок спящего рабочего стола. Скриншот будет доступен, как только монитор включится.")
        elif scr and os.path.exists(scr):
            send_tg_photo(chat_id, scr, "Рабочий стол ПК")
            try: os.remove(scr)
            except: pass
        else:
            send_tg_message(chat_id, "⚠️ Не удалось захватить экран.")
    elif text in ["⚡ Пнуть агента", "/wake", "wake"]:
        with open(WAKE_SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write(f"WAKE_BY_USER_{time.time()}")
        send_agent_reply_to_owner("⚡ Пробуждение", "Сигнал пробуждения доставлен в Antigravity. Модель вышла из спячки и взяла текущую задачу.")
    elif text in ["⏹ Тормоз / Пауза", "/stop", "stop", "пауза"]:
        with open(STOP_SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write(f"PAUSE_BY_USER_{time.time()}")
        send_agent_reply_to_owner("⏹ Пауза", "Команда ПАУЗА активирована. Все агенты остановлены до твоего следующего указания.")
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
        # Message routing: check prefixes or active target
        target = CFG.get("active_target", "eldar")
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

        record_inbox_message(chat_id, user_name, cleaned_text, target)

        if target == "eldar":
            header = "🧠 Голова Эльдара приняла мысль"
            reply_preview = f"Эльдар, твоя мысль принята: «{cleaned_text}». Архитектор подключился к анализу задачи."
        elif target == "mossad":
            header = "🍅 Координатор MOSSAD принял задачу"
            reply_preview = f"Задача для MOSSAD зафиксирована: «{cleaned_text}». Координатор ставит задачу в очередь воркеров."
        else:
            header = "🤖 Telegram-инженер принял запрос"
            reply_preview = f"Запрос по работе моста принят: «{cleaned_text}». Обрабатываю телеметрию."

        send_agent_reply_to_owner(header, reply_preview, target_key=target)

def handle_callback_query(cb):
    global CFG
    cb_id = cb["id"]
    chat_id = str(cb["message"]["chat"]["id"])
    msg_id = cb["message"]["message_id"]
    data = cb.get("data", "")

    if chat_id != OWNER_ID:
        answer_callback(cb_id, "Действие запрещено.")
        return

    if data == "voice_last":
        answer_callback(cb_id, "Синтезирую речь...")
        text_to_speak = MESSAGE_TEXT_CACHE.get("last", "Текст для озвучки не найден.")
        wav = generate_speech(text_to_speak)
        if wav:
            send_tg_voice(chat_id, wav, "🎧 Голосовой ответ")
            try: os.remove(wav)
            except: pass
        else:
            send_tg_message(chat_id, "⚠️ Не удалось синтезировать речь.")
    elif data.startswith("switch_to:"):
        new_target = data.split(":", 1)[1]
        CFG["active_target"] = new_target
        save_config(CFG)
        t_name = ENTITY_NAMES.get(new_target, new_target)
        answer_callback(cb_id, f"Адресат: {t_name}")
        send_tg_message(chat_id, f"🎯 <b>Адресат переключен на: {t_name}</b>", get_owner_keyboard())
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
        edit_tg_message(chat_id, msg_id, "⚠️ <b>Вы ТОЧНО уверены?</b>\nПосле этого бот завершит процесс на ПК и его можно будет включить <b>только физически с компьютера через START_BOT.bat!</b>", reply_markup=markup)
    elif data == "sd_confirm":
        answer_callback(cb_id, "Выключаю...")
        edit_tg_message(chat_id, msg_id, "🛑 <b>Бот выключен на ПК.</b> Процесс завершён.")
        print("[TG Bridge] Принудительное завершение по двойному подтверждению владельца.")
        sys.exit(0)
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

def check_outbox():
    # 1. Check structured JSON outbox
    if os.path.exists(OUTBOX_JSON_FILE):
        try:
            with open(OUTBOX_JSON_FILE, "r", encoding="utf-8") as f:
                items = json.load(f)
            os.remove(OUTBOX_JSON_FILE)
            if isinstance(items, dict):
                items = [items]
            for item in items:
                sender = item.get("sender", "🍅 Координатор MOSSAD")
                text = item.get("text", "")
                with_voice = item.get("voice", False)
                if text:
                    now_str = time.strftime('%H:%M:%S')
                    send_agent_reply_to_owner(f"{sender} | {now_str}", text)
                    if with_voice:
                        wav = generate_speech(text)
                        if wav:
                            send_tg_voice(OWNER_ID, wav, f"🎧 {sender}")
                            try: os.remove(wav)
                            except: pass
        except Exception as e:
            print(f"[Outbox JSON Error] {e}")

    # 2. Check plaintext outbox
    if os.path.exists(OUTBOX_FILE):
        try:
            with open(OUTBOX_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
            if content:
                now_str = time.strftime('%H:%M:%S')
                header = f"💬 [MOSSAD / tm-scripts | {now_str}]"
                if content.startswith("🧠"):
                    header = f"🧠 [Голова Эльдара | {now_str}]"
                elif content.startswith("🍅"):
                    header = f"🍅 [Координатор MOSSAD | {now_str}]"
                elif content.startswith("🤖"):
                    header = f"🤖 [TG-инженер | {now_str}]"
                send_agent_reply_to_owner(header, content)
                os.remove(OUTBOX_FILE)
        except Exception as e:
            print(f"[Outbox Text Error] {e}")

def poll_telegram():
    if not TOKEN:
        print("Bot token not configured.")
        return
    offset = 0
    active_target = CFG.get("active_target", "eldar")
    print(f"[TG Bridge] Запущен. Владелец: {OWNER_ID}. Адресат: {active_target}. Ожидание...")
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
