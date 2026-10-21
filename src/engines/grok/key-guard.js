    // ============================================
    // v1.3.64: GROK — «Клавиши, которые не кидают в промт» (config.grokNoPromptKeys) + MOSSAD-хоткеи не уводят в промт
    // Grok при нажатии буквы вне поля ввода переводит фокус в промт (и буква печатается туда). Ломает клавиши
    // других расширений (Speed Control: R / К) и наши хоткеи (Улучшить Shift+«+»).
    // Как гасим (два слоя, ANTI_PATTERNS §43):
    //  1) <html>, фаза всплытия: e.stopPropagation() — событие уже прошло фазу перехвата (window/document capture —
    //     там слушают другие расширения) и всплытие до <html>, но НЕ доходит до слушателей Grok на document/window
    //     (bubble). stopImmediatePropagation на window/capture не берём: он скрыл бы клавишу и от расширений.
    //  2) страховка, если Grok слушает ниже <html> (корень React) или на window/capture раньше нас: 300 мс после
    //     такой клавиши фокус, прыгнувший в поле ввода, возвращается назад, а ввод символа (beforeinput) отменяется.
    // Формат поля: каждый символ — клавиша по физическому положению (e.code; буква в любой раскладке и с CapsLock,
    // «к» = «r»), пробел = Space; {Имя} — именованная клавиша по e.code или e.key: {Enter}, {F5}, {ArrowUp}, {Comma}…
    // ============================================
    const GROK_KEYGUARD_MS = 300;
    const _kg = { src: null, codes: new Set(), names: new Set(), until: 0, prev: null };

    /** «R{Enter} 1» → { codes:Set(['KeyR','Enter','Space','Digit1']), names:Set(['Enter']) } */
    function mossadParseKeyList(str) {
        const codes = new Set(), names = new Set();
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '{') {
                const j = s.indexOf('}', i + 1);
                const name = j > i + 1 ? s.slice(i + 1, j).trim() : '';
                if (name && /^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
                    const norm = name.toLowerCase() === 'space' ? 'Space' : name[0].toUpperCase() + name.slice(1); // {comma} → Comma
                    codes.add(norm); names.add(norm === 'Space' ? ' ' : norm);
                    i = j; continue;
                }
            }
            if (ch === ' ') { codes.add('Space'); continue; }
            if (/\s/.test(ch)) continue;
            const code = mossadCodeForKey(ch);
            if (code) codes.add(code); else names.add(ch);
        }
        return { codes, names };
    }
    function _kgList() {
        const src = String(config.grokNoPromptKeys == null ? '' : config.grokNoPromptKeys);
        if (src !== _kg.src) { const p = mossadParseKeyList(src); _kg.src = src; _kg.codes = p.codes; _kg.names = p.names; }
        return _kg;
    }
    /** Клавиша из списка (без Ctrl/Alt/Meta; Shift — допускается). */
    function grokNoPromptKeyMatch(e) {
        if (e.ctrlKey || e.altKey || e.metaKey) return false;
        const l = _kgList();
        return (!!e.code && l.codes.has(e.code)) || (typeof e.key === 'string' && l.names.has(e.key));
    }
    /** Нажатие — хоткей MOSSAD (needHandled: только если наш обработчик уже сделал preventDefault). */
    function _kgMossadHotkey(e, needHandled) {
        if ((needHandled && !e.defaultPrevented) || !config.hk) return false;
        for (const k of Object.keys(config.hk)) { if (hotkeyMatches(e, config.hk[k])) return true; }
        return false;
    }
    function _kgArm() { _kg.until = Date.now() + GROK_KEYGUARD_MS; _kg.prev = document.activeElement; }

    if (rootDomain === 'grok.com') {
        // Взвод страховки — window/capture (раньше обработчиков на document/элементах)
        window.addEventListener('keydown', (e) => {
            if (isEditableElement(document.activeElement)) return;
            if (grokNoPromptKeyMatch(e) || _kgMossadHotkey(e, false)) _kgArm();
        }, true);
        // 1) Отсечь Grok на document/window (bubble), расширения в capture клавишу уже увидели
        const stopAtHtml = (e) => {
            if (isEditableElement(document.activeElement) && !(Date.now() < _kg.until)) return;
            if (grokNoPromptKeyMatch(e) || _kgMossadHotkey(e, true)) e.stopPropagation();
        };
        document.documentElement.addEventListener('keydown', stopAtHtml, false);
        document.documentElement.addEventListener('keypress', stopAtHtml, false);
        document.documentElement.addEventListener('keyup', stopAtHtml, false);
        // 2) Страховка: фокус прыгнул в поле ввода сразу после такой клавиши — вернуть
        window.addEventListener('focusin', (e) => {
            if (!(Date.now() < _kg.until)) return;
            const t = e.target;
            if (!isEditableElement(t) || isEditableElement(_kg.prev) || (t.closest && t.closest('[id^="mossad"]'))) return;
            const prev = _kg.prev;
            mossadDebug('hotkey', 'Grok увёл фокус в поле ввода — возвращаем', { code: t.tagName });
            try { t.blur(); } catch (err) {}
            if (prev && prev !== document.body && prev.isConnected && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (err) {} }
        }, true);
        window.addEventListener('beforeinput', (e) => {
            if (Date.now() < _kg.until && !isEditableElement(_kg.prev) && !(e.target.closest && e.target.closest('[id^="mossad"]'))) e.preventDefault();
        }, true);
    }

    // ── «?» у поля: именованные клавиши (клик — дописать в поле), как окно тегов шаблона ──
    const MOSSAD_KEY_TOKENS = [
        ['{Backspace}', '⌫ Backspace'], ['{Enter}', '↵ Enter'], ['{Space}', '␣ Пробел'], ['{Tab}', '⇥ Tab'], ['{Escape}', 'Esc'],
        ['{ArrowUp}', '↑'], ['{ArrowDown}', '↓'], ['{ArrowLeft}', '←'], ['{ArrowRight}', '→'],
        ['{Delete}', 'Delete'], ['{Insert}', 'Insert'], ['{Home}', 'Home'], ['{End}', 'End'], ['{PageUp}', 'PageUp'], ['{PageDown}', 'PageDown'],
        ...Array.from({ length: 12 }, (_, i) => [`{F${i + 1}}`, `F${i + 1}`]),
        ...Array.from({ length: 10 }, (_, i) => [String(i), String(i)]),
        ['{Minus}', '- Minus'], ['{Equal}', '= Equal'], ['{BracketLeft}', '[ BracketLeft'], ['{BracketRight}', '] BracketRight'],
        ['{Backslash}', '\\ Backslash'], ['{Semicolon}', '; Semicolon'], ['{Quote}', "' Quote"], ['{Comma}', ', Comma'],
        ['{Period}', '. Period'], ['{Slash}', '/ Slash'], ['{Backquote}', '` Backquote'],
    ];
    let _keyHelp = null;
    function mossadCloseKeyHelp() { if (_keyHelp) { _keyHelp.cleanup(); _keyHelp.box.remove(); _keyHelp = null; } }
    /** Окно «?» со списком клавиш для поля input (btn — кнопка «?»). Клик по клавише — дописать в конец поля. */
    function mossadToggleKeyHelp(btn, input) {
        if (_keyHelp && _keyHelp.input === input) { mossadCloseKeyHelp(); return; }
        mossadCloseKeyHelp();
        if (!input) return;
        const box = document.createElement('div');
        box.id = 'mossad-key-help';
        box.style.cssText = 'position:fixed;z-index:2147483646;background:rgba(17,24,39,0.97);border:1px solid #4b5563;border-radius:10px;padding:10px 12px;' +
            'box-shadow:0 10px 30px rgba(0,0,0,0.6);color:#e5e7eb;font:12px system-ui,-apple-system,sans-serif;max-width:min(460px,96vw);max-height:60vh;overflow:auto;';
        box.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><b style="flex:1;">${LH('keyHelpTitle')}</b>` +
            `<button data-kh="close" title="Закрыть (Esc)" style="background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:14px;">✕</button></div>` +
            `<div style="display:flex;flex-wrap:wrap;gap:4px;">${MOSSAD_KEY_TOKENS.map(([tok, lab]) =>
                `<code data-kh-ins="${tok.replace(/"/g, '&quot;')}" title="Дописать ${tok.replace(/"/g, '&quot;')}" style="cursor:pointer;color:#93c5fd;background:#1f2937;border:1px solid #374151;border-radius:4px;padding:1px 5px;">${lab.replace(/</g, '&lt;')}</code>`).join('')}</div>` +
            `<div style="margin-top:6px;color:#9ca3af;line-height:1.4;">${LH('keyHelpNote')}</div>`;
        document.body.appendChild(box);
        try {
            const r = (btn || input).getBoundingClientRect();
            const vw = window.innerWidth || 1024;
            box.style.left = Math.max(4, Math.min(r.left, vw - 470)) + 'px';
            box.style.top = Math.max(4, r.bottom + 4) + 'px';
        } catch (e) {}
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); mossadCloseKeyHelp(); } };
        const onDown = (e) => { const t = e.target; if (!box.contains(t) && t !== btn && t !== input) mossadCloseKeyHelp(); };
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('pointerdown', onDown, true);
        _keyHelp = { box, input, cleanup: () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown, true); } };
        box.addEventListener('click', (e) => {
            if (e.target.closest && e.target.closest('[data-kh="close"]')) { mossadCloseKeyHelp(); return; }
            const ins = e.target.closest && e.target.closest('[data-kh-ins]');
            if (!ins) return;
            input.value = String(input.value || '') + ins.getAttribute('data-kh-ins');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
