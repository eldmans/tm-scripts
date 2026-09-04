    // ============================================
    // PINTEREST ENGINE & AUTO FULLSCALE
    // ============================================
    function clickElementFull(el) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
            try {
                el.dispatchEvent(new MouseEvent(evtType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                }));
            } catch (e) {}
        });
        if (typeof el.click === 'function') {
            try { el.click(); } catch(e) {}
        }
    }

    function triggerPinterestFullScale() {
        if (!rootDomain.includes('pinterest.') || !config.pinterestAutoFS) return;
        
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            let btn = document.querySelector('[aria-label="Показать в полном масштабе"], [title="Показать в полном масштабе"], [aria-label*="полном масштабе"]');
            if (!btn) {
                const svg = document.querySelector('svg[aria-label*="полном масштабе"]');
                if (svg) btn = svg.closest('[role="button"]') || svg.closest('button') || svg;
            }
            
            if (btn) {
                clickElementFull(btn);
                console.log('%c[MOSSAD] Auto FullScale clicked target element', 'color:#3b82f6;', btn);
                clearInterval(interval);
            } else if (attempts >= 25) { // Ожидание до 5 секунд (25 x 200ms)
                clearInterval(interval);
            }
        }, 200);
    }

    function getPinterestCandidatePins() {
        const currentPinId = (location.pathname.match(/\/pin\/(\d+)/) || [])[1];
        const allLinks = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
        const candidates = [];

        for (const a of allLinks) {
            const href = a.getAttribute('href') || '';
            const match = href.match(/\/pin\/(\d+)/);
            if (match) {
                const pinId = match[1];
                if (pinId !== currentPinId && !candidates.some(c => c.pinId === pinId)) {
                    const container = a.closest('div[data-grid-item], div[role="listitem"]') || a.parentElement || a;
                    const hasVideo = !!container.querySelector('video, [aria-label*="video"], [aria-label*="видео"], .SoundButton') ||
                                     /\d+:\d{2}/.test(container.textContent || '');
                    candidates.push({
                        pinId,
                        url: new URL(href, location.origin).href,
                        type: hasVideo ? 'video' : 'image',
                        element: a
                    });
                }
            }
        }
        return candidates;
    }

    function selectNextPinterestPin(direction, options = {}) {
        const isManual = options.isManual || false;
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        let idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;

        if (direction === 'prev') {
            if (idx > 0) {
                idx--;
                config.pinterestHistoryIdx = idx;
                Settings.save();
                showToast(`◀ Назад по истории (${idx + 1}/${config.pinterestHistory.length})`);
                window.location.href = config.pinterestHistory[idx];
                return;
            } else {
                showToast('⚠️ Вы в самом начале истории просмотров', true);
                return;
            }
        }

        // direction === 'next'
        // Если выбор сделан ВРУЧНУЮ и мы находимся НЕ на самой вершине стека: идем вперед по истории (как в Проводнике)
        if (isManual && idx >= 0 && idx < config.pinterestHistory.length - 1) {
            idx++;
            config.pinterestHistoryIdx = idx;
            Settings.save();
            showToast(`▶ Вперед по истории (${idx + 1}/${config.pinterestHistory.length})`);
            window.location.href = config.pinterestHistory[idx];
            return;
        }

        // Авто-слайдшоу ИЛИ ручной клик на вершине стека: генерируем НОВЫЙ слайд!
        if (config.pinterestHistory.length === 0 || config.pinterestHistory[config.pinterestHistory.length - 1] !== location.href) {
            config.pinterestHistory.push(location.href);
            if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
            config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
            Settings.save();
        }

        // Фоновый виртуальный скролл для гидратации React
        window.scrollBy({ top: 300, behavior: 'instant' });
        setTimeout(() => window.scrollBy({ top: -300, behavior: 'instant' }), 40);

        setTimeout(() => {
            let candidates = getPinterestCandidatePins();
            let filtered = [];
            const filterType = config.pinterestFilterType || 'ratio';

            if (filterType === 'image') {
                filtered = candidates.filter(c => c.type === 'image');
            } else if (filterType === 'video') {
                filtered = candidates.filter(c => c.type === 'video');
            } else if (filterType === 'ratio') {
                const photoPercent = config.pinterestPhotoPercent ?? 50;
                const roll = Math.random() * 100;
                const targetType = roll < photoPercent ? 'image' : 'video';
                filtered = candidates.filter(c => c.type === targetType);
                if (filtered.length === 0) {
                    filtered = candidates.filter(c => c.type === (targetType === 'image' ? 'video' : 'image'));
                }
            } else {
                filtered = candidates; // 'all'
            }

            // Случай когда у пина 0 ссылок: возврат назад по истории и вызов другого пина
            if (filtered.length === 0 && candidates.length === 0) {
                showToast('⚠️ На странице нет ссылок, переход назад...', true);
                if (config.pinterestHistory.length > 1 && idx > 0) {
                    idx--;
                    config.pinterestHistoryIdx = idx;
                    Settings.save();
                    window.location.href = config.pinterestHistory[idx];
                    return;
                }
                filtered = candidates;
            } else if (filtered.length === 0) {
                filtered = candidates;
            }

            const maxCandidates = filtered.slice(0, 30);
            let targetIndex = 0;
            const mode = config.pinterestMode || 'rand';

            if (mode === 'rand') {
                targetIndex = Math.floor(Math.random() * maxCandidates.length);
            } else if (mode === '+1') {
                window._pinSeqIndex = ((window._pinSeqIndex || 0) + 1) % maxCandidates.length;
                targetIndex = window._pinSeqIndex;
            } else {
                const num = parseInt(mode, 10) || 1;
                targetIndex = Math.min(Math.max(0, num - 1), maxCandidates.length - 1);
            }

            const target = maxCandidates[targetIndex];
            if (target) {
                // Запоминаем тип следующего контента в sessionStorage перед переходом
                sessionStorage.setItem('mossad_expected_type', target.type);

                // Если свернули на новый путь — усекаем историю впереди
                config.pinterestHistory = config.pinterestHistory.slice(0, (config.pinterestHistoryIdx ?? (config.pinterestHistory.length - 1)) + 1);
                config.pinterestHistory.push(target.url);
                if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
                config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
                Settings.save();

                showToast(`📌 Новый пин #${targetIndex + 1} (${target.type === 'video' ? '🎬 Видео' : '🖼 Фото'})`);
                window.location.href = target.url;
            } else {
                showToast('❌ Подходящий пин не найден', true);
            }
        }, 100);
    }

