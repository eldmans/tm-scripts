    // ============================================
    // WIDGET UI
    // ============================================
    window.widgetState = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true'
        ? (sessionStorage.getItem(SESSION_STATE_KEY) || 'bar')
        : 'hidden';

    function formatTime(secs) {
        if (isNaN(secs)) return '--:--';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function initWidget() {
        let hudRow, panel;
        const container = document.createElement('div');
        container.id = 'mossad-widget-container';

        let savedPos = null;
        try {
            savedPos = JSON.parse(localStorage.getItem('mossad_widget_pos'));
        } catch(e) {}

        const defTop = isGrokSavedPage() ? '72px' : '20px';
        const initTop = (savedPos && savedPos.top) ? savedPos.top : defTop;
        const initLeft = (savedPos && savedPos.left) ? savedPos.left : null;
        const initRight = (savedPos && savedPos.right && savedPos.right !== 'auto') ? savedPos.right : null;

        container.style.cssText = `
            position: fixed;
            top: ${initTop};
            ${initRight ? `right: ${initRight}; left: auto;` : initLeft ? `left: ${initLeft}; right: auto;` : 'right: 20px;'}
            z-index: 999998;
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; user-select: none;
            display: flex; flex-direction: column; gap: 4px; pointer-events: none;
            width: fit-content; max-width: calc(100vw - 40px); box-sizing: border-box; align-items: stretch;
        `;

        window.applyWidgetZoom = function() {
            const z = (typeof config !== 'undefined' && config.widgetZoom) ? config.widgetZoom : 1.0;
            container.style.transform = `scale(${z})`;
            const isRight = container.style.right && container.style.right !== 'auto';
            container.style.transformOrigin = isRight ? 'top right' : 'top left';
        };
        window.applyWidgetZoom();

        window.snapWidgetToCorner = function() {
            const topVal = isGrokSavedPage() ? '72px' : '20px';
            container.style.left = '20px';
            container.style.top = topVal;
            container.style.right = 'auto';
            try {
                localStorage.setItem('mossad_widget_pos', JSON.stringify({ left: '20px', top: topVal, right: 'auto' }));
            } catch(err) {}
            showToast('📍 Виджет привязан к левому верхнему краю');
        };

        window.makeWidgetDraggable = function(handleEl) {
            if (!handleEl) return;
            handleEl.style.cursor = 'grab';
            handleEl.addEventListener('mousedown', (e) => {
                if (e.target.closest('button, input, select, label, a')) return;
                e.preventDefault();
                handleEl.style.cursor = 'grabbing';
                const rect = container.getBoundingClientRect();
                const shiftX = e.clientX - rect.left;
                const shiftY = e.clientY - rect.top;

                function onMouseMove(moveEvent) {
                    let newLeft = moveEvent.clientX - shiftX;
                    let newTop = moveEvent.clientY - shiftY;
                    newLeft = Math.max(0, Math.min(window.innerWidth - rect.width, newLeft));
                    newTop = Math.max(0, Math.min(window.innerHeight - rect.height, newTop));
                    container.style.left = newLeft + 'px';
                    container.style.top = newTop + 'px';
                    container.style.right = 'auto';
                }

                function onMouseUp() {
                    handleEl.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    try {
                        localStorage.setItem('mossad_widget_pos', JSON.stringify({
                            left: container.style.left,
                            top: container.style.top
                        }));
                    } catch(err) {}
                }

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        };

        // TOP BAR
        const topBar = document.createElement('div');
        topBar.id = 'mossad-top-bar';
        topBar.style.cssText = `
            background: rgba(20, 20, 20, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 5px 8px;
            display: flex; align-items: center; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: all 0.3s ease; cursor: grab; pointer-events: auto; width: 100%; box-sizing: border-box;
        `;
        window.makeWidgetDraggable(topBar);
        
        // Кнопка скрытия/показа овалов (квота и счётчик): ◀ / ▶
        let _pillsHidden = sessionStorage.getItem('mossad_grok_pills_hidden') === 'true';
        const btnTogglePills = document.createElement('button');
        btnTogglePills.id = 'mossad-btn-toggle-pills';
        btnTogglePills.textContent = _pillsHidden ? '▶' : '◀';
        btnTogglePills.title = 'Скрыть / показать плашки квоты и счётчика';
        btnTogglePills.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 10px; padding: 2px 4px; line-height: 1; transition: color 0.2s;`;
        btnTogglePills.onmouseenter = () => { btnTogglePills.style.color = '#38bdf8'; };
        btnTogglePills.onmouseleave = () => { btnTogglePills.style.color = '#6b7280'; };
        btnTogglePills.onclick = (e) => {
            e.stopPropagation();
            _pillsHidden = !_pillsHidden;
            sessionStorage.setItem('mossad_grok_pills_hidden', _pillsHidden ? 'true' : 'false');
            btnTogglePills.textContent = _pillsHidden ? '▶' : '◀';
            const wrap = document.getElementById('mossad-grok-pills-wrap');
            if (wrap) {
                wrap.style.display = _pillsHidden ? 'none' : 'inline-flex';
            }
            showToast(_pillsHidden ? 'Плашки квоты и счётчика скрыты' : 'Плашки квоты и счётчика показаны');
        };

        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 12px; min-width: 80px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 2px;`;

        // Кнопка Пуск/Пауза (Play ▶ / Pause ❚❚)
        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.textContent = '▶';
        btnStart.title = 'Старт слайдшоу (Insert)';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 4px 11px; min-width: 36px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb; text-align: center;
        `;
        btnStart.onclick = () => {
            const isAnyActive = !!(slideshowActive || window._mossadGalleryActive);
            if (isAnyActive) {
                if (window._mossadGalleryActive && typeof toggleGalleryPause === 'function') {
                    toggleGalleryPause();
                } else if (typeof setSlideshowPaused === 'function') {
                    setSlideshowPaused(!slideshowPaused);
                } else {
                    stopSlideshow();
                }
            } else {
                startSlideshow();
            }
        };

        // Кнопка переключения настроек ▼ (по центру: справа от ракеты, слева от обновления)
        const btnTogglePanel = document.createElement('button');
        btnTogglePanel.id = 'mossad-btn-toggle-panel';
        mossadLabelEl(btnTogglePanel, 'togglePanel');
        btnTogglePanel.title = 'Меню настроек';
        btnTogglePanel.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 12px; padding: 2px 6px; line-height: 1; transition: transform 0.2s, color 0.2s; margin: 0;`;
        btnTogglePanel.onmouseenter = () => { btnTogglePanel.style.color = '#fff'; };
        btnTogglePanel.onmouseleave = () => { btnTogglePanel.style.color = '#9ca3af'; };
        btnTogglePanel.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };

        // Кнопка обновления скрипта (v1.3.97):
        // Серый = актуально (опрос раз в минуту)
        // Зелёный = турбо-опрос (каждые 7 с, вкл/выкл по ПКМ). При релизе авто-открывает вкладку установки!
        // Синий = доступно обновление (клик — обновить)
        const btnUpdate = document.createElement('button');
        mossadLabelEl(btnUpdate, 'update');
        btnUpdate.style.cssText = `background: #18202f; border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; color: #64748b; opacity: 0.55; cursor: pointer; font-size: 13px; padding: 4px 10px; min-width: 32px; transition: all 0.3s ease; text-align: center;`;

        let _turboUpdateCheck = false;
        let _turboTimeoutId = null;
        let _hasUpdateFound = false;
        let _remoteFoundVer = null;

        // v1.3.98: Проверка видимости элементов MOSSAD (помимо овалов квоты/истории).
        // Если виджет скрыт (только овалы или вообще ничего) — любые опросы GitHub НЕ выполняются!
        function isMossadBarOrUiVisible() {
            if (window.widgetState === 'hidden') return false;
            if (container && container.style.display === 'none') return false;
            const isTopBarVis = topBar && topBar.style.display !== 'none' && topBar.offsetWidth > 0;
            const isHudVis = hudRow && hudRow.style.display !== 'none' && hudRow.offsetWidth > 0;
            const isPanelVis = panel && panel.style.display !== 'none' && panel.offsetWidth > 0;
            const pl = document.getElementById('mossad-playlist-panel');
            const isPlVis = pl && pl.style.display !== 'none' && pl.offsetWidth > 0;
            const modal = document.getElementById('mossad-hk-modal');
            const isModalVis = modal && modal.style.display !== 'none';
            return isTopBarVis || isHudVis || isPanelVis || isPlVis || isModalVis;
        }

        function stopTurboMode(notify = false) {
            _turboUpdateCheck = false;
            if (_turboTimeoutId) {
                clearTimeout(_turboTimeoutId);
                _turboTimeoutId = null;
            }
            if (!_hasUpdateFound) {
                setUpdateBtnState('idle');
            }
            if (notify) {
                showToast('⚪ Турбо-опрос завершён (лимит 2 мин). Возврат к обычному режиму.');
            }
        }

        function startTurboMode() {
            _turboUpdateCheck = true;
            if (_turboTimeoutId) clearTimeout(_turboTimeoutId);
            // Лимит турбо-режима: 2 минуты (120 секунд), затем авто-отключение
            _turboTimeoutId = setTimeout(() => {
                stopTurboMode(true);
            }, 120000);
            setUpdateBtnState('turbo');
            showToast('🟢 Турбо-опрос включен (на 2 мин, каждые 7 с). При релизе окно обновления откроется автоматически.');
            checkRemoteVersion(true);
        }

        function openUpdateTab() {
            const updateUrl = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js?t=' + Date.now();
            if (typeof GM_openInTab === 'function') {
                try {
                    GM_openInTab(updateUrl, { active: true, insert: true });
                    return;
                } catch (e) {}
            }
            window.open(updateUrl, '_blank');
        }

        btnUpdate.onclick = () => {
            openUpdateTab();
        };

        btnUpdate.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (_hasUpdateFound) {
                openUpdateTab();
                return;
            }
            if (_turboUpdateCheck) {
                stopTurboMode(false);
                showToast('⚪ Турбо-опрос выключен (обычный опрос раз в 60 с).');
            } else {
                startTurboMode();
            }
        };

        function setUpdateBtnState(state, remoteVersion) {
            if (!btnUpdate || !btnUpdate.isConnected) return;
            if (state === 'available') {
                _hasUpdateFound = true;
                _remoteFoundVer = remoteVersion;
                btnUpdate.style.background = '#1e3a8a';
                btnUpdate.style.color = '#38bdf8';
                btnUpdate.style.border = '1px solid #3b82f6';
                btnUpdate.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.7)';
                btnUpdate.style.opacity = '1';
                btnUpdate.title = `🚀 Доступно обновление: v${remoteVersion}! Клик — обновить (Win+Alt+R)`;
            } else if (state === 'turbo') {
                btnUpdate.style.background = 'rgba(16, 185, 129, 0.2)';
                btnUpdate.style.color = '#10b981';
                btnUpdate.style.border = '1px solid #10b981';
                btnUpdate.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
                btnUpdate.style.opacity = '1';
                btnUpdate.title = '🟢 Турбо-опрос активен (2 мин, каждые 7 с). ПКМ — выключить';
            } else {
                btnUpdate.style.background = '#18202f';
                btnUpdate.style.color = '#64748b';
                btnUpdate.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                btnUpdate.style.boxShadow = 'none';
                btnUpdate.style.opacity = '0.55';
                btnUpdate.title = `Скрипт актуален (v${SCRIPT_VERSION}). ПКМ — турбо-опрос, ЛКМ — переустановить`;
            }
        }
        setUpdateBtnState('idle');

        function isNewerVersion(remote, local) {
            if (!remote || !local) return false;
            const r = String(remote).trim().split('.').map(n => parseInt(n, 10) || 0);
            const l = String(local).trim().split('.').map(n => parseInt(n, 10) || 0);
            for (let i = 0; i < Math.max(r.length, l.length); i++) {
                const rv = r[i] || 0;
                const lv = l[i] || 0;
                if (rv > lv) return true;
                if (rv < lv) return false;
            }
            return false;
        }

        let _lastUpdateCheckTime = 0;
        let _updateCheckInProgress = false;
        function checkRemoteVersion(force = false) {
            // v1.3.98: Проверка строго только при видимом интерфейсе MOSSAD (помимо овалов)
            if (!isMossadBarOrUiVisible()) {
                if (_turboUpdateCheck) stopTurboMode(false);
                return;
            }

            const now = Date.now();
            const minInterval = _turboUpdateCheck ? 7000 : (Math.max(10, (config.updateCheckIntervalSec || 60)) * 1000);
            if (!force && (now - _lastUpdateCheckTime < minInterval)) return;
            if (_updateCheckInProgress) return;
            _updateCheckInProgress = true;
            _lastUpdateCheckTime = now;

            const url = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/src/banner.js?t=' + now;
            const onText = (txt) => {
                _updateCheckInProgress = false;
                const m = txt && txt.match(/\/\/\s*@version\s+([0-9.]+)/i);
                if (m && m[1]) {
                    const remoteVer = m[1].trim();
                    const hasUpdate = isNewerVersion(remoteVer, SCRIPT_VERSION);
                    if (hasUpdate) {
                        const wasTurbo = _turboUpdateCheck;
                        stopTurboMode(false);
                        setUpdateBtnState('available', remoteVer);
                        if (wasTurbo) {
                            showToast(`🎉 Найдена v${remoteVer}! Окно обновления открыто.`);
                            openUpdateTab();
                        }
                    } else if (_turboUpdateCheck) {
                        setUpdateBtnState('turbo');
                    } else {
                        setUpdateBtnState('idle');
                    }
                }
            };

            if (typeof GM_xmlhttpRequest === 'function') {
                try {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        timeout: 5000,
                        onload: (res) => onText(res.responseText),
                        onerror: () => { _updateCheckInProgress = false; },
                        ontimeout: () => { _updateCheckInProgress = false; }
                    });
                    return;
                } catch(e) {}
            }
            fetch(url, { cache: 'no-store' })
                .then(r => r.text())
                .then(onText)
                .catch(() => { _updateCheckInProgress = false; });
        }

        setTimeout(() => checkRemoteVersion(true), 2000);
        setInterval(() => checkRemoteVersion(false), 5000);
        window.addEventListener('focus', () => checkRemoteVersion(false));

        // «2DO» тудушки (шире на 30%)
        const btnTodo = document.createElement('button');
        btnTodo.id = 'mossad-btn-todo';
        mossadLabelEl(btnTodo, 'todoBtn');
        btnTodo.title = 'Тудушки — задачи для ассистента (текст + фото)';
        btnTodo.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #fbbf24; cursor: pointer; font-size: 11px; font-weight: 700; padding: 4px 9px; min-width: 32px; text-align: center;`;
        btnTodo.onclick = (e) => { e.stopPropagation(); toggleSettingsWindow('todos'); };

        // Универсальный крестик в самом правом краю (закрывает всё открытое: настройки, плейлист, виджет)
        // ВАЖНО: на плашки квоты и истории не распространяется!
        const btnClose = document.createElement('button');
        btnClose.id = 'mossad-btn-close';
        mossadLabelEl(btnClose, 'hideWidget');
        btnClose.title = 'Закрыть всё / скрыть виджет';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 13px; padding: 0 4px; line-height: 1; transition: color 0.2s; margin-left: auto;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            if (typeof closeSettingsWindow === 'function') {
                try { closeSettingsWindow(true); } catch(e) {}
            }
            const pl = document.getElementById('mossad-playlist-panel');
            if (pl && pl.style.display !== 'none') {
                pl.style.display = 'none';
                sessionStorage.removeItem('mossad_playlist_open');
            }
            if (window.widgetState === 'panel') {
                window.widgetState = 'bar';
                window.updateWidgetUI();
                return;
            }
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        // Новый порядок: таймер | 🚀 | ▼ | 🔄 | 📝 | ... [авто-отступ] ... | ✕
        topBar.append(btnTogglePills, timerEl, btnStart, btnTogglePanel, btnUpdate, btnTodo, btnClose);
        // ── HUD СЛАЙД-ШОУ (v1.3.93): компактная плашка настроек активного показа ──
        // Появляется ТОЛЬКО когда слайд-шоу запущено. Исчезает при остановке.
        hudRow = document.createElement('div');
        hudRow.id = 'mossad-slideshow-hud';
        hudRow.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 4px 8px;
            display: none; align-items: center; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 700;
            pointer-events: auto; width: 100%; box-sizing: border-box; color: #e5e7eb; user-select: none;
        `;

        // 1. Кнопка скачивания: яркая/тусклая, переключение на лету
        let _lastActiveDownloadType = (config.downloadType && config.downloadType !== 'none') ? config.downloadType : 'video';
        const btnHudDL = document.createElement('button');
        btnHudDL.id = 'mossad-hud-dl';
        btnHudDL.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; padding: 3px 6px; font-size: 12px; font-weight: 700; transition: all 0.2s;`;
        btnHudDL.onclick = (e) => {
            e.stopPropagation();
            if (config.downloadType !== 'none') {
                _lastActiveDownloadType = config.downloadType;
                config.downloadType = 'none';
                showToast('⭳ Скачивание: ВЫКЛ');
            } else {
                config.downloadType = _lastActiveDownloadType || 'video';
                showToast(`⭳ Скачивание: ${config.downloadType}`);
            }
            Settings.save();
            window.updateSlideshowHud();
        };

        // 2. Стрелка направления
        const hudArrow = document.createElement('span');
        hudArrow.id = 'mossad-hud-arrow';
        hudArrow.style.cssText = `font-size: 12px; color: #60a5fa; padding: 0 2px;`;

        // 3. Зацикленная стрелка перемотки (Alt+R) сразу за стрелкой направления
        const btnHudRewind = document.createElement('button');
        btnHudRewind.id = 'mossad-hud-rewind';
        btnHudRewind.textContent = '⟲';
        btnHudRewind.title = 'Перемотка в обратную сторону (Alt+R)';
        btnHudRewind.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #a78bfa; cursor: pointer; padding: 3px 6px; font-size: 12px; font-weight: 700; transition: all 0.2s;`;
        btnHudRewind.onclick = (e) => {
            e.stopPropagation();
            if (rootDomain === 'grok.com' && typeof grokStepFilmstrip === 'function') {
                grokStepFilmstrip(false);
            } else if (typeof triggerRewind === 'function') {
                triggerRewind();
            } else if (typeof prevSlide === 'function') {
                prevSlide();
            }
            showToast('⟲ Шаг назад (Alt+R)');
        };

        // 4. Повтор (Loop / R)
        const btnHudLoop = document.createElement('button');
        btnHudLoop.id = 'mossad-hud-loop';
        btnHudLoop.textContent = 'R';
        btnHudLoop.title = 'Повтор ленты (Loop, R)';
        btnHudLoop.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; cursor: pointer; padding: 3px 6px; font-size: 11px; font-weight: 700; transition: all 0.2s;`;
        btnHudLoop.onclick = (e) => {
            e.stopPropagation();
            config.loopFeed = !config.loopFeed;
            Settings.save();
            showToast(config.loopFeed ? '🔁 Повтор (Loop): ВКЛ' : '➡️ Повтор (Loop): ВЫКЛ');
            window.updateSlideshowHud();
        };

        // 5. Видео (секунды): клик сбрасывает в 1, повторный — возвращает прежнее
        let _savedVideoSec = config.videoDuration || 15;
        const btnHudVideo = document.createElement('button');
        btnHudVideo.id = 'mossad-hud-video';
        btnHudVideo.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #38bdf8; cursor: pointer; padding: 3px 6px; font-size: 11px; font-weight: 700; transition: all 0.2s;`;
        btnHudVideo.onclick = (e) => {
            e.stopPropagation();
            if (config.videoDuration !== 1) {
                _savedVideoSec = config.videoDuration || 15;
                config.videoDuration = 1;
                showToast('📹 Видео: 1 с');
            } else {
                config.videoDuration = _savedVideoSec || 15;
                showToast(`📹 Видео: ${config.videoDuration} с`);
            }
            Settings.save();
            window.updateSlideshowHud();
        };

        // 6. Фото (секунды): клик сбрасывает в 1, повторный — возвращает прежнее
        let _savedPhotoSec = config.photoDuration || 5;
        const btnHudPhoto = document.createElement('button');
        btnHudPhoto.id = 'mossad-hud-photo';
        btnHudPhoto.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #f472b6; cursor: pointer; padding: 3px 6px; font-size: 11px; font-weight: 700; transition: all 0.2s;`;
        btnHudPhoto.onclick = (e) => {
            e.stopPropagation();
            if (config.photoDuration !== 1) {
                _savedPhotoSec = config.photoDuration || 5;
                config.photoDuration = 1;
                showToast('🖼 Фото: 1 с');
            } else {
                config.photoDuration = _savedPhotoSec || 5;
                showToast(`🖼 Фото: ${config.photoDuration} с`);
            }
            Settings.save();
            window.updateSlideshowHud();
        };

        // 7. Пауза (секунды): клик сбрасывает в 1, повторный — возвращает прежнее
        let _savedPauseSec = config.pauseDuration || 2;
        const btnHudPause = document.createElement('button');
        btnHudPause.id = 'mossad-hud-pause';
        btnHudPause.style.cssText = `background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fbbf24; cursor: pointer; padding: 3px 6px; font-size: 11px; font-weight: 700; transition: all 0.2s;`;
        btnHudPause.onclick = (e) => {
            e.stopPropagation();
            if (config.pauseDuration !== 1) {
                _savedPauseSec = config.pauseDuration || 2;
                config.pauseDuration = 1;
                showToast('⏸ Пауза: 1 с');
            } else {
                config.pauseDuration = _savedPauseSec || 2;
                showToast(`⏸ Пауза: ${config.pauseDuration} с`);
            }
            Settings.save();
            window.updateSlideshowHud();
        };

        hudRow.append(btnHudDL, hudArrow, btnHudRewind, btnHudLoop, btnHudVideo, btnHudPhoto, btnHudPause);

        window.updateSlideshowHud = () => {
            const isRunning = !!(slideshowActive || window._mossadGalleryActive || (sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true'));
            if (!isRunning) {
                hudRow.style.display = 'none';
                return;
            }
            hudRow.style.display = 'inline-flex';

            // 1. Скачивание
            const isDLActive = config.downloadType && config.downloadType !== 'none';
            btnHudDL.textContent = '⭳';
            btnHudDL.style.color = isDLActive ? '#10b981' : '#6b7280';
            btnHudDL.style.borderColor = isDLActive ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.1)';
            btnHudDL.title = isDLActive ? `Скачивание: ${config.downloadType} (клик — выключить)` : 'Скачивание выключено (клик — включить)';

            // 2. Стрелка направления
            const dir = (config.slideshowDirections && config.slideshowDirections[0]) || 'down';
            const arrows = { down: '↓', up: '↑', right: '→', left: '←' };
            hudArrow.textContent = arrows[dir] || '↓';
            hudArrow.title = `Направление слайд-шоу: ${dir}`;

            // 4. Повтор R
            btnHudLoop.style.color = config.loopFeed ? '#3b82f6' : '#6b7280';
            btnHudLoop.style.borderColor = config.loopFeed ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)';

            // 5. Видео
            btnHudVideo.textContent = `📹 ${config.videoDuration || 15}s`;
            btnHudVideo.style.borderColor = (config.videoDuration === 1) ? '#38bdf8' : 'rgba(255,255,255,0.1)';

            // 6. Фото
            btnHudPhoto.textContent = `🖼 ${config.photoDuration || 5}s`;
            btnHudPhoto.style.borderColor = (config.photoDuration === 1) ? '#f472b6' : 'rgba(255,255,255,0.1)';

            // 7. Пауза
            btnHudPause.textContent = `⏸ ${config.pauseDuration || 2}s`;
            btnHudPause.style.borderColor = (config.pauseDuration === 1) ? '#fbbf24' : 'rgba(255,255,255,0.1)';
        };


        // SETTINGS PANEL
        panel = document.createElement('div');
        panel.id = 'mossad-panel';
        panel.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px;
            display: none; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 12px; transition: opacity 0.2s ease, transform 0.2s ease; opacity: 0; pointer-events: auto; transform: translateY(-10px);
            width: 100%; box-sizing: border-box;
        `;

        /** v1.3.51: подсветка сегмента переключателя (активный — синий, жирный, с рамкой). */
        const mossadPaintSeg = (el, on) => {
            el.classList.toggle('mossad-seg-on', !!on);
            el.setAttribute('aria-pressed', on ? 'true' : 'false');
            el.style.background = on ? '#2563eb' : '#1f2937';
            el.style.color = on ? '#fff' : '#9ca3af';
            el.style.fontWeight = on ? '700' : '400';
            el.style.boxShadow = on ? 'inset 0 0 0 1px #93c5fd' : 'none';
        };

        const renderPanel = () => {
            const dirs = config.slideshowDirections || [];
            const isPinterest = rootDomain.includes('pinterest.');
            const isRatio = (config.pinterestFilterType || 'ratio') === 'ratio';

            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    ${isPinterest ? `
                    <div style="display: flex; flex-direction: column; gap: 6px; background: rgba(255,255,255,0.03); padding: 6px; border-radius: 8px; border: 1px solid #374151; flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: #60a5fa;">📌 Pinterest Режим</span>
                            <label title="Авто «Показать в полном масштабе»: на каждом новом пине (слайдшоу, стрелки, ручной переход) скрипт ждёт до 8 с кнопку главного пина и жмёт её один раз" style="display:flex; align-items:center; gap:3px; cursor:pointer; font-size:11px;">
                                <input id="mossad-cb-fs" type="checkbox" style="accent-color:#3b82f6;" ${config.pinterestAutoFS ? 'checked' : ''}> <span data-mossad-label="pinAutoFS">${LH('pinAutoFS')}</span>
                            </label>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                            <span style="color:#9ca3af;" title="Какой из похожих пинов открыть следующим" data-mossad-label="pinModeLabel">${LH('pinModeLabel')}</span>
                            <div role="group" style="display:inline-flex; border:1px solid #4b5563; border-radius:5px; overflow:hidden;">
                                <button class="mossad-pmode" data-mode="rand" title="rand — случайный из первых 30 похожих пинов" style="border:none; border-right:1px solid #4b5563; padding:2px 7px; cursor:pointer; font-size:11px;" data-mossad-label="pinRand">${LH('pinRand')}</button>
                                <button class="mossad-pmode" data-mode="+1" title="+1 — по очереди: 1-й, 2-й, 3-й… похожий пин (счёт продолжается от пина к пину, по кругу до 30)" style="border:none; border-right:1px solid #4b5563; padding:2px 7px; cursor:pointer; font-size:11px;" data-mossad-label="pinPlus1">${LH('pinPlus1')}</button>
                                <span class="mossad-pmode" data-mode="n" title="№ N — всегда N-й похожий пин (1–30). Клик по полю включает этот режим" style="display:inline-flex; align-items:center; gap:2px; padding:0 4px; cursor:pointer; font-size:11px;"><span data-mossad-label="pinNum">${LH('pinNum')}</span><input id="mossad-in-pmode-n" type="number" min="1" max="30" value="${pinterestModeIsNumber(config.pinterestMode) ? config.pinterestMode : '3'}" style="width:32px; background:#111827; border:1px solid #4b5563; color:#fff; border-radius:3px; text-align:center; font-size:11px;"></span>
                            </div>
                            <div role="group" title="Направление слайдшоу: ▶ вперёд — новые пины; ◀ назад — по истории (в начале истории — дальше вперёд)" style="display:inline-flex; border:1px solid #4b5563; border-radius:5px; overflow:hidden; margin-left:auto;">
                                <button class="mossad-pdir" data-dir="back" title="◀ Слайдшоу назад по истории" style="border:none; border-right:1px solid #4b5563; padding:2px 6px; cursor:pointer; font-size:11px;" data-mossad-label="pinDirBack">${LH('pinDirBack')}</button>
                                <button class="mossad-pdir" data-dir="fwd" title="▶ Слайдшоу вперёд по новым пинам" style="border:none; padding:2px 6px; cursor:pointer; font-size:11px;" data-mossad-label="pinDirFwd">${LH('pinDirFwd')}</button>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;" title="Похожий пин клавишей 1..9, 0, Q..P, A..L, Z..M (по клавиатуре, в любой раскладке; занятые хоткеями MOSSAD пропускаются). «Фокус» — только выделить пин (как Tab), открыть — Пробел/Enter. «Переход» — сразу открыть. «…номера по Shift» — номера видны, пока зажат Shift или включён CapsLock">
                            <span style="color:#9ca3af;" data-mossad-label="pinJumpLabel">${LH('pinJumpLabel')}</span>
                            <select id="mossad-sel-pjump" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px; font-size:11px;"><option value="off" ${pinterestJumpMode() === 'off' ? 'selected' : ''} data-mossad-label="pinJumpOff">${LH('pinJumpOff')}</option><option value="focus" ${pinterestJumpMode() === 'focus' ? 'selected' : ''} data-mossad-label="pinJumpFocus">${LH('pinJumpFocus')}</option><option value="keys" ${pinterestJumpMode() === 'keys' ? 'selected' : ''} data-mossad-label="pinJumpKeys">${LH('pinJumpKeys')}</option><option value="badges" ${pinterestJumpMode() === 'badges' ? 'selected' : ''} data-mossad-label="pinJumpBadges">${LH('pinJumpBadges')}</option><option value="shift" ${pinterestJumpMode() === 'shift' ? 'selected' : ''} data-mossad-label="pinJumpShift">${LH('pinJumpShift')}</option></select>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color:#9ca3af;">Тип:</span>
                            <select id="mossad-sel-ptype" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px; font-size:11px;">
                                <option value="ratio" ${config.pinterestFilterType === 'ratio' ? 'selected' : ''}>Пропорция %</option>
                                <option value="all" ${config.pinterestFilterType === 'all' ? 'selected' : ''}>Все</option>
                                <option value="image" ${config.pinterestFilterType === 'image' ? 'selected' : ''}>Только Фото</option>
                                <option value="video" ${config.pinterestFilterType === 'video' ? 'selected' : ''}>Только Видео</option>
                            </select>
                        </div>
                        ${isRatio ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                            <label style="display:flex; align-items:center; gap:2px;" title="Не монетка и не строгое чередование: серии бывают, но чем длиннее серия фото, тем вероятнее видео (и наоборот); доля за ~20 последних пинов тянется к заданной. 50/50: после 3 фото подряд ≈80% видео">🖼 Фото %: <input id="mossad-in-photo-pct" type="number" min="0" max="100" value="${config.pinterestPhotoPercent ?? 50}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;"></label>
                            <label style="display:flex; align-items:center; gap:2px;">🎬 Видео %: <input id="mossad-in-video-pct" type="number" min="0" max="100" value="${100 - (config.pinterestPhotoPercent ?? 50)}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;"></label>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <label title="Макс. длительность видео в секундах (0 = без лимита)" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                Макс. видео (сек): <input id="mossad-in-vmax" type="number" min="0" max="999" value="${config.pinterestMaxVideoDuration || 0}" style="width:40px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;">
                            </label>
                        </div>
                    </div>
                    ` : `
                    <div style="display: grid; grid-template-columns: 24px 24px 24px; grid-template-rows: 24px 24px 24px; gap: 2px; align-items: center; justify-items: center;">
                        <div></div>
                        <button class="mossad-dpad" data-dir="up" title="Листать вверх" style="background: ${dirs.includes('up') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;" data-mossad-label="dpadUp">${LH('dpadUp')}</button>
                        <div></div>
                        <button class="mossad-dpad" data-dir="left" title="Листать влево" style="background: ${dirs.includes('left') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;" data-mossad-label="dpadLeft">${LH('dpadLeft')}</button>
                        <button id="mossad-dpad-loop" title="Повторять плейлист (R): перемотка на начало при конце ленты" style="background: ${config.loopFeed ? '#10b981' : '#1f2937'}; border: 1px solid ${config.loopFeed ? '#059669' : '#374151'}; color: ${config.loopFeed ? '#fff' : '#9ca3af'}; width:24px; height:24px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px; padding:0; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" data-mossad-label="dpadLoop">${LH('dpadLoop')}</button>
                        <button class="mossad-dpad" data-dir="right" title="Листать вправо" style="background: ${dirs.includes('right') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;" data-mossad-label="dpadRight">${LH('dpadRight')}</button>
                        <div></div>
                        <button class="mossad-dpad" data-dir="down" title="Листать вниз" style="background: ${dirs.includes('down') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;" data-mossad-label="dpadDown">${LH('dpadDown')}</button>
                        <div></div>
                    </div>
                    `}
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 95px;">
                        <label title="Круги видео" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            <span data-mossad-label="loopsLabel">${LH('loopsLabel')}</span> <input id="mossad-in-loops" type="number" min="1" max="100" value="${config.videoLoops}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Задержка фото" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            <span data-mossad-label="photoLabel">${LH('photoLabel')}</span> <input id="mossad-in-pdelay" type="number" min="0" max="999" value="${config.slideshowDelay}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Пауза после видео" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            <span data-mossad-label="pauseLabel">${LH('pauseLabel')}</span> <input id="mossad-in-vdelay" type="number" min="0" max="999" value="${config.delayAfterVideo}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 6px;">
                    <button id="mossad-btn-export-list" style="background:#1f2937; border:1px solid #374151; border-radius:4px; padding:2px 8px; color:#fbbf24; cursor:pointer; font-weight:bold; font-size:11px; display:flex; align-items:center; gap:4px;" title="Скачать список собранных ссылок (.txt)" data-mossad-label="exportList">${LH('exportList')}</button>
                    <div style="display:flex; align-items:center; gap:3px; background:#1f2937; border:1px solid #374151; border-radius:4px; padding:1px 5px;">
                        <span style="font-size:10px; color:#9ca3af;" title="Масштаб интерфейса MOSSAD">🔍</span>
                        <button id="mossad-btn-zoom-dec" style="background:transparent; border:none; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px; padding:0 3px;" title="Уменьшить масштаб виджета" data-mossad-label="zoomDec">${LH('zoomDec')}</button>
                        <span id="mossad-zoom-val" style="font-size:10px; color:#60a5fa; cursor:pointer; min-width:32px; text-align:center;" title="Клик — сбросить на 100%">${Math.round((config.widgetZoom || 1) * 100)}%</span>
                        <button id="mossad-btn-zoom-inc" style="background:transparent; border:none; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px; padding:0 3px;" title="Увеличить масштаб виджета" data-mossad-label="zoomInc">${LH('zoomInc')}</button>
                    </div>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <label title="Использовать шаблон имени файла при скачивании" style="display:flex; align-items:center; gap:4px; white-space:nowrap; cursor:pointer;">
                        <input id="mossad-cb-fn-tpl" type="checkbox" style="accent-color:#3b82f6;" ${config.filenameTemplateEnabled ? 'checked' : ''}> <span data-mossad-label=\"tplLabel\">${LH('tplLabel')}</span> <span style="font-size:10px;color:#38bdf8;font-weight:700;" title="Шаблон сохраняется строго для ${rootDomain}">[${rootDomain}]</span>
                    </label>
                    <input id="mossad-in-fn-tpl" type="text" placeholder="${getDefaultFilenameTemplate()}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон: {id8} {conv4} {domain} {domainfull} {account} {username} {desc} {title} {date} {time} {ext} {n} {dbl} {oldname} — «?» справа: все теги и итоговое имя"
                        style="flex:1; min-width:0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px 5px; font-size:11px;">
                    <button class="mossad-tpl-help-btn" data-for="mossad-in-fn-tpl" title="Теги шаблона и «как скачается сейчас»" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button>
                    <button id="mossad-btn-save-tpl-global" title="Сохранить шаблон глобально для ${rootDomain} (во всех вкладках)" style="background:#1f2937; border:1px solid #374151; color:#60a5fa; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:11px;" data-mossad-label="saveTplGlobal">${LH('saveTplGlobal')}</button>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                ${(window.MOSSAD_ENGINES?.huggingface?.isSupported() || rootDomain.includes('huggingface') || rootDomain.includes('hf.space')) ? `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 4px;">
                    <span style="font-size:11px; color:#cbd5e1;" title="Автосохранение сгенерированных результатов Space">🤖 HF Авто-DL:</span>
                    <select id="mossad-sel-hf-autosave" style="background:#1f2937; border:1px solid #374151; color:#38bdf8; border-radius:4px; padding:2px; font-size:11px; flex:1;">
                        <option value="off" ${config.hfAutoSave === 'off' ? 'selected' : ''}>Не сохранять</option>
                        <option value="page" ${config.hfAutoSave === 'page' ? 'selected' : ''}>На этой странице</option>
                        <option value="space" ${config.hfAutoSave === 'space' ? 'selected' : ''}>Для этого Space всегда</option>
                        <option value="always" ${config.hfAutoSave === 'always' ? 'selected' : ''}>Для всех Space всегда</option>
                    </select>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select id="mossad-sel-dl" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${config.downloadType === 'none' ? 'selected' : ''}>Не скачивать</option>
                        <option value="all" ${config.downloadType === 'all' ? 'selected' : ''}>Качать Всё</option>
                        <option value="photo" ${config.downloadType === 'photo' ? 'selected' : ''}>Качать Фото</option>
                        <option value="video" ${config.downloadType === 'video' ? 'selected' : ''}>Качать Видео</option>
                    </select>
                    <span style="display:flex; align-items:center; gap:4px;" title="Что делать после скачивания. «Не СШ +1» — перейти к следующему, только если слайдшоу не запущено (на паузе — считается запущенным). «+1 всегда» — всегда (кроме скачивания самим слайдшоу: оно шагает само). Delete — только Grok">
                    <span data-mossad-label="pdLabel" style="white-space:nowrap;">${LH('pdLabel')}</span>
                    <select id="mossad-sel-pd" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${mossadPdAction() === 'none' ? 'selected' : ''} data-mossad-label="pdNone">${LH('pdNone')}</option>
                        <option value="upns" ${mossadPdAction() === 'upns' ? 'selected' : ''} data-mossad-label="pdUpNoSs">${LH('pdUpNoSs')}</option>
                        <option value="always" ${mossadPdAction() === 'always' ? 'selected' : ''} data-mossad-label="pdUpAlways">${LH('pdUpAlways')}</option>
                        ${rootDomain === 'grok.com' ? `<option value="del" ${mossadPdAction() === 'del' ? 'selected' : ''} data-mossad-label="pdDel">${LH('pdDel')}</option>`
                          : (mossadPdAction() === 'del' ? `<option value="del" selected disabled>${LH('pdDel')} (только Grok)</option>` : '')}
                    </select>
                    </span>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <label title="Пауза при переключении вкладки"><input id="mossad-cb-tab" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnTabSwitch ? 'checked' : ''}> Tab</label>
                    <label title="Пауза при потере фокуса браузера"><input id="mossad-cb-brsr" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnBrsrSwitch ? 'checked' : ''}> Brsr</label>
                    <label title="Авто Full Screen при переходе"><input id="mossad-cb-universal-fs" type="checkbox" style="accent-color:#3b82f6;" ${(config.autoFS !== undefined ? config.autoFS : config.pinterestAutoFS) ? 'checked' : ''}> FS</label>
                    <label title="Качать дубликаты сразу без подтверждения"><input id="mossad-cb-allow-dup" type="checkbox" style="accent-color:#3b82f6;" ${config.allowDuplicates ? 'checked' : ''}> Дубли</label>
                    ${rootDomain === 'grok.com' ? `
                    <label title="Удержание позиции + автоподтверждение удаления"><input id="mossad-cb-holdpost" type="checkbox" style="accent-color:#3b82f6;" ${(config.deleteHoldpost || config.deleteAutoconfirm) ? 'checked' : ''}> hold post</label>
                    ` : ''}
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <label title="Ширина списка плейлиста в px (0 = авто под ширину меню)" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                        Ширина списка (px): <input id="mossad-in-playlist-w" type="number" min="0" max="800" step="10" value="${config.playlistWidth || 0}" style="width:48px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;" title="0 = авто под ширину меню">
                    </label>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-btn-hk" style="flex:1; background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px; color:#60a5fa; cursor:pointer; font-weight:bold; transition:all 0.2s;" data-mossad-label="settings">${LH('settings')}</button>
                    <button id="mossad-btn-import-db" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#34d399; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Импортировать базу хешей (результат scan_local_files.py)" data-mossad-label="importDb">${LH('importDb')}</button>
                    <button id="mossad-btn-reset-cfg" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#f87171; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Сбросить все настройки и клавиши по умолчанию" data-mossad-label="resetCfg">${LH('resetCfg')}</button>
                    <input id="mossad-file-db" type="file" accept=".json" style="display:none;">
                </div>
            `;
            
            // Listeners for panel
            panel.querySelectorAll('.mossad-dpad').forEach(btn => {
                btn.onclick = () => Settings.set('slideshowDirections', [btn.dataset.dir]);
            });
            const btnLoop = panel.querySelector('#mossad-dpad-loop');
            if (btnLoop) {
                btnLoop.onclick = () => {
                    const nextVal = !config.loopFeed;
                    Settings.set('loopFeed', nextVal);
                    showToast(nextVal ? '🔁 Повтор плейлиста включен (R)' : '➡️ Повтор плейлиста выключен');
                    window.updateWidgetUI();
                };
            }
            const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

            if (isPinterest) {
                // v1.3.51: сегменты [rand][+1][№ N] и [◀][▶] — активный подсвечен; сохраняем тихо (без перерисовки,
                // фокус в поле не теряется). Раньше выбранный «№» ничем не выделялся. ANTI_PATTERNS §30.
                const paintPinterestSegs = () => {
                    panel.querySelectorAll('.mossad-pmode').forEach(el => {
                        const m = el.dataset.mode;
                        const on = m === 'n' ? pinterestModeIsNumber(config.pinterestMode) : config.pinterestMode === m;
                        mossadPaintSeg(el, on);
                    });
                    panel.querySelectorAll('.mossad-pdir').forEach(el => mossadPaintSeg(el, (config.pinterestDir === 'back' ? 'back' : 'fwd') === el.dataset.dir));
                };
                const inN = panel.querySelector('#mossad-in-pmode-n');
                const numVal = () => String(Math.min(30, Math.max(1, parseInt(inN && inN.value, 10) || 1)));
                panel.querySelectorAll('.mossad-pmode').forEach(el => {
                    el.onclick = () => {
                        const m = el.dataset.mode === 'n' ? numVal() : el.dataset.mode;
                        if (config.pinterestMode !== m) Settings.setQuiet('pinterestMode', m);
                        paintPinterestSegs();
                    };
                });
                if (inN) {
                    inN.oninput = debounce(() => {
                        Settings.setQuiet('pinterestMode', numVal());
                        paintPinterestSegs();
                    }, 300);
                }
                const selPJump = panel.querySelector('#mossad-sel-pjump');
                if (selPJump) selPJump.onchange = (e) => { Settings.setQuiet('pinterestJumpKeys', e.target.value); pinterestJumpApply(); };
                panel.querySelectorAll('.mossad-pdir').forEach(el => {
                    el.onclick = () => {
                        Settings.setQuiet('pinterestDir', el.dataset.dir === 'back' ? 'back' : 'fwd');
                        paintPinterestSegs();
                    };
                });
                paintPinterestSegs();
                const selPType = panel.querySelector('#mossad-sel-ptype');
                if (selPType) {
                    selPType.onchange = (e) => Settings.set('pinterestFilterType', e.target.value);
                }
                const inPhotoPct = panel.querySelector('#mossad-in-photo-pct');
                const inVideoPct = panel.querySelector('#mossad-in-video-pct');
                if (inPhotoPct && inVideoPct) {
                    inPhotoPct.oninput = debounce((e) => {
                        let pVal = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                        inVideoPct.value = 100 - pVal;
                        Settings.set('pinterestPhotoPercent', pVal);
                    }, 300);
                    inVideoPct.oninput = debounce((e) => {
                        let vVal = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                        let pVal = 100 - vVal;
                        inPhotoPct.value = pVal;
                        Settings.set('pinterestPhotoPercent', pVal);
                    }, 300);
                }
                const inVMax = panel.querySelector('#mossad-in-vmax');
                if (inVMax) {
                    inVMax.oninput = debounce((e) => {
                        Settings.set('pinterestMaxVideoDuration', Math.max(0, parseInt(e.target.value, 10) || 0));
                    }, 300);
                }
                const cbFS = panel.querySelector('#mossad-cb-fs');
                if (cbFS) {
                    cbFS.onchange = (e) => Settings.set('pinterestAutoFS', e.target.checked);
                }
            }
            // Инпуты таймеров (Видео круги, Фото задержка, Пауза после видео) доступны ВСЕГДА
            // v1.3.41: 0 с — допустимое значение (раньше «0 || 3» / «0 || 2» превращало 0 в 3 / 2 с, а для фото min был 1).
            // Пустое/некорректное поле — значение не меняется.
            const numOr = (v, fallback) => { const n = parseFloat(v); return isFinite(n) ? n : fallback; };
            panel.querySelector('#mossad-in-loops').oninput = debounce((e) => Settings.set('videoLoops', Math.max(1, Math.round(numOr(e.target.value, config.videoLoops)))), 300);
            panel.querySelector('#mossad-in-pdelay').oninput = debounce((e) => Settings.set('slideshowDelay', Math.max(0, numOr(e.target.value, config.slideshowDelay))), 300);
            panel.querySelector('#mossad-in-vdelay').oninput = debounce((e) => Settings.set('delayAfterVideo', Math.max(0, numOr(e.target.value, config.delayAfterVideo))), 300);
            panel.querySelector('#mossad-sel-dl').onchange = (e) => Settings.set('downloadType', e.target.value);
            panel.querySelector('#mossad-sel-pd').onchange = (e) => Settings.set('pdAction', e.target.value);
            const selHfAutoSave = panel.querySelector('#mossad-sel-hf-autosave');
            if (selHfAutoSave) {
                selHfAutoSave.onchange = (e) => {
                    const val = e.target.value;
                    Settings.set('hfAutoSave', val);
                    if (val === 'space' && window.MOSSAD_ENGINES?.huggingface) {
                        const meta = window.MOSSAD_ENGINES.huggingface.getSpaceMetadata();
                        localStorage.setItem(`mossad_hf_autosave_${meta.space}`, 'true');
                    }
                    showToast(`🤖 HF Автосохранение: ${selHfAutoSave.options[selHfAutoSave.selectedIndex].text}`);
                };
            }
            panel.querySelector('#mossad-cb-fn-tpl').onchange = (e) => Settings.set('filenameTemplateEnabled', e.target.checked);
            const fnTplInput = panel.querySelector('#mossad-in-fn-tpl');
            const _saveFnTpl = (e) => mossadSaveSiteTemplate(e.target.value); // v1.3.53: обновляет и 💾 GM-шаблон сайта
            mossadWireTplHelp(panel);
            fnTplInput.onblur   = _saveFnTpl;  // сохранить при потере фокуса (Tab / клик)
            fnTplInput.onchange = _saveFnTpl;  // сохранить при Enter

            const btnSaveTplGlobal = panel.querySelector('#mossad-btn-save-tpl-global');
            if (btnSaveTplGlobal) {
                btnSaveTplGlobal.onclick = () => {
                    const val = fnTplInput.value.trim();
                    Settings.set('filenameTemplate', val);
                    if (typeof GM_setValue === 'function') {
                        GM_setValue('mossad_tpl_' + rootDomain, val);
                        showToast(`💾 Шаблон сохранён глобально для ${rootDomain}`);
                    } else {
                        showToast('💾 Шаблон сохранён локально');
                    }
                };
            }

            const btnExportList = panel.querySelector('#mossad-btn-export-list');
            if (btnExportList) {
                btnExportList.onclick = () => {
                    if (typeof grokDownloadCollection === 'function') {
                        grokDownloadCollection();
                    } else {
                        showToast('⚠️ Экспорт списка доступен на Grok', true);
                    }
                };
            }

            const btnZoomDec = panel.querySelector('#mossad-btn-zoom-dec');
            const btnZoomInc = panel.querySelector('#mossad-btn-zoom-inc');
            const lblZoomVal = panel.querySelector('#mossad-zoom-val');
            if (btnZoomDec && btnZoomInc && lblZoomVal) {
                btnZoomDec.onclick = () => {
                    const cur = config.widgetZoom || 1.0;
                    const nxt = Math.max(0.6, Math.round((cur - 0.1) * 10) / 10);
                    config.widgetZoom = nxt;
                    Settings.save();
                    lblZoomVal.textContent = `${Math.round(nxt * 100)}%`;
                    if (window.applyWidgetZoom) window.applyWidgetZoom();
                };
                btnZoomInc.onclick = () => {
                    const cur = config.widgetZoom || 1.0;
                    const nxt = Math.min(1.8, Math.round((cur + 0.1) * 10) / 10);
                    config.widgetZoom = nxt;
                    Settings.save();
                    lblZoomVal.textContent = `${Math.round(nxt * 100)}%`;
                    if (window.applyWidgetZoom) window.applyWidgetZoom();
                };
                lblZoomVal.onclick = () => {
                    config.widgetZoom = 1.0;
                    Settings.save();
                    lblZoomVal.textContent = '100%';
                    if (window.applyWidgetZoom) window.applyWidgetZoom();
                };
            }
            panel.querySelector('#mossad-cb-tab').onchange = (e) => Settings.set('stopOnTabSwitch', e.target.checked);
            panel.querySelector('#mossad-cb-brsr').onchange = (e) => Settings.set('stopOnBrsrSwitch', e.target.checked);
            const cbUniFS = panel.querySelector('#mossad-cb-universal-fs');
            if (cbUniFS) {
                cbUniFS.onchange = (e) => {
                    Settings.set('autoFS', e.target.checked);
                    Settings.set('pinterestAutoFS', e.target.checked);
                };
            }
            const cbAllowDup = panel.querySelector('#mossad-cb-allow-dup');
            if (cbAllowDup) {
                cbAllowDup.onchange = (e) => Settings.set('allowDuplicates', e.target.checked);
            }
            if (rootDomain === 'grok.com') {
                const cbHold = panel.querySelector('#mossad-cb-holdpost');
                if (cbHold) {
                    cbHold.onchange = (e) => {
                        Settings.set('deleteHoldpost', e.target.checked);
                        Settings.set('deleteAutoconfirm', e.target.checked);
                    };
                }
            }
            const inPlW = panel.querySelector('#mossad-in-playlist-w');
            if (inPlW) {
                inPlW.oninput = debounce((e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    Settings.set('playlistWidth', val);
                    if (val > 0) {
                        localStorage.setItem('mossad_playlist_width', String(val));
                    } else {
                        localStorage.removeItem('mossad_playlist_width');
                    }
                    const pl = document.getElementById('mossad-playlist-panel');
                    if (pl) {
                        pl.style.width = val > 0 ? (val + 'px') : '100%';
                    }
                }, 300);
            }
            const btnImportDb = panel.querySelector('#mossad-btn-import-db');
            const fileDbInput = panel.querySelector('#mossad-file-db');
            if (btnImportDb && fileDbInput) {
                btnImportDb.onclick = () => fileDbInput.click();
                fileDbInput.onchange = (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        try {
                            const data = JSON.parse(evt.target.result);
                            {
                                const count = await importDownloadHistory(data);
                                showToast(`✅ Импортировано ${count} записей в базу хешей!`);
                            }
                        } catch (err) {
                            showToast('❌ Ошибка чтения JSON файла базы', true);
                        }
                    };
                    reader.readAsText(file, 'utf-8');
                };
            }
            panel.querySelector('#mossad-btn-hk').onclick = () => {
                openSettingsWindow(); // v1.3.45: последняя открытая вкладка (раньше всегда «Общие»)
            };
            panel.querySelector('#mossad-btn-reset-cfg').onclick = () => {
                if (!confirm('Сбросить все настройки и горячие клавиши по умолчанию?')) return;
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem('mossad_playlist_width');
                // v1.3.48: закреплённые (🔒) хоткеи сброс не меняет; остальные — к общим умолчаниям клавиш, если сохранены
                const pinnedHk = {};
                try { getHotkeyPinned().forEach(k => { if (config.hk && config.hk[k]) pinnedHk[k] = JSON.parse(JSON.stringify(config.hk[k])); }); } catch (e) {}
                Object.assign(config, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
                try { Object.keys(config.hk).forEach(k => { config.hk[k] = hotkeyDefaultFor(k); }); } catch (e) {}
                Object.assign(config.hk, pinnedHk);
                // v1.3.41: сайт без своих настроек получает общие умолчания (вкладка «🌐 По умолчанию»), если они есть
                const gd = GlobalDefaults.read();
                if (gd) Object.assign(config, JSON.parse(JSON.stringify(gd)));
                window.updateWidgetUI();
                showToast(gd ? '✅ Настройки сайта сброшены к общим умолчаниям' : '✅ Настройки сброшены по умолчанию');
            };
        };

        container.append(topBar, hudRow, panel);
        const targetParent = document.body || document.documentElement;
        if (targetParent) {
            targetParent.appendChild(container);
        } else {
            window.addEventListener('DOMContentLoaded', () => {
                const b = document.body || document.documentElement;
                if (b && !container.isConnected) b.appendChild(container);
            });
        }

        // Actions (btnStart.onclick handles start/pause toggle)

        window.cycleWidgetMenuState = () => {
            // 3-позиционная логика по Ctrl+Insert (циклическое переключение):
            // 1-е нажатие: Открывается полное меню (все 3 блока/строки, включая панель настроек)
            // 2-е нажатие: Сворачивается до сокращённого меню (только 2 верхние строки)
            // 3-е нажатие: Меню полностью скрывается с экрана (режим click-through)
            // Следующее нажатие: Снова открывает полное меню (цикл заново)
            if (window.widgetState === 'hidden') {
                window.widgetState = 'panel';
            } else if (window.widgetState === 'panel') {
                window.widgetState = 'bar';
            } else {
                window.widgetState = 'hidden';
            }
            sessionStorage.setItem(SESSION_STATE_KEY, window.widgetState);
            window.updateWidgetUI();
        };

        window.updateWidgetUI = () => {
            const galleryRow = document.getElementById('mossad-gallery-row');
            const playlistPanel = document.getElementById('mossad-playlist-panel');

            sessionStorage.setItem(SESSION_STATE_KEY, window.widgetState);

            if (window.widgetState === 'hidden') {
                container.style.display = 'none';
                container.style.pointerEvents = 'none';
                topBar.style.display = 'none';
                panel.style.display = 'none';
                panel.style.pointerEvents = 'none';
                if (galleryRow) galleryRow.style.display = 'none';
                if (playlistPanel) playlistPanel.style.display = 'none';
            } else if (window.widgetState === 'bar') {
                container.style.display = 'flex';
                container.style.pointerEvents = 'none';
                topBar.style.display = 'flex';
                topBar.style.pointerEvents = 'auto';
                panel.style.display = 'none';
                panel.style.pointerEvents = 'none';
                panel.style.opacity = '0';
                if (galleryRow) {
                    const isRowOpen = sessionStorage.getItem('mossad_gallery_row_visible') === 'true';
                    galleryRow.style.display = isRowOpen ? 'flex' : 'none';
                    galleryRow.style.pointerEvents = isRowOpen ? 'auto' : 'none';
                }
                if (playlistPanel) {
                    playlistPanel.style.display = 'flex'; // v1.3.77: было 'block' — тело списка теряло предел и прокрутку
                    playlistPanel.style.pointerEvents = 'auto';
                    if (typeof grokApplyPlaylistAutoHeight === 'function') grokApplyPlaylistAutoHeight(playlistPanel);
                }
                btnTogglePanel.style.transform = 'rotate(0deg)';
                btnTogglePanel.style.color = '#9ca3af';
            } else if (window.widgetState === 'panel') {
                container.style.display = 'flex';
                container.style.pointerEvents = 'none';
                topBar.style.display = 'flex';
                topBar.style.pointerEvents = 'auto';
                if (galleryRow) {
                    const isRowOpen = sessionStorage.getItem('mossad_gallery_row_visible') === 'true';
                    galleryRow.style.display = isRowOpen ? 'flex' : 'none';
                    galleryRow.style.pointerEvents = isRowOpen ? 'auto' : 'none';
                }
                if (playlistPanel) {
                    playlistPanel.style.display = 'flex'; // v1.3.77: было 'block' — тело списка теряло предел и прокрутку
                    playlistPanel.style.pointerEvents = 'auto';
                    if (typeof grokApplyPlaylistAutoHeight === 'function') grokApplyPlaylistAutoHeight(playlistPanel);
                }
                renderPanel(); // re-render to reflect settings
                panel.style.display = 'flex';
                panel.style.pointerEvents = 'auto';
                panel.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
                btnTogglePanel.style.transform = 'rotate(180deg)';
                btnTogglePanel.style.color = '#3b82f6';
            }
            
            const isAnyActive = !!(slideshowActive || window._mossadGalleryActive);
            if (isAnyActive) {
                btnStart.textContent = '❚❚';
                btnStart.title = 'Пауза слайдшоу (Insert)';
                btnStart.style.background = '#3b82f6'; // Bright blue
                btnStart.style.color = '#ffffff';
                btnStart.style.boxShadow = '0 0 10px rgba(59,130,246,0.6)';
            } else {
                btnStart.textContent = '▶';
                btnStart.title = 'Старт слайдшоу (Insert)';
                btnStart.style.background = '#1f2937'; // Gray
                btnStart.style.color = '#e5e7eb';
                btnStart.style.boxShadow = 'none';
            }
            if (typeof window.updateSlideshowHud === 'function') {
                window.updateSlideshowHud();
            }
        };

        window.updateWidgetUI();

        // ── v1.3.37: сворачивание панели настроек кликом вне MOSSAD ──
        // Только реальные клики пользователя (isTrusted), только в состоянии 'panel' → 'bar'.
        // Игнорируются: клики по любым элементам MOSSAD (виджет, модалка F1, плейлист, тосты, уведомления —
        // всё с id="mossad-…"), а также клики, начатые внутри MOSSAD (перетаскивание виджета,
        // ресайз плейлиста, выделение текста в полях — mouseup снаружи не закрывает панель).
        // Клик не перехватывается: страница получает его как обычно.
        const isInsideMossad = (el) => !!(el && el.closest && el.closest('[id^="mossad-"]'));
        let _pointerDownInside = false;
        document.addEventListener('pointerdown', (e) => {
            _pointerDownInside = isInsideMossad(e.target);
        }, true);
        document.addEventListener('click', (e) => {
            const downInside = _pointerDownInside;
            _pointerDownInside = false;
            if (!e.isTrusted || config.closePanelOnOutsideClick === false) return;
            if (window.widgetState !== 'panel') return;
            if (downInside || isInsideMossad(e.target)) return;
            if (document.getElementById('mossad-hk-modal')) return; // открыта модалка F1
            window.widgetState = 'bar';
            window.updateWidgetUI();
        }, true);

        // Tracker Time
        setInterval(() => {
            if (window.widgetState === 'hidden') return;
            // v1.3.38: во время слайдшоу показываем то видео, по которому реально считаются круги
            const tracked = (slideshowActive && currentVideoNode && currentVideoNode.isConnected) ? currentVideoNode : null;
            const video = tracked || getActiveVideo();
            if (slideshowActive) {
                timerEl.style.color = '#3b82f6';
                if (isCountingDown) {
                    timerEl.textContent = countdownSeconds + 'с';
                } else if (video && !isNaN(video.duration)) {
                    const loopsTxt = (tracked && config.videoLoops > 1) ? ` ↺${Math.min(currentLoopCount + 1, config.videoLoops)}/${config.videoLoops}` : '';
                    timerEl.textContent = `${formatTime(video.currentTime)}/${formatTime(video.duration)}${loopsTxt}`;
                } else {
                    timerEl.textContent = '⏳...';
                }
            } else {
                if (video && !isNaN(video.duration)) {
                    timerEl.textContent = `${formatTime(video.currentTime)}/${formatTime(video.duration)}`;
                } else {
                    timerEl.textContent = '--:--';
                }
                timerEl.style.color = '#9ca3af';
            }
        }, 500);
    }

    function safeInitWidget() {
        try {
            initWidget();
        } catch (err) {
            console.error('[MOSSAD] initWidget error:', err);
        }
        try {
            initGrokGalleryBar();
        } catch (err) {
            console.error('[MOSSAD] initGrokGalleryBar error:', err);
        }
        try {
            grokGallerySlideshowTick();
        } catch (err) {
            console.error('[MOSSAD] grokGallerySlideshowTick error:', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', safeInitWidget);
    } else {
        safeInitWidget();
    }
