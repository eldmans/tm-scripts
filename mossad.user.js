// ==UserScript==
// @name         MOSSAD (Media Objects Slideshow and Download)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Универсальный скрипт для авто-слайдшоу, скачивания медиа и горячих клавиш.
// @author       Antigravity
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @match        *://civitai.red/*
// @match        *://*.civitai.red/*
// @match        *://vkvideo.ru/*
// @match        *://*.vkvideo.ru/*
// @match        *://vk.video/*
// @match        *://*.vk.video/*
// @match        *://*.pinterest.com/*
// @match        *://*.pinterest.ru/*
// @match        *://*.pinterest.*/*
// @match        *://hot.noodlemagazine.com/*
// @match        *://*.noodlemagazine.com/*
// @match        *://noodlemagazine.com/*
// @match        *://redgifs.com/*
// @match        *://*.redgifs.com/*
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      pinimg.com
// @connect      *.pinimg.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    console.log('%c[MOSSAD v1.0.0] Скрипт загружен', 'color:#10b981; font-weight:bold');

    const hostname = location.hostname.toLowerCase();
    
    function getRootDomain(host) {
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }
    const rootDomain = getRootDomain(hostname);
    const STORAGE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_config`;

    // ============================================
    // СИСТЕМА НАСТРОЕК
    // ============================================
    const DEFAULT_CONFIG = {
        slideshowMode: 'auto',
        slideshowOrientation: 'h',
        slideshowLoopMode: 'off',
        slideshowDirections: ['right'], // default dpad
        videoLoops: 1,
        slideshowDelay: 12, // для фото
        delayAfterVideo: 2, // задержка после видео
        downloadType: 'none',
        pdAction: 'none', // '-', '+1' (up), 'del'
        stopOnTabSwitch: false,
        stopOnBrsrSwitch: true,
        deleteAutoconfirm: false,
        deleteHoldpost: false,
        
        hk: {
            download:       { key: 'PageDown',   ctrl: false, alt: false, shift: false },
            upscale:        { key: 'PageUp',     ctrl: false, alt: false, shift: false },
            deleteVid:      { key: 'Delete',     ctrl: false, alt: false, shift: false },
            sound:          { key: 'ScrollLock', ctrl: false, alt: false, shift: false },
            playPause:      { key: 'Pause',      ctrl: false, alt: false, shift: false },
            help:           { key: 'F1',         ctrl: false, alt: false, shift: false },
            history:        { key: 'Home',       ctrl: false, alt: false, shift: false },
            slideshowPanel: { key: 'Insert',     ctrl: true,  alt: false, shift: false },
            slideshowStart: { key: 'Insert',     ctrl: false, alt: false, shift: false },
            focusWidget:    { key: 'F7',         ctrl: false, alt: false, shift: false },
        }
    };

    let config = {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        config = stored ? JSON.parse(stored) : {};
    } catch (e) {}

    function mergeDeep(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], mergeDeep(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }
    config = mergeDeep({...DEFAULT_CONFIG}, config);
    // Сброс при рефреше страницы
    config.downloadType = 'none';

    const Settings = {
        get: () => config,
        save: () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            if (window.updateWidgetUI) window.updateWidgetUI();
        },
        set: (key, val) => {
            config[key] = val;
            Settings.save();
        },
    };

    window.addEventListener('storage', (ev) => {
        if (ev.key !== STORAGE_KEY || window.capturingFor !== null) return;
        try { 
            const nc = JSON.parse(ev.newValue); 
            if (nc) {
                Object.assign(config, nc);
                if (window.updateWidgetUI) window.updateWidgetUI();
            } 
        } catch {}
    });

    function formatHotkey(hk) {
        if (!hk || !hk.key) return '—';
        const parts = [];
        if (hk.ctrl)  parts.push('Ctrl');
        if (hk.alt)   parts.push('Alt');
        if (hk.shift) parts.push('Shift');
        parts.push(hk.key);
        return parts.join('+');
    }
    function hotkeyMatches(e, hk) {
        if (!hk || !hk.key) return false;
        return e.key === hk.key && !!e.ctrlKey === !!hk.ctrl && !!e.altKey === !!hk.alt && !!e.shiftKey === !!hk.shift;
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    function showToast(message, isError = false) {
        let toast = document.getElementById('mossad-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mossad-toast';
            toast.style.cssText = `
                position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999999;
                padding: 10px 18px; background: rgba(20, 20, 20, 0.92); backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; color: #ffffff;
                font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none;
                transition: opacity 0.2s ease; opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.borderColor = isError ? '#ef4444' : '#10b981';
        toast.style.color = isError ? '#fca5a5' : '#6ee7b7';
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3500);
    }

    // ============================================
    // NOODLE MAGAZINE MODULE
    // ============================================
    if (rootDomain === 'noodlemagazine.com') {
        const noodleCSS = `
            .c_video > div[data-noscript], .c_video > div:not(.video_player), .fh-button,
            a[href*="faphouse.com"], a[href*="join"], .join-now, div:has(> a[href*="faphouse"]) {
                display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important;
                margin: 0 !important; padding: 0 !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important;
            }
            .c_video { width: 100% !important; max-width: 100% !important; display: block !important; height: auto !important; flex: 1 1 100% !important; }
            .c_video > .video_player { width: 100% !important; max-width: 100% !important; aspect-ratio: 16 / 9 !important; height: auto !important; min-height: 420px !important; margin: 0 auto !important; }
            .c_video .player_wrap, .c_video .video_player iframe, .c_video .video_player video, .c_video .video_player #player, .c_video .video_player .plyr {
                width: 100% !important; height: 100% !important; min-height: 100% !important; padding-bottom: 0 !important;
            }
        `;
        let style = document.createElement('style');
        style.textContent = noodleCSS;
        document.head.appendChild(style);
        function cleanupJoinNow() {
            document.querySelectorAll('.fh-button, a[href*="faphouse.com"], .c_video > div[data-noscript]').forEach(el => { el.style.setProperty('display', 'none', 'important'); el.remove(); });
        }
        setInterval(cleanupJoinNow, 500);
    }

    // ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function downloadBlobMedia(url, filename) {
        showToast('📥 Скачивание...');
        if (typeof GM_download === 'function') {
            try {
                GM_download({
                    url: url, name: filename,
                    onload: () => showToast('✅ Сохранено!'),
                    onerror: () => fetchAndDownloadBlob(url, filename)
                });
                return;
            } catch (e) {}
        }
        fetchAndDownloadBlob(url, filename);
    }

    function fetchAndDownloadBlob(url, filename) {
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET', url: url, responseType: 'blob',
                onload: function (response) {
                    if (response.status === 200 && response.response) {
                        saveBlobToDisk(response.response, filename);
                    } else { fetchBlobFallback(url, filename); }
                },
                onerror: function () { fetchBlobFallback(url, filename); }
            });
        } else { fetchBlobFallback(url, filename); }
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => res.blob()).then(blob => saveBlobToDisk(blob, filename))
        .catch(err => {
            showToast('⚠️ Прямое скачивание недоступно, открыто в новой вкладке', true);
            window.open(url, '_blank');
        });
    }

    function saveBlobToDisk(blob, filename) {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        showToast('✅ Сохранено!');
    }

    function findMediaForDownload() {
        if (rootDomain.includes('pinterest.')) {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                const txt = s.textContent || '';
                if (txt.includes('expMp4')) {
                    const expMp4Match = txt.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+\/expMp4\/[^\s"',]+\.mp4/g);
                    if (expMp4Match) return { url: expMp4Match[0].replace(/\\/g, ''), type: 'video' };
                }
            }
            const sigEl = document.querySelector('[data-video-signature]');
            if (sigEl) {
                const sig = sigEl.getAttribute('data-video-signature');
                if (sig && sig.length >= 6) return { url: `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`, type: 'video' };
            }
        }
        const video = document.querySelector('video');
        if (video) {
            const src = video.currentSrc || video.src || (video.querySelector('source') && video.querySelector('source').src);
            if (src && !src.startsWith('blob:')) return { url: src, type: 'video' };
        }
        const img = document.querySelector('img[src*="pinimg.com/originals/"]') || document.querySelector('img[src*="pinimg.com/736x/"]') || document.querySelector('img');
        if (img && img.src) {
            const fullImg = img.src.replace(/\/736x\//, '/originals/').replace(/\/474x\//, '/originals/');
            return { url: fullImg, type: 'image' };
        }
        return null;
    }

    function triggerDownload() {
        const media = findMediaForDownload();
        if (!media) { showToast('❌ Медиа не найдено', true); return; }
        const ext = media.type === 'video' ? 'mp4' : 'jpg';
        const filename = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${ext}`;
        downloadBlobMedia(media.url, filename);
    }

    // ============================================
    // SLIDESHOW LOGIC (AUTO)
    // ============================================
    let slideshowActive = false;
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

    function stopSlideshow() {
        slideshowActive = false;
        isCountingDown = false;
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (downloadTimeoutId) clearTimeout(downloadTimeoutId);
        if (rafId) cancelAnimationFrame(rafId);
        if (window.updateWidgetUI) window.updateWidgetUI();
    }

    function startSlideshow() {
        if (!slideshowActive) {
            slideshowActive = true;
            slideshowPaused = false;
            if (window.widgetState === 'hidden') window.widgetState = 'bar';
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
        
        // Скачивание перед перелистыванием
        if (config.downloadType !== 'none') {
            const hasVideo = document.querySelector('video') !== null;
            if (!(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo)) {
                triggerDownload();
                if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                    setTimeout(() => window.close(), 1000); // Smart Delete logic
                    return;
                }
            }
        }
        
        // Листание по D-pad (берем первое направление для простоты)
        const key = getArrowKey(dirs[0]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        setTimeout(() => {
            scheduleNextSlideCycle(0);
        }, 500);
    }

    function scheduleNextSlideCycle(initSec) {
        if (!slideshowActive || slideshowPaused) return;
        if (rafId) cancelAnimationFrame(rafId);
        const video = document.querySelector('video');
        
        if (video && !isNaN(video.duration)) {
            // Режим Видео
            isCountingDown = false;
            currentVideoNode = video;
            videoInitialDuration = video.duration;
            currentLoopCount = 0;
            accumulatedTime = 0;
            lastTime = video.currentTime;
            lastRAFTime = performance.now();
            rafId = requestAnimationFrame(checkVideoLoops);
        } else {
            // Режим Фото
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
        
        const ct = currentVideoNode.currentTime;
        if (ct < lastTime) {
            // Произошел луп
            currentLoopCount++;
            accumulatedTime = 0;
        } else {
            const delta = (timeNow - lastRAFTime) / 1000;
            if (!currentVideoNode.paused) {
                accumulatedTime += delta;
            }
        }
        
        lastTime = ct;
        lastRAFTime = timeNow;
        
        if (currentLoopCount >= config.videoLoops || accumulatedTime >= videoInitialDuration) {
            // Циклы завершены, запускаем паузу после видео
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

    // ============================================
    // WIDGET UI
    // ============================================
    window.widgetState = 'hidden'; // 'hidden', 'bar', 'panel'

    function formatTime(secs) {
        if (isNaN(secs)) return '--:--';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function initWidget() {
        const container = document.createElement('div');
        container.id = 'mossad-widget-container';
        container.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 999998;
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; user-select: none;
            display: flex; flex-direction: column; gap: 4px;
        `;

        // TOP BAR
        const topBar = document.createElement('div');
        topBar.id = 'mossad-top-bar';
        topBar.style.cssText = `
            background: rgba(20, 20, 20, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 6px 12px;
            display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: all 0.3s ease;
        `;
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 14px; width: 60px; text-align: center; color: #9ca3af;`;
        
        const btnReset = document.createElement('button');
        btnReset.innerHTML = '↺';
        btnReset.title = 'Мотать до начала/конца';
        btnReset.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 0 4px;`;
        
        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.innerHTML = '🚀 Пуск';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 5px 12px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;
        
        const btnGear = document.createElement('button');
        btnGear.innerHTML = '⚙▼';
        btnGear.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 14px; padding: 0 4px; transition: color 0.2s ease;`;
        
        const btnDL = document.createElement('button');
        btnDL.innerHTML = '💾';
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 14px; padding: 4px 8px;`;

        topBar.append(timerEl, btnReset, btnStart, btnGear, btnDL);

        // SETTINGS PANEL
        const panel = document.createElement('div');
        panel.id = 'mossad-panel';
        panel.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px;
            display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 12px; transition: all 0.3s ease; opacity: 0; pointer-events: none; transform: translateY(-10px);
        `;

        const renderPanel = () => {
            const dirs = config.slideshowDirections || [];
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <button class="mossad-dpad" data-dir="up" style="background: ${dirs.includes('up') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▲</button>
                        <div style="display: flex; gap: 2px;">
                            <button class="mossad-dpad" data-dir="left" style="background: ${dirs.includes('left') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">◀</button>
                            <button class="mossad-dpad" data-dir="down" style="background: ${dirs.includes('down') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▼</button>
                            <button class="mossad-dpad" data-dir="right" style="background: ${dirs.includes('right') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▶</button>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label title="Круги видео" style="display:flex; justify-content:space-between; align-items:center; width:90px;">
                            Видео (↺): <input id="mossad-in-loops" type="number" min="1" max="100" value="${config.videoLoops}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Задержка фото" style="display:flex; justify-content:space-between; align-items:center; width:90px;">
                            Фото (сек): <input id="mossad-in-pdelay" type="number" min="1" max="999" value="${config.slideshowDelay}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Пауза после видео" style="display:flex; justify-content:space-between; align-items:center; width:90px;">
                            Пауза (сек): <input id="mossad-in-vdelay" type="number" min="0" max="999" value="${config.delayAfterVideo}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                    </div>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select id="mossad-sel-dl" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${config.downloadType === 'none' ? 'selected' : ''}>Не скачивать</option>
                        <option value="all" ${config.downloadType === 'all' ? 'selected' : ''}>Качать Всё</option>
                        <option value="photo" ${config.downloadType === 'photo' ? 'selected' : ''}>Качать Фото</option>
                        <option value="video" ${config.downloadType === 'video' ? 'selected' : ''}>Качать Видео</option>
                    </select>
                    <select id="mossad-sel-pd" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${config.pdAction === 'none' ? 'selected' : ''}>После DL: —</option>
                        <option value="up" ${config.pdAction === 'up' ? 'selected' : ''}>После DL: +1</option>
                        ${rootDomain === 'grok.com' ? `<option value="del" ${config.pdAction === 'del' ? 'selected' : ''}>После DL: del</option>` : ''}
                    </select>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <label title="Пауза при переключении вкладки"><input id="mossad-cb-tab" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnTabSwitch ? 'checked' : ''}> Tab</label>
                    <label title="Пауза при потере фокуса браузера"><input id="mossad-cb-brsr" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnBrsrSwitch ? 'checked' : ''}> Brsr</label>
                    ${rootDomain === 'grok.com' ? `
                    <label title="Автоподтверждение удаления"><input id="mossad-cb-aconfirm" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteAutoconfirm ? 'checked' : ''}> a.confirm</label>
                    <label title="Умный возврат к посту"><input id="mossad-cb-holdpost" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteHoldpost ? 'checked' : ''}> hold post</label>
                    ` : ''}
                </div>
            `;
            
            // Listeners for panel
            panel.querySelectorAll('.mossad-dpad').forEach(btn => {
                btn.onclick = () => Settings.set('slideshowDirections', [btn.dataset.dir]);
            });
            panel.querySelector('#mossad-in-loops').onchange = (e) => Settings.set('videoLoops', parseInt(e.target.value) || 1);
            panel.querySelector('#mossad-in-pdelay').onchange = (e) => Settings.set('slideshowDelay', parseInt(e.target.value) || 12);
            panel.querySelector('#mossad-in-vdelay').onchange = (e) => Settings.set('delayAfterVideo', parseInt(e.target.value) || 2);
            panel.querySelector('#mossad-sel-dl').onchange = (e) => Settings.set('downloadType', e.target.value);
            panel.querySelector('#mossad-sel-pd').onchange = (e) => Settings.set('pdAction', e.target.value);
            panel.querySelector('#mossad-cb-tab').onchange = (e) => Settings.set('stopOnTabSwitch', e.target.checked);
            panel.querySelector('#mossad-cb-brsr').onchange = (e) => Settings.set('stopOnBrsrSwitch', e.target.checked);
            if (rootDomain === 'grok.com') {
                panel.querySelector('#mossad-cb-aconfirm').onchange = (e) => Settings.set('deleteAutoconfirm', e.target.checked);
                panel.querySelector('#mossad-cb-holdpost').onchange = (e) => Settings.set('deleteHoldpost', e.target.checked);
            }
        };

        container.append(topBar, panel);
        document.body.appendChild(container);

        // Actions
        btnStart.onclick = startSlideshow;
        btnGear.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };
        btnDL.onclick = triggerDownload;
        btnReset.onclick = () => {
            let oppDir = 'down';
            if (config.slideshowDirections[0] === 'up') oppDir = 'down';
            else if (config.slideshowDirections[0] === 'down') oppDir = 'up';
            else if (config.slideshowDirections[0] === 'left') oppDir = 'right';
            else if (config.slideshowDirections[0] === 'right') oppDir = 'left';
            const key = getArrowKey(oppDir);
            let lastUrl = location.href; let unchangedCount = 0;
            const interval = setInterval(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                setTimeout(() => {
                    if (location.href === lastUrl) {
                        unchangedCount++;
                        if (unchangedCount >= 4) clearInterval(interval);
                    } else { lastUrl = location.href; unchangedCount = 0; }
                }, 60);
            }, 120);
        };

        window.updateWidgetUI = () => {
            if (window.widgetState === 'hidden') {
                topBar.style.display = 'none';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'bar') {
                topBar.style.display = 'flex';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'panel') {
                topBar.style.display = 'flex';
                renderPanel(); // re-render to reflect settings
                panel.style.opacity = '1';
                panel.style.pointerEvents = 'auto';
                panel.style.transform = 'translateY(0)';
            }
            
            if (slideshowActive) {
                btnStart.style.background = '#3b82f6'; // Bright blue
                btnStart.style.color = '#ffffff';
                btnStart.style.boxShadow = '0 0 10px rgba(59,130,246,0.6)';
            } else {
                btnStart.style.background = '#1f2937'; // Gray
                btnStart.style.color = '#e5e7eb';
                btnStart.style.boxShadow = 'none';
            }
        };

        window.updateWidgetUI();

        // Tracker Time
        setInterval(() => {
            if (window.widgetState === 'hidden') return;
            if (slideshowActive && isCountingDown) {
                timerEl.textContent = countdownSeconds + 'с';
                timerEl.style.color = '#3b82f6';
            } else {
                const video = document.querySelector('video');
                if (video && !isNaN(video.duration)) {
                    timerEl.textContent = `${formatTime(video.currentTime)}/${formatTime(video.duration)}`;
                } else {
                    timerEl.textContent = '--:--';
                }
                timerEl.style.color = '#9ca3af';
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWidget);
    } else {
        initWidget();
    }

    // ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null; 
    document.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) { if (!/^F\d+$/.test(e.key)) return; }

        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            window.widgetState = window.widgetState === 'hidden' ? 'panel' : 'hidden';
            window.updateWidgetUI();
        }

        if (hotkeyMatches(e, config.hk.slideshowStart)) {
            e.preventDefault();
            startSlideshow();
        }

        if (hotkeyMatches(e, config.hk.download)) {
            e.preventDefault();
            triggerDownload();
        }

        if (hotkeyMatches(e, config.hk.history) && rootDomain === 'grok.com') {
            e.preventDefault();
            window.location.href = 'https://grok.com/imagine/saved';
        }
    }, true);

})();
