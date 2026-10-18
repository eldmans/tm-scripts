    // ============================================
    // SETTINGS WINDOW (Ctrl+F1): вкладки «Общие» и «Горячие клавиши» (v1.3.40),
    // GitHub-синхронизация, опции виджета (вынесено из ui/panel.js в v1.3.35)
    // ============================================
    // v1.3.40: окно настроек с вкладками «⚙ Общие» и «⌨ Горячие клавиши».
    // openHotkeySettings(tab) оставлен как совместимое имя (Ctrl+F1, кнопки ⌨ / ⚙ Настройки).
    function openHotkeySettings(tab = 'hotkeys') {
        return openSettingsWindow(tab);
    }

    /** Переключает/закрывает окно настроек: если открыто на той же вкладке — закрыть, иначе показать вкладку. */
    function toggleSettingsWindow(tab = 'hotkeys') {
        const modal = document.getElementById('mossad-hk-modal');
        if (modal && modal.dataset.tab === tab) { closeSettingsWindow(true); return; }
        openSettingsWindow(tab);
    }

    function closeSettingsWindow(save = true) {
        const modal = document.getElementById('mossad-hk-modal');
        if (!modal) return;
        if (save) {
            if (typeof window.saveGlobalHotkeys === 'function') window.saveGlobalHotkeys(true);
            else Settings.save();
        }
        if (typeof modal._mossadCleanup === 'function') modal._mossadCleanup();
        modal.remove();
    }

    function openSettingsWindow(tab = 'general') {
        const existing = document.getElementById('mossad-hk-modal');
        if (existing && typeof existing._mossadSetTab === 'function') {
            existing._mossadSetTab(tab);
            return existing;
        }
        const modal = document.createElement('div');
        modal.id = 'mossad-hk-modal';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(20, 20, 20, 0.95); backdrop-filter: blur(10px);
            border: 1px solid #374151; border-radius: 12px; padding: 20px; z-index: 9999999;
            color: #e5e7eb; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; gap: 10px;
            width: 460px; max-width: 94vw; max-height: 90vh; box-sizing: border-box; box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        `;
        
        modal.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <h3 style="margin:0; color:#fff; font-size:16px;">⚙ Настройки MOSSAD</h3>
              <button id="mossad-settings-x" title="Закрыть (настройки сохраняются)" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0 2px;">×</button>
            </div>
            <div id="mossad-settings-tabs" style="display:flex; gap:4px; border-bottom:1px solid #374151; margin-bottom:2px;">
              <button data-tab="general" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;">⚙ Общие</button>
              <button data-tab="hotkeys" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;">⌨ Горячие клавиши</button>
            </div>
            <div data-pane="general" style="display:none; flex-direction:column; gap:2px; overflow-y:auto; max-height:calc(85vh - 160px); padding-right:4px;">
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
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Клик мышью вне окон MOSSAD сворачивает панель настроек виджета до краткого меню">
              <input id="mossad-cb-outside-close" type="checkbox" style="accent-color:#3b82f6;" ${config.closePanelOnOutsideClick !== false ? 'checked' : ''}>
              Сворачивать панель кликом вне её
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Уведомление «🔊 Звук включен / 🔇 Звук выключен» на ~5 с при переключении звука хоткеем. Крестик на нём закрывает только текущее уведомление">
              <input id="mossad-cb-sound-toast" type="checkbox" style="accent-color:#3b82f6;" ${config.showSoundToast !== false ? 'checked' : ''}>
              Показывать тост переключения звука
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="После клика «Собрать» на /imagine/saved скрипт столько секунд подхватывает ссылки, подгружаемые при скролле (каждый клик продлевает; закрывается при старте слайдшоу)">
              Досбор после «Собрать», сек:
              <input id="mossad-collect-watch-sec" type="number" min="5" max="600" step="5" value="${Number(config.collectWatchSec) || 30}" style="width:56px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;">
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Высота списка (плейлиста) при открытии — столько строк видно без прокрутки (если размер не менялся вручную; кнопка ⤢ в списке сбрасывает к этому значению)">
              Список: видимых строк при открытии:
              <input id="mossad-playlist-rows" type="number" min="5" max="200" step="1" value="${Number(config.playlistRows) || 30}" style="width:56px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;">
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Пишет в консоль браузера ([MOSSAD DBG]) кто и почему запустил каждый шаг слайдшоу, а также шаги удаления. Для диагностики; по умолчанию выключено">
              <input id="mossad-cb-debug" type="checkbox" style="accent-color:#f59e0b;" ${config.debugSlideshow ? 'checked' : ''}>
              Debug-лог слайдшоу/удаления
              <button id="mossad-debug-copy" title="Скопировать последние записи debug-лога в буфер обмена (и вывести таблицей в консоль)" style="margin-left:auto;background:#374151;border:1px solid #4b5563;border-radius:4px;color:#fbbf24;padding:1px 8px;cursor:pointer;font-size:11px;">📋 лог</button>
            </label>
            <div style="font-size:10px; color:#6b7280; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <span>v${SCRIPT_VERSION} · 2026-10-19</span>
              <a href="https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js" 
                 title="Обновить скрипт в Tampermonkey" 
                 style="color:#60a5fa; text-decoration:none; font-size:13px; font-weight:bold; cursor:pointer;">🔄 Обновить</a>
            </div>
            </div>
            <div data-pane="hotkeys" style="display:none; flex-direction:column; gap:8px;">
            <div style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); border-radius:6px; padding:6px 10px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px;">
              <span style="color:#34d399;">💡 При закрытии окна настройки автоматически сохраняются для всех сайтов</span>
              <button id="mossad-hk-save-all" style="background:#10b981; border:none; border-radius:4px; color:#fff; padding:3px 8px; cursor:pointer; font-size:11px; font-weight:bold; white-space:nowrap;" title="Сохранить для всех сайтов прямо сейчас">💾 Сохранить</button>
            </div>
            <div id="mossad-hk-list" style="display:flex; flex-direction:column; gap:8px; max-height:calc(85vh - 230px); overflow-y:auto; padding-right:4px;"></div>
              <div><button id="mossad-hk-reset" style="background:#374151; border:1px solid #4b5563; padding:6px 12px; border-radius:6px; color:#f87171; cursor:pointer; font-weight:bold; font-size:12px;">↺ Клавиши по умолчанию</button></div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:10px; gap:8px;">
                <span></span>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-hk-save-close" style="background:#10b981; border:none; padding:6px 14px; border-radius:6px; color:#fff; cursor:pointer; font-weight:bold; font-size:12px;">💾 Сохранить и закрыть</button>
                    <button id="mossad-hk-close" style="background:#374151; border:1px solid #4b5563; padding:6px 12px; border-radius:6px; color:#9ca3af; cursor:pointer; font-weight:bold; font-size:12px;">Закрыть</button>
                </div>
            </div>
        `;
        
        const list = modal.querySelector('#mossad-hk-list');
        const keysMap = {
            nextSlide:        'Следующий слайд (ArrowRight)',
            prevSlide:        'Предыдущий слайд (ArrowLeft)',
            nextGroup:        'Следующая группа (Alt+PageDown)',
            prevGroup:        'Предыдущая группа (Alt+PageUp)',
            download:         'Скачать (PageDown)',
            upscale:          'Улучшить (Shift+«+» / Shift+Num+)',
            deleteVid:        'Удалить видео (Delete)',
            sound:            'Звук вкл/выкл (ScrollLock)',
            playPause:        'Пауза/Плей видео (Pause)',
            help:             'Настройки клавиш (Ctrl+F1)',
            history:          'Переход в Saved Grok (Home)', 
            slideshowPanel:   'Меню: полное / краткое / скрыть (Ctrl+Insert)',
            slideshowStart:   'Малое слайдшоу / ракета (Shift+Insert)',
            galleryPlayPause: 'Большое слайдшоу: Плей/Пауза (Insert; без ссылок — 1-е нажатие собирает)',
            galleryStop:      'Стоп большого слайдшоу',
            duplicateNext:    'Дублировать в фоне + Слайд (Ctrl+Пробел)',
            rewind:           'Мотать в начало (Alt+R)',
            snapWidget:       'Привязать к левому верхнему краю (F8)'
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
                        
                        const newHk = { key: e.key, code: e.code || '', ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }; // v1.3.39: + физическая клавиша
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

        // ── Вкладки ──
        const setTab = (t) => {
            const want = (t === 'general' || t === 'hotkeys') ? t : 'hotkeys';
            modal.dataset.tab = want;
            modal.querySelectorAll('[data-pane]').forEach(p => { p.style.display = p.dataset.pane === want ? 'flex' : 'none'; });
            modal.querySelectorAll('#mossad-settings-tabs [data-tab]').forEach(b => {
                const on = b.dataset.tab === want;
                b.style.background = on ? '#1f2937' : 'transparent';
                b.style.color = on ? '#ffffff' : '#9ca3af';
            });
        };
        modal._mossadSetTab = setTab;
        modal.querySelectorAll('#mossad-settings-tabs [data-tab]').forEach(b => {
            b.onclick = (e) => { e.preventDefault(); setTab(b.dataset.tab); };
        });
        setTab(tab);
        modal.querySelector('#mossad-settings-x').onclick = () => closeSettingsWindow(true);
        modal.querySelector('#mossad-playlist-rows').onchange = (e) => {
            const v = Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 30));
            e.target.value = String(v);
            Settings.setQuiet('playlistRows', v);
        };

        modal.querySelector('#mossad-cb-outside-close').onchange = (e) => {
            Settings.setQuiet('closePanelOnOutsideClick', e.target.checked);
        };
        modal.querySelector('#mossad-collect-watch-sec').onchange = (e) => {
            const v = Math.max(5, Math.min(600, parseInt(e.target.value, 10) || 30));
            e.target.value = String(v);
            Settings.setQuiet('collectWatchSec', v);
        };
        modal.querySelector('#mossad-cb-sound-toast').onchange = (e) => {
            Settings.setQuiet('showSoundToast', e.target.checked);
        };
        modal.querySelector('#mossad-cb-debug').onchange = (e) => {
            Settings.setQuiet('debugSlideshow', e.target.checked);
            if (e.target.checked) mossadDebug('settings', 'debug-лог включён');
        };
        modal.querySelector('#mossad-debug-copy').onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rows = mossadDumpDebugLog();
            const text = rows.map(r => `${r.t} [${r.source}] ${r.msg} ${r.path}${r.data !== undefined ? ' ' + JSON.stringify(r.data) : ''}`).join('\n');
            try {
                navigator.clipboard.writeText(text).then(
                    () => showToast(`📋 Debug-лог скопирован (${rows.length} строк)`),
                    () => showToast('⚠️ Не удалось скопировать — см. консоль', true));
            } catch(err) { showToast('⚠️ Не удалось скопировать — см. консоль', true); }
        };
        modal.querySelector('#mossad-gh-save').onclick = () => {
            setGithubToken(modal.querySelector('#mossad-gh-token').value);
            Settings.save();
            showToast('✅ Токен сохранён');
        };
        modal.querySelector('#mossad-gh-pull').onclick = async () => {
            showSyncStatus('🔄 Получение конфига...', '#f59e0b');
            try {
                await pullConfigFromGitHub();
                showToast('✅ Конфиг получен с GitHub');
                const curTab = modal.dataset.tab;
                closeSettingsWindow(false);
                openSettingsWindow(curTab);
            } catch (e) {
                showToast('❌ Ошибка: ' + e.message, true);
            }
        };

        const closeAndSaveModal = () => closeSettingsWindow(true);

        modal.querySelector('#mossad-hk-save-all').onclick = () => {
            if (typeof window.saveGlobalHotkeys === 'function') {
                window.saveGlobalHotkeys(true);
            } else {
                Settings.save();
            }
        };

        modal.querySelector('#mossad-hk-save-close').onclick = closeAndSaveModal;
        modal.querySelector('#mossad-hk-close').onclick = closeAndSaveModal;

        const onEscClose = (e) => {
            if (e.key === 'Escape' && window.capturingFor === null) {
                closeAndSaveModal();
            }
        };
        document.addEventListener('keydown', onEscClose);
        // v1.3.40: слушатель Esc снимается при ЛЮБОМ закрытии окна (раньше при закрытии кнопкой/хоткеем он оставался висеть)
        modal._mossadCleanup = () => document.removeEventListener('keydown', onEscClose);

        modal.querySelector('#mossad-hk-reset').onclick = () => {
            if (!confirm('Сбросить все горячие клавиши по умолчанию?')) return;
            config.hk = JSON.parse(JSON.stringify(DEFAULT_CONFIG.hk));
            if (typeof window.saveGlobalHotkeys === 'function') {
                window.saveGlobalHotkeys(false);
            } else {
                Settings.save();
            }
            closeSettingsWindow(false);
            openSettingsWindow('hotkeys'); // переоткрыть с обновлёнными клавишами
            showToast('✅ Клавиши сброшены по умолчанию для всех сайтов');
        };
    }
