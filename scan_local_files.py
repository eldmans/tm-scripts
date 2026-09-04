# -*- coding: utf-8 -*-
"""
scan_local_files.py — Сканирование локальных генераций и сбор базы хешей (SHA-256).

Использование:
    python scan_local_files.py "D:\Путь\К\Папке\С\Генерациями"
или просто запустите скрипт — он сам спросит путь.
"""

import os
import sys
import hashlib
import json
import datetime

MEDIA_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".jpg", ".jpeg", ".png", ".webp", ".gif"}

def calculate_sha256(filepath):
    """Вычисляет SHA-256 блоками по 64 КБ (не забивает ОЗУ)."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def scan_directory(target_dir):
    if not os.path.exists(target_dir):
        print(f"❌ Ошибка: папка '{target_dir}' не найдена.")
        return []

    results = []
    print(f"🔍 Сканирование папки: {target_dir}")
    count = 0

    for root, _, files in os.walk(target_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in MEDIA_EXTS:
                count += 1
                full_path = os.path.join(root, file)
                try:
                    stat = os.stat(full_path)
                    file_size = stat.st_size
                    # Дата изменения файла (локальное системное время)
                    mod_time = datetime.datetime.fromtimestamp(stat.st_mtime)
                    date_str = mod_time.strftime("%Y-%m-%d %H:%M:%S")

                    sha256 = calculate_sha256(full_path)

                    results.append({
                        "hash": sha256,
                        "filename": file,
                        "path": full_path,
                        "size": file_size,
                        "date": date_str,
                        "source": "local_scan"
                    })

                    if count % 20 == 0:
                        print(f"   Обработано файлов: {count}...", end="\r")

                except Exception as e:
                    print(f"\n⚠️ Не удалось прочитать '{file}': {e}")

    print(f"\n✅ Сканирование завершено! Всего найдено и обработано: {len(results)} медиафайлов.")
    return results

def main():
    if len(sys.argv) > 1:
        target_dir = sys.argv[1].strip("\"'")
    else:
        print("=" * 60)
        print("  MOSSAD — Сканер существующих файлов генераций (SHA-256)")
        print("=" * 60)
        target_dir = input("Введите путь к папке с файлами (или нажмите Enter для текущей): ").strip("\"'")
        if not target_dir:
            target_dir = os.getcwd()

    items = scan_directory(target_dir)
    if not items:
        print("Файлы не найдены.")
        return

    output_filename = "mossad_history_import.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"\n📁 Результат сохранён в файл: {os.path.abspath(output_filename)}")
    print("👉 Вы сможете подгрузить этот файл прямо в скрипт MOSSAD кнопкой «Импорт базы» в панели настроек!")

if __name__ == "__main__":
    main()
