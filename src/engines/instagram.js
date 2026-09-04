    // ============================================
    // INSTAGRAM ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.instagram = (() => {
        const _igVideoUrls = [];   // перехваченные URL видео CDN инсты

        /** Проверяет, является ли URL видео-файлом (не картинкой) */
        function _igIsVideoUrl(url) {
            if (!url || typeof url !== 'string') return false;
            // Явные расширения картинок — исключаем
            if (/\.(jpg|jpeg|webp|png|gif|avif|heic)(\?|$)/i.test(url)) return false;
            // Явный признак видео
            if (/\.mp4(\?|$)/i.test(url)) return true;
            // CDN-путь содержит /v/ или слово video
            if (/\/v\/|\/video|video\//i.test(url)) return true;
            // CDN-URL без расширения — предположительно видео-сегмент
            if (_igIsCdnUrl(url) && !/\.(jpg|jpeg|webp|png|gif)/i.test(url)) return true;
            return false;
        }

        /** Добавить URL в список, дедупликация, новые — в начало */
        function _igPush(url) {
            if (!url || url.startsWith('blob:')) return;
            if (!_igIsVideoUrl(url)) return;
            // Убираем bytestart/byteend параметры чтобы URL был полным
            const clean = url.replace(/[?&](bytestart|byteend)=[^&]*/gi, '').replace(/[?&]$/, '');
            if (!_igVideoUrls.includes(clean)) {
                _igVideoUrls.unshift(clean);
                if (_igVideoUrls.length > 30) _igVideoUrls.pop();
                console.log('[MOSSAD/IG] Поймал URL:', clean.slice(0, 80));
            }
        }

        /** Проверяет, похож ли URL на медиа CDN инсты */
        function _igIsCdnUrl(url) {
            if (!url || typeof url !== 'string') return false;
            return /cdninstagram\.com/i.test(url) ||
                   /\.fbcdn\.net/i.test(url) ||
                   /instagram\.f[a-z0-9-]+\d+\.fna/i.test(url);
        }

        /** Парсим JSON-данные страницы — инста вставляет видео URL в script-теги */
        function _igScrapePageJson() {
            const found = [];
            const pageText = document.documentElement.innerHTML;
            const re = /https:\/\/[^"'\s]*(?:fbcdn\.net|cdninstagram\.com)[^"'\s]*/g;
            let m;
            while ((m = re.exec(pageText)) !== null) {
                let u = m[0].replace(/\\u0026/g, '&').replace(/\\/g, '').split('"')[0];
                // Фильтруем: только видео URL, без превью-картинок
                if (u && _igIsVideoUrl(u)) {
                    found.push(u);
                }
            }
            return found;
        }

        /** Очистить кэш URL при SPA-навигации */
        function onNavigate() {
            _igVideoUrls.length = 0;
            console.log('[MOSSAD/IG] Навигация — очищаем кэш URL');
        }

        /** Вернуть текущий медиа-результат для DL */
        function findMedia() {
            // 1. Прямые src у видео (иногда инста не использует blob)
            const vids = Array.from(document.querySelectorAll('video'));
            for (const v of vids) {
                const src = v.currentSrc || v.src || (v.querySelector('source') || {}).src || '';
                if (src && _igIsCdnUrl(src) && !src.startsWith('blob:') && _igIsVideoUrl(src)) {
                    return { urls: [src], type: 'video' };
                }
            }
            // 2. Перехваченные через fetch/XHR/Observer
            if (_igVideoUrls.length > 0) {
                return { urls: [..._igVideoUrls], type: 'video' };
            }
            // 3. Парсинг HTML страницы (инста встраивает URL в script-теги)
            const scraped = _igScrapePageJson();
            if (scraped.length > 0) {
                scraped.forEach(u => _igPush(u));
                return { urls: scraped, type: 'video' };
            }
            showToast('⏳ Инста: запусти видео — скрипт поймает URL', true);
            return null;
        }

        function isSupported() {
            return rootDomain.includes('instagram.com');
        }

        function init() {
            if (!isSupported()) return;

            // --- Перехват fetch — ловим любой CDN запрос ---
            const _origFetch = window.fetch;
            window.fetch = function (...args) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                if (_igIsCdnUrl(url)) _igPush(url);
                const p = _origFetch.apply(this, args);
                p.then && p.then(r => {
                    try {
                        if (r && r.headers && r.headers.get('content-type') &&
                            r.headers.get('content-type').includes('video')) {
                            _igPush(r.url || url);
                        }
                    } catch {}
                }).catch(() => {});
                return p;
            };

            // --- Перехват XHR ---
            const _origXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                if (typeof url === 'string' && _igIsCdnUrl(url)) _igPush(url);
                return _origXHROpen.call(this, method, url, ...rest);
            };

            // --- Перехват history.pushState / replaceState — очищаем кэш при навигации ---
            const _origPushState = history.pushState.bind(history);
            const _origReplaceState = history.replaceState.bind(history);
            history.pushState = function (...args) {
                onNavigate();
                return _origPushState(...args);
            };
            history.replaceState = function (...args) {
                onNavigate();
                return _origReplaceState(...args);
            };

            // --- MutationObserver: прямые src у <video> ---
            const _igObserver = new MutationObserver(() => {
                document.querySelectorAll('video, video > source').forEach(el => {
                    const src = el.src || el.getAttribute('src') || el.currentSrc || '';
                    if (_igIsCdnUrl(src)) _igPush(src);
                });
            });
            const _igStartObs = () => {
                if (document.body) _igObserver.observe(document.body, {
                    subtree: true, childList: true, attributes: true, attributeFilter: ['src']
                });
            };
            if (document.body) _igStartObs(); else document.addEventListener('DOMContentLoaded', _igStartObs);
        }

        return { isSupported, findMedia, onNavigate, init };
    })();
    window.MOSSAD_ENGINES.instagram.init();

