# CHECKPOINT — Grok Hotkeys + Slideshow 2.0

> ⚠️ **ПРАВИЛО №1 ДЛЯ ЛЮБОГО АГЕНТА/ЧЕЛОВЕКА, КТО ПРОДОЛЖАЕТ РАБОТУ:**
> **Логируй ВСЕ свои действия в раздел `## Activity Log` внизу этого файла.**
> Формат: `ГГГГ-ММ-ДД ЧЧ:ММ | Агент/Человек | Действие`
> Без логов — никаких изменений. Это обязательно.

---

## Репозиторий

- **GitHub:** https://github.com/eldmans/tm-scripts/tree/grok
- **Ветка:** `grok`
- **Скрипт:** `grok-hotkeys-slideshow.user.js`
- **Установка через Tampermonkey:** https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys-slideshow.user.js
- **Папка проекта (локально):** `c:\Users\user\Documents\tm-scripts\grok\`
- **ТЗ и план разработки:** `c:\Users\user\Documents\tm-scripts\grok2\`

---

## Контекст окружения (Git)

- Remote URL содержит PAT-токен — в конфиге `git remote -v` в папке `grok`
- `git config user.name` => `Assistant Bot`
- Push делается командой: `git push origin grok` из папки `c:\Users\user\Documents\tm-scripts\grok\`

---

## Файлы ТЗ

| Файл | Содержимое |
|------|-----------|
| `SPECIFICATION.md` | Полное описание UI, хоткеев, 3 режимов D-pad, алгоритмов hold post, A-режим через /imagine/saved, защита blur() |
| `DEVELOPMENT_PLAN.md` | 5 этапов разработки |
| `CHECKPOINT.md` | **Этот файл** — статус прогресса и лог |

---

## Статус этапов

| Этап | Статус | Описание |
|------|--------|----------|
| **Этап 1** | ЗАВЕРШЁН | UI-каркас виджета, модалка F1, система хранения настроек |
| **Этап 2** | ЗАВЕРШЁН | SEL-блок, blurActiveInput, хоткей-менеджер, PageDown, Tab/Brsr listeners |
| **Этап 3** | ЗАВЕРШЁН | Движок слайдшоу: Manual timer, AUTO RAF-loop, защита видеопотока, executeResetToStart, режимы —/R/A |
| **Этап 4** | НЕ НАЧАТ | Межпостовая навигация (режимы R и A через /imagine/saved) |
| **Этап 5** | НЕ НАЧАТ | Скачивание и удаление с хитростью hold post |

---

## Что реализовано в Этапе 1

Файл: `grok-hotkeys-slideshow.user.js`

### Виджет (#grok-ss-widget)
- Шапка: NumPad индикатор (?, ВКЛ, ВЫКЛ цветами), заголовок «SlideShow», крестик x
- Клик по шапке => toggle panel (ss-hidden) + Ctrl+Insert
- Режимы Manual / AUTO (кнопки с активной подсветкой)
- Кнопка ↺ (stub — будет executeResetToStart в Этапе 3)
- Секция Manual: − / число / +, пресеты [7] [12] [17]
- Секция AUTO: отсчёт −00с+, круги divisor Nx multiplier, табло секундомера
- D-pad: up down left right, центр цикл —/R/A с тремя стилями (серый/синий/зелёный)
- Выпадающий список: выкл/фото/видео/всё (session-only, не сохраняется при перезагрузке)
- Чекбоксы del, Tab, Brsr
- RadioGroup PageDown: — / +1 / del
- Чекбоксы a.confirm, hold post

### Модальное окно F1
- Таблица 11 хоткеев с интерактивной записью (клик => мигает => нажать клавишу)
- Сброс отдельного хоткея и всех сразу
- Закрытие по Esc, клику на backdrop, кнопке x

### Система хранения
- GM_setValue / GM_getValue через объект Settings (get/set/setNested/save)
- downloadMode = 'none' всегда при старте сессии (не персистентно)
- Все остальные настройки персистентны

### CSS / Design
- Glassmorphic стиль: backdrop-filter blur(24px), тёмный полупрозрачный фон
- Inter font, цветовая система (green/blue/red/amber)
- Плавные transitions, hover-эффекты, анимация модалки

---

## Что нужно сделать в Этапе 2

1. **Расширить глобальный keydown-обработчик** — привязать все хоткеи из Settings.get().hk:
   - download => findGrokDownloadButton() + скачать
   - upscale => найти кнопку Upscale и кликнуть
   - deletePub => с учётом hold post (stub к Этапу 5)
   - toggleMute => video.muted = !video.muted
   - playPause => video.paused ? video.play() : video.pause()
   - goSaved => location.href = 'https://grok.com/imagine/saved'
   - startStop => toggleSlideshow() (stub к Этапу 3)
   - focusPanel => document.getElementById('grok-ss-widget').focus()

2. **blurActiveInput()** — функция, которая:
   - Проверяет document.activeElement
   - Если это INPUT, TEXTAREA или contenteditable => вызывает .blur()
   - Вызывается ПЕРЕД каждым хоткей-экшеном и при навигации

3. **Перехват PageDown** в зависимости от pgDownMode:
   - off => ничего
   - next => следующий слайд + скачать
   - del => удалить публикацию

---

## Важные архитектурные решения

- Все функции навигации (следующий слайд, предыдущий, переход к посту) — в Этапе 3 и 4
- Стабы в текущем коде: rewindToStart(), toggleSlideshow(), findGrokDownloadButton()
- matchHotkey(e, combo) — парсит строку вида "Ctrl+Insert", "F1", "PageDown" => сравнивает с e.key, e.ctrlKey и т.д.
- Settings.initSession() вызывается при init() и сбрасывает downloadMode в 'none'

---

## Activity Log

| Дата/Время | Кто | Действие |
|-----------|-----|---------|
| 2026-08-01 07:05 | Claude Sonnet 4.6 (Antigravity) | Прочитаны SPECIFICATION.md и DEVELOPMENT_PLAN.md из grok2/ |
| 2026-08-01 07:07 | Claude Sonnet 4.6 (Antigravity) | Создан grok-hotkeys-slideshow.user.js — Этап 1 полностью |
| 2026-08-01 07:11 | Claude Sonnet 4.6 (Antigravity) | Добавлены @updateURL/@downloadURL для Tampermonkey, создан CHECKPOINT.md |
| 2026-08-01 07:12 | Claude Sonnet 4.6 (Antigravity) | git add + commit + push на ветку grok |
| 2026-08-01 15:22 | Claude Sonnet 4.6 (Antigravity) | Изучены исходники grok-powertools/content.js и grok-auto-retry через subagent (flash) |
| 2026-08-01 15:29 | Claude Sonnet 4.6 (Antigravity) | Этап 2: SEL-блок, blurActiveInput(), все хоткеи, PageDown intercept, Tab/Brsr listeners — v2.0.1-stage2 запушен |
| 2026-08-02 14:08 | Claude Sonnet 4.6 (Antigravity) | Этап 3: полный движок слайдшоу (Manual, AUTO+видео, RAF, executeResetToStart, —/R/A) — v2.0.2-stage3 запушен |
