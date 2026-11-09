    // ============================================================
    // GROK: История просмотров слайдов (Alt+1..4) и умное сворачивание промпта (v1.3.92)
    // - Срабатывает ТОЛЬКО когда мы находимся внутри диалога (conversation)
    // - Вне диалога (в чате, в Saved, в Image) проверка кнопок выключена, плашка скрыта
    // - Генерации в процессе (спиннер / in-progress) в историю НЕ попадают
    // - Если генерация сорвалась/недействительна: удаляется из истории и перебрасывает в Grok Image
    // - Alt+1: первый слайд диалога (items[0])
    // - Alt+4: последний слайд диалога (items[last])
    // - Alt+2: назад по истории слайдов диалога (задержка >= 5с)
    // - Alt+3: вперёд по истории слайдов диалога
    // - Без перезагрузки страницы (window.location.href запрещён)
    // - Раздельное хранение истории для каждого отдельного conversation
    // - Плашка позиции в истории рядом с квотой (двойной клик — компактный вид)
    // ============================================================

    const GROK_HIST_MAX_AGE_MS = 60 * 60 * 1000; // 1 час — записи старше автоматически удаляются

    let _grokSlideHistIndex = -1;
    let _grokCandidateSlide = null;
    let _grokHistTickTimer = null;
    let _grokIsNavigatingHistory = false;
    let _grokHistoryPillEl = null;

    // ── Проверка: находимся ли мы строго внутри диалога (conversation) ──
    function isGrokInsideConversation() {
        if (rootDomain !== 'grok.com') return false;
        // Не диалог генераций, если мы в Saved или на главной imagine
        if (typeof isGrokSavedPage === 'function' && isGrokSavedPage()) return false;
        if (location.pathname === '/imagine' || location.pathname === '/imagine/') return false;
        // Текстовый чат без генераций
        if (location.pathname.startsWith('/chat') || location.pathname.startsWith('/c/')) {
            if (!document.querySelector('[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]')) {
                return false;
            }
        }
        // На странице поста Imagine
        if (typeof isGrokPostPage === 'function' && isGrokPostPage()) {
            return true;
        }
        // Наличие параметра беседы в URL
        try {
            const u = new URL(location.href);
            if (u.searchParams.get('conversation') || u.searchParams.get('conv')) return true;
        } catch (e) {}
        return false;
    }

    // ── Проверка: идёт ли генерация прямо сейчас (in-progress) ──
    function isGrokGeneratingNow() {
        if (!isGrokInsideConversation()) return false;
        // Спиннеры, прогрессбары, анимации загрузки
        const progress = document.querySelector('[role="progressbar"], [data-testid*="progress"], [aria-label*="Generating"], [aria-label*="generating"], .animate-spin');
        if (progress) {
            const main = document.querySelector('main, [role="main"], div[role="dialog"]');
            if (main && (main.contains(progress) || progress.closest('main, [role="dialog"]'))) {
                return true;
            }
        }
        // Текстовые лоадеры в теле поста
        const candidateTexts = Array.from(document.querySelectorAll('main span, main p, div[role="dialog"] span, div[role="dialog"] p'));
        for (const el of candidateTexts) {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (/^(generating|creating|rendering|preparing|генерация|создание|подготовка)/i.test(txt)) {
                return true;
            }
        }
        // Видео-тег без источника (ещё не сгенерирован)
        const vid = document.querySelector('main video, div[role="dialog"] video');
        if (vid && !vid.src && !vid.querySelector('source') && !vid.currentSrc) {
            return true;
        }
        return false;
    }

    // ── Проверка: сорвалась ли генерация (failed / invalid) ──
    function isGrokGenerationFailed() {
        if (rootDomain !== 'grok.com' || !isGrokInsideConversation()) return false;
        const alerts = Array.from(document.querySelectorAll('[role="alert"], [data-testid*="error"], div[class*="error"]'));
        for (const el of alerts) {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (/fail|error|not found|could not|не удалось|ошибка/i.test(txt)) {
                return true;
            }
        }
        const texts = Array.from(document.querySelectorAll('main p, main h2, main h3, div[role="dialog"] p, div[role="dialog"] h2, div[role="dialog"] h3'));
        for (const el of texts) {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (txt.includes('generation failed') || txt.includes('failed to generate') || txt.includes('post not found') || txt.includes('something went wrong') || txt.includes('не удалось сгенерировать') || txt.includes('ошибка генерации')) {
                return true;
            }
        }
        return false;
    }

    // Удаление сбойной/недействительной генерации из истории и редирект в Grok Image
    function _handleFailedGenerationIfAny() {
        if (!isGrokGenerationFailed()) return;
        const curUrl = location.href;
        const curUuid = typeof grokExtractUuid === 'function' ? grokExtractUuid(location.pathname) : '';
        const convId = _getGrokConvKey();
        let history = _loadGrokSlideHistory(convId);
        const initialLen = history.length;
        history = history.filter(item => {
            if (curUrl && item.url === curUrl) return false;
            if (curUuid && item.uuid && item.uuid.toLowerCase() === curUuid.toLowerCase()) return false;
            return true;
        });
        if (history.length !== initialLen) {
            _saveGrokSlideHistory(history, convId);
            if (_grokSlideHistIndex >= history.length) {
                _grokSlideHistIndex = history.length - 1;
            }
            updateGrokHistoryPill();
        }
        showToast('⚠️ Генерация не удалась — переход в Grok Image');
        window.location.replace('https://grok.com/imagine');
    }

    // ── Определение активного диалога / conversation ──
    function _getGrokConvKey() {
        let convId = '';
        try {
            const u = new URL(location.href);
            convId = u.searchParams.get('conversation') || u.searchParams.get('conv') || '';
            if (!convId) {
                const m = location.pathname.match(/\/(?:c|chat)\/([a-f0-9-]{8,})/i);
                if (m) convId = m[1];
            }
        } catch (e) {}
        if (!convId) {
            const curUuid = typeof grokExtractUuid === 'function' ? grokExtractUuid(location.pathname) : '';
            if (typeof grokCurrentConvId === 'function') {
                convId = grokCurrentConvId(curUuid);
            }
        }
        return (convId ? convId.toLowerCase() : 'default');
    }

    function _getGrokHistStorageKey(convId) {
        return 'mossad_grok_hist_' + (convId || _getGrokConvKey());
    }

    // ── Сворачивание поля ввода промпта ──
    function isGrokPromptActive() {
        const el = document.activeElement;
        if (!el) return false;
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable || el.getAttribute('role') === 'textbox') {
            return true;
        }
        return !!el.closest('form, div.query-bar, [data-testid*="composer"]');
    }

    function grokCollapsePrompt() {
        const prompt = typeof grokFindPromptInput === 'function' ? grokFindPromptInput(true) : document.querySelector('textarea, [contenteditable="true"]');
        if (prompt) {
            try { prompt.blur(); } catch (e) {}
        }
        const ae = document.activeElement;
        if (ae && typeof ae.blur === 'function') {
            try { ae.blur(); } catch (e) {}
        }
        if (typeof blurActiveInput === 'function') {
            blurActiveInput();
        }
        const neutral = document.querySelector('main, [role="main"], #root, body');
        if (neutral) {
            try {
                neutral.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
                neutral.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (e) {}
        }
    }

    // ── Хранилище истории (изолировано по conversation) ──
    function _loadGrokSlideHistory(convId) {
        const key = _getGrokHistStorageKey(convId);
        let list = [];
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) list = JSON.parse(raw);
        } catch (e) { list = []; }

        const now = Date.now();
        const fresh = list.filter(item => item && item.url && (now - item.ts < GROK_HIST_MAX_AGE_MS));
        if (fresh.length !== list.length) {
            _saveGrokSlideHistory(fresh, convId);
        }
        return fresh;
    }

    function _saveGrokSlideHistory(list, convId) {
        try {
            const key = _getGrokHistStorageKey(convId);
            sessionStorage.setItem(key, JSON.stringify(list));
        } catch (e) {}
    }

    // ── Рендер плашки истории рядом с квотой ──
    function updateGrokHistoryPill() {
        if (rootDomain !== 'grok.com') return;

        // Вне диалога плашка истории скрыта
        if (!isGrokInsideConversation() || config.grokHistPillEnabled === false) {
            if (_grokHistoryPillEl) _grokHistoryPillEl.style.display = 'none';
            if (typeof _checkGrokPillsWrapVisibility === 'function') _checkGrokPillsWrapVisibility();
            return;
        }

        const wrap = (typeof getOrCreateGrokPillsWrap === 'function') ? getOrCreateGrokPillsWrap() : null;
        if (!wrap) return;

        if (!_grokHistoryPillEl || !_grokHistoryPillEl.isConnected) {
            _grokHistoryPillEl = document.createElement('div');
            _grokHistoryPillEl.id = 'mossad-grok-history-pill';
            _grokHistoryPillEl.style.cssText = `
                display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 12px;
                background: rgba(17, 24, 39, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(75, 85, 99, 0.65);
                border-radius: 9999px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
                color: #e5e7eb;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.02em;
                cursor: pointer;
                user-select: none;
                transition: border-color 0.15s, box-shadow 0.15s;
            `;
            _grokHistoryPillEl.addEventListener('click', (e) => {
                const hist = _loadGrokSlideHistory();
                const total = hist.length;
                const cur = total > 0 ? (_grokSlideHistIndex >= 0 ? _grokSlideHistIndex + 1 : total) : 0;
                showToast(`🎞 Слайд в истории: ${cur || '-'} из ${total || '-'}`);
            });
            wrap.appendChild(_grokHistoryPillEl);
        }

        _grokHistoryPillEl.style.display = 'inline-flex';

        const isSsRunning = !!(window._mossadGalleryActive || slideshowActive);
        const isCompact = !!config.grokPillsCompact;

        if (isSsRunning) {
            // v1.3.94: Во время слайд-шоу плашка показывает счётчик слайд-шоу!
            let cur = 1, total = 0;
            if (typeof grokGetPlaylistStructure === 'function' && window._mossadGalleryActive) {
                const struct = grokGetPlaylistStructure();
                if (struct && struct.items) {
                    total = struct.items.length;
                    const pos = (typeof grokFindCurrentPosition === 'function') ? grokFindCurrentPosition(struct) : null;
                    cur = (pos && pos.totalIndex >= 0) ? pos.totalIndex + 1 : 1;
                }
            } else {
                const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
                total = items.length;
                const curIdx = typeof grokGetActiveFilmstripIndex === 'function' ? grokGetActiveFilmstripIndex() : -1;
                cur = curIdx >= 0 ? curIdx + 1 : 1;
            }

            if (isCompact) {
                _grokHistoryPillEl.innerHTML = `<span style="color:#10b981;font-weight:700;">${cur || '-'}</span>`;
            } else {
                _grokHistoryPillEl.innerHTML = `<span style="color:#10b981;font-weight:700;">${cur || '-'}</span><span style="color:#6b7280;margin:0 2px;"> / </span><span style="color:#9ca3af;">${total || '-'}</span>`;
            }
            _grokHistoryPillEl.title = `Слайд-шоу:\nПозиция: ${cur || '-'} из ${total || '-'}\nAlt+1 — первый слайд плейлиста\nAlt+2 — шаг назад в показе\nAlt+3 — шаг вперёд в показе\nAlt+4 — последний слайд плейлиста\n(Двойной клик — компактный вид)`;
        } else {
            const history = _loadGrokSlideHistory();
            const total = history.length;
            let cur = 0;
            if (total > 0) {
                cur = _grokSlideHistIndex >= 0 ? _grokSlideHistIndex + 1 : total;
            }

            if (isCompact) {
                _grokHistoryPillEl.innerHTML = `<span style="color:#60a5fa;font-weight:700;">${cur || '-'}</span>`;
            } else {
                _grokHistoryPillEl.innerHTML = `<span style="color:#60a5fa;font-weight:700;">${cur || '-'}</span><span style="color:#6b7280;margin:0 2px;"> / </span><span style="color:#9ca3af;">${total || '-'}</span>`;
            }
            _grokHistoryPillEl.title = `История слайдов диалога:\nПозиция: ${cur || '-'} из ${total || '-'}\nAlt+1 — первый слайд диалога\nAlt+2 — назад по истории\nAlt+3 — вперёд по истории\nAlt+4 — последний слайд диалога\n(Двойной клик — компактный вид)`;
        }
        if (typeof _checkGrokPillsWrapVisibility === 'function') {
            _checkGrokPillsWrapVisibility();
        }
    }

    // ── Запись слайда при задержке >= N сек ──
    function _checkCandidateCommit() {
        if (!isGrokInsideConversation()) return;
        _handleFailedGenerationIfAny();

        if (!_grokCandidateSlide || _grokCandidateSlide.committed) return;

        // Если генерация ещё крутится / в процессе — в историю НЕ заносим!
        if (isGrokGeneratingNow()) {
            _grokCandidateSlide.startTime = Date.now();
            return;
        }

        const dwellSec = Math.max(1, Math.min(60, Number(config.grokHistoryDwellSec) || 5));
        const elapsed = Date.now() - _grokCandidateSlide.startTime;
        if (elapsed < dwellSec * 1000) return;

        _grokCandidateSlide.committed = true;
        const convId = _getGrokConvKey();
        const history = _loadGrokSlideHistory(convId);
        const currentUrl = _grokCandidateSlide.url;

        if (history.length > 0 && history[history.length - 1].url === currentUrl) {
            _grokSlideHistIndex = history.length - 1;
            updateGrokHistoryPill();
            return;
        }

        const newEntry = {
            url: currentUrl,
            path: _grokCandidateSlide.path,
            uuid: _grokCandidateSlide.uuid,
            ts: Date.now()
        };

        if (_grokSlideHistIndex >= 0 && _grokSlideHistIndex < history.length - 1) {
            history.splice(_grokSlideHistIndex + 1);
        }

        history.push(newEntry);
        _grokSlideHistIndex = history.length - 1;
        _saveGrokSlideHistory(history, convId);
        updateGrokHistoryPill();
    }

    function _onGrokSlideChanged() {
        if (rootDomain !== 'grok.com' || !isGrokInsideConversation()) {
            updateGrokHistoryPill();
            return;
        }
        const url = location.href;
        const path = location.pathname;
        const uuid = typeof grokExtractUuid === 'function' ? grokExtractUuid(path) : '';

        if (_grokCandidateSlide && _grokCandidateSlide.url === url) return;

        // v1.4.5: URL кадра реально изменился — сбрасываем цикл бэкслеша!
        if (typeof grokResetCycleState === 'function') grokResetCycleState();

        _grokCandidateSlide = {
            url,
            path,
            uuid,
            startTime: Date.now(),
            committed: false
        };

        updateGrokHistoryPill();
    }

    // ── Навигация по истории слайдов (ИСКЛЮЧИТЕЛЬНО через DOM без перезагрузки страницы) ──
    function grokNavigateToSlide(target) {
        if (!target) return;
        _grokIsNavigatingHistory = true;
        setTimeout(() => { _grokIsNavigatingHistory = false; }, 800);

        const targetUuid = (target.uuid || (target.url ? (typeof grokExtractUuid === 'function' ? grokExtractUuid(target.url) : '') : '')).toLowerCase();

        // 1. Попытка нативного переключения через киноплёнку filmstrip по UUID
        if (targetUuid && typeof grokFindFilmstripItemByUuid === 'function') {
            const btn = grokFindFilmstripItemByUuid(targetUuid);
            if (btn) {
                btn.click();
                try { history.replaceState(null, '', target.path || target.url); } catch (e) {}
                updateGrokHistoryPill();
                return;
            }
        }

        // 2. Поиск по всем элементам киноплёнки
        const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
        if (items.length > 0 && targetUuid) {
            for (const btn of items) {
                const img = btn.querySelector('img, video, source');
                if (img && img.src && img.src.toLowerCase().includes(targetUuid)) {
                    btn.click();
                    try { history.replaceState(null, '', target.path || target.url); } catch (e) {}
                    updateGrokHistoryPill();
                    return;
                }
            }
        }

        showToast('⚠️ Кадр не найден на полосе кадров', true);
        updateGrokHistoryPill();
    }

    // Alt+1: Первый слайд диалога (items[0]), если нет — первый в истории
    function grokJumpToFirstSlide() {
        const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
        if (items.length > 0) {
            items[0].click();
            showToast(`⏮ Первый слайд диалога (1/${items.length})`);
            updateGrokHistoryPill();
            return;
        }
        const history = _loadGrokSlideHistory();
        if (history.length > 0) {
            _grokSlideHistIndex = 0;
            grokNavigateToSlide(history[0]);
            showToast(`⏮ Первый слайд в истории (1/${history.length})`);
            updateGrokHistoryPill();
            return;
        }
        showToast('⏮ Слайды не найдены', true);
    }

    // Alt+4: Последний слайд диалога (items[last]), если нет — последний в истории
    function grokJumpToLastSlide() {
        const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
        if (items.length > 0) {
            items[items.length - 1].click();
            showToast(`⏭ Последний слайд диалога (${items.length}/${items.length})`);
            updateGrokHistoryPill();
            return;
        }
        const history = _loadGrokSlideHistory();
        if (history.length > 0) {
            _grokSlideHistIndex = history.length - 1;
            grokNavigateToSlide(history[history.length - 1]);
            showToast(`⏭ Последний слайд в истории (${history.length}/${history.length})`);
            updateGrokHistoryPill();
            return;
        }
        showToast('⏭ Слайды не найдены', true);
    }

    // Alt+2: Назад в истории
    function grokHistoryBack() {
        const history = _loadGrokSlideHistory();
        if (history.length === 0) {
            showToast('⏮ История слайдов пуста', true);
            return;
        }

        if (_grokSlideHistIndex < 0 || _grokSlideHistIndex >= history.length) {
            _grokSlideHistIndex = history.length - 1;
        }

        if (history[_grokSlideHistIndex] && history[_grokSlideHistIndex].url === location.href && _grokSlideHistIndex > 0) {
            _grokSlideHistIndex--;
        } else if (_grokSlideHistIndex <= 0) {
            showToast('⏮ Начало истории слайдов', true);
            return;
        } else {
            _grokSlideHistIndex--;
        }

        const target = history[_grokSlideHistIndex];
        showToast(`⏮ Слайд: ${_grokSlideHistIndex + 1}/${history.length}`);
        grokNavigateToSlide(target);
        updateGrokHistoryPill();
    }

    // Alt+3: Вперёд в истории
    function grokHistoryForward() {
        const history = _loadGrokSlideHistory();
        if (history.length === 0) {
            showToast('⏭ История слайдов пуста', true);
            return;
        }

        if (_grokSlideHistIndex >= history.length - 1) {
            showToast('⏭ Конец истории слайдов', true);
            return;
        }

        _grokSlideHistIndex++;
        const target = history[_grokSlideHistIndex];
        showToast(`⏭ Слайд: ${_grokSlideHistIndex + 1}/${history.length}`);
        grokNavigateToSlide(target);
        updateGrokHistoryPill();
    }

    // ── Перехват хоткеев Alt+1..Alt+4 (ТОЛЬКО внутри диалога) ──
    window.addEventListener('keydown', function handleGrokHistoryNavKeys(e) {
        if (rootDomain !== 'grok.com') return;

        // ТРЕБОВАНИЕ: хоткеи Alt+1..4 активны ТОЛЬКО внутри диалога (conversation)
        if (!isGrokInsideConversation()) return;

        const isFirstHk = (config.hk && config.hk.grokFirstSlide && hotkeyMatches(e, config.hk.grokFirstSlide)) ||
                          (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit1' || e.key === '1'));
        const isBackHk  = (config.hk && config.hk.grokHistBack && hotkeyMatches(e, config.hk.grokHistBack)) ||
                          (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit2' || e.key === '2'));
        const isFwdHk   = (config.hk && config.hk.grokHistFwd && hotkeyMatches(e, config.hk.grokHistFwd)) ||
                          (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit3' || e.key === '3'));
        const isLastHk  = (config.hk && config.hk.grokLastSlide && hotkeyMatches(e, config.hk.grokLastSlide)) ||
                          (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'Digit4' || e.key === '4'));

        if (!isFirstHk && !isBackHk && !isFwdHk && !isLastHk) {
            if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[5-9]$/.test(e.code || '')) {
                if (config.grokCollapsePromptOnNav !== false && isGrokPromptActive()) {
                    grokCollapsePrompt();
                }
            }
            return;
        }

        // ТРЕБОВАНИЕ: первое нажатие, когда мы внутри промпта — СВОРАЧИВАЕТ промпт и не переходит
        if (isGrokPromptActive()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            grokCollapsePrompt();
            showToast('🔽 Промпт свёрнут');
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        if (config.grokCollapsePromptOnNav !== false) {
            grokCollapsePrompt();
        }

        const isSsRunning = !!(window._mossadGalleryActive || slideshowActive);

        if (isSsRunning) {
            // v1.3.94: Во время слайд-шоу клавиши Alt+1..4 управляют показом слайд-шоу
            if (isFirstHk) {
                if (typeof grokGetPlaylistStructure === 'function' && window._mossadGalleryActive) {
                    const struct = grokGetPlaylistStructure();
                    if (struct && struct.items && struct.items[0]) {
                        if (typeof grokSpaNavigate === 'function') grokSpaNavigate(struct.items[0].url);
                        else window.location.href = struct.items[0].url;
                    }
                } else {
                    const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
                    if (items[0]) items[0].click();
                }
                showToast('⏮ Первый слайд плейлиста');
            } else if (isLastHk) {
                if (typeof grokGetPlaylistStructure === 'function' && window._mossadGalleryActive) {
                    const struct = grokGetPlaylistStructure();
                    if (struct && struct.items && struct.items.length) {
                        const last = struct.items[struct.items.length - 1];
                        if (typeof grokSpaNavigate === 'function') grokSpaNavigate(last.url);
                        else window.location.href = last.url;
                    }
                } else {
                    const items = typeof grokGetFilmstripItems === 'function' ? grokGetFilmstripItems() : [];
                    if (items.length) items[items.length - 1].click();
                }
                showToast('⏭ Последний слайд плейлиста');
            } else if (isBackHk) {
                if (rootDomain === 'grok.com' && typeof grokStepFilmstrip === 'function' && !window._mossadGalleryActive) {
                    grokStepFilmstrip(false);
                } else if (typeof triggerRewind === 'function') {
                    triggerRewind();
                } else if (typeof prevSlide === 'function') {
                    prevSlide();
                }
                showToast('⏮ Предыдущий слайд показа');
            } else if (isFwdHk) {
                if (rootDomain === 'grok.com' && typeof grokStepFilmstrip === 'function' && !window._mossadGalleryActive) {
                    grokStepFilmstrip(true);
                } else if (typeof triggerNextSlide === 'function') {
                    triggerNextSlide();
                } else if (typeof nextSlide === 'function') {
                    nextSlide();
                }
                showToast('⏭ Следующий слайд показа');
            }
            setTimeout(() => { if (typeof updateGrokHistoryPill === 'function') updateGrokHistoryPill(); }, 150);
            return;
        }

        if (isFirstHk) {
            grokJumpToFirstSlide();
        } else if (isLastHk) {
            grokJumpToLastSlide();
        } else if (isBackHk) {
            grokHistoryBack();
        } else if (isFwdHk) {
            grokHistoryForward();
        }
    }, true);

    // v1.4.3: Стрелки ←/→ внутри поля ввода промпта КАТЕГОРИЧЕСКИ НЕ ДОЛЖНЫ сворачивать/размывать промпт!
    // Обработчик handleGrokNavPromptCollapse полностью удалён.

    // ── Инициализация трекера истории ──
    function initGrokSlideHistory() {
        if (rootDomain !== 'grok.com') return;
        _onGrokSlideChanged();
        updateGrokHistoryPill();

        if (!_grokHistTickTimer) {
            _grokHistTickTimer = setInterval(() => {
                if (rootDomain !== 'grok.com') return;
                _onGrokSlideChanged();
                _checkCandidateCommit();
            }, 1000);
        }
    }

    function safeInitGrokSlideHistory() {
        try {
            initGrokSlideHistory();
        } catch (err) {
            console.error('[MOSSAD] initGrokSlideHistory error:', err);
        }
    }

    if (rootDomain === 'grok.com') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', safeInitGrokSlideHistory);
        } else {
            safeInitGrokSlideHistory();
        }
    }
