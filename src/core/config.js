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
        playlistWidth: 0,                // ширина списка плейлиста в px (0 = авто под ширину меню)
        widgetZoom: 1.0,                 // масштаб виджета (1.0 = 100%)
        
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
            download:         { key: 'PageDown',   ctrl: false, alt: false, shift: false }, // PageDown — скачать
            upscale:          { key: 'PageUp',     ctrl: true,  alt: false, shift: false }, // Ctrl+PageUp
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
            nextSlide:        [
                { key: 'ArrowRight', ctrl: false, alt: false, shift: false },
                { key: ' ',          ctrl: false, alt: false, shift: false }  // Пробел (резерв)
            ],
            prevSlide:        { key: 'ArrowLeft',  ctrl: false, alt: false, shift: false },
            nextGroup:        { key: 'PageDown',   ctrl: false, alt: true,  shift: false }, // Alt+PageDown
            prevGroup:        { key: 'PageUp',     ctrl: false, alt: true,  shift: false }, // Alt+PageUp
            duplicateNext:    { key: ' ',          ctrl: true,  alt: false, shift: false }, // Ctrl+Пробел — открыть в фоне + сдвинуть
            rewind:           { key: 'r',          ctrl: false, alt: true,  shift: false }, // Alt+R — перемотка
            updateScript:     { key: 'r',          ctrl: false, alt: true,  shift: false, meta: true }, // Win+Alt+R — обновить скрипт
            videoGen6s:       { key: 'Enter',      ctrl: false, alt: false, shift: true },  // Shift+Enter — видео 6с Grok
            videoGen10s:      { key: 'Enter',      ctrl: true,  alt: false, shift: false }, // Ctrl+Enter — видео 10с Grok
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
    // Для RedGifs дефолтные настройки сайта (направление down, шаблон {userName}-{domain[4]})
    if (rootDomain.includes('redgifs.com')) {
        let storedHasDir = false;
        let storedHasTpl = false;
        let storedHasTplEnabled = false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.slideshowDirections) storedHasDir = true;
                if (parsed.filenameTemplate !== undefined) storedHasTpl = true;
                if (parsed.filenameTemplateEnabled !== undefined) storedHasTplEnabled = true;
            }
        } catch(e) {}
        if (!storedHasDir || (config.slideshowDirections && config.slideshowDirections[0] === 'up')) {
            config.slideshowDirections = ['down'];
        }
        if (!storedHasTpl) {
            config.filenameTemplate = '{userName}-{domain[4]}';
        }
        if (!storedHasTplEnabled) {
            config.filenameTemplateEnabled = true;
        }
    }

    // Для Grok дефолтный шаблон {conv4}-{id4}-{domain}.{ext}
    if (rootDomain === 'grok.com') {
        let storedHasTpl = false;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.filenameTemplate !== undefined && parsed.filenameTemplate !== '{id8}-{domain}.{ext}') {
                    storedHasTpl = true;
                }
            }
        } catch(e) {}
        if (!storedHasTpl || config.filenameTemplate === '{id8}-{domain}.{ext}') {
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
        config.hk.nextSlide = [
            { key: 'ArrowRight', ctrl: false, alt: false, shift: false },
            { key: ' ', ctrl: false, alt: false, shift: false }
        ];
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

    // Миграция v1.3.19: видеогенерация Grok (Shift+Enter / Ctrl+Enter)
    if (!config.hk.videoGen6s) {
        config.hk.videoGen6s = { key: 'Enter', ctrl: false, alt: false, shift: true };
    }
    if (!config.hk.videoGen10s) {
        config.hk.videoGen10s = { key: 'Enter', ctrl: true, alt: false, shift: false };
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

    // Глобальная синхронизация шаблона имени файла через GM_getValue
    if (typeof GM_getValue === 'function') {
        const gmTpl = GM_getValue('mossad_tpl_' + rootDomain, null);
        if (gmTpl && typeof gmTpl === 'string') {
            config.filenameTemplate = gmTpl;
        }
    }

    const Settings = {
        get: () => config,
        save: () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            if (typeof GM_setValue === 'function' && config.hk) {
                GM_setValue('mossad_hk_global', JSON.stringify(config.hk));
            }
            if (window.updateWidgetUI) window.updateWidgetUI();
            scheduleSyncPush();
            if (showToastNotice && typeof showToast === 'function') {
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
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
                    }
                }
            } catch(e) {}
        }
    });

