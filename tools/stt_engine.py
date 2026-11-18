"""
STT Engine for Telegram Bridge (Antigravity & MOSSAD)
Provides dual-engine speech recognition:
1. Primary: Google Speech Recognition API (fast, high accuracy, Russian language)
2. Fallback: Local faster-whisper (large-v3-turbo / small) for offline resilience
"""

import os
import sys
import time
import subprocess
import pydub
import speech_recognition as sr

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

_WHISPER_MODEL = None

def get_whisper_model(model_name="large-v3-turbo"):
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        try:
            from faster_whisper import WhisperModel
            # Load with int8 on CPU using available threads
            _WHISPER_MODEL = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=8)
        except Exception as e:
            print(f"[STT Error] Failed to load faster-whisper model '{model_name}': {e}")
            try:
                from faster_whisper import WhisperModel
                _WHISPER_MODEL = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=8)
            except Exception as e2:
                print(f"[STT Error] Failed to load fallback whisper small: {e2}")
    return _WHISPER_MODEL

def convert_to_wav(audio_input_path, output_wav_path=None):
    if not output_wav_path:
        output_wav_path = os.path.splitext(audio_input_path)[0] + "_converted.wav"
    try:
        sound = pydub.AudioSegment.from_file(audio_input_path)
        sound.export(output_wav_path, format="wav")
        return output_wav_path
    except Exception as e:
        print(f"[STT Convert Error] {e}")
        # Try direct ffmpeg command
        try:
            cmd = ["ffmpeg", "-y", "-i", audio_input_path, "-ar", "16000", "-ac", "1", output_wav_path]
            subprocess.run(cmd, check=True, capture_output=True)
            if os.path.exists(output_wav_path):
                return output_wav_path
        except Exception as fe:
            print(f"[STT FFmpeg Convert Error] {fe}")
    return None

def transcribe_audio(audio_path, prefer_local=False, model_name="large-v3-turbo"):
    """
    Transcribes any audio file (ogg, oga, mp3, wav, etc.) to text.
    Returns (text, engine_used)
    """
    if not os.path.exists(audio_path):
        return "", "file_not_found"

    wav_path = convert_to_wav(audio_path)
    if not wav_path or not os.path.exists(wav_path):
        return "", "conversion_failed"

    # Strategy 1: Google Speech API (unless prefer_local is True)
    if not prefer_local:
        try:
            r = sr.Recognizer()
            with sr.AudioFile(wav_path) as source:
                audio_data = r.record(source)
            text = r.recognize_google(audio_data, language="ru-RU")
            if text and len(text.strip()) > 0:
                try: os.remove(wav_path)
                except: pass
                return text.strip(), "google"
        except Exception as ge:
            print(f"[STT] Google Speech API missed/failed ({ge}), trying Whisper...")

    # Strategy 2: Local faster-whisper
    try:
        model = get_whisper_model(model_name)
        if model:
            segments, info = model.transcribe(wav_path, language="ru", beam_size=1)
            text = " ".join([s.text for s in segments]).strip()
            try: os.remove(wav_path)
            except: pass
            if text:
                return text, f"whisper_{model_name}"
    except Exception as we:
        print(f"[STT Whisper Error] {we}")

    if os.path.exists(wav_path):
        try: os.remove(wav_path)
        except: pass

    return "", "failed"

if __name__ == "__main__":
    test_file = os.path.join(os.path.dirname(BASE_DIR), "test.mp3")
    print(f"Testing STT with {test_file}...")
    t0 = time.time()
    res_text, engine = transcribe_audio(test_file)
    print(f"Result [{engine} in {round(time.time() - t0, 2)}s]: {res_text}")
