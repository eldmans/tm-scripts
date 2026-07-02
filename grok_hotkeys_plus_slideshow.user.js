// ==UserScript==
// @name         Grok Hotkeys + Slideshow
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Полный набор горячих клавиш для Grok + автолистание слайдов на /imagine/post/* (Insert = показать/скрыть панель)
// @author       Grok + eldmans
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok_hotkeys_plus_slideshow.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok_hotkeys_plus_slideshow.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    console.log('%c[Grok Hotkeys + Slideshow v2.0] Скрипт загружен', 'color:#10b981; font-weight:bold');

    // ============================================
    // 1. ГЛОБАЛЬНЫЕ ХОТКЕИ (работают везде)
    // ============================================

    document.addEventListener('keydown', function (e) {

        // Скачать (PageDown)
        if (e.key === 'PageDown') {
            e.preventDefault();
            const btn = findButton(['Download', 'Скачать']);
            triggerClick(btn, 'Download');
        }

        // Улучшить качество / Upscale (PageUp)
        if (e.key === 'PageUp') {
            e.preventDefault();
            const btn = findButton(['Upscale', 'Enhance', 'Improve quality', 'Повысить качество']);
            triggerClick(btn, 'Upscale');
        }

        // Удалить видео (Right Ctrl + Delete)
        const isRightCtrlDelete = (e.key === 'Delete' || e.key === 'Del') && e.ctrlKey && e.code === 'ControlRight';
        if (isRightCtrlDelete) {
            e.preventDefault();
            const btn = findButton(['Delete video', 'Delete', 'Удалить видео']);
            triggerClick(btn, 'Delete video');
        }

        // Переключить звук (End)
        if (e.key === 'End') {
            e.preventDefault();
            const btn = findSoundButton();
            triggerClick(btn, 'Toggle sound');
        }

        // История сохранённых генераций
        if (e.key === 'Home') {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';
            if (e.ctrlKey) {
                window.open(url, '_blank');
            } else {
                window.location.href = url;
            }
        }

    }, true);

    // ============================================
    // 2. ПАНЕЛЬ АВТОЛИСТАНИЯ (только на /imagine/post/*)
    // ============================================

    let slideshowPanel = null;
    let slideshowInterval = null;
    let isPanelVisible = false;

    function initSlideshowPanel() {
        if (slideshowPanel || !location.pathname.includes('/imagine/post/')) return;

        slideshowPanel = document.createElement('div');
        slideshowPanel.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            z-index: 999999;
            background: rgba(20, 20, 20, 0.95);
            padding: 8px 12px;
            border-radius: 12px;
            border: 1px solid #444;
            display: none;
            gap: 8px;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-family: system-ui, sans-serif;
        `;

        slideshowPanel.innerHTML = `
            <button id="slide7" style="padding:8px 16px; background:#1f2937; color:#e5e7eb; border:2px solid #374151; border-radius:8px; cursor:pointer; font-weight:600; min-width:42px;">7</button>
            <button id="slide13" style="padding:8px 16px; background:#1f2937; color:#e5e7eb; border:2px solid #374151; border-radius:8px; cursor:pointer; font-weight:600; min-width:42px;">13</button>
            <button id="slideStop" style="padding:8px 14px; background:#7f1d1d; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600;">Стоп</button>

            <label style="display:flex; align-items:center; gap:6px; margin-left:8px; cursor:pointer; color:#d1d5db; font-size:15px;">
                <input type="checkbox" id="slideDownload" style="width:18px; height:18px; accent-color:#3b82f6;">
                <span>↓</span>
            </label>
        `;

        document.body.appendChild(slideshowPanel);

        const btn7 = slideshowPanel.querySelector('#slide7');
        const btn13 = slideshowPanel.querySelector('#slide13');
        const btnStop = slideshowPanel.querySelector('#slideStop');
        const cb = slideshowPanel.querySelector('#slideDownload');

        cb.checked = false; // по умолчанию выключено

        const activeStyle = 'background:#2563eb; border-color:#3b82f6; color:white;';
        const inactiveStyle = 'background:#1f2937; border-color:#374151; color:#e5e7eb;';

        function setActive(btn) {
            [btn7, btn13].forEach(b => {
                b.style.cssText = b === btn 
                    ? `padding:8px 16px; ${activeStyle} border-radius:8px; cursor:pointer; font-weight:600; min-width:42px;`
                    : `padding:8px 16px; ${inactiveStyle} border-radius:8px; cursor:pointer; font-weight:600; min-width:42px;`;
            });
        }

        function stopSlideshow() {
            if (slideshowInterval) clearInterval(slideshowInterval);
            slideshowInterval = null;
            [btn7, btn13].forEach(b => {
                b.style.cssText = `padding:8px 16px; ${inactiveStyle} border-radius:8px; cursor:pointer; font-weight:600; min-width:42px;`;
            });
        }

        function nextSlide() {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }

        function download() {
            const btn = document.querySelector('button[aria-label*="Скачать"], button[aria-label="Скачать"]');
            if (btn) btn.click();
        }

        function startSlideshow(seconds, activeBtn) {
            stopSlideshow();
            setActive(activeBtn);

            slideshowInterval = setInterval(() => {
                nextSlide();
                if (cb.checked) download();
            }, seconds * 1000);
        }

        btn7.onclick = () => startSlideshow(7, btn7);
        btn13.onclick = () => startSlideshow(13, btn13);
        btnStop.onclick = stopSlideshow;
    }

    // Показать / скрыть панель по Insert
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Insert' || e.key === 'Ins') {
            e.preventDefault();
            if (!slideshowPanel) initSlideshowPanel();

            if (slideshowPanel) {
                isPanelVisible = !isPanelVisible;
                slideshowPanel.style.display = isPanelVisible ? 'flex' : 'none';
            }
        }
    }, true);

    // ============================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ============================================

    function findButton(labels) {
        if (!Array.isArray(labels)) labels = [labels];
        for (const label of labels) {
            let btn = document.querySelector(`button[aria-label="${label}"]`) ||
                      document.querySelector(`button[aria-label*="${label}"]`);
            if (btn) return btn;
        }
        return Array.from(document.querySelectorAll('button')).find(btn => {
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const text = (btn.textContent || '').toLowerCase();
            return labels.some(l => aria.includes(l.toLowerCase()) || text.includes(l.toLowerCase()));
        });
    }

    function findSoundButton() {
        const words = ['звук', 'sound', 'mute', 'unmute'];
        return Array.from(document.querySelectorAll('button')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            return words.some(w => aria.includes(w) || text.includes(w));
        });
    }

    function triggerClick(btn, action) {
        if (!btn) {
            console.log(`%c❌ Кнопка "${action}" не найдена`, 'color:#ef4444');
            return;
        }
        console.log(`%c✅ ${action}`, 'color:#10b981');
        btn.click();

        const origTransform = btn.style.transform;
        btn.style.transition = 'transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        btn.style.transform = 'scale(0.82)';
        setTimeout(() => {
            btn.style.transform = origTransform || '';
        }, 150);
    }

})();
