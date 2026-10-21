    // ============================================
    // v1.3.66: ЛЁГКИЙ СЛОЙ (все сайты) — «DND Media Downloader» внутри MOSSAD
    // build.py кладёт src/light/* в GATE_MODULES ДО src/core/domain.js: код работает на КАЖДОЙ странице, ещё до
    // выхода «сайт не в списке». Поэтому: ни DOM, ни таймеров при загрузке — только два слушателя (click и
    // contextmenu, capture), которые сразу выходят без Ctrl. Тяжёлое (меню, canvas) создаётся по требованию.
    // Код здесь НЕ видит функций mossadMain (только наоборот). ANTI_PATTERNS §44.
    //   Ctrl + левый клик по картинке/видео — скачать в папку загрузок/<папка> (по умолчанию «DND/», GM_download);
    //   Ctrl + правый клик — меню: Скачать, Папка…, Копировать кадр.
    // ============================================
    const MOSSAD_DND_GM_KEY = 'mossad_dnd';
    function mossadDndCfg() {
        let o = null;
        try { if (typeof GM_getValue === 'function') o = GM_getValue(MOSSAD_DND_GM_KEY, null); } catch (e) {}
        try { if (typeof o === 'string') o = JSON.parse(o); } catch (e) { o = null; }
        o = (o && typeof o === 'object') ? o : {};
        return { enabled: o.enabled !== false, folder: typeof o.folder === 'string' ? o.folder : 'DND/' };
    }
    function mossadDndSave(patch) {
        const c = Object.assign(mossadDndCfg(), patch || {});
        try { if (typeof GM_setValue === 'function') GM_setValue(MOSSAD_DND_GM_KEY, JSON.stringify(c)); } catch (e) {}
        return c;
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

    /** Кадр видео / картинка → PNG в буфер обмена. CORS (canvas «испорчен») — понятный тост; нет ClipboardItem — скачать PNG. */
    function mossadCopyFrame(el) {
        const w = el.tagName === 'VIDEO' ? el.videoWidth : (el.naturalWidth || el.width);
        const h = el.tagName === 'VIDEO' ? el.videoHeight : (el.naturalHeight || el.height);
        if (!w || !h) { mossadLightToast('⚠️ Кадр ещё не загружен', true); return; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        try { c.getContext('2d').drawImage(el, 0, 0, w, h); } catch (e) { mossadLightToast('⚠️ Кадр не нарисовать: ' + e.message, true); return; }
        const base = mossadDndFileName(mossadMediaUrl(el) || 'frame', el).replace(/\.[a-z0-9]+$/i, '') + (el.tagName === 'VIDEO' ? '-' + Math.floor(el.currentTime || 0) + 's' : '') + '.png';
        let p;
        try {
            p = new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error('пустой кадр')), 'image/png'); } catch (e) { rej(e); } });
        } catch (e) { p = Promise.reject(e); }
        p.then(blob => {
            if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem === 'function') {
                return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                    .then(() => mossadLightToast('📋 Кадр скопирован (' + w + '×' + h + ')'))
                    .catch(() => { _dndSaveBlob(blob, base); mossadLightToast('📋 Буфер недоступен — кадр сохранён: ' + base); });
            }
            _dndSaveBlob(blob, base);
            mossadLightToast('📋 Копирование картинок не поддерживается — кадр сохранён: ' + base);
        }).catch(err => {
            if (err && (err.name === 'SecurityError' || /taint|insecure|security/i.test(String(err.message))))
                mossadLightToast('⚠️ Сайт защищает кадр (CORS) — скопировать нельзя. «Скачать» сохранит оригинал', true);
            else mossadLightToast('⚠️ Кадр: ' + (err && err.message || err), true);
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
            'box-shadow:0 8px 24px rgba(0,0,0,0.6);font:13px system-ui,sans-serif;color:#e5e7eb;min-width:170px;';
        const folder = mossadDndNormFolder(mossadDndCfg().folder) || '(корень)';
        const items = [['dl', '⬇ Скачать'], ['folder', '📁 Папка… (' + folder + ')'], ['frame', '📋 Копировать кадр']];
        m.innerHTML = items.map(([k, t]) => `<div data-dnd="${k}" style="padding:6px 10px;border-radius:5px;cursor:pointer;white-space:nowrap;">${t.replace(/</g, '&lt;')}</div>`).join('');
        (document.fullscreenElement || document.body || document.documentElement).appendChild(m);
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        m.style.left = Math.max(2, Math.min(x, vw - 200)) + 'px';
        m.style.top = Math.max(2, Math.min(y, vh - 110)) + 'px';
        m.addEventListener('mouseover', (e) => { const it = e.target.closest('[data-dnd]'); m.querySelectorAll('[data-dnd]').forEach(d => { d.style.background = d === it ? '#1f2937' : ''; }); });
        m.addEventListener('click', (e) => {
            const it = e.target.closest('[data-dnd]');
            if (!it) return;
            e.preventDefault(); e.stopPropagation();
            const k = it.getAttribute('data-dnd');
            mossadDndCloseMenu();
            if (k === 'dl') mossadDndDownload(el);
            else if (k === 'frame') mossadCopyFrame(el);
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
        if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.button !== 0) return;
        const el = mossadMediaAt(e.clientX, e.clientY, e.target);
        if (!el || !mossadDndCfg().enabled) return;
        e.preventDefault(); e.stopPropagation(); // не открывать ссылку в новой вкладке
        mossadDndDownload(el);
    }
    function _dndOnContext(e) {
        if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return;
        const el = mossadMediaAt(e.clientX, e.clientY, e.target);
        if (!el || !mossadDndCfg().enabled) return;
        e.preventDefault(); e.stopPropagation();
        mossadDndMenu(el, e.clientX, e.clientY);
    }
    window.addEventListener('click', _dndOnClick, true);
    window.addEventListener('contextmenu', _dndOnContext, true);
