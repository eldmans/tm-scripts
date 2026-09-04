# -*- coding: utf-8 -*-
"""
================================================================================
 MOSSAD — Локальный сканер медиафайлов и генераций (SHA-256)
================================================================================
 ИНСТРУКЦИЯ:
 1. Строку SCAN_FOLDER ниже можно открыть и отредактировать в обычном БЛОКНОТЕ.
 2. Запустите этот файл двойным кликом на компьютере или через терминал.
 3. Скрипт просканирует папку, посчитает SHA-256 хеши с разделением на Видео и
    Фото, сохранит результат в mossad_history.json и (если в репозитории) 
    автоматически выгрузит на GitHub!
================================================================================
"""

# ВПИШИТЕ ПУТЬ К ВАШЕЙ ПАПКЕ С ГЕНЕРАЦИЯМИ НИЖЕ (в кавычках, с буквой r впереди):
SCAN_FOLDER = r"C:\Users\user\Downloads"

import os
import sys
import hashlib
import json
import datetime
import subprocess

VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"}
PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".jfif"}
ALL_MEDIA_EXTS = VIDEO_EXTS | PHOTO_EXTS

def calculate_sha256(filepath):
    """Вычисляет SHA-256 блоками по 64 КБ (не нагружает ОЗУ)."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_directory(target_dir):
    if not os.path.exists(target_dir):
        print(f"❌ Ошибка: папка не найдена: {target_dir}")
        return []

    print(f"\n🔍 Поиск медиафайлов в: {target_dir}")
    file_list = []
    for root, _, files in os.walk(target_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ALL_MEDIA_EXTS:
                file_list.append((os.path.join(root, f), f, ext))

    total = len(file_list)
    print(f"📦 Найдено медиафайлов: {total}")
    if total == 0:
        return []

    results = []
    v_count = 0
    p_count = 0

    print("⚡ Быстрый расчет хешей SHA-256...")
    for idx, (full_path, fname, ext) in enumerate(file_list, 1):
        try:
            stat = os.stat(full_path)
            mod_time = datetime.datetime.fromtimestamp(stat.st_mtime)
            date_str = mod_time.strftime("%Y-%m-%d %H:%M:%S")
            is_video = ext in VIDEO_EXTS
            media_type = "video" if is_video else "photo"

            if is_video:
                v_count += 1
            else:
                p_count += 1

            sha256 = calculate_sha256(full_path)

            results.append({
                "id": sha256,
                "hash": sha256,
                "filename": fname,
                "type": media_type,
                "path": full_path,
                "size": stat.st_size,
                "date": date_str,
                "domain": "local_scan"
            })

            if idx % 25 == 0 or idx == total:
                pct = (idx / total) * 100
                print(f"   [{idx}/{total}] ({pct:.1f}%) | 🎬 Видео: {v_count} | 🖼 Фото: {p_count}", end="\r")

        except Exception as e:
            print(f"\n⚠️ Не удалось прочитать '{fname}': {e}")

    print(f"\n✅ Завершено! Обработано {len(results)} файлов (🎬 Видео: {v_count}, 🖼 Фото: {p_count}).")
    return results

def try_git_push(output_file):
    """Если файл находится в Git-репозитории, коммитим и пушим на GitHub."""
    try:
        git_check = subprocess.run(["git", "status"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if git_check.returncode == 0:
            print("\n🚀 Обнаружен Git-репозиторий. Выполняю выгрузку на GitHub...")
            subprocess.run(["git", "add", output_file], check=True)
            commit_msg = f"data(history): sync local media database ({datetime.date.today()})"
            subprocess.run(["git", "commit", "-m", commit_msg], check=True)
            subprocess.run(["git", "push", "origin", "grok"], check=True)
            print("🎉 Успешно выгружено на GitHub в ветку 'grok'!")
    except Exception as e:
        print(f"ℹ️ Авто-пуш в Git пропущен: {e}")

def main():
    print("=" * 65)
    print("  MOSSAD — Быстрый сканер дубликатов и генераций (SHA-256)")
    print("=" * 65)

    target_dir = SCAN_FOLDER.strip("\"'")
    if len(sys.argv) > 1:
        target_dir = sys.argv[1].strip("\"'")

    if not os.path.exists(target_dir):
        print(f"\n⚠️ Путь из настройки '{target_dir}' не существует.")
        entered = input("Введите путь к папке с файлами вручную (или Enter для текущей папки): ").strip("\"'")
        target_dir = entered if entered else os.getcwd()

    records = scan_directory(target_dir)
    if not records:
        print("Файлы для обработки не найдены.")
        input("\nНажмите Enter для выхода...")
        return

    # Сохраняем в папку со скриптом
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(script_dir, "mossad_history.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"\n💾 База данных успешно сохранена в файл:\n   {out_path}")
    print("👉 Вы можете импортировать её в 1 клик через кнопку «📥 База» на панели MOSSAD в браузере!")

    # Пробуем автоматически отправить на GitHub
    try_git_push(out_path)

    print("\n" + "=" * 65)
    print("  Готово! Окно можно закрывать.")
    print("=" * 65)
    # Задержка перед закрытием консоли при запуске дабл-кликом
    if sys.stdin.isatty():
        input("Нажмите Enter для выхода...")

if __name__ == "__main__":
    main()
