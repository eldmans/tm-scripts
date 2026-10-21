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
        pdAction: 'upns',             // v1.3.56: «После скачивания»: none | upns (+1, только когда слайдшоу нет) | always (+1 всегда) | del (Grok)
        stopOnTabSwitch: false,       // Tab — выключена
        stopOnBrsrSwitch: false,      // Brsr — выключена
        deleteAutoconfirm: true,      // hold post включён (один чекбокс управляет обоими флагами, ANTI_PATTERNS §2)
        deleteHoldpost: true,
        allowDuplicates: false,       // Дубли: качать дубликаты сразу без подтверждения
        // v1.3.50: allowedDomains убран — список сайтов в GM `mossad_sites` (domain.js, вкладка «🌍 Сайты»)
        githubToken: '',
        githubConfigPath: 'mossad-config.json',
        filenameTemplate: '',            // v1.3.53: пусто = шаблон сайта по умолчанию (getDefaultFilenameTemplate: Grok '{id8}-{domain}~{account}', прочие '{id8}-{domain}')
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
        pinterestJumpKeys: 'off',          // v1.3.59: похожий пин по клавише: off | focus | keys | badges | shift
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
        'pinterestMode', 'pinterestFilterType', 'pinterestPhotoPercent', 'pinterestMaxVideoDuration', 'pinterestAutoFS', 'pinterestJumpKeys',
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
    if (!['off', 'focus', 'keys', 'badges', 'shift'].includes(config.pinterestJumpKeys)) config.pinterestJumpKeys = 'off';

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
    // v1.3.53: старый общий шаблон '{id8}-{domain[4]}~{RadugaStud}' ({RadugaStud} — несуществующий тег, задумывался
    // как аккаунт) → пусто = шаблон сайта по умолчанию. Мигрируем: конфиг сайта, GM-шаблон сайта, общие умолчания.
    const OLD_DEFAULT_TPL_V1336 = '{id8}-{domain[4]}~{RadugaStud}';
    // v1.3.56: «После DL: +1» ('up') → «Не СШ +1» ('upns'): во время слайдшоу +1 больше не делается (по умолчанию).
    // Новое «+1 всегда» — отдельное значение 'always' (иначе миграция срабатывала бы снова на каждой загрузке).
    if (config.pdAction === 'up' || !['none', 'upns', 'always', 'del'].includes(config.pdAction)) {
        const wasSaved = config.pdAction === 'up';
        config.pdAction = 'upns';
        try { if (wasSaved && GlobalDefaults.siteHasSavedConfig()) persistLocalConfig(); } catch (e) {}
    }
    if (typeof GM_getValue === 'function') {
        try {
            const rawGd0 = GM_getValue(GLOBAL_DEFAULTS_GM_KEY, '');
            const gd0 = rawGd0 ? (typeof rawGd0 === 'string' ? JSON.parse(rawGd0) : rawGd0) : null;
            if (gd0 && gd0.pdAction === 'up') { gd0.pdAction = 'upns'; GM_setValue(GLOBAL_DEFAULTS_GM_KEY, JSON.stringify(gd0)); }
        } catch (e) {}
    }
    if (typeof GM_getValue === 'function') {
        let gmTpl = GM_getValue('mossad_tpl_' + rootDomain, null);
        if (gmTpl === OLD_DEFAULT_TPL_V1336) {
            gmTpl = '';
            try { GM_setValue('mossad_tpl_' + rootDomain, ''); } catch (e) {}
        }
        if (gmTpl && typeof gmTpl === 'string') {
            config.filenameTemplate = gmTpl;
        }
        try {
            const rawGd = GM_getValue(GLOBAL_DEFAULTS_GM_KEY, '');
            const gd = rawGd ? (typeof rawGd === 'string' ? JSON.parse(rawGd) : rawGd) : null;
            if (gd && gd.filenameTemplate === OLD_DEFAULT_TPL_V1336) {
                gd.filenameTemplate = '';
                GM_setValue(GLOBAL_DEFAULTS_GM_KEY, JSON.stringify(gd));
            }
        } catch (e) {}
    }
    if (config.filenameTemplate === OLD_DEFAULT_TPL_V1336) {
        config.filenameTemplate = '';
        try { if (GlobalDefaults.siteHasSavedConfig()) persistLocalConfig(); } catch (e) {}
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

