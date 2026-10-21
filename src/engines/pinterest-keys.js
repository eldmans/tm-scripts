    // ============================================
    // v1.3.59: PINTEREST — похожий пин по клавише (настройка pinterestJumpKeys)
    // off (по умолчанию) — ничего не запущено (ни слушателей, ни наблюдателей);
    // focus — клавиша N переводит фокус клавиатуры на N-й похожий пин (как Tab у самого Pinterest: превью видео,
    //   синяя рамка фокуса), без перехода и без своих рамок/номеров; открыть — Пробел/Enter (штатно);
    // keys — переход без номеров; badges — переход + номера на пинах всегда; shift — номера, пока зажат Shift
    // (или включён CapsLock). Порядок клавиш — по клавиатуре: 1..9, 0, Q..P, A..L, Z..M (по e.code — работает
    // и в русской раскладке). Клавиши, занятые хоткеями MOSSAD без Ctrl/Alt/Meta, пропускаются. ANTI_PATTERNS §38.
    // ============================================
    const PIN_JUMP_MODES = ['off', 'focus', 'keys', 'badges', 'shift'];
    // Элемент фокуса в плитке: ближайший фокусируемый ПРЕДОК картинки/видео (у Pinterest — ссылка
    // a[href*="/pin/"], оборачивающая PinImage/видео; именно она получает фокус по Tab), а НЕ внешний контейнер
    // плитки с кнопкой «…». Запасные: role=link / tabindex ≥ 0 вокруг медиа → первая ссылка на пин → найденная ссылка.
    const PIN_FOCUS_SEL = 'a[href*="/pin/"], [role="link"], [tabindex]:not([tabindex="-1"])';
    const PIN_JUMP_ALL_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
        'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
        'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL',
        'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'];
    const PIN_BADGE_THROTTLE_MS = 340; // ≤ 3 перерисовки в секунду
    const PIN_BADGE_LAYER_ID = 'mossad-pin-badges';

    function pinterestJumpMode() {
        const m = config.pinterestJumpKeys;
        return PIN_JUMP_MODES.includes(m) ? m : 'off';
    }
    function pinterestJumpCodeLabel(code) {
        return code.startsWith('Digit') ? code.slice(5) : code.slice(3);
    }
    /** Коды клавиш, занятые хоткеями MOSSAD (без Ctrl/Alt/Meta — с ними мы и так не реагируем). */
    function pinterestJumpBusyCodes() {
        const busy = new Set();
        const hk = config.hk || {};
        for (const name of Object.keys(hk)) {
            const list = Array.isArray(hk[name]) ? hk[name] : [hk[name]];
            for (const b of list) {
                if (!b || !b.key || b.ctrl || b.alt || b.meta) continue;
                const code = b.code || mossadCodeForKey(b.key);
                if (code) busy.add(code);
            }
        }
        mossadSpeedBusyCodes().forEach(c => busy.add(c)); // v1.3.67: клавиши скорости видео
        return busy;
    }
    /** { codes: доступные по порядку, skipped: [{code, label}] } */
    function pinterestJumpCodes() {
        const busy = pinterestJumpBusyCodes();
        const codes = [], skipped = [];
        for (const c of PIN_JUMP_ALL_CODES) (busy.has(c) ? skipped : codes).push(c);
        return { codes, skipped: skipped.map(c => ({ code: c, label: pinterestJumpCodeLabel(c) })) };
    }
    window.pinterestJumpCodes = pinterestJumpCodes;

    function _pinJumpIsTyping(e) {
        const t = e.target;
        if (!t || !t.tagName) return false;
        const tag = t.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || !!t.isContentEditable;
    }

    /** Перейти к N-му похожему (как ручной шаг: в историю, хвост «вперёд» отрезается). */
    function pinterestJumpTo(index) {
        const cands = getPinterestCandidatePins();
        const target = cands[index];
        if (!target) { showToast(`⚠️ Нет похожего пина №${index + 1}`, true); return false; }
        pinterestCancelWait();
        if (!Array.isArray(config.pinterestHistory)) config.pinterestHistory = [];
        let hist = config.pinterestHistory;
        let idx = typeof config.pinterestHistoryIdx === 'number' ? config.pinterestHistoryIdx : hist.length - 1;
        if (!(idx >= 0 && idx < hist.length && pinterestCurrentPinId(hist[idx]) === pinterestCurrentPinId())) {
            hist = hist.slice(0, Math.max(0, idx) + (hist.length ? 1 : 0));
            hist.push(location.href);
            idx = hist.length - 1;
        }
        hist = hist.slice(0, idx + 1);
        hist.push(target.url);
        while (hist.length > 100) hist.shift();
        config.pinterestHistory = hist;
        config.pinterestHistoryIdx = hist.length - 1;
        pinterestSaveHistory();
        if (target.type) sessionStorage.setItem('mossad_expected_type', target.type);
        showToast(`📌 Похожий пин №${index + 1} (${target.type === 'video' ? '🎬 Видео' : '🖼 Фото'})`);
        navigatePinterestUrl(target.url); // слайдшоу (если запущено) продолжит с нового пина
        return true;
    }

    function pinterestJumpFocusEl(c) {
        const tile = (c.element && c.element.closest && c.element.closest('[data-grid-item]')) || c.element;
        if (!tile) return null;
        const media = tile.querySelector('img, video');
        let el = media ? media.closest(PIN_FOCUS_SEL) : null;
        if (el && !tile.contains(el)) el = null;
        if (!el) el = tile.querySelector('a[href*="/pin/"]') || c.element;
        return el;
    }
    /** Фокус на N-й похожий пин (без перехода). */
    function pinterestJumpFocus(index) {
        const c = getPinterestCandidatePins()[index];
        const el = c && pinterestJumpFocusEl(c);
        if (!el) { showToast(`⚠️ Нет похожего пина №${index + 1}`, true); return false; }
        try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
        try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
        return document.activeElement === el;
    }

    // ── состояние (всё создаётся только в нужном режиме) ──
    const _pj = { mode: 'off', onKeyDown: null, onKeyUp: null, onBlur: null, onScroll: null, mo: null, moTarget: null,
                  watch: null, pinId: '', shift: false, caps: false, shown: false, last: 0, pending: null };

    function _pjLayer(create) {
        let l = document.getElementById(PIN_BADGE_LAYER_ID);
        if (!l && create) {
            l = document.createElement('div');
            l.id = PIN_BADGE_LAYER_ID;
            l.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483640;pointer-events:none;';
            document.body.appendChild(l);
        }
        return l;
    }
    function _pjClearBadges() { const l = _pjLayer(false); if (l) l.remove(); }
    function _pjBadgesWanted() {
        return _pj.mode === 'badges' || (_pj.mode === 'shift' && (_pj.shift || _pj.caps));
    }
    /** Номера на видимых плитках первых N похожих (N = число свободных клавиш). */
    function pinterestRenderBadges() {
        _pj.pending = null; _pj.last = Date.now();
        if (!_pjBadgesWanted()) { _pjClearBadges(); return; }
        const { codes } = pinterestJumpCodes();
        const cands = getPinterestCandidatePins().slice(0, codes.length);
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        const parts = [];
        cands.forEach((c, i) => {
            const tile = (c.element && c.element.closest && c.element.closest('[data-grid-item]')) || c.element;
            if (!tile || !tile.getBoundingClientRect) return;
            const r = tile.getBoundingClientRect();
            if (r.width <= 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
            parts.push(`<span data-pin-badge="${i}" style="position:absolute;left:${Math.round(r.left + 6)}px;top:${Math.round(Math.max(0, r.top) + 6)}px;` +
                `min-width:18px;padding:1px 5px;border-radius:6px;background:rgba(17,24,39,0.85);color:#fbbf24;border:1px solid #fbbf24;` +
                `font:700 13px/18px system-ui,sans-serif;text-align:center;">${pinterestJumpCodeLabel(codes[i])}</span>`);
        });
        const l = _pjLayer(true);
        l.innerHTML = parts.join('');
    }
    function _pjScheduleBadges() {
        if (!_pjBadgesWanted()) { _pjClearBadges(); return; }
        if (_pj.pending) return;
        const wait = Math.max(0, PIN_BADGE_THROTTLE_MS - (Date.now() - _pj.last));
        _pj.pending = setTimeout(pinterestRenderBadges, wait);
    }
    function _pjObserve(on) {
        if (!on) {
            if (_pj.mo) { _pj.mo.disconnect(); _pj.mo = null; _pj.moTarget = null; }
            if (_pj.onScroll) { window.removeEventListener('scroll', _pj.onScroll, true); window.removeEventListener('resize', _pj.onScroll); _pj.onScroll = null; }
            if (_pj.pending) { clearTimeout(_pj.pending); _pj.pending = null; }
            return;
        }
        if (!_pj.onScroll) {
            _pj.onScroll = () => _pjScheduleBadges();
            window.addEventListener('scroll', _pj.onScroll, { capture: true, passive: true });
            window.addEventListener('resize', _pj.onScroll, { passive: true });
        }
        // Наблюдатель — только за контейнером похожих пинов (не за всем документом)
        const first = document.querySelector('[data-grid-item]');
        const target = document.querySelector(PIN_RELATED_SEL) || (first && (first.parentElement && first.parentElement.parentElement || first.parentElement));
        if (target && target !== _pj.moTarget) {
            if (_pj.mo) _pj.mo.disconnect();
            _pj.mo = new MutationObserver(() => _pjScheduleBadges());
            _pj.mo.observe(target, { childList: true, subtree: true });
            _pj.moTarget = target;
        }
    }
    function _pjUpdateShown() {
        const want = _pjBadgesWanted();
        if (want === _pj.shown) { if (want) _pjScheduleBadges(); return; }
        _pj.shown = want;
        _pjObserve(want);
        if (want) pinterestRenderBadges(); else _pjClearBadges();
    }

    function _pjKeyDown(e) {
        if (typeof e.getModifierState === 'function') _pj.caps = !!e.getModifierState('CapsLock');
        if (e.key === 'Shift') { _pj.shift = true; _pjUpdateShown(); return; }
        if (_pj.mode === 'shift') _pjUpdateShown();
        if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || _pjJumpBlocked(e)) return;
        const { codes } = pinterestJumpCodes();
        const i = codes.indexOf(e.code);
        if (i < 0) return;
        e.preventDefault(); e.stopPropagation();
        if (_pj.mode === 'focus') pinterestJumpFocus(i); else pinterestJumpTo(i);
    }
    function _pjJumpBlocked(e) {
        if (_pjJumpIsTypingSafe(e)) return true;
        if (_pj.mode !== 'focus' && !pinterestCurrentPinId()) return true; // переход — только со страницы пина
        return !!document.getElementById('mossad-hk-modal') && window.capturingFor !== null && window.capturingFor !== undefined;
    }
    function _pjJumpIsTypingSafe(e) { try { return _pinJumpIsTyping(e); } catch (err) { return true; } }
    function _pjKeyUp(e) {
        if (typeof e.getModifierState === 'function') _pj.caps = !!e.getModifierState('CapsLock');
        if (e.key === 'Shift') _pj.shift = false;
        if (_pj.mode === 'shift') _pjUpdateShown();
    }
    function _pjBlur() { _pj.shift = false; if (_pj.mode === 'shift') _pjUpdateShown(); }

    /** Включить/выключить по настройке. Вызывается при загрузке и при смене настройки. */
    function pinterestJumpApply() {
        if (!rootDomain.includes('pinterest.')) return;
        const mode = pinterestJumpMode();
        // снять всё
        if (_pj.onKeyDown) { window.removeEventListener('keydown', _pj.onKeyDown, true); window.removeEventListener('keyup', _pj.onKeyUp, true); window.removeEventListener('blur', _pj.onBlur); }
        _pj.onKeyDown = _pj.onKeyUp = _pj.onBlur = null;
        if (_pj.watch) { clearInterval(_pj.watch); _pj.watch = null; }
        _pjObserve(false); _pjClearBadges(); _pj.shown = false; _pj.shift = false;
        _pj.mode = mode;
        if (mode === 'off') return;
        _pj.onKeyDown = _pjKeyDown; _pj.onKeyUp = _pjKeyUp; _pj.onBlur = _pjBlur;
        window.addEventListener('keydown', _pj.onKeyDown, true);
        window.addEventListener('keyup', _pj.onKeyUp, true);
        window.addEventListener('blur', _pj.onBlur);
        if (mode === 'keys' || mode === 'focus') return; // без номеров — никакой работы с DOM
        // смена пина (переход внутри Pinterest): убрать старые номера и перецепить наблюдатель
        _pj.pinId = pinterestCurrentPinId();
        _pj.watch = setInterval(() => {
            const id = pinterestCurrentPinId();
            if (id !== _pj.pinId) {
                _pj.pinId = id;
                _pjClearBadges();
                if (_pj.shown) { _pjObserve(false); _pjObserve(true); _pjScheduleBadges(); }
            } else if (_pj.shown && !_pj.moTarget) _pjObserve(true);
        }, 1000);
        _pjUpdateShown();
    }
    window.pinterestJumpApply = pinterestJumpApply;
    if (rootDomain.includes('pinterest.')) setTimeout(pinterestJumpApply, 0);
