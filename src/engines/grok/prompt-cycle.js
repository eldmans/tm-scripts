    // ============================================
    // v1.3.61: GROK — цикл фокуса «промт → фото/видео → длина/соотношение» (хоткей grokCycle, по умолчанию «\»)
    // 1-е нажатие — курсор в конец промта; 2-е — СРАЗУ переключает фото ↔ видео и ставит фокус на переключатель;
    // 3-е — фокус на длительность (видео) или соотношение сторон (фото); 4-е — снова промт.
    // Шаг определяется по тому, где сейчас фокус (щёлкнули мышью — цикл продолжается оттуда).
    // Клавиша перехватывается ВСЕГДА на grok.com, в том числе в поле промта (символ «\» не печатается).
    // Сопоставление по e.code (Backslash / IntlBackslash) — работает и в русской раскладке. ANTI_PATTERNS §40.
    // DOM Grok для длительности/соотношения — эвристики (aria-label / текст «6s», «16:9» …), см. CHANGELOG.
    // ============================================
    const _gc = { step: 0, ts: 0, lastMode: '' };
    const GC_PHOTO_RE = /^(image|images|photo|photos|picture|изображени[ея]|фото|картинк[аи])$/;
    const GC_VIDEO_RE = /^(video|videos|видео)$/;
    const GC_DUR_LABEL_RE = /duration|length|длительн|длина/;
    const GC_DUR_TEXT_RE = /^\d{1,2}\s?(s|sec|secs|seconds|с|сек)$/;
    const GC_AR_LABEL_RE = /aspect|ratio|соотнош|пропорц/;
    const GC_AR_TEXT_RE = /^\d{1,2}\s?:\s?\d{1,2}$/;
    const GC_CTRL_SEL = 'button, [role="button"], [role="radio"], [role="tab"], [role="option"], [role="menuitemradio"], [role="combobox"], [aria-pressed], [aria-haspopup], select';

    function _gcOwn(el) { return !!(el && el.closest && el.closest('[id^="mossad"]')); }
    function _gcVisible(el) {
        if (!el || !el.isConnected || _gcOwn(el)) return false;
        if (el.closest('[hidden], [aria-hidden="true"]')) return false;
        return el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0);
    }
    function _gcLabel(el) { return String((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title'))) || '').trim().toLowerCase(); }
    function _gcText(el) { const t = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase(); return t.length <= 24 ? t : ''; }
    function _gcIsOn(el) {
        const a = (n) => el.getAttribute(n);
        return a('aria-checked') === 'true' || a('aria-selected') === 'true' || a('aria-pressed') === 'true' ||
            ['on', 'checked', 'active'].includes(a('data-state')) || a('data-selected') === 'true' || a('data-active') === 'true';
    }
    function _gcControls() { return Array.from(document.querySelectorAll(GC_CTRL_SEL)).filter(_gcVisible); }

    /** Поле промта Grok (textarea / contenteditable), не из UI MOSSAD. */
    function grokFindPromptInput() {
        const all = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]'))
            .filter(el => _gcVisible(el) && !(el.parentElement && el.parentElement.closest('[contenteditable="true"], [contenteditable=""]')));
        const re = /imagine|prompt|промт|промпт|опиши|describe|ask|спрос|type|введите/;
        return all.find(el => re.test(String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '').toLowerCase())) || all[0] || null;
    }

    /** Переключатель режима: { photo, video, mode: 'photo'|'video'|'', trigger } (trigger — выпадающее меню вместо пары кнопок). */
    function grokFindModeSwitch() {
        const ctrls = _gcControls();
        const word = (el) => { const l = _gcLabel(el), t = _gcText(el); return (GC_VIDEO_RE.test(l) || GC_VIDEO_RE.test(t)) ? 'video' : (GC_PHOTO_RE.test(l) || GC_PHOTO_RE.test(t)) ? 'photo' : ''; };
        const vids = ctrls.filter(el => word(el) === 'video' && !el.getAttribute('aria-haspopup'));
        const phs = ctrls.filter(el => word(el) === 'photo' && !el.getAttribute('aria-haspopup'));
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
        const trig = ctrls.find(el => el.getAttribute('aria-haspopup') && word(el));
        if (trig) return { photo: null, video: null, mode: word(trig), trigger: trig };
        return null;
    }
    function _gcParamControl(kind) {
        const labelRe = kind === 'duration' ? GC_DUR_LABEL_RE : GC_AR_LABEL_RE;
        const textRe = kind === 'duration' ? GC_DUR_TEXT_RE : GC_AR_TEXT_RE;
        const ctrls = _gcControls();
        const byLabel = ctrls.filter(el => labelRe.test(_gcLabel(el)));
        const byText = ctrls.filter(el => textRe.test(_gcText(el)) || textRe.test(_gcLabel(el)));
        const pool = byLabel.length ? byLabel : byText;
        if (!pool.length) return null;
        return pool.find(_gcIsOn) || pool[0];
    }
    function grokFindDurationControl() { return _gcParamControl('duration'); }
    function grokFindAspectControl() { return _gcParamControl('aspect'); }

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
        const prompt = grokFindPromptInput();
        if (prompt && (prompt === ae || prompt.contains(ae))) return 'prompt';
        const ms = grokFindModeSwitch();
        if (ms && [ms.photo, ms.video, ms.trigger].some(x => x && (x === ae || x.contains(ae)))) return 'mode';
        if (ms && ms.photo && ms.video && ae.getAttribute && ae.getAttribute('role') === 'radiogroup' && ae.contains(ms.video)) return 'mode';
        const d = grokFindDurationControl(), a = grokFindAspectControl();
        if ([d, a].some(x => x && (x === ae || x.contains(ae)))) return 'param';
        if (ae.getAttribute && /^(radio|menuitemradio|option)$/.test(ae.getAttribute('role') || '')) {
            const t = _gcText(ae) || _gcLabel(ae);
            if (GC_DUR_TEXT_RE.test(t) || GC_AR_TEXT_RE.test(t)) return 'param';
        }
        return '';
    }
    /** Какой шаг (1..3) сделать по этому нажатию. */
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

    function _gcStepPrompt() {
        const p = grokFindPromptInput();
        if (!p) { showToast('⚠️ Поле промта не найдено', true); mossadDebug('grokCycle', 'промт не найден'); return false; }
        _gcCaretToEnd(p);
        mossadDebug('grokCycle', 'шаг 1: промт', { tag: p.tagName });
        return true;
    }
    async function _gcStepMode() {
        const ms = grokFindModeSwitch();
        if (!ms) {
            showToast('⚠️ Переключатель фото/видео не найден', true);
            console.warn('[MOSSAD] grokCycle: переключатель фото/видео не найден. Кандидаты:', _gcControls().slice(0, 40).map(el => `${el.tagName}[${el.getAttribute('role') || ''}] «${_gcLabel(el) || _gcText(el)}»`));
            return false;
        }
        const cur = ms.mode || _gc.lastMode || 'photo';
        const want = cur === 'video' ? 'photo' : 'video';
        if (ms.trigger) {
            // Меню: открыть и выбрать другой режим
            mossadPressEl(ms.trigger);
            const re = want === 'video' ? GC_VIDEO_RE : GC_PHOTO_RE;
            const item = await waitForCondition(() => Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], [data-radix-collection-item]'))
                .find(el => _gcVisible(el) && (re.test(_gcText(el)) || re.test(_gcLabel(el)))), 800, 40);
            if (!item) { showToast('⚠️ Пункт режима в меню не найден', true); mossadDebug('grokCycle', 'меню режима: пункт не найден', { want }); return false; }
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
        const ms = grokFindModeSwitch();
        const mode = (ms && ms.mode) || _gc.lastMode || (grokFindDurationControl() ? 'video' : 'photo');
        const el = mode === 'video' ? grokFindDurationControl() : grokFindAspectControl();
        if (!el) {
            showToast(mode === 'video' ? '⚠️ Длительность видео не найдена' : '⚠️ Соотношение сторон не найдено', true);
            console.warn(`[MOSSAD] grokCycle: ${mode === 'video' ? 'длительность' : 'соотношение сторон'} не найдено. Кандидаты:`, _gcControls().slice(0, 40).map(x => `${x.tagName}[${x.getAttribute('role') || ''}] «${_gcLabel(x) || _gcText(x)}»`));
            return false;
        }
        _gcFocus(el);
        mossadDebug('grokCycle', 'шаг 3: ' + (mode === 'video' ? 'длительность' : 'соотношение'), { tag: el.tagName, label: _gcLabel(el) || _gcText(el) });
        return true;
    }
    /** Одно нажатие цикла. */
    function grokCycleFocus() {
        const step = grokCycleNextStep();
        _gc.step = step; _gc.ts = Date.now();
        if (step === 1) return _gcStepPrompt();
        if (step === 2) { _gcStepMode(); return true; }
        return _gcStepParam();
    }

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
