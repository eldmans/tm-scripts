// ==UserScript==
// @name         MOSSAD (Media Objects Slideshow and Download)
// @namespace    http://tampermonkey.net/
// @version      1.3.6
// @description  Универсальный скрипт для авто-слайдшоу, скачивания медиа и горячих клавиш.
// @author       Antigravity
// @match        *://*/*
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      pinimg.com
// @connect      *.pinimg.com
// @connect      *
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.3.6';
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
            download:       { key: 'PageDown',   ctrl: false, alt: false, shift: true },  // Shift+PageDown
            upscale:        { key: 'PageUp',     ctrl: true,  alt: false, shift: false }, // Ctrl+PageUp
            deleteVid:      { key: 'Delete',     ctrl: false, alt: false, shift: false },
            sound:          { key: 'ScrollLock', ctrl: false, alt: false, shift: false },
            playPause:      { key: 'Pause',      ctrl: false, alt: false, shift: false },
            help:           { key: 'F1',         ctrl: true,  alt: false, shift: false },
            history:        { key: 'Home',       ctrl: false, alt: false, shift: false },
            slideshowPanel: { key: 'Insert',     ctrl: true,  alt: false, shift: false },
            slideshowStart: { key: 'Insert',     ctrl: false, alt: false, shift: false },
            focusWidget:    { key: 'F7',         ctrl: false, alt: false, shift: false },
            nextSlide:      [
                { key: 'PageDown',   ctrl: false, alt: false, shift: false },
                { key: ' ',          ctrl: false, alt: false, shift: false }  // Пробел (резерв)
            ],
            prevSlide:      { key: 'PageUp',     ctrl: false, alt: false, shift: false },
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
    // Сброс при рефреше страницы
    config.downloadType = 'none';

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
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                headers: {
                    'Referer': location.origin + '/',
                    'Origin': location.origin
                },
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
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET', url: url, responseType: 'blob',
                onload: function (response) {
                    if (response.status === 200 && response.response) {
                        saveBlobToDisk(response.response, filename);
                    } else { fetchBlobFallback(url, filename); }
                },
                onerror: function () { fetchBlobFallback(url, filename); }
            });
        } else { fetchBlobFallback(url, filename); }
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => res.blob()).then(blob => saveBlobToDisk(blob, filename))
        .catch(err => {
            showToast('⚠️ Прямое скачивание недоступно, открыто в новой вкладке', true);
            window.open(url, '_blank');
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
            if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
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
            if (b.offsetParent === null) return false;
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
    // GROK: Download with 3-Dots Fallback
    // ============================================================
    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null) {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return false;
        blurActiveInput();

        const currentPostUrl = location.href;
        const currentPostId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';

        // Проверка дубликата в истории
        const hasVid = getActiveVideo() !== null;
        const currentMediaType = hasVid ? 'video' : 'photo';
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl)) {
            checkFileInHistory(null, null, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record));
                } else {
                    triggerGrokDownload(true, null);
                }
            });
            return true;
        }

        const dlKeywords = ['download', 'скачать'];

        const onDownloadTriggered = () => {
            const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
            const ext2 = hasVid ? 'mp4' : 'jpg';
            const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(duplicateRecord.filename) : (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim())) : '';
            const dblSuffix = duplicateRecord ? ` (${rootBase || 'original'}) DBL` : '';

            let grokFilename = `${shortId}-grok${dblSuffix}.${ext2}`;

            if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
                const now2 = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
                const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
                const vars = {
                    id:       currentPostId || '',
                    uuid:     currentPostId || '',
                    hash:     currentPostId || '',
                    postid:   currentPostId || '',
                    id8:      shortId,
                    hash8:    shortId,
                    uuid8:    shortId,
                    domain:   'grok',
                    title:    'Imagine - Grok',
                    username: 'grok',
                    user:     'grok',
                    author:   'grok',
                    date:     dateStr,
                    time:     timeStr,
                    ext:      ext2,
                    n:        String(Date.now()).slice(-6),
                    dbl:      dblSuffix,
                    oldname:  rootBase,
                    copy:     rootBase,
                    root:     rootBase
                };
                const tplStr = config.filenameTemplate.trim();
                const hasDblVar = /\{dbl\}/i.test(tplStr);
                grokFilename = tplStr.replace(/\{(\w+)(?:\[(\d+)\])?\}/gi, (_, name, lenStr) => {
                    const key = name.toLowerCase();
                    const val = key in vars ? vars[key] : '';
                    const len = lenStr ? parseInt(lenStr, 10) : 0;
                    return len > 0 ? val.slice(0, len) : val;
                }).replace(/[\\/:*?"<>|]/g, '_');

                if (!grokFilename.includes('.')) grokFilename += `.${ext2}`;
                if (duplicateRecord && !hasDblVar) {
                    const lastDot = grokFilename.lastIndexOf('.');
                    const base = lastDot !== -1 ? grokFilename.slice(0, lastDot) : grokFilename;
                    const extPart = lastDot !== -1 ? grokFilename.slice(lastDot) : `.${ext2}`;
                    grokFilename = `${base}${dblSuffix}${extPart}`;
                }
            }

            showToast(`📥 Скачивание: ${grokFilename}...`);
            saveFileToHistory({
                hash: '',
                filename: grokFilename,
                rootFilename: rootBase || (typeof extractRootFilename === 'function' ? extractRootFilename(grokFilename) : grokFilename),
                url: currentPostUrl,
                postUrl: currentPostUrl,
                domain: 'grok.com',
                type: currentMediaType
            });
            if (typeof performPostDownloadAction === 'function') {
                performPostDownloadAction();
            }
        };

        // 1. Прямая кнопка на панели
        let directBtn = findGrokButton(dlKeywords);
        if (!directBtn) {
            // Поиск по SVG характерной иконки загрузки
            directBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                if (b.offsetParent === null) return false;
                const path = b.querySelector('path');
                const d = path ? (path.getAttribute('d') || '') : '';
                return d.includes('17v2') || d.includes('v2a2') || (d.includes('M12') && d.includes('17')) || d.includes('20C');
            });
        }

        if (directBtn) {
            triggerClick(directBtn, 'Grok Direct Download');
            onDownloadTriggered();
            return true;
        }

        // 2. Если прямой кнопки нет — открываем три точки
        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Download)');
            retryAction((attempt) => {
                const innerDl = findGrokButton(dlKeywords);
                if (innerDl) {
                    triggerClick(innerDl, 'Grok Download from 3-dots');
                    onDownloadTriggered();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
            return true;
        }

        return false;
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
     */
    function grokFindFilmstripItemByUuid(uuid) {
        if (!uuid) return null;
        const cleanUuid = uuid.toLowerCase();
        const items = grokGetFilmstripItems();
        return items.find(btn => {
            const img = btn.querySelector('img, video, source');
            if (img && img.src && img.src.toLowerCase().includes(cleanUuid)) return true;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes(cleanUuid)) return true;
            return false;
        }) || null;
    }

    /**
     * Находит индекс активного (выбранного) кадра на киноплёнке.
     */
    function grokGetActiveFilmstripIndex() {
        const items = grokGetFilmstripItems();
        if (items.length === 0) return -1;
        const curUuid = grokExtractUuid(location.pathname);
        // 1. По классу выделения (ring-white)
        const activeByClass = items.findIndex(btn => btn.className.includes('ring-white'));
        if (activeByClass !== -1) return activeByClass;
        // 2. По совпадению UUID ассета с текущим URL
        const activeByMatch = items.findIndex(btn => {
            const imgSrc = btn.querySelector('img, video, source')?.src || '';
            const genMatch = imgSrc.match(/generated\/([a-f0-9-]+)\//)?.[1];
            if (genMatch && location.pathname.includes(genMatch)) return true;
            if (curUuid && imgSrc.toLowerCase().includes(curUuid)) return true;
            return false;
        });
        if (activeByMatch !== -1) return activeByMatch;
        return 0;
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

    /** Собирает все уникальные ссылки /imagine/post/... из DOM + определяет тип по span с таймером + convId */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        document.querySelectorAll('a[href*="/imagine/post/"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href) return;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            // Нормализуем URL (убираем query-string для дедупликации по базовому URL поста)
            const baseUrl = url.split('?')[0];
            if (seen.has(baseUrl)) return;
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
        });
        return items;
    }



    /** Кнопка 1: сохранить коллекцию в sessionStorage — МЕРЖИТ с уже собранными */
    function grokSaveCollection(btnEl) {
        const newItems = grokCollectLinks();
        if (newItems.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
            return;
        }
        // Загружаем существующую коллекцию
        let existingItems = [];
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw) existingItems = JSON.parse(raw).items || [];
        } catch(e) {}
        // Мерж: ключ — базовый URL без query string
        const seenBase = new Set(existingItems.map(i => (i.url || '').split('?')[0]));
        let addedCount = 0;
        for (const item of newItems) {
            const base = (item.url || '').split('?')[0];
            if (!seenBase.has(base)) {
                existingItems.push(item);
                seenBase.add(base);
                addedCount++;
            }
        }
        const date   = new Date().toISOString().slice(0, 10);
        const videos = existingItems.filter(i => i.type === 'video').length;
        const photos = existingItems.length - videos;
        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({ date, items: existingItems }));
        if (btnEl) {
            btnEl.textContent = String(existingItems.length);
            btnEl.title = `Коллекция (${existingItems.length}): открыть список`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(existingItems.length);
            const dlBtn = document.getElementById('mossad-gallery-dl');
            if (dlBtn) dlBtn.style.display = 'inline-block';
        }
        const addMsg = addedCount > 0 ? ` (+${addedCount} новых)` : ' (нет новых)';
        showToast(`✅ Итого: ${existingItems.length}${addMsg} → 📹${videos} видео, 🖼${photos} фото`);
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
    // GROK ENGINE: Gallery Queue Builder & Shuffling
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



    /** Строит очередь с учётом режима ssMode / grpOrder / itemOrder */
    function grokBuildGalleryQueue(allItems, ssState) {
        // Поддерживаем как новые поля (grpMode/itemMode), так и старые (ssMode/grpOrder/itemOrder) для совместимости
        const grpMode  = ssState.grpMode  || (ssState.ssMode === 'grp' ? 'seq' : (ssState.ssMode === 'rnd' ? 'off' : 'seq'));
        const itemMode = ssState.itemMode || ssState.itemOrder || 'fwd';

        // Оба выключены → полный рандом по всей коллекции
        if (grpMode === 'off' && itemMode === 'off') {
            return fisherYatesShuffle(allItems);
        }

        // grpMode выключен → не группируем, применяем itemMode ко всему списку
        if (grpMode === 'off') {
            let flat = allItems.slice();
            if (itemMode === 'rev')      flat = flat.reverse();
            else if (itemMode === 'rnd') flat = fisherYatesShuffle(flat);
            return flat;
        }

        // GRP: группируем по convId
        const groups = {};
        const groupOrder = [];
        for (const item of allItems) {
            const gid = item.convId || '__noconv__';
            if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
            groups[gid].push(item);
        }

        // Порядок групп (grpMode: seq / rev / rnd)
        let orderedGroups = groupOrder.slice();
        if (grpMode === 'rev')      orderedGroups = orderedGroups.reverse();
        else if (grpMode === 'rnd') orderedGroups = fisherYatesShuffle(orderedGroups);
        // seq = как собрали (оставляем)

        // Строим итоговую очередь
        const queue = [];
        for (const gid of orderedGroups) {
            let items = groups[gid].slice();
            // itemMode: fwd / rev / rnd / off
            if (itemMode === 'rev')      items = items.reverse();
            else if (itemMode === 'rnd') items = fisherYatesShuffle(items);
            else if (itemMode === 'off') items = fisherYatesShuffle(items);
            // fwd = как собрали (оставляем как есть)
            queue.push(...items);
        }
        return queue;
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
     * Бесшовная SPA-навигация на grok.com:
     * 1. Внутри одной группы — поиск кадра в киноплёнке (filmstrip) и клик без перезагрузки страницы.
     * 2. Next.js router.push (если доступен в рантайме).
     * 3. Fallback: межпостовой переход по location.href (только для перехода на ДРУГУЮ группу/пост).
     */
    function grokSpaNavigate(url) {
        if (!url) return;
        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;
            const targetUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(urlObj.pathname)
                : (urlObj.pathname.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];

            // 1. Приоритет: поиск в полосе киноплёнки (filmstrip) на текущей странице
            if (targetUuid && typeof grokFindFilmstripItemByUuid === 'function') {
                const filmstripBtn = grokFindFilmstripItemByUuid(targetUuid);
                if (filmstripBtn) {
                    console.log(`[MOSSAD] grokSpaNavigate: кадр ${targetUuid.slice(0, 8)} найден в filmstrip — кликаем без перезагрузки!`);
                    filmstripBtn.click();

                    // Ожидаем обновления URL (через history.replaceState Грока) и возобновляем тик слайдшоу
                    let checks = 0;
                    const checkInterval = setInterval(() => {
                        checks++;
                        const curUuid = (typeof grokExtractUuid === 'function')
                            ? grokExtractUuid(location.pathname)
                            : (location.pathname.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
                        if ((curUuid && curUuid === targetUuid.toLowerCase()) || checks >= 12) {
                            clearInterval(checkInterval);
                            if (typeof grokGallerySlideshowTick === 'function') {
                                grokGallerySlideshowTick();
                            }
                        }
                    }, 50);
                    return;
                }
            }

            let navigated = false;

            // 2. Next.js router.push — если доступен в контексте страницы
            const nextRouter = (window.next && window.next.router) || (typeof unsafeWindow !== 'undefined' && unsafeWindow.next && unsafeWindow.next.router);
            if (nextRouter && typeof nextRouter.push === 'function') {
                nextRouter.push(path);
                navigated = true;
            } else {
                // 3. Клик по ссылке в DOM (если есть)
                const anchor = document.querySelector(`a[href="${path}"]`)
                            || document.querySelector(`a[href="${urlObj.pathname}"]`);
                if (anchor) {
                    anchor.click();
                    navigated = true;
                }
            }

            if (navigated) {
                let checks = 0;
                const checkInterval = setInterval(() => {
                    checks++;
                    if (location.pathname === urlObj.pathname || checks >= 15) {
                        clearInterval(checkInterval);
                        if (typeof grokGallerySlideshowTick === 'function') {
                            grokGallerySlideshowTick();
                        }
                    }
                }, 40);
                return;
            }
        } catch (e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }

        // 4. Межпостовой переход (только если кадр из ДРУГОЙ группы/поста)
        console.log('[MOSSAD] grokSpaNavigate: пост не в текущей группе, открываем URL:', url);
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


    /** Кнопка 2: запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения коллекции', true); return; }
        const allItems = data.items || [];
        if (allItems.length === 0) { showToast('⚠️ Коллекция пуста', true); return; }

        // Читаем настройки режима из данных коллекции или дефолт (новые поля grpMode/itemMode)
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };

        const queue = grokBuildGalleryQueue(allItems, ssState);
        const ss = {
            active: true,
            queue,
            circle: 1,
            total: allItems.length,
            grpMode:  ssState.grpMode,
            itemMode: ssState.itemMode,
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryPaused = false;
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = `Gr${grIcon[ssState.grpMode]||'↓'} Md${grIcon[ssState.itemMode]||'↓'}`;
        showToast(`▶ Слайдшоу [${modeLabel}]: ${allItems.length} генераций`);
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { grokSpaNavigate(next.url); }, 300);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const allItems = data.items || [];
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };
        let queue = grokBuildGalleryQueue(allItems, ssState);
        // Переставляем startItem в начало очереди
        const startBase = (startItem.url || '').split('?')[0];
        const idx = queue.findIndex(i => (i.url || '').split('?')[0] === startBase);
        if (idx > 0) queue = [...queue.slice(idx), ...queue.slice(0, idx)];
        const ss = { active: true, queue: queue.slice(1), circle: 1, total: allItems.length,
            grpMode: ssState.grpMode, itemMode: ssState.itemMode };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        sessionStorage.removeItem('mossad_gallery_paused');
        window._mossadGalleryPaused = false;
        // Закрываем большое меню с D-Pad
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();

        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        showToast(`▶ Слайдшоу с выбранного элемента`);
        if (typeof grokTogglePlaylistPanel === 'function') {
            grokTogglePlaylistPanel(true);
        }
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem(startItem.url);
        }
        setTimeout(() => { grokSpaNavigate(startItem.url); }, 300);
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
            btn.style.background = '#059669'; // Зеленая кнопка без слов
            btn.style.color = '#ffffff';
            btn.style.fontSize = '12px';
            btn.style.letterSpacing = '1px';
            if (btnStop) btnStop.style.display = 'inline-block';
        } else if (state === 'paused') {
            btn.textContent = '▶';
            btn.title = 'Продолжить';
            btn.style.background = '#d97706'; // Янтарная при паузе
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
            // Если был фото-таймер, перезапускаем
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
        }
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;

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
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[ss.grpMode]||'↓'} Md${grIcon[ss.itemMode]||'↓'}`;
        const statusPrefix = isPaused ? '⏸' : '▶';
        indicator.innerHTML = `<span id="mgi-status">${statusPrefix} ${modeTag} · ${showed}/${ss.total} · Круг ${ss.circle}</span>`;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn(isPaused ? 'paused' : 'playing');

        // Подсвечиваем активный файл в открытом монолитном списке (плейлисте)
        if (typeof grokHighlightActivePlaylistItem === 'function') {
            grokHighlightActivePlaylistItem();
        }

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;

            let queue  = ss.queue  || [];
            let circle = ss.circle || 1;

            if (queue.length === 0) {
                playCircleDoneSound();
                circle++;
                const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                let allItems = [];
                if (colRaw) { try { allItems = JSON.parse(colRaw).items || []; } catch {} }
                // Новый круг — снова строим очередь с теми же настройками
                const ssState = {
                    grpMode:   ss.grpMode   || ss.ssMode    || 'seq',
                    itemMode:  ss.itemMode  || ss.itemOrder || 'fwd',
                };
                queue = grokBuildGalleryQueue(allItems, ssState);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            // ── Проверяем loop (R): зациклен ли один/несколько элементов ──
            const loopRaw = _gSS.getItem('mossad_grok_loop_set');
            if (loopRaw) {
                try {
                    const loopSet = JSON.parse(loopRaw);
                    const loopUrls = loopSet.urls || [];
                    const loopGroupIds = loopSet.groupIds || [];
                    if (loopUrls.length > 0 || loopGroupIds.length > 0) {
                        let loopItems = [];
                        const colRaw2 = _gSS.getItem(GALLERY_COLLECTION_KEY);
                        if (colRaw2) {
                            const allCol = JSON.parse(colRaw2).items || [];
                            for (const item of allCol) {
                                const baseUrl = (item.url || '').split('?')[0];
                                const inUrls = loopUrls.some(u => u.split('?')[0] === baseUrl);
                                const inGroups = loopGroupIds.includes(item.convId || '__noconv__');
                                if (inUrls || inGroups) loopItems.push(item);
                            }
                        }
                        if (loopItems.length > 0) {
                            const loopIdx = (ss.loopIdx || 0) % loopItems.length;
                            const loopNext = loopItems[loopIdx];
                            ss.loopIdx = loopIdx + 1;
                            ss.queue  = queue;
                            ss.circle = circle;
                            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                            if (loopNext.type) sessionStorage.setItem('mossad_expected_type', loopNext.type);
                            grokSpaNavigate(loopNext.url);
                            return;
                        }
                    }
                } catch(e) {}
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            grokSpaNavigate(next.url || next);
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
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px 10px;
            display: flex; align-items: center; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab; flex-wrap: wrap; pointer-events: auto;
        `;

        // ── Утилита создания маленьких кнопок ──
        const mkBtn = (id, text, title, css) => {
            const b = document.createElement('button');
            b.id = id; b.textContent = text; b.title = title;
            b.style.cssText = `cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 8px;font-weight:700;font-size:11px;transition:all 0.2s;${css}`;
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
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;

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

        // ── 2. Кнопка скачать коллекцию .txt (★) — появляется только когда список собран ──
        const btnDl = mkBtn('mossad-gallery-dl', '★', 'Скачать коллекцию .txt', 'background:#1f2937;color:#fbbf24;');
        btnDl.style.display = savedCount > 0 ? 'inline-block' : 'none';
        btnDl.onclick = () => grokDownloadCollection();

        if (isGrokSavedPage()) {
            // Мониторим изменение числа ссылок на странице каждые 2с
            setInterval(() => {
                const currentCount = document.querySelectorAll('a[href*="/imagine/post/"]').length;
                const sc = parseInt(btnCollect.dataset.collectedCount || String(savedCount), 10);
                if (sc === 0) return;
                if (currentCount !== sc) {
                    const diff = currentCount - sc;
                    const sign = diff > 0 ? '+' : '';
                    btnCollect.textContent = `${sc} 🔴${sign}${diff}`;
                    btnCollect.style.color = '#fca5a5';
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
        btnStatus.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;transition:all 0.2s;`;
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
        const BASE_BTN = 'cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 8px;font-weight:700;font-size:11px;transition:all 0.2s;';

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

        row.append(btnCollect, btnDl, btnStatus, btnStop, btnGr, btnMd);
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
                el.style.borderRadius = '6px';
                el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.35)';
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

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';

        const container = document.getElementById('mossad-widget-container');
        if (container) {
            // Монолитно внутри контейнера виджета
            panel.style.cssText = `
                box-sizing: border-box; width: 100%; min-width: 320px; max-width: 380px;
                max-height: 62vh; overflow-y: auto;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                pointer-events: auto;
            `;
        } else {
            // Fallback (если виджет ещё не создан)
            panel.style.cssText = `
                position: fixed; top: 70px; right: 16px; z-index: 9999999;
                width: 320px; max-height: 62vh; overflow-y: auto;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
            `;
        }

        // ── Заголовок (липкий вверху с поддержкой перетаскивания всего меню) ──
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 6px; position: sticky; top: 0; background: rgba(14, 14, 18, 0.98);
            backdrop-filter: blur(16px); z-index: 2; border-top-left-radius: 12px; border-top-right-radius: 12px;
            cursor: grab;
        `;
        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(header);
        }

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight: 700; font-size: 13px; flex: 1;`;
        titleEl.textContent = `📋 Список (${items.length})`;

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

        header.append(titleEl, btnClearLoop, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding: 6px;`;

        // ── Утилита: кнопка R ──
        const makeRBtn = (isActive, onToggle) => {
            const btn = document.createElement('button');
            btn.textContent = 'R';
            btn.style.cssText = `
                background:none;border:none;cursor:pointer;font-weight:700;font-size:11px;
                padding:0 4px;flex-shrink:0;transition:color 0.15s;
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
            for (const gid of groupOrder) {
                const gItems = groups[gid];
                const grpEl = document.createElement('div');
                grpEl.className = 'mossad-playlist-group';
                grpEl.style.cssText = `margin-bottom:6px;border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;transition:border-color 0.2s;`;

                const grpHeader = document.createElement('div');
                grpHeader.className = 'mossad-playlist-grp-header';
                const shortId = gid === '__noconv__' ? 'Без группы' : gid.slice(0, 8) + '…';
                grpHeader.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);transition:background 0.2s;`;
                grpHeader.title = `Группа: ${gid}`;

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
                grpLabel.style.cssText = `flex:1;font-weight:600;font-size:11px;color:#7dd3fc;cursor:pointer;`;
                grpLabel.textContent = shortId;
                grpLabel.onclick = (e) => {
                    e.stopPropagation();
                    grokStartGallerySlideshowFrom(gItems[0]);
                    grokHighlightActivePlaylistItem(gItems[0].url);
                };

                const grpCount = document.createElement('span');
                grpCount.style.cssText = `color:#6b7280;font-size:10px;`;
                grpCount.textContent = `${gItems.length} ген.`;

                grpHeader.append(rGrp, grpLabel, grpCount);
                grpEl.appendChild(grpHeader);

                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:3px 6px;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.className = 'mossad-playlist-item';
                    li.dataset.url = item.url || '';
                    const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                    li.dataset.uuid = itemUuid;
                    li.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;margin-bottom:2px;border-radius:6px;font-size:10px;border:1px solid transparent;cursor:pointer;transition:all 0.15s;`;

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
                    label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;`;
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
                    li.onclick = onPlayItem;

                    li.append(rItem, label);
                    listEl.appendChild(li);
                });
                grpEl.appendChild(listEl);
                body.appendChild(grpEl);
            }
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.className = 'mossad-playlist-item';
                li.dataset.url = item.url || '';
                const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                li.dataset.uuid = itemUuid;
                li.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;margin-bottom:2px;border-radius:6px;font-size:11px;border:1px solid transparent;cursor:pointer;transition:all 0.15s;`;

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
                label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;`;
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
                li.onclick = onPlayItem;

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

    function triggerDownload(bypassDuplicateCheck = false, duplicateRecord = null) {
        if (duplicateRecord) {
            _activeDuplicateRecord = duplicateRecord;
        } else if (!bypassDuplicateCheck) {
            _activeDuplicateRecord = null;
        }

        if (rootDomain === 'grok.com') {
            if (triggerGrokDownload(bypassDuplicateCheck, duplicateRecord || _activeDuplicateRecord)) return;
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
        if (rootDomain === 'grok.com') {
            const m = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
            if (m) postId = m[1];
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
        } else if (shortId && shortId.length >= 4) {
            // Формат по умолчанию: {8 символов UUID}-{домен}.{ext}
            filename = `${shortId}-${domainClean}.${ext}`;
        } else {
            const titleClean = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            filename = `${titleClean}.${ext}`;
        }

        // --- Применяем шаблон имени файла, если включён ---
        if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
            const now2 = new Date();
            const pad2 = (n) => String(n).padStart(2, '0');
            const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
            const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
            const ext2 = media.type === 'video' ? 'mp4' : 'jpg';
            const titleClean2 = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            const nStr = String(Date.now()).slice(-6);

            // Словарь переменных (значение без обрезки)
            const vars = {
                id:       postId,
                uuid:     postId,
                hash:     postId,
                postid:   postId,
                id8:      shortId,
                hash8:    shortId,
                uuid8:    shortId,
                title:    titleClean2,
                date:     dateStr,
                time:     timeStr,
                ext:      ext2,
                domain:   domainClean,
                username: authorName || shortId,
                user:     authorName || shortId,
                author:   authorName || shortId,
                n:        nStr,
                dbl:      dblSuffix,
                oldname:  rootBase,
                copy:     rootBase,
                root:     rootBase,
            };

            const tplStr = config.filenameTemplate.trim();
            const hasDblVar = /\{dbl\}/i.test(tplStr);

            // Регулярка: {varname} или {varname[N]}
            filename = tplStr.replace(
                /\{(\w+)(?:\[(\d+)\])?\}/gi,
                (_, name, lenStr) => {
                    const key = name.toLowerCase();
                    const val = key in vars ? vars[key] : '';
                    const len = lenStr ? parseInt(lenStr, 10) : 0;
                    return applyTplVar(val, len);
                }
            ).replace(/[\\/:*?"<>|]/g, '_');

            // Добавить расширение, если шаблон его не содержит
            if (!filename.includes('.')) filename += `.${ext2}`;

            // Если шаблон не содержал {dbl}, но файл дубликат — автоматически добавляем (старое_имя) DBL перед расширением
            if (isDup && !hasDblVar) {
                const lastDot = filename.lastIndexOf('.');
                const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
                const extPart = lastDot !== -1 ? filename.slice(lastDot) : `.${ext2}`;
                filename = `${base}${dblSuffix}${extPart}`;
            }
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
    let _lastDownloadUrl = null;     // защита от повторного скачивания одного файла
    let _lastDownloadTime = 0;
    const _filenameCounter = new Map(); // счётчик по базовому имени → (001)(002)...
    let _samePageSlideCount = 0;     // счётчик попыток перелистнуть с одной и той же страницы
    let _lastSlideUrl = '';          // URL во время последнего triggerNextSlide
    const SAME_PAGE_LIMIT = 3;       // сколько раз пробовать перед остановкой
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

    setInterval(() => {
        if (!slideshowActive || _isRewinding) return;
        
        const currentUrl = location.href;
        const currentVideo = getActiveVideo();
        
        const urlChanged = currentUrl !== lastUrlForSlideshow;
        const videoChanged = currentVideo !== lastActiveVideo && (currentVideo !== null || lastActiveVideo !== null);
        
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
                if (rootDomain === 'grok.com' && typeof grokGallerySlideshowTick === 'function') {
                    const raw = (typeof _gSS !== 'undefined' ? _gSS : sessionStorage).getItem('mossad_grok_imagine_ss');
                    if (raw) {
                        try {
                            const ss = JSON.parse(raw);
                            if (ss.active) grokGallerySlideshowTick();
                        } catch(e) {}
                    }
                }
            }
            
            // Ждем чуть-чуть, чтобы SPA успело обновить DOM
            setTimeout(() => {
                if (slideshowActive) scheduleNextSlideCycle(0);
            }, 100);
        } else {
            lastUrlForSlideshow = currentUrl;
            lastActiveVideo = currentVideo;
        }
    }, 100);

    function stopSlideshow() {
        slideshowActive = false;
        setSlideshowPaused(false);
        isCountingDown = false;
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_STATE_KEY);
        sessionStorage.removeItem(SESSION_PAUSED_KEY);
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (downloadTimeoutId) clearTimeout(downloadTimeoutId);
        if (rafId) cancelAnimationFrame(rafId);
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
        const dirs = config.slideshowDirections;
        if (!dirs || dirs.length === 0) { stopSlideshow(); return; }

        // Скачивание перед перелистыванием
        if (config.downloadType !== 'none') {
            const hasVideo = getActiveVideo() !== null;
            if (!(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo)) {
                triggerDownload();
                if (config.pdAction === 'del' && rootDomain === 'grok.com') {
                    setTimeout(() => window.close(), 1000);
                    return;
                }
            }
        }
        
        // Gallery Slideshow: вместо клавиши — переходим на следующий URL из очереди
        if (window._mossadGalleryActive && typeof window._mossadGalleryNextFn === 'function') {
            // Скачивание (если включено) перед переходом
            if (config.downloadType !== 'none') {
                const hasVideo = getActiveVideo() !== null;
                if (!(config.downloadType === 'photo' && hasVideo) && !(config.downloadType === 'video' && !hasVideo)) {
                    triggerDownload();
                }
            }
            window._mossadGalleryNextFn();
            return;
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
        if (rafId) cancelAnimationFrame(rafId);
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        
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
        if (ct < lastTime) {
            // Произошел луп
            currentLoopCount++;
            accumulatedTime = 0;
        } else {
            const delta = (timeNow - lastRAFTime) / 1000;
            accumulatedTime += delta;
        }
        
        lastTime = ct;
        lastRAFTime = timeNow;
        
        // Лимит времени с учетом количества кругов (videoLoops * maxVideoDuration)
        const maxDurationCap = (rootDomain.includes('pinterest.') && config.pinterestMaxVideoDuration > 0)
            ? (config.videoLoops * config.pinterestMaxVideoDuration)
            : (config.videoLoops * videoInitialDuration);

        if (currentLoopCount >= config.videoLoops || accumulatedTime >= maxDurationCap) {
            // Циклы или лимит времени завершены, запускаем паузу после видео
            countdownSeconds = config.delayAfterVideo;
            isCountingDown = true;
            runPhotoTimer();
            return;
        }
        
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
        let anyPaused = false;
        if (slideshowActive && !slideshowPaused) {
            setSlideshowPaused(true);
            anyPaused = true;
        }
        if (window._mossadGalleryActive && !window._mossadGalleryPaused) {
            window._mossadGalleryPaused = true;
            sessionStorage.setItem('mossad_gallery_paused', 'true');
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
        if (manualPaused && !_pausedByTab && !_pausedByBrsr) return;

        if (slideshowActive) {
            setSlideshowPaused(false);
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
                window.location.href = config.pinterestHistory[idx];
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
            window.location.href = config.pinterestHistory[idx];
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
                    window.location.href = config.pinterestHistory[idx];
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
                window.location.href = target.url;
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
        const initRight = (savedPos && savedPos.right) ? savedPos.right : null;

        container.style.cssText = `
            position: fixed;
            top: ${initTop};
            ${initRight ? `right: ${initRight}; left: auto;` : initLeft ? `left: ${initLeft};` : 'right: 20px;'}
            z-index: 999998;
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; user-select: none;
            display: flex; flex-direction: column; gap: 4px; pointer-events: none;
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
            transition: all 0.3s ease; cursor: grab; pointer-events: auto;
        `;
        window.makeWidgetDraggable(topBar);
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 13px; min-width: 95px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 4px;`;

        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.innerHTML = '🚀 Пуск';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 5px 12px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;

        const btnDL = document.createElement('button');
        btnDL.innerHTML = '💾';
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 14px; padding: 4px 8px;`;

        const btnReset = document.createElement('button');
        btnReset.id = 'mossad-btn-rewind-bar';
        btnReset.innerHTML = '↺';
        btnReset.title = `Мотать в начало (${formatHotkey(config.hk.rewind)})`;
        btnReset.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 15px; padding: 0 4px;`;

        const btnUpdate = document.createElement('button');
        btnUpdate.innerHTML = '🔄';
        btnUpdate.title = 'Обновить скрипт (Win+Alt+R)';
        btnUpdate.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #60a5fa; cursor: pointer; font-size: 14px; padding: 4px 8px; transition: transform 0.2s ease;`;
        btnUpdate.onclick = () => {
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        };

        const btnSnap = document.createElement('button');
        btnSnap.innerHTML = '⤢';
        btnSnap.title = 'Привязать к правому верхнему углу (-50px)';
        btnSnap.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 13px; padding: 0 3px; line-height: 1; transition: color 0.2s;`;
        btnSnap.onmouseenter = () => { btnSnap.style.color = '#60a5fa'; };
        btnSnap.onmouseleave = () => { btnSnap.style.color = '#6b7280'; };
        btnSnap.onclick = () => {
            container.style.right = '50px';
            container.style.top = '50px';
            container.style.left = 'auto';
            try {
                localStorage.setItem('mossad_widget_pos', JSON.stringify({ right: '50px', top: '50px' }));
            } catch(err) {}
        };

        const btnTogglePanel = document.createElement('button');
        btnTogglePanel.id = 'mossad-btn-toggle-panel';
        btnTogglePanel.innerHTML = '▼';
        btnTogglePanel.title = 'Меню настроек';
        btnTogglePanel.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 13px; padding: 0 4px; line-height: 1; transition: transform 0.2s, color 0.2s;`;
        btnTogglePanel.onmouseenter = () => { btnTogglePanel.style.color = '#fff'; };
        btnTogglePanel.onmouseleave = () => { btnTogglePanel.style.color = '#9ca3af'; };
        btnTogglePanel.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };

        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.title = 'Скрыть виджет (Ctrl+Insert)';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1; transition: color 0.2s;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        // Порядок: …таймер… | 🚀Пуск | 💾 | ↺ | 🔄 | ⤢ | ▼ | ✕
        topBar.append(timerEl, btnStart, btnDL, btnReset, btnUpdate, btnSnap, btnTogglePanel, btnClose);

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
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <label title="Использовать шаблон имени файла при скачивании" style="display:flex; align-items:center; gap:4px; white-space:nowrap; cursor:pointer;">
                        <input id="mossad-cb-fn-tpl" type="checkbox" style="accent-color:#3b82f6;" ${config.filenameTemplateEnabled ? 'checked' : ''}> Шаблон:
                    </label>
                    <input id="mossad-in-fn-tpl" type="text" placeholder="${rootDomain.includes('redgifs.com') ? '{userName}-{domain[4]}' : '{id8}-{domain}.{ext}'}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон: {userName} {id8} {id} {domain} {title} {date} {time} {ext} {n} {dbl} {oldname}"
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
                    <label title="Удержание позиции + автоподтверждение удаления"><input id="mossad-cb-holdpost" type="checkbox" style="accent-color:#3b82f6;" ${(config.deleteHoldpost || config.deleteAutoconfirm) ? 'checked' : ''}> hold post</label>
                    ` : ''}
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-btn-hk" style="flex:1; background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px; color:#60a5fa; cursor:pointer; font-weight:bold; transition:all 0.2s;">⚙ Настройки</button>
                    <button id="mossad-btn-import-db" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#34d399; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Импортировать базу хешей (результат scan_local_files.py)">📥 База</button>
                    <button id="mossad-btn-rewind" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#9ca3af; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Мотать в начало (${formatHotkey(config.hk.rewind)})">↺</button>
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
                const cbHold = panel.querySelector('#mossad-cb-holdpost');
                if (cbHold) {
                    cbHold.onchange = (e) => {
                        Settings.set('deleteHoldpost', e.target.checked);
                        Settings.set('deleteAutoconfirm', e.target.checked);
                    };
                }
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
        // Скачать и удалить: работает только на страницах постов grok.com
        btnDL.onclick = () => {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            triggerDownload();
        };
        btnReset.onclick = () => doRewind();

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
            btnReset.title = `Мотать в начало (${formatHotkey(config.hk.rewind)})`;
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
              <span>v${SCRIPT_VERSION} · 2026-09-10</span>
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
            nextSlide: 'Следующий слайд (PageDown)',
            prevSlide: 'Предыдущий слайд (PageUp)',
            download: 'Скачать (DL)',
            upscale: 'Улучшить',
            deleteVid: 'Удалить видео',
            sound: 'Звук (вкл/выкл)',
            playPause: 'Пауза/Плей',
            help: 'Настройки клавиш',
            history: 'История (Grok)', 
            slideshowPanel: 'Меню слайдшоу',
            slideshowStart: 'Старт слайдшоу',
            duplicateNext: 'Дублировать в фоне + Слайд (Ctrl+Пробел)',
            rewind: 'Мотать в начало'
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
        const isFwd = (dir === 'next');
        const wasPaused = (typeof slideshowPaused !== 'undefined' && slideshowPaused) ||
                          sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true' ||
                          sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          !!window._mossadGalleryPaused;

        // 1. GROK ENGINE
        if (rootDomain === 'grok.com') {
            const rawCol = (typeof _gSS !== 'undefined' && _gSS.getItem)
                ? _gSS.getItem(GALLERY_COLLECTION_KEY)
                : sessionStorage.getItem('mossad_grok_collection');
            let colData = null;
            if (rawCol) { try { colData = JSON.parse(rawCol); } catch(e) {} }
            const items = colData?.items || [];

            const curId = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(location.pathname)
                : (location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1] ||
                   location.search.match(/[?&]post=([^&]+)/)?.[1]);

            const curIdx = (curId && items.length > 0)
                ? items.findIndex(it => (it.url || '').toLowerCase().includes(curId.toLowerCase()))
                : -1;

            if (curIdx === -1) {
                if (typeof grokStepFilmstrip === 'function' && grokStepFilmstrip(isFwd)) {
                    _postPlayerNav(wasPaused);
                    return;
                }
            } else {
                const loopItems = (typeof getGrokActiveLoopItems === 'function') ? getGrokActiveLoopItems(items) : [];
                let targetItem = null;
                let targetIdx = -1;

                if (loopItems.length > 0) {
                    const curLoopIdx = loopItems.findIndex(it => (it.url || '').toLowerCase().includes(curId.toLowerCase()));
                    let nextLoopIdx = 0;
                    if (curLoopIdx !== -1) {
                        nextLoopIdx = isFwd
                            ? (curLoopIdx + 1) % loopItems.length
                            : (curLoopIdx - 1 + loopItems.length) % loopItems.length;
                    }
                    targetItem = loopItems[nextLoopIdx];
                    targetIdx = items.indexOf(targetItem);
                } else {
                    const grpMode = colData.grpMode || 'seq';
                    const itemMode = colData.itemMode || 'fwd';
                    const isRandom = (grpMode === 'rnd' || itemMode === 'rnd' || config.slideshowMode === 'random');

                    if (isRandom) {
                        let hist = [];
                        try { hist = JSON.parse(sessionStorage.getItem('mossad_player_hist') || '[]'); } catch(e) {}
                        if (isFwd) {
                            hist.push(curIdx);
                            if (hist.length > 50) hist.shift();
                            sessionStorage.setItem('mossad_player_hist', JSON.stringify(hist));

                            let rnd = Math.floor(Math.random() * (items.length - 1));
                            if (rnd >= curIdx) rnd++;
                            targetIdx = rnd;
                        } else {
                            if (hist.length > 0) {
                                targetIdx = hist.pop();
                                sessionStorage.setItem('mossad_player_hist', JSON.stringify(hist));
                            } else {
                                targetIdx = (curIdx - 1 + items.length) % items.length;
                            }
                        }
                    } else if (itemMode === 'rev') {
                        targetIdx = isFwd ? (curIdx - 1) : (curIdx + 1);
                        if (targetIdx < 0) {
                            if (config.loopFeed || true) targetIdx = items.length - 1;
                            else { showToast('⚠️ Начало коллекции', true); return; }
                        } else if (targetIdx >= items.length) {
                            if (config.loopFeed || true) targetIdx = 0;
                            else { showToast('⚠️ Конец коллекции', true); return; }
                        }
                    } else {
                        targetIdx = isFwd ? (curIdx + 1) : (curIdx - 1);
                        if (targetIdx >= items.length) {
                            if (config.loopFeed || true) {
                                targetIdx = 0;
                                showToast('🔄 Новый круг коллекции');
                            } else {
                                showToast('⚠️ Конец коллекции', true);
                                return;
                            }
                        } else if (targetIdx < 0) {
                            if (config.loopFeed || true) {
                                targetIdx = items.length - 1;
                            } else {
                                showToast('⚠️ Начало коллекции', true);
                                return;
                            }
                        }
                    }
                    targetItem = items[targetIdx];
                }

                if (targetItem) {
                    const rawSs = (typeof _gSS !== 'undefined' && _gSS.getItem)
                        ? _gSS.getItem(GALLERY_SS_KEY)
                        : sessionStorage.getItem('mossad_grok_gallery_ss');
                    if (rawSs) {
                        try {
                            const ss = JSON.parse(rawSs);
                            if (targetIdx >= 0) {
                                ss.queue = [...items.slice(targetIdx + 1), ...items.slice(0, targetIdx)];
                                _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                            }
                        } catch(e) {}
                    }

                    if (targetItem.type) sessionStorage.setItem('mossad_expected_type', targetItem.type);
                    const dispIdx = (targetIdx >= 0 ? targetIdx : curIdx) + 1;
                    showToast(`${isFwd ? '⏭' : '⏮'} ${dispIdx}/${items.length} • ${targetItem.type === 'video' ? '📹' : '🖼'}`);
                    grokSpaNavigate(targetItem.url);
                    setTimeout(() => {
                        if (typeof grokHighlightActivePlaylistItem === 'function') {
                            grokHighlightActivePlaylistItem(targetItem.url);
                        }
                    }, 120);
                    _postPlayerNav(wasPaused);
                    return;
                }
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

    // Ранний перехват клавиш слайдера (PageUp / PageDown) ДО сайта на window в фазе capture
    window.addEventListener('keydown', function handlePlayerSlideKeys(e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) return;

        // Перехватываем ТОЛЬКО пока слайдшоу активно или на паузе. При STOP — не перехватываем!
        if (!isSlideshowActiveOrPaused()) return;

        const isNext = hotkeyMatches(e, config.hk.nextSlide);
        const isPrev = hotkeyMatches(e, config.hk.prevSlide);

        if (isNext || isPrev) {
            e.preventDefault();
            e.stopImmediatePropagation();
            playerStepSlide(isNext ? 'next' : 'prev');
        }
    }, true);

    document.addEventListener('keydown', function (e) {
        if (window.capturingFor !== null) return;
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (isEditing) { if (!/^F\d+$/.test(e.key)) return; }

        if (hotkeyMatches(e, config.hk.help)) {
            e.preventDefault();
            if (document.getElementById('mossad-hk-modal')) return;
            openHotkeySettings();
        }

        if (hotkeyMatches(e, config.hk.slideshowPanel)) {
            e.preventDefault();
            window.widgetState = (window.widgetState === 'hidden') ? 'bar' : 'hidden';
            window.updateWidgetUI();
        }

        if (hotkeyMatches(e, config.hk.slideshowStart)) {
            e.preventDefault();
            startSlideshow();
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
