// ==UserScript==
// @name         Grok Hotkeys + Slideshow (настраиваемые клавиши)
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Полный набор горячих клавиш + автолистание + Lag Monitor + настраиваемые клавиши
// @author       Grok + eldmans
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @grant        none
// @updateURL    https://... (обнови если нужно)
// @downloadURL  https://... 
// ==/UserScript==

(function () {
    'use strict';

    console.log('%c[Grok Hotkeys + Slideshow v3.4] Скрипт загружен (настраиваемые клавиши)', 'color:#10b981; font-weight:bold');

    const isPostPage = location.pathname.includes('/imagine/post/');

    // ==================== НАСТРАИВАЕМЫЕ ГОРЯЧИЕ КЛАВИШИ ====================
    let hotkeysConfig = {
        download: 'PageDown',
        upscale: 'PageUp',
        deleteVideo: 'ControlRight+Delete',  // специальный формат
        toggleSound: 'ScrollLock',
        togglePlayPause: 'Pause',
        help: 'F1',
        lagMonitor: 'F8',
        history: 'Home',
        showSlideshowPanel: 'Insert'
    };

    // Загрузка из localStorage
    function loadConfig() {
        const saved = localStorage.getItem('grok_hotkeys_config');
        if (saved) {
            Object.assign(hotkeysConfig, JSON.parse(saved));
        }
    }

    function saveConfig() {
        localStorage.setItem('grok_hotkeys_config', JSON.stringify(hotkeysConfig));
    }

    loadConfig();

    // ==================== ОСНОВНОЙ ОБРАБОТЧИК ====================
    document.addEventListener('keydown', function (e) {
        const keyCombo = getKeyCombo(e);

        // Скачать
        if (keyCombo === hotkeysConfig.download) {
            e.preventDefault();
            triggerClick(findButton(['Download', 'Скачать']), 'Download');
        }

        // Улучшить качество
        if (keyCombo === hotkeysConfig.upscale) {
            e.preventDefault();
            triggerClick(findButton(['Upscale', 'Enhance', 'Improve quality', 'Повысить качество']), 'Upscale');
        }

        // Удалить видео
        if (keyCombo === hotkeysConfig.deleteVideo) {
            e.preventDefault();
            triggerClick(findButton(['Delete video', 'Delete', 'Удалить видео']), 'Delete video');
        }

        // Звук
        if (keyCombo === hotkeysConfig.toggleSound) {
            e.preventDefault();
            toggleSound();
        }

        // Play/Pause
        if (keyCombo === hotkeysConfig.togglePlayPause) {
            e.preventDefault();
            togglePlayPause();
        }

        // Help
        if (keyCombo === hotkeysConfig.help) {
            e.preventDefault();
            toggleHelpOverlay();
        }

        // Lag Monitor
        if (keyCombo === hotkeysConfig.lagMonitor && isPostPage) {
            e.preventDefault();
            toggleLagMonitor();
        }

        // История
        if (keyCombo === hotkeysConfig.history) {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';
            if (e.ctrlKey) window.open(url, '_blank');
            else window.location.href = url;
        }

        // Показать панель слайдшоу
        if (keyCombo === hotkeysConfig.showSlideshowPanel) {
            e.preventDefault();
            if (slideshowPanel) {
                slideshowPanel.style.display = slideshowPanel.style.display === 'none' ? 'flex' : 'none';
            }
        }
    }, true);

    function getKeyCombo(e) {
        let combo = '';
        if (e.ctrlKey) combo += 'Control+';
        if (e.altKey) combo += 'Alt+';
        if (e.shiftKey) combo += 'Shift+';
        if (e.code === 'ControlRight') combo = 'ControlRight+';
        combo += e.key;
        return combo.replace('ControlRight+Delete', 'ControlRight+Delete'); // нормализация
    }

    // ... (все остальные функции findButton, triggerClick, toggleSound, togglePlayPause, lag monitor, slideshow — остаются почти без изменений)

    // ==================== УЛУЧШЕННЫЙ HELP OVERLAY ====================
    let helpOverlay = null;

    function toggleHelpOverlay() {
        if (!helpOverlay) createHelpOverlay();
        helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'block' : 'none';
    }

    function createHelpOverlay() {
        helpOverlay = document.createElement('div');
        // ... стили (оставь как было или улучши)

        let html = `
            <div style="font-weight:600; margin-bottom:12px; color:#fff; font-size:17px;">Настройка горячих клавиш</div>
            <div id="hotkeys-list" style="display:grid; grid-template-columns: auto auto 1fr; gap: 8px 12px; font-size:14px; max-height:60vh; overflow:auto;">
        `;

        Object.keys(hotkeysConfig).forEach(key => {
            const niceName = getNiceName(key);
            html += `
                <div><b>${niceName}</b></div>
                <div style="color:#3b82f6; cursor:pointer;" onclick="editHotkey('${key}')">${hotkeysConfig[key] || 'Отключено'}</div>
                <div style="color:#888; font-size:12px;">${getActionDescription(key)}</div>
            `;
        });

        html += `</div>
            <div style="margin-top:15px; text-align:center;">
                <button onclick="resetHotkeys()" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;">Сбросить все клавиши</button>
            </div>`;

        helpOverlay.innerHTML = html;
        document.body.appendChild(helpOverlay);

        // Глобальные функции для onclick
        window.editHotkey = function(key) {
            const newKey = prompt(`Новая клавиша для "${getNiceName(key)}" (или пусто для отключения):\nПримеры: PageDown, F8, ControlRight+Delete, ScrollLock`, hotkeysConfig[key]);
            if (newKey !== null) {
                hotkeysConfig[key] = newKey.trim() || null;
                saveConfig();
                // Пересоздаём оверлей
                if (helpOverlay) {
                    document.body.removeChild(helpOverlay);
                    helpOverlay = null;
                    toggleHelpOverlay();
                }
            }
        };

        window.resetHotkeys = function() {
            if (confirm('Сбросить все горячие клавиши к значениям по умолчанию?')) {
                localStorage.removeItem('grok_hotkeys_config');
                location.reload();
            }
        };
    }

    function getNiceName(key) {
        const map = {
            download: 'Скачать',
            upscale: 'Улучшить качество',
            deleteVideo: 'Удалить видео',
            toggleSound: 'Звук',
            togglePlayPause: 'Play/Pause',
            help: 'Помощь',
            lagMonitor: 'Lag Monitor',
            history: 'История',
            showSlideshowPanel: 'Панель слайдшоу'
        };
        return map[key] || key;
    }

    function getActionDescription(key) {
        // ... можно расширить
        return '';
    }

    // Остальной код (slideshow, lag и т.д.) остаётся прежним
    // Просто вставь его после этого блока

    // ... (вставь сюда весь оригинальный код от slideshow и ниже)

})();
