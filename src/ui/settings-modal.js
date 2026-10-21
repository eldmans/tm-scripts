    // ============================================
    // SETTINGS WINDOW (Ctrl+F1): вкладки «Общие» и «Горячие клавиши» (v1.3.40),
    // GitHub-синхронизация, опции виджета (вынесено из ui/panel.js в v1.3.35)
    // ============================================
    // v1.3.40: окно настроек с вкладками «⚙ Общие» и «⌨ Горячие клавиши».
    // openHotkeySettings(tab) оставлен как совместимое имя (Ctrl+F1, кнопки ⌨ / ⚙ Настройки).
    function openHotkeySettings(tab = 'hotkeys') {
        return openSettingsWindow(tab);
    }

    // ── v1.3.45: память последней вкладки (UI-состояние — localStorage, как размеры списка/позиция виджета) ──
    const SETTINGS_TAB_LS_KEY = 'mossad_settings_tab';
    const SETTINGS_TABS = ['general', 'hotkeys', 'defaults', 'labels', 'todos', 'sites'];
    function getLastSettingsTab(fallback = 'hotkeys') {
        try {
            const t = localStorage.getItem(SETTINGS_TAB_LS_KEY);
            if (SETTINGS_TABS.includes(t)) return t;
        } catch (e) {}
        return fallback;
    }
    function rememberSettingsTab(t) {
        if (!SETTINGS_TABS.includes(t)) return;
        try { localStorage.setItem(SETTINGS_TAB_LS_KEY, t); } catch (e) {}
    }

    // ── v1.3.45: порядок строк на вкладке «Горячие клавиши» (перетаскиванием). Хоткеи общие для всех
    // сайтов — порядок тоже общий: GM (+ копия в localStorage, если GM недоступен). ──
    const HK_ORDER_KEY = 'mossad_hk_order';
    function getHotkeyOrder() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(HK_ORDER_KEY, null); } catch (e) {}
        if (raw == null) { try { raw = localStorage.getItem(HK_ORDER_KEY); } catch (e) {} }
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
        } catch (e) { return []; }
    }
    function saveHotkeyOrder(order) {
        const json = JSON.stringify(Array.isArray(order) ? order : []);
        try { if (typeof GM_setValue === 'function') GM_setValue(HK_ORDER_KEY, json); } catch (e) {}
        try { localStorage.setItem(HK_ORDER_KEY, json); } catch (e) {}
    }
    // v1.3.47: закреплённые строки (🔒) — не перетаскиваются и не сдвигаются, когда двигают другие
    const HK_PINNED_KEY = 'mossad_hk_pinned';
    function getHotkeyPinned() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(HK_PINNED_KEY, null); } catch (e) {}
        if (raw == null) { try { raw = localStorage.getItem(HK_PINNED_KEY); } catch (e) {} }
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [];
        } catch (e) { return []; }
    }
    function saveHotkeyPinned(list) {
        const json = JSON.stringify(Array.from(new Set(list || [])));
        try { if (typeof GM_setValue === 'function') GM_setValue(HK_PINNED_KEY, json); } catch (e) {}
        try { localStorage.setItem(HK_PINNED_KEY, json); } catch (e) {}
    }
    /**
     * Порядок с учётом закреплённых: закреплённые остаются на своих местах из prev,
     * остальные заполняют свободные места в порядке want.
     */
    function hkOrderKeepPinned(want, prev, pinned) {
        const pin = new Set(pinned || []);
        const out = new Array(prev.length).fill(null);
        prev.forEach((k, i) => { if (pin.has(k)) out[i] = k; });
        const flow = want.filter(k => !pin.has(k) && prev.includes(k));
        let j = 0;
        for (let i = 0; i < out.length; i++) if (out[i] === null) out[i] = flow[j++];
        return out.filter(k => k != null);
    }
    // ── v1.3.48: «По умолчанию: Клавиши · Порядок · Сохранить это» — общие умолчания хоткеев (GM) ──
    // { id, ts, hk, order, pinned }. Запись = рассылка: открытые вкладки получают её через
    // GM_addValueChangeListener, остальные контейнеры — при следующей загрузке (id применённого — в localStorage).
    // Закреплённые (🔒) строки НЕ меняются ни сбросом, ни рассылкой: ни клавиша, ни место.
    const HK_DEFAULTS_GM_KEY = 'mossad_hk_defaults';
    const HK_DEFAULTS_APPLIED_LS = 'mossad_hk_defaults_applied';
    const HK_FACTORY_ORDER = ['nextSlide', 'prevSlide', 'nextGroup', 'prevGroup', 'download', 'upscale', 'deleteVid', 'sound', 'playPause', 'help', 'history', 'slideshowPanel', 'slideshowStart', 'galleryPlayPause', 'galleryStop', 'duplicateNext', 'rewind', 'snapWidget', 'openTodos'];
    function readHotkeyDefaults() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(HK_DEFAULTS_GM_KEY, null); } catch (e) {}
        try {
            const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!o || typeof o !== 'object' || !o.hk || typeof o.hk !== 'object') return null;
            return { id: String(o.id || ''), ts: Number(o.ts) || 0, hk: o.hk, order: Array.isArray(o.order) ? o.order.filter(x => typeof x === 'string') : [], pinned: Array.isArray(o.pinned) ? o.pinned.filter(x => typeof x === 'string') : [] };
        } catch (e) { return null; }
    }
    /** Клавиши по умолчанию: сохранённые общие («Сохранить это») или заводские. */
    function hotkeyDefaultFor(k) {
        const d = readHotkeyDefaults();
        if (d && d.hk && Object.prototype.hasOwnProperty.call(d.hk, k)) return normalizeHotkeyBinding(d.hk[k]);
        return normalizeHotkeyBinding(DEFAULT_CONFIG.hk[k]);
    }
    function hotkeyDefaultOrder() {
        const d = readHotkeyDefaults();
        return (d && d.order.length) ? d.order : HK_FACTORY_ORDER;
    }
    /** Сбросить клавиши к умолчаниям, кроме закреплённых. Возвращает число изменённых. */
    function resetHotkeysKeepPinned() {
        const pin = new Set(getHotkeyPinned());
        const keys = new Set(Object.keys(DEFAULT_CONFIG.hk).concat(Object.keys(config.hk || {})));
        const d = readHotkeyDefaults();
        if (d) Object.keys(d.hk).forEach(k => keys.add(k));
        let n = 0;
        keys.forEach(k => {
            if (pin.has(k)) return;
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG.hk, k) && !(d && d.hk[k])) return;
            const v = hotkeyDefaultFor(k);
            if (JSON.stringify(v) !== JSON.stringify(config.hk[k])) { config.hk[k] = v; n++; }
        });
        return n;
    }
    /** Сбросить порядок к умолчанию; закреплённые строки остаются на своих местах. */
    function resetHotkeyOrderKeepPinned(allKeys) {
        const cur = orderedHotkeyKeys(allKeys, getHotkeyOrder());
        const want = orderedHotkeyKeys(allKeys, hotkeyDefaultOrder());
        const out = hkOrderKeepPinned(want, cur, getHotkeyPinned());
        saveHotkeyOrder(out);
        return out;
    }
    /** «Сохранить это»: текущие клавиши + порядок + закрепления → общие умолчания (и рассылка). */
    function saveHotkeyDefaults(allKeys) {
        const rec = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            ts: Date.now(),
            hk: JSON.parse(JSON.stringify(config.hk || {})),
            order: orderedHotkeyKeys(allKeys || HK_FACTORY_ORDER, getHotkeyOrder()),
            pinned: getHotkeyPinned(),
        };
        if (typeof GM_setValue !== 'function') return null;
        try { GM_setValue(HK_DEFAULTS_GM_KEY, JSON.stringify(rec)); } catch (e) { return null; }
        try { localStorage.setItem(HK_DEFAULTS_APPLIED_LS, rec.id); } catch (e) {} // этот контейнер уже в этом состоянии
        return rec;
    }
    /**
     * Применить общие умолчания в этом контейнере (рассылка или загрузка). Закреплённые здесь строки
     * не трогаются: ни клавиша, ни место. Закрепления из рассылки добавляются к своим.
     */
    function applyHotkeyDefaults(rec, reason) {
        if (!rec || !rec.hk) return false;
        const localPinned = getHotkeyPinned();
        const pin = new Set(localPinned);
        for (const k of Object.keys(rec.hk)) {
            if (pin.has(k)) continue;
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG.hk, k)) continue;
            config.hk[k] = normalizeHotkeyBinding(rec.hk[k]);
        }
        const all = HK_FACTORY_ORDER.concat(Object.keys(DEFAULT_CONFIG.hk).filter(k => !HK_FACTORY_ORDER.includes(k)));
        const cur = orderedHotkeyKeys(all, getHotkeyOrder());
        if (rec.order && rec.order.length) saveHotkeyOrder(hkOrderKeepPinned(orderedHotkeyKeys(all, rec.order), cur, localPinned));
        const mergedPins = Array.from(new Set(localPinned.concat(rec.pinned || [])));
        if (mergedPins.length !== localPinned.length) saveHotkeyPinned(mergedPins);
        try { localStorage.setItem(HK_DEFAULTS_APPLIED_LS, rec.id); } catch (e) {}
        try { persistLocalConfig(); } catch (e) {}
        try { if (typeof GM_setValue === 'function') GM_setValue('mossad_hk_global', JSON.stringify(config.hk)); } catch (e) {}
        if (window.updateWidgetUI) window.updateWidgetUI();
        const modal = document.getElementById('mossad-hk-modal');
        if (modal && typeof modal._mossadRenderHotkeys === 'function') modal._mossadRenderHotkeys();
        mossadDebug('hotkey', 'общие умолчания клавиш применены', { reason, id: rec.id, keptPinned: localPinned.length });
        return true;
    }
    /** Ключи в порядке отображения: сохранённый порядок (только известные), затем новые — в заводском порядке. */
    function orderedHotkeyKeys(keys, order) {
        const known = new Set(keys);
        const seen = new Set();
        const out = [];
        for (const k of (order || [])) {
            if (known.has(k) && !seen.has(k)) { out.push(k); seen.add(k); }
        }
        for (const k of keys) if (!seen.has(k)) out.push(k);
        return out;
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
            // v1.3.45: кнопки «Сохранить» больше нет — всё, что не успело сохраниться (поле в фокусе:
            // change не пришёл; токен без 💾), применяется здесь; затем общий путь сохранения хоткеев
            if (typeof modal._mossadFlush === 'function') { try { modal._mossadFlush(); } catch (e) {} }
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
        { k: 'pdAction',          t: 'sel', label: 'После скачивания', opts: [['none', '—'], ['upns', 'Не СШ +1'], ['always', '+1 всегда'], ['del', 'Delete (Grok)']] },
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
        { k: 'pinterestMode',     t: 'text', label: 'Pinterest: режим (rand / +1 / 1–30)' },
        { k: 'pinterestFilterType', t: 'sel', label: 'Pinterest: фильтр', opts: [['ratio', 'Пропорция %'], ['all', 'Все'], ['image', 'Только фото'], ['video', 'Только видео']] },
        { k: 'pinterestPhotoPercent', t: 'num', label: 'Pinterest: % фото (балансировка серий)', step: 5, min: 0 },
        { k: 'pinterestMaxVideoDuration', t: 'num', label: 'Pinterest: макс. видео, сек (0 = ∞)', step: 1, min: 0 },
        { k: 'pinterestAutoFS',   t: 'bool', label: 'Pinterest: авто «полный масштаб»' },
        { k: 'pinterestJumpKeys', t: 'sel', label: 'Pinterest: похожий пин по клавише', opts: [['off', 'Выкл'], ['focus', 'Фокус'], ['keys', 'Переход'], ['badges', 'Переход + номера'], ['shift', 'Переход, номера по Shift / CapsLock']] },
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
            else if (f.t === 'text' && f.k === 'filenameTemplate') ctl = `<span style="display:flex;align-items:center;gap:4px;"><input id="${id}" type="text" placeholder="пусто = шаблон сайта" style="width:170px;${inputCss}"><button class="mossad-tpl-help-btn" data-for="${id}" title="Теги шаблона и «как скачается сейчас»" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button></span>`;
            else if (f.t === 'text') ctl = `<input id="${id}" type="text" style="width:190px;${inputCss}">`;
            else if (f.t === 'sel') ctl = `<select id="${id}" style="${inputCss}">${f.opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>`;
            else if (f.t === 'dirs') ctl = `<span id="${id}" style="display:flex;gap:6px;">${[['up', '↑'], ['down', '↓'], ['left', '←'], ['right', '→']].map(d => `<label style="cursor:pointer;"><input type="checkbox" data-dir="${d[0]}"> ${d[1]}</label>`).join('')}</span>`;
            else ctl = `<input id="${id}" type="checkbox" style="cursor:pointer;">`;
            return `<input type="checkbox" class="mossad-def-force" data-k="${f.k}" checked title="Включать в «Применить во всех контейнерах»" style="cursor:pointer;margin:0;">` +
                   `<label for="${id}" style="cursor:default;">${esc(f.label)}</label>${ctl}`;
        }).join('');
        mossadWireTplHelp(form);
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

    // ── v1.3.46: вкладка «✏ Подписи» — textarea «ключ = подпись» + кликабельная палитра значков ──
    // Всё строится только при открытии вкладки (не при открытии окна) и не работает в фоне:
    // один делегированный обработчик на палитре, сохранение — по кнопке и при закрытии окна.
    function initLabelsTab(modal) {
        const pane = modal.querySelector('[data-pane="labels"]');
        if (!pane || pane.dataset.built) return;
        pane.dataset.built = '1';
        const btnCss = 'background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;';
        pane.innerHTML = `
            <div style="font-size:11px;color:#9ca3af;line-height:1.35;">Свои подписи кнопок — для всех сайтов и контейнеров. Формат <code>ключ = подпись</code>, <code>#</code> — комментарий, пустая подпись — по умолчанию. Клик по значку ниже вставляет его в позицию курсора.</div>
            <textarea id="mossad-labels-ta" spellcheck="false" wrap="off" style="width:100%;box-sizing:border-box;height:calc(85vh - 330px);min-height:180px;resize:vertical;background:#0b1220;border:1px solid #374151;border-radius:6px;color:#e5e7eb;padding:6px 8px;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;tab-size:4;"></textarea>
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
              <button id="mossad-labels-save" style="${btnCss}background:#065f46;border-color:#10b981;" title="Сохранить и сразу применить">💾 Применить</button>
              <button id="mossad-labels-reset" style="${btnCss}color:#f87171;" title="Вернуть все подписи по умолчанию">↺ По умолчанию</button>
              <span id="mossad-labels-status" style="font-size:11px;color:#9ca3af;"></span>
            </div>
            <div style="font:11px ui-monospace,Consolas,monospace;color:#6b7280;"># Шаблоны значков</div>
            <div id="mossad-labels-palette" style="display:flex;flex-direction:column;gap:2px;max-height:120px;overflow-y:auto;font-size:15px;line-height:1.5;user-select:text;"></div>`;
        const ta = pane.querySelector('#mossad-labels-ta');
        const status = pane.querySelector('#mossad-labels-status');
        const palette = pane.querySelector('#mossad-labels-palette');
        palette.innerHTML = LABEL_PALETTE.map(([title, list]) =>
            `<div><span style="font-size:10px;color:#6b7280;display:inline-block;min-width:62px;">${title}</span>` +
            list.split(' ').filter(Boolean).map(e => `<span data-emo="${e}" title="Вставить" style="cursor:pointer;padding:0 3px;border-radius:3px;">${e}</span>`).join('') +
            `</div>`).join('');

        ta.value = mossadLabelsToText();
        let saved = ta.value;
        let sel = { s: ta.value.length, e: ta.value.length };
        const remember = () => { sel = { s: ta.selectionStart, e: ta.selectionEnd }; };
        ['keyup', 'mouseup', 'select', 'blur', 'input'].forEach(ev => ta.addEventListener(ev, remember));
        // Не уводить фокус из textarea при клике по палитре
        palette.addEventListener('mousedown', (e) => { if (e.target.closest('[data-emo]')) e.preventDefault(); });
        palette.addEventListener('click', (e) => {
            const el = e.target.closest ? e.target.closest('[data-emo]') : null;
            if (!el) return;
            const emo = el.dataset.emo;
            const s = Math.min(sel.s, ta.value.length), en = Math.min(Math.max(sel.e, s), ta.value.length);
            ta.focus();
            if (typeof ta.setRangeText === 'function') ta.setRangeText(emo, s, en, 'end');
            else { ta.value = ta.value.slice(0, s) + emo + ta.value.slice(en); ta.selectionStart = ta.selectionEnd = s + emo.length; }
            remember();
        });

        const apply = (quiet) => {
            const { overrides, unknown } = mossadParseLabelsText(ta.value);
            const n = mossadSetLabelOverrides(overrides);
            saved = ta.value;
            status.textContent = `Своих подписей: ${n}` + (unknown.length ? ` · пропущены неизвестные: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}` : '');
            if (!quiet) showToast(`✏ Подписи применены (${n})`);
        };
        pane.querySelector('#mossad-labels-save').onclick = () => apply(false);
        pane.querySelector('#mossad-labels-reset').onclick = () => {
            if (!confirm('Вернуть все подписи по умолчанию?')) return;
            mossadSetLabelOverrides({});
            ta.value = mossadLabelsToText({});
            saved = ta.value;
            status.textContent = 'Подписи по умолчанию';
            showToast('↺ Подписи по умолчанию');
        };
        // При закрытии окна: сохраняем, только если текст менялся
        modal._mossadLabelsFlush = () => { if (ta.value !== saved) apply(true); };
        status.textContent = `Своих подписей: ${Object.keys(mossadGetLabelOverrides()).length}`;
    }

    /** tab: 'general' | 'hotkeys' | 'defaults' | 'labels' | 'todos' | 'sites'; не задан / 'last' — последняя открытая вкладка (v1.3.45). */
    function openSettingsWindow(tab) {
        if (!SETTINGS_TABS.includes(tab)) tab = getLastSettingsTab();
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
              <h3 style="margin:0; color:#fff; font-size:16px;" data-mossad-label="settingsTitle">${LH('settingsTitle')}</h3>
              <button id="mossad-settings-x" title="Закрыть (настройки сохраняются)" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0 2px;">×</button>
            </div>
            <div id="mossad-settings-tabs" style="display:flex; gap:4px; border-bottom:1px solid #374151; margin-bottom:2px;">
              <button data-tab="general" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" data-mossad-label="tabGeneral">${LH('tabGeneral')}</button>
              <button data-tab="hotkeys" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" data-mossad-label="tabHotkeys">${LH('tabHotkeys')}</button>
              <button data-tab="defaults" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" title="Общие умолчания для всех сайтов без своих сохранённых настроек" data-mossad-label="tabDefaults">${LH('tabDefaults')}</button>
              <button data-tab="labels" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" title="Свои подписи кнопок MOSSAD (для всех сайтов)" data-mossad-label="tabLabels">${LH('tabLabels')}</button>
              <button data-tab="todos" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" title="Задачи для ассистента (текст + фото)" data-mossad-label="tabTodos">${LH('tabTodos')}</button>
              <button data-tab="sites" style="padding:5px 12px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-size:12px;font-weight:bold;" title="На каких сайтах работает MOSSAD (общий список для всех контейнеров)" data-mossad-label="tabSites">${LH('tabSites')}</button>
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
            ${rootDomain.includes('pinterest.') ? `<div style="font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Переход к похожему пину клавишей: 1..9, 0, Q..P, A..L, Z..M (по клавиатуре, в любой раскладке)">
              <div style="display:flex;align-items:center;gap:6px;">
                <span data-mossad-label="pinJumpLabel">${LH('pinJumpLabel')}</span>
                <select id="mossad-gen-pjump" style="background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;"><option value="off" ${pinterestJumpMode() === 'off' ? 'selected' : ''} data-mossad-label="pinJumpOff">${LH('pinJumpOff')}</option><option value="focus" ${pinterestJumpMode() === 'focus' ? 'selected' : ''} data-mossad-label="pinJumpFocus">${LH('pinJumpFocus')}</option><option value="keys" ${pinterestJumpMode() === 'keys' ? 'selected' : ''} data-mossad-label="pinJumpKeys">${LH('pinJumpKeys')}</option><option value="badges" ${pinterestJumpMode() === 'badges' ? 'selected' : ''} data-mossad-label="pinJumpBadges">${LH('pinJumpBadges')}</option><option value="shift" ${pinterestJumpMode() === 'shift' ? 'selected' : ''} data-mossad-label="pinJumpShift">${LH('pinJumpShift')}</option></select>
              </div>
              <div id="mossad-gen-pjump-skip" style="font-size:11px;color:#9ca3af;margin-top:2px;"></div>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Шаблон имени скачиваемых файлов для ${rootDomain} (то же поле, что в меню). Пусто = шаблон сайта по умолчанию">
              <span data-mossad-label="tplSiteLabel" style="white-space:nowrap;">${LH('tplSiteLabel')}</span>
              <input id="mossad-gen-tpl" type="text" placeholder="${getDefaultFilenameTemplate()}" value="${(config.filenameTemplate || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
                style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;">
              <button class="mossad-tpl-help-btn" data-for="mossad-gen-tpl" title="Теги шаблона и «как скачается сейчас»" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button>
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
              <button id="mossad-debug-copy" title="Скопировать последние записи debug-лога в буфер обмена (и вывести таблицей в консоль)" style="margin-left:auto;background:#374151;border:1px solid #4b5563;border-radius:4px;color:#fbbf24;padding:1px 8px;cursor:pointer;font-size:11px;" data-mossad-label="debugCopy">${LH('debugCopy')}</button>
            </label>
            <div style="font-size:10px; color:#6b7280; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
              <span>v${SCRIPT_VERSION} · 2026-10-21</span>
              <a href="https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js" 
                 title="Обновить скрипт в Tampermonkey" 
                 style="color:#60a5fa; text-decoration:none; font-size:13px; font-weight:bold; cursor:pointer;" data-mossad-label="updateLink">${LH('updateLink')}</a>
            </div>
            </div>
            <div data-pane="hotkeys" style="display:none; flex-direction:column; gap:8px;">
            <div style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); border-radius:6px; padding:6px 10px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px;">
              <span style="color:#34d399;">💡 Изменения сохраняются сразу и при закрытии окна — для всех сайтов. Порядок строк — перетаскиванием за название</span>
            </div>
            <div id="mossad-hk-list" style="display:flex; flex-direction:column; gap:8px; max-height:calc(85vh - 230px); overflow-y:auto; padding-right:4px;"></div>
              <div style="display:flex; gap:6px; align-items:center;">
                <span style="font-size:12px;color:#9ca3af;" data-mossad-label="hkDefaultsLabel">${LH('hkDefaultsLabel')}</span>
                <button id="mossad-hk-reset" title="Сбросить клавиши к умолчаниям (сохранённым «Сохранить это» или заводским). Закреплённые 🔒 не меняются" style="background:#374151; border:1px solid #4b5563; padding:5px 10px; border-radius:6px; color:#f87171; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkResetKeys">${LH('hkResetKeys')}</button>
                <button id="mossad-hk-order-reset" title="Сбросить порядок строк к умолчанию. Закреплённые 🔒 остаются на месте" style="background:#374151; border:1px solid #4b5563; padding:5px 10px; border-radius:6px; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkResetOrder">${LH('hkResetOrder')}</button>
                <button id="mossad-hk-save-defaults" title="Сохранить текущие клавиши, порядок и закрепления как общие умолчания — применяются во всех открытых вкладках сразу, в остальных контейнерах при загрузке" style="background:#065f46; border:1px solid #10b981; padding:5px 10px; border-radius:6px; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkSaveDefaults">${LH('hkSaveDefaults')}</button>
              </div>
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
            <div data-pane="labels" style="display:none; flex-direction:column; gap:6px;"></div>
            <div data-pane="todos" style="display:none; flex-direction:column; gap:6px;"></div>
            <div data-pane="sites" style="display:none; flex-direction:column; gap:6px;"></div>
            <div style="display:flex; justify-content:space-between; margin-top:10px; gap:8px;">
                <span></span>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-hk-close" title="Закрыть (настройки сохраняются)" style="background:#374151; border:1px solid #4b5563; padding:6px 14px; border-radius:6px; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="close">${LH('close')}</button>
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
            snapWidget:       'Привязать к левому верхнему краю (F8)',
            openTodos:        'Открыть «📝 Тудушки» (по умолчанию не назначено)'
        };
        
        const renderHotkeyRow = (k) => {
            const row = document.createElement('div');
            row.dataset.hk = k;
            row.style.cssText = `display:flex; justify-content:space-between; align-items:center; background:#1f2937; padding:8px 12px; border-radius:6px; border:1px solid #374151; box-sizing:border-box;`;

            // v1.3.45: вся левая часть (название) — ручка перетаскивания; поле клавиши — нет
            const label = document.createElement('span');
            label.className = 'mossad-hk-handle';
            label.textContent = keysMap[k];
            label.title = 'Перетащите, чтобы изменить порядок';
            label.style.cssText = 'font-size:13px; flex:1; cursor:grab; user-select:none; -webkit-user-select:none; touch-action:none; padding-right:8px;';

            const slotDiv = document.createElement('div');
            slotDiv.style.cssText = 'display:flex; gap:2px; align-items:center;';

            // v1.3.45: одна привязка на действие (резервный слот убран; см. normalizeHotkeyBinding)
            const cur = () => normalizeHotkeyBinding(config.hk[k]);
            const setHk = (h) => { config.hk[k] = normalizeHotkeyBinding(h); Settings.save(); };

            const btn = document.createElement('button');
            btn.className = 'mossad-hk-key';
            btn.style.cssText = `background:#374151; border:none; color:#3b82f6; padding:4px 10px; border-radius:4px; cursor:pointer; min-width:60px; font-weight:bold; font-size:12px; text-align:center;`;
            btn.textContent = formatHotkey(cur());

            const resetBtn = document.createElement('button');
            resetBtn.className = 'mossad-hk-key-reset';
            resetBtn.textContent = '↺';
            resetBtn.title = 'Клавиша по умолчанию';
            resetBtn.style.cssText = `background:transparent; border:none; color:#9ca3af; cursor:pointer; padding:0 2px; font-size:12px;`;

            const disableBtn = document.createElement('button');
            disableBtn.className = 'mossad-hk-key-off';
            disableBtn.textContent = '—';
            disableBtn.title = 'Отключить';
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
                        btn.textContent = formatHotkey(cur());
                        btn.style.color = '#3b82f6';
                        return;
                    }

                    // v1.3.43: буква, нажатая в русской раскладке, сохраняется латиницей (Ctrl+и → Ctrl+b);
                    // сверка всё равно идёт и по физической клавише (code), в любой раскладке.
                    const usKey = mossadUsKeyForCode(e.code || '');
                    const recKey = (usKey && /^[a-z]$/.test(usKey) && typeof e.key === 'string' && /[^\x00-\x7f]/.test(e.key)) ? usKey : e.key;
                    const newHk = { key: recKey, code: e.code || '', ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey }; // v1.3.39: + физическая клавиша
                    setHk(newHk);

                    btn.textContent = formatHotkey(cur());
                    btn.style.color = '#3b82f6';
                };
                document.addEventListener('keydown', handler, true);
            };

            resetBtn.onclick = () => {
                if (row.dataset.pinned) return; // v1.3.48: закреплённую строку сброс не меняет
                setHk(hotkeyDefaultFor(k));
                btn.textContent = formatHotkey(cur());
            };

            disableBtn.onclick = () => {
                setHk(null);
                btn.textContent = formatHotkey(cur());
            };

            // v1.3.47: справа от «—» — ⤒ наверх, ⤓ вниз, 🔒 закрепить (обработка — делегированно на списке)
            const mkMini = (cls, key, title) => {
                const b = document.createElement('button');
                b.className = cls;
                b.title = title;
                b.style.cssText = 'background:transparent; border:none; color:#9ca3af; cursor:pointer; padding:0 2px; font-size:12px; line-height:1;';
                mossadLabelEl(b, key);
                return b;
            };
            const sep = document.createElement('span');
            sep.style.cssText = 'width:1px; height:14px; background:#374151; margin:0 3px;';
            slotDiv.append(btn, resetBtn, disableBtn, sep,
                mkMini('mossad-hk-top', 'hkTop', 'Переместить строку в самый верх'),
                mkMini('mossad-hk-bottom', 'hkBottom', 'Переместить строку в самый низ'),
                mkMini('mossad-hk-pin', 'hkPin', 'Закрепить строку на месте'));
            row.append(label, slotDiv);
            return row;
        };
        /** Вид строки по закреплению: ручка не тянется, ⤒/⤓ неактивны, значок 🔒/🔓. */
        const paintPinned = (row, pinned) => {
            row.dataset.pinned = pinned ? '1' : '';
            const label = row.querySelector('.mossad-hk-handle');
            if (label) {
                label.style.cursor = pinned ? 'default' : 'grab';
                label.title = pinned ? 'Строка закреплена (🔓 — открепить)' : 'Перетащите, чтобы изменить порядок';
            }
            const pinBtn = row.querySelector('.mossad-hk-pin');
            if (pinBtn) {
                mossadLabelEl(pinBtn, pinned ? 'hkUnpin' : 'hkPin');
                pinBtn.title = pinned ? 'Открепить строку' : 'Закрепить строку на месте';
                pinBtn.style.color = pinned ? '#fbbf24' : '#9ca3af';
            }
            row.querySelectorAll('.mossad-hk-top, .mossad-hk-bottom, .mossad-hk-key-reset').forEach(b => {
                b.disabled = !!pinned;
                b.style.opacity = pinned ? '0.3' : '1';
                b.style.cursor = pinned ? 'default' : 'pointer';
            });
            row.style.borderColor = pinned ? 'rgba(251,191,36,0.45)' : '#374151';
        };
        const renderHotkeyList = () => {
            list.innerHTML = '';
            const pinned = new Set(getHotkeyPinned());
            orderedHotkeyKeys(Object.keys(keysMap), getHotkeyOrder()).forEach(k => {
                const row = renderHotkeyRow(k);
                paintPinned(row, pinned.has(k));
                list.append(row);
            });
        };
        /** Расставить строки в DOM по порядку ключей и сохранить порядок. */
        const commitOrder = (order) => {
            const byKey = {};
            Array.from(list.children).forEach(r => { if (r.dataset && r.dataset.hk) byKey[r.dataset.hk] = r; });
            order.forEach(k => { if (byKey[k]) list.appendChild(byKey[k]); });
            saveHotkeyOrder(order);
        };
        // Делегированные клики: ⤒ / ⤓ / 🔒
        list.addEventListener('click', (e) => {
            const b = e.target && e.target.closest ? e.target.closest('.mossad-hk-top, .mossad-hk-bottom, .mossad-hk-pin') : null;
            if (!b || !list.contains(b)) return;
            e.preventDefault();
            e.stopPropagation();
            const row = b.closest('[data-hk]');
            const k = row && row.dataset.hk;
            if (!k) return;
            const cur = Array.from(list.children).filter(r => r.dataset && r.dataset.hk).map(r => r.dataset.hk);
            const pinned = getHotkeyPinned();
            if (b.classList.contains('mossad-hk-pin')) {
                const isPinned = pinned.includes(k);
                const next = isPinned ? pinned.filter(x => x !== k) : pinned.concat(k);
                saveHotkeyPinned(next);
                saveHotkeyOrder(cur); // место закреплённой строки фиксируется в сохранённом порядке
                paintPinned(row, !isPinned);
                return;
            }
            if (pinned.includes(k)) return; // закреплённую строку ⤒/⤓ не двигают
            const rest = cur.filter(x => x !== k);
            const want = b.classList.contains('mossad-hk-top') ? [k].concat(rest) : rest.concat(k);
            commitOrder(hkOrderKeepPinned(want, cur, pinned));
        });
        renderHotkeyList();
        list.style.position = 'relative';

        // ── v1.3.45: перетаскивание строк (pointer events, не HTML5 DnD) ──
        // Тянем за название: строка «всплывает» (absolute внутри списка), на её месте — пунктирный
        // заполнитель, который перескакивает между строками по середине их высоты. Отпустили — строка
        // встаёт на место заполнителя, порядок пишется в GM. Сдвиг < 4 px — не перетаскивание.
        let hkDrag = null;
        const hkRows = () => Array.from(list.children).filter(el => el.dataset && el.dataset.hk);
        const onDragMove = (e) => {
            const d = hkDrag;
            if (!d || (d.pointerId != null && e.pointerId != null && e.pointerId !== d.pointerId)) return;
            const dy = e.clientY - d.startY;
            if (!d.active) {
                if (Math.abs(dy) < 4) return;
                d.active = true;
                const h = d.row.offsetHeight || d.row.getBoundingClientRect().height || 36;
                d.ph = document.createElement('div');
                d.ph.className = 'mossad-hk-placeholder';
                d.ph.style.cssText = `height:${h}px; border:1px dashed #3b82f6; border-radius:6px; background:rgba(59,130,246,0.08); box-sizing:border-box; flex:none;`;
                d.startTop = d.row.offsetTop;
                list.insertBefore(d.ph, d.row);
                d.row.style.position = 'absolute';
                d.row.style.left = '0';
                d.row.style.right = '4px';
                d.row.style.zIndex = '2';
                d.row.style.opacity = '0.92';
                d.row.style.boxShadow = '0 6px 18px rgba(0,0,0,0.55)';
                d.row.style.pointerEvents = 'none';
                d.label.style.cursor = 'grabbing';
                d.prevBodyCursor = document.body.style.cursor;
                document.body.style.cursor = 'grabbing';
                modal.dataset.dragging = '1';
            }
            e.preventDefault();
            d.row.style.top = `${d.startTop + dy + (list.scrollTop - d.startScroll)}px`;
            // Куда встать: перед первой строкой, чья середина ниже указателя
            const others = hkRows().filter(r => r !== d.row);
            let before = null;
            for (const r of others) {
                const rc = r.getBoundingClientRect();
                if (e.clientY < rc.top + rc.height / 2) { before = r; break; }
            }
            if (before) { if (d.ph.nextSibling !== before) list.insertBefore(d.ph, before); }
            else if (list.lastChild !== d.ph) list.appendChild(d.ph);
            // Автопрокрутка у краёв списка
            const lr = list.getBoundingClientRect();
            if (lr.height > 0) {
                if (e.clientY < lr.top + 24) list.scrollTop -= 12;
                else if (e.clientY > lr.bottom - 24) list.scrollTop += 12;
            }
        };
        const endDrag = (e) => {
            const d = hkDrag;
            if (!d || (e && d.pointerId != null && e.pointerId != null && e.pointerId !== d.pointerId)) return;
            hkDrag = null;
            document.removeEventListener('pointermove', onDragMove, true);
            document.removeEventListener('pointerup', endDrag, true);
            document.removeEventListener('pointercancel', endDrag, true);
            try { if (d.label.releasePointerCapture && d.pointerId != null) d.label.releasePointerCapture(d.pointerId); } catch (err) {}
            d.label.style.cursor = 'grab';
            if (!d.active) return;
            ['position', 'left', 'right', 'top', 'zIndex', 'opacity', 'boxShadow', 'pointerEvents'].forEach(p => { d.row.style[p] = ''; });
            if (d.ph && d.ph.parentNode === list) { list.insertBefore(d.row, d.ph); d.ph.remove(); }
            document.body.style.cursor = d.prevBodyCursor || '';
            delete modal.dataset.dragging;
            // Клик после перетаскивания не должен считаться «кликом вне окна»
            modal._mossadSuppressClickUntil = Date.now() + 300;
            // v1.3.47: закреплённые строки возвращаются на свои места, остальные — в новом порядке
            const dropped = hkRows().map(r => r.dataset.hk);
            const order = hkOrderKeepPinned(dropped, d.orderBefore.split('|'), getHotkeyPinned());
            if (order.join('|') !== d.orderBefore) commitOrder(order);
        };
        list.addEventListener('pointerdown', (e) => {
            const label = e.target && e.target.closest ? e.target.closest('.mossad-hk-handle') : null;
            if (!label || !list.contains(label) || hkDrag) return;
            if (e.button != null && e.button !== 0) return;
            if (window.capturingFor !== null && window.capturingFor !== undefined) return; // идёт запись клавиши
            e.preventDefault(); // не выделять текст
            const row = label.closest('[data-hk]');
            if (row && row.dataset.pinned) return; // v1.3.47: закреплённую строку не тянут
            hkDrag = { row, label, pointerId: e.pointerId, startY: e.clientY, startScroll: list.scrollTop, active: false, ph: null, orderBefore: hkRows().map(r => r.dataset.hk).join('|') };
            try { if (label.setPointerCapture && e.pointerId != null) label.setPointerCapture(e.pointerId); } catch (err) {}
            document.addEventListener('pointermove', onDragMove, true);
            document.addEventListener('pointerup', endDrag, true);
            document.addEventListener('pointercancel', endDrag, true);
        });
        modal._mossadEndDrag = () => endDrag(null);

        document.body.appendChild(modal);

        // ── Вкладки ──
        const setTab = (t) => {
            const want = SETTINGS_TABS.includes(t) ? t : 'hotkeys';
            modal.dataset.tab = want;
            rememberSettingsTab(want); // v1.3.45
            if (want === 'labels') initLabelsTab(modal); // v1.3.46: строится лениво, при первом открытии вкладки
            if (want === 'todos') initTodosTab(modal);   // v1.3.49: тоже лениво (фото читаются только здесь)
            if (want === 'sites') initSitesTab(modal);   // v1.3.50: тоже лениво
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

        // v1.3.59: Pinterest — похожий пин по клавише + какие клавиши пропущены (заняты хоткеями MOSSAD)
        const genPJump = modal.querySelector('#mossad-gen-pjump');
        if (genPJump) {
            const paintSkip = () => {
                const sk = pinterestJumpCodes().skipped;
                const el = modal.querySelector('#mossad-gen-pjump-skip');
                if (el) el.textContent = sk.length ? `${L('pinJumpSkipped')} ${sk.map(x => x.label).join(' ')}` : L('pinJumpNoSkipped');
            };
            paintSkip();
            genPJump.onchange = (e) => { Settings.setQuiet('pinterestJumpKeys', e.target.value); pinterestJumpApply(); paintSkip(); };
        }
        // v1.3.53: шаблон имени для этого сайта (то же, что поле в меню)
        const genTpl = modal.querySelector('#mossad-gen-tpl');
        if (genTpl) {
            genTpl.onchange = genTpl.onblur = (e) => mossadSaveSiteTemplate(e.target.value);
            mossadWireTplHelp(genTpl.parentElement);
        }
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

        // v1.3.45: единственная кнопка «Закрыть» (= ×, Esc, клик вне окна) — всегда с сохранением
        modal.querySelector('#mossad-hk-close').onclick = closeAndSaveModal;

        // Досохранение при закрытии: числовое поле в фокусе (change ещё не пришёл) и токен без 💾
        modal._mossadFlush = () => {
            const rowsEl = modal.querySelector('#mossad-playlist-rows');
            if (rowsEl) {
                const v = Math.max(5, Math.min(200, parseInt(rowsEl.value, 10) || 30));
                if (v !== Number(config.playlistRows)) config.playlistRows = v;
            }
            const cwEl = modal.querySelector('#mossad-collect-watch-sec');
            if (cwEl) {
                const v = Math.max(5, Math.min(600, parseInt(cwEl.value, 10) || 30));
                if (v !== Number(config.collectWatchSec)) config.collectWatchSec = v;
            }
            if (typeof modal._mossadLabelsFlush === 'function') modal._mossadLabelsFlush(); // v1.3.46
            if (typeof modal._mossadTodosFlush === 'function') modal._mossadTodosFlush();   // v1.3.49
            const tokEl = modal.querySelector('#mossad-gh-token');
            if (tokEl && tokEl.value !== (config.githubToken || '')) setGithubToken(tokEl.value);
        };

        // v1.3.45: клик вне окна настроек (и вне любых элементов MOSSAD) закрывает его с сохранением.
        // Только реальные клики (isTrusted — программные .click() скрипта по кнопкам Grok не в счёт),
        // начатые тоже снаружи; не во время записи клавиши и не сразу после перетаскивания строки.
        const isInsideMossadEl = (el) => !!(el && el.closest && el.closest('[id^="mossad-"]'));
        let downOutside = false;
        const onDocPointerDown = (e) => { downOutside = !isInsideMossadEl(e.target); };
        const onDocClick = (e) => {
            const wasOutside = downOutside;
            downOutside = false;
            if (!e.isTrusted || !wasOutside) return;
            if (isInsideMossadEl(e.target)) return;
            if (window.capturingFor !== null && window.capturingFor !== undefined) return;
            if (modal.dataset.dragging || Date.now() < (modal._mossadSuppressClickUntil || 0)) return;
            if (!document.getElementById('mossad-hk-modal')) return;
            closeSettingsWindow(true);
        };
        modal._mossadOnOutsideClick = onDocClick;     // для тестов (isTrusted не подделать)
        modal._mossadOnOutsidePointerDown = onDocPointerDown;
        document.addEventListener('pointerdown', onDocPointerDown, true);
        document.addEventListener('click', onDocClick, true);

        const onEscClose = (e) => {
            if (e.key === 'Escape' && window.capturingFor === null) {
                closeAndSaveModal();
            }
        };
        document.addEventListener('keydown', onEscClose);
        // v1.3.40: слушатель Esc снимается при ЛЮБОМ закрытии окна (раньше при закрытии кнопкой/хоткеем он оставался висеть)
        modal._mossadCleanup = () => {
            document.removeEventListener('keydown', onEscClose);
            document.removeEventListener('pointerdown', onDocPointerDown, true);
            document.removeEventListener('click', onDocClick, true);
            if (typeof modal._mossadEndDrag === 'function') modal._mossadEndDrag();
        };

        modal._mossadRenderHotkeys = renderHotkeyList;
        modal.querySelector('#mossad-hk-reset').onclick = () => {
            const src = readHotkeyDefaults() ? 'сохранённым умолчаниям' : 'заводским';
            if (!confirm(`Сбросить горячие клавиши к ${src}? Закреплённые 🔒 не изменятся.`)) return;
            const n = resetHotkeysKeepPinned();
            if (typeof window.saveGlobalHotkeys === 'function') window.saveGlobalHotkeys(false);
            else Settings.save();
            renderHotkeyList();
            showToast(`✅ Клавиши сброшены (${n})`);
        };
        modal.querySelector('#mossad-hk-order-reset').onclick = () => {
            resetHotkeyOrderKeepPinned(Object.keys(keysMap));
            renderHotkeyList();
            showToast('↕ Порядок по умолчанию');
        };
        modal.querySelector('#mossad-hk-save-defaults').onclick = () => {
            if (saveHotkeyDefaults(Object.keys(keysMap))) showToast('🌐 Клавиши сохранены как общие умолчания — применяются во всех вкладках');
            else showToast('❌ GM-хранилище недоступно', true);
        };
        return modal;
    }

    // v1.3.48: общие умолчания клавиш — при загрузке (если ещё не применены здесь) и живьём из других вкладок
    try {
        const rec = readHotkeyDefaults();
        let applied = null;
        try { applied = localStorage.getItem(HK_DEFAULTS_APPLIED_LS); } catch (e) {}
        if (rec && rec.id && rec.id !== applied) applyHotkeyDefaults(rec, 'load');
    } catch (e) {}
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(HK_DEFAULTS_GM_KEY, (name, oldVal, newVal, remote) => {
                if (!remote) return;
                const rec = readHotkeyDefaults();
                let applied = null;
                try { applied = localStorage.getItem(HK_DEFAULTS_APPLIED_LS); } catch (e) {}
                if (rec && rec.id && rec.id !== applied) {
                    applyHotkeyDefaults(rec, 'broadcast');
                    if (typeof showToast === 'function') showToast('🌐 Общие умолчания клавиш применены');
                }
            });
        } catch (e) {}
    }
