    // ============================================
    // FAPHOUSE ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.faphouse = (() => {
        function isSupported() {
            return /(?:faphouse\.com)/i.test(rootDomain) || /(?:faphouse\.com)/i.test(location.hostname);
        }

        // Кэш перехваченных медиа-URL (m3u8 / mp4) через сетевой сниффер
        const _capturedMediaUrls = new Set();
        let _capturedTitle = '';

        /**
         * v1.4.13: Сетевой сниффер: перехват fetch, XHR и Hls.prototype.loadSource
         * Запускается сразу в момент старта страницы, ловит загрузку плеером любого HLS/MP4 потока.
         */
        function _initNetworkSniffer() {
            if (!isSupported()) return;

            function _checkAndSaveUrl(url) {
                if (!url || typeof url !== 'string') return;
                if (/\.(?:m3u8|mp4)(?:\?|$)/i.test(url) || /\/(?:hls|stream|manifest|master)\//i.test(url)) {
                    _capturedMediaUrls.add(url);
                }
            }

            // 1. Хук Hls.js (если сайт загружает плеер на hls.js)
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                const patchHls = (HlsClass) => {
                    if (!HlsClass || HlsClass._mossadPatched) return;
                    HlsClass._mossadPatched = true;
                    const origLoad = HlsClass.prototype.loadSource;
                    if (origLoad) {
                        HlsClass.prototype.loadSource = function(src) {
                            _checkAndSaveUrl(src);
                            return origLoad.apply(this, arguments);
                        };
                    }
                };
                if (uWin.Hls) patchHls(uWin.Hls);
                else {
                    let _hlsVal = undefined;
                    try {
                        Object.defineProperty(uWin, 'Hls', {
                            configurable: true,
                            enumerable: true,
                            get: () => _hlsVal,
                            set: (val) => { _hlsVal = val; patchHls(val); }
                        });
                    } catch (_) {}
                }
            } catch (_) {}

            // 2. Хук window.fetch
            try {
                const targets = [typeof unsafeWindow !== 'undefined' ? unsafeWindow : null, window].filter(Boolean);
                for (const win of targets) {
                    if (win._mossadFetchPatched) continue;
                    win._mossadFetchPatched = true;
                    const origFetch = win.fetch;
                    if (typeof origFetch === 'function') {
                        win.fetch = function(...args) {
                            try {
                                const reqUrl = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                                _checkAndSaveUrl(reqUrl);
                            } catch (_) {}
                            return origFetch.apply(this, args);
                        };
                    }
                }
            } catch (_) {}

            // 3. Хук XMLHttpRequest
            try {
                const targets = [typeof unsafeWindow !== 'undefined' ? unsafeWindow : null, window].filter(Boolean);
                for (const win of targets) {
                    if (!win.XMLHttpRequest || win.XMLHttpRequest._mossadXhrPatched) continue;
                    win.XMLHttpRequest._mossadXhrPatched = true;
                    const origOpen = win.XMLHttpRequest.prototype.open;
                    win.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                        try {
                            if (typeof url === 'string') _checkAndSaveUrl(url);
                        } catch (_) {}
                        return origOpen.call(this, method, url, ...rest);
                    };
                }
            } catch (_) {}
        }

        /**
         * Переключение Большого режима / Large Mode (Theater mode) на Faphouse
         */
        function toggleLargeMode() {
            let handled = false;

            // 1. Поиск кнопки в тулбаре плеера
            const btn = document.querySelector(
                'button[title*="Large" i], button[title*="Theater" i], button[title*="Wide" i], ' +
                'button[title*="крупн" i], button[title*="театр" i], button[title*="размер" i], ' +
                '.theater-btn, button[data-action="theater"]'
            )?.closest('button, span, a, .has-clickable-effect');
            if (btn) {
                btn.click();
                handled = true;
            }

            // 2. Фоллбэк: CSS-класс большого режима на контейнере плеера
            const playerCont = document.querySelector('.video-player, .player_wrap, .player-container, #player, .player, [data-player]');
            if (playerCont) {
                playerCont.classList.toggle('mossad-theater-active');
                if (!document.getElementById('mossad-fh-theater-style')) {
                    const st = document.createElement('style');
                    st.id = 'mossad-fh-theater-style';
                    st.textContent = `
                        body:has(.mossad-theater-active) main,
                        body:has(.mossad-theater-active) .container,
                        body:has(.mossad-theater-active) [class*="layout"] {
                            overflow: visible !important;
                        }
                        .mossad-theater-active {
                            width: 98vw !important;
                            max-width: 98vw !important;
                            margin-left: calc(-49vw + 50%) !important;
                            height: min(85vh, 56.25vw) !important;
                            z-index: 9999 !important;
                            position: relative !important;
                            transition: all 0.3s ease !important;
                        }
                        .mossad-theater-active video {
                            width: 100% !important;
                            height: 100% !important;
                            object-fit: contain !important;
                        }
                    `;
                    document.head.appendChild(st);
                }
                const isWide = playerCont.classList.contains('mossad-theater-active');
                if (isWide) {
                    try { playerCont.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
                }
                handled = true;
                setTimeout(() => {
                    showToast(isWide ? '🔲 Большой режим (Large Mode)' : '▫️ Обычный размер плеера');
                }, 50);
                return handled;
            }

            setTimeout(() => {
                showToast(handled ? '🔲 Большой режим (Large Mode)' : '⚠️ Кнопка «Большой режим» не найдена', !handled);
            }, 60);

            return handled;
        }

        /**
         * Извлечение прямых MP4 / HLS ссылок со страницы faphouse.com
         */
        function findMedia() {
            if (!isSupported()) return null;

            const urls = [];
            let title = _capturedTitle || '';

            // ── 0. Ссылки, перехваченные сетевым сниффером (Hls.js / fetch / XHR) ────
            if (_capturedMediaUrls.size > 0) {
                for (const u of _capturedMediaUrls) {
                    if (u && !urls.includes(u)) urls.push(u);
                }
            }

            // ── 1. Nuxt 3 Data тег (<script id="__NUXT_DATA__">) ────────────────────
            const nuxtDataScript = document.getElementById('__NUXT_DATA__');
            if (nuxtDataScript && nuxtDataScript.textContent) {
                try {
                    const parsed = JSON.parse(nuxtDataScript.textContent);
                    if (Array.isArray(parsed)) {
                        for (const item of parsed) {
                            if (typeof item === 'string') {
                                if (/\.(?:mp4|m3u8)(?:\?|$)/i.test(item) || /\/(?:hls|stream)\//i.test(item)) {
                                    const dec = _decodeUrl(item);
                                    if (dec && !urls.includes(dec)) urls.push(dec);
                                }
                            }
                        }
                    }
                } catch (_) {}
            }

            // ── 2. Глобальные переменные плеера (unsafeWindow) ──────────────────────
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

                // Nuxt.js SSR payload
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

                // window.__NUXT_DATA__ в памяти
                if (Array.isArray(uWin.__NUXT_DATA__)) {
                    for (const item of uWin.__NUXT_DATA__) {
                        if (typeof item === 'string' && (/\.(?:mp4|m3u8)/i.test(item) || /\/(?:hls|stream)\//i.test(item))) {
                            const dec = _decodeUrl(item);
                            if (dec && !urls.includes(dec)) urls.push(dec);
                        }
                    }
                }

                // Pinia / Vuex store
                const pinia = uWin.__pinia || uWin.__store;
                if (pinia) {
                    _extractMp4FromStr(JSON.stringify(pinia), urls);
                }

                // Прямые глобальные переменные плеера
                const candidates = [
                    uWin.playerConfig, uWin.videoConfig, uWin.videoData,
                    uWin.VIDEO_DATA, uWin.PLAYER_CONFIG, uWin.videoSources,
                    uWin.fhPlayerConfig, uWin.fhVideo
                ];
                for (const obj of candidates) {
                    if (obj) _extractMp4FromStr(JSON.stringify(obj), urls);
                }
            } catch (_) {}

            // ── 3. Script-теги страницы ──────────────────────────────────────────────
            const scripts = document.getElementsByTagName('script');
            for (let i = 0; i < scripts.length; i++) {
                const text = scripts[i].textContent || '';
                if (!text) continue;
                if (text.includes('video_url') || text.includes('videoUrl') ||
                    text.includes('.mp4') || text.includes('.m3u8') || text.includes('/hls/')) {
                    _extractMp4FromStr(text, urls);
                    if (!title) {
                        const tm = text.match(/"title"\s*:\s*"([^"]{3,120})"/);
                        if (tm) title = tm[1];
                    }
                }
            }

            // ── 4. <meta> теги ──────────────────────────────────────────────────────
            const metaVid = document.querySelector('meta[property="og:video"], meta[property="og:video:url"], meta[name="twitter:player:stream"]');
            if (metaVid && metaVid.content && !urls.includes(metaVid.content)) {
                urls.push(metaVid.content);
            }

            // ── 5. <video> элемент — прямой src или source ──────────────────────────
            const videos = Array.from(document.querySelectorAll('video'));
            for (const v of videos) {
                const src = v.currentSrc || v.src || '';
                if (src && !src.startsWith('blob:') && !urls.includes(src)) {
                    urls.push(src);
                }
                for (const s of v.querySelectorAll('source')) {
                    if (s.src && !s.src.startsWith('blob:') && !urls.includes(s.src)) {
                        urls.push(s.src);
                    }
                }
            }

            // ── 6. Проверка same-origin iframe ──────────────────────────────────────
            document.querySelectorAll('iframe').forEach(f => {
                try {
                    const iDoc = f.contentDocument;
                    if (iDoc) {
                        iDoc.querySelectorAll('video').forEach(v => {
                            const src = v.currentSrc || v.src || '';
                            if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
                            v.querySelectorAll('source').forEach(s => {
                                if (s.src && !s.src.startsWith('blob:') && !urls.includes(s.src)) urls.push(s.src);
                            });
                        });
                    }
                } catch (_) {}
            });

            if (!urls.length) return null;

            if (!title) {
                title = (document.querySelector('h1.video-title, h1, .title, [data-qa="title"]') || {}).textContent
                     || document.title || '';
            }
            title = title.replace(/\s+/g, ' ').trim();

            // Если есть m3u8, создаем также потенциальные MP4 ссылки
            const expanded = [];
            for (const u of urls) {
                expanded.push(u);
                if (u.includes('.m3u8')) {
                    const mp4Direct = u.replace(/\.m3u8(\?.*)?$/i, '.mp4$1').replace(/\/hls\//i, '/mp4/');
                    if (!expanded.includes(mp4Direct)) expanded.push(mp4Direct);
                }
            }

            // Расставляем MP4 в начало, HLS (.m3u8) в конец
            expanded.sort((a, b) => {
                const aHls = a.includes('.m3u8') ? 1 : 0;
                const bHls = b.includes('.m3u8') ? 1 : 0;
                return aHls - bHls;
            });

            return {
                urls: Array.from(new Set(expanded.filter(Boolean))),
                type: 'video',
                desc: title
            };
        }

        /**
         * Вспомогательная — ищет MP4 / HLS ссылки в произвольной строке JSON/JS.
         */
        function _extractMp4FromStr(str, urls) {
            if (!str || typeof str !== 'string') return;

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

            // Любые https-ссылки на mp4/m3u8
            const broad = /https?:\\?\/\\?\/[^\s"'<>\\]{10,}\.(?:mp4|m3u8)[^\s"'<>\\]*/gi;
            let m;
            while ((m = broad.exec(str)) !== null) {
                const u = _decodeUrl(m[0].replace(/\\+\//g, '/').replace(/\\n|\\r/g, ''));
                if (u && !urls.includes(u)) urls.push(u);
            }
        }

        function _decodeUrl(raw) {
            if (!raw) return '';
            try { return decodeURIComponent(raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))); } catch (e) { return raw; }
        }

        /**
         * v1.4.12: фикс потери фокуса — если плеер в <iframe>, события keydown не доходят
         * до window родительской страницы.
         */
        function _initFocusFix() {
            if (!isSupported()) return;
            document.addEventListener('click', (e) => {
                if (e.target && e.target.tagName === 'IFRAME') return;
                const ae = document.activeElement;
                if (ae && ae.tagName === 'IFRAME') {
                    try { document.body.focus(); } catch (_) {}
                }
            }, true);

            function _tryForwardIframeKeys(iframe) {
                try {
                    const iWin = iframe.contentWindow;
                    if (!iWin || !iWin.document || iWin._mossadFwdAttached) return;
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
                } catch (_) {}
            }

            const _attachToIframes = () => {
                document.querySelectorAll('iframe').forEach(f => _tryForwardIframeKeys(f));
            };
            _attachToIframes();
            const obs = new MutationObserver(_attachToIframes);
            obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
        }

        function init() {
            if (!isSupported()) return;
            _initNetworkSniffer();
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', _initFocusFix);
            } else {
                _initFocusFix();
            }
        }

        return {
            id: 'faphouse',
            isSupported,
            toggleLargeMode,
            findMedia,
            init
        };
    })();
    if (typeof MossadEngineRegistry !== 'undefined') {
        MossadEngineRegistry.register('faphouse', window.MOSSAD_ENGINES.faphouse);
    }
