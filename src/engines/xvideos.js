    // ============================================
    // XVIDEOS / XV-RU / XNXX ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.xvideos = (() => {
        function isSupported() {
            return /(?:xv-ru\.com|xvideos\d*\.com|xnxx\d*\.com)/i.test(rootDomain);
        }

        /**
         * Переключение размера плеера: обычный <-> двойной размер (Double player size)
         */
        function toggleDoubleSize() {
            let handled = false;

            // 1. Через API встроенного плеера (unsafeWindow)
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (uWin.html5player && typeof uWin.html5player.toggleExpand === 'function') {
                    uWin.html5player.toggleExpand();
                    handled = true;
                } else if (uWin.xvideos && uWin.xvideos.player && typeof uWin.xvideos.player.toggleSize === 'function') {
                    uWin.xvideos.player.toggleSize();
                    handled = true;
                } else if (uWin.xv && uWin.xv.player && typeof uWin.xv.player.toggleSize === 'function') {
                    uWin.xv.player.toggleSize();
                    handled = true;
                }
            } catch (e) {}

            // 2. Через клик по кнопке в тулбаре плеера
            if (!handled) {
                const btn = document.querySelector('.icon-f.icf-full-width, .xv-icon-full-width, [title*="Double player size" i], [title*="player size" i], [title*="размер плеера" i]')?.closest('button, span, a, .has-clickable-effect');
                if (btn) {
                    btn.click();
                    handled = true;
                }
            }

            // 3. Фоллбэк через класс контейнера
            if (!handled) {
                const content = document.getElementById('content') || document.getElementById('video-player-bg');
                if (content) {
                    content.classList.toggle('player-enlarged');
                    handled = true;
                }
            }

            // Сигнал пользователю
            setTimeout(() => {
                const isEnlarged = !!document.querySelector('#content.player-enlarged, .player-enlarged');
                showToast(isEnlarged ? '🔲 Двойной размер плеера' : '▫️ Обычный размер плеера');
            }, 60);

            return handled;
        }

        /**
         * Извлечение прямых MP4 ссылок со страницы вместо hls.m3u8
         */
        function findMedia() {
            if (!isSupported()) return null;

            let highUrl = '';
            let lowUrl = '';
            let hlsUrl = '';
            let title = '';

            // 1. Извлекаем из глобального объекта плеера (unsafeWindow)
            try {
                const uWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                const p = uWin.html5player;
                if (p) {
                    highUrl = p.sUrlHigh || '';
                    lowUrl = p.sUrlLow || '';
                    hlsUrl = p.sUrlHls || '';
                    title = p.video_title || '';
                }
            } catch (e) {}

            // 2. Если в объекте нет или uWin закрыт, парсим script-теги страницы
            if (!highUrl && !lowUrl) {
                const scripts = document.getElementsByTagName('script');
                for (let i = 0; i < scripts.length; i++) {
                    const text = scripts[i].textContent || '';
                    if (text.includes('html5player.setVideoUrl') || text.includes('html5player.setVideoHLS')) {
                        const mHigh = text.match(/html5player\.setVideoUrlHigh\('([^']+)'\)/);
                        if (mHigh && mHigh[1]) highUrl = mHigh[1];

                        const mLow = text.match(/html5player\.setVideoUrlLow\('([^']+)'\)/);
                        if (mLow && mLow[1]) lowUrl = mLow[1];

                        const mHls = text.match(/html5player\.setVideoHLS\('([^']+)'\)/);
                        if (mHls && mHls[1]) hlsUrl = mHls[1];

                        const mTitle = text.match(/html5player\.setVideoTitle\('([^']+)'\)/);
                        if (mTitle && mTitle[1]) title = mTitle[1];
                        break;
                    }
                }
            }

            // Прямые MP4 ссылки имеют приоритет над HLS плейлистом
            const urls = [highUrl, lowUrl, hlsUrl].filter(u => u && typeof u === 'string');
            if (urls.length === 0) return null;

            if (!title) {
                title = (document.querySelector('h2.page-title, .video-title, h1') || {}).textContent || document.title || '';
            }
            title = title.replace(/\s+/g, ' ').trim();

            return {
                urls,
                type: 'video',
                desc: title
            };
        }

        return {
            isSupported,
            toggleDoubleSize,
            findMedia
        };
    })();
