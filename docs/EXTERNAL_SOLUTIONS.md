# EXTERNAL_SOLUTIONS.md — Реестр внешних наработок и готовых решений

Этот файл служит оперативной базой знаний по сторонним скриптам, расширениям и API-паттернам для сайтов, с которыми работает MOSSAD.
**Правило:** Не перечитывать весь файл целиком при старте. Обращаться к нему точечно при поступлении задачи по соответствующему сайту.

---

## 1. Grok (`grok.com`)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **Grok Quota Display Pro** | GreasyFork 578827 (BExhei) | Декодирование Protobuf/gRPC-Web `/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` и `/prod_mc_billing.ConsumerUiSvc/GetGrokUsageInfo`, расчет остатка квоты и сброса, тарифы SuperGrok/Premium/Free | Интегрировано в `src/engines/grok/quota.js` (v1.3.87) |
| **Grok Rate Limit Display** | GreasyFork (Blankspeaker / KHROTU) | Перехват `/rest/rate-limits`, отображение ограничений по моделям в query-bar | Альтернативный эндпоинт, учтён в архитектуре |
| **Grok Enhancer** | GreasyFork / Web Store | Отображение кулдаунов и кастомные таймеры | Изучено |
| **Grok Auto-Regenerate / Batch Helpers** | GreasyFork (Bigel elya, Geordie Greep Remphan) | Паттерн сохранения отправленного промпта перед очисткой формы и ре-инъекция в ProseMirror/Lexical `contenteditable` через `execCommand('insertText')` или React textarea setter для серийной генерации и повторов | Интегрировано в `src/engines/grok/prompt-cycle.js` (v1.4.8) |
| **MOSSAD Native Slide History** | Собственная реализация MOSSAD | Запоминание кадра при просмотре $\ge 5$ сек, навигация `Alt+=` / `Alt+-`, двухшаговое сворачивание промпта без потери фокуса | Реализовано в `src/engines/grok/history-nav.js` (v1.3.89) |

---

## 2. Pinterest (`pinterest.com`)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **Pinterest Media Downloader** | Открытые скрипты GreasyFork | Поиск оригинальных картинок через `originals/` и MP4 в `v.pinimg.com` | Интегрировано в MOSSAD download router |
| **Pinterest Full Scale View** | DOM-кнопка пина | Кнопка «Показать в полном масштабе» | Интегрировано в клавишу `F` (`mossadToggleExpand`, v1.3.88) |

---

## 3. Hugging Face Spaces (`huggingface.co`)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **Gradio Output Interceptor** | HuggingFace JS API | Подхват результатов генерации Gradio через `gradio_api` и blob-ссылки | Интегрировано в `src/engines/huggingface.js` (v1.3.70) |

---

## 4. Видеохостинги и плееры (xVideos, RedGifs и др.)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **HLS / Direct MP4 Parser** | HTML5 Video API | Извлечение прямых mp4 ссылок из плееров и hls.m3u8 потоков | Интегрировано в `src/download/router.js` и `src/engines/xvideos.js` (v1.3.86) |
| **Universal Fullscreen Toggle** | DOM Fullscreen API | Нажатие нативного `video.requestFullscreen()` или кнопок плеера | Интегрировано в клавишу `F` (v1.3.88) |
| **Double Player Size Responsive** | CSS Aspect-Ratio / XVideos Player API | Расширение плеера до 98vw с пропорциональной высотой `min(85vh, 56.25vw)` и `resize` диспетчеризацией | Интегрировано в `src/engines/xvideos.js` (v1.4.35) |
| **Floating Player Popup & Tab Switch** | Window.open / Visibility API / GM Storage | Отдельное плавающее окно плеера с автосохранением X/Y и ширины в ПЗУ/GIT и авто-переводом при смене вкладки | Интегрировано в `src/core/hotkeys.js` (v1.4.35) |

---

## 5. Telegram Web (`web.telegram.org`)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **Telegram Media Downloader (WebA / WebK)** | GreasyFork (Neet-Nestor, classccai, OsoCosmico) | Перехват `window.URL.createObjectURL` для захвата Blob/MediaSource, селекторы лайтбокса (`.media-viewer-moal`, `.MediaViewer`, `.ImageViewer`, `.pswp`), извлечение блоба через `fetch(blobUrl)` и скачивание даже из закрытых/защищенных каналов | Интегрируется в `src/engines/telegram.js` (v1.4.19) |

---

## 6. Захват и улучшение видеокадров (Лёгкий слой / DND)

| Решение / Скрипт | Источник | Что умеет / Ключевые API | Статус в MOSSAD |
| :--- | :--- | :--- | :--- |
| **Canvas Frame Grabber & Unsharp Mask Enhancer** | HTML5 Canvas API / WebGL / Tampermonkey | Обход CORS через `GM_xmlhttpRequest(..., responseType: 'blob')` для устранения Tainted Canvas на кросс-доменных CDN (Grok, Hugging Face). Суперсэмплинг низких разрешений (Wan 480p -> 720p), маска нерезкости 3x3 для компенсации артефактов видеосжатия H.264/H.265, копирование в `ClipboardItem({'image/png': blob})` | Интегрировано в `src/light/dnd.js` (v1.4.21) |


