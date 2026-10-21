    // ============================================
    // PINTEREST ENGINE
    // ============================================
    // v1.3.54: мёртвые clickElementFull/triggerPinterestFullScale (нигде не вызывались) удалены — см. git v1.3.53.
    // ── v1.3.51: главный пин отделяем от «Похожих пинов» ──
    // Раньше тип и видео искались по всему документу (первый <video>, regex по innerHTML всей страницы):
    // превью похожего пина делало фото-пин «видео», а сериализация всего DOM повторялась до 60 раз за слайд.
    // ⚠️ Живые данные (ru.pinterest.com, 10.2026): ГЛАВНЫЙ <video> тоже лежит внутри [data-grid-item]!
    // Различаем по elementtiming: главный — 'closeup-video-main-MainPinImage' (^closeup / MainPinImage),
    // похожие — 'gestalt-video'. Сетка — только запасной признак. Без innerHTML. ANTI_PATTERNS §30.
    const PIN_GRID_SEL = '[data-grid-item], [data-test-id="pin-card"], [data-test-id="related-pins"], [data-test-id="relatedPins"], [data-test-id="search-feed"]';
    const PIN_CLOSEUP_SEL = '[data-test-id="closeup-body"], [data-test-id="pin-closeup"], [data-test-id="closeup-stage"], [data-test-id="story-pin-closeup-container"], [data-test-id="visual-content-container"], [data-test-id="closeup-image"]';
    const PIN_VIDEO_SIGNS_SEL = 'video, [data-test-id*="video"], [data-test-id*="duplo-hls"], [data-test-id*="story-pin"], [data-test-id*="idea-pin"], button[aria-label*="звук"], button[aria-label*="Sound"], button[aria-label*="sound"], button[aria-label*="Unmute"], button[aria-label*="Mute"], .SoundButton';
    const PIN_MAIN_MARK_SEL = '[elementtiming^="closeup"], [elementtiming*="MainPinImage"]';
    const PIN_MAIN_SEL = PIN_MAIN_MARK_SEL + ', ' + PIN_CLOSEUP_SEL;
    const PIN_RELATED_SEL = '[data-test-id="relatedPins"], [data-test-id="related-pins"], [data-test-id="closeup-related-pins"]';
    const PIN_SEQ_SS_KEY = 'mossad_pin_seq';    // счётчик режима «+1» (переживает переход на следующий пин)
    const PIN_DEAD_SS_KEY = 'mossad_pin_dead';  // пины без похожих (тупики) — не выбирать снова
    const PIN_WAIT_MS = 15000;                  // ждать появления похожих пинов не дольше
    const PIN_POLL_MS = 250;
    const PIN_MAX_CANDIDATES = 30;

    function pinterestCurrentPinId(path) {
        const m = String(path || location.pathname).match(/\/pin\/(\d+)/);
        return m ? m[1] : '';
    }
    function pinIsOwnUi(el) {
        return !!(el && el.closest && el.closest('[id^="mossad"]'));
    }
    /**
     * Элемент относится к похожему пину (не к главному)?
     * 1) elementtiming ^closeup / MainPinImage — главный; ^gestalt — похожий.
     * 2) Без сетки вокруг — главный.
     * 3) Ближайший контейнер главного (closeup) СОДЕРЖИТ ячейку сетки — ячейка вложена в closeup → похожий;
     *    наоборот (closeup внутри ячейки, как на живом Pinterest) — главный.
     */
    function pinIsRelated(el) {
        if (!el || !el.closest) return false;
        if (pinIsOwnUi(el)) return true;
        const et = (el.getAttribute && el.getAttribute('elementtiming')) || '';
        if (/^closeup|MainPinImage/i.test(et)) return false;
        if (/^gestalt/i.test(et)) return true;
        const g = el.closest(PIN_GRID_SEL);
        if (!g) return false;
        const c = el.closest(PIN_MAIN_SEL);
        if (!c) return true;
        return c !== g && c.contains(g);
    }
    function pinterestCloseupRoots() {
        return Array.from(document.querySelectorAll(PIN_CLOSEUP_SEL)).filter(el => !pinIsRelated(el));
    }
    /** <video> главного пина: внутри closeup, иначе любой не из сетки (самый крупный). */
    function pinterestMainVideo() {
        const marked = document.querySelector('video[elementtiming^="closeup"], video[elementtiming*="MainPinImage"]');
        if (marked && !pinIsOwnUi(marked)) return marked;
        const vids = Array.from(document.querySelectorAll('video')).filter(v => !pinIsRelated(v));
        if (!vids.length) return null;
        const roots = pinterestCloseupRoots();
        const inRoot = vids.find(v => roots.some(r => r.contains(v)));
        if (inRoot) return inRoot;
        if (vids.length === 1) return vids[0];
        let best = vids[0], max = -1;
        for (const v of vids) {
            const r = v.getBoundingClientRect();
            const a = Math.max(0, r.width) * Math.max(0, r.height);
            if (a > max) { max = a; best = v; }
        }
        return best;
    }
    const _pinSmallImgRe = /\/(?:\d{2,3}x\d{2,3}_RS|30x30|60x60|75x75|140x140)\//i;
    /** Картинка главного пина: в closeup, иначе самая крупная pinimg-картинка не из сетки (аватарки пропускаем). */
    function pinterestMainImage() {
        const ok = (i) => {
            const src = i.currentSrc || i.src || '';
            return /pinimg\.com/.test(src) && !_pinSmallImgRe.test(src) && !pinIsRelated(i);
        };
        const marked = Array.from(document.querySelectorAll('img[elementtiming^="closeup"], img[elementtiming*="MainPinImage"]')).find(i => !pinIsOwnUi(i));
        if (marked) return marked;
        for (const r of pinterestCloseupRoots()) {
            const img = Array.from(r.querySelectorAll('img')).find(ok);
            if (img) return img;
        }
        let best = null, max = 0;
        for (const i of document.querySelectorAll('img')) {
            if (!ok(i)) continue;
            const r = i.getBoundingClientRect();
            const a = (r.width * r.height) || ((parseInt(i.getAttribute('width'), 10) || 0) * (parseInt(i.getAttribute('height'), 10) || 0)) || 1;
            if (a > max) { max = a; best = i; }
        }
        return best;
    }
    /** Признаки видео у ГЛАВНОГО пина (плеер, кнопка звука) — без сетки и без виджета MOSSAD. */
    function pinterestHasVideoSigns() {
        const roots = pinterestCloseupRoots();
        const pool = roots.length
            ? roots.flatMap(r => Array.from(r.querySelectorAll(PIN_VIDEO_SIGNS_SEL)))
            : Array.from(document.querySelectorAll(PIN_VIDEO_SIGNS_SEL));
        return pool.some(el => !pinIsRelated(el));
    }

    // Кэш типа текущего пина (по id): решение «фото» принимает движок слайдшоу, «видео» — найденный <video>
    let _pinMediaCache = { pinId: '', type: '', bestMp4Url: null };
    function pinterestRememberType(type, bestMp4Url) {
        const id = pinterestCurrentPinId();
        if (!id) return;
        _pinMediaCache = { pinId: id, type, bestMp4Url: bestMp4Url || (_pinMediaCache.pinId === id ? _pinMediaCache.bestMp4Url : null) };
    }
    function pinterestMp4FromSrc(src) {
        if (!src) return null;
        const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                         src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
        if (sigMatch) {
            const sig = sigMatch[4];
            return `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
        }
        return /\.mp4(\?|$)/i.test(src) && !src.startsWith('blob:') ? src : null;
    }

    function getPinterestMainPinData() {
        try {
            const id = pinterestCurrentPinId();
            const v = pinterestMainVideo();
            if (v) {
                const srcEl = v.querySelector('source');
                const url = pinterestMp4FromSrc(v.currentSrc || v.src || (srcEl && srcEl.src) || '');
                pinterestRememberType('video', url);
                return { isFound: true, type: 'video', bestMp4Url: _pinMediaCache.bestMp4Url };
            }
            if (pinterestHasVideoSigns()) return { isFound: true, type: 'video', bestMp4Url: null };
            if (id && _pinMediaCache.pinId === id && (_pinMediaCache.type === 'video' || _pinMediaCache.type === 'image')) {
                return { isFound: true, type: _pinMediaCache.type, bestMp4Url: _pinMediaCache.bestMp4Url };
            }
        } catch (e) {
            console.error('[MOSSAD] Pinterest main pin detect error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
    }

    // ── v1.3.57: авто «Показать в полном масштабе» (настройка pinterestAutoFS, по умолчанию выкл.) ──
    // В v1.3.54 triggerPinterestFullScale/clickElementFull удалены как мёртвый код: их никто не вызывал,
    // настройка «FS» в блоке Pinterest ничего не делала. Теперь: на каждом новом пине (слайдшоу, стрелки,
    // ручной клик, переход внутри Pinterest) ждём кнопку главного пина и жмём её ОДИН раз на пин. ANTI_PATTERNS §36.
    const PIN_FS_POLL_MS = 250, PIN_FS_WAIT_MS = 8000;
    const PIN_FS_WORDS = ['полном масштабе', 'полный масштаб', 'во весь экран', 'полноэкран', 'развернуть',
        'full size', 'fullsize', 'full-size', 'full screen', 'fullscreen', 'expand', 'enlarge'];
    const PIN_FS_NOT = ['описан', 'коммент', 'description', 'comment', 'текст', 'text', 'more', 'ещё', 'еще'];
    let _pinFsDoneId = '', _pinFsPollId = '', _pinFsTimer = null;

    function clickElementFull(el) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => {
            try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 })); } catch (e) {}
        });
        try { if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    }
    function _pinFsText(el) {
        return [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-test-id'),
                (el.children.length <= 2 ? el.textContent : '')].filter(Boolean).join(' ').toLowerCase();
    }
    /** Кнопка «полный масштаб» ГЛАВНОГО пина (не из сетки похожих). Скрытые до наведения (opacity/visibility) — тоже. */
    function pinterestFindFullScaleButton() {
        const roots = pinterestCloseupRoots();
        const scopes = roots.length ? roots : [document.querySelector('div[role="main"]') || document.body];
        for (const scope of scopes) {
            const els = scope.querySelectorAll('button, [role="button"], a[aria-label], div[aria-label], svg[aria-label], [title]');
            for (const el of els) {
                if (pinIsRelated(el) || pinIsOwnUi(el)) continue;
                const t = _pinFsText(el);
                if (!t || !PIN_FS_WORDS.some(w => t.includes(w)) || PIN_FS_NOT.some(w => t.includes(w))) continue;
                return (el.tagName && el.tagName.toLowerCase() === 'svg') ? (el.closest('button, [role="button"]') || el) : el;
            }
        }
        return null;
    }
    function pinterestAutoFullScaleCancel() {
        if (_pinFsTimer) { clearTimeout(_pinFsTimer); _pinFsTimer = null; }
        _pinFsPollId = '';
    }
    /** Ждёт кнопку (250 мс, до 8 с; при смене пина — стоп) и жмёт один раз на пин. */
    function pinterestAutoFullScale() {
        if (!rootDomain.includes('pinterest.') || !config.pinterestAutoFS) return;
        const id = pinterestCurrentPinId();
        if (!id || id === _pinFsDoneId || id === _pinFsPollId) return;
        pinterestAutoFullScaleCancel();
        _pinFsPollId = id;
        const t0 = Date.now();
        const tick = () => {
            _pinFsTimer = null;
            if (_pinFsPollId !== id) return;
            if (!config.pinterestAutoFS || pinterestCurrentPinId() !== id) { _pinFsPollId = ''; return; }
            const btn = pinterestFindFullScaleButton();
            if (btn) {
                _pinFsDoneId = id; _pinFsPollId = '';
                clickElementFull(btn);
                mossadDebug('fs', 'Pinterest: полный масштаб', { pin: id });
                return;
            }
            if (Date.now() - t0 >= PIN_FS_WAIT_MS) { _pinFsDoneId = id; _pinFsPollId = ''; return; } // нет кнопки — не ищем снова на этом пине
            _pinFsTimer = setTimeout(tick, PIN_FS_POLL_MS);
        };
        _pinFsTimer = setTimeout(tick, PIN_FS_POLL_MS);
    }
    window.pinterestAutoFullScale = pinterestAutoFullScale;
    // Лёгкий сторож: раз в 500 мс сравнить id пина (только на Pinterest и только при включённой настройке)
    if (rootDomain.includes('pinterest.')) {
        setInterval(() => { if (config.pinterestAutoFS) pinterestAutoFullScale(); }, 500);
    }

    function getPinterestCandidatePins() {
        const currentPinId = pinterestCurrentPinId();
        const allLinks = Array.from(document.querySelectorAll('a[href*="/pin/"]'));
        const candidates = [];

        for (const a of allLinks) {
            if (pinIsOwnUi(a)) continue;
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

    /** v1.3.51: история пинов — только в localStorage сайта: без перерисовки меню и без синхронизации с GitHub. */
    function pinterestSaveHistory() {
        try { persistLocalConfig(); } catch (e) {}
    }
    function _pinReadDead() {
        try { const a = JSON.parse(sessionStorage.getItem(PIN_DEAD_SS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    function _pinMarkDead(pinId) {
        if (!pinId) return;
        const a = _pinReadDead().filter(x => x !== pinId);
        a.push(pinId);
        try { sessionStorage.setItem(PIN_DEAD_SS_KEY, JSON.stringify(a.slice(-50))); } catch (e) {}
    }
    /** Направление малого слайдшоу на Pinterest: ▶ вперёд (новые пины, по умолчанию) или ◀ назад по истории. */
    function pinterestSlideDir() {
        return config.pinterestDir === 'back' ? 'prev' : 'next';
    }
    function pinterestModeIsNumber(mode) {
        return /^\d+$/.test(String(mode == null ? '' : mode));
    }

    // v1.3.55: «Соотношение» фото/видео — вероятностная балансировка с памятью (не чередование и не монетка).
    // Память: типы последних PIN_BAL_N пинов, реально показанных слайдшоу (sessionStorage вкладки).
    // P(фото) = clamp(t + k·(t − s) ∓ push, 0.03, 0.97), где
    //   t — целевая доля фото (% фото / 100), s — доля фото в памяти, k = PIN_BAL_K · min(1, n / PIN_BAL_N);
    //   L — длина текущей серии одного типа, Lexp = 1 / (1 − p) — её средняя длина при доле p этого типа;
    //   push = min(PIN_BAL_MAX, PIN_BAL_STEP · max(0, L + 1 − Lexp)) — серия фото уменьшает P(фото), серия видео увеличивает.
    // 50/50: после 3 фото подряд P(видео) ≈ 0.8, после 2 — ≈ 0.64; доля сходится к t (симуляция: ±1.5%).
    const PIN_BAL_SS_KEY = 'mossad_pin_types';
    const PIN_BAL_N = 20, PIN_BAL_K = 1, PIN_BAL_STEP = 0.14, PIN_BAL_MAX = 0.45;
    function _pinReadShown() {
        try { const a = JSON.parse(sessionStorage.getItem(PIN_BAL_SS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    /** Тип показанного пина ('image'|'video') — в память балансировки (повтор того же id подряд не пишется). */
    function pinterestRecordShown(pinId, type) {
        if (!pinId || (type !== 'image' && type !== 'video')) return;
        const a = _pinReadShown();
        if (a.length && a[a.length - 1].id === pinId) a[a.length - 1].t = type;
        else a.push({ id: pinId, t: type });
        try { sessionStorage.setItem(PIN_BAL_SS_KEY, JSON.stringify(a.slice(-PIN_BAL_N))); } catch (e) {}
    }
    /** Фактический тип текущего (главного) пина: кэш → DOM → API; не знаем — ''. */
    function pinterestCurrentShownType() {
        const id = pinterestCurrentPinId();
        if (!id) return '';
        if (_pinMediaCache.pinId === id && (_pinMediaCache.type === 'video' || _pinMediaCache.type === 'image')) return _pinMediaCache.type;
        const pd = getPinterestMainPinData();
        if (pd.isFound && (pd.type === 'video' || pd.type === 'image')) return pd.type;
        const ci = pinterestCachedPinInfo(id);
        if (ci) return ci.isVideo ? 'video' : 'image';
        return '';
    }
    /** P(следующий пин — фото). types — массив 'image'|'video' (старые → новые), photoPercent 0..100. */
    function pinterestPhotoProbability(types, photoPercent) {
        const t = Math.min(1, Math.max(0, (Number(photoPercent) || 0) / 100));
        if (t <= 0 || t >= 1) return t;
        const r = (types || []).filter(x => x === 'image' || x === 'video').slice(-PIN_BAL_N);
        if (!r.length) return t;
        const s = r.filter(x => x === 'image').length / r.length;
        const last = r[r.length - 1];
        let L = 0;
        for (let i = r.length - 1; i >= 0 && r[i] === last; i--) L++;
        const pLast = last === 'image' ? t : 1 - t;
        const push = Math.min(PIN_BAL_MAX, PIN_BAL_STEP * Math.max(0, L + 1 - 1 / (1 - pLast)));
        const k = PIN_BAL_K * Math.min(1, r.length / PIN_BAL_N);
        const p = t + k * (t - s) + (last === 'image' ? -push : push);
        return Math.min(0.97, Math.max(0.03, p));
    }
    window.pinterestPhotoProbability = pinterestPhotoProbability;

    /**
     * Выбор следующего пина из похожих. Пропускаются тупики (_pinMarkDead) и, если есть из чего выбрать,
     * недавно посещённые (иначе «№ 3» мог ходить по кругу A → B → A).
     */
    function pinterestChooseCandidate(candidates) {
        const dead = new Set(_pinReadDead());
        const hist = Array.isArray(config.pinterestHistory) ? config.pinterestHistory : [];
        const visited = new Set(hist.slice(-30).map(u => pinterestCurrentPinId(u)).filter(Boolean));
        let pool = candidates.filter(c => !dead.has(c.pinId));
        const fresh = pool.filter(c => !visited.has(c.pinId));
        if (fresh.length) pool = fresh;
        if (!pool.length) pool = candidates;

        let filtered = [];
        const filterType = config.pinterestFilterType || 'ratio';
        if (filterType === 'image') {
            filtered = pool.filter(c => c.type === 'image');
        } else if (filterType === 'video') {
            filtered = pool.filter(c => c.type === 'video');
        } else if (filterType === 'ratio') {
            const pPhoto = pinterestPhotoProbability(_pinReadShown().map(x => x.t), config.pinterestPhotoPercent ?? 50);
            const targetType = Math.random() < pPhoto ? 'image' : 'video';
            filtered = pool.filter(c => c.type === targetType);
            if (filtered.length === 0) filtered = pool.filter(c => c.type !== targetType);
        } else {
            filtered = pool; // 'all'
        }
        if (filtered.length === 0) filtered = pool;

        const maxCandidates = filtered.slice(0, PIN_MAX_CANDIDATES);
        if (!maxCandidates.length) return null;
        let targetIndex = 0;
        const mode = config.pinterestMode || 'rand';
        if (mode === '+1') {
            // v1.3.51: счётчик в sessionStorage (раньше window._pinSeqIndex обнулялся на каждой странице → всегда 2-й пин)
            const prev = parseInt(sessionStorage.getItem(PIN_SEQ_SS_KEY), 10);
            const next = isNaN(prev) ? 0 : prev + 1;
            targetIndex = next % maxCandidates.length;
            try { sessionStorage.setItem(PIN_SEQ_SS_KEY, String(next % PIN_MAX_CANDIDATES)); } catch (e) {}
        } else if (pinterestModeIsNumber(mode)) {
            const num = parseInt(mode, 10) || 1;
            targetIndex = Math.min(Math.max(0, num - 1), maxCandidates.length - 1);
        } else {
            targetIndex = Math.floor(Math.random() * maxCandidates.length);
        }
        return { target: maxCandidates[targetIndex], index: targetIndex };
    }

    function pinterestScrollToRelated() {
        const rel = document.querySelector(PIN_RELATED_SEL) || document.querySelector('[data-grid-item]');
        try {
            if (rel && typeof rel.scrollIntoView === 'function') rel.scrollIntoView({ block: 'start', behavior: 'instant' });
            else window.scrollBy({ top: Math.max(300, window.innerHeight || 600), behavior: 'instant' });
        } catch (e) {}
    }

    let _pinWaitTimer = null;
    let _pinWaitGen = 0; // v1.3.55: поколение ожидания — «старый» тик после отмены/перехода ничего не делает
    function pinterestCancelWait() {
        _pinWaitGen++;
        if (_pinWaitTimer) { clearTimeout(_pinWaitTimer); _pinWaitTimer = null; }
    }

    /**
     * v1.3.55: пользователь сам открыл пин (переход Pinterest внутри страницы, без перезагрузки) во время слайдшоу.
     * Зовёт монитор URL движка. Ожидание похожих для СТАРОГО пина отменяется, новый пин — в историю
     * (как ветка: хвост «вперёд» отрезается; назад/вперёд браузера по истории — только сдвиг индекса).
     * Дальше движок показывает новый пин как обычный слайд и следующий шаг идёт уже от него.
     */
    function pinterestNoteNavigation(url, fromUrl) {
        pinterestCancelWait();
        const id = pinterestCurrentPinId(new URL(url, location.origin).pathname);
        if (!id) return;
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        const hist = config.pinterestHistory;
        const idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : hist.length - 1;
        const idOf = (u) => { const m = String(u || '').match(/\/pin\/(\d+)/); return m ? m[1] : ''; }; // без подстановки location
        if (idOf(hist[idx]) === id) return;
        // Пин, с которого ушли, — тоже в историю (если ушли до первого шага слайдшоу, его там ещё нет)
        const fromId = idOf(fromUrl);
        if (fromId && fromId !== id && idOf(hist[idx]) !== fromId) {
            config.pinterestHistory = hist.slice(0, Math.max(0, idx) + (hist.length ? 1 : 0));
            config.pinterestHistory.push(fromUrl);
            config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
            return pinterestNoteNavigation(url, '');
        }
        if (idx > 0 && idOf(hist[idx - 1]) === id) config.pinterestHistoryIdx = idx - 1;
        else if (idx + 1 < hist.length && idOf(hist[idx + 1]) === id) config.pinterestHistoryIdx = idx + 1;
        else {
            config.pinterestHistory = hist.slice(0, Math.max(0, idx) + 1);
            config.pinterestHistory.push(url);
            if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
            config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
        }
        pinterestSaveHistory();
    }
    window.pinterestCancelWait = pinterestCancelWait;

    function _pinGoToHistory(idx, toastMsg) {
        config.pinterestHistoryIdx = idx;
        pinterestSaveHistory();
        if (toastMsg) showToast(toastMsg);
        navigatePinterestUrl(config.pinterestHistory[idx]);
    }

    /**
     * v1.3.51: ждём похожие пины (они подгружаются лениво) — опрос каждые 250 мс до 15 с, с прокруткой к ним.
     * Не нашлись: этот пин — тупик, шаг назад по истории (там выберется другая ветка). Слайдшоу само НЕ останавливается.
     */
    function _pinterestPickAndGo(fromSlideshow) {
        pinterestCancelWait();
        const gen = _pinWaitGen;
        const startHref = location.href;
        const t0 = Date.now();
        let scrolled = false, waitToast = false;
        const tick = () => {
            if (gen !== _pinWaitGen) return; // отменено (стоп / ручной переход / новое ожидание)
            _pinWaitTimer = null;
            if (location.href !== startHref) {
                // v1.3.55: страницу сменил пользователь (переход внутри Pinterest). Раньше шаг тихо пропадал.
                // Новый пин — в историю; слайдшоу продолжает с него: монитор URL движка уже запускает цикл слайда,
                // здесь — страховка, если он ещё не заметил смену (без второго перехода: сами никуда не идём).
                if (fromSlideshow && slideshowActive && !slideshowPaused) {
                    pinterestNoteNavigation(location.href, startHref);
                    requestSlideCycle(150, 'pinterest:manual-nav-during-wait');
                }
                return;
            }
            if (fromSlideshow && (!slideshowActive || slideshowPaused)) return;
            const picked = pinterestChooseCandidate(getPinterestCandidatePins());
            if (picked && picked.target) {
                const target = picked.target;
                sessionStorage.setItem('mossad_expected_type', target.type);
                const hi = config.pinterestHistoryIdx ?? (config.pinterestHistory.length - 1);
                config.pinterestHistory = config.pinterestHistory.slice(0, hi + 1); // свернули на новый путь — хвост впереди отрезаем
                config.pinterestHistory.push(target.url);
                if (config.pinterestHistory.length > 100) config.pinterestHistory.shift();
                config.pinterestHistoryIdx = config.pinterestHistory.length - 1;
                pinterestSaveHistory();
                showToast(`📌 Новый пин #${picked.index + 1} (${target.type === 'video' ? '🎬 Видео' : '🖼 Фото'})`);
                navigatePinterestUrl(target.url);
                return;
            }
            const waited = Date.now() - t0;
            if (waited >= PIN_WAIT_MS) {
                _pinMarkDead(pinterestCurrentPinId());
                const idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;
                if (idx > 0) {
                    _pinGoToHistory(idx - 1, '↩ Похожих пинов нет — шаг назад, другая ветка');
                    return;
                }
                showToast('⚠️ Похожих пинов нет, истории нет — жду дальше', true);
                if (!fromSlideshow) return; // ручной шаг: просто сообщаем
                _pinterestPickAndGo(true); // слайдшоу не останавливаем
                return;
            }
            if (!scrolled) { scrolled = true; pinterestScrollToRelated(); }
            if (!waitToast && waited >= 1000) { waitToast = true; showToast('⏳ Жду похожие пины…'); }
            if (gen === _pinWaitGen) _pinWaitTimer = setTimeout(tick, PIN_POLL_MS);
        };
        tick();
    }

    /**
     * Следующий / предыдущий пин.
     * options.isManual — ручной шаг (стрелки): вперёд сначала идём по истории, если мы не на её вершине.
     * options.fromSlideshow — шаг слайдшоу: в начале истории («назад») не стоим, а идём вперёд по новым пинам.
     */
    function selectNextPinterestPin(direction, options = {}) {
        const isManual = options.isManual || false;
        const fromSlideshow = options.fromSlideshow || false;
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        // v1.3.55: текущий пин слайдшоу показало — его фактический тип в память балансировки фото/видео
        if (fromSlideshow) pinterestRecordShown(pinterestCurrentPinId(), pinterestCurrentShownType());
        let idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : config.pinterestHistory.length - 1;

        if (direction === 'prev') {
            if (idx > 0) {
                idx--;
                _pinGoToHistory(idx, `◀ Назад по истории (${idx + 1}/${config.pinterestHistory.length})`);
                return true;
            }
            if (!fromSlideshow) {
                showToast('⚠️ Вы в самом начале истории просмотров', true);
                return false;
            }
            // v1.3.51: слайдшоу в начале истории не останавливается — дальше вперёд по новым пинам
            showToast('⏮ Начало истории — дальше вперёд по новым пинам');
        }

        // Ручной шаг вперёд НЕ на вершине истории: идём вперёд по истории (как в Проводнике)
        if (direction !== 'prev' && isManual && idx >= 0 && idx < config.pinterestHistory.length - 1) {
            idx++;
            _pinGoToHistory(idx, `▶ Вперед по истории (${idx + 1}/${config.pinterestHistory.length})`);
            return true;
        }

        // Новый пин: текущий — в историю (если его там нет на вершине)
        const hist = config.pinterestHistory;
        const curIdxOk = idx >= 0 && idx < hist.length && hist[idx] === location.href;
        if (!curIdxOk) {
            if (hist.length === 0 || hist[hist.length - 1] !== location.href) {
                hist.push(location.href);
                if (hist.length > 100) hist.shift();
            }
            config.pinterestHistoryIdx = hist.length - 1;
            pinterestSaveHistory();
        }
        _pinterestPickAndGo(fromSlideshow);
        return true;
    }

    // ── v1.3.52: СКАЧИВАНИЕ на Pinterest — данные пина из PinResource API (same-origin) ──
    // История поломки: v1.2.19 (6b460fd) — ранний возврат «видео без ссылки» по blob-src плеера (JSON уже не
    // смотрели); v1.2.22 (1b8a255) — фолбэк на первое `div[role=main] img` (это картинка ПОХОЖЕГО пина).
    // Правка v1.3.21 была сделана только в бандле и потерялась при сборке из src/. ANTI_PATTERNS §31.
    // Порядок: (1) API пина (кэш по id) → хеш HLS → expMp4 _720w, запасной _360w; (2) хеш из poster/
    // data-video-signature главного <video>; (3) видео-пин без ссылки — «видео не найдено», НИКОГДА не фото;
    // фото — images.orig из API, иначе только картинка главного пина (closeup / MainPinImage).
    const PIN_API_TIMEOUT_MS = 7000;
    const PIN_API_CACHE_MAX = 30;
    const _pinApiCache = new Map(); // id → Promise<info|null>
    const _pinApiDone = new Map();  // id → info|null (уже полученные — для синхронных проверок слайдшоу)

    /** Хеш ролика (32 hex + путь aa/bb/cc) из ссылки HLS / expMp4 / превью videos/thumbnails. */
    function pinterestVideoHashFromUrl(url) {
        const m = String(url || '').match(/\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})(?:[._]|$)/i);
        if (!m) return null;
        if (!/videos\//i.test(url) && !/\.m3u8|expMp4|thumbnails/i.test(url)) return null;
        return m[4].toLowerCase();
    }
    /** Рабочие ссылки на mp4 по хешу (проверено 10.2026: _720w / _360w = 200 video/mp4 со звуком; mc/720p, _t1.._t4, _1080w, _480w = 403). */
    function pinterestMp4UrlsFromHash(hash) {
        if (!hash || hash.length !== 32) return [];
        const p = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4, 6)}/${hash}`;
        return [`https://v1.pinimg.com/videos/iht/expMp4/${p}_720w.mp4`, `https://v1.pinimg.com/videos/iht/expMp4/${p}_360w.mp4`];
    }
    function _pinCollectVideoLists(d) {
        const lists = [];
        const add = (v) => { if (v && v.video_list && typeof v.video_list === 'object') lists.push(v.video_list); };
        add(d && d.videos);
        add(d && d.video);
        const pages = (d && d.story_pin_data && Array.isArray(d.story_pin_data.pages)) ? d.story_pin_data.pages : [];
        for (const pg of pages) {
            add(pg && pg.video);
            const blocks = (pg && Array.isArray(pg.blocks)) ? pg.blocks : [];
            for (const b of blocks) add(b && b.video);
        }
        return lists;
    }
    /** Компактная сводка пина из ответа API (весь JSON не храним). */
    function pinterestParsePinData(d) {
        if (!d || typeof d !== 'object') return null;
        const info = { isVideo: false, mp4Urls: [], hash: null, durationMs: 0, imageUrl: '', desc: '' };
        const direct = [];
        for (const list of _pinCollectVideoLists(d)) {
            for (const k of Object.keys(list)) {
                const e = list[k];
                if (!e || !e.url) continue;
                info.isVideo = true;
                if (!info.durationMs && e.duration) info.durationMs = Number(e.duration) || 0;
                if (/\.mp4(\?|$)/i.test(e.url)) direct.push({ url: e.url, w: e.width || 0 });
                if (!info.hash) info.hash = pinterestVideoHashFromUrl(e.url);
            }
        }
        const byHash = pinterestMp4UrlsFromHash(info.hash);
        direct.sort((a, b) => b.w - a.w);
        info.mp4Urls = Array.from(new Set([...byHash, ...direct.map(x => x.url)]));
        const im = d.images || {};
        info.imageUrl = (im.orig && im.orig.url) || (im.originals && im.originals.url) || (im['736x'] && im['736x'].url) || '';
        const txt = [d.title, d.grid_title, d.description, d.closeup_unified_description].find(x => typeof x === 'string' && x.trim());
        info.desc = txt ? txt.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
        return info;
    }
    /** Один запрос на пин (кэш промисов, до 30 пинов), таймаут 7 с; ошибка → null. */
    function pinterestFetchPinInfo(pinId) {
        if (!pinId) return Promise.resolve(null);
        if (_pinApiCache.has(pinId)) return _pinApiCache.get(pinId);
        const p = (async () => {
            if (typeof fetch !== 'function') return null;
            const ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
            const t = ctrl ? setTimeout(() => ctrl.abort(), PIN_API_TIMEOUT_MS) : null;
            try {
                const q = new URLSearchParams({
                    source_url: `/pin/${pinId}/`,
                    data: JSON.stringify({ options: { id: String(pinId), field_set_key: 'detailed' }, context: {} })
                });
                const res = await fetch(`/resource/PinResource/get/?${q}`, {
                    credentials: 'same-origin',
                    headers: { 'X-Pinterest-PWS-Handler': 'www/pin/[id].js', 'Accept': 'application/json' },
                    signal: ctrl ? ctrl.signal : undefined
                });
                if (!res.ok) return null;
                const json = await res.json();
                return pinterestParsePinData(json && json.resource_response && json.resource_response.data);
            } catch (e) {
                console.warn('[MOSSAD] PinResource API недоступен:', e && e.message);
                return null;
            } finally {
                if (t) clearTimeout(t);
            }
        })().then(info => { _pinApiDone.set(pinId, info); return info; });
        _pinApiCache.set(pinId, p);
        while (_pinApiCache.size > PIN_API_CACHE_MAX) {
            const k = _pinApiCache.keys().next().value;
            _pinApiCache.delete(k);
            _pinApiDone.delete(k);
        }
        return p;
    }
    /** Уже полученная сводка текущего пина (синхронно; undefined — ещё не запрашивали/не пришла). */
    function pinterestCachedPinInfo(pinId) {
        const id = pinId || pinterestCurrentPinId();
        return _pinApiDone.has(id) ? _pinApiDone.get(id) : undefined;
    }
    window.pinterestFetchPinInfo = pinterestFetchPinInfo;

    /** Хеш ролика главного пина из DOM: poster главного <video> или ближайший [data-video-signature]. */
    function pinterestVideoHashFromDom() {
        const v = pinterestMainVideo();
        if (!v) return null;
        const sigEl = v.closest('[data-video-signature]') || v.querySelector('[data-video-signature]');
        const sig = sigEl ? (sigEl.getAttribute('data-video-signature') || '') : '';
        if (/^[a-f0-9]{32}$/i.test(sig)) return sig.toLowerCase();
        const srcEl = v.querySelector('source');
        for (const u of [v.getAttribute('poster'), v.currentSrc, v.src, srcEl && srcEl.src]) {
            const h = pinterestVideoHashFromUrl(u || '');
            if (h) return h;
        }
        return null;
    }
    function _pinOriginalsUrl(src) {
        return String(src || '').replace(/\/(?:\d{2,4}x(?:\d{2,4})?(?:_RS)?)\//, '/originals/');
    }

    /**
     * Что качать на текущем пине. → { urls, type: 'video'|'photo', desc } | { error: 'video-not-found' } | null.
     * API ответил — доверяем ему (видео/фото); API недоступен — только DOM главного пина.
     */
    async function pinterestResolveMedia() {
        const id = pinterestCurrentPinId();
        const info = id ? await pinterestFetchPinInfo(id) : null;
        const domHash = pinterestVideoHashFromDom();
        if (info) {
            if (info.isVideo) {
                const urls = Array.from(new Set([...info.mp4Urls, ...pinterestMp4UrlsFromHash(domHash)]));
                if (urls.length) return { urls, type: 'video', desc: info.desc };
                return { error: 'video-not-found' };
            }
            if (info.imageUrl) return { urls: [info.imageUrl], type: 'photo', desc: info.desc };
        }
        if (domHash) return { urls: pinterestMp4UrlsFromHash(domHash), type: 'video', desc: info ? info.desc : '' };
        const v = pinterestMainVideo();
        if (v) {
            const direct = pinterestMp4FromSrc(v.currentSrc || v.src || '');
            if (direct) return { urls: [direct], type: 'video' };
        }
        if (v || pinterestHasVideoSigns()) return { error: 'video-not-found' };
        const img = pinterestMainImage();
        if (img) {
            const src = img.currentSrc || img.src;
            return { urls: Array.from(new Set([_pinOriginalsUrl(src), src])), type: 'photo', desc: info ? info.desc : '' };
        }
        return null;
    }
