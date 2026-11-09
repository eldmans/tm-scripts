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
    const _gc = { step: 0, ts: 0, lastMode: '', modeNA: '', useClicked: false };
    const GC_PHOTO_RE = /^(image|images|photo|photos|picture|изображени[ея]|фото|картинк[аи])$/;
    const GC_VIDEO_RE = /^(video|videos|видео)$/;
    const GC_DUR_LABEL_RE = /duration|length|длительн|длина/;
    const GC_DUR_TEXT_RE = /^\d{1,2}\s?(s|sec|secs|seconds|с|сек)$/;
    const GC_AR_LABEL_RE = /aspect|ratio|соотнош|пропорц/;
    const GC_AR_TEXT_RE = /^\d{1,2}\s?:\s?\d{1,2}$/;
    const GC_CTRL_SEL = 'button, [role="button"], [role="radio"], [role="tab"], [role="option"], [role="menuitemradio"], [role="combobox"], [aria-pressed], [aria-haspopup], select';
    // Боковые панели / выезжающие ящики / модальные окна — не композер
    const GC_PANEL_SEL = '[role="dialog"], [role="alertdialog"], [role="complementary"], aside';
    const GC_POPOVER_SEL = '[data-radix-popper-content-wrapper], [data-radix-menu-content], [role="menu"], [role="listbox"], div[role="dialog"][data-state="open"], [data-state="open"][class*="popover"], [data-state="open"][class*="content"]';
    const GC_ITEM_SEL = '[role="option"], [role="menuitemradio"], [role="menuitem"], [data-radix-collection-item], button[role="radio"]';

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

    function grokIsPromptInput(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        const prompt = grokFindPromptInput(true);
        if (prompt && (prompt === el || prompt.contains(el))) return true;
        if (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.getAttribute && el.getAttribute('role') === 'textbox')) {
            const re = /imagine|prompt|промт|промпт|опиши|describe|ask|спрос|type|введите/;
            if (re.test(String(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '').toLowerCase())) {
                return true;
            }
        }
        return false;
    }
    window.grokIsPromptInput = grokIsPromptInput;
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

    /** v1.4.5: Сброс состояния цикла при перелистывании кадров */
    function grokResetCycleState() {
        _gc.step = 0;
        _gc.ts = 0;
        _gc.lastStepName = null;
        _gc.useClicked = false;
    }
    window.grokResetCycleState = grokResetCycleState;

    /** v1.4.5: Поиск кнопки/плашки "Use" (использовать текущий промпт и фото при генерации) */
    function grokFindUseButton() {
        const isFresh = (el) => !el._mossadUseClicked || (Date.now() - el._mossadUseClicked > 800);
        // 1. Поиск элементов со словом "Use" или "Использовать"
        const candidates = Array.from(document.querySelectorAll('span, button, [role="button"], div'))
            .filter(el => {
                if (!_gcShown(el) || _gcOwn(el) || !isFresh(el)) return false;
                if (el.children.length > 2) return false;
                const t = (el.textContent || '').trim();
                return /^(use|использовать)$/i.test(t);
            });

        for (const el of candidates) {
            // Плашка находится над полем ввода (.absolute.bottom-full или с классом ring-1 / surface)
            const pill = el.closest('.absolute, [class*="bottom-full"], div[class*="ring-1"], div[class*="border-border"], div[class*="surface"]');
            if (pill && _gcShown(pill)) {
                pill._mossadUseTarget = el;
                return pill;
            }
            if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || (el.classList && el.classList.contains('cursor-pointer'))) {
                return el;
            }
            if (el.parentElement && _gcShown(el.parentElement)) {
                el.parentElement._mossadUseTarget = el;
                return el.parentElement;
            }
        }

        // 2. Фолбэк: поиск плашки над полем ввода по классу bottom-full, содержащей слово Use
        const bottomPills = Array.from(document.querySelectorAll('.absolute.bottom-full, [class*="bottom-full"]'))
            .filter(el => _gcShown(el) && !_gcOwn(el));
        for (const bp of bottomPills) {
            const uSpan = Array.from(bp.querySelectorAll('span, button, div')).find(x => /^(use|использовать)$/i.test((x.textContent || '').trim()));
            if (uSpan) {
                bp._mossadUseTarget = uSpan;
                return bp;
            }
        }

        return null;
    }

    /** v1.4.5: Программный клик по кнопке Use */
    function grokClickUseButton(btn) {
        if (!btn) return false;
        btn._mossadUseClicked = Date.now();
        if (btn._mossadUseTarget) btn._mossadUseTarget._mossadUseClicked = Date.now();
        const target = btn._mossadUseTarget || btn;
        mossadPressEl(target);
        if (target !== btn) {
            mossadPressEl(btn);
        }
        try {
            if (typeof target.click === 'function') target.click();
            if (typeof btn.click === 'function') btn.click();
        } catch (e) {}
        return true;
    }

    /** v1.4.5: Определение доступных шагов цикла:
     * Строго 3 шага: 'prompt' -> 'mode' (если есть) -> 'param' -> 'prompt'.
     * Если доступна кнопка Use — шаг 1 ('prompt') нажимает её, перенося промпт и фото в поле ввода!
     */
    function grokCycleAvailableSteps() {
        const comp = grokFindComposer(grokFindPromptInput(true));
        const ms = comp ? grokFindModeSwitch(comp) : null;
        if (!ms) {
            return ['prompt', 'param'];
        }
        return ['prompt', 'mode', 'param'];
    }

    /** Где сейчас фокус: 'prompt' | 'mode' | 'param' | ''. */
    function grokCycleWhere() {
        const pop = _gcOpenPopover();
        if (pop) return 'param';

        const ae = document.activeElement;
        if (!ae) return '';
        if (grokIsPromptInput(ae)) return 'prompt';

        const comp = grokFindComposer(grokFindPromptInput(true));
        if (comp) {
            const ms = grokFindModeSwitch(comp);
            if (ms && (ms.trigger === ae || ms.photo === ae || ms.video === ae || (ae && ms.trigger && ms.trigger.contains(ae)))) return 'mode';
            const d = grokFindDurationControl(comp), a = grokFindAspectControl(comp);
            if ((d && (d === ae || d.contains(ae))) || (a && (a === ae || a.contains(ae)))) return 'param';
        }

        if (ae.getAttribute && /^(radio|menuitemradio|option|menuitem|menu|listbox)$/.test(ae.getAttribute('role') || '')) {
            const t = _gcText(ae) || _gcLabel(ae);
            if (GC_DUR_TEXT_RE.test(t) || GC_AR_TEXT_RE.test(t)) return 'param';
        }
        if (_gc.lastStepName === 'param') return 'param';
        return '';
    }

    /** Какой шаг пробовать по этому нажатию бэкслеша (строго по кругу!). */
    function grokCycleNextStep() {
        const steps = grokCycleAvailableSteps();
        const where = grokCycleWhere();
        if (where) {
            const idx = steps.indexOf(where);
            if (idx !== -1) {
                return steps[(idx + 1) % steps.length];
            }
        }
        if (_gc.lastStepName) {
            const idx = steps.indexOf(_gc.lastStepName);
            if (idx !== -1) {
                return steps[(idx + 1) % steps.length];
            }
        }
        return steps[0]; // по умолчанию prompt
    }

    function _gcOpenPopover() {
        const prompt = grokFindPromptInput(true);
        return Array.from(document.querySelectorAll(GC_POPOVER_SEL)).find(el => el.isConnected && !_gcOwn(el) && !(prompt && el.contains(prompt)) && _gcShown(el)) || null;
    }

    // ШАГ 1: Промпт (или нажатие кнопки Use, если она присутствует на фото)
    function _gcStepPrompt() {
        // Если был открыт выпадающий список параметров — подтверждаем текущий активный пункт
        const pop = _gcOpenPopover();
        if (pop) {
            const ae = document.activeElement;
            const item = (ae && pop.contains(ae)) ? ((ae.closest && ae.closest(GC_ITEM_SEL)) || ae) : null;
            if (item && item.isConnected) {
                try { mossadPressEl(item); } catch (e) {}
            }
        }

        // v1.4.5: Если на экране есть плашка "Use" и мы её ещё не нажимали на этом кадре — нажимаем её!
        // (но только если мы не завершаем цикл с шага param)
        if (!_gc.useClicked && _gc.lastStepName !== 'param') {
            const useBtn = grokFindUseButton();
            if (useBtn) {
                mossadDebug('grokCycle', 'шаг prompt: нажатие на кнопку Use');
                _gc.useClicked = true;
                grokClickUseButton(useBtn);
                showToast('✨ Use: промпт загружен');
                setTimeout(() => {
                    const p = grokFindPromptInput(true);
                    if (p) _gcCaretToEnd(p);
                }, 100);
                return true;
            }
        }

        const p = grokFindPromptInput(true);
        if (!p) {
            mossadDebug('grokCycle', 'шаг prompt: инпут не найден');
            return false;
        }
        _gcCaretToEnd(p);
        // Страховка от автофокуса Radix при закрытии поповера
        setTimeout(() => { const p2 = grokFindPromptInput(true); if (p2) _gcCaretToEnd(p2); }, 60);
        setTimeout(() => { const p3 = grokFindPromptInput(true); if (p3) _gcCaretToEnd(p3); }, 150);
        mossadDebug('grokCycle', 'шаг prompt: фокус в инпуте');
        return true;
    }

    // ШАГ 2: Режим (Фото <-> Видео)
    async function _gcStepMode() {
        const comp = grokFindComposer(grokFindPromptInput(true));
        const ms = comp && grokFindModeSwitch(comp);
        if (!ms) {
            mossadDebug('grokCycle', 'шаг mode: переключателя нет');
            return false;
        }
        const cur = ms.mode || _gc.lastMode || 'photo';
        const want = cur === 'video' ? 'photo' : 'video';
        if (ms.trigger) {
            mossadPressEl(ms.trigger);
            const re = want === 'video' ? GC_VIDEO_RE : GC_PHOTO_RE;
            const item = await waitForCondition(() => Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"], [data-radix-collection-item]'))
                .find(el => _gcVisible(el) && _gcUsable(el) && (re.test(_gcText(el)) || re.test(_gcLabel(el)))), 800, 40);
            if (!item) {
                return false;
            }
            mossadPressEl(item);
            setTimeout(() => { const t = grokFindModeSwitch(); _gcFocus((t && (t.trigger || t[want])) || ms.trigger); }, 60);
        } else {
            const target = ms[want];
            if (target) {
                mossadPressEl(target);
                _gcFocus(target);
                setTimeout(() => {
                    if (grokCycleWhere() === 'mode') return;
                    const t = grokFindModeSwitch();
                    if (t && t[want]) _gcFocus(t[want]);
                }, 60);
            }
        }
        _gc.lastMode = want;
        showToast(want === 'video' ? '🎬 Видео' : '🖼 Фото');
        mossadDebug('grokCycle', 'шаг mode: переключено на ' + want);
        return true;
    }

    // ШАГ 3 (или 2 при 2-шаговом цикле): Параметр (Видео -> секунды / Фото -> соотношение сторон)
    function _gcStepParam() {
        const comp = grokFindComposer(grokFindPromptInput(true));
        if (!comp) {
            mossadDebug('grokCycle', 'шаг param: композер не найден');
            return false;
        }
        const ms = grokFindModeSwitch(comp);
        const d = grokFindDurationControl(comp), a = grokFindAspectControl(comp);
        const mode = (ms && ms.mode) || _gc.lastMode || (d ? 'video' : 'photo');
        // Если видео — фокус на продолжительность (секунды); если фото — на соотношение сторон
        const el = mode === 'video' ? (d || a) : (a || d);
        if (!el) {
            mossadDebug('grokCycle', 'шаг param: контрол не найден');
            return false;
        }
        _gcFocus(el);
        mossadDebug('grokCycle', 'шаг param: ' + (el === d ? 'секунды/длительность' : 'соотношение сторон'));
        return true;
    }

    /** Одно нажатие цикла по бэкслешу: строго по кругу 1->2->3->1 или 1->2->1! */
    async function grokCycleFocus() {
        // v1.4.6: Всегда, когда на экране есть кнопка Use — нажатие `\` кликает по ней!
        const useBtn = grokFindUseButton();
        if (useBtn) {
            mossadDebug('grokCycle', 'всегда при наличии Use: нажатие на кнопку Use');
            _gc.useClicked = true;
            grokClickUseButton(useBtn);
            showToast('✨ Use: промпт загружен');
            // В этом же заходе, в самом конце — переход в поле ввода промпта
            setTimeout(() => {
                const p = grokFindPromptInput(true);
                if (p) _gcCaretToEnd(p);
            }, 100);
            _gc.lastStepName = 'prompt';
            _gc.ts = Date.now();
            return true;
        }

        const steps = grokCycleAvailableSteps();
        const nextTarget = grokCycleNextStep();
        const startIdx = steps.indexOf(nextTarget);

        for (let i = 0; i < steps.length; i++) {
            const stepName = steps[(startIdx + i) % steps.length];
            let ok = false;
            if (stepName === 'prompt') {
                ok = _gcStepPrompt();
            } else if (stepName === 'mode') {
                ok = await _gcStepMode();
            } else if (stepName === 'param') {
                ok = _gcStepParam();
            }
            if (ok) {
                _gc.lastStepName = stepName;
                _gc.ts = Date.now();
                return true;
            }
        }
        return false;
    }

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

        // 1. Открытый поповер параметров (Radix Popover / Menu / Portal) — наивысший приоритет!
        // Перехватываем стрелки ВСЕГДА, когда поповер открыт, даже если ae === body, чтобы Grok не листал слайд!
        const pop = _gcOpenPopover();
        if (pop) {
            return { kind: 'popover', pop, cur: (ae && pop.contains(ae)) ? ae : null };
        }

        if (!ae || ae === document.body || ae === document.documentElement || _gcOwn(ae)) return null;

        // 2. Элемент списка опций (меню / список / радиогруппа)
        const opt = ae.closest && ae.closest(GC_ITEM_SEL);
        const list = ae.closest && ae.closest('[role="listbox"], [role="menu"], [role="radiogroup"], [data-radix-menu-content], [data-radix-popper-content-wrapper]');
        if (list && _gcIsParamList(list)) return { kind: 'list', list, cur: opt || ae };

        // 3. Контрол параметров внутри композера (длительность или соотношение сторон)
        const comp = grokFindComposer();
        if (comp && comp.contains(ae)) {
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
        }

        // 4. Если мы находимся на шаге 'param' цикла
        if (typeof grokCycleWhere === 'function' && grokCycleWhere() === 'param') {
            return { kind: 'param_fallback', cur: ae };
        }

        return null;
    }

    function _gcArrowStep(list, cur, down) {
        if (!list.length) return null;
        let i = -1;
        if (cur) {
            i = list.indexOf(cur);
            if (i < 0) {
                i = list.findIndex(item => item === cur || item.contains(cur));
            }
        }
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

        if (t.kind === 'trigger') {
            mossadPressEl(t.cur);
            setTimeout(() => {
                const pop = _gcOpenPopover();
                if (pop) {
                    const items = Array.from(pop.querySelectorAll(GC_ITEM_SEL)).filter(x => _gcShown(x) && _gcUsable(x));
                    if (items.length) {
                        const nx = down ? items[0] : items[items.length - 1];
                        if (!nx.hasAttribute('tabindex')) nx.setAttribute('tabindex', '-1');
                        _gcFocus(nx);
                        try {
                            nx.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true }));
                            nx.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                        } catch (_) {}
                    }
                }
            }, 60);
            return;
        }

        // v1.4.6: В выпадающем списке параметров стрелки ТОЛЬКО перемещают подсветку/фокус,
        // КАТЕГОРИЧЕСКИ НЕ нажимая (mossadPressEl) пункт автоматически, чтобы дать пользователю свободно листать!
        if (t.kind === 'popover' || t.kind === 'list') {
            const rootEl = t.pop || t.list;
            const items = Array.from(rootEl.querySelectorAll(GC_ITEM_SEL)).filter(x => _gcShown(x) && _gcUsable(x));
            if (!items.length) return;
            const curItem = (t.cur && (t.cur.closest(GC_ITEM_SEL) || t.cur)) || null;
            const nx = _gcArrowStep(items, curItem, down);
            if (nx) {
                if (!nx.hasAttribute('tabindex')) nx.setAttribute('tabindex', '-1');
                _gcFocus(nx);
                try {
                    nx.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true }));
                    nx.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                } catch (_) {}
            }
            return;
        }

        if (t.kind === 'group') {
            let opts = Array.from(t.box.querySelectorAll('[role="radio"], [role="tab"], [role="option"], button')).filter(x => _gcShown(x) && _gcUsable(x));
            if (t.box === t.cur && t.cur.parentElement) {
                opts = Array.from(t.cur.parentElement.querySelectorAll('button, [role="radio"], [role="tab"]')).filter(x => _gcShown(x) && _gcUsable(x) && (t.re.test(_gcText(x)) || t.re.test(_gcLabel(x))));
            }
            const curOpt = opts.find(x => x === t.cur || x.contains(t.cur)) || null;
            const nx = _gcArrowStep(opts, curOpt, down);
            if (nx && nx !== curOpt) { mossadPressEl(nx); _gcFocus(nx); }
            return;
        }

        if (t.kind === 'param_fallback') {
            const comp = grokFindComposer();
            const d = comp && grokFindDurationControl(comp);
            const a = comp && grokFindAspectControl(comp);
            const targetCtl = d || a;
            if (targetCtl) {
                mossadPressEl(targetCtl);
                setTimeout(() => {
                    const pop = _gcOpenPopover();
                    if (pop) {
                        const items = Array.from(pop.querySelectorAll(GC_ITEM_SEL)).filter(x => _gcShown(x) && _gcUsable(x));
                        if (items.length) {
                            const nx = down ? items[0] : items[items.length - 1];
                            if (!nx.hasAttribute('tabindex')) nx.setAttribute('tabindex', '-1');
                            _gcFocus(nx);
                            try {
                                nx.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true }));
                                nx.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
                            } catch (_) {}
                        }
                    }
                }, 60);
            }
            return;
        }
    }, true);

    // v1.4.6: Выбор подсвеченного пункта в открытом поповере параметров по Enter
    window.addEventListener('keydown', function grokComposerEnterKey(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        if (e.key !== 'Enter') return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        const pop = _gcOpenPopover();
        if (!pop) return;
        const ae = document.activeElement;
        const item = (ae && pop.contains(ae)) ? ((ae.closest && ae.closest(GC_ITEM_SEL)) || ae) : null;
        if (item && item.isConnected) {
            e.preventDefault();
            e.stopImmediatePropagation();
            mossadPressEl(item);
        }
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

    // v1.4.5: Сброс шага бэкслеша при кликах мыши по миниатюрам ленты / плейлиста / кадрам
    document.addEventListener('pointerdown', (e) => {
        if (rootDomain !== 'grok.com' || !e.target) return;
        const t = e.target;
        if (t.closest && t.closest('[data-filmstrip-item], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"], a[href*="/imagine/post/"], [data-sidebar-item], #mossad-playlist-panel')) {
            grokResetCycleState();
        }
    }, true);

    window.addEventListener('popstate', () => {
        if (rootDomain === 'grok.com' && typeof grokResetCycleState === 'function') {
            grokResetCycleState();
        }
    });
