    // ============================================
    // v1.3.66: ЛЁГКИЙ СЛОЙ (все сайты) — «DND Media Downloader» внутри MOSSAD
    // build.py кладёт src/light/* в GATE_MODULES ДО src/core/domain.js: код работает на КАЖДОЙ странице, ещё до
    // выхода «сайт не в списке». Поэтому: ни DOM, ни таймеров при загрузке — только два слушателя (click и
    // contextmenu, capture), которые сразу выходят без Ctrl. Тяжёлое (меню, canvas) создаётся по требованию.
    // Код здесь НЕ видит функций mossadMain (только наоборот). ANTI_PATTERNS §44.
    //   Ctrl + левый клик по картинке/видео — скачать в папку загрузок/<папка> (по умолчанию «DND/», GM_download);
    //   Ctrl + правый клик — меню: Скачать, Папка…, Копировать кадр, Улучшить и скопировать.
    // ============================================
    const MOSSAD_DND_GM_KEY = 'mossad_dnd';
    function mossadDndCfg() {
        let o = null;
        try { if (typeof GM_getValue === 'function') o = GM_getValue(MOSSAD_DND_GM_KEY, null); } catch (e) {}
        try { if (typeof o === 'string') o = JSON.parse(o); } catch (e) { o = null; }
        o = (o && typeof o === 'object') ? o : {};
        return { enabled: o.enabled !== false, folder: typeof o.folder === 'string' ? o.folder : 'DND/', leftMod: typeof o.leftMod === 'string' ? o.leftMod : 'ctrl', rightMod: typeof o.rightMod === 'string' ? o.rightMod : 'ctrl' };
    }
    function mossadDndSave(patch) {
        const c = Object.assign(mossadDndCfg(), patch || {});
        try { if (typeof GM_setValue === 'function') GM_setValue(MOSSAD_DND_GM_KEY, JSON.stringify(c)); } catch (e) {}
        return c;
    }
    function mossadDndModMatch(e, modKey) {
        // modKey: 'ctrl' | 'alt' | 'shift' | 'ctrl+shift' | 'alt+shift' | 'ctrl+alt'
        const c = !!e.ctrlKey, a = !!e.altKey, s = !!e.shiftKey, m = !!e.metaKey;
        if (m) return false; // Meta/Win никогда
        switch (modKey || 'ctrl') {
            case 'ctrl':       return c && !a && !s;
            case 'alt':        return !c && a && !s;
            case 'shift':      return !c && !a && s;
            case 'ctrl+shift': return c && !a && s;
            case 'alt+shift':  return !c && a && s;
            case 'ctrl+alt':   return c && a && !s;
            default:           return c && !a && !s;
        }
    }
    /** «DND», «/DND/», «a\\b» → «DND/», «a/b/»; пусто → '' (корень «Загрузок»). Без «..» и недопустимых символов. */
    function mossadDndNormFolder(f) {
        const parts = String(f || '').replace(/\\/g, '/').split('/').map(p => p.trim().replace(/[<>:"|?*\x00-\x1f]/g, '_')).filter(p => p && p !== '.' && p !== '..');
        return parts.length ? parts.join('/') + '/' : '';
    }

    /** Небольшой тост лёгкого слоя (в полном экране — внутри fullscreenElement). */
    function mossadLightToast(msg, isError) {
        try {
            const host = document.fullscreenElement || document.body || document.documentElement;
            let t = document.getElementById('mossad-light-toast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'mossad-light-toast';
                t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;padding:8px 14px;border-radius:8px;' +
                    'background:rgba(17,17,17,0.92);color:#fff;font:600 13px system-ui,sans-serif;pointer-events:none;max-width:90vw;';
            }
            if (t.parentNode !== host) host.appendChild(t);
            t.textContent = msg;
            t.style.border = '1px solid ' + (isError ? '#ef4444' : '#10b981');
            clearTimeout(t._mossadT);
            t._mossadT = setTimeout(() => t.remove(), 2600);
        } catch (e) {}
    }

    /** Картинка/видео под точкой (x, y): сам элемент или внутри стопки элементов (оверлеи сайтов поверх медиа). */
    function mossadMediaAt(x, y, target) {
        const pick = (el) => {
            if (!el || !el.tagName) return null;
            const tag = el.tagName;
            if (tag === 'IMG' || tag === 'VIDEO') return el;
            if (tag === 'PICTURE' || tag === 'SOURCE') return el.closest('picture') && el.closest('picture').querySelector('img');
            return null;
        };
        let m = pick(target);
        if (m) return m;
        if (document.elementsFromPoint) {
            for (const el of document.elementsFromPoint(x, y)) {
                if (el.id && String(el.id).indexOf('mossad') === 0) continue;
                m = pick(el);
                if (m) return m;
            }
        }
        return null;
    }
    function mossadMediaUrl(el) {
        if (!el) return '';
        if (el.tagName === 'VIDEO') {
            // v1.3.86: если плеер сайта отдает прямой MP4 вместо HLS .m3u8
            try {
                if (window.MOSSAD_ENGINES?.xvideos?.findMedia) {
                    const m = window.MOSSAD_ENGINES.xvideos.findMedia();
                    if (m && m.urls && m.urls[0] && !/\.m3u8(\?|$)/i.test(m.urls[0])) return m.urls[0];
                }
                const u = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (u.html5player && (u.html5player.sUrlHigh || u.html5player.sUrlLow)) {
                    const uMp4 = u.html5player.sUrlHigh || u.html5player.sUrlLow;
                    if (uMp4 && !/\.m3u8(\?|$)/i.test(uMp4)) return uMp4;
                }
            } catch (e) {}
            const s = el.currentSrc || el.src || (el.querySelector('source[src]') && el.querySelector('source[src]').src) || '';
            return s;
        }
        return el.currentSrc || el.src || '';
    }
    function mossadDndFileName(url, el) {
        let name = '';
        try { name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || ''); } catch (e) {}
        name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(-120);
        const isVid = el && el.tagName === 'VIDEO';
        if (!name || name.indexOf('.') < 0) {
            const host = (location.hostname || 'page').replace(/^www\./, '');
            name = (name || host + '-' + Date.now().toString(36)) + (isVid ? '.mp4' : '.jpg');
        }
        return name;
    }
    function _dndSaveBlob(blob, name) {
        const a = document.createElement('a');
        const u = URL.createObjectURL(blob);
        a.href = u; a.download = name; a.style.display = 'none';
        (document.body || document.documentElement).appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 4000);
    }
    /** Скачать медиа-элемент в папку DND. blob: — через fetch (если поток MediaSource — понятный тост). */
    function mossadDndDownload(el) {
        const url = mossadMediaUrl(el);
        if (!url) { mossadLightToast('⚠️ У элемента нет адреса файла', true); return false; }
        const name = mossadDndFileName(url, el);
        const folder = mossadDndNormFolder(mossadDndCfg().folder);
        if (/^blob:/.test(url)) {
            fetch(url).then(r => r.blob()).then(b => { _dndSaveBlob(b, name); mossadLightToast('⬇ ' + name + ' (blob — в корень «Загрузок»)'); })
                .catch(() => mossadLightToast('⚠️ Потоковое видео (blob/MSE) так не скачать — попробуйте «Копировать кадр» или MOSSAD на сайте', true));
            return true;
        }
        if (/^data:/.test(url)) { fetch(url).then(r => r.blob()).then(b => _dndSaveBlob(b, name)); mossadLightToast('⬇ ' + name); return true; }
        if (/\.m3u8(\?|$)/i.test(url)) {
            mossadLightToast('⚠️ HLS-поток (.m3u8) — используйте PageDown в MOSSAD или HLS-расширение', true);
            return true;
        }
        if (typeof GM_download !== 'function') { window.open(url, '_blank'); return true; }
        try {
            GM_download({
                url, name: folder + name, saveAs: false,
                onload: () => mossadLightToast('✅ ' + folder + name),
                onerror: (err) => {
                    const why = (err && (err.error || err.details && err.details.current)) || '';
                    mossadLightToast('⚠️ Не скачалось' + (why ? ' (' + why + ')' : '') + '. Tampermonkey → Настройки → Загрузки: «Browser API» и разрешить расширения файлов', true);
                },
            });
            mossadLightToast('⬇ ' + folder + name);
        } catch (e) { mossadLightToast('⚠️ GM_download: ' + e.message, true); }
        return true;
    }

    /**
     * Повышение резкости (Unsharp Mask), микроконтраста и насыщенности кадра.
     * Компенсирует артефакты и мыло компрессии H.264/H.265 видео для повторной генерации (Wan, Grok и др.).
     */
    function mossadEnhanceImageData(imgData) {
        const d = imgData.data;
        const w = imgData.width;
        const h = imgData.height;
        const copy = new Uint8ClampedArray(d);
        const k = 0.32;
        const center = 1 + 4 * k;
        const contrast = 1.06;
        const sat = 1.08;

        for (let y = 1; y < h - 1; y++) {
            const row = y * w;
            const rowUp = (y - 1) * w;
            const rowDown = (y + 1) * w;
            for (let x = 1; x < w - 1; x++) {
                const idx = (row + x) << 2;
                const u = (rowUp + x) << 2;
                const dn = (rowDown + x) << 2;
                const l = (row + (x - 1)) << 2;
                const r = (row + (x + 1)) << 2;

                // Маска нерезкости 3x3
                let red = copy[idx] * center - (copy[u] + copy[dn] + copy[l] + copy[r]) * k;
                let grn = copy[idx + 1] * center - (copy[u + 1] + copy[dn + 1] + copy[l + 1] + copy[r + 1]) * k;
                let blu = copy[idx + 2] * center - (copy[u + 2] + copy[dn + 2] + copy[l + 2] + copy[r + 2]) * k;

                // Контраст
                red = (red - 128) * contrast + 128;
                grn = (grn - 128) * contrast + 128;
                blu = (blu - 128) * contrast + 128;

                // Насыщенность
                const gray = 0.299 * red + 0.587 * grn + 0.114 * blu;
                red = gray + (red - gray) * sat;
                grn = gray + (grn - gray) * sat;
                blu = gray + (blu - gray) * sat;

                d[idx]     = red < 0 ? 0 : (red > 255 ? 255 : red);
                d[idx + 1] = grn < 0 ? 0 : (grn > 255 ? 255 : grn);
                d[idx + 2] = blu < 0 ? 0 : (blu > 255 ? 255 : blu);
            }
        }
        return imgData;
    }

    /**
     * Кадр видео / картинка → PNG в буфер обмена.
     * При enhance=true выполняет суперсэмплинг (для видео < 1080p), устраняет мыло сжатия (Unsharp Mask),
     * восстанавливает микроконтраст и насыщенность.
     * При CORS (холст «испорчен» кросс-доменным CDN, например assets.grok.com) — прозрачно обходит CORS через GM_xmlhttpRequest.
     */
    function mossadCopyFrame(el, enhance) {
        enhance = !!enhance;
        const origW = el.tagName === 'VIDEO' ? el.videoWidth : (el.naturalWidth || el.width);
        const origH = el.tagName === 'VIDEO' ? el.videoHeight : (el.naturalHeight || el.height);
        if (!origW || !origH) { mossadLightToast('⚠️ Медиа ещё не загружено', true); return; }

        const isVideo = el.tagName === 'VIDEO';
        const curTime = isVideo ? Math.max(0, Math.min(el.currentTime || 0, (el.duration || 9999) - 0.04)) : 0;
        const base = (enhance ? 'enhanced-' : '') +
            mossadDndFileName(mossadMediaUrl(el) || 'frame', el).replace(/\.[a-z0-9]+$/i, '') +
            (isVideo ? '-' + Math.floor(curTime) + 's' : '') + '.png';

        const finishExport = (sourceCanvas, sw, sh) => {
            let finalCanvas = sourceCanvas;
            let targetW = sw, targetH = sh;

            if (enhance) {
                let scale = 1.0;
                const maxDim = Math.max(sw, sh);
                if (maxDim <= 640) scale = 2.0;
                else if (maxDim < 1100) scale = 1.5;

                targetW = Math.round(sw * scale);
                targetH = Math.round(sh * scale);

                if (targetW !== sw || targetH !== sh) {
                    finalCanvas = document.createElement('canvas');
                    finalCanvas.width = targetW;
                    finalCanvas.height = targetH;
                    const fCtx = finalCanvas.getContext('2d');
                    fCtx.imageSmoothingEnabled = true;
                    fCtx.imageSmoothingQuality = 'high';
                    fCtx.drawImage(sourceCanvas, 0, 0, targetW, targetH);
                }

                try {
                    const fCtx = finalCanvas.getContext('2d');
                    const imgData = fCtx.getImageData(0, 0, targetW, targetH);
                    mossadEnhanceImageData(imgData);
                    fCtx.putImageData(imgData, 0, 0);
                } catch (e) {
                    console.warn('[MOSSAD] Enhance filter warning:', e);
                }
            }

            finalCanvas.toBlob(blob => {
                if (!blob) { mossadLightToast('⚠️ Пустой кадр', true); return; }
                const dimStr = targetW + '×' + targetH;
                const label = enhance ? '✨ Кадр улучшен и скопирован (' + dimStr + ')' : '📋 Кадр скопирован (' + dimStr + ')';

                if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem === 'function') {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => mossadLightToast(label))
                        .catch(() => {
                            _dndSaveBlob(blob, base);
                            mossadLightToast('📋 Буфер недоступен — кадр сохранён: ' + base);
                        });
                } else {
                    _dndSaveBlob(blob, base);
                    mossadLightToast('📋 Буфер не поддерживается — кадр сохранён: ' + base);
                }
            }, 'image/png');
        };

        // 1. Быстрый путь: пробуем отрисовать напрямую
        const c = document.createElement('canvas');
        c.width = origW; c.height = origH;
        let directOk = false;
        try {
            c.getContext('2d').drawImage(el, 0, 0, origW, origH);
            c.getContext('2d').getImageData(0, 0, 1, 1); // вызовет SecurityError, если холст испорчен CORS
            directOk = true;
        } catch (e) {
            directOk = false;
        }

        if (directOk) {
            finishExport(c, origW, origH);
            return;
        }

        // 2. Путь обхода CORS через GM_xmlhttpRequest (Grok CDN assets.grok.com, Hugging Face CDN и др.)
        const mediaUrl = mossadMediaUrl(el);
        if (!mediaUrl || typeof GM_xmlhttpRequest !== 'function') {
            mossadLightToast('⚠️ Сайт защищает кадр (CORS) — скопировать нельзя. «Скачать» сохранит оригинал', true);
            return;
        }

        mossadLightToast('⏳ Захват кадра (обход CORS)...');

        GM_xmlhttpRequest({
            method: 'GET',
            url: mediaUrl,
            responseType: 'blob',
            onload: (res) => {
                if (!res.response || (res.status && res.status >= 400)) {
                    mossadLightToast('⚠️ Не удалось загрузить медиа (HTTP ' + (res.status || '') + ')', true);
                    return;
                }
                const blob = res.response;
                const blobUrl = URL.createObjectURL(blob);

                if (!isVideo) {
                    const img = new Image();
                    img.onload = () => {
                        const c2 = document.createElement('canvas');
                        const iw = img.naturalWidth || origW;
                        const ih = img.naturalHeight || origH;
                        c2.width = iw; c2.height = ih;
                        c2.getContext('2d').drawImage(img, 0, 0, iw, ih);
                        URL.revokeObjectURL(blobUrl);
                        finishExport(c2, iw, ih);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        mossadLightToast('⚠️ Ошибка декодирования картинки', true);
                    };
                    img.src = blobUrl;
                } else {
                    const tempVid = document.createElement('video');
                    tempVid.muted = true;
                    tempVid.playsInline = true;
                    tempVid.preload = 'auto';
                    let cleaned = false;
                    const cleanup = () => {
                        if (cleaned) return;
                        cleaned = true;
                        URL.revokeObjectURL(blobUrl);
                        tempVid.removeAttribute('src');
                        try { tempVid.load(); } catch (e) {}
                    };

                    let done = false;
                    const doCapture = () => {
                        if (done) return;
                        done = true;
                        try {
                            const c2 = document.createElement('canvas');
                            const vw = tempVid.videoWidth || origW;
                            const vh = tempVid.videoHeight || origH;
                            c2.width = vw; c2.height = vh;
                            c2.getContext('2d').drawImage(tempVid, 0, 0, vw, vh);
                            cleanup();
                            finishExport(c2, vw, vh);
                        } catch (err) {
                            cleanup();
                            mossadLightToast('⚠️ Ошибка захвата: ' + (err && err.message || err), true);
                        }
                    };

                    let seekTimer = null;
                    tempVid.onloadedmetadata = () => {
                        const dur = tempVid.duration || 9999;
                        const targetT = Math.max(0, Math.min(curTime, dur - 0.04));
                        if (targetT > 0.05) {
                            tempVid.currentTime = targetT;
                        } else {
                            if (tempVid.readyState >= 2) doCapture();
                            else tempVid.onloadeddata = doCapture;
                        }
                    };
                    tempVid.onseeked = () => {
                        if (seekTimer) clearTimeout(seekTimer);
                        doCapture();
                    };
                    tempVid.onerror = () => {
                        if (seekTimer) clearTimeout(seekTimer);
                        cleanup();
                        mossadLightToast('⚠️ Не удалось воспроизвести видео-кадр', true);
                    };
                    seekTimer = setTimeout(() => {
                        if (!done && tempVid.readyState >= 2) doCapture();
                    }, 4000);

                    tempVid.src = blobUrl;
                }
            },
            onerror: (err) => {
                mossadLightToast('⚠️ XHR ошибка: ' + (err && err.error || 'не удалось скачать'), true);
            }
        });
    }

    // ── меню Ctrl + правый клик (создаётся по требованию, одно) ──
    function mossadDndCloseMenu() {
        const m = document.getElementById('mossad-dnd-menu');
        if (m) { if (m._mossadOff) m._mossadOff(); m.remove(); }
    }
    function mossadDndMenu(el, x, y) {
        mossadDndCloseMenu();
        const m = document.createElement('div');
        m.id = 'mossad-dnd-menu';
        m.style.cssText = 'position:fixed;z-index:2147483647;background:#111827;border:1px solid #4b5563;border-radius:8px;padding:4px;' +
            'box-shadow:0 8px 24px rgba(0,0,0,0.6);font:13px system-ui,sans-serif;color:#e5e7eb;min-width:185px;';
        const folder = mossadDndNormFolder(mossadDndCfg().folder) || '(корень)';
        const items = [
            ['dl', '⬇ Скачать'],
            ['folder', '📁 Папка… (' + folder + ')'],
            ['frame', '📋 Копировать кадр'],
            ['enhance', '✨ Улучшить и скопировать']
        ];
        m.innerHTML = items.map(([k, t]) => `<div data-dnd="${k}" style="padding:6px 10px;border-radius:5px;cursor:pointer;white-space:nowrap;">${t.replace(/</g, '&lt;')}</div>`).join('');
        (document.fullscreenElement || document.body || document.documentElement).appendChild(m);
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        m.style.left = Math.max(2, Math.min(x, vw - 215)) + 'px';
        m.style.top = Math.max(2, Math.min(y, vh - 150)) + 'px';
        m.addEventListener('mouseover', (e) => { const it = e.target.closest('[data-dnd]'); m.querySelectorAll('[data-dnd]').forEach(d => { d.style.background = d === it ? '#1f2937' : ''; }); });
        m.addEventListener('click', (e) => {
            const it = e.target.closest('[data-dnd]');
            if (!it) return;
            e.preventDefault(); e.stopPropagation();
            const k = it.getAttribute('data-dnd');
            mossadDndCloseMenu();
            if (k === 'dl') mossadDndDownload(el);
            else if (k === 'frame') mossadCopyFrame(el, false);
            else if (k === 'enhance') mossadCopyFrame(el, true);
            else if (k === 'folder') {
                const v = prompt('MOSSAD DND: подпапка в «Загрузках» (пусто — корень):', mossadDndCfg().folder);
                if (v !== null) { const f = mossadDndNormFolder(v); mossadDndSave({ folder: f }); mossadLightToast('📁 Папка: ' + (f || '(корень «Загрузок»)')); }
            }
        });
        const off = (e) => { if (e.type === 'keydown' && e.key !== 'Escape') return; if (e.type !== 'keydown' && m.contains(e.target)) return; mossadDndCloseMenu(); };
        setTimeout(() => {
            window.addEventListener('pointerdown', off, true);
            window.addEventListener('keydown', off, true);
            window.addEventListener('blur', off);
        }, 0);
        m._mossadOff = () => { window.removeEventListener('pointerdown', off, true); window.removeEventListener('keydown', off, true); window.removeEventListener('blur', off); };
    }

    // ── два слушателя на всю страницу; без Ctrl — мгновенный выход ──
    function _dndOnClick(e) {
        const cfg = mossadDndCfg();
        if (!mossadDndModMatch(e, cfg.leftMod) || e.button !== 0) return;
        const el = mossadMediaAt(e.clientX, e.clientY, e.target);
        if (!el || !cfg.enabled) return;
        e.preventDefault(); e.stopPropagation(); // не открывать ссылку в новой вкладке
        mossadDndDownload(el);
    }
    function _dndOnContext(e) {
        const cfg = mossadDndCfg();
        if (!mossadDndModMatch(e, cfg.rightMod)) return;
        const el = mossadMediaAt(e.clientX, e.clientY, e.target);
        if (!el || !cfg.enabled) return;
        e.preventDefault(); e.stopPropagation();
        mossadDndMenu(el, e.clientX, e.clientY);
    }
    window.addEventListener('click', _dndOnClick, true);
    window.addEventListener('contextmenu', _dndOnContext, true);
