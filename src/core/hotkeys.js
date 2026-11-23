    // v1.4.12/v1.4.35: «📺 Play in Window» — открыть видео в плавающем окне или новой вкладке
    let _mossadFloatWin = null;
    let _mossadFloatWinPollTimer = null;

    function _mossadSaveFloatGeometry(x, y, w, h) {
        if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') return;
        if (w < 150 || h < 100) return;
        let changed = false;
        if (config.floatWinLeft !== x) { config.floatWinLeft = x; changed = true; }
        if (config.floatWinTop !== y) { config.floatWinTop = y; changed = true; }
        if (config.floatWinWidth !== w) { config.floatWinWidth = w; changed = true; }
        if (config.floatWinHeight !== h) { config.floatWinHeight = h; changed = true; }
        if (changed) {
            if (typeof Settings !== 'undefined' && typeof Settings.setQuiet === 'function') {
                Settings.setQuiet('floatWinLeft', x);
                Settings.setQuiet('floatWinTop', y);
                Settings.setQuiet('floatWinWidth', w);
                Settings.setQuiet('floatWinHeight', h);
            } else if (typeof persistLocalConfig === 'function') {
                persistLocalConfig();
            }
            if (typeof scheduleSyncPush === 'function') {
                scheduleSyncPush();
            }
        }
    }

    function mossadPlayInWindow(opts = {}) {
        if (rootDomain === 'grok.com') {
            showToast('⚠️ На Grok прямое открытие видео в отдельной вкладке заблокировано сервером', true);
            return;
        }

        const activeVid = (typeof getActiveVideo === 'function' ? getActiveVideo() : null) || document.querySelector('video');
        const startTime = activeVid ? (activeVid.currentTime || 0) : 0;

        let videoUrl = '';
        try {
            if (typeof MossadEngineRegistry !== 'undefined') {
                const active = MossadEngineRegistry.getActiveEngine();
                if (active && typeof active.findMedia === 'function') {
                    const m = active.findMedia();
                    if (m && m.urls && m.urls[0] && !m.urls[0].startsWith('blob:')) videoUrl = m.urls[0];
                }
            }
            if (!videoUrl) {
                const engines = window.MOSSAD_ENGINES || {};
                for (const eng of [engines.faphouse, engines.xvideos, engines.redgifs, engines.huggingface, engines.instagram]) {
                    if (eng && typeof eng.isSupported === 'function' && eng.isSupported() && typeof eng.findMedia === 'function') {
                        const m = eng.findMedia();
                        if (m && m.urls && m.urls[0] && !m.urls[0].startsWith('blob:')) { videoUrl = m.urls[0]; break; }
                    }
                }
            }
        } catch (_) {}
        if (!videoUrl && activeVid) {
            const s = activeVid.currentSrc || activeVid.src || '';
            if (s && !s.startsWith('blob:')) videoUrl = s;
        }

        const mode = config.playInWindowMode || 'popup';
        const openUrl = videoUrl || location.href;

        // Если режим 'tab' (новая вкладка)
        if (mode === 'tab') {
            const label = videoUrl ? '📺 Видео открыто в новой вкладке' : '🗗 Страница открыта в новой вкладке';
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(openUrl, { active: true });
            } else {
                window.open(openUrl, '_blank');
            }
            showToast(label);
            return;
        }

        // Режим 'popup' (плавающее отдельное окно с запоминанием координат и ширины в ПЗУ и GIT)
        // Если окно уже открыто — просто активируем его
        if (_mossadFloatWin && !_mossadFloatWin.closed) {
            try {
                _mossadFloatWin.focus();
                showToast('📺 Плавающее окно уже открыто');
                return;
            } catch (_) {}
        }

        const w = Number(config.floatWinWidth) || 854;
        const h = Number(config.floatWinHeight) || 480;
        const x = Number(config.floatWinLeft) || 100;
        const y = Number(config.floatWinTop) || 100;
        const features = `width=${w},height=${h},left=${x},top=${y},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`;

        let popup = null;
        try {
            if (videoUrl) {
                // Открываем about:blank (same-origin, полный доступ к геометрии и событиям)
                popup = window.open('about:blank', 'mossad_player_window', features);
                if (popup) {
                    const doc = popup.document;
                    const pageTitle = (document.querySelector('h1, h2.page-title, .video-title') || {}).textContent || document.title || 'MOSSAD Floating Player';
                    const cleanTitle = pageTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    
                    doc.open();
                    doc.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${cleanTitle}</title>
    <style>
        html, body {
            margin: 0; padding: 0; width: 100%; height: 100%;
            background: #000; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
        }
        video {
            width: 100%; height: 100%; object-fit: contain; outline: none;
        }
    </style>
</head>
<body>
    <video id="mv" src="${videoUrl}" controls autoplay playsinline></video>
    <script>
        const v = document.getElementById('mv');
        if (${startTime} > 0) {
            try { v.currentTime = ${startTime}; } catch (_) {}
        }
        // Управление с клавиатуры внутри плавающего окна
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (v.paused) v.play(); else v.pause();
            } else if (e.code === 'ArrowRight') {
                v.currentTime = Math.min(v.duration || 1e6, v.currentTime + 5);
            } else if (e.code === 'ArrowLeft') {
                v.currentTime = Math.max(0, v.currentTime - 5);
            }
        });
    </script>
