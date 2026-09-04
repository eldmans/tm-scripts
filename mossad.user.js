// ==UserScript==
// @name         MOSSAD (Media Objects Slideshow and Download)
// @namespace    http://tampermonkey.net/
// @version      1.2.50
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

const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.2.50';
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
        return e.key === hk.key &&
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
                            if (urlReq.result) addRecordToMemoryCache(urlReq.result);
                            resolve(urlReq.result || null);
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
    async function saveFileToHistory({ hash, filename, url, postUrl, path, size, type }) {
        try {
            const db = await getDownloadDB();
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
            const isVid = type === 'video' || (filename && /\.(mp4|webm|mov|mkv)$/i.test(filename));

            const record = {
                id: hash || `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                hash: hash || '',
                filename: filename || 'unknown',
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
            const oldBase = duplicateRecord ? (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim() : '';
            const dblSuffix = duplicateRecord ? ` (${oldBase || 'original'}) DBL` : '';

            let grokFilename = `${shortId}-grok${dblSuffix}.${ext2}`;

            if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
                const now2 = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
                const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
                const vars = {
                    id:      currentPostId || '',
                    uuid:    currentPostId || '',
                    hash:    currentPostId || '',
                    postid:  currentPostId || '',
                    id8:     shortId,
                    hash8:   shortId,
                    uuid8:   shortId,
                    domain:  'grok',
                    title:   'Imagine - Grok',
                    date:    dateStr,
                    time:    timeStr,
                    ext:     ext2,
                    n:       String(Date.now()).slice(-6),
                    dbl:     dblSuffix,
                    oldname: oldBase,
                    copy:    oldBase
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

            // hold post: предварительный шаг в направлении DPad и возврат для надежной фиксации целевого URL
            if (config.deleteHoldpost) {
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

                // 1. Листаем вперед в сторону DPad
                sendKey(forwardKey);

                // Ждем смены URL на целевой пост
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

                // 2. Листаем обратно на исходный пост
                if (finalTargetUrl) {
                    console.log(`[MOSSAD] hold post: найден целевой финишный пост: ${finalTargetUrl}`);
                    sendKey(backKey);

                    const backStart = Date.now();
                    while (Date.now() - backStart < 1500) {
                        await new Promise(r => setTimeout(r, 40));
                        if (location.href === initialUrl) break;
                        if (Date.now() - backStart > 350 && location.href !== initialUrl) {
                            sendKey(backKey);
                        }
                    }
                    await new Promise(r => setTimeout(r, 250)); // пауза для готовности DOM исходного поста
                } else {
                    // Фолбэк на анализ DOM / коллекцию, если шаг не изменил URL
                    finalTargetUrl = getGrokNeighborPostUrl();
                    console.warn('[MOSSAD] hold post: шаг вперед не изменил URL, fallback:', finalTargetUrl);
                }
            }

            // 3. Запуск удаления и подтверждения
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];

            const triggerConfirm = () => {
                if (!config.deleteAutoconfirm) return;
                retryAction((attempt) => {
                    const confirmKeywords = ['удалить изображение', 'удалить видео', 'удалить', 'delete', 'confirm', 'ok', 'yes', 'да'];
                    const dialog = document.querySelector('[role="dialog"]') || document;
                    const confirmBtn = findGrokButton(confirmKeywords, dialog);
                    if (confirmBtn) {
                        triggerClick(confirmBtn, 'Confirm Delete');
                        console.log('[MOSSAD] Delete confirmed on attempt', attempt);
                        return true;
                    }
                    return false;
                }, [100, 250, 450, 750]);
            };

            const directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;

            if (directDelBtn) {
                triggerClick(directDelBtn, 'Delete Button');
                showToast('✕ Удаление...');
                triggerConfirm();
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
                                triggerConfirm();
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

            // 4. Если включен hold post и зафиксирован finalTargetUrl:
            // ждем, пока сменится URL (пост удалился и Grok перекинул со страницы),
            // и в этот момент немедленно переходим на целевой сохранённый URL
            if (config.deleteHoldpost && finalTargetUrl) {
                const waitStart = Date.now();
                let urlRedirected = false;
                while (Date.now() - waitStart < 8000) {
                    await new Promise(r => setTimeout(r, 40));
                    if (location.href !== initialUrl) {
                        urlRedirected = true;
                        break;
                    }
                }

                console.log(`[MOSSAD] hold post: удаление завершено (смена URL: ${urlRedirected}). Переход на: ${finalTargetUrl}`);
                showToast('🎯 Переход к сохранённому посту...');
                window.location.href = finalTargetUrl;
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }

    // Граница: только на странице поста grok.com/imagine/post/... работают DL, Delete, слайдшоу и т.д.
    const isGrokPostPage  = () => rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    const isGrokSavedPage = () => rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);

    // ============================================================
    // GROK IMAGINE GALLERY — сбор ссылок + рандомное слайдшоу
    // ============================================================
    // sessionStorage: живёт только в текущей вкладке, умирает при закрытии, не смешивается между вкладками
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const _gSS = sessionStorage; // короткий псевдоним

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

    /** Собирает все уникальные ссылки /imagine/post/... из DOM + определяет тип по span с таймером */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        document.querySelectorAll('a[href*="/imagine/post/"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href) return;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            if (seen.has(url)) return;
            seen.add(url);
            // Карточка — ближайший listitem / masonry-item родитель
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            // Видео = есть span с классом tabular-nums (таймер 0:06)
            const hasTimer = !!(card && card.querySelector('span.tabular-nums'));
            items.push({ url, type: hasTimer ? 'video' : 'photo' });
        });
        return items;
    }

    /** Fisher-Yates перемешивание */
    function fisherYatesShuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
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

    /** Кнопка 1: сохранить коллекцию в sessionStorage (без скачивания) */
    function grokSaveCollection(btnEl) {
        const items = grokCollectLinks();
        if (items.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
            return;
        }
        const date   = new Date().toISOString().slice(0, 10);
        const videos = items.filter(i => i.type === 'video').length;
        const photos = items.length - videos;
        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({ date, items }));
        if (btnEl) {
            btnEl.textContent = `✅ ${items.length} (📹${videos} 🖼${photos})`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(items.length);
        }
        showToast(`✅ Собрано ${items.length} → 📹${videos} видео, 🖼${photos} фото`);
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

    /** Кнопка 2: запустить рандомное слайдшоу по коллекции */
    function grokStartGallerySlideshow(btnEl) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения коллекции', true); return; }
        const allItems = data.items || [];
        if (allItems.length === 0) { showToast('⚠️ Коллекция пуста', true); return; }

        const queue = fisherYatesShuffle(allItems); // queue of {url, type}
        const ss = { active: true, queue, circle: 1, total: allItems.length };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        showToast(`🎲 Слайдшоу: круг 1, ${allItems.length} генераций`);
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        // Подсказываем движку тип следующего поста
        if (next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { window.location.href = next.url; }, 300);
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        const btnSS = document.getElementById('mossad-gallery-ss');
        if (btnSS) {
            btnSS.textContent = '🎲 Слайдшоу';
            btnSS.style.background = '#1e3a5f';
            btnSS.style.color = '#93c5fd';
        }
        showToast('⏹ Gallery слайдшоу остановлено');
    }

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
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px 12px;
            display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab;
        `;

        const btnCollect = document.createElement('button');
        btnCollect.id = 'mossad-gallery-collect';
        let savedCount = 0;
        try {
            const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (cRaw) savedCount = (JSON.parse(cRaw).items || []).length;
        } catch(e) {}
        btnCollect.textContent = savedCount > 0 ? `📋 Собрано (${savedCount})` : '📋 Собрать';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else {
                showToast('ℹ️ Переход на /imagine/saved для сбора...');
                setTimeout(() => { window.location.href = 'https://grok.com/imagine/saved'; }, 300);
            }
        };

        if (isGrokSavedPage()) {
            // Мониторим изменение числа ссылок на странице каждые 2с
            setInterval(() => {
                const currentCount = document.querySelectorAll('a[href*="/imagine/post/"]').length;
                const sc = parseInt(btnCollect.dataset.collectedCount || String(savedCount), 10);
                if (sc === 0) return;
                if (currentCount !== sc) {
                    const diff = currentCount - sc;
                    const sign = diff > 0 ? '+' : '';
                    btnCollect.textContent = `🔴 ${currentCount} (${sign}${diff})`;
                    btnCollect.style.background = '#7f1d1d';
                    btnCollect.style.color = '#fca5a5';
                    btnCollect.dataset.collectedCount = String(currentCount);
                }
            }, 2000);
        }

        // На странице /saved слайдшоу никогда не должно гореть красным «Стоп»
        const _ssActive = (() => {
            if (isGrokSavedPage()) return false;
            try {
                const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                return !!item.active && (slideshowActive || sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true');
            } catch { return false; }
        })();

        const btnSS = document.createElement('button');
        btnSS.id = 'mossad-gallery-ss';
        btnSS.textContent = _ssActive ? '⏹ Стоп' : '🎲 Слайдшоу';
        btnSS.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:${_ssActive ? '#7f1d1d' : '#1e3a5f'};color:${_ssActive ? '#fca5a5' : '#93c5fd'};transition:all 0.2s;`;
        btnSS.onclick = () => {
            const active = (() => {
                try {
                    const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                    return !!item.active;
                } catch { return false; }
            })();
            if (active) {
                grokStopGallerySlideshow();
                stopSlideshow();
                btnSS.textContent = '🎲 Слайдшоу';
                btnSS.style.background = '#1e3a5f'; btnSS.style.color = '#93c5fd';
            } else {
                grokStartGallerySlideshow(btnSS);
            }
        };

        const btnDl = document.createElement('button');
        btnDl.id = 'mossad-gallery-dl';
        btnDl.textContent = '📥';
        btnDl.title = 'Скачать коллекцию .txt';
        btnDl.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 8px;font-size:14px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;
        btnDl.onclick = () => grokDownloadCollection();

        // Стрелочка вниз: открывает/закрывает вторую полоску (TopBar)
        const btnToggleTop = document.createElement('button');
        btnToggleTop.id = 'mossad-gallery-toggle-top';
        btnToggleTop.innerHTML = '▼';
        btnToggleTop.title = 'Показать / скрыть панель управления';
        btnToggleTop.style.cssText = `background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:12px;padding:0 4px;transition:color 0.2s;`;
        btnToggleTop.onclick = () => {
            window.widgetState = window.widgetState === 'hidden' ? 'bar' : 'hidden';
            if (window.updateWidgetUI) window.updateWidgetUI();
        };

        row.append(btnCollect, btnSS, btnDl, btnToggleTop);
        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
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

        // Показываем индикатор
        const indicator = document.createElement('div');
        indicator.id = 'mossad-gallery-indicator';
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        indicator.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.1); border-radius:10px;
            padding:6px 16px; font-family:system-ui,sans-serif; font-size:12px;
            color:#9ca3af; display:flex; align-items:center; gap:10px;
            box-shadow:0 4px 20px rgba(0,0,0,0.5);
        `;
        indicator.innerHTML = `<span>🎲 Круг ${ss.circle} · ${showed}/${ss.total}</span><button id="mgi-stop" style="background:#374151;border:none;border-radius:6px;color:#f87171;padding:3px 8px;cursor:pointer;font-size:11px;font-weight:bold;">⏹</button>`;
        document.body.appendChild(indicator);

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            indicator.remove();
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
                queue = fisherYatesShuffle(allItems);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            // Подсказываем движку тип следующего поста — нет 6с ожидания на фото
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            window.location.href = next.url || next; // поддержка старых строковых очередей
        };

        document.getElementById('mgi-stop').onclick = () => {
            grokStopGallerySlideshow();
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            stopSlideshow();
            indicator.remove();
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = false;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        setTimeout(() => scheduleNextSlideCycle(0), 300);
    }

    /** Клавиши ←→ по коллекции (только если текущий пост есть в списке) */
    function grokGalleryKeyboardNav() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (items.length === 0) return;

        // UUID текущего поста
        const currentId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
        if (!currentId) return;
        if (!items.some(it => it.url.includes(currentId))) return; // не наш пост — не перехватываем

        document.addEventListener('keydown', function _gNav(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

            // Перепроверяем по актуальному URL
            const curId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
            const curIdx = curId ? items.findIndex(it => it.url.includes(curId)) : -1;
            if (curIdx === -1) {
                document.removeEventListener('keydown', _gNav, true);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const nextIdx = e.key === 'ArrowRight'
                ? (curIdx + 1) % items.length
                : (curIdx - 1 + items.length) % items.length;
            const next = items[nextIdx];
            if (next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            showToast(`←→ ${nextIdx + 1}/${items.length} • ${next.type === 'video' ? '📹' : '🖼'}`);
            window.location.href = next.url;
        }, true); // capture — раньше страницы
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

    // Точная копия из 2.1.7-redgifs-drag
    function getActiveRedGifsItem() {
        return document.querySelector('.GifPreview_isActive')
            || document.querySelector('.GifPreview')
            || document.querySelector('[data-feed-item-id]');
    }

    function getRedGifsVideo() {
        const active = getActiveRedGifsItem();
        if (active) {
            const v = active.querySelector('video');
            if (v) return v;
        }
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        let bestVideo = null;
        let maxVisibleHeight = 0;
        const vh = window.innerHeight;
        for (const v of videos) {
            const rect = v.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
            if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                bestVideo = v;
            }
        }
        return bestVideo || videos[0];
    }

    function getRedGifsTitleFilename(itemId) {
        let rawTitle = (document.title || '').trim();
        if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
            rawTitle = rawTitle.slice(1, -1).trim();
        }
        if (rawTitle) {
            const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            if (safeTitle.length > 0) return `${safeTitle}.mp4`;
        }
        return `redgifs_${itemId}_${Date.now()}.mp4`;
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

        // 1. Точная копия логики из старого скрипта (grok_hotkeys_plus_slideshow.user.js от 4 августа)
        if (rootDomain.includes('redgifs.com')) {
            const active = getActiveRedGifsItem();
            const urls = [];
            const itemId = active ? active.getAttribute('data-feed-item-id') : null;

            // Из картинки poster
            if (active) {
                const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]');
                if (poster && poster.src) {
                    const mp4Hd = poster.src.replace(/-mobile\.(jpg|png|jpeg)/i, '.mp4').replace(/\.(jpg|png|jpeg)/i, '.mp4');
                    const mp4Sd = poster.src.replace(/\.(jpg|png|jpeg)/i, '-mobile.mp4');
                    urls.push(mp4Hd, mp4Sd);
                }
            }

            const v = getRedGifsVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/hd.m3u8`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/sd.m3u8`);
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
        const isDup = Boolean(currentDup && currentDup.filename);
        const oldBase = isDup ? (currentDup.filename || '').replace(/\.[^/.]+$/, '').trim() : '';
        const dblSuffix = isDup ? ` (${oldBase || 'original'}) DBL` : '';
        
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
                id:      postId,
                uuid:    postId,
                hash:    postId,
                postid:  postId,
                id8:     shortId,
                hash8:   shortId,
                uuid8:   shortId,
                title:   titleClean2,
                date:    dateStr,
                time:    timeStr,
                ext:     ext2,
                domain:  domainClean,
                n:       nStr,
                dbl:     dblSuffix,
                oldname: oldBase,
                copy:    oldBase,
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
            const isM3u8 = targetUrl.includes('.m3u8');
            const targetFilename = isM3u8 ? filename.replace('.mp4', '.m3u8') : filename;
            
            if (typeof GM_download === 'function' && targetUrl.endsWith('.m3u8')) {
                try {
                    GM_download({
                        url: targetUrl,
                        name: targetFilename,
                        saveAs: false,
                        onerror: (err) => {
                            console.warn(`GM_download failed for ${targetUrl}:`, err);
                            tryNext();
                        }
                    });
                    if (typeof performPostDownloadAction === 'function') {
                        performPostDownloadAction();
                    }
                } catch (e) {
                    tryNext();
                }
            } else {
                showToast('⏳ Запуск скачивания...');
                triggerDirectBlobDownload(targetUrl, targetFilename, tryNext);
                if (typeof performPostDownloadAction === 'function') {
                    performPostDownloadAction();
                }
            }
        }
        
        tryNext();
    }

