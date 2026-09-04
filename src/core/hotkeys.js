    // ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null; 
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
            window.widgetState = window.widgetState === 'hidden' ? 'panel' : 'hidden';
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
            // После скачивания — перейти +1 если выбрано
            if (config.pdAction === 'up') {
                setTimeout(() => {
                    const dirs = config.slideshowDirections;
                    const key = getArrowKey(dirs && dirs.length ? dirs[0] : 'up');
                    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                }, 600);
            } else if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                setTimeout(() => runSmartDelete(), 1000);
            }
        }
        
        if (hotkeyMatches(e, config.hk.deleteVid)) {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            e.preventDefault();
            runSmartDelete();
        }

        if (hotkeyMatches(e, config.hk.sound)) {
            e.preventDefault();
            const video = getActiveVideo();
            if (video) video.muted = !video.muted;
            // Специфично для RedGifs
            if (rootDomain.includes('redgifs.com')) {
                const btn = document.querySelector('button.SoundButton');
                if (btn) btn.click();
            }
            showToast(video && video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
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

        // Alt+R: перемотка (Win+Alt+R: обновить скрипт)
        if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
            e.preventDefault();
            if (e.metaKey) {
                window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
            } else {
                doRewind();
            }
        }

        // Принудительный следующий слайд (Пробел)
        if (hotkeyMatches(e, config.hk.nextSlide)) {
            if (slideshowActive) {
                e.preventDefault();
                showToast('⏭ Принудительный переход...');
                triggerNextSlide();
            }
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

        // Ручная навигация стрелками на Pinterest (влево/вверх = назад, вправо/вниз = вперед)
        if (rootDomain.includes('pinterest.')) {
            if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                selectNextPinterestPin('next');
            } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                selectNextPinterestPin('prev');
            }
        }
    }, true);

    // Авто кликер FullScale для Pinterest
    if (rootDomain.includes('pinterest.')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', triggerPinterestFullScale);
        } else {
            triggerPinterestFullScale();
        }
    }

    // Возобновление слайдшоу после перехода/перезагрузки страницы
    if (slideshowActive) {
        showToast('▶ Слайдшоу возобновлено');
        setTimeout(() => {
            scheduleNextSlideCycle(0);
        }, 500);
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

