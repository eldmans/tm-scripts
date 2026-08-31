# MOSSAD Modularization & Development Plan
> Версия плана: 1.0 | Дата: 2026-08-31 | Текущая версия скрипта: 1.2.40

---

## Как работать с этим планом

1. Прочитай `PROJECT_VISION.md` для понимания целей
2. Найди первый незавершённый блок (`[ ]`)
3. Перед началом — прочитай только нужные строки файла (указаны в каждом блоке)
4. По завершении блока: поставь `[x]`, запиши версию и дату, сделай git commit
5. **Не читай весь файл целиком** — каждый блок самодостаточен

### Условные обозначения
- `[ ]` — не начато
- `[/]` — в процессе (укажи кем и когда)
- `[x]` — завершено (укажи версию и дату)
- `[!]` — заблокировано / требует обсуждения

---

## КРИТИЧЕСКИЙ ТЕХНИЧЕСКИЙ ДОЛГ

### [x] BLOCK-000: Восстановить кодировку файла (emoji сломаны)
**Проблема:** Python-скрипт в v1.2.38 сохранил файл неверной кодировкой — emoji превратились в красные квадраты.  
**Решение:** Восстановлен из git v1.2.37 как бинарный файл, версия бампнута до 1.2.40.  
**Статус:** ✅ Завершено в v1.2.40 | 2026-08-31

> ⚠️ **ПРАВИЛО ДЛЯ ВСЕХ ПОСЛЕДУЮЩИХ ПРАВОК:**  
> Всегда редактировать файл в бинарном режиме (`rb`/`wb`) или через `replace_file_content` инструмент.  
> Никогда не использовать `Set-Content` PowerShell или Python `open(..., 'w', encoding='utf-8')` на этом файле.  
> Перед коммитом проверять: `python -c "raw=open('mossad.user.js','rb').read(); print('OK' if b'\xe2\x9d\x8c' in raw else 'BROKEN')"`

---

## БЛОК 1: РЕФАКТОРИНГ — МОДУЛЬНОСТЬ

### [ ] BLOCK-101: Вынести Instagram engine в отдельный логический блок
**Читать строки:** `grep -n "INSTAGRAM ENGINE"` → примерно L964–L1042
**Задача:**
- Обернуть весь Instagram-код в объект `window.MOSSAD_ENGINES.instagram = { ... }`
- Методы: `isSupported()`, `findMedia()`, `onNavigate()`, `init()`
- Instagram сейчас помечен как WIP (навигация ломается при листании)

**Известные баги Instagram (решить в этом блоке):**
1. При листании постов (pushState) `_igVideoUrls` не очищается → качает старое видео
   - Фикс: добавить перехват `history.pushState`/`replaceState`, на смену URL делать `_igVideoUrls.length = 0`
   - Это было в v1.2.39 но сломало кодировку → нужно переписать бинарно-безопасно
2. `_igScrapePageJson` иногда находит не-видео URL → фильтровать через `_igIsVideoUrl()`

**Проверка:** Открыть пост на instagram.com, запустить видео, нажать DL. Перейти на следующий пост, снова DL. Должны скачаться разные файлы.

---

### [ ] BLOCK-102: Вынести Pinterest engine
**Читать строки:** `grep -n "pinterest\|Pinterest\|getPinterest"` — около L700–L960
**Задача:** Аналогично Block-101, обернуть в `window.MOSSAD_ENGINES.pinterest`

---

### [ ] BLOCK-103: Вынести RedGifs engine
**Читать строки:** `grep -n "redgifs\|RedGifs\|getRedGifs"` — около L820–L955
**Задача:** Аналогично, обернуть в `window.MOSSAD_ENGINES.redgifs`

---

### [ ] BLOCK-104: Вынести Settings в отдельный модуль
**Читать строки:** L64–L160 (DEFAULT_CONFIG, Settings object)
**Задача:** `window.MOSSAD_SETTINGS = { DEFAULT_CONFIG, config, Settings }` — без изменения логики
**Важно:** `Settings.saveQuiet` уже существует — не сломать его

---

### [ ] BLOCK-105: Вынести Download engine
**Читать строки:** `grep -n "triggerDownload\|saveBlobToDisk\|fetchBlobFallback\|_filenameCounter"` → L800–L1150
**Задача:** Обернуть в `window.MOSSAD_DOWNLOAD = { triggerDownload, applyFilenameTemplate, getFilename }`

---

## БЛОК 2: НОВЫЕ САЙТЫ (Класс А — только скачивание)

### [ ] BLOCK-201: xhamster.com — floating download button
**Что читать:** `PROJECT_VISION.md` (Класс А), grep `allowedDomains` (L37, L79)
**Задача:**
1. Добавить `xhamster.com` в `allowedDomains` (L37 и L79)
2. Добавить в `findMediaForDownload()` ветку для xhamster:
   - Искать `<video>` элемент с прямым `src` (не blob) или `<source>`
   - Часто CDN: `*.xhcdn.com/*.mp4`
3. Добавить floating иконку 💾 поверх видео > X% экрана
   - При hover показывать, при клике — `triggerDownload()`
   - Это отдельная функция `injectFloatingDLButton()`

**Порог размера для иконки:** видео > 30% ширины экрана ИЛИ > 300px по меньшей стороне

---

### [ ] BLOCK-202: xv-ru.com — floating download button
**Аналогично BLOCK-201**, CDN предположительно `*.xvideos-cdn.com` или прямые `.mp4` в src

