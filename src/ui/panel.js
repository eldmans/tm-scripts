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
        const container = document.createElement('div');
        container.id = 'mossad-widget-container';

        let savedPos = null;
        try {
            savedPos = JSON.parse(localStorage.getItem('mossad_widget_pos'));
        } catch(e) {}

        const defTop = isGrokSavedPage() ? '72px' : '20px';
        const initTop = (savedPos && savedPos.top) ? savedPos.top : defTop;
        const initLeft = (savedPos && savedPos.left) ? savedPos.left : null;

        container.style.cssText = `
            position: fixed;
            top: ${initTop};
            ${initLeft ? `left: ${initLeft};` : 'right: 20px;'}
            z-index: 999998;
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; user-select: none;
            display: flex; flex-direction: column; gap: 4px;
        `;

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
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 6px 12px;
            display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: all 0.3s ease; cursor: grab;
        `;
        window.makeWidgetDraggable(topBar);
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 13px; min-width: 95px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 4px;`;
        
        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.title = 'Скрыть виджет';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1; transition: color 0.2s;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        const btnReset = document.createElement('button');
        btnReset.id = 'mossad-btn-rewind-bar';
        btnReset.innerHTML = '↺';
        btnReset.title = 'Перемотка (Alt+R)';
        btnReset.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 15px; padding: 0 4px;`;

        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.innerHTML = '🚀 Пуск';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 5px 12px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;
        
        const btnGear = document.createElement('button');
        btnGear.innerHTML = '⚙▼';
        btnGear.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 14px; padding: 0 4px; transition: color 0.2s ease;`;
        
        const btnDL = document.createElement('button');
        btnDL.innerHTML = '💾';
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 14px; padding: 4px 8px;`;

        const btnUpdate = document.createElement('button');
        btnUpdate.innerHTML = '🔄';
        btnUpdate.title = 'Обновить скрипт (Win+Alt+R)';
        btnUpdate.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #60a5fa; cursor: pointer; font-size: 14px; padding: 4px 8px; transition: transform 0.2s ease;`;
        btnUpdate.onclick = () => {
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        };

        // Порядок: ✕ | …таймер… | 🚀Пуск | ⚙▼ | 💾 | ↺ | 🔄
        topBar.append(btnClose, timerEl, btnStart, btnGear, btnDL, btnReset, btnUpdate);

        // SETTINGS PANEL
        const panel = document.createElement('div');
        panel.id = 'mossad-panel';
        panel.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px;
            display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 12px; transition: all 0.3s ease; opacity: 0; pointer-events: none; transform: translateY(-10px);
        `;

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
                            <label title="Авто разворачивание во весь экран" style="display:flex; align-items:center; gap:3px; cursor:pointer; font-size:11px;">
                                <input id="mossad-cb-fs" type="checkbox" style="accent-color:#3b82f6;" ${config.pinterestAutoFS ? 'checked' : ''}> FS
                            </label>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <span style="color:#9ca3af;">Пин:</span>
                            <button class="mossad-pmode" data-mode="rand" style="background:${config.pinterestMode === 'rand' ? '#3b82f6' : '#1f2937'}; border:1px solid #374151; color:#fff; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:11px;">rand</button>
                            <button class="mossad-pmode" data-mode="+1" style="background:${config.pinterestMode === '+1' ? '#3b82f6' : '#1f2937'}; border:1px solid #374151; color:#fff; padding:2px 6px; border-radius:4px; cursor:pointer; font-size:11px;">+1</button>
                            <input id="mossad-in-pmode-n" type="number" min="1" max="9" value="${!isNaN(parseInt(config.pinterestMode, 10)) ? config.pinterestMode : '1'}" style="width:30px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;" title="Номер пина 1-9">
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
                            <label style="display:flex; align-items:center; gap:2px;">🖼 Фото %: <input id="mossad-in-photo-pct" type="number" min="0" max="100" value="${config.pinterestPhotoPercent ?? 50}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center; font-size:11px;"></label>
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
                        <button class="mossad-dpad" data-dir="up" title="Листать вверх" style="background: ${dirs.includes('up') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;">▲</button>
                        <div></div>
                        <button class="mossad-dpad" data-dir="left" title="Листать влево" style="background: ${dirs.includes('left') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;">◀</button>
                        <button id="mossad-dpad-loop" title="Повторять плейлист (R): перемотка на начало при конце ленты" style="background: ${config.loopFeed ? '#10b981' : '#1f2937'}; border: 1px solid ${config.loopFeed ? '#059669' : '#374151'}; color: ${config.loopFeed ? '#fff' : '#9ca3af'}; width:24px; height:24px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:12px; padding:0; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">R</button>
                        <button class="mossad-dpad" data-dir="right" title="Листать вправо" style="background: ${dirs.includes('right') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;">▶</button>
                        <div></div>
                        <button class="mossad-dpad" data-dir="down" title="Листать вниз" style="background: ${dirs.includes('down') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer; font-size:11px; padding:0; display:flex; align-items:center; justify-content:center;">▼</button>
                        <div></div>
                    </div>
                    `}
                    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 95px;">
                        <label title="Круги видео" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            Видео (↺): <input id="mossad-in-loops" type="number" min="1" max="100" value="${config.videoLoops}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Задержка фото" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            Фото (сек): <input id="mossad-in-pdelay" type="number" min="1" max="999" value="${config.slideshowDelay}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                        <label title="Пауза после видео" style="display:flex; justify-content:space-between; align-items:center; width:95px;">
                            Пауза (сек): <input id="mossad-in-vdelay" type="number" min="0" max="999" value="${config.delayAfterVideo}" style="width:36px; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; text-align:center;">
                        </label>
                    </div>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <label title="Использовать шаблон имени файла при скачивании" style="display:flex; align-items:center; gap:4px; white-space:nowrap; cursor:pointer;">
                        <input id="mossad-cb-fn-tpl" type="checkbox" style="accent-color:#3b82f6;" ${config.filenameTemplateEnabled ? 'checked' : ''}> Шаблон:
                    </label>
                    <input id="mossad-in-fn-tpl" type="text" placeholder="{id8}-{domain}.{ext}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон имени файла. Переменные: {id8} {id} {domain} {title} {date} {time} {ext} {n} {dbl} {oldname}"
                        style="flex:1; min-width:0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px 5px; font-size:11px;">
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <select id="mossad-sel-dl" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${config.downloadType === 'none' ? 'selected' : ''}>Не скачивать</option>
                        <option value="all" ${config.downloadType === 'all' ? 'selected' : ''}>Качать Всё</option>
                        <option value="photo" ${config.downloadType === 'photo' ? 'selected' : ''}>Качать Фото</option>
                        <option value="video" ${config.downloadType === 'video' ? 'selected' : ''}>Качать Видео</option>
                    </select>
                    <select id="mossad-sel-pd" style="background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px;">
                        <option value="none" ${config.pdAction === 'none' ? 'selected' : ''}>После DL: —</option>
                        <option value="up" ${config.pdAction === 'up' ? 'selected' : ''}>После DL: +1</option>
                        ${rootDomain === 'grok.com' ? `<option value="del" ${config.pdAction === 'del' ? 'selected' : ''}>После DL: del</option>` : ''}
                    </select>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                    <label title="Пауза при переключении вкладки"><input id="mossad-cb-tab" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnTabSwitch ? 'checked' : ''}> Tab</label>
                    <label title="Пауза при потере фокуса браузера"><input id="mossad-cb-brsr" type="checkbox" style="accent-color:#3b82f6;" ${config.stopOnBrsrSwitch ? 'checked' : ''}> Brsr</label>
                    <label title="Авто Full Screen при переходе"><input id="mossad-cb-universal-fs" type="checkbox" style="accent-color:#3b82f6;" ${(config.autoFS !== undefined ? config.autoFS : config.pinterestAutoFS) ? 'checked' : ''}> FS</label>
                    <label title="Качать дубликаты сразу без подтверждения"><input id="mossad-cb-allow-dup" type="checkbox" style="accent-color:#3b82f6;" ${config.allowDuplicates ? 'checked' : ''}> Дубли</label>
                    ${rootDomain === 'grok.com' ? `
                    <label title="Автоподтверждение удаления"><input id="mossad-cb-aconfirm" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteAutoconfirm ? 'checked' : ''}> a.confirm</label>
                    <label title="Умный возврат к посту"><input id="mossad-cb-holdpost" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteHoldpost ? 'checked' : ''}> hold post</label>
                    ` : ''}
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-btn-hk" style="flex:1; background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px; color:#60a5fa; cursor:pointer; font-weight:bold; transition:all 0.2s;">⚙ Настройки</button>
                    <button id="mossad-btn-import-db" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#34d399; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Импортировать базу хешей (результат scan_local_files.py)">📥 База</button>
                    <button id="mossad-btn-rewind" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#9ca3af; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Мотать до начала/конца ленты">↺</button>
                    <button id="mossad-btn-reset-cfg" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#f87171; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Сбросить все настройки и клавиши по умолчанию">↺ Сброс</button>
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
                panel.querySelectorAll('.mossad-pmode').forEach(btn => {
                    btn.onclick = () => Settings.set('pinterestMode', btn.dataset.mode);
                });
                const inN = panel.querySelector('#mossad-in-pmode-n');
                if (inN) {
                    inN.oninput = debounce((e) => {
                        const val = Math.min(9, Math.max(1, parseInt(e.target.value, 10) || 1));
                        Settings.set('pinterestMode', String(val));
                    }, 300);
                }
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
            panel.querySelector('#mossad-in-loops').oninput = debounce((e) => Settings.set('videoLoops', Math.max(1, parseInt(e.target.value) || 1)), 300);
            panel.querySelector('#mossad-in-pdelay').oninput = debounce((e) => Settings.set('slideshowDelay', Math.max(1, parseInt(e.target.value) || 3)), 300);
            panel.querySelector('#mossad-in-vdelay').oninput = debounce((e) => Settings.set('delayAfterVideo', Math.max(0, parseInt(e.target.value) || 2)), 300);
            panel.querySelector('#mossad-sel-dl').onchange = (e) => Settings.set('downloadType', e.target.value);
            panel.querySelector('#mossad-sel-pd').onchange = (e) => Settings.set('pdAction', e.target.value);
            panel.querySelector('#mossad-cb-fn-tpl').onchange = (e) => Settings.set('filenameTemplateEnabled', e.target.checked);
            const fnTplInput = panel.querySelector('#mossad-in-fn-tpl');
            const _saveFnTpl = (e) => Settings.setQuiet('filenameTemplate', e.target.value);
            fnTplInput.onblur   = _saveFnTpl;  // сохранить при потере фокуса (Tab / клик)
            fnTplInput.onchange = _saveFnTpl;  // сохранить при Enter
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
                panel.querySelector('#mossad-cb-aconfirm').onchange = (e) => Settings.set('deleteAutoconfirm', e.target.checked);
                panel.querySelector('#mossad-cb-holdpost').onchange = (e) => Settings.set('deleteHoldpost', e.target.checked);
            }
            panel.querySelector('#mossad-btn-rewind').onclick = doRewind;
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
                            if (typeof importDownloadHistory === 'function') {
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
                if (document.getElementById('mossad-hk-modal')) return;
                openHotkeySettings();
            };
            panel.querySelector('#mossad-btn-reset-cfg').onclick = () => {
                if (!confirm('Сбросить все настройки и горячие клавиши по умолчанию?')) return;
                localStorage.removeItem(STORAGE_KEY);
                Object.assign(config, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
                window.updateWidgetUI();
                showToast('✅ Настройки сброшены по умолчанию');
            };
        };

        container.append(topBar, panel);
        document.body.appendChild(container);

        // Actions
        btnStart.onclick = startSlideshow;
        btnGear.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };
        // Скачать и удалить: работает только на страницах постов grok.com
        btnDL.onclick = () => {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            triggerDownload();
        };
        btnReset.onclick = () => doRewind();

        window.updateWidgetUI = () => {
            if (window.widgetState === 'hidden') {
                topBar.style.display = 'none';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'bar') {
                topBar.style.display = 'flex';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'panel') {
                topBar.style.display = 'flex';
                renderPanel(); // re-render to reflect settings
                panel.style.opacity = '1';
                panel.style.pointerEvents = 'auto';
                panel.style.transform = 'translateY(0)';
            }
            
            if (slideshowActive) {
                btnStart.style.background = '#3b82f6'; // Bright blue
                btnStart.style.color = '#ffffff';
                btnStart.style.boxShadow = '0 0 10px rgba(59,130,246,0.6)';
            } else {
                btnStart.style.background = '#1f2937'; // Gray
                btnStart.style.color = '#e5e7eb';
                btnStart.style.boxShadow = 'none';
            }
        };

        window.updateWidgetUI();

        // Tracker Time
        setInterval(() => {
            if (window.widgetState === 'hidden') return;
            const video = getActiveVideo();
            if (slideshowActive) {
                timerEl.style.color = '#3b82f6';
                if (isCountingDown) {
                    timerEl.textContent = countdownSeconds + 'с';
                } else if (video && !isNaN(video.duration)) {
                    timerEl.textContent = `${formatTime(video.currentTime)}/${formatTime(video.duration)}`;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initWidget(); initGrokGalleryBar(); grokGallerySlideshowTick(); grokGalleryKeyboardNav(); });
    } else {
        initWidget();
        initGrokGalleryBar();
        grokGallerySlideshowTick();
        grokGalleryKeyboardNav();
    }

    function openHotkeySettings() {
        const modal = document.createElement('div');
        modal.id = 'mossad-hk-modal';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(20, 20, 20, 0.95); backdrop-filter: blur(10px);
            border: 1px solid #374151; border-radius: 12px; padding: 20px; z-index: 9999999;
            color: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; gap: 10px;
            min-width: 320px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        `;
        
        modal.innerHTML = `
            <h3 style="margin:0 0 4px 0; color:#fff; font-size:16px;">Настройки горячих клавиш</h3>
            <div style="background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:8px;">
              <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">GitHub Sync Token:</div>
              <div style="display:flex;gap:6px;">
                <input id="mossad-gh-token" type="password" placeholder="github_pat_..." 
                  style="flex:1;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:4px 8px;font-size:12px;" 
                  value="${config.githubToken || ''}">
                <button id="mossad-gh-save" style="background:#3b82f6;border:none;border-radius:4px;color:#fff;padding:4px 10px;cursor:pointer;font-size:12px;">💾</button>
                <button id="mossad-gh-pull" style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#60a5fa;padding:4px 10px;cursor:pointer;font-size:12px;" title="Получить конфиг с GitHub">⬇</button>
              </div>
            </div>
            <div style="font-size:10px; color:#6b7280; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <span>v${SCRIPT_VERSION} · 2026-09-05</span>
              <a href="https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js" 
                 title="Обновить скрипт в Tampermonkey" 
                 style="color:#60a5fa; text-decoration:none; font-size:13px; font-weight:bold; cursor:pointer;">🔄 Обновить</a>
            </div>
            <div id="mossad-hk-list" style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto; padding-right:4px;"></div>
            <div style="display:flex; justify-content:space-between; margin-top:10px; gap:8px;">
                <button id="mossad-hk-reset" style="background:#374151; border:1px solid #4b5563; padding:6px 14px; border-radius:6px; color:#f87171; cursor:pointer; font-weight:bold;">↺ Клавиши по умолчанию</button>
                <button id="mossad-hk-close" style="background:#ef4444; border:none; padding:6px 16px; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold;">Закрыть</button>
            </div>
        `;
        
        const list = modal.querySelector('#mossad-hk-list');
        const keysMap = {
            download: 'Скачать (DL)', upscale: 'Улучшить', deleteVid: 'Удалить видео', sound: 'Звук (вкл/выкл)',
            playPause: 'Пауза/Плей', help: 'Настройки клавиш', history: 'История (Grok)', 
            slideshowPanel: 'Меню слайдшоу', slideshowStart: 'Старт слайдшоу',
            nextSlide: 'Следующий слайд (Пробел)', duplicateNext: 'Дублировать в фоне + Слайд (Ctrl+Пробел)'
        };
        
        Object.keys(keysMap).forEach(k => {
            const row = document.createElement('div');
            row.style.cssText = `display:flex; justify-content:space-between; align-items:center; background:#1f2937; padding:8px 12px; border-radius:6px; border:1px solid #374151;`;
            
            const label = document.createElement('span');
            label.textContent = keysMap[k];
            label.style.fontSize = '13px';
            label.style.flex = '1';
            
            const slotsContainer = document.createElement('div');
            slotsContainer.style.cssText = 'display:flex; gap:6px; align-items:center;';
            
            let hkArr = Array.isArray(config.hk[k]) ? [...config.hk[k]] : [config.hk[k], null];
            while (hkArr.length < 2) hkArr.push(null);
            
            const createSlot = (slotIndex) => {
                const slotDiv = document.createElement('div');
                slotDiv.style.cssText = 'display:flex; gap:2px; align-items:center;';
                
                const btn = document.createElement('button');
                btn.style.cssText = `background:#374151; border:none; color:#3b82f6; padding:4px 10px; border-radius:4px; cursor:pointer; min-width:60px; font-weight:bold; font-size:12px; text-align:center;`;
                btn.textContent = formatHotkey(hkArr[slotIndex]);
                
                const resetBtn = document.createElement('button');
                resetBtn.innerHTML = '↺';
                resetBtn.title = 'Сброс слота';
                resetBtn.style.cssText = `background:transparent; border:none; color:#9ca3af; cursor:pointer; padding:0 2px; font-size:12px;`;
                
                const disableBtn = document.createElement('button');
                disableBtn.innerHTML = '—';
                disableBtn.title = 'Отключить слот';
                disableBtn.style.cssText = `background:transparent; border:none; color:#ef4444; cursor:pointer; padding:0 2px; font-size:12px; font-weight:bold;`;
                
                btn.onclick = () => {
                    btn.textContent = '...';
                    btn.style.color = '#ef4444';
                    
                    window.capturingFor = k;
                    const handler = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) return;
                        
                        document.removeEventListener('keydown', handler, true);
                        window.capturingFor = null;
                        
                        if (e.key === 'Escape') {
                            btn.textContent = formatHotkey(hkArr[slotIndex]);
                            btn.style.color = '#3b82f6';
                            return;
                        }
                        
                        const newHk = { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
                        hkArr[slotIndex] = newHk;
                        config.hk[k] = hkArr;
                        Settings.save();
                        
                        btn.textContent = formatHotkey(newHk);
                        btn.style.color = '#3b82f6';
                    };
                    document.addEventListener('keydown', handler, true);
                };
                
                resetBtn.onclick = () => {
                    const defArr = Array.isArray(DEFAULT_CONFIG.hk[k]) ? DEFAULT_CONFIG.hk[k] : [DEFAULT_CONFIG.hk[k], null];
                    const defHk = slotIndex < defArr.length ? defArr[slotIndex] : null;
                    hkArr[slotIndex] = defHk;
                    config.hk[k] = hkArr;
                    Settings.save();
                    btn.textContent = formatHotkey(defHk);
                };
                
                disableBtn.onclick = () => {
                    hkArr[slotIndex] = null;
                    config.hk[k] = hkArr;
                    Settings.save();
                    btn.textContent = formatHotkey(null);
                };
                
                slotDiv.append(btn, resetBtn, disableBtn);
                return slotDiv;
            };
            
            slotsContainer.append(createSlot(0), createSlot(1));
            row.append(label, slotsContainer);
            list.append(row);
        });
        
        document.body.appendChild(modal);
        
        modal.querySelector('#mossad-gh-save').onclick = () => {
            config.githubToken = modal.querySelector('#mossad-gh-token').value.trim();
            Settings.save();
            showToast('✅ Токен сохранён');
        };
        modal.querySelector('#mossad-gh-pull').onclick = async () => {
            showSyncStatus('🔄 Получение конфига...', '#f59e0b');
            try {
                await pullConfigFromGitHub();
                showToast('✅ Конфиг получен с GitHub');
                modal.remove();
                openHotkeySettings();
            } catch (e) {
                showToast('❌ Ошибка: ' + e.message, true);
            }
        };

        modal.querySelector('#mossad-hk-close').onclick = () => modal.remove();
        modal.querySelector('#mossad-hk-reset').onclick = () => {
            if (!confirm('Сбросить все горячие клавиши по умолчанию?')) return;
            config.hk = JSON.parse(JSON.stringify(DEFAULT_CONFIG.hk));
            Settings.save();
            modal.remove();
            openHotkeySettings(); // переоткрыть с обновлёнными клавишами
            showToast('✅ Клавиши сброшены по умолчанию');
        };
    }

