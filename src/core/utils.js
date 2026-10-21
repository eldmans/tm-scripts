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

    /**
     * Выполняет пост-действие после фактического скачивания (+1 или del).
     * Срабатывает ТОЛЬКО когда скачивание реально началось, а не при блокировке дубликата.
     */
    function performPostDownloadAction() {
        if (!config || config.pdAction === 'none') return;
        if (config.pdAction === 'up') {
            setTimeout(() => {
                const dirs = config.slideshowDirections;
                const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                performDpadStep(dPadDir, false);
            }, 600);
        } else if (config.pdAction === 'del' && rootDomain === 'grok.com') {
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

    /**
     * Возвращает дефолтный шаблон имени файла для текущего сайта (отображается серым плейсхолдером)
     */
    function getDefaultFilenameTemplate() {
        // v1.3.36: единый шаблон по умолчанию для всех сайтов (эталон владельца, см. DEFAULT_CONFIG).
        // Раньше: RedGifs — {userName}-{domain[4]}, Grok — {conv4}-{id4}-{domain}.{ext}, прочие — {id8}-{domain}.{ext}.
        return DEFAULT_CONFIG.filenameTemplate;
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
            : (getDefaultFilenameTemplate());

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