// ============================================
    // SLIDESHOW LOGIC (AUTO) & SESSION PERSISTENCE
    // ============================================
    const SESSION_ACTIVE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`;
    const SESSION_STATE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_wstate`;

    let slideshowActive = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
    let slideshowPaused = false;
    let slideshowTimeoutId = null;
    let downloadTimeoutId = null;
    let countdownSeconds = 0;
    let isCountingDown = false; // Отсчет времени после видео или для фото
    
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

            // 2. Grok: кнопка Full Screen
            if (rootDomain === 'grok.com') {
                const fsKeywords = ['во весь экран', 'полноэкран', 'full screen', 'fullscreen'];
                const btn = (typeof findGrokButton === 'function' ? findGrokButton(fsKeywords) : null)
                    || Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        const title = (b.getAttribute('title') || '').toLowerCase();
                        return fsKeywords.some(k => aria.includes(k) || title.includes(k));
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
        if (!slideshowActive) return;
        
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
        slideshowPaused = false;
        isCountingDown = false;
        sessionStorage.removeItem(SESSION_ACTIVE_KEY);
        sessionStorage.removeItem(SESSION_STATE_KEY);
        if (slideshowTimeoutId) clearTimeout(slideshowTimeoutId);
        if (downloadTimeoutId) clearTimeout(downloadTimeoutId);
        if (rafId) cancelAnimationFrame(rafId);
        if (rootDomain === 'grok.com') {
            _gSS.removeItem(GALLERY_SS_KEY);
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;
            const ind = document.getElementById('mossad-gallery-indicator');
            if (ind) ind.remove();
            const btnSS = document.getElementById('mossad-gallery-ss');
            if (btnSS) {
                btnSS.textContent = '🎲 Слайдшоу';
                btnSS.style.background = '#1e3a5f';
                btnSS.style.color = '#93c5fd';
            }
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
                const ind = document.getElementById('mossad-gallery-indicator');
                if (ind) ind.remove();
            }
            slideshowActive = true;
            slideshowPaused = false;
            sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
            sessionStorage.setItem(SESSION_STATE_KEY, 'bar');
            // Закрываем модальное окно настроек горячих клавиш (если открыто)
            const hkModal = document.getElementById('mossad-hk-modal');
            if (hkModal) hkModal.remove();
            // Сворачиваем виджет в компактную полоску (bar)
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
        if (!slideshowActive || slideshowPaused) return;
        const dirs = config.slideshowDirections;
        if (!dirs || dirs.length === 0) { stopSlideshow(); return; }

        // Защита от зацикливания на конце ленты
        const curUrl = location.href;
        if (curUrl === _lastSlideUrl) {
            _samePageSlideCount++;
            if (_samePageSlideCount > SAME_PAGE_LIMIT) {
                console.warn('[MOSSAD] Превышен лимит перелистываний без смены страницы, остановка.');
                stopSlideshow();
                showToast('⏹ Слайдшоу остановлен: конец ленты', true);
                return;
            }
        } else {
            _samePageSlideCount = 0;
            _lastSlideUrl = curUrl;
        }

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

        // Листание
        const key = getArrowKey(dirs[0]);
        document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        triggerUniversalFullScreen();
        setTimeout(() => {
            scheduleNextSlideCycle(0);
        }, 500);
    }

    function getPinMediaType() {
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

        container.style.cssText = `
            position: fixed;
            top: ${initTop};
            ${initLeft ? `left: ${initLeft};` : 'right: 20px;'}
            z-index: 999998;
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; user-select: none;
            display: flex; flex-direction: column; gap: 4px;
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
            transition: all 0.3s ease; cursor: grab;
        `;
        window.makeWidgetDraggable(topBar);
        
        const timerEl = document.createElement('div');
        timerEl.id = 'mossad-timer';
        timerEl.style.cssText = `font-family: monospace; font-size: 13px; min-width: 95px; width: auto; white-space: nowrap; text-align: center; color: #9ca3af; padding: 0 4px;`;
        
        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.title = 'Скрыть виджет';
        btnClose.style.cssText = `background: transparent; border: none; color: #6b7280; cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1; transition: color 0.2s;`;
        btnClose.onmouseenter = () => { btnClose.style.color = '#f87171'; };
        btnClose.onmouseleave = () => { btnClose.style.color = '#6b7280'; };
        btnClose.onclick = () => {
            window.widgetState = 'hidden';
            window.updateWidgetUI();
        };

        const btnReset = document.createElement('button');
        btnReset.id = 'mossad-btn-rewind-bar';
        btnReset.innerHTML = '↺';
        btnReset.title = 'Перемотка (Alt+R)';
        btnReset.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 15px; padding: 0 4px;`;

        const btnStart = document.createElement('button');
        btnStart.id = 'mossad-btn-start';
        btnStart.innerHTML = '🚀 Пуск';
        btnStart.style.cssText = `
            cursor: pointer; border: none; border-radius: 6px; padding: 5px 12px;
            font-weight: 700; font-size: 13px; transition: all 0.2s ease;
            background: #1f2937; color: #e5e7eb;
        `;
        
        const btnGear = document.createElement('button');
        btnGear.innerHTML = '⚙▼';
        btnGear.style.cssText = `background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 14px; padding: 0 4px; transition: color 0.2s ease;`;
        
        const btnDL = document.createElement('button');
        btnDL.innerHTML = '💾';
        btnDL.title = 'Скачать';
        btnDL.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #10b981; cursor: pointer; font-size: 14px; padding: 4px 8px;`;

        const btnUpdate = document.createElement('button');
        btnUpdate.innerHTML = '🔄';
        btnUpdate.title = 'Обновить скрипт (Win+Alt+R)';
        btnUpdate.style.cssText = `background: #1f2937; border: none; border-radius: 6px; color: #60a5fa; cursor: pointer; font-size: 14px; padding: 4px 8px; transition: transform 0.2s ease;`;
        btnUpdate.onclick = () => {
            window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
        };

        // Порядок: ✕ | …таймер… | 🚀Пуск | ⚙▼ | 💾 | ↺ | 🔄
        topBar.append(btnClose, timerEl, btnStart, btnGear, btnDL, btnReset, btnUpdate);

        // SETTINGS PANEL
        const panel = document.createElement('div');
        panel.id = 'mossad-panel';
        panel.style.cssText = `
            background: rgba(20, 20, 20, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px;
            display: flex; flex-direction: column; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-size: 12px; transition: all 0.3s ease; opacity: 0; pointer-events: none; transform: translateY(-10px);
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
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                        <button class="mossad-dpad" data-dir="up" style="background: ${dirs.includes('up') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▲</button>
                        <div style="display: flex; gap: 2px;">
                            <button class="mossad-dpad" data-dir="left" style="background: ${dirs.includes('left') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">◀</button>
                            <button class="mossad-dpad" data-dir="down" style="background: ${dirs.includes('down') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▼</button>
                            <button class="mossad-dpad" data-dir="right" style="background: ${dirs.includes('right') ? '#10b981' : '#1f2937'}; border: 1px solid #374151; color: #fff; width:24px; height:24px; border-radius:4px; cursor:pointer;">▶</button>
                        </div>
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
                    <input id="mossad-in-fn-tpl" type="text" placeholder="{id8}-{domain}.{ext}" value="${(config.filenameTemplate || '').replace(/"/g, '&quot;')}"
                        title="Шаблон имени файла. Переменные: {id8} {id} {domain} {title} {date} {time} {ext} {n} {dbl} {oldname}"
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
                    <label title="Автоподтверждение удаления"><input id="mossad-cb-aconfirm" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteAutoconfirm ? 'checked' : ''}> a.confirm</label>
                    <label title="Умный возврат к посту"><input id="mossad-cb-holdpost" type="checkbox" style="accent-color:#3b82f6;" ${config.deleteHoldpost ? 'checked' : ''}> hold post</label>
                    ` : ''}
                </div>
                <div style="border-top: 1px solid #374151; margin: 4px 0;"></div>
                <div style="display:flex; gap:6px;">
                    <button id="mossad-btn-hk" style="flex:1; background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px; color:#60a5fa; cursor:pointer; font-weight:bold; transition:all 0.2s;">⚙ Настройки</button>
                    <button id="mossad-btn-import-db" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#34d399; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Импортировать базу хешей (результат scan_local_files.py)">📥 База</button>
                    <button id="mossad-btn-rewind" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#9ca3af; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Мотать до начала/конца ленты">↺</button>
                    <button id="mossad-btn-reset-cfg" style="background:#374151; border:1px solid #4b5563; border-radius:4px; padding:6px 8px; color:#f87171; cursor:pointer; font-weight:bold; transition:all 0.2s;" title="Сбросить все настройки и клавиши по умолчанию">↺ Сброс</button>
                    <input id="mossad-file-db" type="file" accept=".json" style="display:none;">
                </div>
            `;
            
            // Listeners for panel
            panel.querySelectorAll('.mossad-dpad').forEach(btn => {
                btn.onclick = () => Settings.set('slideshowDirections', [btn.dataset.dir]);
            });
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
                panel.querySelector('#mossad-cb-aconfirm').onchange = (e) => Settings.set('deleteAutoconfirm', e.target.checked);
                panel.querySelector('#mossad-cb-holdpost').onchange = (e) => Settings.set('deleteHoldpost', e.target.checked);
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
        btnGear.onclick = () => {
            window.widgetState = window.widgetState === 'panel' ? 'bar' : 'panel';
            window.updateWidgetUI();
        };
        // Скачать и удалить: работает только на страницах постов grok.com
        btnDL.onclick = () => {
            if (rootDomain === 'grok.com' && !isGrokPostPage()) return;
            triggerDownload();
        };
        const doRewind = () => {
            let oppDir = 'down';
            const d0 = (config.slideshowDirections || ['up'])[0];
            if (d0 === 'up') oppDir = 'down';
            else if (d0 === 'down') oppDir = 'up';
            else if (d0 === 'left') oppDir = 'right';
            else if (d0 === 'right') oppDir = 'left';
            const key = getArrowKey(oppDir);
            let lastUrl = location.href; let unchangedCount = 0;
            const interval = setInterval(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                setTimeout(() => {
                    if (location.href === lastUrl) {
                        unchangedCount++;
                        if (unchangedCount >= 4) clearInterval(interval);
                    } else { lastUrl = location.href; unchangedCount = 0; }
                }, 60);
            }, 120);
        };
        btnReset.onclick = doRewind;

        window.updateWidgetUI = () => {
            if (window.widgetState === 'hidden') {
                topBar.style.display = 'none';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'bar') {
                topBar.style.display = 'flex';
                panel.style.opacity = '0';
                panel.style.pointerEvents = 'none';
                panel.style.transform = 'translateY(-10px)';
            } else if (window.widgetState === 'panel') {
                topBar.style.display = 'flex';
                renderPanel(); // re-render to reflect settings
                panel.style.opacity = '1';
                panel.style.pointerEvents = 'auto';
                panel.style.transform = 'translateY(0)';
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
        document.addEventListener('DOMContentLoaded', () => { initWidget(); initGrokGalleryBar(); grokGallerySlideshowTick(); grokGalleryKeyboardNav(); });
    } else {
        initWidget();
        initGrokGalleryBar();
        grokGallerySlideshowTick();
        grokGalleryKeyboardNav();
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
              <span>v${SCRIPT_VERSION} · 2026-09-04</span>
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
            download: 'Скачать (DL)', upscale: 'Улучшить', deleteVid: 'Удалить видео', sound: 'Звук (вкл/выкл)',
            playPause: 'Пауза/Плей', help: 'Настройки клавиш', history: 'История (Grok)', 
            slideshowPanel: 'Меню слайдшоу', slideshowStart: 'Старт слайдшоу',
            nextSlide: 'Следующий слайд (Пробел)', duplicateNext: 'Дублировать в фоне + Слайд (Ctrl+Пробел)'
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
            window.widgetState = window.widgetState === 'hidden' ? 'panel' : 'hidden';
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

        // Alt+R: перемотка (Win+Alt+R: обновить скрипт)
        if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
            e.preventDefault();
            if (e.metaKey) {
                window.location.href = 'https://raw.githubusercontent.com/eldmans/tm-scripts/grok/mossad.user.js';
            } else {
                doRewind();
            }
        }

        // Принудительный следующий слайд (Пробел)
        if (hotkeyMatches(e, config.hk.nextSlide)) {
            if (slideshowActive) {
                e.preventDefault();
                showToast('⏭ Принудительный переход...');
                triggerNextSlide();
            }
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

        // Ручная навигация стрелками на Pinterest (влево/вверх = назад, вправо/вниз = вперед)
        if (rootDomain.includes('pinterest.')) {
            if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                selectNextPinterestPin('next');
            } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                selectNextPinterestPin('prev');
            }
        }
    }, true);

    // Авто кликер FullScreen при старте страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', triggerUniversalFullScreen);
    } else {
        triggerUniversalFullScreen();
    }

    // Возобновление слайдшоу после перехода/перезагрузки страницы
    if (slideshowActive) {
        showToast('▶ Слайдшоу возобновлено');
        setTimeout(() => {
            scheduleNextSlideCycle(0);
        }, 500);
    }

    // Проверяем GitHub при старте (с задержкой чтобы не мешать загрузке)
    setTimeout(checkAndPullOnStartup, 3000);

})();
