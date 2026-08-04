// ==UserScript==
// @name         Universal Web & Media Enhancer
// @namespace    https://github.com/eldmans/tm-scripts
// @version      1.0.0
// @description  Авто-очистка NoodleMagazine (скрытие Join Now, разворачивание плеера на 100%) + Pinterest FullScale Auto-Clicker & Hotkeys
// @author       eldmans
// @match        *://*.noodlemagazine.com/*
// @match        *://noodlemagazine.com/*
// @match        *://*.pinterest.com/*
// @match        *://*.pinterest.ru/*
// @match        *://*.pinterest.*/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/universal_media_enhancer.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/universal_media_enhancer.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    const hostname = location.hostname.toLowerCase();

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

        // Нейтрализация динамически появляющихся кнопок Join Now
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

        // Постоянная проверка и отслеживание DOM (MutationObserver + interval)
        const observer = new MutationObserver(() => cleanupJoinNow());
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
        setInterval(cleanupJoinNow, 500);
    }

    // =========================================================================
    // MODULE 2: PINTEREST (FullScale Auto-Clicker & Hotkeys)
    // =========================================================================
    if (hostname.includes('pinterest.')) {
        console.log('%c[Universal Enhancer] Pinterest module active', 'color:#3b82f6; font-weight:bold;');

        // State keys
        const ENABLED_KEY = 'pinterest_fs_enabled';
        const DELAY_KEY = 'pinterest_fs_delay';
        const HOTKEYS_KEY = 'pinterest_fs_hotkeys';

        // Load state
        let isEnabled = localStorage.getItem(ENABLED_KEY) !== 'false';
        let delayVal = parseInt(localStorage.getItem(DELAY_KEY), 10);
        if (isNaN(delayVal)) delayVal = 10;

        // Load hotkeys config
        let hotkeys = {
            toggleFS: { key: 'ArrowUp', ctrl: false, alt: false, shift: true },
            settings: { key: 'F2', ctrl: false, alt: false, shift: false }
        };
        try {
            const stored = localStorage.getItem(HOTKEYS_KEY);
            if (stored) {
                Object.assign(hotkeys, JSON.parse(stored));
            }
        } catch (e) { }

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
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.5);
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: system-ui, -apple-system, sans-serif;
                color: #e5e7eb;
                font-size: 12px;
                user-select: none;
            `;

            const btnFS = document.createElement('button');
            btnFS.textContent = 'FS';
            btnFS.style.cssText = `
                cursor: pointer;
                border: none;
                border-radius: 6px;
                padding: 4px 10px;
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

            const inputDelay = document.createElement('input');
            inputDelay.type = 'number';
            inputDelay.value = delayVal;
            inputDelay.min = '0';
            inputDelay.max = '100';
            inputDelay.style.cssText = `
                width: 42px;
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
            suffix.textContent = '*0.1sec';
            suffix.style.color = '#9ca3af';

            container.appendChild(btnFS);
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
                    <span style="font-weight: 700; font-size: 15px;">FS Auto-Clicker Настройки</span>
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
