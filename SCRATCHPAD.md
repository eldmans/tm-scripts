### База граблей и ограничений (Failed Approaches & Constraints)
* **Instagram:**
  * ❌ Попытка искать mp4 напрямую через `document.querySelector('video').src` — отдаёт `blob:`, не качается.
  * ❌ Попытка перехватывать URL без сброса массива `_igVideoUrls` — при смене поста качает старое видео.
  * ❌ Сохранение файла через PowerShell `Set-Content` — ломает UTF-8 emoji в скрипте.
* **Grok / Pinterest:**
  * ❌ Задержка плеера 5 сек — на фото-страницах создает зависание, нужно детекция за 800мс.