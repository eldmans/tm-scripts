    // ============================================
    // FAPHOUSE ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.faphouse = (() => {
        function isSupported() {
            return /(?:faphouse\.com)/i.test(rootDomain);
        }

        /**
         * Извлечение прямых MP4 ссылок со страницы faphouse.com
         * Стратегии (по приоритету):
         *  1. unsafeWindow — глобальные объекты плеера (window.__NUXT__, window.__INITIAL_STATE__, playerConfig и т.п.)
         *  2. Script-теги — парсинг JSON/JS-переменных с video_url / mp4 / hls
         *  3. <video> элемент — фоллбэк
         */
        function findMedia() {
            if (!isSupported()) return null;

            const urls = [];
            let title = '';

            // ── 1. Глобальные переменные плеера (unsafeWindow) ──────────────────────
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

                // Nuxt.js SSR payload (наиболее надёжный источник)
                const nuxt = uWin.__NUXT__ || uWin.__nuxt__;
                if (nuxt) {
                    const payload = nuxt.state || nuxt.data || nuxt.payload || {};
                    const str = JSON.stringify(payload);
                    _extractMp4FromStr(str, urls);
                    if (!title) {
                        const tm = str.match(/"title"\s*:\s*"([^"]{3,120})"/);
                        if (tm) title = tm[1];
                    }
                }

                // Pinia / Vuex store
                const pinia = uWin.__pinia || uWin.__store;
                if (pinia && !urls.length) {
                    _extractMp4FromStr(JSON.stringify(pinia), urls);
                }

                // Прямые глобальные переменные плеера
                const candidates = [
                    uWin.playerConfig, uWin.videoConfig, uWin.videoData,
                    uWin.VIDEO_DATA, uWin.PLAYER_CONFIG, uWin.videoSources,
                    uWin.fhPlayerConfig, uWin.fhVideo
                ];
                for (const obj of candidates) {
                    if (obj && !urls.length) {
                        _extractMp4FromStr(JSON.stringify(obj), urls);
                    }
                }

                // window.initialState / window.appData / window.__APP__
                const appCandidates = [
                    uWin.initialState, uWin.appData, uWin.__APP__,
                    uWin.__INITIAL_STATE__, uWin.__INITIAL_DATA__
                ];
                for (const obj of appCandidates) {
                    if (obj && !urls.length) {
                        try { _extractMp4FromStr(JSON.stringify(obj), urls); } catch (e) {}
                    }
                }
            } catch (e) {}

            // ── 2. Script-теги страницы ──────────────────────────────────────────────
            if (!urls.length) {
                const scripts = document.getElementsByTagName('script');
                for (let i = 0; i < scripts.length; i++) {
                    const text = scripts[i].textContent || '';
                    if (!text) continue;

                    // Nuxt / Vite SSR inline payload
                    if (text.includes('__NUXT_DATA__') || text.includes('__NUXT__') ||
                        text.includes('video_url') || text.includes('videoUrl') ||
                        text.includes('.mp4') || text.includes('.m3u8') || text.includes('hls')) {
                        _extractMp4FromStr(text, urls);
                        if (!title) {
                            const tm = text.match(/"title"\s*:\s*"([^"]{3,120})"/);
                            if (tm) title = tm[1];
                        }
                        if (urls.length) break;
                    }
                }
            }

            // ── 3. <video> элемент — фоллбэк ────────────────────────────────────────
            if (!urls.length) {
                const videos = Array.from(document.querySelectorAll('video'));
                for (const v of videos) {
                    const src = v.currentSrc || v.src || '';
                    if (src && !src.startsWith('blob:')) {
                        urls.push(src);
                        break;
                    }
                    for (const s of v.querySelectorAll('source')) {
                        if (s.src && !s.src.startsWith('blob:')) {
                            urls.push(s.src);
                            break;
                        }
                    }
                    if (urls.length) break;
                }
            }

            if (!urls.length) return null;

            if (!title) {
                title = (document.querySelector('h1.video-title, h1, .title') || {}).textContent
                     || document.title || '';
            }
            title = title.replace(/\s+/g, ' ').trim();

            return {
                urls: Array.from(new Set(urls.filter(Boolean))),
                type: 'video',
                desc: title
            };
        }

        /**
         * Вспомогательная — ищет MP4 / HLS ссылки в произвольной строке.
         * Добавляет найденные URL в массив urls.
         */
        function _extractMp4FromStr(str, urls) {
            if (!str || typeof str !== 'string') return;

            // Прямые ключи с видео-URL (JSON)
            const keyPatterns = [
                /["'](?:video_url|videoUrl|mp4_url|src|hlsUrl|hls_url|cdnUrl|cdn_url|streamUrl|stream_url|url_mp4|url_hls|fileUrl|file_url|mediaUrl|media_url)["']\s*:\s*["']([^"']{10,}\.(?:mp4|m3u8)[^"']*)/gi,
                /["']src["']\s*:\s*["'](https?:\/\/[^"']{10,}\.(?:mp4|m3u8)[^"']*)/gi,
            ];
            for (const re of keyPatterns) {
                let m;
                re.lastIndex = 0;
                while ((m = re.exec(str)) !== null) {
                    const u = _decodeUrl(m[1]);
                    if (u && !urls.includes(u)) urls.push(u);
                }
            }

            // Любые https-ссылки на mp4/m3u8 (широкий поиск)
            if (!urls.length) {
                const broad = /https?:\\?\/\\?\/[^\s"'<>\\]{10,}\.(?:mp4|m3u8)[^\s"'<>\\]*/gi;
                let m;
                while ((m = broad.exec(str)) !== null) {
                    const u = _decodeUrl(m[0].replace(/\\+\//g, '/').replace(/\\n|\\r/g, ''));
                    if (u && !urls.includes(u)) urls.push(u);
                }
            }

            // Расставляем HLS в конец (прямые MP4 имеют приоритет)
            urls.sort((a, b) => {
                const aHls = a.includes('.m3u8') ? 1 : 0;
                const bHls = b.includes('.m3u8') ? 1 : 0;
                return aHls - bHls;
            });
        }

        function _decodeUrl(raw) {
            if (!raw) return '';
            try { return decodeURIComponent(raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))); } catch (e) { return raw; }
        }

        /**
         * v1.4.12: фикс потери фокуса — если плеер в <iframe>, события keydown не доходят
         * до window родительской страницы. Решение:
         *  1. При клике на страницу вне iframe — снимаем фокус с iframe.
         *  2. Пробуем добавить keydown-listener внутри same-origin iframe и форвардить хоткеи.
         */
        function _initFocusFix() {
            if (!isSupported()) return;
            // При клике вне iframe — снимаем фокус с iframe чтобы хоткеи снова работали
            document.addEventListener('click', (e) => {
                if (e.target && e.target.tagName === 'IFRAME') return;
                const ae = document.activeElement;
                if (ae && ae.tagName === 'IFRAME') {
                    try { document.body.focus(); } catch (_) {}
                }
            }, true);
            // Форвардируем keydown из same-origin iframe в родительский window
            function _tryForwardIframeKeys(iframe) {
                try {
                    const iWin = iframe.contentWindow;
                    if (!iWin || !iWin.document) return;
                    if (iWin._mossadFwdAttached) return;
                    iWin._mossadFwdAttached = true;
                    iWin.addEventListener('keydown', (ev) => {
                        try {
                            window.dispatchEvent(new KeyboardEvent('keydown', {
                                key: ev.key, code: ev.code,
                                ctrlKey: ev.ctrlKey, altKey: ev.altKey,
                                shiftKey: ev.shiftKey, metaKey: ev.metaKey,
                                bubbles: true, cancelable: true
                            }));
                        } catch (_) {}
                    }, true);
                } catch (_) {} // cross-origin → молча
            }
            // Наблюдаем за iframe которые появляются в DOM
            const _attachToIframes = () => {
                document.querySelectorAll('iframe').forEach(f => _tryForwardIframeKeys(f));
            };
            _attachToIframes();
            const obs = new MutationObserver(_attachToIframes);
            obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
        }

        // Запускаем фикс фокуса при загрузке
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _initFocusFix);
        } else {
            _initFocusFix();
        }

        return { isSupported, findMedia };
    })();
