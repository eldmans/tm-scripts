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
        if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const nextRes = (typeof grokGetNextSlideItem === 'function')
                ? grokGetNextSlideItem(isFwd ? 'down' : 'up')
                : null;
            if (nextRes && nextRes.item) {
                if (nextRes.circleCompleted) {
                    if (typeof playCircleDoneSound === 'function') playCircleDoneSound();
                    let ss = {};
                    try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
                    ss.circle = (ss.circle || 1) + 1;
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    showToast(`🔄 Круг ${ss.circle} начался!`);
                }
                const targetItem = nextRes.item;
                if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
                const curPos = (struct && typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct, targetItem.url) : null;
                const posStr = (curPos && curPos.flatIndex !== -1) ? ` ${curPos.flatIndex + 1}/${struct.items.length}` : '';
                showToast(`${isFwd ? '⏭' : '⏮'}${posStr} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                grokSpaNavigate(targetItem.url);
                setTimeout(() => {
                    if (typeof grokHighlightActivePlaylistItem === 'function') {
                        grokHighlightActivePlaylistItem(targetItem.url);
                    }
                }, 100);
                _postPlayerNav(wasPaused);
                return;
            }
            // Fallback если коллекция не собрана: навигация по киноплёнке (filmstrip)
            if (typeof grokStepFilmstrip === 'function' && grokStepFilmstrip(isFwd)) {
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

    // Ранний перехват клавиш слайдера (PageUp / PageDown, ArrowDown / ArrowUp) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) return;

        const isGrokPost = (rootDomain === 'grok.com' && isGrokPostPage());
        const hasGrokCollection = isGrokPost && !!_gSS.getItem(GALLERY_COLLECTION_KEY);

        // Перехват групп: config.hk.nextGroup (по умолчанию Alt+PageDown) / config.hk.prevGroup (по умолчанию Alt+PageUp)
        const isNextGrp = hotkeyMatches(e, config.hk.nextGroup);
        const isPrevGrp = hotkeyMatches(e, config.hk.prevGroup);
        if ((isNextGrp || isPrevGrp) && isGrokPost && hasGrokCollection) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
            const nextRes = (typeof grokGetNextSlideItem === 'function')
                ? grokGetNextSlideItem(isNextGrp ? 'next_grp' : 'prev_grp')
                : null;
            if (nextRes && nextRes.item) {
                if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
                showToast(`📁 Группа: ${isNextGrp ? '↓' : '↑'}`);
                grokSpaNavigate(nextRes.item.url);
                setTimeout(() => {
                    if (typeof grokHighlightActivePlaylistItem === 'function') {
                        grokHighlightActivePlaylistItem(nextRes.item.url);
                    }
                }, 100);
            }
            return;
        }

        // Перехватываем ТОЛЬКО пока слайдшоу активно/на паузе, либо на посте Grok с коллекцией
        if (!isSlideshowActiveOrPaused() && !hasGrokCollection) return;

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    window.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing && !/^F\d+$/.test(e.key) && !(e.ctrlKey || e.altKey || e.metaKey)) return;

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const existingModal = document.getElementById('mossad-hk-modal');
            if (existingModal) {
                existingModal.remove();
                return;
            }
            if (typeof openHotkeySettings === 'function') openHotkeySettings();
            return;
        }

        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            window.widgetState = (window.widgetState === 'hidden') ? 'bar' : 'hidden';
            window.updateWidgetUI();
            return;
        }

        // Большое слайдшоу (по плейлисту коллекции): Плей / Пауза (Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.galleryPlayPause)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                const active = window._mossadGalleryActive || (() => {
                    try { return !!(JSON.parse((typeof _gSS !== 'undefined' ? _gSS : sessionStorage).getItem(GALLERY_SS_KEY) || '{}').active); } catch { return false; }
                })();
                if (active) {
                    if (typeof toggleGalleryPause === 'function') toggleGalleryPause();
                } else {
                    if (typeof grokStartGallerySlideshow === 'function') grokStartGallerySlideshow();
                }
            } else {
                startSlideshow();
            }
            return;
        }

        // Стоп большого слайдшоу
        if (config.hk.galleryStop && hotkeyMatches(e, config.hk.galleryStop)) {
            e.preventDefault();
            if (rootDomain === 'grok.com' && typeof grokStopGallerySlideshow === 'function') {
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
            setTimeout(() => {
                scheduleNextSlideCycle(0);
            }, 500);
        } else {
            showToast('⏸ Слайдшоу на паузе');
        }
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

