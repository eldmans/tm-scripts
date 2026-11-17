    // ============================================
    // TELEGRAM WEB (WebK / WebA) ENGINE (v1.4.19)
    // ============================================
    // Поддержка web.telegram.org (версии K и A).
    // Позволяет скачивать исходные фото и видео из постов каналов и чатов (включая защищенные),
    // использовать D-pad для листания постов/медиа и авто-переход в слайдшоу.
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.telegram = (() => {
        const _tgBlobs = new Map();

        function isSupported() {
            return rootDomain === 'telegram.org' || /(?:web\.telegram\.org|webk\.telegram\.org|weba\.telegram\.org)/i.test(location.hostname);
        }

        /**
         * Перехват создания blob-ссылок для гарантированного доступа к исходным Blob
         */
        function _initBlobSniffer() {
            if (!isSupported() || window._mossadTgBlobPatched) return;
            window._mossadTgBlobPatched = true;

            const origCreate = window.URL.createObjectURL;
            if (typeof origCreate === 'function') {
                window.URL.createObjectURL = function(obj) {
                    const url = origCreate.call(window.URL, obj);
                    if (obj instanceof Blob) {
                        try {
                            _tgBlobs.set(url, { blob: obj, type: obj.type || '', time: Date.now() });
                            if (_tgBlobs.size > 80) {
                                const oldest = _tgBlobs.keys().next().value;
                                _tgBlobs.delete(oldest);
                            }
                        } catch (_) {}
                    }
                    return url;
                };
            }
        }

        /**
         * Извлечение подписи / текста к посту
         */
        function getCaption(container) {
            if (!container) return '';
            const el = container.querySelector(
                '.media-viewer-caption, .MediaViewer-caption, .caption, ' +
                '.message-text, .translatable-message, .text-content, [class*="caption"]'
            );
            const raw = el ? (el.textContent || '') : '';
            return raw.replace(/\s+/g, ' ').trim().slice(0, 80);
        }

        /**
         * Поиск медиафайла в активном лайтбоксе или выбранном сообщении
         */
        function findMedia() {
            if (!isSupported()) return null;

            // 1. Проверяем открытый полноэкранный просмотрщик (Media Viewer / Lightbox)
            const viewer = document.querySelector(
                '.media-viewer-moal, .media-viewer, .ImageViewer, .MediaViewer, .pswp, [class*="MediaViewer"]'
            );
            if (viewer && viewer.offsetParent !== null) {
                // Видео в просмотрщике
                const v = viewer.querySelector('video');
                if (v) {
                    const src = v.currentSrc || v.src || '';
                    if (src) {
                        return {
                            urls: [src],
                            type: 'video',
                            desc: getCaption(viewer) || 'telegram_video'
                        };
                    }
                }
                // Изображение в просмотрщике
                const img = viewer.querySelector(
                    'img.media-viewer-aspect-img, img.media-viewer-image, img.pswp__img, img[class*="full-image"], img'
                );
                if (img) {
                    const src = img.currentSrc || img.src || '';
                    if (src && !src.startsWith('data:image/svg')) {
                        return {
                            urls: [src],
                            type: 'photo',
                            desc: getCaption(viewer) || 'telegram_photo'
                        };
                    }
                }
            }

            // 2. Выделенное или активное сообщение в ленте чата/канала
            const activeMsg = document.querySelector(
                '.bubble.is-selected, .bubble:hover, .Message.selected, .Message:hover, .message:hover'
            );
            if (activeMsg) {
                const v = activeMsg.querySelector('video');
                if (v && (v.currentSrc || v.src)) {
                    return {
                        urls: [v.currentSrc || v.src],
                        type: 'video',
                        desc: getCaption(activeMsg) || 'telegram_video'
                    };
                }
                const img = activeMsg.querySelector('img.media-photo, img.thumbnail, img');
                if (img && (img.currentSrc || img.src) && !img.src.startsWith('data:image/svg')) {
                    return {
                        urls: [img.currentSrc || img.src],
                        type: 'photo',
                        desc: getCaption(activeMsg) || 'telegram_photo'
                    };
                }
            }

            // 3. Активно играющее видео в видимой области ленты
            const allVideos = Array.from(document.querySelectorAll('video'));
            const playing = allVideos.find(v => !v.paused && v.currentTime > 0) || allVideos[0];
            if (playing && (playing.currentSrc || playing.src)) {
                const parentBubble = playing.closest('.bubble, .Message, .message, [data-message-id]');
                return {
                    urls: [playing.currentSrc || playing.src],
                    type: 'video',
                    desc: getCaption(parentBubble) || 'telegram_video'
                };
            }

            return null;
        }

        /**
         * Навигация по медиа/постам (стрелки или D-pad)
         */
        function navigate(dir = 'down') {
            if (!isSupported()) return false;
            const isFwd = dir === 'down' || dir === 'right';

            // 1. Если открыт лайтбокс — кликаем нативные кнопки Далее / Назад
            const viewer = document.querySelector(
                '.media-viewer-moal, .media-viewer, .ImageViewer, .MediaViewer, .pswp'
            );
            if (viewer && viewer.offsetParent !== null) {
                const nextBtn = viewer.querySelector(
                    '.media-viewer-button-next, .pswp__button--arrow--right, button[aria-label*="Next" i], .MediaViewer-next, [class*="arrow-right"]'
                );
                const prevBtn = viewer.querySelector(
                    '.media-viewer-button-prev, .pswp__button--arrow--left, button[aria-label*="Previous" i], .MediaViewer-prev, [class*="arrow-left"]'
                );
                const target = isFwd ? nextBtn : prevBtn;
                if (target) {
                    target.click();
                    return true;
                }
            }

            // 2. Листание по сообщениям ленты с медиа
            const mediaMessages = Array.from(document.querySelectorAll(
                '.bubble:has(video), .bubble:has(img.media-photo), .Message:has(video), .Message:has(img)'
            ));
            if (mediaMessages.length > 0) {
                const viewCenter = window.innerHeight / 2;
                let currentIdx = -1;
                let minDiff = Infinity;
                mediaMessages.forEach((el, idx) => {
                    const rect = el.getBoundingClientRect();
                    const diff = Math.abs((rect.top + rect.height / 2) - viewCenter);
                    if (diff < minDiff) {
                        minDiff = diff;
                        currentIdx = idx;
                    }
                });

                const targetIdx = isFwd
                    ? Math.min(mediaMessages.length - 1, currentIdx + 1)
                    : Math.max(0, currentIdx - 1);

                if (targetIdx !== currentIdx && mediaMessages[targetIdx]) {
                    mediaMessages[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Если в сообщении есть видео — запускаем воспроизведение
                    const vid = mediaMessages[targetIdx].querySelector('video');
                    if (vid) {
                        try { vid.play().catch(() => {}); } catch (_) {}
                    }
                    return true;
                }
            }

            return false;
        }

        function init() {
            if (!isSupported()) return;
            _initBlobSniffer();
        }

        return {
            id: 'telegram',
            isSupported,
            findMedia,
            navigate,
            init
        };
    })();

    if (typeof MossadEngineRegistry !== 'undefined') {
        MossadEngineRegistry.register('telegram', window.MOSSAD_ENGINES.telegram);
    }
