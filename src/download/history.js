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
