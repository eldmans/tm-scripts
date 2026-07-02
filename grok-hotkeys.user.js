// ==UserScript==
// @name         Grok Hotkeys
// @namespace    http://tampermonkey.net/
// @version      1.30
// @description  Keyboard shortcuts for Grok Imagine: PageDown = Download, PageUp = Upscale/Enhance, RightCtrl+Delete = Delete video, End = Toggle sound, Home = Saved history (current tab), Ctrl+Home = new tab. Works on both Russian and English UI.
// @author       Grok + eldmans
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    // === INITIALIZATION ===
    console.log('%c[Grok Hotkeys v1.2] Script loaded and active', 'color:#10b981; font-weight:bold');

    // Global keydown listener (capture: true to intercept before page scripts)
    document.addEventListener('keydown', function (e) {

        // ============================================
        // 1. DOWNLOAD VIDEO / IMAGE
        // Key: PageDown
        // ============================================
        if (e.key === 'PageDown') {
            e.preventDefault();
            const btn = findButton(['Download', 'Скачать']);
            triggerClick(btn, 'Download');
        }

        // ============================================
        // 2. UPSCALE / ENHANCE QUALITY
        // Key: PageUp
        // ============================================
        if (e.key === 'PageUp') {
            e.preventDefault();
            const btn = findButton([
                'Upscale', 'Enhance', 'Improve quality', 'Повысить качество', 'Улучшить качество'
            ]);
            triggerClick(btn, 'Upscale / Enhance quality');
        }

        // ============================================
        // 3. DELETE VIDEO
        // Key: Right Ctrl + Delete (or Del)
        // Using Right Ctrl to avoid conflicts with common Left Ctrl shortcuts
        // ============================================
        const isRightCtrlDelete = (e.key === 'Delete' || e.key === 'Del') &&
                                  e.ctrlKey &&
                                  e.code === 'ControlRight';

        if (isRightCtrlDelete) {
            e.preventDefault();
            const btn = findButton(['Delete video', 'Delete', 'Удалить видео']);
            triggerClick(btn, 'Delete video');
        }

        // ============================================
        // 4. TOGGLE SOUND (Mute / Unmute)
        // Key: End
        // ============================================
        if (e.key === 'End') {
            e.preventDefault();
            const btn = findSoundButton();
            triggerClick(btn, 'Toggle sound');
        }

        // ============================================
        // 5. SAVED GENERATIONS HISTORY
        // Home        → current tab
        // Ctrl + Home → new tab
        // ============================================
        if (e.key === 'Home') {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';

            if (e.ctrlKey) {
                console.log('%c📜 Opening saved generations in NEW tab', 'color:#3b82f6');
                window.open(url, '_blank');
            } else {
                console.log('%c📜 Opening saved generations in current tab', 'color:#3b82f6');
                window.location.href = url;
            }
        }

    }, true); // capture: true

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Find button by multiple possible labels (Russian + English)
     */
    function findButton(labels) {
        if (!Array.isArray(labels)) labels = [labels];

        for (const label of labels) {
            // Exact aria-label match
            let btn = document.querySelector(`button[aria-label="${label}"]`);
            if (btn) return btn;

            // Partial aria-label match
            btn = document.querySelector(`button[aria-label*="${label}"]`);
            if (btn) return btn;
        }

        // Fallback: search all buttons by text content or aria-label
        return Array.from(document.querySelectorAll('button')).find(btn => {
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const text = (btn.textContent || '').trim().toLowerCase();

            return labels.some(l => {
                const lower = l.toLowerCase();
                return aria.includes(lower) || text.includes(lower);
            });
        });
    }

    /**
     * Special finder for sound toggle button.
     * Supports both Russian and English.
     */
    function findSoundButton() {
        const soundWords = ['звук', 'sound', 'mute', 'unmute', 'включить звук', 'выключить звук'];

        let btn = Array.from(document.querySelectorAll('button')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            return soundWords.some(w => aria.includes(w) || text.includes(w));
        });

        if (btn) return btn;

        // Fallback exact selectors
        return document.querySelector('button[aria-label*="Mute"]') ||
               document.querySelector('button[aria-label*="Unmute"]') ||
               document.querySelector('button[aria-label*="Sound"]') ||
               document.querySelector('button[aria-label*="звук"]');
    }

    /**
     * Click the button with nice visual feedback animation.
     */
    function triggerClick(btn, actionName) {
        if (!btn) {
            console.log(`%c❌ Button for "${actionName}" not found on page`, 'color:#ef4444');
            return;
        }

        console.log(`%c✅ ${actionName}`, 'color:#10b981');

        btn.click();

        // Nice "press" animation
        const originalTransition = btn.style.transition;
        const originalTransform = btn.style.transform;

        btn.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        btn.style.transform = 'scale(0.82)';

        setTimeout(() => {
            btn.style.transform = originalTransform || '';
            btn.style.transition = originalTransition || '';
        }, 150);
    }

})();
