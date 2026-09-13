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

        const startBase = (startItem.url || '').split('?')[0].toLowerCase();
        const startGid = startItem.convId || '__noconv__';

        const ss = {
            active: true,
            circle: 1,
            total: struct.items.length,
            visitedInCurGroup: [startBase],
            visitedGroupsInCircle: [startGid],
            visitedInCircle: [startBase]
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryPaused = false;
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
            setTimeout(() => { grokSpaNavigate(startItem.url); }, 200);
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
        const curPos = (struct && typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct) : null;

        const grpMode = struct?.grpMode || 'seq';
        const itemMode = struct?.itemMode || 'fwd';
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[grpMode]||'↓'} Md${grIcon[itemMode]||'↓'}`;
        const statusPrefix = isPaused ? '⏸' : '▶';

        let posText = '';
        if (curPos && curPos.flatIndex !== -1 && struct) {
            posText = `${curPos.flatIndex + 1}/${struct.items.length}`;
            if (curPos.grpIndex !== -1 && struct.groups.length > 1) {
                posText += ` (гр. ${curPos.grpIndex + 1}/${struct.groups.length})`;
            }
        } else if (struct) {
            posText = `${struct.items.length}`;
        }

        indicator.innerHTML = `<span id="mgi-status">${statusPrefix} ${modeTag} · ${posText} · Круг ${ss.circle || 1}</span>`;

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
