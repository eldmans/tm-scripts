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

    // ── v1.3.41: вкладка «🌐 По умолчанию» — общие умолчания (GM), см. GlobalDefaults в core/config.js ──
    const GLOBAL_DEFAULTS_FIELDS = [
        { k: 'slideshowDelay',    t: 'num', label: 'Фото: показ, сек', step: 0.5, min: 0 },
        { k: 'videoLoops',        t: 'num', label: 'Видео: кругов (↺)', step: 1, min: 1 },
        { k: 'delayAfterVideo',   t: 'num', label: 'Пауза после видео, сек', step: 0.5, min: 0 },
        { k: 'slideshowDirections', t: 'dirs', label: 'Направления D-pad' },
        { k: 'loopFeed',          t: 'bool', label: 'R: повторять ленту' },
        { k: 'downloadType',      t: 'sel', label: 'Скачивание', opts: [['none', 'Не скачивать'], ['all', 'Качать всё'], ['photo', 'Качать фото'], ['video', 'Качать видео']] },
        { k: 'pdAction',          t: 'sel', label: 'После DL', opts: [['none', '—'], ['up', '+1'], ['del', 'del (Grok)']] },
        { k: 'filenameTemplate',  t: 'text', label: 'Шаблон имени файла' },
        { k: 'filenameTemplateEnabled', t: 'bool', label: 'Использовать шаблон' },
        { k: 'allowDuplicates',   t: 'bool', label: 'Дубли: качать без вопроса' },
        { k: 'deleteHoldpost',    t: 'hold', label: 'hold post (удаление)' },
        { k: 'stopOnTabSwitch',   t: 'bool', label: 'Tab: стоп при смене вкладки' },
        { k: 'stopOnBrsrSwitch',  t: 'bool', label: 'Brsr: стоп при уходе из браузера' },
        { k: 'autoFS',            t: 'bool', label: 'FS: авто полный экран' },
        { k: 'widgetZoom',        t: 'num', label: 'Масштаб виджета', step: 0.05, min: 0.5 },
        { k: 'closePanelOnOutsideClick', t: 'bool', label: 'Сворачивать меню кликом вне' },
        { k: 'showSoundToast',    t: 'bool', label: 'Тост переключения звука' },
        { k: 'playlistRows',      t: 'num', label: 'Список: видимых строк', step: 1, min: 5 },
        { k: 'playlistWidth',     t: 'num', label: 'Список: ширина, px (0 = авто)', step: 10, min: 0 },
        { k: 'collectWatchSec',   t: 'num', label: 'Досбор после «Собрать», сек', step: 5, min: 5 },
        { k: 'pinterestMode',     t: 'text', label: 'Pinterest: режим (rand / +1 / 1–9)' },
        { k: 'pinterestFilterType', t: 'sel', label: 'Pinterest: фильтр', opts: [['ratio', 'Пропорция %'], ['all', 'Все'], ['image', 'Только фото'], ['video', 'Только видео']] },
        { k: 'pinterestPhotoPercent', t: 'num', label: 'Pinterest: % фото', step: 5, min: 0 },
        { k: 'pinterestMaxVideoDuration', t: 'num', label: 'Pinterest: макс. видео, сек (0 = ∞)', step: 1, min: 0 },
        { k: 'pinterestAutoFS',   t: 'bool', label: 'Pinterest: авто FS' },
    ];

    function initGlobalDefaultsTab(modal) {
        const form = modal.querySelector('#mossad-def-form');
        const status = modal.querySelector('#mossad-def-status');
        if (!form) return;
        const inputCss = 'background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;';
        const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        form.innerHTML = GLOBAL_DEFAULTS_FIELDS.map(f => {
            const id = `mossad-def-${f.k}`;
            let ctl = '';
            if (f.t === 'num') ctl = `<input id="${id}" type="number" step="${f.step || 1}" min="${f.min != null ? f.min : ''}" style="width:70px;${inputCss}">`;
            else if (f.t === 'text') ctl = `<input id="${id}" type="text" style="width:190px;${inputCss}">`;
            else if (f.t === 'sel') ctl = `<select id="${id}" style="${inputCss}">${f.opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`;
            else if (f.t === 'dirs') ctl = `<span id="${id}" style="display:flex;gap:6px;">${[['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']].map(d => `<label style="cursor:pointer;"><input type="checkbox" data-dir="${d[0]}"> ${d[1]}</label>`).join('')}</span>`;
            else ctl = `<input id="${id}" type="checkbox" style="cursor:pointer;">`;
            return `<input type="checkbox" class="mossad-def-force" data-k="${f.k}" checked title="Включать в «Применить во всех контейнерах»" style="cursor:pointer;margin:0;">` +
                   `<label for="${id}" style="cursor:default;">${esc(f.label)}</label>${ctl}`;
        }).join('');
        // Заголовок колонки галочек
        form.insertAdjacentHTML('afterbegin', `<span title="Какие настройки перезаписать во всех контейнерах" style="font-size:10px;color:#9ca3af;">⇄</span><span style="font-size:10px;color:#9ca3af;">настройка (⇄ — применять во всех контейнерах)</span><span></span>`);

        const fill = (vals) => {
            for (const f of GLOBAL_DEFAULTS_FIELDS) {
                const el = form.querySelector(`#mossad-def-${f.k}`);
                const v = vals[f.k];
                if (!el) continue;
                if (f.t === 'dirs') {
                    const arr = Array.isArray(v) ? v : [];
                    el.querySelectorAll('input[data-dir]').forEach(cb => { cb.checked = arr.includes(cb.dataset.dir); });
                } else if (f.t === 'bool' || f.t === 'hold') el.checked = !!v;
                else el.value = v == null ? '' : String(v);
            }
        };
        const collect = () => {
            const out = {};
            for (const f of GLOBAL_DEFAULTS_FIELDS) {
                const el = form.querySelector(`#mossad-def-${f.k}`);
                if (!el) continue;
                if (f.t === 'dirs') out[f.k] = Array.from(el.querySelectorAll('input[data-dir]')).filter(cb => cb.checked).map(cb => cb.dataset.dir);
                else if (f.t === 'bool') out[f.k] = !!el.checked;
                else if (f.t === 'hold') { out.deleteHoldpost = !!el.checked; out.deleteAutoconfirm = !!el.checked; } // ANTI_PATTERNS §2
                else if (f.t === 'num') { const n = parseFloat(el.value); if (isFinite(n)) out[f.k] = Math.max(f.min != null ? f.min : -Infinity, n); }
                else out[f.k] = String(el.value);
            }
            return GlobalDefaults.sanitize(out);
        };
        const renderStatus = () => {
            const saved = GlobalDefaults.read();
            const site = GlobalDefaults.siteHasSavedConfig();
            status.innerHTML =
                `Умолчания действуют на сайтах <b>без своих сохранённых настроек</b> (вместо заводских). Настройки сайтов не меняются.<br>` +
                `Сейчас: ${saved ? '<span style="color:#34d399;">сохранены свои умолчания</span>' : '<span style="color:#fbbf24;">заводские</span>'}` +
                ` · этот сайт: ${site ? 'свои настройки' : 'без своих настроек — работают умолчания'}` +
                (() => { const st = GlobalDefaults.readStamp(); return st ? `<br>Последнее «⇄ во всех контейнерах»: ${new Date(st.ts).toLocaleString()} (${st.keys.length} настр.)` : ''; })();
        };
        fill(GlobalDefaults.effective());
        renderStatus();

        modal.querySelector('#mossad-def-save').onclick = () => {
            if (GlobalDefaults.write(collect())) showToast('🌐 Умолчания сохранены для всех сайтов');
            else showToast('❌ GM-хранилище недоступно', true);
            renderStatus();
        };
        modal.querySelector('#mossad-def-take').onclick = () => {
            fill(Object.assign(GlobalDefaults.effective(), GlobalDefaults.fromConfig(config)));
            showToast('⬇ В форме — настройки этого сайта. Нажмите «Сохранить как умолчания»');
        };
        modal.querySelector('#mossad-def-factory').onclick = () => {
            if (!confirm('Удалить сохранённые умолчания и вернуть заводские? Настройки сайтов не изменятся.')) return;
            GlobalDefaults.clear();
            fill(GlobalDefaults.factory());
            renderStatus();
            showToast('↺ Умолчания: заводские');
        };
        modal.querySelector('#mossad-def-apply-all').onclick = () => {
            const keys = Array.from(form.querySelectorAll('.mossad-def-force:checked')).map(cb => cb.dataset.k);
            // hold post управляет двумя флагами (ANTI_PATTERNS §2)
            if (keys.includes('deleteHoldpost')) keys.push('deleteAutoconfirm');
            if (!keys.length) { showToast('⚠️ Не отмечено ни одной настройки (⇄)', true); return; }
            if (!confirm(`Перезаписать ${keys.length} настр. на всех сайтах во всех контейнерах значениями из формы?`)) return;
            if (!GlobalDefaults.write(collect())) { showToast('❌ GM-хранилище недоступно', true); return; }
            const st = GlobalDefaults.writeStamp(keys);
            GlobalDefaults.applyStampIfNew(st); // этот контейнер — сразу (слушатель GM мог уже успеть)
            if (window.updateWidgetUI) window.updateWidgetUI();
            renderStatus();
            showToast(`⇄ Применено: ${keys.length} настр. — остальные контейнеры подхватят при загрузке / сразу`);
        };
        modal.querySelector('#mossad-def-apply').onclick = () => {
            const vals = collect();
            for (const k of Object.keys(vals)) config[k] = JSON.parse(JSON.stringify(vals[k]));
            Settings.save();
            renderStatus();
            showToast('➜ Значения формы применены к этому сайту');
        };
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
              <button data-tab="defaults" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" title="Общие умолчания для всех сайтов без своих сохранённых настроек">🌐 По умолчанию</button>
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
            <div data-pane="defaults" style="display:none; flex-direction:column; gap:6px;">
              <div id="mossad-def-status" style="font-size:11px;color:#9ca3af;line-height:1.35;"></div>
              <div id="mossad-def-form" style="display:grid; grid-template-columns:auto 1fr auto; gap:4px 10px; align-items:center; overflow-y:auto; max-height:calc(85vh - 260px); padding-right:4px; font-size:12px; color:#d1d5db;"></div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                <button id="mossad-def-save" style="background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;background:#065f46;border-color:#10b981;" title="Записать форму как умолчания для всех сайтов без своих настроек">💾 Сохранить как умолчания</button>
                <button id="mossad-def-take" style="background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;" title="Заполнить форму текущими настройками этого сайта (без записи)">⬇ Взять текущие настройки сайта</button>
                <button id="mossad-def-factory" style="background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;color:#f87171;" title="Удалить сохранённые умолчания — снова действуют заводские">↺ Сбросить к заводским</button>
                <button id="mossad-def-apply-all" style="background:#1e3a8a;border:1px solid #3b82f6;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;" title="Сохранить умолчания и перезаписать отмеченные (⇄) настройки на всех сайтах во всех контейнерах: при следующей загрузке, а в открытых вкладках — сразу">⇄ Применить во всех контейнерах</button>
                <button id="mossad-def-apply" style="background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;color:#60a5fa;" title="Записать значения формы в настройки ЭТОГО сайта">➜ Применить к этому сайту</button>
              </div>
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
            const want = (t === 'general' || t === 'hotkeys' || t === 'defaults') ? t : 'hotkeys';
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
        initGlobalDefaultsTab(modal);
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
