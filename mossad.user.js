// ==UserScript==
// @name         MOSSAD (Media Objects Slideshow and Download)
// @namespace    http://tampermonkey.net/
// @version      1.3.52
// @description  Универсальный скрипт для авто-слайдшоу, скачивания медиа и горячих клавиш.
// @author       Antigravity
// @match        *://*/*
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @connect      pinimg.com
// @connect      *.pinimg.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.3.52';
    console.log(`%c[MOSSAD v${SCRIPT_VERSION}] Скрипт загружен`, 'color:#10b981; font-weight:bold');

    const hostname = location.hostname.toLowerCase();
    
    function getRootDomain(host) {
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }
    const rootDomain = getRootDomain(hostname);
    const STORAGE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_config`;

    // ── v1.3.50: список сайтов MOSSAD ──
    // Встроенные сайты + свои сайты пользователя в GM-ключе `mossad_sites` (общий для всех сайтов и
    // контейнеров). Сравнение по суффиксу: host === d или host оканчивается на '.' + d
    // (раньше было hostname.includes(d) — «grok.com.evil.net» тоже проходил).
    // Старый per-site localStorage `allowedDomains` читается и переносится в GM, но больше не пишется.
    // Добавить/убрать сайт — команда в меню Tampermonkey или вкладка «🌍 Сайты» (Ctrl+F1).
    // На сайте не из списка скрипт регистрирует ТОЛЬКО команду меню: ни DOM, ни слушателей.
    const MOSSAD_BUILTIN_SITES = ['grok.com', 'redgifs.com', 'pinterest.com', 'pinterest.ru', 'civitai.red', 'vkvideo.ru', 'vk.video', 'noodlemagazine.com', 'instagram.com'];
    const MOSSAD_SITES_GM_KEY = 'mossad_sites';

    /** «https://www.Site.com:8080/path» → «site.com»; мусор → ''. */
    function mossadNormSite(s) {
        let d = String(s == null ? '' : s).trim().toLowerCase();
        d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
        d = d.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '').replace(/^www\./, '');
        return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(d) ? d : '';
    }
    function mossadHostMatches(host, site) {
        const d = mossadNormSite(site);
        const h = String(host || '').toLowerCase();
        return !!d && (h === d || h.endsWith('.' + d));
    }
    function mossadReadUserSites() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(MOSSAD_SITES_GM_KEY, null); } catch (e) {}
        let arr = raw;
        try { if (typeof raw === 'string') arr = JSON.parse(raw); } catch (e) { arr = null; }
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const x of arr) { const d = mossadNormSite(x); if (d && !out.includes(d)) out.push(d); }
        return out;
    }
    function mossadWriteUserSites(list) {
        const out = [];
        for (const x of (list || [])) { const d = mossadNormSite(x); if (d && !out.includes(d) && !MOSSAD_BUILTIN_SITES.includes(d)) out.push(d); }
        try { if (typeof GM_setValue === 'function') { GM_setValue(MOSSAD_SITES_GM_KEY, JSON.stringify(out)); return out; } } catch (e) {}
        return null;
    }
    function mossadIsBuiltinHost(host) { return MOSSAD_BUILTIN_SITES.some(d => mossadHostMatches(host, d)); }
    function mossadIsHostAllowed(host) { return mossadIsBuiltinHost(host) || mossadReadUserSites().some(d => mossadHostMatches(host, d)); }
    /** Добавить сайт в общий список. Возвращает нормализованный домен или '' (мусор/нет GM). */
    function mossadAddUserSite(site) {
        const d = mossadNormSite(site);
        if (!d) return '';
        if (MOSSAD_BUILTIN_SITES.includes(d)) return d;
        const list = mossadReadUserSites();
        if (!list.includes(d)) list.push(d);
        return mossadWriteUserSites(list) ? d : '';
    }
    /** Убрать из своего списка все записи, под которые попадает host (или ровно этот домен). */
    function mossadRemoveUserSite(hostOrSite) {
        const h = mossadNormSite(hostOrSite);
        const list = mossadReadUserSites();
        const keep = list.filter(d => d !== h && !mossadHostMatches(h, d));
        if (keep.length === list.length) return 0;
        return mossadWriteUserSites(keep) ? list.length - keep.length : 0;
    }

    // Миграция: свои домены из старого per-site localStorage `allowedDomains` → GM (один раз, при чтении)
    try {
        const _legacyCfg = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (_legacyCfg && Array.isArray(_legacyCfg.allowedDomains) && typeof GM_setValue === 'function') {
            const cur = mossadReadUserSites();
            const add = _legacyCfg.allowedDomains.map(mossadNormSite).filter(d => d && !MOSSAD_BUILTIN_SITES.includes(d) && !cur.includes(d));
            if (add.length) { mossadWriteUserSites(cur.concat(add)); console.log('[MOSSAD] v1.3.50: сайты перенесены в общий список:', add.join(', ')); }
            // Убрать старый ключ сразу, иначе удалённый во «🌍 Сайты» домен вернулся бы при следующей загрузке
            delete _legacyCfg.allowedDomains;
            // (старая кнопка «➕ MOSSAD» писала конфиг только из allowedDomains — пустой удаляем, чтобы сайт жил на 🌐 общих умолчаниях)
            if (Object.keys(_legacyCfg).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(_legacyCfg));
            else localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {}

    const _isAllowed = mossadIsHostAllowed(hostname);

    // Команда меню Tampermonkey: «➕ Добавить этот сайт» / «➖ Убрать этот сайт» (встроенный — только «🌍 Сайты»)
    let _mossadMenuId = null;
    function mossadRegisterSiteMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        try { if (_mossadMenuId !== null && typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(_mossadMenuId); } catch (e) {}
        _mossadMenuId = null;
        const builtin = mossadIsBuiltinHost(hostname);
        const added = !builtin && mossadIsHostAllowed(hostname);
        let title, fn;
        if (builtin) {
            if (!_isAllowed || typeof openSettingsWindow !== 'function') return;
            title = '🌍 Сайты MOSSAD';
            fn = () => { try { openSettingsWindow('sites'); } catch (e) {} };
        } else if (added) {
            title = '➖ Убрать этот сайт из MOSSAD';
            fn = () => {
                mossadRemoveUserSite(hostname);
                mossadRegisterSiteMenu();
                if (confirm(`MOSSAD: ${hostname} убран из списка сайтов.\nПерезагрузить страницу, чтобы выключить скрипт здесь?`)) location.reload();
            };
        } else {
            title = '➕ Добавить этот сайт в MOSSAD';
            fn = () => {
                const d = mossadAddUserSite(hostname);
                if (!d) { alert('MOSSAD: не удалось сохранить (GM-хранилище недоступно)'); return; }
                mossadRegisterSiteMenu();
                if (confirm(`MOSSAD: ${d} добавлен в список сайтов.\nПерезагрузить страницу, чтобы включить скрипт здесь?`)) location.reload();
            };
        }
        try { _mossadMenuId = GM_registerMenuCommand(title, fn); } catch (e) {}
    }
    mossadRegisterSiteMenu();
    if (!_isAllowed) return; // Выход — сайт не в списке (только команда меню, без DOM и слушателей)

    // Список изменили в другой вкладке/контейнере — обновить подпись команды меню и вкладку «🌍 Сайты»
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(MOSSAD_SITES_GM_KEY, (name, oldVal, newVal, remote) => {
                if (!remote) return;
                mossadRegisterSiteMenu();
                try { mossadSitesRerender(); } catch (e) {}
            });
        } catch (e) {}
    }

// ============================================
    // СИСТЕМА НАСТРОЕК
    // ============================================
    const DEFAULT_CONFIG = {
        slideshowMode: 'auto',
        slideshowOrientation: 'h',
        slideshowLoopMode: 'off',
        loopFeed: false,              // R в D-pad: повторять текущий плейлист (перемотка в начало при конце ленты)
        slideshowDirections: ['up'],  // листание вверх по умолчанию
        // v1.3.36: значения по умолчанию — по эталонной панели владельца (только для доменов без сохранённых настроек)
        videoLoops: 1,                // Видео (↺): 1 круг
        slideshowDelay: 1,            // Фото: 1 сек
        delayAfterVideo: 1,           // Пауза: 1 сек
        downloadType: 'none',         // не скачивать
        pdAction: 'none',             // После DL: —
        stopOnTabSwitch: false,       // Tab — выключена
        stopOnBrsrSwitch: false,      // Brsr — выключена
        deleteAutoconfirm: true,      // hold post включён (один чекбокс управляет обоими флагами, ANTI_PATTERNS §2)
        deleteHoldpost: true,
        allowDuplicates: false,       // Дубли: качать дубликаты сразу без подтверждения
        // v1.3.50: allowedDomains убран — список сайтов в GM `mossad_sites` (domain.js, вкладка «🌍 Сайты»)
        githubToken: '',
        githubConfigPath: 'mossad-config.json',
        filenameTemplate: '{id8}-{domain[4]}~{RadugaStud}',  // шаблон имени файла по умолчанию (для всех сайтов)
        filenameTemplateEnabled: true,   // использовать шаблон?
        playlistRows: 30,                // v1.3.40: видимых строк списка при открытии / по ⤢
        playlistWidth: 0,                // ширина списка плейлиста в px (0 = авто под ширину меню)
        widgetZoom: 0.9,                 // масштаб виджета (0.9 = 90%)
        closePanelOnOutsideClick: true,  // v1.3.37: сворачивать панель настроек виджета кликом вне MOSSAD
        collectWatchSec: 30,            // v1.3.39: окно досбора ссылок после клика «Собрать» (сек)
        showSoundToast: true,           // v1.3.39: показывать тост «Звук вкл/выкл» (~5 с, × закрывает только текущий)
        debugSlideshow: false,          // v1.3.38: debug-лог источников шагов слайдшоу и шагов удаления (консоль)
        
        // PINTEREST ENGINE CONFIGS
        pinterestMode: 'rand',             // 'rand' | '+1' | '1'..'30' (№ N — N-й похожий пин)
        pinterestDir: 'fwd',               // v1.3.51: малое слайдшоу на Pinterest: 'fwd' — новые пины, 'back' — назад по истории
        pinterestFilterType: 'ratio',      // 'all' | 'ratio' | 'image' | 'video'
        pinterestPhotoPercent: 50,         // 0..100 % (видео = 100 - photo)
        pinterestMaxVideoDuration: 0,      // макс длительность видео в сек (0 = без лимита)
        pinterestAutoFS: false,            // авто разворачивание во весь экран (FS выкл.)
        autoFS: false,                     // универсальный авто Full Screen (FS выкл.)
        pinterestHistory: [],              // история до 100 посещенных URL
        pinterestHistoryIdx: -1,           // текущий индекс в истории (как в Проводнике)
        
        hk: {
            download:         { key: 'PageDown',   ctrl: false, alt: false, shift: false }, // PageDown — скачать
            upscale:          { key: '+',          ctrl: false, alt: false, shift: true },  // v1.3.39: Shift+«+» (осн. ряд и Num+); Ctrl+PageUp/PageDown в Grok переключают беседы.
                                                                                         // Без поля code: mergeDeep подмешал бы его в старые сохранённые хоткеи.
            deleteVid:        { key: 'Delete',     ctrl: false, alt: false, shift: false },
            sound:            { key: 'ScrollLock', ctrl: false, alt: false, shift: false },
            playPause:        { key: 'Pause',      ctrl: false, alt: false, shift: false },
            help:             { key: 'F1',         ctrl: true,  alt: false, shift: false },
            history:          { key: 'Home',       ctrl: false, alt: false, shift: false },
            slideshowPanel:   { key: 'Insert',     ctrl: true,  alt: false, shift: false }, // Ctrl+Insert — меню
            slideshowStart:   { key: 'Insert',     ctrl: false, alt: false, shift: true },  // Shift+Insert — малое слайдшоу (ракета)
            galleryPlayPause: { key: 'Insert',     ctrl: false, alt: false, shift: false }, // Insert — большое слайдшоу (плейлист)
            galleryStop:      { key: '',           ctrl: false, alt: false, shift: false }, // Пусто — стоп большого слайдшоу
            focusWidget:      { key: 'F7',         ctrl: false, alt: false, shift: false },
            snapWidget:       { key: 'F8',         ctrl: false, alt: false, shift: false }, // F8 — привязать к левому верхнему краю
            openTodos:        { key: '',           ctrl: false, alt: false, shift: false }, // v1.3.49: «📝 Тудушки» — пусто по умолчанию
            nextSlide:        { key: 'ArrowRight', ctrl: false, alt: false, shift: false }, // v1.3.45: одна привязка (резервный Пробел убран)
            prevSlide:        { key: 'ArrowLeft',  ctrl: false, alt: false, shift: false },
            nextGroup:        { key: 'PageDown',   ctrl: false, alt: true,  shift: false }, // Alt+PageDown
            prevGroup:        { key: 'PageUp',     ctrl: false, alt: true,  shift: false }, // Alt+PageUp
            duplicateNext:    { key: ' ',          ctrl: true,  alt: false, shift: false }, // Ctrl+Пробел — открыть в фоне + сдвинуть
            rewind:           { key: 'r',          ctrl: false, alt: true,  shift: false }, // Alt+R — перемотка
        }
    };

    let config = {};
    let siteHasSavedConfig = false; // v1.3.41: есть ли у этого сайта свои сохранённые настройки
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        siteHasSavedConfig = !!stored;
        config = stored ? JSON.parse(stored) : {};
    } catch (e) {}

    // ── v1.3.41: общие «умолчания» для всех сайтов (GM-хранилище Tampermonkey) ──
    // Применяются ТОЛЬКО к сайту без сохранённого конфига (вместо заводских DEFAULT_CONFIG).
    // Сохранённые настройки сайтов не трогаются. Заводские значения — запасной вариант.
    const GLOBAL_DEFAULTS_GM_KEY = 'mossad_global_defaults';
    const GLOBAL_DEFAULT_KEYS = [
        'slideshowDelay', 'videoLoops', 'delayAfterVideo', 'slideshowDirections', 'loopFeed',
        'downloadType', 'pdAction', 'filenameTemplate', 'filenameTemplateEnabled',
        'stopOnTabSwitch', 'stopOnBrsrSwitch', 'deleteAutoconfirm', 'deleteHoldpost', 'allowDuplicates',
        'autoFS', 'widgetZoom', 'closePanelOnOutsideClick', 'showSoundToast',
        'playlistRows', 'playlistWidth', 'collectWatchSec',
        'pinterestMode', 'pinterestFilterType', 'pinterestPhotoPercent', 'pinterestMaxVideoDuration', 'pinterestAutoFS',
    ];
    const GlobalDefaults = {
        KEY: GLOBAL_DEFAULTS_GM_KEY,
        keys: GLOBAL_DEFAULT_KEYS,
        /** Только известные ключи и только значения того же типа, что у заводских (мусор отбрасывается). */
        sanitize(src) {
            const out = {};
            if (!src || typeof src !== 'object') return out;
            for (const k of GLOBAL_DEFAULT_KEYS) {
                if (!(k in src)) continue;
                const f = DEFAULT_CONFIG[k], v = src[k];
                if (Array.isArray(f)) { if (Array.isArray(v)) out[k] = v.filter(x => typeof x === 'string'); }
                else if (typeof f === 'number') { const n = Number(v); if (isFinite(n)) out[k] = n; }
                else if (typeof v === typeof f) out[k] = v;
            }
            return out;
        },
        read() {
            if (typeof GM_getValue !== 'function') return null;
            try {
                const raw = GM_getValue(GLOBAL_DEFAULTS_GM_KEY, '');
                if (!raw) return null;
                const o = GlobalDefaults.sanitize(typeof raw === 'string' ? JSON.parse(raw) : raw);
                return Object.keys(o).length ? o : null;
            } catch (e) { return null; }
        },
        write(obj) {
            if (typeof GM_setValue !== 'function') return false;
            GM_setValue(GLOBAL_DEFAULTS_GM_KEY, JSON.stringify(GlobalDefaults.sanitize(obj)));
            return true;
        },
        clear() { if (typeof GM_setValue === 'function') GM_setValue(GLOBAL_DEFAULTS_GM_KEY, ''); },
        /** Заводские значения (копия). */
        factory() { return GlobalDefaults.sanitize(JSON.parse(JSON.stringify(DEFAULT_CONFIG))); },
        /** Действующие умолчания: сохранённые поверх заводских. */
        effective() { return Object.assign(GlobalDefaults.factory(), GlobalDefaults.read() || {}); },
        /** Срез текущего конфига сайта. */
        fromConfig(cfg) { return GlobalDefaults.sanitize(JSON.parse(JSON.stringify(cfg || {}))); },
        // ── «Применить во всех контейнерах» ──
        // localStorage у каждого контейнера Firefox (и у каждого сайта) свой, GM-хранилище — общее.
        // Кнопка пишет в GM «штамп» { id, ts, keys }; каждый контейнер при загрузке (и живьём через
        // GM_addValueChangeListener) сравнивает его со своим последним применённым (localStorage) и
        // перезаписывает ТОЛЬКО перечисленные ключи значениями общих умолчаний, затем запоминает штамп.
        APPLY_KEY: 'mossad_global_defaults_apply',
        SEEN_LS_KEY: 'mossad_global_defaults_apply_seen',
        readStamp() {
            if (typeof GM_getValue !== 'function') return null;
            try {
                const raw = GM_getValue('mossad_global_defaults_apply', '');
                const st = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
                return (st && st.id && Array.isArray(st.keys)) ? st : null;
            } catch (e) { return null; }
        },
        writeStamp(keys) {
            if (typeof GM_setValue !== 'function') return null;
            const st = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, ts: Date.now(), keys: keys.filter(k => GLOBAL_DEFAULT_KEYS.includes(k)) };
            GM_setValue('mossad_global_defaults_apply', JSON.stringify(st));
            return st;
        },
        /** Применяет штамп к конфигу этого сайта/контейнера, если он ещё не применён. Возвращает список применённых ключей или null. */
        applyStampIfNew(stamp) {
            const st = stamp || GlobalDefaults.readStamp();
            if (!st) return null;
            let seen = '';
            try { seen = localStorage.getItem('mossad_global_defaults_apply_seen') || ''; } catch (e) {}
            if (seen === st.id) return null;
            const vals = GlobalDefaults.effective();
            const applied = [];
            for (const k of st.keys) {
                if (!(k in vals)) continue;
                config[k] = JSON.parse(JSON.stringify(vals[k]));
                applied.push(k);
            }
            try {
                // Сайт без своего конфига не «сохраняем» насильно: он и так живёт на общих умолчаниях
                // (иначе он перестал бы получать их дальнейшие изменения).
                if (applied.length && GlobalDefaults.siteHasSavedConfig()) persistLocalConfig();
                localStorage.setItem('mossad_global_defaults_apply_seen', st.id);
            } catch (e) {}
            if (applied.length) console.log('[MOSSAD] Общие умолчания применены (штамп ' + st.id + '):', applied.join(', '));
            return applied;
        },
        loadedWithGlobalDefaults: () => !siteHasSavedConfig && !!GlobalDefaults.read(),
        siteHasSavedConfig: () => { try { return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return siteHasSavedConfig; } },
    };

    function mergeDeep(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], mergeDeep(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }
    {
        const base = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        if (!siteHasSavedConfig) {
            const gd = GlobalDefaults.read();
            if (gd) Object.assign(base, JSON.parse(JSON.stringify(gd)));
        }
        config = mergeDeep(base, config);
    }

    // v1.3.51: Pinterest — мусорный режим/направление → по умолчанию (режим из старой панели мог быть любым текстом)
    if (!(config.pinterestMode === 'rand' || config.pinterestMode === '+1' || /^\d+$/.test(String(config.pinterestMode)))) config.pinterestMode = 'rand';
    if (/^\d+$/.test(String(config.pinterestMode))) config.pinterestMode = String(Math.min(30, Math.max(1, parseInt(config.pinterestMode, 10))));
    if (config.pinterestDir !== 'back') config.pinterestDir = 'fwd';

    // ── GitHub-токен: хранится в общем хранилище Tampermonkey (GM_setValue), а НЕ в localStorage сайта ──
    // v1.3.34: раньше токен лежал в localStorage каждого сайта (`mossad_{domain}_config`) и был
    // доступен любым скриптам страницы. Теперь: один глобальный ключ GM, в localStorage не пишется.
    // В памяти (`config.githubToken`) токен остаётся — sync.js и панель работают как раньше.
    const GITHUB_TOKEN_GM_KEY = 'mossad_github_token';
    const _hasGmStore = (typeof GM_getValue === 'function' && typeof GM_setValue === 'function');

    /** JSON конфига для localStorage — без githubToken (если доступно GM-хранилище). */
    function serializeLocalConfig() {
        const copy = Object.assign({}, config);
        delete copy.allowedDomains; // v1.3.50: старый per-site список сайтов больше не пишется (перенесён в GM)
        if (!_hasGmStore) return JSON.stringify(copy);
        delete copy.githubToken;
        return JSON.stringify(copy);
    }
    function persistLocalConfig() {
        localStorage.setItem(STORAGE_KEY, serializeLocalConfig());
    }
    /**
     * v1.3.45: одна привязка на действие. Старый формат — массив слотов [основная, резерв] (или объект
     * после mergeDeep с числовыми ключами '0'/'1'). Берём основную; если она пустая, а резерв задан —
     * резерв становится основной. Возвращает чистый объект {key, code?, ctrl, alt, shift, meta?}.
     */
    function normalizeHotkeyBinding(v) {
        const clean = (h) => {
            const o = { key: (h && typeof h.key === 'string') ? h.key : '', ctrl: !!(h && h.ctrl), alt: !!(h && h.alt), shift: !!(h && h.shift) };
            if (h && h.meta) o.meta = true;
            if (h && typeof h.code === 'string' && h.code) o.code = h.code;
            return o;
        };
        if (!v || typeof v !== 'object') return clean(null);
        const isSlots = Array.isArray(v) || Object.prototype.hasOwnProperty.call(v, '0') || Object.prototype.hasOwnProperty.call(v, '1');
        if (!isSlots) return clean(v);
        const slots = [v[0], v[1]];
        const pick = slots.find(h => h && typeof h === 'object' && h.key);
        return clean(pick || null);
    }
    function isHotkeyBindingClean(v) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
        return JSON.stringify(v) === JSON.stringify(normalizeHotkeyBinding(v));
    }
    /** Нормализует все config.hk; true — если что-то изменилось (нужно сохранить). */
    function normalizeAllHotkeys() {
        if (!config.hk || typeof config.hk !== 'object') return false;
        let changed = false;
        for (const k of Object.keys(config.hk)) {
            if (!isHotkeyBindingClean(config.hk[k])) {
                config.hk[k] = normalizeHotkeyBinding(config.hk[k]);
                changed = true;
            }
        }
        return changed;
    }
    /** Сохранить токен (из панели настроек): в память + GM. */
    function setGithubToken(token) {
        config.githubToken = (token || '').trim();
        if (_hasGmStore) {
            try { GM_setValue(GITHUB_TOKEN_GM_KEY, config.githubToken); } catch(e) {}
        }
    }
    // Одноразовая миграция: старый токен из localStorage → GM, затем удаляем его из localStorage.
    // Правим именно «сырой» JSON localStorage (а не весь смерженный config), чтобы не изменить
    // проверки «что сохранено пользователем» ниже (RedGifs / Grok шаблоны и направления).
    if (_hasGmStore) {
        try {
            const legacyToken = config.githubToken || '';
            const gmToken = GM_getValue(GITHUB_TOKEN_GM_KEY, '') || '';
            if (legacyToken && !gmToken) GM_setValue(GITHUB_TOKEN_GM_KEY, legacyToken);
            config.githubToken = gmToken || legacyToken;
            const rawCfg = localStorage.getItem(STORAGE_KEY);
            if (rawCfg) {
                const parsedCfg = JSON.parse(rawCfg);
                if (parsedCfg && Object.prototype.hasOwnProperty.call(parsedCfg, 'githubToken')) {
                    delete parsedCfg.githubToken;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedCfg));
                }
            }
        } catch(e) {
            console.warn('[MOSSAD] githubToken migration failed:', e);
        }
    }
    // Для RedGifs дефолтное направление сайта — down.
    // v1.3.36: сайтовый шаблон {userName}-{domain[4]} больше не подставляется — для новых доменов
    // действует общий шаблон из DEFAULT_CONFIG (эталон владельца); сохранённый пользователем шаблон не трогаем.
    if (rootDomain.includes('redgifs.com')) {
        let storedHasDir = false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.slideshowDirections) storedHasDir = true;
            }
        } catch(e) {}
        if (!storedHasDir || (config.slideshowDirections && config.slideshowDirections[0] === 'up')) {
            config.slideshowDirections = ['down'];
        }
    }

    // Grok: миграция старого сохранённого шаблона {id8}-{domain}.{ext} → {conv4}-{id4}-{domain}.{ext} (как раньше).
    // v1.3.36: для новых установок сайтовый шаблон больше не подставляется — действует общий
    // шаблон из DEFAULT_CONFIG (эталон владельца).
    if (rootDomain === 'grok.com') {
        if (config.filenameTemplate === '{id8}-{domain}.{ext}') {
            config.filenameTemplate = '{conv4}-{id4}-{domain}.{ext}';
        }
    }

    // Миграция v1.3.23: download -> PageDown, nextSlide -> ArrowRight, prevSlide -> ArrowLeft
    const isOldDlShiftPd = (h) => h && h.key === 'PageDown' && h.shift && !h.ctrl && !h.alt;
    const isOldNextPd = (h) => h && h.key === 'PageDown' && !h.shift && !h.ctrl && !h.alt;
    const isOldPrevPu = (h) => h && h.key === 'PageUp' && !h.shift && !h.ctrl && !h.alt;

    if (Array.isArray(config.hk.download)) {
        if (config.hk.download.some(isOldDlShiftPd)) {
            config.hk.download = config.hk.download.map(h => isOldDlShiftPd(h) ? { key: 'PageDown', ctrl: false, alt: false, shift: false } : h);
        }
    } else if (!config.hk.download || isOldDlShiftPd(config.hk.download)) {
        config.hk.download = { key: 'PageDown', ctrl: false, alt: false, shift: false };
    }

    // Миграция: переносим upscale с PageUp на Ctrl+PageUp во избежание конфликта
    if (config.hk.upscale && config.hk.upscale.key === 'PageUp' && !config.hk.upscale.ctrl && !config.hk.upscale.alt && !config.hk.upscale.shift) {
        config.hk.upscale = { key: 'PageUp', ctrl: true, alt: false, shift: false };
    }

    if (Array.isArray(config.hk.nextSlide)) {
        if (config.hk.nextSlide.some(isOldNextPd)) {
            config.hk.nextSlide = config.hk.nextSlide.map(h => isOldNextPd(h) ? { key: 'ArrowRight', ctrl: false, alt: false, shift: false } : h);
        }
    } else if (!config.hk.nextSlide || isOldNextPd(config.hk.nextSlide)) {
        config.hk.nextSlide = { key: 'ArrowRight', ctrl: false, alt: false, shift: false };
    }

    if (!config.hk.prevSlide || isOldPrevPu(config.hk.prevSlide)) {
        config.hk.prevSlide = { key: 'ArrowLeft', ctrl: false, alt: false, shift: false };
    }

    // Миграция v1.3.14: инициализация nextGroup (Alt+PageDown) и prevGroup (Alt+PageUp)
    if (!config.hk.nextGroup) {
        config.hk.nextGroup = { key: 'PageDown', ctrl: false, alt: true, shift: false };
    }
    if (!config.hk.prevGroup) {
        config.hk.prevGroup = { key: 'PageUp', ctrl: false, alt: true, shift: false };
    }

    // Миграция v1.3.13: разделение малого (Shift+Insert) и большого слайдшоу (Insert)
    if (!config.hk.galleryPlayPause) {
        config.hk.galleryPlayPause = { key: 'Insert', ctrl: false, alt: false, shift: false };
    }
    if (!config.hk.galleryStop) {
        config.hk.galleryStop = { key: '', ctrl: false, alt: false, shift: false };
    }
    if (config.hk.slideshowStart && config.hk.slideshowStart.key === 'Insert' && !config.hk.slideshowStart.ctrl && !config.hk.slideshowStart.alt && !config.hk.slideshowStart.shift) {
        config.hk.slideshowStart = { key: 'Insert', ctrl: false, alt: false, shift: true };
    }


    // Миграция v1.3.24: history (Home) и slideshowPanel (Ctrl+Insert)
    if (!config.hk.history) {
        config.hk.history = { key: 'Home', ctrl: false, alt: false, shift: false };
    }
    if (!config.hk.slideshowPanel) {
        config.hk.slideshowPanel = { key: 'Insert', ctrl: true, alt: false, shift: false };
    }

    // Глобальная синхронизация хоткеев через GM_getValue (общие для всех сайтов)
    if (typeof GM_getValue === 'function') {
        try {
            const gmHk = GM_getValue('mossad_hk_global', null);
            if (gmHk) {
                const parsedHk = JSON.parse(gmHk);
                if (parsedHk && typeof parsedHk === 'object') {
                    config.hk = mergeDeep(config.hk, parsedHk);
                }
            }
        } catch (e) {}
    }
    // v1.3.40: генерация видео 6s / 10s удалена — чистим старые хоткеи (локальные и глобальные, после слияния)
    delete config.hk.videoGen6s;
    delete config.hk.videoGen10s;

    migrateUpscaleDefaultHotkey();

    // v1.3.45: одна привязка на действие — свёртка старых слотов [основная, резерв] в объект
    if (normalizeAllHotkeys()) {
        try { persistLocalConfig(); } catch (e) {}
        if (typeof GM_setValue === 'function') { try { GM_setValue('mossad_hk_global', JSON.stringify(config.hk)); } catch (e) {} }
    }

    // v1.3.41: «Применить во всех контейнерах» — штамп из GM, если этот контейнер его ещё не применял
    try { GlobalDefaults.applyStampIfNew(); } catch (e) {}
    // …и живьём для уже открытых вкладок (Tampermonkey: GM_addValueChangeListener)
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(GLOBAL_DEFAULTS_GM_KEY, () => {
                // Сайт без своих настроек сразу переходит на новые общие умолчания
                if (GlobalDefaults.siteHasSavedConfig()) return;
                const gd = GlobalDefaults.effective();
                for (const k of Object.keys(gd)) config[k] = JSON.parse(JSON.stringify(gd[k]));
                if (window.updateWidgetUI) window.updateWidgetUI();
            });
            GM_addValueChangeListener('mossad_global_defaults_apply', (name, oldVal, newVal) => {
                let st = null;
                try { st = newVal ? (typeof newVal === 'string' ? JSON.parse(newVal) : newVal) : null; } catch (e) {}
                if (!st || !st.id || !Array.isArray(st.keys)) return;
                const applied = GlobalDefaults.applyStampIfNew(st);
                if (applied && applied.length) {
                    if (window.updateWidgetUI) window.updateWidgetUI();
                    if (typeof showToast === 'function') showToast(`🌐 Общие умолчания применены (${applied.length})`);
                }
            });
        } catch (e) {}
    }

    // Глобальная синхронизация шаблона имени файла через GM_getValue
    if (typeof GM_getValue === 'function') {
        const gmTpl = GM_getValue('mossad_tpl_' + rootDomain, null);
        if (gmTpl && typeof gmTpl === 'string') {
            config.filenameTemplate = gmTpl;
        }
    }

    /**
     * v1.3.39: старый дефолт «Улучшить» Ctrl+PageUp → Shift+«+» (Ctrl+PageUp/PageDown в Grok переключают
     * беседы). Мигрируем ОДИН раз и только если у пользователя по-прежнему нетронутый старый дефолт
     * (объект или слот-массив [Ctrl+PageUp, пусто]). Флаг в GM — общий для всех сайтов.
     */
    function migrateUpscaleDefaultHotkey() {
        const FLAG = 'mossad_mig_upscale_v1339';
        const hasGm = (typeof GM_getValue === 'function' && typeof GM_setValue === 'function');
        try { if (hasGm && GM_getValue(FLAG, false)) return false; } catch(e) {}
        const isOldDefault = (h) => !!h && h.key === 'PageUp' && !!h.ctrl && !h.alt && !h.shift && !h.meta;
        const cur = config.hk && config.hk.upscale;
        let untouched = false;
        if (Array.isArray(cur)) {
            const filled = cur.filter(h => h && h.key);
            untouched = filled.length === 1 && isOldDefault(filled[0]);
        } else {
            untouched = isOldDefault(cur);
        }
        if (untouched) {
            config.hk.upscale = JSON.parse(JSON.stringify(DEFAULT_CONFIG.hk.upscale));
            try { persistLocalConfig(); } catch(e) {}
            if (hasGm) { try { GM_setValue('mossad_hk_global', JSON.stringify(config.hk)); } catch(e) {} }
            console.log('[MOSSAD] Миграция v1.3.39: хоткей «Улучшить» Ctrl+PageUp → Shift+«+»');
        }
        if (hasGm) { try { GM_setValue(FLAG, true); } catch(e) {} }
        return untouched;
    }

    const Settings = {
        get: () => config,
        save: () => {
            persistLocalConfig();
            if (typeof GM_setValue === 'function' && config.hk) {
                try {
                    GM_setValue('mossad_hk_global', JSON.stringify(config.hk));
                } catch(e) {}
            }
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleSyncPush(); // Запускаем батч-синхронизацию
        },
        // Сохранить без ре-рендера UI (для текстовых полей — не сбивает фокус)
        saveQuiet: () => {
            persistLocalConfig();
            if (typeof GM_setValue === 'function' && config.hk) {
                try {
                    GM_setValue('mossad_hk_global', JSON.stringify(config.hk));
                } catch(e) {}
            }
            scheduleSyncPush();
        },
        setQuiet: (key, val) => {
            config[key] = val;
            Settings.saveQuiet();
        },
        set: (key, val) => {
            config[key] = val;
            Settings.save();
        },
    };

    // Функция быстрого глобального сохранения хоткеев для всех сайтов
    window.saveGlobalHotkeys = function(showToastNotice = true) {
        try {
            persistLocalConfig();
            if (typeof GM_setValue === 'function' && config.hk) {
                GM_setValue('mossad_hk_global', JSON.stringify(config.hk));
            }
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleSyncPush();
            if (showToastNotice) {
                showToast('✅ Хоткеи сохранены для всех сайтов');
            }
        } catch(e) {
            console.error('[MOSSAD] saveGlobalHotkeys failed:', e);
        }
    };

    // Синхронизация глобальных хоткеев при фокусе вкладки (подхват изменений с других сайтов)
    window.addEventListener('focus', () => {
        if (typeof GM_getValue === 'function' && window.capturingFor === null) {
            try {
                const gmHk = GM_getValue('mossad_hk_global', null);
                if (gmHk) {
                    const parsed = JSON.parse(gmHk);
                    if (parsed && typeof parsed === 'object') {
                        config.hk = mergeDeep(config.hk, parsed);
                        normalizeAllHotkeys();
                        persistLocalConfig();
                    }
                }
                // Подхватываем токен, сохранённый на другом сайте
                config.githubToken = GM_getValue(GITHUB_TOKEN_GM_KEY, '') || '';
            } catch(e) {}
        }
    });

// ============================================
    // GITHUB SYNC
    // ============================================
    const GITHUB_OWNER = 'eldmans';
    const GITHUB_REPO = 'tm-scripts';
    const GITHUB_BRANCH = 'grok';

    let _syncQueue = []; // батч изменений
    let _syncTimer = null;
    let _syncStatusEl = null;

    function getSyncStatusEl() {
        if (!_syncStatusEl || !document.body.contains(_syncStatusEl)) {
            _syncStatusEl = document.createElement('div');
            _syncStatusEl.id = 'mossad-sync-status';
            _syncStatusEl.style.cssText = `position:fixed;bottom:8px;right:8px;z-index:9999998;font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(15,15,15,0.85);backdrop-filter:blur(6px);border:1px solid #374151;color:#9ca3af;font-family:system-ui;pointer-events:none;transition:opacity 0.3s;opacity:0;`;
            document.body.appendChild(_syncStatusEl);
        }
        return _syncStatusEl;
    }

    function showSyncStatus(text, color = '#9ca3af', autoHide = false) {
        const el = getSyncStatusEl();
        el.textContent = text;
        el.style.color = color;
        el.style.opacity = '1';
        if (autoHide) setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    async function pushConfigToGitHub() {
        if (!config.githubToken) return;
        const token = config.githubToken;
        const path = config.githubConfigPath || 'mossad-config.json';
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        
        // Получаем текущий SHA файла
        let sha = null;
        try {
            const res = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                    onload: resolve,
                    onerror: reject
                });
            });
            if (res.status === 200) {
                const data = JSON.parse(res.responseText);
                sha = data.sha;
            }
        } catch (e) {}
        
        // Экспортируем конфиг без токена
        const exportCfg = JSON.parse(JSON.stringify(config));
        delete exportCfg.githubToken;
        delete exportCfg.allowedDomains; // v1.3.50: список сайтов живёт в GM `mossad_sites`
        delete exportCfg.pinterestHistory;    // v1.3.51: история пинов — локальная, не синхронизируется
        delete exportCfg.pinterestHistoryIdx;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportCfg, null, 2))));
        
        const body = JSON.stringify({
            message: `mossad: sync config from ${hostname}`,
            content,
            branch: GITHUB_BRANCH,
            ...(sha ? { sha } : {})
        });
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'PUT',
                url: apiUrl,
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
                data: body,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve();
                    else reject(new Error(`HTTP ${res.status}: ${res.responseText}`));
                },
                onerror: reject
            });
        });
    }

    async function pullConfigFromGitHub() {
        if (!config.githubToken) return;
        const token = config.githubToken;
        const path = config.githubConfigPath || 'mossad-config.json';
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?t=${Date.now()}`;
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                onload: (res) => {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            const decoded = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
                            // Применяем конфиг, сохраняя локальный токен
                            const token = config.githubToken;
                            // v1.3.51: локальную историю пинов не затираем (файл общий для всех сайтов)
                            if (decoded && typeof decoded === 'object') { delete decoded.pinterestHistory; delete decoded.pinterestHistoryIdx; }
                            Object.assign(config, decoded);
                            config.githubToken = token;
                            try { normalizeAllHotkeys(); } catch (e) {} // v1.3.45: одна привязка на действие
                            persistLocalConfig();
                            if (window.updateWidgetUI) window.updateWidgetUI();
                            resolve(true);
                        } catch (e) { reject(e); }
                    } else {
                        reject(new Error(`HTTP ${res.status}`));
                    }
                },
                onerror: reject
            });
        });
    }

    // Отложенный батч-пуш
    function scheduleSyncPush() {
        if (!config.githubToken) return;
        if (_syncTimer) clearTimeout(_syncTimer);
        showSyncStatus('🔄 Синхронизация...', '#f59e0b');
        
        _syncTimer = setTimeout(async () => {
            try {
                await pushConfigToGitHub();
                showSyncStatus('✅ Синхронизировано', '#10b981', true);
            } catch (e) {
                showSyncStatus('⚠️ Ошибка синхронизации', '#ef4444');
                console.error('[MOSSAD Sync] Push failed:', e);
            }
        }, 2000); // Батчим: ждём 2 секунды после последнего изменения
    }

    // Проверка при старте
    async function checkAndPullOnStartup() {
        if (!config.githubToken) return;
        try {
            const pulled = await pullConfigFromGitHub();
            if (pulled) showSyncStatus('✅ Конфиг обновлён', '#10b981', true);
        } catch (e) {
            // Тихо — возможно нет файла ещё
        }
    }

    window.addEventListener('storage', (ev) => {
        if (ev.key !== STORAGE_KEY || window.capturingFor !== null) return;
        try { 
            const nc = JSON.parse(ev.newValue); 
            if (nc) {
                Object.assign(config, nc);
                if (window.updateWidgetUI) window.updateWidgetUI();
            } 
        } catch {}
    });

    function formatHotkey(hk) {
        if (!hk || !hk.key) return '—';
        const parts = [];
        if (hk.ctrl)  parts.push('Ctrl');
        if (hk.alt)   parts.push('Alt');
        if (hk.shift) parts.push('Shift');
        parts.push(hk.key === '+' ? '«+»' : hk.key);
        return parts.join('+');
    }
    // ── v1.3.43: физическая клавиша (KeyboardEvent.code) для символа — раскладко-независимые хоткеи ──
    // Строки: code, символ US без Shift, с Shift, символ русской раскладки (ЙЦУКЕН) без Shift / с Shift.
    // Раньше (v1.3.37) по e.code сверялись только латинские буквы и цифры, а (v1.3.39) — хоткеи,
    // записанные с полем code. Знаки («/», «.», «;», «[» …) и хоткеи, записанные в русской
    // раскладке до v1.3.39 (key: 'и' без code), в другой раскладке не срабатывали. ANTI_PATTERNS §22.
    const MOSSAD_KEY_LAYOUT = (() => {
        const rows = [
            ['Backquote', '`', '~', 'ё', 'Ё'], ['Minus', '-', '_'], ['Equal', '=', '+'],
            ['BracketLeft', '[', '{', 'х', 'Х'], ['BracketRight', ']', '}', 'ъ', 'Ъ'], ['Backslash', '\\', '|'],
            ['Semicolon', ';', ':', 'ж', 'Ж'], ['Quote', "'", '"', 'э', 'Э'],
            ['Comma', ',', '<', 'б', 'Б'], ['Period', '.', '>', 'ю', 'Ю'], ['Slash', '/', '?'],
            ['Digit1', '1', '!'], ['Digit2', '2', '@'], ['Digit3', '3', '#'], ['Digit4', '4', '$'], ['Digit5', '5', '%'],
            ['Digit6', '6', '^'], ['Digit7', '7', '&'], ['Digit8', '8', '*'], ['Digit9', '9', '('], ['Digit0', '0', ')'],
            ['Space', ' ', ' ']
        ];
        const ru = 'йцукенгшщзфывапролдячсмитьбю';
        const us = 'qwertyuiopasdfghjklzxcvbnm';
        for (let i = 0; i < us.length; i++) rows.push(['Key' + us[i].toUpperCase(), us[i], us[i].toUpperCase(), ru[i], ru[i].toUpperCase()]);
        const charToCode = new Map();
        const codeToUs = new Map();
        const codeToUsShift = new Map();
        // Сначала US (без Shift / с Shift), затем русские буквы — «.» и «,» остаются за US-клавишами
        rows.forEach(([code, u, us2]) => {
            codeToUs.set(code, u);
            if (us2) codeToUsShift.set(code, us2);
            if (!charToCode.has(u)) charToCode.set(u, code);
            if (us2 && !charToCode.has(us2)) charToCode.set(us2, code);
        });
        rows.forEach(([code, , , r, r2]) => {
            if (r && !charToCode.has(r)) charToCode.set(r, code);
            if (r2 && !charToCode.has(r2)) charToCode.set(r2, code);
        });
        // ю/б заняты клавишами Period/Comma; в ряду букв у них свои code — исправляем
        charToCode.set('ю', 'Period'); charToCode.set('Ю', 'Period'); charToCode.set('б', 'Comma'); charToCode.set('Б', 'Comma');
        return { charToCode, codeToUs, codeToUsShift };
    })();

    /** e.code для символа хоткея (или ''): 'b' / 'и' → 'KeyB', '/' → 'Slash', '.' → 'Period'. */
    function mossadCodeForKey(key) {
        if (typeof key !== 'string' || key.length !== 1) return '';
        return MOSSAD_KEY_LAYOUT.charToCode.get(key) || MOSSAD_KEY_LAYOUT.charToCode.get(key.toLowerCase()) || '';
    }

    /** Символ US-раскладки для e.code (shift — с Shift) или ''. */
    function mossadUsKeyForCode(code, shift = false) {
        return (shift && MOSSAD_KEY_LAYOUT.codeToUsShift.get(code)) || MOSSAD_KEY_LAYOUT.codeToUs.get(code) || '';
    }

    function hotkeyMatches(e, hk) {
        if (!hk) return false;
        if (Array.isArray(hk)) return hk.some(k => hotkeyMatches(e, k));
        if (!hk.key) return false;
        let keyMatch = e.key === hk.key || (typeof e.key === 'string' && typeof hk.key === 'string' && e.key.toLowerCase() === hk.key.toLowerCase());
        // «+» на основном ряду (Equal) и на цифровом блоке (NumpadAdd) считаются одной клавишей (v1.3.39).
        const PLUS_CODES = ['Equal', 'NumpadAdd'];
        if (!keyMatch && typeof e.code === 'string' && (hk.key === '+' || PLUS_CODES.includes(hk.code))) {
            keyMatch = PLUS_CODES.includes(e.code);
        } else if (!keyMatch && typeof e.code === 'string' && e.code) {
            // v1.3.39: записанная физическая клавиша (hk.code); v1.3.43: иначе — code, выведенный из символа
            // (буквы US/RU, цифры, знаки). Так Ctrl+B / Ctrl+/ / Alt+R работают в любой раскладке.
            const code = hk.code || mossadCodeForKey(hk.key);
            if (code) keyMatch = e.code === code;
        }
        return keyMatch &&
            !!e.ctrlKey  === !!hk.ctrl &&
            !!e.altKey   === !!hk.alt &&
            !!e.shiftKey === !!hk.shift &&
            (hk.meta === undefined ? true : !!e.metaKey === !!hk.meta);
    }

// ============================================
    // v1.3.44: СЧЁТЧИКИ ТАЙМЕРОВ/НАБЛЮДАТЕЛЕЙ MOSSAD (диагностика утечек)
    // setInterval / clearInterval / MutationObserver внутри бандла перекрыты тонкими обёртками
    // (та же сигнатура, только учёт активных id/наблюдателей). Код сайта это не затрагивает.
    // Срез пишется в debug-лог (mossadPerfSnapshot) — см. ANTI_PATTERNS §23.
    // ============================================
    const _mossadActive = { intervals: new Set(), observers: new Set() };
    const _nativeSetInterval = window.setInterval.bind(window);
    const _nativeClearInterval = window.clearInterval.bind(window);
    const setInterval = (fn, ms, ...args) => {
        const id = _nativeSetInterval(fn, ms, ...args);
        _mossadActive.intervals.add(id);
        return id;
    };
    const clearInterval = (id) => {
        _mossadActive.intervals.delete(id);
        return _nativeClearInterval(id);
    };
    // Фабрика (не подкласс): `new MutationObserver(cb)` вернёт настоящий наблюдатель с учётом observe/disconnect.
    // Подкласс нативного конструктора в песочнице Tampermonkey (Firefox, Xray) ненадёжен.
    const _NativeMO = window.MutationObserver;
    function MutationObserver(cb) {
        const o = new _NativeMO(cb);
        try {
            const obs = o.observe.bind(o), dis = o.disconnect.bind(o);
            o.observe = (...a) => { _mossadActive.observers.add(o); return obs(...a); };
            o.disconnect = () => { _mossadActive.observers.delete(o); return dis(); };
        } catch (e) {}
        return o;
    }

    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    function showToast(message, isError = false) {
        let toast = document.getElementById('mossad-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mossad-toast';
            toast.style.cssText = `
                position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999999;
                padding: 10px 18px; background: rgba(20, 20, 20, 0.92); backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; color: #ffffff;
                font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none;
                transition: opacity 0.2s ease; opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.borderColor = isError ? '#ef4444' : '#10b981';
        toast.style.color = isError ? '#fca5a5' : '#6ee7b7';
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3500);
    }

    // ============================================
    // URL NORMALIZATION (общие ключи сравнения URL)
    // ============================================

    /** URL без query-строки (`?…`). null/undefined → ''. Регистр сохраняется. */
    function stripUrlQuery(url) {
        return String(url || '').split('?')[0];
    }

    /** Ключ сравнения URL: без query-строки и в нижнем регистре. null/undefined → ''. */
    function normUrlKey(url) {
        return stripUrlQuery(url).toLowerCase();
    }

    // ============================================
    // FOCUS: единая проверка «пользователь сейчас печатает»
    // ============================================

    // Типы <input>, в которых нет ввода текста: хоткеи при фокусе на них должны работать.
    const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

    /**
     * true, если элемент — поле ввода текста (input с текстом, textarea, select, contenteditable,
     * role="textbox" или что-то внутри них). Используется всеми обработчиками хоткеев (v1.3.37).
     */
    function isEditableElement(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        if (el.tagName === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(String(el.type || '').toLowerCase());
        if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
        if (el.isContentEditable) return true;
        if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
        return !!(el.closest && el.closest('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
    }

    // ============================================
    // POLLING: общий помощник ожидания условия
    // ============================================

    /**
     * Опрашивает checkFn каждые intervalMs (первая проверка — через intervalMs).
     * Резолвится результатом checkFn, как только он truthy, или null, когда исчерпаны попытки.
     * v1.3.38: семантика «числа попыток» (как до v1.3.33): maxAttempts = ceil(timeoutMs / intervalMs).
     * При загруженном main thread таймеры срабатывают реже, и чисто «настенные» часы давали меньше
     * проверок, чем задумано (например, 240/40 мс → всего 1–2 проверки вместо 6). Страховка от
     * бесконечного ожидания в фоновой вкладке (таймеры ≥1 с): жёсткий потолок 4 × timeoutMs.
     * Исключения в checkFn гасятся (считаются «ещё нет»). Интервал всегда очищается.
     */
    function waitForCondition(checkFn, timeoutMs = 2500, intervalMs = 50) {
        return new Promise(resolve => {
            const start = Date.now();
            const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));
            const hardCapMs = timeoutMs * 4;
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                let res = null;
                try { res = checkFn(); } catch(e) {}
                if (res) {
                    clearInterval(timer);
                    return resolve(res);
                }
                if (attempts >= maxAttempts || Date.now() - start >= hardCapMs) {
                    clearInterval(timer);
                    return resolve(null);
                }
            }, intervalMs);
        });
    }

    // ============================================
    // DEBUG-ЛОГ (v1.3.38): кто и почему запустил шаг слайдшоу / удаление
    // Включается в F1 → «Debug-лог слайдшоу» (config.debugSlideshow, по умолчанию выкл.).
    // Пишет в консоль с префиксом [MOSSAD DBG] и в кольцевой буфер (последние 300 записей),
    // который копируется кнопкой «📋 лог» в окне F1 (mossadDumpDebugLog()).
    // ============================================
    const MOSSAD_DEBUG_MAX = 300;
    const _mossadDebugBuf = [];

    function isMossadDebugOn() {
        try { return !!(config && config.debugSlideshow); } catch(e) { return false; }
    }

    function mossadDebug(source, msg, data) {
        if (!isMossadDebugOn()) return;
        const entry = {
            t: new Date().toISOString().slice(11, 23),
            source: String(source || '?'),
            msg: String(msg || ''),
            path: (location.pathname || '').slice(0, 80)
        };
        if (data !== undefined) entry.data = data;
        _mossadDebugBuf.push(entry);
        if (_mossadDebugBuf.length > MOSSAD_DEBUG_MAX) _mossadDebugBuf.splice(0, _mossadDebugBuf.length - MOSSAD_DEBUG_MAX);
        try {
            console.log('%c[MOSSAD DBG]', 'color:#f59e0b;font-weight:bold', entry.t, `[${entry.source}]`, entry.msg, data !== undefined ? data : '');
        } catch(e) {}
    }

    // ── v1.3.44: диагностика производительности (только при включённом debug-логе) ──
    // Лаг главного потока: интервал 250 мс; если между срабатываниями прошло на 200+ мс больше — страница
    // (сайт, браузер или MOSSAD) была занята. В фоновой вкладке браузер сам замедляет таймеры — не считаем.
    const _mossadPerf = { timer: null, last: 0, lagMax: 0, lagCount: 0, slideAt: 0 };

    function mossadPerfStart() {
        if (_mossadPerf.timer || !isMossadDebugOn()) return;
        _mossadPerf.last = performance.now();
        _mossadPerf.timer = setInterval(() => {
            const now = performance.now();
            const lag = now - _mossadPerf.last - 250;
            _mossadPerf.last = now;
            if (document.hidden) return;
            if (!isMossadDebugOn()) { clearInterval(_mossadPerf.timer); _mossadPerf.timer = null; return; }
            if (lag > _mossadPerf.lagMax) _mossadPerf.lagMax = lag;
            if (lag > 200) {
                _mossadPerf.lagCount++;
                mossadDebug('perf', 'главный поток занят (лаг)', { ms: Math.round(lag) });
            }
        }, 250);
    }

    /** Срез на каждом слайде: активные таймеры/наблюдатели MOSSAD, <video> и узлы DOM, лаг за слайд. */
    function mossadPerfSnapshot(where) {
        if (!isMossadDebugOn()) return;
        mossadPerfStart();
        const now = performance.now();
        const data = {
            where,
            intervals: _mossadActive.intervals.size,
            observers: _mossadActive.observers.size,
            videos: document.getElementsByTagName('video').length,
            nodes: document.getElementsByTagName('*').length,
            lagMaxMs: Math.round(_mossadPerf.lagMax),
            lags: _mossadPerf.lagCount,
            slideMs: _mossadPerf.slideAt ? Math.round(now - _mossadPerf.slideAt) : 0
        };
        try { if (performance.memory) data.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) {}
        _mossadPerf.slideAt = now;
        _mossadPerf.lagMax = 0;
        _mossadPerf.lagCount = 0;
        mossadDebug('perf', 'срез', data);
    }

    /** Время шага (мс) — пишем в лог, только если шаг занял больше порога. */
    function mossadPerfStep(name, t0, thresholdMs = 30) {
        const ms = performance.now() - t0;
        if (ms >= thresholdMs) mossadDebug('perf', 'долгий шаг', { name, ms: Math.round(ms) });
    }

    function mossadDumpDebugLog() {
        try { console.table(_mossadDebugBuf.slice()); } catch(e) { console.log(_mossadDebugBuf.slice()); }
        return _mossadDebugBuf.slice();
    }

    // ============================================
    // GENERAL HELPERS & RETRY ENGINE
    // ============================================

    /**
     * Снимает фокус с активного поля ввода, если он там остался.
     */
    function blurActiveInput() {
        const activeEl = document.activeElement;
        if (activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable ||
            activeEl.getAttribute('role') === 'textbox' ||
            !!activeEl.closest('input, textarea, [contenteditable="true"], [role="textbox"]')
        )) {
            try { activeEl.blur(); } catch (e) {}
        }
    }

    /**
     * Полный программный клик по элементу с эмуляцией pointer/mouse событий.
     */
    function triggerClick(el, label = '') {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
            try {
                el.dispatchEvent(new MouseEvent(evtType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                }));
            } catch (e) {}
        });
        if (typeof el.click === 'function') {
            try { el.click(); } catch(e) {}
        }
        if (label) {
            console.log(`%c[MOSSAD] Clicked "${label}"`, 'color:#10b981;', el);
        }
    }

    /**
     * Выполняет действие с серией попыток (по умолчанию через 100, 300, 500 мс).
     * Если fn возвращает truthy значение (например, true или найденный элемент) — цепочка немедленно прерывается.
     * @param {(attempt: number) => any} fn Функция-попытка.
     * @param {number[]} delays Задержки в миллисекундах от старта.
     * @returns {() => void} Функция принудительной отмены оставшихся попыток.
     */
    function retryAction(fn, delays = [100, 300, 500]) {
        let stopped = false;
        const timeouts = [];
        delays.forEach((delay, idx) => {
            const tid = setTimeout(() => {
                if (stopped) return;
                try {
                    const res = fn(idx + 1);
                    if (res) {
                        stopped = true;
                        timeouts.forEach(t => clearTimeout(t));
                    }
                } catch (e) {
                    console.error('[MOSSAD] retryAction error:', e);
                }
            }, delay);
            timeouts.push(tid);
        });
        return () => {
            stopped = true;
            timeouts.forEach(t => clearTimeout(t));
        };
    }

    /**
     * Преобразует строковое направление в имя клавиши KeyboardEvent
     */
    function getArrowKey(dir) {
        if (dir === 'up') return 'ArrowUp';
        if (dir === 'down') return 'ArrowDown';
        if (dir === 'left') return 'ArrowLeft';
        return 'ArrowRight';
    }
    window.getArrowKey = getArrowKey;

    /**
     * Отправляет нативное синтетическое событие стрелки клавиатуры во все слои DOM:
     * activeElement -> document -> window, заполняя key, code, keyCode и which.
     */
    function sendDpadKeyEvent(key) {
        blurActiveInput();
        const keyCode = key === 'ArrowUp' ? 38 : (key === 'ArrowDown' ? 40 : (key === 'ArrowLeft' ? 37 : 39));
        const eventInit = {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true
        };
        const active = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
        if (active) {
            try { active.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
            try { active.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}
        }
        try { document.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
        try { document.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}
        try { window.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
        try { window.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}

        triggerUniversalFullScreen();
    }
    window.sendDpadKeyEvent = sendDpadKeyEvent;

    /**
     * Поиск нативной кнопки навигации на Grok (если доступна в DOM)
     */
    function findGrokNavButton(dir) {
        const isNext = (dir === 'down' || dir === 'right');
        const labels = isNext
            ? ['next post', 'next', 'следующий', 'следующая', 'следующее']
            : ['previous post', 'previous', 'prev', 'предыдущий', 'предыдущая', 'предыдущее'];
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        return btns.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            return labels.some(l => aria === l || title === l);
        }) || null;
    }

    /**
     * Унифицированный пошаговый переход по направлению D-Pad.
     * Используется:
     * 1. В Малом слайдшоу (Shift+Insert / ракета 🚀).
     * 2. После скачивания при включенном pdAction: 'up' (Скачать - +1).
     * 3. При ручной навигации.
     */
    function performDpadStep(dirOverride = null, isSlideshow = false) {
        const dirs = config.slideshowDirections;
        const dir = dirOverride || ((dirs && dirs.length) ? dirs[0] : 'down');
        const isFwd = (dir === 'down' || dir === 'right');

        // 1. Pinterest
        // v1.3.51: направление D-pad на Pinterest не используется (D-pad там не показан, а ▲ по умолчанию
        // означало «назад по истории»). Слайдшоу — своё направление ◀/▶ (pinterestSlideDir), «После DL: +1» — вперёд.
        if (rootDomain.includes('pinterest.')) {
            if (isSlideshow) selectNextPinterestPin(pinterestSlideDir(), { isManual: false, fromSlideshow: true });
            else selectNextPinterestPin('next', { isManual: true });
            return true;
        }

        // 2. RedGifs
        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
                window.MOSSAD_ENGINES.redgifs.navigate(dir);
            } else redGifsNavigate(dir);
            return true;
        }

        // 3. Grok
        if (rootDomain === 'grok.com') {
            // А. Горизонтальное листание кадров группы по киноплёнке (left / right)
            if ((dir === 'left' || dir === 'right') && isGrokPostPage()) {
                {
                    const stepRes = grokStepFilmstrip(isFwd);
                    if (stepRes === true) return true;
                    if (stepRes === 'end') {
                        if (isSlideshow && !config.loopFeed) {
                            stopSlideshow();
                            showToast('⏹ Слайдшоу остановлено: конец ленты', true);
                            return false;
                        }
                    }
                }
            }

            // Б. Проверяем, есть ли карточки соседних постов в DOM или в сохраненной коллекции
            const neighborUrl = getGrokNeighborPostUrl(dir);
            if (neighborUrl) {
                if (typeof grokSpaNavigate === 'function') {
                    grokSpaNavigate(neighborUrl);
                } else {
                    window.location.href = neighborUrl;
                }
                return true;
            }

            // В. Проверяем нативную кнопку навигации
            const navBtn = findGrokNavButton(dir);
            if (navBtn) {
                triggerClick(navBtn, `Grok Nav Button (${dir})`);
                return true;
            }

            // Г. Нативная отправка стрелок Grok (ArrowUp / ArrowDown / ArrowLeft / ArrowRight)
            const key = getArrowKey(dir);
            sendDpadKeyEvent(key);
            return true;
        }

        // 4. Все остальные сайты: универсальная отправка стрелки D-pad
        const key = getArrowKey(dir);
        sendDpadKeyEvent(key);
        return true;
    }
    window.performDpadStep = performDpadStep;

    /**
     * Выполняет пост-действие после фактического скачивания (+1 или del).
     * Срабатывает ТОЛЬКО когда скачивание реально началось, а не при блокировке дубликата.
     */
    function performPostDownloadAction() {
        if (!config || config.pdAction === 'none') return;
        if (config.pdAction === 'up') {
            setTimeout(() => {
                const dirs = config.slideshowDirections;
                const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                performDpadStep(dPadDir, false);
            }, 600);
        } else if (config.pdAction === 'del' && rootDomain === 'grok.com') {
            setTimeout(() => {
                runSmartDelete();
            }, 1000);
        }
    }
    window.performPostDownloadAction = performPostDownloadAction;

    /**
     * Извлекает чистое первоначальное (искомое) имя файла из истории или дубликата.
     * Срезает любые уровни вложенных "(...) DBL", чтобы все дубли всегда ссылались
     * на один общий исходный файл, а не порождали матрёшку из имен.
     */
    function extractRootFilename(rawName) {
        if (!rawName || typeof rawName !== 'string') return 'original';
        let name = rawName.replace(/\.[^/.]+$/, '').trim();
        if (!name) return 'original';

        if (name.includes('(')) {
            // Разворачиваем вложенные DBL-матрёшки
            while (/\bDBL\b/i.test(name)) {
                const m = name.match(/\(([^()]+)\)\s*DBL/i);
                if (m && m[1]) {
                    name = m[1].trim();
                } else {
                    name = name.replace(/\s*[-_]?\s*DBL\b/gi, '').trim();
                    break;
                }
            }

            if (name.includes('(')) {
                const parts = name.split('(').map(p => p.replace(/[()]/g, '').trim()).filter(Boolean);
                if (parts.length > 1) {
                    name = parts[1];
                } else if (parts.length === 1) {
                    name = parts[0];
                }
            }
        }

        name = name.replace(/\s*[-_]?\s*DBL\b/gi, '').trim();
        name = name.replace(/^[()]+|[()]+$/g, '').trim();
        name = name.replace(/[\s_-]+$/, '').trim();

        // Ограничиваем длину исходного имени максимум 50 символов
        if (name.length > 50) {
            name = name.slice(0, 50).trim() + '…';
        }

        return name || 'original';
    }
    window.extractRootFilename = extractRootFilename;

    /**
     * Флаг выполнения перемотки ленты
     */
    let _isRewinding = false;
    window._isRewinding = false;

    /**
     * Мотает ленту в противоположную сторону от выбранного DPad направления до самого начала/конца.
     * По завершении (когда URL перестает меняться 5 раз подряд) вызывает onComplete callback.
     */
    function doRewind(onComplete) {
        if (_isRewinding) return;
        _isRewinding = true;
        window._isRewinding = true;
        // v1.3.43: на время перемотки — никаких таймеров/подсчёта кругов (раньше RAF перепривязывался
        // и запускал play() у роликов, пролетающих при перемотке); после — сброс памяти прошлого круга.
        if (typeof window.cancelSlideTimers === 'function') window.cancelSlideTimers();

        let oppDir = 'down';
        const d0 = (config.slideshowDirections || ['up'])[0];
        if (d0 === 'up') oppDir = 'down';
        else if (d0 === 'down') oppDir = 'up';
        else if (d0 === 'left') oppDir = 'right';
        else if (d0 === 'right') oppDir = 'left';
        const key = getArrowKey(oppDir);

        showToast('↺ Перемотка на начало ленты...');
        let lastUrl = location.href;
        let unchangedCount = 0;

        const interval = setInterval(() => {
            sendDpadKeyEvent(key);

            setTimeout(() => {
                if (location.href === lastUrl) {
                    unchangedCount++;
                    if (unchangedCount >= 5) {
                        clearInterval(interval);
                        _isRewinding = false;
                        window._isRewinding = false;
                        if (typeof window.resetSlideTrackingState === 'function') window.resetSlideTrackingState('rewind');
                        showToast('🏁 Достигнуто начало ленты');
                        if (typeof onComplete === 'function') {
                            setTimeout(onComplete, 400);
                        }
                    }
                } else {
                    lastUrl = location.href;
                    unchangedCount = 0;
                }
            }, 60);
        }, 120);
    }
    window.doRewind = doRewind;

    /**
     * Возвращает дефолтный шаблон имени файла для текущего сайта (отображается серым плейсхолдером)
     */
    function getDefaultFilenameTemplate() {
        // v1.3.36: единый шаблон по умолчанию для всех сайтов (эталон владельца, см. DEFAULT_CONFIG).
        // Раньше: RedGifs — {userName}-{domain[4]}, Grok — {conv4}-{id4}-{domain}.{ext}, прочие — {id8}-{domain}.{ext}.
        return DEFAULT_CONFIG.filenameTemplate;
    }
    window.getDefaultFilenameTemplate = getDefaultFilenameTemplate;

    /**
     * Форматирует имя файла по шаблону и словарю переменных.
     * Поддерживает:
     * - {varN} (например {conv4}, {id4}, {id8}, {conv8})
     * - {var[N]} (например {domain[4]}, {id[8]})
     * - {var} (полное значение без обрезки)
     * - авто-очистку висячих разделителей при пустых переменных
     * - подстановку суффикса дубликата {dbl}
     */
    function renderFilenameTemplate(rawTpl, vars, isDup = false, dblSuffix = '', defaultExt = 'mp4') {
        const tplStr = (rawTpl && rawTpl.trim())
            ? rawTpl.trim()
            : (getDefaultFilenameTemplate());

        const hasDblVar = /\{dbl\}/i.test(tplStr);

        const aliasMap = {
            conversation: 'conv',
            uuid: 'id',
            hash: 'id',
            postid: 'id',
            user: 'username',
            author: 'username',
            copy: 'oldname',
            root: 'oldname'
        };

        let filename = tplStr.replace(
            /\{([a-zA-Z]+)(\d+)?(?:\[(\d+)\])?\}/g,
            (_, name, inlineLen, bracketLen) => {
                const rawName = name.toLowerCase();
                const key = aliasMap[rawName] || rawName;
                const len = parseInt(bracketLen || inlineLen || '0', 10);
                if (key in vars) {
                    const val = vars[key] != null ? String(vars[key]) : '';
                    return len > 0 ? val.slice(0, len) : val;
                }
                if (rawName in vars) {
                    const val = vars[rawName] != null ? String(vars[rawName]) : '';
                    return len > 0 ? val.slice(0, len) : val;
                }
                return '';
            }
        ).replace(/[\\/:*?"<>|]/g, '_');

        // Очистка возможных двойных или висячих дефисов/подчеркиваний (например, если conv пустой)
        filename = filename
            .replace(/-{2,}/g, '-')
            .replace(/_{2,}/g, '_')
            .replace(/^[-_\s]+/, '')
            .replace(/[-_\s]+(?=\.[a-zA-Z0-9]+$)/, '');

        const ext = vars.ext || defaultExt;
        if (!filename.includes('.')) {
            filename += `.${ext}`;
        }

        if (isDup && !hasDblVar && dblSuffix) {
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : `.${ext}`;
            filename = `${base}${dblSuffix}${extPart}`;
        }

        return filename;
    }
    window.renderFilenameTemplate = renderFilenameTemplate;

    /**
     * Асинхронно отправляет промпт в локальный Universal Prompt Vault (http://127.0.0.1:5999).
     * Работает в фоне без блокировки интерфейса и без назойливых ошибок при выключенном сервере.
     */
    function sendPromptToVault(prompt, model = '', source = '', url = '') {
        if (!prompt || !prompt.trim()) return;
        const payload = JSON.stringify({
            prompt: prompt.trim(),
            model: model || '',
            source: source || location.hostname,
            url: url || location.href
        });

        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://127.0.0.1:5999/api/save_prompt',
                    headers: { 'Content-Type': 'application/json' },
                    data: payload,
                    timeout: 3000,
                    onload: () => {},
                    onerror: () => {}
                });
            } else if (typeof fetch === 'function') {
                fetch('http://127.0.0.1:5999/api/save_prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    mode: 'cors'
                }).catch(() => {});
            }
        } catch (e) {}
    }
    window.sendPromptToVault = sendPromptToVault;

// ============================================
    // LABELS (v1.3.46): подписи кнопок и надписей MOSSAD — одна карта + помощник L('key').
    // Свои подписи пользователь задаёт на вкладке «✏ Подписи» (Ctrl+F1). Хранятся в GM
    // (общие для всех сайтов и контейнеров), только изменённые ключи. Пустое значение = по умолчанию.
    // ============================================
    const LABELS_GM_KEY = 'mossad_labels';

    // [ключ, подпись по умолчанию, комментарий]; строки-заголовки — ['#', 'Раздел']
    const LABEL_DEFS = [
        ['#', 'Верхняя полоса виджета'],
        ['start',          '🚀',            'кнопка запуска слайд-шоу (Insert)'],
        ['download',       '💾',            'кнопка «Скачать»'],
        ['update',         '🔄',            'кнопка «Обновить скрипт»'],
        ['togglePanel',    '▼',             'кнопка «Меню настроек» (развернуть/свернуть)'],
        ['hideWidget',     '✕',             'кнопка «Скрыть виджет»'],
        ['#', 'Полоса Grok (верхний ряд)'],
        ['collect',        'Собрать',       'кнопка сбора ссылок на странице Saved (потом там число)'],
        ['slideshow',      'Слайдшоу',      'кнопка запуска большого слайд-шоу'],
        ['pause',          '❚❚',            'кнопка «Пауза» (во время слайд-шоу)'],
        ['resume',         '▶',             'кнопка «Продолжить» (на паузе)'],
        ['stop',           '■',             'кнопка «Остановить слайд-шоу»'],
        ['grPrefix',       'Gr',            'кнопка порядка групп (к ней добавляется ↓ ↑ ↺ −)'],
        ['mdPrefix',       'Md',            'кнопка порядка файлов (к ней добавляется ↓ ↑ ↺ −)'],
        ['random',         '🔀',            'кнопка «Случайно»'],
        ['settingsHk',     '⌨',             'кнопка окна настроек (горячие клавиши)'],
        ['#', 'Меню настроек виджета'],
        ['dpadUp',         '▲',             'D-pad: листать вверх'],
        ['dpadLeft',       '◀',             'D-pad: листать влево'],
        ['dpadRight',      '▶',             'D-pad: листать вправо'],
        ['dpadDown',       '▼',             'D-pad: листать вниз'],
        ['dpadLoop',       'R',             'D-pad: повторять ленту'],
        ['loopsLabel',     'Видео (↺):',    'надпись у поля «кругов видео»'],
        ['photoLabel',     'Фото (сек):',   'надпись у поля «показ фото»'],
        ['pauseLabel',     'Пауза (сек):',  'надпись у поля «пауза после видео»'],
        ['exportList',     '💾 Список',     'кнопка «Скачать список ссылок (.txt)»'],
        ['zoomDec',        '−',             'кнопка «Уменьшить масштаб»'],
        ['zoomInc',        '+',             'кнопка «Увеличить масштаб»'],
        ['tplLabel',       'Шаблон:',       'надпись у шаблона имени файла'],
        ['saveTplGlobal',  '💾',            'кнопка «Сохранить шаблон для всех вкладок»'],
        ['settings',       '⚙ Настройки',   'кнопка открытия окна настроек'],
        ['importDb',       '📥 База',       'кнопка «Импорт базы хешей»'],
        ['resetCfg',       '↺ Сброс',       'кнопка «Сбросить все настройки»'],
        ['#', 'Список (плейлист)'],
        ['playlistTitle',  '📋 Список',     'заголовок списка (к нему добавляется число)'],
        ['fontDec',        'A−',            'кнопка «Шрифт меньше»'],
        ['fontInc',        'A+',            'кнопка «Шрифт больше»'],
        ['clearLoops',     'R ✕',           'кнопка «Отключить все зацикленные»'],
        ['resetSize',      '⤢',             'кнопка «Сбросить размер списка»'],
        ['closeList',      '×',             'кнопка «Закрыть список»'],
        ['loopItem',       'R',             'кнопка «Зациклить» у строки'],
        ['groupCount',     'ген.',          'подпись числа генераций в группе'],
        ['#', 'Окно настроек'],
        ['settingsTitle',  '⚙ Настройки MOSSAD', 'заголовок окна'],
        ['tabGeneral',     '⚙ Общие',       'вкладка «Общие»'],
        ['tabHotkeys',     '⌨ Горячие клавиши', 'вкладка «Горячие клавиши»'],
        ['tabDefaults',    '🌐 По умолчанию', 'вкладка общих умолчаний'],
        ['tabLabels',      '✏ Подписи',     'вкладка подписей (эта)'],
        ['close',          'Закрыть',       'кнопка закрытия окна'],
        ['hkDefaultsLabel', 'По умолчанию:', 'надпись перед кнопками сброса на вкладке клавиш'],
        ['hkResetKeys',    'Клавиши',       'кнопка «Сбросить клавиши к умолчаниям» (🔒 не меняются)'],
        ['hkResetOrder',   'Порядок',       'кнопка «Сбросить порядок строк» (🔒 остаются на месте)'],
        ['hkSaveDefaults', 'Сохранить это', 'кнопка «Сохранить клавиши, порядок и 🔒 как общие умолчания»'],
        ['hkTop',          '⤒',             'кнопка строки клавиши: в самый верх'],
        ['hkBottom',       '⤓',             'кнопка строки клавиши: в самый низ'],
        ['hkPin',          '🔒',            'кнопка строки клавиши: закрепить'],
        ['hkUnpin',        '🔓',            'кнопка закреплённой строки: открепить'],
        ['debugCopy',      '📋 лог',        'кнопка копирования debug-лога'],
        ['updateLink',     '🔄 Обновить',   'ссылка «Обновить скрипт»'],
        ['#', 'Тудушки (задачи для ассистента)'],
        ['todoBtn',        '2DO',           'кнопка на верхней полосе: открыть тудушки'],
        ['tabTodos',       '📝 Тудушки',    'вкладка тудушек в окне настроек'],
        ['todoAdd',        '➕ Добавить',   'кнопка «Добавить задачу»'],
        ['todoAttach',     '📎',            'кнопка «Прикрепить фото»'],
        ['todoDelete',     '🗑',            'кнопка «Удалить задачу»'],
        ['todoCopy',       '📋 Копировать для ассистента', 'кнопка копирования открытых задач текстом'],
        ['todoGitHub',     '📤 На GitHub',  'кнопка отправки задач в issue на GitHub'],
        ['todoExport',     '💾 Экспорт',    'кнопка экспорта в HTML-файл с фото'],
        ['todoClearDone',  'Удалить выполненные', 'кнопка удаления выполненных задач'],
        ['#', 'Сайты (v1.3.50)'],
        ['tabSites',       '🌍 Сайты',      'вкладка списка сайтов в окне настроек'],
        ['sitesAdd',       'Добавить',      'кнопка «Добавить сайт из поля»'],
        ['sitesAddCurrent', '➕ Этот сайт', 'кнопка «Добавить текущий сайт»'],
        ['sitesRemove',    '✕',             'кнопка «Убрать сайт» у строки'],
        ['sitesBuiltin',   'Встроенные',    'заголовок списка встроенных сайтов'],
        ['sitesUser',      'Свои',          'заголовок списка своих сайтов'],
        ['#', 'Pinterest (v1.3.51)'],
        ['pinModeLabel',   'Пин:',          'надпись у выбора следующего пина'],
        ['pinRand',        'rand',          'режим «случайный похожий пин»'],
        ['pinPlus1',       '+1',            'режим «по очереди: 1-й, 2-й, 3-й…»'],
        ['pinNum',         '№',             'режим «всегда N-й похожий пин» (рядом поле с числом)'],
        ['pinDirBack',     '◀',             'направление слайдшоу: назад по истории'],
        ['pinDirFwd',      '▶',             'направление слайдшоу: вперёд по новым пинам'],
        ['#', 'Уведомления'],
        ['toastClose',     '×',             'крестик на тосте звука'],
    ];
    const LABEL_DEFAULTS = {};
    const LABEL_COMMENTS = {};
    for (const d of LABEL_DEFS) { if (d[0] !== '#') { LABEL_DEFAULTS[d[0]] = d[1]; LABEL_COMMENTS[d[0]] = d[2]; } }

    // Значки для копирования/вставки (вкладка «✏ Подписи»): сначала уже используемые в MOSSAD, затем запас
    const LABEL_PALETTE = [
        ['В MOSSAD', '⤒ ⤓ 🔒 🔓 🚀 💾 🔄 🔀 ⌨ 📋 👁 ⚙ 🌐 ⇄ ⤤ ⤢ × ✕ 📹 🖼 🎬 ❔ 📥 📌 🔍 ⏳ ⏱ 🗑 ✅ ❌ ⚠️ 💡 🔊 🔇 ↺ ↕ ▲ ▼ ◀ ▶ ■ ❚❚ ✏ 🩺 🗂 🔁'],
        ['Плеер', '▶ ⏸ ⏹ ⏺ ⏯ ⏭ ⏮ ⏩ ⏪ 🔁 🔂 🔀 🔈 🔉 🔊 🔇 🎵 🎞 📺 🎥'],
        ['Стрелки', '← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⤴ ⤵ ↩ ↪ ⟲ ⟳ ➜ ➤ ⮕'],
        ['Действия', '🗑 ⬇ ⬆ 📤 📥 📂 📁 🗃 🔗 📎 ✂ 🖊 🔒 🔓 🔑 🧹 🛠 🔧 ⚡ 🔥'],
        ['Отметки', '✔ ✓ ✗ ✘ ☐ ☑ ★ ☆ ⭐ ❤ 💔 👍 👎 ⚑ 🏁 ● ○ ◆ ◇ •'],
        ['Разное', '👁 🕒 ⏰ ⌛ 📅 🔔 🔕 💬 ℹ ❓ ❗ ➕ ➖ ✖ ➗ 🎯 🧭 🌙 ☀ 🌀'],
    ];

    let _mossadLabelOverrides = null;

    function mossadReadLabelOverrides() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(LABELS_GM_KEY, null); } catch (e) {}
        let obj = null;
        try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { obj = null; }
        return mossadSanitizeLabelOverrides(obj);
    }
    /** Только известные ключи, только непустые строки, отличные от значения по умолчанию. */
    function mossadSanitizeLabelOverrides(obj) {
        const out = {};
        if (!obj || typeof obj !== 'object') return out;
        for (const k of Object.keys(obj)) {
            if (!Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, k)) continue;
            const v = typeof obj[k] === 'string' ? obj[k].trim().slice(0, 200) : '';
            if (v && v !== LABEL_DEFAULTS[k]) out[k] = v;
        }
        return out;
    }

    /** Подпись по ключу: своя (если задана) или по умолчанию. Неизвестный ключ — пустая строка. */
    function L(key) {
        if (_mossadLabelOverrides === null) _mossadLabelOverrides = mossadReadLabelOverrides();
        const o = _mossadLabelOverrides[key];
        if (o) return o;
        return Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, key) ? LABEL_DEFAULTS[key] : '';
    }
    /** То же, экранированное для вставки в innerHTML-шаблоны. */
    function LH(key) {
        return String(L(key)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    /** Поставить подпись элементу и пометить его для живого обновления (pre/suf — неизменяемые части). */
    function mossadLabelEl(el, key, pre = '', suf = '') {
        if (!el) return el;
        el.dataset.mossadLabel = key;
        if (pre) el.dataset.mossadPre = pre; else delete el.dataset.mossadPre;
        if (suf) el.dataset.mossadSuf = suf; else delete el.dataset.mossadSuf;
        el.textContent = pre + L(key) + suf;
        return el;
    }
    /** Элемент больше не показывает подпись (например, «Собрать» сменилось числом). */
    function mossadUnlabelEl(el) {
        if (el && el.dataset) { delete el.dataset.mossadLabel; delete el.dataset.mossadPre; delete el.dataset.mossadSuf; }
        return el;
    }
    /** Перерисовать все помеченные подписи (один querySelectorAll; вызывается только при сохранении). */
    function mossadApplyLabels(root) {
        const r = root || document;
        let n = 0;
        r.querySelectorAll('[data-mossad-label]').forEach(el => {
            const t = (el.dataset.mossadPre || '') + L(el.dataset.mossadLabel) + (el.dataset.mossadSuf || '');
            if (el.textContent !== t) { el.textContent = t; n++; }
        });
        return n;
    }

    function mossadGetLabelOverrides() {
        if (_mossadLabelOverrides === null) _mossadLabelOverrides = mossadReadLabelOverrides();
        return Object.assign({}, _mossadLabelOverrides);
    }
    /** Записать свои подписи (только отличные от умолчаний) в GM и перерисовать. */
    function mossadSetLabelOverrides(obj) {
        _mossadLabelOverrides = mossadSanitizeLabelOverrides(obj);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(LABELS_GM_KEY, JSON.stringify(_mossadLabelOverrides));
        } catch (e) {}
        mossadApplyLabels();
        return Object.keys(_mossadLabelOverrides).length;
    }

    /** Текст для textarea: «# комментарий» + «ключ = подпись» по разделам. */
    function mossadLabelsToText(overrides) {
        const ov = overrides || mossadGetLabelOverrides();
        const lines = ['# Подписи MOSSAD: «ключ = подпись». Строки с # — комментарии.',
                       '# Пустая подпись или удалённая строка = по умолчанию. Неизвестные ключи игнорируются.', ''];
        for (const d of LABEL_DEFS) {
            if (d[0] === '#') { if (lines[lines.length - 1] !== '') lines.push(''); lines.push(`# ── ${d[1]} ──`); continue; }
            lines.push(`# ${d[2]}` + (ov[d[0]] ? ` (по умолчанию: ${d[1]})` : ''));
            lines.push(`${d[0]} = ${ov[d[0]] || d[1]}`);
        }
        return lines.join('\n') + '\n';
    }
    /** Разбор textarea → только изменённые ключи. Возвращает {overrides, unknown: [ключи]}. */
    function mossadParseLabelsText(text) {
        const raw = {};
        const unknown = [];
        String(text || '').split(/\r?\n/).forEach(line => {
            const s = line.trim();
            if (!s || s.startsWith('#')) return;
            const i = s.indexOf('=');
            if (i <= 0) return;
            const k = s.slice(0, i).trim();
            const v = s.slice(i + 1).trim();
            if (!Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, k)) { unknown.push(k); return; }
            raw[k] = v;
        });
        return { overrides: mossadSanitizeLabelOverrides(raw), unknown };
    }

    // Другие вкладки/контейнеры: подхватить изменения сразу (одно событие на сохранение, не опрос)
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(LABELS_GM_KEY, (name, oldVal, newVal, remote) => {
                if (!remote) return;
                _mossadLabelOverrides = null;
                try { mossadApplyLabels(); } catch (e) {}
            });
        } catch (e) {}
    }

// ============================================
    // NOODLE MAGAZINE MODULE
    // ============================================
    if (rootDomain === 'noodlemagazine.com') {
        const noodleCSS = `
            .c_video > div[data-noscript], .c_video > div:not(.video_player), .fh-button,
            a[href*="faphouse.com"], a[href*="join"], .join-now, div:has(> a[href*="faphouse"]) {
                display: none !important; visibility: hidden !important; width: 0 !important; height: 0 !important;
                margin: 0 !important; padding: 0 !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important;
            }
            .c_video { width: 100% !important; max-width: 100% !important; display: block !important; height: auto !important; flex: 1 1 100% !important; }
            .c_video > .video_player { width: 100% !important; max-width: 100% !important; aspect-ratio: 16 / 9 !important; height: auto !important; min-height: 420px !important; margin: 0 auto !important; }
            .c_video .player_wrap, .c_video .video_player iframe, .c_video .video_player video, .c_video .video_player #player, .c_video .video_player .plyr {
                width: 100% !important; height: 100% !important; min-height: 100% !important; padding-bottom: 0 !important;
            }
        `;
        let style = document.createElement('style');
        style.textContent = noodleCSS;
        document.head.appendChild(style);
        function cleanupJoinNow() {
            document.querySelectorAll('.fh-button, a[href*="faphouse.com"], .c_video > div[data-noscript]').forEach(el => { el.style.setProperty('display', 'none', 'important'); el.remove(); });
        }
        setInterval(cleanupJoinNow, 500);
    }

// ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function triggerDirectBlobDownload(url, filename, onErrorCallback, postUrl = null, onSuccess = null) {
        // v1.3.52: onSuccess — файл сохранён (для слайдшоу «скачать и листать»: не ждать страховочные 8 с)
        // 1. Предпочитаем GM_download (без CORS-проблем, скачивает напрямую в Загрузки)
        if (typeof GM_download === 'function') {
            try {
                showToast(`⏳ Скачивание: ${filename}...`);
                GM_download({
                    url: url,
                    name: filename,
                    saveAs: false,
                    onload: () => {
                        showToast('✅ Сохранено!');
                        if (onSuccess) { try { onSuccess(); } catch (e) {} }
                        saveFileToHistory({
                            hash: '',
                            filename,
                            rootFilename: extractRootFilename(filename),
                            url: url || location.href,
                            postUrl: postUrl || location.href,
                            domain: rootDomain
                        });
                    },
                    onerror: (err) => {
                        console.warn('[MOSSAD] GM_download failed, trying fallback:', err);
                        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl, onSuccess);
                    }
                });
                return;
            } catch(e) {
                console.warn('[MOSSAD] GM_download call exception:', e);
            }
        }
        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl, onSuccess);
    }

    function _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl = null, onSuccess = null) {
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onprogress: (p) => {
                    if (p.total > 0) {
                        const pct = Math.round((p.loaded / p.total) * 100);
                        showToast(`⏳ Скачивание: ${pct}%`);
                    }
                },
                onload: (res) => {
                    if (res.status === 200 && res.response) {
                        saveBlobToDisk(res.response, filename, url, postUrl);
                        if (onSuccess) { try { onSuccess(); } catch (e) {} }
                    } else {
                        if (onErrorCallback) onErrorCallback();
                        else fetchBlobFallback(url, filename, postUrl);
                    }
                },
                onerror: () => {
                    if (onErrorCallback) onErrorCallback();
                    else fetchBlobFallback(url, filename, postUrl);
                }
            });
        } else {
            if (onErrorCallback) onErrorCallback();
            else fetchBlobFallback(url, filename, postUrl);
        }
    }

    function downloadBlobMedia(url, filename, postUrl = null) {
        triggerDirectBlobDownload(url, filename, null, postUrl);
    }

    function fetchAndDownloadBlob(url, filename, postUrl = null) {
        triggerDirectBlobDownload(url, filename, null, postUrl);
    }

    function fetchBlobFallback(url, filename, postUrl = null) {
        fetch(url).then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        }).then(blob => saveBlobToDisk(blob, filename, url, postUrl))
        .catch(err => {
            console.warn('[MOSSAD] fetch blob failed, using <a> download:', err);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_self';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 1000);
            showToast('📥 Скачивание запущено через браузер');
        });
    }

    function saveBlobToDisk(blob, filename, directUrl = null, postUrl = null) {
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            computeSHA256(blob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: extractRootFilename(filename),
                    url: directUrl || location.href,
                    postUrl: postUrl || location.href,
                    size: blob.size,
                    domain: rootDomain
                });
            });
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        showToast('✅ Сохранено!');
    }

// ============================================================
    // DOWNLOAD HISTORY & HASH DEDUPLICATION (IndexedDB + SHA-256)
    // ============================================================

    const MOSSAD_DB_NAME = 'mossad_media_db';
    const MOSSAD_DB_VERSION = 1;
    const MOSSAD_STORE_NAME = 'downloads';

    let _mossadDBPromise = null;
    let _pendingDuplicateConfirm = null; // { key, expiresAt, executeDownload }
    let _dupTimerInterval = null;

    // IN-MEMORY FAST CACHE (O(1) lookup for 18000+ records)
    const _cachedHashes = new Map(); // hash -> record
    const _cachedUrls = new Map();   // url -> record
    const _videoHashes = new Set();  // hashes of videos
    const _photoHashes = new Set();  // hashes of photos
    let _isCacheLoaded = false;

    function addRecordToMemoryCache(record) {
        if (!record) return;
        const isVid = record.type === 'video' || (record.filename && /\.(mp4|webm|mov|mkv)$/i.test(record.filename));
        if (record.hash) {
            _cachedHashes.set(record.hash, record);
            if (isVid) {
                _videoHashes.add(record.hash);
            } else {
                _photoHashes.add(record.hash);
            }
        }
        if (record.url) _cachedUrls.set(record.url, record);
        if (record.postUrl) _cachedUrls.set(record.postUrl, record);
    }

    /**
     * Предзагрузка всей базы в память при старте (занимает ~1-2 МБ ОЗУ на 18 000 записей)
     */
    async function loadHistoryCache() {
        if (_isCacheLoaded) return;
        try {
            const db = await getDownloadDB();
            const tx = db.transaction(MOSSAD_STORE_NAME, 'readonly');
            const store = tx.objectStore(MOSSAD_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const records = req.result || [];
                for (const r of records) {
                    addRecordToMemoryCache(r);
                }
                _isCacheLoaded = true;
                console.log(`[MOSSAD DB] In-memory кеш загружен: ${records.length} записей (видео: ${_videoHashes.size}, фото: ${_photoHashes.size})`);
            };
        } catch (e) {
            console.warn('[MOSSAD DB] Ошибка предзагрузки кеша истории:', e);
        }
    }

    /**
     * Инициализация IndexedDB для хранения истории скачиваний.
     */
    function getDownloadDB() {
        if (_mossadDBPromise) return _mossadDBPromise;

        _mossadDBPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(MOSSAD_DB_NAME, MOSSAD_DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(MOSSAD_STORE_NAME)) {
                    const store = db.createObjectStore(MOSSAD_STORE_NAME, { keyPath: 'id' });
                    store.createIndex('hash', 'hash', { unique: false });
                    store.createIndex('url', 'url', { unique: false });
                    store.createIndex('filename', 'filename', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                resolve(db);
                loadHistoryCache();
            };
            req.onerror = (e) => {
                console.error('[MOSSAD DB] Ошибка открытия IndexedDB:', e);
                reject(e);
            };
        });
        return _mossadDBPromise;
    }

    // Запускаем фоновую предзагрузку при старте
    try { getDownloadDB(); } catch (e) {}

    /**
     * Вычисление SHA-256 хеша из ArrayBuffer / Blob.
     */
    async function computeSHA256(data) {
        try {
            let buffer;
            if (data instanceof Blob) {
                buffer = await data.arrayBuffer();
            } else if (data instanceof ArrayBuffer) {
                buffer = data;
            } else if (typeof data === 'string') {
                buffer = new TextEncoder().encode(data).buffer;
            } else {
                return null;
            }
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error('[MOSSAD DB] Ошибка вычисления SHA-256:', e);
            return null;
        }
    }

    /**
     * Проверка, скачивался ли уже файл по хешу или URL с разделением на кучи (видео/фото).
     * @param {string|null} hash - SHA-256 хеш
     * @param {string|null} mediaUrl - Прямой URL медиа
     * @param {string|null} postUrl - URL страницы/поста
     * @param {string|null} mediaType - 'video' | 'photo' | null
     * @returns {Promise<Object|null>} Возвращает запись из базы или null.
     */
    async function checkFileInHistory(hash, mediaUrl, postUrl, mediaType = null) {
        // 1. МГНОВЕННАЯ ПРОВЕРКА В ПАМЯТИ (O(1), 0 миллисекунд)
        if (hash) {
            if (mediaType === 'video' && _videoHashes.has(hash)) {
                return _cachedHashes.get(hash);
            }
            if (mediaType === 'photo' && _photoHashes.has(hash)) {
                return _cachedHashes.get(hash);
            }
            if (!mediaType && _cachedHashes.has(hash)) {
                return _cachedHashes.get(hash);
            }
        }
        if (mediaUrl && _cachedUrls.has(mediaUrl)) {
            return _cachedUrls.get(mediaUrl);
        }
        if (postUrl && _cachedUrls.has(postUrl)) {
            return _cachedUrls.get(postUrl);
        }

        // Если кеш уже прогрет и совпадений нет — гарантированно новый файл!
        if (_isCacheLoaded) {
            return null;
        }

        // 2. Фоллбек на IndexedDB, если кеш еще не успел вычитаться
        try {
            const db = await getDownloadDB();
            return new Promise((resolve) => {
                const tx = db.transaction(MOSSAD_STORE_NAME, 'readonly');
                const store = tx.objectStore(MOSSAD_STORE_NAME);

                if (hash) {
                    const hashIdx = store.index('hash');
                    const hashReq = hashIdx.get(hash);
                    hashReq.onsuccess = () => {
                        if (hashReq.result) {
                            addRecordToMemoryCache(hashReq.result);
                            return resolve(hashReq.result);
                        }
                        checkUrls();
                    };
                    hashReq.onerror = () => checkUrls();
                } else {
                    checkUrls();
                }

                function checkUrls() {
                    const urlIdx = store.index('url');
                    const targetUrl = mediaUrl || postUrl;
                    if (targetUrl) {
                        const urlReq = urlIdx.get(targetUrl);
                        urlReq.onsuccess = () => {
                            const res = urlReq.result || null;
                            if (res) {
                                if (!res.rootFilename) {
                                    res.rootFilename = extractRootFilename(res.filename);
                                }
                                addRecordToMemoryCache(res);
                            }
                            resolve(res);
                        };
                        urlReq.onerror = () => resolve(null);
                    } else {
                        resolve(null);
                    }
                }
            });
        } catch (e) {
            console.warn('[MOSSAD DB] Ошибка проверки истории:', e);
            return null;
        }
    }

    /**
     * Сохранение информации о скачанном файле в IndexedDB и in-memory кеш.
     */
    async function saveFileToHistory({ hash, filename, url, postUrl, path, size, type, rootFilename }) {
        try {
            const db = await getDownloadDB();
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            const isVid = type === 'video' || (filename && /\.(mp4|webm|mov|mkv)$/i.test(filename));
            const cleanRoot = rootFilename || (extractRootFilename(filename));

            const record = {
                id: hash || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                hash: hash || '',
                filename: filename || 'unknown',
                rootFilename: cleanRoot,
                type: isVid ? 'video' : 'photo',
                url: url || postUrl || location.href,
                postUrl: postUrl || location.href,
                path: path || '',
                size: size || 0,
                date: dateStr,
                domain: rootDomain
            };

            // Добавляем в быстрый кеш
            addRecordToMemoryCache(record);

            const tx = db.transaction(MOSSAD_STORE_NAME, 'readwrite');
            tx.objectStore(MOSSAD_STORE_NAME).put(record);
            return new Promise((resolve) => {
                tx.oncomplete = () => {
                    console.log(`[MOSSAD DB] Файл сохранен в историю: ${filename} [${record.type}] (hash: ${hash ? hash.slice(0, 8) : 'none'})`);
                    resolve(true);
                };
                tx.onerror = () => resolve(false);
            });
        } catch (e) {
            console.error('[MOSSAD DB] Ошибка сохранения в IndexedDB:', e);
            return false;
        }
    }

    /**
     * Показывает компактное Glassmorphic-уведомление справа под виджетом
     * о том, что файл уже скачивался, с таймером подтверждения на 6 секунд.
     * @param {Object} record          - запись из истории
     * @param {Function} onConfirmDownload - коллбек, замыкающий URL/media момента нажатия
     * @param {string} [lockedPostUrl] - URL поста в момент нажатия (фиксируется!)
     * @param {string} [lockedMediaUrl] - URL медиа в момент нажатия (фиксируется!)
     */
    function showDuplicateDownloadNotice(record, onConfirmDownload, lockedPostUrl, lockedMediaUrl) {
        // Если включена галочка «Качать дубли»: качаем сразу и показываем укороченное уведомление без таймера
        if (config.allowDuplicates) {
            showToast(`⚠️ Дубликат: ${record.filename || 'файл'} (${record.date || 'ранее'})`, false, 3000);
            if (typeof onConfirmDownload === 'function') {
                onConfirmDownload();
            }
            return;
        }

        // Удаляем старое уведомление, если висит
        const existing = document.getElementById('mossad-dup-warning');
        if (existing) existing.remove();
        if (_dupTimerInterval) clearInterval(_dupTimerInterval);

        const container = document.getElementById('mossad-widget-container') || document.body;

        const notice = document.createElement('div');
        notice.id = 'mossad-dup-warning';
        notice.style.cssText = `
            background: rgba(25, 20, 20, 0.95); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 10px; padding: 8px 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-family: system-ui, -apple-system, sans-serif;
            color: #e5e7eb; font-size: 12px; display: flex; flex-direction: column; gap: 4px;
            animation: mossadFadeIn 0.2s ease; margin-top: 6px; z-index: 999999;
        `;

        let secondsLeft = 6;

        notice.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#f87171; display:flex; align-items:center; gap:4px;">
                    ⚠️ Уже скачивался
                </span>
                <button id="mossad-dup-close" style="background:transparent; border:none; color:#9ca3af; cursor:pointer; font-size:12px; padding:0 4px;">✕</button>
            </div>
            <div style="color:#f3f4f6; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;" title="${record.filename}">
                📄 ${record.filename}
            </div>
            <div style="color:#9ca3af; font-size:11px;">
                📅 ${record.date || 'ранее'}
            </div>
            <div id="mossad-dup-timer-txt" style="color:#facc15; font-size:11px; font-weight:bold; margin-top:2px;">
                ⏱ Нажмите «Скачать» за ${secondsLeft}с для повтора
            </div>
        `;

        container.appendChild(notice);

        const closeNotice = () => {
            if (_dupTimerInterval) clearInterval(_dupTimerInterval);
            _pendingDuplicateConfirm = null;
            if (notice && notice.parentNode) notice.remove();
        };

        notice.querySelector('#mossad-dup-close').onclick = closeNotice;

        // Сохраняем ожидание подтверждения — фиксируем URL/ID файла МОМЕНТА нажатия,
        // чтобы подтверждение сработало только для того же файла, а не любого дубля.
        const lockedId = record.id || record.hash || lockedMediaUrl || lockedPostUrl || '';
        _pendingDuplicateConfirm = {
            id: lockedId,
            lockedPostUrl: lockedPostUrl || '',
            lockedMediaUrl: lockedMediaUrl || '',
            expiresAt: Date.now() + 6000,
            confirm: () => {
                closeNotice();
                if (typeof onConfirmDownload === 'function') onConfirmDownload();
            }
        };

        _dupTimerInterval = setInterval(() => {
            secondsLeft--;
            const timerTxt = notice.querySelector('#mossad-dup-timer-txt');
            if (timerTxt) timerTxt.textContent = `⏱ Нажмите «Скачать» за ${secondsLeft}с для повтора`;
            if (secondsLeft <= 0) {
                closeNotice();
            }
        }, 1000);
    }

    /**
     * Проверяет, активно ли подтверждение повторного скачивания для текущего файла.
     * Подтверждение действительно ТОЛЬКО для того файла (postUrl или mediaUrl),
     * по которому было показано уведомление — скроллинг к другому посту не даёт пройти.
     * @param {string} fileIdentifier - URL поста или медиа для сравнения
     */
    function isDuplicateConfirmed(fileIdentifier) {
        if (!_pendingDuplicateConfirm) return false;
        if (Date.now() > _pendingDuplicateConfirm.expiresAt) return false;
        // Если идентификатор совпадает с зафиксированным URL поста или медиа — подтверждено
        if (fileIdentifier) {
            const lp = _pendingDuplicateConfirm.lockedPostUrl;
            const lm = _pendingDuplicateConfirm.lockedMediaUrl;
            if (lp && fileIdentifier === lp) return true;
            if (lm && fileIdentifier === lm) return true;
            // Fallback: если id совпадает (хеш / id записи)
            if (_pendingDuplicateConfirm.id && fileIdentifier === _pendingDuplicateConfirm.id) return true;
            return false;
        }
        // Без идентификатора — не подтверждаем (безопаснее)
        return false;
    }

    /**
     * Импорт массива записей из JSON в IndexedDB и in-memory кеш.
     */
    async function importDownloadHistory(records) {
        if (!Array.isArray(records) || records.length === 0) return 0;
        try {
            const db = await getDownloadDB();
            const tx = db.transaction(MOSSAD_STORE_NAME, 'readwrite');
            const store = tx.objectStore(MOSSAD_STORE_NAME);
            let imported = 0;

            for (const r of records) {
                if (r.hash || r.filename) {
                    const isVid = r.type === 'video' || (r.filename && /\.(mp4|webm|mov|mkv)$/i.test(r.filename));
                    const item = {
                        id: r.hash || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        hash: r.hash || '',
                        filename: r.filename || 'unknown',
                        type: isVid ? 'video' : 'photo',
                        path: r.path || '',
                        size: r.size || 0,
                        date: r.date || new Date().toISOString().slice(0, 19).replace('T', ' '),
                        url: r.url || '',
                        postUrl: r.postUrl || '',
                        domain: r.domain || 'local_import'
                    };
                    store.put(item);
                    addRecordToMemoryCache(item);
                    imported++;
                }
            }

            return new Promise((resolve) => {
                tx.oncomplete = () => {
                    _isCacheLoaded = true;
                    console.log(`[MOSSAD DB] Импортировано ${imported} записей в базу и кеш.`);
                    resolve(imported);
                };
                tx.onerror = () => resolve(0);
            });
        } catch (e) {
            console.error('[MOSSAD DB] Ошибка импорта истории:', e);
            return 0;
        }
    }

// ============================================================
    // METADATA INJECTOR (MP4, JPEG, PNG, WebP)
    // ============================================================

    // CRC32 table for PNG chunk generation
    let _crcTable = null;
    function getCrcTable() {
        if (_crcTable) return _crcTable;
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[i] = c >>> 0;
        }
        _crcTable = table;
        return table;
    }

    function calculateCrc32(bytes) {
        const table = getCrcTable();
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) {
            crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в PNG файл через tEXt чанки.
     */
    function injectPngMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            // Проверка PNG сигнатуры: 89 50 4E 47 0D 0A 1A 0A
            if (u8.length < 33 || u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4E || u8[3] !== 0x47) {
                return buffer;
            }

            // Первый чанк IHDR: длина 13 байт (заголовок 8 байт, данные 13, crc 4 = 25 байт). Заканчивается на 8 + 25 = 33
            const insertPos = 33;
            const textEncoder = new TextEncoder();

            function makeTextChunk(keyword, text) {
                const kwBytes = textEncoder.encode(keyword);
                const valBytes = textEncoder.encode(text);
                const chunkData = new Uint8Array(kwBytes.length + 1 + valBytes.length);
                chunkData.set(kwBytes, 0);
                chunkData[kwBytes.length] = 0; // null separator
                chunkData.set(valBytes, kwBytes.length + 1);

                const chunkLen = chunkData.length;
                const chunk = new Uint8Array(8 + chunkLen + 4);
                const view = new DataView(chunk.buffer);
                view.setUint32(0, chunkLen, false);
                chunk[4] = 0x74; chunk[5] = 0x45; chunk[6] = 0x58; chunk[7] = 0x74; // 'tEXt'
                chunk.set(chunkData, 8);

                // CRC считается от типа чанка (4 байта) + данных чанка
                const crcBytes = chunk.subarray(4, 8 + chunkLen);
                const crc = calculateCrc32(crcBytes);
                view.setUint32(8 + chunkLen, crc, false);
                return chunk;
            }

            const commentText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const chunks = [
                makeTextChunk('Description', prompt),
                makeTextChunk('Comment', commentText),
                makeTextChunk('Source', url),
                makeTextChunk('prompt', prompt),
                makeTextChunk('parameters', prompt)
            ];
            if (model) {
                chunks.push(makeTextChunk('source', model));
                chunks.push(makeTextChunk('model', model));
            }
            if (promptHash) {
                chunks.push(makeTextChunk('prompt_hash', promptHash));
            }
            chunks.push(makeTextChunk('timestamp', new Date().toISOString().replace('T', ' ').slice(0, 19)));

            const totalChunksLen = chunks.reduce((acc, c) => acc + c.length, 0);
            const result = new Uint8Array(u8.length + totalChunksLen);
            result.set(u8.subarray(0, insertPos), 0);
            let offset = insertPos;
            for (const ch of chunks) {
                result.set(ch, offset);
                offset += ch.length;
            }
            result.set(u8.subarray(insertPos), offset);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectPngMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в JPEG файл через COM и XMP маркеры.
     */
    function injectJpegMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            if (u8.length < 4 || u8[0] !== 0xFF || u8[1] !== 0xD8) {
                return buffer; // Не JPEG
            }

            const textEncoder = new TextEncoder();
            const comText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const comBytes = textEncoder.encode(comText);
            const comLen = Math.min(comBytes.length, 65530);

            // 1. COM маркер: FF FE [длина 2 байта] [текст]
            const comMarker = new Uint8Array(4 + comLen);
            comMarker[0] = 0xFF; comMarker[1] = 0xFE;
            const comView = new DataView(comMarker.buffer);
            comView.setUint16(2, comLen + 2, false);
            comMarker.set(comBytes.subarray(0, comLen), 4);

            // 2. XMP APP1 маркер: FF E1 [длина 2 байта] [http://ns.adobe.com/xap/1.0/\0] [XML]
            const escapeXml = (s) => (s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
            const cleanXmlPrompt = escapeXml(prompt);
            const cleanXmlUrl = escapeXml(url);
            const cleanXmlModel = escapeXml(model || 'Grok');
            const cleanXmlTitle = escapeXml((prompt || '').slice(0, 60));
            const cleanXmlHash = escapeXml(promptHash);

            const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlPrompt}</rdf:li></rdf:Alt></dc:description><dc:source>${cleanXmlUrl}</dc:source><dc:creator><rdf:Seq><rdf:li>${cleanXmlModel}</rdf:li></rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlTitle}</rdf:li></rdf:Alt></dc:title><dc:identifier>${cleanXmlHash}</dc:identifier></rdf:Description></rdf:RDF></x:xmpmeta>`;
            const xmpHeader = textEncoder.encode('http://ns.adobe.com/xap/1.0/\0');
            const xmpXmlBytes = textEncoder.encode(xmpXml);
            const xmpPayloadLen = xmpHeader.length + xmpXmlBytes.length;

            let xmpMarker = null;
            if (xmpPayloadLen + 2 < 65535) {
                xmpMarker = new Uint8Array(4 + xmpPayloadLen);
                xmpMarker[0] = 0xFF; xmpMarker[1] = 0xE1;
                const xmpView = new DataView(xmpMarker.buffer);
                xmpView.setUint16(2, xmpPayloadLen + 2, false);
                xmpMarker.set(xmpHeader, 4);
                xmpMarker.set(xmpXmlBytes, 4 + xmpHeader.length);
            }

            // Находим место вставки: сразу после SOI (байты 0, 1) или после APP0 (FF E0), если он есть
            let insertPos = 2;
            if (u8.length > 4 && u8[2] === 0xFF && u8[3] === 0xE0) {
                const app0Len = (u8[4] << 8) | u8[5];
                insertPos = 4 + app0Len;
            }

            const extraLen = comMarker.length + (xmpMarker ? xmpMarker.length : 0);
            const result = new Uint8Array(u8.length + extraLen);
            result.set(u8.subarray(0, insertPos), 0);
            let curPos = insertPos;
            result.set(comMarker, curPos);
            curPos += comMarker.length;
            if (xmpMarker) {
                result.set(xmpMarker, curPos);
                curPos += xmpMarker.length;
            }
            result.set(u8.subarray(insertPos), curPos);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectJpegMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в MP4 (ISO BMFF / QuickTime) в атом moov.udta.meta.ilst.
     * Корректирует таблицы смещений чанков stco/co64 при сдвиге mdat.
     */
    function injectMp4Metadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            const view = new DataView(buffer);
            const len = u8.length;

            // Парсим верхнеуровневые атомы
            let pos = 0;
            let moovStart = -1, moovLen = 0;
            let mdatStart = -1;

            while (pos + 8 <= len) {
                let boxSize = view.getUint32(pos, false);
                const bType = String.fromCharCode(u8[pos+4], u8[pos+5], u8[pos+6], u8[pos+7]);
                let headerLen = 8;
                if (boxSize === 1 && pos + 16 <= len) {
                    // 64-битный размер
                    const hi = view.getUint32(pos + 8, false);
                    const lo = view.getUint32(pos + 12, false);
                    boxSize = hi * 4294967296 + lo;
                    headerLen = 16;
                } else if (boxSize === 0) {
                    boxSize = len - pos;
                }
                if (boxSize < headerLen || pos + boxSize > len) break;

                if (bType === 'moov') {
                    moovStart = pos;
                    moovLen = boxSize;
                } else if (bType === 'mdat') {
                    mdatStart = pos;
                }
                pos += boxSize;
            }

            if (moovStart === -1 || moovLen === 0) {
                return buffer; // moov не найден
            }

            const textEncoder = new TextEncoder();

            function makeMp4Box(typeStr, payloadBytes) {
                const box = new Uint8Array(8 + payloadBytes.length);
                const bView = new DataView(box.buffer);
                bView.setUint32(0, box.length, false);
                for (let i = 0; i < 4; i++) {
                    box[4 + i] = typeStr.charCodeAt(i);
                }
                box.set(payloadBytes, 8);
                return box;
            }

            function makeIlstItem(tagBytes, text) {
                const textBytes = textEncoder.encode(text);
                // Box 'data': 4 байта длина (16 + textBytes.length), 'data', 1 байт version=0, 3 байта flags=1 (UTF-8), 4 байта locale=0
                const dataBox = new Uint8Array(16 + textBytes.length);
                const dView = new DataView(dataBox.buffer);
                dView.setUint32(0, dataBox.length, false);
                dataBox[4] = 0x64; dataBox[5] = 0x61; dataBox[6] = 0x74; dataBox[7] = 0x61; // 'data'
                dataBox[8] = 0; dataBox[9] = 0; dataBox[10] = 0; dataBox[11] = 1; // version 0, type 1 (UTF-8)
                dView.setUint32(12, 0, false); // locale 0
                dataBox.set(textBytes, 16);

                const itemBox = new Uint8Array(8 + dataBox.length);
                const iView = new DataView(itemBox.buffer);
                iView.setUint32(0, itemBox.length, false);
                itemBox.set(tagBytes, 4);
                itemBox.set(dataBox, 8);
                return itemBox;
            }

            // Собираем элементы ilst
            const tagDes = new Uint8Array([0xA9, 0x64, 0x65, 0x73]); // '©des' (Description)
            const tagCmt = new Uint8Array([0xA9, 0x63, 0x6D, 0x74]); // '©cmt' (Comment)
            const tagUrl1 = new Uint8Array([0x70, 0x75, 0x72, 0x6C]); // 'purl' (Posting URL)
            const tagUrl2 = new Uint8Array([0xA9, 0x75, 0x72, 0x6C]); // '©url' (URL)
            const tagArt  = new Uint8Array([0xA9, 0x41, 0x52, 0x54]); // '©ART' (Artist / Model)
            const tagNam  = new Uint8Array([0xA9, 0x6E, 0x61, 0x6D]); // '©nam' (Title)

            const commentText = `Prompt: ${prompt}\nURL: ${url}${model ? `\nModel: ${model}` : ''}${promptHash ? `\nHash: ${promptHash}` : ''}`;
            const items = [
                makeIlstItem(tagDes, prompt),
                makeIlstItem(tagCmt, commentText),
                makeIlstItem(tagUrl1, url),
                makeIlstItem(tagUrl2, url)
            ];
            if (model) {
                items.push(makeIlstItem(tagArt, model));
            }
            if (prompt) {
                items.push(makeIlstItem(tagNam, prompt.slice(0, 60)));
            }

            const totalItemsLen = items.reduce((acc, it) => acc + it.length, 0);
            const ilstPayload = new Uint8Array(totalItemsLen);
            let ilstOff = 0;
            for (const it of items) {
                ilstPayload.set(it, ilstOff);
                ilstOff += it.length;
            }
            const ilstBox = makeMp4Box('ilst', ilstPayload);

            // Handler box 'hdlr' для meta
            const hdlrBox = new Uint8Array(33);
            const hView = new DataView(hdlrBox.buffer);
            hView.setUint32(0, 33, false);
            hdlrBox[4] = 0x68; hdlrBox[5] = 0x64; hdlrBox[6] = 0x6C; hdlrBox[7] = 0x72; // 'hdlr'
            hView.setUint32(8, 0, false); // version + flags
            hView.setUint32(12, 0, false); // pre_defined
            hdlrBox[16] = 0x6D; hdlrBox[17] = 0x64; hdlrBox[18] = 0x69; hdlrBox[19] = 0x72; // 'mdir'
            hdlrBox[20] = 0x61; hdlrBox[21] = 0x70; hdlrBox[22] = 0x70; hdlrBox[23] = 0x6C; // 'appl'
            hView.setUint32(24, 0, false); // flags
            hView.setUint32(28, 0, false); // flags mask
            hdlrBox[32] = 0; // name empty string

            // Box 'meta': FullBox (version 0 + flags 0 = 4 байта) + hdlr + ilst
            const metaPayload = new Uint8Array(4 + hdlrBox.length + ilstBox.length);
            metaPayload[0] = 0; metaPayload[1] = 0; metaPayload[2] = 0; metaPayload[3] = 0;
            metaPayload.set(hdlrBox, 4);
            metaPayload.set(ilstBox, 4 + hdlrBox.length);
            const metaBox = makeMp4Box('meta', metaPayload);

            // Box 'udta'
            const udtaBox = makeMp4Box('udta', metaBox);

            // Ищем и вырезаем старый udta внутри moov, если он был
            let oldUdtaStart = -1, oldUdtaLen = 0;
            let mPos = moovStart + 8;
            const moovEnd = moovStart + moovLen;

            while (mPos + 8 <= moovEnd) {
                const subSize = view.getUint32(mPos, false);
                const subType = String.fromCharCode(u8[mPos+4], u8[mPos+5], u8[mPos+6], u8[mPos+7]);
                if (subSize < 8 || mPos + subSize > moovEnd) break;
                if (subType === 'udta') {
                    oldUdtaStart = mPos;
                    oldUdtaLen = subSize;
                    break;
                }
                mPos += subSize;
            }

            const delta = udtaBox.length - oldUdtaLen;

            // Создаем копию буфера moov (без старого udta, но с новым udta)
            let moovBodyBeforeUdta, moovBodyAfterUdta;
            if (oldUdtaStart !== -1) {
                moovBodyBeforeUdta = u8.slice(moovStart + 8, oldUdtaStart);
                moovBodyAfterUdta = u8.slice(oldUdtaStart + oldUdtaLen, moovEnd);
            } else {
                moovBodyBeforeUdta = u8.slice(moovStart + 8, moovEnd);
                moovBodyAfterUdta = new Uint8Array(0);
            }

            const newMoovLen = moovLen + delta;
            const newMoovBytes = new Uint8Array(newMoovLen);
            const newMoovView = new DataView(newMoovBytes.buffer);
            newMoovView.setUint32(0, newMoovLen, false);
            newMoovBytes[4] = 0x6D; newMoovBytes[5] = 0x6F; newMoovBytes[6] = 0x6F; newMoovBytes[7] = 0x76; // 'moov'

            let writeOffset = 8;
            newMoovBytes.set(moovBodyBeforeUdta, writeOffset);
            writeOffset += moovBodyBeforeUdta.length;
            newMoovBytes.set(moovBodyAfterUdta, writeOffset);
            writeOffset += moovBodyAfterUdta.length;
            newMoovBytes.set(udtaBox, writeOffset);

            // Если moov расположен до mdat (faststart MP4), смещаем все chunk offsets на величину delta!
            if (mdatStart !== -1 && moovStart < mdatStart && delta !== 0) {
                // Ищем все stco и co64 внутри нового moov
                let scanPos = 0;
                while (scanPos + 8 <= newMoovBytes.length) {
                    const bSize = newMoovView.getUint32(scanPos, false);
                    if (bSize < 8 || scanPos + bSize > newMoovBytes.length) {
                        scanPos++;
                        continue;
                    }
                    const tag = String.fromCharCode(
                        newMoovBytes[scanPos+4], newMoovBytes[scanPos+5],
                        newMoovBytes[scanPos+6], newMoovBytes[scanPos+7]
                    );
                    if (tag === 'stco') {
                        const entryCount = newMoovView.getUint32(scanPos + 12, false);
                        for (let i = 0; i < entryCount; i++) {
                            const curOff = newMoovView.getUint32(scanPos + 16 + i * 4, false);
                            newMoovView.setUint32(scanPos + 16 + i * 4, curOff + delta, false);
                        }
                    } else if (tag === 'co64') {
                        const entryCount = newMoovView.getUint32(scanPos + 12, false);
                        for (let i = 0; i < entryCount; i++) {
                            const curOffHi = newMoovView.getUint32(scanPos + 16 + i * 8, false);
                            const curOffLo = newMoovView.getUint32(scanPos + 20 + i * 8, false);
                            let off = BigInt(curOffHi) * 4294967296n + BigInt(curOffLo);
                            off += BigInt(delta);
                            newMoovView.setUint32(scanPos + 16 + i * 8, Number(off / 4294967296n), false);
                            newMoovView.setUint32(scanPos + 20 + i * 8, Number(off % 4294967296n), false);
                        }
                    }
                    scanPos += 4;
                }
            }

            // Собираем итоговый файл
            const result = new Uint8Array(len + delta);
            result.set(u8.subarray(0, moovStart), 0);
            result.set(newMoovBytes, moovStart);
            result.set(u8.subarray(moovStart + moovLen), moovStart + newMoovLen);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectMp4Metadata error:', e);
            return buffer;
        }
    }

    /**
     * Внедряет метаданные (промпт, ссылку, модель и хэш) в WebP файл (RIFF контейнер) через XMP чанк.
     */
    function injectWebpMetadata(buffer, prompt, url, model = '', promptHash = '') {
        try {
            const u8 = new Uint8Array(buffer);
            const view = new DataView(buffer);
            if (u8.length < 12) return buffer;
            // Проверка 'RIFF' и 'WEBP'
            const riff = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
            const webp = String.fromCharCode(u8[8], u8[9], u8[10], u8[11]);
            if (riff !== 'RIFF' || webp !== 'WEBP') return buffer;

            const textEncoder = new TextEncoder();
            const escapeXml = (s) => (s || '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
            const cleanXmlPrompt = escapeXml(prompt);
            const cleanXmlUrl = escapeXml(url);
            const cleanXmlModel = escapeXml(model || 'Grok');
            const cleanXmlTitle = escapeXml((prompt || '').slice(0, 60));
            const cleanXmlHash = escapeXml(promptHash);

            const xmpXml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlPrompt}</rdf:li></rdf:Alt></dc:description><dc:source>${cleanXmlUrl}</dc:source><dc:creator><rdf:Seq><rdf:li>${cleanXmlModel}</rdf:li></rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${cleanXmlTitle}</rdf:li></rdf:Alt></dc:title><dc:identifier>${cleanXmlHash}</dc:identifier></rdf:Description></rdf:RDF></x:xmpmeta>`;
            const xmpBytes = textEncoder.encode(xmpXml);

            // Чанк XMP в RIFF: 'XMP ' (4 байта) + 4 байта длина (little-endian) + данные + паддинг до четного
            const pad = (xmpBytes.length % 2 === 1) ? 1 : 0;
            const chunkLen = 8 + xmpBytes.length + pad;
            const xmpChunk = new Uint8Array(chunkLen);
            const chView = new DataView(xmpChunk.buffer);
            xmpChunk[0] = 0x58; xmpChunk[1] = 0x4D; xmpChunk[2] = 0x50; xmpChunk[3] = 0x20; // 'XMP '
            chView.setUint32(4, xmpBytes.length, true); // little-endian
            xmpChunk.set(xmpBytes, 8);

            const result = new Uint8Array(u8.length + chunkLen);
            result.set(u8, 0);
            result.set(xmpChunk, u8.length);

            // Обновляем размер RIFF в заголовке (offset 4, 4 байта little-endian = размер_файла - 8)
            const resView = new DataView(result.buffer);
            resView.setUint32(4, result.length - 8, true);
            return result.buffer;
        } catch (e) {
            console.warn('[MOSSAD] injectWebpMetadata error:', e);
            return buffer;
        }
    }

    /**
     * Главная точка входа: определяет тип медиа и внедряет метаданные (промпт, URL, модель, хэш).
     * @param {Blob} rawBlob
     * @param {string} prompt
     * @param {string} url
     * @param {string} model
     * @param {string} promptHash
     * @returns {Promise<Blob>}
     */
    async function injectGrokMetadataToBlob(rawBlob, prompt, url, model = '', promptHash = '') {
        if (!rawBlob) return rawBlob;
        const cleanPrompt = (prompt || '').trim();
        const cleanUrl = (url || location.href || '').trim();
        if (!cleanPrompt && !cleanUrl && !model) return rawBlob;

        try {
            const arrayBuffer = await rawBlob.arrayBuffer();
            const u8 = new Uint8Array(arrayBuffer);
            if (u8.length < 12) return rawBlob;

            let enrichedBuffer = arrayBuffer;

            // 1. Проверка MP4 (байты 4..7 === 'ftyp')
            if (u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
                enrichedBuffer = injectMp4Metadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 2. Проверка PNG (сигнатура 89 50 4E 47)
            else if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
                enrichedBuffer = injectPngMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 3. Проверка JPEG (FF D8)
            else if (u8[0] === 0xFF && u8[1] === 0xD8) {
                enrichedBuffer = injectJpegMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }
            // 4. Проверка WebP (RIFF....WEBP)
            else if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
                     u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
                enrichedBuffer = injectWebpMetadata(arrayBuffer, cleanPrompt, cleanUrl, model, promptHash);
            }

            return new Blob([enrichedBuffer], { type: rawBlob.type || 'application/octet-stream' });
        } catch (err) {
            console.warn('[MOSSAD] injectGrokMetadataToBlob error:', err);
            return rawBlob;
        }
    }

// ============================================================
    // GROK ENGINE: Constants & Page Predicates
    // ============================================================
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const GALLERY_LOOP_KEY       = 'mossad_grok_loop_set';
    const GALLERY_COLLECT_ACTIVE_KEY = 'mossad_grok_collect_active'; // флаг автосбора ссылок
    const _gSS                   = sessionStorage; // короткий псевдоним
    // v1.3.42: кадры киноплёнки (в них бывают <video>/<img> других генераций — это не медиа текущего поста)
    const GROK_FILMSTRIP_SEL     = '[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]';

    /** Проверка: находимся ли мы на странице поста Grok Imagine */
    function isGrokPostPage() {
        return rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    }

    /** Проверка: находимся ли мы на странице сохраненных постов Grok Imagine */
    function isGrokSavedPage() {
        return rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);
    }

// ============================================================
    // GROK HELPERS: Button Finders (см. также sound / upscale / media / download / filmstrip / navigation)
    // ============================================================

    /**
     * Поиск кнопки/кликабельного элемента по ключевым словам (aria-label, title, textContent).
     * Регистронезависимый (case-insensitive) поиск, универсален для RU/EN.
     */
    function findGrokButton(keywords, rootEl = document) {
        if (!Array.isArray(keywords)) keywords = [keywords];
        const lowerKeywords = keywords.map(k => k.toLowerCase().trim());
        const candidates = Array.from(rootEl.querySelectorAll('button, [role="button"], [role="menuitem"], a'));
        return candidates.find(el => {
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) return false;
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const txt = (el.textContent || '').trim().toLowerCase();
            return lowerKeywords.some(k => aria.includes(k) || title.includes(k) || txt.includes(k));
        }) || null;
    }

    /**
     * Находит кнопку «три точки» (меню действий с постом) в Grok.
     */
    function findGrok3DotsMenuButton() {
        // 1. Поиск по aria-label и тексту
        const byLabel = findGrokButton([
            'действия с постом', 'post actions', 'more options', 'more', 'ещё', 'три точки'
        ]);
        if (byLabel) return byLabel;

        // 2. Поиск по SVG иконке (кнопка с 3 точками / кругами)
        return Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes('post') || aria.includes('действи') || aria.includes('more')) return true;
            const svgs = b.querySelectorAll('svg');
            for (const svg of svgs) {
                if (svg.querySelectorAll('circle').length >= 3) return true;
                const path = svg.querySelector('path');
                const d = path ? (path.getAttribute('d') || '') : '';
                if (d.includes('M12') && d.includes('C12')) return true;
            }
            return false;
        }) || null;
    }

// ============================================================
    // GROK: Sound Toggle (Mute / Unmute via Player DOM Button)
    // ============================================================
    // v1.3.32: Grok добавил кнопку, начинающуюся с иконки ноты (выбор музыки / аудио-дорожки).
    // Старый поиск findGrokButton(['звук','sound',...]) брал ПЕРВУЮ видимую кнопку, у которой
    // одно из слов встречалось в aria-label / title / textContent (подстрокой). Кнопка с нотой
    // (например «Добавить звук» / «Sound» / «Music») стоит в DOM раньше кнопки mute и
    // перехватывала хоткей. Теперь — скоринг кандидатов с явным исключением «музыкальных» кнопок.

    // Сильные признаки именно mute/unmute (сравниваем с aria-label / title).
    const GROK_MUTE_WORDS = [
        'mute', 'unmute', 'заглушить', 'включить звук', 'выключить звук', 'отключить звук', 'без звука', 'со звуком'
    ];
    // Слабые признаки — только в aria-label / title, не в textContent.
    const GROK_SOUND_WORDS = ['звук', 'sound', 'volume', 'громкость'];
    // Признаки кнопок выбора музыки / аудио-дорожки — такие кнопки НИКОГДА не кликаем.
    const GROK_MUSIC_WORDS = [
        'music', 'музык', 'song', 'песн', 'track', 'трек', 'дорожк', 'melod', 'мелод', 'soundtrack',
        'add sound', 'add audio', 'добавить звук', 'добавить аудио', 'choose', 'select', 'выбрать', 'generate', 'сгенерир'
    ];
    const GROK_MUSIC_GLYPHS = /^[\s]*[\u266A\u266B\u266C\u{1F3B5}\u{1F3B6}\u{1F3BC}]/u; // ♪ ♫ ♬ 🎵 🎶 🎼

    /** true, если ведущая иконка / подпись кнопки — нота (кнопка выбора музыки). */
    function isGrokMusicNoteButton(el) {
        const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
        if (GROK_MUSIC_WORDS.some(w => label.includes(w))) return true;
        const txt = (el.textContent || '').trim();
        if (GROK_MUSIC_GLYPHS.test(txt)) return true;
        if (GROK_MUSIC_WORDS.some(w => txt.toLowerCase().includes(w))) return true;
        // Ведущая иконка: первый <img>/<svg> внутри кнопки
        const icon = el.querySelector('img, svg');
        if (icon) {
            const iconSig = [
                icon.getAttribute('alt'), icon.getAttribute('src'), icon.getAttribute('aria-label'),
                icon.getAttribute('data-icon'), icon.getAttribute('class')
            ].map(s => (s || '').toLowerCase()).join(' ');
            if (/music|note|nota|нота|музык|audio-lines|audio_track|song/.test(iconSig)) return true;
        }
        return false;
    }

    /**
     * Находит настоящую кнопку mute/unmute плеера Grok (или null).
     * Скоринг: сильные слова в aria/title, иконка громкости, близость к активному <video>.
     * Исключаются: невидимые, «музыкальные» кнопки, кнопки, открывающие меню (aria-haspopup).
     */
    function findGrokSoundToggleButton(opts = {}) {
        // v1.3.42: opts.includeHidden — для определения «видео или фото» (grokDetectSlideMedia):
        // кнопка mute плеера Grok скрыта, пока мышь не над видео, но в DOM она есть. Кликать по ней
        // хоткеем по-прежнему можно только по видимой (вызов без опций).
        const includeHidden = !!opts.includeHidden;
        const video = (typeof getActiveVideo === 'function') ? getActiveVideo() : null;
        // Контейнер плеера: несколько уровней вверх от <video>
        const playerRoots = [];
        if (video) {
            let n = video.parentElement;
            for (let i = 0; i < 4 && n; i++, n = n.parentElement) playerRoots.push(n);
        }
        let best = null, bestScore = 0;
        const candidates = document.querySelectorAll('button, [role="button"]');
        for (const el of candidates) {
            if (!includeHidden && el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) continue;
            if (el.closest('#mossad-widget, [id^="mossad-"]')) continue; // свои кнопки MOSSAD не трогаем
            if (el.closest(GROK_FILMSTRIP_SEL)) continue; // кадры киноплёнки — не плеер
            if (isGrokMusicNoteButton(el)) continue;
            // v1.3.43: «Make video» (белый треугольник в круге) — генерация видео из фото, не плеер
            if (/make\s*video/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' '))) continue;
            if (el.hasAttribute('aria-haspopup')) continue; // mute не открывает меню
            const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase().trim();
            const txt = (el.textContent || '').trim().toLowerCase();
            const svgCls = Array.from(el.querySelectorAll('svg')).map(s => (s.getAttribute('class') || '').toLowerCase()).join(' ');
            let score = 0;
            if (GROK_MUTE_WORDS.some(w => label.includes(w))) score += 10;
            else if (GROK_MUTE_WORDS.some(w => txt === w)) score += 8;
            else if (txt === '' && GROK_SOUND_WORDS.some(w => label.includes(w))) score += 4;
            // ↑ слабое слово («звук»/«sound») засчитываем только для icon-only кнопки:
            //   у кнопки с нотой есть видимая подпись, у mute-иконки плеера — нет.
            if (txt === '' && /volume|speaker|mute/.test(svgCls)) score += 4; // lucide-volume-2 / lucide-volume-x и т.п.
            if (score === 0) continue;
            const nearPlayer = playerRoots.some(r => r.contains(el));
            if (score < 8 && !nearPlayer) continue; // слабые совпадения — только рядом с активным <video>
            if (nearPlayer) score += 3;
            if (score > bestScore) { best = el; bestScore = score; }
        }
        return best;
    }

    // ── v1.3.39: отдельный тост состояния звука (~5 с) с крестиком ──
    // × закрывает ТОЛЬКО текущий тост — ничего не запоминается. Показ включается/выключается в F1
    // (config.showSoundToast, по умолчанию вкл.). Крепится к fullscreen-элементу, если он есть
    // (иначе в полноэкранном плеере тост в document.body не виден).
    let _soundToastTimer = null;

    function showSoundToast(message) {
        if (config.showSoundToast === false) return;
        const host = document.fullscreenElement || document.body;
        let t = document.getElementById('mossad-sound-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'mossad-sound-toast';
            t.style.cssText = `
                position: fixed; bottom: 64px; left: 50%; transform: translateX(-50%); z-index: 2147483646;
                display: flex; align-items: center; gap: 10px;
                padding: 8px 10px 8px 16px; background: rgba(20, 20, 20, 0.92); backdrop-filter: blur(10px);
                border: 1px solid #10b981; border-radius: 10px; color: #6ee7b7;
                font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: auto;
                transition: opacity 0.2s ease; opacity: 0;
            `;
            const txt = document.createElement('span');
            txt.className = 'mossad-sound-toast-text';
            const x = document.createElement('button');
            mossadLabelEl(x, 'toastClose');
            x.title = 'Закрыть (только это уведомление)';
            x.style.cssText = 'background:none;border:none;color:#9ca3af;font-size:16px;line-height:1;cursor:pointer;padding:0 4px;';
            x.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (_soundToastTimer) { clearTimeout(_soundToastTimer); _soundToastTimer = null; }
                t.style.opacity = '0';
                setTimeout(() => { if (t.style.opacity === '0') t.remove(); }, 250);
            };
            t.append(txt, x);
        }
        if (t.parentNode !== host) host.appendChild(t);
        t.querySelector('.mossad-sound-toast-text').textContent = message;
        t.style.opacity = '1';
        if (_soundToastTimer) clearTimeout(_soundToastTimer);
        _soundToastTimer = setTimeout(() => {
            _soundToastTimer = null;
            t.style.opacity = '0';
            setTimeout(() => { if (t.style.opacity === '0') t.remove(); }, 250);
        }, 5000);
    }

    function toggleGrokSound() {
        if (rootDomain !== 'grok.com') return;
        blurActiveInput();

        const btn = findGrokSoundToggleButton();
        if (btn) {
            const video = (typeof getActiveVideo === 'function') ? getActiveVideo() : null;
            const labelBefore = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || '').toLowerCase();
            triggerClick(btn, 'Grok Sound Toggle');
            // Тост по фактическому состоянию <video> (после того как плеер применит клик);
            // если видео нет — по подписи кнопки до клика.
            setTimeout(() => {
                let nowMuted;
                if (video && video.isConnected) nowMuted = video.muted;
                else nowMuted = !(labelBefore.includes('включить') || labelBefore.includes('unmute'));
                showSoundToast(nowMuted ? '🔇 Звук выключен' : '🔊 Звук включен');
            }, 150);
            return;
        }

        // Фолбэк на HTML5 video, если кнопка mute в DOM не найдена.
        // ANTI_PATTERNS §2: прямое video.muted может рассинхронизировать иконку плеера Grok,
        // поэтому это только последний вариант (как и до v1.3.32), а не основной путь.
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            showSoundToast(video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
        } else {
            showToast('⚠️ Видео не найдено', true);
        }
    }

// ============================================================
    // GROK: PageUp Upscale (RU/EN, Case-insensitive, Submenu -> 720p)
    // ============================================================
    function runGrokUpscale() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        blurActiveInput();

        const upscaleKeywords = ['upscale', 'enhance', 'improve quality', 'повысить качество', 'улучшить качество', 'увеличить'];

        const triggerPhase2Submenu = () => {
            // Фаза 2: выбор «Увеличить до 720p» / «Upscale to 720p» / «720p»
            const target720pKeywords = ['увеличить до 720p', 'upscale to 720p', '720p'];
            retryAction((attempt) => {
                const subItem = findGrokButton(target720pKeywords);
                if (subItem) {
                    triggerClick(subItem, 'Upscale to 720p');
                    showToast('✅ Увеличение до 720p запущено');
                    return true; // прерывает попытки
                }
                if (attempt === 3) {
                    showToast('ℹ️ Меню 720p не появилось', true);
                }
                return false;
            }, [100, 300, 500]);
        };

        // Фаза 1: ищем основную кнопку Upscale
        const directBtn = findGrokButton(upscaleKeywords);
        if (directBtn) {
            triggerClick(directBtn, 'Upscale Phase 1');
            triggerPhase2Submenu();
            return;
        }

        // Если прямой кнопки нет — пробуем через 3 точки
        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Upscale)');
            retryAction((attempt) => {
                const menuBtn = findGrokButton(upscaleKeywords);
                if (menuBtn) {
                    triggerClick(menuBtn, 'Upscale Phase 1 from 3-dots');
                    triggerPhase2Submenu();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
        } else {
            showToast('⚠️ Кнопка Upscale не найдена', true);
        }
    }

    // ============================================================

// ============================================================
    // GROK: Prompt & Media Finders
    // ============================================================

    /**
     * Извлекает текст промпта для текущего поста Imagine.
     */
    function getGrokCurrentPrompt() {
        // 1. Поле ввода промпта (textarea или contenteditable)
        const ta = document.querySelector('textarea, div[contenteditable="true"]');
        if (ta) {
            const val = (ta.value !== undefined ? ta.value : (ta.innerText || ta.textContent || '')).trim();
            if (val) return val;
        }

        // 2. Alt-атрибут главного изображения поста
        const mainImg = document.querySelector('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img');
        if (mainImg) {
            const alt = (mainImg.getAttribute('alt') || '').trim();
            if (alt && alt.length > 2 && !/^(pfp|profile|avatar|logo|image)$/i.test(alt)) {
                return alt;
            }
        }

        // 3. Мета-теги OpenGraph / description
        const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
        if (metaDesc) {
            const content = (metaDesc.getAttribute('content') || '').trim();
            if (content && !content.toLowerCase().includes('grok is an ai') && !content.toLowerCase().includes('imagine anything')) {
                return content;
            }
        }

        // 4. Текстовые блоки с классом prose или атрибутами
        const promptBlock = document.querySelector('[data-testid*="prompt"], .prose');
        if (promptBlock && promptBlock.textContent.trim()) {
            return promptBlock.textContent.trim();
        }

        return '';
    }

    /**
     * Находит активный медиа-элемент на странице поста Grok (видео или изображение).
     */
    function getGrokMedia() {
        // 1. Видео
        const video = getActiveVideo() || document.querySelector('main video, div[role="dialog"] video, video');
        if (video) {
            let src = '';
            const sources = Array.from(video.querySelectorAll('source'));
            for (const s of sources) {
                if (s.src) { src = s.src; break; }
            }
            if (!src && video.currentSrc) src = video.currentSrc;
            if (!src && video.src) src = video.src;
            if (src) return { url: src, type: 'video', ext: 'mp4' };
        }

        // 2. Изображение
        const candidates = Array.from(document.querySelectorAll('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img, img'));
        const validImgs = candidates.filter(img => {
            if (!img.src) return false;
            const s = img.src.toLowerCase();
            if (s.includes('avatar') || s.includes('profile') || s.includes('pfp') || s.includes('icon')) return false;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            return (w >= 150 && h >= 150) || s.includes('share-images') || s.includes('imagine-public') || s.includes('assets.grok.com');
        }).sort((a, b) => {
            const areaA = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
            const areaB = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
            return areaB - areaA;
        });

        if (validImgs.length > 0) {
            const bestImg = validImgs[0];
            let ext = 'jpg';
            const srcLower = bestImg.src.toLowerCase();
            if (srcLower.includes('.png')) ext = 'png';
            else if (srcLower.includes('.webp')) ext = 'webp';
            return { url: bestImg.src, type: 'photo', ext };
        }

        return null;
    }

    /**
     * Извлекает текущую модель генерации Grok (или возвращает дефолтное 'Grok Imagine').
     */
    function getGrokCurrentModel() {
        const selectors = [
            'button[aria-haspopup="menu"] span',
            'button[data-testid*="model"]',
            '[aria-label*="model" i]',
            '[aria-label*="режим" i]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
                const txt = el.textContent.trim();
                if (/grok|flux|aurora|imagine/i.test(txt)) {
                    return txt;
                }
            }
        }
        return 'Grok Imagine';
    }

    /**
     * Вычисляет короткий хэш промпта (12 hex символов).
     */
    function computeGrokPromptHash(str) {
        if (!str) return '';
        let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, '0').slice(-12);
    }

    /**
     * Фолбэк на клик нативной кнопки Download при невозможности прямой загрузки.
     * Поиск строго по aria-label="download".
     */
    function fallbackGrokNativeClick(onSuccess) {
        let directBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
            return aria === 'download';
        });

        if (directBtn) {
            triggerClick(directBtn, 'Grok Direct Download (Fallback)');
            if (onSuccess) onSuccess();
            return;
        }

        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Fallback Download)');
            retryAction((attempt) => {
                const innerDl = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                    const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                    return aria === 'download';
                });
                if (innerDl) {
                    triggerClick(innerDl, 'Grok Download from 3-dots (Fallback)');
                    if (onSuccess) onSuccess();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
        }
    }

    // ── v1.3.42: быстрое определение «видео или фото» на странице поста ──
    // Раньше слайдшоу ждало до 6 с (см. CHANGELOG v1.3.42, ANTI_PATTERNS §21). Теперь признаки
    // берутся только из просмотрщика текущего поста (без киноплёнки и без кнопок MOSSAD).

    /** <video> просмотрщика поста (без кадров киноплёнки и без элементов MOSSAD). */
    function grokGetViewerVideos() {
        return Array.from(document.querySelectorAll('video')).filter(v =>
            v.isConnected && !v.closest(GROK_FILMSTRIP_SEL) && !v.closest('#mossad-widget, [id^="mossad-"]'));
    }

    /**
     * v1.3.43: лучший <video> поста из списка. Раньше брали «самое видимое», при равенстве — первое в DOM.
     * После круга (повтор) Grok может держать в DOM старый элемент того же поста (на паузе, «замёрзший»
     * на ~1 с) раньше свежего — слайдшоу считало круги по нему и висело. Теперь важнее: src с UUID
     * текущего поста, видео играет, есть данные (readyState), затем видимая площадь.
     */
    /** v1.3.43: src ролика указывает на ДРУГУЮ генерацию (…/generated/<uuid>/…), не на текущий пост. */
    function grokIsForeignVideo(v) {
        const uuid = grokExtractUuid(location.pathname);
        if (!uuid || !v) return false;
        const src = (v.currentSrc || v.src || '').toLowerCase();
        const m = src.match(/(?:generated|post)\/([a-f0-9-]{36})/);
        return !!(m && m[1] !== uuid);
    }

    function grokPickBestVideo(videos) {
        if (!videos || !videos.length) return null;
        if (videos.length === 1) return videos[0];
        const uuid = grokExtractUuid(location.pathname);
        let best = null, bestScore = -1;
        for (const v of videos) {
            const src = (v.currentSrc || v.src || '').toLowerCase();
            let area = 0;
            try {
                const r = v.getBoundingClientRect();
                const vh = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
                const vw = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
                area = vh * vw;
            } catch (e) {}
            let score = 0;
            if (uuid && src.includes(uuid)) score += 8;
            else if (grokIsForeignVideo(v)) score -= 8; // ролик другой генерации
            if (!v.paused && !v.ended) score += 4;
            if (v.readyState >= 2) score += 1;
            if (area > 0) score += 2;
            // площадь — только для различения равных (0..1)
            score += Math.min(1, area / Math.max(1, window.innerWidth * window.innerHeight));
            if (score > bestScore) { best = v; bestScore = score; }
        }
        return best;
    }

    /** Главная картинка поста (сгенерированное изображение, не миниатюра и не аватар) или null. */
    function grokFindMainImage() {
        const uuid = grokExtractUuid(location.pathname);
        let best = null, bestScore = 0;
        for (const img of document.querySelectorAll('img')) {
            if (img.closest(GROK_FILMSTRIP_SEL) || img.closest('#mossad-widget, [id^="mossad-"]')) continue;
            const src = (img.currentSrc || img.src || '').toLowerCase();
            if (!src) continue;
            if (/avatar|profile|pfp|icon|logo|favicon/.test(src)) continue;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            let score = 0;
            if (uuid && src.includes(uuid)) score += 10;                     // картинка именно этого поста
            if (/assets\.grok\.com|imagine-public|share-images|\/generated\//.test(src)) score += 5;
            if (w >= 150 && h >= 150) score += 3;
            if (score < 3) continue;
            if (score > bestScore) { best = img; bestScore = score; }
        }
        return best;
    }

    /**
     * Признаки медиа текущего поста. Ничего не ждёт — только читает DOM; ожиданием управляет
     * scheduleNextSlideCycle (src/slideshow/engine.js).
     *   staleSrc — src <video> предыдущего слайда: такой ролик ещё не сменился, он «старый».
     * Возвращает { video, staleVideo, soundBtn, mainImg, imageBtn, makeVideoBtn, settled }.
     */
    function grokDetectSlideMedia(staleSrc = '') {
        const vids = grokGetViewerVideos();
        let video = null, staleVideo = null;
        // v1.3.43: «чужой» ролик — src с UUID другой генерации (остался от прошлого слайда/круга) — как старый
        const isOld = (v) => {
            const src = v.currentSrc || v.src || '';
            if (staleSrc && src && src === staleSrc) return true;
            return grokIsForeignVideo(v);
        };
        const fresh = [];
        for (const v of vids) {
            if (isOld(v)) { staleVideo = staleVideo || v; continue; }
            fresh.push(v);
        }
        // Если «свежих» видео несколько — лучшее (v1.3.43: UUID поста в src, играет, видимо)
        video = fresh.length > 1 ? grokPickBestVideo(fresh) : (fresh[0] || null);
        let soundBtn = null;
        try { soundBtn = findGrokSoundToggleButton({ includeHidden: true }); } catch (e) {}
        // «Удалить изображение» (видно, если меню поста раскрыто) — железное подтверждение фото
        const imageBtn = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]')).some(el => {
            if (el.closest('#mossad-widget, [id^="mossad-"]')) return false;
            const t = (el.textContent || '').trim();
            const a = (el.getAttribute('aria-label') || '').trim();
            return t === 'Удалить изображение' || t === 'Delete image' || a === 'Удалить изображение' || a === 'Delete image';
        });
        // Страница «устоялась»: документ загружен и URL уже указывает на целевой пост слайдшоу
        let settled = document.readyState === 'complete';
        if (settled) {
            try {
                const ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                const cur = grokExtractUuid(location.pathname);
                if (ss.active && ss.targetUuid && cur && cur !== String(ss.targetUuid).toLowerCase()) settled = false;
            } catch (e) {}
        }
        // v1.3.43: «Make video» (сделать видео из картинки) бывает только у фото — сильный признак фото
        let makeVideoBtn = null;
        try {
            makeVideoBtn = Array.from(document.querySelectorAll('button, [role="button"], a')).find(el =>
                !el.closest(GROK_FILMSTRIP_SEL) && !el.closest('#mossad-widget, [id^="mossad-"]') &&
                GROK_MAKE_VIDEO_RE.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' '))) || null;
        } catch (e) {}
        return { video, staleVideo, soundBtn, mainImg: grokFindMainImage(), imageBtn, makeVideoBtn, settled };
    }

// ============================================================
    // GROK: Download with Metadata Injection & Fallback
    // ============================================================
    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null) {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return false;
        blurActiveInput();

        const currentPostUrl = location.href;
        const currentPostId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';
        let currentConvId = '';
        try {
            const u = new URL(currentPostUrl);
            currentConvId = u.searchParams.get('conversation') || u.searchParams.get('conv') || '';
        } catch(e) {}
        if (!currentConvId && currentPostId) {
            try {
                const raw = sessionStorage.getItem('grok_gallery_collection');
                if (raw) {
                    const data = JSON.parse(raw);
                    const found = (data.items || []).find(it => it.url && it.url.includes(currentPostId));
                    if (found && found.convId) currentConvId = found.convId;
                }
            } catch(e) {}
        }
        if (!currentConvId && currentPostId) {
            const a = document.querySelector(`a[href*="${currentPostId}"][href*="conversation="]`);
            if (a) {
                try {
                    const u = new URL(a.href, location.origin);
                    currentConvId = u.searchParams.get('conversation') || '';
                } catch(e) {}
            }
        }

        const media = getGrokMedia();
        const hasVid = media ? (media.type === 'video') : (getActiveVideo() !== null);
        const currentMediaType = hasVid ? 'video' : 'photo';

        // Проверка дубликата в истории
        const lockedMediaUrl = media ? media.url : null;
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl) && !isDuplicateConfirmed(lockedMediaUrl)) {
            checkFileInHistory(null, lockedMediaUrl, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record, onDoneCallback), currentPostUrl, lockedMediaUrl);
                } else {
                    triggerGrokDownload(true, null, onDoneCallback);
                }
            });
            return true;
        }

        const prompt = getGrokCurrentPrompt();
        const model = getGrokCurrentModel();
        const promptHash = computeGrokPromptHash(prompt);
        if (prompt) {
            sendPromptToVault(prompt, model, 'grok.com', currentPostUrl);
        }
        const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
        const shortId4 = currentPostId ? currentPostId.slice(0, 4) : '';
        const shortConv4 = currentConvId ? currentConvId.slice(0, 4) : '';
        const ext2 = media ? media.ext : (hasVid ? 'mp4' : 'jpg');
        const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (extractRootFilename(duplicateRecord.filename))) : '';
        const dblSuffix = duplicateRecord ? ` (${rootBase || 'original'}) DBL` : '';

        // Дефолтное имя без включенного шаблона: {conv4}-{id4}-grok.mp4
        const defaultPrefix = shortConv4 ? `${shortConv4}-${shortId4 || shortId}` : (shortId || 'media');
        let grokFilename = `${defaultPrefix}-grok${dblSuffix}.${ext2}`;

        if (config.filenameTemplateEnabled) {
            const now2 = new Date();
            const pad2 = (n) => String(n).padStart(2, '0');
            const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
            const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
            const vars = {
                id:           currentPostId || '',
                conv:         currentConvId || '',
                conversation: currentConvId || '',
                uuid:         currentPostId || '',
                hash:         currentPostId || '',
                postid:       currentPostId || '',
                id8:          shortId,
                hash8:        shortId,
                uuid8:        shortId,
                domain:       'grok',
                title:        'Imagine - Grok',
                username:     'grok',
                user:         'grok',
                author:       'grok',
                date:         dateStr,
                time:         timeStr,
                ext:          ext2,
                n:            String(Date.now()).slice(-6),
                dbl:          dblSuffix,
                oldname:      rootBase,
                copy:         rootBase,
                root:         rootBase
            };
            grokFilename = renderFilenameTemplate(config.filenameTemplate, vars, Boolean(duplicateRecord), dblSuffix, ext2);
        }

        const onDownloadFinalized = () => {
            performPostDownloadAction();
            if (onDoneCallback) onDoneCallback();
        };

        if (media && media.url) {
            showToast(`⏳ Загрузка: ${grokFilename}...`);
            const isBlobUrl = media.url.startsWith('blob:');

            const handleBlobResponse = async (rawBlob) => {
                try {
                    showToast('⏳ Запись метаданных...');
                    const enrichedBlob = await injectGrokMetadataToBlob(rawBlob, prompt, currentPostUrl, model, promptHash);
                    saveBlobToDisk(enrichedBlob, grokFilename, media.url, currentPostUrl);
                    onDownloadFinalized();
                } catch (err) {
                    console.error('[MOSSAD] Metadata injection failed, saving raw blob:', err);
                    saveBlobToDisk(rawBlob, grokFilename, media.url, currentPostUrl);
                    onDownloadFinalized();
                }
            };

            const finalizeFallback = () => {
                console.warn('[MOSSAD] Media fetch failed, using native Grok download button fallback');
                fallbackGrokNativeClick(onDownloadFinalized);
            };

            if (isBlobUrl) {
                fetch(media.url)
                    .then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.blob();
                    })
                    .then(handleBlobResponse)
                    .catch(finalizeFallback);
                return true;
            }

            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: media.url,
                    responseType: 'blob',
                    onprogress: (p) => {
                        if (p.total > 0) {
                            const pct = Math.round((p.loaded / p.total) * 100);
                            showToast(`⏳ Скачивание: ${pct}%`);
                        }
                    },
                    onload: (res) => {
                        if (res.status === 200 && res.response) {
                            handleBlobResponse(res.response);
                        } else {
                            finalizeFallback();
                        }
                    },
                    onerror: () => finalizeFallback()
                });
            } else {
                fetch(media.url)
                    .then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.blob();
                    })
                    .then(handleBlobResponse)
                    .catch(finalizeFallback);
            }
            return true;
        }

        // Если медиа-URL не найден — стандартный клик кнопки
        fallbackGrokNativeClick(onDownloadFinalized);
        return true;
    }


    // Автоматический перехват отправки промпта в Grok в Universal Prompt Vault
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', function handleGrokPromptSubmit(e) {
            if (rootDomain !== 'grok.com') return;
            if (e.key === 'Enter' && !e.shiftKey) {
                const ta = document.querySelector('textarea, div[contenteditable="true"]');
                if (ta && (ta === e.target || ta.contains(e.target))) {
                    const txt = (ta.value !== undefined ? ta.value : (ta.innerText || ta.textContent || '')).trim();
                    if (txt && txt.length > 2) {
                        const model = getGrokCurrentModel();
                        sendPromptToVault(txt, model, 'grok.com', location.href);
                    }
                }
            }
        }, true);
    }

// ============================================================
    // GROK: Filmstrip (Киноплёнка) & Intra-group Navigation Helpers
    // ============================================================

    /**
     * Извлекает 36-значный UUID генерации из URL или пути к ассету.
     */
    function grokExtractUuid(urlOrStr) {
        if (!urlOrStr) return '';
        const m = urlOrStr.match(/(?:post|generated)\/([a-f0-9-]{36})/i);
        return m ? m[1].toLowerCase() : '';
    }

    /**
     * Возвращает массив кнопок кадров на полосе киноплёнки (filmstrip).
     */
    function grokGetFilmstripItems() {
        return Array.from(document.querySelectorAll('[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]'));
    }

    /**
     * Находит кнопку в киноплёнке по UUID генерации.
     * Возвращает элемент ТОЛЬКО если он реально присутствует на текущей киноплёнке.
     */
    function grokFindFilmstripItemByUuid(uuid) {
        if (!uuid) return null;
        const items = grokGetFilmstripItems();
        if (items.length === 0) return null;
        const cleanUuid = uuid.toLowerCase();
        return items.find(btn => {
            const img = btn.querySelector('img, video, source');
            if (img && img.src && img.src.toLowerCase().includes(cleanUuid)) return true;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes(cleanUuid)) return true;
            const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
            if (dataId && dataId.includes(cleanUuid)) return true;
            return false;
        }) || null;
    }

    /**
     * Находит индекс активного (выбранного) кадра на киноплёнке.
     */
    function grokGetActiveFilmstripIndex() {
        const items = grokGetFilmstripItems();
        if (items.length === 0) return -1;

        // 1. По классу выделения (ring-white, border-white, aria-selected="true") БЕЗ ложных Tailwind focus:*
        const activeByClass = items.findIndex(btn => {
            if (btn.getAttribute('aria-selected') === 'true') return true;
            const cls = btn.className || '';
            const tokens = cls.split(/\s+/);
            return tokens.some(t => /^(ring-white|border-white|ring-2|ring-4|active)$/i.test(t));
        });
        if (activeByClass !== -1) return activeByClass;

        // 2. По совпадению UUID ассета с текущим URL (fallback если класс ещё не применился)
        const curUuid = grokExtractUuid(location.pathname);
        if (curUuid) {
            const activeByMatch = items.findIndex(btn => {
                const imgSrc = btn.querySelector('img, video, source')?.src || '';
                const genMatch = imgSrc.match(/generated\/([a-f0-9-]+)\//)?.[1];
                if (genMatch && curUuid.includes(genMatch.toLowerCase())) return true;
                if (imgSrc.toLowerCase().includes(curUuid)) return true;
                const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
                if (dataId && dataId.includes(curUuid)) return true;
                return false;
            });
            if (activeByMatch !== -1) return activeByMatch;
        }

        return -1;
    }

    /**
     * Шаг по киноплёнке (вперёд: down/right, назад: up/left).
     * Возвращает:
     * - true: клик выполнен успешно
     * - 'end': достигнут край киноплёнки при выключенном R (config.loopFeed)
     * - false: нет киноплёнки или одиночный кадр
     */
    function grokStepFilmstrip(isNext = true) {
        const items = grokGetFilmstripItems();
        if (items.length <= 1) return false;
        const curIdx = grokGetActiveFilmstripIndex();
        const safeCurIdx = curIdx !== -1 ? curIdx : 0;
        const loop = !!config.loopFeed;

        let nextIdx;
        let reachedEnd = false;

        if (isNext) {
            if (safeCurIdx + 1 < items.length) {
                nextIdx = safeCurIdx + 1;
            } else {
                reachedEnd = true;
                if (loop) {
                    nextIdx = 0;
                } else {
                    return 'end'; // Достигнут конец, повтор выключен
                }
            }
        } else {
            if (safeCurIdx > 0) {
                nextIdx = safeCurIdx - 1;
            } else {
                reachedEnd = true;
                if (loop) {
                    nextIdx = items.length - 1;
                } else {
                    return 'end'; // Достигнуто начало, повтор выключен
                }
            }
        }

        if (nextIdx >= 0 && nextIdx < items.length) {
            // v1.3.43: повтор киноплёнки — забыть «прошлое видео» прошлого круга до клика
            if (reachedEnd && loop && typeof window.resetSlideTrackingState === 'function') window.resetSlideTrackingState('wrap-filmstrip');
            items[nextIdx].click();
            if (reachedEnd && loop) {
                showToast('🔄 Конец киноплёнки: повтор (R)...');
            }
            setTimeout(() => {
                grokHighlightActivePlaylistItem();
            }, 120);
            return true;
        }

        return false;
    }

// ============================================================
    // GROK: навигация в Saved (/imagine/saved)
    // (v1.3.40: кнопки/хоткеи генерации видео 6s / 10s удалены вместе с video-gen.js)
    // ============================================================

    /**
     * Универсальная навигация в Saved Grok (/imagine/saved) из любого места grok.com.
     * Если уже на /imagine/saved — плавно скроллит в начало ленты.
     */
    function grokNavigateToSaved() {
        if (isGrokSavedPage()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
            const scrollables = document.querySelectorAll('main, [role="main"], [data-scroll-container], div[class*="overflow-y"]');
            scrollables.forEach(el => {
                if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
            });
            showToast('🔝 В начало Saved Grok');
            return;
        }

        showToast('📂 Переход в Saved Grok...');

        // 1. Попытка нативного SPA перехода через ссылку в DOM
        const savedLink = document.querySelector('a[href="/imagine/saved"], a[href*="/imagine/saved"]');
        if (savedLink) {
            try {
                savedLink.click();
                setTimeout(() => {
                    if (!isGrokSavedPage()) {
                        window.location.href = 'https://grok.com/imagine/saved';
                    }
                }, 250);
                return;
            } catch(e) {}
        }

        // 2. Прямой переход по URL
        window.location.href = 'https://grok.com/imagine/saved';
    }
    window.grokNavigateToSaved = grokNavigateToSaved;

// ============================================================
    // GROK: Smart Delete (3-dots fallback, a.confirm, hold-post)
    // ============================================================
    function getGrokNeighborPostUrl(dirOverride = null, isDelete = false) {
        // 1. Проверяем карточки постов в текущем DOM
        const cards = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        const currentIdMatch = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
        const currentId = currentIdMatch ? currentIdMatch[1] : null;

        const dirs = config.slideshowDirections;
        const dir = dirOverride || ((dirs && dirs.length) ? dirs[0] : 'down');
        const isFwd = (dir === 'down' || dir === 'right');
        const loop = !!config.loopFeed;

        if (cards.length > 0 && currentId) {
            const urls = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
            const seen = new Map();
            for (const u of urls) {
                const m = u.match(/\/imagine\/post\/([^/?#]+)/);
                if (m && !seen.has(m[1])) seen.set(m[1], u);
            }
            const unique = Array.from(seen.keys());
            const idx = unique.indexOf(currentId);

            let targetId = null;
            let wrapped = false; // v1.3.43: повтор (R) — переход через край списка
            if (isFwd) {
                if (idx >= 0 && idx < unique.length - 1) {
                    targetId = unique[idx + 1];
                } else if (loop && unique.length > 0) {
                    targetId = unique[0];
                    wrapped = true;
                } else if (isDelete && !loop && idx > 0) {
                    targetId = unique[idx - 1];
                }
            } else {
                if (idx > 0) {
                    targetId = unique[idx - 1];
                } else if (loop && unique.length > 0) {
                    targetId = unique[unique.length - 1];
                    wrapped = true;
                } else if (isDelete && !loop && idx < unique.length - 1) {
                    targetId = unique[idx + 1];
                }
            }
            if (wrapped && targetId && typeof window.resetSlideTrackingState === 'function') window.resetSlideTrackingState('wrap-neighbor');
            if (targetId && seen.get(targetId)) return seen.get(targetId);
        }

        // 2. Проверяем ссылки из сохраненной коллекции галереи
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw && currentId) {
                const items = (JSON.parse(raw).items || []).map(i => i.url || i);
                const idx = items.findIndex(u => u.includes(currentId));
                if (idx !== -1) {
                    let nextIdx = -1;
                    if (isFwd) {
                        if (idx + 1 < items.length) {
                            nextIdx = idx + 1;
                        } else if (loop) {
                            nextIdx = 0;
                        } else if (isDelete && !loop && idx > 0) {
                            nextIdx = idx - 1;
                        }
                    } else {
                        if (idx > 0) {
                            nextIdx = idx - 1;
                        } else if (loop) {
                            nextIdx = items.length - 1;
                        } else if (isDelete && !loop && idx + 1 < items.length) {
                            nextIdx = idx + 1;
                        }
                    }
                    if (nextIdx !== -1 && items[nextIdx]) return items[nextIdx];
                }
            }
        } catch (e) {}

        return null;
    }

    // ── Диалог подтверждения удаления (v1.3.37) ──
    const GROK_DIALOG_SELECTOR = '[role="alertdialog"], [role="dialog"], [aria-modal="true"]';
    const GROK_CANCEL_WORDS = ['отмена', 'отменить', 'cancel', 'закрыть', 'close', 'нет', 'no'];
    const GROK_CONFIRM_RE = /удалить|delete|подтвердить|confirm/;
    const GROK_CONFIRM_EXACT = ['да', 'yes', 'ok', 'ок'];
    // v1.3.38: точные подписи кнопки подтверждения в приоритете (англ. UI Grok: «Delete video»)
    const GROK_CONFIRM_PRIORITY = [
        'delete video', 'delete image', 'delete post', 'delete',
        'удалить видео', 'удалить изображение', 'удалить пост', 'удалить'
    ];

    function _btnLabel(btn) {
        const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        const txt = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return { aria, txt };
    }

    /**
     * Одиночный клик для шагов удаления (v1.3.38). Общий triggerClick() шлёт синтетический click И вызывает
     * el.click() — это ДВА клика: на кнопке-триггере диалога второй клик может закрыть только что открытый
     * диалог, а на подтверждении — отправить второй запрос. Здесь: pointer/mouse down/up + один el.click().
     */
    function grokDeleteClickOnce(el, label) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => {
            try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 })); } catch(e) {}
        });
        try { el.click(); } catch(e) {}
        mossadDebug('delete', `клик: ${label}`, { text: (el.textContent || '').trim().slice(0, 40), aria: el.getAttribute('aria-label') || '' });
    }

    function _isVisibleEl(el) {
        return !!el && el.isConnected && !(el.offsetWidth === 0 && el.offsetHeight === 0 &&
            (!el.getClientRects || !el.getClientRects().length));
    }

    /** Все видимые диалоги страницы (кроме окон MOSSAD). */
    function listGrokDialogs() {
        return Array.from(document.querySelectorAll(GROK_DIALOG_SELECTOR))
            .filter(d => _isVisibleEl(d) && !(d.id || '').startsWith('mossad-') && !d.closest('[id^="mossad-"]'));
    }

    /** Кнопка — подтверждение удаления (а не «Отмена» и не исходная кнопка «Удалить» поста)? */
    function isGrokConfirmButton(btn, excludeBtn = null) {
        if (!btn || btn === excludeBtn) return false;
        const label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).trim().toLowerCase();
        if (!label) return false;
        if (GROK_CANCEL_WORDS.some(w => label === w || label.startsWith(w + ' '))) return false;
        return GROK_CONFIRM_RE.test(label) || GROK_CONFIRM_EXACT.includes(label);
    }

    function findGrokConfirmButtonIn(dialog, excludeBtn = null) {
        if (!dialog || !dialog.isConnected) return null;
        const btns = Array.from(dialog.querySelectorAll('button, [role="button"]'))
            .filter(b => _isVisibleEl(b) && b !== excludeBtn && !b.disabled);
        // 1) Точное совпадение подписи по приоритету («Delete video» → … → «Удалить»)
        for (const want of GROK_CONFIRM_PRIORITY) {
            const exact = btns.find(b => { const l = _btnLabel(b); return l.txt === want || l.aria === want; });
            if (exact && isGrokConfirmButton(exact, excludeBtn)) return exact;
        }
        // 2) Любая кнопка подтверждения (содержит delete/удалить/confirm…, не «Отмена»)
        return btns.find(b => isGrokConfirmButton(b, excludeBtn)) || null;
    }

    /** Новый (появившийся после клика «Удалить») диалог с кнопкой подтверждения; самый верхний. */
    function findGrokConfirmDialog(preDialogs, excludeBtn = null) {
        const fresh = listGrokDialogs().filter(d => !preDialogs.has(d) && findGrokConfirmButtonIn(d, excludeBtn));
        if (fresh.length) return fresh[fresh.length - 1];
        // Фолбэк: alertdialog, даже если существовал раньше (Grok может переиспользовать узел)
        const alerts = listGrokDialogs().filter(d => d.getAttribute('role') === 'alertdialog' && findGrokConfirmButtonIn(d, excludeBtn));
        return alerts.length ? alerts[alerts.length - 1] : null;
    }

    function isGrokDialogOpen(dialog) {
        return _isVisibleEl(dialog) && dialog.getAttribute('data-state') !== 'closed';
    }

    let _grokDeleteInProgress = false;

    async function runSmartDelete() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        if (_grokDeleteInProgress) return;
        _grokDeleteInProgress = true;

        try {
            blurActiveInput();
            const initialUrl = location.href;
            mossadDebug('delete', 'старт удаления', { holdpost: !!config.deleteHoldpost, autoconfirm: !!config.deleteAutoconfirm });
            let finalTargetUrl = null;

            let targetFilmstripBtn = null;
            let targetFilmstripUuid = null;

            // 1. hold post: определяем целевой кадр / пост перед удалением
            if (config.deleteHoldpost) {
                // А. Приоритет: кадры на полосе киноплёнки (filmstrip)
                const items = grokGetFilmstripItems();

                if (items.length > 1) {
                    const currentIdx = items.findIndex(btn => 
                        btn.className.includes('ring-white') || 
                        location.pathname.includes(btn.querySelector('img')?.src.match(/generated\/([a-f0-9-]+)\//)?.[1] || '---')
                    );
                    const safeCurIdx = currentIdx !== -1 ? currentIdx : (grokGetActiveFilmstripIndex());
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    const isFwd = (dPadDir === 'down' || dPadDir === 'right');
                    const loop = !!config.loopFeed;

                    let nextIdx;
                    if (isFwd) {
                        // Д-пад вниз/вправо: шагаем на следующее видео вниз по ленте
                        if (safeCurIdx + 1 < items.length) {
                            nextIdx = safeCurIdx + 1;
                        } else if (loop) {
                            nextIdx = 0; // петля R: в начало
                        } else {
                            nextIdx = safeCurIdx > 0 ? safeCurIdx - 1 : 0; // R выключен: не зацикливаем, отступаем назад
                        }
                    } else {
                        // Д-пад вверх/влево: шагаем на предыдущее видео вверх по ленте (на 4-е от 5-го)
                        if (safeCurIdx > 0) {
                            nextIdx = safeCurIdx - 1;
                        } else if (loop) {
                            nextIdx = items.length - 1; // петля R: в конец
                        } else {
                            nextIdx = items.length > 1 ? 1 : 0; // R выключен: не зацикливаем, отступаем вперёд
                        }
                    }
                    targetFilmstripBtn = items[nextIdx];

                    const nextImgSrc = targetFilmstripBtn?.querySelector('img, video, source')?.src || '';
                    const m = nextImgSrc.match(/generated\/([a-f0-9-]+)\//);
                    targetFilmstripUuid = m ? m[1] : (grokExtractUuid(nextImgSrc));
                    if (targetFilmstripUuid) {
                        finalTargetUrl = `/imagine/post/${targetFilmstripUuid}`;
                    }
                    mossadDebug('delete', 'hold post: цель по киноплёнке', { from: safeCurIdx + 1, to: nextIdx + 1, uuid: targetFilmstripUuid || '' });
                    console.log(`[MOSSAD] hold post: DPad=${dPadDir} (${isFwd ? 'вниз' : 'вверх'}), целевой кадр: ${safeCurIdx + 1} -> ${nextIdx + 1} (UUID: ${targetFilmstripUuid || 'н/д'}, loop=${loop})`);
                } else {
                    // Б. Киноплёнка из 1 кадра или не найдена — ищем URL соседа по коллекции / DOM
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    finalTargetUrl = getGrokNeighborPostUrl(dPadDir, true);
                    console.log('[MOSSAD] hold post: киноплёнка одиночная/отсутствует, fallback URL соседа:', finalTargetUrl);
                    mossadDebug('delete', 'hold post: цель — сосед по коллекции/DOM', { url: finalTargetUrl || '' });
                }

                // В. Крайний фолбэк: шаг стрелками, если нет киноплёнки и не найден URL соседа
                if (!targetFilmstripBtn && !finalTargetUrl) {
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    const forwardKey = getArrowKey(dPadDir);
                    const oppDir = dPadDir === 'up' ? 'down' : (dPadDir === 'down' ? 'up' : (dPadDir === 'left' ? 'right' : 'left'));
                    const backKey = getArrowKey(oppDir);

                    showToast('🔍 Фиксация позиции...');

                    const sendKey = (k) => {
                        if (typeof sendDpadKeyEvent === 'function') {
                            sendDpadKeyEvent(k);
                        } else {
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                            document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
                        }
                    };

                    sendKey(forwardKey);
                    const peekStart = Date.now();
                    while (Date.now() - peekStart < 1500) {
                        await new Promise(r => setTimeout(r, 40));
                        if (location.href !== initialUrl && isGrokPostPage()) {
                            finalTargetUrl = location.href;
                            break;
                        }
                        if (Date.now() - peekStart > 350 && location.href === initialUrl && !finalTargetUrl) {
                            sendKey(forwardKey);
                        }
                    }

                    if (finalTargetUrl) {
                        console.log(`[MOSSAD] hold post: найден целевой финишный пост (fallback peek): ${finalTargetUrl}`);
                        sendKey(backKey);
                        const backStart = Date.now();
                        while (Date.now() - backStart < 1500) {
                            await new Promise(r => setTimeout(r, 40));
                            if (location.href === initialUrl) break;
                            if (Date.now() - backStart > 350 && location.href !== initialUrl) {
                                sendKey(backKey);
                            }
                        }
                        await new Promise(r => setTimeout(r, 250));
                    }
                }
            }

            // 2. Запуск удаления и подтверждения
            // v1.3.37: страница поста Grok сама является [role="dialog"] (просмотрщик), поэтому старый поиск
            // `document.querySelector('[role="dialog"]')` находил просмотрщик, «подтверждал» повторным кликом
            // по кнопке «Удалить» самого поста и сразу уходил на соседа, пока настоящий диалог висел открытым.
            // Теперь: ищем только НОВЫЙ диалог (появившийся после клика), кнопку подтверждения — только внутри
            // него, и переходим на соседа ТОЛЬКО после подтверждения и закрытия диалога (ANTI_PATTERNS §16).
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];
            const preDialogs = new Set(listGrokDialogs());

            let directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;
            let clickedDelBtn = null;

            mossadDebug('delete', directDelBtn ? 'кнопка удаления найдена' : 'кнопки удаления нет — пробуем меню «⋯»', { preDialogs: preDialogs.size });
            if (directDelBtn) {
                grokDeleteClickOnce(directDelBtn, 'Delete Button');
                clickedDelBtn = directDelBtn;
                showToast('✕ Удаление...');
                deleteClicked = true;
            } else {
                const dotsBtn = findGrok3DotsMenuButton();
                if (dotsBtn) {
                    grokDeleteClickOnce(dotsBtn, 'Post actions (for Delete)');
                    const innerDel = await waitForCondition(() => findGrokButton(deleteBtnLabels), 1500, 100);
                    if (innerDel) {
                        grokDeleteClickOnce(innerDel, 'Delete Button (from menu)');
                        clickedDelBtn = innerDel;
                        showToast('✕ Удаление...');
                        deleteClicked = true;
                    }
                }
            }

            if (!deleteClicked) {
                mossadDebug('delete', 'СТОП: кнопка удаления не найдена');
                showToast('⚠️ Кнопка удаления не найдена', true);
                return;
            }

            const filmstripCountBefore = grokGetFilmstripItems().length;
            const confirmDialog = await waitForCondition(
                () => findGrokConfirmDialog(preDialogs, clickedDelBtn), 3000, 50);

            mossadDebug('delete', confirmDialog ? 'диалог подтверждения найден' : 'диалог подтверждения НЕ появился за 3 с', confirmDialog ? {
                role: confirmDialog.getAttribute('role') || '',
                btn: ((findGrokConfirmButtonIn(confirmDialog, clickedDelBtn) || {}).textContent || '').trim().slice(0, 30)
            } : undefined);
            let deleteConfirmed = false;
            if (!confirmDialog) {
                // Диалог не появился: считаем удаление выполненным, только если есть признаки удаления
                const removed = await waitForCondition(() =>
                    location.href !== initialUrl ||
                    (filmstripCountBefore > 1 && grokGetFilmstripItems().length < filmstripCountBefore), 2000, 100);
                if (removed) {
                    deleteConfirmed = true;
                    mossadDebug('delete', 'удалено без диалога (есть признаки удаления)');
                } else {
                    console.warn('[MOSSAD] Delete: диалог подтверждения не найден, переход отменён');
                    showToast('⚠️ Диалог подтверждения не найден — переход отменён', true);
                }
            } else {
                // Фиксируем ручные клики пользователя по кнопкам диалога (Удалить / Отмена)
                let userChoice = null; // 'confirm' | 'cancel'
                const onDialogClick = (ev) => {
                    const b = ev.target && ev.target.closest && ev.target.closest('button, [role="button"]');
                    if (!b || !confirmDialog.contains(b)) return;
                    userChoice = isGrokConfirmButton(b, clickedDelBtn) ? 'confirm' : 'cancel';
                };
                const onDialogKey = (ev) => {
                    if (ev.key === 'Escape') userChoice = 'cancel';
                    // Enter на сфокусированной кнопке подтверждения (браузер сам превратит его в click)
                    if (ev.key === 'Enter' && document.activeElement && confirmDialog.contains(document.activeElement) &&
                        isGrokConfirmButton(document.activeElement, clickedDelBtn)) userChoice = 'confirm';
                };
                document.addEventListener('click', onDialogClick, true);
                document.addEventListener('keydown', onDialogKey, true);
                const isClosed = () => !isGrokDialogOpen(confirmDialog);

                try {
                    if (config.deleteAutoconfirm) {
                        const confirmBtn = await waitForCondition(
                            () => findGrokConfirmButtonIn(confirmDialog, clickedDelBtn), 2000, 50);
                        if (confirmBtn) {
                            // Даём Radix закончить анимацию открытия (иначе клик может уйти в «пустоту»)
                            await new Promise(r => setTimeout(r, 120));
                            grokDeleteClickOnce(confirmBtn, 'Confirm Delete');
                            console.log('[MOSSAD] Delete: подтверждение нажато, ждём закрытия диалога');
                            if (await waitForCondition(isClosed, 5000, 50)) deleteConfirmed = true;
                            if (!deleteConfirmed && !isClosed()) {
                                // Вторая попытка: фокус + Enter-эквивалент через повторный одиночный клик
                                mossadDebug('delete', 'диалог не закрылся за 5 с — повторное подтверждение');
                                const again = findGrokConfirmButtonIn(confirmDialog, clickedDelBtn);
                                if (again) {
                                    try { again.focus({ preventScroll: true }); } catch(e) {}
                                    grokDeleteClickOnce(again, 'Confirm Delete (retry)');
                                    if (await waitForCondition(isClosed, 3000, 50)) deleteConfirmed = true;
                                }
                            }
                            mossadDebug('delete', deleteConfirmed ? 'подтверждено, диалог закрыт' : 'автоподтверждение не удалось');
                        } else {
                            mossadDebug('delete', 'кнопка подтверждения в диалоге не найдена');
                        }
                        if (!deleteConfirmed && !isClosed()) {
                            showToast('⚠️ Не удалось подтвердить автоматически — подтвердите вручную', true);
                        }
                    } else {
                        // v1.3.38: без автоподтверждения — ставим фокус на «Delete video», чтобы Enter подтверждал.
                        // Radix при открытии сам фокусирует «Cancel», поэтому повторяем фокус после монтирования.
                        const focusConfirm = () => {
                            if (isClosed() || userChoice) return;
                            const b = findGrokConfirmButtonIn(confirmDialog, clickedDelBtn);
                            if (b && document.activeElement !== b) {
                                try { b.focus({ preventScroll: true }); } catch(e) {}
                            }
                        };
                        focusConfirm();
                        [60, 200, 450].forEach(ms => setTimeout(focusConfirm, ms));
                        mossadDebug('delete', 'ручной режим: фокус на кнопке подтверждения (Enter = удалить)');
                        showToast('🗑 Enter — удалить, Esc — отмена');
                    }

                    if (!deleteConfirmed && !isClosed()) {
                        // Ручное подтверждение: ждём закрытия диалога до 60 с
                        await waitForCondition(isClosed, 60000, 100);
                        deleteConfirmed = isClosed() && userChoice === 'confirm';
                        mossadDebug('delete', 'ручной режим: диалог закрыт', { userChoice, deleteConfirmed });
                        if (isClosed() && userChoice !== 'confirm') {
                            console.log('[MOSSAD] Delete: диалог закрыт без подтверждения — остаёмся на посту');
                        }
                    }
                } finally {
                    document.removeEventListener('click', onDialogClick, true);
                    document.removeEventListener('keydown', onDialogKey, true);
                }
            }

            // 2б. v1.3.38: ждём признаков фактического удаления (до 4 с), а не фиксированные 150 мс
            let grokNavigatedItself = false;
            if (deleteConfirmed && config.deleteHoldpost) {
                const removedSignal = await waitForCondition(() => {
                    if (location.href !== initialUrl) return 'url';
                    if (filmstripCountBefore > 1 && grokGetFilmstripItems().length < filmstripCountBefore) return 'filmstrip';
                    return null;
                }, 4000, 100);
                grokNavigatedItself = removedSignal === 'url';
                mossadDebug('delete', removedSignal ? `удаление подтверждено признаком: ${removedSignal}` : 'нет явного признака за 4 с (диалог закрыт после подтверждения — продолжаем)', { url: location.pathname });
            }

            // 3. hold post: переход на следующий кадр / пост — только после подтверждённого удаления
            if (config.deleteHoldpost && deleteConfirmed) {
                const executeTransition = () => {
                    // А. Приоритет: переключение по киноплёнке (только видео, без перезагрузки)
                    if (targetFilmstripBtn) {
                        console.log('[MOSSAD] hold post: переключаем кадр по киноплёнке (SPA, без перезагрузки)...');
                        showToast('🎯 Переход к следующему кадру...');

                        if (targetFilmstripBtn.isConnected && !grokNavigatedItself) {
                            mossadDebug('delete', 'hold post: клик по целевому кадру');
                            targetFilmstripBtn.click();
                            return;
                        }

                        // Если DOM обновился, ищем по UUID
                        if (targetFilmstripUuid) {
                            const refetched = grokFindFilmstripItemByUuid(targetFilmstripUuid);
                            if (refetched) {
                                mossadDebug('delete', 'hold post: клик по целевому кадру (найден заново по UUID)');
                                refetched.click();
                                return;
                            }
                        }

                        // Если есть URL цели — надёжнее перейти по нему, чем кликать «первый попавшийся» кадр
                        if (!finalTargetUrl) {
                            const currentItems = grokGetFilmstripItems();
                            if (currentItems.length > 0 && !grokNavigatedItself) {
                                mossadDebug('delete', 'hold post: цель не найдена — первый кадр киноплёнки');
                                currentItems[0].click();
                                return;
                            }
                        }
                    }

                    // Б. Межпостовой переход через SPA-роутер (если киноплёнки не было)
                    if (finalTargetUrl) {
                        const curU = (grokExtractUuid(location.pathname) || '').toLowerCase();
                        const tgtU = (grokExtractUuid(finalTargetUrl) || '').toLowerCase();
                        if (curU && tgtU && curU === tgtU) {
                            mossadDebug('delete', 'hold post: Grok уже открыл целевой пост — переход не нужен');
                            return;
                        }
                        mossadDebug('delete', 'hold post: переход по URL цели', { url: finalTargetUrl });
                        console.log(`[MOSSAD] hold post: переход на сохранённый URL: ${finalTargetUrl}`);
                        showToast('🎯 Переход к соседнему посту...');
                        if (typeof grokSpaNavigate === 'function') {
                            grokSpaNavigate(finalTargetUrl);
                        } else {
                            window.location.href = finalTargetUrl;
                        }
                    }
                };

                // Небольшая пауза, чтобы Grok перерисовал киноплёнку после удаления
                await new Promise(r => setTimeout(r, 150));
                executeTransition();
            } else if (config.deleteHoldpost) {
                mossadDebug('delete', 'hold post: переход отменён (удаление не подтверждено)');
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }

// ============================================================
    // GROK ENGINE: Collection Management (Scraping, Saving, Export)
    // ============================================================

    /** Извлекает email из Next.js Flight данных на странице */
    function grokExtractEmail() {
        // Просто находим слово email, затем вытащиваем email-паттерн после него
        // Работает для "email":"val", \"email\":\"val\", любого варианта
        const re = /email[^a-zA-Z0-9]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
        for (const s of document.querySelectorAll('script')) {
            const m = s.textContent.match(re);
            if (m) return m[1];
        }
        try {
            const m = document.documentElement.innerHTML.match(re);
            if (m) return m[1];
        } catch(e) {}
        return 'unknown';
    }

    // ── v1.3.43: тип плитки Saved («фото» / «видео») в обоих видах ленты ──
    // Компактный вид: у видео есть бейдж длительности (span.tabular-nums, «0:06»).
    // Полный вид: бейджей нет. У ФОТО есть кнопка «Make video» (белый треугольник в круге);
    // у видео её нет, а после загрузки в плитке появляется <video> (автоплей).
    // Плитка, которую ещё нельзя классифицировать (ленивая отрисовка), получает type: null и
    // перепроверяется через ~500 мс (grokScheduleRetype). ANTI_PATTERNS §22.
    const GROK_MAKE_VIDEO_RE = /make\s*video/i;
    const GROK_RETYPE_DELAY_MS = 500;
    const GROK_RETYPE_MAX = 4;

    /** Кнопка «Make video» внутри root (aria-label / title / текст, без учёта регистра). */
    function grokFindMakeVideoButton(root) {
        if (!root || !root.querySelectorAll) return null;
        const els = root.querySelectorAll('button, [role="button"], a');
        for (const el of els) {
            if (el.closest('#mossad-widget, [id^="mossad-"]')) continue;
            const sig = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' ');
            if (GROK_MAKE_VIDEO_RE.test(sig)) return el;
        }
        return null;
    }

    /** Вид ленты Saved: 'compact' (есть бейджи), 'full' (есть «Make video» или <video> в плитках), иначе 'unknown'. */
    function grokSavedViewMode() {
        const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        let full = false;
        for (const a of anchors) {
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            if (!card) continue;
            if (card.querySelector('span.tabular-nums')) return 'compact';
            if (!full && (grokFindMakeVideoButton(card) || card.querySelector('video'))) full = true;
        }
        return full ? 'full' : 'unknown';
    }

    /** 'video' | 'photo' | null (плитка ещё не отрисована / вид ленты не ясен). */
    function grokClassifySavedTile(card, view) {
        if (!card) return null;
        if (card.querySelector('span.tabular-nums')) return 'video';   // бейдж длительности (компактный вид)
        if (grokFindMakeVideoButton(card)) return 'photo';               // «Make video» есть только у фото
        if (card.querySelector('video')) return 'video';                 // автоплей (полный вид)
        const img = card.querySelector('img');
        const rendered = !!(img && (img.currentSrc || img.getAttribute('src')) && img.complete !== false);
        if (!rendered) return null;
        if (view === 'compact') return 'photo';  // бейджа нет → фото
        if (view === 'full') return 'video';     // отрисована, но без «Make video» → видео (ролик ещё грузится)
        return null;
    }

    /** Собирает все уникальные ссылки /imagine/post/... из DOM в хронологическом порядке (снизу вверх страницы) */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        const view = grokSavedViewMode();
        const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        // Идём от конца к началу DOM: всё, что в самом низу, создавалось раньше (хронологический порядок)
        for (let i = anchors.length - 1; i >= 0; i--) {
            const a = anchors[i];
            const href = a.getAttribute('href') || '';
            if (!href) continue;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            // Нормализуем URL (убираем query-string для дедупликации по базовому URL поста)
            const baseUrl = stripUrlQuery(url);
            if (seen.has(baseUrl)) continue;
            seen.add(baseUrl);
            // Карточка — ближайший listitem / masonry-item родитель
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            const type = grokClassifySavedTile(card, view);
            // Conversation ID из ?conversation=UUID параметра
            let convId = null;
            try {
                const urlObj = new URL(url, 'https://grok.com');
                convId = urlObj.searchParams.get('conversation') || null;
            } catch(e) {}
            items.push({ url, type, convId });
        }
        const untyped = items.filter(it => !it.type).length;
        mossadDebug('collect', 'типы плиток', { view, total: items.length, untyped });
        return items;
    }

    /** Дописывает тип уже собранным элементам без типа (из свежего сбора). Возвращает число исправленных. */
    function grokFillMissingTypes(existingItems, foundItems) {
        const byBase = new Map();
        foundItems.forEach(it => { if (it.type) byBase.set(normUrlKey(it.url), it.type); });
        let fixed = 0;
        existingItems.forEach(it => {
            if (it.type) return;
            const t = byBase.get(normUrlKey(it.url));
            if (t) { it.type = t; fixed++; }
        });
        return fixed;
    }

    /** Перепроверка элементов коллекции без типа через ~500 мс (до GROK_RETYPE_MAX раз). */
    let _retypeTimer = null;
    function grokScheduleRetype(attempt = 1) {
        if (_retypeTimer) return; // уже запланирована
        if (attempt > GROK_RETYPE_MAX) return;
        _retypeTimer = setTimeout(() => {
            _retypeTimer = null;
            if (!isGrokSavedPage()) return;
            let data;
            try { data = JSON.parse(_gSS.getItem(GALLERY_COLLECTION_KEY) || 'null'); } catch(e) { return; }
            if (!data || !Array.isArray(data.items)) return;
            const before = data.items.filter(it => !it.type).length;
            if (!before) return;
            const fixed = grokFillMissingTypes(data.items, grokCollectLinks());
            const left = before - fixed;
            if (fixed) {
                _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(data));
                const panel = document.getElementById('mossad-playlist-panel');
                if (panel) { panel.remove(); grokTogglePlaylistPanel(true); }
            }
            mossadDebug('collect', 'перепроверка типов', { attempt, fixed, untyped: left });
            if (left > 0) grokScheduleRetype(attempt + 1);
        }, GROK_RETYPE_DELAY_MS);
    }

    function grokTypeCounts(items) {
        const videos = items.filter(i => i.type === 'video').length;
        const photos = items.filter(i => i.type === 'photo').length;
        return { videos, photos, unknown: items.length - videos - photos };
    }

    /** Кнопка 1: сохранить коллекцию в sessionStorage (накопительное добавление, список только увеличивается) */
    function grokSaveCollection(btnEl) {
        const foundItems = grokCollectLinks();
        // v1.3.39: после клика ещё N секунд дособираем ссылки, подгружаемые при скролле
        grokStartCollectWatch(config.collectWatchSec, 'click');
        if (foundItems.length === 0) {
            showToast(`⚠️ Ссылки пока не найдены — скролльте ленту, досбор ${config.collectWatchSec || 30} с`, true);
            return;
        }

        let existingData = {};
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw) existingData = JSON.parse(raw);
        } catch(e) {}

        const existingItems = existingData.items || [];
        const seenUrls = new Set();
        const mergedItems = [];

        // 1. Сохраняем все уже имеющиеся элементы (список только увеличивается!)
        for (const it of existingItems) {
            const base = normUrlKey(it.url);
            if (!seenUrls.has(base)) {
                seenUrls.add(base);
                mergedItems.push(it);
            }
        }

        // 2. Добавляем новые элементы, которых ещё не было
        let addedCount = 0;
        for (const it of foundItems) {
            const base = normUrlKey(it.url);
            if (!seenUrls.has(base)) {
                seenUrls.add(base);
                mergedItems.push(it);
                addedCount++;
            }
        }

        grokFillMissingTypes(mergedItems, foundItems);
        const grpMode  = existingData.grpMode  || 'seq';
        const itemMode = existingData.itemMode || 'fwd';
        const date     = new Date().toISOString().slice(0, 10);
        const { videos, photos, unknown } = grokTypeCounts(mergedItems);
        const unkTxt   = unknown ? `, ❔${unknown}` : '';

        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({
            date,
            items: mergedItems,
            grpMode,
            itemMode,
            // v1.3.41: сохраняем Gr/Md, запомненные кнопкой 🔀 «Случайно»
            ...(existingData.preRandom ? { preRandom: existingData.preRandom } : {})
        }));

        if (btnEl) {
            mossadUnlabelEl(btnEl).textContent = String(mergedItems.length);
            btnEl.title = `Коллекция (${mergedItems.length}): открыть список`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(mergedItems.length);
            const dlBtn = document.getElementById('mossad-gallery-dl') || document.getElementById('mossad-btn-export-list');
            if (dlBtn) dlBtn.style.display = 'inline-block';
        }

        // Если открыт список (плейлист) — обновляем его под новый порядок
        const playlistPanel = document.getElementById('mossad-playlist-panel');
        if (playlistPanel) {
            playlistPanel.remove();
            grokTogglePlaylistPanel(true);
        }

        sessionStorage.setItem(GALLERY_COLLECT_ACTIVE_KEY, 'true');

        if (addedCount > 0) {
            showToast(`✅ Добавлено +${addedCount}! Всего в списке: ${mergedItems.length} (📹${videos}, 🖼${photos}${unkTxt})`);
        } else {
            showToast(`ℹ️ Новых ссылок нет. В списке: ${mergedItems.length} (📹${videos}, 🖼${photos}${unkTxt})`);
        }
        mossadDebug('collect', 'сбор: типы', { total: mergedItems.length, videos, photos, untyped: unknown });
        if (unknown) grokScheduleRetype(1);
    }

    /**
     * Автоматическое бесшовное добавление новых ссылок в коллекцию на лету.
     * Новые ссылки сразу подхватываются при скролле и добавляются в общий список без подтверждений и без (+N).
     */
    function grokAutoCollectNewLinks() {
        if (!isGrokSavedPage()) return;
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        const watching = grokIsCollectWatching();
        if (!raw && !watching) return; // Досбор — только после клика «Собрать» (в окне досбора)

        let existingData = {};
        if (raw) {
            try { existingData = JSON.parse(raw); } catch(e) { return; }
        } else {
            existingData = { date: new Date().toISOString().slice(0, 10), items: [], grpMode: 'seq', itemMode: 'fwd' };
        }
        const existingItems = existingData.items || [];
        if (!existingItems.length && !watching && !sessionStorage.getItem(GALLERY_COLLECT_ACTIVE_KEY)) return;

        const seenUrls = new Set();
        existingItems.forEach(it => {
            const base = normUrlKey(it.url);
            if (base) seenUrls.add(base);
        });

        const foundItems = grokCollectLinks();
        let addedCount = 0;
        for (const it of foundItems) {
            const base = normUrlKey(it.url);
            if (!seenUrls.has(base)) {
                seenUrls.add(base);
                existingItems.push(it);
                addedCount++;
            }
        }
        // v1.3.43: тип, который появился после отрисовки плитки, дописываем уже собранным
        const typedNow = grokFillMissingTypes(existingItems, foundItems);
        if (typedNow && !addedCount && raw) {
            existingData.items = existingItems;
            _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(existingData));
        }
        if (existingItems.some(it => !it.type)) grokScheduleRetype(1);

        const btnCollect = document.getElementById('mossad-gallery-collect');

        if (addedCount > 0) {
            const date = new Date().toISOString().slice(0, 10);
            existingData.date = date;
            existingData.items = existingItems;
            _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(existingData));
            sessionStorage.setItem(GALLERY_COLLECT_ACTIVE_KEY, 'true');
            mossadDebug('collect', 'досбор: добавлены ссылки', { added: addedCount, total: existingItems.length });

            if (btnCollect) {
                mossadUnlabelEl(btnCollect).textContent = String(existingItems.length);
                btnCollect.title = `Коллекция (${existingItems.length}): открыть список`;
                btnCollect.style.background = '#065f46';
                btnCollect.style.color = '#e5e7eb';
                btnCollect.dataset.collectedCount = String(existingItems.length);
                const dlBtn = document.getElementById('mossad-gallery-dl') || document.getElementById('mossad-btn-export-list');
                if (dlBtn) dlBtn.style.display = 'inline-block';
            }

            const playlistPanel = document.getElementById('mossad-playlist-panel');
            if (playlistPanel) {
                playlistPanel.remove();
                grokTogglePlaylistPanel(true);
            }
        } else if (btnCollect && existingItems.length > 0) {
            // Без скобок и (+N): отображается только чистое количество
            mossadUnlabelEl(btnCollect).textContent = String(existingItems.length);
            btnCollect.title = `Коллекция (${existingItems.length}): открыть список`;
            btnCollect.style.background = '#065f46';
            btnCollect.style.color = '#e5e7eb';
            btnCollect.dataset.collectedCount = String(existingItems.length);
        }
    }

    // ── v1.3.39: «окно досбора» после клика «Собрать» ──
    // Замысел владельца: автосбор НЕ стартует сам. После клика «Собрать» скрипт ещё N секунд
    // (config.collectWatchSec, по умолчанию 30) следит за лентой /imagine/saved и подхватывает
    // ссылки, подгружаемые при скролле. Каждый новый клик продлевает окно. Окно закрывается по
    // таймеру, при старте слайдшоу или при уходе со страницы. Пока окно открыто — рядом с кнопкой
    // виден отсчёт «👁 25с». API переиспользуемое (будущий сценарий «первый Insert — собрать»):
    //   grokStartCollectWatch(sec?, source?) / grokStopCollectWatch(reason?) / grokIsCollectWatching()
    // Раньше (v1.3.30–v1.3.38) наблюдатель вешался только если вкладка ОТКРЫЛАСЬ сразу на /imagine/saved
    // (initGrokGalleryBar) — при SPA-переходе на /imagine/saved досбор не работал вовсе (ANTI_PATTERNS §18).
    const _collectWatch = { until: 0, observer: null, tickId: null, debounce: null, source: '' };

    function grokIsCollectWatching() {
        return !!_collectWatch.observer && Date.now() < _collectWatch.until;
    }

    function _collectWatchTrigger() {
        if (!isGrokSavedPage()) return;
        if (_collectWatch.debounce) clearTimeout(_collectWatch.debounce);
        _collectWatch.debounce = setTimeout(() => {
            _collectWatch.debounce = null;
            grokAutoCollectNewLinks();
        }, 300);
    }

    function _collectWatchIndicator(secLeft) {
        const btn = document.getElementById('mossad-gallery-collect');
        let ind = document.getElementById('mossad-collect-watch');
        if (secLeft <= 0 || !btn) { if (ind) ind.remove(); return; }
        if (!ind) {
            ind = document.createElement('span');
            ind.id = 'mossad-collect-watch';
            ind.title = 'Досбор новых ссылок при скролле (клик — остановить)';
            ind.style.cssText = 'font-size:10px;color:#6ee7b7;padding:0 3px;cursor:pointer;white-space:nowrap;font-variant-numeric:tabular-nums;';
            ind.onclick = (e) => { e.stopPropagation(); grokStopCollectWatch('user'); };
            btn.insertAdjacentElement('afterend', ind);
        }
        ind.textContent = `👁${secLeft}с`;
    }

    function _isAnySlideshowRunning() {
        try {
            if (window._mossadGalleryActive) return true;
            if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
        } catch(e) {}
        return false;
    }

    function grokStartCollectWatch(sec, source = 'click') {
        if (rootDomain !== 'grok.com' || !isGrokSavedPage()) return false;
        const dur = Math.max(5, Math.min(600, Number(sec || config.collectWatchSec || 30)));
        _collectWatch.until = Date.now() + dur * 1000;
        _collectWatch.source = source;
        mossadDebug('collect', 'окно досбора открыто/продлено', { sec: dur, source });
        if (!_collectWatch.observer) {
            _collectWatch.observer = new MutationObserver((mutations) => {
                for (let i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) { _collectWatchTrigger(); return; }
                }
            });
            _collectWatch.observer.observe(document.body, { childList: true, subtree: true });
            window.addEventListener('scroll', _collectWatchTrigger, { passive: true, capture: true });
            _collectWatch.tickId = setInterval(() => {
                if (!isGrokSavedPage()) { grokStopCollectWatch('left-page'); return; }
                if (_isAnySlideshowRunning()) { grokStopCollectWatch('slideshow'); return; }
                const left = Math.ceil((_collectWatch.until - Date.now()) / 1000);
                if (left <= 0) { grokStopCollectWatch('timeout'); return; }
                _collectWatchIndicator(left);
                _collectWatchTrigger(); // страховка: ленивые картинки без мутаций childList
            }, 1000);
        }
        _collectWatchIndicator(dur);
        return true;
    }

    function grokStopCollectWatch(reason = 'stop') {
        if (!_collectWatch.observer) { _collectWatchIndicator(0); return; }
        _collectWatch.observer.disconnect();
        _collectWatch.observer = null;
        window.removeEventListener('scroll', _collectWatchTrigger, { passive: true, capture: true });
        if (_collectWatch.tickId) { clearInterval(_collectWatch.tickId); _collectWatch.tickId = null; }
        if (_collectWatch.debounce) { clearTimeout(_collectWatch.debounce); _collectWatch.debounce = null; }
        // Последний досбор перед закрытием (кроме ухода со страницы / старта слайдшоу)
        if (reason === 'timeout' || reason === 'user') { try { grokAutoCollectNewLinks(); } catch(e) {} }
        _collectWatch.until = 0;
        _collectWatchIndicator(0);
        mossadDebug('collect', 'окно досбора закрыто', { reason });
    }

    /** Совместимость: раньше вешал постоянный наблюдатель; теперь досбор — только в окне после клика. */
    function grokInitAutoCollector() {}

    /** Отдельная кнопка — скачать .txt с коллекцией (только тогда извлекает email) */
    function grokDownloadCollection() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Сначала нажмите «Собрать»', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения', true); return; }
        const items = data.items || [];
        const email = grokExtractEmail();
        const date  = data.date || new Date().toISOString().slice(0, 10);
        const filename = `${email}_${date}_${items.length}_links.txt`;
        const blob = new Blob([items.map(i => `${i.url}\t${i.type || 'unknown'}`).join('\n')], { type: 'text/plain' });
        const bUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = bUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(bUrl); }, 2000);
        showToast(`📥 Скачано: ${filename}`);
    }

// ============================================================
    // GROK ENGINE: Playlist Structure & Navigation Resolver
    // ============================================================

    /** Fisher-Yates перемешивание */
    function fisherYatesShuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Строит каноническую структуру плейлиста из сохранённой коллекции:
     * - items: плоский массив в хронологическом порядке (снизу вверх страницы Grok)
     * - groups: массив групп в порядке первого появления элементов снизу вверх
     * - grpMode: режим переключения групп (seq | rev | rnd | off)
     * - itemMode: режим порядка внутри группы (fwd | rev | rnd | off)
     */
    // v1.3.38: кэш разобранной структуры. Раньше вся коллекция (растёт за сессию, хранится в sessionStorage
    // до перезапуска браузера) парсилась JSON.parse 5–8 раз на каждый шаг/клавишу. Теперь — только при
    // изменении сохранённой строки. Результат общий: НЕ мутировать struct/items/groups у вызывающих.
    let _plStructCacheRaw = null;
    let _plStructCache = null;

    function grokGetPlaylistStructure() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return null;
        if (raw === _plStructCacheRaw) return _plStructCache;
        const built = grokBuildPlaylistStructure(raw);
        _plStructCacheRaw = raw;
        _plStructCache = built;
        return built;
    }

    function grokBuildPlaylistStructure(raw) {
        let data;
        try { data = JSON.parse(raw); } catch { return null; }
        const items = data.items || [];
        if (!items.length) return null;

        const grpMode  = data.grpMode  || 'seq';
        const itemMode = data.itemMode || 'fwd';

        const groups = [];
        const groupMap = new Map();
        for (const item of items) {
            const gid = item.convId || '__noconv__';
            let grp = groupMap.get(gid);
            if (!grp) {
                grp = { id: gid, items: [] };
                groupMap.set(gid, grp);
                groups.push(grp);
            }
            grp.items.push(item);
        }

        return { items, groups, grpMode, itemMode };
    }

    /**
     * Находит текущее положение на странице/в коллекции:
     * Возвращает { flatIndex, grpIndex, itemInGrpIndex, currentItem }
     */
    function grokFindCurrentPosition(structure, url = null) {
        if (!structure || !structure.items.length) return null;
        const targetUrl = url || location.href;
        const curUuid = grokExtractUuid(targetUrl);
        const cleanTarget = normUrlKey(targetUrl);

        const isMatch = (item) => {
            if (!item || !item.url) return false;
            if (curUuid) {
                const itemUuid = grokExtractUuid(item.url);
                if (itemUuid && itemUuid.toLowerCase() === curUuid.toLowerCase()) return true;
            }
            return (normUrlKey(item.url) === cleanTarget);
        };

        let flatIndex = structure.items.findIndex(isMatch);
        let grpIndex = -1;
        let itemInGrpIndex = -1;

        for (let g = 0; g < structure.groups.length; g++) {
            const idx = structure.groups[g].items.findIndex(isMatch);
            if (idx !== -1) {
                grpIndex = g;
                itemInGrpIndex = idx;
                break;
            }
        }

        return {
            flatIndex,
            grpIndex,
            itemInGrpIndex,
            currentItem: flatIndex !== -1 ? structure.items[flatIndex] : null
        };
    }


    /**
     * Главный диспетчер навигации по списку:
     * - direction === 'down': строго вниз по нашему списку (в хронологическом порядке)
     * - direction === 'up': строго вверх по нашему списку (в обратном порядке)
     * - direction === 'next_grp': шаг к следующей группе
     * - direction === 'prev_grp': шаг к предыдущей группе
     * - direction === 'auto': шаг автоматического слайдшоу с учётом grpMode и itemMode
     */
    // ── v1.3.38: история показанных элементов (для «назад» в случайных режимах) и явная синхронизация позиции ──
    const GALLERY_HISTORY_MAX = 200;

    function grokReadSS() {
        try { return JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}') || {}; } catch(e) { return {}; }
    }

    function grokIsRandomMode(struct) {
        return !!struct && (struct.grpMode === 'rnd' || struct.itemMode === 'rnd' || struct.itemMode === 'off');
    }

    /** Добавляет url в историю (без повторов подряд), ограничивая размер. Мутирует ss. */
    function grokHistoryPushInto(ss, url) {
        if (!url) return;
        const hist = Array.isArray(ss.history) ? ss.history : [];
        const key = normUrlKey(url);
        if (!hist.length || normUrlKey(hist[hist.length - 1]) !== key) hist.push(url);
        if (hist.length > GALLERY_HISTORY_MAX) hist.splice(0, hist.length - GALLERY_HISTORY_MAX);
        ss.history = hist;
    }

    /**
     * Явно фиксирует «текущий» элемент слайдшоу в SS: targetUrl/targetUuid, curGrpIdx/curItemIdx, отметки
     * посещения и история. Вызывается при ЛЮБОМ переходе по плейлисту (авто, хоткеи, клик в списке),
     * чтобы следующий автошаг считался от реально выбранного элемента, а не от устаревшей позиции.
     */
    function grokSyncSlidePosition(item, opts = {}) {
        if (!item || !item.url) return;
        const struct = opts.struct || grokGetPlaylistStructure();
        const ss = opts.ss || grokReadSS();
        if (!ss.active && !opts.force) return; // слайдшоу по коллекции не запущено — позицию не ведём
        const base = normUrlKey(item.url);
        ss.targetUrl = item.url;
        ss.targetUuid = grokExtractUuid(item.url);
        if (struct) {
            for (let g = 0; g < struct.groups.length; g++) {
                const i = struct.groups[g].items.findIndex(it => normUrlKey(it.url) === base);
                if (i !== -1) {
                    if (ss.curGrpIdx !== g) ss.visitedInCurGroup = [];
                    ss.curGrpIdx = g;
                    ss.curItemIdx = i;
                    const vg = Array.isArray(ss.visitedGroupsInCircle) ? ss.visitedGroupsInCircle : [];
                    if (!vg.includes(struct.groups[g].id)) vg.push(struct.groups[g].id);
                    ss.visitedGroupsInCircle = vg;
                    break;
                }
            }
        }
        const vcg = Array.isArray(ss.visitedInCurGroup) ? ss.visitedInCurGroup : [];
        if (!vcg.includes(base)) vcg.push(base);
        ss.visitedInCurGroup = vcg;
        const vc = Array.isArray(ss.visitedInCircle) ? ss.visitedInCircle : [];
        if (!vc.includes(base)) vc.push(base);
        ss.visitedInCircle = vc;
        if (opts.pushHistory !== false) grokHistoryPushInto(ss, item.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('pos', 'позиция синхронизирована', { source: opts.source, g: ss.curGrpIdx, i: ss.curItemIdx, hist: (ss.history || []).length });
    }

    function grokGetNextSlideItem(direction = 'auto', overrideUrl = null) {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) return null;

        // v1.3.38: «текущий» элемент — тот, что явно выбран скриптом (ss.targetUrl), а не URL страницы:
        // URL отстаёт при переключении киноплёнки и может принадлежать предыдущему посту во время перехода.
        if (!overrideUrl) {
            const ssPos = grokReadSS();
            if (ssPos.active && ssPos.targetUrl &&
                struct.items.some(it => normUrlKey(it.url) === normUrlKey(ssPos.targetUrl))) {
                overrideUrl = ssPos.targetUrl;
            }
        }
        const curPos = grokFindCurrentPosition(struct, overrideUrl);

        // ── 1. Зацикленный набор (R / loopSet) ──
        const loopSet = getGrokLoopSet(); // loop.js: всегда { urls: [], groupIds: [] }
        const loopUrls = loopSet.urls;
        const loopGroupIds = loopSet.groupIds;

        if (loopUrls.length > 0 || loopGroupIds.length > 0) {
            const loopItems = struct.items.filter(item => {
                const base = normUrlKey(item.url);
                const inUrls = loopUrls.some(u => normUrlKey(u) === base);
                const inGrps = loopGroupIds.includes(item.convId || '__noconv__');
                return inUrls || inGrps;
            });
            if (loopItems.length > 0) {
                const curLoopIdx = loopItems.findIndex(item => {
                    if (!curPos || !curPos.currentItem) return false;
                    return normUrlKey(item.url) === normUrlKey(curPos.currentItem.url);
                });
                let targetIdx = 0;
                if (curLoopIdx !== -1) {
                    if (direction === 'up' || (direction === 'auto' && struct.itemMode === 'rev')) {
                        targetIdx = (curLoopIdx - 1 + loopItems.length) % loopItems.length;
                    } else {
                        targetIdx = (curLoopIdx + 1) % loopItems.length;
                    }
                }
                const circleCompleted = (curLoopIdx === loopItems.length - 1 && targetIdx === 0);
                return { item: loopItems[targetIdx], circleCompleted };
            }
        }

        // ── 2. Переходы по группам (Alt+ArrowDown / Alt+ArrowUp) ──
        if (direction === 'next_grp' || direction === 'prev_grp') {
            if (!struct.groups.length) return null;
            const curG = (curPos && curPos.grpIndex !== -1) ? curPos.grpIndex : 0;
            const nextG = direction === 'next_grp'
                ? (curG + 1) % struct.groups.length
                : (curG - 1 + struct.groups.length) % struct.groups.length;
            const targetGrp = struct.groups[nextG];
            const targetItem = struct.itemMode === 'rev'
                ? targetGrp.items[targetGrp.items.length - 1]
                : targetGrp.items[0];
            return { item: targetItem, circleCompleted: false };
        }

        // ── 3. Ручной переход ВНИЗ (ArrowDown / PageDown) — СТРОГО ВНИЗ ПО СПИСКУ ──
        if (direction === 'down') {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[0], circleCompleted: false };
            }
            if (struct.grpMode === 'off' || !struct.groups.length) {
                const nextFlat = (curPos.flatIndex + 1) % struct.items.length;
                return { item: struct.items[nextFlat], circleCompleted: nextFlat === 0 };
            }
            const g = curPos.grpIndex;
            const curGrp = struct.groups[g];
            const i = curPos.itemInGrpIndex;
            if (curGrp && i + 1 < curGrp.items.length) {
                return { item: curGrp.items[i + 1], circleCompleted: false };
            }
            // Конец группы -> переход к первой записи следующей группы вниз
            const nextG = (g + 1) % struct.groups.length;
            const nextGrp = struct.groups[nextG];
            return { item: nextGrp.items[0], circleCompleted: nextG === 0 };
        }

        // ── 4а. «Назад» в случайных режимах — по истории показанных элементов (v1.3.38) ──
        if (direction === 'up' && grokIsRandomMode(struct)) {
            const ssH = grokReadSS();
            const hist = Array.isArray(ssH.history) ? ssH.history.slice() : [];
            const curKey = normUrlKey((curPos && curPos.currentItem && curPos.currentItem.url) || overrideUrl || location.href);
            while (hist.length && normUrlKey(hist[hist.length - 1]) === curKey) hist.pop();
            while (hist.length) {
                const prevKey = normUrlKey(hist[hist.length - 1]);
                const prevItem = struct.items.find(it => normUrlKey(it.url) === prevKey);
                if (prevItem) {
                    ssH.history = hist; // вершина истории = элемент, на который возвращаемся
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ssH));
                    mossadDebug('pos', 'назад по истории', { left: hist.length });
                    return { item: prevItem, circleCompleted: false, fromHistory: true };
                }
                hist.pop(); // элемента уже нет в коллекции
            }
            // История пуста — обычный шаг вверх по списку
        }

        // ── 4. Ручной переход ВВЕРХ (ArrowUp / PageUp) — СТРОГО ВВЕРХ ПО СПИСКУ ──
        if (direction === 'up') {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[struct.items.length - 1], circleCompleted: false };
            }
            if (struct.grpMode === 'off' || !struct.groups.length) {
                const prevFlat = (curPos.flatIndex - 1 + struct.items.length) % struct.items.length;
                return { item: struct.items[prevFlat], circleCompleted: prevFlat === struct.items.length - 1 };
            }
            const g = curPos.grpIndex;
            const curGrp = struct.groups[g];
            const i = curPos.itemInGrpIndex;
            if (curGrp && i - 1 >= 0) {
                return { item: curGrp.items[i - 1], circleCompleted: false };
            }
            // Начало группы -> переход к последней записи предыдущей группы вверх
            const prevG = (g - 1 + struct.groups.length) % struct.groups.length;
            const prevGrp = struct.groups[prevG];
            return { item: prevGrp.items[prevGrp.items.length - 1], circleCompleted: prevG === struct.groups.length - 1 };
        }

        // ── 5. Автоматический шаг слайдшоу (direction === 'auto') ──
        let ss = {};
        try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
        let visitedInCurGroup = ss.visitedInCurGroup || [];
        let visitedGroups = ss.visitedGroupsInCircle || [];
        let visitedInCircle = ss.visitedInCircle || [];

        // Режим без групп (grpMode === 'off')
        if (struct.grpMode === 'off' || !struct.groups.length) {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[0], circleCompleted: false };
            }
            if (struct.itemMode === 'rev') {
                const prevIdx = curPos.flatIndex - 1;
                if (prevIdx < 0) {
                    return { item: struct.items[struct.items.length - 1], circleCompleted: true };
                }
                return { item: struct.items[prevIdx], circleCompleted: false };
            }
            if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
                const curBase = normUrlKey(curPos.currentItem?.url);
                if (!visitedInCircle.includes(curBase)) visitedInCircle.push(curBase);
                const unvisited = struct.items.filter(it => !visitedInCircle.includes(normUrlKey(it.url)));
                if (unvisited.length === 0) {
                    ss.visitedInCircle = [];
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    const rndItem = struct.items[Math.floor(Math.random() * struct.items.length)];
                    return { item: rndItem, circleCompleted: true };
                }
                const rndItem = unvisited[Math.floor(Math.random() * unvisited.length)];
                visitedInCircle.push(normUrlKey(rndItem.url));
                ss.visitedInCircle = visitedInCircle;
                _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                return { item: rndItem, circleCompleted: false };
            }
            // itemMode === 'fwd' (прямой порядок)
            const nextIdx = curPos.flatIndex + 1;
            if (nextIdx >= struct.items.length) {
                return { item: struct.items[0], circleCompleted: true };
            }
            return { item: struct.items[nextIdx], circleCompleted: false };
        }

        // Режим с группами
        // Читаем позицию из SS — она явно записывается на каждом шаге и не зависит от DOM
        let g, i;
        const hasSsPos = typeof ss.curGrpIdx === 'number' && ss.curGrpIdx >= 0 &&
                         typeof ss.curItemIdx === 'number' && ss.curItemIdx >= 0 &&
                         ss.curGrpIdx < struct.groups.length;
        if (hasSsPos) {
            g = ss.curGrpIdx;
            i = Math.min(ss.curItemIdx, struct.groups[g].items.length - 1);
        } else {
            // Fallback: определяем по URL (первый запуск или внешняя навигация)
            g = (curPos && curPos.grpIndex !== -1) ? curPos.grpIndex : 0;
            i = (curPos && curPos.itemInGrpIndex !== -1) ? curPos.itemInGrpIndex : 0;
        }
        let curGrp = struct.groups[g];

        const curItemForVisited = curGrp.items[i];
        const curBase = normUrlKey(curItemForVisited?.url);
        if (!visitedInCurGroup.includes(curBase)) visitedInCurGroup.push(curBase);
        if (!visitedGroups.includes(curGrp.id)) visitedGroups.push(curGrp.id);

        let nextItemInGrp = null;
        let groupDone = false;

        if (struct.itemMode === 'fwd') {
            // Идем вниз по элементам группы
            if (i + 1 < curGrp.items.length) {
                nextItemInGrp = curGrp.items[i + 1];
            } else {
                groupDone = true;
            }
        } else if (struct.itemMode === 'rev') {
            // Идем вверх по элементам группы
            if (i - 1 >= 0) {
                nextItemInGrp = curGrp.items[i - 1];
            } else {
                groupDone = true;
            }
        } else {
            // rnd / off: случайный выбор среди непосещенных в текущей группе
            const unvisitedInGrp = curGrp.items.filter(it => !visitedInCurGroup.includes(normUrlKey(it.url)));
            if (unvisitedInGrp.length > 0) {
                nextItemInGrp = unvisitedInGrp[Math.floor(Math.random() * unvisitedInGrp.length)];
            } else {
                groupDone = true;
            }
        }

        if (!groupDone && nextItemInGrp) {
            const newItemIdx = curGrp.items.indexOf(nextItemInGrp);
            visitedInCurGroup.push(normUrlKey(nextItemInGrp.url));
            ss.visitedInCurGroup = visitedInCurGroup;
            ss.curGrpIdx = g;
            ss.curItemIdx = newItemIdx >= 0 ? newItemIdx : i + 1;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            return { item: nextItemInGrp, circleCompleted: false };
        }

        // Группа завершена! Переходим к следующей группе
        ss.visitedInCurGroup = [];
        let nextG = -1;
        let circleCompleted = false;

        if (struct.grpMode === 'rev') {
            // Группы вверх по списку
            nextG = g - 1;
            if (nextG < 0) {
                nextG = struct.groups.length - 1;
                circleCompleted = true;
            }
        } else if (struct.grpMode === 'rnd') {
            // Случайный выбор следующей группы
            const unvisitedGrps = struct.groups.filter(grp => !visitedGroups.includes(grp.id));
            if (unvisitedGrps.length === 0) {
                circleCompleted = true;
                visitedGroups = [];
                const rndGrp = struct.groups[Math.floor(Math.random() * struct.groups.length)];
                nextG = struct.groups.indexOf(rndGrp);
            } else {
                const rndGrp = unvisitedGrps[Math.floor(Math.random() * unvisitedGrps.length)];
                nextG = struct.groups.indexOf(rndGrp);
            }
            visitedGroups.push(struct.groups[nextG].id);
        } else {
            // grpMode === 'seq': группы вниз по списку
            nextG = g + 1;
            if (nextG >= struct.groups.length) {
                nextG = 0;
                circleCompleted = true;
            }
        }

        ss.visitedGroupsInCircle = visitedGroups;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        const targetGrp = struct.groups[nextG];
        let targetItem = null;
        if (struct.itemMode === 'rev') {
            targetItem = targetGrp.items[targetGrp.items.length - 1];
        } else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
            targetItem = targetGrp.items[Math.floor(Math.random() * targetGrp.items.length)];
        } else {
            targetItem = targetGrp.items[0];
        }

        ss.visitedInCurGroup = [normUrlKey(targetItem.url)];
        ss.curGrpIdx = nextG;
        ss.curItemIdx = targetGrp.items.indexOf(targetItem);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        return { item: targetItem, circleCompleted };
    }

    /** Совместимость: возвращает плоскую очередь элементов */
    function grokBuildGalleryQueue(allItems, ssState) {
        const struct = grokGetPlaylistStructure();
        if (struct && struct.items.length) {
            const queue = [];
            const grpOrder = struct.grpMode === 'rev'
                ? struct.groups.slice().reverse()
                : (struct.grpMode === 'rnd' ? fisherYatesShuffle(struct.groups) : struct.groups.slice());

            for (const g of grpOrder) {
                let itms = g.items.slice();
                if (struct.itemMode === 'rev') itms.reverse();
                else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') itms = fisherYatesShuffle(itms);
                queue.push(...itms);
            }
            return queue;
        }
        return (allItems || []).slice();
    }

    /**
     * SPA-навигация на grok.com через Next.js router.push() — без перезагрузки страницы.
     * Подтверждено: window.next.router доступен на grok.com.
     * Fallback: клик по <a> или window.location.href (полный переход).
     */

// ============================================================
    // GROK ENGINE: Loop R State Manager (Unified Storage & Lookup)
    // ============================================================

    function getGrokLoopSet() {
        const raw = _gSS.getItem(GALLERY_LOOP_KEY);
        if (!raw) return { urls: [], groupIds: [] };
        try {
            const parsed = JSON.parse(raw);
            return {
                urls: Array.isArray(parsed.urls) ? parsed.urls : [],
                groupIds: Array.isArray(parsed.groupIds) ? parsed.groupIds : []
            };
        } catch {
            return { urls: [], groupIds: [] };
        }
    }

    function saveGrokLoopSet(loopSet) {
        _gSS.setItem(GALLERY_LOOP_KEY, JSON.stringify(loopSet));
    }

    function clearGrokLoopSet() {
        _gSS.removeItem(GALLERY_LOOP_KEY);
    }

    function isGrokItemLooped(url, loopSet = null) {
        if (!url) return false;
        const set = loopSet || getGrokLoopSet();
        const baseUrl = stripUrlQuery(url);
        return set.urls.some(u => stripUrlQuery(u) === baseUrl);
    }

    function isGrokGroupLooped(convId, loopSet = null) {
        if (!convId || convId === '__noconv__') return false;
        const set = loopSet || getGrokLoopSet();
        return set.groupIds.includes(convId);
    }

    function getGrokActiveLoopItems(allItems) {
        const set = getGrokLoopSet();
        if (set.urls.length === 0 && set.groupIds.length === 0) return [];
        return allItems.filter(it => {
            const baseUrl = stripUrlQuery(it.url);
            const inUrls = set.urls.some(u => stripUrlQuery(u) === baseUrl);
            const inGrps = it.convId && set.groupIds.includes(it.convId);
            return inUrls || inGrps;
        });
    }

// ============================================================
    // GROK ENGINE: Gallery Slideshow (Filmstrip & SPA Navigation, Tick, Loop)
    // ============================================================

    /**
     * Навигация на grok.com:
     * - Та же conversation (группа) → filmstrip click (мгновенно, без перезагрузки)
     * - Другая conversation → window.location.href (полный переход)
     */
    // ── v1.3.38: блокировка навигации «в полёте» ──
    // Раньше несколько источников (таймер фото, конец кругов видео, монитор URL, тик, ретраи) могли
    // запустить шаг подряд, пока предыдущий переход ещё не завершился → «шторм» ~10 переходов/с в
    // режиме случайных групп. Теперь автошаг игнорируется, пока предыдущий переход не «прибыл» (тик
    // на новом посте) или не истёк таймаут. Ручные шаги (хоткеи, клик в плейлисте) перехватывают
    // блокировку (force). ANTI_PATTERNS §17.
    const GALLERY_NAV_LOCK_MS = 4000;
    const GALLERY_MIN_DWELL_MS = 600; // автошаг не раньше, чем через 600 мс после прибытия (фото ≥ 1 с)
    const _galleryNav = { inFlight: false, targetUuid: '', startedAt: 0, source: '', seq: 0, arrivedAt: 0 };

    function grokNavInFlight() {
        if (!_galleryNav.inFlight) return false;
        if (Date.now() - _galleryNav.startedAt > GALLERY_NAV_LOCK_MS) {
            mossadDebug('nav', 'таймаут блокировки перехода — снимаем', { source: _galleryNav.source, target: _galleryNav.targetUuid });
            _galleryNav.inFlight = false;
            return false;
        }
        return true;
    }

    /** Захват блокировки перехода. false — автошаг отклонён (переход уже идёт). */
    function grokBeginNav(url, source, force = false) {
        if (!force && grokNavInFlight()) {
            mossadDebug('nav', 'шаг ОТКЛОНЁН: предыдущий переход ещё в полёте', { source, inFlightFrom: _galleryNav.source, target: _galleryNav.targetUuid });
            return false;
        }
        _galleryNav.inFlight = true;
        _galleryNav.targetUuid = (grokExtractUuid(url || '') || '').toLowerCase();
        _galleryNav.startedAt = Date.now();
        _galleryNav.source = source || '?';
        _galleryNav.seq++;
        const mySeq = _galleryNav.seq;
        // Сторож: если «прибытие» так и не случилось (переход не удался), снимаем блокировку и продолжаем
        setTimeout(() => {
            if (_galleryNav.inFlight && _galleryNav.seq === mySeq) {
                mossadDebug('nav', 'сторож: переход не завершился — снимаем блокировку', { source: _galleryNav.source });
                _galleryNav.inFlight = false;
                if (slideshowActive && !slideshowPaused) requestSlideCycle(0, 'nav-watchdog');
            }
        }, GALLERY_NAV_LOCK_MS + 100);
        mossadDebug('nav', 'переход начат', { source, target: _galleryNav.targetUuid, seq: _galleryNav.seq, force: !!force });
        return true;
    }

    function grokEndNav(reason) {
        if (!_galleryNav.inFlight) return;
        mossadDebug('nav', 'переход завершён', { reason, source: _galleryNav.source, ms: Date.now() - _galleryNav.startedAt });
        _galleryNav.inFlight = false;
        _galleryNav.arrivedAt = Date.now();
    }

    function grokSpaNavigate(url) {
        if (!url) return;

        // Сохраняем состояние паузы перед переходом
        const wasPaused = window._mossadGalleryPaused ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        if (wasPaused) {
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            if (typeof SESSION_PAUSED_KEY !== 'undefined') sessionStorage.setItem(SESSION_PAUSED_KEY, 'true');
        } else {
            sessionStorage.removeItem('mossad_gallery_paused');
            if (typeof SESSION_PAUSED_KEY !== 'undefined') sessionStorage.removeItem(SESSION_PAUSED_KEY);
        }
        sessionStorage.setItem('mossad_navigating_group', 'true');

        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;
            const targetUuid = grokExtractUuid(urlObj.pathname);

            const struct = grokGetPlaylistStructure();
            const isPostPage = isGrokPostPage();

            if (isPostPage && struct) {
                const targetPos = grokFindCurrentPosition(struct, url);
                const currentPos = grokFindCurrentPosition(struct);

                const isSameGroup = targetPos && currentPos &&
                                    targetPos.grpIndex !== -1 &&
                                    targetPos.grpIndex === currentPos.grpIndex;

                if (isSameGroup) {
                    // Та же conversation → filmstrip click, без перезагрузки страницы
                    let filmstripBtn = null;
                    if (targetUuid) {
                        filmstripBtn = grokFindFilmstripItemByUuid(targetUuid);
                    }
                    if (!filmstripBtn) {
                        const filmItems = grokGetFilmstripItems();
                        if (targetPos.itemInGrpIndex >= 0 && targetPos.itemInGrpIndex < filmItems.length) {
                            filmstripBtn = filmItems[targetPos.itemInGrpIndex];
                        }
                    }

                    if (filmstripBtn) {
                        console.log('[MOSSAD] grokSpaNavigate: та же conversation → filmstrip click');
                        mossadDebug('nav', 'filmstrip click (та же conversation)', { target: targetUuid });
                        const navSeq = _galleryNav.seq;
                        filmstripBtn.click();
                        try { history.replaceState(null, '', path); } catch(e) {}
                        // До 6 проверок × 40 мс ждём смены UUID в URL, затем тик в любом случае
                        waitForCondition(() => {
                            const curUuid = grokExtractUuid(location.pathname);
                            return !!(curUuid && targetUuid && curUuid.toLowerCase() === targetUuid.toLowerCase());
                        }, 240, 40).then(() => {
                            // Если за это время начался другой (ручной) переход — его тик сделает он сам
                            if (navSeq !== _galleryNav.seq) {
                                mossadDebug('nav', 'тик пропущен: устаревший переход', { navSeq, cur: _galleryNav.seq });
                                return;
                            }
                            grokGallerySlideshowTick('spa-arrived');
                        });
                        return;
                    }
                }
            }
        } catch(e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // Другая conversation или нет filmstrip → полный переход по URL
        console.log('[MOSSAD] grokSpaNavigate: другая conversation → location.href', url);
        mossadDebug('nav', 'location.href (другая conversation)', { url });
        window.location.href = url;
    }

    // v1.3.38: ОДИН общий AudioContext на страницу (раньше — new AudioContext() на каждый круг без close():
    // контексты копились, каждый держал аудиопоток браузера → лаги до перезапуска браузера). ANTI_PATTERNS §17.
    let _circleAudioCtx = null;
    let _circleSoundLastAt = 0;
    const CIRCLE_SOUND_MIN_GAP_MS = 2000; // не чаще одного сигнала за 2 с

    function getCircleAudioCtx() {
        if (_circleAudioCtx && _circleAudioCtx.state !== 'closed') return _circleAudioCtx;
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        _circleAudioCtx = new Ctor();
        return _circleAudioCtx;
    }

    /** Звуковой сигнал окончания круга (до-ми-соль) */
    function playCircleDoneSound() {
        const now = Date.now();
        if (now - _circleSoundLastAt < CIRCLE_SOUND_MIN_GAP_MS) return;
        _circleSoundLastAt = now;
        try {
            const ctx = getCircleAudioCtx();
            if (!ctx) return;
            if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                try { ctx.resume().catch(() => {}); } catch(e) {}
            }
            [523, 659, 784].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g   = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                const t0 = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.25, t0);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
                osc.start(t0); osc.stop(t0 + 0.35);
                osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch(e) {} };
            });
        } catch(e) { /* AudioContext может быть заблокирован */ }
    }


    /** Запустить слайдшоу по коллекции (с учётом текущего режима) */
    /**
     * v1.3.40: Insert (большое слайдшоу) на Grok.
     *  - ссылки уже собраны → старт как раньше;
     *  - ссылок нет и мы на /imagine/saved → 1-е нажатие: сбор видимых + окно досбора
     *    (grokStartCollectWatch через grokSaveCollection), тост «Insert ещё раз — старт»;
     *    2-е нажатие → grokStartGallerySlideshow() (он сам гасит окно досбора).
     *  - ссылок нет и не Saved → прежний тост «Сначала соберите коллекцию».
     * Возвращает 'start' | 'collect'.
     */
    function grokInsertCollectOrStart() {
        const struct = grokGetPlaylistStructure();
        const hasLinks = !!(struct && struct.items && struct.items.length);
        if (hasLinks || grokIsCollectWatching() || !isGrokSavedPage()) {
            mossadDebug('insert', 'старт слайдшоу', { hasLinks, watching: grokIsCollectWatching() });
            grokStartGallerySlideshow();
            return 'start';
        }
        grokSaveCollection(document.getElementById('mossad-gallery-collect'));
        const sec = config.collectWatchSec || 30;
        const hkPP = config.hk && config.hk.galleryPlayPause;
        const hk0 = Array.isArray(hkPP) ? hkPP[0] : hkPP;
        const label = hk0 && hk0.key ? formatHotkey(hk0) : 'Insert';
        showToast(`📋 Сбор начат (${sec} с) — скролльте ленту. ${label} ещё раз — старт слайдшоу`);
        mossadDebug('insert', 'первое нажатие: сбор + окно досбора', { sec });
        return 'collect';
    }

    /**
     * v1.3.41: единая точка для Insert. Пауза/продолжение — только если слайдшоу реально идёт
     * в этой вкладке (window._mossadGalleryActive). «Активный» флаг в sessionStorage без живого
     * слайдшоу на /imagine/saved — устаревший: чистим его и идём в «собрать → старт».
     */
    function grokHandleGalleryPlayPause(source = 'hotkey') {
        if (window._mossadGalleryActive) {
            mossadDebug('insert', 'пауза/продолжение', { source });
            toggleGalleryPause();
            return 'toggle';
        }
        let ssActive = false;
        try { ssActive = !!JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active; } catch (e) {}
        if (ssActive && isGrokSavedPage()) {
            mossadDebug('insert', 'устаревший флаг active на Saved — сброшен', { source });
            _gSS.removeItem(GALLERY_SS_KEY);
            sessionStorage.removeItem('mossad_gallery_paused');
        }
        return grokInsertCollectOrStart();
    }

    function grokStartGallerySlideshow() {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }

        // Если уже стоим на элементе из коллекции — стартуем прямо с него!
        let startItem = null;
        const curPos = grokFindCurrentPosition(struct);
        if (curPos && curPos.currentItem) {
            startItem = curPos.currentItem;
        } else {
            // v1.3.41: «Случайно» (Gr− Md−) — старт с любого элемента всей коллекции
            if (struct.grpMode === 'off' && (struct.itemMode === 'off' || struct.itemMode === 'rnd')) {
                startItem = struct.items[Math.floor(Math.random() * struct.items.length)];
            }
            // Выбираем стартовую группу
            let startGrp = null;
            if (struct.grpMode === 'rev') {
                startGrp = struct.groups[struct.groups.length - 1];
            } else if (struct.grpMode === 'rnd') {
                startGrp = struct.groups[Math.floor(Math.random() * struct.groups.length)];
            } else {
                startGrp = struct.groups[0];
            }
            if (startItem) {
                // уже выбран (случайный режим)
            } else if (startGrp && startGrp.items.length) {
                if (struct.itemMode === 'rev') {
                    startItem = startGrp.items[startGrp.items.length - 1];
                } else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
                    startItem = startGrp.items[Math.floor(Math.random() * startGrp.items.length)];
                } else {
                    startItem = startGrp.items[0];
                }
            } else {
                startItem = struct.items[0];
            }
        }
        if (!startItem) return;
        grokStartGallerySlideshowFrom(startItem);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        if (!startItem) return;
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) {
            showToast('⚠️ Коллекция не собрана', true);
            return;
        }

        grokStopCollectWatch('slideshow'); // v1.3.39: окно досбора закрывается при старте слайдшоу
        // Немедленно останавливаем ВСЕ таймеры предыдущего слайда (включая отложенный запуск цикла,
        // v1.3.38) и перехватываем блокировку перехода: устаревшие автошаги не перебьют выбор.
        cancelSlideTimers();
        const prevSS = grokReadSS();

        const startBase = normUrlKey(startItem.url);
        const startGid = startItem.convId || '__noconv__';
        const startUuid = grokExtractUuid(startItem.url);

        // Ищем явную позицию стартового элемента в структуре
        let startGrpIdx = 0, startItemIdx = 0;
        for (let _g = 0; _g < struct.groups.length; _g++) {
            const _i = struct.groups[_g].items.findIndex(it =>
                normUrlKey(it.url) === startBase);
            if (_i !== -1) { startGrpIdx = _g; startItemIdx = _i; break; }
        }

        const ss = {
            active: true,
            circle: 1,
            total: struct.items.length,
            targetUrl: startItem.url,
            targetUuid: startUuid,
            curGrpIdx: startGrpIdx,
            curItemIdx: startItemIdx,
            visitedInCurGroup: [startBase],
            visitedGroupsInCircle: [startGid],
            visitedInCircle: [startBase],
            history: Array.isArray(prevSS.history) ? prevSS.history : []
        };
        grokHistoryPushInto(ss, startItem.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('pos', 'старт с выбранного элемента', { g: startGrpIdx, i: startItemIdx });
        const wasPaused = window._mossadGalleryPaused || sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        if (wasPaused) {
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
        } else {
            sessionStorage.removeItem('mossad_gallery_paused');
            window._mossadGalleryPaused = false;
        }
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = `Gr${grIcon[struct.grpMode]||'↓'} Md${grIcon[struct.itemMode]||'↓'}`;
        showToast(`▶ Слайдшоу [${modeLabel}]: ${struct.items.length} ген.`);
        grokTogglePlaylistPanel(true);
        grokHighlightActivePlaylistItem(startItem.url);

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда

        grokBeginNav(startItem.url, 'manual-pick', true);
        const navSeq = _galleryNav.seq;
        const curClean = normUrlKey(location.href);
        if (curClean === startBase) {
            grokGallerySlideshowTick('start-here');
        } else {
            setTimeout(() => {
                if (navSeq !== _galleryNav.seq) return; // успели выбрать другой элемент
                grokSpaNavigate(startItem.url);
            }, 150);
        }
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        window._mossadGalleryPaused = false;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        updateGalleryStatusBtn('idle');
        showToast('⏹ Gallery слайдшоу остановлено');
    }

    /** Обновляет текст/цвет кнопки статуса слайдшоу и видимость кнопки стоп */
    function updateGalleryStatusBtn(state) {
        // state: 'idle' | 'playing' | 'paused'
        const btn = document.getElementById('mossad-gallery-status');
        const btnStop = document.getElementById('mossad-gallery-stop');
        if (!btn) return;

        if (state === 'playing') {
            mossadLabelEl(btn, 'pause');
            btn.title = 'Пауза';
            btn.style.background = '#059669';
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = '1px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else if (state === 'paused') {
            mossadLabelEl(btn, 'resume');
            btn.title = 'Продолжить';
            btn.style.background = '#d97706';
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else {
            mossadLabelEl(btn, 'slideshow');
            btn.title = 'Запустить слайдшоу по генерациям';
            btn.style.background = '#1e3a5f';
            btn.style.color = '#93c5fd';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = 'normal';
            if (btnStop) btnStop.style.display = 'none';
        }
    }

    /** Переключить паузу галерейного слайдшоу */
    function toggleGalleryPause() {
        if (!window._mossadGalleryActive) return;
        window._mossadGalleryPaused = !window._mossadGalleryPaused;
        if (window._mossadGalleryPaused) {
            setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            setSlideshowPaused(false);
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            showToast('▶ Продолжаем');
            requestSlideCycle(0, 'gallery-resume');
        }
    }

    /** Выполняет шаг к следующему слайду по логике плейлиста */
    function grokGalleryStepNext(source = 'auto') {
        // v1.3.38: автошаг не выполняется, пока предыдущий переход не завершился (см. grokBeginNav)
        if (grokNavInFlight()) {
            mossadDebug('nav', 'автошаг ОТКЛОНЁН: переход в полёте', { source, inFlightFrom: _galleryNav.source });
            return false;
        }
        if (_galleryNav.arrivedAt && Date.now() - _galleryNav.arrivedAt < GALLERY_MIN_DWELL_MS) {
            const elapsed = Date.now() - _galleryNav.arrivedAt;
            mossadDebug('nav', 'автошаг ОТКЛОНЁН: слишком рано после прибытия', { source, ms: elapsed });
            // triggerNextSlide уже отменил таймеры — перезапускаем цикл текущего слайда, иначе слайдшоу встанет
            requestSlideCycle(GALLERY_MIN_DWELL_MS - elapsed + 50, 'dwell-retry');
            return false;
        }
        const nextRes = grokGetNextSlideItem('auto');
        if (!nextRes || !nextRes.item) {
            mossadDebug('step', 'следующий элемент не найден', { source });
            return false;
        }
        if (!grokBeginNav(nextRes.item.url, 'auto:' + source)) return false;

        if (nextRes.circleCompleted) {
            mossadPerfSnapshot('circle');
            playCircleDoneSound();
            resetSlideTrackingState('circle'); // v1.3.43: новый круг — забыть «прошлое видео» прошлого круга
            let ss = {};
            try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
            ss.circle = (ss.circle || 1) + 1;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            showToast(`🔄 Круг ${ss.circle} начался!`);
        }

        let ss = {};
        try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
        ss.targetUrl = nextRes.item.url;
        ss.targetUuid = grokExtractUuid(nextRes.item.url);
        grokHistoryPushInto(ss, nextRes.item.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('step', 'автошаг', { source, circle: !!nextRes.circleCompleted, target: ss.targetUuid });

        if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
        else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда
        grokSpaNavigate(nextRes.item.url);
        return true;
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick(source = 'tick') {
        if (!isGrokPostPage()) return;
        const _pt = performance.now();
        try { return _grokGallerySlideshowTick(source); } finally { mossadPerfStep('galleryTick', _pt); }
    }
    function _grokGallerySlideshowTick(source) {
        // Прибыли на пост: переход завершён
        grokEndNav(source);
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;
        // Все старые таймеры предыдущего слайда — отменить (ровно один новый запуск цикла ниже)
        cancelSlideTimers();

        if (sessionStorage.getItem('mossad_navigating_group') === 'true') {
            sessionStorage.removeItem('mossad_navigating_group');
        }

        // Проверяем, стояло ли слайдшоу на паузе до перехода
        const isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                         (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        window._mossadGalleryPaused = isPaused;
        setSlideshowPaused(isPaused);

        // Показываем компактный индикатор (или обновляем существующий)
        let indicator = document.getElementById('mossad-gallery-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'mossad-gallery-indicator';
            indicator.style.cssText = `
                position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
                z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
                border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                padding:5px 14px; font-family:system-ui,sans-serif; font-size:11px;
                color:#9ca3af; display:flex; align-items:center; gap:8px;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(indicator);
        }


        const struct = grokGetPlaylistStructure();



        const grpMode = struct?.grpMode || 'seq';
        const itemMode = struct?.itemMode || 'fwd';
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[grpMode]||'↓'} Md${grIcon[itemMode]||'↓'}`;
        const statusPrefix = isPaused ? '⏸' : '▶';

        // Позиция из SS (явная, надёжная)
        let posText = '';
        if (struct) {
            const ssG = typeof ss.curGrpIdx === 'number' ? ss.curGrpIdx : -1;
            const ssI = typeof ss.curItemIdx === 'number' ? ss.curItemIdx : -1;
            if (ssG >= 0 && ssI >= 0 && ssG < struct.groups.length) {
                const grp = struct.groups[ssG];
                // flatIndex = число элементов во всех предыдущих группах + ssI
                let flatIdx = ssI;
                for (let _g = 0; _g < ssG; _g++) flatIdx += struct.groups[_g].items.length;
                posText = `${flatIdx + 1}/${struct.items.length}`;
                if (struct.groups.length > 1) posText += ` (гр. ${ssG + 1}/${struct.groups.length})`;
            } else {
                posText = `${struct.items.length}`;
            }
        }


        indicator.innerHTML = `<span id="mgi-status">${statusPrefix} ${modeTag} · ${posText} · Круг ${ss.circle || 1}</span>`;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn(isPaused ? 'paused' : 'playing');

        // Подсвечиваем активный файл в открытом монолитном списке (плейлисте)
        grokHighlightActivePlaylistItem(ss.targetUrl || null);

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = (stepSource) => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            grokGalleryStepNext(stepSource || 'next-fn');
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = isPaused;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        if (!isPaused) {
            requestSlideCycle(300, 'tick:' + source);
        }
    }

    // Фасад для явного контракта MOSSAD GALLERY
    window.MOSSAD_GALLERY = {
        isActive: () => !!window._mossadGalleryActive,
        isPaused: () => !!window._mossadGalleryPaused,
        next: () => {
            if (typeof window._mossadGalleryNextFn === 'function') {
                window._mossadGalleryNextFn('facade');
            }
        },
        pause: toggleGalleryPause,
        stop: grokStopGallerySlideshow,
        start: grokStartGallerySlideshow,
        highlightActive: (url) => (grokHighlightActivePlaylistItem(url)),
        togglePlaylist: (force) => (grokTogglePlaylistPanel(force))
    };

// ============================================================
    // GROK ENGINE: UI Gallery Bar (Main Widget Sub-panel)
    // ============================================================

    /** Инициализация строки галереи внутри виджета MOSSAD (для всех страниц grok.com) */
    function initGrokGalleryBar() {
        if (rootDomain !== 'grok.com') return;
        if (document.getElementById('mossad-gallery-row')) return;

        const container = document.getElementById('mossad-widget-container');
        if (!container) return;

        const row = document.createElement('div');
        row.id = 'mossad-gallery-row';
        row.style.cssText = `
            background: rgba(20,20,20,0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 5px 8px;
            display: flex; align-items: center; gap: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab; flex-wrap: nowrap; pointer-events: auto;
            width: 100%; box-sizing: border-box;
        `;

        // ── Утилита создания маленьких кнопок ──
        const mkBtn = (id, text, title, css) => {
            const b = document.createElement('button');
            b.id = id; b.title = title;
            if (Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, text)) mossadLabelEl(b, text); else b.textContent = text; // v1.3.46: ключ подписи
            b.style.cssText = `cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 6px;font-weight:700;font-size:11px;transition:all 0.2s;${css}`;
            return b;
        };

        // ── 1. Кнопка «Собрать» / Количество ──
        const btnCollect = document.createElement('button');
        btnCollect.id = 'mossad-gallery-collect';
        let savedCount = 0;
        try {
            const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (cRaw) savedCount = (JSON.parse(cRaw).items || []).length;
        } catch(e) {}
        if (savedCount > 0) btnCollect.textContent = String(savedCount); else mossadLabelEl(btnCollect, 'collect');
        btnCollect.title = savedCount > 0 ? `Коллекция (${savedCount}): открыть список` : 'Собрать коллекцию ссылок';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:3px 7px;font-weight:700;font-size:11px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;

        // Клик: на /saved — собирать; иначе — открывать плейлист (если есть коллекция)
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else if (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0) {
                grokTogglePlaylistPanel();
            } else {
                if (typeof grokNavigateToSaved === 'function') {
                    grokNavigateToSaved();
                } else {
                    window.location.href = 'https://grok.com/imagine/saved';
                }
            }
        };

        // Правый клик: очистить коллекцию
        btnCollect.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm('Очистить собранную коллекцию?')) {
                _gSS.removeItem(GALLERY_COLLECTION_KEY);
                sessionStorage.removeItem(GALLERY_COLLECT_ACTIVE_KEY);
                mossadLabelEl(btnCollect, 'collect');
                btnCollect.dataset.collectedCount = '0';
                btnCollect.style.background = '#1f2937';
                btnCollect.style.color = '#e5e7eb';
                const pl = document.getElementById('mossad-playlist-panel');
                if (pl) pl.remove();
                showToast('🗑 Коллекция очищена');
            }
        };


        // ── 3. Кнопка-статус воспроизведения (Слайдшоу / ❚❚ / ▶) ──
        const _ssActive = (() => {
            if (isGrokSavedPage()) return false;
            try {
                const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                return !!item.active && (slideshowActive || sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true');
            } catch { return false; }
        })();
        const _isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');

        const btnStatus = document.createElement('button');
        btnStatus.id = 'mossad-gallery-status';
        btnStatus.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:3px 7px;font-weight:700;font-size:11px;transition:all 0.2s;`;
        if (_ssActive) {
            mossadLabelEl(btnStatus, _isPaused ? 'resume' : 'pause');
            btnStatus.title = _isPaused ? 'Продолжить' : 'Пауза';
            btnStatus.style.background = _isPaused ? '#d97706' : '#059669';
            btnStatus.style.color = '#ffffff';
        } else {
            mossadLabelEl(btnStatus, 'slideshow');
            btnStatus.title = 'Запустить слайдшоу по генерациям';
            btnStatus.style.background = '#1e3a5f';
            btnStatus.style.color = '#93c5fd';
        }
        btnStatus.onclick = () => {
            const active = window._mossadGalleryActive || (() => {
                try { return !!(JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active); } catch { return false; }
            })();
            if (active) {
                toggleGalleryPause();
            } else {
                grokStartGallerySlideshow();
            }
        };

        // ── 4. Кнопка [■] стоп — появляется только когда слайдшоу запущено ──
        const btnStop = mkBtn('mossad-gallery-stop', 'stop', 'Остановить слайдшоу', 'background:#1f2937;color:#f87171;');
        btnStop.style.display = _ssActive ? 'inline-block' : 'none';
        btnStop.onclick = () => {
            grokStopGallerySlideshow();
            stopSlideshow();
        };

        // ── 5. Режимы Gr / Md — 4 состояния: ↓ seq | ↑ rev | ↺ rnd | − off ──
        // По умолчанию: grpMode=seq (прямой порядок групп), itemMode=fwd (прямой порядок файлов)
        const GR_STATES  = ['seq', 'rev', 'rnd', 'off'];
        const GR_ICONS   = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const GR_TIPS    = {
            seq: 'Gr↓ — группы по порядку',
            rev: 'Gr↑ — группы в обратном порядке',
            rnd: 'Gr↺ — случайный порядок групп (без повторов за круг)',
            off: 'Gr− — без учёта групп (режим Md применяется ко всей коллекции)',
        };
        const MD_STATES  = ['fwd', 'rev', 'rnd', 'off'];
        const MD_ICONS   = { fwd: '↓', rev: '↑', rnd: '↺', off: '−' };
        const MD_TIPS    = {
            fwd: 'Md↓ — файлы в прямом порядке',
            rev: 'Md↑ — файлы в обратном порядке',
            rnd: 'Md↺ — случайный порядок файлов (без повторов за круг)',
            off: 'Md− — файлы в случайном порядке (оба − = полный хаос)',
        };

        // Читаем текущие настройки из коллекции
        let grpModeCfg = 'seq', itemModeCfg = 'fwd';
        try {
            const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (colRaw) {
                const colData = JSON.parse(colRaw);
                grpModeCfg  = colData.grpMode  || 'seq';
                itemModeCfg = colData.itemMode || 'fwd';
            }
        } catch(e) {}

        // Функция сохранения режима в коллекцию
        const saveModeToCollection = (key, val) => {
            try {
                const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                const data = raw ? JSON.parse(raw) : {};
                data[key] = val;
                _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(data));
            } catch(e) {}
        };

        // Helper: цвет кнопки по состоянию
        const grBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1a2e3a;color:#7dd3fc;';
        const mdBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1e1a3a;color:#c4b5fd;';
        const BASE_BTN = 'cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 6px;font-weight:700;font-size:11px;transition:all 0.2s;';

        // Кнопка Gr (порядок групп)
        const btnGr = mkBtn('mossad-gallery-grmode',
            'grPrefix',
            GR_TIPS[grpModeCfg] || '',
            grBtnCss(grpModeCfg));
        btnGr.onclick = () => {
            const idx = GR_STATES.indexOf(grpModeCfg);
            grpModeCfg = GR_STATES[(idx + 1) % GR_STATES.length];
            saveModeToCollection('grpMode', grpModeCfg);
            refreshModeButtons();
        };

        // Кнопка Md (порядок внутри группы)
        const btnMd = mkBtn('mossad-gallery-mdmode',
            'mdPrefix',
            MD_TIPS[itemModeCfg] || '',
            mdBtnCss(itemModeCfg));
        btnMd.onclick = () => {
            const idx = MD_STATES.indexOf(itemModeCfg);
            itemModeCfg = MD_STATES[(idx + 1) % MD_STATES.length];
            saveModeToCollection('itemMode', itemModeCfg);
            refreshModeButtons();
        };

        // ── v1.3.41: «Случайно» 🔀 — весь список вперемешку, без учёта групп ──
        // Это ровно состояние «Gr− Md−» (4-е, приглушённое, у обеих кнопок): queue.js уже умеет
        // случайный порядок по всей коллекции без повторов за круг, «назад» — по истории (v1.3.38).
        // Своего флага нет: кнопка горит, когда Gr и Md обе «−». Любой активный Gr/Md гасит её сама.
        // Прежние Gr/Md запоминаются в коллекции (preRandom) и возвращаются повторным нажатием.
        const isRandomOn = () => grpModeCfg === 'off' && itemModeCfg === 'off';
        const RND_TIPS = {
            on:  '🔀 Случайно: ВКЛ — весь список вперемешку, группы не учитываются. Нажмите, чтобы вернуть прежние Gr/Md',
            off: '🔀 Случайно: весь список вперемешку без учёта групп (Gr и Md → «−»)',
        };
        const rndBtnCss = (on) => (on
            ? 'background:#3a2a05;color:#fbbf24;border-color:rgba(251,191,36,0.6);'
            : 'background:#1a1a2e;color:#6b7280;') + 'margin-right:6px;';
        const btnRnd = mkBtn('mossad-gallery-rndmode', 'random', RND_TIPS.off, rndBtnCss(false));
        function refreshModeButtons() {
            mossadLabelEl(btnGr, 'grPrefix', '', GR_ICONS[grpModeCfg]);
            btnGr.title       = GR_TIPS[grpModeCfg];
            btnGr.style.cssText = BASE_BTN + grBtnCss(grpModeCfg);
            mossadLabelEl(btnMd, 'mdPrefix', '', MD_ICONS[itemModeCfg]);
            btnMd.title       = MD_TIPS[itemModeCfg];
            btnMd.style.cssText = BASE_BTN + mdBtnCss(itemModeCfg);
            const on = isRandomOn();
            btnRnd.title = on ? RND_TIPS.on : RND_TIPS.off;
            btnRnd.style.cssText = BASE_BTN + rndBtnCss(on);
            btnRnd.dataset.active = on ? '1' : '0';
        }
        btnRnd.onclick = () => {
            let data = {};
            try { data = JSON.parse(_gSS.getItem(GALLERY_COLLECTION_KEY) || '{}') || {}; } catch (e) {}
            if (isRandomOn()) {
                const prev = data.preRandom || {};
                grpModeCfg  = (prev.grpMode  && prev.grpMode  !== 'off') ? prev.grpMode  : 'seq';
                itemModeCfg = (prev.itemMode && prev.itemMode !== 'off') ? prev.itemMode : 'fwd';
                delete data.preRandom;
                showToast(`🔀 Случайно: выкл (Gr${GR_ICONS[grpModeCfg]} Md${MD_ICONS[itemModeCfg]})`);
            } else {
                data.preRandom = { grpMode: grpModeCfg, itemMode: itemModeCfg };
                grpModeCfg = 'off';
                itemModeCfg = 'off';
                showToast('🔀 Случайно: весь список вперемешку (без групп)');
            }
            data.grpMode = grpModeCfg;
            data.itemMode = itemModeCfg;
            try { _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(data)); } catch (e) {}
            mossadDebug('mode', 'случайный режим', { on: isRandomOn(), grpMode: grpModeCfg, itemMode: itemModeCfg });
            refreshModeButtons();
        };
        refreshModeButtons();

        row.append(btnCollect, btnStatus, btnStop, btnGr, btnMd, btnRnd);

        // ── Кнопка окна настроек (⌨) слева от крестика (✕), отделена от 🔀 небольшим зазором ──
        // v1.3.41: возвращена в верхний ряд (в v1.3.40 была во втором ряду)
        const btnHk = mkBtn('mossad-gallery-hk', 'settingsHk', 'Настройки: горячие клавиши (Ctrl+F1)', 'background:#1f2937;color:#9ca3af;font-size:12px;padding:2px 6px;margin-left:auto;');
        btnHk.onclick = (e) => { e.stopPropagation(); toggleSettingsWindow('hotkeys'); };
        row.append(btnHk);

        // Переносим крестик закрытия на самый верхний ряд (на Grok это mossad-gallery-row)
        const closeBtn = document.getElementById('mossad-btn-close');
        if (closeBtn) {
            closeBtn.style.marginLeft = '4px';
            row.append(closeBtn);
        }

        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
        }

        // Если список был открыт ранее — восстанавливаем его монолитно в контейнере виджета
        if (_gSS.getItem('mossad_playlist_open') === 'true' && (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0)) {
            setTimeout(() => {
                grokTogglePlaylistPanel(true);
            }, 60);
        }
    }

// ============================================================
    // GROK ENGINE: UI Playlist Panel (Monolithic List & Active Highlight)
    // ============================================================

    /** Подсвечивает кнопку [📋 Список] в баре при открытом списке */
    function grokUpdatePlaylistBtnState(isOpen) {
        const btn = document.getElementById('mossad-gallery-collect');
        if (!btn) return;
        if (isOpen) {
            btn.style.boxShadow = '0 0 0 1px #3b82f6, 0 0 8px rgba(59,130,246,0.5)';
        } else {
            btn.style.boxShadow = 'none';
        }
    }

    /** Подсвечивает активный файл в открытом списке (плейлисте) и скроллит к нему */
    function grokHighlightActivePlaylistItem(overrideUrl = null) {
        const panel = document.getElementById('mossad-playlist-panel');
        if (!panel) return;

        // Если URL не передан явно — определяем текущий элемент через grokFindCurrentPosition (учитывая киноплёнку)
        if (!overrideUrl) {
            const struct = grokGetPlaylistStructure();
            const curPos = grokFindCurrentPosition(struct);
            if (curPos && curPos.currentItem && curPos.currentItem.url) {
                overrideUrl = curPos.currentItem.url;
            }
        }

        // Извлекаем активный UUID
        let activeUuid = '';
        if (overrideUrl) {
            activeUuid = grokExtractUuid(overrideUrl);
        } else {
            activeUuid = grokExtractUuid(location.pathname);
            if (!activeUuid && location.search) {
                activeUuid = grokExtractUuid(location.search);
            }
        }

        const currentCleanUrl = normUrlKey(overrideUrl || location.href);
        let currentPath = '';
        try {
            currentPath = (overrideUrl ? new URL(overrideUrl, location.origin).pathname : location.pathname).toLowerCase();
        } catch(e) {
            currentPath = location.pathname.toLowerCase();
        }

        // v1.3.38: раньше на каждом шаге перебирались и перекрашивались ВСЕ элементы списка (O(N) записей
        // стилей и textContent). Теперь: ищем совпадение (дёшево, только чтение data-атрибутов), а
        // перерисовываем лишь прежний активный и новый активный элементы.
        const isActiveEl = (el) => {
            const itemUrl = (el.dataset.url || '').toLowerCase();
            const itemUuid = (el.dataset.uuid || '').toLowerCase();
            if (activeUuid && itemUuid) return activeUuid.toLowerCase() === itemUuid;
            const cleanItemUrl = stripUrlQuery(itemUrl);
            return !!cleanItemUrl && (cleanItemUrl === currentCleanUrl || (currentPath && cleanItemUrl.endsWith(currentPath)));
        };
        const paintEl = (el, isActive) => {
            const label = el.querySelector('.mossad-playlist-label');
            const origText = el.dataset.origText || (label ? label.textContent.replace(/^▶\s*/, '') : '');
            if (!el.dataset.origText && origText) el.dataset.origText = origText;
            if (isActive) {
                el.style.background = 'rgba(59, 130, 246, 0.28)';
                el.style.border = '1px solid rgba(96, 165, 250, 0.6)';
                el.style.borderRadius = '4px';
                el.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.3)';
                if (label) {
                    label.style.color = '#ffffff';
                    label.style.fontWeight = '700';
                    label.textContent = '▶ ' + origText;
                }
                const grpEl = el.closest('.mossad-playlist-group');
                if (grpEl) {
                    grpEl.style.borderColor = 'rgba(96, 165, 250, 0.4)';
                    const gh = grpEl.querySelector('.mossad-playlist-grp-header');
                    if (gh) gh.style.background = 'rgba(59, 130, 246, 0.12)';
                }
            } else {
                el.style.background = 'transparent';
                el.style.border = '1px solid transparent';
                el.style.boxShadow = 'none';
                if (label) {
                    label.style.color = '#9ca3af';
                    label.style.fontWeight = 'normal';
                    label.textContent = origText;
                }
            }
            el.dataset.active = isActive ? 'true' : 'false';
        };

        let matchedEl = null;
        const items = panel.querySelectorAll('.mossad-playlist-item');
        for (const el of items) {
            if (isActiveEl(el)) { matchedEl = el; break; }
        }
        panel.querySelectorAll('.mossad-playlist-item[data-active="true"]').forEach(el => {
            if (el !== matchedEl) paintEl(el, false);
        });
        if (matchedEl && matchedEl.dataset.active !== 'true') paintEl(matchedEl, true);

        // Сбросить оформление групп, в которых нет активного элемента
        panel.querySelectorAll('.mossad-playlist-group').forEach(grp => {
            const hasActive = !!grp.querySelector('.mossad-playlist-item[data-active="true"]');
            if (!hasActive) {
                grp.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                const gh = grp.querySelector('.mossad-playlist-grp-header');
                if (gh) gh.style.background = 'rgba(255, 255, 255, 0.04)';
            }
        });

        if (matchedEl) {
            try {
                matchedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } catch(e) {}
        }
    }

    // ── v1.3.40: высота «N строк» и ресайз за любой край/угол ──
    const PLAYLIST_EDGE_PX = 6;

    function grokPlaylistRows() {
        const n = parseInt(config.playlistRows, 10);
        return Math.max(5, Math.min(200, isNaN(n) ? 30 : n));
    }

    /** Высота одной строки списка по первой отрисованной строке; 0 — если ещё не измерить (скрыто / не в layout). */
    function grokPlaylistMeasuredRowHeight(panel) {
        for (const sel of ['.mossad-playlist-item', '.mossad-playlist-grp-header']) {
            const row = panel.querySelector(sel);
            const h = row ? row.getBoundingClientRect().height : 0;
            if (h > 4) return h + 1; // + margin-bottom 1px
        }
        return 0;
    }

    function grokPlaylistRowHeight(panel) {
        const m = grokPlaylistMeasuredRowHeight(panel);
        if (m) return m;
        const font = parseFloat(getComputedStyle(panel).getPropertyValue('--mossad-pl-font-size')) || 11;
        return Math.round(font * 1.15 + 5);
    }

    /** Число «строк» списка: файлы + заголовки групп (то, что видно в прокрутке). */
    function grokPlaylistRowCount(panel) {
        return panel.querySelectorAll('.mossad-playlist-item, .mossad-playlist-grp-header').length;
    }

    /**
     * Если пользователь не задавал высоту вручную — подогнать под N видимых строк.
     * v1.3.41: решение «auto или N строк» — по ЧИСЛУ строк, а не по измеренной высоте.
     * В v1.3.40 сравнивался body.scrollHeight: при открытии списка на старте страницы
     * (виджет ещё скрыт / не в layout) он равен 0 → ставилось height:auto → список во всю длину.
     * Пока строку не измерить, высота считается по шрифту и пересчитывается, когда layout появится.
     */
    function grokApplyPlaylistAutoHeight(panel) {
        if (!panel || panel.dataset.autoHeight !== '1') return;
        const rows = grokPlaylistRows();
        if (grokPlaylistRowCount(panel) <= rows) {
            panel.style.height = 'auto';
            panel.dataset.rowsTarget = 'auto';
            return;
        }
        const header = panel.firstElementChild;
        const headerH = (header && header.getBoundingClientRect().height) || 33;
        const rowH = grokPlaylistRowHeight(panel);
        const body = panel.querySelector('.mossad-playlist-body');
        const bodyChrome = body ? 4 : 0; // padding 2px сверху/снизу
        const target = Math.round(headerH + bodyChrome + rows * rowH + 2); // + рамка
        panel.style.height = `${target}px`;
        panel.dataset.rowsTarget = String(target);
        if (!grokPlaylistMeasuredRowHeight(panel)) grokSchedulePlaylistReMeasure(panel);
    }

    /** Повторный расчёт, когда список станет видимым (до ~5 с, затем — при наведении). */
    function grokSchedulePlaylistReMeasure(panel) {
        if (panel._mossadReMeasure) return;
        let tries = 0;
        const tick = () => {
            if (!panel.isConnected || panel.dataset.autoHeight !== '1') { panel._mossadReMeasure = null; return; }
            if (grokPlaylistMeasuredRowHeight(panel)) { panel._mossadReMeasure = null; grokApplyPlaylistAutoHeight(panel); return; }
            if (++tries > 25) { panel._mossadReMeasure = null; return; }
            panel._mossadReMeasure = setTimeout(tick, 200);
        };
        panel._mossadReMeasure = setTimeout(tick, 50);
    }

    function grokPlaylistEdgeAt(panel, x, y) {
        const r = panel.getBoundingClientRect();
        if (x < r.left - 1 || x > r.right + 1 || y < r.top - 1 || y > r.bottom + 1) return '';
        let edge = '';
        if (y - r.top <= PLAYLIST_EDGE_PX) edge += 'n';
        else if (r.bottom - y <= PLAYLIST_EDGE_PX) edge += 's';
        if (x - r.left <= PLAYLIST_EDGE_PX) edge += 'w';
        else if (r.right - x <= PLAYLIST_EDGE_PX) edge += 'e';
        return edge;
    }

    const PLAYLIST_EDGE_CURSOR = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' };

    function grokEnsurePlaylistResizeStyle() {
        if (document.getElementById('mossad-playlist-resize-style')) return;
        const st = document.createElement('style');
        st.id = 'mossad-playlist-resize-style';
        // Пока курсор в зоне края — все потомки (шапка с grab, кнопки) показывают курсор ресайза
        st.textContent = Object.keys(PLAYLIST_EDGE_CURSOR).map(k =>
            `#mossad-playlist-panel[data-edge="${k}"], #mossad-playlist-panel[data-edge="${k}"] * { cursor: ${PLAYLIST_EDGE_CURSOR[k]} !important; }`
        ).join('\n');
        (document.head || document.documentElement).appendChild(st);
    }

    function grokAttachPlaylistEdgeResize(panel, container) {
        grokEnsurePlaylistResizeStyle();
        const inWidget = !!(container && panel.parentNode === container);
        let drag = null;

        panel.addEventListener('mousemove', (e) => {
            if (drag) return;
            const edge = grokPlaylistEdgeAt(panel, e.clientX, e.clientY);
            if (edge) panel.dataset.edge = edge; else delete panel.dataset.edge;
        });
        panel.addEventListener('mouseleave', () => { if (!drag) delete panel.dataset.edge; });
        // v1.3.41: если на старте строку было не измерить — досчитать при первом наведении
        panel.addEventListener('mouseenter', () => { if (!drag) grokApplyPlaylistAutoHeight(panel); });

        // capture: перехватываем раньше перетаскивания виджета за шапку
        panel.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const edge = grokPlaylistEdgeAt(panel, e.clientX, e.clientY);
            if (!edge) return;
            e.preventDefault();
            e.stopPropagation();
            const r = panel.getBoundingClientRect();
            const moveEl = inWidget ? container : panel; // что сдвигать при тяге за левый/верхний край
            const mr = moveEl.getBoundingClientRect();
            drag = { edge, x: e.clientX, y: e.clientY, w: r.width, h: r.height, left: mr.left, top: mr.top, moved: false };
            panel.dataset.edge = edge;
            const maxW = window.innerWidth * 0.95, maxH = window.innerHeight * 0.85;

            const onMove = (ev) => {
                const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
                if (drag.edge.includes('e')) panel.style.width = Math.round(Math.max(140, Math.min(maxW, drag.w + dx))) + 'px';
                if (drag.edge.includes('s')) panel.style.height = Math.round(Math.max(90, Math.min(maxH, drag.h + dy))) + 'px';
                if (drag.edge.includes('w')) {
                    const nw = Math.max(140, Math.min(maxW, drag.w - dx));
                    panel.style.width = Math.round(nw) + 'px';
                    if (inWidget || moveEl.style.left) {
                        moveEl.style.left = Math.round(Math.max(0, drag.left + (drag.w - nw))) + 'px';
                        moveEl.style.right = 'auto';
                    }
                }
                if (drag.edge.includes('n')) {
                    const nh = Math.max(90, Math.min(maxH, drag.h - dy));
                    panel.style.height = Math.round(nh) + 'px';
                    moveEl.style.top = Math.round(Math.max(0, drag.top + (drag.h - nh))) + 'px';
                }
                drag.moved = true;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup', onUp, true);
                const d = drag; drag = null;
                delete panel.dataset.edge;
                if (!d || !d.moved) return;
                const fr = panel.getBoundingClientRect();
                if (/[ew]/.test(d.edge)) {
                    const w = Math.round(fr.width);
                    localStorage.setItem('mossad_playlist_width', String(w));
                    if (typeof Settings !== 'undefined') Settings.setQuiet('playlistWidth', w);
                }
                if (/[ns]/.test(d.edge)) {
                    panel.dataset.autoHeight = '0';
                    localStorage.setItem('mossad_playlist_height', String(Math.round(fr.height)));
                }
                if (inWidget && /[nw]/.test(d.edge)) {
                    try { localStorage.setItem('mossad_widget_pos', JSON.stringify({ left: container.style.left, top: container.style.top })); } catch (err) {}
                }
                mossadDebug('playlist', 'ресайз', { edge: d.edge, w: Math.round(fr.width), h: Math.round(fr.height) });
            };
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup', onUp, true);
        }, true);
    }

    /** Список (плейлист): открыть/закрыть. Монолитно крепится к меню виджета MOSSAD */
    function grokTogglePlaylistPanel(forceOpen = false) {
        const existing = document.getElementById('mossad-playlist-panel');
        if (existing) {
            if (forceOpen) {
                grokHighlightActivePlaylistItem();
                return;
            }
            existing.remove();
            _gSS.removeItem('mossad_playlist_open');
            grokUpdatePlaylistBtnState(false);
            return;
        }

        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            if (!forceOpen) showToast('⚠️ Коллекция не собрана', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (!items.length) {
            if (!forceOpen) showToast('⚠️ Коллекция пуста', true);
            return;
        }

        // Запоминаем состояние открытия плейлиста для сохранения между переходами
        _gSS.setItem('mossad_playlist_open', 'true');

        // Читаем текущий loop-set
        let loopSet = getGrokLoopSet(); // loop.js: всегда { urls: [], groupIds: [] }
        const saveLoopSet = () => saveGrokLoopSet(loopSet);

        const savedCustomWidth = (typeof config !== 'undefined' && config.playlistWidth)
            ? config.playlistWidth
            : parseInt(localStorage.getItem('mossad_playlist_width') || '0', 10);
        const savedCustomHeight = parseInt(localStorage.getItem('mossad_playlist_height') || '0', 10);
        let currentFontSize = parseInt(localStorage.getItem('mossad_playlist_font_size') || '11', 10);
        if (isNaN(currentFontSize) || currentFontSize < 8) currentFontSize = 8;
        if (currentFontSize > 20) currentFontSize = 20;

        const initialWidth = savedCustomWidth > 0 ? `${savedCustomWidth}px` : '100%';
        const initialHeight = savedCustomHeight > 0 ? `${savedCustomHeight}px` : 'auto';

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';

        const container = document.getElementById('mossad-widget-container');
        if (container) {
            // Монолитно внутри контейнера виджета
            panel.style.cssText = `
                box-sizing: border-box; width: ${initialWidth}; ${savedCustomHeight > 0 ? `height: ${initialHeight};` : ''}
                min-width: 140px; max-width: 95vw; min-height: 90px; max-height: 85vh;
                display: flex; flex-direction: column; overflow: hidden; position: relative;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: var(--mossad-pl-font-size, 11px); color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                pointer-events: auto;
                --mossad-pl-font-size: ${currentFontSize}px;
            `;
        } else {
            // Fallback (если виджет ещё не создан)
            panel.style.cssText = `
                position: fixed; top: 70px; right: 16px; z-index: 9999999;
                width: ${savedCustomWidth > 0 ? `${savedCustomWidth}px` : '240px'}; ${savedCustomHeight > 0 ? `height: ${initialHeight};` : ''}
                min-width: 140px; max-width: 95vw; min-height: 90px; max-height: 85vh;
                display: flex; flex-direction: column; overflow: hidden;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: var(--mossad-pl-font-size, 11px); color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                --mossad-pl-font-size: ${currentFontSize}px;
            `;
        }

        panel.tabIndex = -1;
        panel.style.outline = 'none';
        panel.addEventListener('mouseenter', () => {
            try { panel.focus(); } catch(e) {}
        });
        panel.addEventListener('click', (e) => {
            if (e.target === panel || e.target === body) {
                try { panel.focus(); } catch(e) {}
            }
        });

        // v1.3.40: размер меняется мышью за ЛЮБОЙ край/угол (зона ~6px, см. grokAttachPlaylistEdgeResize),
        // сохраняется только по окончании ручного ресайза. Прежний ResizeObserver записывал и
        // автоматические размеры (100% / auto) как «пользовательские» — из-за этого сброс не работал.
        panel.dataset.autoHeight = savedCustomHeight > 0 ? '0' : '1';
        const defaultWidthCss = container ? '100%' : '240px';

        // ── Заголовок (липкий вверху с поддержкой перетаскивания всего меню) ──
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 6px; flex: 0 0 auto; background: rgba(14, 14, 18, 0.98);
            backdrop-filter: blur(16px); z-index: 2; border-top-left-radius: 12px; border-top-right-radius: 12px;
            cursor: grab; min-width: 0; max-width: 100%; box-sizing: border-box;
        `;
        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(header);
        }

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight: 700; font-size: calc(var(--mossad-pl-font-size, 11px) + 2px); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;`;
        mossadLabelEl(titleEl, 'playlistTitle', '', ` (${items.length})`);
        titleEl.title = 'Двойной клик — сбросить размер списка (как кнопка ⤢)';
        // v1.3.40: двойной клик и кнопка ⤢ сбрасывают к одному размеру: N строк (F1) × ширина по умолчанию
        const resetPlaylistSize = () => {
            panel.style.width = defaultWidthCss;
            localStorage.removeItem('mossad_playlist_width');
            localStorage.removeItem('mossad_playlist_height');
            if (typeof Settings !== 'undefined') {
                Settings.setQuiet('playlistWidth', 0);
            }
            panel.dataset.autoHeight = '1';
            grokApplyPlaylistAutoHeight(panel);
            showToast(`↔ Размер списка сброшен: ${grokPlaylistRows()} строк`);
        };
        titleEl.ondblclick = (e) => { e.stopPropagation(); resetPlaylistSize(); };

        // Кнопки масштабирования шрифта списка (A− / A+)
        const fontControls = document.createElement('div');
        fontControls.style.cssText = `display: flex; align-items: center; gap: 3px; flex-shrink: 0;`;

        const btnFontDec = document.createElement('button');
        mossadLabelEl(btnFontDec, 'fontDec');
        btnFontDec.title = 'Уменьшить шрифт списка';
        btnFontDec.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#9ca3af;padding:1px 5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;transition:all 0.15s;`;
        btnFontDec.onmouseenter = () => { btnFontDec.style.color = '#ffffff'; btnFontDec.style.background = 'rgba(255,255,255,0.14)'; };
        btnFontDec.onmouseleave = () => { btnFontDec.style.color = '#9ca3af'; btnFontDec.style.background = 'rgba(255,255,255,0.06)'; };
        btnFontDec.onclick = (e) => {
            e.stopPropagation();
            if (currentFontSize > 8) {
                currentFontSize--;
                panel.style.setProperty('--mossad-pl-font-size', `${currentFontSize}px`);
                localStorage.setItem('mossad_playlist_font_size', String(currentFontSize));
                grokApplyPlaylistAutoHeight(panel);
            }
        };

        const btnFontInc = document.createElement('button');
        mossadLabelEl(btnFontInc, 'fontInc');
        btnFontInc.title = 'Увеличить шрифт списка';
        btnFontInc.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#9ca3af;padding:1px 5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;transition:all 0.15s;`;
        btnFontInc.onmouseenter = () => { btnFontInc.style.color = '#ffffff'; btnFontInc.style.background = 'rgba(255,255,255,0.14)'; };
        btnFontInc.onmouseleave = () => { btnFontInc.style.color = '#9ca3af'; btnFontInc.style.background = 'rgba(255,255,255,0.06)'; };
        btnFontInc.onclick = (e) => {
            e.stopPropagation();
            if (currentFontSize < 20) {
                currentFontSize++;
                panel.style.setProperty('--mossad-pl-font-size', `${currentFontSize}px`);
                localStorage.setItem('mossad_playlist_font_size', String(currentFontSize));
                grokApplyPlaylistAutoHeight(panel);
            }
        };
        fontControls.append(btnFontDec, btnFontInc);

        // Кнопка «отключить все R» — появляется если зациклено 2+ элементов
        const btnClearLoop = document.createElement('button');
        mossadLabelEl(btnClearLoop, 'clearLoops');
        btnClearLoop.title = 'Отключить все зацикленные';
        btnClearLoop.style.cssText = `background:#7f1d1d;border:none;border-radius:4px;color:#fca5a5;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;display:${(loopSet.urls.length + loopSet.groupIds.length) > 1 ? 'inline-block' : 'none'};`;
        btnClearLoop.onclick = () => {
            loopSet = { urls: [], groupIds: [] };
            saveLoopSet();
            panel.remove();
            grokTogglePlaylistPanel(true);
        };

        const btnClose = document.createElement('button');
        mossadLabelEl(btnClose, 'closeList');
        btnClose.title = 'Закрыть список';
        btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;transition:color 0.15s;`;
        btnClose.onmouseenter = () => btnClose.style.color = '#f87171';
        btnClose.onmouseleave = () => btnClose.style.color = '#9ca3af';
        btnClose.onclick = () => {
            panel.remove();
            _gSS.removeItem('mossad_playlist_open');
            grokUpdatePlaylistBtnState(false);
        };

        // v1.3.40: сброс размера (справа от A+, слева от ×)
        const btnResetSize = document.createElement('button');
        btnResetSize.id = 'mossad-playlist-reset-size';
        mossadLabelEl(btnResetSize, 'resetSize');
        btnResetSize.title = 'Сбросить размер списка (строк по умолчанию — в настройках, вкладка «Общие»)';
        btnResetSize.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#9ca3af;padding:1px 5px;font-size:11px;font-weight:700;cursor:pointer;line-height:1.2;flex-shrink:0;`;
        btnResetSize.onmouseenter = () => { btnResetSize.style.color = '#ffffff'; };
        btnResetSize.onmouseleave = () => { btnResetSize.style.color = '#9ca3af'; };
        btnResetSize.onclick = (e) => { e.stopPropagation(); resetPlaylistSize(); };

        header.append(titleEl, fontControls, btnClearLoop, btnResetSize, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.className = 'mossad-playlist-body';
        // v1.3.40: прокручивается тело, а не вся панель (полоса прокрутки не перекрывает зону ресайза края)
        body.style.cssText = `padding: 2px; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; flex: 1 1 auto; min-height: 0; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;`;

        // ── Утилита: кнопка R ──
        const makeRBtn = (isActive, onToggle) => {
            const btn = document.createElement('button');
            mossadLabelEl(btn, 'loopItem');
            btn.style.cssText = `
                background:none;border:none;cursor:pointer;font-weight:700;font-size:var(--mossad-pl-font-size, 10px);
                padding:0 2px;line-height:1;flex-shrink:0;transition:color 0.15s;
                color:${isActive ? '#f87171' : '#374151'};
            `;
            btn.title = isActive ? 'Зациклено — клик для отмены' : 'Зациклить';
            btn.onclick = (e) => {
                e.stopPropagation();
                onToggle(btn);
            };
            return btn;
        };

        // ── Группируем по convId ──
        const groups = {};
        const groupOrder = [];
        for (const item of items) {
            const gid = item.convId || '__noconv__';
            if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
            groups[gid].push(item);
        }

        const hasGroups = groupOrder.length > 1 || (groupOrder.length === 1 && groupOrder[0] !== '__noconv__');

        if (hasGroups) {
            groupOrder.forEach((gid, gIdx) => {
                const gItems = groups[gid];
                const grpEl = document.createElement('div');
                grpEl.className = 'mossad-playlist-group';
                grpEl.style.cssText = `margin-bottom:2px;border:1px solid rgba(255,255,255,0.07);border-radius:5px;overflow:hidden;transition:border-color 0.2s;min-width:0;max-width:100%;box-sizing:border-box;`;

                const grpHeader = document.createElement('div');
                grpHeader.className = 'mossad-playlist-grp-header';
                const shortId = gid === '__noconv__' ? 'Без группы' : `Гр. ${gIdx + 1}: ${gid.slice(0, 8)}…`;
                grpHeader.style.cssText = `display:flex;align-items:center;gap:3px;padding:2px 5px;background:rgba(255,255,255,0.04);line-height:1.15;transition:background 0.2s;min-width:0;max-width:100%;box-sizing:border-box;`;
                grpHeader.title = `Группа ${gIdx + 1}: ${gid}`;

                const isGrpLooped = loopSet.groupIds.includes(gid);
                const rGrp = makeRBtn(isGrpLooped, (btn) => {
                    const i = loopSet.groupIds.indexOf(gid);
                    if (i >= 0) { loopSet.groupIds.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                    else { loopSet.groupIds.push(gid); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                    saveLoopSet();
                    const total = loopSet.urls.length + loopSet.groupIds.length;
                    btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                });

                const grpLabel = document.createElement('span');
                grpLabel.style.cssText = `flex:1;min-width:0;font-weight:600;font-size:var(--mossad-pl-font-size, 11px);color:#7dd3fc;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15;`;
                grpLabel.textContent = shortId;
                grpLabel.onclick = (e) => {
                    e.stopPropagation();
                    const rawCol = _gSS.getItem(GALLERY_COLLECTION_KEY);
                    let itemMode = 'fwd';
                    if (rawCol) {
                        try { itemMode = JSON.parse(rawCol).itemMode || 'fwd'; } catch(err) {}
                    }
                    let startItem = gItems[0];
                    if (itemMode === 'rev') {
                        startItem = gItems[gItems.length - 1];
                    } else if (itemMode === 'rnd') {
                        startItem = gItems[Math.floor(Math.random() * gItems.length)];
                    }
                    grokStartGallerySlideshowFrom(startItem);
                    grokHighlightActivePlaylistItem(startItem.url);
                };

                const grpCount = document.createElement('span');
                grpCount.style.cssText = `color:#6b7280;font-size:calc(var(--mossad-pl-font-size, 11px) - 1px);flex-shrink:0;white-space:nowrap;line-height:1.15;`;
                mossadLabelEl(grpCount, 'groupCount', `${gItems.length} `);

                grpHeader.onclick = (e) => {
                    if (e.target === grpHeader || e.target === grpCount) {
                        e.stopPropagation();
                        try { panel.focus(); } catch(err) {}
                    }
                };
                grpHeader.append(rGrp, grpLabel, grpCount);
                grpEl.appendChild(grpHeader);

                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:1px 2px;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.className = 'mossad-playlist-item';
                    li.dataset.url = item.url || '';
                    const itemUuid = grokExtractUuid(item.url);
                    li.dataset.uuid = itemUuid;
                    li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 10px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

                    const baseUrl = stripUrlQuery(item.url);
                    const isLooped = loopSet.urls.some(u => stripUrlQuery(u) === baseUrl);
                    const rItem = makeRBtn(isLooped, (btn) => {
                        const i = loopSet.urls.findIndex(u => stripUrlQuery(u) === baseUrl);
                        if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                        else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                        saveLoopSet();
                        const total = loopSet.urls.length + loopSet.groupIds.length;
                        btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                    });

                    const label = document.createElement('span');
                    label.className = 'mossad-playlist-label';
                    label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
                    const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : (item.type ? '🖼' : '❔')} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 22)}`;
                    label.textContent = baseText;
                    li.dataset.origText = baseText;
                    label.title = item.url;

                    li.onmouseover = () => {
                        if (li.dataset.active !== 'true') li.style.background = 'rgba(255,255,255,0.05)';
                    };
                    li.onmouseout = () => {
                        if (li.dataset.active !== 'true') li.style.background = 'transparent';
                    };

                    const onPlayItem = (e) => {
                        e.stopPropagation();
                        grokStartGallerySlideshowFrom(item);
                        grokHighlightActivePlaylistItem(item.url);
                    };
                    label.onclick = onPlayItem;
                    li.onclick = (e) => {
                        if (e.target === li) {
                            e.stopPropagation();
                            try { panel.focus(); } catch(err) {}
                        }
                    };

                    li.append(rItem, label);
                    listEl.appendChild(li);
                });
                grpEl.appendChild(listEl);
                body.appendChild(grpEl);
            });
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.className = 'mossad-playlist-item';
                li.dataset.url = item.url || '';
                const itemUuid = grokExtractUuid(item.url);
                li.dataset.uuid = itemUuid;
                li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 11px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

                const baseUrl = stripUrlQuery(item.url);
                const isLooped = loopSet.urls.some(u => stripUrlQuery(u) === baseUrl);
                const rItem = makeRBtn(isLooped, (btn) => {
                    const i = loopSet.urls.findIndex(u => stripUrlQuery(u) === baseUrl);
                    if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                    else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                    saveLoopSet();
                    const total = loopSet.urls.length + loopSet.groupIds.length;
                    btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                });

                const label = document.createElement('span');
                label.className = 'mossad-playlist-label';
                label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
                const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : (item.type ? '🖼' : '❔')} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 26)}`;
                label.textContent = baseText;
                li.dataset.origText = baseText;
                label.title = item.url;

                li.onmouseover = () => {
                    if (li.dataset.active !== 'true') li.style.background = 'rgba(255,255,255,0.06)';
                };
                li.onmouseout = () => {
                    if (li.dataset.active !== 'true') li.style.background = 'transparent';
                };

                const onPlayItem = (e) => {
                    e.stopPropagation();
                    grokStartGallerySlideshowFrom(item);
                    grokHighlightActivePlaylistItem(item.url);
                };
                label.onclick = onPlayItem;
                li.onclick = (e) => {
                    if (e.target === li) {
                        e.stopPropagation();
                        try { panel.focus(); } catch(err) {}
                    }
                };

                li.append(rItem, label);
                body.appendChild(li);
            });
        }

        panel.appendChild(body);

        // Монолитное крепление к контейнеру виджета
        if (container) {
            const settingsPanel = document.getElementById('mossad-panel');
            if (settingsPanel && settingsPanel.parentNode === container) {
                container.insertBefore(panel, settingsPanel);
            } else {
                container.appendChild(panel);
            }
        } else {
            document.body.appendChild(panel);
        }

        grokUpdatePlaylistBtnState(true);

        // v1.3.40: высота по умолчанию = N строк; ресайз за любой край
        grokApplyPlaylistAutoHeight(panel);
        grokAttachPlaylistEdgeResize(panel, container);

        // Подсвечиваем активный элемент сразу при открытии списка
        grokHighlightActivePlaylistItem();
    }

// ============================================
    // INSTAGRAM ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.instagram = (() => {
        const _igVideoUrls = [];   // перехваченные URL видео CDN инсты

        /** Проверяет, является ли URL видео-файлом (не картинкой) */
        function _igIsVideoUrl(url) {
            if (!url || typeof url !== 'string') return false;
            // Явные расширения картинок — исключаем
            if (/\.(jpg|jpeg|webp|png|gif|avif|heic)(\?|$)/i.test(url)) return false;
            // Явный признак видео
            if (/\.mp4(\?|$)/i.test(url)) return true;
            // CDN-путь содержит /v/ или слово video
            if (/\/v\/|\/video|video\//i.test(url)) return true;
            // CDN-URL без расширения — предположительно видео-сегмент
            if (_igIsCdnUrl(url) && !/\.(jpg|jpeg|webp|png|gif)/i.test(url)) return true;
            return false;
        }

        /** Добавить URL в список, дедупликация, новые — в начало */
        function _igPush(url) {
            if (!url || url.startsWith('blob:')) return;
            if (!_igIsVideoUrl(url)) return;
            // Убираем bytestart/byteend параметры чтобы URL был полным
            const clean = url.replace(/[?&](bytestart|byteend)=[^&]*/gi, '').replace(/[?&]$/, '');
            if (!_igVideoUrls.includes(clean)) {
                _igVideoUrls.unshift(clean);
                if (_igVideoUrls.length > 30) _igVideoUrls.pop();
                console.log('[MOSSAD/IG] Поймал URL:', clean.slice(0, 80));
            }
        }

        /** Проверяет, похож ли URL на медиа CDN инсты */
        function _igIsCdnUrl(url) {
            if (!url || typeof url !== 'string') return false;
            return /cdninstagram\.com/i.test(url) ||
                   /\.fbcdn\.net/i.test(url) ||
                   /instagram\.f[a-z0-9-]+\d+\.fna/i.test(url);
        }

        /** Парсим JSON-данные страницы — инста вставляет видео URL в script-теги */
        function _igScrapePageJson() {
            const found = [];
            const pageText = document.documentElement.innerHTML;
            const re = /https:\/\/[^"'\s]*(?:fbcdn\.net|cdninstagram\.com)[^"'\s]*/g;
            let m;
            while ((m = re.exec(pageText)) !== null) {
                let u = m[0].replace(/\\u0026/g, '&').replace(/\\/g, '').split('"')[0];
                // Фильтруем: только видео URL, без превью-картинок
                if (u && _igIsVideoUrl(u)) {
                    found.push(u);
                }
            }
            return found;
        }

        /** Очистить кэш URL при SPA-навигации */
        function onNavigate() {
            _igVideoUrls.length = 0;
            console.log('[MOSSAD/IG] Навигация — очищаем кэш URL');
        }

        /** Вернуть текущий медиа-результат для DL */
        function findMedia() {
            // 1. Прямые src у видео (иногда инста не использует blob)
            const vids = Array.from(document.querySelectorAll('video'));
            for (const v of vids) {
                const src = v.currentSrc || v.src || (v.querySelector('source') || {}).src || '';
                if (src && _igIsCdnUrl(src) && !src.startsWith('blob:') && _igIsVideoUrl(src)) {
                    return { urls: [src], type: 'video' };
                }
            }
            // 2. Перехваченные через fetch/XHR/Observer
            if (_igVideoUrls.length > 0) {
                return { urls: [..._igVideoUrls], type: 'video' };
            }
            // 3. Парсинг HTML страницы (инста встраивает URL в script-теги)
            const scraped = _igScrapePageJson();
            if (scraped.length > 0) {
                scraped.forEach(u => _igPush(u));
                return { urls: scraped, type: 'video' };
            }
            showToast('⏳ Инста: запусти видео — скрипт поймает URL', true);
            return null;
        }

        function isSupported() {
            return rootDomain.includes('instagram.com');
        }

        function init() {
            if (!isSupported()) return;

            // --- Перехват fetch — ловим любой CDN запрос ---
            const _origFetch = window.fetch;
            window.fetch = function (...args) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
                if (_igIsCdnUrl(url)) _igPush(url);
                const p = _origFetch.apply(this, args);
                p.then && p.then(r => {
                    try {
                        if (r && r.headers && r.headers.get('content-type') &&
                            r.headers.get('content-type').includes('video')) {
                            _igPush(r.url || url);
                        }
                    } catch {}
                }).catch(() => {});
                return p;
            };

            // --- Перехват XHR ---
            const _origXHROpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function (method, url, ...rest) {
                if (typeof url === 'string' && _igIsCdnUrl(url)) _igPush(url);
                return _origXHROpen.call(this, method, url, ...rest);
            };

            // --- Перехват history.pushState / replaceState — очищаем кэш при навигации ---
            const _origPushState = history.pushState.bind(history);
            const _origReplaceState = history.replaceState.bind(history);
            history.pushState = function (...args) {
                onNavigate();
                return _origPushState(...args);
            };
            history.replaceState = function (...args) {
                onNavigate();
                return _origReplaceState(...args);
            };

            // --- MutationObserver: прямые src у <video> ---
            const _igObserver = new MutationObserver(() => {
                document.querySelectorAll('video, video > source').forEach(el => {
                    const src = el.src || el.getAttribute('src') || el.currentSrc || '';
                    if (_igIsCdnUrl(src)) _igPush(src);
                });
            });
            const _igStartObs = () => {
                if (document.body) _igObserver.observe(document.body, {
                    subtree: true, childList: true, attributes: true, attributeFilter: ['src']
                });
            };
            if (document.body) _igStartObs(); else document.addEventListener('DOMContentLoaded', _igStartObs);
        }

        return { isSupported, findMedia, onNavigate, init };
    })();
    window.MOSSAD_ENGINES.instagram.init();

// ============================================
    // REDGIFS ENGINE
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.redgifs = (() => {
        const REDGIFS_COLLECTION_KEY = 'mossad_redgifs_collection';
        const REDGIFS_SS_KEY = 'mossad_redgifs_ss';

        function isSupported() {
            return rootDomain.includes('redgifs.com');
        }

        /** Находит активный элемент превью/карточки в DOM */
        function getActiveItem() {
            // 1. Приоритет: текущее воспроизводящееся видео и его карточка
            const videos = Array.from(document.querySelectorAll('video'));
            const playingVideo = videos.find(v => !v.paused && v.currentTime > 0);
            if (playingVideo) {
                const card = playingVideo.closest('.GifPreview_isActive, [data-feed-item-id], .GifPreview, .feed-item, a[href*="/watch/"]');
                if (card) return card;
            }

            // 2. Активный элемент ленты или сетки с классом isActive
            const activeEl = document.querySelector('.GifPreview_isActive, .GifPreview.isActive, .preview_isActive, [data-feed-item-id].active');
            if (activeEl) return activeEl;

            // 3. Видео с наибольшей видимой площадью
            const bestVideo = getActiveVideo();
            if (bestVideo) {
                const card = bestVideo.closest('.GifPreview_isActive, [data-feed-item-id], .GifPreview, .feed-item');
                if (card) return card;
            }

            // 4. Попап-плеер / модальное окно просмотра
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .previewModal');
            if (modal) return modal;

            // 5. Первый элемент с ID фида или превью
            return document.querySelector('[data-feed-item-id], .GifPreview');
        }

        /** Находит активное/главное видео RedGifs */
        function getActiveVideo() {
            const videos = Array.from(document.querySelectorAll('video'));
            if (videos.length === 0) return null;

            // 1. Безусловный приоритет: видео, которое прямо сейчас воспроизводится
            const playing = videos.find(v => !v.paused && v.currentTime > 0);
            if (playing) return playing;

            // 2. Видео внутри активной карточки
            const activeCard = document.querySelector('.GifPreview_isActive, .GifPreview.isActive');
            if (activeCard) {
                const v = activeCard.querySelector('video');
                if (v) return v;
            }

            // 3. Видео с наибольшей видимой площадью
            let bestVideo = null;
            let maxArea = 0;
            const vh = window.innerHeight;
            const vw = window.innerWidth;

            for (const v of videos) {
                const rect = v.getBoundingClientRect();
                const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
                const visibleWidth = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
                const area = visibleHeight * visibleWidth;
                if (area > maxArea) {
                    maxArea = area;
                    bestVideo = v;
                }
            }
            if (bestVideo && maxArea > 0) return bestVideo;

            // 4. Видео в модалке
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .PlayerWrapper');
            if (modal) {
                const modalVid = modal.querySelector('video');
                if (modalVid) return modalVid;
            }

            return videos[0];
        }

        /** Извлекает имя автора (userName) на RedGifs */
        function getUserName(targetEl = null) {
            const active = targetEl || getActiveItem();
            let name = '';

            // 1. Поиск в активном элементе или его контейнерах
            const searchRoots = [];
            if (active) {
                searchRoots.push(active);
                const cardContainer = active.closest('[data-feed-item-id], .feed-item, .GifPreview, .PlayerWrapper, [role="dialog"], .previewModal, .preview-modal');
                if (cardContainer && cardContainer !== active) searchRoots.push(cardContainer);
                if (active.parentElement) searchRoots.push(active.parentElement);
                if (active.parentElement?.parentElement) searchRoots.push(active.parentElement.parentElement);
            }

            const modal = document.querySelector('[role="dialog"], .PlayerWrapper, .previewModal, .preview-modal');
            if (modal && !searchRoots.includes(modal)) searchRoots.push(modal);
            searchRoots.push(document);

            for (const root of searchRoots) {
                if (!root) continue;

                // а) span.userName или класс, содержащий userName
                const uSpan = root.querySelector('.userName, [class*="userName"]');
                if (uSpan && uSpan.textContent && uSpan.textContent.trim()) {
                    name = uSpan.textContent.trim();
                    break;
                }

                // б) a.userAvatar или ссылка на профиль /users/...
                const uLink = root.querySelector('a.userAvatar, a[href*="/users/"], a[aria-label*="profile" i]');
                if (uLink) {
                    const href = uLink.getAttribute('href') || '';
                    const mHref = href.match(/\/users\/([^/?#]+)/);
                    if (mHref) {
                        name = decodeURIComponent(mHref[1]).trim();
                        break;
                    }
                    const aria = uLink.getAttribute('aria-label') || '';
                    const mAria = aria.match(/Link to\s+(.+?)\s+profile/i) || aria.match(/profile of\s+(.+)/i);
                    if (mAria) {
                        name = mAria[1].trim();
                        break;
                    }
                }
            }

            // 2. Если все еще пусто — проверяем URL страницы (если мы на /users/NAME)
            if (!name) {
                const urlMatch = location.pathname.match(/\/users\/([^/?#]+)/);
                if (urlMatch) {
                    name = decodeURIComponent(urlMatch[1]).trim();
                }
            }

            // 3. Проверяем meta-теги страницы (на случай прямого перехода /watch/ID)
            if (!name) {
                const metaAuthor = document.querySelector('meta[name="author"], meta[property="article:author"], meta[property="og:author"]');
                if (metaAuthor && metaAuthor.content) {
                    name = metaAuthor.content.trim();
                }
            }

            // 4. Очистка от спецсимволов и пробелов
            if (name) {
                name = name.replace(/^@+/, '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
            }

            return name || '';
        }

        /** Генерирует безопасное имя файла */
        function getTitleFilename(itemId) {
            const uName = getUserName();
            const dPart = 'redg';
            if (uName) {
                return `${uName}-${dPart}.mp4`;
            }
            let rawTitle = (document.title || '').trim();
            if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
                rawTitle = rawTitle.slice(1, -1).trim();
            }
            if (rawTitle) {
                const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
                if (safeTitle.length > 0) return `${safeTitle}.mp4`;
            }
            return `redgifs_${itemId || 'video'}_${Date.now()}.mp4`;
        }

        /** Извлекает ссылки для скачивания текущего видео */
        function findMedia() {
            const v = getActiveVideo();
            let active = null;
            if (v) {
                active = v.closest('.GifPreview_isActive, [data-feed-item-id], .GifPreview');
            }
            if (!active) {
                active = getActiveItem();
            }

            let itemId = (active && active.getAttribute('data-feed-item-id')) || null;
            if (!itemId) {
                const activeCard = document.querySelector('.GifPreview_isActive[data-feed-item-id], .GifPreview.isActive[data-feed-item-id]');
                if (activeCard) itemId = activeCard.getAttribute('data-feed-item-id');
            }
            if (!itemId && v) {
                const nearCard = v.closest('[data-feed-item-id]');
                if (nearCard) itemId = nearCard.getAttribute('data-feed-item-id');
            }
            if (!itemId && active) {
                const watchA = active.querySelector('a[href*="/watch/"]');
                if (watchA) {
                    const m = (watchA.getAttribute('href') || '').match(/\/watch\/([^/?#]+)/);
                    if (m) itemId = m[1];
                }
            }
            if (!itemId) {
                const urlMatch = location.pathname.match(/\/watch\/([^/?#]+)/);
                if (urlMatch) itemId = urlMatch[1];
            }

            // Мягкая синхронизация адресной строки (чтобы URL соответствовал текущему видео)
            if (itemId && location.pathname.includes('/watch/')) {
                const currentUrlId = (location.pathname.match(/\/watch\/([^/?#]+)/) || [])[1];
                if (currentUrlId && currentUrlId.toLowerCase() !== itemId.toLowerCase()) {
                    try {
                        history.replaceState(null, '', `/watch/${itemId}`);
                    } catch (e) {}
                }
            }

            const urls = [];

            // 1. Прямые CDN ссылки RedGifs на основе itemId
            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://media.redgifs.com/${capId}-mobile.mp4`);
                urls.push(`https://media.redgifs.com/${itemId}.mp4`);
                urls.push(`https://media.redgifs.com/${itemId}-mobile.mp4`);
            }

            // 2. Из постера активной карточки или текущего видео
            if (active || v) {
                const posterImg = (active && active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"], img[src*="thumbs"]'))
                               || (itemId ? document.querySelector(`img[src*="${itemId}"]`) : null);
                const posterSrc = posterImg?.src || v?.poster || (v && v.getAttribute('poster')) || '';
                if (posterSrc) {
                    const mp4Hd = posterSrc.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg|webp)/i, '.mp4').replace(/\.(?:jpg|png|jpeg|webp)/i, '.mp4');
                    const mp4Sd = posterSrc.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg|webp)/i, '-mobile.mp4').replace(/\.(?:jpg|png|jpeg|webp)/i, '-mobile.mp4');
                    if (!urls.includes(mp4Hd)) urls.unshift(mp4Hd);
                    if (!urls.includes(mp4Sd)) urls.push(mp4Sd);
                }
            }

            // 3. Прямой src видео (если не blob)
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
            }

            const cleanUrls = Array.from(new Set(urls.filter(Boolean)));
            if (cleanUrls.length > 0) {
                const postUrl = itemId ? `https://www.redgifs.com/watch/${itemId}` : location.href;
                return {
                    urls: cleanUrls,
                    type: 'video',
                    itemId: itemId || 'video',
                    userName: getUserName(active),
                    postUrl: postUrl
                };
            }
            return null;
        }

        /** 
         * Навигация на RedGifs (изолированная от URL-детектора)
         * dir: 'down' (вперед/следующее) или 'up' (назад/предыдущее)
         */
        function navigate(dir = 'down') {
            const isFwd = (dir === 'down' || dir === 'right');
            const targetDir = isFwd ? 'down' : 'up';

            // 1. Поиск нативных кнопок Next / Previous в UI плеера RedGifs
            const nextBtn = document.querySelector('button[aria-label="Next video"], button.nextButton, button.navButton.nextButton, button[aria-label*="Next" i], button[title*="Next" i], .PlayerNavigation-Next');
            const prevBtn = document.querySelector('button[aria-label="Previous video"], button.prevButton, button.navButton.prevButton, button[aria-label*="Prev" i], button[title*="Prev" i], .PlayerNavigation-Prev');

            if (isFwd && nextBtn) {
                if (typeof triggerClick === 'function') triggerClick(nextBtn, 'RedGifs Next Video');
                else nextBtn.click();
                return true;
            } else if (!isFwd && prevBtn) {
                if (typeof triggerClick === 'function') triggerClick(prevBtn, 'RedGifs Prev Video');
                else prevBtn.click();
                return true;
            }

            // 2. Поиск по DOM-элементам карточек
            const active = getActiveItem();
            if (active) {
                // Ищем соседнюю карточку в том же родительском контейнере или во всем документе
                const container = active.parentElement || document;
                const items = Array.from(container.querySelectorAll('[data-feed-item-id], .GifPreview, a[href*="/watch/"]'));
                let target = null;
                
                if (items.length > 1) {
                    const idx = items.indexOf(active);
                    if (idx !== -1) {
                        target = isFwd ? items[idx + 1] : items[idx - 1];
                    }
                }
                
                if (!target) {
                    target = isFwd ? active.nextElementSibling : active.previousElementSibling;
                }

                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const clickTarget = target.querySelector('.TapTracker, video, img, a') || target;
                    if (typeof triggerClick === 'function') triggerClick(clickTarget, 'RedGifs Target Card');
                    else clickTarget.click();
                    return true;
                }
            }

            // 3. Отправка клавиш ArrowDown / ArrowUp на window и document
            const key = isFwd ? 'ArrowDown' : 'ArrowUp';
            const keyCode = isFwd ? 40 : 38;

            const evDown = new KeyboardEvent('keydown', { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true });
            const evUp   = new KeyboardEvent('keyup',   { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true });

            document.dispatchEvent(evDown);
            window.dispatchEvent(evDown);

            setTimeout(() => {
                document.dispatchEvent(evUp);
                window.dispatchEvent(evUp);
            }, 50);

            // 4. Мягкая прокрутка страницы как страховка
            const scrollAmount = isFwd ? (window.innerHeight * 0.85) : (-window.innerHeight * 0.85);
            window.scrollBy({ top: scrollAmount, behavior: 'smooth' });

            triggerUniversalFullScreen();

            return true;
        }

        /**
         * Сбор всех ссылок видео со страницы профиля/тега/поиска RedGifs
         */
        function collectLinks() {
            const rawLinks = Array.from(document.querySelectorAll('a[href*="/watch/"]'));
            const cards = Array.from(document.querySelectorAll('[data-feed-item-id]'));
            
            const seen = new Set();
            const items = [];

            // Определяем контекст (пользователь или тег)
            let contextName = '';
            const userMatch = location.pathname.match(/\/users\/([^/?#]+)/);
            const tagMatch = location.pathname.match(/\/tags\/([^/?#]+)/);
            if (userMatch) contextName = `@${userMatch[1]}`;
            else if (tagMatch) contextName = `#${tagMatch[1]}`;
            else contextName = document.title.split('-')[0].trim();

            for (const a of rawLinks) {
                const href = a.href;
                const m = href.match(/\/watch\/([^/?#]+)/);
                if (!m) continue;
                const id = m[1];
                if (seen.has(id)) continue;
                seen.add(id);

                const img = a.querySelector('img');
                const poster = img ? img.src : '';
                items.push({
                    id,
                    url: `https://www.redgifs.com/watch/${id}`,
                    poster,
                    context: contextName,
                    type: 'video'
                });
            }

            for (const c of cards) {
                const id = c.getAttribute('data-feed-item-id');
                if (!id || seen.has(id)) continue;
                seen.add(id);
                const img = c.querySelector('img');
                items.push({
                    id,
                    url: `https://www.redgifs.com/watch/${id}`,
                    poster: img ? img.src : '',
                    context: contextName,
                    type: 'video'
                });
            }

            if (items.length === 0) {
                showToast('⚠️ На странице не найдено ссылок на видео', true);
                return;
            }

            const payload = {
                context: contextName,
                collectedAt: new Date().toISOString(),
                items
            };

            localStorage.setItem(REDGIFS_COLLECTION_KEY, JSON.stringify(payload));
            showToast(`📋 Собрано ${items.length} видео (${contextName})`);
            updateGalleryUI();
        }

        /** Обновление панели плейлиста/коллекции для RedGifs */
        function togglePlaylistPanel() {
            const existing = document.getElementById('mossad-rg-playlist-panel');
            if (existing) { existing.remove(); return; }

            const raw = localStorage.getItem(REDGIFS_COLLECTION_KEY);
            if (!raw) { showToast('⚠️ Коллекция RedGifs пуста. Нажмите [📋 Собрать]', true); return; }

            let data;
            try { data = JSON.parse(raw); } catch { return; }
            const items = data.items || [];
            if (!items.length) { showToast('⚠️ Коллекция пуста', true); return; }

            const panel = document.createElement('div');
            panel.id = 'mossad-rg-playlist-panel';
            panel.style.cssText = `
                position:fixed; top:70px; right:16px; z-index:9999999;
                width:320px; max-height:75vh; overflow-y:auto;
                background:rgba(12,12,16,0.96); backdrop-filter:blur(20px);
                border:1px solid rgba(255,255,255,0.12); border-radius:14px;
                font-family:system-ui,sans-serif; font-size:12px; color:#d1d5db;
                box-shadow:0 20px 60px rgba(0,0,0,0.7);
            `;

            const header = document.createElement('div');
            header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);`;
            header.innerHTML = `<span style="font-weight:700;font-size:13px;">📋 RedGifs Плейлист (${items.length})</span>`;
            
            const btnClose = document.createElement('button');
            btnClose.textContent = '×';
            btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;`;
            btnClose.onclick = () => panel.remove();
            header.appendChild(btnClose);
            panel.appendChild(header);

            const body = document.createElement('div');
            body.style.cssText = `padding:8px;`;

            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.style.cssText = `padding:5px 8px;margin-bottom:3px;cursor:pointer;border-radius:6px;color:#9ca3af;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:6px;`;
                li.innerHTML = `<span style="color:#60a5fa;">${idx + 1}.</span> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">📹 ${item.id}</span>`;
                li.title = `Открыть: ${item.url}`;
                li.onmouseover = () => li.style.background = 'rgba(255,255,255,0.06)';
                li.onmouseout  = () => li.style.background = 'transparent';
                li.onclick = () => {
                    panel.remove();
                    window.location.href = item.url;
                };
                body.appendChild(li);
            });

            panel.appendChild(body);
            document.body.appendChild(panel);
        }

        /** Встраивает кнопки сбора коллекции в виджет MOSSAD на RedGifs */
        function updateGalleryUI() {
            if (!isSupported()) return;
            const widget = document.getElementById('mossad-main-panel') || document.getElementById('mossad-status-bar');
            if (!widget) return;

            let bar = document.getElementById('mossad-redgifs-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'mossad-redgifs-bar';
                bar.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:4px;font-size:11px;`;
                
                const panel = document.getElementById('mossad-main-panel');
                if (panel) {
                    panel.insertBefore(bar, panel.firstChild);
                }
            }

            const raw = localStorage.getItem(REDGIFS_COLLECTION_KEY);
            let count = 0;
            if (raw) {
                try { count = (JSON.parse(raw).items || []).length; } catch {}
            }

            bar.innerHTML = `
                <button id="mossad-rg-collect" style="padding:2px 8px;border-radius:4px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">📋 Собрать (${count})</button>
                <button id="mossad-rg-list" style="padding:2px 8px;border-radius:4px;border:none;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;">📋 Плейлист</button>
            `;

            bar.querySelector('#mossad-rg-collect').onclick = collectLinks;
            bar.querySelector('#mossad-rg-list').onclick = togglePlaylistPanel;
        }

        function init() {
            if (!isSupported()) return;
            setInterval(updateGalleryUI, 2000);
        }

        return {
            isSupported,
            getActiveItem,
            getActiveVideo,
            getUserName,
            getTitleFilename,
            findMedia,
            navigate,
            collectLinks,
            togglePlaylistPanel,
            init
        };
    })();

    // Обратная совместимость и глобальные алиасы
    function getActiveRedGifsItem() {
        return window.MOSSAD_ENGINES?.redgifs?.getActiveItem() ||
               document.querySelector('.GifPreview_isActive') ||
               document.querySelector('.GifPreview') ||
               document.querySelector('[data-feed-item-id]');
    }

    function getRedGifsVideo() {
        return window.MOSSAD_ENGINES?.redgifs?.getActiveVideo() || null;
    }

    function getRedGifsUserName() {
        return window.MOSSAD_ENGINES?.redgifs?.getUserName() || '';
    }

    function getRedGifsTitleFilename(itemId) {
        return window.MOSSAD_ENGINES?.redgifs?.getTitleFilename(itemId) || `redgifs_${itemId}_${Date.now()}.mp4`;
    }

    function redGifsNavigate(dir = 'down') {
        if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
            return window.MOSSAD_ENGINES.redgifs.navigate(dir);
        }
    }

    if (window.MOSSAD_ENGINES?.redgifs) {
        window.MOSSAD_ENGINES.redgifs.init();
    }

function findMediaForDownload() {
        // Instagram — делегируем к движку
        if (window.MOSSAD_ENGINES.instagram?.isSupported()) {
            return window.MOSSAD_ENGINES.instagram.findMedia();
        }

        // v1.3.52: Pinterest — асинхронно через pinterestResolveMedia() в triggerDownload (API пина).
        // Синхронный путь сюда больше не заходит; запасной ответ — только главный пин, без «первой картинки страницы».
        if (rootDomain.includes('pinterest.')) {
            const img = pinterestMainImage();
            return img ? { urls: [img.currentSrc || img.src], type: 'photo' } : null;
        }

        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.findMedia) {
                const res = window.MOSSAD_ENGINES.redgifs.findMedia();
                if (res) return res;
            }
            const active = getActiveRedGifsItem();
            const urls = [];
            const itemId = active ? active.getAttribute('data-feed-item-id') : null;

            // Из картинки poster
            if (active) {
                const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]')
                            || (itemId ? document.querySelector(`img[src*="${itemId}"]`) : null)
                            || document.querySelector('img[src*="media.redgifs.com"]');
                if (poster && poster.src) {
                    const mp4Hd = poster.src.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg)/i, '.mp4').replace(/\.(?:jpg|png|jpeg)/i, '.mp4');
                    const mp4Sd = poster.src.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg)/i, '-mobile.mp4').replace(/\.(?:jpg|png|jpeg)/i, '-mobile.mp4');
                    urls.push(mp4Hd, mp4Sd);
                }
            }

            const v = getRedGifsVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://media.redgifs.com/${capId}-mobile.mp4`);
            }

            if (urls.length > 0) return { urls: Array.from(new Set(urls.filter(Boolean))), type: 'video', itemId: itemId || 'video' };
        }

        const video = getActiveVideo();
        if (video) {
            let src = '';
            if (!src) {
                const sources = Array.from(video.querySelectorAll('source'));
                for (const s of sources) {
                    if (s.src && !s.src.startsWith('blob:')) { src = s.src; break; }
                }
                if (!src && video.src && !video.src.startsWith('blob:')) src = video.src;
                if (!src && video.currentSrc && !video.currentSrc.startsWith('blob:')) src = video.currentSrc;
            }
            if (src) return { urls: [src], type: 'video' };
        }

        const img = document.querySelector('img[src*="pinimg.com/originals/"]') || document.querySelector('img[src*="pinimg.com/736x/"]');
        if (img && img.src) {
            const fullImg = img.src.replace(/\/736x\//, '/originals/').replace(/\/474x\//, '/originals/');
            return { urls: [fullImg], type: 'image' };
        }
        
        const allImgs = Array.from(document.querySelectorAll('img')).filter(i => i.width > 200 && i.height > 200);
        if (allImgs.length > 0 && !rootDomain.includes('redgifs.com') && !rootDomain.includes('vk')) {
            return { urls: [allImgs[0].src], type: 'image' };
        }
        
        return null;
    }

    let _activeDuplicateRecord = null;

    function triggerDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null, presetMedia = null) {
        // v1.3.52: Pinterest — медиа главного пина из PinResource API (асинхронно, кэш по id пина)
        if (rootDomain.includes('pinterest.') && !presetMedia) {
            const pinUrlAtStart = location.href;
            pinterestResolveMedia().then(m => {
                if (location.href !== pinUrlAtStart) return; // ушли на другой пин, пока ждали
                if (!m || m.error || !m.urls || !m.urls.length) {
                    showToast(m && m.error === 'video-not-found' ? '❌ Видео не найдено (фото вместо видео не качаю)' : '❌ Медиа не найдено', true);
                    if (onDoneCallback) onDoneCallback(); // слайдшоу не ждёт 8 с
                    return;
                }
                triggerDownload(bypassDuplicateCheck, duplicateRecord, onDoneCallback, m);
            }).catch(e => { console.error('[MOSSAD] Pinterest download resolve error:', e); showToast('❌ Медиа не найдено', true); if (onDoneCallback) onDoneCallback(); });
            return;
        }
        if (duplicateRecord) {
            _activeDuplicateRecord = duplicateRecord;
        } else if (!bypassDuplicateCheck) {
            _activeDuplicateRecord = null;
        }

        if (rootDomain === 'grok.com') {
            if (triggerGrokDownload(bypassDuplicateCheck, duplicateRecord || _activeDuplicateRecord, onDoneCallback)) return;
        }

        const media = presetMedia || findMediaForDownload();
        if (!media || !media.urls || media.urls.length === 0) { showToast('❌ Медиа не найдено', true); return; }

        const primaryUrl = media.urls[0];
        const canonicalPostUrl = media.postUrl || location.href;

        // Проверка дубликата в истории (для Pinterest, Instagram, RedGifs и др.)
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(primaryUrl) && !isDuplicateConfirmed(canonicalPostUrl)) {
            checkFileInHistory(null, primaryUrl, canonicalPostUrl, media.type).then(record => {
                if (record) {
                    _activeDuplicateRecord = record;
                    showDuplicateDownloadNotice(record, () => triggerDownload(true, record, null, presetMedia), canonicalPostUrl, primaryUrl);
                } else {
                    _activeDuplicateRecord = null;
                    triggerDownload(true, null, onDoneCallback, presetMedia);
                }
            });
            return;
        }

        // Защита от повторного скачивания одного файла за короткое время
        const now = Date.now();
        if (primaryUrl === _lastDownloadUrl && (now - _lastDownloadTime) < 5000) {
            console.warn('[MOSSAD] Повторное скачивание того же файла за 5сек, пропущено.');
            return;
        }
        _lastDownloadUrl = primaryUrl;
        _lastDownloadTime = now;

        const currentDup = duplicateRecord || _activeDuplicateRecord;
        const isDup = Boolean(currentDup && (currentDup.filename || currentDup.rootFilename));
        const rootBase = isDup ? (currentDup.rootFilename || (extractRootFilename(currentDup.filename))) : '';
        const dblSuffix = isDup ? ` (${rootBase || 'original'}) DBL` : '';
        
        // Извлечение UUID / ID поста для короткого именования (первые 8 символов)
        let postId = '';
        let convId = '';
        if (rootDomain === 'grok.com') {
            const m = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
            if (m) postId = m[1];
            try {
                const u = new URL(location.href);
                convId = u.searchParams.get('conversation') || u.searchParams.get('conv') || '';
            } catch(e) {}
            if (!convId && postId) {
                try {
                    const raw = sessionStorage.getItem('grok_gallery_collection');
                    if (raw) {
                        const data = JSON.parse(raw);
                        const found = (data.items || []).find(it => it.url && it.url.includes(postId));
                        if (found && found.convId) convId = found.convId;
                    }
                } catch(e) {}
            }
            if (!convId && postId) {
                const a = document.querySelector(`a[href*="${postId}"][href*="conversation="]`);
                if (a) {
                    try {
                        const u = new URL(a.href, location.origin);
                        convId = u.searchParams.get('conversation') || '';
                    } catch(e) {}
                }
            }
        } else if (rootDomain.includes('pinterest.')) {
            const m = location.pathname.match(/\/pin\/(\d+)/);
            if (m) postId = m[1];
        } else if (rootDomain.includes('redgifs.com')) {
            postId = media.itemId || '';
        } else if (rootDomain.includes('instagram.com')) {
            const m = location.pathname.match(/\/(?:p|reel)\/([^/?#]+)/);
            if (m) postId = m[1];
        }
        if (!postId && media.itemId) postId = media.itemId;
        if (!postId) postId = String(Date.now());

        const shortId = postId.replace(/^grok-video-/, '').slice(0, 8);
        const domainClean = rootDomain.replace(/[^a-z0-9._-]/gi, '_');

        // Извлечение имени автора/пользователя (для RedGifs, Instagram и др.)
        let authorName = '';
        if (media && media.userName) {
            authorName = media.userName;
        } else if (rootDomain.includes('redgifs.com')) {
            authorName = getRedGifsUserName();
        } else if (rootDomain.includes('instagram.com')) {
            const m = location.pathname.match(/^\/([A-Za-z0-9_.]+)\//);
            if (m && !['p', 'reel', 'stories', 'explore'].includes(m[1])) authorName = m[1];
        }

        // --- Вспомогательная функция: применить {var[N]} синтаксис ---
        function applyTplVar(value, len) {
            return len > 0 ? value.slice(0, len) : value;
        }

        // --- Базовое имя файла (по умолчанию: 8 символов ID + домен) ---
        let filename;
        const ext = media.type === 'video' ? 'mp4' : 'jpg';
        if (rootDomain.includes('redgifs.com') && media.itemId) {
            filename = `${getRedGifsTitleFilename(media.itemId)}`;
        } else if (rootDomain === 'grok.com' && shortId && shortId.length >= 4) {
            const shortConv4 = convId ? convId.slice(0, 4) : '';
            const shortId4 = postId ? postId.slice(0, 4) : '';
            const defaultPrefix = shortConv4 ? `${shortConv4}-${shortId4 || shortId}` : shortId;
            filename = `${defaultPrefix}-${domainClean}.${ext}`;
        } else if (shortId && shortId.length >= 4) {
            // Формат по умолчанию: {8 символов UUID}-{домен}.{ext}
            filename = `${shortId}-${domainClean}.${ext}`;
        } else {
            const titleClean = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            filename = `${titleClean}.${ext}`;
        }

        // --- Применяем шаблон имени файла, если включён ---
        if (config.filenameTemplateEnabled) {
            const now2 = new Date();
            const pad2 = (n) => String(n).padStart(2, '0');
            const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
            const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
            const ext2 = media.type === 'video' ? 'mp4' : 'jpg';
            const titleClean2 = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            const nStr = String(Date.now()).slice(-6);

            // Словарь переменных (значение без обрезки)
            const vars = {
                id:           postId,
                conv:         convId,
                conversation: convId,
                uuid:         postId,
                hash:         postId,
                postid:       postId,
                id8:          shortId,
                hash8:        shortId,
                uuid8:        shortId,
                title:        titleClean2,
                date:         dateStr,
                time:         timeStr,
                ext:          ext2,
                domain:       domainClean,
                username:     authorName || shortId,
                user:         authorName || shortId,
                author:       authorName || shortId,
                n:            nStr,
                dbl:          dblSuffix,
                oldname:      rootBase,
                copy:         rootBase,
                root:         rootBase,
            };

            filename = renderFilenameTemplate(config.filenameTemplate, vars, isDup, dblSuffix, ext2);
        } else if (isDup) {
            // Без шаблона: добавляем разметку дубликата перед расширением
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : (media.type === 'video' ? '.mp4' : '.jpg');
            filename = `${base}${dblSuffix}${extPart}`;
        }

        const urls = media.urls;
        let attemptedIndex = 0;

        let postActionDone = false; // v1.3.52: «После DL» — один раз, а не на каждую запасную ссылку (_720w → _360w)
        function tryNext() {
            if (attemptedIndex >= urls.length) {
                console.warn('Все ссылки не сработали, fallback на Blob...');
                if (onDoneCallback) onDoneCallback();
                downloadBlobMedia(urls[0], filename, canonicalPostUrl);
                return;
            }
            const targetUrl = urls[attemptedIndex++];
            showToast('⏳ Запуск скачивания...');
            // v1.3.52: слайдшоу листает, как только файл сохранён (раньше колбэк не вызывался — всегда ждали 8 с страховки)
            triggerDirectBlobDownload(targetUrl, filename, tryNext, canonicalPostUrl, onDoneCallback);
            if (!postActionDone) { postActionDone = true; performPostDownloadAction(); }
        }
        
        tryNext();
    }

// ============================================
    // SLIDESHOW LOGIC (AUTO) & SESSION PERSISTENCE
    // ============================================
    const SESSION_ACTIVE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`;
    const SESSION_STATE_KEY  = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_wstate`;
    const SESSION_PAUSED_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_paused`;
    const SESSION_NAV_KEY    = 'mossad_navigating';

    // Если был автоматический переход на следующий слайд, гарантируем очистку флагов навигации и паузы
    if (sessionStorage.getItem(SESSION_NAV_KEY) === 'true') {
        sessionStorage.removeItem(SESSION_NAV_KEY);
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
    }

    let slideshowActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
    let slideshowPaused = sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';
    let slideshowTimeoutId = null;
    let downloadTimeoutId = null;
    let countdownSeconds = 0;
    let isCountingDown = false; // Отсчет времени после видео или для фото

    function setSlideshowPaused(val) {
        slideshowPaused = !!val;
        if (slideshowPaused) {
            sessionStorage.setItem(SESSION_PAUSED_KEY, 'true');
        } else {
            sessionStorage.removeItem(SESSION_PAUSED_KEY);
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }
    
    // Вспомогательные переменные для циклов
    let currentVideoNode = null;
    let videoInitialDuration = 0;
    let currentLoopCount = 0;
    let accumulatedTime = 0;
    let lastTime = 0;
    let lastRAFTime = 0;
    let rafId = null;
    let _videoReachedEndZone = false; // Видео зашло в финальную зону (последние доли секунды)
    let _endedConsumed = false;       // v1.3.38: событие ended уже засчитано (ended остаётся true до play())
    let _videoDetachedSince = 0;      // v1.3.38: когда отслеживаемый <video> исчез из DOM
    let _lastRebindCheck = 0;         // v1.3.38: троттлинг поиска другого играющего видео
    let _lastCycleVideoSrc = '';      // v1.3.38: src видео предыдущего слайда (не считать старое видео новым)
    let _lastCycleSlideKey = '';
    let _lastDownloadUrl = null;     // защита от повторного скачивания одного файла
    let _lastDownloadTime = 0;
    const _filenameCounter = new Map(); // счётчик по базовому имени → (001)(002)...
    let _samePageSlideCount = 0;     // счётчик попыток перелистнуть с одной и той же страницы
    let _lastSlideUrl = '';          // URL во время последнего triggerNextSlide
    const SAME_PAGE_LIMIT = 3;       // сколько раз пробовать перед остановкой

    // v1.3.38: ЕДИНСТВЕННЫЙ отложенный запуск цикла слайда. Раньше цикл запускали независимо
    // тик галереи (setTimeout 300 мс без id), монитор URL (150 мс) и др. — каждый перезапуск
    // обнулял счётчик кругов видео. Теперь все источники идут через requestSlideCycle():
    // новый запрос заменяет предыдущий, cancelSlideTimers() отменяет его (ANTI_PATTERNS §17).
    let _cycleStartTimer = null;

    function requestSlideCycle(delayMs, source) {
        if (_cycleStartTimer) { clearTimeout(_cycleStartTimer); _cycleStartTimer = null; }
        mossadDebug('cycle', 'запрос запуска цикла', { source, delayMs });
        _cycleStartTimer = setTimeout(() => {
            _cycleStartTimer = null;
            if (slideshowActive && !slideshowPaused) scheduleNextSlideCycle(0);
        }, Math.max(0, delayMs || 0));
    }

    function cancelSlideTimers() {
        if (_cycleStartTimer) {
            clearTimeout(_cycleStartTimer);
            _cycleStartTimer = null;
        }
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (slideshowTimeoutId) {
            clearTimeout(slideshowTimeoutId);
            slideshowTimeoutId = null;
        }
        if (downloadTimeoutId) {
            clearTimeout(downloadTimeoutId);
            downloadTimeoutId = null;
        }
        isCountingDown = false;
        countdownSeconds = 0;
        currentLoopCount = 0;
        accumulatedTime = 0;
        lastTime = 0;
        _videoReachedEndZone = false;
        _endedConsumed = false;
        _videoDetachedSince = 0;
        currentVideoNode = null;
    }

    /** Живая длительность видео (videoInitialDuration — только запасной вариант, пока duration ещё NaN). */
    function liveVideoDuration(v) {
        const d = v ? v.duration : NaN;
        return (isFinite(d) && d > 0) ? d : (videoInitialDuration || 0);
    }

    /**
     * v1.3.38: перепривязка счётчика кругов к новому <video> того же слайда (React/HLS перемонтировал плеер)
     * БЕЗ сброса currentLoopCount. Раньше любая смена элемента перезапускала цикл с нуля → 2–4 круга вместо 1.
     */
    function rebindVideoNode(v, source) {
        if (!v) return;
        mossadDebug('loop', 'перепривязка к новому <video> без сброса счётчика', { source, loops: currentLoopCount });
        currentVideoNode = v;
        lastActiveVideo = v;
        if (isFinite(v.duration) && v.duration > 0) videoInitialDuration = v.duration;
        _videoReachedEndZone = false;
        _endedConsumed = !!v.ended;
        _videoDetachedSince = 0;
        lastTime = v.currentTime;
        if (v.paused) { try { v.play().catch(() => {}); } catch(e) {} }
        if (!rafId && slideshowActive && !slideshowPaused && !isCountingDown) {
            rafId = requestAnimationFrame(checkVideoLoops);
        }
    }
    window.cancelSlideTimers = cancelSlideTimers;
    function getActiveVideo() {
        if (rootDomain.includes('redgifs.com') && window.MOSSAD_ENGINES?.redgifs?.getActiveVideo) {
            const rgVid = window.MOSSAD_ENGINES.redgifs.getActiveVideo();
            if (rgVid) return rgVid;
        }

        let videos = Array.from(document.querySelectorAll('video'));
        // v1.3.42: на Grok <video> в кадрах киноплёнки — миниатюры других генераций, не плеер поста
        if (rootDomain === 'grok.com') {
            videos = videos.filter(v => !v.closest(GROK_FILMSTRIP_SEL));
            if (videos.length === 0) return null;
            return grokPickBestVideo(videos); // v1.3.43: UUID поста / играет / видимо (не «первое в DOM»)
        }
        if (videos.length === 0) return null;
        
        // v1.3.51: на Пинтересте — только видео главного пина (closeup), превью «Похожих пинов» не берём.
        // Раньше в список «сцен» входил div[role="main"], а он содержит и сетку похожих.
        if (rootDomain.includes('pinterest.')) return pinterestMainVideo();

        if (videos.length === 1) return videos[0];
        
        let maxVisible = 0;
        let bestVideo = videos[0];
        for (const v of videos) {
            const rect = v.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
            const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
            const visibleArea = visibleHeight * visibleWidth;
            if (visibleArea > maxVisible) {
                maxVisible = visibleArea;
                bestVideo = v;
            }
        }
        return bestVideo;
    }

    // ============================================
    // UNIVERSAL AUTO FULL SCREEN (FS)
    // ============================================
    function triggerUniversalFullScreen() {
        const isEnabled = config.autoFS !== undefined ? config.autoFS : (config.pinterestAutoFS !== undefined ? config.pinterestAutoFS : true);
        if (!isEnabled) return;
        if (document.fullscreenElement) return;

        retryAction((attempt) => {
            if (document.fullscreenElement) return true;

            // 1. Pinterest: "Показать в полном масштабе"
            if (rootDomain.includes('pinterest.')) {
                let btn = document.querySelector('[aria-label="Показать в полном масштабе"], [title="Показать в полном масштабе"], [aria-label*="полном масштабе"]');
                if (!btn) {
                    const svg = document.querySelector('svg[aria-label*="полном масштабе"]');
                    if (svg) btn = svg.closest('[role="button"]') || svg.closest('button') || svg;
                }
                if (btn) {
                    triggerClick(btn, 'Pinterest FullScale');
                    return true;
                }
            }

            // 2. Grok: кнопка Full Screen (Expand video / lucide-expand)
            if (rootDomain === 'grok.com') {
                const fsKeywords = ['expand video', 'expand', 'во весь экран', 'полноэкран', 'full screen', 'fullscreen'];
                const btn = document.querySelector('button[aria-label="Expand video"], button[aria-label*="Expand" i]')
                    || (findGrokButton(fsKeywords))
                    || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        const title = (b.getAttribute('title') || '').toLowerCase();
                        return fsKeywords.some(k => aria.includes(k) || title.includes(k)) || b.querySelector('svg.lucide-expand');
                    });
                if (btn) {
                    triggerClick(btn, 'Grok FullScreen');
                    return true;
                }
            }

            // 3. Универсальный поиск для остальных сайтов
            const genericBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const title = (b.getAttribute('title') || '').toLowerCase();
                return aria.includes('fullscreen') || aria.includes('full screen') || aria.includes('во весь экран') ||
                       title.includes('fullscreen') || title.includes('full screen') || title.includes('во весь экран');
            });
            if (genericBtn) {
                triggerClick(genericBtn, 'Universal FullScreen');
                return true;
            }

            return false;
        }, [100, 300, 500]);
    }

    let lastUrlForSlideshow = location.href;
    let lastActiveVideo = null;

    /** Ключ «слайда» для монитора: на Grok — UUID поста (смена query/replaceState того же поста — не новый слайд). */
    function slideKeyOf(url) {
        if (rootDomain === 'grok.com') {
            try {
                const u = grokExtractUuid(new URL(url, location.origin).pathname);
                if (u) return 'grok:' + u.toLowerCase();
            } catch(e) {}
        }
        return url;
    }

    setInterval(() => {
        if (!slideshowActive || _isRewinding) return;
        
        const currentUrl = location.href;
        const urlChanged = currentUrl !== lastUrlForSlideshow;
        const slideChanged = urlChanged && slideKeyOf(currentUrl) !== slideKeyOf(lastUrlForSlideshow);
        
        let videoChanged = false;
        let currentVideo = lastActiveVideo;
        if (urlChanged || !lastActiveVideo || !document.body.contains(lastActiveVideo)) {
            currentVideo = getActiveVideo();
            videoChanged = currentVideo !== lastActiveVideo && (currentVideo !== null || lastActiveVideo !== null);
        }
        
        if (urlChanged && !slideChanged && !videoChanged) {
            // Тот же пост (например, replaceState с другим query) — не новый слайд
            lastUrlForSlideshow = currentUrl;
            return;
        }

        if (slideChanged || videoChanged || urlChanged) {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;

            // v1.3.38: на Grok смена <video> внутри того же поста (React перемонтировал плеер) — НЕ новый слайд:
            // перепривязываемся к новому элементу без сброса счётчика кругов (см. rebindVideoNode).
            if (!slideChanged && videoChanged && rootDomain === 'grok.com' && currentVideoNode && currentVideo && !isCountingDown) {
                rebindVideoNode(currentVideo, 'url-monitor');
                return;
            }

            if (slideshowTimeoutId) { clearTimeout(slideshowTimeoutId); slideshowTimeoutId = null; }
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

            // Сбрасываем таймер в интерфейсе немедленно!
            isCountingDown = false;
            countdownSeconds = 0;

            if (urlChanged) {
                triggerUniversalFullScreen();
            }

            if (slideChanged) mossadPerfSnapshot('slide');
            requestSlideCycle(150, slideChanged ? 'url-monitor:slide' : 'url-monitor:video');
        }
    }, 250);

    function stopSlideshow() {
        cancelSlideTimers();
        if (typeof pinterestCancelWait === 'function') pinterestCancelWait();
        slideshowActive = false;
        setSlideshowPaused(false);
        isCountingDown = false;
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_STATE_KEY);
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
        if (rootDomain === 'grok.com') {
            _gSS.removeItem(GALLERY_SS_KEY);
            sessionStorage.removeItem('mossad_gallery_paused');
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            window._mossadGalleryPaused = false;
            const ind = document.getElementById('mossad-gallery-indicator');
            if (ind) ind.remove();
            updateGalleryStatusBtn('idle');
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }

    function startSlideshow() {
        if (!slideshowActive) {
            // При локальном старте гарантируем, что это НЕ галерейный режим
            if (rootDomain === 'grok.com') {
                window._mossadGalleryActive = false;
                window._mossadGalleryNextFn = null;
                _gSS.removeItem(GALLERY_SS_KEY);
                sessionStorage.removeItem('mossad_gallery_paused');
                const ind = document.getElementById('mossad-gallery-indicator');
                if (ind) ind.remove();
            }
            slideshowActive = true;
            setSlideshowPaused(false);
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            sessionStorage.setItem(SESSION_STATE_KEY, 'bar');
            // Закрываем модальное окно настроек горячих клавиш (если открыто)
            // v1.3.45: через общий путь закрытия — с сохранением и снятием слушателей (раньше просто remove())
            if (document.getElementById('mossad-hk-modal')) closeSettingsWindow(true);
            // Сворачиваем большое меню с D-Pad в компактную полоску (bar)
            window.widgetState = 'bar';
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleNextSlideCycle(0);
        } else {
            stopSlideshow();
        }
    }

    function getArrowKey(dir) {
        if (dir === 'up') return 'ArrowUp';
        if (dir === 'down') return 'ArrowDown';
        if (dir === 'left') return 'ArrowLeft';
        return 'ArrowRight';
    }

    function triggerNextSlide(source = 'unknown') {
        if (!slideshowActive || slideshowPaused || _isRewinding) {
            mossadDebug('step', 'triggerNextSlide пропущен (неактивно/пауза/перемотка)', { source });
            return;
        }
        mossadDebug('step', 'triggerNextSlide', { source });
        cancelSlideTimers();

        // 1. Большое слайдшоу (по плейлисту коллекции в Grok): НЕ зависит от D-Pad!
        const isBigGrokSs = (rootDomain === 'grok.com') && (() => {
            if (window._mossadGalleryActive) return true;
            try { return !!JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active; } catch { return false; }
        })();

        const dirs = config.slideshowDirections;
        const isPinterest = rootDomain.includes('pinterest.');
        if (!isBigGrokSs && !isPinterest && (!dirs || dirs.length === 0)) {
            stopSlideshow();
            return;
        }

        const advanceToNext = () => {
            // Большое слайдшоу (Gallery Slideshow): переходим на следующий URL из собранного плейлиста
            if (isBigGrokSs) {
                if (typeof window._mossadGalleryNextFn === 'function') {
                    window._mossadGalleryNextFn(source);
                    return;
                } else grokGalleryStepNext(source);
                return;
            }

            // v1.3.51: Pinterest — своё направление (▶ вперёд по умолчанию, ◀ назад по истории), не D-pad.
            // Похожих пинов ждёт сам движок (до 15 с), тупик — шаг назад; «конец ленты» и остановки здесь нет.
            // Раньше: D-pad ▲ по умолчанию = «назад по истории» → «начало истории» → через 5 с «конец ленты». ANTI_PATTERNS §30.
            if (isPinterest) {
                selectNextPinterestPin(pinterestSlideDir(), { isManual: false, fromSlideshow: true });
                triggerUniversalFullScreen();
                return;
            }

            // Малое слайдшоу управляется D-Pad и петлей R
            const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
            const startUrl = location.href;

            const sendSlideStep = () => {
                if (typeof performDpadStep === 'function') {
                    performDpadStep(dPadDir, true);
                } else {
                    const key = (typeof getArrowKey === 'function') ? getArrowKey(dPadDir) : 'ArrowDown';
                    if (typeof sendDpadKeyEvent === 'function') {
                        sendDpadKeyEvent(key);
                    } else {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                        document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
                    }
                }
                triggerUniversalFullScreen();
            };

            // Попытка 1: исходное нажатие
            sendSlideStep();

            // Проверяем через 1 секунду
            setTimeout(() => {
                if (!slideshowActive || slideshowPaused || _isRewinding) return;
                if (location.href !== startUrl) return; // Успешно перелистнулось с 1-й попытки

                // Попытка 2: URL не изменился через 1 секунду
                console.log('[MOSSAD] Конец ленты? Попытка 2 (через 1с)...');
                sendSlideStep();

                // Проверяем через 3 секунды (на 4-й секунде от начала)
                setTimeout(() => {
                    if (!slideshowActive || slideshowPaused || _isRewinding) return;
                    if (location.href !== startUrl) return; // Успешно перелистнулось со 2-й попытки

                    // Попытка 3: URL всё ещё не изменился через 3 секунды
                    console.log('[MOSSAD] Конец ленты? Попытка 3 (на 4-й секунде)...');
                    sendSlideStep();

                    // Даем 1 секунду на завершение 3-й попытки
                    setTimeout(() => {
                        if (!slideshowActive || slideshowPaused || _isRewinding) return;
                        if (location.href !== startUrl) return; // Успешно перелистнулось с 3-й попытки

                        // URL так и не изменился после 3 попыток -> дошёл до конца ленты, упёрся
                        console.warn('[MOSSAD] Достигнут конец ленты (3 попытки без смены URL)');
                        if (config.loopFeed) {
                            showToast('🔄 Конец ленты: повтор плейлиста (R)...');
                            doRewind(() => {
                                if (slideshowActive && !slideshowPaused) {
                                    scheduleNextSlideCycle(0);
                                }
                            });
                        } else {
                            stopSlideshow();
                            showToast('⏹ Слайдшоу остановлено: конец ленты', true);
                        }
                    }, 1000);
                }, 3000);
            }, 1000);
        };

        // Скачивание перед перелистыванием
        if (config.downloadType !== 'none') {
            const hasVideo = getActiveVideo() !== null;
            const typeMatch = !(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo);
            if (typeMatch) {
                // 60-секундный guard от повторного скачивания одной страницы
                const _dlPageUrl = normUrlKey(location.href);
                const _dlLastUrl = sessionStorage.getItem('mossad_auto_dl_url');
                const _dlLastTime = parseInt(sessionStorage.getItem('mossad_auto_dl_time') || '0', 10);
                const _dlNow = Date.now();
                const _recentDl = (_dlLastUrl === _dlPageUrl) && (_dlNow - _dlLastTime < 60000);
                if (_recentDl) {
                    const secsAgo = Math.round((_dlNow - _dlLastTime) / 1000);
                    const _h = Array.isArray(config.hk?.download) ? config.hk.download[0] : config.hk?.download;
                    const _dlLabel = _h?.key ? `${_h.ctrl?'Ctrl+':''}${_h.alt?'Alt+':''}${_h.shift?'Shift+':''}${_h.key}` : 'DL';
                    showToast(`⚠️ ${secsAgo}с назад уже скачано. Повтор: ${_dlLabel}`);
                    advanceToNext();
                    return;
                } else {
                    sessionStorage.setItem('mossad_auto_dl_url', _dlPageUrl);
                    sessionStorage.setItem('mossad_auto_dl_time', String(_dlNow));
                    
                    let advanced = false;
                    const onDownloadComplete = () => {
                        if (advanced) return;
                        advanced = true;
                        if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                            setTimeout(() => window.close(), 1000);
                            return;
                        }
                        advanceToNext();
                    };

                    // Страховочный таймаут: если скачивание/сеть задерживается, продолжаем листание через 8с
                    const safetyTimer = setTimeout(() => {
                        console.warn('[MOSSAD] Auto-download wait timeout (8s), advancing slide');
                        onDownloadComplete();
                    }, 8000);

                    triggerDownload(false, null, () => {
                        clearTimeout(safetyTimer);
                        onDownloadComplete();
                    });
                    return;
                }
            }
        }

        advanceToNext();
    }

    function getPinMediaType() {
        if (rootDomain.includes('redgifs.com')) return 'video';

        // v1.3.51: Pinterest — сначала факты о ГЛАВНОМ пине (closeup), тип с карточки сетки — только подсказка
        // «ждать плеер». Раньше тип с карточки ('image') сразу запускал фото-таймер даже у видео-пина.
        if (rootDomain.includes('pinterest.')) {
            const pinData = getPinterestMainPinData();
            if (pinData.isFound && (pinData.type === 'video' || pinData.type === 'image')) return pinData.type;
            // v1.3.52: сводка пина из PinResource API (один запрос на пин, кэш): видео/фото известно ещё до плеера
            const pid = pinterestCurrentPinId();
            if (pid) {
                const ci = pinterestCachedPinInfo(pid);
                if (ci === undefined) pinterestFetchPinInfo(pid);
                else if (ci) return ci.isVideo ? 'video' : 'image';
            }
            if (sessionStorage.getItem('mossad_expected_type') === 'video') return 'video';
            if (config.pinterestFilterType === 'video') return 'video';
            return 'unknown';
        }

        const expected = sessionStorage.getItem('mossad_expected_type');
        if (expected === 'video' || expected === 'image') return expected;
        // v1.3.42: сбор Grok пишет тип 'photo' (collect.js) — раньше он не распознавался и тип
        // угадывался по DOM, что на фото давало ложное «видео» и ожидание 6 с.
        if (expected === 'photo') return 'image';

        // Быстрое определение по кнопкам Grok (появляются раньше видео-плеера)
        if (rootDomain === 'grok.com') {
            // v1.3.43: кнопка «Make video» (у фото) — не признак видео
            const allBtns = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'))
                .filter(el => !/make\s*video/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' ')));
            const btnTexts = allBtns.map(el => (el.textContent || '').trim());
            const btnArias = allBtns.map(el => (el.getAttribute('aria-label') || '').toLowerCase());
            // "Удалить изображение" — железное подтверждение что это фото
            if (btnTexts.some(t => t === 'Удалить изображение' || t === 'Delete image')) return 'image';
            // Видео-признаки по кнопкам
            if (
                btnTexts.some(t => t === 'Удалить видео' || t === 'Delete video' || t === 'Продлить' || t === 'Extend') ||
                btnArias.some(a => a.includes('звук') || a.includes('sound') || a.includes('mute') || a.includes('unmute')) ||
                allBtns.some(el => /звук/i.test(el.textContent))
            ) return 'video';
        }

        // Проверяем видеоплееры (duplo-hls-video, story-pin, idea-pin, кнопки звука)
        if (document.querySelector('video, [data-test-id*="video"], [data-test-id*="story-pin"], [data-test-id*="idea-pin"], [data-test-id*="duplo-hls"], button[aria-label*="звук"], button[aria-label*="Sound"], button[aria-label*="Unmute"], .SoundButton')) {
            return 'video';
        }
        if (document.querySelector('meta[property="og:video"], meta[name="og:video"], meta[name="twitter:card"][content="player"]')) {
            return 'video';
        }
        const ldJsonScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of ldJsonScripts) {
            const txt = s.textContent || '';
            if (txt.includes('VideoObject') || txt.includes('video')) return 'video';
        }

        return 'unknown';
    }

    function scheduleNextSlideCycle(initSec, retryCount = 0) {
        if (!slideshowActive || slideshowPaused) return;
        // Прямой запуск цикла отменяет отложенный (requestSlideCycle), иначе он перезапустил бы счётчик позже
        if (_cycleStartTimer) { clearTimeout(_cycleStartTimer); _cycleStartTimer = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (slideshowTimeoutId) { clearTimeout(slideshowTimeoutId); slideshowTimeoutId = null; }
        
        // v1.3.42: Grok — своё быстрое определение (grokDecideSlideMedia). true — решение принято или
        // запланирована повторная проверка; иначе — элемент <video>, идём в общий путь видео.
        let grokVideo = null;
        if (rootDomain === 'grok.com' && typeof isGrokPostPage === 'function' && isGrokPostPage()) {
            const _pt = performance.now();
            const res = grokDecideSlideMedia(initSec, retryCount);
            mossadPerfStep('grokDecideSlideMedia', _pt);
            if (res === true) return;
            grokVideo = res; // найден свежий <video> просмотрщика — это видео, что бы ни говорил сбор
        }

        const detectedType = grokVideo ? 'video' : getPinMediaType();
        const video = grokVideo || getActiveVideo();

        if (detectedType === 'image') {
            // Мгновенный запуск фото-таймера на 0 миллисекунде
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer('photo-timer');
            return;
        }

        if (video) {
            if (video.paused) {
                try { video.play().catch(() => {}); } catch(e) {}
            }
            if (isNaN(video.duration) || video.duration === 0) {
                if (retryCount > 40) { // До 8 секунд ожидания параметров видео
                     triggerNextSlide('video-meta-timeout');
                     return;
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            // v1.3.38: на Grok сразу после перехода ещё может стоять <video> ПРЕДЫДУЩЕГО поста (тот же src).
            // Ждём смены src (до ~3 с), иначе считали бы круги старого ролика.
            const slideKey = slideKeyOf(location.href);
            const vSrc = video.currentSrc || video.src || '';
            if (rootDomain === 'grok.com' && _lastCycleSlideKey && slideKey !== _lastCycleSlideKey &&
                vSrc && vSrc === _lastCycleVideoSrc && retryCount < 15) {
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            _lastCycleSlideKey = slideKey;
            _lastCycleVideoSrc = vSrc;
            sessionStorage.removeItem('mossad_expected_type');
            isCountingDown = false;
            currentVideoNode = video;
            lastActiveVideo = video;
            videoInitialDuration = video.duration;
            currentLoopCount = 0;
            accumulatedTime = 0;
            lastTime = video.currentTime;
            lastRAFTime = performance.now();
            _videoReachedEndZone = false;
            _videoDetachedSince = 0;
            _endedConsumed = false;
            if (video.ended) {
                // Ролик уже закончился (не зациклен) — начинаем круг заново, а не засчитываем мгновенно
                try { video.currentTime = 0; video.play().catch(() => {}); } catch(e) {}
            }
            mossadDebug('cycle', 'старт подсчёта кругов видео', { need: config.videoLoops, dur: Math.round(video.duration * 10) / 10 });
            rafId = requestAnimationFrame(checkVideoLoops);
        } else if (rootDomain.includes('pinterest.')) {
            // v1.3.51: Pinterest — картинка и признаки видео только у главного пина (не в сетке похожих).
            // Есть плеер/кнопка звука — ждём <video> до 6 с; карточка сказала «видео» — до 3 с; иначе 0.5 с.
            const mainImg = pinterestMainImage();
            const signs = pinterestHasVideoSigns();
            const cap = signs ? 60 : (detectedType === 'video' ? 30 : 5);
            if (retryCount < cap || (!mainImg && retryCount < 60)) {
                if ((signs || detectedType === 'video') && retryCount > 0 && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка видео-плеера... (${Math.floor(retryCount / 10)}/${Math.round(cap / 10)}с)`);
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 100);
                return;
            }
            pinterestRememberType('image');
            startPhotoCountdown(initSec, 'pinterest: нет видео у главного пина');
        } else {
            // Если в DOM уже есть главная картинка пина и нет контейнеров видео
            const stage = document.querySelector('div[data-test-id="closeup-stage"], div[data-test-id="pin-closeup"], div[role="main"]');
            const mainImg = stage ? stage.querySelector('img') : null;
            const hasVideoElements = document.querySelector('div[data-test-id="video-player"], div[data-test-id="story-pin-video"], button[aria-label*="звук"], button[aria-label*="Sound"], .SoundButton');

            if (detectedType === 'unknown' && mainImg && !hasVideoElements && retryCount >= 5) {
                // Запуск фото-таймера после 500мс проверки картинки
                sessionStorage.removeItem('mossad_expected_type');
                countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
                isCountingDown = true;
                runPhotoTimer('photo-timer');
                return;
            }

            // Ожидание монтирования <video> (для видео-пинов)
            const isVideoExpected = (detectedType === 'video' || (rootDomain.includes('pinterest.') && config.pinterestFilterType === 'video'));
            const maxWaitAttempts = isVideoExpected ? 60 : 15; // 6 сек для видео, 1.5 сек для остальных

            if (retryCount < maxWaitAttempts) {
                if (isVideoExpected && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка HLS видео-плеера... (${Math.floor(retryCount / 10)}/6с)`);
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 100);
                return;
            }

            // Фолбэк на фото
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer('photo-timer');
        }
    }

    // ── v1.3.42: определение «видео или фото» на Grok ──
    // Видео: свежий <video> просмотрщика (не кадр киноплёнки, src не от прошлого слайда) — сразу.
    // Фото: нет свежего <video> и нет кнопки mute/unmute плеера (в т.ч. скрытой), страница «устоялась»
    // (readyState complete + URL на целевом посте) и прошло короткое окно с момента прибытия:
    // GROK_PHOTO_GRACE_MS (тип по сбору — фото) или GROK_UNKNOWN_GRACE_MS (тип неизвестен). Опрос — 100 мс.
    // Если ролик смонтируется позже, монитор URL/видео (setInterval 250 мс выше) перезапустит цикл
    // и слайд пойдёт как видео. ANTI_PATTERNS §21.
    const GROK_PHOTO_GRACE_MS   = 450;  // сбор сказал «фото» (нет таймера на карточке)
    const GROK_UNKNOWN_GRACE_MS = 700;  // тип неизвестен
    const GROK_STALE_WAIT_MS    = 3000; // ждать смены старого <video> / «устаканивания» URL не дольше
    const GROK_VIDEO_WAIT_MS    = 6000; // сбор сказал «видео» или есть кнопка звука, а <video> ещё нет
    const GROK_DETECT_POLL_MS   = 100;
    let _grokDetectStartedAt = 0;
    const GROK_STALL_MS      = 1500;  // v1.3.43: время видео не идёт столько — восстанавливаем
    const GROK_STALL_SKIP_MS = 10000; // не помогло — следующий слайд
    let _stallNode = null, _stallCt = -1, _stallSince = 0, _stallLastFix = 0;

    /**
     * v1.3.43: сброс «памяти» прошлых слайдов при повторе (круг слайдшоу / перемотка ленты в начало).
     * Те же посты показываются снова: src «прошлого видео» и lastActiveVideo из прошлого круга не
     * должны влиять на первый слайд нового круга.
     */
    function resetSlideTrackingState(reason) {
        mossadDebug('cycle', 'сброс состояния слайдов (повтор)', { reason });
        _lastCycleSlideKey = '';
        _lastCycleVideoSrc = '';
        lastActiveVideo = null;
        _stallNode = null;
        _grokDetectStartedAt = 0;
    }
    window.resetSlideTrackingState = resetSlideTrackingState;

    function startPhotoCountdown(initSec, why) {
        sessionStorage.removeItem('mossad_expected_type');
        countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
        isCountingDown = true;
        mossadDebug('cycle', 'фото: старт таймера', { why, sec: countdownSeconds });
        runPhotoTimer('photo-timer');
    }

    /** true — решение принято/перепроверка запланирована; <video> — продолжить общий путь видео с ним. */
    function grokDecideSlideMedia(initSec, retryCount) {
        const now = Date.now();
        if (retryCount === 0 || !_grokDetectStartedAt) _grokDetectStartedAt = now;
        const slideKey = slideKeyOf(location.href);
        const staleSrc = (_lastCycleSlideKey && slideKey !== _lastCycleSlideKey) ? _lastCycleVideoSrc : '';
        const d = grokDetectSlideMedia(staleSrc);
        const expectedRaw = sessionStorage.getItem('mossad_expected_type');
        const expected = expectedRaw === 'photo' ? 'image' : expectedRaw;
        // Окно отсчитываем от прибытия на пост (его фиксирует grokEndNav), а при загрузке страницы — от начала проверки
        const curUuid = grokExtractUuid(location.pathname);
        const arrived = (typeof _galleryNav !== 'undefined' && _galleryNav.arrivedAt && _galleryNav.arrivedAt <= _grokDetectStartedAt + 50 &&
                         now - _galleryNav.arrivedAt < 15000 && (!_galleryNav.targetUuid || _galleryNav.targetUuid === curUuid))
            ? _galleryNav.arrivedAt : _grokDetectStartedAt;
        const sinceArrival = now - arrived;
        const sinceStart = now - _grokDetectStartedAt;
        const again = () => {
            slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), GROK_DETECT_POLL_MS);
            return true;
        };

        if (d.video) {
            mossadDebug('cycle', 'Grok: видео найдено', { ms: sinceStart, expected });
            return d.video; // общий путь видео (ждёт duration, считает круги)
        }
        if (d.imageBtn) {
            startPhotoCountdown(initSec, 'кнопка «Удалить изображение»');
            return true;
        }
        // v1.3.43: «Make video» есть только у фото. Если сбор сказал «видео» — не верим кнопке
        // (ждём <video>, как ниже); иначе — фото сразу, без окна ожидания.
        if (d.makeVideoBtn && (!d.staleVideo || curImg) && expected !== 'video' && d.settled) {
            startPhotoCountdown(initSec, 'кнопка «Make video»');
            return true;
        }
        const curImg = !!(d.mainImg && curUuid && (d.mainImg.currentSrc || d.mainImg.src || '').toLowerCase().includes(curUuid));
        if (d.staleVideo && !curImg) {
            // На экране ещё ролик прошлого слайда: ждём смены (как в v1.3.38), затем — по признакам.
            // v1.3.43: если уже видна картинка именно этого поста — старый ролик не ждём.
            if (sinceStart < GROK_STALE_WAIT_MS) return again();
            if (expected === 'image' && d.mainImg) { startPhotoCountdown(initSec, 'старое видео не сменилось, сбор: фото'); return true; }
            return d.staleVideo; // как раньше: принимаем ролик как видео этого слайда
        }
        if (expected === 'video' || d.soundBtn) {
            // Плеер монтируется: ждём <video>. Сбор «видео» — до 6 с (HLS бывает медленным);
            // одна кнопка звука без подтверждения сбором — до 3 с.
            const cap = expected === 'video' ? GROK_VIDEO_WAIT_MS : GROK_STALE_WAIT_MS;
            if (sinceStart < cap) {
                if (expected === 'video' && retryCount > 0 && retryCount % 10 === 0) {
                    showToast(`⏳ Загрузка видео-плеера... (${Math.floor(sinceStart / 1000)}/${cap / 1000}с)`);
                }
                return again();
            }
            mossadDebug('cycle', 'Grok: видео так и не появилось — считаем фото', { ms: sinceStart, expected, soundBtn: !!d.soundBtn });
            startPhotoCountdown(initSec, 'нет <video> за ' + cap + ' мс');
            return true;
        }
        // Нет ни видео, ни кнопки звука → фото, как только страница устоялась и прошло окно
        const grace = expected === 'image' ? GROK_PHOTO_GRACE_MS : GROK_UNKNOWN_GRACE_MS;
        if (!d.settled && sinceStart < GROK_STALE_WAIT_MS) return again();
        if (!d.mainImg && sinceStart < GROK_UNKNOWN_GRACE_MS * 2) return again(); // картинка ещё не отрисовалась
        if (sinceArrival < grace || sinceStart < 100) return again();
        mossadDebug('cycle', 'Grok: фото определено', { ms: sinceStart, sinceArrival, expected, img: !!d.mainImg });
        startPhotoCountdown(initSec, 'нет <video> и кнопки звука');
        return true;
    }

    function checkVideoLoops(timeNow) {
        rafId = null;
        if (!slideshowActive || slideshowPaused) return;
        if (!currentVideoNode || !document.body.contains(currentVideoNode)) {
            // v1.3.38: элемент перемонтирован — пробуем перепривязаться к новому <video> без сброса счётчика
            const replacement = getActiveVideo();
            if (currentVideoNode && replacement && replacement !== currentVideoNode) {
                rebindVideoNode(replacement, 'detached');
                if (!rafId) rafId = requestAnimationFrame(checkVideoLoops);
                return;
            }
            if (!_videoDetachedSince) _videoDetachedSince = timeNow || performance.now();
            if ((timeNow || performance.now()) - _videoDetachedSince < 2000) {
                rafId = requestAnimationFrame(checkVideoLoops);
                return;
            }
            mossadDebug('cycle', 'видео исчезло >2с — перезапуск цикла');
            scheduleNextSlideCycle(0); // Видео исчезло надолго, перезапуск логики
            return;
        }
        _videoDetachedSince = 0;

        // v1.3.43: «замёрзшее» видео на Grok (время не идёт > GROK_STALL_MS — на паузе не по воле
        // пользователя или без данных). После повтора круга Grok держал в DOM старый элемент того же
        // поста; счётчик кругов смотрел на него, таймер стоял на 1 с. Порядок восстановления:
        // перепривязка к лучшему <video>; если другого нет и ролик НЕ на паузе (застрял) — play(),
        // через GROK_STALL_SKIP_MS — следующий слайд. На паузе без другого ролика — ждём (пауза пользователя).
        if (rootDomain === 'grok.com') {
            const nowS = timeNow || performance.now();
            const ctS = currentVideoNode.currentTime;
            if (_stallNode !== currentVideoNode || Math.abs(ctS - _stallCt) > 0.01) {
                _stallNode = currentVideoNode; _stallCt = ctS; _stallSince = nowS; _stallLastFix = 0;
            } else if (!currentVideoNode._mossadUserPaused && nowS - _stallSince > GROK_STALL_MS && nowS - _stallLastFix > 700) {
                _stallLastFix = nowS;
                const act = getActiveVideo();
                if (act && act !== currentVideoNode) {
                    mossadDebug('loop', 'видео стоит — перепривязка к другому <video>', { ms: Math.round(nowS - _stallSince), paused: currentVideoNode.paused });
                    rebindVideoNode(act, 'stall');
                    if (!rafId) rafId = requestAnimationFrame(checkVideoLoops);
                    return;
                }
                // На паузе и другого видео нет — это, скорее всего, пауза пользователя (клик по ролику): ждём, как раньше
                if (currentVideoNode.paused) { /* ждём */ }
                else if (nowS - _stallSince > GROK_STALL_SKIP_MS) {
                    mossadDebug('loop', 'видео стоит слишком долго — следующий слайд', { ms: Math.round(nowS - _stallSince) });
                    _stallNode = null;
                    triggerNextSlide('video-stall');
                    return;
                }
                else {
                    mossadDebug('loop', 'видео стоит (не на паузе) — play()', { ms: Math.round(nowS - _stallSince) });
                    try { currentVideoNode.play().catch(() => {}); } catch (e) {}
                }
            }
        }

        // Если видео на паузе: либо пользователь поставил паузу (ждём), либо мы следим не за тем элементом
        if (currentVideoNode.paused) {
            const now = timeNow || performance.now();
            if (rootDomain === 'grok.com' && now - _lastRebindCheck > 500) {
                _lastRebindCheck = now;
                const act = getActiveVideo();
                if (act && act !== currentVideoNode && !act.paused) {
                    rebindVideoNode(act, 'paused-other-playing');
                    if (rafId) return; // rebind уже запланировал следующий кадр
                }
            }
            lastRAFTime = timeNow;
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const ct = currentVideoNode.currentTime;
        const effDuration = liveVideoDuration(currentVideoNode);

        if (effDuration <= 0) {
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const isEnded = !!currentVideoNode.ended;
        if (!isEnded) _endedConsumed = false;

        // Финальная зона ролика (последние 0.45с либо нативное событие ended)
        const isAtEnd = isEnded || (ct >= Math.max(0.5, effDuration - 0.45));
        if (isAtEnd) {
            _videoReachedEndZone = true;
        }

        // Завершение одного цикла/круга видео
        let loopCompleted = false;
        if (isEnded && !_endedConsumed) {
            loopCompleted = true;
            _endedConsumed = true; // ended остаётся true до следующего play() — засчитываем один раз
        } else if (!isEnded && _videoReachedEndZone && ct < 1.0 && ct < lastTime) {
            // Видео было в финальной зоне и зациклилось на начало (время реально «откатилось» на этом же
            // элементе; v1.3.38: без ct < lastTime короткие ролики <1.45 с засчитывали круг прямо в финальной зоне)
            loopCompleted = true;
        } else if (rootDomain.includes('pinterest.') && config.pinterestMaxVideoDuration > 0 && ct >= config.pinterestMaxVideoDuration) {
            // Pinterest лимит длительности
            loopCompleted = true;
        }

        if (loopCompleted) {
            currentLoopCount++;
            _videoReachedEndZone = false;
            lastTime = ct;
            mossadDebug('loop', `круг видео ${currentLoopCount}/${config.videoLoops}`, { ended: isEnded });
            if (currentLoopCount >= config.videoLoops) {
                // Все круги завершены: запускаем паузу после видео
                countdownSeconds = config.delayAfterVideo;
                mossadDebug('loop', 'все круги видео завершены', { loops: currentLoopCount, need: config.videoLoops });
                if (countdownSeconds > 0) {
                    isCountingDown = true;
                    runPhotoTimer('video-loops-done');
                } else {
                    triggerNextSlide('video-loops-done');
                }
                return;
            }
            if (isEnded) {
                // Незацикленный ролик: запускаем следующий круг сами
                try { currentVideoNode.currentTime = 0; currentVideoNode.play().catch(() => {}); } catch(e) {}
            }
        }

        lastTime = ct;
        lastRAFTime = timeNow;
        rafId = requestAnimationFrame(checkVideoLoops);
    }

    function runPhotoTimer(reason = 'photo-timer') {
        if (!slideshowActive || slideshowPaused) return;
        if (countdownSeconds <= 0) {
            isCountingDown = false;
            triggerNextSlide(reason);
            return;
        }
        slideshowTimeoutId = setTimeout(() => {
            countdownSeconds--;
            runPhotoTimer(reason);
        }, 1000);
    }

    // ============================================
    // TAB SWITCH & BROWSER FOCUS LISTENERS (Tab / Brsr)
    // ============================================
    let _pausedByTab = false;
    let _pausedByBrsr = false;

    function pauseAllSlideshows(reason) {
        if (window._mossadNavigating ||
            sessionStorage.getItem('mossad_navigating_group') === 'true' ||
            sessionStorage.getItem(SESSION_NAV_KEY) === 'true') {
            return; // Не ставить на паузу при автоматическом переходе между группами / слайдами
        }
        let anyPaused = false;
        if (slideshowActive && !slideshowPaused) {
            slideshowPaused = true;
            cancelSlideTimers();
            anyPaused = true;
        }
        if (window._mossadGalleryActive && !window._mossadGalleryPaused) {
            window._mossadGalleryPaused = true;
            updateGalleryStatusBtn('paused');
            anyPaused = true;
        }
        if (anyPaused) {
            if (reason === 'tab') _pausedByTab = true;
            if (reason === 'brsr') _pausedByBrsr = true;
            if (window.updateWidgetUI) window.updateWidgetUI();
        }
    }

    function resumeAllSlideshows(reason) {
        if (reason === 'tab' && _pausedByTab) {
            _pausedByTab = false;
            if (_pausedByBrsr) return;
        } else if (reason === 'brsr' && _pausedByBrsr) {
            _pausedByBrsr = false;
            if (_pausedByTab) return;
        } else {
            return;
        }

        // Если пауза была установлена пользователем вручную — не снимаем
        const manualPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' || sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';
        if (manualPaused) return;

        if (slideshowActive) {
            slideshowPaused = false;
            requestSlideCycle(0, 'resume:' + reason);
        }
        if (window._mossadGalleryActive) {
            window._mossadGalleryPaused = false;
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            requestSlideCycle(0, 'resume:' + reason);
        }
        if (window.updateWidgetUI) window.updateWidgetUI();
    }

    window.addEventListener('beforeunload', () => {
        window._mossadNavigating = true;
    });
    window.addEventListener('pagehide', () => {
        window._mossadNavigating = true;
    });

    document.addEventListener('visibilitychange', () => {
        if (!config.stopOnTabSwitch) return;
        if (document.hidden) {
            pauseAllSlideshows('tab');
        } else {
            resumeAllSlideshows('tab');
        }
    });

    window.addEventListener('blur', () => {
        if (!config.stopOnBrsrSwitch) return;
        pauseAllSlideshows('brsr');
    });

    window.addEventListener('focus', () => {
        if (!config.stopOnBrsrSwitch) return;
        resumeAllSlideshows('brsr');
    });

// ============================================
    // PINTEREST ENGINE & AUTO FULLSCALE
    // ============================================
    function clickElementFull(el) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
            try {
                el.dispatchEvent(new MouseEvent(evtType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                }));
            } catch (e) {}
        });
        if (typeof el.click === 'function') {
            try { el.click(); } catch(e) {}
        }
    }

    function triggerPinterestFullScale() {
        if (!rootDomain.includes('pinterest.') || !config.pinterestAutoFS) return;
        
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            let btn = document.querySelector('[aria-label="Показать в полном масштабе"], [title="Показать в полном масштабе"], [aria-label*="полном масштабе"]');
            if (!btn) {
                const svg = document.querySelector('svg[aria-label*="полном масштабе"]');
                if (svg) btn = svg.closest('[role="button"]') || svg.closest('button') || svg;
            }
            
            if (btn) {
                clickElementFull(btn);
                console.log('%c[MOSSAD] Auto FullScale clicked target element', 'color:#3b82f6;', btn);
                clearInterval(interval);
            } else if (attempts >= 25) { // Ожидание до 5 секунд (25 x 200ms)
                clearInterval(interval);
            }
        }, 200);
    }

    // ── v1.3.51: главный пин отделяем от «Похожих пинов» ──
    // Раньше тип и видео искались по всему документу (первый <video>, regex по innerHTML всей страницы):
    // превью похожего пина делало фото-пин «видео», а сериализация всего DOM повторялась до 60 раз за слайд.
    // ⚠️ Живые данные (ru.pinterest.com, 10.2026): ГЛАВНЫЙ <video> тоже лежит внутри [data-grid-item]!
    // Различаем по elementtiming: главный — 'closeup-video-main-MainPinImage' (^closeup / MainPinImage),
    // похожие — 'gestalt-video'. Сетка — только запасной признак. Без innerHTML. ANTI_PATTERNS §30.
    const PIN_GRID_SEL = '[data-grid-item], [data-test-id="pin-card"], [data-test-id="related-pins"], [data-test-id="relatedPins"], [data-test-id="search-feed"]';
    const PIN_CLOSEUP_SEL = '[data-test-id="closeup-body"], [data-test-id="pin-closeup"], [data-test-id="closeup-stage"], [data-test-id="story-pin-closeup-container"], [data-test-id="visual-content-container"], [data-test-id="closeup-image"]';
    const PIN_VIDEO_SIGNS_SEL = 'video, [data-test-id*="video"], [data-test-id*="duplo-hls"], [data-test-id*="story-pin"], [data-test-id*="idea-pin"], button[aria-label*="звук"], button[aria-label*="Sound"], button[aria-label*="sound"], button[aria-label*="Unmute"], button[aria-label*="Mute"], .SoundButton';
    const PIN_MAIN_MARK_SEL = '[elementtiming^="closeup"], [elementtiming*="MainPinImage"]';
    const PIN_MAIN_SEL = PIN_MAIN_MARK_SEL + ', ' + PIN_CLOSEUP_SEL;
    const PIN_RELATED_SEL = '[data-test-id="relatedPins"], [data-test-id="related-pins"], [data-test-id="closeup-related-pins"]';
    const PIN_SEQ_SS_KEY = 'mossad_pin_seq';    // счётчик режима «+1» (переживает переход на следующий пин)
    const PIN_DEAD_SS_KEY = 'mossad_pin_dead';  // пины без похожих (тупики) — не выбирать снова
    const PIN_WAIT_MS = 15000;                  // ждать появления похожих пинов не дольше
    const PIN_POLL_MS = 250;
    const PIN_MAX_CANDIDATES = 30;

    function pinterestCurrentPinId(path) {
        const m = String(path || location.pathname).match(/\/pin\/(\d+)/);
        return m ? m[1] : '';
    }
    function pinIsOwnUi(el) {
        return !!(el && el.closest && el.closest('[id^="mossad"]'));
    }
    /**
     * Элемент относится к похожему пину (не к главному)?
     * 1) elementtiming ^closeup / MainPinImage — главный; ^gestalt — похожий.
     * 2) Без сетки вокруг — главный.
     * 3) Ближайший контейнер главного (closeup) СОДЕРЖИТ ячейку сетки — ячейка вложена в closeup → похожий;
     *    наоборот (closeup внутри ячейки, как на живом Pinterest) — главный.
     */
    function pinIsRelated(el) {
        if (!el || !el.closest) return false;
        if (pinIsOwnUi(el)) return true;
        const et = (el.getAttribute && el.getAttribute('elementtiming')) || '';
        if (/^closeup|MainPinImage/i.test(et)) return false;
        if (/^gestalt/i.test(et)) return true;
        const g = el.closest(PIN_GRID_SEL);
        if (!g) return false;
        const c = el.closest(PIN_MAIN_SEL);
        if (!c) return true;
        return c !== g && c.contains(g);
    }
    function pinterestCloseupRoots() {
        return Array.from(document.querySelectorAll(PIN_CLOSEUP_SEL)).filter(el => !pinIsRelated(el));
    }
    /** <video> главного пина: внутри closeup, иначе любой не из сетки (самый крупный). */
    function pinterestMainVideo() {
        const marked = document.querySelector('video[elementtiming^="closeup"], video[elementtiming*="MainPinImage"]');
        if (marked && !pinIsOwnUi(marked)) return marked;
        const vids = Array.from(document.querySelectorAll('video')).filter(v => !pinIsRelated(v));
        if (!vids.length) return null;
        const roots = pinterestCloseupRoots();
        const inRoot = vids.find(v => roots.some(r => r.contains(v)));
        if (inRoot) return inRoot;
        if (vids.length === 1) return vids[0];
        let best = vids[0], max = -1;
        for (const v of vids) {
            const r = v.getBoundingClientRect();
            const a = Math.max(0, r.width) * Math.max(0, r.height);
            if (a > max) { max = a; best = v; }
        }
        return best;
    }
    const _pinSmallImgRe = /\/(?:\d{2,3}x\d{2,3}_RS|30x30|60x60|75x75|140x140)\//i;
    /** Картинка главного пина: в closeup, иначе самая крупная pinimg-картинка не из сетки (аватарки пропускаем). */
    function pinterestMainImage() {
        const ok = (i) => {
            const src = i.currentSrc || i.src || '';
            return /pinimg\.com/.test(src) && !_pinSmallImgRe.test(src) && !pinIsRelated(i);
        };
        const marked = Array.from(document.querySelectorAll('img[elementtiming^="closeup"], img[elementtiming*="MainPinImage"]')).find(i => !pinIsOwnUi(i));
        if (marked) return marked;
        for (const r of pinterestCloseupRoots()) {
            const img = Array.from(r.querySelectorAll('img')).find(ok);
            if (img) return img;
        }
        let best = null, max = 0;
        for (const i of document.querySelectorAll('img')) {
            if (!ok(i)) continue;
            const r = i.getBoundingClientRect();
            const a = (r.width * r.height) || ((parseInt(i.getAttribute('width'), 10) || 0) * (parseInt(i.getAttribute('height'), 10) || 0)) || 1;
            if (a > max) { max = a; best = i; }
        }
        return best;
    }
    /** Признаки видео у ГЛАВНОГО пина (плеер, кнопка звука) — без сетки и без виджета MOSSAD. */
    function pinterestHasVideoSigns() {
        const roots = pinterestCloseupRoots();
        const pool = roots.length
            ? roots.flatMap(r => Array.from(r.querySelectorAll(PIN_VIDEO_SIGNS_SEL)))
            : Array.from(document.querySelectorAll(PIN_VIDEO_SIGNS_SEL));
        return pool.some(el => !pinIsRelated(el));
    }

    // Кэш типа текущего пина (по id): решение «фото» принимает движок слайдшоу, «видео» — найденный <video>
    let _pinMediaCache = { pinId: '', type: '', bestMp4Url: null };
    function pinterestRememberType(type, bestMp4Url) {
        const id = pinterestCurrentPinId();
        if (!id) return;
        _pinMediaCache = { pinId: id, type, bestMp4Url: bestMp4Url || (_pinMediaCache.pinId === id ? _pinMediaCache.bestMp4Url : null) };
    }
    function pinterestMp4FromSrc(src) {
        if (!src) return null;
        const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                         src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
        if (sigMatch) {
            const sig = sigMatch[4];
            return `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
        }
        return /\.mp4(\?|$)/i.test(src) && !src.startsWith('blob:') ? src : null;
    }

    function getPinterestMainPinData() {
        try {
            const id = pinterestCurrentPinId();
            const v = pinterestMainVideo();
            if (v) {
                const srcEl = v.querySelector('source');
                const url = pinterestMp4FromSrc(v.currentSrc || v.src || (srcEl && srcEl.src) || '');
                pinterestRememberType('video', url);
                return { isFound: true, type: 'video', bestMp4Url: _pinMediaCache.bestMp4Url };
            }
            if (pinterestHasVideoSigns()) return { isFound: true, type: 'video', bestMp4Url: null };
            if (id && _pinMediaCache.pinId === id && (_pinMediaCache.type === 'video' || _pinMediaCache.type === 'image')) {
                return { isFound: true, type: _pinMediaCache.type, bestMp4Url: _pinMediaCache.bestMp4Url };
            }
        } catch (e) {
            console.error('[MOSSAD] Pinterest main pin detect error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
    }

    function getPinterestCandidatePins() {
        const currentPinId = pinterestCurrentPinId();
        const allLinks = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
        const candidates = [];

        for (const a of allLinks) {
            if (pinIsOwnUi(a)) continue;
            const href = a.getAttribute('href') || '';
            const match = href.match(/\/pin\/(\d+)/);
            if (match) {
                const pinId = match[1];
                if (pinId !== currentPinId && !candidates.some(c => c.pinId === pinId)) {
                    const container = a.closest('div[data-grid-item], div[role="listitem"]') || a.parentElement || a;
                    const hasVideo = !!container.querySelector('video, [aria-label*="video"], [aria-label*="видео"], .SoundButton') ||
                                     /\d+:\d{2}/.test(container.textContent || '');
                    candidates.push({
                        pinId,
                        url: new URL(href, location.origin).href,
                        type: hasVideo ? 'video' : 'image',
                        element: a
                    });
                }
            }
        }
        return candidates;
    }

    function navigatePinterestUrl(url) {
        window._mossadNavigating = true;
        const isPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                         sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';
        if (!isPaused) {
            sessionStorage.setItem('mossad_navigating', 'true');
            sessionStorage.removeItem(SESSION_PAUSED_KEY);
        }
        window.location.href = url;
    }

    /** v1.3.51: история пинов — только в localStorage сайта: без перерисовки меню и без синхронизации с GitHub. */
    function pinterestSaveHistory() {
        try { persistLocalConfig(); } catch (e) {}
    }
    function _pinReadDead() {
        try { const a = JSON.parse(sessionStorage.getItem(PIN_DEAD_SS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    function _pinMarkDead(pinId) {
        if (!pinId) return;
        const a = _pinReadDead().filter(x => x !== pinId);
        a.push(pinId);
        try { sessionStorage.setItem(PIN_DEAD_SS_KEY, JSON.stringify(a.slice(-50))); } catch (e) {}
    }
    /** Направление малого слайдшоу на Pinterest: ▶ вперёд (новые пины, по умолчанию) или ◀ назад по истории. */
    function pinterestSlideDir() {
        return config.pinterestDir === 'back' ? 'prev' : 'next';
    }
    function pinterestModeIsNumber(mode) {
        return /^\d+$/.test(String(mode == null ? '' : mode));
    }

    /**
     * Выбор следующего пина из похожих. Пропускаются тупики (_pinMarkDead) и, если есть из чего выбрать,
     * недавно посещённые (иначе «№ 3» мог ходить по кругу A → B → A).
     */
    function pinterestChooseCandidate(candidates) {
        const dead = new Set(_pinReadDead());
        const hist = Array.isArray(config.pinterestHistory) ? config.pinterestHistory : [];
        const visited = new Set(hist.slice(-30).map(u => pinterestCurrentPinId(u)).filter(Boolean));
        let pool = candidates.filter(c => !dead.has(c.pinId));
        const fresh = pool.filter(c => !visited.has(c.pinId));
        if (fresh.length) pool = fresh;
        if (!pool.length) pool = candidates;

        let filtered = [];
        const filterType = config.pinterestFilterType || 'ratio';
        if (filterType === 'image') {
            filtered = pool.filter(c => c.type === 'image');
        } else if (filterType === 'video') {
            filtered = pool.filter(c => c.type === 'video');
        } else if (filterType === 'ratio') {
            const photoPercent = config.pinterestPhotoPercent ?? 50;
            const targetType = (Math.random() * 100) < photoPercent ? 'image' : 'video';
            filtered = pool.filter(c => c.type === targetType);
            if (filtered.length === 0) filtered = pool.filter(c => c.type !== targetType);
        } else {
            filtered = pool; // 'all'
        }
        if (filtered.length === 0) filtered = pool;

        const maxCandidates = filtered.slice(0, PIN_MAX_CANDIDATES);
        if (!maxCandidates.length) return null;
        let targetIndex = 0;
        const mode = config.pinterestMode || 'rand';
        if (mode === '+1') {
            // v1.3.51: счётчик в sessionStorage (раньше window._pinSeqIndex обнулялся на каждой странице → всегда 2-й пин)
            const prev = parseInt(sessionStorage.getItem(PIN_SEQ_SS_KEY), 10);
            const next = isNaN(prev) ? 0 : prev + 1;
            targetIndex = next % maxCandidates.length;
            try { sessionStorage.setItem(PIN_SEQ_SS_KEY, String(next % PIN_MAX_CANDIDATES)); } catch (e) {}
        } else if (pinterestModeIsNumber(mode)) {
            const num = parseInt(mode, 10) || 1;
            targetIndex = Math.min(Math.max(0, num - 1), maxCandidates.length - 1);
        } else {
            targetIndex = Math.floor(Math.random() * maxCandidates.length);
        }
        return { target: maxCandidates[targetIndex], index: targetIndex };
    }

    function pinterestScrollToRelated() {
        const rel = document.querySelector(PIN_RELATED_SEL) || document.querySelector('[data-grid-item]');
        try {
            if (rel && typeof rel.scrollIntoView === 'function') rel.scrollIntoView({ block: 'start', behavior: 'instant' });
            else window.scrollBy({ top: Math.max(300, window.innerHeight || 600), behavior: 'instant' });
        } catch (e) {}
    }

    let _pinWaitTimer = null;
    function pinterestCancelWait() {
        if (_pinWaitTimer) { clearTimeout(_pinWaitTimer); _pinWaitTimer = null; }
    }
    window.pinterestCancelWait = pinterestCancelWait;

    function _pinGoToHistory(idx, toastMsg) {
        config.pinterestHistoryIdx = idx;
        pinterestSaveHistory();
        if (toastMsg) showToast(toastMsg);
        navigatePinterestUrl(config.pinterestHistory[idx]);
    }

    /**
     * v1.3.51: ждём похожие пины (они подгружаются лениво) — опрос каждые 250 мс до 15 с, с прокруткой к ним.
     * Не нашлись: этот пин — тупик, шаг назад по истории (там выберется другая ветка). Слайдшоу само НЕ останавливается.
     */
    function _pinterestPickAndGo(fromSlideshow) {
        pinterestCancelWait();
        const startHref = location.href;
        const t0 = Date.now();
        let scrolled = false, waitToast = false;
        const tick = () => {
            _pinWaitTimer = null;
            if (location.href !== startHref) return;
            if (fromSlideshow && (!slideshowActive || slideshowPaused)) return;
            const picked = pinterestChooseCandidate(getPinterestCandidatePins());
            if (picked && picked.target) {
                const target = picked.target;
                sessionStorage.setItem('mossad_expected_type', target.type);
                const hi = config.pinterestHistoryIdx ?? (config.pinterestHistory.length - 1);
                config.pinterestHistory = config.pinterestHistory.slice(0, hi + 1); // свернули на новый путь — хвост впереди отрезаем
                config.pinterestHistory.push(target.url);
                if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
                config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
                pinterestSaveHistory();
                showToast(`📌 Новый пин #${picked.index + 1} (${target.type === 'video' ? '🎬 Видео' : '🖼 Фото'})`);
                navigatePinterestUrl(target.url);
                return;
            }
            const waited = Date.now() - t0;
            if (waited >= PIN_WAIT_MS) {
                _pinMarkDead(pinterestCurrentPinId());
                const idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;
                if (idx > 0) {
                    _pinGoToHistory(idx - 1, '↩ Похожих пинов нет — шаг назад, другая ветка');
                    return;
                }
                showToast('⚠️ Похожих пинов нет, истории нет — жду дальше', true);
                if (!fromSlideshow) return; // ручной шаг: просто сообщаем
                _pinterestPickAndGo(true); // слайдшоу не останавливаем
                return;
            }
            if (!scrolled) { scrolled = true; pinterestScrollToRelated(); }
            if (!waitToast && waited >= 1000) { waitToast = true; showToast('⏳ Жду похожие пины…'); }
            _pinWaitTimer = setTimeout(tick, PIN_POLL_MS);
        };
        tick();
    }

    /**
     * Следующий / предыдущий пин.
     * options.isManual — ручной шаг (стрелки): вперёд сначала идём по истории, если мы не на её вершине.
     * options.fromSlideshow — шаг слайдшоу: в начале истории («назад») не стоим, а идём вперёд по новым пинам.
     */
    function selectNextPinterestPin(direction, options = {}) {
        const isManual = options.isManual || false;
        const fromSlideshow = options.fromSlideshow || false;
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        let idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;

        if (direction === 'prev') {
            if (idx > 0) {
                idx--;
                _pinGoToHistory(idx, `◀ Назад по истории (${idx + 1}/${config.pinterestHistory.length})`);
                return true;
            }
            if (!fromSlideshow) {
                showToast('⚠️ Вы в самом начале истории просмотров', true);
                return false;
            }
            // v1.3.51: слайдшоу в начале истории не останавливается — дальше вперёд по новым пинам
            showToast('⏮ Начало истории — дальше вперёд по новым пинам');
        }

        // Ручной шаг вперёд НЕ на вершине истории: идём вперёд по истории (как в Проводнике)
        if (direction !== 'prev' && isManual && idx >= 0 && idx < config.pinterestHistory.length - 1) {
            idx++;
            _pinGoToHistory(idx, `▶ Вперед по истории (${idx + 1}/${config.pinterestHistory.length})`);
            return true;
        }

        // Новый пин: текущий — в историю (если его там нет на вершине)
        const hist = config.pinterestHistory;
        const curIdxOk = idx >= 0 && idx < hist.length && hist[idx] === location.href;
        if (!curIdxOk) {
            if (hist.length === 0 || hist[hist.length - 1] !== location.href) {
                hist.push(location.href);
                if (hist.length > 100) hist.shift();
            }
            config.pinterestHistoryIdx = hist.length - 1;
            pinterestSaveHistory();
        }
        _pinterestPickAndGo(fromSlideshow);
        return true;
    }

    // ── v1.3.52: СКАЧИВАНИЕ на Pinterest — данные пина из PinResource API (same-origin) ──
    // История поломки: v1.2.19 (6b460fd) — ранний возврат «видео без ссылки» по blob-src плеера (JSON уже не
    // смотрели); v1.2.22 (1b8a255) — фолбэк на первое `div[role=main] img` (это картинка ПОХОЖЕГО пина).
    // Правка v1.3.21 была сделана только в бандле и потерялась при сборке из src/. ANTI_PATTERNS §31.
    // Порядок: (1) API пина (кэш по id) → хеш HLS → expMp4 _720w, запасной _360w; (2) хеш из poster/
    // data-video-signature главного <video>; (3) видео-пин без ссылки — «видео не найдено», НИКОГДА не фото;
    // фото — images.orig из API, иначе только картинка главного пина (closeup / MainPinImage).
    const PIN_API_TIMEOUT_MS = 7000;
    const PIN_API_CACHE_MAX = 30;
    const _pinApiCache = new Map(); // id → Promise<info|null>
    const _pinApiDone = new Map();  // id → info|null (уже полученные — для синхронных проверок слайдшоу)

    /** Хеш ролика (32 hex + путь aa/bb/cc) из ссылки HLS / expMp4 / превью videos/thumbnails. */
    function pinterestVideoHashFromUrl(url) {
        const m = String(url || '').match(/\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})(?:[._]|$)/i);
        if (!m) return null;
        if (!/videos\//i.test(url) && !/\.m3u8|expMp4|thumbnails/i.test(url)) return null;
        return m[4].toLowerCase();
    }
    /** Рабочие ссылки на mp4 по хешу (проверено 10.2026: _720w / _360w = 200 video/mp4 со звуком; mc/720p, _t1.._t4, _1080w, _480w = 403). */
    function pinterestMp4UrlsFromHash(hash) {
        if (!hash || hash.length !== 32) return [];
        const p = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4, 6)}/${hash}`;
        return [`https://v1.pinimg.com/videos/iht/expMp4/${p}_720w.mp4`, `https://v1.pinimg.com/videos/iht/expMp4/${p}_360w.mp4`];
    }
    function _pinCollectVideoLists(d) {
        const lists = [];
        const add = (v) => { if (v && v.video_list && typeof v.video_list === 'object') lists.push(v.video_list); };
        add(d && d.videos);
        add(d && d.video);
        const pages = (d && d.story_pin_data && Array.isArray(d.story_pin_data.pages)) ? d.story_pin_data.pages : [];
        for (const pg of pages) {
            add(pg && pg.video);
            const blocks = (pg && Array.isArray(pg.blocks)) ? pg.blocks : [];
            for (const b of blocks) add(b && b.video);
        }
        return lists;
    }
    /** Компактная сводка пина из ответа API (весь JSON не храним). */
    function pinterestParsePinData(d) {
        if (!d || typeof d !== 'object') return null;
        const info = { isVideo: false, mp4Urls: [], hash: null, durationMs: 0, imageUrl: '', desc: '' };
        const direct = [];
        for (const list of _pinCollectVideoLists(d)) {
            for (const k of Object.keys(list)) {
                const e = list[k];
                if (!e || !e.url) continue;
                info.isVideo = true;
                if (!info.durationMs && e.duration) info.durationMs = Number(e.duration) || 0;
                if (/\.mp4(\?|$)/i.test(e.url)) direct.push({ url: e.url, w: e.width || 0 });
                if (!info.hash) info.hash = pinterestVideoHashFromUrl(e.url);
            }
        }
        const byHash = pinterestMp4UrlsFromHash(info.hash);
        direct.sort((a, b) => b.w - a.w);
        info.mp4Urls = Array.from(new Set([...byHash, ...direct.map(x => x.url)]));
        const im = d.images || {};
        info.imageUrl = (im.orig && im.orig.url) || (im.originals && im.originals.url) || (im['736x'] && im['736x'].url) || '';
        const txt = [d.title, d.grid_title, d.description, d.closeup_unified_description].find(x => typeof x === 'string' && x.trim());
        info.desc = txt ? txt.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
        return info;
    }
    /** Один запрос на пин (кэш промисов, до 30 пинов), таймаут 7 с; ошибка → null. */
    function pinterestFetchPinInfo(pinId) {
        if (!pinId) return Promise.resolve(null);
        if (_pinApiCache.has(pinId)) return _pinApiCache.get(pinId);
        const p = (async () => {
            if (typeof fetch !== 'function') return null;
            const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
            const t = ctrl ? setTimeout(() => ctrl.abort(), PIN_API_TIMEOUT_MS) : null;
            try {
                const q = new URLSearchParams({
                    source_url: `/pin/${pinId}/`,
                    data: JSON.stringify({ options: { id: String(pinId), field_set_key: 'detailed' }, context: {} })
                });
                const res = await fetch(`/resource/PinResource/get/?${q}`, {
                    credentials: 'same-origin',
                    headers: { 'X-Pinterest-PWS-Handler': 'www/pin/[id].js', 'Accept': 'application/json' },
                    signal: ctrl ? ctrl.signal : undefined
                });
                if (!res.ok) return null;
                const json = await res.json();
                return pinterestParsePinData(json && json.resource_response && json.resource_response.data);
            } catch (e) {
                console.warn('[MOSSAD] PinResource API недоступен:', e && e.message);
                return null;
            } finally {
                if (t) clearTimeout(t);
            }
        })().then(info => { _pinApiDone.set(pinId, info); return info; });
        _pinApiCache.set(pinId, p);
        while (_pinApiCache.size > PIN_API_CACHE_MAX) {
            const k = _pinApiCache.keys().next().value;
            _pinApiCache.delete(k);
            _pinApiDone.delete(k);
        }
        return p;
    }
    /** Уже полученная сводка текущего пина (синхронно; undefined — ещё не запрашивали/не пришла). */
    function pinterestCachedPinInfo(pinId) {
        const id = pinId || pinterestCurrentPinId();
        return _pinApiDone.has(id) ? _pinApiDone.get(id) : undefined;
    }
    window.pinterestFetchPinInfo = pinterestFetchPinInfo;

    /** Хеш ролика главного пина из DOM: poster главного <video> или ближайший [data-video-signature]. */
    function pinterestVideoHashFromDom() {
        const v = pinterestMainVideo();
        if (!v) return null;
        const sigEl = v.closest('[data-video-signature]') || v.querySelector('[data-video-signature]');
        const sig = sigEl ? (sigEl.getAttribute('data-video-signature') || '') : '';
        if (/^[a-f0-9]{32}$/i.test(sig)) return sig.toLowerCase();
        const srcEl = v.querySelector('source');
        for (const u of [v.getAttribute('poster'), v.currentSrc, v.src, srcEl && srcEl.src]) {
            const h = pinterestVideoHashFromUrl(u || '');
            if (h) return h;
        }
        return null;
    }
    function _pinOriginalsUrl(src) {
        return String(src || '').replace(/\/(?:\d{2,4}x(?:\d{2,4})?(?:_RS)?)\//, '/originals/');
    }

    /**
     * Что качать на текущем пине. → { urls, type: 'video'|'photo', desc } | { error: 'video-not-found' } | null.
     * API ответил — доверяем ему (видео/фото); API недоступен — только DOM главного пина.
     */
    async function pinterestResolveMedia() {
        const id = pinterestCurrentPinId();
        const info = id ? await pinterestFetchPinInfo(id) : null;
        const domHash = pinterestVideoHashFromDom();
        if (info) {
            if (info.isVideo) {
                const urls = Array.from(new Set([...info.mp4Urls, ...pinterestMp4UrlsFromHash(domHash)]));
                if (urls.length) return { urls, type: 'video', desc: info.desc };
                return { error: 'video-not-found' };
            }
            if (info.imageUrl) return { urls: [info.imageUrl], type: 'photo', desc: info.desc };
        }
        if (domHash) return { urls: pinterestMp4UrlsFromHash(domHash), type: 'video', desc: info ? info.desc : '' };
        const v = pinterestMainVideo();
        if (v) {
            const direct = pinterestMp4FromSrc(v.currentSrc || v.src || '');
            if (direct) return { urls: [direct], type: 'video' };
        }
        if (v || pinterestHasVideoSigns()) return { error: 'video-not-found' };
        const img = pinterestMainImage();
        if (img) {
            const src = img.currentSrc || img.src;
            return { urls: Array.from(new Set([_pinOriginalsUrl(src), src])), type: 'photo', desc: info ? info.desc : '' };
        }
        return null;
    }

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
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 12px; min-width: 80px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 2px;`;

        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        mossadLabelEl(btnStart, 'start');
        btnStart.title = 'Старт слайдшоу (Insert)';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 4px 8px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;

        const btnDL = document.createElement('button');
        mossadLabelEl(btnDL, 'download');
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 13px; padding: 4px 7px;`;

        const btnUpdate = document.createElement('button');
        mossadLabelEl(btnUpdate, 'update');
        btnUpdate.title = 'Обновить скрипт (Win+Alt+R)';
        btnUpdate.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #60a5fa; cursor: pointer; font-size: 13px; padding: 4px 7px; transition: transform 0.2s ease;`;
        btnUpdate.onclick = () => {
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        };

        const btnTogglePanel = document.createElement('button');
        btnTogglePanel.id = 'mossad-btn-toggle-panel';
        mossadLabelEl(btnTogglePanel, 'togglePanel');
        btnTogglePanel.title = 'Меню настроек';
        btnTogglePanel.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 12px; padding: 2px 6px; line-height: 1; transition: transform 0.2s, color 0.2s; margin-left: auto;`;
        btnTogglePanel.onmouseenter = () => { btnTogglePanel.style.color = '#fff'; };
        btnTogglePanel.onmouseleave = () => { btnTogglePanel.style.color = '#9ca3af'; };
        btnTogglePanel.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };

        const btnClose = document.createElement('button');
        btnClose.id = 'mossad-btn-close';
        mossadLabelEl(btnClose, 'hideWidget');
        btnClose.title = 'Скрыть виджет (Ctrl+Insert)';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 13px; padding: 0 4px; line-height: 1; transition: color 0.2s; margin-left: 4px;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        // Порядок: …таймер… | 🚀 | 💾 | 🔄 | ▼ | ✕ (на Grok ⌨ и ✕ — в верхнем ряду, см. ui-bar.js)
        // v1.3.49: «2DO» — справа от 🔄: окно настроек сразу на вкладке «📝 Тудушки»
        const btnTodo = document.createElement('button');
        btnTodo.id = 'mossad-btn-todo';
        mossadLabelEl(btnTodo, 'todoBtn');
        btnTodo.title = 'Тудушки — задачи для ассистента (текст + фото)';
        btnTodo.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #fbbf24; cursor: pointer; font-size: 11px; font-weight: 700; padding: 4px 6px;`;
        btnTodo.onclick = (e) => { e.stopPropagation(); toggleSettingsWindow('todos'); };
        topBar.append(timerEl, btnStart, btnDL, btnUpdate, btnTodo, btnTogglePanel, btnClose);

        // SETTINGS PANEL
        const panel = document.createElement('div');
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
                            <label title="Авто разворачивание во весь экран" style="display:flex; align-items:center; gap:3px; cursor:pointer; font-size:11px;">
                                <input id="mossad-cb-fs" type="checkbox" style="accent-color:#3b82f6;" ${config.pinterestAutoFS ? 'checked' : ''}> FS
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
                        <input id="mossad-cb-fn-tpl" type="checkbox" style="accent-color:#3b82f6;" ${config.filenameTemplateEnabled ? 'checked' : ''}> <span data-mossad-label=\"tplLabel\">${LH('tplLabel')}</span>
                    </label>
                    <input id="mossad-in-fn-tpl" type="text" placeholder="${getDefaultFilenameTemplate()}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон: {conv4} {id4} {id8} {id} {domain} {userName} {title} {date} {time} {ext} {n} {dbl} {oldname}"
                        style="flex:1; min-width:0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px 5px; font-size:11px;">
                    <button id="mossad-btn-save-tpl-global" title="Сохранить шаблон глобально для ${rootDomain} (во всех вкладках)" style="background:#1f2937; border:1px solid #374151; color:#60a5fa; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:11px;" data-mossad-label="saveTplGlobal">${LH('saveTplGlobal')}</button>
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
            panel.querySelector('#mossad-cb-fn-tpl').onchange = (e) => Settings.set('filenameTemplateEnabled', e.target.checked);
            const fnTplInput = panel.querySelector('#mossad-in-fn-tpl');
            const _saveFnTpl = (e) => Settings.setQuiet('filenameTemplate', e.target.value);
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

        container.append(topBar, panel);
        document.body.appendChild(container);

        // Actions
        btnStart.onclick = startSlideshow;
        // Скачать и удалить: работает только на страницах постов grok.com
        btnDL.onclick = () => {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            triggerDownload();
        };

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
                    galleryRow.style.display = 'flex';
                    galleryRow.style.pointerEvents = 'auto';
                }
                if (playlistPanel) {
                    playlistPanel.style.display = 'block';
                    playlistPanel.style.pointerEvents = 'auto';
                }
                btnTogglePanel.style.transform = 'rotate(0deg)';
                btnTogglePanel.style.color = '#9ca3af';
            } else if (window.widgetState === 'panel') {
                container.style.display = 'flex';
                container.style.pointerEvents = 'none';
                topBar.style.display = 'flex';
                topBar.style.pointerEvents = 'auto';
                if (galleryRow) {
                    galleryRow.style.display = 'flex';
                    galleryRow.style.pointerEvents = 'auto';
                }
                if (playlistPanel) {
                    playlistPanel.style.display = 'block';
                    playlistPanel.style.pointerEvents = 'auto';
                }
                renderPanel(); // re-render to reflect settings
                panel.style.display = 'flex';
                panel.style.pointerEvents = 'auto';
                panel.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
                btnTogglePanel.style.transform = 'rotate(180deg)';
                btnTogglePanel.style.color = '#3b82f6';
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { initWidget(); initGrokGalleryBar(); grokGallerySlideshowTick(); });
    } else {
        initWidget();
        initGrokGalleryBar();
        grokGallerySlideshowTick();
    }

// ============================================
    // TODOS (v1.3.49): вкладка «📝 Тудушки» — задачи владельца для ассистента (текст + фото).
    // Хранение: GM (общее для всех сайтов и контейнеров). Список — один маленький ключ mossad_todos;
    // каждое фото — свой ключ mossad_todo_img_<id> (data URL), читается только при открытой вкладке.
    // Фото при добавлении уменьшаются (canvas, длинная сторона ≤ 1280 px, JPEG 0.8; маленький PNG — как есть).
    // В фоне ничего не работает: всё строится при открытии вкладки и живёт только в DOM окна настроек.
    // ============================================
    const TODOS_GM_KEY = 'mossad_todos';
    const TODO_IMG_PREFIX = 'mossad_todo_img_';
    const TODO_IMG_MAX_SIDE = 1280;
    const TODO_IMG_JPEG_Q = 0.8;
    const TODO_PNG_KEEP_BYTES = 150 * 1024;
    const TODO_WARN_BYTES = 20 * 1024 * 1024;

    function todoNewId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function todoReadList() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(TODOS_GM_KEY, null); } catch (e) {}
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!Array.isArray(arr)) return [];
            return arr.filter(t => t && typeof t === 'object' && t.id).map(t => ({
                id: String(t.id), text: typeof t.text === 'string' ? t.text : '', done: !!t.done, ts: Number(t.ts) || 0,
                imgs: Array.isArray(t.imgs) ? t.imgs.filter(i => i && i.id).map(i => ({ id: String(i.id), bytes: Number(i.bytes) || 0, w: Number(i.w) || 0, h: Number(i.h) || 0 })) : [],
                sent: (t.sent && Number(t.sent.n)) ? { n: Number(t.sent.n), url: String(t.sent.url || ''), ts: Number(t.sent.ts) || 0 } : null,
            }));
        } catch (e) { return []; }
    }
    function todoWriteList(list) {
        try { if (typeof GM_setValue === 'function') GM_setValue(TODOS_GM_KEY, JSON.stringify(list)); } catch (e) { return false; }
        return true;
    }
    function todoReadImg(imgId) {
        try { if (typeof GM_getValue === 'function') { const v = GM_getValue(TODO_IMG_PREFIX + imgId, ''); return typeof v === 'string' ? v : ''; } } catch (e) {}
        return '';
    }
    function todoWriteImg(imgId, dataUrl) {
        try { if (typeof GM_setValue === 'function') { GM_setValue(TODO_IMG_PREFIX + imgId, dataUrl); return true; } } catch (e) {}
        return false;
    }
    function todoDeleteImg(imgId) {
        try {
            if (typeof GM_deleteValue === 'function') GM_deleteValue(TODO_IMG_PREFIX + imgId);
            else if (typeof GM_setValue === 'function') GM_setValue(TODO_IMG_PREFIX + imgId, '');
        } catch (e) {}
    }
    /** Сумма байт фото (по метаданным списка — без чтения самих фото). */
    function todoTotalBytes(list) {
        return (list || todoReadList()).reduce((s, t) => s + t.imgs.reduce((a, i) => a + i.bytes, 0) + (t.text || '').length, 0);
    }
    function todoFmtMb(b) { return (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' МБ'; }

    function _todoReadAsDataUrl(blob) {
        return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    }
    function _todoDecode(blob) {
        if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
            img.src = url;
        });
    }
    /**
     * Уменьшить картинку: длинная сторона ≤ 1280 px, JPEG 0.8. Маленький PNG (≤150 КБ и ≤1280 px) — как есть.
     * Возвращает {dataUrl, bytes, w, h}. Холст и bitmap освобождаются сразу.
     */
    async function mossadDownscaleImage(blob) {
        if (!blob || !/^image\//.test(blob.type || '')) throw new Error('not an image');
        const src = await _todoDecode(blob);
        const w0 = src.width || src.naturalWidth || 0, h0 = src.height || src.naturalHeight || 0;
        if (!w0 || !h0) { try { src.close && src.close(); } catch (e) {} throw new Error('empty image'); }
        const k = Math.min(1, TODO_IMG_MAX_SIDE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
        let dataUrl;
        if (blob.type === 'image/png' && k === 1 && blob.size <= TODO_PNG_KEEP_BYTES) {
            dataUrl = await _todoReadAsDataUrl(blob);
        } else {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            if (!ctx) { try { src.close && src.close(); } catch (e) {} throw new Error('canvas unavailable'); }
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // прозрачность PNG → белый фон (JPEG)
            ctx.drawImage(src, 0, 0, w, h);
            dataUrl = c.toDataURL('image/jpeg', TODO_IMG_JPEG_Q);
            c.width = c.height = 0; // освободить память холста
        }
        try { src.close && src.close(); } catch (e) {}
        return { dataUrl, bytes: dataUrl.length, w, h };
    }

    /** Текст для чата: открытые задачи, пронумерованные. */
    function mossadTodosAsText(list) {
        const open = (list || todoReadList()).filter(t => !t.done && (t.text.trim() || t.imgs.length));
        if (!open.length) return '';
        return open.map((t, i) => {
            const body = t.text.trim().replace(/\n/g, '\n   ');
            const ph = t.imgs.length ? ` [фото: ${t.imgs.length}]` : '';
            return `${i + 1}. ${body || '(без текста)'}${ph}`;
        }).join('\n');
    }
    /** Один HTML-файл со всеми задачами и встроенными фото (без zip-библиотек). */
    function mossadTodosAsHtml(list) {
        const L0 = list || todoReadList();
        const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const items = L0.map((t, i) => {
            const imgs = t.imgs.map(im => { const u = todoReadImg(im.id); return u ? `<a href="${u}" target="_blank"><img src="${u}" style="max-width:100%;max-height:420px;margin:4px 6px 0 0;border:1px solid #ccc;"></a>` : ''; }).join('');
            return `<li style="margin:0 0 14px;${t.done ? 'color:#888;' : ''}"><div style="white-space:pre-wrap;">${t.done ? '✔ ' : ''}${esc(t.text || '(без текста)')}</div>${imgs ? `<div>${imgs}</div>` : ''}</li>`;
        }).join('\n');
        return `<!doctype html><html><head><meta charset="utf-8"><title>MOSSAD — тудушки ${new Date().toISOString().slice(0, 10)}</title></head>` +
               `<body style="font-family:system-ui,sans-serif;max-width:960px;margin:20px auto;padding:0 12px;">` +
               `<h2>MOSSAD — тудушки (${L0.filter(t => !t.done).length} открыто, ${L0.length} всего)</h2><ol>\n${items}\n</ol></body></html>`;
    }

    function _todoCopyText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
        } catch (e) {}
        try {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta); ta.select();
            const ok = document.execCommand && document.execCommand('copy');
            ta.remove();
            return Promise.resolve(!!ok);
        } catch (e) { return Promise.resolve(false); }
    }

    /** Просмотр фото на весь экран (клик или Esc — закрыть). */
    function mossadTodoOpenOverlay(dataUrl) {
        if (!dataUrl) return;
        const ov = document.createElement('div');
        ov.id = 'mossad-todo-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'max-width:96vw;max-height:96vh;box-shadow:0 10px 40px rgba(0,0,0,0.8);';
        ov.appendChild(img);
        const close = (e) => { if (e) { e.stopPropagation(); } document.removeEventListener('keydown', onKey, true); ov.remove(); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
        ov.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(ov);
        return ov;
    }

    // ── «📤 На GitHub»: одно issue в eldmans/tm-scripts + фото в ветке todo-assets ──
    const TODO_GH_OWNER = 'eldmans';
    const TODO_GH_REPO = 'tm-scripts';
    const TODO_GH_BRANCH = 'todo-assets';
    const TODO_GH_LABEL = 'mossad-todo';
    function todoGh(token, method, path, body) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest !== 'function') { resolve({ status: 0, json: null, headers: '' }); return; }
            GM_xmlhttpRequest({
                method,
                url: `https://api.github.com${path}`,
                headers: Object.assign({ 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
                data: body ? JSON.stringify(body) : undefined,
                onload: (res) => { let json = null; try { json = JSON.parse(res.responseText || 'null'); } catch (e) {} resolve({ status: res.status, json, headers: res.responseHeaders || '' }); },
                onerror: () => resolve({ status: 0, json: null, headers: '' }),
                ontimeout: () => resolve({ status: 0, json: null, headers: '' }),
            });
        });
    }
    /** Понятное объяснение ошибки GitHub (403/404/401) для тоста. */
    function todoGhError(step, r) {
        const need = (/x-accepted-github-permissions:\s*([^\r\n]+)/i.exec(r.headers || '') || [])[1];
        const msg = (r.json && r.json.message) ? r.json.message : '';
        if (r.status === 0) return `${step}: нет связи с api.github.com`;
        if (r.status === 401) return `${step}: токен недействителен (401) — обновите его в «⚙ Общие»`;
        if (r.status === 403) return `${step}: нет прав (403)${need ? ' — нужно: ' + need : ''}. Fine-grained токен: Contents и Issues — Read and write для ${TODO_GH_OWNER}/${TODO_GH_REPO}${/rate limit/i.test(msg) ? ' (или превышен лимит запросов)' : ''}`;
        if (r.status === 404) return `${step}: не найдено (404) — токену не открыт репозиторий ${TODO_GH_OWNER}/${TODO_GH_REPO} (fine-grained: добавьте его в Repository access)`;
        if (r.status === 422) return `${step}: отклонено (422) ${msg}`;
        return `${step}: HTTP ${r.status} ${msg}`;
    }
    function _todoB64ofDataUrl(u) { const i = String(u).indexOf(','); return i >= 0 ? String(u).slice(i + 1) : ''; }
    function _todoExtOfDataUrl(u) { const m = /^data:image\/(png|jpeg|jpg|gif|webp)/i.exec(String(u)); return m ? (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : 'jpg'; }
    /**
     * Отправить открытые задачи. Шаги:
     *  1) фото (если есть): ветка todo-assets (GET ref → при 404 создать от ветки по умолчанию),
     *     PUT contents todo/<дата>/<id>-<n>.<ext> в эту ветку;
     *  2) метка mossad-todo (POST labels; 422 «уже есть» — нормально; нет прав — без метки);
     *  3) POST issues «2DO <дата>», тело — нумерованный список со ссылками raw.githubusercontent на фото;
     *  4) задачи помечаются sent {n, url} (остаются в списке).
     * Возвращает {ok, issue?, error?}.
     */
    async function mossadSendTodosToGitHub(onProgress) {
        const token = (config && config.githubToken) || (typeof GM_getValue === 'function' ? GM_getValue('mossad_github_token', '') : '');
        if (!token) return { ok: false, error: 'Нет GitHub-токена — укажите его во вкладке «⚙ Общие»' };
        const list = todoReadList();
        const open = list.filter(t => !t.done && !t.sent && (t.text.trim() || t.imgs.length));
        if (!open.length) return { ok: false, error: 'Нет открытых неотправленных задач' };
        const repo = `/repos/${TODO_GH_OWNER}/${TODO_GH_REPO}`;
        const date = new Date().toISOString().slice(0, 10);
        const say = (m) => { try { onProgress && onProgress(m); } catch (e) {} };

        // 1) Фото
        const imgLinks = {}; // todoId → [url]
        const withImgs = open.filter(t => t.imgs.length);
        if (withImgs.length) {
            say('ветка для фото…');
            let ref = await todoGh(token, 'GET', `${repo}/git/ref/heads/${TODO_GH_BRANCH}`);
            if (ref.status === 404) {
                const info = await todoGh(token, 'GET', repo);
                if (info.status !== 200) return { ok: false, error: todoGhError('Репозиторий', info) };
                const def = (info.json && info.json.default_branch) || 'main';
                const base = await todoGh(token, 'GET', `${repo}/git/ref/heads/${def}`);
                if (base.status !== 200) return { ok: false, error: todoGhError('Ветка по умолчанию', base) };
                ref = await todoGh(token, 'POST', `${repo}/git/refs`, { ref: `refs/heads/${TODO_GH_BRANCH}`, sha: base.json.object.sha });
                if (ref.status !== 201) return { ok: false, error: todoGhError(`Создание ветки ${TODO_GH_BRANCH}`, ref) };
            } else if (ref.status !== 200) {
                return { ok: false, error: todoGhError(`Ветка ${TODO_GH_BRANCH}`, ref) };
            }
            let done = 0;
            const total = withImgs.reduce((a, t) => a + t.imgs.length, 0);
            for (const t of withImgs) {
                imgLinks[t.id] = [];
                for (let n = 0; n < t.imgs.length; n++) {
                    const u = todoReadImg(t.imgs[n].id);
                    if (!u) continue;
                    const path = `todo/${date}/${t.id}-${n + 1}.${_todoExtOfDataUrl(u)}`;
                    say(`фото ${++done}/${total}…`);
                    const put = await todoGh(token, 'PUT', `${repo}/contents/${path}`, { message: `todo: ${path}`, content: _todoB64ofDataUrl(u), branch: TODO_GH_BRANCH });
                    if (put.status !== 201 && put.status !== 200) {
                        // 422 «sha wasn't supplied» — файл уже есть (повторная отправка): ссылка та же
                        if (put.status !== 422) return { ok: false, error: todoGhError('Загрузка фото', put) };
                    }
                    imgLinks[t.id].push(`https://raw.githubusercontent.com/${TODO_GH_OWNER}/${TODO_GH_REPO}/${TODO_GH_BRANCH}/${path}`);
                }
            }
        }

        // 2) Метка (необязательно)
        say('метка…');
        const lab = await todoGh(token, 'POST', `${repo}/labels`, { name: TODO_GH_LABEL, color: 'f59e0b', description: 'Задачи из MOSSAD (вкладка «Тудушки»)' });
        const labelOk = lab.status === 201 || lab.status === 422;

        // 3) Issue
        const body = open.map((t, i) => {
            const text = (t.text.trim() || '(без текста)').replace(/\n/g, '\n   ');
            const pics = (imgLinks[t.id] || []).map((u, k) => `   ![${i + 1}.${k + 1}](${u})`).join('\n');
            return `${i + 1}. ${text}${pics ? '\n' + pics : ''}`;
        }).join('\n') + `\n\n— отправлено из MOSSAD v${SCRIPT_VERSION}`;
        say('issue…');
        let iss = await todoGh(token, 'POST', `${repo}/issues`, Object.assign({ title: `2DO ${date}`, body }, labelOk ? { labels: [TODO_GH_LABEL] } : {}));
        if ((iss.status === 403 || iss.status === 422) && labelOk) {
            iss = await todoGh(token, 'POST', `${repo}/issues`, { title: `2DO ${date}`, body }); // без метки
        }
        if (iss.status !== 201 || !iss.json || !iss.json.number) return { ok: false, error: todoGhError('Создание issue', iss) };

        // 4) Отметить отправленные
        const sent = { n: iss.json.number, url: iss.json.html_url || '', ts: Date.now() };
        const ids = new Set(open.map(t => t.id));
        const fresh = todoReadList();
        fresh.forEach(t => { if (ids.has(t.id)) t.sent = sent; });
        todoWriteList(fresh);
        return { ok: true, issue: sent, count: open.length };
    }

    /** Вкладка «📝 Тудушки» — строится лениво при первом открытии вкладки. */
    function initTodosTab(modal) {
        const pane = modal.querySelector('[data-pane="todos"]');
        if (!pane) return;
        if (pane.dataset.built) { renderTodos(); return; }
        pane.dataset.built = '1';
        const btnCss = 'background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;';
        const inputCss = 'background:#111827;border:1px solid #374151;border-radius:6px;color:#e5e7eb;padding:5px 8px;font-size:12px;font-family:inherit;';
        pane.innerHTML = `
            <div id="mossad-todo-new" class="mossad-todo-drop" style="display:flex;flex-direction:column;gap:4px;background:#1f2937;border:1px dashed #374151;border-radius:6px;padding:6px;">
              <textarea id="mossad-todo-new-text" rows="2" placeholder="Новая задача… (Ctrl+V — вставить фото, можно перетащить файл)" style="${inputCss}resize:vertical;"></textarea>
              <div style="display:flex;gap:6px;align-items:center;">
                <div class="mossad-todo-thumbs" style="display:flex;gap:4px;flex-wrap:wrap;flex:1;"></div>
                <button class="mossad-todo-attach" title="Прикрепить фото" style="${btnCss}" data-mossad-label="todoAttach">${LH('todoAttach')}</button>
                <button id="mossad-todo-add" style="${btnCss}background:#065f46;border-color:#10b981;" data-mossad-label="todoAdd">${LH('todoAdd')}</button>
              </div>
            </div>
            <div id="mossad-todo-list" style="display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:calc(85vh - 330px);padding-right:4px;position:relative;"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <button id="mossad-todo-copy" style="${btnCss}" title="Открытые задачи — нумерованным текстом в буфер обмена" data-mossad-label="todoCopy">${LH('todoCopy')}</button>
              <button id="mossad-todo-gh" style="${btnCss}background:#1e3a8a;border-color:#3b82f6;" title="Открытые неотправленные задачи → одно issue в ${TODO_GH_OWNER}/${TODO_GH_REPO} (фото — в ветку ${TODO_GH_BRANCH}). Нужен GitHub-токен (вкладка «⚙ Общие»)" data-mossad-label="todoGitHub">${LH('todoGitHub')}</button>
              <button id="mossad-todo-export" style="${btnCss}" title="Один HTML-файл: все задачи и фото внутри" data-mossad-label="todoExport">${LH('todoExport')}</button>
              <button id="mossad-todo-clear-done" style="${btnCss}color:#f87171;" data-mossad-label="todoClearDone">${LH('todoClearDone')}</button>
              <span id="mossad-todo-size" style="font-size:11px;color:#9ca3af;margin-left:auto;"></span>
            </div>
            <input id="mossad-todo-file" type="file" accept="image/*" multiple style="display:none;">`;
        const listEl = pane.querySelector('#mossad-todo-list');
        const newBox = pane.querySelector('#mossad-todo-new');
        const newText = pane.querySelector('#mossad-todo-new-text');
        const fileIn = pane.querySelector('#mossad-todo-file');
        const sizeEl = pane.querySelector('#mossad-todo-size');
        let pendingImgs = []; // фото новой задачи (ещё не добавленной): [{id, bytes, w, h, dataUrl}]
        let attachTarget = null; // id задачи для 📎 или null (новая)

        const updateSize = (list) => {
            const b = todoTotalBytes(list) + pendingImgs.reduce((a, i) => a + i.bytes, 0);
            sizeEl.textContent = `Хранилище: ${todoFmtMb(b)}` + (b > TODO_WARN_BYTES ? ' ⚠️ больше 20 МБ — удалите лишние фото' : '');
            sizeEl.style.color = b > TODO_WARN_BYTES ? '#fbbf24' : '#9ca3af';
            return b;
        };
        const mkThumb = (imgId, dataUrl, removable) => {
            const wrap = document.createElement('span');
            wrap.className = 'mossad-todo-thumb';
            wrap.dataset.img = imgId;
            wrap.style.cssText = 'position:relative;display:inline-block;width:64px;height:64px;border-radius:4px;overflow:hidden;border:1px solid #374151;background:#111827;cursor:zoom-in;flex:none;';
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = dataUrl;
            img.style.cssText = 'width:64px;height:64px;object-fit:cover;display:block;';
            wrap.appendChild(img);
            if (removable) {
                const x = document.createElement('button');
                x.className = 'mossad-todo-img-del';
                x.title = 'Убрать фото';
                x.textContent = '×';
                x.style.cssText = 'position:absolute;top:0;right:0;background:rgba(0,0,0,0.65);border:none;color:#f87171;font-size:12px;line-height:1;padding:1px 4px;cursor:pointer;';
                wrap.appendChild(x);
            }
            return wrap;
        };
        const renderPending = () => {
            const box = newBox.querySelector('.mossad-todo-thumbs');
            box.innerHTML = '';
            pendingImgs.forEach(p => box.appendChild(mkThumb(p.id, p.dataUrl, true)));
        };
        const renderRow = (t) => {
            const row = document.createElement('div');
            row.className = 'mossad-todo-item mossad-todo-drop';
            row.dataset.todo = t.id;
            row.style.cssText = `display:flex;gap:6px;align-items:flex-start;background:#1f2937;border:1px solid #374151;border-radius:6px;padding:6px;box-sizing:border-box;${t.done ? 'opacity:0.55;' : ''}`;
            row.innerHTML = `
                <span class="mossad-todo-handle" title="Перетащите, чтобы изменить порядок" style="cursor:grab;user-select:none;touch-action:none;color:#6b7280;padding:2px 2px 0;font-size:13px;line-height:1;">⋮⋮</span>
                <input type="checkbox" class="mossad-todo-done" ${t.done ? 'checked' : ''} title="Выполнено" style="margin-top:4px;cursor:pointer;accent-color:#10b981;">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
                  <textarea class="mossad-todo-text" rows="${Math.min(6, Math.max(1, (t.text.match(/\n/g) || []).length + 1))}" style="${inputCss}resize:vertical;${t.done ? 'text-decoration:line-through;' : ''}"></textarea>
                  <div class="mossad-todo-thumbs" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
                  ${t.sent ? `<a class="mossad-todo-sent" href="${String(t.sent.url).replace(/"/g, '&quot;')}" target="_blank" rel="noopener" title="Отправлено на GitHub ${new Date(t.sent.ts).toLocaleString()}" style="align-self:flex-start;font-size:10px;color:#93c5fd;background:#1e3a8a;border-radius:4px;padding:1px 6px;text-decoration:none;">📤 #${t.sent.n}</a>` : ''}
                </div>
                <button class="mossad-todo-attach" title="Прикрепить фото" style="background:transparent;border:none;cursor:pointer;font-size:13px;padding:2px;" data-mossad-label="todoAttach">${LH('todoAttach')}</button>
                <button class="mossad-todo-del" title="Удалить задачу" style="background:transparent;border:none;cursor:pointer;font-size:13px;padding:2px;color:#f87171;" data-mossad-label="todoDelete">${LH('todoDelete')}</button>`;
            row.querySelector('.mossad-todo-text').value = t.text;
            const thumbs = row.querySelector('.mossad-todo-thumbs');
            t.imgs.forEach(im => { const u = todoReadImg(im.id); if (u) thumbs.appendChild(mkThumb(im.id, u, true)); });
            return row;
        };
        function renderTodos() {
            const list = todoReadList();
            listEl.innerHTML = '';
            if (!list.length) listEl.innerHTML = '<div style="font-size:12px;color:#6b7280;padding:6px;">Задач пока нет.</div>';
            list.forEach(t => listEl.appendChild(renderRow(t)));
            updateSize(list);
        }
        modal._mossadRenderTodos = renderTodos;
        const mutate = (fn) => { const list = todoReadList(); const r = fn(list); todoWriteList(list); updateSize(list); return r; };

        // ── Добавление фото: файл / вставка / перетаскивание ──
        const addImages = async (files, todoId) => {
            const imgs = Array.from(files || []).filter(f => f && /^image\//.test(f.type || ''));
            if (!imgs.length) return 0;
            let n = 0;
            for (const f of imgs) {
                let r;
                try { r = await mossadDownscaleImage(f); } catch (e) { showToast('⚠️ Не удалось обработать фото', true); continue; }
                const id = todoNewId();
                if (todoId) {
                    if (!todoWriteImg(id, r.dataUrl)) { showToast('❌ GM-хранилище недоступно', true); return n; }
                    mutate(list => { const t = list.find(x => x.id === todoId); if (t) t.imgs.push({ id, bytes: r.bytes, w: r.w, h: r.h }); });
                    const row = listEl.querySelector(`[data-todo="${todoId}"] .mossad-todo-thumbs`);
                    if (row) row.appendChild(mkThumb(id, r.dataUrl, true));
                } else {
                    pendingImgs.push({ id, bytes: r.bytes, w: r.w, h: r.h, dataUrl: r.dataUrl });
                    renderPending();
                }
                n++;
            }
            const total = updateSize();
            if (total > TODO_WARN_BYTES) showToast(`⚠️ Тудушки занимают ${todoFmtMb(total)} (больше 20 МБ)`, true);
            return n;
        };
        modal._mossadTodoAddImages = addImages; // для тестов
        const targetOf = (el) => {
            const row = el && el.closest ? el.closest('[data-todo]') : null;
            return row ? row.dataset.todo : null;
        };
        pane.addEventListener('paste', (e) => {
            const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
            if (!files.some(f => /^image\//.test(f.type || ''))) return; // обычный текст вставляется как обычно
            e.preventDefault();
            addImages(files, targetOf(e.target));
        });
        pane.addEventListener('dragover', (e) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
        });
        pane.addEventListener('drop', (e) => {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (!files || !files.length) return;
            e.preventDefault();
            addImages(files, targetOf(e.target));
        });
        fileIn.addEventListener('change', () => { const files = Array.from(fileIn.files || []); fileIn.value = ''; addImages(files, attachTarget); });

        // ── Делегированные клики ──
        pane.addEventListener('click', (e) => {
            const t = e.target;
            if (!t || !t.closest) return;
            const delImg = t.closest('.mossad-todo-img-del');
            if (delImg) {
                e.stopPropagation();
                const wrap = delImg.closest('.mossad-todo-thumb');
                const imgId = wrap.dataset.img;
                const todoId = targetOf(wrap);
                if (todoId) {
                    mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.imgs = it.imgs.filter(i => i.id !== imgId); });
                    todoDeleteImg(imgId);
                } else {
                    pendingImgs = pendingImgs.filter(p => p.id !== imgId);
                }
                wrap.remove();
                updateSize();
                return;
            }
            const thumb = t.closest('.mossad-todo-thumb');
            if (thumb) { const img = thumb.querySelector('img'); mossadTodoOpenOverlay(img && img.src); return; }
            if (t.closest('.mossad-todo-attach')) { attachTarget = targetOf(t); fileIn.click(); return; }
            if (t.closest('.mossad-todo-del')) {
                const todoId = targetOf(t);
                const it = todoReadList().find(x => x.id === todoId);
                if (it && (it.text.trim() || it.imgs.length) && !confirm('Удалить задачу?')) return;
                mutate(list => { const i = list.findIndex(x => x.id === todoId); if (i >= 0) { list[i].imgs.forEach(im => todoDeleteImg(im.id)); list.splice(i, 1); } });
                renderTodos();
                return;
            }
            if (t.id === 'mossad-todo-add') {
                const text = newText.value.trim();
                if (!text && !pendingImgs.length) { newText.focus(); return; }
                const imgs = [];
                for (const p of pendingImgs) { if (todoWriteImg(p.id, p.dataUrl)) imgs.push({ id: p.id, bytes: p.bytes, w: p.w, h: p.h }); }
                mutate(list => { list.push({ id: todoNewId(), text, done: false, ts: Date.now(), imgs }); });
                pendingImgs = []; newText.value = ''; renderPending();
                renderTodos();
                return;
            }
            if (t.id === 'mossad-todo-copy') {
                const text = mossadTodosAsText();
                if (!text) { showToast('Открытых задач нет'); return; }
                _todoCopyText(text).then(ok => showToast(ok ? `📋 Скопировано: ${text.split(/\n(?=\d+\. )/).length} задач` : '⚠️ Не удалось скопировать', !ok));
                modal._mossadTodoLastCopy = text;
                return;
            }
            if (t.id === 'mossad-todo-gh') {
                if (t.disabled) return;
                if (modal._mossadTodosFlush) modal._mossadTodosFlush();
                t.disabled = true;
                const lbl = t.textContent;
                const p = mossadSendTodosToGitHub((m) => { t.textContent = `📤 ${m}`; }).then(r => {
                    t.disabled = false; t.textContent = lbl;
                    if (r.ok) { showToast(`📤 Отправлено: ${r.count} задач → issue #${r.issue.n}`); renderTodos(); }
                    else showToast(`❌ ${r.error}`, true);
                    return r;
                });
                modal._mossadTodoLastSend = p;
                return;
            }
            if (t.id === 'mossad-todo-export') {
                const html = mossadTodosAsHtml();
                try {
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `mossad-todos-${new Date().toISOString().slice(0, 10)}.html`;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                    showToast(`💾 Экспорт: ${todoFmtMb(html.length)}`);
                } catch (err) { showToast('❌ Экспорт не удался', true); }
                modal._mossadTodoLastExport = html;
                return;
            }
            if (t.id === 'mossad-todo-clear-done') {
                const n = todoReadList().filter(x => x.done).length;
                if (!n) { showToast('Выполненных нет'); return; }
                if (!confirm(`Удалить выполненные (${n})?`)) return;
                mutate(list => {
                    for (let i = list.length - 1; i >= 0; i--) if (list[i].done) { list[i].imgs.forEach(im => todoDeleteImg(im.id)); list.splice(i, 1); }
                });
                renderTodos();
            }
        });
        pane.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || !t.classList) return;
            const todoId = targetOf(t);
            if (!todoId) return;
            if (t.classList.contains('mossad-todo-done')) {
                mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.done = !!t.checked; });
                const row = t.closest('[data-todo]');
                row.style.opacity = t.checked ? '0.55' : '';
                const ta = row.querySelector('.mossad-todo-text');
                if (ta) ta.style.textDecoration = t.checked ? 'line-through' : '';
            } else if (t.classList.contains('mossad-todo-text')) {
                mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.text = t.value; });
            }
        });
        // Текст сохраняется и при закрытии окна (change мог не прийти)
        modal._mossadTodosFlush = () => {
            const list = todoReadList();
            let dirty = false;
            listEl.querySelectorAll('[data-todo]').forEach(row => {
                const it = list.find(x => x.id === row.dataset.todo);
                const ta = row.querySelector('.mossad-todo-text');
                if (it && ta && ta.value !== it.text) { it.text = ta.value; dirty = true; }
            });
            if (dirty) todoWriteList(list);
        };

        // ── Перетаскивание задач (pointer events, как строки хоткеев) ──
        mossadMakeSortable(listEl, {
            rowSel: '[data-todo]', handleSel: '.mossad-todo-handle',
            onDrop: (ids) => mutate(list => { const by = {}; list.forEach(x => { by[x.id] = x; }); const out = ids.map(id => by[id]).filter(Boolean); list.forEach(x => { if (!out.includes(x)) out.push(x); }); list.splice(0, list.length, ...out); }),
        });
        renderTodos();
    }

    /**
     * Лёгкая сортировка перетаскиванием: тянем за handleSel, строка поднимается (absolute внутри
     * list с position:relative), пунктирный заполнитель. Слушатели документа — только на время тяги.
     */
    function mossadMakeSortable(list, { rowSel, handleSel, onDrop }) {
        let d = null;
        const rows = () => Array.from(list.children).filter(el => el.matches && el.matches(rowSel));
        const move = (e) => {
            if (!d) return;
            const dy = e.clientY - d.startY;
            if (!d.active) {
                if (Math.abs(dy) < 4) return;
                d.active = true;
                d.ph = document.createElement('div');
                d.ph.className = 'mossad-sort-placeholder';
                d.ph.style.cssText = `height:${d.row.offsetHeight || 40}px;border:1px dashed #3b82f6;border-radius:6px;background:rgba(59,130,246,0.08);flex:none;`;
                d.top0 = d.row.offsetTop;
                list.insertBefore(d.ph, d.row);
                Object.assign(d.row.style, { position: 'absolute', left: '0', right: '4px', zIndex: '2', opacity: '0.92', pointerEvents: 'none' });
                d.handle.style.cursor = 'grabbing';
                d.prevCursor = document.body.style.cursor;
                document.body.style.cursor = 'grabbing';
            }
            e.preventDefault();
            d.row.style.top = `${d.top0 + dy}px`;
            let before = null;
            for (const r of rows()) {
                if (r === d.row) continue;
                const rc = r.getBoundingClientRect();
                if (e.clientY < rc.top + rc.height / 2) { before = r; break; }
            }
            if (before) { if (d.ph.nextSibling !== before) list.insertBefore(d.ph, before); }
            else if (list.lastChild !== d.ph) list.appendChild(d.ph);
        };
        const end = () => {
            if (!d) return;
            const x = d; d = null;
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('pointerup', end, true);
            document.removeEventListener('pointercancel', end, true);
            x.handle.style.cursor = 'grab';
            if (!x.active) return;
            ['position', 'left', 'right', 'top', 'zIndex', 'opacity', 'pointerEvents'].forEach(p => { x.row.style[p] = ''; });
            if (x.ph.parentNode === list) { list.insertBefore(x.row, x.ph); x.ph.remove(); }
            document.body.style.cursor = x.prevCursor || '';
            const ids = rows().map(r => r.dataset.todo || r.dataset.hk || r.dataset.id);
            if (ids.join('|') !== x.before && typeof onDrop === 'function') onDrop(ids);
        };
        list.addEventListener('pointerdown', (e) => {
            const h = e.target && e.target.closest ? e.target.closest(handleSel) : null;
            if (!h || !list.contains(h) || d) return;
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            const row = h.closest(rowSel);
            d = { row, handle: h, startY: e.clientY, active: false, ph: null, before: rows().map(r => r.dataset.todo || r.dataset.hk || r.dataset.id).join('|') };
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', end, true);
            document.addEventListener('pointercancel', end, true);
        });
        return { cancel: end };
    }

// ============================================
    // SITES (v1.3.50): вкладка «🌍 Сайты» — где работает MOSSAD.
    // Встроенные сайты (MOSSAD_BUILTIN_SITES, только чтение) + свои (GM `mossad_sites`, общий для всех
    // сайтов и контейнеров; логика — src/core/domain.js). Строится лениво при первом открытии вкладки;
    // один делегированный обработчик на списке. Добавление/удаление вступает в силу после перезагрузки
    // страницы нужного сайта.
    // ============================================
    let _mossadSitesPane = null;

    function mossadEscHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Перерисовать список, если вкладка уже построена (вызывается и из GM-слушателя в domain.js). */
    function mossadSitesRerender() {
        const pane = _mossadSitesPane;
        if (!pane || !pane.isConnected) { _mossadSitesPane = null; return; }
        const user = mossadReadUserSites();
        const here = (d) => mossadHostMatches(hostname, d) ? ' <span style="color:#10b981;" title="Текущий сайт">● здесь</span>' : '';
        const chip = 'display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid #374151;border-radius:6px;background:#0b1220;font:12px ui-monospace,Consolas,monospace;color:#e5e7eb;';
        pane.querySelector('#mossad-sites-builtin').innerHTML = MOSSAD_BUILTIN_SITES.map(d =>
            `<div style="${chip}color:#9ca3af;" title="Встроенный сайт — убрать нельзя">🔒 ${mossadEscHtml(d)}${here(d)}</div>`).join('');
        pane.querySelector('#mossad-sites-user').innerHTML = user.length ? user.map(d =>
            `<div data-site="${mossadEscHtml(d)}" style="${chip}">${mossadEscHtml(d)}${here(d)}<button data-site-del="${mossadEscHtml(d)}" title="Убрать сайт из списка" style="margin-left:auto;background:#374151;border:1px solid #4b5563;border-radius:4px;color:#f87171;padding:0 7px;cursor:pointer;font-size:11px;font-weight:bold;">${LH('sitesRemove')}</button></div>`).join('')
            : '<div style="font-size:11px;color:#6b7280;">Пока пусто</div>';
        const cur = pane.querySelector('#mossad-sites-add-current');
        const curNorm = mossadNormSite(hostname);
        const already = mossadIsBuiltinHost(hostname) || user.some(d => mossadHostMatches(hostname, d));
        cur.disabled = already || !curNorm;
        cur.style.opacity = cur.disabled ? '0.5' : '1';
        cur.title = already ? `${hostname} уже в списке` : `Добавить ${curNorm}`;
    }

    function initSitesTab(modal) {
        const pane = modal.querySelector('[data-pane="sites"]');
        if (!pane || pane.dataset.built) return;
        pane.dataset.built = '1';
        _mossadSitesPane = pane;
        const btnCss = 'background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;';
        pane.innerHTML = `
            <div style="font-size:11px;color:#9ca3af;line-height:1.35;">Сайты, где работает MOSSAD. Список общий для всех сайтов и контейнеров. Поддомены входят автоматически (<code>site.com</code> → <code>m.site.com</code>). То же — в меню Tampermonkey: «➕ Добавить этот сайт в MOSSAD».</div>
            <div style="font-size:11px;color:#fbbf24;">⚠️ После добавления или удаления перезагрузи страницу того сайта.</div>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="mossad-sites-input" type="text" placeholder="example.com" spellcheck="false" style="flex:1;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:4px 6px;font-size:12px;">
              <button id="mossad-sites-add" style="${btnCss}background:#065f46;border-color:#10b981;" data-mossad-label="sitesAdd">${LH('sitesAdd')}</button>
              <button id="mossad-sites-add-current" style="${btnCss}color:#60a5fa;" data-mossad-label="sitesAddCurrent">${LH('sitesAddCurrent')}</button>
            </div>
            <div id="mossad-sites-status" style="font-size:11px;color:#9ca3af;min-height:14px;"></div>
            <div style="overflow-y:auto;max-height:calc(85vh - 320px);display:flex;flex-direction:column;gap:6px;padding-right:4px;">
              <div style="font-size:11px;color:#6b7280;" data-mossad-label="sitesUser">${LH('sitesUser')}</div>
              <div id="mossad-sites-user" style="display:flex;flex-direction:column;gap:3px;"></div>
              <div style="font-size:11px;color:#6b7280;margin-top:4px;" data-mossad-label="sitesBuiltin">${LH('sitesBuiltin')}</div>
              <div id="mossad-sites-builtin" style="display:flex;flex-direction:column;gap:3px;"></div>
            </div>`;
        const input = pane.querySelector('#mossad-sites-input');
        const status = pane.querySelector('#mossad-sites-status');
        const say = (t, bad) => { status.textContent = t; status.style.color = bad ? '#f87171' : '#10b981'; };
        const add = (raw) => {
            const d = mossadNormSite(raw);
            if (!d) { say('Не похоже на домен: ' + String(raw || '').slice(0, 60), true); return false; }
            if (MOSSAD_BUILTIN_SITES.includes(d)) { say(`${d} — встроенный, уже работает`); return false; }
            if (mossadReadUserSites().includes(d)) { say(`${d} уже в списке`); return false; }
            if (!mossadAddUserSite(d)) { say('GM-хранилище недоступно', true); return false; }
            say(`✅ ${d} добавлен — перезагрузи страницу сайта`);
            mossadSitesRerender();
            try { mossadRegisterSiteMenu(); } catch (e) {}
            return true;
        };
        pane.querySelector('#mossad-sites-add').onclick = () => { if (add(input.value)) input.value = ''; };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (add(input.value)) input.value = ''; } });
        pane.querySelector('#mossad-sites-add-current').onclick = () => add(hostname);
        pane.querySelector('#mossad-sites-user').addEventListener('click', (e) => {
            const b = e.target && e.target.closest ? e.target.closest('[data-site-del]') : null;
            if (!b) return;
            const d = b.dataset.siteDel;
            const list = mossadReadUserSites().filter(x => x !== d);
            if (!mossadWriteUserSites(list)) { say('GM-хранилище недоступно', true); return; }
            say(`${d} убран — перезагрузи страницу сайта`);
            mossadSitesRerender();
            try { mossadRegisterSiteMenu(); } catch (e2) {}
        });
        mossadSitesRerender();
    }

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
    function clearHotkeyOrder() {
        try { if (typeof GM_deleteValue === 'function') GM_deleteValue(HK_ORDER_KEY); else if (typeof GM_setValue === 'function') GM_setValue(HK_ORDER_KEY, '[]'); } catch (e) {}
        try { localStorage.removeItem(HK_ORDER_KEY); } catch (e) {}
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
        { k: 'pinterestMode',     t: 'text', label: 'Pinterest: режим (rand / +1 / 1–30)' },
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

// ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null;

    // ── v1.3.43: «мост раскладки» для СОБСТВЕННЫХ сочетаний Grok (Ctrl+B — свернуть боковую панель, Ctrl+/) ──
    // Это не хоткеи MOSSAD: их обрабатывает сам сайт и сравнивает e.key ('b', '/'). В русской раскладке
    // e.key === 'и' (KeyB) и '.' (Slash) — сайт их не узнаёт. Ловим такое нажатие раньше всех (window, capture),
    // гасим оригинал и отправляем копию с латинским e.key и тем же e.code/модификаторами. Если сайт отменил
    // копию (preventDefault) — отменяем и оригинал (чтобы, например, Firefox не открыл панель закладок).
    // Только белый список клавиш: Ctrl+C/V/X/A/Z и т.п. в полях ввода не трогаем (у копии нет действия по умолчанию).
    const GROK_LAYOUT_BRIDGE_CODES = ['KeyB', 'Slash'];
    window.addEventListener('keydown', function grokLayoutBridge(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        if (e.__mossadLayoutBridge || !(e.ctrlKey || e.metaKey) || e.altKey) return;
        if (!GROK_LAYOUT_BRIDGE_CODES.includes(e.code)) return;
        const us = mossadUsKeyForCode(e.code);
        if (!us || e.key === us || e.key === mossadUsKeyForCode(e.code, true)) return; // латинская раскладка — сайт справится сам
        const key = mossadUsKeyForCode(e.code, e.shiftKey);
        let copy;
        try {
            copy = new KeyboardEvent('keydown', {
                key, code: e.code, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: false,
                repeat: e.repeat, bubbles: true, cancelable: true, composed: true
            });
            Object.defineProperty(copy, '__mossadLayoutBridge', { value: true });
            // Старые обработчики смотрят keyCode/which (у копии они 0)
            const kc = /^Key[A-Z]$/.test(e.code) ? e.code.charCodeAt(3) : (e.keyCode || 0);
            Object.defineProperty(copy, 'keyCode', { get: () => kc });
            Object.defineProperty(copy, 'which', { get: () => kc });
        } catch (err) { return; }
        e.stopImmediatePropagation();
        const target = (e.target && e.target.dispatchEvent) ? e.target : document;
        mossadDebug('hotkey', 'мост раскладки: сочетание сайта', { code: e.code, key: e.key, as: key });
        const notCancelled = target.dispatchEvent(copy);
        if (!notCancelled) e.preventDefault();
    }, true);

    function isSlideshowActiveOrPaused() {
        if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
        if (typeof slideshowPaused !== 'undefined' && slideshowPaused) return true;
        if (window._mossadGalleryActive || window._mossadGalleryPaused) return true;
        if (sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true') return true;
        if (sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true') return true;
        if (sessionStorage.getItem('mossad_gallery_paused') === 'true') return true;
        // GALLERY_SS_KEY = 'mossad_grok_imagine_ss' (constants.js). Старый фолбэк читал
        // несуществующий ключ 'mossad_grok_gallery_ss' — убран (v1.3.33).
        const rawSs = _gSS.getItem(GALLERY_SS_KEY);
        if (rawSs) {
            try {
                const ss = JSON.parse(rawSs);
                if (ss && ss.active) return true;
            } catch(e) {}
        }
        return false;
    }

    /**
     * v1.3.47: ЕДИНЫЙ шлюз хоткеев слайдшоу. Шаг вперёд/назад, смена группы (Gr/Md), стоп, перемотка в начало,
     * «дубль + слайд» работают ТОЛЬКО пока слайдшоу (большое или малое) идёт или стоит на паузе.
     * После «Стоп» нажатие проходит сайту нетронутым (без preventDefault) — у Grok свои ←/→.
     * Не входят: запуск (Insert / Shift+Insert), окно настроек, меню, звук, пауза видео, скачать,
     * улучшить, удалить, Home, привязка виджета.
     */
    const SLIDESHOW_ONLY_HOTKEYS = ['nextSlide', 'prevSlide', 'nextGroup', 'prevGroup', 'galleryStop', 'rewind', 'duplicateNext'];
    function mossadSlideshowHotkeysEnabled() {
        return isSlideshowActiveOrPaused();
    }
    /** Какой хоткей слайдшоу совпал с нажатием (или null). */
    function mossadMatchSlideshowHotkey(e) {
        for (const k of SLIDESHOW_ONLY_HOTKEYS) {
            const hk = config.hk && config.hk[k];
            if (hk && hotkeyMatches(e, hk)) return k;
        }
        return null;
    }

    function _postPlayerNav(wasPaused) {
        if (wasPaused) {
            setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
            updateGalleryStatusBtn('paused');
            if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
            if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        } else {
            requestSlideCycle(300, 'manual-step');
        }
    }

    function playerStepSlide(dir) {
        cancelSlideTimers();
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const nextRes = grokGetNextSlideItem(isFwd ? 'down' : 'up');
            if (nextRes && nextRes.item) {
                if (nextRes.circleCompleted) {
                    playCircleDoneSound();
                    let ss = {};
                    try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
                    ss.circle = (ss.circle || 1) + 1;
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    showToast(`🔄 Круг ${ss.circle} начался!`);
                }
                const targetItem = nextRes.item;
                // v1.3.38: ручной шаг перехватывает блокировку и явно фиксирует позицию (+история)
                grokBeginNav(targetItem.url, 'manual:' + dir, true);
                grokSyncSlidePosition(targetItem, { source: 'manual:' + dir });
                if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда
                const struct = grokGetPlaylistStructure();
                const curPos = (struct) ? grokFindCurrentPosition(struct, targetItem.url) : null;
                const posStr = (curPos && curPos.flatIndex !== -1) ? ` ${curPos.flatIndex + 1}/${struct.items.length}` : '';
                showToast(`${isFwd ? '⏭' : '⏮'}${posStr} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                grokSpaNavigate(targetItem.url);
                setTimeout(() => {
                    grokHighlightActivePlaylistItem(targetItem.url);
                }, 100);
                _postPlayerNav(wasPaused);
                return;
            }
            // Fallback если коллекция не собрана: навигация по киноплёнке (filmstrip)
            if (grokStepFilmstrip(isFwd)) {
                _postPlayerNav(wasPaused);
                return;
            }
        }

        // 2. PINTEREST ENGINE
        if (rootDomain.includes('pinterest.')) {
            selectNextPinterestPin(dir, { isManual: true });
            _postPlayerNav(wasPaused);
            return;
        }

        // 3. REDGIFS ENGINE
        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
                window.MOSSAD_ENGINES.redgifs.navigate(isFwd ? 'down' : 'up');
            } else redGifsNavigate(isFwd ? 'down' : 'up');
            _postPlayerNav(wasPaused);
            return;
        }

        // 4. ДРУГИЕ САЙТЫ (универсальный переход ленты)
        const dirs = config.slideshowDirections;
        const mainDir = (dirs && dirs.length) ? dirs[0] : 'down';
        const getOppKey = (d) => {
            if (d === 'up') return 'ArrowDown';
            if (d === 'down') return 'ArrowUp';
            if (d === 'left') return 'ArrowRight';
            return 'ArrowLeft';
        };
        const keyToPress = isFwd ? getArrowKey(mainDir) : getOppKey(mainDir);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: keyToPress, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: keyToPress, bubbles: true }));
        triggerUniversalFullScreen();
        _postPlayerNav(wasPaused);
    }

    // v1.3.41: Insert (большое слайдшоу) на Grok ловим на window в фазе capture — раньше сайта.
    // Раньше обработчик стоял в фазе bubble и проверял «залипший» GALLERY_SS_KEY.active:
    // на /imagine/saved после прошлого слайдшоу первое нажатие уходило в toggleGalleryPause(),
    // которая сразу выходила (слайдшоу на самом деле не идёт) — нажатие «терялось».
    function grokGalleryPlayPauseKey(e) {
        if (window.capturingFor !== null || rootDomain !== 'grok.com') return;
        if (!hotkeyMatches(e, config.hk.galleryPlayPause)) return;
        // В поле ввода Insert ничего не печатает — пропускаем только «печатающие» клавиши
        const typingKey = typeof e.key === 'string' && e.key.length === 1 && !(e.ctrlKey || e.altKey || e.metaKey);
        if (typingKey && isEditableElement(document.activeElement)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        grokHandleGalleryPlayPause('hotkey');
    }
    window.addEventListener('keydown', grokGalleryPlayPauseKey, true);

    // Снятие залипшего фокуса с текстовых полей при клике в медиа/фон/элементы вне полей ввода
    window.addEventListener('pointerdown', function (e) {
        if (!e.target) return;
        const isInput = !!e.target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
        if (!isInput && document.activeElement) {
            const el = document.activeElement;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('role') === 'textbox' || !!el.closest('input, textarea, [contenteditable="true"], [role="textbox"]')) {
                try { el.blur(); } catch (err) {}
            }
        }
    }, true);

    // Ранний перехват клавиш слайдера (PageUp / PageDown, ArrowDown / ArrowUp) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        if (isEditableElement(document.activeElement)) return;

        // v1.3.47: раньше стрелки и Alt+PageDown/Up перехватывались и без слайдшоу — достаточно было
        // коллекции в sessionStorage и страницы поста (hasGrokCollection). После «Стоп» коллекция остаётся,
        // поэтому ←/→ продолжали листать слайды. Теперь — только при идущем/приостановленном слайдшоу.
        if (!mossadSlideshowHotkeysEnabled()) return;
        const isGrokPost = (rootDomain === 'grok.com' && isGrokPostPage());
        const hasGrokCollection = isGrokPost && !!_gSS.getItem(GALLERY_COLLECTION_KEY);

        // Перехват групп: config.hk.nextGroup (по умолчанию Alt+PageDown) / config.hk.prevGroup (по умолчанию Alt+PageUp)
        const isNextGrp = hotkeyMatches(e, config.hk.nextGroup);
        const isPrevGrp = hotkeyMatches(e, config.hk.prevGroup);
        if ((isNextGrp || isPrevGrp) && isGrokPost && hasGrokCollection) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelSlideTimers();
            const nextRes = grokGetNextSlideItem(isNextGrp ? 'next_grp' : 'prev_grp');
            if (nextRes && nextRes.item) {
                grokBeginNav(nextRes.item.url, isNextGrp ? 'manual:next_grp' : 'manual:prev_grp', true);
                grokSyncSlidePosition(nextRes.item, { source: 'manual:grp' });
                if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
                else sessionStorage.removeItem('mossad_expected_type'); // v1.3.43: тип неизвестен — не оставлять подсказку прошлого слайда
                showToast(`📁 Группа: ${isNextGrp ? '↓' : '↑'}`);
                grokSpaNavigate(nextRes.item.url);
                setTimeout(() => {
                    grokHighlightActivePlaylistItem(nextRes.item.url);
                }, 100);
            }
            return;
        }

        // Шлюз уже пройден выше (слайдшоу идёт или на паузе)

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cancelSlideTimers();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    window.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;

        const activeEl = document.activeElement;
        const isEditing = isEditableElement(activeEl);

        // 1. Навигация Home / Saved Grok (срабатывает из любого места grok.com)
        const isHomeKey = (e.key === 'Home' || e.code === 'Home') && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
        const isHistoryHk = hotkeyMatches(e, config.hk.history) || isHomeKey;
        if (isHistoryHk && rootDomain === 'grok.com') {
            if (isEditing) {
                const textVal = (activeEl.value !== undefined) ? String(activeEl.value) : (activeEl.textContent || '');
                // Если это штатный Home (без модификаторов) и в поле есть введенный текст — сохраняем нативное поведение перемещения курсора в начало строки
                if (isHomeKey && textVal.trim().length > 0) {
                    return;
                }
            }
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof grokNavigateToSaved === 'function') {
                grokNavigateToSaved();
            } else {
                if (location.pathname !== '/imagine/saved') {
                    window.location.href = 'https://grok.com/imagine/saved';
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
            return;
        }

        if (isEditing && !/^F\d+$/.test(e.key) && !(e.ctrlKey || e.altKey || e.metaKey)) return;

        // v1.3.47: хоткеи слайдшоу (стоп, перемотка, дубль+слайд) без слайдшоу — не наши: отдаём сайту
        const ssKey = mossadMatchSlideshowHotkey(e);
        const isUpdateCombo = hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR'));
        if (ssKey && !isUpdateCombo && !mossadSlideshowHotkeysEnabled()) {
            // …кроме сочетаний, которые одновременно назначены на «не-слайдшоу» действие
            const other = ['help', 'slideshowPanel', 'galleryPlayPause', 'slideshowStart', 'download', 'upscale', 'deleteVid', 'sound', 'playPause', 'snapWidget', 'history']
                .some(k => config.hk[k] && hotkeyMatches(e, config.hk[k]));
            if (!other) { mossadDebug('hotkey', 'хоткей слайдшоу без слайдшоу — пропущен сайту', { hk: ssKey }); return; }
        }

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // Ctrl+F1 (и любые переназначенные слоты help): открыть/закрыть окно настроек.
            // Если окно открыто — закрыть с сохранением (с любой вкладки), как раньше.
            if (document.getElementById('mossad-hk-modal')) { closeSettingsWindow(true); return; }
            openSettingsWindow(); // v1.3.45: последняя открытая вкладка
            return;
        }

        // v1.3.49: «📝 Тудушки» (по умолчанию не назначено): открыть окно настроек сразу на этой вкладке / закрыть
        if (config.hk.openTodos && config.hk.openTodos.key && hotkeyMatches(e, config.hk.openTodos)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            toggleSettingsWindow('todos');
            return;
        }

        // Новая 3-позиционная логика переключения по Ctrl+Insert (циклическое переключение):
        // 1-е нажатие: Открывается полное меню (все 3 блока/строки, включая панель настроек снизу)
        // 2-е нажатие: Сворачивается до сокращённого меню (только 2 верхние строки)
        // 3-е нажатие: Меню полностью скрывается с экрана (режим click-through)
        // Следующее нажатие: Снова открывает полное меню (цикл заново)
        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof window.cycleWidgetMenuState === 'function') {
                window.cycleWidgetMenuState();
            } else {
                if (window.widgetState === 'hidden') window.widgetState = 'panel';
                else if (window.widgetState === 'panel') window.widgetState = 'bar';
                else window.widgetState = 'hidden';
                if (typeof window.updateWidgetUI === 'function') window.updateWidgetUI();
            }
            return;
        }

        // Большое слайдшоу (по плейлисту коллекции): Плей / Пауза (Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.galleryPlayPause)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                grokHandleGalleryPlayPause('hotkey-bubble'); // обычно уже обработано в capture (см. выше)
            } else {
                startSlideshow();
            }
            return;
        }

        // Стоп большого слайдшоу
        if (config.hk.galleryStop && hotkeyMatches(e, config.hk.galleryStop) && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                grokStopGallerySlideshow();
            }
            stopSlideshow();
            return;
        }

        // Малое слайдшоу (внутри группы / ракета: Shift+Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.slideshowStart)) {
            e.preventDefault();
            startSlideshow();
            return;
        }

        if (hotkeyMatches(e, config.hk.download)) {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            e.preventDefault();
            triggerDownload();
        }

        if (hotkeyMatches(e, config.hk.upscale)) {
            if (rootDomain === 'grok.com' && isGrokPostPage()) {
                e.preventDefault();
                runGrokUpscale();
            }
        }
        
        if (hotkeyMatches(e, config.hk.deleteVid)) {
            // v1.3.50: гасим Delete только там, где MOSSAD его обрабатывает (пост Grok); на остальных
            // сайтах клавиша остаётся сайту (runSmartDelete там ничего не делает — ANTI_PATTERNS §26, §29)
            if (rootDomain === 'grok.com' && isGrokPostPage()) {
                e.preventDefault();
                runSmartDelete();
            }
        }

        if (hotkeyMatches(e, config.hk.sound)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                toggleGrokSound();
            } else {
                const video = getActiveVideo();
                if (video) video.muted = !video.muted;
                // Специфично для RedGifs
                if (rootDomain.includes('redgifs.com')) {
                    const btn = document.querySelector('button.SoundButton');
                    if (btn) btn.click();
                }
                showToast(video && video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
            }
        }

        if (hotkeyMatches(e, config.hk.playPause)) {
            e.preventDefault();
            const video = getActiveVideo();
            if (video) {
                // v1.3.43: пауза пользователя — сторож «замёрзшего» видео её не снимает
                if (video.paused) { video._mossadUserPaused = false; video.play(); }
                else { video._mossadUserPaused = true; video.pause(); }
                showToast(video.paused ? '▶ Проигрывание' : '⏸ Пауза');
            }
        }

        // Привязать виджет к левому верхнему краю
        if (hotkeyMatches(e, config.hk.snapWidget)) {
            e.preventDefault();
            if (typeof window.snapWidgetToCorner === 'function') {
                window.snapWidgetToCorner();
            }
        }

        // Обновить скрипт (Win+Alt+R) / Мотать в начало (Alt+R по умолчанию)
        if (hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR'))) {
            e.preventDefault();
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        } else if (hotkeyMatches(e, config.hk.rewind) && !e.metaKey && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            doRewind();
        }

        // Дублирование страницы в фоновой вкладке + принудительный переход (Ctrl + Пробел)
        if (hotkeyMatches(e, config.hk.duplicateNext) && mossadSlideshowHotkeysEnabled()) {
            e.preventDefault();
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(location.href, { active: false, insert: true });
                showToast('📑 Открыто во вкладке в фоне + Переход...');
            } else {
                window.open(location.href, '_blank');
                showToast('📑 Открыта вкладка + Переход...');
            }
            triggerNextSlide('hotkey:duplicateNext');
        }
    }, true);

    // Авто кликер FullScreen при старте страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', triggerUniversalFullScreen);
    } else {
        triggerUniversalFullScreen();
    }

    // Возобновление слайдшоу после перехода/перезагрузки страницы
    if (sessionStorage.getItem('mossad_navigating') === 'true') {
        sessionStorage.removeItem('mossad_navigating');
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
        if (typeof setSlideshowPaused === 'function') setSlideshowPaused(false);
        else slideshowPaused = false;
    }

    const _isPausedOnResume = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                              sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                              sessionStorage.getItem('mossad_gallery_paused') === 'true';

    if (slideshowActive) {
        if (!_isPausedOnResume) {
            showToast('▶ Слайдшоу возобновлено');
            requestSlideCycle(500, 'page-resume');
        } else {
            showToast('⏸ Слайдшоу на паузе');
        }
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

})();
