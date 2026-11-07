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
