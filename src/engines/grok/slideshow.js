    // ============================================================
    // GROK ENGINE: Gallery Slideshow (Filmstrip & SPA Navigation, Tick, Loop)
    // ============================================================

    /**
     * Бесшовная SPA-навигация на grok.com:
     * 1. Внутри одной группы — поиск кадра в киноплёнке (filmstrip) и клик без перезагрузки страницы.
     * 2. Next.js router.push (если доступен в рантайме).
     * 3. Fallback: межпостовой переход по location.href (только для перехода на ДРУГУЮ группу/пост).
     */
    function grokSpaNavigate(url) {
        if (!url) return;
        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;
            const targetUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(urlObj.pathname)
                : (urlObj.pathname.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];

            // 1. Приоритет: поиск в полосе киноплёнки (filmstrip) на текущей странице
            if (targetUuid && typeof grokFindFilmstripItemByUuid === 'function') {
                const filmstripBtn = grokFindFilmstripItemByUuid(targetUuid);
                if (filmstripBtn) {
                    console.log(`[MOSSAD] grokSpaNavigate: кадр ${targetUuid.slice(0, 8)} найден в filmstrip — кликаем без перезагрузки!`);
                    filmstripBtn.click();

                    // Ожидаем обновления URL (через history.replaceState Грока) и возобновляем тик слайдшоу
                    let checks = 0;
                    const checkInterval = setInterval(() => {
                        checks++;
                        const curUuid = (typeof grokExtractUuid === 'function')
                            ? grokExtractUuid(location.pathname)
                            : (location.pathname.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
                        if ((curUuid && curUuid === targetUuid.toLowerCase()) || checks >= 12) {
                            clearInterval(checkInterval);
                            if (typeof grokGallerySlideshowTick === 'function') {
                                grokGallerySlideshowTick();
                            }
                        }
                    }, 50);
                    return;
                }
            }

            let navigated = false;

            // 2. Next.js router.push — если доступен в контексте страницы
            const nextRouter = (window.next && window.next.router) || (typeof unsafeWindow !== 'undefined' && unsafeWindow.next && unsafeWindow.next.router);
            if (nextRouter && typeof nextRouter.push === 'function') {
                nextRouter.push(path);
                navigated = true;
            } else {
                // 3. Клик по ссылке в DOM (если есть)
                const anchor = document.querySelector(`a[href="${path}"]`)
                            || document.querySelector(`a[href="${urlObj.pathname}"]`);
                if (anchor) {
                    anchor.click();
                    navigated = true;
                }
            }

            if (navigated) {
                let checks = 0;
                const checkInterval = setInterval(() => {
                    checks++;
                    if (location.pathname === urlObj.pathname || checks >= 15) {
                        clearInterval(checkInterval);
                        if (typeof grokGallerySlideshowTick === 'function') {
                            grokGallerySlideshowTick();
                        }
                    }
                }, 40);
                return;
            }
        } catch (e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // 4. Межпостовой переход (только если кадр из ДРУГОЙ группы/поста)
        console.log('[MOSSAD] grokSpaNavigate: пост не в текущей группе, открываем URL:', url);
        window.location.href = url;
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


    /** Кнопка 2: запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения коллекции', true); return; }
        const allItems = data.items || [];
        if (allItems.length === 0) { showToast('⚠️ Коллекция пуста', true); return; }

        // Читаем настройки режима из данных коллекции или дефолт (новые поля grpMode/itemMode)
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };

        const queue = grokBuildGalleryQueue(allItems, ssState);
        const ss = {
            active: true,
            queue,
            circle: 1,
            total: allItems.length,
            grpMode:  ssState.grpMode,
            itemMode: ssState.itemMode,
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryPaused = false;
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = `Gr${grIcon[ssState.grpMode]||'↓'} Md${grIcon[ssState.itemMode]||'↓'}`;
        showToast(`▶ Слайдшоу [${modeLabel}]: ${allItems.length} генераций`);
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { grokSpaNavigate(next.url); }, 300);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const allItems = data.items || [];
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };
        let queue = grokBuildGalleryQueue(allItems, ssState);
        // Переставляем startItem в начало очереди
        const startBase = (startItem.url || '').split('?')[0];
        const idx = queue.findIndex(i => (i.url || '').split('?')[0] === startBase);
        if (idx > 0) queue = [...queue.slice(idx), ...queue.slice(0, idx)];
        const ss = { active: true, queue: queue.slice(1), circle: 1, total: allItems.length,
            grpMode: ssState.grpMode, itemMode: ssState.itemMode };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryPaused = false;
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        showToast(`▶ Слайдшоу с выбранного элемента`);
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(startItem.url);
        }
        setTimeout(() => { grokSpaNavigate(startItem.url); }, 300);
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        window._mossadGalleryPaused = false;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        updateGalleryStatusBtn('idle');
        showToast('⏹ Gallery слайдшоу остановлено');
    }

    /** Обновляет текст/цвет кнопки статуса слайдшоу и видимость кнопки стоп */
    function updateGalleryStatusBtn(state) {
        // state: 'idle' | 'playing' | 'paused'
        const btn = document.getElementById('mossad-gallery-status');
        const btnStop = document.getElementById('mossad-gallery-stop');
        if (!btn) return;

        if (state === 'playing') {
            btn.textContent = '❚❚';
            btn.title = 'Пауза';
            btn.style.background = '#059669'; // Зеленая кнопка без слов
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = '1px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else if (state === 'paused') {
            btn.textContent = '▶';
            btn.title = 'Продолжить';
            btn.style.background = '#d97706'; // Янтарная при паузе
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else {
            btn.textContent = 'Слайдшоу';
            btn.title = 'Запустить слайдшоу по генерациям';
            btn.style.background = '#1e3a5f';
            btn.style.color = '#93c5fd';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = 'normal';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    /** Переключить паузу галерейного слайдшоу */
    function toggleGalleryPause() {
        if (!window._mossadGalleryActive) return;
        window._mossadGalleryPaused = !window._mossadGalleryPaused;
        if (window._mossadGalleryPaused) {
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(false);
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            showToast('▶ Продолжаем');
            // Если был фото-таймер, перезапускаем
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
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

        // Проверяем, стояло ли слайдшоу на паузе до перехода
        const isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                         (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        window._mossadGalleryPaused = isPaused;
        if (typeof setSlideshowPaused === 'function') setSlideshowPaused(isPaused);

        // Показываем компактный индикатор (или обновляем существующий)
        let indicator = document.getElementById('mossad-gallery-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'mossad-gallery-indicator';
            indicator.style.cssText = `
                position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
                z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
                border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                padding:5px 14px; font-family:system-ui,sans-serif; font-size:11px;
                color:#9ca3af; display:flex; align-items:center; gap:8px;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(indicator);
        }
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[ss.grpMode]||'↓'} Md${grIcon[ss.itemMode]||'↓'}`;
        const statusPrefix = isPaused ? '⏸' : '▶';
        indicator.innerHTML = `<span id="mgi-status">${statusPrefix} ${modeTag} · ${showed}/${ss.total} · Круг ${ss.circle}</span>`;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn(isPaused ? 'paused' : 'playing');

        // Подсвечиваем активный файл в открытом монолитном списке (плейлисте)
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem();
        }

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
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
                // Новый круг — снова строим очередь с теми же настройками
                const ssState = {
                    grpMode:   ss.grpMode   || ss.ssMode    || 'seq',
                    itemMode:  ss.itemMode  || ss.itemOrder || 'fwd',
                };
                queue = grokBuildGalleryQueue(allItems, ssState);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            // ── Проверяем loop (R): зациклен ли один/несколько элементов ──
            const loopRaw = _gSS.getItem('mossad_grok_loop_set');
            if (loopRaw) {
                try {
                    const loopSet = JSON.parse(loopRaw);
                    const loopUrls = loopSet.urls || [];
                    const loopGroupIds = loopSet.groupIds || [];
                    if (loopUrls.length > 0 || loopGroupIds.length > 0) {
                        let loopItems = [];
                        const colRaw2 = _gSS.getItem(GALLERY_COLLECTION_KEY);
                        if (colRaw2) {
                            const allCol = JSON.parse(colRaw2).items || [];
                            for (const item of allCol) {
                                const baseUrl = (item.url || '').split('?')[0];
                                const inUrls = loopUrls.some(u => u.split('?')[0] === baseUrl);
                                const inGroups = loopGroupIds.includes(item.convId || '__noconv__');
                                if (inUrls || inGroups) loopItems.push(item);
                            }
                        }
                        if (loopItems.length > 0) {
                            const loopIdx = (ss.loopIdx || 0) % loopItems.length;
                            const loopNext = loopItems[loopIdx];
                            ss.loopIdx = loopIdx + 1;
                            ss.queue  = queue;
                            ss.circle = circle;
                            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                            if (loopNext.type) sessionStorage.setItem('mossad_expected_type', loopNext.type);
                            grokSpaNavigate(loopNext.url);
                            return;
                        }
                    }
                } catch(e) {}
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            grokSpaNavigate(next.url || next);
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = isPaused;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        if (!isPaused) {
            setTimeout(() => scheduleNextSlideCycle(0), 300);
        }
    }

    // Фасад для явного контракта MOSSAD GALLERY
    window.MOSSAD_GALLERY = {
        isActive: () => !!window._mossadGalleryActive,
        isPaused: () => !!window._mossadGalleryPaused,
        next: () => {
            if (typeof window._mossadGalleryNextFn === 'function') {
                window._mossadGalleryNextFn();
            }
        },
        pause: toggleGalleryPause,
        stop: grokStopGallerySlideshow,
        start: grokStartGallerySlideshow,
        highlightActive: (url) => (typeof grokHighlightActivePlaylistItem === 'function' ? grokHighlightActivePlaylistItem(url) : null),
        togglePlaylist: (force) => (typeof grokTogglePlaylistPanel === 'function' ? grokTogglePlaylistPanel(force) : null)
    };
