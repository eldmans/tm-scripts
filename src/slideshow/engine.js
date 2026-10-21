    // ============================================
    // SLIDESHOW LOGIC (AUTO) & SESSION PERSISTENCE
    // ============================================
    const SESSION_ACTIVE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`;
    const SESSION_STATE_KEY  = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_wstate`;
    const SESSION_PAUSED_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_paused`;
    const SESSION_NAV_KEY    = 'mossad_navigating';

    // Если был автоматический переход на следующий слайд, гарантируем очистку флагов навигации и паузы
    if (sessionStorage.getItem(SESSION_NAV_KEY) === 'true') {
        sessionStorage.removeItem(SESSION_NAV_KEY);
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
    }

    let slideshowActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
    let slideshowPaused = sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';
    let slideshowTimeoutId = null;
    let downloadTimeoutId = null;
    let countdownSeconds = 0;
    let isCountingDown = false; // Отсчет времени после видео или для фото

    function setSlideshowPaused(val) {
        slideshowPaused = !!val;
        if (slideshowPaused) {
            sessionStorage.setItem(SESSION_PAUSED_KEY, 'true');
        } else {
            sessionStorage.removeItem(SESSION_PAUSED_KEY);
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }
    
    // Вспомогательные переменные для циклов
    let currentVideoNode = null;
    let videoInitialDuration = 0;
    let currentLoopCount = 0;
    let accumulatedTime = 0;
    let lastTime = 0;
    let lastRAFTime = 0;
    let rafId = null;
    let _videoReachedEndZone = false; // Видео зашло в финальную зону (последние доли секунды)
    let _endedConsumed = false;       // v1.3.38: событие ended уже засчитано (ended остаётся true до play())
    let _videoDetachedSince = 0;      // v1.3.38: когда отслеживаемый <video> исчез из DOM
    let _lastRebindCheck = 0;         // v1.3.38: троттлинг поиска другого играющего видео
    let _lastCycleVideoSrc = '';      // v1.3.38: src видео предыдущего слайда (не считать старое видео новым)
    let _lastCycleSlideKey = '';
    let _lastDownloadUrl = null;     // защита от повторного скачивания одного файла
    let _lastDownloadTime = 0;
    const _filenameCounter = new Map(); // счётчик по базовому имени → (001)(002)...
    let _samePageSlideCount = 0;     // счётчик попыток перелистнуть с одной и той же страницы
    let _lastSlideUrl = '';          // URL во время последнего triggerNextSlide
    const SAME_PAGE_LIMIT = 3;       // сколько раз пробовать перед остановкой

    // v1.3.38: ЕДИНСТВЕННЫЙ отложенный запуск цикла слайда. Раньше цикл запускали независимо
    // тик галереи (setTimeout 300 мс без id), монитор URL (150 мс) и др. — каждый перезапуск
    // обнулял счётчик кругов видео. Теперь все источники идут через requestSlideCycle():
    // новый запрос заменяет предыдущий, cancelSlideTimers() отменяет его (ANTI_PATTERNS §17).
    let _cycleStartTimer = null;

    function requestSlideCycle(delayMs, source) {
        if (_cycleStartTimer) { clearTimeout(_cycleStartTimer); _cycleStartTimer = null; }
        mossadDebug('cycle', 'запрос запуска цикла', { source, delayMs });
        _cycleStartTimer = setTimeout(() => {
            _cycleStartTimer = null;
            if (slideshowActive && !slideshowPaused) scheduleNextSlideCycle(0);
        }, Math.max(0, delayMs || 0));
    }

    function cancelSlideTimers() {
        if (_cycleStartTimer) {
            clearTimeout(_cycleStartTimer);
            _cycleStartTimer = null;
        }
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (slideshowTimeoutId) {
            clearTimeout(slideshowTimeoutId);
            slideshowTimeoutId = null;
        }
        if (downloadTimeoutId) {
            clearTimeout(downloadTimeoutId);
            downloadTimeoutId = null;
        }
        isCountingDown = false;
        countdownSeconds = 0;
        currentLoopCount = 0;
        accumulatedTime = 0;
        lastTime = 0;
        _videoReachedEndZone = false;
        _endedConsumed = false;
        _videoDetachedSince = 0;
        currentVideoNode = null;
    }

    /** Живая длительность видео (videoInitialDuration — только запасной вариант, пока duration ещё NaN). */
    function liveVideoDuration(v) {
        const d = v ? v.duration : NaN;
        return (isFinite(d) && d > 0) ? d : (videoInitialDuration || 0);
    }

    /**
     * v1.3.38: перепривязка счётчика кругов к новому <video> того же слайда (React/HLS перемонтировал плеер)
     * БЕЗ сброса currentLoopCount. Раньше любая смена элемента перезапускала цикл с нуля → 2–4 круга вместо 1.
     */
    function rebindVideoNode(v, source) {
        if (!v) return;
        mossadDebug('loop', 'перепривязка к новому <video> без сброса счётчика', { source, loops: currentLoopCount });
        currentVideoNode = v;
        lastActiveVideo = v;
        if (isFinite(v.duration) && v.duration > 0) videoInitialDuration = v.duration;
        _videoReachedEndZone = false;
        _endedConsumed = !!v.ended;
        _videoDetachedSince = 0;
        lastTime = v.currentTime;
        if (v.paused) { try { v.play().catch(() => {}); } catch(e) {} }
        if (!rafId && slideshowActive && !slideshowPaused && !isCountingDown) {
            rafId = requestAnimationFrame(checkVideoLoops);
        }
    }
    window.cancelSlideTimers = cancelSlideTimers;
    function getActiveVideo() {
        if (rootDomain.includes('redgifs.com') && window.MOSSAD_ENGINES?.redgifs?.getActiveVideo) {
            const rgVid = window.MOSSAD_ENGINES.redgifs.getActiveVideo();
            if (rgVid) return rgVid;
        }

        let videos = Array.from(document.querySelectorAll('video'));
        // v1.3.42: на Grok <video> в кадрах киноплёнки — миниатюры других генераций, не плеер поста
        if (rootDomain === 'grok.com') {
            videos = videos.filter(v => !v.closest(GROK_FILMSTRIP_SEL));
            if (videos.length === 0) return null;
            return grokPickBestVideo(videos); // v1.3.43: UUID поста / играет / видимо (не «первое в DOM»)
        }
        if (videos.length === 0) return null;
        
        // v1.3.51: на Пинтересте — только видео главного пина (closeup), превью «Похожих пинов» не берём.
        // Раньше в список «сцен» входил div[role="main"], а он содержит и сетку похожих.
        if (rootDomain.includes('pinterest.')) return pinterestMainVideo();

        if (videos.length === 1) return videos[0];
        
        let maxVisible = 0;
        let bestVideo = videos[0];
        for (const v of videos) {
            const rect = v.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
            const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
            const visibleArea = visibleHeight * visibleWidth;
            if (visibleArea > maxVisible) {
                maxVisible = visibleArea;
                bestVideo = v;
            }
        }
        return bestVideo;
    }

    // ============================================
    // UNIVERSAL AUTO FULL SCREEN (FS)
    // ============================================
    function triggerUniversalFullScreen() {
        const isEnabled = config.autoFS !== undefined ? config.autoFS : (config.pinterestAutoFS !== undefined ? config.pinterestAutoFS : true);
        if (!isEnabled) return;
        if (document.fullscreenElement) return;

        retryAction((attempt) => {
            if (document.fullscreenElement) return true;

            // 1. Pinterest: "Показать в полном масштабе"
            if (rootDomain.includes('pinterest.')) {
                let btn = document.querySelector('[aria-label="Показать в полном масштабе"], [title="Показать в полном масштабе"], [aria-label*="полном масштабе"]');
                if (!btn) {
                    const svg = document.querySelector('svg[aria-label*="полном масштабе"]');
                    if (svg) btn = svg.closest('[role="button"]') || svg.closest('button') || svg;
                }
                if (btn) {
                    triggerClick(btn, 'Pinterest FullScale');
                    return true;
                }
            }

            // 2. Grok: кнопка Full Screen (Expand video / lucide-expand)
            if (rootDomain === 'grok.com') {
                const fsKeywords = ['expand video', 'expand', 'во весь экран', 'полноэкран', 'full screen', 'fullscreen'];
                const btn = document.querySelector('button[aria-label="Expand video"], button[aria-label*="Expand" i]')
                    || (findGrokButton(fsKeywords))
                    || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        const title = (b.getAttribute('title') || '').toLowerCase();
                        return fsKeywords.some(k => aria.includes(k) || title.includes(k)) || b.querySelector('svg.lucide-expand');
                    });
                if (btn) {
                    triggerClick(btn, 'Grok FullScreen');
                    return true;
                }
            }

            // 3. Универсальный поиск для остальных сайтов
            const genericBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const title = (b.getAttribute('title') || '').toLowerCase();
                return aria.includes('fullscreen') || aria.includes('full screen') || aria.includes('во весь экран') ||
                       title.includes('fullscreen') || title.includes('full screen') || title.includes('во весь экран');
            });
            if (genericBtn) {
                triggerClick(genericBtn, 'Universal FullScreen');
                return true;
            }

            return false;
        }, [100, 300, 500]);
    }

    let lastUrlForSlideshow = location.href;
    let lastActiveVideo = null;

    /** Ключ «слайда» для монитора: на Grok — UUID поста (смена query/replaceState того же поста — не новый слайд). */
    function slideKeyOf(url) {
        if (rootDomain === 'grok.com') {
            try {
                const u = grokExtractUuid(new URL(url, location.origin).pathname);
                if (u) return 'grok:' + u.toLowerCase();
            } catch(e) {}
        }
        return url;
    }

    setInterval(() => {
        if (!slideshowActive || _isRewinding) return;
        
        const currentUrl = location.href;
        const urlChanged = currentUrl !== lastUrlForSlideshow;
        const slideChanged = urlChanged && slideKeyOf(currentUrl) !== slideKeyOf(lastUrlForSlideshow);
        
        let videoChanged = false;
        let currentVideo = lastActiveVideo;
        if (urlChanged || !lastActiveVideo || !document.body.contains(lastActiveVideo)) {
            currentVideo = getActiveVideo();
            videoChanged = currentVideo !== lastActiveVideo && (currentVideo !== null || lastActiveVideo !== null);
        }
        
        if (urlChanged && !slideChanged && !videoChanged) {
            // Тот же пост (например, replaceState с другим query) — не новый слайд
            lastUrlForSlideshow = currentUrl;
            return;
        }

        if (slideChanged || videoChanged || urlChanged) {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;

            // v1.3.38: на Grok смена <video> внутри того же поста (React перемонтировал плеер) — НЕ новый слайд:
            // перепривязываемся к новому элементу без сброса счётчика кругов (см. rebindVideoNode).
            if (!slideChanged && videoChanged && rootDomain === 'grok.com' && currentVideoNode && currentVideo && !isCountingDown) {
                rebindVideoNode(currentVideo, 'url-monitor');
                return;
            }

            if (slideshowTimeoutId) { clearTimeout(slideshowTimeoutId); slideshowTimeoutId = null; }
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

            // Сбрасываем таймер в интерфейсе немедленно!
            isCountingDown = false;
            countdownSeconds = 0;

            if (urlChanged) {
                triggerUniversalFullScreen();
            }

            if (slideChanged) mossadPerfSnapshot('slide');
            requestSlideCycle(150, slideChanged ? 'url-monitor:slide' : 'url-monitor:video');
        }
    }, 250);

    function stopSlideshow() {
        cancelSlideTimers();
        if (typeof pinterestCancelWait === 'function') pinterestCancelWait();
        slideshowActive = false;
        setSlideshowPaused(false);
        isCountingDown = false;
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_STATE_KEY);
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
        if (rootDomain === 'grok.com') {
            _gSS.removeItem(GALLERY_SS_KEY);
            sessionStorage.removeItem('mossad_gallery_paused');
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            window._mossadGalleryPaused = false;
            const ind = document.getElementById('mossad-gallery-indicator');
            if (ind) ind.remove();
            updateGalleryStatusBtn('idle');
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }

    function startSlideshow() {
        if (!slideshowActive) {
            // При локальном старте гарантируем, что это НЕ галерейный режим
            if (rootDomain === 'grok.com') {
                window._mossadGalleryActive = false;
                window._mossadGalleryNextFn = null;
                _gSS.removeItem(GALLERY_SS_KEY);
                sessionStorage.removeItem('mossad_gallery_paused');
                const ind = document.getElementById('mossad-gallery-indicator');
                if (ind) ind.remove();
            }
            slideshowActive = true;
            setSlideshowPaused(false);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            sessionStorage.setItem(SESSION_STATE_KEY, 'bar');
            // Закрываем модальное окно настроек горячих клавиш (если открыто)
            // v1.3.45: через общий путь закрытия — с сохранением и снятием слушателей (раньше просто remove())
            if (document.getElementById('mossad-hk-modal')) closeSettingsWindow(true);
            // Сворачиваем большое меню с D-Pad в компактную полоску (bar)
            window.widgetState = 'bar';
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleNextSlideCycle(0);
        } else {
            stopSlideshow();
        }
    }

    function getArrowKey(dir) {
        if (dir === 'up') return 'ArrowUp';
        if (dir === 'down') return 'ArrowDown';
        if (dir === 'left') return 'ArrowLeft';
        return 'ArrowRight';
    }

    function triggerNextSlide(source = 'unknown') {
        if (!slideshowActive || slideshowPaused || _isRewinding) {
            mossadDebug('step', 'triggerNextSlide пропущен (неактивно/пауза/перемотка)', { source });
            return;
        }
        mossadDebug('step', 'triggerNextSlide', { source });
        cancelSlideTimers();

        // 1. Большое слайдшоу (по плейлисту коллекции в Grok): НЕ зависит от D-Pad!
        const isBigGrokSs = (rootDomain === 'grok.com') && (() => {
            if (window._mossadGalleryActive) return true;
            try { return !!JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active; } catch { return false; }
        })();

        const dirs = config.slideshowDirections;
        const isPinterest = rootDomain.includes('pinterest.');
        if (!isBigGrokSs && !isPinterest && (!dirs || dirs.length === 0)) {
            stopSlideshow();
            return;
        }

        const advanceToNext = () => {
            // Большое слайдшоу (Gallery Slideshow): переходим на следующий URL из собранного плейлиста
            if (isBigGrokSs) {
                if (typeof window._mossadGalleryNextFn === 'function') {
                    window._mossadGalleryNextFn(source);
                    return;
                } else grokGalleryStepNext(source);
                return;
            }

            // v1.3.51: Pinterest — своё направление (▶ вперёд по умолчанию, ◀ назад по истории), не D-pad.
            // Похожих пинов ждёт сам движок (до 15 с), тупик — шаг назад; «конец ленты» и остановки здесь нет.
            // Раньше: D-pad ▲ по умолчанию = «назад по истории» → «начало истории» → через 5 с «конец ленты». ANTI_PATTERNS §30.
            if (isPinterest) {
                selectNextPinterestPin(pinterestSlideDir(), { isManual: false, fromSlideshow: true });
                triggerUniversalFullScreen();
                return;
            }

            // Малое слайдшоу управляется D-Pad и петлей R
            const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
            const startUrl = location.href;

            const sendSlideStep = () => {
                if (typeof performDpadStep === 'function') {
                    performDpadStep(dPadDir, true);
                } else {
                    const key = (typeof getArrowKey === 'function') ? getArrowKey(dPadDir) : 'ArrowDown';
                    if (typeof sendDpadKeyEvent === 'function') {
                        sendDpadKeyEvent(key);
                    } else {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                        document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
                    }
                }
                triggerUniversalFullScreen();
            };

            // Попытка 1: исходное нажатие
            sendSlideStep();

            // Проверяем через 1 секунду
            setTimeout(() => {
                if (!slideshowActive || slideshowPaused || _isRewinding) return;
                if (location.href !== startUrl) return; // Успешно перелистнулось с 1-й попытки

                // Попытка 2: URL не изменился через 1 секунду
                console.log('[MOSSAD] Конец ленты? Попытка 2 (через 1с)...');
                sendSlideStep();

                // Проверяем через 3 секунды (на 4-й секунде от начала)
                setTimeout(() => {
                    if (!slideshowActive || slideshowPaused || _isRewinding) return;
                    if (location.href !== startUrl) return; // Успешно перелистнулось со 2-й попытки

                    // Попытка 3: URL всё ещё не изменился через 3 секунды
                    console.log('[MOSSAD] Конец ленты? Попытка 3 (на 4-й секунде)...');
                    sendSlideStep();

                    // Даем 1 секунду на завершение 3-й попытки
                    setTimeout(() => {
                        if (!slideshowActive || slideshowPaused || _isRewinding) return;
                        if (location.href !== startUrl) return; // Успешно перелистнулось с 3-й попытки

                        // URL так и не изменился после 3 попыток -> дошёл до конца ленты, упёрся
                        console.warn('[MOSSAD] Достигнут конец ленты (3 попытки без смены URL)');
                        if (config.loopFeed) {
                            showToast('🔄 Конец ленты: повтор плейлиста (R)...');
                            doRewind(() => {
                                if (slideshowActive && !slideshowPaused) {
                                    scheduleNextSlideCycle(0);
                                }
                            });
                        } else {
                            stopSlideshow();
                            showToast('⏹ Слайдшоу остановлено: конец ленты', true);
                        }
                    }, 1000);
                }, 3000);
            }, 1000);
        };

        // Скачивание перед перелистыванием
        if (config.downloadType !== 'none') {
            const hasVideo = getActiveVideo() !== null;
            const typeMatch = !(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo);
            if (typeMatch) {
                // 60-секундный guard от повторного скачивания одной страницы
                const _dlPageUrl = normUrlKey(location.href);
                const _dlLastUrl = sessionStorage.getItem('mossad_auto_dl_url');
                const _dlLastTime = parseInt(sessionStorage.getItem('mossad_auto_dl_time') || '0', 10);
                const _dlNow = Date.now();
                const _recentDl = (_dlLastUrl === _dlPageUrl) && (_dlNow - _dlLastTime < 60000);
                if (_recentDl) {
                    const secsAgo = Math.round((_dlNow - _dlLastTime) / 1000);
                    const _h = Array.isArray(config.hk?.download) ? config.hk.download[0] : config.hk?.download;
                    const _dlLabel = _h?.key ? `${_h.ctrl?'Ctrl+':''}${_h.alt?'Alt+':''}${_h.shift?'Shift+':''}${_h.key}` : 'DL';
                    showToast(`⚠️ ${secsAgo}с назад уже скачано. Повтор: ${_dlLabel}`);
                    advanceToNext();
                    return;
                } else {
                    sessionStorage.setItem('mossad_auto_dl_url', _dlPageUrl);
                    sessionStorage.setItem('mossad_auto_dl_time', String(_dlNow));
                    
                    let advanced = false;
                    const onDownloadComplete = () => {
                        if (advanced) return;
                        advanced = true;
                        if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                            setTimeout(() => window.close(), 1000);
                            return;
                        }
                        advanceToNext();
                    };

                    // Страховочный таймаут: если скачивание/сеть задерживается, продолжаем листание через 8с
                    const safetyTimer = setTimeout(() => {
                        console.warn('[MOSSAD] Auto-download wait timeout (8s), advancing slide');
                        onDownloadComplete();
                    }, 8000);

                    triggerDownload(false, null, () => {
                        clearTimeout(safetyTimer);
                        onDownloadComplete();
                    });
                    return;
                }
            }
        }

        advanceToNext();
    }

    function getPinMediaType() {
        if (rootDomain.includes('redgifs.com')) return 'video';

        // v1.3.51: Pinterest — сначала факты о ГЛАВНОМ пине (closeup), тип с карточки сетки — только подсказка
        // «ждать плеер». Раньше тип с карточки ('image') сразу запускал фото-таймер даже у видео-пина.
        if (rootDomain.includes('pinterest.')) {
            const pinData = getPinterestMainPinData();
            if (pinData.isFound && (pinData.type === 'video' || pinData.type === 'image')) return pinData.type;
            if (sessionStorage.getItem('mossad_expected_type') === 'video') return 'video';
            if (config.pinterestFilterType === 'video') return 'video';
            return 'unknown';
        }

        const expected = sessionStorage.getItem('mossad_expected_type');
        if (expected === 'video' || expected === 'image') return expected;
        // v1.3.42: сбор Grok пишет тип 'photo' (collect.js) — раньше он не распознавался и тип
        // угадывался по DOM, что на фото давало ложное «видео» и ожидание 6 с.
        if (expected === 'photo') return 'image';

        // Быстрое определение по кнопкам Grok (появляются раньше видео-плеера)
        if (rootDomain === 'grok.com') {
            // v1.3.43: кнопка «Make video» (у фото) — не признак видео
            const allBtns = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'))
                .filter(el => !/make\s*video/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' ')));
            const btnTexts = allBtns.map(el => (el.textContent || '').trim());
            const btnArias = allBtns.map(el => (el.getAttribute('aria-label') || '').toLowerCase());
            // "Удалить изображение" — железное подтверждение что это фото
            if (btnTexts.some(t => t === 'Удалить изображение' || t === 'Delete image')) return 'image';
            // Видео-признаки по кнопкам
            if (
                btnTexts.some(t => t === 'Удалить видео' || t === 'Delete video' || t === 'Продлить' || t === 'Extend') ||
                btnArias.some(a => a.includes('звук') || a.includes('sound') || a.includes('mute') || a.includes('unmute')) ||
                allBtns.some(el => /звук/i.test(el.textContent))
            ) return 'video';
        }

        // Проверяем видеоплееры (duplo-hls-video, story-pin, idea-pin, кнопки звука)
        if (document.querySelector('video, [data-test-id*="video"], [data-test-id*="story-pin"], [data-test-id*="idea-pin"], [data-test-id*="duplo-hls"], button[aria-label*="звук"], button[aria-label*="Sound"], button[aria-label*="Unmute"], .SoundButton')) {
            return 'video';
        }
        if (document.querySelector('meta[property="og:video"], meta[name="og:video"], meta[name="twitter:card"][content="player"]')) {
            return 'video';
        }
        const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of ldJsonScripts) {
            const txt = s.textContent || '';
            if (txt.includes('VideoObject') || txt.includes('video')) return 'video';
        }

        return 'unknown';
    }

    function scheduleNextSlideCycle(initSec, retryCount = 0) {
        if (!slideshowActive || slideshowPaused) return;
        // Прямой запуск цикла отменяет отложенный (requestSlideCycle), иначе он перезапустил бы счётчик позже
        if (_cycleStartTimer) { clearTimeout(_cycleStartTimer); _cycleStartTimer = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (slideshowTimeoutId) { clearTimeout(slideshowTimeoutId); slideshowTimeoutId = null; }
        
        // v1.3.42: Grok — своё быстрое определение (grokDecideSlideMedia). true — решение принято или
        // запланирована повторная проверка; иначе — элемент <video>, идём в общий путь видео.
        let grokVideo = null;
        if (rootDomain === 'grok.com' && typeof isGrokPostPage === 'function' && isGrokPostPage()) {
            const _pt = performance.now();
            const res = grokDecideSlideMedia(initSec, retryCount);
            mossadPerfStep('grokDecideSlideMedia', _pt);
            if (res === true) return;
            grokVideo = res; // найден свежий <video> просмотрщика — это видео, что бы ни говорил сбор
        }

        const detectedType = grokVideo ? 'video' : getPinMediaType();
        const video = grokVideo || getActiveVideo();

        if (detectedType === 'image') {
            // Мгновенный запуск фото-таймера на 0 миллисекунде
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer('photo-timer');
            return;
        }

        if (video) {
            if (video.paused) {
                try { video.play().catch(() => {}); } catch(e) {}
            }
            if (isNaN(video.duration) || video.duration === 0) {
                if (retryCount > 40) { // До 8 секунд ожидания параметров видео
                     triggerNextSlide('video-meta-timeout');
                     return;
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            // v1.3.38: на Grok сразу после перехода ещё может стоять <video> ПРЕДЫДУЩЕГО поста (тот же src).
            // Ждём смены src (до ~3 с), иначе считали бы круги старого ролика.
            const slideKey = slideKeyOf(location.href);
            const vSrc = video.currentSrc || video.src || '';
            if (rootDomain === 'grok.com' && _lastCycleSlideKey && slideKey !== _lastCycleSlideKey &&
                vSrc && vSrc === _lastCycleVideoSrc && retryCount < 15) {
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            _lastCycleSlideKey = slideKey;
            _lastCycleVideoSrc = vSrc;
            sessionStorage.removeItem('mossad_expected_type');
            isCountingDown = false;
            currentVideoNode = video;
            lastActiveVideo = video;
            videoInitialDuration = video.duration;
            currentLoopCount = 0;
            accumulatedTime = 0;
            lastTime = video.currentTime;
            lastRAFTime = performance.now();
            _videoReachedEndZone = false;
            _videoDetachedSince = 0;
            _endedConsumed = false;
            if (video.ended) {
                // Ролик уже закончился (не зациклен) — начинаем круг заново, а не засчитываем мгновенно
                try { video.currentTime = 0; video.play().catch(() => {}); } catch(e) {}
            }
            mossadDebug('cycle', 'старт подсчёта кругов видео', { need: config.videoLoops, dur: Math.round(video.duration * 10) / 10 });
            rafId = requestAnimationFrame(checkVideoLoops);
        } else if (rootDomain.includes('pinterest.')) {
            // v1.3.51: Pinterest — картинка и признаки видео только у главного пина (не в сетке похожих).
            // Есть плеер/кнопка звука — ждём <video> до 6 с; карточка сказала «видео» — до 3 с; иначе 0.5 с.
            const mainImg = pinterestMainImage();
            const signs = pinterestHasVideoSigns();
            const cap = signs ? 60 : (detectedType === 'video' ? 30 : 5);
            if (retryCount < cap || (!mainImg && retryCount < 60)) {
                if ((signs || detectedType === 'video') && retryCount > 0 && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка видео-плеера... (${Math.floor(retryCount / 10)}/${Math.round(cap / 10)}с)`);
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 100);
                return;
            }
            pinterestRememberType('image');
            startPhotoCountdown(initSec, 'pinterest: нет видео у главного пина');
        } else {
            // Если в DOM уже есть главная картинка пина и нет контейнеров видео
            const stage = document.querySelector('div[data-test-id="closeup-stage"], div[data-test-id="pin-closeup"], div[role="main"]');
            const mainImg = stage ? stage.querySelector('img') : null;
            const hasVideoElements = document.querySelector('div[data-test-id="video-player"], div[data-test-id="story-pin-video"], button[aria-label*="звук"], button[aria-label*="Sound"], .SoundButton');

            if (detectedType === 'unknown' && mainImg && !hasVideoElements && retryCount >= 5) {
                // Запуск фото-таймера после 500мс проверки картинки
                sessionStorage.removeItem('mossad_expected_type');
                countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
                isCountingDown = true;
                runPhotoTimer('photo-timer');
                return;
            }

            // Ожидание монтирования <video> (для видео-пинов)
            const isVideoExpected = (detectedType === 'video' || (rootDomain.includes('pinterest.') && config.pinterestFilterType === 'video'));
            const maxWaitAttempts = isVideoExpected ? 60 : 15; // 6 сек для видео, 1.5 сек для остальных

            if (retryCount < maxWaitAttempts) {
                if (isVideoExpected && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка HLS видео-плеера... (${Math.floor(retryCount / 10)}/6с)`);
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 100);
                return;
            }

            // Фолбэк на фото
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer('photo-timer');
        }
    }

    // ── v1.3.42: определение «видео или фото» на Grok ──
    // Видео: свежий <video> просмотрщика (не кадр киноплёнки, src не от прошлого слайда) — сразу.
    // Фото: нет свежего <video> и нет кнопки mute/unmute плеера (в т.ч. скрытой), страница «устоялась»
    // (readyState complete + URL на целевом посте) и прошло короткое окно с момента прибытия:
    // GROK_PHOTO_GRACE_MS (тип по сбору — фото) или GROK_UNKNOWN_GRACE_MS (тип неизвестен). Опрос — 100 мс.
    // Если ролик смонтируется позже, монитор URL/видео (setInterval 250 мс выше) перезапустит цикл
    // и слайд пойдёт как видео. ANTI_PATTERNS §21.
    const GROK_PHOTO_GRACE_MS   = 450;  // сбор сказал «фото» (нет таймера на карточке)
    const GROK_UNKNOWN_GRACE_MS = 700;  // тип неизвестен
    const GROK_STALE_WAIT_MS    = 3000; // ждать смены старого <video> / «устаканивания» URL не дольше
    const GROK_VIDEO_WAIT_MS    = 6000; // сбор сказал «видео» или есть кнопка звука, а <video> ещё нет
    const GROK_DETECT_POLL_MS   = 100;
    let _grokDetectStartedAt = 0;
    const GROK_STALL_MS      = 1500;  // v1.3.43: время видео не идёт столько — восстанавливаем
    const GROK_STALL_SKIP_MS = 10000; // не помогло — следующий слайд
    let _stallNode = null, _stallCt = -1, _stallSince = 0, _stallLastFix = 0;

    /**
     * v1.3.43: сброс «памяти» прошлых слайдов при повторе (круг слайдшоу / перемотка ленты в начало).
     * Те же посты показываются снова: src «прошлого видео» и lastActiveVideo из прошлого круга не
     * должны влиять на первый слайд нового круга.
     */
    function resetSlideTrackingState(reason) {
        mossadDebug('cycle', 'сброс состояния слайдов (повтор)', { reason });
        _lastCycleSlideKey = '';
        _lastCycleVideoSrc = '';
        lastActiveVideo = null;
        _stallNode = null;
        _grokDetectStartedAt = 0;
    }
    window.resetSlideTrackingState = resetSlideTrackingState;

    function startPhotoCountdown(initSec, why) {
        sessionStorage.removeItem('mossad_expected_type');
        countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
        isCountingDown = true;
        mossadDebug('cycle', 'фото: старт таймера', { why, sec: countdownSeconds });
        runPhotoTimer('photo-timer');
    }

    /** true — решение принято/перепроверка запланирована; <video> — продолжить общий путь видео с ним. */
    function grokDecideSlideMedia(initSec, retryCount) {
        const now = Date.now();
        if (retryCount === 0 || !_grokDetectStartedAt) _grokDetectStartedAt = now;
        const slideKey = slideKeyOf(location.href);
        const staleSrc = (_lastCycleSlideKey && slideKey !== _lastCycleSlideKey) ? _lastCycleVideoSrc : '';
        const d = grokDetectSlideMedia(staleSrc);
        const expectedRaw = sessionStorage.getItem('mossad_expected_type');
        const expected = expectedRaw === 'photo' ? 'image' : expectedRaw;
        // Окно отсчитываем от прибытия на пост (его фиксирует grokEndNav), а при загрузке страницы — от начала проверки
        const curUuid = grokExtractUuid(location.pathname);
        const arrived = (typeof _galleryNav !== 'undefined' && _galleryNav.arrivedAt && _galleryNav.arrivedAt <= _grokDetectStartedAt + 50 &&
                         now - _galleryNav.arrivedAt < 15000 && (!_galleryNav.targetUuid || _galleryNav.targetUuid === curUuid))
            ? _galleryNav.arrivedAt : _grokDetectStartedAt;
        const sinceArrival = now - arrived;
        const sinceStart = now - _grokDetectStartedAt;
        const again = () => {
            slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), GROK_DETECT_POLL_MS);
            return true;
        };

        if (d.video) {
            mossadDebug('cycle', 'Grok: видео найдено', { ms: sinceStart, expected });
            return d.video; // общий путь видео (ждёт duration, считает круги)
        }
        if (d.imageBtn) {
            startPhotoCountdown(initSec, 'кнопка «Удалить изображение»');
            return true;
        }
        // v1.3.43: «Make video» есть только у фото. Если сбор сказал «видео» — не верим кнопке
        // (ждём <video>, как ниже); иначе — фото сразу, без окна ожидания.
        if (d.makeVideoBtn && (!d.staleVideo || curImg) && expected !== 'video' && d.settled) {
            startPhotoCountdown(initSec, 'кнопка «Make video»');
            return true;
        }
        const curImg = !!(d.mainImg && curUuid && (d.mainImg.currentSrc || d.mainImg.src || '').toLowerCase().includes(curUuid));
        if (d.staleVideo && !curImg) {
            // На экране ещё ролик прошлого слайда: ждём смены (как в v1.3.38), затем — по признакам.
            // v1.3.43: если уже видна картинка именно этого поста — старый ролик не ждём.
            if (sinceStart < GROK_STALE_WAIT_MS) return again();
            if (expected === 'image' && d.mainImg) { startPhotoCountdown(initSec, 'старое видео не сменилось, сбор: фото'); return true; }
            return d.staleVideo; // как раньше: принимаем ролик как видео этого слайда
        }
        if (expected === 'video' || d.soundBtn) {
            // Плеер монтируется: ждём <video>. Сбор «видео» — до 6 с (HLS бывает медленным);
            // одна кнопка звука без подтверждения сбором — до 3 с.
            const cap = expected === 'video' ? GROK_VIDEO_WAIT_MS : GROK_STALE_WAIT_MS;
            if (sinceStart < cap) {
                if (expected === 'video' && retryCount > 0 && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка видео-плеера... (${Math.floor(sinceStart / 1000)}/${cap / 1000}с)`);
                }
                return again();
            }
            mossadDebug('cycle', 'Grok: видео так и не появилось — считаем фото', { ms: sinceStart, expected, soundBtn: !!d.soundBtn });
            startPhotoCountdown(initSec, 'нет <video> за ' + cap + ' мс');
            return true;
        }
        // Нет ни видео, ни кнопки звука → фото, как только страница устоялась и прошло окно
        const grace = expected === 'image' ? GROK_PHOTO_GRACE_MS : GROK_UNKNOWN_GRACE_MS;
        if (!d.settled && sinceStart < GROK_STALE_WAIT_MS) return again();
        if (!d.mainImg && sinceStart < GROK_UNKNOWN_GRACE_MS * 2) return again(); // картинка ещё не отрисовалась
        if (sinceArrival < grace || sinceStart < 100) return again();
        mossadDebug('cycle', 'Grok: фото определено', { ms: sinceStart, sinceArrival, expected, img: !!d.mainImg });
        startPhotoCountdown(initSec, 'нет <video> и кнопки звука');
        return true;
    }

    function checkVideoLoops(timeNow) {
        rafId = null;
        if (!slideshowActive || slideshowPaused) return;
        if (!currentVideoNode || !document.body.contains(currentVideoNode)) {
            // v1.3.38: элемент перемонтирован — пробуем перепривязаться к новому <video> без сброса счётчика
            const replacement = getActiveVideo();
            if (currentVideoNode && replacement && replacement !== currentVideoNode) {
                rebindVideoNode(replacement, 'detached');
                if (!rafId) rafId = requestAnimationFrame(checkVideoLoops);
                return;
            }
            if (!_videoDetachedSince) _videoDetachedSince = timeNow || performance.now();
            if ((timeNow || performance.now()) - _videoDetachedSince < 2000) {
                rafId = requestAnimationFrame(checkVideoLoops);
                return;
            }
            mossadDebug('cycle', 'видео исчезло >2с — перезапуск цикла');
            scheduleNextSlideCycle(0); // Видео исчезло надолго, перезапуск логики
            return;
        }
        _videoDetachedSince = 0;

        // v1.3.43: «замёрзшее» видео на Grok (время не идёт > GROK_STALL_MS — на паузе не по воле
        // пользователя или без данных). После повтора круга Grok держал в DOM старый элемент того же
        // поста; счётчик кругов смотрел на него, таймер стоял на 1 с. Порядок восстановления:
        // перепривязка к лучшему <video>; если другого нет и ролик НЕ на паузе (застрял) — play(),
        // через GROK_STALL_SKIP_MS — следующий слайд. На паузе без другого ролика — ждём (пауза пользователя).
        if (rootDomain === 'grok.com') {
            const nowS = timeNow || performance.now();
            const ctS = currentVideoNode.currentTime;
            if (_stallNode !== currentVideoNode || Math.abs(ctS - _stallCt) > 0.01) {
                _stallNode = currentVideoNode; _stallCt = ctS; _stallSince = nowS; _stallLastFix = 0;
            } else if (!currentVideoNode._mossadUserPaused && nowS - _stallSince > GROK_STALL_MS && nowS - _stallLastFix > 700) {
                _stallLastFix = nowS;
                const act = getActiveVideo();
                if (act && act !== currentVideoNode) {
                    mossadDebug('loop', 'видео стоит — перепривязка к другому <video>', { ms: Math.round(nowS - _stallSince), paused: currentVideoNode.paused });
                    rebindVideoNode(act, 'stall');
                    if (!rafId) rafId = requestAnimationFrame(checkVideoLoops);
                    return;
                }
                // На паузе и другого видео нет — это, скорее всего, пауза пользователя (клик по ролику): ждём, как раньше
                if (currentVideoNode.paused) { /* ждём */ }
                else if (nowS - _stallSince > GROK_STALL_SKIP_MS) {
                    mossadDebug('loop', 'видео стоит слишком долго — следующий слайд', { ms: Math.round(nowS - _stallSince) });
                    _stallNode = null;
                    triggerNextSlide('video-stall');
                    return;
                }
                else {
                    mossadDebug('loop', 'видео стоит (не на паузе) — play()', { ms: Math.round(nowS - _stallSince) });
                    try { currentVideoNode.play().catch(() => {}); } catch (e) {}
                }
            }
        }

        // Если видео на паузе: либо пользователь поставил паузу (ждём), либо мы следим не за тем элементом
        if (currentVideoNode.paused) {
            const now = timeNow || performance.now();
            if (rootDomain === 'grok.com' && now - _lastRebindCheck > 500) {
                _lastRebindCheck = now;
                const act = getActiveVideo();
                if (act && act !== currentVideoNode && !act.paused) {
                    rebindVideoNode(act, 'paused-other-playing');
                    if (rafId) return; // rebind уже запланировал следующий кадр
                }
            }
            lastRAFTime = timeNow;
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const ct = currentVideoNode.currentTime;
        const effDuration = liveVideoDuration(currentVideoNode);

        if (effDuration <= 0) {
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const isEnded = !!currentVideoNode.ended;
        if (!isEnded) _endedConsumed = false;

        // Финальная зона ролика (последние 0.45с либо нативное событие ended)
        const isAtEnd = isEnded || (ct >= Math.max(0.5, effDuration - 0.45));
        if (isAtEnd) {
            _videoReachedEndZone = true;
        }

        // Завершение одного цикла/круга видео
        let loopCompleted = false;
        if (isEnded && !_endedConsumed) {
            loopCompleted = true;
            _endedConsumed = true; // ended остаётся true до следующего play() — засчитываем один раз
        } else if (!isEnded && _videoReachedEndZone && ct < 1.0 && ct < lastTime) {
            // Видео было в финальной зоне и зациклилось на начало (время реально «откатилось» на этом же
            // элементе; v1.3.38: без ct < lastTime короткие ролики <1.45 с засчитывали круг прямо в финальной зоне)
            loopCompleted = true;
        } else if (rootDomain.includes('pinterest.') && config.pinterestMaxVideoDuration > 0 && ct >= config.pinterestMaxVideoDuration) {
            // Pinterest лимит длительности
            loopCompleted = true;
        }

        if (loopCompleted) {
            currentLoopCount++;
            _videoReachedEndZone = false;
            lastTime = ct;
            mossadDebug('loop', `круг видео ${currentLoopCount}/${config.videoLoops}`, { ended: isEnded });
            if (currentLoopCount >= config.videoLoops) {
                // Все круги завершены: запускаем паузу после видео
                countdownSeconds = config.delayAfterVideo;
                mossadDebug('loop', 'все круги видео завершены', { loops: currentLoopCount, need: config.videoLoops });
                if (countdownSeconds > 0) {
                    isCountingDown = true;
                    runPhotoTimer('video-loops-done');
                } else {
                    triggerNextSlide('video-loops-done');
                }
                return;
            }
            if (isEnded) {
                // Незацикленный ролик: запускаем следующий круг сами
                try { currentVideoNode.currentTime = 0; currentVideoNode.play().catch(() => {}); } catch(e) {}
            }
        }

        lastTime = ct;
        lastRAFTime = timeNow;
        rafId = requestAnimationFrame(checkVideoLoops);
    }

    function runPhotoTimer(reason = 'photo-timer') {
        if (!slideshowActive || slideshowPaused) return;
        if (countdownSeconds <= 0) {
            isCountingDown = false;
            triggerNextSlide(reason);
            return;
        }
        slideshowTimeoutId = setTimeout(() => {
            countdownSeconds--;
            runPhotoTimer(reason);
        }, 1000);
    }

    // ============================================
    // TAB SWITCH & BROWSER FOCUS LISTENERS (Tab / Brsr)
    // ============================================
    let _pausedByTab = false;
    let _pausedByBrsr = false;

    function pauseAllSlideshows(reason) {
        if (window._mossadNavigating ||
            sessionStorage.getItem('mossad_navigating_group') === 'true' ||
            sessionStorage.getItem(SESSION_NAV_KEY) === 'true') {
            return; // Не ставить на паузу при автоматическом переходе между группами / слайдами
        }
        let anyPaused = false;
        if (slideshowActive && !slideshowPaused) {
            slideshowPaused = true;
            cancelSlideTimers();
            anyPaused = true;
        }
        if (window._mossadGalleryActive && !window._mossadGalleryPaused) {
            window._mossadGalleryPaused = true;
            updateGalleryStatusBtn('paused');
            anyPaused = true;
        }
        if (anyPaused) {
            if (reason === 'tab') _pausedByTab = true;
            if (reason === 'brsr') _pausedByBrsr = true;
            if (window.updateWidgetUI) window.updateWidgetUI();
        }
    }

    function resumeAllSlideshows(reason) {
        if (reason === 'tab' && _pausedByTab) {
            _pausedByTab = false;
            if (_pausedByBrsr) return;
        } else if (reason === 'brsr' && _pausedByBrsr) {
            _pausedByBrsr = false;
            if (_pausedByTab) return;
        } else {
            return;
        }

        // Если пауза была установлена пользователем вручную — не снимаем
        const manualPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' || sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';
        if (manualPaused) return;

        if (slideshowActive) {
            slideshowPaused = false;
            requestSlideCycle(0, 'resume:' + reason);
        }
        if (window._mossadGalleryActive) {
            window._mossadGalleryPaused = false;
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            requestSlideCycle(0, 'resume:' + reason);
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }

    window.addEventListener('beforeunload', () => {
        window._mossadNavigating = true;
    });
    window.addEventListener('pagehide', () => {
        window._mossadNavigating = true;
    });

    document.addEventListener('visibilitychange', () => {
        if (!config.stopOnTabSwitch) return;
        if (document.hidden) {
            pauseAllSlideshows('tab');
        } else {
            resumeAllSlideshows('tab');
        }
    });

    window.addEventListener('blur', () => {
        if (!config.stopOnBrsrSwitch) return;
        pauseAllSlideshows('brsr');
    });

    window.addEventListener('focus', () => {
        if (!config.stopOnBrsrSwitch) return;
        resumeAllSlideshows('brsr');
    });

