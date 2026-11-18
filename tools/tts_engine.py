"""
TTS Engine for Telegram Bridge (Antigravity & MOSSAD)
Generates high quality spoken voice using Windows offline voice (Microsoft Irina Desktop)
and encodes it to Telegram-native Opus OGG format for instant voice messages.
"""

import os
import time
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def generate_voice_ogg(text, output_ogg=None):
    if not output_ogg:
        output_ogg = os.path.join(BASE_DIR, f"voice_{int(time.time()*1000)}.ogg")
    temp_wav = os.path.splitext(output_ogg)[0] + "_temp.wav"

    clean_text = (
        text.replace('"', ' ')
        .replace("'", " ")
        .replace("<", " ")
        .replace(">", " ")
        .replace("*", " ")
        .replace("`", " ")
        .replace("#", " ")
        [:1200]
    )
    wav_escaped = temp_wav.replace("\\", "\\\\")

    ps_cmd = f"""
    Add-Type -AssemblyName System.Speech
    $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {{ $s.SelectVoice('Microsoft Irina Desktop') }} catch {{}}
    $s.SetOutputToWaveFile('{wav_escaped}')
    $s.Speak("{clean_text}")
    $s.Dispose()
    """

    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], check=True, capture_output=True, timeout=15)
        if os.path.exists(temp_wav) and os.path.getsize(temp_wav) > 500:
            # Convert WAV to Telegram Opus OGG
            cmd = ["ffmpeg", "-y", "-i", temp_wav, "-c:a", "libopus", "-b:a", "32k", output_ogg]
            subprocess.run(cmd, check=True, capture_output=True, timeout=10)
            try: os.remove(temp_wav)
            except: pass
            if os.path.exists(output_ogg) and os.path.getsize(output_ogg) > 200:
                return output_ogg
    except Exception as e:
        print(f"[TTS Error] {e}")
        if os.path.exists(temp_wav):
            try: os.remove(temp_wav)
            except: pass

    return None

if __name__ == "__main__":
    ogg = generate_voice_ogg("Привет! Тестирование голосового синтеза.")
    print("Generated OGG:", ogg, "Size:", os.path.getsize(ogg) if ogg else 0)
    if ogg:
        os.remove(ogg)
