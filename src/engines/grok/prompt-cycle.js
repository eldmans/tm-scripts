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
    /** v1.4.8: реальная CSS-видимость (opacity > 0.05, display != none, visibility != hidden, pointer-events != none) включая предков. */
    function _gcRealVisible(el) {
        if (!_gcVisible(el)) return false;
        try {
            const stEl = window.getComputedStyle(el);
            if (!stEl || stEl.display === 'none' || stEl.visibility === 'hidden' || stEl.visibility === 'collapse') return false;
            if (parseFloat(stEl.opacity) <= 0.05 || stEl.pointerEvents === 'none') return false;
            const rect = el.getBoundingClientRect();
            if (!rect || rect.width <= 1 || rect.height <= 1) return false;
            let cur = el.parentElement;
            while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
                if (cur.hasAttribute('hidden') || cur.getAttribute('aria-hidden') === 'true') return false;
                const st = window.getComputedStyle(cur);
                if (!st || st.display === 'none' || st.visibility === 'hidden' || st.visibility === 'collapse') return false;
                if (parseFloat(st.opacity) <= 0.05) return false;
                cur = cur.parentElement;
            }
        } catch (e) { return false; }
        return true;
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
    window.grokFindPromptInput = grokFindPromptInput;

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

    // v1.4.8: Память последнего отправленного промпта для мгновенного перезапуска фото (как видео по `\` -> Enter)
    const GC_LAST_PROMPT_SS_KEY = 'mossad_grok_last_prompt';
    const GC_LAST_PROMPT_TS_SS_KEY = 'mossad_grok_last_prompt_ts';
    let _gcLastSubmittedPrompt = '';
    let _gcLastSubmitTs = 0;
    try {
        _gcLastSubmittedPrompt = sessionStorage.getItem(GC_LAST_PROMPT_SS_KEY) || '';
        _gcLastSubmitTs = Number(sessionStorage.getItem(GC_LAST_PROMPT_TS_SS_KEY) || 0) || 0;
    } catch (e) {}
    let _gcRestoredForEmpty = false;

    function grokReadPromptText(el) {
        const p = el || grokFindPromptInput(true);
        if (!p) return '';
        const raw = typeof p.value === 'string' ? p.value : (p.innerText || p.textContent || '');
        return String(raw || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim();
    }

    function grokCaptureCurrentPrompt() {
        if (rootDomain !== 'grok.com') return '';
        const txt = grokReadPromptText();
        if (txt) {
            _gcLastSubmittedPrompt = txt;
            _gcLastSubmitTs = Date.now();
            _gcRestoredForEmpty = false;
            try {
                sessionStorage.setItem(GC_LAST_PROMPT_SS_KEY, txt);
                sessionStorage.setItem(GC_LAST_PROMPT_TS_SS_KEY, String(_gcLastSubmitTs));
            } catch (e) {}
            mossadDebug('grokCycle', 'промт сохранён для быстрого повтора', { len: txt.length });
        }
        return txt;
    }
    window.grokCaptureCurrentPrompt = grokCaptureCurrentPrompt;

    /** v1.4.8: Вставка текста промпта в поле ввода Grok (React textarea или ProseMirror/Lexical contenteditable). */
    function grokInsertPromptText(el, text) {
        if (!el || !text) return false;
        _gcFocus(el);
        try {
            if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) desc.set.call(el, text);
                else el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                _gcCaretToEnd(el);
                return true;
            }
            if (el.isContentEditable) {
                const sel = window.getSelection && window.getSelection();
                if (sel) {
                    const rg = document.createRange();
                    rg.selectNodeContents(el);
                    sel.removeAllRanges();
                    sel.addRange(rg);
                }
                let ok = false;
                try { ok = document.execCommand('insertText', false, text); } catch (e) {}
                if (!ok) {
                    el.textContent = text;
                    try {
                        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
                    } catch (e) {
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                _gcCaretToEnd(el);
                return true;
            }
        } catch (e) {}
        return false;
    }

    /** v1.4.8: Есть ли уже в композере текст или прикреплённое фото/чип. */
    function grokComposerHasContent(comp) {
        const p = grokFindPromptInput(true);
        if (p) {
            if (grokReadPromptText(p).length > 0) return true;
            if (p.querySelector && p.querySelector('img, [contenteditable="false"], [data-chip], [data-mention]')) return true;
        }
        const box = comp || grokFindComposer(p);
        if (box) {
            const imgs = Array.from(box.querySelectorAll('img'));
            for (const im of imgs) {
                if (!_gcShown(im) || im.closest(GC_CTRL_SEL)) continue;
                const s = (im.src || '').toLowerCase();
                if (s.includes('avatar') || s.includes('pfp') || s.includes('logo')) continue;
                return true;
            }
            const rmBtn = box.querySelector('button[aria-label*="Remove" i], button[aria-label*="Detach" i], button[aria-label*="Delete" i], button[aria-label*="Удал" i], button[aria-label*="Clear" i]');
            if (rmBtn && _gcShown(rmBtn) && !rmBtn.closest('[role="menu"]')) return true;
        }
        return false;
    }
    window.grokComposerHasContent = grokComposerHasContent;

    /**
     * v1.4.8: Определяет состояние активного элемента (на киноплёнке / главном экране):
     * 'generating-video' | 'generating-image' | 'video' | 'photo'.
     */
    function grokDetectActiveItemState() {
        const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
        const activeIdx = typeof grokGetActiveFilmstripIndex === 'function' ? grokGetActiveFilmstripIndex() : -1;
        const thumb = (activeIdx >= 0 && items[activeIdx]) ? items[activeIdx] : null;
        const main = document.querySelector('main, [role="main"], div[role="dialog"]');
        const activeVid = (typeof getActiveVideo === 'function' ? getActiveVideo() : null) ||
            (main ? main.querySelector('video') : document.querySelector('video'));

        const hasProgressEl = (root, excludeFilmstrip) => {
            if (!root) return false;
            const sels = '.animate-spin, .animate-pulse, [role="progressbar"], [aria-busy="true"], [data-testid*="progress"], [data-state="generating"], svg circle[stroke-dashoffset], img[class*="blur-"]';
            const found = Array.from(root.querySelectorAll(sels)).some(el => {
                if (!_gcShown(el)) return false;
                if (excludeFilmstrip && el.closest('[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]')) return false;
                return true;
            });
            if (found) return true;
            if (!excludeFilmstrip) {
                const txt = (root.textContent || '').trim();
                if (/\b\d{1,3}%/.test(txt)) return true;
                if (/\b(generating|creating|rendering|preparing|queued|генерация|создание|подготовка|в очереди)\b/i.test(txt)) return true;
            }
            return false;
        };

        const genGlobal = (typeof isGrokGeneratingNow === 'function') ? isGrokGeneratingNow() : false;
        const genThumb = hasProgressEl(thumb, false);
        const genMain = hasProgressEl(main, !!thumb);
        const isGenerating = !!(genGlobal || genThumb || genMain);

        const comp = grokFindComposer(grokFindPromptInput(true));
        const ms = comp ? grokFindModeSwitch(comp) : null;
        const thumbHasVideo = !!(thumb && (
            thumb.querySelector('video') ||
            /\b\d{1,2}\s?(?:s|sec|с|сек)\b/i.test(thumb.textContent || '') ||
            /video|видео/i.test(thumb.getAttribute('aria-label') || '')
        ));
        const hasLoadedVideo = !!(activeVid && (activeVid.currentSrc || activeVid.src || activeVid.querySelector('source')));
        const hasEmptyVideoTag = !!(activeVid && !activeVid.currentSrc && !activeVid.src && !activeVid.querySelector('source'));

        let isVideo = !!(hasLoadedVideo || hasEmptyVideoTag || thumbHasVideo);
        if (isGenerating && !isVideo && ms && ms.mode === 'video') {
            isVideo = true;
        }

        const state = isGenerating
            ? (isVideo ? 'generating-video' : 'generating-image')
            : (isVideo ? 'video' : 'photo');

        const labels = {
            'generating-video': '⏳ Генерация видео',
            'generating-image': '⏳ Генерация фото',
            'video': '🎬 Видео',
            'photo': '🖼 Фото',
        };
        return { state, isGenerating, isVideo, isPhoto: !isVideo, hasActiveThumb: !!thumb, label: labels[state] };
    }
    window.grokDetectActiveItemState = grokDetectActiveItemState;

    const USE_WORD_RE = /(?:^|[^a-zA-Zа-яА-ЯёЁ0-9])(use|использовать)(?:$|[^a-zA-Zа-яА-ЯёЁ0-9])/i;

    /** v1.4.8: Поиск ТОЛЬКО реально видимой плашки "Use" над композером (отсекает скрытые CSS и слова вроде user*). */
    function grokFindUseButton() {
        const isFresh = (el) => !el._mossadUseClicked || (Date.now() - el._mossadUseClicked > 800);
        const comp = grokFindComposer(grokFindPromptInput(true));
        const compRect = comp ? _gcRect(comp) : null;

        const isNearComposer = (el) => {
            if (grokIsPromptInput(el)) return false;
            if (el.closest('nav, header, [role="menu"], [role="listbox"]')) return false;
            if (!compRect) return true;
            const r = _gcRect(el);
            if (!r) return false;
            return r.bottom <= compRect.top + 48 && r.top >= compRect.top - 160;
        };

        const isUseText = (el) => {
            const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (!raw || raw.length > 20) return false;
            return USE_WORD_RE.test(raw);
        };

        // 1. Поиск реально видимых элементов со словом Use / Использовать (целое слово)
        const candidates = Array.from(document.querySelectorAll('span, button, [role="button"], div'))
            .filter(el => {
                if (_gcOwn(el) || !isFresh(el)) return false;
                if (el.children.length > 2) return false;
                if (!isUseText(el)) return false;
                if (!_gcRealVisible(el)) return false;
                return isNearComposer(el);
            });

        for (const el of candidates) {
            const pill = el.closest('.absolute, [class*="bottom-full"], div[class*="ring-1"], div[class*="border-border"], div[class*="surface"]');
            if (pill && pill !== comp && !pill.contains(comp) && _gcRealVisible(pill) && isFresh(pill)) {
                pill._mossadUseTarget = el;
                return pill;
            }
            if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || (el.classList && el.classList.contains('cursor-pointer'))) {
                return el;
            }
            if (el.parentElement && el.parentElement !== comp && _gcRealVisible(el.parentElement) && isFresh(el.parentElement)) {
                el.parentElement._mossadUseTarget = el;
                return el.parentElement;
            }
        }

        // 2. Фолбэк: реально видимая плашка .bottom-full над композером со словом Use
        const bottomPills = Array.from(document.querySelectorAll('.absolute.bottom-full, [class*="bottom-full"]'))
            .filter(el => _gcRealVisible(el) && isFresh(el) && isNearComposer(el));
        for (const bp of bottomPills) {
            const uSpan = Array.from(bp.querySelectorAll('span, button, div')).find(x => isUseText(x) && _gcRealVisible(x));
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

        // v1.4.8: Если композер пуст и мы не завершаем цикл — пробуем видимую кнопку Use
        const comp = grokFindComposer(grokFindPromptInput(true));
        if (!grokComposerHasContent(comp) && !_gc.useClicked && _gc.lastStepName !== 'param') {
            const useBtn = grokFindUseButton();
            if (useBtn) {
                mossadDebug('grokCycle', 'шаг prompt: нажатие на видимую кнопку Use');
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
        const comp = grokFindComposer(grokFindPromptInput(true));
        const hasContent = grokComposerHasContent(comp);

        // v1.4.8: Если композер ПУСТ — сначала пробуем реально видимую кнопку Use;
        // если её нет и идёт генерация или промпт был недавно отправлен — восстанавливаем текст промпта для мгновенного повтора (\ -> Enter)!
        if (!hasContent) {
            const useBtn = grokFindUseButton();
            if (useBtn) {
                mossadDebug('grokCycle', 'композер пуст: клик по видимой кнопке Use');
                _gc.useClicked = true;
                grokClickUseButton(useBtn);
                showToast('✨ Use: промпт загружен');
                setTimeout(() => {
                    const p = grokFindPromptInput(true);
                    if (p) _gcCaretToEnd(p);
                }, 100);
                _gc.lastStepName = 'prompt';
                _gc.ts = Date.now();
                return true;
            }

            if (!_gcRestoredForEmpty) {
                const pEl = grokFindPromptInput(true);
                const stateInfo = grokDetectActiveItemState();
                const isRecentSubmit = _gcLastSubmittedPrompt && (Date.now() - _gcLastSubmitTs < 180000);
                let restoreText = '';
                if (isRecentSubmit) restoreText = _gcLastSubmittedPrompt;
                else if (stateInfo.isGenerating && typeof getGrokCurrentPrompt === 'function') {
                    restoreText = String(getGrokCurrentPrompt() || '').trim();
                }
                if (pEl && restoreText) {
                    _gcRestoredForEmpty = true;
                    grokInsertPromptText(pEl, restoreText);
                    showToast(`📋 Промпт восстановлен (${stateInfo.label}) — Enter для запуска`);
                    _gc.lastStepName = 'prompt';
                    _gc.ts = Date.now();
                    return true;
                }
            }
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

    // v1.4.8: Enter в композере:
    // 1) При открытом поповере параметров — выбор подсвеченного пункта;
    // 2) Когда фокус стоит на переключателе режима (Фото ↔ Видео) — запуск генерации (как Enter в промпте / стрелка ↑);
    // 3) Когда Enter нажат в самом поле промпта — запоминаем промпт для серийного запуска фото.
    window.addEventListener('keydown', function grokComposerEnterKey(e) {
        if (rootDomain !== 'grok.com' || window.capturingFor !== null) return;
        if (e.key !== 'Enter') return;
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const pop = _gcOpenPopover();
        if (pop) {
            const ae = document.activeElement;
            const item = (ae && pop.contains(ae)) ? ((ae.closest && ae.closest(GC_ITEM_SEL)) || ae) : null;
            if (item && item.isConnected) {
                e.preventDefault();
                e.stopImmediatePropagation();
                mossadPressEl(item);
            }
            return;
        }

        const ae = document.activeElement;
        if (grokIsPromptInput(e.target || ae)) {
            grokCaptureCurrentPrompt();
            return;
        }

        if (grokCycleWhere() === 'mode' && typeof window.triggerGrokSubmit === 'function') {
            e.preventDefault();
            e.stopImmediatePropagation();
            grokCaptureCurrentPrompt();
            window.triggerGrokSubmit();
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

    // v1.4.5/v1.4.8: Сброс шага бэкслеша при кликах по ленте + захват промпта перед кликом на кнопку отправки ↑
    document.addEventListener('pointerdown', (e) => {
        if (rootDomain !== 'grok.com' || !e.target) return;
        const t = e.target;
        if (t.closest && t.closest('[data-filmstrip-item], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"], a[href*="/imagine/post/"], [data-sidebar-item], #mossad-playlist-panel')) {
            grokResetCycleState();
        }
        const btn = t.closest && t.closest('button, [role="button"]');
        if (btn && !_gcOwn(btn)) {
            const comp = grokFindComposer(grokFindPromptInput(true));
            if (comp && comp.contains(btn)) {
                const isSubmit = btn.getAttribute('type') === 'submit' ||
                    btn.querySelector('g[id*="arrow-up"]') ||
                    (/rounded-full/.test(btn.className || '') && btn.querySelector('svg')) ||
                    /(send|submit|make video|generate|отправить|создать)/i.test(btn.getAttribute('aria-label') || '');
                if (isSubmit) grokCaptureCurrentPrompt();
            }
        }
    }, true);

    window.addEventListener('popstate', () => {
        if (rootDomain === 'grok.com' && typeof grokResetCycleState === 'function') {
            grokResetCycleState();
        }
    });
