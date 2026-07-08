// ==UserScript==
// @name         Pinterest FullScale Auto-Clicker
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Автоматически нажимает "Показать в полном масштабе" на Pinterest.
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

    // Load state
    let isEnabled = localStorage.getItem(ENABLED_KEY) !== 'false'; // default true
    let delayVal = parseInt(localStorage.getItem(DELAY_KEY), 10);
    if (isNaN(delayVal)) delayVal = 10; // default 10 (1.0 sec)

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
            // Find fullscale button
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
})();
