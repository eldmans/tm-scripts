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

    function getPinterestMainPinData() {
        try {
            // 1. Прямой осмотр DOM тегов видео главного пина (closeup-video-main, duplo-hls-video)
            const mainVideo = document.querySelector('video[elementtiming*="video"], video[data-test-id="duplo-hls-video"], video[src*="v1.pinimg.com"], video.jI_JN7');
            if (mainVideo) {
                const src = mainVideo.src || (mainVideo.querySelector('source') && mainVideo.querySelector('source').src) || '';
                const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
                let bestMp4Url = null;
                if (sigMatch) {
                    const sig = sigMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                } else if (src.endsWith('.mp4')) {
                    bestMp4Url = src;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            // 2. Сканирование разметки DOM на предмет v1.pinimg.com/videos/iht/hls/ или elementtiming="closeup-video-main"
            const fullHtml = document.documentElement.innerHTML || '';
            const hlsMatch = fullHtml.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/iht\\?\/hls\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{32})\.m3u8/i) ||
                             fullHtml.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i);

            if (hlsMatch || fullHtml.includes('elementtiming="closeup-video-main') || fullHtml.includes('data-test-id="duplo-hls-video"')) {
                let bestMp4Url = null;
                if (hlsMatch) {
                    const sig = hlsMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            const scanText = (txt) => {
                if (!txt || !txt.includes('auth_web_main_pin')) return null;
                const idx = txt.indexOf('resource_response');
                if (idx === -1) return null;
                
                // Берем с запасом 40000 символов, т.к. story_pin_data с видео-блоком лежит глубоко внизу JSON
                const slice = txt.slice(Math.max(0, idx - 500), idx + 40000);

                // 1. ПЕРВЫМ ДЕЛОМ ИЩЕМ СИГНАТУРЫ И БЛОКИ ВИДЕО
                const sigMatch = slice.match(/"video_signature"\s*:\s*"([a-f0-9]{32})"/i) ||
                                 slice.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 slice.match(/thumbnails\/originals\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\./i);

                const hasVideoKeywords = /story_pin_video_block/i.test(slice) || 
                                         /"video_list"\s*:\s*\{/i.test(slice) || 
                                         /"videos"\s*:\s*\{/i.test(slice) || 
                                         /duplo-hls/i.test(slice);

                if (sigMatch || hasVideoKeywords) {
                    let bestMp4Url = null;
                    const mp4Matches = slice.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+?\.mp4/g) ||
                                       slice.match(/https:\/\/v1\.pinimg\.com\/videos\/[^\s"',]+?\.mp4/g);
                    if (mp4Matches && mp4Matches.length > 0) {
                        bestMp4Url = mp4Matches[0].replace(/\\/g, '');
                    }
                    
                    if (!bestMp4Url && sigMatch) {
                        const sig = sigMatch[4] || sigMatch[1];
                        if (sig && sig.length === 32) {
                            bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                        }
                    }
                    return { isFound: true, type: 'video', bestMp4Url };
                }

                // 2. И ТОЛЬКО ЕСЛИ НИ ОДНОГО ПРИЗНАКА ВИДЕО НЕТ — ЭТО ФОТО
                if (/"images"\s*:\s*\{/i.test(slice) || /"image_signature"/i.test(slice)) {
                    return { isFound: true, type: 'image', bestMp4Url: null };
                }

                return null;
            };

            if (window.__PJS_OUTPUT__) {
                const res = scanText(JSON.stringify(window.__PJS_OUTPUT__));
                if (res) return res;
            }

            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const res = scanText(s.textContent || '');
                if (res) return res;
            }
        } catch (e) {
            console.error('[MOSSAD] PinResource JSON parse error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
    }

