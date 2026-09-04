    // ============================================================
    // GROK: Smart Delete (click "Удалить изображение"/"Удалить видео", auto-confirm, hold-post)
    // ============================================================
    function runSmartDelete() {
        if (rootDomain !== 'grok.com') return;
        // Определяем текст кнопки удаления по текущему медиа-типу пина
        const hasVideo = !!getActiveVideo();
        const deleteBtnLabel = hasVideo ? 'Удалить видео' : 'Удалить изображение';

        // 1. Находим кнопку удаления (предварительно: если hold post — запоминаем URL поста до открытия диалога)
        let postUrl = null;
        if (config.deleteHoldpost) {
            // URL формат /imagine/post/ID/response/RID
            const m = location.pathname.match(/(\/imagine\/post\/[^/]+)/);
            if (m) postUrl = m[1];
        }

        // 2. Находим и кликаем кнопку удаления (ищем по aria-label или текст)
        const findDelBtn = () => {
            const all = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
            return all.find(el => {
                const txt = (el.textContent || '').trim();
                const aria = (el.getAttribute('aria-label') || '').trim();
                return txt === deleteBtnLabel || aria === deleteBtnLabel ||
                       txt.includes('Удалить') || aria.includes('Удалить') ||
                       txt.toLowerCase().includes('delete') || aria.toLowerCase().includes('delete');
            });
        };

        const delBtn = findDelBtn();
        if (!delBtn) {
            showToast('⚠️ Кнопка удаления не найдена на странице', true);
            return;
        }
        delBtn.click();
        showToast('✕ Удаление...');

        // 3. Автоподтверждение (если включено)
        if (config.deleteAutoconfirm) {
            let confirmAttempts = 0;
            const confirmInterval = setInterval(() => {
                confirmAttempts++;
                const confirmBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
                const confirmBtn = confirmBtns.find(el => {
                    const txt = (el.textContent || '').trim().toLowerCase();
                    const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
                    return txt === 'удалить' || aria === 'удалить' ||
                           txt === 'delete' || aria === 'delete' ||
                           txt === 'confirm' || txt === 'yes' || aria === 'confirm';
                });
                if (confirmBtn) {
                    confirmBtn.click();
                    clearInterval(confirmInterval);
                    // 4. hold post: вернуться на страницу поста после удаления
                    if (postUrl) {
                        setTimeout(() => {
                            window.location.href = postUrl;
                        }, 800);
                    }
                }
                if (confirmAttempts > 25) clearInterval(confirmInterval); // 5с ожидания
            }, 200);
        }
    }

    // Граница: только на странице поста grok.com/imagine/post/... работают DL, Delete, слайдшоу и т.д.
    const isGrokPostPage  = () => rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    const isGrokSavedPage = () => rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);

    // ============================================================
    // GROK IMAGINE GALLERY — сбор ссылок + рандомное слайдшоу
    // ============================================================
    // sessionStorage: живёт только в текущей вкладке, умирает при закрытии, не смешивается между вкладками
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const _gSS = sessionStorage; // короткий псевдоним

    /** Извлекает email из Next.js Flight данных на странице */
    function grokExtractEmail() {
        // Просто находим слово email, затем вытащиваем email-паттерн после него
        // Работает для "email":"val", \"email\":\"val\", любого варианта
        const re = /email[^a-zA-Z0-9]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
        for (const s of document.querySelectorAll('script')) {
            const m = s.textContent.match(re);
            if (m) return m[1];
        }
        try {
            const m = document.documentElement.innerHTML.match(re);
            if (m) return m[1];
        } catch(e) {}
        return 'unknown';
    }

    /** Собирает все уникальные ссылки /imagine/post/... из DOM + определяет тип по span с таймером */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        document.querySelectorAll('a[href*="/imagine/post/"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href) return;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            if (seen.has(url)) return;
            seen.add(url);
            // Карточка — ближайший listitem / masonry-item родитель
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            // Видео = есть span с классом tabular-nums (таймер 0:06)
            const hasTimer = !!(card && card.querySelector('span.tabular-nums'));
            items.push({ url, type: hasTimer ? 'video' : 'photo' });
        });
        return items;
    }

    /** Fisher-Yates перемешивание */
    function fisherYatesShuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** Звуковой сигнал окончания круга (до-ми-соль) */
    function playCircleDoneSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [523, 659, 784].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g   = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                const t0 = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.25, t0);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
                osc.start(t0); osc.stop(t0 + 0.35);
            });
        } catch(e) { /* AudioContext может быть заблокирован */ }
    }

    /** Кнопка 1: сохранить коллекцию в sessionStorage (без скачивания) */
    function grokSaveCollection(btnEl) {
        const items = grokCollectLinks();
        if (items.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
            return;
        }
        const date   = new Date().toISOString().slice(0, 10);
        const videos = items.filter(i => i.type === 'video').length;
        const photos = items.length - videos;
        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({ date, items }));
        if (btnEl) {
            btnEl.textContent = `✅ ${items.length} (📹${videos} 🖼${photos})`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(items.length);
        }
        showToast(`✅ Собрано ${items.length} → 📹${videos} видео, 🖼${photos} фото`);
    }

    /** Отдельная кнопка — скачать .txt с коллекцией (только тогда извлекает email) */
    function grokDownloadCollection() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Сначала нажмите «Собрать»', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения', true); return; }
        const items = data.items || [];
        const email = grokExtractEmail();
        const date  = data.date || new Date().toISOString().slice(0, 10);
        const filename = `${email}_${date}_${items.length}_links.txt`;
        const blob = new Blob([items.map(i => `${i.url}\t${i.type}`).join('\n')], { type: 'text/plain' });
        const bUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = bUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(bUrl); }, 2000);
        showToast(`📥 Скачано: ${filename}`);
    }

    /** Кнопка 2: запустить рандомное слайдшоу по коллекции */
    function grokStartGallerySlideshow(btnEl) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения коллекции', true); return; }
        const allItems = data.items || [];
        if (allItems.length === 0) { showToast('⚠️ Коллекция пуста', true); return; }

        const queue = fisherYatesShuffle(allItems); // queue of {url, type}
        const ss = { active: true, queue, circle: 1, total: allItems.length };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        showToast(`🎲 Слайдшоу: круг 1, ${allItems.length} генераций`);
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        // Подсказываем движку тип следующего поста
        if (next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { window.location.href = next.url; }, 300);
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        const btnSS = document.getElementById('mossad-gallery-ss');
        if (btnSS) {
            btnSS.textContent = '🎲 Слайдшоу';
            btnSS.style.background = '#1e3a5f';
            btnSS.style.color = '#93c5fd';
        }
        showToast('⏹ Gallery слайдшоу остановлено');
    }

    /** Инициализация строки галереи внутри виджета MOSSAD (для всех страниц grok.com) */
    function initGrokGalleryBar() {
        if (rootDomain !== 'grok.com') return;
        if (document.getElementById('mossad-gallery-row')) return;

        const container = document.getElementById('mossad-widget-container');
        if (!container) return;

        const row = document.createElement('div');
        row.id = 'mossad-gallery-row';
        row.style.cssText = `
            background: rgba(20,20,20,0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px 12px;
            display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab;
        `;

        const btnCollect = document.createElement('button');
        btnCollect.id = 'mossad-gallery-collect';
        let savedCount = 0;
        try {
            const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (cRaw) savedCount = (JSON.parse(cRaw).items || []).length;
        } catch(e) {}
        btnCollect.textContent = savedCount > 0 ? `📋 Собрано (${savedCount})` : '📋 Собрать';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else {
                showToast('ℹ️ Переход на /imagine/saved для сбора...');
                setTimeout(() => { window.location.href = 'https://grok.com/imagine/saved'; }, 300);
            }
        };

        if (isGrokSavedPage()) {
            // Мониторим изменение числа ссылок на странице каждые 2с
            setInterval(() => {
                const currentCount = document.querySelectorAll('a[href*="/imagine/post/"]').length;
                const sc = parseInt(btnCollect.dataset.collectedCount || String(savedCount), 10);
                if (sc === 0) return;
                if (currentCount !== sc) {
                    const diff = currentCount - sc;
                    const sign = diff > 0 ? '+' : '';
                    btnCollect.textContent = `🔴 ${currentCount} (${sign}${diff})`;
                    btnCollect.style.background = '#7f1d1d';
                    btnCollect.style.color = '#fca5a5';
                    btnCollect.dataset.collectedCount = String(currentCount);
                }
            }, 2000);
        }

        // На странице /saved слайдшоу никогда не должно гореть красным «Стоп»
        const _ssActive = (() => {
            if (isGrokSavedPage()) return false;
            try {
                const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                return !!item.active && (slideshowActive || sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true');
            } catch { return false; }
        })();

        const btnSS = document.createElement('button');
        btnSS.id = 'mossad-gallery-ss';
        btnSS.textContent = _ssActive ? '⏹ Стоп' : '🎲 Слайдшоу';
        btnSS.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:${_ssActive ? '#7f1d1d' : '#1e3a5f'};color:${_ssActive ? '#fca5a5' : '#93c5fd'};transition:all 0.2s;`;
        btnSS.onclick = () => {
            const active = (() => {
                try {
                    const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                    return !!item.active;
                } catch { return false; }
            })();
            if (active) {
                grokStopGallerySlideshow();
                stopSlideshow();
                btnSS.textContent = '🎲 Слайдшоу';
                btnSS.style.background = '#1e3a5f'; btnSS.style.color = '#93c5fd';
            } else {
                grokStartGallerySlideshow(btnSS);
            }
        };

        const btnDl = document.createElement('button');
        btnDl.id = 'mossad-gallery-dl';
        btnDl.textContent = '📥';
        btnDl.title = 'Скачать коллекцию .txt';
        btnDl.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 8px;font-size:14px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;
        btnDl.onclick = () => grokDownloadCollection();

        // Стрелочка вниз: открывает/закрывает вторую полоску (TopBar)
        const btnToggleTop = document.createElement('button');
        btnToggleTop.id = 'mossad-gallery-toggle-top';
        btnToggleTop.innerHTML = '▼';
        btnToggleTop.title = 'Показать / скрыть панель управления';
        btnToggleTop.style.cssText = `background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:12px;padding:0 4px;transition:color 0.2s;`;
        btnToggleTop.onclick = () => {
            window.widgetState = window.widgetState === 'hidden' ? 'bar' : 'hidden';
            if (window.updateWidgetUI) window.updateWidgetUI();
        };

        row.append(btnCollect, btnSS, btnDl, btnToggleTop);
        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
        }
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;

        // Показываем индикатор
        const indicator = document.createElement('div');
        indicator.id = 'mossad-gallery-indicator';
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        indicator.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.1); border-radius:10px;
            padding:6px 16px; font-family:system-ui,sans-serif; font-size:12px;
            color:#9ca3af; display:flex; align-items:center; gap:10px;
            box-shadow:0 4px 20px rgba(0,0,0,0.5);
        `;
        indicator.innerHTML = `<span>🎲 Круг ${ss.circle} · ${showed}/${ss.total}</span><button id="mgi-stop" style="background:#374151;border:none;border-radius:6px;color:#f87171;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:bold;">⏹</button>`;
        document.body.appendChild(indicator);

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            indicator.remove();
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;

            let queue  = ss.queue  || [];
            let circle = ss.circle || 1;

            if (queue.length === 0) {
                playCircleDoneSound();
                circle++;
                const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                let allItems = [];
                if (colRaw) { try { allItems = JSON.parse(colRaw).items || []; } catch {} }
                queue = fisherYatesShuffle(allItems);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            // Подсказываем движку тип следующего поста — нет 6с ожидания на фото
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            window.location.href = next.url || next; // поддержка старых строковых очередей
        };

        document.getElementById('mgi-stop').onclick = () => {
            grokStopGallerySlideshow();
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            stopSlideshow();
            indicator.remove();
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = false;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        setTimeout(() => scheduleNextSlideCycle(0), 300);
    }

    /** Клавиши ←→ по коллекции (только если текущий пост есть в списке) */
    function grokGalleryKeyboardNav() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (items.length === 0) return;

        // UUID текущего поста
        const currentId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
        if (!currentId) return;
        if (!items.some(it => it.url.includes(currentId))) return; // не наш пост — не перехватываем

        document.addEventListener('keydown', function _gNav(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

            // Перепроверяем по актуальному URL
            const curId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
            const curIdx = curId ? items.findIndex(it => it.url.includes(curId)) : -1;
            if (curIdx === -1) {
                document.removeEventListener('keydown', _gNav, true);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const nextIdx = e.key === 'ArrowRight'
                ? (curIdx + 1) % items.length
                : (curIdx - 1 + items.length) % items.length;
            const next = items[nextIdx];
            if (next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            showToast(`←→ ${nextIdx + 1}/${items.length} • ${next.type === 'video' ? '📹' : '🖼'}`);
            window.location.href = next.url;
        }, true); // capture — раньше страницы
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => res.blob()).then(blob => saveBlobToDisk(blob, filename))
        .catch(err => {
            showToast('⚠️ Прямое скачивание недоступно, открыто в новой вкладке', true);
            window.open(url, '_blank');
        });
    }

    function saveBlobToDisk(blob, filename) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        showToast('✅ Сохранено!');
    }

    // Точная копия из 2.1.7-redgifs-drag
    function getActiveRedGifsItem() {
        return document.querySelector('.GifPreview_isActive')
            || document.querySelector('.GifPreview')
            || document.querySelector('[data-feed-item-id]');
    }

    function getRedGifsVideo() {
        const active = getActiveRedGifsItem();
        if (active) {
            const v = active.querySelector('video');
            if (v) return v;
        }
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        let bestVideo = null;
        let maxVisibleHeight = 0;
        const vh = window.innerHeight;
        for (const v of videos) {
            const rect = v.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
            if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                bestVideo = v;
            }
        }
        return bestVideo || videos[0];
    }

    function getRedGifsTitleFilename(itemId) {
        let rawTitle = (document.title || '').trim();
        if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
            rawTitle = rawTitle.slice(1, -1).trim();
        }
        if (rawTitle) {
            const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            if (safeTitle.length > 0) return `${safeTitle}.mp4`;
        }
        return `redgifs_${itemId}_${Date.now()}.mp4`;
    }

    function getPinterestMainPinData() {
        try {
            // 1. Прямой осмотр DOM тегов видео главного пина (closeup-video-main, duplo-hls-video)
            const mainVideo = document.querySelector('video[elementtiming*="video"], video[data-test-id="duplo-hls-video"], video[src*="v1.pinimg.com"], video.jI_JN7');
            if (mainVideo) {
                const src = mainVideo.src || (mainVideo.querySelector('source') && mainVideo.querySelector('source').src) || '';
                const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
                let bestMp4Url = null;
                if (sigMatch) {
                    const sig = sigMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                } else if (src.endsWith('.mp4')) {
                    bestMp4Url = src;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            // 2. Сканирование разметки DOM на предмет v1.pinimg.com/videos/iht/hls/ или elementtiming="closeup-video-main"
            const fullHtml = document.documentElement.innerHTML || '';
            const hlsMatch = fullHtml.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/iht\\?\/hls\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{32})\.m3u8/i) ||
                             fullHtml.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i);

            if (hlsMatch || fullHtml.includes('elementtiming="closeup-video-main') || fullHtml.includes('data-test-id="duplo-hls-video"')) {
                let bestMp4Url = null;
                if (hlsMatch) {
                    const sig = hlsMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            const scanText = (txt) => {
                if (!txt || !txt.includes('auth_web_main_pin')) return null;
                const idx = txt.indexOf('resource_response');
                if (idx === -1) return null;
                
                // Берем с запасом 40000 символов, т.к. story_pin_data с видео-блоком лежит глубоко внизу JSON
                const slice = txt.slice(Math.max(0, idx - 500), idx + 40000);

                // 1. ПЕРВЫМ ДЕЛОМ ИЩЕМ СИГНАТУРЫ И БЛОКИ ВИДЕО
                const sigMatch = slice.match(/"video_signature"\s*:\s*"([a-f0-9]{32})"/i) ||
                                 slice.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 slice.match(/thumbnails\/originals\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\./i);

                const hasVideoKeywords = /story_pin_video_block/i.test(slice) || 
                                         /"video_list"\s*:\s*\{/i.test(slice) || 
                                         /"videos"\s*:\s*\{/i.test(slice) || 
                                         /duplo-hls/i.test(slice);

                if (sigMatch || hasVideoKeywords) {
                    let bestMp4Url = null;
                    const mp4Matches = slice.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+?\.mp4/g) ||
                                       slice.match(/https:\/\/v1\.pinimg\.com\/videos\/[^\s"',]+?\.mp4/g);
                    if (mp4Matches && mp4Matches.length > 0) {
                        bestMp4Url = mp4Matches[0].replace(/\\/g, '');
                    }
                    
                    if (!bestMp4Url && sigMatch) {
                        const sig = sigMatch[4] || sigMatch[1];
                        if (sig && sig.length === 32) {
                            bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                        }
                    }
                    return { isFound: true, type: 'video', bestMp4Url };
                }

                // 2. И ТОЛЬКО ЕСЛИ НИ ОДНОГО ПРИЗНАКА ВИДЕО НЕТ — ЭТО ФОТО
                if (/"images"\s*:\s*\{/i.test(slice) || /"image_signature"/i.test(slice)) {
                    return { isFound: true, type: 'image', bestMp4Url: null };
                }

                return null;
            };

            if (window.__PJS_OUTPUT__) {
                const res = scanText(JSON.stringify(window.__PJS_OUTPUT__));
                if (res) return res;
            }

            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const res = scanText(s.textContent || '');
                if (res) return res;
            }
        } catch (e) {
            console.error('[MOSSAD] PinResource JSON parse error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
    }

