    // ============================================
    // REDGIFS ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.redgifs = (() => {
        const REDGIFS_COLLECTION_KEY = 'mossad_redgifs_collection';
        const REDGIFS_SS_KEY = 'mossad_redgifs_ss';

        function isSupported() {
            return rootDomain.includes('redgifs.com');
        }

        /** Находит активный элемент превью/карточки в DOM */
        function getActiveItem() {
            // 1. Попап-плеер / модальное окно просмотра
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .PlayerWrapper, .previewModal');
            if (modal) return modal;

            // 2. Активный элемент ленты или сетки
            const activeEl = document.querySelector('.GifPreview_isActive, .GifPreview.isActive, .preview_isActive, [data-feed-item-id].active');
            if (activeEl) return activeEl;

            // 3. Элемент, содержащий играющее видео
            const videos = Array.from(document.querySelectorAll('video'));
            const playingVideo = videos.find(v => !v.paused && v.currentTime > 0);
            if (playingVideo) {
                const card = playingVideo.closest('[data-feed-item-id], .GifPreview, .feed-item, a[href*="/watch/"]');
                if (card) return card;
            }

            // 4. Первый элемент с ID фида или превью
            return document.querySelector('[data-feed-item-id], .GifPreview');
        }

        /** Находит активное/главное видео RedGifs */
        function getActiveVideo() {
            // Если открыт попап/модалка — ищем видео строго внутри него
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .PlayerWrapper');
            if (modal) {
                const modalVid = modal.querySelector('video');
                if (modalVid) return modalVid;
            }

            const active = getActiveItem();
            if (active) {
                const v = active.querySelector('video');
                if (v) return v;
            }

            const videos = Array.from(document.querySelectorAll('video'));
            if (videos.length === 0) return null;

            // Предпочитаем проигрывающееся видео
            const playing = videos.find(v => !v.paused && v.currentTime > 0);
            if (playing) return playing;

            // Иначе выбираем с наибольшей видимой площадью
            let bestVideo = null;
            let maxArea = 0;
            const vh = window.innerHeight;
            const vw = window.innerWidth;

            for (const v of videos) {
                const rect = v.getBoundingClientRect();
                const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
                const visibleWidth = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
                const area = visibleHeight * visibleWidth;
                if (area > maxArea) {
                    maxArea = area;
                    bestVideo = v;
                }
            }
            return bestVideo || videos[0];
        }

        /** Генерирует безопасное имя файла */
        function getTitleFilename(itemId) {
            let rawTitle = (document.title || '').trim();
            if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
                rawTitle = rawTitle.slice(1, -1).trim();
            }
            if (rawTitle) {
                const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
                if (safeTitle.length > 0) return `${safeTitle}.mp4`;
            }
            return `redgifs_${itemId || 'video'}_${Date.now()}.mp4`;
        }

        /** Извлекает ссылки для скачивания текущего видео */
        function findMedia() {
            const active = getActiveItem();
            const urls = [];
            const itemId = (active && active.getAttribute('data-feed-item-id')) || 
                           (location.pathname.match(/\/watch\/([^/?#]+)/) || [])[1] || null;

            if (active) {
                const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]');
                if (poster && poster.src) {
                    const mp4Hd = poster.src.replace(/-mobile\.(jpg|png|jpeg)/i, '.mp4').replace(/\.(jpg|png|jpeg)/i, '.mp4');
                    const mp4Sd = poster.src.replace(/\.(jpg|png|jpeg)/i, '-mobile.mp4');
                    urls.push(mp4Hd, mp4Sd);
                }
            }

            const v = getActiveVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/hd.m3u8`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/sd.m3u8`);
            }

            const cleanUrls = Array.from(new Set(urls.filter(Boolean)));
            if (cleanUrls.length > 0) {
                return { urls: cleanUrls, type: 'video', itemId: itemId || 'video' };
            }
            return null;
        }

        /** 
         * Навигация на RedGifs (изолированная от URL-детектора)
         * dir: 'down' (вперед/следующее) или 'up' (назад/предыдущее)
         */
        function navigate(dir = 'down') {
            const isFwd = (dir === 'down' || dir === 'right');
            const targetDir = isFwd ? 'down' : 'up';

            // 1. Поиск нативных кнопок Next / Previous в UI плеера RedGifs
            const nextBtn = document.querySelector('button[aria-label="Next video"], button.nextButton, button.navButton.nextButton, button[aria-label*="Next" i], button[title*="Next" i], .PlayerNavigation-Next');
            const prevBtn = document.querySelector('button[aria-label="Previous video"], button.prevButton, button.navButton.prevButton, button[aria-label*="Prev" i], button[title*="Prev" i], .PlayerNavigation-Prev');

            if (isFwd && nextBtn) {
                if (typeof triggerClick === 'function') triggerClick(nextBtn, 'RedGifs Next Video');
                else nextBtn.click();
                return true;
            } else if (!isFwd && prevBtn) {
                if (typeof triggerClick === 'function') triggerClick(prevBtn, 'RedGifs Prev Video');
                else prevBtn.click();
                return true;
            }

            // 2. Поиск по DOM-элементам карточек
            const active = getActiveItem();
            if (active) {
                // Ищем соседнюю карточку в том же родительском контейнере или во всем документе
                const container = active.parentElement || document;
                const items = Array.from(container.querySelectorAll('[data-feed-item-id], .GifPreview, a[href*="/watch/"]'));
                let target = null;
                
                if (items.length > 1) {
                    const idx = items.indexOf(active);
                    if (idx !== -1) {
                        target = isFwd ? items[idx + 1] : items[idx - 1];
                    }
                }
                
                if (!target) {
                    target = isFwd ? active.nextElementSibling : active.previousElementSibling;
                }

                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const clickTarget = target.querySelector('.TapTracker, video, img, a') || target;
                    if (typeof triggerClick === 'function') triggerClick(clickTarget, 'RedGifs Target Card');
                    else clickTarget.click();
                    return true;
                }
            }

            // 3. Отправка клавиш ArrowDown / ArrowUp на window и document
            const key = isFwd ? 'ArrowDown' : 'ArrowUp';
            const keyCode = isFwd ? 40 : 38;

            const evDown = new KeyboardEvent('keydown', { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true });
            const evUp   = new KeyboardEvent('keyup',   { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true });

            document.dispatchEvent(evDown);
            window.dispatchEvent(evDown);

            setTimeout(() => {
                document.dispatchEvent(evUp);
                window.dispatchEvent(evUp);
            }, 50);

            // 4. Мягкая прокрутка страницы как страховка
            const scrollAmount = isFwd ? (window.innerHeight * 0.85) : (-window.innerHeight * 0.85);
            window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

            if (typeof triggerUniversalFullScreen === 'function') {
                triggerUniversalFullScreen();
            }

            return true;
        }

        /**
         * Сбор всех ссылок видео со страницы профиля/тега/поиска RedGifs
         */
        function collectLinks() {
            const rawLinks = Array.from(document.querySelectorAll('a[href*="/watch/"]'));
            const cards = Array.from(document.querySelectorAll('[data-feed-item-id]'));
            
            const seen = new Set();
            const items = [];

            // Определяем контекст (пользователь или тег)
            let contextName = '';
            const userMatch = location.pathname.match(/\/users\/([^/?#]+)/);
            const tagMatch = location.pathname.match(/\/tags\/([^/?#]+)/);
            if (userMatch) contextName = `@${userMatch[1]}`;
            else if (tagMatch) contextName = `#${tagMatch[1]}`;
            else contextName = document.title.split('-')[0].trim();

            for (const a of rawLinks) {
                const href = a.href;
                const m = href.match(/\/watch\/([^/?#]+)/);
                if (!m) continue;
                const id = m[1];
                if (seen.has(id)) continue;
                seen.add(id);

                const img = a.querySelector('img');
                const poster = img ? img.src : '';
                items.push({
                    id,
                    url: `https://www.redgifs.com/watch/${id}`,
                    poster,
                    context: contextName,
                    type: 'video'
                });
            }

            for (const c of cards) {
                const id = c.getAttribute('data-feed-item-id');
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const img = c.querySelector('img');
                items.push({
                    id,
                    url: `https://www.redgifs.com/watch/${id}`,
                    poster: img ? img.src : '',
                    context: contextName,
                    type: 'video'
                });
            }

            if (items.length === 0) {
                showToast('⚠️ На странице не найдено ссылок на видео', true);
                return;
            }

            const payload = {
                context: contextName,
                collectedAt: new Date().toISOString(),
                items
            };

            localStorage.setItem(REDGIFS_COLLECTION_KEY, JSON.stringify(payload));
            showToast(`📋 Собрано ${items.length} видео (${contextName})`);
            updateGalleryUI();
        }

        /** Обновление панели плейлиста/коллекции для RedGifs */
        function togglePlaylistPanel() {
            const existing = document.getElementById('mossad-rg-playlist-panel');
            if (existing) { existing.remove(); return; }

            const raw = localStorage.getItem(REDGIFS_COLLECTION_KEY);
            if (!raw) { showToast('⚠️ Коллекция RedGifs пуста. Нажмите [📋 Собрать]', true); return; }

            let data;
            try { data = JSON.parse(raw); } catch { return; }
            const items = data.items || [];
            if (!items.length) { showToast('⚠️ Коллекция пуста', true); return; }

            const panel = document.createElement('div');
            panel.id = 'mossad-rg-playlist-panel';
            panel.style.cssText = `
                position:fixed; top:70px; right:16px; z-index:9999999;
                width:320px; max-height:75vh; overflow-y:auto;
                background:rgba(12,12,16,0.96); backdrop-filter:blur(20px);
                border:1px solid rgba(255,255,255,0.12); border-radius:14px;
                font-family:system-ui,sans-serif; font-size:12px; color:#d1d5db;
                box-shadow:0 20px 60px rgba(0,0,0,0.7);
            `;

            const header = document.createElement('div');
            header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);`;
            header.innerHTML = `<span style="font-weight:700;font-size:13px;">📋 RedGifs Плейлист (${items.length})</span>`;
            
            const btnClose = document.createElement('button');
            btnClose.textContent = '×';
            btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;`;
            btnClose.onclick = () => panel.remove();
            header.appendChild(btnClose);
            panel.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = `padding:8px;`;

            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.style.cssText = `padding:5px 8px;margin-bottom:3px;cursor:pointer;border-radius:6px;color:#9ca3af;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;`;
                li.innerHTML = `<span style="color:#60a5fa;">${idx + 1}.</span> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">📹 ${item.id}</span>`;
                li.title = `Открыть: ${item.url}`;
                li.onmouseover = () => li.style.background = 'rgba(255,255,255,0.06)';
                li.onmouseout  = () => li.style.background = 'transparent';
                li.onclick = () => {
                    panel.remove();
                    window.location.href = item.url;
                };
                body.appendChild(li);
            });

            panel.appendChild(body);
            document.body.appendChild(panel);
        }

        /** Встраивает кнопки сбора коллекции в виджет MOSSAD на RedGifs */
        function updateGalleryUI() {
            if (!isSupported()) return;
            const widget = document.getElementById('mossad-main-panel') || document.getElementById('mossad-status-bar');
            if (!widget) return;

            let bar = document.getElementById('mossad-redgifs-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'mossad-redgifs-bar';
                bar.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px;font-size:11px;`;
                
                const panel = document.getElementById('mossad-main-panel');
                if (panel) {
                    panel.insertBefore(bar, panel.firstChild);
                }
            }

            const raw = localStorage.getItem(REDGIFS_COLLECTION_KEY);
            let count = 0;
            if (raw) {
                try { count = (JSON.parse(raw).items || []).length; } catch {}
            }

            bar.innerHTML = `
                <button id="mossad-rg-collect" style="padding:2px 8px;border-radius:4px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">📋 Собрать (${count})</button>
                <button id="mossad-rg-list" style="padding:2px 8px;border-radius:4px;border:none;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;">📋 Плейлист</button>
            `;

            bar.querySelector('#mossad-rg-collect').onclick = collectLinks;
            bar.querySelector('#mossad-rg-list').onclick = togglePlaylistPanel;
        }

        function init() {
            if (!isSupported()) return;
            setInterval(updateGalleryUI, 2000);
        }

        return {
            isSupported,
            getActiveItem,
            getActiveVideo,
            getTitleFilename,
            findMedia,
            navigate,
            collectLinks,
            togglePlaylistPanel,
            init
        };
    })();

    // Обратная совместимость и глобальные алиасы
    function getActiveRedGifsItem() {
        return window.MOSSAD_ENGINES?.redgifs?.getActiveItem() ||
               document.querySelector('.GifPreview_isActive') ||
               document.querySelector('.GifPreview') ||
               document.querySelector('[data-feed-item-id]');
    }

    function getRedGifsVideo() {
        return window.MOSSAD_ENGINES?.redgifs?.getActiveVideo() || null;
    }

    function getRedGifsTitleFilename(itemId) {
        return window.MOSSAD_ENGINES?.redgifs?.getTitleFilename(itemId) || `redgifs_${itemId}_${Date.now()}.mp4`;
    }

    function redGifsNavigate(dir = 'down') {
        if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
            return window.MOSSAD_ENGINES.redgifs.navigate(dir);
        }
    }

    if (window.MOSSAD_ENGINES?.redgifs) {
        window.MOSSAD_ENGINES.redgifs.init();
    }
