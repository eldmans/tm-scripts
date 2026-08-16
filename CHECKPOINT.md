# MOSSAD — Checkpoint (актуально на 2026-08-16)

## Файл
`mossad.user.js` — единый скрипт для grok.com, pinterest, redgifs, civitai и др.
Текущая версия: **1.2.30**
GitHub branch: `grok` → https://github.com/eldmans/tm-scripts

---

## Архитектура (кратко)

- **Настройки**: `localStorage` под ключом `mossad_{rootDomain}_config`
- **UI виджет**: правый верхний угол, `position:fixed; top:20px; right:20px`
  - TopBar: `[✕] [таймер] [🚀Пуск] [⚙▼] [💾] [↺] [🔄]`
  - Settings panel: d-pad направлений, задержки (фото/видео/пауза), скачивание
- **Слайдшоу**: `slideshowActive` флаг, `scheduleNextSlideCycle()` → `checkVideoLoops()` (RAF) или `runPhotoTimer()`
- **Определение типа**: `getPinMediaType()` — кнопки Grok + video тег + meta + ld+json
- **Скачивание**: `triggerDownload()` → GM_download / blob fallback
- **GitHub sync**: `githubToken` в настройках → pull/push конфига `mossad-config.json`

---

## Grok Imagine Gallery (новая функция, v1.2.25–1.2.30)

### Константы
```js
GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection'  // {email, date, links:[...]}
GALLERY_SS_KEY         = 'mossad_grok_imagine_ss'          // {active, queue:[], circle, total, delay}
```

### На странице /imagine/saved
- `isGrokSavedPage()` → виджет стартует с `top:72px` (не перекрывает навигацию)
- Первой строкой в виджете: `[📋 Собрать N] [🎲 Слайдшоу]`
- **Собрать**: парсит все `<a href="/imagine/post/...">` из DOM, извлекает email через regex `email.{0,6}(email-паттерн)`, сохраняет в localStorage + скачивает `email_дата_N_links.txt`
- **Слайдшоу**: Fisher-Yates shuffle → `location.href` на первый URL → состояние в localStorage

### На странице /imagine/post/...
- `grokGallerySlideshowTick()` запускается при загрузке страницы
- Ставит `window._mossadGalleryActive = true` и `window._mossadGalleryNextFn = fn`
- Запускает стандартный `slideshowActive = true` + `scheduleNextSlideCycle(0)`
- `triggerNextSlide()` перехватывает: если `_mossadGalleryActive` → вызывает `_mossadGalleryNextFn` (переход на следующий URL из очереди) вместо нажатия клавиши-стрелки
- Показывает индикатор: `🎲 Круг N · X/Total [⏹]`
- Конец круга: аккорд до-ми-соль + новый shuffle

---

## TODO (не сделано, в приоритете)

### 1. 🔀 Кнопка-шаффл в Settings Panel (ГЛАВНОЕ)
- Рядом с d-padом добавить кнопку 🔀, чуть крупнее отдельных стрелок
- **Взаимоисключающая** с направлениями дэпада (▲◀▼▶)
- При активации 🔀: `config.slideshowMode = 'gallery'`
- При активации любой стрелки: `config.slideshowMode = 'dpad'` (возврат к обычному)
- Если `slideshowMode === 'gallery'` → при старте слайдшоу читает список из `GALLERY_COLLECTION_KEY` и листает по нему
- Если `'dpad'` → стандартное листание клавишей по d-pad направлению

### 2. Логика определения фото/видео (переработать)
**Проблема**: `scheduleNextSlideCycle` вызывается до загрузки DOM кнопок → `getPinMediaType()` возвращает `'unknown'` → 6 секунд ожидания HLS

**Правильная логика**:
```
При unknown → сразу запустить фото-таймер (slideshowDelay)
Параллельно каждые 200мс проверять признаки видео
Нашли видео до истечения таймера → отменить таймер, запустить видео-логику
Таймер истёк без видео → перешли дальше (правильно для фото)
```

### 3. Email → ключ localStorage по аккаунту
Сейчас `GALLERY_COLLECTION_KEY` один для всех.
Нужно: `mossad_grok_gallery_{email}` — отдельный ключ на каждый аккаунт.
Список аккаунтов в `mossad_grok_gallery_accounts = [email1, email2]`.

---

## Как запустить новый чат с Flash экономно

Скопируй агенту этот файл (`CHECKPOINT.md`) + конкретный вопрос.
Пример: «Читай CHECKPOINT.md. Реализуй TODO пункт 1 (кнопка 🔀)».
Flash прочитает только этот файл и задачу — без длинной истории диалога.
