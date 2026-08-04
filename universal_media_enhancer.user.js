// ==UserScript==
// @name         Universal Web & Media Enhancer
// @namespace    https://github.com/eldmans/tm-scripts
// @version      1.1.0
// @description  Авто-очистка NoodleMagazine (скрытие Join Now, 100% плеер) + Pinterest FullScale Auto-Clicker & Video Downloader (RedGifs-style widget, PageDown)
// @author       eldmans
// @match        *://*.noodlemagazine.com/*
// @match        *://noodlemagazine.com/*
// @match        *://*.pinterest.com/*
// @match        *://*.pinterest.ru/*
// @match        *://*.pinterest.*/*
// @run-at       document-start
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/universal_media_enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/universal_media_enhancer.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    const hostname = location.hostname.toLowerCase();

    // =========================================================================
    // HELPER: Toast notifications
    // =========================================================================
    function showToast(message, isError = false) {
        let toast = document.getElementById('uni-enhancer-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'uni-enhancer-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 9999999;
                padding: 10px 18px;
                background: rgba(20, 20, 20, 0.9);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 10px;
                color: #ffffff;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                pointer-events: none;
                transition: opacity 0.2s ease, transform 0.2s ease;
                opacity: 0;
            `;
            (document.body || document.documentElement).appendChild(toast);
        }
        toast.textContent = message;
        toast.style.borderColor = isError ? '#ef4444' : '#10b981';
        toast.style.color = isError ? '#fca5a5' : '#6ee7b7';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    // =========================================================================
    // MODULE 1: NOODLE MAGAZINE (Hide "Join Now" & Expand Video Player 100%)
    // =========================================================================
    if (hostname.includes('noodlemagazine.com')) {
        console.log('%c[Universal Enhancer] NoodleMagazine module active', 'color:#10b981; font-weight:bold;');

        const noodleCSS = `
            /* 1. Скрываем рекламную кнопочку "Join Now" и боковые блоки */
            .c_video > div[data-noscript],
            .c_video > div:not(.video_player),
            .fh-button,
            a[href*="faphouse.com"],
            a[href*="join"],
            .join-now,
            div:has(> a[href*="faphouse"]) {
                display: none !important;
                visibility: hidden !important;
                width: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* 2. Растягиваем контейнер плеера на 100% ширины */
            .c_video {
                width: 100% !important;
                max-width: 100% !important;
                display: block !important;
                height: auto !important;
                flex: 1 1 100% !important;
            }

            /* 3. Фиксируем пропорции видеоплеера */
            .c_video > .video_player {
                width: 100% !important;
                max-width: 100% !important;
                aspect-ratio: 16 / 9 !important;
                height: auto !important;
                min-height: 420px !important;
                margin: 0 auto !important;
            }

            /* 4. Заполнение всей области элементами плеера */
            .c_video .player_wrap,
            .c_video .video_player iframe,
            .c_video .video_player video,
            .c_video .video_player #player,
            .c_video .video_player .plyr {
                width: 100% !important;
                height: 100% !important;
                min-height: 100% !important;
                padding-bottom: 0 !important;
            }
        `;

        function injectNoodleStyles() {
            if (document.head || document.documentElement) {
                let style = document.getElementById('uni-noodle-styles');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'uni-noodle-styles';
                    (document.head || document.documentElement).appendChild(style);
                }
                style.textContent = noodleCSS;
            }
        }

        function cleanupJoinNow() {
            const targets = document.querySelectorAll('.fh-button, a[href*="faphouse.com"], .c_video > div[data-noscript]');
            targets.forEach(el => {
                if (el.style.display !== 'none') {
                    el.style.setProperty('display', 'none', 'important');
                    el.remove();
                }
            });
        }

        injectNoodleStyles();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                injectNoodleStyles();
                cleanupJoinNow();
            });
        } else {
            cleanupJoinNow();
        }

        const observer = new MutationObserver(() => cleanupJoinNow());
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setInterval(cleanupJoinNow, 500);
    }

    // =========================================================================
    // MODULE 2: PINTEREST (FullScale Auto-Clicker, Video Downloader & Hotkeys)
    // =========================================================================
    if (hostname.includes('pinterest.')) {
        console.log('%c[Universal Enhancer] Pinterest module active', 'color:#3b82f6; font-weight:bold;');

        // State keys
        const ENABLED_KEY = 'pinterest_fs_enabled';
        const DELAY_KEY = 'pinterest_fs_delay';
        const HOTKEYS_KEY = 'pinterest_fs_hotkeys';

        let isEnabled = localStorage.getItem(ENABLED_KEY) !== 'false';
        let delayVal = parseInt(localStorage.getItem(DELAY_KEY), 10);
        if (isNaN(delayVal)) delayVal = 10;

        let hotkeys = {
            toggleFS: { key: 'ArrowUp', ctrl: false, alt: false, shift: true },
            settings: { key: 'F2', ctrl: false, alt: false, shift: false },
            download: { key: 'PageDown', ctrl: false, alt: false, shift: false }
        };
        try {
            const stored = localStorage.getItem(HOTKEYS_KEY);
            if (stored) {
                Object.assign(hotkeys, JSON.parse(stored));
            }
        } catch (e) { }

        // =========================================================================
        // PINTEREST MEDIA EXTRACTION LOGIC
        // =========================================================================
        function findPinterestMedia() {
            // 1. Прямой <video> или <source> элемент
            const videos = Array.from(document.querySelectorAll('video'));
            for (const v of videos) {
                const src = v.currentSrc || v.src || v.querySelector('source')?.src;
                if (src && !src.startsWith('blob:')) {
                    return { url: src, type: 'video' };
                }
            }

            // 2. Из атрибута data-video-signature (как в DevTools пользователя)
            const sigEl = document.querySelector('[data-video-signature]');
            if (sigEl) {
                const sig = sigEl.getAttribute('data-video-signature');
                if (sig && sig.length >= 6) {
                    const p1 = sig.slice(0, 2);
                    const p2 = sig.slice(2, 4);
                    const p3 = sig.slice(4, 6);
                    // Формируем прямой 720w URL видео с cdn pinimg
                    const candidateUrl = `https://v1.pinimg.com/videos/iht/hls/${p1}/${p2}/${p3}/${sig}_720w.cmfv`;
                    return { url: candidateUrl, type: 'video', signature: sig };
                }
            }

            // 3. Сканирование JSON в script тегах (Pins initial data)
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                const txt = s.textContent || '';
                if (txt.includes('video_list') || txt.includes('pinimg.com/videos')) {
                    const matches = txt.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+\.(?:mp4|cmfv|m3u8)/g);
                    if (matches && matches.length > 0) {
                        const cleanUrl = matches[0].replace(/\\/g, '');
                        return { url: cleanUrl, type: 'video' };
                    }
                }
            }

            // 4. Метатеги og:video
            const metaVid = document.querySelector('meta[property="og:video"], meta[property="og:video:secure_url"]');
            if (metaVid && metaVid.content) {
                return { url: metaVid.content, type: 'video' };
            }

            // 5. Изображение в высоком качестве (Original HQ Image fallback)
            const img = document.querySelector('img[src*="pinimg.com/originals/"]') ||
                        document.querySelector('img[src*="pinimg.com/736x/"]') ||
                        document.querySelector('[data-test-id="pin-closeup-image"] img');
            if (img && img.src) {
                const fullImg = img.src.replace(/\/736x\//, '/originals/').replace(/\/474x\//, '/originals/');
                return { url: fullImg, type: 'image' };
            }

            return null;
        }

        function triggerPinterestDownload() {
            const media = findPinterestMedia();
            if (!media || !media.url) {
                showToast('❌ Медиафайл для скачивания не найден на странице', true);
                return;
            }

            const pageTitle = (document.title || 'pinterest_media').replace(/[\\/:*?"<>|]/g, '_').trim();
            const ext = media.type === 'video' ? 'mp4' : 'jpg';
            const filename = `${pageTitle}.${ext}`;

            showToast(`📥 Скачивание ${media.type === 'video' ? 'видео' : 'изображения'}...`);

            // Скачивание через direct link / new tab / blob
            try {
                const a = document.createElement('a');
                a.href = media.url;
                a.download = filename;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => a.remove(), 1000);
            } catch (err) {
                if (typeof GM_openInTab === 'function') {
                    GM_openInTab(media.url, { active: true });
                } else {
                    window.open(media.url, '_blank');
                }
            }
        }

        // =========================================================================
        // REDGIFS-STYLE COMPACT WIDGET UI
        // =========================================================================
        function initPinterestUI() {
            if (document.getElementById('pinterest-fs-widget')) return;

            const container = document.createElement('div');
            container.id = 'pinterest-fs-widget';
            container.style.cssText = `
                position: fixed;
                top: 50px;
                right: 50px;
                z-index: 999999;
                background: rgba(20, 20, 20, 0.85);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: system-ui, -apple-system, sans-serif;
                color: #e5e7eb;
                font-size: 12px;
                user-select: none;
            `;

            // FS Button
            const btnFS = document.createElement('button');
            btnFS.textContent = 'FS';
            btnFS.title = 'Переключить авто-масштаб (Shift+Up)';
            btnFS.style.cssText = `
                cursor: pointer;
                border: none;
                border-radius: 6px;
                padding: 5px 10px;
                font-weight: 700;
                font-size: 12px;
                transition: all 0.2s ease;
            `;

            function updateButtonState() {
                if (isEnabled) {
                    btnFS.style.background = '#3b82f6';
                    btnFS.style.color = '#ffffff';
                    btnFS.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.4)';
                } else {
                    btnFS.style.background = '#4b5563';
                    btnFS.style.color = '#d1d5db';
                    btnFS.style.boxShadow = 'none';
                }
            }
            updateButtonState();

            btnFS.onclick = () => {
                isEnabled = !isEnabled;
                localStorage.setItem(ENABLED_KEY, isEnabled);
                updateButtonState();
                if (isEnabled) {
                    triggerAction();
                }
            };

            // Download Button (RedGifs secondary style)
            const btnDL = document.createElement('button');
            btnDL.innerHTML = '💾 Скачать';
            btnDL.title = 'Скачать видео/медиа (PageDown)';
            btnDL.style.cssText = `
                cursor: pointer;
                border: none;
                border-radius: 6px;
                padding: 5px 10px;
                font-weight: 700;
                font-size: 12px;
                background: #10b981;
                color: #ffffff;
                box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
                transition: all 0.2s ease;
            `;
            btnDL.onmouseover = () => { btnDL.style.background = '#059669'; };
            btnDL.onmouseout = () => { btnDL.style.background = '#10b981'; };
            btnDL.onclick = () => {
                triggerPinterestDownload();
            };

            // Delay Input
            const inputDelay = document.createElement('input');
            inputDelay.type = 'number';
            inputDelay.value = delayVal;
            inputDelay.min = '0';
            inputDelay.max = '100';
            inputDelay.title = 'Задержка клика (в 0.1 сек)';
            inputDelay.style.cssText = `
                width: 40px;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 4px;
                color: #e5e7eb;
                padding: 2px 4px;
                text-align: center;
                font-size: 12px;
            `;
            inputDelay.onchange = () => {
                let val = parseInt(inputDelay.value, 10);
                if (isNaN(val) || val < 0) val = 0;
                delayVal = val;
                localStorage.setItem(DELAY_KEY, delayVal);
            };

            const suffix = document.createElement('span');
            suffix.textContent = '*0.1s';
            suffix.style.color = '#9ca3af';

            container.appendChild(btnFS);
            container.appendChild(btnDL);
            container.appendChild(inputDelay);
            container.appendChild(suffix);
            (document.body || document.documentElement).appendChild(container);
        }

        let actionTimeout = null;

        function triggerAction() {
            if (!isEnabled) return;
            if (actionTimeout) clearTimeout(actionTimeout);

            actionTimeout = setTimeout(() => {
                let btn = document.querySelector('[aria-label="Показать в полном масштабе"], [title="Показать в полном масштабе"]');
                if (!btn) {
                    const svg = document.querySelector('svg[aria-label="Показать в полном масштабе"]');
                    if (svg) {
                        btn = svg.closest('button') || svg;
                    }
                }

                if (btn) {
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    console.log('%c[FS Auto-Clicker] Clicked full scale button', 'color:#10b981;');
                }
            }, delayVal * 100);
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initPinterestUI();
            triggerAction();
        } else {
            window.addEventListener('DOMContentLoaded', () => {
                initPinterestUI();
                triggerAction();
            });
        }

        window.addEventListener('focus', triggerAction);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) triggerAction();
        });

        let lastUrl = location.href;
        setInterval(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                triggerAction();
            }
        }, 300);

        // Settings Overlay
        let settingsOverlay = null;
        let capturing = false;

        function formatHotkey(hk) {
            if (!hk || !hk.key) return '—';
            const parts = [];
            if (hk.ctrl) parts.push('Ctrl');
            if (hk.alt) parts.push('Alt');
            if (hk.shift) parts.push('Shift');
            let k = hk.key;
            if (k === ' ') k = 'Space';
            parts.push(k);
            return parts.join('+');
        }

        function toggleSettingsOverlay() {
            if (!settingsOverlay) {
                createSettingsOverlay();
            }
            settingsOverlay.style.display = settingsOverlay.style.display === 'none' ? 'flex' : 'none';
            if (settingsOverlay.style.display === 'flex') {
                updateSettingsUI();
            }
        }

        function createSettingsOverlay() {
            settingsOverlay = document.createElement('div');
            settingsOverlay.id = 'pinterest-fs-settings-overlay';
            settingsOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 1000000;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(4px);
                display: none;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: rgba(20, 20, 20, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 14px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.6);
                padding: 20px;
                width: 320px;
                color: #e5e7eb;
                display: flex;
                flex-direction: column;
                gap: 16px;
            `;

            modal.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; font-size: 15px;">FS & Downloader Настройки</span>
                    <span id="pinter-fs-close-modal" style="cursor: pointer; color: #9ca3af; font-size: 18px; font-weight: bold;">×</span>
                </div>
                <div style="border-top: 1px solid #374151;"></div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 12px; color: #9ca3af;">Клавиша Вкл/Выкл (FS):</div>
                    <button id="pinter-fs-key-btn" style="
                        width: 100%;
                        padding: 10px;
                        background: #1f2937;
                        border: 1px solid #374151;
                        border-radius: 8px;
                        color: #3b82f6;
                        font-weight: 600;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.2s ease;
                    "></button>
                    <div id="pinter-fs-hint" style="font-size: 11px; color: #6b7280; text-align: center; display: none;">
                        Нажмите клавишу на клавиатуре (можно с Ctrl, Alt, Shift)...
                    </div>
                </div>
            `;

            settingsOverlay.appendChild(modal);
            document.body.appendChild(settingsOverlay);

            const closeBtn = modal.querySelector('#pinter-fs-close-modal');
            closeBtn.onclick = () => {
                settingsOverlay.style.display = 'none';
                cancelCapture();
            };

            const keyBtn = modal.querySelector('#pinter-fs-key-btn');
            keyBtn.onclick = () => {
                startCapture();
            };
        }

        function updateSettingsUI() {
            if (!settingsOverlay) return;
            const keyBtn = settingsOverlay.querySelector('#pinter-fs-key-btn');
            keyBtn.textContent = formatHotkey(hotkeys.toggleFS);
        }

        function startCapture() {
            capturing = true;
            const hint = settingsOverlay.querySelector('#pinter-fs-hint');
            const keyBtn = settingsOverlay.querySelector('#pinter-fs-key-btn');
            hint.style.display = 'block';
            keyBtn.textContent = '[ Нажмите клавишу... ]';
            keyBtn.style.color = '#ef4444';
            keyBtn.style.borderColor = '#ef4444';
        }

        function cancelCapture() {
            capturing = false;
            if (!settingsOverlay) return;
            const hint = settingsOverlay.querySelector('#pinter-fs-hint');
            const keyBtn = settingsOverlay.querySelector('#pinter-fs-key-btn');
            hint.style.display = 'none';
            keyBtn.style.color = '#3b82f6';
            keyBtn.style.borderColor = '#374151';
            updateSettingsUI();
        }

        function hotkeyMatches(e, hk) {
            if (!hk || !hk.key) return false;
            return e.key.toLowerCase() === hk.key.toLowerCase() &&
                !!e.ctrlKey === !!hk.ctrl &&
                !!e.altKey === !!hk.alt &&
                !!e.shiftKey === !!hk.shift;
        }

        document.addEventListener('keydown', function (e) {
            if (capturing) {
                e.preventDefault();
                e.stopPropagation();

                if (['control', 'shift', 'alt', 'meta'].includes(e.key.toLowerCase())) {
                    return;
                }

                hotkeys.toggleFS = {
                    key: e.key,
                    ctrl: e.ctrlKey,
                    alt: e.altKey,
                    shift: e.shiftKey
                };
                localStorage.setItem(HOTKEYS_KEY, JSON.stringify(hotkeys));
                cancelCapture();
                return;
            }

            if (settingsOverlay && settingsOverlay.style.display === 'flex') {
                if (e.key === 'Escape' || hotkeyMatches(e, hotkeys.settings) || e.key === 'F1') {
                    e.preventDefault();
                    e.stopPropagation();
                    settingsOverlay.style.display = 'none';
                    cancelCapture();
                    return;
                }
            }

            const activeEl = document.activeElement;
            const isEditing = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.isContentEditable
            );
            if (isEditing) return;

            // Хоткей на скачивание (PageDown)
            if (hotkeyMatches(e, hotkeys.download) || e.key === 'PageDown') {
                e.preventDefault();
                triggerPinterestDownload();
                return;
            }

            if (hotkeyMatches(e, hotkeys.toggleFS)) {
                e.preventDefault();
                isEnabled = !isEnabled;
                localStorage.setItem(ENABLED_KEY, isEnabled);
                const widgetBtn = document.querySelector('#pinterest-fs-widget button');
                if (widgetBtn) {
                    widgetBtn.style.background = isEnabled ? '#3b82f6' : '#4b5563';
                    widgetBtn.style.color = isEnabled ? '#ffffff' : '#d1d5db';
                }
                if (isEnabled) {
                    triggerAction();
                }
            }

            if (hotkeyMatches(e, hotkeys.settings) || e.key === 'F1') {
                e.preventDefault();
                toggleSettingsOverlay();
            }
        }, true);
    }
})();
