// ==UserScript==
// @name         MOSSAD (Media Objects Slideshow and Download)
// @namespace    http://tampermonkey.net/
// @version      1.3.21
// @description  Универсальный скрипт для авто-слайдшоу, скачивания медиа и горячих клавиш.
// @author       Antigravity
// @match        *://*/*
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      pinimg.com
// @connect      *.pinimg.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.3.21';
    console.log(`%c[MOSSAD v${SCRIPT_VERSION}] Скрипт загружен`, 'color:#10b981; font-weight:bold');

    const hostname = location.hostname.toLowerCase();
    
    function getRootDomain(host) {
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }
    const rootDomain = getRootDomain(hostname);
    const STORAGE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_config`;

    // Загрузка конфига из localStorage для проверки allowedDomains
    const _quickCfg = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } })();
    const _allowedDomains = _quickCfg.allowedDomains || ['grok.com','redgifs.com','pinterest.com','pinterest.ru','civitai.red','vkvideo.ru','vk.video','noodlemagazine.com','instagram.com'];
    const _isAllowed = _allowedDomains.some(d => hostname.includes(d.split('/')[0]));
    if (!_isAllowed) {
        // Показываем маленькую кнопку «+ Добавить сайт в MOSSAD»
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.createElement('button');
            btn.id = 'mossad-add-site';
            btn.textContent = '➕ MOSSAD';
            btn.title = 'Добавить этот сайт в MOSSAD';
            btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999999;background:rgba(20,20,20,0.85);color:#60a5fa;border:1px solid #374151;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:system-ui;backdrop-filter:blur(8px);';
            btn.onclick = () => {
                const cfg = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } })();
                const domains = cfg.allowedDomains || _allowedDomains;
                if (!domains.includes(hostname)) domains.push(hostname);
                cfg.allowedDomains = domains;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
                btn.textContent = '✅ Добавлено! Перезагрузи страницу';
                btn.style.color = '#10b981';
            };
            document.body.appendChild(btn);
        });
        return; // Выход — сайт не в списке
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
            download:         { key: 'PageDown',   ctrl: false, alt: false, shift: true },  // Shift+PageDown
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
                { key: 'PageDown',   ctrl: false, alt: false, shift: false },
                { key: ' ',          ctrl: false, alt: false, shift: false }  // Пробел (резерв)
            ],
            prevSlide:        { key: 'PageUp',     ctrl: false, alt: false, shift: false },
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

    // Миграция старых настроек скачивания (если там был объект или дублирующий PageDown)
    if (Array.isArray(config.hk.download)) {
        config.hk.download = config.hk.download.filter(h => !(h && h.key === 'PageDown' && !h.ctrl && !h.alt && !h.shift));
        if (config.hk.download.length === 0) {
            config.hk.download = [{ key: 'PageDown', ctrl: false, alt: false, shift: true }];
        }
    } else if (!config.hk.download || (config.hk.download.key === 'PageDown' && !config.hk.download.ctrl && !config.hk.download.alt && !config.hk.download.shift)) {
        config.hk.download = { key: 'PageDown', ctrl: false, alt: false, shift: true };
    }

    // Миграция: переносим upscale с PageUp на Ctrl+PageUp во избежание конфликта со слайдером
    if (config.hk.upscale && config.hk.upscale.key === 'PageUp' && !config.hk.upscale.ctrl && !config.hk.upscale.alt && !config.hk.upscale.shift) {
        config.hk.upscale = { key: 'PageUp', ctrl: true, alt: false, shift: false };
    }

    // Миграция: инициализация prevSlide (PageUp) и nextSlide (PageDown)
    if (!config.hk.prevSlide) {
        config.hk.prevSlide = { key: 'PageUp', ctrl: false, alt: false, shift: false };
    }
    if (!config.hk.nextSlide || (Array.isArray(config.hk.nextSlide) && !config.hk.nextSlide.some(h => h && h.key === 'PageDown'))) {
        const spaceHk = { key: ' ', ctrl: false, alt: false, shift: false };
        config.hk.nextSlide = [{ key: 'PageDown', ctrl: false, alt: false, shift: false }, spaceHk];
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
                            Object.assign(config, decoded);
                            config.githubToken = token;
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
        parts.push(hk.key);
        return parts.join('+');
    }
    function hotkeyMatches(e, hk) {
        if (!hk) return false;
        if (Array.isArray(hk)) return hk.some(k => hotkeyMatches(e, k));
        if (!hk.key) return false;
        const keyMatch = e.key === hk.key || (typeof e.key === 'string' && typeof hk.key === 'string' && e.key.toLowerCase() === hk.key.toLowerCase());
        return keyMatch &&
            !!e.ctrlKey  === !!hk.ctrl &&
            !!e.altKey   === !!hk.alt &&
            !!e.shiftKey === !!hk.shift &&
            (hk.meta === undefined ? true : !!e.metaKey === !!hk.meta);
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
    // GENERAL HELPERS & RETRY ENGINE
    // ============================================

    /**
     * Снимает фокус с активного поля ввода, если он там остался.
     */
    function blurActiveInput() {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
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
     * Выполняет пост-действие после фактического скачивания (+1 или del).
     * Срабатывает ТОЛЬКО когда скачивание реально началось, а не при блокировке дубликата.
     */
    function performPostDownloadAction() {
        if (!config || config.pdAction === 'none') return;
        if (config.pdAction === 'up') {
            setTimeout(() => {
                const dirs = config.slideshowDirections;
                const key = getArrowKey(dirs && dirs.length ? dirs[0] : 'up');
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                if (typeof triggerUniversalFullScreen === 'function') {
                    triggerUniversalFullScreen();
                }
            }, 600);
        } else if (config.pdAction === 'del' && rootDomain === 'grok.com') {
            setTimeout(() => {
                if (typeof runSmartDelete === 'function') {
                    runSmartDelete();
                }
            }, 1000);
        }
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
            document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));

            setTimeout(() => {
                if (location.href === lastUrl) {
                    unchangedCount++;
                    if (unchangedCount >= 5) {
                        clearInterval(interval);
                        _isRewinding = false;
                        window._isRewinding = false;
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
        if (typeof rootDomain !== 'undefined' && rootDomain.includes('redgifs.com')) {
            return '{userName}-{domain[4]}';
        }
        if (typeof rootDomain !== 'undefined' && rootDomain === 'grok.com') {
            return '{conv4}-{id4}-{domain}.{ext}';
        }
        return '{id8}-{domain}.{ext}';
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
            : (typeof getDefaultFilenameTemplate === 'function' ? getDefaultFilenameTemplate() : '{id8}-{domain}.{ext}');

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
    function triggerDirectBlobDownload(url, filename, onErrorCallback) {
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
                        if (typeof saveFileToHistory === 'function') {
                            saveFileToHistory({
                                hash: '',
                                filename,
                                rootFilename: (typeof extractRootFilename === 'function') ? extractRootFilename(filename) : '',
                                url: location.href,
                                postUrl: location.href,
                                domain: rootDomain
                            });
                        }
                    },
                    onerror: (err) => {
                        console.warn('[MOSSAD] GM_download failed, trying fallback:', err);
                        _downloadViaXhrOrFetch(url, filename, onErrorCallback);
                    }
                });
                return;
            } catch(e) {
                console.warn('[MOSSAD] GM_download call exception:', e);
            }
        }
        _downloadViaXhrOrFetch(url, filename, onErrorCallback);
    }

    function _downloadViaXhrOrFetch(url, filename, onErrorCallback) {
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
                        saveBlobToDisk(res.response, filename);
                    } else {
                        if (onErrorCallback) onErrorCallback();
                        else fetchBlobFallback(url, filename);
                    }
                },
                onerror: () => {
                    if (onErrorCallback) onErrorCallback();
                    else fetchBlobFallback(url, filename);
                }
            });
        } else {
            if (onErrorCallback) onErrorCallback();
            else fetchBlobFallback(url, filename);
        }
    }

    function downloadBlobMedia(url, filename) {
        triggerDirectBlobDownload(url, filename);
    }

    function fetchAndDownloadBlob(url, filename) {
        triggerDirectBlobDownload(url, filename);
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        }).then(blob => saveBlobToDisk(blob, filename))
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

    function saveBlobToDisk(blob, filename) {
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            computeSHA256(blob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: (typeof extractRootFilename === 'function') ? extractRootFilename(filename) : '',
                    url: location.href,
                    postUrl: location.href,
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
                                if (!res.rootFilename && typeof extractRootFilename === 'function') {
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
            const cleanRoot = rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(filename) : (filename || '').replace(/\.[^/.]+$/, '').trim());

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
     */
    function showDuplicateDownloadNotice(record, onConfirmDownload) {
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

        // Сохраняем ожидание подтверждения
        _pendingDuplicateConfirm = {
            id: record.id || record.hash || record.url,
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
     */
    function isDuplicateConfirmed(fileIdentifier) {
        if (_pendingDuplicateConfirm && Date.now() <= _pendingDuplicateConfirm.expiresAt) {
            return true;
        }
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
    const _gSS                   = sessionStorage; // короткий псевдоним

    /** Проверка: находимся ли мы на странице поста Grok Imagine */
    function isGrokPostPage() {
        return rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    }

    /** Проверка: находимся ли мы на странице сохраненных постов Grok Imagine */
    function isGrokSavedPage() {
        return rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);
    }

// ============================================================
    // GROK HELPERS: Button Finders & Actions
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
    function toggleGrokSound() {
        if (rootDomain !== 'grok.com') return;
        blurActiveInput();

        // Ищем кнопку звука в интерфейсе плеера Grok
        const soundWords = ['заглушить', 'включить звук', 'звук', 'sound', 'mute', 'unmute'];
        const btn = findGrokButton(soundWords);

        if (btn) {
            triggerClick(btn, 'Grok Sound Toggle');
            const isMuted = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase().includes('включить') ||
                            (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase().includes('unmute');
            showToast(isMuted ? '🔊 Звук включен' : '🔇 Звук выключен');
            return;
        }

        // Фолбэк на HTML5 video, если кнопка в DOM не найдена
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            showToast(video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
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

    let _isGrokInternalClick = false;

    /**
     * Фолбэк на клик нативной кнопки Download при невозможности прямой загрузки.
     * Поиск строго по aria-label="download".
     */
    function fallbackGrokNativeClick(onSuccess) {
        _isGrokInternalClick = true;
        try {
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
        } finally {
            setTimeout(() => { _isGrokInternalClick = false; }, 1000);
        }
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
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl)) {
            checkFileInHistory(null, media ? media.url : null, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record, onDoneCallback));
                } else {
                    triggerGrokDownload(true, null, onDoneCallback);
                }
            });
            return true;
        }

        const prompt = getGrokCurrentPrompt();
        const model = getGrokCurrentModel();
        const promptHash = computeGrokPromptHash(prompt);
        const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
        const shortId4 = currentPostId ? currentPostId.slice(0, 4) : '';
        const shortConv4 = currentConvId ? currentConvId.slice(0, 4) : '';
        const ext2 = media ? media.ext : (hasVid ? 'mp4' : 'jpg');
        const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(duplicateRecord.filename) : (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim())) : '';
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
            grokFilename = typeof renderFilenameTemplate === 'function'
                ? renderFilenameTemplate(config.filenameTemplate, vars, Boolean(duplicateRecord), dblSuffix, ext2)
                : grokFilename;
        }

        const onDownloadFinalized = () => {
            if (typeof performPostDownloadAction === 'function') {
                performPostDownloadAction();
            }
            if (onDoneCallback) onDoneCallback();
        };

        if (media && media.url) {
            showToast(`⏳ Загрузка: ${grokFilename}...`);
            const isBlobUrl = media.url.startsWith('blob:');

            const handleBlobResponse = async (rawBlob) => {
                try {
                    showToast('⏳ Запись метаданных...');
                    const enrichedBlob = await injectGrokMetadataToBlob(rawBlob, prompt, currentPostUrl, model, promptHash);
                    saveBlobToDisk(enrichedBlob, grokFilename);
                    onDownloadFinalized();
                } catch (err) {
                    console.error('[MOSSAD] Metadata injection failed, saving raw blob:', err);
                    saveBlobToDisk(rawBlob, grokFilename);
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

    // Перехват клика по нативной кнопке скачивания Grok на странице
    if (typeof document !== 'undefined') {
        document.addEventListener('click', function handleGrokNativeDownloadClick(e) {
            if (rootDomain !== 'grok.com' || _isGrokInternalClick) return;
            const btn = e.target.closest('button, [role="button"]');
            if (!btn || (btn.id && btn.id.startsWith('mossad-'))) return;

            const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
            const isDl = aria === 'download';

            if (isDl) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('[MOSSAD] Intercepted native Grok download button -> triggerGrokDownload with metadata');
                triggerGrokDownload();
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
     * Возвращает true, если клик выполнен, false — если край или нет киноплёнки.
     */
    function grokStepFilmstrip(isNext = true) {
        const items = grokGetFilmstripItems();
        if (items.length <= 1) return false;
        const curIdx = grokGetActiveFilmstripIndex();
        if (curIdx === -1) return false;
        const nextIdx = isNext ? (curIdx + 1) % items.length : (curIdx - 1 + items.length) % items.length;
        items[nextIdx].click();
        setTimeout(() => {
            if (typeof grokHighlightActivePlaylistItem === 'function') {
                grokHighlightActivePlaylistItem();
            }
        }, 120);
        return true;
    }

    // ============================================================
    // GROK: Video Generation Shortcuts (6s & 10s)
    // ============================================================
    let _isGeneratingGrokVideo = false;

    function findMakeVideoButton() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        // 1. По aria-label или title
        const byLabel = buttons.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            return aria === 'make video' || aria.includes('make video') || aria.includes('создать видео') ||
                   title === 'make video' || title.includes('make video');
        });
        if (byLabel) return byLabel;

        // 2. По SVG стрелке отправки (path: M6 11L12 5M12 5L18 11M12 5V19)
        const bySvg = buttons.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const path = b.querySelector('path');
            const d = path ? (path.getAttribute('d') || '') : '';
            return (d.includes('M6 11L12 5') || d.includes('5V19')) && (b.closest('div.relative.z-10') || (b.className && b.className.includes('rounded-full')));
        });
        return bySvg || null;
    }

    function findGrokVideoModeRadio() {
        const candidates = Array.from(document.querySelectorAll('button[role="radio"], [role="radio"]'));
        return candidates.find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const txt = (b.textContent || '').trim().toLowerCase();
            return aria === 'video' || aria.includes('video') || aria === 'видео' || txt === 'video' || txt === 'видео';
        }) || null;
    }

    function isGrokVideoModeActive() {
        const radio = findGrokVideoModeRadio();
        if (radio) {
            return radio.getAttribute('aria-checked') === 'true';
        }
        // Fallback: если Make video уже есть на экране
        const makeBtn = findMakeVideoButton();
        return Boolean(makeBtn);
    }

    function findVideoDurationButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
        return candidates.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (aria === 'video duration' || aria.includes('video duration') || aria.includes('длительность')) return true;
            if (b.getAttribute('aria-haspopup') === 'menu' && (b.textContent.trim() === '6s' || b.textContent.trim() === '10s')) return true;
            return false;
        }) || null;
    }

    function findDurationMenuItem(targetSeconds) {
        const targetStr = `${targetSeconds}s`.toLowerCase();
        // 1. Поиск элементов меню Radix UI
        const candidates = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], [role="menu"] button, [role="menu"] [tabindex]'));
        for (const item of candidates) {
            if (item.offsetWidth === 0 && item.offsetHeight === 0 && (!item.getClientRects || !item.getClientRects().length)) continue;
            const spans = Array.from(item.querySelectorAll('span'));
            if (spans.some(s => s.textContent.trim().toLowerCase() === targetStr)) {
                return item;
            }
            if (item.textContent.trim().toLowerCase() === targetStr) {
                return item;
            }
        }
        // 2. Поиск любого открытого span с точным текстом "6s" или "10s"
        const allSpans = Array.from(document.querySelectorAll('[role="menu"] span, div[data-radix-popper-content-wrapper] span, span'));
        const matchedSpan = allSpans.find(s => {
            if (s.offsetWidth === 0 && s.offsetHeight === 0 && (!s.getClientRects || !s.getClientRects().length)) return false;
            return s.textContent.trim().toLowerCase() === targetStr;
        });
        if (matchedSpan) {
            return matchedSpan.closest('[role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], button, [tabindex]') || matchedSpan;
        }
        return null;
    }

    function waitForCondition(checkFn, timeoutMs = 2500, intervalMs = 50) {
        return new Promise(resolve => {
            const start = Date.now();
            const timer = setInterval(() => {
                let res = null;
                try { res = checkFn(); } catch(e) {}
                if (res) {
                    clearInterval(timer);
                    return resolve(res);
                }
                if (Date.now() - start >= timeoutMs) {
                    clearInterval(timer);
                    return resolve(null);
                }
            }, intervalMs);
        });
    }

    async function triggerGrokVideoGeneration(targetSeconds = 6) {
        if (rootDomain !== 'grok.com') return;
        if (_isGeneratingGrokVideo) {
            showToast('⏳ Уже выполняется выбор режима видео...');
            return;
        }
        _isGeneratingGrokVideo = true;

        try {
            const targetStr = `${targetSeconds}s`.toLowerCase();

            // ── Шаг 1: Проверка режима «Видео» ──
            if (!isGrokVideoModeActive()) {
                const videoRadio = findGrokVideoModeRadio();
                if (videoRadio) {
                    showToast('🎥 Переключение в режим видео...');
                    triggerClick(videoRadio, 'Switch to Video Mode');
                    const switched = await waitForCondition(() => isGrokVideoModeActive(), 2500);
                    if (!switched) {
                        showToast('⚠️ Не удалось переключить в режим видео', true);
                        _isGeneratingGrokVideo = false;
                        return;
                    }
                } else {
                    console.log('[MOSSAD] Video mode radio not found, proceeding with Make video check');
                }
            }

            // Небольшая пауза для рендера контролов длительности
            await new Promise(r => setTimeout(r, 100));

            // ── Шаг 2: Проверка и выбор длительности (6s / 10s) ──
            const durBtn = await waitForCondition(() => findVideoDurationButton(), 2000);
            if (durBtn) {
                const curText = durBtn.textContent.trim().toLowerCase();
                if (!curText.includes(targetStr)) {
                    showToast(`⏱ Выбор длительности ${targetSeconds}с...`);
                    triggerClick(durBtn, 'Open Video Duration Menu');

                    const menuItem = await waitForCondition(() => findDurationMenuItem(targetSeconds), 2000);
                    if (menuItem) {
                        triggerClick(menuItem, `Select ${targetSeconds}s`);
                        // Ждем обновления текста на кнопке длительности
                        await waitForCondition(() => {
                            const updated = durBtn.textContent.trim().toLowerCase();
                            return updated.includes(targetStr);
                        }, 1500);
                    } else {
                        showToast(`⚠️ Пункт ${targetSeconds}с не найден в меню`, true);
                    }
                }
            }

            // Небольшая пауза перед кликом по финальной кнопке
            await new Promise(r => setTimeout(r, 120));

            // ── Шаг 3: Нажатие кнопки Make video ──
            const makeBtn = await waitForCondition(() => findMakeVideoButton(), 2500);
            if (!makeBtn) {
                showToast('⚠️ Кнопка «Make video» не найдена', true);
                _isGeneratingGrokVideo = false;
                return;
            }

            if (makeBtn.disabled || makeBtn.getAttribute('aria-disabled') === 'true') {
                showToast('⚠️ Кнопка «Make video» неактивна (введите промпт)', true);
                _isGeneratingGrokVideo = false;
                return;
            }

            triggerClick(makeBtn, `Make Video (${targetSeconds}s)`);
            showToast(`🎬 Генерация видео ${targetSeconds}с запущена!`);
        } catch (err) {
            console.error('[MOSSAD] Error in triggerGrokVideoGeneration:', err);
            showToast('❌ Ошибка генерации видео: ' + err.message, true);
        } finally {
            _isGeneratingGrokVideo = false;
        }
    }
    window.triggerGrokVideoGeneration = triggerGrokVideoGeneration;

// ============================================================
    // GROK: Smart Delete (3-dots fallback, a.confirm, hold-post)
    // ============================================================
    function getGrokNeighborPostUrl() {
        // 1. Проверяем карточки постов в текущем DOM
        const cards = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        const currentIdMatch = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
        const currentId = currentIdMatch ? currentIdMatch[1] : null;

        if (cards.length > 0 && currentId) {
            const urls = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
            const seen = new Map();
            for (const u of urls) {
                const m = u.match(/\/imagine\/post\/([^/?#]+)/);
                if (m && !seen.has(m[1])) seen.set(m[1], u);
            }
            const unique = Array.from(seen.keys());
            const idx = unique.indexOf(currentId);
            const dir = (config.slideshowDirections && config.slideshowDirections.length) ? config.slideshowDirections[0] : 'up';

            let targetId = null;
            if (dir === 'down' || dir === 'right') {
                targetId = (idx >= 0 && idx < unique.length - 1) ? unique[idx + 1] : (unique.length > 0 ? unique[0] : null);
            } else {
                targetId = (idx > 0) ? unique[idx - 1] : (unique.length > 0 ? unique[unique.length - 1] : null);
            }
            if (targetId && seen.get(targetId)) return seen.get(targetId);
        }

        // 2. Проверяем ссылки из сохраненной коллекции галереи
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw && currentId) {
                const items = (JSON.parse(raw).items || []).map(i => i.url || i);
                const idx = items.findIndex(u => u.includes(currentId));
                if (idx !== -1) {
                    const nextIdx = (idx + 1) % items.length;
                    return items[nextIdx];
                }
            }
        } catch (e) {}

        return null;
    }

    let _grokDeleteInProgress = false;

    async function runSmartDelete() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        if (_grokDeleteInProgress) return;
        _grokDeleteInProgress = true;

        try {
            blurActiveInput();
            const initialUrl = location.href;
            let finalTargetUrl = null;

            let targetFilmstripBtn = null;
            let targetFilmstripUuid = null;

            // 1. hold post: определяем целевой кадр / пост перед удалением
            if (config.deleteHoldpost) {
                // А. Приоритет: кадры на полосе киноплёнки (filmstrip)
                const items = (typeof grokGetFilmstripItems === 'function')
                    ? grokGetFilmstripItems()
                    : Array.from(document.querySelectorAll('[data-filmstrip-item="true"]'));

                if (items.length > 1) {
                    const currentIdx = items.findIndex(btn => 
                        btn.className.includes('ring-white') || 
                        location.pathname.includes(btn.querySelector('img')?.src.match(/generated\/([a-f0-9-]+)\//)?.[1] || '---')
                    );
                    const safeCurIdx = currentIdx !== -1 ? currentIdx : ((typeof grokGetActiveFilmstripIndex === 'function') ? grokGetActiveFilmstripIndex() : 0);
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    const isFwd = (dPadDir === 'down' || dPadDir === 'right');

                    let nextIdx;
                    if (isFwd) {
                        // Д-пад вниз/вправо: шагаем на следующее видео вниз по ленте
                        nextIdx = (safeCurIdx + 1 < items.length) ? safeCurIdx + 1 : (safeCurIdx > 0 ? safeCurIdx - 1 : 0);
                    } else {
                        // Д-пад вверх/влево: шагаем на предыдущее видео вверх по ленте (на 4-е от 5-го)
                        nextIdx = (safeCurIdx > 0) ? safeCurIdx - 1 : (items.length > 1 ? 1 : 0);
                    }
                    targetFilmstripBtn = items[nextIdx];

                    const nextImgSrc = targetFilmstripBtn?.querySelector('img, video, source')?.src || '';
                    const m = nextImgSrc.match(/generated\/([a-f0-9-]+)\//);
                    targetFilmstripUuid = m ? m[1] : (typeof grokExtractUuid === 'function' ? grokExtractUuid(nextImgSrc) : null);
                    if (targetFilmstripUuid) {
                        finalTargetUrl = `/imagine/post/${targetFilmstripUuid}`;
                    }
                    console.log(`[MOSSAD] hold post: DPad=${dPadDir} (${isFwd ? 'вниз' : 'вверх'}), целевой кадр: ${safeCurIdx + 1} -> ${nextIdx + 1} (UUID: ${targetFilmstripUuid || 'н/д'})`);
                } else {
                    // Б. Киноплёнка из 1 кадра или не найдена — ищем URL соседа по коллекции / DOM
                    finalTargetUrl = getGrokNeighborPostUrl();
                    console.log('[MOSSAD] hold post: киноплёнка одиночная/отсутствует, fallback URL соседа:', finalTargetUrl);
                }

                // В. Крайний фолбэк: шаг стрелками, если нет киноплёнки и не найден URL соседа
                if (!targetFilmstripBtn && !finalTargetUrl) {
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'up';
                    const forwardKey = getArrowKey(dPadDir);
                    const oppDir = dPadDir === 'up' ? 'down' : (dPadDir === 'down' ? 'up' : (dPadDir === 'left' ? 'right' : 'left'));
                    const backKey = getArrowKey(oppDir);

                    showToast('🔍 Фиксация позиции...');

                    const sendKey = (k) => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                        document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
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
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];

            let deleteConfirmed = false;
            const triggerConfirm = () => {
                if (!config.deleteAutoconfirm) return Promise.resolve(false);
                return new Promise((resolve) => {
                    retryAction((attempt) => {
                        const confirmKeywords = ['удалить изображение', 'удалить видео', 'удалить', 'delete', 'confirm', 'ok', 'yes', 'да'];
                        const dialog = document.querySelector('[role="dialog"]') || document;
                        const confirmBtn = findGrokButton(confirmKeywords, dialog);
                        if (confirmBtn) {
                            triggerClick(confirmBtn, 'Confirm Delete');
                            console.log('[MOSSAD] Delete confirmed on attempt', attempt);
                            deleteConfirmed = true;
                            resolve(true);
                            return true;
                        }
                        if (attempt === 4) resolve(false);
                        return false;
                    }, [100, 250, 450, 750]);
                });
            };

            const directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;

            if (directDelBtn) {
                triggerClick(directDelBtn, 'Delete Button');
                showToast('✕ Удаление...');
                deleteClicked = true;
            } else {
                const dotsBtn = findGrok3DotsMenuButton();
                if (dotsBtn) {
                    triggerClick(dotsBtn, 'Post actions (for Delete)');
                    deleteClicked = await new Promise((resolve) => {
                        retryAction((attempt) => {
                            const innerDel = findGrokButton(deleteBtnLabels);
                            if (innerDel) {
                                triggerClick(innerDel, 'Delete Button (from menu)');
                                showToast('✕ Удаление...');
                                resolve(true);
                                return true;
                            }
                            if (attempt === 3) resolve(false);
                            return false;
                        }, [100, 250, 450]);
                    });
                }
            }

            if (!deleteClicked) {
                showToast('⚠️ Кнопка удаления не найдена', true);
                _grokDeleteInProgress = false;
                return;
            }

            // Ожидаем подтверждения удаления
            await triggerConfirm();

            // 3. hold post: переход на следующий кадр / пост без перезагрузки страницы
            if (config.deleteHoldpost) {
                const executeTransition = () => {
                    // А. Приоритет: переключение по киноплёнке (только видео, без перезагрузки)
                    if (targetFilmstripBtn) {
                        console.log('[MOSSAD] hold post: переключаем кадр по киноплёнке (SPA, без перезагрузки)...');
                        showToast('🎯 Переход к следующему кадру...');

                        if (targetFilmstripBtn.isConnected) {
                            targetFilmstripBtn.click();
                            return;
                        }

                        // Если DOM обновился, ищем по UUID
                        if (targetFilmstripUuid && typeof grokFindFilmstripItemByUuid === 'function') {
                            const refetched = grokFindFilmstripItemByUuid(targetFilmstripUuid);
                            if (refetched) {
                                refetched.click();
                                return;
                            }
                        }

                        // Или первый доступный кадр в киноплёнке
                        const currentItems = (typeof grokGetFilmstripItems === 'function')
                            ? grokGetFilmstripItems()
                            : Array.from(document.querySelectorAll('[data-filmstrip-item="true"]'));
                        if (currentItems.length > 0) {
                            currentItems[0].click();
                            return;
                        }
                    }

                    // Б. Межпостовой переход через SPA-роутер (если киноплёнки не было)
                    if (finalTargetUrl) {
                        console.log(`[MOSSAD] hold post: переход на сохранённый URL: ${finalTargetUrl}`);
                        showToast('🎯 Переход к соседнему посту...');
                        if (typeof grokSpaNavigate === 'function') {
                            grokSpaNavigate(finalTargetUrl);
                        } else {
                            window.location.href = finalTargetUrl;
                        }
                    }
                };

                if (deleteConfirmed) {
                    // Небольшая задержка (150мс), чтобы сетевой запрос на удаление успел инициироваться
                    await new Promise(r => setTimeout(r, 150));
                    executeTransition();
                } else if (!config.deleteAutoconfirm) {
                    // При ручном подтверждении ждём закрытия диалога
                    const waitStart = Date.now();
                    const checkInterval = setInterval(() => {
                        const dialog = document.querySelector('[role="dialog"]');
                        if (!dialog || Date.now() - waitStart > 15000) {
                            clearInterval(checkInterval);
                            if (!dialog && Date.now() - waitStart < 14500) {
                                setTimeout(executeTransition, 150);
                            }
                        }
                    }, 100);
                } else {
                    // Фолбэк, если автоподтверждение не вернуло подтверждение
                    await new Promise(r => setTimeout(r, 300));
                    executeTransition();
                }
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

    /** Собирает все уникальные ссылки /imagine/post/... из DOM в хронологическом порядке (снизу вверх страницы) */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        // Идём от конца к началу DOM: всё, что в самом низу, создавалось раньше (хронологический порядок)
        for (let i = anchors.length - 1; i >= 0; i--) {
            const a = anchors[i];
            const href = a.getAttribute('href') || '';
            if (!href) continue;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            // Нормализуем URL (убираем query-string для дедупликации по базовому URL поста)
            const baseUrl = url.split('?')[0];
            if (seen.has(baseUrl)) continue;
            seen.add(baseUrl);
            // Карточка — ближайший listitem / masonry-item родитель
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            // Видео = есть span с классом tabular-nums (таймер 0:06)
            const hasTimer = !!(card && card.querySelector('span.tabular-nums'));
            // Conversation ID из ?conversation=UUID параметра
            let convId = null;
            try {
                const urlObj = new URL(url, 'https://grok.com');
                convId = urlObj.searchParams.get('conversation') || null;
            } catch(e) {}
            items.push({ url, type: hasTimer ? 'video' : 'photo', convId });
        }
        return items;
    }



    /** Кнопка 1: сохранить коллекцию в sessionStorage (накопительное добавление, список только увеличивается) */
    function grokSaveCollection(btnEl) {
        const foundItems = grokCollectLinks();
        if (foundItems.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
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
            const base = (it.url || '').split('?')[0].toLowerCase();
            if (!seenUrls.has(base)) {
                seenUrls.add(base);
                mergedItems.push(it);
            }
        }

        // 2. Добавляем новые элементы, которых ещё не было
        let addedCount = 0;
        for (const it of foundItems) {
            const base = (it.url || '').split('?')[0].toLowerCase();
            if (!seenUrls.has(base)) {
                seenUrls.add(base);
                mergedItems.push(it);
                addedCount++;
            }
        }

        const grpMode  = existingData.grpMode  || 'seq';
        const itemMode = existingData.itemMode || 'fwd';
        const date     = new Date().toISOString().slice(0, 10);
        const videos   = mergedItems.filter(i => i.type === 'video').length;
        const photos   = mergedItems.length - videos;

        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({
            date,
            items: mergedItems,
            grpMode,
            itemMode
        }));

        if (btnEl) {
            btnEl.textContent = String(mergedItems.length);
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
            if (typeof grokTogglePlaylistPanel === 'function') {
                grokTogglePlaylistPanel(true);
            }
        }

        if (addedCount > 0) {
            showToast(`✅ Добавлено +${addedCount}! Всего в списке: ${mergedItems.length} (📹${videos}, 🖼${photos})`);
        } else {
            showToast(`ℹ️ Новых ссылок нет. В списке: ${mergedItems.length} (📹${videos}, 🖼${photos})`);
        }
    }

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
        const blob = new Blob([items.map(i => `${i.url}\t${i.type}`).join('\n')], { type: 'text/plain' });
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
    function grokGetPlaylistStructure() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return null;
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
        const curUuid = (typeof grokExtractUuid === 'function')
            ? grokExtractUuid(targetUrl)
            : (targetUrl.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
        const cleanTarget = targetUrl.split('?')[0].toLowerCase();

        const isMatch = (item) => {
            if (!item || !item.url) return false;
            if (curUuid) {
                const itemUuid = (typeof grokExtractUuid === 'function')
                    ? grokExtractUuid(item.url)
                    : (item.url.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
                if (itemUuid && itemUuid.toLowerCase() === curUuid.toLowerCase()) return true;
            }
            return (item.url.split('?')[0].toLowerCase() === cleanTarget);
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
    function grokGetNextSlideItem(direction = 'auto', overrideUrl = null) {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) return null;

        const curPos = grokFindCurrentPosition(struct, overrideUrl);

        // ── 1. Зацикленный набор (R / loopSet) ──
        let loopSet = { urls: [], groupIds: [] };
        try {
            const lr = _gSS.getItem('mossad_grok_loop_set');
            if (lr) loopSet = JSON.parse(lr);
        } catch(e) {}
        const loopUrls = loopSet.urls || [];
        const loopGroupIds = loopSet.groupIds || [];

        if (loopUrls.length > 0 || loopGroupIds.length > 0) {
            const loopItems = struct.items.filter(item => {
                const base = (item.url || '').split('?')[0].toLowerCase();
                const inUrls = loopUrls.some(u => u.split('?')[0].toLowerCase() === base);
                const inGrps = loopGroupIds.includes(item.convId || '__noconv__');
                return inUrls || inGrps;
            });
            if (loopItems.length > 0) {
                const curLoopIdx = loopItems.findIndex(item => {
                    if (!curPos || !curPos.currentItem) return false;
                    return (item.url || '').split('?')[0].toLowerCase() === (curPos.currentItem.url || '').split('?')[0].toLowerCase();
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
                const curBase = (curPos.currentItem?.url || '').split('?')[0].toLowerCase();
                if (!visitedInCircle.includes(curBase)) visitedInCircle.push(curBase);
                const unvisited = struct.items.filter(it => !visitedInCircle.includes((it.url || '').split('?')[0].toLowerCase()));
                if (unvisited.length === 0) {
                    ss.visitedInCircle = [];
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    const rndItem = struct.items[Math.floor(Math.random() * struct.items.length)];
                    return { item: rndItem, circleCompleted: true };
                }
                const rndItem = unvisited[Math.floor(Math.random() * unvisited.length)];
                visitedInCircle.push((rndItem.url || '').split('?')[0].toLowerCase());
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
        const curBase = (curItemForVisited?.url || '').split('?')[0].toLowerCase();
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
            const unvisitedInGrp = curGrp.items.filter(it => !visitedInCurGroup.includes((it.url || '').split('?')[0].toLowerCase()));
            if (unvisitedInGrp.length > 0) {
                nextItemInGrp = unvisitedInGrp[Math.floor(Math.random() * unvisitedInGrp.length)];
            } else {
                groupDone = true;
            }
        }

        if (!groupDone && nextItemInGrp) {
            const newItemIdx = curGrp.items.indexOf(nextItemInGrp);
            visitedInCurGroup.push((nextItemInGrp.url || '').split('?')[0].toLowerCase());
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

        ss.visitedInCurGroup = [(targetItem.url || '').split('?')[0].toLowerCase()];
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
        const baseUrl = url.split('?')[0];
        return set.urls.some(u => (u || '').split('?')[0] === baseUrl);
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
            const baseUrl = (it.url || '').split('?')[0];
            const inUrls = set.urls.some(u => (u || '').split('?')[0] === baseUrl);
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
            const targetUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(urlObj.pathname)
                : (urlObj.pathname.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];

            const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
            const isPostPage = typeof isGrokPostPage === 'function' ? isGrokPostPage() : location.pathname.includes('/imagine/post/');

            if (isPostPage && struct) {
                const targetPos = (typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct, url) : null;
                const currentPos = (typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct) : null;

                const isSameGroup = targetPos && currentPos &&
                                    targetPos.grpIndex !== -1 &&
                                    targetPos.grpIndex === currentPos.grpIndex;

                if (isSameGroup) {
                    // Та же conversation → filmstrip click, без перезагрузки страницы
                    let filmstripBtn = null;
                    if (targetUuid && typeof grokFindFilmstripItemByUuid === 'function') {
                        filmstripBtn = grokFindFilmstripItemByUuid(targetUuid);
                    }
                    if (!filmstripBtn && typeof grokGetFilmstripItems === 'function') {
                        const filmItems = grokGetFilmstripItems();
                        if (targetPos.itemInGrpIndex >= 0 && targetPos.itemInGrpIndex < filmItems.length) {
                            filmstripBtn = filmItems[targetPos.itemInGrpIndex];
                        }
                    }

                    if (filmstripBtn) {
                        console.log('[MOSSAD] grokSpaNavigate: та же conversation → filmstrip click');
                        filmstripBtn.click();
                        try { history.replaceState(null, '', path); } catch(e) {}
                        let checks = 0;
                        const checkInterval = setInterval(() => {
                            checks++;
                            const curUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(location.pathname) : '';
                            if ((curUuid && targetUuid && curUuid === targetUuid.toLowerCase()) || checks >= 6) {
                                clearInterval(checkInterval);
                                if (typeof grokGallerySlideshowTick === 'function') grokGallerySlideshowTick();
                            }
                        }, 40);
                        return;
                    }
                }
            }
        } catch(e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // Другая conversation или нет filmstrip → полный переход по URL
        console.log('[MOSSAD] grokSpaNavigate: другая conversation → location.href', url);
        window.location.href = url;
    }

    /** Звуковой сигнал окончания круга (до-ми-соль) */
    function playCircleDoneSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
            });
        } catch(e) { /* AudioContext может быть заблокирован */ }
    }


    /** Запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
        if (!struct || !struct.items.length) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }

        // Если уже стоим на элементе из коллекции — стартуем прямо с него!
        let startItem = null;
        const curPos = (typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct) : null;
        if (curPos && curPos.currentItem) {
            startItem = curPos.currentItem;
        } else {
            // Выбираем стартовую группу
            let startGrp = null;
            if (struct.grpMode === 'rev') {
                startGrp = struct.groups[struct.groups.length - 1];
            } else if (struct.grpMode === 'rnd') {
                startGrp = struct.groups[Math.floor(Math.random() * struct.groups.length)];
            } else {
                startGrp = struct.groups[0];
            }
            if (startGrp && startGrp.items.length) {
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
        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
        if (!struct || !struct.items.length) {
            showToast('⚠️ Коллекция не собрана', true);
            return;
        }

        // Немедленно останавливаем любые активные таймеры предыдущего видео/слайда!
        if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
        isCountingDown = false;
        countdownSeconds = 0;
        currentLoopCount = 0;
        accumulatedTime = 0;

        const startBase = (startItem.url || '').split('?')[0].toLowerCase();
        const startGid = startItem.convId || '__noconv__';
        const startUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(startItem.url) : '';

        // Ищем явную позицию стартового элемента в структуре
        let startGrpIdx = 0, startItemIdx = 0;
        for (let _g = 0; _g < struct.groups.length; _g++) {
            const _i = struct.groups[_g].items.findIndex(it =>
                (it.url || '').split('?')[0].toLowerCase() === startBase);
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
            visitedInCircle: [startBase]
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
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
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(startItem.url);
        }

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);

        const curClean = location.href.split('?')[0].toLowerCase();
        if (curClean === startBase) {
            grokGallerySlideshowTick();
        } else {
            setTimeout(() => { grokSpaNavigate(startItem.url); }, 150);
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
            btn.textContent = '❚❚';
            btn.title = 'Пауза';
            btn.style.background = '#059669';
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = '1px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else if (state === 'paused') {
            btn.textContent = '▶';
            btn.title = 'Продолжить';
            btn.style.background = '#d97706';
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else {
            btn.textContent = 'Слайдшоу';
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
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(false);
            sessionStorage.removeItem('mossad_gallery_paused');
            updateGalleryStatusBtn('playing');
            showToast('▶ Продолжаем');
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
        }
    }

    /** Выполняет шаг к следующему слайду по логике плейлиста */
    function grokGalleryStepNext() {
        const nextRes = (typeof grokGetNextSlideItem === 'function')
            ? grokGetNextSlideItem('auto')
            : null;
        if (!nextRes || !nextRes.item) return;

        if (nextRes.circleCompleted) {
            playCircleDoneSound();
            let ss = {};
            try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
            ss.circle = (ss.circle || 1) + 1;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            showToast(`🔄 Круг ${ss.circle} начался!`);
        }

        let ss = {};
        try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
        ss.targetUrl = nextRes.item.url;
        ss.targetUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(nextRes.item.url) : '';
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
        grokSpaNavigate(nextRes.item.url);
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;

        if (sessionStorage.getItem('mossad_navigating_group') === 'true') {
            sessionStorage.removeItem('mossad_navigating_group');
        }

        // Проверяем, стояло ли слайдшоу на паузе до перехода
        const isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                         (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');
        window._mossadGalleryPaused = isPaused;
        if (typeof setSlideshowPaused === 'function') setSlideshowPaused(isPaused);

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


        const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;



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
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(ss.targetUrl || null);
        }

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            grokGalleryStepNext();
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = isPaused;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        if (!isPaused) {
            setTimeout(() => scheduleNextSlideCycle(0), 300);
        }
    }

    // Фасад для явного контракта MOSSAD GALLERY
    window.MOSSAD_GALLERY = {
        isActive: () => !!window._mossadGalleryActive,
        isPaused: () => !!window._mossadGalleryPaused,
        next: () => {
            if (typeof window._mossadGalleryNextFn === 'function') {
                window._mossadGalleryNextFn();
            }
        },
        pause: toggleGalleryPause,
        stop: grokStopGallerySlideshow,
        start: grokStartGallerySlideshow,
        highlightActive: (url) => (typeof grokHighlightActivePlaylistItem === 'function' ? grokHighlightActivePlaylistItem(url) : null),
        togglePlaylist: (force) => (typeof grokTogglePlaylistPanel === 'function' ? grokTogglePlaylistPanel(force) : null)
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
            width: fit-content; max-width: 100%; box-sizing: border-box;
        `;

        // ── Утилита создания маленьких кнопок ──
        const mkBtn = (id, text, title, css) => {
            const b = document.createElement('button');
            b.id = id; b.textContent = text; b.title = title;
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
        btnCollect.textContent = savedCount > 0 ? String(savedCount) : 'Собрать';
        btnCollect.title = savedCount > 0 ? `Коллекция (${savedCount}): открыть список` : 'Собрать коллекцию ссылок';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:3px 7px;font-weight:700;font-size:11px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;

        // Клик: на /saved — собирать; иначе — открывать плейлист (если есть коллекция)
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else if (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0) {
                grokTogglePlaylistPanel();
            } else {
                showToast('ℹ️ Переход на /imagine/saved для сбора...');
                setTimeout(() => { window.location.href = 'https://grok.com/imagine/saved'; }, 300);
            }
        };

        // Правый клик: очистить коллекцию
        btnCollect.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm('Очистить собранную коллекцию?')) {
                _gSS.removeItem(GALLERY_COLLECTION_KEY);
                btnCollect.textContent = 'Собрать';
                btnCollect.dataset.collectedCount = '0';
                btnCollect.style.background = '#1f2937';
                btnCollect.style.color = '#e5e7eb';
                const pl = document.getElementById('mossad-playlist-panel');
                if (pl) pl.remove();
                showToast('🗑 Коллекция очищена');
            }
        };


        if (isGrokSavedPage()) {
            // Мониторим появление новых ссылок на странице каждые 2с (количество только увеличивается!)
            setInterval(() => {
                let currentTotal = savedCount;
                const existingUrls = new Set();
                try {
                    const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                    if (cRaw) {
                        const items = JSON.parse(cRaw).items || [];
                        currentTotal = items.length;
                        items.forEach(it => existingUrls.add((it.url || '').split('?')[0].toLowerCase()));
                    }
                } catch(e) {}

                if (currentTotal === 0 && !btnCollect.dataset.collectedCount) return;

                const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
                let uncollected = 0;
                anchors.forEach(a => {
                    const href = a.getAttribute('href') || '';
                    if (!href) return;
                    const url = href.startsWith('http') ? href : 'https://grok.com' + href;
                    if (!existingUrls.has(url.split('?')[0].toLowerCase())) {
                        uncollected++;
                    }
                });

                if (uncollected > 0) {
                    btnCollect.textContent = `${currentTotal} 🟢+${uncollected}`;
                    btnCollect.style.color = '#34d399';
                    btnCollect.title = `Собрано: ${currentTotal}, новых на странице: +${uncollected}. Кликните для добавления!`;
                } else if (currentTotal > 0) {
                    btnCollect.textContent = String(currentTotal);
                    btnCollect.style.color = '#e5e7eb';
                    btnCollect.title = `Коллекция (${currentTotal}): открыть список`;
                }
            }, 2000);
        }

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
            btnStatus.textContent = _isPaused ? '▶' : '❚❚';
            btnStatus.title = _isPaused ? 'Продолжить' : 'Пауза';
            btnStatus.style.background = _isPaused ? '#d97706' : '#059669';
            btnStatus.style.color = '#ffffff';
        } else {
            btnStatus.textContent = 'Слайдшоу';
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
        const btnStop = mkBtn('mossad-gallery-stop', '■', 'Остановить слайдшоу', 'background:#1f2937;color:#f87171;');
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
            `Gr${GR_ICONS[grpModeCfg]}`,
            GR_TIPS[grpModeCfg] || '',
            grBtnCss(grpModeCfg));
        btnGr.onclick = () => {
            const idx = GR_STATES.indexOf(grpModeCfg);
            grpModeCfg = GR_STATES[(idx + 1) % GR_STATES.length];
            saveModeToCollection('grpMode', grpModeCfg);
            btnGr.textContent = `Gr${GR_ICONS[grpModeCfg]}`;
            btnGr.title       = GR_TIPS[grpModeCfg];
            btnGr.style.cssText = BASE_BTN + grBtnCss(grpModeCfg);
        };

        // Кнопка Md (порядок внутри группы)
        const btnMd = mkBtn('mossad-gallery-mdmode',
            `Md${MD_ICONS[itemModeCfg]}`,
            MD_TIPS[itemModeCfg] || '',
            mdBtnCss(itemModeCfg));
        btnMd.onclick = () => {
            const idx = MD_STATES.indexOf(itemModeCfg);
            itemModeCfg = MD_STATES[(idx + 1) % MD_STATES.length];
            saveModeToCollection('itemMode', itemModeCfg);
            btnMd.textContent = `Md${MD_ICONS[itemModeCfg]}`;
            btnMd.title       = MD_TIPS[itemModeCfg];
            btnMd.style.cssText = BASE_BTN + mdBtnCss(itemModeCfg);
        };

        // ── 6. Быстрые кнопки генерации видео (6s / 10s) ──
        const btnVid6 = mkBtn('mossad-grok-vid6', '6s', 'Генерация видео 6 сек (Shift+Enter)', 'background:#1a2332;color:#38bdf8;');
        btnVid6.onclick = () => {
            if (typeof triggerGrokVideoGeneration === 'function') triggerGrokVideoGeneration(6);
        };
        const btnVid10 = mkBtn('mossad-grok-vid10', '10s', 'Генерация видео 10 сек (Ctrl+Enter)', 'background:#1e1a3a;color:#a78bfa;');
        btnVid10.onclick = () => {
            if (typeof triggerGrokVideoGeneration === 'function') triggerGrokVideoGeneration(10);
        };

        row.append(btnCollect, btnStatus, btnStop, btnGr, btnMd, btnVid6, btnVid10);

        // ── Кнопка вызова настроек горячих клавиш (⌨) слева от крестика (✕) ──
        const btnHk = mkBtn('mossad-gallery-hk', '⌨', 'Настройки горячих клавиш', 'background:#1f2937;color:#9ca3af;font-size:12px;padding:2px 6px;margin-left:auto;');
        btnHk.onclick = () => {
            const existingModal = document.getElementById('mossad-hk-modal');
            if (existingModal) {
                existingModal.remove();
                return;
            }
            if (typeof openHotkeySettings === 'function') openHotkeySettings();
        };

        // Переносим крестик закрытия на самый верхний ряд (на Grok это mossad-gallery-row)
        const closeBtn = document.getElementById('mossad-btn-close');
        if (closeBtn) {
            closeBtn.style.marginLeft = '4px';
            row.append(btnHk, closeBtn);
        } else {
            row.append(btnHk);
        }

        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
        }

        // Если список был открыт ранее — восстанавливаем его монолитно в контейнере виджета
        if (_gSS.getItem('mossad_playlist_open') === 'true' && (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0)) {
            setTimeout(() => {
                if (typeof grokTogglePlaylistPanel === 'function') {
                    grokTogglePlaylistPanel(true);
                }
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
        if (!overrideUrl && typeof grokGetPlaylistStructure === 'function' && typeof grokFindCurrentPosition === 'function') {
            const struct = grokGetPlaylistStructure();
            const curPos = grokFindCurrentPosition(struct);
            if (curPos && curPos.currentItem && curPos.currentItem.url) {
                overrideUrl = curPos.currentItem.url;
            }
        }

        // Извлекаем активный UUID
        let activeUuid = '';
        if (overrideUrl) {
            activeUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(overrideUrl)
                : '';
        } else {
            activeUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(location.pathname)
                : '';
            if (!activeUuid && location.search) {
                activeUuid = (typeof grokExtractUuid === 'function')
                    ? grokExtractUuid(location.search)
                    : '';
            }
        }

        const currentCleanUrl = (overrideUrl || location.href).split('?')[0].toLowerCase();
        let currentPath = '';
        try {
            currentPath = (overrideUrl ? new URL(overrideUrl, location.origin).pathname : location.pathname).toLowerCase();
        } catch(e) {
            currentPath = location.pathname.toLowerCase();
        }

        const items = panel.querySelectorAll('.mossad-playlist-item');
        let matchedEl = null;

        items.forEach(el => {
            const itemUrl = (el.dataset.url || '').toLowerCase();
            const itemUuid = (el.dataset.uuid || '').toLowerCase();
            const cleanItemUrl = itemUrl.split('?')[0];

            let isActive = false;
            if (activeUuid && itemUuid && activeUuid === itemUuid) {
                isActive = true;
            } else if (cleanItemUrl && (cleanItemUrl === currentCleanUrl || (currentPath && cleanItemUrl.endsWith(currentPath)))) {
                isActive = true;
            }

            const label = el.querySelector('.mossad-playlist-label');
            const origText = el.dataset.origText || (label ? label.textContent.replace(/^▶\s*/, '') : '');
            if (!el.dataset.origText && origText) el.dataset.origText = origText;

            if (isActive) {
                matchedEl = el;
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
        });

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
        let loopSet = { urls: [], groupIds: [] };
        try {
            const lr = _gSS.getItem('mossad_grok_loop_set');
            if (lr) loopSet = JSON.parse(lr);
        } catch(e) {}
        const saveLoopSet = () => _gSS.setItem('mossad_grok_loop_set', JSON.stringify(loopSet));

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
                overflow-y: auto; overflow-x: hidden; resize: both;
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
                overflow-y: auto; overflow-x: hidden; resize: both;
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

        // Сохраняем пользовательские размеры при интерактивном ресайзе мышью
        if (window.ResizeObserver) {
            let lastW = savedCustomWidth || 0;
            let lastH = savedCustomHeight || 0;
            const ro = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const w = Math.round(entry.contentRect.width);
                    const h = Math.round(entry.contentRect.height);
                    if (w >= 120 && Math.abs(w - lastW) > 6) {
                        lastW = w;
                        localStorage.setItem('mossad_playlist_width', String(w));
                        if (typeof Settings !== 'undefined') {
                            Settings.setQuiet('playlistWidth', w);
                        }
                    }
                    if (h >= 80 && Math.abs(h - lastH) > 6) {
                        lastH = h;
                        localStorage.setItem('mossad_playlist_height', String(h));
                    }
                }
            });
            ro.observe(panel);
        }

        // ── Заголовок (липкий вверху с поддержкой перетаскивания всего меню) ──
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 6px; position: sticky; top: 0; background: rgba(14, 14, 18, 0.98);
            backdrop-filter: blur(16px); z-index: 2; border-top-left-radius: 12px; border-top-right-radius: 12px;
            cursor: grab; min-width: 0; max-width: 100%; box-sizing: border-box;
        `;
        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(header);
        }

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight: 700; font-size: calc(var(--mossad-pl-font-size, 11px) + 2px); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;`;
        titleEl.textContent = `📋 Список (${items.length})`;
        titleEl.title = 'Двойной клик — сбросить ширину и высоту списка';
        titleEl.ondblclick = () => {
            panel.style.width = '100%';
            panel.style.height = 'auto';
            localStorage.removeItem('mossad_playlist_width');
            localStorage.removeItem('mossad_playlist_height');
            if (typeof Settings !== 'undefined') {
                Settings.setQuiet('playlistWidth', 0);
            }
            showToast('↔ Размеры списка сброшены');
        };

        // Кнопки масштабирования шрифта списка (A− / A+)
        const fontControls = document.createElement('div');
        fontControls.style.cssText = `display: flex; align-items: center; gap: 3px; flex-shrink: 0;`;

        const btnFontDec = document.createElement('button');
        btnFontDec.textContent = 'A−';
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
            }
        };

        const btnFontInc = document.createElement('button');
        btnFontInc.textContent = 'A+';
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
            }
        };
        fontControls.append(btnFontDec, btnFontInc);

        // Кнопка «отключить все R» — появляется если зациклено 2+ элементов
        const btnClearLoop = document.createElement('button');
        btnClearLoop.textContent = 'R ✕';
        btnClearLoop.title = 'Отключить все зацикленные';
        btnClearLoop.style.cssText = `background:#7f1d1d;border:none;border-radius:4px;color:#fca5a5;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;display:${(loopSet.urls.length + loopSet.groupIds.length) > 1 ? 'inline-block' : 'none'};`;
        btnClearLoop.onclick = () => {
            loopSet = { urls: [], groupIds: [] };
            saveLoopSet();
            panel.remove();
            grokTogglePlaylistPanel(true);
        };

        const btnClose = document.createElement('button');
        btnClose.textContent = '×';
        btnClose.title = 'Закрыть список';
        btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;transition:color 0.15s;`;
        btnClose.onmouseenter = () => btnClose.style.color = '#f87171';
        btnClose.onmouseleave = () => btnClose.style.color = '#9ca3af';
        btnClose.onclick = () => {
            panel.remove();
            _gSS.removeItem('mossad_playlist_open');
            grokUpdatePlaylistBtnState(false);
        };

        header.append(titleEl, fontControls, btnClearLoop, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding: 2px; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: hidden;`;

        // ── Утилита: кнопка R ──
        const makeRBtn = (isActive, onToggle) => {
            const btn = document.createElement('button');
            btn.textContent = 'R';
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
                grpCount.textContent = `${gItems.length} ген.`;

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
                    const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                    li.dataset.uuid = itemUuid;
                    li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 10px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

                    const baseUrl = (item.url || '').split('?')[0];
                    const isLooped = loopSet.urls.some(u => u.split('?')[0] === baseUrl);
                    const rItem = makeRBtn(isLooped, (btn) => {
                        const i = loopSet.urls.findIndex(u => u.split('?')[0] === baseUrl);
                        if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                        else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                        saveLoopSet();
                        const total = loopSet.urls.length + loopSet.groupIds.length;
                        btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                    });

                    const label = document.createElement('span');
                    label.className = 'mossad-playlist-label';
                    label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
                    const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 22)}`;
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
                const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                li.dataset.uuid = itemUuid;
                li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 11px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

                const baseUrl = (item.url || '').split('?')[0];
                const isLooped = loopSet.urls.some(u => u.split('?')[0] === baseUrl);
                const rItem = makeRBtn(isLooped, (btn) => {
                    const i = loopSet.urls.findIndex(u => u.split('?')[0] === baseUrl);
                    if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                    else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                    saveLoopSet();
                    const total = loopSet.urls.length + loopSet.groupIds.length;
                    btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                });

                const label = document.createElement('span');
                label.className = 'mossad-playlist-label';
                label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
                const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 26)}`;
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
            // 1. Попап-плеер / модальное окно просмотра
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .PlayerWrapper, .previewModal');
            if (modal) return modal;

            // 2. Активный элемент ленты или сетки
            const activeEl = document.querySelector('.GifPreview_isActive, .GifPreview.isActive, .preview_isActive, [data-feed-item-id].active');
            if (activeEl) return activeEl;

            // 3. Элемент, содержащий играющее видео
            const videos = Array.from(document.querySelectorAll('video'));
            const playingVideo = videos.find(v => !v.paused && v.currentTime > 0);
            if (playingVideo) {
                const card = playingVideo.closest('[data-feed-item-id], .GifPreview, .feed-item, a[href*="/watch/"]');
                if (card) return card;
            }

            // 4. Первый элемент с ID фида или превью
            return document.querySelector('[data-feed-item-id], .GifPreview');
        }

        /** Находит активное/главное видео RedGifs */
        function getActiveVideo() {
            // Если открыт попап/модалка — ищем видео строго внутри него
            const modal = document.querySelector('[role="dialog"], .modal, .preview-modal, .PlayerWrapper');
            if (modal) {
                const modalVid = modal.querySelector('video');
                if (modalVid) return modalVid;
            }

            const active = getActiveItem();
            if (active) {
                const v = active.querySelector('video');
                if (v) return v;
            }

            const videos = Array.from(document.querySelectorAll('video'));
            if (videos.length === 0) return null;

            // Предпочитаем проигрывающееся видео
            const playing = videos.find(v => !v.paused && v.currentTime > 0);
            if (playing) return playing;

            // Иначе выбираем с наибольшей видимой площадью
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
            return bestVideo || videos[0];
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
            const active = getActiveItem();
            const urls = [];
            const itemId = (active && active.getAttribute('data-feed-item-id')) || 
                           (location.pathname.match(/\/watch\/([^/?#]+)/) || [])[1] || null;

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

            const v = getActiveVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://media.redgifs.com/${capId}-mobile.mp4`);
            }

            const cleanUrls = Array.from(new Set(urls.filter(Boolean)));
            if (cleanUrls.length > 0) {
                return { urls: cleanUrls, type: 'video', itemId: itemId || 'video', userName: getUserName() };
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

            if (typeof triggerUniversalFullScreen === 'function') {
                triggerUniversalFullScreen();
            }

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

        if (rootDomain.includes('pinterest.')) {
            const pinType = getPinMediaType();
            const mainPin = getPinterestMainPinData();
            
            // 1. Если главный пин - ВИДЕО
            if (pinType === 'video' || mainPin.bestMp4Url) {
                if (mainPin.bestMp4Url) {
                    return { urls: [mainPin.bestMp4Url], type: 'video' };
                }
                const stageSig = document.querySelector('div[data-test-id="closeup-stage"] [data-video-signature], div[data-test-id="pin-closeup"] [data-video-signature]');
                if (stageSig) {
                    const sig = stageSig.getAttribute('data-video-signature');
                    if (sig && sig.length === 32) {
                        return { urls: [`https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`], type: 'video' };
                    }
                }
            }

            // 2. Если главный пин - ФОТО (или не содержит видео)
            const stageImg = document.querySelector('div[data-test-id="closeup-stage"] img, div[data-test-id="pin-closeup"] img, div[role="main"] img');
            if (stageImg && stageImg.src) {
                let imgUrl = stageImg.src;
                imgUrl = imgUrl.replace(/\/(236x|474x|564x|736x|1200x)\//, '/originals/');
                return { urls: [imgUrl], type: 'photo' };
            }
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

    function triggerDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null) {
        if (duplicateRecord) {
            _activeDuplicateRecord = duplicateRecord;
        } else if (!bypassDuplicateCheck) {
            _activeDuplicateRecord = null;
        }

        if (rootDomain === 'grok.com') {
            if (triggerGrokDownload(bypassDuplicateCheck, duplicateRecord || _activeDuplicateRecord, onDoneCallback)) return;
        }

        const media = findMediaForDownload();
        if (!media || !media.urls || media.urls.length === 0) { showToast('❌ Медиа не найдено', true); return; }

        const primaryUrl = media.urls[0];

        // Проверка дубликата в истории (для Pinterest, Instagram, RedGifs и др.)
        if (!bypassDuplicateCheck && typeof checkFileInHistory === 'function' && !isDuplicateConfirmed(primaryUrl) && !isDuplicateConfirmed(location.href)) {
            checkFileInHistory(null, primaryUrl, location.href, media.type).then(record => {
                if (record) {
                    _activeDuplicateRecord = record;
                    showDuplicateDownloadNotice(record, () => triggerDownload(true, record));
                } else {
                    _activeDuplicateRecord = null;
                    triggerDownload(true, null);
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
        const rootBase = isDup ? (currentDup.rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(currentDup.filename) : (currentDup.filename || '').replace(/\.[^/.]+$/, '').trim())) : '';
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
            authorName = typeof getRedGifsUserName === 'function' ? getRedGifsUserName() : (window.MOSSAD_ENGINES?.redgifs?.getUserName ? window.MOSSAD_ENGINES.redgifs.getUserName() : '');
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

            filename = typeof renderFilenameTemplate === 'function'
                ? renderFilenameTemplate(config.filenameTemplate, vars, isDup, dblSuffix, ext2)
                : filename;
        } else if (isDup) {
            // Без шаблона: добавляем разметку дубликата перед расширением
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : (media.type === 'video' ? '.mp4' : '.jpg');
            filename = `${base}${dblSuffix}${extPart}`;
        }

        const urls = media.urls;
        let attemptedIndex = 0;

        function tryNext() {
            if (attemptedIndex >= urls.length) {
                console.warn('Все ссылки не сработали, fallback на Blob...');
                downloadBlobMedia(urls[0], filename);
                return;
            }
            const targetUrl = urls[attemptedIndex++];
            showToast('⏳ Запуск скачивания...');
            triggerDirectBlobDownload(targetUrl, filename, tryNext);
            if (typeof performPostDownloadAction === 'function') {
                performPostDownloadAction();
            }
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
    let _lastDownloadUrl = null;     // защита от повторного скачивания одного файла
    let _lastDownloadTime = 0;
    const _filenameCounter = new Map(); // счётчик по базовому имени → (001)(002)...
    let _samePageSlideCount = 0;     // счётчик попыток перелистнуть с одной и той же страницы
    let _lastSlideUrl = '';          // URL во время последнего triggerNextSlide
    const SAME_PAGE_LIMIT = 3;       // сколько раз пробовать перед остановкой

    function cancelSlideTimers() {
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
        currentVideoNode = null;
    }
    window.cancelSlideTimers = cancelSlideTimers;
    function getActiveVideo() {
        if (rootDomain.includes('redgifs.com') && window.MOSSAD_ENGINES?.redgifs?.getActiveVideo) {
            const rgVid = window.MOSSAD_ENGINES.redgifs.getActiveVideo();
            if (rgVid) return rgVid;
        }

        let videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        
        // На Пинтересте ищем видео в главном контейнере сцены пина (closeup-stage / main)
        if (rootDomain.includes('pinterest.')) {
            const mainStage = document.querySelector('div[data-test-id="closeup-stage"], div[data-test-id="pin-closeup"], div[role="main"], div[data-test-id="story-pin-closeup-container"]');
            if (mainStage) {
                const stageVideo = mainStage.querySelector('video');
                if (stageVideo) return stageVideo;
            }

            videos = videos.filter(v => {
                const isRec = v.closest('div[data-grid-item], div[data-test-id="pin-card"], div[data-test-id="related-pins"], div[data-test-id="search-feed"]');
                return !isRec;
            });
            if (videos.length === 0) return null;
        }

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
                    || (typeof findGrokButton === 'function' ? findGrokButton(fsKeywords) : null)
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
    let _urlMonitorTimer = null;

    setInterval(() => {
        if (!slideshowActive || _isRewinding) return;
        
        const currentUrl = location.href;
        const urlChanged = currentUrl !== lastUrlForSlideshow;
        
        let videoChanged = false;
        let currentVideo = lastActiveVideo;
        if (urlChanged || !lastActiveVideo || !document.body.contains(lastActiveVideo)) {
            currentVideo = getActiveVideo();
            videoChanged = currentVideo !== lastActiveVideo && (currentVideo !== null || lastActiveVideo !== null);
        }
        
        if (urlChanged || videoChanged) {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;
            
            if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
            if (rafId) cancelAnimationFrame(rafId);
            
            // Сбрасываем таймер в интерфейсе немедленно!
            isCountingDown = false;
            countdownSeconds = 0;

            if (urlChanged) {
                triggerUniversalFullScreen();
            }
            
            if (_urlMonitorTimer) clearTimeout(_urlMonitorTimer);
            _urlMonitorTimer = setTimeout(() => {
                _urlMonitorTimer = null;
                if (slideshowActive && !slideshowPaused) scheduleNextSlideCycle(0);
            }, 150);
        }
    }, 250);

    function stopSlideshow() {
        cancelSlideTimers();
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
            if (typeof updateGalleryStatusBtn === 'function') updateGalleryStatusBtn('idle');
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
            const hkModal = document.getElementById('mossad-hk-modal');
            if (hkModal) hkModal.remove();
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

    function triggerNextSlide() {
        if (!slideshowActive || slideshowPaused || _isRewinding) return;
        cancelSlideTimers();
        const dirs = config.slideshowDirections;
        if (!dirs || dirs.length === 0) { stopSlideshow(); return; }

        const advanceToNext = () => {
            // Gallery Slideshow: вместо клавиши — переходим на следующий URL из списка
            if (rootDomain === 'grok.com') {
                const hasGrokSs = (() => {
                    try { return !!JSON.parse((typeof _gSS !== 'undefined' ? _gSS : sessionStorage).getItem('mossad_grok_imagine_ss') || '{}').active; } catch { return false; }
                })();
                if (window._mossadGalleryActive || hasGrokSs) {
                    if (typeof window._mossadGalleryNextFn === 'function') {
                        window._mossadGalleryNextFn();
                        return;
                    } else if (typeof grokGalleryStepNext === 'function') {
                        grokGalleryStepNext();
                        return;
                    }
                }
            }

            // Pinterest ссылочная навигация
            if (rootDomain.includes('pinterest.')) {
                selectNextPinterestPin('next');
                return;
            }

            // RedGifs навигация (изолирована от URL-детектора!)
            if (rootDomain.includes('redgifs.com')) {
                const dir = (dirs && dirs.length) ? dirs[0] : 'down';
                if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
                    window.MOSSAD_ENGINES.redgifs.navigate(dir);
                } else if (typeof redGifsNavigate === 'function') {
                    redGifsNavigate(dir);
                }
                return;
            }

            // Grok навигация по киноплёнке (filmstrip) на странице поста
            if (rootDomain === 'grok.com' && isGrokPostPage()) {
                const isFwd = ['down', 'right'].includes((dirs && dirs.length) ? dirs[0] : 'down');
                if (typeof grokStepFilmstrip === 'function' && grokStepFilmstrip(isFwd)) {
                    return;
                }
            }

            // Листание ленты с детектором конца (3 попытки: сразу, через 1с, через 3с)
            const startUrl = location.href;
            const key = getArrowKey(dirs[0]);

            const sendSlideKey = () => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
                triggerUniversalFullScreen();
            };

            // Попытка 1: исходное нажатие
            sendSlideKey();

            // Проверяем через 1 секунду
            setTimeout(() => {
                if (!slideshowActive || slideshowPaused || _isRewinding) return;
                if (location.href !== startUrl) return; // Успешно перелистнулось с 1-й попытки

                // Попытка 2: URL не изменился через 1 секунду
                console.log('[MOSSAD] Конец ленты? Попытка 2 (через 1с)...');
                sendSlideKey();

                // Проверяем через 3 секунды (на 4-й секунде от начала)
                setTimeout(() => {
                    if (!slideshowActive || slideshowPaused || _isRewinding) return;
                    if (location.href !== startUrl) return; // Успешно перелистнулось со 2-й попытки

                    // Попытка 3: URL всё ещё не изменился через 3 секунды
                    console.log('[MOSSAD] Конец ленты? Попытка 3 (на 4-й секунде)...');
                    sendSlideKey();

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
                            showToast('⏹ Слайдшоу остановлен: конец ленты', true);
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
                const _dlPageUrl = location.href.split('?')[0].toLowerCase();
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

        const expected = sessionStorage.getItem('mossad_expected_type');
        if (expected === 'video' || expected === 'image') return expected;

        if (rootDomain.includes('pinterest.')) {
            const pinData = getPinterestMainPinData();
            if (pinData.isFound && (pinData.type === 'video' || pinData.type === 'image')) {
                return pinData.type;
            }
            if (config.pinterestFilterType === 'video') return 'video';
            if (config.pinterestFilterType === 'image') return 'image';
        }

        // Быстрое определение по кнопкам Grok (появляются раньше видео-плеера)
        if (rootDomain === 'grok.com') {
            const allBtns = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]'));
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
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (slideshowTimeoutId) { clearTimeout(slideshowTimeoutId); slideshowTimeoutId = null; }
        
        const detectedType = getPinMediaType();
        const video = getActiveVideo();

        if (detectedType === 'image') {
            // Мгновенный запуск фото-таймера на 0 миллисекунде
            sessionStorage.removeItem('mossad_expected_type');
            countdownSeconds = (initSec > 0) ? initSec : config.slideshowDelay;
            isCountingDown = true;
            runPhotoTimer();
            return;
        }

        if (video) {
            if (video.paused) {
                try { video.play().catch(() => {}); } catch(e) {}
            }
            if (isNaN(video.duration) || video.duration === 0) {
                if (retryCount > 40) { // До 8 секунд ожидания параметров видео
                     triggerNextSlide();
                     return;
                }
                slideshowTimeoutId = setTimeout(() => scheduleNextSlideCycle(initSec, retryCount + 1), 200);
                return;
            }
            sessionStorage.removeItem('mossad_expected_type');
            isCountingDown = false;
            currentVideoNode = video;
            videoInitialDuration = video.duration;
            currentLoopCount = 0;
            accumulatedTime = 0;
            lastTime = video.currentTime;
            lastRAFTime = performance.now();
            _videoReachedEndZone = false;
            rafId = requestAnimationFrame(checkVideoLoops);
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
                runPhotoTimer();
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
            runPhotoTimer();
        }
    }

    function checkVideoLoops(timeNow) {
        if (!slideshowActive || slideshowPaused) return;
        if (!currentVideoNode || !document.body.contains(currentVideoNode)) {
            scheduleNextSlideCycle(0); // Видео исчезло, перезапуск логики
            return;
        }
        
        // Если пользователь поставил видео на паузу — ставим отсчет слайдшоу на паузу!
        if (currentVideoNode.paused) {
            lastRAFTime = timeNow;
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        const ct = currentVideoNode.currentTime;
        const effDuration = videoInitialDuration || (currentVideoNode && !isNaN(currentVideoNode.duration) ? currentVideoNode.duration : 0);

        if (effDuration <= 0) {
            rafId = requestAnimationFrame(checkVideoLoops);
            return;
        }

        // Финальная зона ролика (последние 0.45с либо нативное событие ended)
        const isAtEnd = currentVideoNode.ended || (ct >= Math.max(0.5, effDuration - 0.45));
        if (isAtEnd) {
            _videoReachedEndZone = true;
        }

        // Завершение одного цикла/круга видео
        let loopCompleted = false;
        if (currentVideoNode.ended) {
            loopCompleted = true;
        } else if (_videoReachedEndZone && ct < 1.0) {
            // Видео было в финальной зоне и зациклилось на начало
            loopCompleted = true;
        } else if (rootDomain.includes('pinterest.') && config.pinterestMaxVideoDuration > 0 && ct >= config.pinterestMaxVideoDuration) {
            // Pinterest лимит длительности
            loopCompleted = true;
        }

        if (loopCompleted) {
            currentLoopCount++;
            _videoReachedEndZone = false;
            lastTime = ct;
            if (currentLoopCount >= config.videoLoops) {
                // Все круги завершены: запускаем паузу после видео
                countdownSeconds = config.delayAfterVideo;
                if (countdownSeconds > 0) {
                    isCountingDown = true;
                    runPhotoTimer();
                } else {
                    triggerNextSlide();
                }
                return;
            }
        }

        lastTime = ct;
        lastRAFTime = timeNow;
        rafId = requestAnimationFrame(checkVideoLoops);
    }

    function runPhotoTimer() {
        if (!slideshowActive || slideshowPaused) return;
        if (countdownSeconds <= 0) {
            isCountingDown = false;
            triggerNextSlide();
            return;
        }
        slideshowTimeoutId = setTimeout(() => {
            countdownSeconds--;
            runPhotoTimer();
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
            if (typeof updateGalleryStatusBtn === 'function') updateGalleryStatusBtn('paused');
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
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
        }
        if (window._mossadGalleryActive) {
            window._mossadGalleryPaused = false;
            sessionStorage.removeItem('mossad_gallery_paused');
            if (typeof updateGalleryStatusBtn === 'function') updateGalleryStatusBtn('playing');
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
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

    function getPinterestCandidatePins() {
        const currentPinId = (location.pathname.match(/\/pin\/(\d+)/) || [])[1];
        const allLinks = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
        const candidates = [];

        for (const a of allLinks) {
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

    function selectNextPinterestPin(direction, options = {}) {
        const isManual = options.isManual || false;
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        let idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;

        if (direction === 'prev') {
            if (idx > 0) {
                idx--;
                config.pinterestHistoryIdx = idx;
                Settings.save();
                showToast(`◀ Назад по истории (${idx + 1}/${config.pinterestHistory.length})`);
                navigatePinterestUrl(config.pinterestHistory[idx]);
                return;
            } else {
                showToast('⚠️ Вы в самом начале истории просмотров', true);
                return;
            }
        }

        // direction === 'next'
        // Если выбор сделан ВРУЧНУЮ и мы находимся НЕ на самой вершине стека: идем вперед по истории (как в Проводнике)
        if (isManual && idx >= 0 && idx < config.pinterestHistory.length - 1) {
            idx++;
            config.pinterestHistoryIdx = idx;
            Settings.save();
            showToast(`▶ Вперед по истории (${idx + 1}/${config.pinterestHistory.length})`);
            navigatePinterestUrl(config.pinterestHistory[idx]);
            return;
        }

        // Авто-слайдшоу ИЛИ ручной клик на вершине стека: генерируем НОВЫЙ слайд!
        if (config.pinterestHistory.length === 0 || config.pinterestHistory[config.pinterestHistory.length - 1] !== location.href) {
            config.pinterestHistory.push(location.href);
            if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
            config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
            Settings.save();
        }

        // Фоновый виртуальный скролл для гидратации React
        window.scrollBy({ top: 300, behavior: 'instant' });
        setTimeout(() => window.scrollBy({ top: -300, behavior: 'instant' }), 40);

        setTimeout(() => {
            let candidates = getPinterestCandidatePins();
            let filtered = [];
            const filterType = config.pinterestFilterType || 'ratio';

            if (filterType === 'image') {
                filtered = candidates.filter(c => c.type === 'image');
            } else if (filterType === 'video') {
                filtered = candidates.filter(c => c.type === 'video');
            } else if (filterType === 'ratio') {
                const photoPercent = config.pinterestPhotoPercent ?? 50;
                const roll = Math.random() * 100;
                const targetType = roll < photoPercent ? 'image' : 'video';
                filtered = candidates.filter(c => c.type === targetType);
                if (filtered.length === 0) {
                    filtered = candidates.filter(c => c.type === (targetType === 'image' ? 'video' : 'image'));
                }
            } else {
                filtered = candidates; // 'all'
            }

            // Случай когда у пина 0 ссылок: возврат назад по истории и вызов другого пина
            if (filtered.length === 0 && candidates.length === 0) {
                showToast('⚠️ На странице нет ссылок, переход назад...', true);
                if (config.pinterestHistory.length > 1 && idx > 0) {
                    idx--;
                    config.pinterestHistoryIdx = idx;
                    Settings.save();
                    navigatePinterestUrl(config.pinterestHistory[idx]);
                    return;
                }
                filtered = candidates;
            } else if (filtered.length === 0) {
                filtered = candidates;
            }

            const maxCandidates = filtered.slice(0, 30);
            let targetIndex = 0;
            const mode = config.pinterestMode || 'rand';

            if (mode === 'rand') {
                targetIndex = Math.floor(Math.random() * maxCandidates.length);
            } else if (mode === '+1') {
                window._pinSeqIndex = ((window._pinSeqIndex || 0) + 1) % maxCandidates.length;
                targetIndex = window._pinSeqIndex;
            } else {
                const num = parseInt(mode, 10) || 1;
                targetIndex = Math.min(Math.max(0, num - 1), maxCandidates.length - 1);
            }

            const target = maxCandidates[targetIndex];
            if (target) {
                // Запоминаем тип следующего контента в sessionStorage перед переходом
                sessionStorage.setItem('mossad_expected_type', target.type);

                // Если свернули на новый путь — усекаем историю впереди
                config.pinterestHistory = config.pinterestHistory.slice(0, (config.pinterestHistoryIdx ?? (config.pinterestHistory.length - 1)) + 1);
                config.pinterestHistory.push(target.url);
                if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
                config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
                Settings.save();

                showToast(`📌 Новый пин #${targetIndex + 1} (${target.type === 'video' ? '🎬 Видео' : '🖼 Фото'})`);
                navigatePinterestUrl(target.url);
            } else {
                showToast('❌ Подходящий пин не найден', true);
            }
        }, 100);
    }

    function getPinterestMainPinData() {
        try {
            // 1. Прямой осмотр DOM тегов видео главного пина (closeup-video-main, duplo-hls-video)
            const mainVideo = document.querySelector('video[elementtiming*="video"], video[data-test-id="duplo-hls-video"], video[src*="v1.pinimg.com"], video.jI_JN7');
            if (mainVideo) {
                const src = mainVideo.src || (mainVideo.querySelector('source') && mainVideo.querySelector('source').src) || '';
                const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
                let bestMp4Url = null;
                if (sigMatch) {
                    const sig = sigMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                } else if (src.endsWith('.mp4')) {
                    bestMp4Url = src;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            // 2. Сканирование разметки DOM на предмет v1.pinimg.com/videos/iht/hls/ или elementtiming="closeup-video-main"
            const fullHtml = document.documentElement.innerHTML || '';
            const hlsMatch = fullHtml.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/iht\\?\/hls\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{32})\.m3u8/i) ||
                             fullHtml.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i);

            if (hlsMatch || fullHtml.includes('elementtiming="closeup-video-main') || fullHtml.includes('data-test-id="duplo-hls-video"')) {
                let bestMp4Url = null;
                if (hlsMatch) {
                    const sig = hlsMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            const scanText = (txt) => {
                if (!txt || !txt.includes('auth_web_main_pin')) return null;
                const idx = txt.indexOf('resource_response');
                if (idx === -1) return null;
                
                // Берем с запасом 40000 символов, т.к. story_pin_data с видео-блоком лежит глубоко внизу JSON
                const slice = txt.slice(Math.max(0, idx - 500), idx + 40000);

                // 1. ПЕРВЫМ ДЕЛОМ ИЩЕМ СИГНАТУРЫ И БЛОКИ ВИДЕО
                const sigMatch = slice.match(/"video_signature"\s*:\s*"([a-f0-9]{32})"/i) ||
                                 slice.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 slice.match(/thumbnails\/originals\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\./i);

                const hasVideoKeywords = /story_pin_video_block/i.test(slice) || 
                                         /"video_list"\s*:\s*\{/i.test(slice) || 
                                         /"videos"\s*:\s*\{/i.test(slice) || 
                                         /duplo-hls/i.test(slice);

                if (sigMatch || hasVideoKeywords) {
                    let bestMp4Url = null;
                    const mp4Matches = slice.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+?\.mp4/g) ||
                                       slice.match(/https:\/\/v1\.pinimg\.com\/videos\/[^\s"',]+?\.mp4/g);
                    if (mp4Matches && mp4Matches.length > 0) {
                        bestMp4Url = mp4Matches[0].replace(/\\/g, '');
                    }
                    
                    if (!bestMp4Url && sigMatch) {
                        const sig = sigMatch[4] || sigMatch[1];
                        if (sig && sig.length === 32) {
                            bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                        }
                    }
                    return { isFound: true, type: 'video', bestMp4Url };
                }

                // 2. И ТОЛЬКО ЕСЛИ НИ ОДНОГО ПРИЗНАКА ВИДЕО НЕТ — ЭТО ФОТО
                if (/"images"\s*:\s*\{/i.test(slice) || /"image_signature"/i.test(slice)) {
                    return { isFound: true, type: 'image', bestMp4Url: null };
                }

                return null;
            };

            if (window.__PJS_OUTPUT__) {
                const res = scanText(JSON.stringify(window.__PJS_OUTPUT__));
                if (res) return res;
            }

            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const res = scanText(s.textContent || '');
                if (res) return res;
            }
        } catch (e) {
            console.error('[MOSSAD] PinResource JSON parse error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
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
            transition: all 0.3s ease; cursor: grab; pointer-events: auto; width: fit-content; max-width: 100%; box-sizing: border-box;
        `;
        window.makeWidgetDraggable(topBar);
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 12px; min-width: 80px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 2px;`;

        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.innerHTML = '🚀';
        btnStart.title = 'Старт слайдшоу (Insert)';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 4px 8px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;

        const btnDL = document.createElement('button');
        btnDL.innerHTML = '💾';
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 13px; padding: 4px 7px;`;

        const btnUpdate = document.createElement('button');
        btnUpdate.innerHTML = '🔄';
        btnUpdate.title = 'Обновить скрипт (Win+Alt+R)';
        btnUpdate.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #60a5fa; cursor: pointer; font-size: 13px; padding: 4px 7px; transition: transform 0.2s ease;`;
        btnUpdate.onclick = () => {
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        };

        const btnTogglePanel = document.createElement('button');
        btnTogglePanel.id = 'mossad-btn-toggle-panel';
        btnTogglePanel.innerHTML = '▼';
        btnTogglePanel.title = 'Меню настроек';
        btnTogglePanel.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 12px; padding: 0 3px; line-height: 1; transition: transform 0.2s, color 0.2s;`;
        btnTogglePanel.onmouseenter = () => { btnTogglePanel.style.color = '#fff'; };
        btnTogglePanel.onmouseleave = () => { btnTogglePanel.style.color = '#9ca3af'; };
        btnTogglePanel.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };

        const btnClose = document.createElement('button');
        btnClose.id = 'mossad-btn-close';
        btnClose.innerHTML = '✕';
        btnClose.title = 'Скрыть виджет (Ctrl+Insert)';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 13px; padding: 0 4px; line-height: 1; transition: color 0.2s; margin-left: auto;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        // Порядок: …таймер… | 🚀 | 💾 | 🔄 | ▼ | ✕ (на Grok ✕ переносится на верхний ряд)
        topBar.append(timerEl, btnStart, btnDL, btnUpdate, btnTogglePanel, btnClose);

        // SETTINGS PANEL
        const panel = document.createElement('div');
        panel.id = 'mossad-panel';
        panel.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px;
            display: none; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 12px; transition: opacity 0.2s ease, transform 0.2s ease; opacity: 0; pointer-events: auto; transform: translateY(-10px);
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 6px;">
                    <button id="mossad-btn-export-list" style="background:#1f2937; border:1px solid #374151; border-radius:4px; padding:2px 8px; color:#fbbf24; cursor:pointer; font-weight:bold; font-size:11px; display:flex; align-items:center; gap:4px;" title="Скачать список собранных ссылок (.txt)">
                        💾 Список
                    </button>
                    <div style="display:flex; align-items:center; gap:3px; background:#1f2937; border:1px solid #374151; border-radius:4px; padding:1px 5px;">
                        <span style="font-size:10px; color:#9ca3af;" title="Масштаб интерфейса MOSSAD">🔍</span>
                        <button id="mossad-btn-zoom-dec" style="background:transparent; border:none; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px; padding:0 3px;" title="Уменьшить масштаб виджета">−</button>
                        <span id="mossad-zoom-val" style="font-size:10px; color:#60a5fa; cursor:pointer; min-width:32px; text-align:center;" title="Клик — сбросить на 100%">${Math.round((config.widgetZoom || 1) * 100)}%</span>
                        <button id="mossad-btn-zoom-inc" style="background:transparent; border:none; color:#e5e7eb; cursor:pointer; font-weight:bold; font-size:12px; padding:0 3px;" title="Увеличить масштаб виджета">+</button>
                    </div>
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <label title="Использовать шаблон имени файла при скачивании" style="display:flex; align-items:center; gap:4px; white-space:nowrap; cursor:pointer;">
                        <input id="mossad-cb-fn-tpl" type="checkbox" style="accent-color:#3b82f6;" ${config.filenameTemplateEnabled ? 'checked' : ''}> Шаблон:
                    </label>
                    <input id="mossad-in-fn-tpl" type="text" placeholder="${typeof getDefaultFilenameTemplate === 'function' ? getDefaultFilenameTemplate() : (rootDomain === 'grok.com' ? '{conv4}-{id4}-{domain}.{ext}' : (rootDomain.includes('redgifs.com') ? '{userName}-{domain[4]}' : '{id8}-{domain}.{ext}'))}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон: {conv4} {id4} {id8} {id} {domain} {userName} {title} {date} {time} {ext} {n} {dbl} {oldname}"
                        style="flex:1; min-width:0; background:#1f2937; border:1px solid #374151; color:#fff; border-radius:4px; padding:2px 5px; font-size:11px;">
                    <button id="mossad-btn-save-tpl-global" title="Сохранить шаблон глобально для ${rootDomain} (во всех вкладках)" style="background:#1f2937; border:1px solid #374151; color:#60a5fa; border-radius:4px; padding:2px 6px; cursor:pointer; font-size:11px;">💾</button>
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
                    <button id="mossad-btn-hk" style="flex:1; background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px; color:#60a5fa; cursor:pointer; font-weight:bold; transition:all 0.2s;">⚙ Настройки</button>
                    <button id="mossad-btn-import-db" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#34d399; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Импортировать базу хешей (результат scan_local_files.py)">📥 База</button>
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
                localStorage.removeItem('mossad_playlist_width');
                Object.assign(config, JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
                window.updateWidgetUI();
                showToast('✅ Настройки сброшены по умолчанию');
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

        window.updateWidgetUI = () => {
            const galleryRow = document.getElementById('mossad-gallery-row');
            const playlistPanel = document.getElementById('mossad-playlist-panel');

            if (window.widgetState === 'hidden') {
                container.style.display = 'none';
                topBar.style.display = 'none';
                panel.style.display = 'none';
                panel.style.pointerEvents = 'none';
                if (galleryRow) galleryRow.style.display = 'none';
                if (playlistPanel) playlistPanel.style.display = 'none';
            } else if (window.widgetState === 'bar') {
                container.style.display = 'flex';
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
        document.addEventListener('DOMContentLoaded', () => { initWidget(); initGrokGalleryBar(); grokGallerySlideshowTick(); });
    } else {
        initWidget();
        initGrokGalleryBar();
        grokGallerySlideshowTick();
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
              <span>v${SCRIPT_VERSION} · 2026-09-21</span>
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
            nextSlide:        'Следующий слайд (PageDown)',
            prevSlide:        'Предыдущий слайд (PageUp)',
            nextGroup:        'Следующая группа (Alt+PageDown)',
            prevGroup:        'Предыдущая группа (Alt+PageUp)',
            download:         'Скачать (DL)',
            upscale:          'Улучшить',
            deleteVid:        'Удалить видео',
            sound:            'Звук (вкл/выкл)',
            playPause:        'Пауза/Плей видео',
            help:             'Настройки клавиш (Ctrl+F1)',
            history:          'История (Grok)', 
            slideshowPanel:   'Меню слайдшоу (Ctrl+Insert)',
            slideshowStart:   'Малое слайдшоу / ракета (Shift+Insert)',
            galleryPlayPause: 'Большое слайдшоу: Плей/Пауза (Insert)',
            galleryStop:      'Стоп большого слайдшоу',
            duplicateNext:    'Дублировать в фоне + Слайд (Ctrl+Пробел)',
            rewind:           'Мотать в начало (Alt+R)',
            snapWidget:       'Привязать к левому верхнему краю (F8)',
            videoGen6s:       'Видео 6с Grok (Shift+Enter)',
            videoGen10s:      'Видео 10с Grok (Ctrl+Enter)'
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

// ============================================
    // GLOBAL HOTKEYS & LISTENERS
    // ============================================
    window.capturingFor = null;

    function isSlideshowActiveOrPaused() {
        if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
        if (typeof slideshowPaused !== 'undefined' && slideshowPaused) return true;
        if (window._mossadGalleryActive || window._mossadGalleryPaused) return true;
        if (sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true') return true;
        if (sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true') return true;
        if (sessionStorage.getItem('mossad_gallery_paused') === 'true') return true;
        const rawSs = (typeof _gSS !== 'undefined' && _gSS.getItem)
            ? _gSS.getItem(GALLERY_SS_KEY)
            : sessionStorage.getItem('mossad_grok_gallery_ss');
        if (rawSs) {
            try {
                const ss = JSON.parse(rawSs);
                if (ss && ss.active) return true;
            } catch(e) {}
        }
        return false;
    }

    function _postPlayerNav(wasPaused) {
        if (wasPaused) {
            if (typeof setSlideshowPaused === 'function') setSlideshowPaused(true);
            sessionStorage.setItem('mossad_gallery_paused', 'true');
            window._mossadGalleryPaused = true;
            if (typeof updateGalleryStatusBtn === 'function') updateGalleryStatusBtn('paused');
            if (typeof rafId !== 'undefined' && rafId) cancelAnimationFrame(rafId);
            if (typeof slideshowTimeoutId !== 'undefined' && slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        } else {
            setTimeout(() => {
                if (slideshowActive && !slideshowPaused) {
                    if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
                }
            }, 300);
        }
    }

    function playerStepSlide(dir) {
        if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const nextRes = (typeof grokGetNextSlideItem === 'function')
                ? grokGetNextSlideItem(isFwd ? 'down' : 'up')
                : null;
            if (nextRes && nextRes.item) {
                if (nextRes.circleCompleted) {
                    if (typeof playCircleDoneSound === 'function') playCircleDoneSound();
                    let ss = {};
                    try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
                    ss.circle = (ss.circle || 1) + 1;
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    showToast(`🔄 Круг ${ss.circle} начался!`);
                }
                const targetItem = nextRes.item;
                if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                const struct = (typeof grokGetPlaylistStructure === 'function') ? grokGetPlaylistStructure() : null;
                const curPos = (struct && typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct, targetItem.url) : null;
                const posStr = (curPos && curPos.flatIndex !== -1) ? ` ${curPos.flatIndex + 1}/${struct.items.length}` : '';
                showToast(`${isFwd ? '⏭' : '⏮'}${posStr} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                grokSpaNavigate(targetItem.url);
                setTimeout(() => {
                    if (typeof grokHighlightActivePlaylistItem === 'function') {
                        grokHighlightActivePlaylistItem(targetItem.url);
                    }
                }, 100);
                _postPlayerNav(wasPaused);
                return;
            }
            // Fallback если коллекция не собрана: навигация по киноплёнке (filmstrip)
            if (typeof grokStepFilmstrip === 'function' && grokStepFilmstrip(isFwd)) {
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
            } else if (typeof redGifsNavigate === 'function') {
                redGifsNavigate(isFwd ? 'down' : 'up');
            }
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
        if (typeof triggerUniversalFullScreen === 'function') triggerUniversalFullScreen();
        _postPlayerNav(wasPaused);
    }

    // Ранний перехват клавиш слайдера (PageUp / PageDown, ArrowDown / ArrowUp) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) return;

        const isGrokPost = (rootDomain === 'grok.com' && isGrokPostPage());
        const hasGrokCollection = isGrokPost && !!_gSS.getItem(GALLERY_COLLECTION_KEY);

        // Перехват групп: config.hk.nextGroup (по умолчанию Alt+PageDown) / config.hk.prevGroup (по умолчанию Alt+PageUp)
        const isNextGrp = hotkeyMatches(e, config.hk.nextGroup);
        const isPrevGrp = hotkeyMatches(e, config.hk.prevGroup);
        if ((isNextGrp || isPrevGrp) && isGrokPost && hasGrokCollection) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
            const nextRes = (typeof grokGetNextSlideItem === 'function')
                ? grokGetNextSlideItem(isNextGrp ? 'next_grp' : 'prev_grp')
                : null;
            if (nextRes && nextRes.item) {
                if (nextRes.item.type) sessionStorage.setItem('mossad_expected_type', nextRes.item.type);
                showToast(`📁 Группа: ${isNextGrp ? '↓' : '↑'}`);
                grokSpaNavigate(nextRes.item.url);
                setTimeout(() => {
                    if (typeof grokHighlightActivePlaylistItem === 'function') {
                        grokHighlightActivePlaylistItem(nextRes.item.url);
                    }
                }, 100);
            }
            return;
        }

        // Перехватываем ТОЛЬКО пока слайдшоу активно/на паузе, либо на посте Grok с коллекцией
        if (!isSlideshowActiveOrPaused() && !hasGrokCollection) return;

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof cancelSlideTimers === 'function') cancelSlideTimers();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    window.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;

        // Перехват генерации видео в Grok (Shift+Enter — 6с, Ctrl+Enter — 10с)
        // Срабатывает ДО проверки isEditing, чтобы работать прямо во время ввода текста промпта
        if (rootDomain === 'grok.com') {
            if (hotkeyMatches(e, config.hk.videoGen6s)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (typeof triggerGrokVideoGeneration === 'function') {
                    triggerGrokVideoGeneration(6);
                }
                return;
            }
            if (hotkeyMatches(e, config.hk.videoGen10s)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                if (typeof triggerGrokVideoGeneration === 'function') {
                    triggerGrokVideoGeneration(10);
                }
                return;
            }
        }

        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing && !/^F\d+$/.test(e.key) && !(e.ctrlKey || e.altKey || e.metaKey)) return;

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const existingModal = document.getElementById('mossad-hk-modal');
            if (existingModal) {
                existingModal.remove();
                return;
            }
            if (typeof openHotkeySettings === 'function') openHotkeySettings();
            return;
        }

        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            window.widgetState = (window.widgetState === 'hidden') ? 'bar' : 'hidden';
            window.updateWidgetUI();
            return;
        }

        // Большое слайдшоу (по плейлисту коллекции): Плей / Пауза (Insert по умолчанию)
        if (hotkeyMatches(e, config.hk.galleryPlayPause)) {
            e.preventDefault();
            if (rootDomain === 'grok.com') {
                const active = window._mossadGalleryActive || (() => {
                    try { return !!(JSON.parse((typeof _gSS !== 'undefined' ? _gSS : sessionStorage).getItem(GALLERY_SS_KEY) || '{}').active); } catch { return false; }
                })();
                if (active) {
                    if (typeof toggleGalleryPause === 'function') toggleGalleryPause();
                } else {
                    if (typeof grokStartGallerySlideshow === 'function') grokStartGallerySlideshow();
                }
            } else {
                startSlideshow();
            }
            return;
        }

        // Стоп большого слайдшоу
        if (config.hk.galleryStop && hotkeyMatches(e, config.hk.galleryStop)) {
            e.preventDefault();
            if (rootDomain === 'grok.com' && typeof grokStopGallerySlideshow === 'function') {
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
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            e.preventDefault();
            runSmartDelete();
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
                if (video.paused) video.play();
                else video.pause();
                showToast(video.paused ? '▶ Проигрывание' : '⏸ Пауза');
            }
        }

        if (hotkeyMatches(e, config.hk.history) && rootDomain === 'grok.com') {
            e.preventDefault();
            window.location.href = 'https://grok.com/imagine/saved';
        }

        // Привязать виджет к левому верхнему краю
        if (hotkeyMatches(e, config.hk.snapWidget)) {
            e.preventDefault();
            if (typeof window.snapWidgetToCorner === 'function') {
                window.snapWidgetToCorner();
            }
        }

        // Обновить скрипт (Win+Alt+R) / Мотать в начало (Alt+R по умолчанию)
        if (hotkeyMatches(e, config.hk.updateScript) || (e.altKey && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R'))) {
            e.preventDefault();
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        } else if (hotkeyMatches(e, config.hk.rewind) && !e.metaKey) {
            e.preventDefault();
            doRewind();
        }

        // Дублирование страницы в фоновой вкладке + принудительный переход (Ctrl + Пробел)
        if (hotkeyMatches(e, config.hk.duplicateNext)) {
            e.preventDefault();
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(location.href, { active: false, insert: true });
                showToast('📑 Открыто во вкладке в фоне + Переход...');
            } else {
                window.open(location.href, '_blank');
                showToast('📑 Открыта вкладка + Переход...');
            }
            triggerNextSlide();
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
            setTimeout(() => {
                scheduleNextSlideCycle(0);
            }, 500);
        } else {
            showToast('⏸ Слайдшоу на паузе');
        }
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

})();
