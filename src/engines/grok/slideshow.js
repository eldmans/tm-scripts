    // ============================================================
    // GROK ENGINE: Gallery Slideshow (SPA Navigation, Tick, Loop)
    // ============================================================

    /**
     * SPA-навигация на grok.com через Next.js router.push() — без перезагрузки страницы.
     * Подтверждено: window.next.router доступен на grok.com.
     * Fallback: клик по <a> или window.location.href (полный переход).
     */
    function grokSpaNavigate(url) {
        if (!url) return;
        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;

            let navigated = false;

            // 1. Next.js router.push — основной метод (SPA без перезагрузки)
            if (window.next && window.next.router && typeof window.next.router.push === 'function') {
                window.next.router.push(path);
                navigated = true;
            } else {
                // 2. Клик по ссылке в DOM (если есть)
                const anchor = document.querySelector([href=""])
                            || document.querySelector([href=""]);
                if (anchor) {
                    anchor.click();
                    navigated = true;
                }
            }

            if (navigated) {
                // Ждём смены URL и перезапускаем/обновляем тик слайдшоу
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
        // 3. Fallback: полный переход
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

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = Gr Md;
        showToast(▶ Слайдшоу []:  генераций);
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
        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        showToast(▶ Слайдшоу с выбранного элемента);
        setTimeout(() => { grokSpaNavigate(startItem.url); }, 300);
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        window._mossadGalleryPaused = false;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        updateGalleryStatusBtn('idle');
        showToast('⏹ Gallery слайдшоу остановлено');
    }

    /** Обновляет текст/цвет кнопки статуса слайдшоу */
    function updateGalleryStatusBtn(state) {
        // state: 'idle' | 'playing' | 'paused'
        const btn = document.getElementById('mossad-gallery-status');
        if (!btn) return;
        if (state === 'playing') {
            btn.textContent = '▶ Идёт';
            btn.style.background = '#064e3b';
            btn.style.color = '#34d399';
        } else if (state === 'paused') {
            btn.textContent = '⏸ Пауза';
            btn.style.background = '#451a03';
            btn.style.color = '#fbbf24';
        } else {
            btn.textContent = '🎲 Слайдшоу';
            btn.style.background = '#1e3a5f';
            btn.style.color = '#93c5fd';
        }
    }

    /** Переключить паузу галерейного слайдшоу */
    function toggleGalleryPause() {
        if (!window._mossadGalleryActive) return;
        window._mossadGalleryPaused = !window._mossadGalleryPaused;
        if (window._mossadGalleryPaused) {
            slideshowPaused = true;
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            slideshowPaused = false;
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

        // Показываем компактный индикатор (или обновляем существующий)
        let indicator = document.getElementById('mossad-gallery-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'mossad-gallery-indicator';
            indicator.style.cssText = 
                position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
                z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
                border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                padding:5px 14px; font-family:system-ui,sans-serif; font-size:11px;
                color:#9ca3af; display:flex; align-items:center; gap:8px;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
            ;
            document.body.appendChild(indicator);
        }
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = Gr Md;
        indicator.innerHTML = <span id="mgi-status">▶  · / · Круг </span>;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn('playing');
        window._mossadGalleryPaused = false;

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
                showToast(🔄 Круг  начался! ( генераций));
            }

            // ── Проверяем loop (R): зациклен ли один/несколько элементов ──
            const colRaw2 = _gSS.getItem(GALLERY_COLLECTION_KEY);
            const allCol = colRaw2 ? (JSON.parse(colRaw2).items || []) : [];
            const loopItems = getGrokActiveLoopItems(allCol);
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

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            grokSpaNavigate(next.url || next);
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
            showToast(←→ / • );
            grokSpaNavigate(next.url);
        }, true); // capture — раньше страницы
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
        start: grokStartGallerySlideshow
    };
