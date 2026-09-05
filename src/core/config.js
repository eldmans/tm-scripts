    // ============================================
    // СИСТЕМА НАСТРОЕК
    // ============================================
    const DEFAULT_CONFIG = {
        slideshowMode: 'auto',
        slideshowOrientation: 'h',
        slideshowLoopMode: 'off',
        loopFeed: false,              // R в D-pad: повторять текущий плейлист (перемотка в начало при конце ленты)
        slideshowDirections: ['up'],  // листание вверх по умолчанию
        videoLoops: 2,
        slideshowDelay: 3,           // фото 3 сек
        delayAfterVideo: 2,           // пауза 2 сек
        downloadType: 'none',         // не скачивать
        pdAction: 'up',               // после DL: +1
        stopOnTabSwitch: true,        // Tab — включена
        stopOnBrsrSwitch: false,
        deleteAutoconfirm: false,
        deleteHoldpost: false,
        allowDuplicates: false,       // Дубли: качать дубликаты сразу без подтверждения
        allowedDomains: ['grok.com', 'redgifs.com', 'pinterest.com', 'pinterest.ru', 'civitai.red', 'vkvideo.ru', 'vk.video', 'noodlemagazine.com', 'instagram.com'],
        githubToken: '',
        githubConfigPath: 'mossad-config.json',
        filenameTemplate: '{id8}-{domain}.{ext}',  // шаблон имени файла по умолчанию (8 символов UUID + домен)
        filenameTemplateEnabled: false,  // использовать шаблон?
        
        // PINTEREST ENGINE CONFIGS
        pinterestMode: 'rand',             // 'rand' | '+1' | '1'..'9'
        pinterestFilterType: 'ratio',      // 'all' | 'ratio' | 'image' | 'video'
        pinterestPhotoPercent: 50,         // 0..100 % (видео = 100 - photo)
        pinterestMaxVideoDuration: 0,      // макс длительность видео в сек (0 = без лимита)
        pinterestAutoFS: true,             // авто разворачивание во весь экран
        autoFS: true,                      // универсальный авто Full Screen
        pinterestHistory: [],              // история до 100 посещенных URL
        pinterestHistoryIdx: -1,           // текущий индекс в истории (как в Проводнике)
        
        hk: {
            download:       [
                { key: 'PageDown',   ctrl: false, alt: false, shift: true },  // Shift+PageDown
                { key: 'PageDown',   ctrl: false, alt: false, shift: false }  // PageDown (резерв)
            ],
            upscale:        { key: 'PageUp',     ctrl: false, alt: false, shift: false },
            deleteVid:      { key: 'Delete',     ctrl: false, alt: false, shift: false },
            sound:          { key: 'ScrollLock', ctrl: false, alt: false, shift: false },
            playPause:      { key: 'Pause',      ctrl: false, alt: false, shift: false },
            help:           { key: 'F1',         ctrl: true,  alt: false, shift: false },
            history:        { key: 'Home',       ctrl: false, alt: false, shift: false },
            slideshowPanel: { key: 'Insert',     ctrl: true,  alt: false, shift: false },
            slideshowStart: { key: 'Insert',     ctrl: false, alt: false, shift: false },
            focusWidget:    { key: 'F7',         ctrl: false, alt: false, shift: false },
            nextSlide:      { key: ' ',          ctrl: false, alt: false, shift: false }, // Пробел — сдвинуть слайд
            duplicateNext:  { key: ' ',          ctrl: true,  alt: false, shift: false }, // Ctrl+Пробел — открыть в фоне + сдвинуть
            rewind:         { key: 'r',          ctrl: false, alt: true,  shift: false }, // Alt+R — перемотка
            updateScript:   { key: 'r',          ctrl: false, alt: true,  shift: false, meta: true }, // Win+Alt+R — обновить скрипт
        }
    };

    let config = {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        config = stored ? JSON.parse(stored) : {};
    } catch (e) {}

    function mergeDeep(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], mergeDeep(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }
    config = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), config);
    // Сброс при рефреше страницы
    config.downloadType = 'none';

    // Миграция старых настроек скачивания (если там был объект)
    if (!Array.isArray(config.hk.download)) {
        config.hk.download = JSON.parse(JSON.stringify(DEFAULT_CONFIG.hk.download));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    const Settings = {
        get: () => config,
        save: () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleSyncPush(); // Запускаем батч-синхронизацию
        },
        // Сохранить без ре-рендера UI (для текстовых полей — не сбивает фокус)
        saveQuiet: () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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

