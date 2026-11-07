    // ============================================================
    // GROK: История просмотров слайдов (Alt+= / Alt+-) и умное сворачивание промпта (v1.3.89)
    // ============================================================

    const GROK_SLIDE_HIST_KEY = 'mossad_grok_slide_hist_v1';
    const GROK_HIST_MAX_AGE_MS = 60 * 60 * 1000; // 1 час — записи старше автоматически удаляются

    let _grokSlideHistIndex = -1;
    let _grokCandidateSlide = null;
    let _grokHistTickTimer = null;
    let _grokIsNavigatingHistory = false;

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
        // Эмуляция клика вне композера для сворачивания развёрнутого инпута Grok
        const neutral = document.querySelector('main, [role="main"], #root, body');
        if (neutral) {
            try {
                neutral.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
                neutral.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            } catch (e) {}
        }
    }

    // ── Хранилище истории ──
    function _loadGrokSlideHistory() {
        let list = [];
        try {
            const raw = sessionStorage.getItem(GROK_SLIDE_HIST_KEY);
            if (raw) list = JSON.parse(raw);
        } catch (e) { list = []; }

        const now = Date.now();
        // Автоматическая очистка записей старше 1 часа
        const fresh = list.filter(item => item && item.url && (now - item.ts < GROK_HIST_MAX_AGE_MS));
        if (fresh.length !== list.length) {
            _saveGrokSlideHistory(fresh);
        }
        return fresh;
    }

    function _saveGrokSlideHistory(list) {
        try {
            sessionStorage.setItem(GROK_SLIDE_HIST_KEY, JSON.stringify(list));
        } catch (e) {}
    }

    // ── Запись слайда при задержке >= N сек ──
    function _checkCandidateCommit() {
        if (!_grokCandidateSlide || _grokCandidateSlide.committed) return;
        const dwellSec = Math.max(1, Math.min(60, Number(config.grokHistoryDwellSec) || 5));
        const elapsed = Date.now() - _grokCandidateSlide.startTime;
        if (elapsed < dwellSec * 1000) return;

        _grokCandidateSlide.committed = true;
        const history = _loadGrokSlideHistory();
        const currentUrl = _grokCandidateSlide.url;

        // Если последний элемент истории уже этот URL — не дублируем
        if (history.length > 0 && history[history.length - 1].url === currentUrl) {
            _grokSlideHistIndex = history.length - 1;
            return;
        }

        const newEntry = {
            url: currentUrl,
            path: _grokCandidateSlide.path,
            uuid: _grokCandidateSlide.uuid,
            ts: Date.now()
        };

        // Если листали назад в истории и задержались на новом кадре — отрезаем хвост вперёд
        if (_grokSlideHistIndex >= 0 && _grokSlideHistIndex < history.length - 1) {
            history.splice(_grokSlideHistIndex + 1);
        }

        history.push(newEntry);
        _grokSlideHistIndex = history.length - 1;
        _saveGrokSlideHistory(history);
    }

    function _onGrokSlideChanged() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        const url = location.href;
        const path = location.pathname;
        const uuid = typeof grokExtractUuid === 'function' ? grokExtractUuid(path) : '';

        if (_grokCandidateSlide && _grokCandidateSlide.url === url) return;

        _grokCandidateSlide = {
            url,
            path,
            uuid,
            startTime: Date.now(),
            committed: false
        };
    }

    // ── Навигация по истории ──
    function grokNavigateToSlide(target) {
        if (!target || !target.url) return;
        _grokIsNavigatingHistory = true;
        setTimeout(() => { _grokIsNavigatingHistory = false; }, 800);

        // 1. Попытка нативного переключения через киноплёнку filmstrip
        if (target.uuid && typeof grokFindFilmstripItemByUuid === 'function') {
            const btn = grokFindFilmstripItemByUuid(target.uuid);
            if (btn) {
                btn.click();
                try { history.replaceState(null, '', target.path || target.url); } catch (e) {}
                return;
            }
        }

        // 2. Если кадра нет в текущей киноплёнке — плавный переход по ссылке или SPA
        if (typeof grokSpaNavigate === 'function') {
            grokSpaNavigate(target.url);
        } else {
            window.location.href = target.url;
        }
    }

    function grokHistoryBack() {
        const history = _loadGrokSlideHistory();
        if (history.length === 0) {
            showToast('⏮ История слайдов пуста', true);
            return;
        }

        // Если индекс не инициализирован — начинаем с текущего
        if (_grokSlideHistIndex < 0 || _grokSlideHistIndex >= history.length) {
            _grokSlideHistIndex = history.length - 1;
        }

        // Если мы стоим на самом последнем и он совпадает с текущим URL — шагаем на 1 назад
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
    }

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
    }

    // ── Перехват хоткеев Alt+= и Alt+- (с поддержкой первого нажатия в промпте) ──
    window.addEventListener('keydown', function handleGrokHistoryNavKeys(e) {
        if (rootDomain !== 'grok.com') return;

        // При Alt+1..Alt+9 сворачиваем промпт, если включено в настройках
        if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code || '')) {
            if (config.grokCollapsePromptOnNav !== false) {
                grokCollapsePrompt();
            }
            return;
        }

        const isBackHk = (config.hk && config.hk.grokHistBack && hotkeyMatches(e, config.hk.grokHistBack)) ||
                         (e.altKey && (e.key === '=' || e.code === 'Equal')) ||
                         (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === '=' || e.code === 'Equal') && !isEditableElement(document.activeElement));
        const isFwdHk = (config.hk && config.hk.grokHistFwd && hotkeyMatches(e, config.hk.grokHistFwd)) ||
                        (e.altKey && (e.key === '-' || e.code === 'Minus')) ||
                        (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && (e.key === '-' || e.code === 'Minus') && !isEditableElement(document.activeElement));

        if (!isBackHk && !isFwdHk) return;

        // Требование пользователя: первое нажатие, когда мы внутри промпта — СВОРАЧИВАЕТ промпт и не переходит
        if (isGrokPromptActive()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            grokCollapsePrompt();
            showToast('🔽 Промпт свёрнут');
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        // Если включена опция сворачивания промпта при листании
        if (config.grokCollapsePromptOnNav !== false) {
            grokCollapsePrompt();
        }

        if (isBackHk) {
            grokHistoryBack();
        } else {
            grokHistoryForward();
        }
    }, true);

    // ── Авто-сворачивание промпта при навигации стрелками / PageUp / PageDown ──
    window.addEventListener('keydown', function handleGrokNavPromptCollapse(e) {
        if (rootDomain !== 'grok.com' || config.grokCollapsePromptOnNav === false) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === 'PageUp') {
            if (isGrokPromptActive()) {
                grokCollapsePrompt();
            }
        }
    }, false);

    // ── Инициализация трекера истории ──
    function initGrokSlideHistory() {
        if (rootDomain !== 'grok.com') return;
        _onGrokSlideChanged();

        if (!_grokHistTickTimer) {
            _grokHistTickTimer = setInterval(() => {
                if (rootDomain !== 'grok.com') return;
                _onGrokSlideChanged();
                _checkCandidateCommit();
            }, 1000);
        }
    }

    if (rootDomain === 'grok.com') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGrokSlideHistory);
        } else {
            initGrokSlideHistory();
        }
    }
