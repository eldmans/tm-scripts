    // ============================================
    // v1.3.44: СЧЁТЧИКИ ТАЙМЕРОВ/НАБЛЮДАТЕЛЕЙ MOSSAD (диагностика утечек)
    // setInterval / clearInterval / MutationObserver внутри бандла перекрыты тонкими обёртками
    // (та же сигнатура, только учёт активных id/наблюдателей). Код сайта это не затрагивает.
    // Срез пишется в debug-лог (mossadPerfSnapshot) — см. ANTI_PATTERNS §23.
    // ============================================
    const _mossadActive = { intervals: new Set(), observers: new Set() };
    const _nativeSetInterval = window.setInterval.bind(window);
    const _nativeClearInterval = window.clearInterval.bind(window);
    const setInterval = (fn, ms, ...args) => {
        const id = _nativeSetInterval(fn, ms, ...args);
        _mossadActive.intervals.add(id);
        return id;
    };
    const clearInterval = (id) => {
        _mossadActive.intervals.delete(id);
        return _nativeClearInterval(id);
    };
    // Фабрика (не подкласс): `new MutationObserver(cb)` вернёт настоящий наблюдатель с учётом observe/disconnect.
    // Подкласс нативного конструктора в песочнице Tampermonkey (Firefox, Xray) ненадёжен.
    const _NativeMO = window.MutationObserver;
    function MutationObserver(cb) {
        const o = new _NativeMO(cb);
        try {
            const obs = o.observe.bind(o), dis = o.disconnect.bind(o);
            o.observe = (...a) => { _mossadActive.observers.add(o); return obs(...a); };
            o.disconnect = () => { _mossadActive.observers.delete(o); return dis(); };
        } catch (e) {}
        return o;
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
    // URL NORMALIZATION (общие ключи сравнения URL)
    // ============================================

    /** URL без query-строки (`?…`). null/undefined → ''. Регистр сохраняется. */
    function stripUrlQuery(url) {
        return String(url || '').split('?')[0];
    }

    /** Ключ сравнения URL: без query-строки и в нижнем регистре. null/undefined → ''. */
    function normUrlKey(url) {
        return stripUrlQuery(url).toLowerCase();
    }

    // ============================================
    // FOCUS: единая проверка «пользователь сейчас печатает»
    // ============================================

    // Типы <input>, в которых нет ввода текста: хоткеи при фокусе на них должны работать.
    const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

    /**
     * true, если элемент — поле ввода текста (input с текстом, textarea, select, contenteditable,
     * role="textbox" или что-то внутри них). Используется всеми обработчиками хоткеев (v1.3.37).
     */
    function isEditableElement(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        if (el.tagName === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(String(el.type || '').toLowerCase());
        if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
        if (el.isContentEditable) return true;
        if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
        return !!(el.closest && el.closest('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'));
    }

    // ============================================
    // POLLING: общий помощник ожидания условия
    // ============================================

    /**
     * Опрашивает checkFn каждые intervalMs (первая проверка — через intervalMs).
     * Резолвится результатом checkFn, как только он truthy, или null, когда исчерпаны попытки.
     * v1.3.38: семантика «числа попыток» (как до v1.3.33): maxAttempts = ceil(timeoutMs / intervalMs).
     * При загруженном main thread таймеры срабатывают реже, и чисто «настенные» часы давали меньше
     * проверок, чем задумано (например, 240/40 мс → всего 1–2 проверки вместо 6). Страховка от
     * бесконечного ожидания в фоновой вкладке (таймеры ≥1 с): жёсткий потолок 4 × timeoutMs.
     * Исключения в checkFn гасятся (считаются «ещё нет»). Интервал всегда очищается.
     */
    function waitForCondition(checkFn, timeoutMs = 2500, intervalMs = 50) {
        return new Promise(resolve => {
            const start = Date.now();
            const maxAttempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));
            const hardCapMs = timeoutMs * 4;
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                let res = null;
                try { res = checkFn(); } catch(e) {}
                if (res) {
                    clearInterval(timer);
                    return resolve(res);
                }
                if (attempts >= maxAttempts || Date.now() - start >= hardCapMs) {
                    clearInterval(timer);
                    return resolve(null);
                }
            }, intervalMs);
        });
    }

    // ============================================
    // DEBUG-ЛОГ (v1.3.38): кто и почему запустил шаг слайдшоу / удаление
    // Включается в F1 → «Debug-лог слайдшоу» (config.debugSlideshow, по умолчанию выкл.).
    // Пишет в консоль с префиксом [MOSSAD DBG] и в кольцевой буфер (последние 300 записей),
    // который копируется кнопкой «📋 лог» в окне F1 (mossadDumpDebugLog()).
    // ============================================
    const MOSSAD_DEBUG_MAX = 300;
    const _mossadDebugBuf = [];

    function isMossadDebugOn() {
        try { return !!(config && config.debugSlideshow); } catch(e) { return false; }
    }

    function mossadDebug(source, msg, data) {
        if (!isMossadDebugOn()) return;
        const entry = {
            t: new Date().toISOString().slice(11, 23),
            source: String(source || '?'),
            msg: String(msg || ''),
            path: (location.pathname || '').slice(0, 80)
        };
        if (data !== undefined) entry.data = data;
        _mossadDebugBuf.push(entry);
        if (_mossadDebugBuf.length > MOSSAD_DEBUG_MAX) _mossadDebugBuf.splice(0, _mossadDebugBuf.length - MOSSAD_DEBUG_MAX);
        try {
            console.log('%c[MOSSAD DBG]', 'color:#f59e0b;font-weight:bold', entry.t, `[${entry.source}]`, entry.msg, data !== undefined ? data : '');
        } catch(e) {}
    }

    // ── v1.3.44: диагностика производительности (только при включённом debug-логе) ──
    // Лаг главного потока: интервал 250 мс; если между срабатываниями прошло на 200+ мс больше — страница
    // (сайт, браузер или MOSSAD) была занята. В фоновой вкладке браузер сам замедляет таймеры — не считаем.
    const _mossadPerf = { timer: null, last: 0, lagMax: 0, lagCount: 0, slideAt: 0 };

    function mossadPerfStart() {
        if (_mossadPerf.timer || !isMossadDebugOn()) return;
        _mossadPerf.last = performance.now();
        _mossadPerf.timer = setInterval(() => {
            const now = performance.now();
            const lag = now - _mossadPerf.last - 250;
            _mossadPerf.last = now;
            if (document.hidden) return;
            if (!isMossadDebugOn()) { clearInterval(_mossadPerf.timer); _mossadPerf.timer = null; return; }
            if (lag > _mossadPerf.lagMax) _mossadPerf.lagMax = lag;
            if (lag > 200) {
                _mossadPerf.lagCount++;
                mossadDebug('perf', 'главный поток занят (лаг)', { ms: Math.round(lag) });
            }
        }, 250);
    }

    /** Срез на каждом слайде: активные таймеры/наблюдатели MOSSAD, <video> и узлы DOM, лаг за слайд. */
    function mossadPerfSnapshot(where) {
        if (!isMossadDebugOn()) return;
        mossadPerfStart();
        const now = performance.now();
        const data = {
            where,
            intervals: _mossadActive.intervals.size,
            observers: _mossadActive.observers.size,
            videos: document.getElementsByTagName('video').length,
            nodes: document.getElementsByTagName('*').length,
            lagMaxMs: Math.round(_mossadPerf.lagMax),
            lags: _mossadPerf.lagCount,
            slideMs: _mossadPerf.slideAt ? Math.round(now - _mossadPerf.slideAt) : 0
        };
        try { if (performance.memory) data.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); } catch (e) {}
        _mossadPerf.slideAt = now;
        _mossadPerf.lagMax = 0;
        _mossadPerf.lagCount = 0;
        mossadDebug('perf', 'срез', data);
    }

    /** Время шага (мс) — пишем в лог, только если шаг занял больше порога. */
    function mossadPerfStep(name, t0, thresholdMs = 30) {
        const ms = performance.now() - t0;
        if (ms >= thresholdMs) mossadDebug('perf', 'долгий шаг', { name, ms: Math.round(ms) });
    }

    function mossadDumpDebugLog() {
        try { console.table(_mossadDebugBuf.slice()); } catch(e) { console.log(_mossadDebugBuf.slice()); }
        return _mossadDebugBuf.slice();
    }

    // ============================================
    // GENERAL HELPERS & RETRY ENGINE
    // ============================================

    /**
     * Снимает фокус с активного поля ввода, если он там остался.
     */
    function blurActiveInput() {
        const activeEl = document.activeElement;
        if (activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable ||
            activeEl.getAttribute('role') === 'textbox' ||
            !!activeEl.closest('input, textarea, [contenteditable="true"], [role="textbox"]')
        )) {
            try { activeEl.blur(); } catch (e) {}
        }
    }

    /** v1.3.61: клик «как мышью»: pointer/mouse-последовательность + один click (Radix реагирует и на pointerdown). */
    function mossadPressEl(el) {
        if (!el) return;
        const P = window.PointerEvent || window.MouseEvent;
        const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
        const base = { bubbles: true, cancelable: true, composed: true, view: window, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        const fire = (C, type, extra) => { try { el.dispatchEvent(new C(type, Object.assign({}, base, extra))); } catch (e) {} };
        fire(P, 'pointerdown', { buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true });
        fire(window.MouseEvent, 'mousedown', { buttons: 1 });
        fire(P, 'pointerup', { buttons: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true });
        fire(window.MouseEvent, 'mouseup', { buttons: 0 });
        try { el.click(); } catch (e) {}
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
     * Преобразует строковое направление в имя клавиши KeyboardEvent
     */
    function getArrowKey(dir) {
        if (dir === 'up') return 'ArrowUp';
        if (dir === 'down') return 'ArrowDown';
        if (dir === 'left') return 'ArrowLeft';
        return 'ArrowRight';
    }
    window.getArrowKey = getArrowKey;

    /**
     * Отправляет нативное синтетическое событие стрелки клавиатуры во все слои DOM:
     * activeElement -> document -> window, заполняя key, code, keyCode и which.
     */
    function sendDpadKeyEvent(key) {
        blurActiveInput();
        const keyCode = key === 'ArrowUp' ? 38 : (key === 'ArrowDown' ? 40 : (key === 'ArrowLeft' ? 37 : 39));
        const eventInit = {
            key: key,
            code: key,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            composed: true
        };
        const active = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : null;
        if (active) {
            try { active.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
            try { active.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}
        }
        try { document.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
        try { document.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}
        try { window.dispatchEvent(new KeyboardEvent('keydown', eventInit)); } catch(e) {}
        try { window.dispatchEvent(new KeyboardEvent('keyup', eventInit)); } catch(e) {}

        triggerUniversalFullScreen();
    }
    window.sendDpadKeyEvent = sendDpadKeyEvent;

    /**
     * Поиск нативной кнопки навигации на Grok (если доступна в DOM)
     */
    function findGrokNavButton(dir) {
        const isNext = (dir === 'down' || dir === 'right');
        const labels = isNext
            ? ['next post', 'next', 'следующий', 'следующая', 'следующее']
            : ['previous post', 'previous', 'prev', 'предыдущий', 'предыдущая', 'предыдущее'];
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        return btns.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            return labels.some(l => aria === l || title === l);
        }) || null;
    }

    /**
     * Унифицированный пошаговый переход по направлению D-Pad.
     * Используется:
     * 1. В Малом слайдшоу (Shift+Insert / ракета 🚀).
     * 2. После скачивания при включенном pdAction: 'up' (Скачать - +1).
     * 3. При ручной навигации.
     */
    function performDpadStep(dirOverride = null, isSlideshow = false) {
        const dirs = config.slideshowDirections;
        const dir = dirOverride || ((dirs && dirs.length) ? dirs[0] : 'down');
        const isFwd = (dir === 'down' || dir === 'right');

        // 1. Pinterest
        // v1.3.51: направление D-pad на Pinterest не используется (D-pad там не показан, а ▲ по умолчанию
        // означало «назад по истории»). Слайдшоу — своё направление ◀/▶ (pinterestSlideDir), «После DL: +1» — вперёд.
        if (rootDomain.includes('pinterest.')) {
            if (isSlideshow) selectNextPinterestPin(pinterestSlideDir(), { isManual: false, fromSlideshow: true });
            else selectNextPinterestPin('next', { isManual: true });
            return true;
        }

        // 2. RedGifs
        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.navigate) {
                window.MOSSAD_ENGINES.redgifs.navigate(dir);
            } else redGifsNavigate(dir);
            return true;
        }

        // 3. Grok
        if (rootDomain === 'grok.com') {
            // А. Горизонтальное листание кадров группы по киноплёнке (left / right)
            if ((dir === 'left' || dir === 'right') && isGrokPostPage()) {
                {
                    const stepRes = grokStepFilmstrip(isFwd);
                    if (stepRes === true) return true;
                    if (stepRes === 'end') {
                        if (isSlideshow && !config.loopFeed) {
                            stopSlideshow();
                            showToast('⏹ Слайдшоу остановлено: конец ленты', true);
                            return false;
                        }
                    }
                }
            }

            // Б. Проверяем, есть ли карточки соседних постов в DOM или в сохраненной коллекции
            const neighborUrl = getGrokNeighborPostUrl(dir);
            if (neighborUrl) {
                if (typeof grokSpaNavigate === 'function') {
                    grokSpaNavigate(neighborUrl);
                } else {
                    window.location.href = neighborUrl;
                }
                return true;
            }

            // В. Проверяем нативную кнопку навигации
            const navBtn = findGrokNavButton(dir);
            if (navBtn) {
                triggerClick(navBtn, `Grok Nav Button (${dir})`);
                return true;
            }

            // Г. Нативная отправка стрелок Grok (ArrowUp / ArrowDown / ArrowLeft / ArrowRight)
            const key = getArrowKey(dir);
            sendDpadKeyEvent(key);
            return true;
        }

        // 4. Все остальные сайты: универсальная отправка стрелки D-pad
        const key = getArrowKey(dir);
        sendDpadKeyEvent(key);
        return true;
    }
    window.performDpadStep = performDpadStep;

    // v1.3.56: «После скачивания»: none (—) | upns («Не СШ +1»: +1, только если слайдшоу НЕ запущено —
    // ни малое, ни большое Grok, ни Pinterest; на паузе = запущено) | always («+1 всегда») | del (Delete, только Grok).
    // Скачивание, которое запустило само слайдшоу перед шагом, +1 не делает никогда: слайдшоу шагает само (иначе двойной шаг).
    let mossadSlideshowDlActive = false;
    function mossadPdAction() {
        const v = config && config.pdAction;
        if (v === 'up') return 'upns';
        return ['none', 'upns', 'always', 'del'].includes(v) ? v : 'upns';
    }
    /** Запущено ли какое-либо слайдшоу (идёт или на паузе). Остановлено полностью — false. */
    function mossadAnySlideshowActive() {
        try {
            if (typeof slideshowActive !== 'undefined' && slideshowActive) return true;
            if (window._mossadGalleryActive) return true;
            if (sessionStorage.getItem(`mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`) === 'true') return true;
        } catch (e) {}
        return false;
    }

    /**
     * Выполняет пост-действие после фактического скачивания (+1 или del).
     * Срабатывает ТОЛЬКО когда скачивание реально началось, а не при блокировке дубликата.
     */
    function performPostDownloadAction() {
        const act = mossadPdAction();
        if (!config || act === 'none') return;
        if (act === 'upns' || act === 'always') {
            if (mossadSlideshowDlActive) { mossadDebug('step', 'После скачивания +1 пропущен: скачивание запустило слайдшоу'); return; }
            if (act === 'upns' && mossadAnySlideshowActive()) { mossadDebug('step', 'После скачивания «Не СШ +1»: слайдшоу запущено — без +1'); return; }
            setTimeout(() => {
                const dirs = config.slideshowDirections;
                const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                performDpadStep(dPadDir, false);
            }, 600);
        } else if (act === 'del' && rootDomain === 'grok.com') {
            setTimeout(() => {
                runSmartDelete();
            }, 1000);
        }
    }
    window.performPostDownloadAction = performPostDownloadAction;

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
        // v1.3.43: на время перемотки — никаких таймеров/подсчёта кругов (раньше RAF перепривязывался
        // и запускал play() у роликов, пролетающих при перемотке); после — сброс памяти прошлого круга.
        if (typeof window.cancelSlideTimers === 'function') window.cancelSlideTimers();

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
            sendDpadKeyEvent(key);

            setTimeout(() => {
                if (location.href === lastUrl) {
                    unchangedCount++;
                    if (unchangedCount >= 5) {
                        clearInterval(interval);
                        _isRewinding = false;
                        window._isRewinding = false;
                        if (typeof window.resetSlideTrackingState === 'function') window.resetSlideTrackingState('rewind');
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
    // ШАБЛОН ИМЕНИ ФАЙЛА (v1.3.53: общие теги, buildFilenameVars, правило расширения)
    // ============================================
    // Старый общий шаблон по умолчанию '{id8}-{domain[4]}~{RadugaStud}' мигрирует в config.js (OLD_DEFAULT_TPL_V1336).
    const MOSSAD_DEFAULT_TPL = '{id8}-{domain}';
    const MOSSAD_DEFAULT_TPL_GROK = '{id8}-{domain}~{account}';
    // Расширение добавляется, если имя НЕ оканчивается на одно из этих (точки внутри имени не мешают)
    const MOSSAD_MEDIA_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'gif', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'heic', 'mp3', 'm4a', 'txt'];
    const MOSSAD_NAME_MAX = 200; // длина имени без расширения (Windows: 255 на имя целиком)

    /**
     * Теги шаблона: k — имя, aliases — синонимы, what — что подставляется (для окна «?»).
     * Любой тег принимает длину: {tagN} или {tag[N]} — первые N символов (N ≥ 1; без N — целиком).
     * Имена — только буквы, регистр не важен. Неизвестный тег в имени файла пропадает (в окне «?» — красным).
     */
    const MOSSAD_TPL_TAGS = [
        { k: 'id',         aliases: ['uuid', 'hash', 'postid'], what: 'ID поста: Pinterest — номер пина, Grok — UUID поста, RedGifs — id ролика, Instagram — код поста; иначе — время (мс)' },
        { k: 'conv',       aliases: ['conversation'],           what: 'Grok: UUID беседы (на других сайтах пусто)' },
        { k: 'domain',     aliases: ['site'],                   what: 'Сайт одним словом: pinterest, grok, redgifs…' },
        { k: 'domainfull', aliases: [],                         what: 'Домен целиком: pinterest.com, grok.com…' },
        { k: 'account',    aliases: ['email'],                  what: 'Grok: e-mail вошедшего аккаунта (если удалось узнать); на других сайтах пусто' },
        { k: 'username',   aliases: ['user', 'author'],         what: 'Автор (RedGifs, Instagram); иначе — первые 8 символов ID; Grok — grok' },
        { k: 'desc',       aliases: ['description'],            what: 'Описание: Pinterest — заголовок/описание пина, Grok — промпт; иначе пусто' },
        { k: 'title',      aliases: [],                         what: 'Заголовок вкладки (Grok — «Imagine - Grok»)' },
        { k: 'date',       aliases: [],                         what: 'Дата скачивания: дд.мм.гг' },
        { k: 'time',       aliases: [],                         what: 'Время скачивания: чч-мм-сс' },
        { k: 'ext',        aliases: [],                         what: 'Расширение: mp4 / jpg (добавляется само, если имя не оканчивается на него)' },
        { k: 'n',          aliases: [],                         what: 'Последние 6 цифр текущего времени в мс (не счётчик)' },
        { k: 'dbl',        aliases: [],                         what: 'Пометка дубликата « (исходное имя) DBL»; без тега добавляется в конец сама' },
        { k: 'oldname',    aliases: ['copy', 'root'],           what: 'Имя ранее скачанного файла (только для дубликата, до 50 символов)' },
    ];
    const MOSSAD_TPL_ALIAS = {};
    for (const t of MOSSAD_TPL_TAGS) { MOSSAD_TPL_ALIAS[t.k] = t.k; for (const a of t.aliases) MOSSAD_TPL_ALIAS[a] = t.k; }

    // ── v1.3.74: модификаторы тега (внутри фигурных скобок, в любом теге) ──
    //   {tag--Минус слово--"текст с - дефисами"}  — удалить (без учёта регистра, все вхождения)
    //   {tag[[2]]} {tag[[-2]]} {tag[[2:]]} {tag[[:-2]]} {tag[[1:3]]} — слова (как срезы Python)
    //   {tag[N]} / {tagN} — первые N символов
    // Порядок применения всегда: минус-слова → слова → символы (как бы они ни были записаны).
    const MOSSAD_TPL_SEP_CLS = '\\s.,_|\\-\u2013\u2014';
    const MOSSAD_TPL_MOD_START = /--|\[\[|\[\d+\]/;

    /** Разбить шаблон на куски: { text } и { raw: '{…}', inner: '…' }. Скобки внутри тега считаются по глубине
     *  (регулярка {re:…\d{2}…} не рвёт тег), \x — экранирование, "…" внутри тега — кавычки. */
    function mossadTplScan(tpl) {
        const s = String(tpl || ''), out = [];
        let i = 0, text = '';
        while (i < s.length) {
            if (s[i] !== '{') { text += s[i++]; continue; }
            let j = i + 1, depth = 1, q = false;
            for (; j < s.length; j++) {
                const c = s[j];
                if (c === '\\') { j++; continue; }
                if (c === '"') { q = !q; continue; }
                if (q) continue;
                if (c === '{') depth++;
                else if (c === '}' && --depth === 0) break;
            }
            if (j >= s.length) { text += s.slice(i); break; } // нет закрывающей — обычный текст
            if (text) { out.push({ text }); text = ''; }
            out.push({ raw: s.slice(i, j + 1), inner: s.slice(i + 1, j) });
            i = j + 1;
        }
        if (text) out.push({ text });
        return out;
    }

    /** Разобрать модификаторы (строка после имени тега) в spec. Возвращает текст ошибки или ''. */
    function _tplParseMods(s, spec) {
        let i = 0, m;
        while (i < s.length) {
            const rest = s.slice(i);
            if (rest.startsWith('--')) {
                i += 2;
                if (s[i] === '"') {
                    const j = s.indexOf('"', i + 1);
                    if (j < 0) return 'нет закрывающей кавычки';
                    if (j > i + 1) spec.minus.push(s.slice(i + 1, j));
                    i = j + 1;
                } else {
                    const r2 = s.slice(i), k = r2.search(MOSSAD_TPL_MOD_START);
                    const w = k < 0 ? r2 : r2.slice(0, k);
                    if (w.trim()) spec.minus.push(w.trim());
                    i += w.length;
                }
                continue;
            }
            if ((m = /^\[\[\s*(-?\d+)?\s*(:)?\s*(-?\d+)?\s*\]\]/.exec(rest))) {
                if (m[1] == null && m[3] == null && !m[2]) return 'пустые [[ ]]';
                if (!m[2] && m[1] == null) return 'нужно число в [[ ]]';
                spec.words = { a: m[1] != null ? parseInt(m[1], 10) : null, b: m[3] != null ? parseInt(m[3], 10) : null, colon: !!m[2] };
                i += m[0].length; continue;
            }
            if ((m = /^\[(\d+)\]/.exec(rest))) { spec.chars = parseInt(m[1], 10); i += m[0].length; continue; }
            return 'непонятно: ' + rest;
        }
        return '';
    }

    /** Ключ тега страницы: "в кавычках" или до первого модификатора (--, [[, [N]). → [key, rest] */
    function _tplPageKey(s) {
        if (s[0] === '"') {
            const j = s.indexOf('"', 1);
            return j < 0 ? [null, ''] : [s.slice(1, j), s.slice(j + 1)];
        }
        const k = s.search(MOSSAD_TPL_MOD_START);
        return k < 0 ? [s.trim(), ''] : [s.slice(0, k).trim(), s.slice(k)];
    }
    /** Разрезать по неэкранированному «/» (\/ → /, остальные \ остаются для регулярки). */
    function _tplSplitSlash(s) {
        const out = []; let cur = '';
        for (let i = 0; i < s.length; i++) {
            if (s[i] === '\\' && s[i + 1] === '/') { cur += '/'; i++; continue; }
            if (s[i] === '\\') { cur += s[i] + (s[i + 1] || ''); i++; continue; }
            if (s[i] === '/') { out.push(cur); cur = ''; continue; }
            cur += s[i];
        }
        out.push(cur);
        return out;
    }

    /** Разбор содержимого тега (без скобок) → spec { kind: var|meta|ld|css|re, name, key, attr, src, re, repl, chars, words, minus[], err }.
     *  v1.3.75: теги страницы — meta:ИМЯ, ld:путь.к.полю, css:СЕЛЕКТОР[@атрибут], re:ИСТОЧНИК/РЕГУЛЯРКА/ЗАМЕНА[/модификаторы]. */
    function mossadTplParse(inner) {
        const s = String(inner || '');
        const spec = { kind: 'var', name: '', chars: 0, words: null, minus: [], err: '' };
        const pm = /^(meta|ld|css|re):/i.exec(s);
        if (pm) {
            spec.kind = pm[1].toLowerCase();
            const body = s.slice(pm[0].length);
            if (spec.kind === 're') {
                const parts = _tplSplitSlash(body);
                if (parts.length < 2 || !parts[1]) { spec.err = 'нужно re:ИСТОЧНИК/РЕГУЛЯРКА/ЗАМЕНА'; return spec; }
                spec.src = mossadTplParse(parts[0]);
                if (spec.src.err) { spec.err = 'источник: ' + spec.src.err; return spec; }
                try { spec.re = new RegExp(parts[1], 'i'); } catch (e) { spec.err = 'ошибка в регулярке: ' + e.message; return spec; }
                spec.repl = parts.length > 2 ? parts[2] : null;
                spec.err = _tplParseMods(parts.slice(3).join('/'), spec);
                return spec;
            }
            const [key, rest] = _tplPageKey(body);
            if (!key) { spec.err = key === null ? 'нет закрывающей кавычки' : 'пустое имя после ' + pm[0]; return spec; }
            spec.key = key;
            if (spec.kind === 'css') {
                const am = /@([\w:-]+)$/.exec(key);
                if (am) { spec.attr = am[1]; spec.key = key.slice(0, am.index).trim(); }
                try { document.createDocumentFragment().querySelector(spec.key); } catch (e) { spec.err = 'ошибка в CSS-селекторе'; return spec; }
            }
            spec.err = _tplParseMods(rest, spec);
            return spec;
        }
        const m = /^([a-zA-Z]+)(\d+)?/.exec(s);
        if (!m) { spec.err = 'нет имени тега'; return spec; }
        spec.name = m[1];
        if (m[2]) spec.chars = parseInt(m[2], 10);
        spec.err = _tplParseMods(s.slice(m[0].length), spec);
        return spec;
    }

    /** Убрать слова/фразы list из val (без учёта регистра, все вхождения); если что-то убрано — подчистить пробелы и висячие разделители. */
    function mossadTplMinus(val, list) {
        let v = String(val == null ? '' : val), hit = false;
        for (const w of (list || [])) {
            if (!w) continue;
            const re = new RegExp(String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const v2 = v.replace(re, '');
            if (v2 !== v) { hit = true; v = v2; }
        }
        if (!hit) return v;
        const S = MOSSAD_TPL_SEP_CLS;
        return v.replace(/\s+/g, ' ')
            .replace(new RegExp(`(\\s*[${S.slice(2)}]\\s*)(?:[${S.slice(2)}]\\s*)+`, 'g'), '$1')
            .replace(new RegExp(`^[${S}]+|[${S}]+$`, 'g'), '');
    }

    /** Слова из val по срезу (a, b, colon) — как Python: [[2]] первые 2, [[-2]] последние 2, [[2:]] без первых 2, [[:-2]] без последних 2.
     *  Разделители слов: пробел . , _ | - – —; между оставшимися словами разделители остаются как были. */
    function mossadTplWords(val, w) {
        const v = String(val == null ? '' : val);
        if (!w) return v;
        const spans = [], re = new RegExp(`[^${MOSSAD_TPL_SEP_CLS}]+`, 'g');
        let m;
        while ((m = re.exec(v))) spans.push([m.index, m.index + m[0].length]);
        const n = spans.length;
        const norm = (x, d) => x == null ? d : (x < 0 ? Math.max(0, n + x) : Math.min(x, n));
        let s, e;
        if (!w.colon) {
            if (w.a > 0) { s = 0; e = Math.min(w.a, n); }
            else if (w.a < 0) { s = Math.max(0, n + w.a); e = n; }
            else return '';
        } else { s = norm(w.a, 0); e = norm(w.b, n); }
        if (e <= s) return '';
        return v.slice(spans[s][0], spans[e - 1][1]);
    }

    /** Модификаторы spec к значению: минус-слова → слова → символы. */
    function mossadTplApplyMods(val, spec) {
        let v = String(val == null ? '' : val);
        if (spec.minus && spec.minus.length) v = mossadTplMinus(v, spec.minus);
        if (spec.words) v = mossadTplWords(v, spec.words);
        if (spec.chars > 0) v = v.slice(0, spec.chars);
        return v;
    }

    /** Список «через запятую» с кавычками: 'Watch Online, " - Brave", HD' → ['Watch Online', ' - Brave', 'HD']. */
    function mossadParseJunkList(text) {
        const out = [], s = String(text || '');
        const re = /\s*(?:"([^"]*)"|([^,]*))\s*(?:,|$)/g;
        let m;
        while (re.lastIndex < s.length && (m = re.exec(s))) {
            if (m[0] === '') { re.lastIndex++; continue; }
            const w = m[1] != null ? m[1] : (m[2] || '').trim();
            if (w && !out.includes(w)) out.push(w);
        }
        return out;
    }
    // v1.3.74: минус-слова сайта (всегда убираются из {title} и {desc}): GM `mossad_junk_<домен>` (общий для контейнеров), копия в localStorage
    const MOSSAD_JUNK_KEY = 'mossad_junk_' + rootDomain;
    function mossadJunkText() {
        let v = null;
        try { if (typeof GM_getValue === 'function') v = GM_getValue(MOSSAD_JUNK_KEY, null); } catch (e) {}
        if (v == null) { try { v = localStorage.getItem(MOSSAD_JUNK_KEY); } catch (e) {} }
        return v == null ? '' : String(v);
    }
    function mossadSetJunkText(v) {
        const x = String(v == null ? '' : v);
        try { if (typeof GM_setValue === 'function') GM_setValue(MOSSAD_JUNK_KEY, x); } catch (e) {}
        try { localStorage.setItem(MOSSAD_JUNK_KEY, x); } catch (e) {}
        document.querySelectorAll('#mossad-gen-junk, [data-th="junk"]').forEach(el => { if (el.value !== x && el !== document.activeElement) el.value = x; });
    }
    window.mossadSetJunkText = mossadSetJunkText;

    /** Шаблон по умолчанию для текущего сайта (серый плейсхолдер; пустое поле = он). */
    function getDefaultFilenameTemplate() {
        if (rootDomain === 'grok.com') return MOSSAD_DEFAULT_TPL_GROK;
        if (rootDomain.includes('huggingface') || rootDomain.includes('hf.space')) return '{hf}-{space}-{subtype}-{id8}.{ext}';
        return MOSSAD_DEFAULT_TPL;
    }
    window.getDefaultFilenameTemplate = getDefaultFilenameTemplate;

    /** Сайт одним словом (метка второго уровня): pinterest.com → pinterest, ru.pinterest.com → pinterest, vk.video → vk. */
    function mossadDomainWord(root) {
        const parts = String(root || '').toLowerCase().split('.').filter(Boolean);
        return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '');
    }
    /** Текст для имени файла под Windows: без \ / : * ? " < > | и управляющих, пробелы схлопнуты, без точек/пробелов в конце. */
    function mossadSafeNamePart(s) {
        return String(s == null ? '' : s)
            .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/[.\s]+$/, '');
    }

    /**
     * v1.3.53: ОДИН словарь тегов для настоящего скачивания и для окна «?» (раньше — две копии: router.js и
     * grok/download.js, и они расходились). ctx: { postId, convId, type ('video'|'photo'), ext, authorName,
     * title, desc, account, dblSuffix, rootBase, now }.
     */
    function buildFilenameVars(ctx = {}) {
        const now = ctx.now instanceof Date ? ctx.now : new Date();
        const p2 = (n) => String(n).padStart(2, '0');
        const postId = String(ctx.postId || '');
        const shortId = postId.replace(/^grok-video-/, '').slice(0, 8);
        const ext = ctx.ext || (ctx.type === 'video' ? 'mp4' : 'jpg');
        const titleRaw = ctx.title != null ? ctx.title : (document.title || '');
        const junk = mossadParseJunkList(ctx.junk != null ? ctx.junk : mossadJunkText()); // v1.3.74: минус-слова сайта
        return {
            id:         postId,
            conv:       String(ctx.convId || ''),
            hf:         'HF',
            space:      (ctx.spaceName || (window.MOSSAD_ENGINES?.huggingface?.getSpaceMetadata && window.MOSSAD_ENGINES.huggingface.getSpaceMetadata().space) || ''),
            subtype:    (ctx.subtype || (window.MOSSAD_ENGINES?.huggingface?.getSpaceMetadata && window.MOSSAD_ENGINES.huggingface.getSpaceMetadata().subtype) || ''),
            model:      (ctx.subtype || (window.MOSSAD_ENGINES?.huggingface?.getSpaceMetadata && window.MOSSAD_ENGINES.huggingface.getSpaceMetadata().subtype) || ''),
            mediatype:  ctx.type || '',
            domain:     mossadDomainWord(rootDomain),
            domainfull: rootDomain.replace(/[^a-z0-9._-]/gi, '_'),
            account:    String(ctx.account || '').trim(),
            username:   String(ctx.authorName || '') || shortId,
            desc:       mossadSafeNamePart(junk.length ? mossadTplMinus(ctx.desc || '', junk) : (ctx.desc || '')),
            title:      mossadSafeNamePart(junk.length ? mossadTplMinus(titleRaw, junk) : titleRaw) || `media_${now.getTime()}`,
            date:       `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${String(now.getFullYear()).slice(-2)}`,
            time:       `${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`,
            ext,
            n:          String(now.getTime()).slice(-6),
            dbl:        ctx.dblSuffix || '',
            oldname:    ctx.rootBase || '',
        };
    }
    window.buildFilenameVars = buildFilenameVars;

    /** Значение тега по имени из шаблона (с синонимами) или undefined, если тег неизвестен. */
    function mossadTplValue(vars, name) {
        const key = MOSSAD_TPL_ALIAS[String(name).toLowerCase()];
        if (key && key in vars) return vars[key] != null ? String(vars[key]) : '';
        const raw = String(name).toLowerCase();
        if (raw in vars) return vars[raw] != null ? String(vars[raw]) : '';
        return undefined;
    }
    /** v1.3.74: значение одного тега (кусок из mossadTplScan) → { val, err }. err — неизвестный тег / ошибка синтаксиса. */
    function mossadTplEvalTag(inner, vars, cache) {
        const spec = mossadTplParse(inner);
        if (spec.err) return { val: '', err: spec.err };
        const base = mossadTplEvalBase(spec, vars, cache || {});
        if (base.err) return { val: '', err: base.err };
        return { val: mossadTplApplyMods(base.val, spec), err: '' };
    }
    /** Значение тега без модификаторов. raw — без mossadSafeNamePart (для источника регулярки). */
    function mossadTplEvalBase(spec, vars, cache, raw) {
        if (spec.kind === 'var') {
            const v = mossadTplValue(vars, spec.name);
            return v === undefined ? { val: '', err: 'неизвестный тег' } : { val: v, err: '' };
        }
        const doc = cache.doc || document;
        let v = '';
        if (spec.kind === 'meta') v = mossadPageMeta(spec.key, doc);
        else if (spec.kind === 'ld') v = mossadPageLd(spec.key, doc, cache);
        else if (spec.kind === 'css') {
            let el = null;
            try { el = doc.querySelector(spec.key); } catch (e) { return { val: '', err: 'ошибка в CSS-селекторе' }; }
            if (el) v = spec.attr ? (el.getAttribute(spec.attr) || '')
                : ((el.textContent || '').trim() || el.getAttribute('content') || el.value || el.getAttribute('alt') || el.getAttribute('title') || '');
        } else if (spec.kind === 're') {
            const src = mossadTplEvalBase(spec.src, vars, cache, true);
            if (src.err) return src;
            const m = spec.re.exec(mossadTplApplyMods(src.val, spec.src));
            if (m) v = spec.repl == null ? (m[1] != null ? m[1] : m[0])
                : spec.repl.replace(/\$(\$|&|\d)/g, (x, c) => c === '$' ? '$' : c === '&' ? m[0] : (m[+c] || ''));
        }
        v = String(v == null ? '' : v);
        return { val: raw ? v : mossadSafeNamePart(v), err: '' };
    }

    // ── v1.3.75: теги со страницы ──
    /** <meta property|name|itemprop="key" content> (регистр имени не важен). */
    function mossadPageMeta(key, doc) {
        const k = String(key).toLowerCase();
        for (const el of (doc || document).querySelectorAll('meta[content]')) {
            const n = el.getAttribute('property') || el.getAttribute('name') || el.getAttribute('itemprop') || '';
            if (n.toLowerCase() === k) return el.getAttribute('content') || '';
        }
        return '';
    }
    const MOSSAD_LD_MEDIA = /^(VideoObject|ImageObject|MediaObject|AudioObject|Movie|Clip|Episode)$/i;
    /** Объекты из <script type="application/ld+json"> (массивы и @graph раскрыты); первым — VideoObject/ImageObject/MediaObject. */
    function mossadPageLdNodes(doc, cache) {
        if (cache && cache.ld) return cache.ld;
        const nodes = [];
        const add = (o) => {
            if (Array.isArray(o)) { o.forEach(add); return; }
            if (!o || typeof o !== 'object') return;
            nodes.push(o);
            if (Array.isArray(o['@graph'])) o['@graph'].forEach(add);
        };
        for (const sc of (doc || document).querySelectorAll('script[type="application/ld+json"]')) {
            try { add(JSON.parse(sc.textContent || '')); } catch (e) {}
        }
        const isMedia = (o) => [].concat(o['@type'] || []).some(t => MOSSAD_LD_MEDIA.test(String(t)));
        const out = nodes.filter(isMedia).concat(nodes.filter(o => !isMedia(o)));
        if (cache) cache.ld = out;
        return out;
    }
    /** Значение по пути «author.name» / «thumbnailUrl.0»: массив без номера — первый элемент, объект — его name / @id / url. */
    function _ldGet(o, path) {
        let cur = o;
        for (const part of path.split('.')) {
            if (cur == null) return undefined;
            if (Array.isArray(cur) && !/^\d+$/.test(part)) cur = cur[0];
            if (cur == null || typeof cur !== 'object') return undefined;
            cur = cur[part];
        }
        if (Array.isArray(cur)) cur = cur[0];
        if (cur && typeof cur === 'object') cur = cur.name || cur['@id'] || cur.url;
        return cur == null || typeof cur === 'object' ? undefined : cur;
    }
    function mossadPageLd(path, doc, cache) {
        for (const o of mossadPageLdNodes(doc, cache)) {
            const v = _ldGet(o, path);
            if (v !== undefined && v !== '') return String(v);
        }
        return '';
    }
    /** Для окна «?»: что есть на странице — meta [[имя, значение]] и ld+json [[путь, значение]]. */
    function mossadPageTagCatalog(doc) {
        const d = doc || document, meta = [], ld = [], seen = new Set();
        for (const el of d.querySelectorAll('meta[content]')) {
            const n = el.getAttribute('property') || el.getAttribute('name') || el.getAttribute('itemprop');
            if (!n || seen.has(n.toLowerCase())) continue;
            seen.add(n.toLowerCase());
            meta.push([n, el.getAttribute('content') || '']);
            if (meta.length >= 80) break;
        }
        const lseen = new Set();
        const walk = (o, pre, depth) => {
            if (ld.length >= 120 || depth > 4 || o == null) return;
            if (Array.isArray(o)) { o.slice(0, 3).forEach((x, i) => walk(x, pre ? `${pre}.${i}` : String(i), depth + 1)); return; }
            if (typeof o === 'object') {
                for (const k of Object.keys(o)) { if (k === '@context' || k === '@graph') continue; walk(o[k], pre ? `${pre}.${k}` : k, depth + 1); }
                return;
            }
            if (!pre || lseen.has(pre)) return;
            lseen.add(pre);
            ld.push([pre, String(o)]);
        };
        mossadPageLdNodes(d, null).forEach(o => walk(o, '', 0));
        return { meta, ld };
    }
    window.mossadPageTagCatalog = mossadPageTagCatalog;
    /** Проблемные теги шаблона: [{ raw: '{foo}', err: 'неизвестный тег' }] (повторы — один раз). */
    function mossadTemplateTagIssues(tpl, vars) {
        const out = [], cache = {};
        const vv = vars || buildFilenameVars({});
        for (const p of mossadTplScan(tpl)) {
            if (p.raw == null || out.some(x => x.raw === p.raw)) continue;
            const r = mossadTplEvalTag(p.inner, vv, cache);
            if (r.err) out.push({ raw: p.raw, err: r.err });
        }
        return out;
    }
    /** Неизвестные / ошибочные теги шаблона (как написаны: '{RadugaStud}'). */
    function mossadTemplateUnknownTags(tpl, vars) {
        return mossadTemplateTagIssues(tpl, vars).map(x => x.raw);
    }

    /**
     * Имя файла по шаблону. {tag}, {tagN}, {tag[N]} — первые N символов; v1.3.74: модификаторы --минус, [[слова]] (mossadTplParse). Неизвестный тег → пусто
     * (решение v1.3.53: в имени — пропадает, в окне «?» — показывается красным с предупреждением).
     * Расширение: добавляется, если имя не оканчивается на известное медиа-расширение (v1.3.53; раньше
     * любая точка в имени — например pinterest.com — отменяла расширение).
     */
    function renderFilenameTemplate(rawTpl, vars, isDup = false, dblSuffix = '', defaultExt = 'mp4') {
        const tplStr = (rawTpl && rawTpl.trim()) ? rawTpl.trim() : getDefaultFilenameTemplate();
        const hasDblVar = /\{dbl\}/i.test(tplStr);

        const cache = {};
        let filename = mossadTplScan(tplStr).map(p => p.raw == null ? p.text : mossadTplEvalTag(p.inner, vars, cache).val).join('').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');

        // Висячие разделители при пустых тегах (например, нет conv / account)
        filename = filename
            .replace(/-{2,}/g, '-')
            .replace(/_{2,}/g, '_')
            .replace(/~{2,}/g, '~')
            .replace(/^[-_~\s]+/, '')
            .replace(/[-_~\s]+(?=\.[a-zA-Z0-9]+$)/, '')
            .replace(/[-_~.\s]+$/, '');

        const ext = vars.ext || defaultExt;
        const extRe = new RegExp('\\.(' + MOSSAD_MEDIA_EXTS.join('|') + ')$', 'i');
        let base = filename, extPart = '';
        if (extRe.test(filename)) {
            const i = filename.lastIndexOf('.');
            base = filename.slice(0, i);
            extPart = filename.slice(i);
        } else {
            extPart = `.${ext}`;
        }
        if (!base) base = String(vars.id || '').slice(0, 8) || 'media';
        if (base.length > MOSSAD_NAME_MAX) base = base.slice(0, MOSSAD_NAME_MAX).replace(/[-_~.\s]+$/, '');

        if (isDup && !hasDblVar && dblSuffix) base = `${base}${dblSuffix}`;
        return `${base}${extPart}`;
    }
    window.renderFilenameTemplate = renderFilenameTemplate;

    /**
     * Асинхронно отправляет промпт в локальный Universal Prompt Vault (http://127.0.0.1:5999).
     * Работает в фоне без блокировки интерфейса и без назойливых ошибок при выключенном сервере.
     */
    function sendPromptToVault(prompt, model = '', source = '', url = '') {
        if (!prompt || !prompt.trim()) return;
        const payload = JSON.stringify({
            prompt: prompt.trim(),
            model: model || '',
            source: source || location.hostname,
            url: url || location.href
        });

        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://127.0.0.1:5999/api/save_prompt',
                    headers: { 'Content-Type': 'application/json' },
                    data: payload,
                    timeout: 3000,
                    onload: () => {},
                    onerror: () => {}
                });
            } else if (typeof fetch === 'function') {
                fetch('http://127.0.0.1:5999/api/save_prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    mode: 'cors'
                }).catch(() => {});
            }
        } catch (e) {}
    }
    window.sendPromptToVault = sendPromptToVault;

