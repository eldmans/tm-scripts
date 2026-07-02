// ==UserScript==
// @name         Grok Hotkeys + Slideshow
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Полный набор горячих клавиш + автолистание слайдов + Lag Monitor + Help (F1) + Play/Pause (Pause) + ScrollLock (звук)
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

    console.log('%c[Grok Hotkeys + Slideshow v3.0] Скрипт загружен', 'color:#10b981; font-weight:bold');

    const isPostPage = location.pathname.includes('/imagine/post/');

    // ============================================
    // ГЛОБАЛЬНЫЕ ХОТКЕИ
    // ============================================

    document.addEventListener('keydown', function (e) {

        // Скачать
        if (e.key === 'PageDown') {
            e.preventDefault();
            triggerClick(findButton(['Download', 'Скачать']), 'Download');
        }

        // Улучшить качество
        if (e.key === 'PageUp') {
            e.preventDefault();
            triggerClick(findButton(['Upscale', 'Enhance', 'Improve quality', 'Повысить качество']), 'Upscale');
        }

        // Удалить видео
        const isRightCtrlDelete = (e.key === 'Delete' || e.key === 'Del') && e.ctrlKey && e.code === 'ControlRight';
        if (isRightCtrlDelete) {
            e.preventDefault();
            triggerClick(findButton(['Delete video', 'Delete', 'Удалить видео']), 'Delete video');
        }

        // Звук → ScrollLock
        if (e.key === 'ScrollLock' || e.key === 'Scroll') {
            e.preventDefault();
            toggleSound();
        }

        // Play / Pause видео → Pause/Break
        if (e.key === 'Pause' || e.key === 'Break') {
            e.preventDefault();
            togglePlayPause();
        }

        // Help overlay → F1
        if (e.key === 'F1') {
            e.preventDefault();
            toggleHelpOverlay();
        }

        // Lag Monitor → F8 (только на post страницах)
        if (e.key === 'F8' && isPostPage) {
            e.preventDefault();
            toggleLagMonitor();
        }

        // История
        if (e.key === 'Home') {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';
            if (e.ctrlKey) window.open(url, '_blank');
            else window.location.href = url;
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

    function triggerClick(btn, action) {
        if (!btn) {
            console.log(`%c❌ "${action}" не найдена`, 'color:#ef4444');
            return;
        }
        console.log(`%c✅ ${action}`, 'color:#10b981');
        btn.click();
        // Анимация нажатия
        const orig = btn.style.transform;
        btn.style.transition = 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)';
        btn.style.transform = 'scale(0.82)';
        setTimeout(() => { btn.style.transform = orig || ''; }, 120);
    }

    // Переключение звука
    function toggleSound() {
        const btn = findSoundButton();
        if (btn) {
            triggerClick(btn, 'Toggle sound');
        } else {
            console.log('%c❌ Кнопка звука не найдена', 'color:#ef4444');
        }
    }

    function findSoundButton() {
        const words = ['заглушить', 'включить звук', 'звук', 'sound', 'mute', 'unmute'];
        let btn = Array.from(document.querySelectorAll('button')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            return words.some(w => aria.includes(w) || text.includes(w));
        });
        if (btn) return btn;

        return document.querySelector('button[aria-label*="Заглушить"]') ||
               document.querySelector('button[aria-label*="Включить звук"]') ||
               document.querySelector('button[aria-label*="Mute"]') ||
               document.querySelector('button[aria-label*="Unmute"]');
    }

    // Play / Pause
    function togglePlayPause() {
        const pauseBtn = document.querySelector('button[aria-label*="Приостановить"]');
        const playBtn = document.querySelector('button[aria-label*="Воспроизвести"]');

        if (pauseBtn) {
            triggerClick(pauseBtn, 'Pause video');
        } else if (playBtn) {
            triggerClick(playBtn, 'Play video');
        } else {
            console.log('%c❌ Кнопка Play/Pause не найдена', 'color:#ef4444');
        }
    }

    // ============================================
    // HELP OVERLAY (F1)
    // ============================================

    let helpOverlay = null;

    function toggleHelpOverlay() {
        if (!helpOverlay) createHelpOverlay();

        helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'block' : 'none';
    }

    function createHelpOverlay() {
        helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999999; background: rgba(15,15,15,0.95); color: #ddd;
            padding: 20px 28px; border-radius: 12px; border: 1px solid #444;
            font-family: system-ui, monospace; font-size: 15px; line-height: 1.5;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); max-width: 420px;
        `;

        helpOverlay.innerHTML = `
            <div style="font-weight:600; margin-bottom:12px; color:#fff; font-size:17px;">Grok Hotkeys</div>
            <div style="display:grid; grid-template-columns: auto 1fr; gap: 6px 18px; font-size:14px;">
                <div><b>PageDown</b></div><div>Скачать</div>
                <div><b>PageUp</b></div><div>Улучшить качество</div>
                <div><b>ScrollLock</b></div><div>Вкл/Выкл звук</div>
                <div><b>Pause/Break</b></div><div>Play / Pause видео</div>
                <div><b>Right Ctrl + Delete</b></div><div>Удалить видео</div>
                <div><b>Home</b> / <b>Ctrl+Home</b></div><div>История сохранённых</div>
                <div><b>F1</b></div><div>Это окно (помощь)</div>
                <div><b>F8</b></div><div>Lag Monitor (на странице поста)</div>
                <div><b>Insert</b></div><div>Показать панель 7/13</div>
            </div>
            <div style="margin-top:16px; font-size:12px; opacity:0.6;">На странице генерации: 7 и 13 — автолистание слайдов</div>
        `;

        document.body.appendChild(helpOverlay);
    }

    // ============================================
    // LAG MONITOR (F8) — только на /imagine/post/*
    // ============================================

    let lagPanel = null;
    let lagRunning = false;
    let lagTimer = null;
    let lagPrev = 0;

    function toggleLagMonitor() {
        if (!isPostPage) return;

        if (!lagPanel) createLagPanel();

        if (lagRunning) {
            stopLagMonitor();
        } else {
            startLagMonitor();
        }
    }

    function createLagPanel() {
        lagPanel = document.createElement('div');
        lagPanel.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:999999;
            background:#111; color:#0f0; padding:8px 14px; border-radius:8px;
            font-family:monospace; font-size:16px; border:1px solid #444; display:none;
        `;
        lagPanel.textContent = '0 ms';
        document.body.appendChild(lagPanel);
    }

    function startLagMonitor() {
        if (!lagPanel) createLagPanel();
        lagRunning = true;
        lagPanel.style.display = 'block';
        lagPrev = performance.now();

        lagTimer = setInterval(() => {
            const now = performance.now();
            const drift = now - lagPrev - 500;
            lagPrev = now;

            lagPanel.textContent = `${Math.round(drift)} ms`;

            if (drift < 50) lagPanel.style.color = '#00ff00';
            else if (drift < 200) lagPanel.style.color = '#ffff00';
            else if (drift < 1000) lagPanel.style.color = '#ff8800';
            else lagPanel.style.color = '#ff0000';
        }, 500);
    }

    function stopLagMonitor() {
        lagRunning = false;
        clearInterval(lagTimer);
        if (lagPanel) lagPanel.style.display = 'none';
    }

    // ============================================
    // SLIDESHOW PANEL (7 / 13) — улучшенная версия
    // ============================================

    let slideshowPanel = null;
    let slideshowInterval = null;
    let currentInterval = 7; // дефолт

    function initSlideshowPanel() {
        if (slideshowPanel || !isPostPage) return;

        // Загружаем сохранённый интервал
        const saved = localStorage.getItem('grok_slideshow_interval');
        if (saved) currentInterval = parseInt(saved, 10) || 7;

        slideshowPanel = document.createElement('div');
        slideshowPanel.style.cssText = `
            position:fixed; top:70px; right:20px; z-index:999999;
            background:rgba(20,20,20,0.95); padding:10px 14px; border-radius:12px;
            border:1px solid #444; display:none; gap:10px; align-items:center;
            box-shadow:0 4px 12px rgba(0,0,0,0.4); font-family:system-ui,sans-serif;
        `;

        slideshowPanel.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; position:relative;">
                <div id="plus7" style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">+</div>
                <button id="btn7" style="padding:8px 18px; background:#1f2937; color:#e5e7eb; border:2px solid #374151; border-radius:8px; cursor:pointer; font-weight:600; min-width:46px;">7</button>
                <div id="minus7" style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">−</div>
            </div>

            <div style="display:flex; flex-direction:column; align-items:center; position:relative;">
                <div id="plus13" style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">+</div>
                <button id="btn13" style="padding:8px 18px; background:#1f2937; color:#e5e7eb; border:2px solid #374151; border-radius:8px; cursor:pointer; font-weight:600; min-width:46px;">13</button>
                <div id="minus13" style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">−</div>
            </div>
        `;

        document.body.appendChild(slideshowPanel);

        const btn7 = slideshowPanel.querySelector('#btn7');
        const btn13 = slideshowPanel.querySelector('#btn13');
        const plus7 = slideshowPanel.querySelector('#plus7');
        const minus7 = slideshowPanel.querySelector('#minus7');
        const plus13 = slideshowPanel.querySelector('#plus13');
        const minus13 = slideshowPanel.querySelector('#minus13');

        function updateButtonLabel(btn, val) {
            btn.textContent = val;
        }

        function setActive(btn) {
            [btn7, btn13].forEach(b => {
                if (b === btn) {
                    b.style.background = '#2563eb';
                    b.style.borderColor = '#3b82f6';
                    b.style.color = 'white';
                } else {
                    b.style.background = '#1f2937';
                    b.style.borderColor = '#374151';
                    b.style.color = '#e5e7eb';
                }
            });
        }

        function stopSlideshow() {
            if (slideshowInterval) clearInterval(slideshowInterval);
            slideshowInterval = null;
            [btn7, btn13].forEach(b => {
                b.style.background = '#1f2937';
                b.style.borderColor = '#374151';
                b.style.color = '#e5e7eb';
            });
        }

        function nextSlide() {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }

        function downloadIfChecked() {
            // Можно добавить чекбокс позже, если нужно. Пока без него.
        }

        function startSlideshow(seconds, btn) {
            stopSlideshow();
            setActive(btn);
            currentInterval = seconds;
            localStorage.setItem('grok_slideshow_interval', currentInterval);

            slideshowInterval = setInterval(() => {
                nextSlide();
                downloadIfChecked();
            }, seconds * 1000);
        }

        // Клик по кнопкам
        btn7.onclick = () => {
            if (slideshowInterval && currentInterval === 7) {
                stopSlideshow();
            } else {
                startSlideshow(7, btn7);
            }
        };

        btn13.onclick = () => {
            if (slideshowInterval && currentInterval === 13) {
                stopSlideshow();
            } else {
                startSlideshow(13, btn13);
            }
        };

        // +/- для 7
        plus7.onclick = (e) => { e.stopImmediatePropagation(); currentInterval = Math.min(currentInterval + 1, 60); updateButtonLabel(btn7, currentInterval); localStorage.setItem('grok_slideshow_interval', currentInterval); };
        minus7.onclick = (e) => { e.stopImmediatePropagation(); currentInterval = Math.max(currentInterval - 1, 3); updateButtonLabel(btn7, currentInterval); localStorage.setItem('grok_slideshow_interval', currentInterval); };

        plus13.onclick = (e) => { e.stopImmediatePropagation(); currentInterval = Math.min(currentInterval + 1, 60); updateButtonLabel(btn13, currentInterval); localStorage.setItem('grok_slideshow_interval', currentInterval); };
        minus13.onclick = (e) => { e.stopImmediatePropagation(); currentInterval = Math.max(currentInterval - 1, 3); updateButtonLabel(btn13, currentInterval); localStorage.setItem('grok_slideshow_interval', currentInterval); };

        // Показать текущий интервал при наведении (опционально)
        [btn7, btn13].forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (btn === btn7) updateButtonLabel(btn7, currentInterval);
                if (btn === btn13) updateButtonLabel(btn13, currentInterval);
            });
        });

        // Показать панель по Insert
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Insert' || e.key === 'Ins') {
                e.preventDefault();
                slideshowPanel.style.display = slideshowPanel.style.display === 'none' ? 'flex' : 'none';
            }
        }, true);
    }

    // Инициализация панели автолистания
    if (isPostPage) {
        initSlideshowPanel();
    }

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================

    console.log('%c[Grok Hotkeys + Slideshow] Все модули инициализированы', 'color:#10b981');

})();
