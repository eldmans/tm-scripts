    // ============================================================
    // GROK ENGINE: Gallery Slideshow (Filmstrip & SPA Navigation, Tick, Loop)
    // ============================================================

    /**
     * SPA-навигация на grok.com.
     * КАЖДЫЙ пост в группе имеет свой уникальный UUID → всегда навигируем по URL.
     * Filmstrip используется ТОЛЬКО для ручного листания вариантов одного поста (grokStepFilmstrip),
     * но НЕ для автоматического слайдшоу по коллекции.
     * 1. Пробуем Next.js router.push (без перезагрузки страницы).
     * 2. Fallback: window.location.href (полный переход).
     */
    function grokSpaNavigate(url) {
        if (!url) return;

        // Сохраняем состояние паузы перед переходом
        const wasPaused = window._mossadGalleryPaused ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        if (wasPaused) {
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            if (typeof SESSION_PAUSED_KEY !== 'undefined') sessionStorage.setItem(SESSION_PAUSED_KEY, 'true');
        } else {
            sessionStorage.removeItem('mossad_gallery_paused');
            if (typeof SESSION_PAUSED_KEY !== 'undefined') sessionStorage.removeItem(SESSION_PAUSED_KEY);
        }
        sessionStorage.setItem('mossad_navigating_group', 'true');

        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;

            // Попытка SPA-навигации через Next.js router (без перезагрузки страницы)
            if (window.next?.router?.push) {
                console.log('[MOSSAD] grokSpaNavigate: Next.js router.push →', path);
                window.next.router.push(path);
                // Ждём смены URL, затем вызываем tick
                let navChecks = 0;
                const navWait = setInterval(() => {
                    navChecks++;
                    const curPath = location.pathname + location.search;
                    if (curPath === path) {
                        clearInterval(navWait);
                        if (typeof grokGallerySlideshowTick === 'function') {
                            setTimeout(grokGallerySlideshowTick, 200);
                        }
                    } else if (navChecks >= 20) {
                        // 2 секунды прошло — роутер не отработал, переходим жёстко
                        clearInterval(navWait);
                        console.warn('[MOSSAD] grokSpaNavigate: router.push не сработал → location.href');
                        window.location.href = url;
                    }
                }, 100);
                return;
            }
        } catch(e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // Fallback: полный переход
        console.log('[MOSSAD] grokSpaNavigate: location.href →', url);
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


    /** Запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
        if (!struct || !struct.items.length) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }

        // Если уже стоим на элементе из коллекции — стартуем прямо с него!
        let startItem = null;
        const curPos = (typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct) : null;
        if (curPos && curPos.currentItem) {
            startItem = curPos.currentItem;
        } else {
            // Выбираем стартовую группу
            let startGrp = null;
            if (struct.grpMode === 'rev') {
                startGrp = struct.groups[struct.groups.length - 1];
            } else if (struct.grpMode === 'rnd') {
                startGrp = struct.groups[Math.floor(Math.random() * struct.groups.length)];
            } else {
                startGrp = struct.groups[0];
            }
            if (startGrp && startGrp.items.length) {
                if (struct.itemMode === 'rev') {
                    startItem = startGrp.items[startGrp.items.length - 1];
                } else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
                    startItem = startGrp.items[Math.floor(Math.random() * startGrp.items.length)];
                } else {
                    startItem = startGrp.items[0];
                }
            } else {
                startItem = struct.items[0];
            }
        }
        if (!startItem) return;
        grokStartGallerySlideshowFrom(startItem);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        if (!startItem) return;
        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
        if (!struct || !struct.items.length) {
            showToast('⚠️ Коллекция не собрана', true);
            return;
        }

        // Немедленно останавливаем любые активные таймеры предыдущего видео/слайда!
        if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
        isCountingDown = false;
        countdownSeconds = 0;
        currentLoopCount = 0;
        accumulatedTime = 0;

        const startBase = (startItem.url || '').split('?')[0].toLowerCase();
        const startGid = startItem.convId || '__noconv__';
        const startUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(startItem.url) : '';

        // Ищем явную позицию стартового элемента в структуре
        let startGrpIdx = 0, startItemIdx = 0;
        for (let _g = 0; _g < struct.groups.length; _g++) {
            const _i = struct.groups[_g].items.findIndex(it =>
                (it.url || '').split('?')[0].toLowerCase() === startBase);
            if (_i !== -1) { startGrpIdx = _g; startItemIdx = _i; break; }
        }

        const ss = {
            active: true,
            circle: 1,
            total: struct.items.length,
            targetUrl: startItem.url,
            targetUuid: startUuid,
            curGrpIdx: startGrpIdx,
            curItemIdx: startItemIdx,
            visitedInCurGroup: [startBase],
            visitedGroupsInCircle: [startGid],
            visitedInCircle: [startBase]
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        const wasPaused = window._mossadGalleryPaused || sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        if (wasPaused) {
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
        } else {
            sessionStorage.removeItem('mossad_gallery_paused');
            window._mossadGalleryPaused = false;
        }
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = `Gr${grIcon[struct.grpMode]||'↓'} Md${grIcon[struct.itemMode]||'↓'}`;
        showToast(`▶ Слайдшоу [${modeLabel}]: ${struct.items.length} ген.`);
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(startItem.url);
        }

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);

        const curClean = location.href.split('?')[0].toLowerCase();
        if (curClean === startBase) {
            grokGallerySlideshowTick();
        } else {
            setTimeout(() => { grokSpaNavigate(startItem.url); }, 150);
        }
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
            btn.style.background = '#059669';
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = '1px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else if (state === 'paused') {
            btn.textContent = '▶';
            btn.title = 'Продолжить';
            btn.style.background = '#d97706';
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
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
        }
    }

    /** Выполняет шаг к следующему слайду по логике плейлиста */
    function grokGalleryStepNext() {
        const nextRes = (typeof grokGetNextSlideItem === 'function')
            ? grokGetNextSlideItem('auto')
            : null;
        if (!nextRes || !nextRes.item) return;

        if (nextRes.circleCompleted) {
            playCircleDoneSound();
            let ss = {};
            try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
            ss.circle = (ss.circle || 1) + 1;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            showToast(`🔄 Круг ${ss.circle} начался!`);
        }

        let ss = {};
        try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
        ss.targetUrl = nextRes.item.url;
        ss.targetUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(nextRes.item.url) : '';
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
        grokSpaNavigate(nextRes.item.url);
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;

        if (sessionStorage.getItem('mossad_navigating_group') === 'true') {
            sessionStorage.removeItem('mossad_navigating_group');
        }

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


        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;



        const grpMode = struct?.grpMode || 'seq';
        const itemMode = struct?.itemMode || 'fwd';
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[grpMode]||'↓'} Md${grIcon[itemMode]||'↓'}`;
        const statusPrefix = isPaused ? '⏸' : '▶';

        // Позиция из SS (явная, надёжная)
        let posText = '';
        if (struct) {
            const ssG = typeof ss.curGrpIdx === 'number' ? ss.curGrpIdx : -1;
            const ssI = typeof ss.curItemIdx === 'number' ? ss.curItemIdx : -1;
            if (ssG >= 0 && ssI >= 0 && ssG < struct.groups.length) {
                const grp = struct.groups[ssG];
                // flatIndex = число элементов во всех предыдущих группах + ssI
                let flatIdx = ssI;
                for (let _g = 0; _g < ssG; _g++) flatIdx += struct.groups[_g].items.length;
                posText = `${flatIdx + 1}/${struct.items.length}`;
                if (struct.groups.length > 1) posText += ` (гр. ${ssG + 1}/${struct.groups.length})`;
            } else {
                posText = `${struct.items.length}`;
            }
        }


        indicator.innerHTML = `<span id="mgi-status">${statusPrefix} ${modeTag} · ${posText} · Круг ${ss.circle || 1}</span>`;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn(isPaused ? 'paused' : 'playing');

        // Подсвечиваем активный файл в открытом монолитном списке (плейлисте)
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(ss.targetUrl || null);
        }

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            grokGalleryStepNext();
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
