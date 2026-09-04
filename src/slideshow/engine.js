    // ============================================
    // SLIDESHOW LOGIC (AUTO) & SESSION PERSISTENCE
    // ============================================
    const SESSION_ACTIVE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`;
    const SESSION_STATE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_wstate`;

    let slideshowActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
    let slideshowPaused = false;
    let slideshowTimeoutId = null;
    let downloadTimeoutId = null;
    let countdownSeconds = 0;
    let isCountingDown = false; // Отсчет времени после видео или для фото
    
    // Вспомогательные переменные для циклов
    let currentVideoNode = null;
    let videoInitialDuration = 0;
    let currentLoopCount = 0;
    let accumulatedTime = 0;
    let lastTime = 0;
    let lastRAFTime = 0;
    let rafId = null;
    let _lastDownloadUrl = null;     // защита от повторного скачивания одного файла
    let _lastDownloadTime = 0;
    const _filenameCounter = new Map(); // счётчик по базовому имени → (001)(002)...
    let _samePageSlideCount = 0;     // счётчик попыток перелистнуть с одной и той же страницы
    let _lastSlideUrl = '';          // URL во время последнего triggerNextSlide
    const SAME_PAGE_LIMIT = 3;       // сколько раз пробовать перед остановкой
    function getActiveVideo() {
        let videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        
        // На Пинтересте ищем видео в главном контейнере сцены пина (closeup-stage / main)
        if (rootDomain.includes('pinterest.')) {
            const mainStage = document.querySelector('div[data-test-id="closeup-stage"], div[data-test-id="pin-closeup"], div[role="main"], div[data-test-id="story-pin-closeup-container"]');
            if (mainStage) {
                const stageVideo = mainStage.querySelector('video');
                if (stageVideo) return stageVideo;
            }

            videos = videos.filter(v => {
                const isRec = v.closest('div[data-grid-item], div[data-test-id="pin-card"], div[data-test-id="related-pins"], div[data-test-id="search-feed"]');
                return !isRec;
            });
            if (videos.length === 0) return null;
        }

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

            // 2. Grok: кнопка Full Screen
            if (rootDomain === 'grok.com') {
                const fsKeywords = ['во весь экран', 'полноэкран', 'full screen', 'fullscreen'];
                const btn = (typeof findGrokButton === 'function' ? findGrokButton(fsKeywords) : null)
                    || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        const title = (b.getAttribute('title') || '').toLowerCase();
                        return fsKeywords.some(k => aria.includes(k) || title.includes(k));
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

    setInterval(() => {
        if (!slideshowActive) return;
        
        const currentUrl = location.href;
        const currentVideo = getActiveVideo();
        
        const urlChanged = currentUrl !== lastUrlForSlideshow;
        const videoChanged = currentVideo !== lastActiveVideo && (currentVideo !== null || lastActiveVideo !== null);
        
        if (urlChanged || videoChanged) {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;
            
            if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
            if (rafId) cancelAnimationFrame(rafId);
            
            // Сбрасываем таймер в интерфейсе немедленно!
            isCountingDown = false;
            countdownSeconds = 0;

            if (urlChanged) {
                triggerUniversalFullScreen();
            }
            
            // Ждем чуть-чуть, чтобы SPA успело обновить DOM
            setTimeout(() => {
                if (slideshowActive) scheduleNextSlideCycle(0);
            }, 100);
        } else {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;
        }
    }, 100);

    function stopSlideshow() {
        slideshowActive = false;
        slideshowPaused = false;
        isCountingDown = false;
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_STATE_KEY);
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (downloadTimeoutId) clearTimeout(downloadTimeoutId);
        if (rafId) cancelAnimationFrame(rafId);
        if (rootDomain === 'grok.com') {
            _gSS.removeItem(GALLERY_SS_KEY);
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            const ind = document.getElementById('mossad-gallery-indicator');
            if (ind) ind.remove();
            const btnSS = document.getElementById('mossad-gallery-ss');
            if (btnSS) {
                btnSS.textContent = '🎲 Слайдшоу';
                btnSS.style.background = '#1e3a5f';
                btnSS.style.color = '#93c5fd';
            }
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
                const ind = document.getElementById('mossad-gallery-indicator');
                if (ind) ind.remove();
            }
            slideshowActive = true;
            slideshowPaused = false;
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            sessionStorage.setItem(SESSION_STATE_KEY, 'bar');
            // Закрываем модальное окно настроек горячих клавиш (если открыто)
            const hkModal = document.getElementById('mossad-hk-modal');
            if (hkModal) hkModal.remove();
            // Сворачиваем виджет в компактную полоску (bar)
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

    function triggerNextSlide() {
        if (!slideshowActive || slideshowPaused) return;
        const dirs = config.slideshowDirections;
        if (!dirs || dirs.length === 0) { stopSlideshow(); return; }

        // Защита от зацикливания на конце ленты
        const curUrl = location.href;
        if (curUrl === _lastSlideUrl) {
            _samePageSlideCount++;
            if (_samePageSlideCount > SAME_PAGE_LIMIT) {
                console.warn('[MOSSAD] Превышен лимит перелистываний без смены страницы, остановка.');
                stopSlideshow();
                showToast('⏹ Слайдшоу остановлен: конец ленты', true);
                return;
            }
        } else {
            _samePageSlideCount = 0;
            _lastSlideUrl = curUrl;
        }

        // Скачивание перед перелистыванием
        if (config.downloadType !== 'none') {
            const hasVideo = getActiveVideo() !== null;
            if (!(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo)) {
                triggerDownload();
                if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                    setTimeout(() => window.close(), 1000);
                    return;
                }
            }
        }
        
        // Gallery Slideshow: вместо клавиши — переходим на следующий URL из очереди
        if (window._mossadGalleryActive && typeof window._mossadGalleryNextFn === 'function') {
            // Скачивание (если включено) перед переходом
            if (config.downloadType !== 'none') {
                const hasVideo = getActiveVideo() !== null;
                if (!(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo)) {
                    triggerDownload();
                }
            }
            window._mossadGalleryNextFn();
            return;
        }

        // Pinterest ссылочная навигация
        if (rootDomain.includes('pinterest.')) {
            selectNextPinterestPin('next');
            return;
        }

        // Листание
        const key = getArrowKey(dirs[0]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        triggerUniversalFullScreen();
        setTimeout(() => {
            scheduleNextSlideCycle(0);
        }, 500);
    }

    function getPinMediaType() {
        const expected = sessionStorage.getItem('mossad_expected_type');
        if (expected === 'video' || expected === 'image') return expected;

        if (rootDomain.includes('pinterest.')) {
            const pinData = getPinterestMainPinData();
            if (pinData.isFound && (pinData.type === 'video' || pinData.type === 'image')) {
                return pinData.type;
            }
            if (config.pinterestFilterType === 'video') return 'video';
            if (config.pinterestFilterType === 'image') return 'image';
        }

        // Быстрое определение по кнопкам Grok (появляются раньше видео-плеера)
        if (rootDomain === 'grok.com') {
            const allBtns = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
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
        if (rafId) cancelAnimationFrame(rafId);
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        
        const detectedType = getPinMediaType();
        const video = getActiveVideo();

        if (detectedType === 'image') {
            // Мгновенный запуск фото-таймера на 0 миллисекунде
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer();
            return;
        }

        if (video) {
            if (isNaN(video.duration) || video.duration === 0) {
                if (retryCount > 40) { // До 8 секунд ожидания параметров видео
                     triggerNextSlide();
                     return;
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            sessionStorage.removeItem('mossad_expected_type');
            isCountingDown = false;
            currentVideoNode = video;
            videoInitialDuration = video.duration;
            currentLoopCount = 0;
            accumulatedTime = 0;
            lastTime = video.currentTime;
            lastRAFTime = performance.now();
            rafId = requestAnimationFrame(checkVideoLoops);
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
                runPhotoTimer();
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
            runPhotoTimer();
        }
    }

    function checkVideoLoops(timeNow) {
        if (!slideshowActive || slideshowPaused) return;
        if (!currentVideoNode || !document.body.contains(currentVideoNode)) {
            scheduleNextSlideCycle(0); // Видео исчезло, перезапуск логики
            return;
        }
        
        // Если пользователь поставил видео на паузу — ставим отсчет слайдшоу на паузу!
        if (currentVideoNode.paused) {
            lastRAFTime = timeNow;
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const ct = currentVideoNode.currentTime;
        if (ct < lastTime) {
            // Произошел луп
            currentLoopCount++;
            accumulatedTime = 0;
        } else {
            const delta = (timeNow - lastRAFTime) / 1000;
            accumulatedTime += delta;
        }
        
        lastTime = ct;
        lastRAFTime = timeNow;
        
        // Лимит времени с учетом количества кругов (videoLoops * maxVideoDuration)
        const maxDurationCap = (rootDomain.includes('pinterest.') && config.pinterestMaxVideoDuration > 0)
            ? (config.videoLoops * config.pinterestMaxVideoDuration)
            : (config.videoLoops * videoInitialDuration);

        if (currentLoopCount >= config.videoLoops || accumulatedTime >= maxDurationCap) {
            // Циклы или лимит времени завершены, запускаем паузу после видео
            countdownSeconds = config.delayAfterVideo;
            isCountingDown = true;
            runPhotoTimer();
            return;
        }
        
        rafId = requestAnimationFrame(checkVideoLoops);
    }

    function runPhotoTimer() {
        if (!slideshowActive || slideshowPaused) return;
        if (countdownSeconds <= 0) {
            isCountingDown = false;
            triggerNextSlide();
            return;
        }
        slideshowTimeoutId = setTimeout(() => {
            countdownSeconds--;
            runPhotoTimer();
        }, 1000);
    }

