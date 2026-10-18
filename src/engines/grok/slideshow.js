    // ============================================================
    // GROK ENGINE: Gallery Slideshow (Filmstrip & SPA Navigation, Tick, Loop)
    // ============================================================

    /**
     * Навигация на grok.com:
     * - Та же conversation (группа) → filmstrip click (мгновенно, без перезагрузки)
     * - Другая conversation → window.location.href (полный переход)
     */
    // ── v1.3.38: блокировка навигации «в полёте» ──
    // Раньше несколько источников (таймер фото, конец кругов видео, монитор URL, тик, ретраи) могли
    // запустить шаг подряд, пока предыдущий переход ещё не завершился → «шторм» ~10 переходов/с в
    // режиме случайных групп. Теперь автошаг игнорируется, пока предыдущий переход не «прибыл» (тик
    // на новом посте) или не истёк таймаут. Ручные шаги (хоткеи, клик в плейлисте) перехватывают
    // блокировку (force). ANTI_PATTERNS §17.
    const GALLERY_NAV_LOCK_MS = 4000;
    const GALLERY_MIN_DWELL_MS = 600; // автошаг не раньше, чем через 600 мс после прибытия (фото ≥ 1 с)
    const _galleryNav = { inFlight: false, targetUuid: '', startedAt: 0, source: '', seq: 0, arrivedAt: 0 };

    function grokNavInFlight() {
        if (!_galleryNav.inFlight) return false;
        if (Date.now() - _galleryNav.startedAt > GALLERY_NAV_LOCK_MS) {
            mossadDebug('nav', 'таймаут блокировки перехода — снимаем', { source: _galleryNav.source, target: _galleryNav.targetUuid });
            _galleryNav.inFlight = false;
            return false;
        }
        return true;
    }

    /** Захват блокировки перехода. false — автошаг отклонён (переход уже идёт). */
    function grokBeginNav(url, source, force = false) {
        if (!force && grokNavInFlight()) {
            mossadDebug('nav', 'шаг ОТКЛОНЁН: предыдущий переход ещё в полёте', { source, inFlightFrom: _galleryNav.source, target: _galleryNav.targetUuid });
            return false;
        }
        _galleryNav.inFlight = true;
        _galleryNav.targetUuid = (grokExtractUuid(url || '') || '').toLowerCase();
        _galleryNav.startedAt = Date.now();
        _galleryNav.source = source || '?';
        _galleryNav.seq++;
        const mySeq = _galleryNav.seq;
        // Сторож: если «прибытие» так и не случилось (переход не удался), снимаем блокировку и продолжаем
        setTimeout(() => {
            if (_galleryNav.inFlight && _galleryNav.seq === mySeq) {
                mossadDebug('nav', 'сторож: переход не завершился — снимаем блокировку', { source: _galleryNav.source });
                _galleryNav.inFlight = false;
                if (slideshowActive && !slideshowPaused) requestSlideCycle(0, 'nav-watchdog');
            }
        }, GALLERY_NAV_LOCK_MS + 100);
        mossadDebug('nav', 'переход начат', { source, target: _galleryNav.targetUuid, seq: _galleryNav.seq, force: !!force });
        return true;
    }

    function grokEndNav(reason) {
        if (!_galleryNav.inFlight) return;
        mossadDebug('nav', 'переход завершён', { reason, source: _galleryNav.source, ms: Date.now() - _galleryNav.startedAt });
        _galleryNav.inFlight = false;
        _galleryNav.arrivedAt = Date.now();
    }

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
            const targetUuid = grokExtractUuid(urlObj.pathname);

            const struct = grokGetPlaylistStructure();
            const isPostPage = isGrokPostPage();

            if (isPostPage && struct) {
                const targetPos = grokFindCurrentPosition(struct, url);
                const currentPos = grokFindCurrentPosition(struct);

                const isSameGroup = targetPos && currentPos &&
                                    targetPos.grpIndex !== -1 &&
                                    targetPos.grpIndex === currentPos.grpIndex;

                if (isSameGroup) {
                    // Та же conversation → filmstrip click, без перезагрузки страницы
                    let filmstripBtn = null;
                    if (targetUuid) {
                        filmstripBtn = grokFindFilmstripItemByUuid(targetUuid);
                    }
                    if (!filmstripBtn) {
                        const filmItems = grokGetFilmstripItems();
                        if (targetPos.itemInGrpIndex >= 0 && targetPos.itemInGrpIndex < filmItems.length) {
                            filmstripBtn = filmItems[targetPos.itemInGrpIndex];
                        }
                    }

                    if (filmstripBtn) {
                        console.log('[MOSSAD] grokSpaNavigate: та же conversation → filmstrip click');
                        mossadDebug('nav', 'filmstrip click (та же conversation)', { target: targetUuid });
                        const navSeq = _galleryNav.seq;
                        filmstripBtn.click();
                        try { history.replaceState(null, '', path); } catch(e) {}
                        // До 6 проверок × 40 мс ждём смены UUID в URL, затем тик в любом случае
                        waitForCondition(() => {
                            const curUuid = grokExtractUuid(location.pathname);
                            return !!(curUuid && targetUuid && curUuid.toLowerCase() === targetUuid.toLowerCase());
                        }, 240, 40).then(() => {
                            // Если за это время начался другой (ручной) переход — его тик сделает он сам
                            if (navSeq !== _galleryNav.seq) {
                                mossadDebug('nav', 'тик пропущен: устаревший переход', { navSeq, cur: _galleryNav.seq });
                                return;
                            }
                            grokGallerySlideshowTick('spa-arrived');
                        });
                        return;
                    }
                }
            }
        } catch(e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // Другая conversation или нет filmstrip → полный переход по URL
        console.log('[MOSSAD] grokSpaNavigate: другая conversation → location.href', url);
        mossadDebug('nav', 'location.href (другая conversation)', { url });
        window.location.href = url;
    }

    // v1.3.38: ОДИН общий AudioContext на страницу (раньше — new AudioContext() на каждый круг без close():
    // контексты копились, каждый держал аудиопоток браузера → лаги до перезапуска браузера). ANTI_PATTERNS §17.
    let _circleAudioCtx = null;
    let _circleSoundLastAt = 0;
    const CIRCLE_SOUND_MIN_GAP_MS = 2000; // не чаще одного сигнала за 2 с

    function getCircleAudioCtx() {
        if (_circleAudioCtx && _circleAudioCtx.state !== 'closed') return _circleAudioCtx;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        _circleAudioCtx = new Ctor();
        return _circleAudioCtx;
    }

    /** Звуковой сигнал окончания круга (до-ми-соль) */
    function playCircleDoneSound() {
        const now = Date.now();
        if (now - _circleSoundLastAt < CIRCLE_SOUND_MIN_GAP_MS) return;
        _circleSoundLastAt = now;
        try {
            const ctx = getCircleAudioCtx();
            if (!ctx) return;
            if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                try { ctx.resume().catch(() => {}); } catch(e) {}
            }
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
                osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch(e) {} };
            });
        } catch(e) { /* AudioContext может быть заблокирован */ }
    }


    /** Запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }

        // Если уже стоим на элементе из коллекции — стартуем прямо с него!
        let startItem = null;
        const curPos = grokFindCurrentPosition(struct);
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
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) {
            showToast('⚠️ Коллекция не собрана', true);
            return;
        }

        // Немедленно останавливаем ВСЕ таймеры предыдущего слайда (включая отложенный запуск цикла,
        // v1.3.38) и перехватываем блокировку перехода: устаревшие автошаги не перебьют выбор.
        cancelSlideTimers();
        const prevSS = grokReadSS();

        const startBase = normUrlKey(startItem.url);
        const startGid = startItem.convId || '__noconv__';
        const startUuid = grokExtractUuid(startItem.url);

        // Ищем явную позицию стартового элемента в структуре
        let startGrpIdx = 0, startItemIdx = 0;
        for (let _g = 0; _g < struct.groups.length; _g++) {
            const _i = struct.groups[_g].items.findIndex(it =>
                normUrlKey(it.url) === startBase);
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
            visitedInCircle: [startBase],
            history: Array.isArray(prevSS.history) ? prevSS.history : []
        };
        grokHistoryPushInto(ss, startItem.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('pos', 'старт с выбранного элемента', { g: startGrpIdx, i: startItemIdx });
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
        grokTogglePlaylistPanel(true);
        grokHighlightActivePlaylistItem(startItem.url);

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);

        grokBeginNav(startItem.url, 'manual-pick', true);
        const navSeq = _galleryNav.seq;
        const curClean = normUrlKey(location.href);
        if (curClean === startBase) {
            grokGallerySlideshowTick('start-here');
        } else {
            setTimeout(() => {
                if (navSeq !== _galleryNav.seq) return; // успели выбрать другой элемент
                grokSpaNavigate(startItem.url);
            }, 150);
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
            setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            setSlideshowPaused(false);
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            showToast('▶ Продолжаем');
            requestSlideCycle(0, 'gallery-resume');
        }
    }

    /** Выполняет шаг к следующему слайду по логике плейлиста */
    function grokGalleryStepNext(source = 'auto') {
        // v1.3.38: автошаг не выполняется, пока предыдущий переход не завершился (см. grokBeginNav)
        if (grokNavInFlight()) {
            mossadDebug('nav', 'автошаг ОТКЛОНЁН: переход в полёте', { source, inFlightFrom: _galleryNav.source });
            return false;
        }
        if (_galleryNav.arrivedAt && Date.now() - _galleryNav.arrivedAt < GALLERY_MIN_DWELL_MS) {
            const elapsed = Date.now() - _galleryNav.arrivedAt;
            mossadDebug('nav', 'автошаг ОТКЛОНЁН: слишком рано после прибытия', { source, ms: elapsed });
            // triggerNextSlide уже отменил таймеры — перезапускаем цикл текущего слайда, иначе слайдшоу встанет
            requestSlideCycle(GALLERY_MIN_DWELL_MS - elapsed + 50, 'dwell-retry');
            return false;
        }
        const nextRes = grokGetNextSlideItem('auto');
        if (!nextRes || !nextRes.item) {
            mossadDebug('step', 'следующий элемент не найден', { source });
            return false;
        }
        if (!grokBeginNav(nextRes.item.url, 'auto:' + source)) return false;

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
        ss.targetUuid = grokExtractUuid(nextRes.item.url);
        grokHistoryPushInto(ss, nextRes.item.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('step', 'автошаг', { source, circle: !!nextRes.circleCompleted, target: ss.targetUuid });

        if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
        grokSpaNavigate(nextRes.item.url);
        return true;
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick(source = 'tick') {
        if (!isGrokPostPage()) return;
        // Прибыли на пост: переход завершён
        grokEndNav(source);
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;
        // Все старые таймеры предыдущего слайда — отменить (ровно один новый запуск цикла ниже)
        cancelSlideTimers();

        if (sessionStorage.getItem('mossad_navigating_group') === 'true') {
            sessionStorage.removeItem('mossad_navigating_group');
        }

        // Проверяем, стояло ли слайдшоу на паузе до перехода
        const isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                         (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        window._mossadGalleryPaused = isPaused;
        setSlideshowPaused(isPaused);

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


        const struct = grokGetPlaylistStructure();



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
        grokHighlightActivePlaylistItem(ss.targetUrl || null);

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = (stepSource) => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            grokGalleryStepNext(stepSource || 'next-fn');
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = isPaused;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        if (!isPaused) {
            requestSlideCycle(300, 'tick:' + source);
        }
    }

    // Фасад для явного контракта MOSSAD GALLERY
    window.MOSSAD_GALLERY = {
        isActive: () => !!window._mossadGalleryActive,
        isPaused: () => !!window._mossadGalleryPaused,
        next: () => {
            if (typeof window._mossadGalleryNextFn === 'function') {
                window._mossadGalleryNextFn('facade');
            }
        },
        pause: toggleGalleryPause,
        stop: grokStopGallerySlideshow,
        start: grokStartGallerySlideshow,
        highlightActive: (url) => (grokHighlightActivePlaylistItem(url)),
        togglePlaylist: (force) => (grokTogglePlaylistPanel(force))
    };
