#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prompt_metascan.py — Универсальный сканер метаданных для медиафайлов Grok и I2ANY.
Поддерживает MP4, PNG, JPG, JPEG, WEBP.
"""

import os
import sys
import time
import json
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path

# Попытка импорта Pillow для картинок
try:
    from PIL import Image, ExifTags
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Для Windows-консоли (отслеживание нажатий клавиш без ожидания Enter)
try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False


MEDIA_EXTENSIONS = {'.mp4', '.png', '.jpg', '.jpeg', '.webp', '.mov', '.mkv'}


def get_file_created_date_str(filepath: Path) -> str:
    """Возвращает дату создания файла в формате дд.мм.гг."""
    try:
        stat = filepath.stat()
        ts = getattr(stat, 'st_ctime', stat.st_mtime)
        dt = datetime.fromtimestamp(ts)
        return dt.strftime('%d.%m.%y')
    except Exception:
        return '--.--.--'


def compute_short_hash(text: str) -> str:
    """Короткий 12-значный хэш промпта."""
    if not text:
        return '-'
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()[:12]


def extract_video_duration_and_tags(filepath: Path) -> dict:
    """Извлекает длительность видео и теги через ffprobe (быстро в json)."""
    res = {'duration': '-', 'model': '', 'prompt': '', 'hash': ''}
    try:
        cmd = [
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            str(filepath)
        ]
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, timeout=3)
        if p.returncode == 0 and p.stdout:
            data = json.loads(p.stdout)
            fmt = data.get('format', {})
            dur_sec = fmt.get('duration')
            if dur_sec:
                try:
                    d_float = float(dur_sec)
                    mins = int(d_float // 60)
                    secs = int(d_float % 60)
                    res['duration'] = f"{mins:02d}:{secs:02d}" if mins > 0 else f"{d_float:.1f}s"
                except Exception:
                    res['duration'] = str(dur_sec)[:6]

            tags = fmt.get('tags', {})
            # Поиск тегов модели (artist, ©ART)
            for k, v in tags.items():
                kl = k.lower()
                if kl in ('artist', '©art', 'model'):
                    res['model'] = str(v).strip()
                    break

            # Поиск промпта (description, comment, title)
            prompt = tags.get('description') or tags.get('comment') or tags.get('title') or ''
            # Если в комментарии формат "Prompt: ...\nURL: ...\nModel: ...\nHash: ..."
            if 'Prompt:' in prompt:
                lines = prompt.split('\n')
                for line in lines:
                    if line.startswith('Prompt:'):
                        prompt = line.replace('Prompt:', '', 1).strip()
                    elif line.startswith('Model:') and not res['model']:
                        res['model'] = line.replace('Model:', '', 1).strip()
                    elif line.startswith('Hash:'):
                        res['hash'] = line.replace('Hash:', '', 1).strip()

            res['prompt'] = prompt.strip()
    except Exception:
        pass
    return res


def extract_image_metadata(filepath: Path) -> dict:
    """Извлекает метаданные из PNG, JPG, JPEG, WEBP."""
    res = {'duration': '-', 'model': '', 'prompt': '', 'hash': ''}
    if not HAS_PIL:
        return res

    try:
        ext = filepath.suffix.lower()
        with Image.open(filepath) as img:
            info = img.info or {}

            # 1. PNG
            if ext == '.png':
                # Модель
                res['model'] = info.get('source') or info.get('model') or ''
                # Хэш
                res['hash'] = info.get('prompt_hash') or ''
                # Промпт
                prompt = (
                    info.get('prompt') or
                    info.get('Description') or
                    info.get('parameters') or
                    info.get('Comment') or ''
                )
                if 'Prompt:' in prompt:
                    for line in prompt.split('\n'):
                        if line.startswith('Prompt:'):
                            prompt = line.replace('Prompt:', '', 1).strip()
                        elif line.startswith('Model:') and not res['model']:
                            res['model'] = line.replace('Model:', '', 1).strip()
                        elif line.startswith('Hash:') and not res['hash']:
                            res['hash'] = line.replace('Hash:', '', 1).strip()
                res['prompt'] = prompt.strip()

            # 2. JPG / JPEG / WEBP
            elif ext in ('.jpg', '.jpeg', '.webp'):
                exif = img.getexif() if hasattr(img, 'getexif') else None
                if exif:
                    # 0x013b = Artist, 0x0131 = Software
                    res['model'] = exif.get(0x013b) or exif.get(0x0131) or ''
                    # 0x9286 = UserComment
                    user_cmt = exif.get(0x9286)
                    if isinstance(user_cmt, bytes):
                        try:
                            if user_cmt.startswith(b'UNICODE\x00'):
                                user_cmt = user_cmt[8:].decode('utf-16le', errors='ignore')
                            elif user_cmt.startswith(b'ASCII\x00\x00\x00'):
                                user_cmt = user_cmt[8:].decode('ascii', errors='ignore')
                            else:
                                user_cmt = user_cmt.decode('utf-8', errors='ignore')
                        except Exception:
                            user_cmt = ''
                    # 0x010e = ImageDescription
                    img_desc = exif.get(0x010e) or ''

                    prompt = user_cmt or img_desc or ''
                    if 'Prompt:' in prompt:
                        for line in prompt.split('\n'):
                            if line.startswith('Prompt:'):
                                prompt = line.replace('Prompt:', '', 1).strip()
                            elif line.startswith('Model:') and not res['model']:
                                res['model'] = line.replace('Model:', '', 1).strip()
                            elif line.startswith('Hash:'):
                                res['hash'] = line.replace('Hash:', '', 1).strip()
                    res['prompt'] = prompt.strip()

                # XMP chunk parsing if available in info
                xmp = info.get('XML:com.adobe.xmp') or info.get('xmp') or ''
                if isinstance(xmp, bytes):
                    xmp = xmp.decode('utf-8', errors='ignore')
                if xmp and not res['prompt']:
                    import re
                    m_desc = re.search(r'<dc:description[^>]*>.*?<rdf:li[^>]*>(.*?)</rdf:li>', xmp, re.DOTALL)
                    if m_desc:
                        res['prompt'] = m_desc.group(1).replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').strip()
                    m_creator = re.search(r'<dc:creator[^>]*>.*?<rdf:li[^>]*>(.*?)</rdf:li>', xmp, re.DOTALL)
                    if m_creator and not res['model']:
                        res['model'] = m_creator.group(1).strip()
                    m_id = re.search(r'<dc:identifier[^>]*>(.*?)</dc:identifier>', xmp, re.DOTALL)
                    if m_id and not res['hash']:
                        res['hash'] = m_id.group(1).strip()
    except Exception:
        pass
    return res


def scan_media_file(filepath: Path) -> dict:
    """Сканирует один файл и возвращает словарь с атрибутами."""
    ext = filepath.suffix.lower()
    date_str = get_file_created_date_str(filepath)
    name_with_date = f"{filepath.name}_{date_str}"

    if ext in ('.mp4', '.mov', '.mkv'):
        meta = extract_video_duration_and_tags(filepath)
    else:
        meta = extract_image_metadata(filepath)

    prompt = meta.get('prompt') or ''
    # Очищаем промпт от переносов строк для аккуратности таблицы
    clean_prompt = ' '.join(prompt.split()) if prompt else '-'

    # Если модель не определена в метаданных, пробуем извлечь из суффикса имени файла (напр. ..._QWEN.png)
    model = meta.get('model') or ''
    if not model:
        stem = filepath.stem
        for known in ('QWEN', 'Wan2.2', 'FLUX', 'Grok', 'Imagine'):
            if known.lower() in stem.lower():
                model = known
                break
    if not model:
        model = '-'

    phash = meta.get('hash') or ''
    if not phash or phash == '-':
        phash = compute_short_hash(prompt) if prompt else '-'

    return {
        'name_date': name_with_date,
        'duration': meta.get('duration') or '-',
        'model': model,
        'hash': phash,
        'prompt': clean_prompt
    }


def print_table(rows: list, folder_title: str = None):
    """Выводит красиво отформатированную таблицу в консоли."""
    if folder_title:
        print("\n" + "=" * 95)
        print(f"ПАПКА: {folder_title}")
        print("=" * 95)

    if not rows:
        print("  [В этой папке медиафайлы не найдены]")
        return

    # Заголовки таблицы
    col1 = "ИМЯфайла_дата дд.мм.гг создания"
    col2 = "Длит."
    col3 = "Модель"
    col4 = "Хэш"
    col5 = "Промпт"

    # Расчет ширины колонок
    w1 = max(len(col1), max(len(r['name_date']) for r in rows))
    w1 = min(w1, 46)
    w2 = 7
    w3 = 10
    w4 = 14

    header = f"{col1:<{w1}} | {col2:<{w2}} | {col3:<{w3}} | {col4:<{w4}} | {col5}"
    sep = f"{'-'*w1}-+-{'-'*w2}-+-{'-'*w3}-+-{'-'*w4}-+-{'-'*40}"
    print(header)
    print(sep)

    for r in rows:
        n = r['name_date']
        if len(n) > w1:
            n = n[:w1-3] + '...'
        dur = r['duration']
        mod = r['model'][:w3]
        hsh = r['hash'][:w4]
        prm = r['prompt']
        # Ограничиваем слишком длинный промпт для одной строки
        if len(prm) > 75:
            prm = prm[:72] + '...'
        print(f"{n:<{w1}} | {dur:<{w2}} | {mod:<{w3}} | {hsh:<{w4}} | {prm}")


def scan_directory(dir_path: Path) -> list:
    """Сканирует только файлы в заданной папке (без вложенных)."""
    rows = []
    try:
        entries = sorted(dir_path.iterdir(), key=lambda p: p.name.lower())
        for item in entries:
            if item.is_file() and item.suffix.lower() in MEDIA_EXTENSIONS:
                rows.append(scan_media_file(item))
    except Exception as e:
        print(f"  Ошибка чтения папки {dir_path}: {e}")
    return rows


def get_key_press():
    """Считывает нажатие одной клавиши в Windows без буферизации."""
    if HAS_MSVCRT:
        ch = msvcrt.getch()
        if ch == b'\x00' or ch == b'\xe0':
            msvcrt.getch() # спец-клавиша
            return ''
        if ch == b'\x1b':
            return 'ESC'
        if ch in (b'\r', b'\n'):
            return 'ENTER'
        try:
            return ch.decode('utf-8', errors='ignore')
        except Exception:
            return ''
    else:
        line = sys.stdin.readline()
        if not line:
            return 'ESC'
        line = line.strip()
        if not line:
            return 'ENTER'
        return line[0]


def run_interactive(start_dir: Path):
    """Главный интерактивный цикл управления."""
    current_dir = start_dir

    while True:
        os.system('cls' if os.name == 'nt' else 'clear')
        print("=" * 95)
        print(" PROMPT METASCAN — Универсальный сканер медиа и промптов (Grok & I2ANY)")
        print("=" * 95)

        rows = scan_directory(current_dir)
        print_table(rows, str(current_dir))

        print("\n" + "-" * 95)
        print("  [1]           — Показать каждую подпапку по очереди с паузой (Any key)")
        print("  [Enter]       — Показать ВСЕ подпапки блоками в одном непрерывном списке")
        print("  [R / r / К / к] — Обновить текущую папку")
        print("  [ESC]         — Выход из программы")
        print("-" * 95)
        print("Ожидание команды: ", end='', flush=True)

        key = get_key_press()
        if key == 'ESC':
            print("\nВыход.")
            sys.exit(0)

        elif key == '1':
            # Режим 1: обход каждой подпапки по очереди с паузой
            subdirs = [p for p in current_dir.rglob('*') if p.is_dir()]
            if not subdirs:
                print("\nВложенных папок не обнаружено. Нажмите любую клавишу для возврата...")
                get_key_press()
                continue

            for sdir in subdirs:
                sub_rows = scan_directory(sdir)
                if sub_rows: # показываем только непустые папки
                    print_table(sub_rows, str(sdir))
                    print(f"\n[Нажмите Any key для следующей папки / ESC для выхода]...", end='', flush=True)
                    k = get_key_press()
                    if k == 'ESC':
                        print("\nВыход.")
                        sys.exit(0)
            print("\nВсе подпапки просмотрены. Нажмите любую клавишу для возврата в меню...")
            get_key_press()

        elif key in ('R', 'r', 'К', 'к'):
            # Перезапуск текущей папки
            continue

        elif key == 'ENTER':
            # Режим Enter: показать все подпапки блоками без пауз
            print("\n\nСквозное сканирование всех подпапок...")
            subdirs = [p for p in current_dir.rglob('*') if p.is_dir()]
            for sdir in subdirs:
                sub_rows = scan_directory(sdir)
                if sub_rows:
                    print_table(sub_rows, str(sdir))
            print("\n" + "=" * 95)
            print("Сканирование завершено. Нажмите любую клавишу для возврата в меню...")
            get_key_press()


def main():
    target = Path.cwd()
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.exists() and p.is_dir():
            target = p.resolve()

    run_interactive(target)


if __name__ == '__main__':
    main()
