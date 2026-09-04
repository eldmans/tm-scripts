# START_HERE — Входная точка для любого разработчика и ИИ-агента

> 🚀 **АРХИТЕКТУРА MOSSAD ПЕРЕВЕДЕНА НА МОДУЛИ (`src/`)!**  
> **ГЛАВНОЕ ПРАВИЛО:**  
> **НЕ редактируй `mossad.user.js` вручную!** Этот файл генерируется автоматически сборщиком.  
> Исходники лежат в папке `src/`.  
> После правок всегда запускай: `python build.py`

---

## 🗺️ Карта проекта (что где лежит)

1. [ANTI_PATTERNS.md](file:///c:/Users/user/Documents/tm-scripts/grok/ANTI_PATTERNS.md) — **Кладбище неудачных гипотез и грабли**. Перед любой задачей проверь, не наступали ли уже на эти грабли!
2. [PROJECT_VISION.md](file:///c:/Users/user/Documents/tm-scripts/grok/PROJECT_VISION.md) — Общее видение: Класс A (только скачивание) и Класс Б (слайдшоу + лента + скачивание).
3. [MODPLAN.md](file:///c:/Users/user/Documents/tm-scripts/grok/MODPLAN.md) — Архитектурный план модулей, статус готовности каждого модуля и сайтов.
4. [TODO.md](file:///c:/Users/user/Documents/tm-scripts/grok/TODO.md) — Бэклог задач (с приоритетами).
5. [GEMINI.md](file:///c:/Users/user/Documents/tm-scripts/grok/GEMINI.md) — Жёсткие правила версионирования, Git workflow и сохранения UI.
6. [CHANGELOG.md](file:///c:/Users/user/Documents/tm-scripts/grok/CHANGELOG.md) — Человеческий журнал изменений версий (что, зачем и когда менялось).
7. [SCRATCHPAD.md](file:///c:/Users/user/Documents/tm-scripts/grok/SCRATCHPAD.md) — Быстрые рабочие заметки текущей сессии.
8. `src/` — Исходный код, разбитый на изолированные модули:
   - `src/core/` — конфиг, настройки, горячие клавиши, утилиты.
   - `src/engines/` — логика конкретных сайтов (`grok.js`, `pinterest.js`, `instagram.js`, `redgifs.js`, `generic.js`).
   - `src/download/` — подсистема перехвата медиа и скачивания.
   - `src/slideshow/` — движок таймеров и виджет управления.
   - `src/ui/` — панель настроек (HTML, стили, привязки).

---

## 🎯 Иерархия приоритетов в работе

### 🥇 Приоритет 1: Прямой запрос пользователя в чате
Если пользователь попросил конкретную фичу или фикс — делай её в соответствующем файле в `src/engines/...` или `src/core/...`.

### 🥈 Приоритет 2: Срочные задачи из [TODO.md](file:///c:/Users/user/Documents/tm-scripts/grok/TODO.md)
Пункты с меткой `[Срочно]` (Приоритет 2).

### 🥉 Приоритет 3: Модуляризация и расширение по [MODPLAN.md](file:///c:/Users/user/Documents/tm-scripts/grok/MODPLAN.md)
Если задач нет — берём следующий незавершённый модуль из плана.

---

## ⚡ Обязательный рабочий процесс при ЛЮБОЙ правке:

1. Вносим правку в нужный файл в `src/`.
2. Запускаем сборщик:
   ```bash
   python build.py
   ```
   *(Сборщик автоматически проверит UTF-8/emoji и обновит `mossad.user.js`)*
3. При необходимости повышения версии:
   ```bash
   python build.py --bump
   ```
4. Фиксируем в Git:
   ```bash
   git add .
   git commit -m "..."
   git push origin grok
   ```
5. В ответе пользователю **всегда явно пишем текущую версию**.
