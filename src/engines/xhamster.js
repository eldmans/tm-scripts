    // ============================================
    // XHAMSTER ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.xhamster = (() => {
        function isSupported() {
            return /(?:xhamster\d*|xh\d*)\.(?:com|desi|one|red|tube|gold)/i.test(rootDomain) ||
                   /(?:xhamster|xh\d*)/i.test(location.hostname);
        }

        /**
         * Переключение Большого режима / Large Mode (Theater mode) на xHamster
         */
        function toggleLargeMode() {
            let handled = false;

            // 1. Через API плеера (unsafeWindow)
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (uWin.player && typeof uWin.player.toggleTheaterMode === 'function') {
                    uWin.player.toggleTheaterMode();
                    handled = true;
                } else if (uWin.xhPlayer && typeof uWin.xhPlayer.toggleSize === 'function') {
                    uWin.xhPlayer.toggleSize();
                    handled = true;
                }
            } catch (e) {}

            // 2. Через клик по кнопке в тулбаре плеера
            if (!handled) {
                const btn = document.querySelector(
                    '[data-qa="player-size-button"], [data-role="theater-mode"], ' +
                    'button[title*="Large" i], button[title*="Theater" i], button[title*="Theatre" i], ' +
                    'button[title*="крупн" i], button[title*="театр" i], ' +
                    '[aria-label*="Large" i], [aria-label*="Theater" i], .player-size-toggle, .icon-theater'
                )?.closest('button, span, a, .has-clickable-effect');
                if (btn) {
                    btn.click();
                    handled = true;
                }
            }

            // 3. Фоллбэк через класс контейнера
            if (!handled) {
                const cont = document.querySelector('.page-container, #player-container, .player-container, main');
                if (cont) {
                    cont.classList.toggle('page-container--wide');
                    handled = true;
                }
            }

            setTimeout(() => {
                const isWide = !!document.querySelector('.page-container--wide, [data-theater="true"], .player-enlarged');
                showToast(isWide ? '🔲 Большой режим (Large Mode)' : '▫️ Обычный размер плеера');
            }, 60);

            return handled;
        }

        /**
         * Извлечение прямых MP4 и HLS ссылок со страницы xHamster
         */
        function findMedia() {
            if (!isSupported()) return null;

            const urls = [];
            let title = '';

            // 1. Извлекаем из window.initials (наиболее надёжный нативный источник xHamster)
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                const inits = uWin.initials || uWin.initialData || (uWin.__INITIAL_STATE__ && uWin.__INITIAL_STATE__.initials);
                if (inits && inits.videoModel) {
                    const vm = inits.videoModel;
                    title = vm.title || '';
                    const sources = vm.sources || {};
                    // MP4 по качествам (1080p, 720p, 480p, 240p)
                    if (sources.mp4 && typeof sources.mp4 === 'object') {
                        const qKeys = ['1080p', '720p', '480p', '360p', '240p'];
                        for (const q of qKeys) {
                            if (sources.mp4[q]) urls.push(sources.mp4[q]);
                        }
                        for (const k in sources.mp4) {
                            if (sources.mp4[k] && !urls.includes(sources.mp4[k])) urls.push(sources.mp4[k]);
                        }
                    }
                    // HLS поток (master.m3u8)
                    if (sources.hls && typeof sources.hls === 'object') {
                        if (sources.hls.hls) urls.push(sources.hls.hls);
                        if (sources.hls.url) urls.push(sources.hls.url);
                    } else if (typeof sources.hls === 'string') {
                        urls.push(sources.hls);
                    }
                }
            } catch (e) {}

            // 2. Если window.initials закрыт, парсим script-тег initials-script
            if (!urls.length) {
                const initScript = document.getElementById('initials-script') ||
                    Array.from(document.getElementsByTagName('script')).find(s => s.textContent && s.textContent.includes('window.initials'));
                if (initScript && initScript.textContent) {
                    const text = initScript.textContent;
                    // Извлекаем MP4 ссылки
                    const mp4Regex = /"https?:\/\/[^"]+\.mp4[^"]*"/gi;
                    let m;
                    while ((m = mp4Regex.exec(text)) !== null) {
                        const clean = m[0].replace(/"/g, '').replace(/\\u0026/g, '&').replace(/\\/g, '');
                        if (clean && !urls.includes(clean)) urls.push(clean);
                    }
                    // Извлекаем HLS ссылки
                    const hlsRegex = /"https?:\/\/[^"]+\.m3u8[^"]*"/gi;
                    while ((m = hlsRegex.exec(text)) !== null) {
                        const clean = m[0].replace(/"/g, '').replace(/\\u0026/g, '&').replace(/\\/g, '');
                        if (clean && !urls.includes(clean)) urls.push(clean);
                    }
                    if (!title) {
                        const tm = text.match(/"title"\s*:\s*"([^"]+)"/);
                        if (tm) title = tm[1];
                    }
                }
            }

            // 3. Fallback: <video> элементы и <meta>
            if (!urls.length) {
                const metaVid = document.querySelector('meta[property="og:video"], meta[property="og:video:url"]');
                if (metaVid && metaVid.content) urls.push(metaVid.content);

                const videos = Array.from(document.querySelectorAll('video'));
                for (const v of videos) {
                    const src = v.currentSrc || v.src || '';
                    if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
                    for (const s of v.querySelectorAll('source')) {
                        if (s.src && !s.src.startsWith('blob:') && !urls.includes(s.src)) urls.push(s.src);
                    }
                }
            }

            if (!urls.length) return null;

            if (!title) {
                title = (document.querySelector('h1.page-title, h1, [data-qa="video-title"]') || {}).textContent
                     || document.title || '';
            }
            title = title.replace(/\s+/g, ' ').trim();

            return {
                urls: Array.from(new Set(urls.filter(Boolean))),
                type: 'video',
                desc: title
            };
        }

        return {
            isSupported,
            toggleLargeMode,
            findMedia
        };
    })();
