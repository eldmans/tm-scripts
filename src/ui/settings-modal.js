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
    const SETTINGS_TABS = ['general', 'hotkeys', 'video', 'quota', 'defaults', 'labels', 'todos', 'sites'];
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
    // ── v1.3.48: «По умолчанию: Клавиши · Порядок · Применить на всех сайтах · Сохранить как умолчание» (v1.3.68) — общие умолчания хоткеев (GM) ──
    // { id, ts, hk, order, pinned }. Запись = рассылка: открытые вкладки получают её через
    // GM_addValueChangeListener, остальные контейнеры — при следующей загрузке (id применённого — в localStorage).
    // Закреплённые (🔒) строки НЕ меняются ни сбросом, ни рассылкой: ни клавиша, ни место.
    const HK_DEFAULTS_GM_KEY = 'mossad_hk_defaults';
    const HK_DEFAULTS_APPLIED_LS = 'mossad_hk_defaults_applied';
    const HK_FACTORY_ORDER = ['nextSlide', 'prevSlide', 'nextGroup', 'prevGroup', 'download', 'upscale', 'deleteVid', 'sound', 'playPause', 'help', 'history', 'slideshowPanel', 'slideshowStart', 'galleryPlayPause', 'galleryStop', 'duplicateNext', 'rewind', 'snapWidget', 'openTodos', 'grokCycle', 'grokFirstSlide', 'grokHistBack', 'grokHistFwd', 'grokLastSlide', 'expand', 'xvDoubleSize', 'generate'];
    function readHotkeyDefaults() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(HK_DEFAULTS_GM_KEY, null); } catch (e) {}
        try {
            const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!o || typeof o !== 'object' || !o.hk || typeof o.hk !== 'object') return null;
            return { id: String(o.id || ''), ts: Number(o.ts) || 0, hk: o.hk, order: Array.isArray(o.order) ? o.order.filter(x => typeof x === 'string') : [], pinned: Array.isArray(o.pinned) ? o.pinned.filter(x => typeof x === 'string') : [], only: Array.isArray(o.only) ? o.only.filter(x => typeof x === 'string') : null };
        } catch (e) { return null; }
    }
    // v1.3.71: умолчания только для этого домена (окно «Сохранить как умолчание» → «Для {домен}»).
    // GM `mossad_hk_defaults_site` = { <rootDomain>: { ts, hk, order } }; без рассылки — база сброса «Клавиши» этого сайта.
    const HK_SITE_DEFAULTS_GM_KEY = 'mossad_hk_defaults_site';
    const HK_DOMAIN_SHORT = String(rootDomain).split('.')[0] || rootDomain;
    function _readSiteDefaultsAll() {
        try {
            const raw = typeof GM_getValue === 'function' ? GM_getValue(HK_SITE_DEFAULTS_GM_KEY, null) : null;
            const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
        } catch (e) { return {}; }
    }
    function readSiteHotkeyDefaults() {
        const o = _readSiteDefaultsAll()[rootDomain];
        return (o && o.hk && typeof o.hk === 'object') ? { hk: o.hk, order: Array.isArray(o.order) ? o.order : [] } : null;
    }
    function saveSiteHotkeyDefaults(allKeys) {
        if (typeof GM_setValue !== 'function') return false;
        const all = _readSiteDefaultsAll();
        all[rootDomain] = { ts: Date.now(), hk: JSON.parse(JSON.stringify(config.hk || {})), order: orderedHotkeyKeys(allKeys || HK_FACTORY_ORDER, getHotkeyOrder()) };
        try { GM_setValue(HK_SITE_DEFAULTS_GM_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
    }
    /** Клавиши по умолчанию: умолчания этого домена, иначе сохранённые общие («Сохранить как умолчание»), иначе заводские. */
    function hotkeyDefaultFor(k) {
        const s = readSiteHotkeyDefaults();
        if (s && Object.prototype.hasOwnProperty.call(s.hk, k)) return normalizeHotkeyBinding(s.hk[k]);
        const d = readHotkeyDefaults();
        if (d && d.hk && Object.prototype.hasOwnProperty.call(d.hk, k)) return normalizeHotkeyBinding(d.hk[k]);
        return normalizeHotkeyBinding(DEFAULT_CONFIG.hk[k]);
    }
    function hotkeyDefaultOrder() {
        const s = readSiteHotkeyDefaults();
        if (s && s.order.length) return s.order;
        const d = readHotkeyDefaults();
        return (d && d.order.length) ? d.order : HK_FACTORY_ORDER;
    }
    /** Сбросить клавиши к умолчаниям, кроме закреплённых. Возвращает число изменённых. */
    // v1.3.60: одно сочетание — одно действие. Ключ сочетания сверяется так же, как hotkeyMatches:
    // модификаторы + физическая клавиша (code, иначе выведенная из символа; «+» основного ряда = цифрового блока).
    function hotkeyComboId(h) {
        const b = normalizeHotkeyBinding(h);
        if (!b.key) return '';
        // Именованные клавиши (F8, Pause, Enter, стрелки) hotkeyMatches сверяет по e.key → по имени; символы — по физической клавише
        let code = b.key === ' ' ? 'Space'
            : (String(b.key).length > 1 ? 'name:' + String(b.key).toLowerCase()
            : (b.code || mossadCodeForKey(b.key) || ('key:' + String(b.key).toLowerCase())));
        if (b.key === '+' || code === 'Equal' || code === 'NumpadAdd') code = 'PLUS';
        return [b.ctrl, b.alt, b.shift, !!b.meta].map(x => x ? 1 : 0).join('') + '|' + code;
    }
    /** Другие действия с тем же сочетанием, что h (кроме самого k). */
    function hotkeyConflicts(k, h, keys) {
        const id = hotkeyComboId(h);
        if (!id) return [];
        return (keys || Object.keys(config.hk || {})).filter(o => o !== k && hotkeyComboId(config.hk[o]) === id);
    }
    /** Группы дубликатов среди действий keys: id → [действия]. */
    function hotkeyDuplicateGroups(keys) {
        const by = {};
        keys.forEach(k => { const id = hotkeyComboId(config.hk[k]); if (id) (by[id] = by[id] || []).push(k); });
        return Object.values(by).filter(g => g.length > 1);
    }
    /** После сброса: сбрасываемая (не закреплённая) строка не может получить клавишу, уже занятую другой —
     *  закреплённые и стоящие выше по порядку важнее. Возвращает очищенные действия. */
    function hotkeyDedupeAfterReset(order, pinnedList) {
        const pin = new Set(pinnedList || []);
        const seen = new Set(), cleared = [];
        const keys = order.filter(k => pin.has(k)).concat(order.filter(k => !pin.has(k)));
        keys.forEach(k => {
            const id = hotkeyComboId(config.hk[k]);
            if (!id) return;
            if (seen.has(id) && !pin.has(k)) { config.hk[k] = normalizeHotkeyBinding(null); cleared.push(k); return; }
            seen.add(id);
        });
        return cleared;
    }
    window.hotkeyComboId = hotkeyComboId;

    function resetHotkeysKeepPinned() {
        const pin = new Set(getHotkeyPinned());
        const keys = new Set(Object.keys(DEFAULT_CONFIG.hk).concat(Object.keys(config.hk || {})));
        const d = readHotkeyDefaults(), sd = readSiteHotkeyDefaults();
        if (d) Object.keys(d.hk).forEach(k => keys.add(k));
        if (sd) Object.keys(sd.hk).forEach(k => keys.add(k));
        let n = 0;
        keys.forEach(k => {
            if (pin.has(k)) return;
            if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG.hk, k) && !(d && d.hk[k]) && !(sd && sd.hk[k])) return;
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
    /**
     * «Сохранить как умолчание»: текущие клавиши + порядок + закрепления → общие умолчания (база «Сброс клавиш») и рассылка.
     * v1.3.68: effective=true — действующие клавиши этого сайта (после «Применить на всех сайтах» они же общие).
     */
    function saveHotkeyDefaults(allKeys, effective, skipPinned) {
        const rec = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            ts: Date.now(),
            hk: effective ? JSON.parse(JSON.stringify(config.hk || {})) : mossadHkGlobalTable(), // v1.3.63: общие значения, без «своих» клавиш сайта
            order: orderedHotkeyKeys(allKeys || HK_FACTORY_ORDER, getHotkeyOrder()),
            pinned: getHotkeyPinned(),
        };
        // v1.3.71: «Для всех НЕ ЗАКРЕПЛЁННЫХ» — закреплённые здесь не входят: их умолчания прежние, рассылка их не трогает (only)
        if (skipPinned) {
            const pin = new Set(rec.pinned), prev = readHotkeyDefaults();
            const hk = Object.assign({}, prev ? prev.hk : {});
            Object.keys(rec.hk).forEach(k => { if (!pin.has(k)) hk[k] = rec.hk[k]; });
            rec.only = Object.keys(rec.hk).filter(k => !pin.has(k));
            rec.hk = hk;
            rec.pinned = prev ? prev.pinned : [];
        }
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
            if (rec.only && !rec.only.includes(k)) continue; // v1.3.71: «не закреплённые» — только перечисленные
            if (mossadHkSetGlobalValue(k, rec.hk[k])) continue; // v1.3.63: «своё» для сайта — меняется только общее значение
            config.hk[k] = normalizeHotkeyBinding(rec.hk[k]);
        }
        const all = HK_FACTORY_ORDER.concat(Object.keys(DEFAULT_CONFIG.hk).filter(k => !HK_FACTORY_ORDER.includes(k)));
        const cur = orderedHotkeyKeys(all, getHotkeyOrder());
        if (rec.order && rec.order.length) saveHotkeyOrder(hkOrderKeepPinned(orderedHotkeyKeys(all, rec.order), cur, localPinned));
        const mergedPins = Array.from(new Set(localPinned.concat(rec.pinned || [])));
        if (mergedPins.length !== localPinned.length) saveHotkeyPinned(mergedPins);
        try { localStorage.setItem(HK_DEFAULTS_APPLIED_LS, rec.id); } catch (e) {}
        try { persistLocalConfig(); } catch (e) {}
        try { mossadHkPersist(); } catch (e) {}
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

    /**
     * v1.3.71: окно «Вы уверены? Вы точно уверены?» для красной «Сохранить как умолчание».
     * Варианты: Для {домен} (зелёная, без примера) / для всех ОБЩИХ / для всех НЕ ЗАКРЕПЛЁННЫХ / ДЛЯ ВСЕГО —
     * в последних трёх нужно решить пример на сложение двузначных чисел. Внутри окна настроек (id mossad-*),
     * Esc закрывает только это окно.
     */
    function openHkDefaultsDialog(modal, onPick) {
        const old = document.getElementById('mossad-hk-defdlg');
        if (old) old.remove();
        const d = document.createElement('div');
        d.id = 'mossad-hk-defdlg';
        d.style.cssText = 'position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;border-radius:inherit;';
        const btn = 'display:block;width:100%;margin:4px 0;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;color:#e5e7eb;';
        d.innerHTML = `<div style="background:#111827;border:1px solid #ef4444;border-radius:10px;padding:12px 14px;min-width:260px;max-width:340px;font-size:12px;color:#e5e7eb;">
            <div style="font-weight:bold;color:#f87171;margin-bottom:2px;">Вы уверены? Вы точно уверены?</div>
            <div style="color:#9ca3af;margin-bottom:6px;">Новые умолчания — к ним возвращает «Клавиши».</div>
            <div data-step="pick">
              <button data-mode="domain" style="${btn}background:#065f46;border:1px solid #10b981;" title="Только база сброса для ${rootDomain}; другие сайты и контейнеры не трогаются">Для ${rootDomain}</button>
              <button data-mode="common" style="${btn}background:#374151;border:1px solid #ef4444;" title="Общие клавиши (без «своих» этого сайта) — умолчание для всех сайтов и контейнеров. На другие сайты не рассылается">Для всех ОБЩИХ настроек</button>
              <button data-mode="unpinned" style="${btn}background:#374151;border:1px solid #ef4444;" title="Как «Применить на всех сайтах» + умолчание, но закреплённые 🔒 не трогаются нигде">Для всех НЕ ЗАКРЕПЛЁННЫХ настроек</button>
              <button data-mode="all" style="${btn}background:#7f1d1d;border:1px solid #ef4444;" title="Применить на всех сайтах и сохранить всё (клавиши, порядок, закрепления) как умолчание">ДЛЯ ВСЕГО</button>
            </div>
            <div data-step="math" style="display:none;margin:6px 0;">
              <div data-q style="margin-bottom:4px;"></div>
              <input data-ans type="text" inputmode="numeric" autocomplete="off" style="width:70px;background:#1f2937;border:1px solid #4b5563;border-radius:4px;color:#e5e7eb;padding:3px 6px;font-size:13px;">
              <button data-ok style="margin-left:6px;background:#7f1d1d;border:1px solid #ef4444;border-radius:6px;color:#fee2e2;padding:4px 10px;cursor:pointer;font-weight:bold;font-size:12px;">OK</button>
            </div>
            <button data-cancel style="${btn}background:#374151;border:1px solid #4b5563;margin-top:8px;">Отмена</button>
          </div>`;
        const close = () => d.remove();
        let mode = null, sum = 0;
        const done = () => { close(); onPick(mode); };
        d.querySelector('[data-cancel]').onclick = close;
        d.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => {
            mode = b.dataset.mode;
            if (mode === 'domain') { done(); return; }
            const x = 10 + Math.floor(Math.random() * 90), y = 10 + Math.floor(Math.random() * 90);
            sum = x + y;
            d.dataset.sum = String(sum); // для тестов
            d.querySelector('[data-step="pick"]').style.display = 'none';
            d.querySelector('[data-step="math"]').style.display = 'block';
            d.querySelector('[data-q]').textContent = `«${b.textContent}» — решите пример: ${x} + ${y} =`;
            const inp = d.querySelector('[data-ans]');
            try { inp.focus(); } catch (e) {}
        }; });
        const check = () => {
            const inp = d.querySelector('[data-ans]');
            if (parseInt(String(inp.value).trim(), 10) === sum) done();
            else { inp.style.borderColor = '#ef4444'; inp.value = ''; }
        };
        d.querySelector('[data-ok]').onclick = check;
        d.addEventListener('keydown', (e) => {
            e.stopPropagation(); // Esc/Enter/цифры — только этому окну (не закрывать настройки, не хоткеи)
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('[data-ans]')) { e.preventDefault(); check(); }
        });
        d.addEventListener('click', (e) => { if (e.target === d) close(); });
        modal.appendChild(d);
        return d;
    }

    // ── v1.3.73: листание вкладок окна настроек по кругу: ←/→ и б/ю (по e.code: Comma = «б ,» влево, Period = «ю .» вправо) ──
    // Один слушатель window/capture (до хоткеев MOSSAD и сайта); работает только при открытом окне и фокусе не в поле ввода.
    function mossadSettingsTabsKey(e) {
        const c = e.code || '';
        const dir = (c === 'ArrowRight' || c === 'Period') ? 1 : (c === 'ArrowLeft' || c === 'Comma') ? -1 : 0;
        if (!dir || e.ctrlKey || e.altKey || e.metaKey) return;
        const modal = document.getElementById('mossad-hk-modal');
        if (!modal || typeof modal._mossadSetTab !== 'function') return;
        if (window.capturingFor !== null && window.capturingFor !== undefined) return;
        if (isEditableElement(document.activeElement) || document.getElementById('mossad-hk-defdlg') || document.getElementById('mossad-key-help')) return;
        const tabs = Array.from(modal.querySelectorAll('#mossad-settings-tabs [data-tab]')).map(b => b.dataset.tab);
        if (!tabs.length) return;
        const i = tabs.indexOf(modal.dataset.tab);
        e.preventDefault();
        e.stopImmediatePropagation();
        modal._mossadSetTab(tabs[((i < 0 ? 0 : i) + dir + tabs.length) % tabs.length]);
    }
    window.addEventListener('keydown', mossadSettingsTabsKey, true);

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
        { k: 'filenameTemplateEnabled', t: 'bool', label: 'Использовать шаблон' },
        { k: 'allowDuplicates',   t: 'bool', label: 'Дубли: качать без вопроса' },
        { k: 'dblPosition',       t: 'sel', label: 'Позиция пометки DBL', opts: [['end', 'В конце имени'], ['middle', 'В середине имени']] },
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
        { k: 'autoUpdateCheck',   t: 'bool', label: 'Автопроверка обновлений (GitHub)' },
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
        modal._mossadQuotaFlush = () => {
            const pane = modal.querySelector('[data-pane="quota"]');
            if (pane && pane._inited) {
                const cbEnabled = pane.querySelector('#mossad-grok-quota-enabled');
                const inputSep = pane.querySelector('#mossad-grok-quota-sep');
                const selectTime = pane.querySelector('#mossad-grok-quota-timemode');
                if (cbEnabled) config.grokQuotaEnabled = cbEnabled.checked;
                if (inputSep) config.grokQuotaSep = inputSep.value;
                if (selectTime) config.grokQuotaTimeMode = selectTime.value;
                Settings.save();
                if (typeof updateGrokQuotaPill === 'function') updateGrokQuotaPill();
            }
        };
        status.textContent = `Своих подписей: ${Object.keys(mossadGetLabelOverrides()).length}`;
    }

    // ── v1.3.87: вкладка лимита Grok ──
    function initQuotaTab(modal) {
        const pane = modal.querySelector('[data-pane="quota"]');
        if (!pane) return;
        if (pane._inited) {
            if (typeof pane._updatePreview === 'function') pane._updatePreview();
            return;
        }
        pane._inited = true;

        pane.innerHTML = `
            <div style="background:#1f2937;border:1px solid #374151;border-radius:8px;padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <h4 style="margin:0;font-size:14px;color:#f3f4f6;">📊 Расход квоты Grok (Лимит)</h4>
                    <span style="font-size:11px;color:#10b981;background:rgba(16,185,129,0.15);padding:2px 6px;border-radius:4px;">grok.com</span>
                </div>
                <div style="font-size:12px;color:#9ca3af;margin-bottom:12px;line-height:1.4;">
                    Компактная плашка отображается по умолчанию сверху по центру экрана на сайте Grok. Показывает процент израсходованного лимита, время до сброса и букву тарифа (<b>S</b> — SuperGrok, <b>P</b> — Premium, <b>F</b> — Free).
                </div>
                
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#e5e7eb;cursor:pointer;margin-bottom:8px;">
                    <input type="checkbox" id="mossad-grok-quota-enabled" ${config.grokQuotaEnabled !== false ? 'checked' : ''} style="accent-color:#10b981;">
                    Показывать плашку расхода лимита на Grok
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#e5e7eb;cursor:pointer;margin-bottom:8px;">
                    <input type="checkbox" id="mossad-grok-hist-pill-enabled" ${config.grokHistPillEnabled !== false ? 'checked' : ''} style="accent-color:#3b82f6;">
                    Показывать плашку позиции в истории диалога (рядом с квотой)
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:#e5e7eb;cursor:pointer;margin-bottom:12px;" title="Также переключается двойным кликом (dblclick) по любой из плашек">
                    <input type="checkbox" id="mossad-grok-pills-compact" ${config.grokPillsCompact ? 'checked' : ''} style="accent-color:#f59e0b;">
                    Компактный вид плашек (только % и только номер позиции)
                </label>
                
                <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#d1d5db;margin-bottom:12px;">
                    <span style="white-space:nowrap;">Символ-разделитель:</span>
                    <input id="mossad-grok-quota-sep" type="text" value="${String(config.grokQuotaSep != null ? config.grokQuotaSep : ' · ').replace(/"/g, '&quot;')}" style="width:70px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:3px 6px;text-align:center;font-size:12px;">
                    <span style="font-size:11px;color:#9ca3af;">(например: &quot; · &quot;, &quot; | &quot;, &quot; / &quot;)</span>
                </div>

                <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#d1d5db;margin-bottom:14px;">
                    <span style="white-space:nowrap;">Время до сброса:</span>
                    <select id="mossad-grok-quota-timemode" style="background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:3px 8px;font-size:12px;">
                        <option value="auto" ${(config.grokQuotaTimeMode || 'auto') === 'auto' ? 'selected' : ''}>Авто: дни (если &gt;1 дня) или только часы (3д / 14ч)</option>
                        <option value="both" ${(config.grokQuotaTimeMode || 'auto') === 'both' ? 'selected' : ''}>Дни и часы одновременно (3д 14ч)</option>
                        <option value="hours" ${(config.grokQuotaTimeMode || 'auto') === 'hours' ? 'selected' : ''}>Всегда только в часах (72ч)</option>
                    </select>
                </div>

                <div style="display:flex;gap:8px;margin-bottom:14px;">
                    <button id="mossad-grok-quota-resetpos" style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#e5e7eb;padding:4px 10px;cursor:pointer;font-size:12px;">↺ По центру вверху</button>
                    <button id="mossad-grok-quota-refresh" style="background:#10b981;border:none;border-radius:4px;color:#fff;padding:4px 10px;cursor:pointer;font-size:12px;">🔄 Обновить данные</button>
                </div>

                <div style="border-top:1px solid #374151;padding-top:10px;">
                    <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">Предпросмотр плашки:</div>
                    <div id="mossad-grok-quota-preview" style="display:flex;align-items:center;justify-content:center;padding:12px;background:#111827;border-radius:6px;min-height:36px;">
                    </div>
                </div>
            </div>
        `;

        const cbEnabled = pane.querySelector('#mossad-grok-quota-enabled');
        const cbHistPill = pane.querySelector('#mossad-grok-hist-pill-enabled');
        const cbCompact = pane.querySelector('#mossad-grok-pills-compact');
        const inputSep = pane.querySelector('#mossad-grok-quota-sep');
        const selectTime = pane.querySelector('#mossad-grok-quota-timemode');
        const btnResetPos = pane.querySelector('#mossad-grok-quota-resetpos');
        const btnRefresh = pane.querySelector('#mossad-grok-quota-refresh');
        const previewEl = pane.querySelector('#mossad-grok-quota-preview');

        const updatePreview = () => {
            if (!previewEl) return;
            const enabled = cbEnabled ? cbEnabled.checked : true;
            const sep = inputSep ? inputSep.value : ' · ';
            const mode = selectTime ? selectTime.value : 'auto';

            if (!enabled) {
                previewEl.innerHTML = '<span style="color:#9ca3af;font-size:12px;font-style:italic;">Плашка выключена в настройках</span>';
                return;
            }

            const cached = (typeof grokGetCachedQuota === 'function' && grokGetCachedQuota());
            const sample = cached || {
                usagePercent: 24,
                currentPeriod: { end: new Date(Date.now() + 3 * 86400 * 1000 + 14 * 3600 * 1000).toISOString() }
            };

            if (typeof renderGrokQuotaHtml === 'function') {
                previewEl.innerHTML = `<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:rgba(17,24,39,0.9);border:1px solid rgba(75,85,99,0.65);border-radius:9999px;box-shadow:0 4px 12px rgba(0,0,0,0.5);color:#e5e7eb;font-size:12px;font-weight:600;">` +
                    renderGrokQuotaHtml(sample, { grokQuotaSep: sep, grokQuotaTimeMode: mode }) +
                    `</div>`;
            } else {
                previewEl.innerHTML = `<span style="color:#10b981;font-weight:bold;">24%${sep}3д${sep}S</span>`;
            }
        };

        pane._updatePreview = updatePreview;

        const saveChanges = () => {
            config.grokQuotaEnabled = cbEnabled ? cbEnabled.checked : true;
            config.grokHistPillEnabled = cbHistPill ? cbHistPill.checked : true;
            config.grokPillsCompact = cbCompact ? cbCompact.checked : false;
            config.grokQuotaSep = inputSep ? inputSep.value : ' · ';
            config.grokQuotaTimeMode = selectTime ? selectTime.value : 'auto';
            Settings.save();
            updatePreview();
            if (typeof updateGrokQuotaPill === 'function') updateGrokQuotaPill();
        };

        if (cbEnabled) cbEnabled.onchange = saveChanges;
        if (cbHistPill) cbHistPill.onchange = saveChanges;
        if (cbCompact) cbCompact.onchange = saveChanges;
        if (inputSep) inputSep.oninput = saveChanges;
        if (selectTime) selectTime.onchange = saveChanges;

        if (btnResetPos) {
            btnResetPos.onclick = (e) => {
                e.preventDefault();
                config.grokQuotaPos = null;
                Settings.save();
                if (typeof updateGrokQuotaPill === 'function') updateGrokQuotaPill();
                showToast('↺ Позиция сброшена (по центру вверху)');
            };
        }

        if (btnRefresh) {
            btnRefresh.onclick = async (e) => {
                e.preventDefault();
                btnRefresh.disabled = true;
                btnRefresh.textContent = '⏳ ...';
                try {
                    if (typeof grokFetchQuota === 'function') {
                        await grokFetchQuota(true);
                        updatePreview();
                        showToast('✓ Квота Grok обновлена');
                    } else {
                        showToast('Доступно на grok.com');
                    }
                } catch (err) {
                    showToast('Ошибка обновления квоты');
                } finally {
                    btnRefresh.disabled = false;
                    btnRefresh.textContent = '🔄 Обновить данные';
                }
            };
        }

        updatePreview();
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
              <button data-tab="general" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabGeneral')}" data-mossad-label="tabGeneral" data-mossad-icon="1">${mossadLabelIcon(LH('tabGeneral'))}</button>
              <button data-tab="hotkeys" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabHotkeys')}" data-mossad-label="tabHotkeys" data-mossad-icon="1">${mossadLabelIcon(LH('tabHotkeys'))}</button>
              <button data-tab="video" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabVideo')} — Лёгкий слой на всех сайтах: DND-скачивание, скорость видео" data-mossad-label="tabVideo" data-mossad-icon="1" data-mossad-tip="Лёгкий слой на всех сайтах: DND-скачивание, скорость видео">${mossadLabelIcon(LH('tabVideo'))}</button>
              <button data-tab="quota" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabQuota')} — Расход квоты, время сброса и тариф Grok" data-mossad-label="tabQuota" data-mossad-icon="1" data-mossad-tip="Расход квоты, время сброса и тариф Grok">${mossadLabelIcon(LH('tabQuota'))}</button>
              <button data-tab="defaults" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabDefaults')} — Общие умолчания для всех сайтов без своих сохранённых настроек" data-mossad-label="tabDefaults" data-mossad-icon="1" data-mossad-tip="Общие умолчания для всех сайтов без своих сохранённых настроек">${mossadLabelIcon(LH('tabDefaults'))}</button>
              <button data-tab="labels" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabLabels')} — Свои подписи кнопок MOSSAD (для всех сайтов)" data-mossad-label="tabLabels" data-mossad-icon="1" data-mossad-tip="Свои подписи кнопок MOSSAD (для всех сайтов)">${mossadLabelIcon(LH('tabLabels'))}</button>
              <button data-tab="todos" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabTodos')} — Задачи для ассистента (текст + фото)" data-mossad-label="tabTodos" data-mossad-icon="1" data-mossad-tip="Задачи для ассистента (текст + фото)">${mossadLabelIcon(LH('tabTodos'))}</button>
              <button data-tab="sites" style="padding:5px 10px;border-radius:6px 6px 0 0;border:1px solid #374151;border-bottom:none;cursor:pointer;font-weight:bold;font-size:15px;line-height:1;" title="${LH('tabSites')} — На каких сайтах работает MOSSAD (общий список для всех контейнеров)" data-mossad-label="tabSites" data-mossad-icon="1" data-mossad-tip="На каких сайтах работает MOSSAD (общий список для всех контейнеров)">${mossadLabelIcon(LH('tabSites'))}</button>
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
            ${rootDomain === 'grok.com' ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Вне поля ввода эти клавиши не переводят фокус в промт Grok (например, R у расширения Speed Control). Другие расширения клавишу видят">
              <span data-mossad-label="noPromptLabel" style="white-space:nowrap;">${LH('noPromptLabel')}</span>
              <input id="mossad-gen-nokeys" type="text" value="${String(config.grokNoPromptKeys == null ? '' : config.grokNoPromptKeys).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
                style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;">
              <button id="mossad-gen-nokeys-help" title="Именованные клавиши" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button>
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Сворачивать активное поле ввода промпта при любом листании слайдов (стрелки, Alt+1..4, история и т.д.)">
              <input id="mossad-grok-collapse-prompt" type="checkbox" style="accent-color:#10b981;" ${config.grokCollapsePromptOnNav !== false ? 'checked' : ''}>
              Сворачивать промпт при листании слайдов
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Сохранять слайд в историю просмотров conversation, если просмотр длился дольше этого числа секунд (история старше 1 часа очищается автоматически)">
              История слайдов: пауза для записи, сек:
              <input id="mossad-grok-hist-dwell" type="number" min="1" max="60" step="1" value="${Number(config.grokHistoryDwellSec) || 5}" style="width:52px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;">
            </label>` : ''}
            <div style="font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Выбранные хоткеи MOSSAD срабатывают, даже когда фокус в поле промпта (ввода). Список — id действий через запятую; выбор — кнопкой «?»">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input id="mossad-gen-prompthk-on" type="checkbox" style="accent-color:#3b82f6;" ${config.promptHotkeysOn ? 'checked' : ''}><span data-mossad-label="promptHkLabel">${LH('promptHkLabel')}</span></label>
              <div style="display:flex;align-items:center;gap:6px;margin-top:3px;padding-left:22px;">
                <input id="mossad-gen-prompthk" type="text" readonly title="Только выбор кнопкой «?» (клик — добавить, повторный клик — убрать)" value="${String(config.promptHotkeys == null ? '' : config.promptHotkeys).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
                  style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#9ca3af;padding:2px 6px;font-size:12px;cursor:pointer;">
                <button id="mossad-gen-prompthk-help" title="Выбрать хоткеи (клик — добавить, повторный клик — убрать)" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Шаблон имени скачиваемых файлов для ${rootDomain} (то же поле, что в меню). Пусто = шаблон сайта по умолчанию">
              <span data-mossad-label="tplSiteLabel" style="white-space:nowrap;">${LH('tplSiteLabel')}</span>
              <input id="mossad-gen-tpl" type="text" placeholder="${getDefaultFilenameTemplate()}" value="${(config.filenameTemplate || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
                style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;">
              <button class="mossad-tpl-help-btn" data-for="mossad-gen-tpl" title="Теги шаблона и «как скачается сейчас»" style="${MOSSAD_TPL_HELP_BTN_CSS}" data-mossad-label="tplHelpBtn">${LH('tplHelpBtn')}</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;" title="v1.3.74: минус-слова для ${rootDomain} — через запятую, всегда убираются из {title} и {desc} (без учёта регистра). Текст с запятой или пробелами по краям — в кавычках: &quot; - Brave&quot;. В самом шаблоне то же делает {title--слово}">
              <span data-mossad-label="tplJunkLabel" style="white-space:nowrap;">${LH('tplJunkLabel')}</span>
              <input id="mossad-gen-junk" type="text" placeholder="Watch Online, &quot; - Brave&quot;" value="${mossadJunkText().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
                style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;">
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;">
              <span title="Позиция пометки дубликата в имени файла: в конце имени или в середине">Пометка дубликата (DBL):</span>
              <select id="mossad-gen-dbl-pos" style="background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;">
                <option value="end" ${config.dblPosition === 'end' ? 'selected' : ''}>В конце имени (по умолчанию)</option>
                <option value="middle" ${config.dblPosition === 'middle' ? 'selected' : ''}>В середине имени</option>
              </select>
              <span style="font-size:11px;color:#9ca3af;margin-left:auto;" title="Сквозной номер успешных закачек для ${rootDomain}">Закачек на сайте: <b id="mossad-gen-site-count" style="color:#38bdf8;">${typeof mossadGetSiteDlCount === 'function' ? mossadGetSiteDlCount() : 0}</b></span>
            </div>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Клик мышью вне окон MOSSAD сворачивает панель настроек виджета до краткого меню">
              <input id="mossad-cb-outside-close" type="checkbox" style="accent-color:#3b82f6;" ${config.closePanelOnOutsideClick !== false ? 'checked' : ''}>
              Сворачивать панель кликом вне её
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#d1d5db;margin-bottom:6px;cursor:pointer;" title="Уведомление «🔊 Звук включен / 🔇 Звук выключен» на ~5 с при переключении звука хоткеем. Крестик на нём закрывает только текущее уведомление">
              <input id="mossad-cb-sound-toast" type="checkbox" style="accent-color:#3b82f6;" ${config.showSoundToast !== false ? 'checked' : ''}>
              Показывать тост переключения звука
            </label>
            ${(() => { // v1.3.82: 🔔 Сигналы скачивания (issue #2, п.5)
                const B = mossadBeepsRead();
                const tf = (id, v, w, tip) => `<input id="${id}" type="text" inputmode="numeric" value="${v}" title="${tip}" style="width:${w}px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 4px;font-size:12px;">`;
                const row = (k, name) => `
                <div class="mossad-beep-row" data-beep="${k}" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:3px 0 0 18px;">
                  <label style="display:flex;align-items:center;gap:4px;cursor:pointer;min-width:150px;"><input id="mossad-beep-${k}-on" type="checkbox" style="accent-color:#3b82f6;" ${B[k].on ? 'checked' : ''}>${name}</label>
                  Гц ${tf(`mossad-beep-${k}-hz`, B[k].hz, 52, 'Высота тона, Гц (50–8000). Низкий ≈ 200–400, высокий ≈ 1000–2000')}
                  раз ${tf(`mossad-beep-${k}-count`, B[k].count, 28, 'Сколько гудков подряд (1–5)')}
                  мс ${tf(`mossad-beep-${k}-ms`, B[k].ms, 40, 'Длительность одного гудка, мс (20–1000)')}
                  <button id="mossad-beep-${k}-test" type="button" title="Проиграть с текущими значениями полей" style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#e5e7eb;cursor:pointer;font-size:11px;padding:1px 7px;">▶</button>
                </div>`;
                return `
            <div id="mossad-beeps" style="font-size:12px;color:#d1d5db;margin-bottom:6px;" title="Звуковые сигналы скачивания. Сохраняются для всех сайтов">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input id="mossad-beep-on" type="checkbox" style="accent-color:#3b82f6;" ${B.on ? 'checked' : ''}>🔔 Сигналы скачивания</label>
                <span>громкость, %</span>${tf('mossad-beep-volume', B.volume, 36, 'Громкость сигналов, % (0–100)')}
              </div>
              ${row('dup', '«Уже скачивали»')}
              ${row('start', 'Скачивание началось')}
            </div>`;
            })()}
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
            <div style="font-size:10px; color:#6b7280; margin-bottom:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span>v${SCRIPT_VERSION} · 2026-11-10</span>
              <a href="https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js" 
                 title="Обновить скрипт в Tampermonkey" 
                 style="color:#60a5fa; text-decoration:none; font-size:13px; font-weight:bold; cursor:pointer;" data-mossad-label="updateLink">${LH('updateLink')}</a>
              <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#d1d5db;cursor:pointer;margin-left:auto;" title="Автоматическая фоновая проверка обновлений на GitHub. Если выключено — обновление проверяется только вручную (кнопка 🔄 или Win+Alt+R)">
                <input id="mossad-cb-auto-update" type="checkbox" style="accent-color:#3b82f6;" ${config.autoUpdateCheck ? 'checked' : ''}>
                Автообновление
              </label>
            </div>
            </div>
            <div data-pane="hotkeys" style="display:none; flex-direction:column; gap:8px;">
            <div style="background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); border-radius:6px; padding:6px 10px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px;">
              <span style="color:#34d399;">💡 Изменения сохраняются сразу и при закрытии окна — для всех сайтов. Порядок строк — перетаскиванием за название</span>
            </div>
            <div id="mossad-hk-list" style="display:flex; flex-direction:column; gap:8px; max-height:calc(85vh - 230px); overflow-y:auto; padding-right:4px;"></div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <div id="mossad-hk-defaults-box" style="border:1px solid #6b7280; border-radius:8px; padding:3px 6px 5px; display:flex; flex-direction:column; align-items:center; gap:3px;">
                  <span style="font-size:11px;color:#9ca3af;" data-mossad-label="hkDefaultsLabel">${LH('hkDefaultsLabel')}</span>
                  <div style="display:flex; gap:6px;">
                    <button id="mossad-hk-reset" title="Сбросить клавиши к умолчаниям (этого сайта, если сохранены «Для домена», иначе общим сохранённым или заводским). Закреплённые 🔒 не меняются" style="background:#374151; border:1px solid #4b5563; padding:5px 10px; border-radius:6px; color:#f87171; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkResetKeys">${LH('hkResetKeys')}</button>
                    <button id="mossad-hk-order-reset" title="Сбросить порядок строк к умолчанию. Закреплённые 🔒 остаются на месте" style="background:#374151; border:1px solid #4b5563; padding:5px 10px; border-radius:6px; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkResetOrder">${LH('hkResetOrder')}</button>
                  </div>
                </div>
                <button id="mossad-hk-apply-domain" title="Все действующие клавиши — «Только для этого сайта» (${rootDomain}): одинаковые на всех страницах ${rootDomain} во всех контейнерах, правка общих их не меняет. Общие клавиши и умолчания не меняются" style="background:#831843; border:1px solid #ec4899; padding:5px 10px; border-radius:6px; color:#fce7f3; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkForDomain" data-mossad-suf=" ${HK_DOMAIN_SHORT}">${LH('hkForDomain')} ${HK_DOMAIN_SHORT}</button>
                <button id="mossad-hk-apply-all" title="Действующие клавиши этого сайта — на все сайты: общие клавиши и «свои» клавиши других сайтов (кроме действий, работающих только там). Умолчания для «Клавиши» (сброс) не меняются" style="background:#1e3a8a; border:1px solid #3b82f6; padding:5px 10px; border-radius:6px; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkApplyAll">${LH('hkApplyAll')}</button>
                <button id="mossad-hk-save-defaults" title="Сменить умолчания (к ним возвращает «Клавиши»): окно выбора — для ${rootDomain} / для общих / для не закреплённых / для всего (последние три — с примером на сложение)" style="background:#7f1d1d; border:1px solid #ef4444; padding:5px 10px; border-radius:6px; color:#fee2e2; cursor:pointer; font-weight:bold; font-size:12px;" data-mossad-label="hkSaveDefaults">${LH('hkSaveDefaults')}</button>
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
            <div data-pane="video" style="display:none; flex-direction:column; gap:6px; overflow-y:auto; max-height:calc(85vh - 160px); padding-right:4px;"></div>
            <div data-pane="quota" style="display:none; flex-direction:column; gap:6px; overflow-y:auto; max-height:calc(85vh - 160px); padding-right:4px;"></div>
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
        const HOTKEY_CATEGORIES = [
            { id: 'cat-player', title: '🎬 Слайд-шоу и медиаплеер', keys: ['galleryPlayPause', 'slideshowStart', 'galleryStop', 'playPause', 'sound', 'expand', 'xvDoubleSize'] },
            { id: 'cat-nav', title: '🎞 Листание и навигация по кадрам', keys: ['nextSlide', 'prevSlide', 'nextGroup', 'prevGroup', 'rewind', 'grokFirstSlide', 'grokHistBack', 'grokHistFwd', 'grokLastSlide'] },
            { id: 'cat-dl', title: '💾 Скачивание, апскейл и удаление', keys: ['download', 'upscale', 'deleteVid', 'duplicateNext', 'generate'] },
            { id: 'cat-ui', title: '🛠 Меню, окна и утилиты', keys: ['updateScript', 'slideshowPanel', 'help', 'history', 'snapWidget', 'openTodos', 'grokCycle'] }
        ];

        const keysMap = {
            // Слайд-шоу и медиаплеер
            galleryPlayPause: 'Большое слайдшоу: Плей/Пауза (Insert; без ссылок — 1-е нажатие собирает)',
            slideshowStart:   'Малое слайдшоу / ракета (Shift+Insert)',
            galleryStop:      'Стоп большого слайдшоу',
            playPause:        'Пауза/Плей видео (Pause)',
            sound:            'Звук вкл/выкл (ScrollLock)',
            expand:           '⛶ Развернуть / полный экран (F — плееры, видео, Grok, Pinterest)',
            xvDoubleSize:     'XVideos / xv-ru — 🔲 Двойной размер плеера (T)',

            // Листание и навигация по кадрам
            nextSlide:        'Следующий слайд (ArrowRight)',
            prevSlide:        'Предыдущий слайд (ArrowLeft)',
            nextGroup:        'Следующая группа (Alt+PageDown)',
            prevGroup:        'Предыдущая группа (Alt+PageUp)',
            rewind:           'Мотать в начало / шаг назад (Alt+R)',
            grokFirstSlide:   'Grok — первый кадр/слайд диалога (Alt+1)',
            grokHistBack:     'Grok — назад по истории слайдов (Alt+2)',
            grokHistFwd:      'Grok — вперёд по истории слайдов (Alt+3)',
            grokLastSlide:    'Grok — последний кадр/слайд диалога (Alt+4)',

            // Скачивание, апскейл и удаление
            download:         'Скачать медиа (PageDown)',
            upscale:          'Улучшить (Shift+«+» / Shift+Num+)',
            deleteVid:        'Удалить видео/пост (Delete)',
            duplicateNext:    'Дублировать в фоне + Слайд (Ctrl+Пробел)',
            generate:         'Генерация Space / Отправка Grok (Ctrl+Enter)',

            // Меню, окна и утилиты
            updateScript:     'Обновить скрипт с GitHub (Win+Alt+R / клик 🔄)',
            slideshowPanel:   'Меню: полное / краткое / скрыть (Ctrl+Insert)',
            help:             'Настройки клавиш (Ctrl+F1)',
            history:          'Переход в Saved Grok (Home)', 
            snapWidget:       'Привязать к левому верхнему краю (F8)',
            openTodos:        'Открыть «📝 Тудушки» (по умолчанию не назначено)',
            grokCycle:        'Grok — цикл: промт → фото/видео → длина/соотношение (\\)'
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
                    assignWithConflictCheck(newHk);
                };
                document.addEventListener('keydown', handler, true);
            };

            // v1.3.60: сочетание уже занято другим действием — спросить прямо в строке (Да — у того очистить)
            const assignWithConflictCheck = (newHk) => {
                const prevBox = row.querySelector('.mossad-hk-conflict');
                if (prevBox) prevBox.remove();
                const others = hotkeyConflicts(k, newHk, Object.keys(keysMap));
                const spd = mossadSpeedOwners(newHk, hotkeyComboId); // v1.3.67: клавиши скорости видео (лёгкий слой)
                const pinNote = (rootDomain.includes('pinterest.') && typeof pinterestJumpMode === 'function' && pinterestJumpMode() !== 'off') &&
                    !newHk.ctrl && !newHk.alt && !newHk.meta && PIN_JUMP_ALL_CODES.includes(newHk.code || mossadCodeForKey(newHk.key));
                if (!others.length && !spd.length) {
                    setHk(newHk);
                    btn.textContent = formatHotkey(cur()); btn.style.color = '#3b82f6';
                    if (pinNote) showToast(L('hkPinJumpNote'));
                    if (typeof modal._mossadPaintDupes === 'function') modal._mossadPaintDupes();
                    return;
                }
                btn.textContent = formatHotkey(normalizeHotkeyBinding(newHk)); btn.style.color = '#fbbf24';
                const box = document.createElement('div');
                box.className = 'mossad-hk-conflict';
                box.style.cssText = 'flex-basis:100%; margin-top:6px; font-size:12px; color:#fbbf24; display:flex; gap:6px; align-items:center; flex-wrap:wrap;';
                const names = others.map(o => keysMap[o] || o).concat(spd.map(o => o.label)).join(', ');
                box.innerHTML = `<span>${LH('hkConflict')} <b></b>. ${LH('hkConflictAsk')}</span>` +
                    `<button class="mossad-hk-yes" style="background:#b91c1c;border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;">${LH('hkYes')}</button>` +
                    `<button class="mossad-hk-no" style="background:#374151;border:none;color:#e5e7eb;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;">${LH('hkCancel')}</button>` +
                    (pinNote ? `<span style="color:#9ca3af;">${LH('hkPinJumpNote')}</span>` : '');
                box.querySelector('b').textContent = names;
                row.style.flexWrap = 'wrap';
                row.appendChild(box);
                box.querySelector('.mossad-hk-yes').onclick = (ev) => {
                    ev.stopPropagation();
                    others.forEach(o => { config.hk[o] = normalizeHotkeyBinding(null); });
                    spd.forEach(o => o.clear());
                    setHk(newHk);
                    box.remove();
                    if (typeof modal._mossadRenderHotkeys === 'function') modal._mossadRenderHotkeys();
                    showToast(`⌨️ ${formatHotkey(cur())} → ${keysMap[k] || k}; ${L('hkCleared')} ${names}`);
                };
                box.querySelector('.mossad-hk-no').onclick = (ev) => {
                    ev.stopPropagation();
                    box.remove();
                    btn.textContent = formatHotkey(cur()); btn.style.color = '#3b82f6';
                };
            };

            resetBtn.onclick = () => {
                if (row.dataset.pinned) return; // v1.3.48: закреплённую строку сброс не меняет
                const def = hotkeyDefaultFor(k);
                if (!normalizeHotkeyBinding(def).key) { setHk(def); btn.textContent = formatHotkey(cur()); return; }
                assignWithConflictCheck(def);
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
                mkMini('mossad-hk-top', 'hkTop', 'Вверх до края секции; с верха общих — в «Только для этого сайта»'),
                mkMini('mossad-hk-bottom', 'hkBottom', 'Вниз до края секции; с низа секции сайта — в «Общие»'),
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
        // v1.3.60: уже существующие дубликаты (старые настройки, рассылка умолчаний) — красным с подсказкой,
        // автоматически не чистим (не угадать, какое действие владельцу важнее)
        const paintDupes = () => {
            const groups = hotkeyDuplicateGroups(Object.keys(keysMap));
            const dupOf = {};
            groups.forEach(g => g.forEach(k => { dupOf[k] = g.filter(x => x !== k); }));
            Array.from(list.children).forEach(r => {
                const b = r.querySelector && r.querySelector('.mossad-hk-key');
                if (!b) return;
                const sp = mossadSpeedOwners(config.hk[r.dataset.hk], hotkeyComboId).map(o => o.label); // v1.3.67
                const d0 = dupOf[r.dataset.hk];
                const d = (d0 || sp.length) ? (d0 || []).concat(sp) : null;
                b.style.outline = d ? '2px solid #ef4444' : '';
                b.style.color = d ? '#f87171' : '#3b82f6';
                b.title = d ? `${L('hkDupHint')} ${d.map(x => keysMap[x] || x).join(', ')}` : '';
                r.dataset.dup = d ? '1' : '';
            });
        };
        modal._mossadPaintDupes = paintDupes;
        // ── v1.3.63: две секции — «Только для этого сайта» (сверху), разделитель, «Общие для всех сайтов» ──
        // Строку перетащили выше разделителя (или ⤒ с верха общих) — клавиша своя для сайта; ниже — снова общая.
        const mkSecHead = (cls, text, hint) => {
            const h = document.createElement('div');
            h.className = cls;
            h.style.cssText = 'font-size:11px; font-weight:bold; color:#9ca3af; text-transform:uppercase; letter-spacing:0.04em; padding:2px 2px 0;' +
                (cls === 'mossad-hk-sep' ? ' border-top:2px solid #4b5563; margin-top:4px; padding-top:8px;' : '');
            h.textContent = text;
            if (hint) {
                const sp = document.createElement('span');
                sp.className = 'mossad-hk-sec-hint';
                sp.style.cssText = 'display:block; font-weight:normal; text-transform:none; letter-spacing:0; color:#6b7280; font-size:11px;';
                sp.textContent = hint;
                h.appendChild(sp);
            }
            return h;
        };
        const hkSep = () => list.querySelector('.mossad-hk-sep');
        const renderHotkeyList = () => {
            list.innerHTML = '';
            const pinned = new Set(getHotkeyPinned());
            const all = Object.keys(keysMap);
            const siteSet = new Set(mossadHkSiteKeys().filter(k => keysMap[k]));
            const siteKeys = orderedHotkeyKeys(all.filter(k => siteSet.has(k)), mossadHkSiteEntry().order);
            const globalKeys = orderedHotkeyKeys(all, getHotkeyOrder()).filter(k => !siteSet.has(k));

            list.append(mkSecHead('mossad-hk-sec-site', `${L('hkSecSite')} (${rootDomain})`, siteKeys.length ? '' : L('hkSecSiteEmpty')));
            const addRow = (k, site, catId) => {
                const row = renderHotkeyRow(k);
                row.dataset.site = site ? '1' : '';
                if (catId) row.dataset.cat = catId;
                paintPinned(row, pinned.has(k));
                list.append(row);
            };
            siteKeys.forEach(k => addRow(k, true));

            list.append(mkSecHead('mossad-hk-sep', L('hkSecGlobal')));

            // v1.3.99: Группировка глобальных клавиш по 4 логическим блокам
            HOTKEY_CATEGORIES.forEach(cat => {
                const catKeys = cat.keys.filter(k => globalKeys.includes(k));
                if (catKeys.length) {
                    const head = document.createElement('div');
                    head.className = 'mossad-hk-cat-head';
                    head.dataset.cat = cat.id;
                    head.style.cssText = 'font-size:11px; font-weight:bold; color:#60a5fa; text-transform:uppercase; letter-spacing:0.04em; padding:6px 2px 2px; margin-top:8px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;';
                    head.innerHTML = `<span>${cat.title}</span><span style="font-size:10px; color:#9ca3af; font-weight:normal;">(${catKeys.length})</span>`;
                    list.append(head);
                    catKeys.forEach(k => addRow(k, false, cat.id));
                }
            });
            // Непопавшие в категории клавиши (если есть сторонние)
            const categorized = new Set(HOTKEY_CATEGORIES.flatMap(c => c.keys));
            const uncategorized = globalKeys.filter(k => !categorized.has(k));
            if (uncategorized.length) {
                uncategorized.forEach(k => addRow(k, false, 'cat-other'));
            }

            paintDupes();
        };
        /** Строки секций в DOM: { site: [...], global: [...] } */
        const hkSections = () => {
            const out = { site: [], global: [] };
            let past = false;
            Array.from(list.children).forEach(el => {
                if (el.classList && el.classList.contains('mossad-hk-sep')) { past = true; return; }
                if (el.dataset && el.dataset.hk) out[past ? 'global' : 'site'].push(el.dataset.hk);
            });
            return out;
        };
        /** Общий порядок хранится для всех сайтов: «свои» строки этого сайта сохраняют там прежние места. */
        const mergeGlobalOrder = (visible) => {
            const all = Object.keys(keysMap);
            const full = orderedHotkeyKeys(all, getHotkeyOrder());
            const vis = new Set(visible), q = visible.slice(), out = [];
            full.forEach(k => { if (vis.has(k)) { if (q.length) out.push(q.shift()); } else out.push(k); });
            return out.concat(q);
        };
        /** Расставить секции и сохранить: порядок сайта, общий порядок, переходы между секциями. */
        const commitSections = (siteOrder, globalOrder) => {
            const wasSite = new Set(mossadHkSiteKeys());
            siteOrder.forEach(k => { if (!wasSite.has(k)) mossadHkSetSite(k, true, siteOrder); });
            globalOrder.forEach(k => { if (wasSite.has(k)) mossadHkSetSite(k, false); });
            mossadHkSaveSiteOrder(siteOrder);
            saveHotkeyOrder(mergeGlobalOrder(globalOrder));
            const moved = siteOrder.some(k => !wasSite.has(k)) || globalOrder.some(k => wasSite.has(k));
            if (moved) { renderHotkeyList(); if (window.updateWidgetUI) window.updateWidgetUI(); return; }
            const byKey = {};
            Array.from(list.children).forEach(r => { if (r.dataset && r.dataset.hk) byKey[r.dataset.hk] = r; });
            const sep = hkSep();
            siteOrder.forEach(k => { if (byKey[k]) list.insertBefore(byKey[k], sep); });
            globalOrder.forEach(k => { if (byKey[k]) list.appendChild(byKey[k]); });
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
            // v1.3.63: ⤒ / ⤓ — «до следующего потолка»: край своей секции, а с края — через разделитель
            const sec = hkSections();
            const inSite = sec.site.includes(k);
            const up = b.classList.contains('mossad-hk-top');
            const curSec = inSite ? sec.site : sec.global;
            const rest = curSec.filter(x => x !== k);
            const moved = hkOrderKeepPinned(up ? [k].concat(rest) : rest.concat(k), curSec, pinned);
            if (moved.join('|') !== curSec.join('|')) {
                if (inSite) commitSections(moved, sec.global); else commitSections(sec.site, moved);
                return;
            }
            // уже у края секции
            if (up && !inSite) commitSections(sec.site.concat(k), sec.global.filter(x => x !== k));       // ⤒ с верха общих → в конец «своих»
            else if (!up && inSite) commitSections(sec.site.filter(x => x !== k), [k].concat(sec.global)); // ⤓ с низа «своих» → в начало общих
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
            const others = Array.from(list.children).filter(r => r !== d.row && r !== d.ph && ((r.dataset && r.dataset.hk) || r.classList.contains('mossad-hk-sep')));
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
            // v1.3.63: выше разделителя — «свои» для сайта, ниже — общие; закреплённые — на своих местах в секции
            const sec = hkSections();
            const pin = getHotkeyPinned();
            const before = d.sectionsBefore;
            const siteO = hkOrderKeepPinned(sec.site, before.site.filter(x => sec.site.includes(x)), pin).concat(sec.site.filter(x => !before.site.includes(x)));
            const globO = hkOrderKeepPinned(sec.global, before.global.filter(x => sec.global.includes(x)), pin).concat(sec.global.filter(x => !before.global.includes(x)));
            if (siteO.join('|') !== before.site.join('|') || globO.join('|') !== before.global.join('|')) commitSections(siteO, globO);
        };
        list.addEventListener('pointerdown', (e) => {
            const label = e.target && e.target.closest ? e.target.closest('.mossad-hk-handle') : null;
            if (!label || !list.contains(label) || hkDrag) return;
            if (e.button != null && e.button !== 0) return;
            if (window.capturingFor !== null && window.capturingFor !== undefined) return; // идёт запись клавиши
            e.preventDefault(); // не выделять текст
            const row = label.closest('[data-hk]');
            if (row && row.dataset.pinned) return; // v1.3.47: закреплённую строку не тянут
            hkDrag = { row, label, pointerId: e.pointerId, startY: e.clientY, startScroll: list.scrollTop, active: false, ph: null, orderBefore: hkRows().map(r => r.dataset.hk).join('|'), sectionsBefore: hkSections() };
            try { if (label.setPointerCapture && e.pointerId != null) label.setPointerCapture(e.pointerId); } catch (err) {}
            document.addEventListener('pointermove', onDragMove, true);
            document.addEventListener('pointerup', endDrag, true);
            document.addEventListener('pointercancel', endDrag, true);
        });
        modal._mossadEndDrag = () => endDrag(null);

        document.body.appendChild(modal);
        // v1.3.78: ресайз за края, перетаскивание за шапку, S/A — запомнить геометрию окна.
        // Заданная высота окна → вкладки тянутся на всю высоту и прокручиваются сами
        mossadWinAttach(modal, 'settings', { handle: modal.firstElementChild, onGeom: (m) => {
            if (!m.style.height || m.style.height === 'auto') return;
            m.querySelectorAll('[data-pane]').forEach(p => { p.style.maxHeight = 'none'; p.style.flex = '1 1 auto'; p.style.minHeight = '0'; p.style.overflowY = 'auto'; });
        } });

        // ── Вкладки ──
        const setTab = (t) => {
            const want = SETTINGS_TABS.includes(t) ? t : 'hotkeys';
            modal.dataset.tab = want;
            rememberSettingsTab(want); // v1.3.45
            if (want === 'labels') initLabelsTab(modal); // v1.3.46: строится лениво, при первом открытии вкладки
            // v1.3.73: ошибка ленивой сборки вкладки не должна мешать переключению (раньше «Тудушки» переставали щёлкаться)
            try {
                if (want === 'todos') initTodosTab(modal);   // v1.3.49: тоже лениво (фото читаются только здесь)
                if (want === 'sites') initSitesTab(modal);   // v1.3.50: тоже лениво
                if (want === 'video') mossadLightRenderSettings(modal.querySelector('[data-pane="video"]')); // v1.3.66: лёгкий слой
                if (want === 'quota') initQuotaTab(modal); // v1.3.87: лимит Grok
            } catch (err) { console.warn('[MOSSAD] вкладка ' + want + ':', err); }
            modal.querySelectorAll('[data-pane]').forEach(p => { p.style.display = p.dataset.pane === want ? 'flex' : 'none'; });
            modal.querySelectorAll('#mossad-settings-tabs [data-tab]').forEach(b => {
                const on = b.dataset.tab === want;
                b.style.background = on ? '#1f2937' : 'transparent';
                b.style.color = on ? '#ffffff' : '#9ca3af';
            });
        };
        modal._mossadSetTab = setTab;
        // v1.3.99: Поиск по всем вкладкам и клавишам
        const searchInput = modal.querySelector('#mossad-settings-search');
        const searchClear = modal.querySelector('#mossad-settings-search-clear');
        const otherTabsWrap = modal.querySelector('#mossad-search-other-tabs');
        const otherTabsChips = modal.querySelector('#mossad-search-other-chips');

        const tabNames = {
            general: '⚙️ Общие',
            hotkeys: '⌨️ Хоткеи',
            video: '🎥 Видео',
            quota: '📊 Лимит',
            defaults: '🌐 Дефолты',
            labels: '🏷️ Подписи',
            todos: '📝 Тудушки',
            sites: '🌍 Сайты'
        };

        function applySearchFilter() {
            const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
            if (searchClear) searchClear.style.display = q ? 'block' : 'none';

            // Находим активную вкладку
            let activeTab = 'hotkeys';
            modal.querySelectorAll('#mossad-settings-tabs [data-tab]').forEach(b => {
                if (b.style.background === 'rgb(31, 41, 55)' || b.style.color === 'rgb(255, 255, 255)') activeTab = b.dataset.tab;
            });

            // 1. Фильтруем текущую активную панель
            const activePane = modal.querySelector(`[data-pane="${activeTab}"]`);
            if (activePane) {
                if (activeTab === 'hotkeys') {
                    const rows = activePane.querySelectorAll('[data-hk]');
                    const catHasVisible = {};
                    rows.forEach(r => {
                        const hkKey = r.dataset.hk;
                        const labelText = (keysMap[hkKey] || '').toLowerCase();
                        const keyBinding = (r.querySelector('.mossad-hk-key')?.textContent || '').toLowerCase();
                        const matches = !q || labelText.includes(q) || keyBinding.includes(q) || hkKey.toLowerCase().includes(q);
                        r.style.display = matches ? 'flex' : 'none';
                        const catId = r.dataset.cat;
                        if (catId && matches) catHasVisible[catId] = true;
                    });
                    activePane.querySelectorAll('.mossad-hk-cat-head').forEach(ch => {
                        const cid = ch.dataset.cat;
                        ch.style.display = (!q || catHasVisible[cid]) ? 'flex' : 'none';
                    });
                } else {
                    const directChildren = Array.from(activePane.children);
                    directChildren.forEach(el => {
                        const text = (el.textContent || '').toLowerCase() + ' ' + (el.title || '').toLowerCase();
                        const matches = !q || text.includes(q);
                        el.style.display = matches ? '' : 'none';
                    });
                }
            }

            // 2. Ищем совпадения в других вкладках
            if (!q) {
                if (otherTabsWrap) otherTabsWrap.style.display = 'none';
                return;
            }

            const otherCounts = {};
            if (activeTab !== 'hotkeys') {
                let hkCount = 0;
                Object.keys(keysMap).forEach(k => {
                    const txt = (keysMap[k] + ' ' + k + ' ' + formatHotkey(config.hk[k])).toLowerCase();
                    if (txt.includes(q)) hkCount++;
                });
                if (hkCount > 0) otherCounts['hotkeys'] = hkCount;
            }

            modal.querySelectorAll('[data-pane]').forEach(p => {
                const paneName = p.dataset.pane;
                if (paneName === activeTab || paneName === 'hotkeys') return;
                const fullText = (p.textContent || '').toLowerCase();
                if (fullText.includes(q)) {
                    const count = (fullText.match(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                    if (count > 0) otherCounts[paneName] = count;
                }
            });

            const foundTabs = Object.keys(otherCounts);
            if (foundTabs.length > 0 && otherTabsWrap && otherTabsChips) {
                otherTabsWrap.style.display = 'flex';
                otherTabsChips.innerHTML = foundTabs.map(t => {
                    return `<button type="button" class="mossad-search-chip" data-goto="${t}" style="background:#1f2937;border:1px solid #3b82f6;border-radius:12px;color:#60a5fa;padding:2px 8px;cursor:pointer;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:3px;transition:all 0.2s;">` +
                           `${tabNames[t] || t} (${otherCounts[t]})</button>`;
                }).join('');

                otherTabsChips.querySelectorAll('.mossad-search-chip').forEach(btn => {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        const targetTab = btn.dataset.goto;
                        if (typeof setTab === 'function') {
                            setTab(targetTab);
                            applySearchFilter();
                        }
                    };
                });
            } else if (otherTabsWrap) {
                otherTabsWrap.style.display = 'none';
            }
        }

        if (searchInput) {
            searchInput.oninput = () => applySearchFilter();
        }
        if (searchClear) {
            searchClear.onclick = () => {
                if (searchInput) { searchInput.value = ''; searchInput.focus(); }
                applySearchFilter();
            };
        }

        modal.querySelectorAll('#mossad-settings-tabs [data-tab]').forEach(b => {
            b.onclick = (e) => {
                e.preventDefault();
                setTab(b.dataset.tab);
                applySearchFilter();
            };
        });
        setTab(tab);
        applySearchFilter();
        modal.querySelector('#mossad-settings-x').onclick = () => closeSettingsWindow(true);
        initGlobalDefaultsTab(modal);
        modal.querySelector('#mossad-playlist-rows').onchange = (e) => {
            const v = Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 30));
            e.target.value = String(v);
            Settings.setQuiet('playlistRows', v);
            const pl = document.getElementById('mossad-playlist-panel'); // v1.3.77: открытый список — сразу под новое N
            if (pl && typeof grokApplyPlaylistAutoHeight === 'function') grokApplyPlaylistAutoHeight(pl);
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
        // v1.3.64: Grok — клавиши, которые не кидают в промт
        const genNoKeys = modal.querySelector('#mossad-gen-nokeys');
        if (genNoKeys) {
            genNoKeys.oninput = genNoKeys.onchange = (e) => Settings.setQuiet('grokNoPromptKeys', e.target.value);
            modal.querySelector('#mossad-gen-nokeys-help').onclick = (e) => { e.preventDefault(); e.stopPropagation(); mossadToggleKeyHelp(e.currentTarget, genNoKeys); };
            const cbCollapse = modal.querySelector('#mossad-grok-collapse-prompt');
            if (cbCollapse) cbCollapse.onchange = (e) => Settings.setQuiet('grokCollapsePromptOnNav', e.target.checked);
            const inDwell = modal.querySelector('#mossad-grok-hist-dwell');
            if (inDwell) inDwell.onchange = (e) => Settings.setQuiet('grokHistoryDwellSec', Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 5)));
        }
        // v1.3.72: хоткеи, работающие даже в поле промпта — галочка + список через запятую, «?» — выбор кликами
        const genPHk = modal.querySelector('#mossad-gen-prompthk');
        modal.querySelector('#mossad-gen-prompthk-on').onchange = (e) => Settings.setQuiet('promptHotkeysOn', e.target.checked);
        genPHk.oninput = genPHk.onchange = (e) => Settings.setQuiet('promptHotkeys', e.target.value.split(/[\s,;]+/).filter(Boolean).join(', '));
        // v1.3.83 (issue #1.2 «вручную не вводить»): поле только для чтения, выбор — в «?» (клик — добавить, повторный — убрать)
        const openPHkHelp = (e) => {
            e.preventDefault(); e.stopPropagation();
            const toks = orderedHotkeyKeys(Object.keys(keysMap), getHotkeyOrder()).map(k => [k, `${keysMap[k] || k}${config.hk[k] && config.hk[k].key ? ' · ' + formatHotkey(config.hk[k]) : ''}`]);
            mossadToggleKeyHelp(modal.querySelector('#mossad-gen-prompthk-help'), genPHk, { tokens: toks, title: 'promptHkHelpTitle', note: '', sep: ', ', toggle: true });
        };
        modal.querySelector('#mossad-gen-prompthk-help').onclick = openPHkHelp;
        genPHk.onclick = openPHkHelp;
        // v1.3.53: шаблон имени для этого сайта (то же, что поле в меню)
        const genTpl = modal.querySelector('#mossad-gen-tpl');
        if (genTpl) {
            genTpl.onchange = genTpl.onblur = (e) => mossadSaveSiteTemplate(e.target.value);
            mossadWireTplHelp(genTpl.parentElement);
        }
        const genJunk = modal.querySelector('#mossad-gen-junk'); // v1.3.74
        if (genJunk) genJunk.oninput = genJunk.onchange = (e) => mossadSetJunkText(e.target.value);
        const genDblPos = modal.querySelector('#mossad-gen-dbl-pos');
        if (genDblPos) {
            genDblPos.onchange = (e) => {
                Settings.set('dblPosition', e.target.value);
                const p = document.querySelector('#mossad-sel-dbl-pos');
                if (p) p.value = e.target.value;
            };
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
        // v1.3.82: 🔔 Сигналы — читаем поля, нормализуем, сохраняем (GM, общее для всех сайтов)
        const beepsFromForm = () => {
            const q = (id) => modal.querySelector('#' + id);
            const b = { on: q('mossad-beep-on').checked, volume: q('mossad-beep-volume').value };
            ['dup', 'start'].forEach(k => { b[k] = { on: q(`mossad-beep-${k}-on`).checked, hz: q(`mossad-beep-${k}-hz`).value, count: q(`mossad-beep-${k}-count`).value, ms: q(`mossad-beep-${k}-ms`).value }; });
            return mossadBeepsNormalize(b);
        };
        const beepsSave = () => {
            const n = mossadBeepsWrite(beepsFromForm());
            const q = (id) => modal.querySelector('#' + id);
            q('mossad-beep-volume').value = String(n.volume);
            ['dup', 'start'].forEach(k => { ['hz', 'count', 'ms'].forEach(f => { q(`mossad-beep-${k}-${f}`).value = String(n[k][f]); }); });
        };
        modal.querySelectorAll('#mossad-beeps input').forEach(inp => { inp.addEventListener('change', beepsSave); });
        modal._mossadBeepsSave = beepsSave;
        ['dup', 'start'].forEach(k => {
            modal.querySelector(`#mossad-beep-${k}-test`).onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                mossadBeep(k, { test: true, cfg: beepsFromForm() });
            };
        });
        const cbAutoUpdate = modal.querySelector('#mossad-cb-auto-update');
        if (cbAutoUpdate) {
            cbAutoUpdate.onchange = (e) => {
                Settings.set('autoUpdateCheck', e.target.checked);
                showToast(e.target.checked ? '🔔 Автообновление: проверка включена' : '🔕 Автообновление: автопроверка выключена');
            };
        }
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
            if (typeof modal._mossadBeepsSave === 'function') modal._mossadBeepsSave();     // v1.3.82
            if (typeof modal._mossadQuotaFlush === 'function') modal._mossadQuotaFlush(); // v1.3.87
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
            // v1.3.60: сброс не создаёт дубликатов: клавиша, уже занятая закреплённой (или стоящей выше) строкой, очищается
            const cleared = hotkeyDedupeAfterReset(orderedHotkeyKeys(Object.keys(keysMap), getHotkeyOrder()), getHotkeyPinned());
            if (cleared.length) setTimeout(() => showToast(`⚠️ ${L('hkResetCleared')} ${cleared.map(x => keysMap[x] || x).join(', ')}`, true), 1200);
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
        // v1.3.68: две кнопки — «Применить на всех сайтах» и «Сохранить как умолчание» (= то же + база сброса)
        const pushAll = () => {
            const rep = mossadHkPushAllSites();
            renderHotkeyList();
            if (rep.cleared.length) setTimeout(() => showToast(`⚠️ Совпали с разосланными и очищены: ${rep.cleared.map(x => x.replace(/: (\w+)$/, (m, k) => ': ' + (keysMap[k] || k))).join(', ')}`, true), 1200);
            return rep;
        };
        const pushNote = 'Клавиши этого сайта (общие и «Только для этого сайта») станут такими же на всех сайтах: и общие, и «свои» клавиши других сайтов. Действия, работающие только на другом сайте (например, цикл Grok, полный экран Pinterest), сохранят там свою клавишу.';
        modal.querySelector('#mossad-hk-apply-all').onclick = () => {
            if (!confirm(`Применить на всех сайтах?\n\n${pushNote}\n\nУмолчания, к которым возвращает сброс «Клавиши», не изменятся.`)) return;
            const rep = pushAll();
            showToast(`🌐 Клавиши применены на всех сайтах (своих разделов других сайтов: ${rep.sites})`);
        };
        // v1.3.71: розовая «Для всех {домен}» — все клавиши «только для этого сайта» (общие и умолчания не меняются)
        modal.querySelector('#mossad-hk-apply-domain').onclick = () => {
            if (!confirm(`Для всех ${HK_DOMAIN_SHORT}?\n\nВсе действующие клавиши станут «Только для этого сайта» (${rootDomain}): одинаковые на всех страницах ${rootDomain} во всех контейнерах, правка общих клавиш их не изменит.\n\nОбщие клавиши других сайтов и умолчания не изменятся.`)) return;
            const n = mossadHkAllToSite(orderedHotkeyKeys(Object.keys(keysMap), getHotkeyOrder()));
            renderHotkeyList();
            showToast(`🌸 Клавиши — для всех ${rootDomain} (новых «своих»: ${n})`);
        };
        // v1.3.71: красная «Сохранить как умолчание» — окно выбора; кроме «Для {домен}» нужен пример на сложение
        const saveDefaultsAs = (mode) => {
            const keys = Object.keys(keysMap);
            if (mode === 'domain') {
                if (saveSiteHotkeyDefaults(keys)) showToast(`✅ Умолчания клавиш для ${rootDomain} сохранены`);
                else showToast('❌ GM-хранилище недоступно', true);
                return;
            }
            if (mode === 'common') {
                if (saveHotkeyDefaults(keys, false)) showToast('✅ Общие клавиши сохранены как умолчание');
                else showToast('❌ GM-хранилище недоступно', true);
                return;
            }
            const skip = mode === 'unpinned' ? getHotkeyPinned() : null;
            const rep = mossadHkPushAllSites(skip);
            renderHotkeyList();
            if (rep.cleared.length) setTimeout(() => showToast(`⚠️ Совпали с разосланными и очищены: ${rep.cleared.map(x => x.replace(/: (\w+)$/, (m, k) => ': ' + (keysMap[k] || k))).join(', ')}`, true), 1200);
            if (mode === 'all' && readSiteHotkeyDefaults()) saveSiteHotkeyDefaults(keys); // своя база домена — тоже на новое «всё»
            if (saveHotkeyDefaults(keys, true, mode === 'unpinned')) showToast(mode === 'unpinned' ? '🌐 Не закреплённые: применено на всех сайтах и сохранено как умолчание' : '🌐 Применено на всех сайтах и сохранено как умолчание');
            else showToast('❌ GM-хранилище недоступно', true);
        };
        modal._mossadSaveDefaultsAs = saveDefaultsAs;
        modal.querySelector('#mossad-hk-save-defaults').onclick = () => openHkDefaultsDialog(modal, saveDefaultsAs);
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
