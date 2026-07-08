// ==UserScript==
// @name         Pinterest FullScale Auto-Clicker
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Автоматически нажимает "Показать в полном масштабе" на Pinterest с возможностью смены хоткея вкл/выкл по F2/F1.
// @author       eldmans
// @match        *://*.pinterest.com/*
// @match        *://*.pinterest.ru/*
// @match        *://*.pinterest.*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

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
    } catch(e) {}

    // Create UI container
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

    // FS Toggle Button
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

    // Delay Input Field
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

    // Label suffix
    const suffix = document.createElement('span');
    suffix.textContent = '*0.1sec';
    suffix.style.color = '#9ca3af';

    // Assemble UI
    container.appendChild(btnFS);
    container.appendChild(inputDelay);
    container.appendChild(suffix);
    document.body.appendChild(container);

    // Auto-click logic
    let actionTimeout = null;

    function triggerAction() {
        if (!isEnabled) return;
        
        if (actionTimeout) {
            clearTimeout(actionTimeout);
        }

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

    // Trigger on page load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        triggerAction();
    } else {
        window.addEventListener('DOMContentLoaded', triggerAction);
    }

    // Trigger on window focus or visibility change
    window.addEventListener('focus', triggerAction);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            triggerAction();
        }
    });

    // Отслеживание смены URL (SPA-навигация)
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            triggerAction();
        }
    }, 300);

    // ============================================
    // НАСТРОЙКА ГОРЯЧИХ КЛАВИШ (F2/F1)
    // ============================================

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

    document.addEventListener('keydown', function(e) {
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

        // Close on Escape or settings key if open
        if (settingsOverlay && settingsOverlay.style.display === 'flex') {
            if (e.key === 'Escape' || hotkeyMatches(e, hotkeys.settings) || e.key === 'F1') {
                e.preventDefault();
                e.stopPropagation();
                settingsOverlay.style.display = 'none';
                cancelCapture();
                return;
            }
        }

        // Standard hotkeys checks
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
            updateButtonState();
            if (isEnabled) {
                triggerAction();
            }
        }

        // settings toggle (F2 or F1)
        if (hotkeyMatches(e, hotkeys.settings) || e.key === 'F1') {
            e.preventDefault();
            toggleSettingsOverlay();
        }
    }, true);

})();
