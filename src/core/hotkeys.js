    // ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null;

    // ── v1.3.43: «мост раскладки» для СОБСТВЕННЫХ сочетаний Grok (Ctrl+B — свернуть боковую панель, Ctrl+/) ──
    // Это не хоткеи MOSSAD: их обрабатывает сам сайт и сравнивает e.key ('b', '/'). В русской раскладке
    // e.key === 'и' (KeyB) и '.' (Slash) — сайт их не узнаёт. Ловим такое нажатие раньше всех (window, capture),
    // гасим оригинал и отправляем копию с латинским e.key и тем же e.code/модификаторами. Если сайт отменил
    // копию (preventDefault) — отменяем и оригинал (чтобы, например, Firefox не открыл панель закладок).
    // Только белый список клавиш: Ctrl+C/V/X/A/Z и т.п. в полях ввода не трогаем (у копии нет действия по умолчанию).
    const GROK_LAYOUT_BRIDGE_CODES = ['KeyB', 'Slash'];
    window.addEventListener('keydown', function grokLayoutBridge(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        if (e.__mossadLayoutBridge || !(e.ctrlKey || e.metaKey) || e.altKey) return;
        if (!GROK_LAYOUT_BRIDGE_CODES.includes(e.code)) return;
        const us = mossadUsKeyForCode(e.code);
        if (!us || e.key === us || e.key === mossadUsKeyForCode(e.code, true)) return; // латинская раскладка — сайт справится сам
        const key = mossadUsKeyForCode(e.code, e.shiftKey);
        let copy;
        try {
            copy = new KeyboardEvent('keydown', {
                key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: false,
                repeat: e.repeat, bubbles: true, cancelable: true, composed: true
            });
            Object.defineProperty(copy, '__mossadLayoutBridge', { value: true });
            // Старые обработчики смотрят keyCode/which (у копии они 0)
            const kc = /^Key[A-Z]$/.test(e.code) ? e.code.charCodeAt(3) : (e.keyCode || 0);
            Object.defineProperty(copy, 'keyCode', { get: () => kc });
            Object.defineProperty(copy, 'which', { get: () => kc });
        } catch (err) { return; }
        e.stopImmediatePropagation();
        const target = (e.target && e.target.dispatchEvent) ? e.target : document;
        mossadDebug('hotkey', 'мост раскладки: сочетание сайта', { code: e.code, key: e.key, as: key });
        const notCancelled = target.dispatchEvent(copy);
        if (!notCancelled) e.preventDefault();
    }, true);

    function isSlideshowActiveOrPaused() {
        if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
        if (typeof slideshowPaused !== 'undefined' && slideshowPaused) return true;
        if (window._mossadGalleryActive || window._mossadGalleryPaused) return true;
        if (sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true') return true;
        if (sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true') return true;
        if (sessionStorage.getItem('mossad_gallery_paused') === 'true') return true;
        // GALLERY_SS_KEY = 'mossad_grok_imagine_ss' (constants.js). Старый фолбэк читал
        // несуществующий ключ 'mossad_grok_gallery_ss' — убран (v1.3.33).
        const rawSs = _gSS.getItem(GALLERY_SS_KEY);
        if (rawSs) {
            try {
                const ss = JSON.parse(rawSs);
                if (ss && ss.active) return true;
            } catch(e) {}
        }
        return false;
    }

    /**
     * v1.3.47: ЕДИНЫЙ шлюз хоткеев слайдшоу. Шаг вперёд/назад, смена группы (Gr/Md), стоп, перемотка в начало,
     * «дубль + слайд» работают ТОЛЬКО пока слайдшоу (большое или малое) идёт или стоит на паузе.
     * После «Стоп» нажатие проходит сайту нетронутым (без preventDefault) — у Grok свои ←/→.
     * Не входят: запуск (Insert / Shift+Insert), окно настроек, меню, звук, пауза видео, скачать,
     * улучшить, удалить, Home, привязка виджета.
     */
    const SLIDESHOW_ONLY_HOTKEYS = ['nextSlide', 'prevSlide', 'nextGroup', 'prevGroup', 'galleryStop', 'rewind', 'duplicateNext'];
    function mossadSlideshowHotkeysEnabled() {
        return isSlideshowActiveOrPaused();
    }
    /** Какой хоткей слайдшоу совпал с нажатием (или null). */
    function mossadMatchSlideshowHotkey(e) {
        for (const k of SLIDESHOW_ONLY_HOTKEYS) {
            const hk = config.hk && config.hk[k];
            if (hk && hotkeyMatches(e, hk)) return k;
        }
        return null;
    }

    function _postPlayerNav(wasPaused) {
        if (wasPaused) {
            setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
            updateGalleryStatusBtn('paused');
            if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
            if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        } else {
            requestSlideCycle(300, 'manual-step');
        }
    }

    function playerStepSlide(dir) {
        cancelSlideTimers();
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const nextRes = grokGetNextSlideItem(isFwd ? 'down' : 'up');
            if (nextRes && nextRes.item) {
                if (nextRes.circleCompleted) {
                    playCircleDoneSound();
                    let ss = {};
                    try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
                    ss.circle = (ss.circle || 1) + 1;
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    showToast(`🔄 Круг ${ss.circle} начался!`);
                }
                const targetItem = nextRes.item;
                // v1.3.38: ручной шаг перехватывает блокировку и явно фиксирует позицию (+история)
                grokBeginNav(targetItem.url, 'manual:' + dir, true);
                grokSyncSlidePosition(targetItem, { source: 'manual:' + dir });
                if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда
                const struct = grokGetPlaylistStructure();
                const curPos = (struct) ? grokFindCurrentPosition(struct, targetItem.url) : null;
                const posStr = (curPos && curPos.flatIndex !== -1) ? ` ${curPos.flatIndex + 1}/${struct.items.length}` : '';
                showToast(`${isFwd ? '⏭' : '⏮'}${posStr} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                grokSpaNavigate(targetItem.url);
                setTimeout(() => {
                    grokHighlightActivePlaylistItem(targetItem.url);
                }, 100);
                _postPlayerNav(wasPaused);
                return;
            }
            // Fallback если коллекция не собрана: навигация по киноплёнке (filmstrip)
            if (grokStepFilmstrip(isFwd)) {
                _postPlayerNav(wasPaused);
                return;
            }
        }

        // 2. PINTEREST ENGINE
        if (rootDomain.includes('pinterest.')) {
            selectNextPinterestPin(dir, { isManual: true });
            _postPlayerNav(wasPaused);
            return;
        }

        // 3. REDGIFS ENGINE
        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
                window.MOSSAD_ENGINES.redgifs.navigate(isFwd ? 'down' : 'up');
            } else redGifsNavigate(isFwd ? 'down' : 'up');
            _postPlayerNav(wasPaused);
            return;
        }

        // 4. ДРУГИЕ САЙТЫ (универсальный переход ленты)
        const dirs = config.slideshowDirections;
        const mainDir = (dirs && dirs.length) ? dirs[0] : 'down';
        const getOppKey = (d) => {
            if (d === 'up') return 'ArrowDown';
            if (d === 'down') return 'ArrowUp';
            if (d === 'left') return 'ArrowRight';
            return 'ArrowLeft';
        };
        const keyToPress = isFwd ? getArrowKey(mainDir) : getOppKey(mainDir);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: keyToPress, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: keyToPress, bubbles: true }));
        triggerUniversalFullScreen();
        _postPlayerNav(wasPaused);
    }

    // v1.3.41: Insert (большое слайдшоу) на Grok ловим на window в фазе capture — раньше сайта.
    // Раньше обработчик стоял в фазе bubble и проверял «залипший» GALLERY_SS_KEY.active:
    // на /imagine/saved после прошлого слайдшоу первое нажатие уходило в toggleGalleryPause(),
    // которая сразу выходила (слайдшоу на самом деле не идёт) — нажатие «терялось».
    function grokGalleryPlayPauseKey(e) {
        if (window.capturingFor !== null || rootDomain !== 'grok.com') return;
        if (!hotkeyMatches(e, config.hk.galleryPlayPause)) return;
        // В поле ввода Insert ничего не печатает — пропускаем только «печатающие» клавиши
        const typingKey = typeof e.key === 'string' && e.key.length === 1 && !(e.ctrlKey || e.altKey || e.metaKey);
        if (typingKey && isEditableElement(document.activeElement)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        grokHandleGalleryPlayPause('hotkey');
    }
    window.addEventListener('keydown', grokGalleryPlayPauseKey, true);

    // Снятие залипшего фокуса с текстовых полей при клике в медиа/фон/элементы вне полей ввода
    window.addEventListener('pointerdown', function (e) {
        if (!e.target) return;
        const isInput = !!e.target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
        if (!isInput && document.activeElement) {
            const el = document.activeElement;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('role') === 'textbox' || !!el.closest('input, textarea, [contenteditable="true"], [role="textbox"]')) {
                try { el.blur(); } catch (err) {}
            }
        }
    }, true);

    /** v1.3.69: стрелка ↑/↓ в контроле длительности/соотношения композера Grok — хоткеи MOSSAD её не трогают. */
    function _mossadGrokCtlArrow(e) {
        if (e.__mossadGrokCtlArrow) return true;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
        try { return typeof grokComposerArrowCtl === 'function' && !!grokComposerArrowCtl(e); } catch (err) { return false; }
    }
    // Ранний перехват клавиш слайдера (PageUp / PageDown, ArrowDown / ArrowUp) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        if (_mossadGrokCtlArrow(e)) return; // v1.3.69: ↑/↓ в длительности/соотношении композера Grok
        if (isEditableElement(document.activeElement)) return;

        // v1.3.47: раньше стрелки и Alt+PageDown/Up перехватывались и без слайдшоу — достаточно было
        // коллекции в sessionStorage и страницы поста (hasGrokCollection). После «Стоп» коллекция остаётся,
        // поэтому ←/→ продолжали листать слайды. Теперь — только при идущем/приостановленном слайдшоу.
        if (!mossadSlideshowHotkeysEnabled()) return;
        const isGrokPost = (rootDomain === 'grok.com' && isGrokPostPage());
        const hasGrokCollection = isGrokPost && !!_gSS.getItem(GALLERY_COLLECTION_KEY);

        // Перехват групп: config.hk.nextGroup (по умолчанию Alt+PageDown) / config.hk.prevGroup (по умолчанию Alt+PageUp)
        const isNextGrp = hotkeyMatches(e, config.hk.nextGroup);
        const isPrevGrp = hotkeyMatches(e, config.hk.prevGroup);
        if ((isNextGrp || isPrevGrp) && isGrokPost && hasGrokCollection) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelSlideTimers();
            const nextRes = grokGetNextSlideItem(isNextGrp ? 'next_grp' : 'prev_grp');
            if (nextRes && nextRes.item) {
                grokBeginNav(nextRes.item.url, isNextGrp ? 'manual:next_grp' : 'manual:prev_grp', true);
                grokSyncSlidePosition(nextRes.item, { source: 'manual:grp' });
                if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
                else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда
                showToast(`📁 Группа: ${isNextGrp ? '↓' : '↑'}`);
                grokSpaNavigate(nextRes.item.url);
                setTimeout(() => {
                    grokHighlightActivePlaylistItem(nextRes.item.url);
                }, 100);
            }
            return;
        }

        // Шлюз уже пройден выше (слайдшоу идёт или на паузе)

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelSlideTimers();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    window.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;
        if (_mossadGrokCtlArrow(e)) return; // v1.3.69

        const activeEl = document.activeElement;
        const isEditing = isEditableElement(activeEl);
        // v1.3.59: Pinterest — фокус на плитке пина (режим «Фокус» или Tab): Пробел/Enter без модификаторов — сайту
        // (открыть пин), даже если на них назначен хоткей MOSSAD.
        if (rootDomain.includes('pinterest.') && (e.key === ' ' || e.key === 'Enter') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey &&
            activeEl && activeEl.closest && activeEl.closest('[data-grid-item]')) return;

        // 0. Универсальный запуск генерации / отправка промпта (Ctrl+Enter) для Hugging Face и Grok
        // Срабатывает в любом месте страницы, включая текстовые поля ввода и настройки
        if (config.hk.generate && hotkeyMatches(e, config.hk.generate)) {
            if (window.MOSSAD_ENGINES?.huggingface?.isSupported()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                window.MOSSAD_ENGINES.huggingface.triggerGenerate();
                return;
            }
            if (rootDomain === 'grok.com') {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (typeof triggerGrokSubmit === 'function') {
                    triggerGrokSubmit();
                }
                return;
            }
        }

        // 1. Навигация Home / Saved Grok (срабатывает из любого места grok.com)
        const isHomeKey = (e.key === 'Home' || e.code === 'Home') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
        const isHistoryHk = hotkeyMatches(e, config.hk.history) || isHomeKey;
        if (isHistoryHk && rootDomain === 'grok.com') {
            if (isEditing) {
                const textVal = (activeEl.value !== undefined) ? String(activeEl.value) : (activeEl.textContent || '');
                // Если это штатный Home (без модификаторов) и в поле есть введенный текст — сохраняем нативное поведение перемещения курсора в начало строки
                if (isHomeKey && textVal.trim().length > 0) {
                    return;
                }
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof grokNavigateToSaved === 'function') {
                grokNavigateToSaved();
            } else {
                if (location.pathname !== '/imagine/saved') {
                    window.location.href = 'https://grok.com/imagine/saved';
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            return;
        }

        if (isEditing && !/^F\d+$/.test(e.key) && !(e.ctrlKey || e.altKey || e.metaKey)) return;

        // v1.3.47: хоткеи слайдшоу (стоп, перемотка, дубль+слайд) без слайдшоу — не наши: отдаём сайту
        const ssKey = mossadMatchSlideshowHotkey(e);
        const isUpdateCombo = hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR'));
        if (ssKey && !isUpdateCombo && !mossadSlideshowHotkeysEnabled()) {
            // …кроме сочетаний, которые одновременно назначены на «не-слайдшоу» действие
            const other = ['help', 'slideshowPanel', 'galleryPlayPause', 'slideshowStart', 'download', 'upscale', 'deleteVid', 'sound', 'playPause', 'snapWidget', 'history']
                .some(k => config.hk[k] && hotkeyMatches(e, config.hk[k]));
            if (!other) { mossadDebug('hotkey', 'хоткей слайдшоу без слайдшоу — пропущен сайту', { hk: ssKey }); return; }
        }

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // Ctrl+F1 (и любые переназначенные слоты help): открыть/закрыть окно настроек.
            // Если окно открыто — закрыть с сохранением (с любой вкладки), как раньше.
            if (document.getElementById('mossad-hk-modal')) { closeSettingsWindow(true); return; }
            openSettingsWindow(); // v1.3.45: последняя открытая вкладка
            return;
        }

        // v1.3.49: «📝 Тудушки» (по умолчанию не назначено): открыть окно настроек сразу на этой вкладке / закрыть
        if (config.hk.openTodos && config.hk.openTodos.key && hotkeyMatches(e, config.hk.openTodos)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            toggleSettingsWindow('todos');
            return;
        }

        // Новая 3-позиционная логика переключения по Ctrl+Insert (циклическое переключение):
        // 1-е нажатие: Открывается полное меню (все 3 блока/строки, включая панель настроек снизу)
        // 2-е нажатие: Сворачивается до сокращённого меню (только 2 верхние строки)
        // 3-е нажатие: Меню полностью скрывается с экрана (режим click-through)
        // Следующее нажатие: Снова открывает полное меню (цикл заново)
        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof window.cycleWidgetMenuState === 'function') {
                window.cycleWidgetMenuState();
            } else {
                if (window.widgetState === 'hidden') window.widgetState = 'panel';
                else if (window.widgetState === 'panel') window.widgetState = 'bar';
                else window.widgetState = 'hidden';
                if (typeof window.updateWidgetUI === 'function') window.updateWidgetUI();
            }
            return;
        }

        // Большое слайдшоу (по плейлисту коллекции): Плей / Пауза (Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.galleryPlayPause)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                grokHandleGalleryPlayPause('hotkey-bubble'); // обычно уже обработано в capture (см. выше)
            } else {
                startSlideshow();
            }
            return;
        }

        // Стоп большого слайдшоу
        if (config.hk.galleryStop && hotkeyMatches(e, config.hk.galleryStop) && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                grokStopGallerySlideshow();
            }
            stopSlideshow();
            return;
        }

        // Малое слайдшоу (внутри группы / ракета: Shift+Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.slideshowStart)) {
            e.preventDefault();
            startSlideshow();
            return;
        }

        if (hotkeyMatches(e, config.hk.download)) {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            e.preventDefault();
            triggerDownload();
        }

        if (hotkeyMatches(e, config.hk.upscale)) {
            if (rootDomain === 'grok.com' && isGrokPostPage()) {
                e.preventDefault();
                runGrokUpscale();
            }
        }
        
        if (hotkeyMatches(e, config.hk.deleteVid)) {
            // v1.3.50: гасим Delete только там, где MOSSAD его обрабатывает (пост Grok); на остальных
            // сайтах клавиша остаётся сайту (runSmartDelete там ничего не делает — ANTI_PATTERNS §26, §29)
            if (rootDomain === 'grok.com' && isGrokPostPage()) {
                e.preventDefault();
                runSmartDelete();
            }
        }

        if (hotkeyMatches(e, config.hk.sound)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                toggleGrokSound();
            } else if (rootDomain.includes('pinterest.')) {
                pinterestToggleSound(); // v1.3.62: видео оверлея/полного экрана, кнопка плеера, тост и в полном экране
            } else {
                const video = getActiveVideo();
                if (video) video.muted = !video.muted;
                // Специфично для RedGifs
                if (rootDomain.includes('redgifs.com')) {
                    const btn = document.querySelector('button.SoundButton');
                    if (btn) btn.click();
                }
                showToast(video && video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
            }
        }

        // v1.3.63: Pinterest — ⛶ «Показать в полном масштабе» главного пина (по умолчанию не назначено)
        if (rootDomain.includes('pinterest.') && config.hk.pinFullScale && config.hk.pinFullScale.key && hotkeyMatches(e, config.hk.pinFullScale)) {
            e.preventDefault();
            const fsBtn = pinterestFindFullScaleButton();
            if (fsBtn) clickElementFull(fsBtn); else showToast('⚠️ Кнопка «Показать в полном масштабе» не найдена', true);
            return;
        }

        if (hotkeyMatches(e, config.hk.playPause)) {
            e.preventDefault();
            const video = getActiveVideo();
            if (video) {
                // v1.3.43: пауза пользователя — сторож «замёрзшего» видео её не снимает
                if (video.paused) { video._mossadUserPaused = false; video.play(); }
                else { video._mossadUserPaused = true; video.pause(); }
                showToast(video.paused ? '▶ Проигрывание' : '⏸ Пауза');
            }
        }

        // Привязать виджет к левому верхнему краю
        if (hotkeyMatches(e, config.hk.snapWidget)) {
            e.preventDefault();
            if (typeof window.snapWidgetToCorner === 'function') {
                window.snapWidgetToCorner();
            }
        }

        // Обновить скрипт (Win+Alt+R) / Мотать в начало (Alt+R по умолчанию)
        if (hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR'))) {
            e.preventDefault();
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        } else if (hotkeyMatches(e, config.hk.rewind) && !e.metaKey && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            doRewind();
        }

        // Дублирование страницы в фоновой вкладке + принудительный переход (Ctrl + Пробел)
        if (hotkeyMatches(e, config.hk.duplicateNext) && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(location.href, { active: false, insert: true });
                showToast('📑 Открыто во вкладке в фоне + Переход...');
            } else {
                window.open(location.href, '_blank');
                showToast('📑 Открыта вкладка + Переход...');
            }
            triggerNextSlide('hotkey:duplicateNext');
        }
    }, true);

    // Авто кликер FullScreen при старте страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', triggerUniversalFullScreen);
    } else {
        triggerUniversalFullScreen();
    }

    // Возобновление слайдшоу после перехода/перезагрузки страницы
    if (sessionStorage.getItem('mossad_navigating') === 'true') {
        sessionStorage.removeItem('mossad_navigating');
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
        if (typeof setSlideshowPaused === 'function') setSlideshowPaused(false);
        else slideshowPaused = false;
    }

    const _isPausedOnResume = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                              sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                              sessionStorage.getItem('mossad_gallery_paused') === 'true';

    if (slideshowActive) {
        if (!_isPausedOnResume) {
            showToast('▶ Слайдшоу возобновлено');
            requestSlideCycle(500, 'page-resume');
        } else {
            showToast('⏸ Слайдшоу на паузе');
        }
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

