    // ============================================
    // v1.3.61: GROK — цикл фокуса «промт → фото/видео → длина/соотношение» (хоткей grokCycle, по умолчанию «\»)
    // 1-е нажатие — курсор в конец промта; 2-е — СРАЗУ переключает фото ↔ видео и ставит фокус на переключатель;
    // 3-е — фокус на длительность (видео) или соотношение сторон (фото); 4-е — снова промт.
    // Шаг определяется по тому, где сейчас фокус (щёлкнули мышью — цикл продолжается оттуда).
    // Клавиша перехватывается ВСЕГДА на grok.com, в том числе в поле промта (символ «\» не печатается).
    // Сопоставление по e.code (Backslash / IntlBackslash) — работает и в русской раскладке. ANTI_PATTERNS §40.
    // DOM Grok для длительности/соотношения — эвристики (aria-label / текст «6s», «16:9» …), см. CHANGELOG.
    // v1.3.69: поиск режима/длительности/соотношения — ТОЛЬКО внутри композера промта (боковые панели исключены:
    // там соотношение сразу запускает перегенерацию); нет цели шага — тихо к следующему доступному шагу;
    // открытое меню мешает найти промт — Escape/blur и повтор. Стрелки ↑/↓ в длительности/соотношении не листают
    // посты. ANTI_PATTERNS §47.
    // ============================================
    const _gc = { step: 0, ts: 0, lastMode: '', modeNA: '' };
    const GC_PHOTO_RE = /^(image|images|photo|photos|picture|изображени[ея]|фото|картинк[аи])$/;
    const GC_VIDEO_RE = /^(video|videos|видео)$/;
    const GC_DUR_LABEL_RE = /duration|length|длительн|длина/;
    const GC_DUR_TEXT_RE = /^\d{1,2}\s?(s|sec|secs|seconds|с|сек)$/;
    const GC_AR_LABEL_RE = /aspect|ratio|соотнош|пропорц/;
    const GC_AR_TEXT_RE = /^\d{1,2}\s?:\s?\d{1,2}$/;
    const GC_CTRL_SEL = 'button, [role="button"], [role="radio"], [role="tab"], [role="option"], [role="menuitemradio"], [role="combobox"], [aria-pressed], [aria-haspopup], select';
    // Боковые панели / выезжающие ящики / модальные окна — не композер
    const GC_PANEL_SEL = '[role="dialog"], [role="alertdialog"], [role="complementary"], aside';
    const GC_POPOVER_SEL = '[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"], [role="dialog"][data-state="open"]';
    const GC_ITEM_SEL = '[role="option"], [role="menuitemradio"], [role="menuitem"]';

    function _gcOwn(el) { return !!(el && el.closest && el.closest('[id^="mossad"]')); }
    function _gcShown(el) { return !!(el && el.isConnected && !_gcOwn(el) && (el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0))); }
    function _gcVisible(el) {
        if (!_gcShown(el)) return false;
        return !el.closest('[hidden], [aria-hidden="true"]');
    }
    function _gcUsable(el) { return !!el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('data-disabled'); }
    function _gcLabel(el) { return String((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || '').trim().toLowerCase(); }
    function _gcText(el) { const t = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); return t.length <= 24 ? t : ''; }
    function _gcIsOn(el) {
        const a = (n) => el.getAttribute(n);
        return a('aria-checked') === 'true' || a('aria-selected') === 'true' || a('aria-pressed') === 'true' ||
            ['on', 'checked', 'active'].includes(a('data-state')) || a('data-selected') === 'true' || a('data-active') === 'true';
    }

    /** Поле промта Grok (textarea / contenteditable), не из UI MOSSAD. lenient — и под aria-hidden (открыто модальное меню). */
    function grokFindPromptInput(lenient) {
        const all = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'))
            .filter(el => (lenient ? _gcShown(el) : _gcVisible(el)) && !(el.parentElement && el.parentElement.closest('[contenteditable="true"], [contenteditable=""]')));
        const re = /imagine|prompt|промт|промпт|опиши|describe|ask|спрос|type|введите/;
        return all.find(el => re.test(String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '').toLowerCase())) || all[0] || null;
    }
    function _gcRect(el) { try { const r = el.getBoundingClientRect(); return r && (r.width > 0 || r.height > 0) ? r : null; } catch (e) { return null; } }
    /** В el есть боковая панель / ящик, НЕ содержащая промт. */
    function _gcHasPanel(el, prompt) { return Array.from(el.querySelectorAll(GC_PANEL_SEL)).some(p => !p.contains(prompt)); }
    /**
     * v1.3.69: композер промта — ближайшая форма, иначе предок промта не выше 6 уровней; подъём останавливается
     * перед <main>/<body>, перед предком с боковой панелью, другим полем ввода или высотой > 60% окна.
     */
    function grokFindComposer(prompt) {
        prompt = prompt || grokFindPromptInput(true);
        if (!prompt) return null;
        const form = prompt.closest('form');
        if (form && !_gcHasPanel(form, prompt)) return form;
        let best = prompt.parentElement || null;
        let el = best;
        for (let i = 0; i < 6 && el && el !== document.body && el !== document.documentElement; i++) {
            if (el.tagName === 'MAIN' || _gcHasPanel(el, prompt)) break;
            if (Array.from(el.querySelectorAll('textarea, [contenteditable="true"]')).some(x => x !== prompt && !prompt.contains(x) && !_gcOwn(x))) break;
            const r = _gcRect(el);
            if (r && window.innerHeight && r.height > window.innerHeight * 0.6) break;
            best = el;
            el = el.parentElement;
        }
        return best;
    }
    /** Элементы управления композера (без боковых панелей и того, что прижато к правому краю правее промта). */
    function _gcControls(root) {
        if (!root) return [];
        const prompt = grokFindPromptInput(true);
        const pr = prompt && _gcRect(prompt);
        return Array.from(root.querySelectorAll(GC_CTRL_SEL)).filter(el => {
            if (!_gcVisible(el)) return false;
            const panel = el.closest(GC_PANEL_SEL);
            if (panel && root.contains(panel) && panel !== root && !(prompt && panel.contains(prompt))) return false;
            const r = pr && _gcRect(el);
            if (r && window.innerWidth && r.left > window.innerWidth * 0.7 && r.left > pr.right + 80) return false;
            return true;
        });
    }

    /**
     * Переключатель режима в композере: { photo, video, mode, trigger } или null.
     * Пункт «бот» (и любые кроме фото/видео) не выбирается никогда. Только одна пригодная кнопка (видео) — null.
     */
    function grokFindModeSwitch(root) {
        const ctrls = _gcControls(root === undefined ? grokFindComposer() : root);
        const word = (el) => { const l = _gcLabel(el), t = _gcText(el); return (GC_VIDEO_RE.test(l) || GC_VIDEO_RE.test(t)) ? 'video' : (GC_PHOTO_RE.test(l) || GC_PHOTO_RE.test(t)) ? 'photo' : ''; };
        const vids = ctrls.filter(el => word(el) === 'video' && !el.getAttribute('aria-haspopup') && _gcUsable(el));
        const phs = ctrls.filter(el => word(el) === 'photo' && !el.getAttribute('aria-haspopup') && _gcUsable(el));
        for (const v of vids) {
            for (const up of [v.parentElement, v.parentElement && v.parentElement.parentElement]) {
                const p = up && phs.find(x => up.contains(x));
                if (p) {
                    const mode = _gcIsOn(v) ? 'video' : _gcIsOn(p) ? 'photo' : '';
                    return { photo: p, video: v, mode, trigger: null };
                }
            }
        }
        // Выпадающее меню: кнопка с aria-haspopup, на которой написан текущий режим
        const trig = ctrls.find(el => el.getAttribute('aria-haspopup') && word(el) && _gcUsable(el));
        if (trig) return { photo: null, video: null, mode: word(trig), trigger: trig };
        return null;
    }
    function _gcParamControl(kind, root) {
        const labelRe = kind === 'duration' ? GC_DUR_LABEL_RE : GC_AR_LABEL_RE;
        const textRe = kind === 'duration' ? GC_DUR_TEXT_RE : GC_AR_TEXT_RE;
        const ctrls = _gcControls(root === undefined ? grokFindComposer() : root);
        const byLabel = ctrls.filter(el => labelRe.test(_gcLabel(el)) || (el.parentElement && el.parentElement.getAttribute('role') === 'radiogroup' && labelRe.test(_gcLabel(el.parentElement))));
        const byText = ctrls.filter(el => textRe.test(_gcText(el)) || textRe.test(_gcLabel(el)));
        const pool = byLabel.length ? byLabel : byText;
        if (!pool.length) return null;
        return pool.find(_gcIsOn) || pool[0];
    }
    function grokFindDurationControl(root) { return _gcParamControl('duration', root); }
    function grokFindAspectControl(root) { return _gcParamControl('aspect', root); }

    function _gcFocus(el) {
        if (!el) return false;
        try { el.focus({ preventScroll: true, focusVisible: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
        return document.activeElement === el || (el.contains && el.contains(document.activeElement));
    }
    function _gcCaretToEnd(el) {
        _gcFocus(el);
        try {
            if (typeof el.value === 'string' && el.setSelectionRange) { const n = el.value.length; el.setSelectionRange(n, n); return; }
            const sel = window.getSelection && window.getSelection();
            if (sel) { const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg); }
        } catch (e) {}
    }

    /** Где сейчас фокус: 'prompt' | 'mode' | 'param' | ''. */
    function grokCycleWhere() {
        const ae = document.activeElement;
        if (!ae || ae === document.body || ae === document.documentElement) return '';
        const prompt = grokFindPromptInput(true);
        if (prompt && (prompt === ae || prompt.contains(ae))) return 'prompt';
        const comp = grokFindComposer(prompt);
        const ms = comp && grokFindModeSwitch(comp);
        if (ms && [ms.photo, ms.video, ms.trigger].some(x => x && (x === ae || x.contains(ae)))) return 'mode';
        if (ms && ms.photo && ms.video && ae.getAttribute && ae.getAttribute('role') === 'radiogroup' && ae.contains(ms.video)) return 'mode';
        const d = comp && grokFindDurationControl(comp), a = comp && grokFindAspectControl(comp);
        if ([d, a].some(x => x && (x === ae || x.contains(ae) || (x.parentElement && x.parentElement.getAttribute('role') === 'radiogroup' && x.parentElement.contains(ae))))) return 'param';
        if (ae.getAttribute && /^(radio|menuitemradio|option|menuitem)$/.test(ae.getAttribute('role') || '')) {
            const t = _gcText(ae) || _gcLabel(ae);
            if (GC_DUR_TEXT_RE.test(t) || GC_AR_TEXT_RE.test(t)) return 'param';
        }
        return '';
    }
    /** Какой шаг (1..3) пробовать первым по этому нажатию. */
    function grokCycleNextStep() {
        const where = grokCycleWhere();
        if (where === 'prompt') return 2;
        if (where === 'mode') return 3;
        if (where === 'param') return 1;
        const ae = document.activeElement;
        const idle = !ae || ae === document.body || ae === document.documentElement;
        // Фокус «потерялся» после перерисовки Grok (только что переключили) — продолжаем по счётчику
        if (idle && _gc.step && Date.now() - _gc.ts < 15000) return (_gc.step % 3) + 1;
        return 1;
    }

    function _gcOpenPopover() {
        const prompt = grokFindPromptInput(true);
        return Array.from(document.querySelectorAll(GC_POPOVER_SEL)).find(el => el.isConnected && !_gcOwn(el) && !(prompt && el.contains(prompt)) && _gcShown(el)) || null;
    }
    function _gcEsc(t) { try { t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true })); } catch (e) {} }
    /** v1.3.69: промт не виден из-за открытого меню/поповера — Escape по нему (или blur) и ждём промт. */
    async function _gcEnsurePromptReachable() {
        if (grokFindPromptInput()) return true;
        const pop = _gcOpenPopover();
        const ae = document.activeElement;
        const inPop = !!(pop && ae && pop.contains(ae));
        if (!pop && !(ae && ae.getAttribute && /^(option|menuitem|menuitemradio)$/.test(ae.getAttribute('role') || ''))) return false;
        if (pop) _gcEsc(inPop ? ae : pop);
        if (ae && ae !== document.body && typeof ae.blur === 'function') { try { ae.blur(); } catch (e) {} }
        const ok = await waitForCondition(() => grokFindPromptInput(), 400, 40);
        mossadDebug('grokCycle', 'закрыто меню, промт ' + (ok ? 'найден' : 'не найден'), { popover: !!pop });
        return !!ok;
    }

    function _gcStepPrompt() {
        const p = grokFindPromptInput();
        if (!p) { mossadDebug('grokCycle', 'шаг 1: промт не найден — пропуск'); return false; }
        _gcCaretToEnd(p);
        mossadDebug('grokCycle', 'шаг 1: промт', { tag: p.tagName });
        return true;
    }
    async function _gcStepMode() {
        const comp = grokFindComposer(grokFindPromptInput());
        const ms = comp && grokFindModeSwitch(comp);
        if (!ms) { mossadDebug('grokCycle', 'шаг 2: переключателя фото/видео нет — пропуск', { composer: !!comp }); return false; }
        if (ms.trigger && _gc.modeNA === location.pathname) { mossadDebug('grokCycle', 'шаг 2: в меню режима здесь нет второго режима — пропуск'); return false; }
        const cur = ms.mode || _gc.lastMode || 'photo';
        const want = cur === 'video' ? 'photo' : 'video';
        if (ms.trigger) {
            // Меню: открыть и выбрать другой режим (только фото/видео — «бот» и прочее не выбираются)
            mossadPressEl(ms.trigger);
            const re = want === 'video' ? GC_VIDEO_RE : GC_PHOTO_RE;
            const item = await waitForCondition(() => Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], [data-radix-collection-item]'))
                .find(el => _gcVisible(el) && _gcUsable(el) && (re.test(_gcText(el)) || re.test(_gcLabel(el)))), 800, 40);
            if (!item) {
                const pop = _gcOpenPopover();
                if (pop) _gcEsc(document.activeElement && pop.contains(document.activeElement) ? document.activeElement : pop);
                _gc.modeNA = location.pathname;
                mossadDebug('grokCycle', 'шаг 2: в меню нет режима «' + want + '» — пропуск', {});
                return false;
            }
            mossadPressEl(item);
            setTimeout(() => { const t = grokFindModeSwitch(); _gcFocus((t && (t.trigger || t[want])) || ms.trigger); }, 60);
        } else {
            const target = ms[want];
            mossadPressEl(target);
            _gcFocus(target);
            // React может перерисовать кнопки — вернуть фокус на свежий элемент
            setTimeout(() => {
                if (grokCycleWhere() === 'mode') return;
                const t = grokFindModeSwitch();
                if (t && t[want]) _gcFocus(t[want]);
            }, 60);
        }
        _gc.lastMode = want;
        showToast(want === 'video' ? '🎬 Видео' : '🖼 Фото');
        mossadDebug('grokCycle', 'шаг 2: режим', { from: ms.mode || '?', to: want, menu: !!ms.trigger });
        return true;
    }
    function _gcStepParam() {
        const comp = grokFindComposer(grokFindPromptInput());
        if (!comp) { mossadDebug('grokCycle', 'шаг 3: композер не найден — пропуск'); return false; }
        const ms = grokFindModeSwitch(comp);
        const d = grokFindDurationControl(comp), a = grokFindAspectControl(comp);
        const mode = (ms && ms.mode) || _gc.lastMode || (d ? 'video' : 'photo');
        const el = mode === 'video' ? (d || a) : (a || d);
        if (!el) { mossadDebug('grokCycle', 'шаг 3: длительности/соотношения в композере нет — пропуск'); return false; }
        _gcFocus(el);
        mossadDebug('grokCycle', 'шаг 3: ' + (el === d ? 'длительность' : 'соотношение'), { tag: el.tagName, label: _gcLabel(el) || _gcText(el) });
        return true;
    }
    /** Одно нажатие цикла: первый подходящий шаг, недоступные — тихо пропускаются. */
    function grokCycleFocus() {
        const first = grokCycleNextStep();
        // Промт виден — без ожиданий (шаги 1/3 и пара кнопок режима выполняются синхронно)
        if (grokFindPromptInput()) return _gcRun(first);
        return _gcEnsurePromptReachable().then(() => _gcRun(first));
    }
    async function _gcRun(first) {
        for (let i = 0; i < 3; i++) {
            const step = ((first - 1 + i) % 3) + 1;
            const ok = step === 1 ? _gcStepPrompt() : step === 2 ? await _gcStepMode() : _gcStepParam();
            if (ok) { _gc.step = step; _gc.ts = Date.now(); return true; }
        }
        showToast('⚠️ Grok: не нашёл ни промт, ни фото/видео, ни длительность/соотношение', true);
        console.warn('[MOSSAD] grokCycle: ничего не найдено. Композер:', grokFindComposer(), 'кандидаты:', _gcControls(grokFindComposer()).slice(0, 40).map(el => `${el.tagName}[${el.getAttribute('role') || ''}] «${_gcLabel(el) || _gcText(el)}»`));
        return false;
    }

    // ── v1.3.69: ↑/↓ в длительности/соотношении композера не листают посты ──
    // Почему не stopPropagation на window/capture: React вешает обработчики на корень (Next.js — на document),
    // и такая остановка гасит и собственный обработчик контрола — значение не меняется. Листенер «после React»
    // на корне тоже не гарантирован (обработчик Grok может стоять на том же document). Поэтому:
    //  • нативные <select>/<input> — только stopImmediatePropagation (значение меняет действие по умолчанию);
    //  • ARIA-контролы — шаг выполняем сами (нажатие соседнего варианта / фокус соседнего пункта открытого
    //    списка / открытие меню с кнопки), затем preventDefault + stopImmediatePropagation.
    // Везде вне этих контролов стрелки не трогаются.
    function _gcIsParamList(list) {
        const items = Array.from(list.querySelectorAll(GC_ITEM_SEL));
        const n = items.filter(it => { const t = _gcText(it) || _gcLabel(it); return GC_DUR_TEXT_RE.test(t) || GC_AR_TEXT_RE.test(t); }).length;
        return n > 0 && n * 2 >= items.length;
    }
    /** Цель стрелки ↑/↓ в контроле длительности/соотношения композера, иначе null. */
    function grokComposerArrowCtl(e) {
        if (rootDomain !== 'grok.com' || !e || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return null;
        if (e.ctrlKey || e.altKey || e.metaKey) return null;
        const ae = document.activeElement;
        if (!ae || ae === document.body || ae === document.documentElement || !ae.closest || _gcOwn(ae)) return null;
        const opt = ae.closest(GC_ITEM_SEL);
        const list = (opt || ae).closest('[role="listbox"], [role="menu"]');
        if (list && _gcIsParamList(list)) return { kind: 'list', list, cur: opt };
        const comp = grokFindComposer();
        if (!comp || !comp.contains(ae)) return null;
        for (const kind of ['duration', 'aspect']) {
            const c = _gcParamControl(kind, comp);
            if (!c) continue;
            const grp = c.closest('[role="radiogroup"], [role="group"], [role="tablist"], [role="toolbar"]');
            const box = grp && comp.contains(grp) ? grp : c;
            if (box !== ae && !box.contains(ae)) continue;
            if (/^(SELECT|INPUT)$/.test(ae.tagName)) return { kind: 'native', box, cur: ae };
            if (ae === c && c.getAttribute('aria-haspopup')) return { kind: 'trigger', box, cur: c };
            return { kind: 'group', box, cur: ae, re: kind === 'duration' ? GC_DUR_TEXT_RE : GC_AR_TEXT_RE };
        }
        return null;
    }
    function _gcArrowStep(list, cur, down) {
        if (!list.length) return null;
        let i = list.indexOf(cur);
        if (i < 0) i = list.findIndex(_gcIsOn);
        if (i < 0) return list[down ? 0 : list.length - 1];
        return list[(i + (down ? 1 : -1) + list.length) % list.length];
    }
    window.addEventListener('keydown', function grokComposerArrows(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        const t = grokComposerArrowCtl(e);
        if (!t) return;
        e.__mossadGrokCtlArrow = true;
        const down = e.key === 'ArrowDown';
        if (t.kind === 'native') { e.stopImmediatePropagation(); return; }
        e.preventDefault();
        e.stopImmediatePropagation();
        if (t.kind === 'trigger') { mossadPressEl(t.cur); return; }
        if (t.kind === 'list') {
            const items = Array.from(t.list.querySelectorAll(GC_ITEM_SEL)).filter(x => _gcShown(x) && _gcUsable(x));
            const nx = _gcArrowStep(items, t.cur, down);
            if (nx) { if (!nx.hasAttribute('tabindex')) nx.setAttribute('tabindex', '-1'); _gcFocus(nx); }
            return;
        }
        let opts = Array.from(t.box.querySelectorAll('[role="radio"], [role="tab"], [role="option"], button')).filter(x => _gcShown(x) && _gcUsable(x));
        if (t.box === t.cur && t.cur.parentElement) opts = Array.from(t.cur.parentElement.querySelectorAll('button, [role="radio"], [role="tab"]')).filter(x => _gcShown(x) && _gcUsable(x) && (t.re.test(_gcText(x)) || t.re.test(_gcLabel(x))));
        const curOpt = opts.find(x => x === t.cur || x.contains(t.cur)) || null;
        const nx = _gcArrowStep(opts, curOpt, down);
        if (nx && nx !== curOpt) { mossadPressEl(nx); _gcFocus(nx); }
        mossadDebug('grokCycle', 'стрелка в ' + t.kind + ': пост не листается', { to: nx && (_gcText(nx) || _gcLabel(nx)) });
    }, true);

    // Перехват раньше сайта: window, capture; в т.ч. в поле промта (без символа «\»)
    window.addEventListener('keydown', function grokCycleKey(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        if (!config.hk || !hotkeyMatches(e, config.hk.grokCycle)) return;
        if (_gcOwn(e.target) || _gcOwn(document.activeElement)) return; // поля самого MOSSAD (тудушки, метки) — печатаем
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        grokCycleFocus();
    }, true);
