    // ============================================================
    // DOWNLOAD HISTORY & HASH DEDUPLICATION (IndexedDB + SHA-256)
    // ============================================================

    const MOSSAD_DB_NAME = 'mossad_media_db';
    const MOSSAD_DB_VERSION = 1;
    const MOSSAD_STORE_NAME = 'downloads';

    let _mossadDBPromise = null;
    let _pendingDuplicateConfirm = null; // { key, expiresAt, executeDownload }
    let _dupTimerInterval = null;
    function cleanMediaUrl(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('blob:') || url.startsWith('data:')) return url;
        try {
            const u = new URL(url);
            const transientParams = new Set([
                'token', 'expires', 'expire', 'exp', 'sig', 'signature', 'h', 'ttl',
                'validfrom', 'validto', 'ip', 't', 'st', 'e', 'auth', 'sessionid',
                'session', 'ts', 'time', '_', 'hash', 'v', 'download'
            ]);
            const sp = new URLSearchParams(u.search);
            let changed = false;
            for (const key of Array.from(sp.keys())) {
                if (transientParams.has(key.toLowerCase())) {
                    sp.delete(key);
                    changed = true;
                }
            }
            if (changed) {
                u.search = sp.toString() ? `?${sp.toString()}` : '';
            }
            return u.origin + u.pathname + (u.search || '');
        } catch (_) {
            return url.split('?')[0];
        }
    }
    window.cleanMediaUrl = cleanMediaUrl;

    function isPostUrlSpecific(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            const u = new URL(url);
            const host = u.hostname.toLowerCase();
            if (host.includes('huggingface') || host.includes('hf.space')) return false;
            if (u.pathname === '/' || u.pathname === '') return false;
            if (host.includes('grok.com') && u.pathname.includes('/imagine/post/')) return true;
            if (host.includes('pinterest.') && u.pathname.includes('/pin/')) return true;
            if (host.includes('instagram.com') && /\/(?:p|reel)\//.test(u.pathname)) return true;
            if (host.includes('redgifs.com') && u.pathname.includes('/watch/')) return true;
            if (/(?:xvideos|xnxx|xv-ru|faphouse|xhamster|noodlemagazine)/i.test(host) && /\/video/i.test(u.pathname)) return true;
            return false;
        } catch (e) {
            return false;
        }
    }
    window.isPostUrlSpecific = isPostUrlSpecific;

    async function resolveMediaHash(mediaUrl) {
        if (!mediaUrl || typeof mediaUrl !== 'string') return null;
        try {
            // v1.4.16: Fast-Hash — срез 64 КБ (bytes=0-65535) содержит moov/ftyp MP4 и заголовки фото,
            // вычисляется мгновенно (<100 мс) без выкачивания 1 МБ трафика
            if (mediaUrl.startsWith('data:')) {
                const res = await fetch(mediaUrl);
                const blob = await res.blob();
                return await computeSHA256(blob.slice(0, 65536));
            }
            if (mediaUrl.startsWith('blob:')) {
                const res = await fetch(mediaUrl);
                if (res.ok) {
                    const blob = await res.blob();
                    return await computeSHA256(blob.slice(0, 65536));
                }
            }
            // Кросс-доменные CDN ссылки через GM_xmlhttpRequest со срезом 64 КБ
            if (/^https?:\/\//i.test(mediaUrl)) {
                return new Promise((resolve) => {
                    if (typeof GM_xmlhttpRequest !== 'function') return resolve(null);
                    let settled = false;
                    const timer = setTimeout(() => {
                        if (!settled) { settled = true; resolve(null); }
                    }, 2200);

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: mediaUrl,
                        headers: { 'Range': 'bytes=0-65535' },
                        responseType: 'blob',
                        onload: async (res) => {
                            if (settled) return;
                            settled = true;
                            clearTimeout(timer);
                            if ((res.status === 200 || res.status === 206) && res.response) {
                                try {
                                    const sliceBlob = res.response.slice(0, 65536);
                                    const hash = await computeSHA256(sliceBlob);
                                    resolve(hash);
                                } catch (_) {
                                    resolve(null);
                                }
                            } else {
                                resolve(null);
                            }
                        },
                        onerror: () => {
                            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
                        },
                        ontimeout: () => {
                            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
                        }
                    });
                });
            }
        } catch (e) {}
        return null;
    }
    window.resolveMediaHash = resolveMediaHash;

    /**
     * Находит информацию о самом первом (исходном) файле в истории
     * и считает общее количество существующих копий (для DBL1, DBL2...).
     */
    function findOriginalRecordInfo(matchRecord) {
        if (!matchRecord) return { originalRecord: null, originalName: '', rootBase: '', count: 1, allRoots: '' };

        const root = matchRecord.rootFilename || extractRootFilename(matchRecord.filename);
        const hash = matchRecord.hash || '';

        const matches = [];
        for (const r of _cachedHashes.values()) {
            if ((hash && r.hash && r.hash === hash) || (root && r.rootFilename && r.rootFilename === root)) {
                matches.push(r);
            }
        }
        if (matches.length === 0) matches.push(matchRecord);

        matches.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id || '').localeCompare(b.id || ''));

        const earliest = matches[0];
        const originalFilename = earliest.filename || matchRecord.filename || 'original';
        const originalRoot = earliest.rootFilename || extractRootFilename(originalFilename);

        const uniqueRoots = Array.from(new Set(matches.map(m => m.rootFilename || extractRootFilename(m.filename)).filter(Boolean)));
        let allRoots = uniqueRoots.join(', ');
        if (allRoots.length > 50) allRoots = allRoots.slice(0, 50).trim() + '…';

        const count = matches.length;

        return {
            originalRecord: earliest,
            originalName: originalFilename,
            rootBase: originalRoot || 'original',
            count: count,
            allRoots: allRoots || originalRoot || 'original'
        };
    }
    window.findOriginalRecordInfo = findOriginalRecordInfo;

    function getPendingDuplicateInfo() {
        if (!_pendingDuplicateConfirm) return null;
        if (Date.now() > _pendingDuplicateConfirm.expiresAt) return null;
        return _pendingDuplicateConfirm;
    }
    window.getPendingDuplicateInfo = getPendingDuplicateInfo;


    // IN-MEMORY FAST CACHE (O(1) lookup for 18000+ records)
    const _cachedHashes = new Map(); // hash -> record
    const _cachedUrls = new Map();   // url -> record
    const _cachedCleanUrls = new Map(); // cleanUrl -> record
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
        // v1.4.32: На Hugging Face Spaces URL временных файлов часто переиспользуются (/file=/tmp/gradio/image.png)
        // Для HF Spaces индексируем в кеше ТОЛЬКО по хешу, не по generic URL
        const isHfDomain = (d) => d && (d.includes('huggingface') || d.includes('hf.space'));
        if (record.url && !isHfDomain(record.domain)) {
            _cachedUrls.set(record.url, record);
            const cu = cleanMediaUrl(record.url);
            if (cu) _cachedCleanUrls.set(cu, record);
        }
        if (record.postUrl && isPostUrlSpecific(record.postUrl)) {
            _cachedUrls.set(record.postUrl, record);
            const cpu = cleanMediaUrl(record.postUrl);
            if (cpu) _cachedCleanUrls.set(cpu, record);
        }
    }

    /**
     * Предзагрузка всей базы в память при старте (занимает ~1-2 МБ ОЗУ на 18 000 записей)
     */
    const GM_HISTORY_KEY = 'mossad_recent_history_v1';
    function loadGmRecentHistory() {
        if (typeof GM_getValue !== 'function') return;
        try {
            const raw = GM_getValue(GM_HISTORY_KEY, null);
            if (raw) {
                const arr = (typeof raw === 'string' ? JSON.parse(raw) : raw);
                if (Array.isArray(arr)) {
                    for (const r of arr) {
                        addRecordToMemoryCache(r);
                    }
                }
            }
        } catch (_) {}
    }
    try { loadGmRecentHistory(); } catch (_) {}

    async function loadHistoryCache() {
        loadGmRecentHistory();
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
            if (mediaType === 'video' && _videoHashes.has(hash)) return _cachedHashes.get(hash);
            if (mediaType === 'photo' && _photoHashes.has(hash)) return _cachedHashes.get(hash);
            if (!mediaType && _cachedHashes.has(hash)) return _cachedHashes.get(hash);
        }
        if (mediaUrl) {
            if (_cachedUrls.has(mediaUrl)) return _cachedUrls.get(mediaUrl);
            const cu = cleanMediaUrl(mediaUrl);
            if (cu && _cachedCleanUrls.has(cu)) return _cachedCleanUrls.get(cu);
        }
        if (postUrl && isPostUrlSpecific(postUrl)) {
            if (_cachedUrls.has(postUrl)) return _cachedUrls.get(postUrl);
            const cpu = cleanMediaUrl(postUrl);
            if (cpu && _cachedCleanUrls.has(cpu)) return _cachedCleanUrls.get(cpu);
        }

        // 2. Если по URL не найден, вычисляем хеш (blob или кросс-доменный срез 1 МБ)
        if (!hash && mediaUrl) {
            try {
                const h = await resolveMediaHash(mediaUrl);
                if (h) {
                    hash = h;
                    if (mediaType === 'video' && _videoHashes.has(hash)) return _cachedHashes.get(hash);
                    if (mediaType === 'photo' && _photoHashes.has(hash)) return _cachedHashes.get(hash);
                    if (_cachedHashes.has(hash)) return _cachedHashes.get(hash);
                }
            } catch (_) {}
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
                    const targetUrl = (!isHf && mediaUrl) || (isPostUrlSpecific(postUrl) ? postUrl : null);
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
                domain: (typeof canonicalDomain !== 'undefined' ? canonicalDomain : rootDomain)
            };

            // Добавляем в быстрый кеш
            addRecordToMemoryCache(record);

            // v1.4.34: Синхронизация последних скачиваний в GM-хранилище для кросс-доменных iframe спейсов (*.hf.space <-> huggingface.co)
            if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
                try {
                    const raw = GM_getValue(GM_HISTORY_KEY, null);
                    const list = (raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []) || [];
                    list.unshift({
                        id: record.id,
                        hash: record.hash,
                        filename: record.filename,
                        rootFilename: record.rootFilename,
                        type: record.type,
                        url: record.url,
                        postUrl: record.postUrl,
                        size: record.size,
                        date: record.date,
                        domain: record.domain
                    });
                    if (list.length > 500) list.length = 500;
                    GM_setValue(GM_HISTORY_KEY, JSON.stringify(list));
                } catch (_) {}
            }

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
     * @param {Function} [onTimeout]   - коллбек по истечении таймера (для безопасного пост-действия)
     */
    function showDuplicateDownloadNotice(record, onConfirmDownload, lockedPostUrl, lockedMediaUrl, onTimeout) {
        // Если включена галочка «Качать дубли»: качаем сразу и показываем укороченное уведомление без таймера
        try { mossadBeep('dup'); } catch (e) {} // v1.3.82: двойной низкий сигнал «уже скачивали»
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

        // v1.4.22: Окно предупреждения о дубликате ВСЕГДА монтируется в центр экрана поверх всего
        const container = document.fullscreenElement || document.body;

        const notice = document.createElement('div');
        notice.id = 'mossad-dup-warning';
        notice.style.cssText = `
            position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647; pointer-events: auto;
            background: rgba(20, 18, 24, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(239, 68, 68, 0.55); border-radius: 12px; padding: 10px 14px;
            box-shadow: 0 12px 36px rgba(0,0,0,0.75), 0 0 15px rgba(239, 68, 68, 0.25);
            font-family: system-ui, -apple-system, sans-serif; color: #e5e7eb; font-size: 12px;
            display: flex; flex-direction: column; gap: 6px; animation: mossadFadeIn 0.2s ease;
        `;

        let secondsLeft = 6;
        // v1.4.16: вычисление dupInfo ДО генерации разметки (исправление TDZ ReferenceError)
        const dupInfo = findOriginalRecordInfo(record);
        const previewUrl = lockedMediaUrl || record.url;
        const isVid = record.type === 'video' || (record.filename && /\.(mp4|webm|mov|mkv)$/i.test(record.filename));
        const thumbHtml = previewUrl && !previewUrl.startsWith('data:') ? `
            <div style="flex-shrink:0;width:56px;height:42px;border-radius:4px;overflow:hidden;border:1px solid #374151;background:#0b1220;display:flex;align-items:center;justify-content:center;">
                ${isVid ? `<video src="${previewUrl}" style="width:100%;height:100%;object-fit:cover;" muted autoplay loop playsinline></video>` : `<img src="${previewUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">`}
            </div>
        ` : '';

        notice.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:#f87171; display:flex; align-items:center; gap:4px;">
                    ⚠️ Уже скачивался
                </span>
                <button id="mossad-dup-close" style="background:transparent; border:none; color:#9ca3af; cursor:pointer; font-size:12px; padding:0 4px;">✕</button>
            </div>
            <div style="display:flex; gap:8px; align-items:center; margin-top:2px;">
                ${thumbHtml}
                <div style="display:flex; flex-direction:column; gap:2px; min-width:0; flex:1;">
                    <div style="color:#f3f4f6; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;" title="${dupInfo.originalName || record.filename}">
                        📄 ${dupInfo.originalName || record.filename}
                    </div>
                    <div style="color:#9ca3af; font-size:10px;">
                        📅 ${dupInfo.originalRecord?.date || record.date || 'ранее'} · Копия #${dupInfo.count} (след. DBL${dupInfo.count})
                    </div>
                </div>
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
            record,
            dupInfo,
            rootBase: dupInfo.rootBase,
            count: dupInfo.count,
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
                if (typeof onTimeout === 'function') {
                    try { onTimeout(); } catch (err) {}
                }
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

    async function exportDownloadHistoryJSON() {
        try {
            const db = await getDownloadDB();
            const records = await new Promise((resolve) => {
                const tx = db.transaction(MOSSAD_STORE_NAME, 'readonly');
                const store = tx.objectStore(MOSSAD_STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });
            const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `mossad-hashes-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            if (typeof showToast === 'function') showToast(`💾 Экспортировано ${records.length} записей базы хешей!`);
        } catch (e) {
            console.error('[MOSSAD] Export history error:', e);
            if (typeof showToast === 'function') showToast('❌ Ошибка экспорта базы', true);
        }
    }
    window.exportDownloadHistoryJSON = exportDownloadHistoryJSON;

    /**
     * v1.4.16: Синхронизация базы хешей с GitHub (двустороннее слияние).
     * Читает локальные записи из IndexedDB, скачивает remote 'mossad-hashes.json',
     * объединяет их и сохраняет обратно в IndexedDB и на GitHub.
     */
    async function syncHashesWithGitHub() {
        if (!config.githubToken) {
            if (typeof showToast === 'function') showToast('⚠️ GitHub Token не указан в настройках', false, 3000);
            return false;
        }
        const token = config.githubToken;
        const path = 'mossad-hashes.json';
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

        if (typeof showToast === 'function') showToast('☁️ Синхронизация базы хешей...', false, 2500);

        try {
            // 1. Читаем локальные записи
            const db = await getDownloadDB();
            const localRecords = await new Promise((resolve) => {
                const tx = db.transaction(MOSSAD_STORE_NAME, 'readonly');
                const store = tx.objectStore(MOSSAD_STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            });

            // 2. Запрашиваем файл с GitHub
            let remoteRecords = [];
            let sha = null;
            try {
                const res = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `${apiUrl}?t=${Date.now()}`,
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        },
                        onload: resolve,
                        onerror: reject
                    });
                });
                if (res.status === 200) {
                    const data = JSON.parse(res.responseText);
                    sha = data.sha;
                    const decoded = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
                    if (Array.isArray(decoded)) remoteRecords = decoded;
                }
            } catch (e1) {
                console.warn('[MOSSAD DB Sync] Remote file not found or empty:', e1);
            }

            // 3. Объединяем локальные и удалённые (по hash или url)
            const map = new Map();
            for (const r of remoteRecords) {
                const key = r.hash || r.url || r.filename;
                if (key) map.set(key, r);
            }
            for (const r of localRecords) {
                const key = r.hash || r.url || r.filename;
                if (key) {
                    const existing = map.get(key);
                    map.set(key, existing ? Object.assign({}, existing, r) : r);
                }
            }
            const merged = Array.from(map.values());

            // 4. Записываем объединённые в локальную IndexedDB и кеш
            await importDownloadHistory(merged);

            // 5. Отправляем объединенный массив на GitHub
            const exportData = merged.map(r => ({
                hash: r.hash || '',
                filename: r.filename || '',
                type: r.type || 'photo',
                date: r.date || '',
                url: r.url || '',
                domain: r.domain || ''
            }));
            const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportData, null, 2))));
            const body = JSON.stringify({
                message: `mossad: sync hash database (${merged.length} items)`,
                content,
                branch: GITHUB_BRANCH,
                ...(sha ? { sha } : {})
            });

            await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'PUT',
                    url: apiUrl,
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    data: body,
                    onload: (res) => {
                        if (res.status >= 200 && res.status < 300) resolve();
                        else reject(new Error(`HTTP ${res.status}: ${res.responseText}`));
                    },
                    onerror: reject
                });
            });

            if (typeof showToast === 'function') showToast(`✅ База хешей синхронизирована: ${merged.length} записей!`, true, 3500);
            return true;
        } catch (err) {
            console.error('[MOSSAD DB Sync] Error:', err);
            if (typeof showToast === 'function') showToast(`⚠️ Ошибка синхронизации базы: ${err.message}`, false, 4000);
            return false;
        }
    }
    window.syncHashesWithGitHub = syncHashesWithGitHub;

    /**
     * v1.4.16: Мелодия из 5 нот через Web Audio API (C5, E5, G5, C6, E6)
     */
    function mossadPlayChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            const times = [0, 0.12, 0.24, 0.38, 0.54];
            const durs  = [0.10, 0.10, 0.12, 0.14, 0.28];
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + times[idx]);
                gain.gain.setValueAtTime(0.18, ctx.currentTime + times[idx]);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + times[idx] + durs[idx]);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + times[idx]);
                osc.stop(ctx.currentTime + times[idx] + durs[idx]);
            });
        } catch (e) {}
    }
    window.mossadPlayChime = mossadPlayChime;