</body>
</html>`);
                    doc.close();
                }
            } else {
                popup = window.open(openUrl, 'mossad_player_window', features);
            }
        } catch (err) {
            console.warn('[MOSSAD] Popup error:', err);
        }

        if (!popup) {
            if (!opts.fromTabSwitch) {
                showToast('⚠️ Всплывающее окно заблокировано браузером. Разрешите всплывающие окна в адресной строке.', true);
            }
            return;
        }

        _mossadFloatWin = popup;

        // Приостанавливаем видео на исходной странице, чтобы звук не двоился
        if (activeVid && !activeVid.paused) {
            try {
                activeVid._mossadUserPaused = true;
                activeVid.pause();
            } catch (_) {}
        }

        // Отслеживание позиции и размеров плавающего окна для сохранения в ПЗУ и GIT
        const recordGeometry = () => {
            try {
                if (!popup || popup.closed) return;
                const curX = popup.screenX != null ? popup.screenX : popup.screenLeft;
                const curY = popup.screenY != null ? popup.screenY : popup.screenTop;
                const curW = popup.outerWidth;
                const curH = popup.outerHeight;
                if (typeof curX === 'number' && typeof curY === 'number' && curW > 100 && curH > 100) {
                    _mossadSaveFloatGeometry(curX, curY, curW, curH);
                }
            } catch (_) {}
        };

        try {
            popup.addEventListener('resize', recordGeometry);
            popup.addEventListener('beforeunload', recordGeometry);
            popup.addEventListener('pagehide', recordGeometry);
        } catch (_) {}

        if (_mossadFloatWinPollTimer) clearInterval(_mossadFloatWinPollTimer);
        _mossadFloatWinPollTimer = setInterval(() => {
            if (!popup || popup.closed) {
                clearInterval(_mossadFloatWinPollTimer);
                _mossadFloatWinPollTimer = null;
                _mossadFloatWin = null;
                return;
            }
            recordGeometry();
        }, 1500);

        showToast('📺 Открыто плавающее окно (позиция сохраняется в ПЗУ/GIT)');
    }

    /**
     * v1.4.13: Универсальный Большой режим плеера / Large Mode (T или L по умолчанию)
     * Поддерживает: xHamster (Large mode), xVideos / xv-ru (Double size), Faphouse,
     * а также автопоиск кнопки в тулбаре плеера и универсальный CSS-режим.
     */
    function mossadToggleLargePlayer() {
        let handled = false;

        // 0. Активный движок из реестра
        if (typeof MossadEngineRegistry !== 'undefined') {
            const active = MossadEngineRegistry.getActiveEngine();
            if (active && typeof active.toggleLargeMode === 'function') {
                handled = active.toggleLargeMode();
                if (handled) return handled;
            }
        }

        // 1. XVideos / XV-RU / XNXX
        if (window.MOSSAD_ENGINES?.xvideos?.isSupported()) {
            handled = window.MOSSAD_ENGINES.xvideos.toggleDoubleSize();
            if (handled) return handled;
        }

        // 2. xHamster (хомяки)
        if (window.MOSSAD_ENGINES?.xhamster?.isSupported()) {
            handled = window.MOSSAD_ENGINES.xhamster.toggleLargeMode();
            if (handled) return handled;
        }

        // 3. Faphouse
        if (window.MOSSAD_ENGINES?.faphouse?.isSupported() && typeof window.MOSSAD_ENGINES.faphouse.toggleLargeMode === 'function') {
            handled = window.MOSSAD_ENGINES.faphouse.toggleLargeMode();
            if (handled) return handled;
        }

        // 4. Поиск кнопки в плеере на любом сайте
        const v = (typeof getActiveVideo === 'function' ? getActiveVideo() : null) || document.querySelector('video');
        const container = v ? (v.closest('.video-player, .player-container, .player_wrap, .player, #player, .player-wrap, [data-player]') || v.parentElement) : document;
        const btns = Array.from(container.querySelectorAll('button, [role="button"], span.has-clickable-effect, a'));
        for (const b of btns) {
            const t = ((b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.className || '')).toLowerCase();
            if (/(?:large\s*mode|theater|theatre|double\s*size|wide\s*screen|wide\s*player|двойной\s*размер|театр|широк|крупн)/i.test(t) &&
                !/(?:full\s*-?screen|полноэкран|во весь экран)/i.test(t)) {
                b.click();
                handled = true;
                break;
            }
        }

        // 5. Универсальный CSS-фоллбэк
        if (!handled && v) {
            const pCont = v.closest('.video-player, .player-container, .player_wrap, .player, #player, .player-wrap, .video-container') || v.parentElement;
            if (pCont) {
                pCont.classList.toggle('mossad-large-player-active');
                if (!document.getElementById('mossad-large-player-style')) {
                    const st = document.createElement('style');
                    st.id = 'mossad-large-player-style';
                    st.textContent = `
                        .mossad-large-player-active {
                            width: 100vw !important;
                            max-width: 100vw !important;
                            margin-left: calc(-50vw + 50%) !important;
                            height: min(85vh, 56.25vw) !important;
                            z-index: 9999 !important;
                            position: relative !important;
                            transition: all 0.3s ease !important;
                        }
                        .mossad-large-player-active video {
                            width: 100% !important;
                            height: 100% !important;
                            object-fit: contain !important;
                        }
                    `;
                    document.head.appendChild(st);
                }
                const isLg = pCont.classList.contains('mossad-large-player-active');
                if (isLg) {
                    try { pCont.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
                }
                handled = true;
                setTimeout(() => {
                    showToast(isLg ? '🔲 Большой режим (Large Mode)' : '▫️ Обычный размер плеера');
                }, 50);
                return handled;
            }
        }

        setTimeout(() => {
            showToast(handled ? '🔲 Большой режим (Large Mode)' : '⚠️ Кнопка «Большой режим» (Large Mode) не найдена', !handled);
        }, 60);

        return handled;
    }

    /**
     * v1.4.23: Закрепление видеоплеера в углу экрана (Sticky Player / PiP)
     * Позволяет продолжать просмотр видео при скролле вниз для выбора похожих превью.
     */
    function mossadToggleStickyPlayer() {
        const v = (typeof getActiveVideo === 'function' ? getActiveVideo() : null) || document.querySelector('video');
        if (!v) {
            showToast('⚠️ Видеоплеер не найден на странице', true);
            return false;
        }

        const container = v.closest('#html5video_base, #video-player-bg, #player-container, .player-container, [data-role="player-container"], .player_wrap, .video-player, .player-holder, #player, [data-player]') || v;

        if (!document.getElementById('mossad-sticky-player-style')) {
            const st = document.createElement('style');
            st.id = 'mossad-sticky-player-style';
            st.textContent = `
                .mossad-sticky-player {
                    position: fixed !important;
                    top: 18px !important;
                    right: 18px !important;
                    width: 480px !important;
                    height: 270px !important;
                    max-width: 42vw !important;
                    max-height: 42vh !important;
                    z-index: 2147483640 !important;
                    box-shadow: 0 12px 36px rgba(0,0,0,0.85), 0 0 0 2px rgba(56, 189, 248, 0.5) !important;
                    border-radius: 10px !important;
                    overflow: hidden !important;
                    background: #000 !important;
                    transition: transform 0.2s ease, opacity 0.2s ease !important;
                }
                .mossad-sticky-player video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: contain !important;
                }
            `;
            (document.head || document.documentElement).appendChild(st);
        }

        const isSticky = container.classList.toggle('mossad-sticky-player');
        showToast(isSticky ? '📌 Видео закреплено в углу (Shift+V для сброса)' : '▫️ Видео возвращено на место');
        return true;
    }

    function mossadLargePlayerMatch(e) {
        const hk = config.hk && (config.hk.largePlayer || config.hk.xvDoubleSize);
        if (hk && hk.key) {
            if (hotkeyMatches(e, hk)) return true;
            if (!hk.ctrl && !hk.alt && !hk.shift && e.shiftKey && hotkeyMatches(e, Object.assign({}, hk, { shift: true }))) return true;
        }
        // Если хоткей дефолтный (key: 't' или не настроен) — поддерживаем и T, и L (Large Mode, буква L)
        const isDefaultHk = !hk || !hk.key || (hk.key.toLowerCase() === 't' && !hk.ctrl && !hk.alt);
        if (isDefaultHk && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (e.code === 'KeyT' || e.code === 'KeyL' ||
                e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е' ||
                e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
                return true;
            }
        }
        return false;
    }

    function mossadXvDoubleSizeMatch(e) {
        return mossadLargePlayerMatch(e);
    }

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
        if (typeof grokResetCycleState === 'function') grokResetCycleState();
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

    let _grokHomeWarnActive = false;
    let _grokHomeWarnTimer = null;
    let _grokArrowUpWarnActive = false;
    let _grokArrowUpWarnTimer = null;
    let _grokArrowDownWarnActive = false;
    let _grokArrowDownWarnTimer = null;

    /** v1.3.69 / v1.4.2: стрелка ↑/↓ в контроле длительности/соотношения композера Grok — хоткеи MOSSAD её не трогают. */
    function _mossadGrokCtlArrow(e) {
        if (e.__mossadGrokCtlArrow) return true;
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return false;
        if (rootDomain === 'grok.com') {
            if (typeof grokCycleWhere === 'function') {
                const where = grokCycleWhere();
                if (where === 'param' || where === 'mode') return true;
            }
            if (typeof grokComposerArrowCtl === 'function') {
                try { return !!grokComposerArrowCtl(e); } catch (err) { return false; }
            }
        }
        return false;
    }
    /** v1.3.72: хоткей из списка «работают даже в поле промпта» (config.promptHotkeys, через запятую). */
    function mossadPromptHotkeyPass(e) {
        if (!config.promptHotkeysOn || !config.hk) return false;
        return String(config.promptHotkeys || '').split(/[\s,;]+/).some(k => k && config.hk[k] && config.hk[k].key && hotkeyMatches(e, config.hk[k]));
    }
    // Ранний перехват клавиш слайдера (PageUp / PageDown, ArrowDown / ArrowUp) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        if (_mossadGrokCtlArrow(e)) return; // v1.3.69 / v1.4.2: ↑/↓ в длительности/соотношении композера Grok

        const activeEl = document.activeElement;
        const isEditing = isEditableElement(activeEl);
        const isPrompt = rootDomain === 'grok.com' && (isEditing || (typeof grokIsPromptInput === 'function' && grokIsPromptInput(activeEl)));

        // v1.4.2: Стрелки ↑/↓ в текстовом поле промпта Grok:
        // Если курсор в самом начале и нажали ↑ -> предупреждение -> повторное нажатие в течение 5 сек перелистывает слайд назад
        // Если курсор в самом конце и нажали ↓ -> предупреждение -> повторное нажатие в течение 5 сек перелистывает слайд вперёд
        if (isPrompt && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            if (e.key === 'ArrowUp') {
                if (isCaretAtStart(activeEl)) {
                    if (!_grokArrowUpWarnActive) {
                        _grokArrowUpWarnActive = true;
                        showToast('⚠️ Повторное нажатие ↑ перелистнёт слайд назад', false, 5000);
                        if (_grokArrowUpWarnTimer) clearTimeout(_grokArrowUpWarnTimer);
                        _grokArrowUpWarnTimer = setTimeout(() => { _grokArrowUpWarnActive = false; }, 5000);
                        return;
                    } else {
                        _grokArrowUpWarnActive = false;
                        if (_grokArrowUpWarnTimer) { clearTimeout(_grokArrowUpWarnTimer); _grokArrowUpWarnTimer = null; }
                        hideToast();
                        if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        cancelSlideTimers();
                        playerStepSlide('prev');
                        return;
                    }
                } else {
                    _grokArrowUpWarnActive = false;
                    return;
                }
            } else if (e.key === 'ArrowDown') {
                if (isCaretAtEnd(activeEl)) {
                    if (!_grokArrowDownWarnActive) {
                        _grokArrowDownWarnActive = true;
                        showToast('⚠️ Повторное нажатие ↓ перелистнёт слайд вперёд', false, 5000);
                        if (_grokArrowDownWarnTimer) clearTimeout(_grokArrowDownWarnTimer);
                        _grokArrowDownWarnTimer = setTimeout(() => { _grokArrowDownWarnActive = false; }, 5000);
                        return;
                    } else {
                        _grokArrowDownWarnActive = false;
                        if (_grokArrowDownWarnTimer) { clearTimeout(_grokArrowDownWarnTimer); _grokArrowDownWarnTimer = null; }
                        hideToast();
                        if (activeEl && typeof activeEl.blur === 'function') activeEl.blur();
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        cancelSlideTimers();
                        playerStepSlide('next');
                        return;
                    }
                } else {
                    _grokArrowDownWarnActive = false;
                    return;
                }
            }
        }

        // Сброс предупреждений при нажатии любой другой клавиши (игнорируя Shift, Control, Alt, Meta)
        const isModKey = ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key);
        if (!isModKey && e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Home') {
            if (_grokArrowUpWarnActive || _grokArrowDownWarnActive || _grokHomeWarnActive) {
                _grokArrowUpWarnActive = false;
                _grokArrowDownWarnActive = false;
                _grokHomeWarnActive = false;
                hideToast();
            }
        }

        if (isEditing && !mossadPromptHotkeyPass(e)) return;

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
        // v1.3.84: grokCycle ни при каких условиях не переходит в Saved
        if (config.hk && config.hk.grokCycle && hotkeyMatches(e, config.hk.grokCycle)) return;
        const isHomeKey = (e.key === 'Home' || e.code === 'Home') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
        const isHistoryHk = hotkeyMatches(e, config.hk.history) || isHomeKey;
        if (isHistoryHk && rootDomain === 'grok.com') {
            const isPrompt = (typeof grokIsPromptInput === 'function' && grokIsPromptInput(activeEl)) || isEditableElement(activeEl);
            if (isPrompt) {
                const textVal = ((activeEl.value !== undefined) ? String(activeEl.value) : (activeEl.textContent || '')).trim();
                // Если промпт полностью пустой — Home сразу срабатывает и переходит в Saved!
                if (textVal.length === 0) {
                    hideToast();
                    _grokHomeWarnActive = false;
                    if (_grokHomeWarnTimer) { clearTimeout(_grokHomeWarnTimer); _grokHomeWarnTimer = null; }
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (typeof grokNavigateToSaved === 'function') grokNavigateToSaved();
                    else window.location.href = 'https://grok.com/imagine/saved';
                    return;
                }

                // Промпт НЕ пустой:
                // Если мы ещё не в самом начале строки/текста — нативное нажатие Home перемещает каретку в начало строки
                if (!isCaretAtStart(activeEl)) {
                    _grokHomeWarnActive = false;
                    return;
                }

                // Каретка УЖЕ в самом начале непустого промпта:
                // Предупреждение о повторном нажатии в течение 5 секунд
                if (!_grokHomeWarnActive) {
                    _grokHomeWarnActive = true;
                    showToast('⚠️ Повторное нажатие Home в течение 5 сек перейдёт в Saved', false, 5000);
                    if (_grokHomeWarnTimer) clearTimeout(_grokHomeWarnTimer);
                    _grokHomeWarnTimer = setTimeout(() => {
                        _grokHomeWarnActive = false;
                    }, 5000);
                    // Первое нажатие НЕ переходит
                    return;
                } else {
                    // Повторное нажатие произошло в течение 5 секунд!
                    _grokHomeWarnActive = false;
                    if (_grokHomeWarnTimer) { clearTimeout(_grokHomeWarnTimer); _grokHomeWarnTimer = null; }
                    hideToast();
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (typeof grokNavigateToSaved === 'function') grokNavigateToSaved();
                    else window.location.href = 'https://grok.com/imagine/saved';
                    return;
                }
            }

            hideToast();
            _grokHomeWarnActive = false;
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

        if (isEditing && !/^F\d+$/.test(e.key) && !(e.ctrlKey || e.altKey || e.metaKey) && !mossadPromptHotkeyPass(e)) return;

        // v1.3.47: хоткеи слайдшоу (стоп, перемотка, дубль+слайд) без слайдшоу — не наши: отдаём сайту
        const ssKey = mossadMatchSlideshowHotkey(e);
        const isUpdateCombo = hotkeyMatches(e, config.hk.updateScript);
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

        // v1.4.13: 🔲 Большой режим плеера / Large Mode (T или L по умолчанию — xHamster, XVideos, Faphouse и др.)
        if (mossadLargePlayerMatch(e)) {
            e.preventDefault();
            mossadToggleLargePlayer();
            return;
        }

        // v1.3.79: ⛶ Развернуть / полный экран (F по умолчанию; Shift не важен) — все сайты
        if (mossadExpandHotkeyMatch(e)) {
            e.preventDefault();
            mossadToggleExpand();
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

        // v1.4.12: «📺 Play in Window» — открыть видео в отдельной вкладке
        if (config.hk.playInWindow && config.hk.playInWindow.key && hotkeyMatches(e, config.hk.playInWindow)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            mossadPlayInWindow();
            return;
        }

        // v1.4.23: «📌 Sticky Player» — закрепить видео в углу (Shift+V)
        if (config.hk.stickyPlayer && hotkeyMatches(e, config.hk.stickyPlayer)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            mossadToggleStickyPlayer();
            return;
        }

        // Привязать виджет к левому верхнему краю
        if (hotkeyMatches(e, config.hk.snapWidget)) {
            e.preventDefault();
            if (typeof window.snapWidgetToCorner === 'function') {
                window.snapWidgetToCorner();
            }
        }

        // Обновить скрипт (Ctrl+Shift+F5 по умолчанию, проверка и ожидание в фоне) / Мотать в начало (Alt+R)
        if (hotkeyMatches(e, config.hk.updateScript)) {
            e.preventDefault();
            if (typeof window.mossadCheckOrWaitUpdate === 'function') {
                window.mossadCheckOrWaitUpdate();
            } else {
                const updateUrl = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js?t=' + Date.now();
                if (typeof GM_openInTab === 'function') {
                    GM_openInTab(updateUrl, { active: true, insert: true });
                } else {
                    window.open(updateUrl, '_blank');
                }
            }
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

    // v1.4.35: авто-открытие плавающего окна при переключении на другую вкладку
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && config.floatOnTabSwitch) {
            if (_mossadFloatWin && !_mossadFloatWin.closed) return;
            const v = (typeof getActiveVideo === 'function' ? getActiveVideo() : null) || document.querySelector('video');
            if (v && !v.paused && !v.ended && v.readyState >= 2) {
                mossadPlayInWindow({ fromTabSwitch: true });
            }
        }
    });

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

    // v1.4.18: Инициализация активного платформенного движка через реестр (On-Demand)
    if (typeof MossadEngineRegistry !== 'undefined') {
        MossadEngineRegistry.initActiveEngine();
    }

    setTimeout(() => {
        try {
            if (typeof GM_getValue === 'function') {
                const pendD = GM_getValue('mossad_wizard_pending_' + rootDomain, false) ||
                              GM_getValue('mossad_wizard_pending_' + hostname, false);
                if (pendD) {
                    try {
                        GM_setValue('mossad_wizard_pending_' + rootDomain, false);
                        GM_setValue('mossad_wizard_pending_' + hostname, false);
                    } catch (e1) {}
                    if (typeof mossadOpenSiteWizard === 'function') {
                        mossadOpenSiteWizard(hostname);
                    }
                }
            }
        } catch (e) {}
    }, 900);

