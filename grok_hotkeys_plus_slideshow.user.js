// ==UserScript==
// @name         Grok Hotkeys + Slideshow
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Полный набор горячих клавиш + автолистание слайдов + Lag Monitor + Help/Settings (F1) + Play/Pause (Pause) + ScrollLock (звук). Клавиши можно переназначить через F1.
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

    console.log('%c[Grok Hotkeys + Slideshow v4.3] Скрипт загружен', 'color:#10b981; font-weight:bold');

    const isPostPage = location.pathname.includes('/imagine/post/');

    // ============================================
    // КОНФИГУРАЦИЯ ГОРЯЧИХ КЛАВИШ
    // ============================================

    const STORAGE_KEY = 'grok_hotkeys_config';

    // Описание всех действий с клавишами по умолчанию.
    // onlyF1F4: true — для этого действия допустимы только F1-F4 без модификаторов.
    // postOnly: true  — действие отображается и работает только на страницах поста.
    const ACTIONS = {
        download:   { label: 'Скачать',                      defaultKey: { key: 'PageDown',   ctrl: false, alt: false, shift: false } },
        upscale:    { label: 'Улучшить качество',             defaultKey: { key: 'PageUp',     ctrl: false, alt: false, shift: false } },
        deleteVid:  { label: 'Удалить видео',                 defaultKey: { key: 'Delete',     ctrl: true,  alt: false, shift: false } },
        sound:      { label: 'Вкл/Выкл звук',                defaultKey: { key: 'ScrollLock', ctrl: false, alt: false, shift: false } },
        playPause:  { label: 'Play / Pause видео',           defaultKey: { key: 'Pause',      ctrl: false, alt: false, shift: false } },
        help:       { label: 'Справка / Настройки',          defaultKey: { key: 'F1',         ctrl: false, alt: false, shift: false }, onlyF1F4: true },
        lagMonitor: { label: 'Lag Monitor (страница поста)',  defaultKey: { key: 'F8',         ctrl: false, alt: false, shift: false }, postOnly: true },
        history:    { label: 'История сохранённых',           defaultKey: { key: 'Home',       ctrl: false, alt: false, shift: false } },
        slideshow:  { label: 'Панель слайдшоу',              defaultKey: { key: 'Insert',     ctrl: false, alt: false, shift: false }, postOnly: true },
    };

    // Загрузка конфига
    let config = {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        config = stored ? JSON.parse(stored) : {};
    } catch (e) {}

    // Заполняем пропущенные записи дефолтами
    for (const [id, action] of Object.entries(ACTIONS)) {
        if (!config[id]) config[id] = { ...action.defaultKey };
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    // Форматирует хоткей в читаемую строку: "Ctrl+PageDown"
    function formatHotkey(hk) {
        if (!hk || !hk.key) return '—';
        const parts = [];
        if (hk.ctrl)  parts.push('Ctrl');
        if (hk.alt)   parts.push('Alt');
        if (hk.shift) parts.push('Shift');
        parts.push(hk.key);
        return parts.join('+');
    }

    // Извлекает хоткей-объект из события (возвращает null если нажат только модификатор)
    function hotkeyFromEvent(e) {
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
        return { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
    }

    // Проверяет, совпадает ли событие с хоткеем
    function hotkeyMatches(e, hk) {
        if (!hk || !hk.key) return false;
        return e.key === hk.key &&
               !!e.ctrlKey  === !!hk.ctrl &&
               !!e.altKey   === !!hk.alt  &&
               !!e.shiftKey === !!hk.shift;
    }

    // Сравнивает два хоткей-объекта
    function hotkeyEquals(a, b) {
        if (!a || !b || !a.key || !b.key) return false;
        return a.key === b.key &&
               !!a.ctrl  === !!b.ctrl  &&
               !!a.alt   === !!b.alt   &&
               !!a.shift === !!b.shift;
    }

    // Ищет конфликтующее действие (возвращает id или null)
    function findConflict(hk, excludeId) {
        for (const [id, hkCurrent] of Object.entries(config)) {
            if (id === excludeId) continue;
            if (hotkeyEquals(hk, hkCurrent)) return id;
        }
        return null;
    }

    // ============================================
    // ГЛОБАЛЬНЫЙ ОБРАБОТЧИК КЛАВИШ
    // ============================================

    let capturingFor = null; // id действия, для которого ждём нажатие новой клавиши

    document.addEventListener('keydown', function (e) {
        if (capturingFor !== null) return; // не выполняем действия во время захвата

        // В текстовых полях разрешаем только F-клавиши — остальное браузеру
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );
        if (isEditing && !/^F\d+$/.test(e.key)) return;

        if (hotkeyMatches(e, config.download)) {
            e.preventDefault();
            triggerClick(findButton(['Download', 'Скачать']), 'Download');
            // Если панель слайдшоу скрыта — дополнительно листаем через 0.5с
            if (isPostPage && (!slideshowPanel || slideshowPanel.style.display === 'none')) {
                setTimeout(() => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
                }, 500);
            }
        }

        if (hotkeyMatches(e, config.upscale)) {
            e.preventDefault();
            triggerClick(findButton(['Upscale', 'Enhance', 'Improve quality', 'Повысить качество']), 'Upscale');
        }

        if (hotkeyMatches(e, config.deleteVid)) {
            e.preventDefault();
            triggerClick(findButton(['Delete video', 'Delete', 'Удалить видео']), 'Delete video');
        }

        if (hotkeyMatches(e, config.sound)) {
            e.preventDefault();
            toggleSound();
        }

        if (hotkeyMatches(e, config.playPause)) {
            e.preventDefault();
            togglePlayPause();
        }

        if (hotkeyMatches(e, config.help)) {
            e.preventDefault();
            toggleHelpOverlay();
        }

        if (hotkeyMatches(e, config.lagMonitor) && isPostPage) {
            e.preventDefault();
            toggleLagMonitor();
        }

        // История: базовая клавиша → перейти, Ctrl + базовая (если Ctrl не часть хоткея) → открыть в новой вкладке
        if (config.history.key && e.key === config.history.key &&
            !!e.altKey === !!config.history.alt && !!e.shiftKey === !!config.history.shift) {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';
            if (!config.history.ctrl && e.ctrlKey) window.open(url, '_blank');
            else if (hotkeyMatches(e, config.history)) window.location.href = url;
        }

        if (hotkeyMatches(e, config.slideshow) && isPostPage) {
            e.preventDefault();
            if (slideshowPanel) {
                slideshowPanel.style.display = slideshowPanel.style.display === 'none' ? 'flex' : 'none';
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

    function triggerClick(btn, action) {
        if (!btn) {
            console.log(`%c❌ "${action}" не найдена`, 'color:#ef4444');
            return;
        }
        console.log(`%c✅ ${action}`, 'color:#10b981');
        btn.click();
        const orig = btn.style.transform;
        btn.style.transition = 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)';
        btn.style.transform = 'scale(0.82)';
        setTimeout(() => { btn.style.transform = orig || ''; }, 120);
    }

    function toggleSound() {
        const btn = findSoundButton();
        if (btn) triggerClick(btn, 'Toggle sound');
        else console.log('%c❌ Кнопка звука не найдена', 'color:#ef4444');
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

    function togglePlayPause() {
        const pauseBtn = document.querySelector('button[aria-label*="Приостановить"]');
        const playBtn  = document.querySelector('button[aria-label*="Воспроизвести"]');
        if (pauseBtn) triggerClick(pauseBtn, 'Pause video');
        else if (playBtn) triggerClick(playBtn, 'Play video');
        else console.log('%c❌ Кнопка Play/Pause не найдена', 'color:#ef4444');
    }

    // ============================================
    // HELP / SETTINGS OVERLAY (F1)
    // ============================================

    let helpOverlay = null;
    let captureListener = null;

    function toggleHelpOverlay() {
        if (!helpOverlay) createHelpOverlay();
        else rebuildHelpContent();
        helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'flex' : 'none';
    }

    function createHelpOverlay() {
        helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999999; background: rgba(11,13,18,0.98); color: #ddd;
            padding: 22px 26px; border-radius: 14px; border: 1px solid #2a2f3e;
            font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5;
            box-shadow: 0 16px 48px rgba(0,0,0,0.85); width: 460px;
            display: flex; flex-direction: column; gap: 14px;
        `;

        // Закрыть по клику вне overlay
        document.addEventListener('mousedown', function (e) {
            if (helpOverlay &&
                helpOverlay.style.display !== 'none' &&
                !helpOverlay.contains(e.target)) {
                helpOverlay.style.display = 'none';
                cancelCapture();
            }
        });

        document.body.appendChild(helpOverlay);
        rebuildHelpContent();
    }

    function rebuildHelpContent() {
        if (!helpOverlay) return;
        cancelCapture();
        helpOverlay.innerHTML = '';

        // ── Заголовок ──────────────────────────────────
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline;';
        titleRow.innerHTML = `
            <span style="font-weight:700; font-size:16px; color:#fff; letter-spacing:0.3px;">Grok Hotkeys</span>
            <span style="font-size:11px; color:#4b5563;">нажмите на клавишу чтобы переназначить</span>
        `;
        helpOverlay.appendChild(titleRow);

        // ── Разделитель ────────────────────────────────
        const hr = document.createElement('div');
        hr.style.cssText = 'border-top:1px solid #1e2433; margin:-4px 0;';
        helpOverlay.appendChild(hr);

        // ── Таблица хоткеев ────────────────────────────
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 165px 1fr; gap: 6px 14px; align-items:center;';

        for (const [id, action] of Object.entries(ACTIONS)) {
            if (action.postOnly && !isPostPage) continue;

            const keyCell = document.createElement('div');
            keyCell.dataset.actionId = id;
            keyCell.style.cssText = `
                background: #161b27; border: 1px solid #252d3d; border-radius: 7px;
                padding: 4px 10px; cursor: pointer; text-align: center; font-weight: 600;
                color: #c9d1e0; transition: background 0.15s, border-color 0.15s, color 0.15s;
                font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                user-select: none;
            `;
            keyCell.textContent = formatHotkey(config[id]);
            keyCell.title = 'Нажмите чтобы переназначить';

            keyCell.addEventListener('mouseenter', () => {
                if (capturingFor !== id) {
                    keyCell.style.background = '#1e2840';
                    keyCell.style.borderColor = '#3b4a6b';
                    keyCell.style.color = '#e2e8f0';
                }
            });
            keyCell.addEventListener('mouseleave', () => {
                if (capturingFor !== id) {
                    keyCell.style.background = '#161b27';
                    keyCell.style.borderColor = '#252d3d';
                    keyCell.style.color = '#c9d1e0';
                }
            });
            keyCell.addEventListener('click', () => startCapture(id));

            const descCell = document.createElement('div');
            descCell.style.cssText = 'color: #6b7280; font-size:13px;';
            descCell.textContent = action.label;

            grid.appendChild(keyCell);
            grid.appendChild(descCell);
        }
        helpOverlay.appendChild(grid);

        // ── Зона конфликта ─────────────────────────────
        const conflictArea = document.createElement('div');
        conflictArea.id = 'hk-conflict';
        conflictArea.style.cssText = `
            display:none; background:#2d0a0a; border:1px solid #7f1d1d;
            border-radius:8px; padding:10px 14px; font-size:13px; color:#fca5a5;
        `;
        helpOverlay.appendChild(conflictArea);

        // ── Подсказка захвата ──────────────────────────
        const captureHint = document.createElement('div');
        captureHint.id = 'hk-capture-hint';
        captureHint.style.cssText = 'display:none; font-size:12px; color:#60a5fa; text-align:center; letter-spacing:0.2px;';
        captureHint.textContent = '⌨️  Нажмите новую клавишу или комбинацию…  Esc — отмена';
        helpOverlay.appendChild(captureHint);

        // ── Кнопка сброса ──────────────────────────────
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↺  Сбросить к значениям по умолчанию';
        resetBtn.style.cssText = `
            padding:7px 0; background:transparent; border:1px solid #252d3d;
            border-radius:8px; color:#4b5563; cursor:pointer; font-size:12px;
            transition: all 0.15s; width:100%; letter-spacing:0.2px;
        `;
        resetBtn.addEventListener('mouseenter', () => {
            resetBtn.style.borderColor = '#374151';
            resetBtn.style.color = '#9ca3af';
            resetBtn.style.background = '#161b27';
        });
        resetBtn.addEventListener('mouseleave', () => {
            resetBtn.style.borderColor = '#252d3d';
            resetBtn.style.color = '#4b5563';
            resetBtn.style.background = 'transparent';
        });
        resetBtn.addEventListener('click', () => {
            for (const [id, action] of Object.entries(ACTIONS)) {
                config[id] = { ...action.defaultKey };
            }
            saveConfig();
            rebuildHelpContent();
        });
        helpOverlay.appendChild(resetBtn);
    }

    // ── Начать захват новой клавиши ────────────────────

    function startCapture(actionId) {
        if (capturingFor !== null) cancelCapture();
        capturingFor = actionId;

        const keyCell = helpOverlay.querySelector(`[data-action-id="${actionId}"]`);
        if (keyCell) {
            keyCell.style.background    = '#0f2340';
            keyCell.style.borderColor   = '#3b82f6';
            keyCell.style.color         = '#93c5fd';
            keyCell.textContent         = '…';
        }

        const hint = helpOverlay.querySelector('#hk-capture-hint');
        if (hint) hint.style.display = 'block';

        captureListener = function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (e.key === 'Escape') {
                cancelCapture();
                rebuildHelpContent();
                return;
            }

            const hk = hotkeyFromEvent(e);
            if (!hk) return; // нажата только клавиша-модификатор

            // Ограничение для help: только F1-F4 без модификаторов
            if (actionId === 'help') {
                if (!['F1', 'F2', 'F3', 'F4'].includes(hk.key) || hk.ctrl || hk.alt || hk.shift) {
                    showCaptureError('Для «Справки» допустимы только F1, F2, F3 или F4 (без модификаторов)');
                    return;
                }
            }

            const conflictId = findConflict(hk, actionId);
            if (conflictId) {
                showConflictDialog(actionId, conflictId, hk);
            } else {
                applyHotkey(actionId, hk);
            }
        };

        document.addEventListener('keydown', captureListener, true);
    }

    function cancelCapture() {
        if (captureListener) {
            document.removeEventListener('keydown', captureListener, true);
            captureListener = null;
        }
        capturingFor = null;
    }

    function applyHotkey(actionId, hk) {
        config[actionId] = hk;
        saveConfig();
        cancelCapture();
        rebuildHelpContent();
    }

    function showCaptureError(msg) {
        const area = helpOverlay.querySelector('#hk-conflict');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `<span>⛔  ${msg}</span>`;
        setTimeout(() => { cancelCapture(); rebuildHelpContent(); }, 2000);
    }

    function showConflictDialog(actionId, conflictId, newHk) {
        // Снимаем обработчик на время диалога
        document.removeEventListener('keydown', captureListener, true);

        const area = helpOverlay.querySelector('#hk-conflict');
        if (!area) return;

        const conflictLabel = ACTIONS[conflictId].label;
        const defaultHk     = ACTIONS[conflictId].defaultKey;
        const defaultTaken  = findConflict(defaultHk, conflictId);
        const canUseDefault = !defaultTaken && defaultHk.key;

        const destText = canUseDefault
            ? `«${conflictLabel}» переедет на дефолтную&nbsp;<b>${formatHotkey(defaultHk)}</b>`
            : `«${conflictLabel}» останется <b>без клавиши</b> (дефолтная ${formatHotkey(defaultHk)} занята)`;

        area.style.display = 'block';
        area.innerHTML = `
            <div style="margin-bottom:7px;">
                ⚠️ <b>${formatHotkey(newHk)}</b> уже используется для «${conflictLabel}».
            </div>
            <div style="margin-bottom:10px; color:#fda4af; font-size:12px;">${destText}</div>
            <div style="display:flex; gap:8px;">
                <button id="hk-ok" style="padding:5px 16px; background:#b91c1c; border:none; border-radius:6px; color:#fff; cursor:pointer; font-size:13px; font-weight:600;">Переназначить</button>
                <button id="hk-cancel" style="padding:5px 16px; background:#161b27; border:1px solid #2d3748; border-radius:6px; color:#94a3b8; cursor:pointer; font-size:13px;">Отмена</button>
            </div>
        `;

        area.querySelector('#hk-ok').addEventListener('click', () => {
            config[conflictId] = canUseDefault
                ? { ...defaultHk }
                : { key: null, ctrl: false, alt: false, shift: false };
            applyHotkey(actionId, newHk);
        });

        area.querySelector('#hk-cancel').addEventListener('click', () => {
            cancelCapture();
            rebuildHelpContent();
        });
    }

    // ============================================
    // LAG MONITOR (F8) — только на /imagine/post/*
    // ============================================

    let lagPanel   = null;
    let lagRunning = false;
    let lagTimer   = null;
    let lagPrev    = 0;

    function toggleLagMonitor() {
        if (!isPostPage) return;
        if (!lagPanel) createLagPanel();
        if (lagRunning) stopLagMonitor();
        else startLagMonitor();
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
            const now   = performance.now();
            const drift = now - lagPrev - 500;
            lagPrev = now;
            lagPanel.textContent = `${Math.round(drift)} ms`;

            if      (drift < 50)   lagPanel.style.color = '#00ff00';
            else if (drift < 200)  lagPanel.style.color = '#ffff00';
            else if (drift < 1000) lagPanel.style.color = '#ff8800';
            else                   lagPanel.style.color = '#ff0000';
        }, 500);
    }

    function stopLagMonitor() {
        lagRunning = false;
        clearInterval(lagTimer);
        if (lagPanel) lagPanel.style.display = 'none';
    }

    // ============================================
    // SLIDESHOW PANEL (Insert) — только на /imagine/post/*
    // ПРИМЕЧАНИЕ: Toggle панели управляется из главного keydown-обработчика
    //             через config.slideshow (по умолчанию Insert)
    // ============================================

    let slideshowPanel    = null;
    let slideshowInterval = null;
    let currentInterval   = 7;

    function initSlideshowPanel() {
        if (slideshowPanel || !isPostPage) return;

        const saved = localStorage.getItem('grok_slideshow_interval');
        if (saved) currentInterval = parseInt(saved, 10) || 7;

        slideshowPanel = document.createElement('div');
        slideshowPanel.style.cssText = `
            position:fixed; top:70px; right:20px; z-index:999999;
            background:rgba(20,20,20,0.95); padding:10px 14px; border-radius:12px;
            border:1px solid #444; display:none; gap:10px; align-items:center;
            box-shadow:0 4px 12px rgba(0,0,0,0.4); font-family:system-ui,sans-serif;
        `;

        const initDownload   = localStorage.getItem('grok_slideshow_download')    !== 'false';
        const initOnlyActive = localStorage.getItem('grok_slideshow_only_active') !== 'false';

        slideshowPanel.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <!-- Пресеты слева -->
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px; font-size:11px; color:#888;">
                    <div id="preset17" style="cursor:pointer; user-select:none; padding:1px 4px;">17</div>
                    <div id="preset12" style="cursor:pointer; user-select:none; padding:1px 4px;">12</div>
                    <div id="preset7"  style="cursor:pointer; user-select:none; padding:1px 4px;">7</div>
                </div>

                <!-- Главная кнопка с +/- -->
                <div style="display:flex; flex-direction:column; align-items:center; position:relative;">
                    <div id="plus"  style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">+</div>
                    <button id="btnInterval" style="padding:8px 20px; background:#1f2937; color:#e5e7eb; border:2px solid #374151; border-radius:8px; cursor:pointer; font-weight:600; min-width:52px; font-size:15px;">${currentInterval}</button>
                    <div id="minus" style="font-size:11px; color:#888; cursor:pointer; user-select:none; line-height:1;">−</div>
                </div>

                <!-- x2 -->
                <div id="btnX2" style="font-size:11px; color:#888; cursor:pointer; user-select:none; padding:2px 5px; border:1px solid #555; border-radius:4px; line-height:1.6;">x2</div>

                <!-- Галочки: Download + Only Active -->
                <div style="display:flex; flex-direction:column; gap:6px; margin-left:2px;">
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#d1d5db; font-size:13px;" title="Скачивать каждый слайд">
                        <input type="checkbox" id="cbDownload" style="width:13px; height:13px; accent-color:#3b82f6;" ${initDownload ? 'checked' : ''}>
                        <span>↓</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer; color:#9ca3af;" title="Слайдшоу только когда вкладка активна">
                        <input type="checkbox" id="cbOnlyActive" style="width:13px; height:13px; accent-color:#3b82f6;" ${initOnlyActive ? 'checked' : ''}>
                        <span style="font-size:9px; line-height:1.2; display:flex; flex-direction:column;"><span>Only</span><span>active</span></span>
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(slideshowPanel);

        const btnInterval  = slideshowPanel.querySelector('#btnInterval');
        const plus         = slideshowPanel.querySelector('#plus');
        const minus        = slideshowPanel.querySelector('#minus');
        const preset17     = slideshowPanel.querySelector('#preset17');
        const preset12     = slideshowPanel.querySelector('#preset12');
        const preset7      = slideshowPanel.querySelector('#preset7');
        const btnX2        = slideshowPanel.querySelector('#btnX2');
        const cbDownload   = slideshowPanel.querySelector('#cbDownload');
        const cbOnlyActive = slideshowPanel.querySelector('#cbOnlyActive');

        btnInterval.textContent = currentInterval;

        cbDownload.addEventListener('change', () => {
            localStorage.setItem('grok_slideshow_download', cbDownload.checked);
        });
        cbOnlyActive.addEventListener('change', () => {
            localStorage.setItem('grok_slideshow_only_active', cbOnlyActive.checked);
        });

        function setActive(active) {
            if (active) {
                btnInterval.style.background  = '#2563eb';
                btnInterval.style.borderColor = '#3b82f6';
                btnInterval.style.color       = 'white';
            } else {
                btnInterval.style.background  = '#1f2937';
                btnInterval.style.borderColor = '#374151';
                btnInterval.style.color       = '#e5e7eb';
            }
        }

        let slideshowPaused = false;

        function stopSlideshow() {
            if (slideshowInterval) clearInterval(slideshowInterval);
            slideshowInterval = null;
            slideshowPaused   = false;
            setActive(false);
        }

        function nextSlide() {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        }

        function downloadIfChecked() {
            if (cbDownload && cbDownload.checked) {
                const btn = document.querySelector('button[aria-label*="Скачать"], button[aria-label="Скачать"]');
                if (btn) btn.click();
            }
        }

        function startSlideshow(seconds) {
            stopSlideshow();
            setActive(true);
            currentInterval = seconds;
            btnInterval.textContent = currentInterval;
            localStorage.setItem('grok_slideshow_interval', currentInterval);

            // Первый цикл сразу
            setTimeout(() => downloadIfChecked(), (seconds - 2) * 1000);

            // Основной цикл
            slideshowInterval = setInterval(() => {
                setTimeout(() => downloadIfChecked(), (seconds - 2) * 1000);
                nextSlide();
            }, seconds * 1000);
        }

        // Пауза/возобновление при переключении вкладки (Only Active)
        document.addEventListener('visibilitychange', () => {
            if (!cbOnlyActive.checked) return;
            if (document.hidden) {
                // Уходим в фон — пауза, кнопка остаётся синей
                if (slideshowInterval) {
                    clearInterval(slideshowInterval);
                    slideshowInterval = null;
                    slideshowPaused   = true;
                }
            } else {
                // Возвращаемся — возобновляем
                if (slideshowPaused) {
                    slideshowPaused = false;
                    startSlideshow(currentInterval);
                }
            }
        });

        btnInterval.onclick = () => {
            if (slideshowInterval || slideshowPaused) stopSlideshow();
            else startSlideshow(currentInterval);
        };

        plus.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = Math.min(currentInterval + 1, 100);
            btnInterval.textContent = currentInterval;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
        };
        minus.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = Math.max(currentInterval - 1, 3);
            btnInterval.textContent = currentInterval;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
        };

        btnX2.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = Math.min(currentInterval * 2, 100);
            btnInterval.textContent = currentInterval;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
            if (slideshowInterval) startSlideshow(currentInterval);
        };

        preset17.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 17;
            btnInterval.textContent = 17;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
            if (slideshowInterval) startSlideshow(17);
        };
        preset12.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 12;
            btnInterval.textContent = 12;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
            if (slideshowInterval) startSlideshow(12);
        };
        preset7.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 7;
            btnInterval.textContent = 7;
            localStorage.setItem('grok_slideshow_interval', currentInterval);
            if (slideshowInterval) startSlideshow(7);
        };
    }

    // Инициализация панели слайдшоу
    if (isPostPage) {
        initSlideshowPanel();
    }

    // ============================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================

    console.log('%c[Grok Hotkeys + Slideshow] Все модули инициализированы', 'color:#10b981');

})();
