    // ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null;

    function isSlideshowActiveOrPaused() {
        if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
        if (typeof slideshowPaused !== 'undefined' && slideshowPaused) return true;
        if (window._mossadGalleryActive || window._mossadGalleryPaused) return true;
        if (sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true') return true;
        if (sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true') return true;
        if (sessionStorage.getItem('mossad_gallery_paused') === 'true') return true;
        const rawSs = (typeof _gSS !== 'undefined' && _gSS.getItem)
            ? _gSS.getItem(GALLERY_SS_KEY)
            : sessionStorage.getItem('mossad_grok_gallery_ss');
        if (rawSs) {
            try {
                const ss = JSON.parse(rawSs);
                if (ss && ss.active) return true;
            } catch(e) {}
        }
        return false;
    }

    function _postPlayerNav(wasPaused) {
        if (wasPaused) {
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
            if (typeof updateGalleryStatusBtn === 'function') updateGalleryStatusBtn('paused');
            if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
            if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        } else {
            setTimeout(() => {
                if (slideshowActive && !slideshowPaused) {
                    if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
                }
            }, 300);
        }
    }

    function playerStepSlide(dir) {
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const rawCol = (typeof _gSS !== 'undefined' && _gSS.getItem)
                ? _gSS.getItem(GALLERY_COLLECTION_KEY)
                : sessionStorage.getItem('mossad_grok_collection');
            let colData = null;
            if (rawCol) { try { colData = JSON.parse(rawCol); } catch(e) {} }
            const items = colData?.items || [];

            const curId = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(location.pathname)
                : (location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1] ||
                   location.search.match(/[?&]post=([^&]+)/)?.[1]);

            const curIdx = (curId && items.length > 0)
                ? items.findIndex(it => (it.url || '').toLowerCase().includes(curId.toLowerCase()))
                : -1;

            if (curIdx === -1) {
                if (typeof grokStepFilmstrip === 'function' && grokStepFilmstrip(isFwd)) {
                    _postPlayerNav(wasPaused);
                    return;
                }
            } else {
                const loopItems = (typeof getGrokActiveLoopItems === 'function') ? getGrokActiveLoopItems(items) : [];
                let targetItem = null;
                let targetIdx = -1;

                if (loopItems.length > 0) {
                    const curLoopIdx = loopItems.findIndex(it => (it.url || '').toLowerCase().includes(curId.toLowerCase()));
                    let nextLoopIdx = 0;
                    if (curLoopIdx !== -1) {
                        nextLoopIdx = isFwd
                            ? (curLoopIdx + 1) % loopItems.length
                            : (curLoopIdx - 1 + loopItems.length) % loopItems.length;
                    }
                    targetItem = loopItems[nextLoopIdx];
                    targetIdx = items.indexOf(targetItem);
                } else {
                    const grpMode = colData.grpMode || 'seq';
                    const itemMode = colData.itemMode || 'fwd';
                    const isRandom = (grpMode === 'rnd' || itemMode === 'rnd' || config.slideshowMode === 'random');

                    if (isRandom) {
                        let hist = [];
                        try { hist = JSON.parse(sessionStorage.getItem('mossad_player_hist') || '[]'); } catch(e) {}
                        if (isFwd) {
                            hist.push(curIdx);
                            if (hist.length > 50) hist.shift();
                            sessionStorage.setItem('mossad_player_hist', JSON.stringify(hist));

                            let rnd = Math.floor(Math.random() * (items.length - 1));
                            if (rnd >= curIdx) rnd++;
                            targetIdx = rnd;
                        } else {
                            if (hist.length > 0) {
                                targetIdx = hist.pop();
                                sessionStorage.setItem('mossad_player_hist', JSON.stringify(hist));
                            } else {
                                targetIdx = (curIdx - 1 + items.length) % items.length;
                            }
                        }
                    } else if (itemMode === 'rev') {
                        targetIdx = isFwd ? (curIdx - 1) : (curIdx + 1);
                        if (targetIdx < 0) {
                            if (config.loopFeed || true) targetIdx = items.length - 1;
                            else { showToast('⚠️ Начало коллекции', true); return; }
                        } else if (targetIdx >= items.length) {
                            if (config.loopFeed || true) targetIdx = 0;
                            else { showToast('⚠️ Конец коллекции', true); return; }
                        }
                    } else {
                        targetIdx = isFwd ? (curIdx + 1) : (curIdx - 1);
                        if (targetIdx >= items.length) {
                            if (config.loopFeed || true) {
                                targetIdx = 0;
                                showToast('🔄 Новый круг коллекции');
                            } else {
                                showToast('⚠️ Конец коллекции', true);
                                return;
                            }
                        } else if (targetIdx < 0) {
                            if (config.loopFeed || true) {
                                targetIdx = items.length - 1;
                            } else {
                                showToast('⚠️ Начало коллекции', true);
                                return;
                            }
                        }
                    }
                    targetItem = items[targetIdx];
                }

                if (targetItem) {
                    const rawSs = (typeof _gSS !== 'undefined' && _gSS.getItem)
                        ? _gSS.getItem(GALLERY_SS_KEY)
                        : sessionStorage.getItem('mossad_grok_gallery_ss');
                    if (rawSs) {
                        try {
                            const ss = JSON.parse(rawSs);
                            if (targetIdx >= 0) {
                                ss.queue = [...items.slice(targetIdx + 1), ...items.slice(0, targetIdx)];
                                _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                            }
                        } catch(e) {}
                    }

                    if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                    const dispIdx = (targetIdx >= 0 ? targetIdx : curIdx) + 1;
                    showToast(`${isFwd ? '⏭' : '⏮'} ${dispIdx}/${items.length} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                    grokSpaNavigate(targetItem.url);
                    setTimeout(() => {
                        if (typeof grokHighlightActivePlaylistItem === 'function') {
                            grokHighlightActivePlaylistItem(targetItem.url);
                        }
                    }, 120);
                    _postPlayerNav(wasPaused);
                    return;
                }
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
            } else if (typeof redGifsNavigate === 'function') {
                redGifsNavigate(isFwd ? 'down' : 'up');
            }
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
        if (typeof triggerUniversalFullScreen === 'function') triggerUniversalFullScreen();
        _postPlayerNav(wasPaused);
    }

    // Ранний перехват клавиш слайдера (PageUp / PageDown) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) return;

        // Перехватываем ТОЛЬКО пока слайдшоу активно или на паузе. При STOP — не перехватываем!
        if (!isSlideshowActiveOrPaused()) return;

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    document.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) { if (!/^F\d+$/.test(e.key)) return; }

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            if (document.getElementById('mossad-hk-modal')) return;
            openHotkeySettings();
        }

        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            window.widgetState = (window.widgetState === 'hidden') ? 'bar' : 'hidden';
            window.updateWidgetUI();
        }

        if (hotkeyMatches(e, config.hk.slideshowStart)) {
            e.preventDefault();
            startSlideshow();
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
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            e.preventDefault();
            runSmartDelete();
        }

        if (hotkeyMatches(e, config.hk.sound)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                toggleGrokSound();
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

        if (hotkeyMatches(e, config.hk.playPause)) {
            e.preventDefault();
            const video = getActiveVideo();
            if (video) {
                if (video.paused) video.play();
                else video.pause();
                showToast(video.paused ? '▶ Проигрывание' : '⏸ Пауза');
            }
        }

        if (hotkeyMatches(e, config.hk.history) && rootDomain === 'grok.com') {
            e.preventDefault();
            window.location.href = 'https://grok.com/imagine/saved';
        }

        // Привязать виджет к левому верхнему краю
        if (hotkeyMatches(e, config.hk.snapWidget)) {
            e.preventDefault();
            if (typeof window.snapWidgetToCorner === 'function') {
                window.snapWidgetToCorner();
            }
        }

        // Обновить скрипт (Win+Alt+R) / Мотать в начало (Alt+R по умолчанию)
        if (hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R'))) {
            e.preventDefault();
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        } else if (hotkeyMatches(e, config.hk.rewind) && !e.metaKey) {
            e.preventDefault();
            doRewind();
        }

        // Дублирование страницы в фоновой вкладке + принудительный переход (Ctrl + Пробел)
        if (hotkeyMatches(e, config.hk.duplicateNext)) {
            e.preventDefault();
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(location.href, { active: false, insert: true });
                showToast('📑 Открыто во вкладке в фоне + Переход...');
            } else {
                window.open(location.href, '_blank');
                showToast('📑 Открыта вкладка + Переход...');
            }
            triggerNextSlide();
        }
    }, true);

    // Авто кликер FullScreen при старте страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', triggerUniversalFullScreen);
    } else {
        triggerUniversalFullScreen();
    }

    // Возобновление слайдшоу после перехода/перезагрузки страницы
    const _isPausedOnResume = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                              sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                              sessionStorage.getItem('mossad_gallery_paused') === 'true';

    if (slideshowActive) {
        if (!_isPausedOnResume) {
            showToast('▶ Слайдшоу возобновлено');
            setTimeout(() => {
                scheduleNextSlideCycle(0);
            }, 500);
        } else {
            showToast('⏸ Слайдшоу на паузе');
        }
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