---

### [ ] BLOCK-203: hot.noodlemagazine.com — floating download button
**Примечание:** `noodlemagazine.com` уже в allowedDomains — проверить работает ли DL вообще.  
Добавить `hot.noodlemagazine.com` как отдельный хост если нужно.

---

### [ ] BLOCK-204: tnaflix.com — floating download button
**Аналогично BLOCK-201**

---

### [ ] BLOCK-205: Универсальная функция `injectFloatingDLButton()`
**Задача:** Написать одну функцию которую используют все Класс-А сайты:
```js
// Навешивает иконку на все подходящие видео/фото на странице
function injectFloatingDLButton() {
    const MIN_SIZE = 300; // px
    document.querySelectorAll('video, img').forEach(el => {
        if (el.dataset.mossadDl) return; // уже есть
        const r = el.getBoundingClientRect();
        if (r.width < MIN_SIZE && r.height < MIN_SIZE) return;
        // ... создать div с иконкой, position:absolute, onclick=triggerDownload
    });
}
// Запускать при загрузке и при изменении DOM (MutationObserver)
```

---

## БЛОК 3: СКАЧИВАНИЕ — УЛУЧШЕНИЯ

### [ ] BLOCK-301: Дедупликация по размеру файла
**Задача:** Хранить в localStorage массив `{name, size, date}` скачанных файлов.  
Перед скачиванием — сделать HEAD-запрос на URL чтобы получить `Content-Length`.  
Если такой размер уже есть → спросить пользователя (или silent skip с тостом).

**Примечание:** SHA-хеш от содержимого (идеально) требует скачать весь файл перед записью — слишком тяжело. Size — достаточный компромисс для 1-3 файлов в день.

---

### [ ] BLOCK-302: Шаблон имени — привязка к сайту
**Задача:** В настройках добавить per-domain шаблон вместо глобального.  
`config.filenameTemplateByDomain = { 'instagram.com': '{date}_{n}_{domain[4]}', ... }`  
Если для текущего домена нет шаблона — использовать глобальный.

---

## БЛОК 4: SLIDESHOW — УЛУЧШЕНИЯ

### [ ] BLOCK-401: Умное определение медиа (борьба с превью)
**Читать:** `grep -n "getActiveVideo\|currentSrc\|blob:"` → L1100–L1200 примерно
**Задача:**
- Видео считать настоящим только если `duration > 3` секунд (борьба с hover-превью)
- Пинтерест: паттерн уже реализован — перенести логику в универсальный `isRealVideo(videoEl)`
- Фото-страница: если `<video>` не найден за 800ms → считать страницу фото, не ждать 5 сек

---

### [ ] BLOCK-402: Google Images / Яндекс.Картинки slideshow
**Задача:** Добавить движок для поисковых страниц с фото:
- `images.google.com`, `yandex.ru/images`
- Собирать превью в список ссылок → открывать полноразмерные
- Это Класс Б, режим 2 (grid view slideshow)

---

## ТЕХНИЧЕСКИЕ ЗАМЕТКИ

### Кодировка файла
Файл хранится в **UTF-8 без BOM**. При любом редактировании:
- ✅ `replace_file_content` инструмент (Antigravity) — безопасно
- ✅ Python `open('file','rb'/'wb')` — безопасно  
- ❌ PowerShell `Set-Content` без `-Encoding UTF8NoBOM` — ломает emoji
- ❌ Python `open('file','w', encoding='utf-8')` — ломает если исходник не UTF-8

### Проверка emoji перед коммитом
```bash
python -c "r=open('mossad.user.js','rb').read(); print('OK' if b'\xe2\x9d\x8c' in r else 'EMOJI BROKEN')"
```

### Структура ключевых функций (актуально для v1.2.40)
| Функция | Строка (~) | Назначение |
|---|---|---|
| `DEFAULT_CONFIG` | L64 | Все настройки по умолчанию |
| `Settings.set/save/saveQuiet` | L139 | Сохранение настроек (saveQuiet не ре-рендерит панель) |
| `findMediaForDownload()` | L994 | Главная функция поиска медиа |
| `triggerDownload()` | L1043 | Скачивание с шаблоном и счётчиком |
| `renderPanel()` | L1736 | HTML настроек (пересоздаётся при updateWidgetUI) |
| `_igVideoUrls` | L967 | Кэш Instagram URL (очищать при навигации) |

### Сайты в проекте
| Сайт | allowedDomains | Engine | Slideshow | DL | Статус |
|---|---|---|---|---|---|
| grok.com | ✅ | generic | ✅ | ✅ | Рабочий |
| redgifs.com | ✅ | redgifs | ✅ | ✅ | Рабочий |
| pinterest.com | ✅ | pinterest | ✅ | ✅ | Рабочий |
| instagram.com | ✅ | instagram | ❌ | ⚠️ WIP | Базово работает, навигация сломана |
| noodlemagazine.com | ✅ | generic | ❌ | ? | Не тестировался |
| xhamster.com | ❌ | — | ❌ | ❌ | Нужно добавить |
| xv-ru.com | ❌ | — | ❌ | ❌ | Нужно добавить |
| tnaflix.com | ❌ | — | ❌ | ❌ | Нужно добавить |

---

## ЖУРНАЛ ИЗМЕНЕНИЙ ПЛАНА

| Дата | Автор | Что изменено |
|---|---|---|
| 2026-08-31 | Antigravity | Создан план v1.0 |
