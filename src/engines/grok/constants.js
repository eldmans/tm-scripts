    // ============================================================
    // GROK ENGINE: Constants & Page Predicates
    // ============================================================
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const GALLERY_LOOP_KEY       = 'mossad_grok_loop_set';
    const GALLERY_COLLECT_ACTIVE_KEY = 'mossad_grok_collect_active'; // флаг автосбора ссылок
    const _gSS                   = sessionStorage; // короткий псевдоним
    // v1.3.42: кадры киноплёнки (в них бывают <video>/<img> других генераций — это не медиа текущего поста)
    const GROK_FILMSTRIP_SEL     = '[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]';

    /** Проверка: находимся ли мы на странице поста Grok Imagine */
    function isGrokPostPage() {
        return rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    }

    /** Проверка: находимся ли мы на странице сохраненных постов Grok Imagine */
    function isGrokSavedPage() {
        return rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);
    }

    /** Проверка: находимся ли мы в разделе Library (новый интерфейс Grok) */
    function isGrokLibraryPage() {
        return rootDomain === 'grok.com' && /^\/library(?:\/|$)/.test(location.pathname);
    }

    // ============================================================
    // v1.4.36: Режим интерфейса Grok (auto | old | new) — строго per-container в localStorage
    // ============================================================
    const GROK_UI_MODE_LS_KEY = 'mossad_grok_ui_mode';
    const GROK_UI_DETECTED_LS_KEY = 'mossad_grok_ui_detected';
    const GROK_UI_DWELL_MS = 2000;

    let _grokPathTracker = location.pathname;
    let _grokPathEnteredAt = Date.now();
    let _grokDwellTimer = null;

    function _grokTouchPathTracker() {
        if (location.pathname !== _grokPathTracker) {
            _grokPathTracker = location.pathname;
            _grokPathEnteredAt = Date.now();
            if (_grokDwellTimer) { clearTimeout(_grokDwellTimer); _grokDwellTimer = null; }
            if (rootDomain === 'grok.com' && (/^\/library(?:\/|$)/.test(_grokPathTracker) || /^\/imagine(?:\/|$)/.test(_grokPathTracker))) {
                _grokDwellTimer = setTimeout(() => {
                    _grokDwellTimer = null;
                    grokDetectAutoUiMode();
                    grokRefreshUiModeBadges();
                }, GROK_UI_DWELL_MS + 100);
            }
        }
    }

    function grokGetUiMode() {
        try {
            const v = localStorage.getItem(GROK_UI_MODE_LS_KEY);
            if (v === 'old' || v === 'new' || v === 'auto') return v;
        } catch (e) {}
        return 'auto';
    }

    function grokRefreshUiModeBadges() {
        const manual = grokGetUiMode();
        const eff = grokEffectiveUiMode();
        document.querySelectorAll('.mossad-grok-ui-btn').forEach(btn => {
            const on = btn.dataset.mode === manual;
            btn.style.background = on ? (manual === 'new' ? '#059669' : manual === 'old' ? '#d97706' : '#2563eb') : '#1f2937';
            btn.style.color = on ? '#ffffff' : '#9ca3af';
            btn.style.borderColor = on ? '#93c5fd' : '#374151';
            btn.style.fontWeight = on ? '700' : '500';
        });
        document.querySelectorAll('.mossad-grok-ui-eff').forEach(el => {
            el.textContent = eff === 'new' ? 'New (/library)' : 'Old (/imagine)';
            el.style.color = eff === 'new' ? '#34d399' : '#fbbf24';
        });
    }

    function grokSetUiMode(mode) {
        const m = (mode === 'old' || mode === 'new') ? mode : 'auto';
        try { localStorage.setItem(GROK_UI_MODE_LS_KEY, m); } catch (e) {}
        grokRefreshUiModeBadges();
        return m;
    }

    function grokDomNavSignals() {
        let hasImagine = false;
        let hasLibrary = false;
        try {
            const links = document.querySelectorAll('a[href], nav button, aside button, [role="navigation"] button');
            for (const el of links) {
                if (el.closest && el.closest('[id^="mossad"]')) continue;
                if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) continue;
                const href = (el.getAttribute('href') || '').trim();
                const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
                if (/^\/imagine(?:\/|$|\?)/.test(href) || /^(?:imagine|воображение)$/i.test(label)) {
                    hasImagine = true;
                }
                if (/^\/library(?:\/|$|\?)/.test(href) || /^(?:library|библиотека)$/i.test(label)) {
                    hasLibrary = true;
                }
            }
        } catch (e) {}
        return { hasImagine, hasLibrary };
    }

    function _grokCacheDetectedMode(mode) {
        try { localStorage.setItem(GROK_UI_DETECTED_LS_KEY, mode); } catch (e) {}
    }

    function grokDetectAutoUiMode() {
        if (rootDomain !== 'grok.com') return 'old';
        _grokTouchPathTracker();
        const dwellMs = Date.now() - _grokPathEnteredAt;
        const path = location.pathname;

        if (/^\/imagine\/(?:post|saved)/.test(path)) {
            if (dwellMs >= GROK_UI_DWELL_MS) _grokCacheDetectedMode('old');
            return 'old';
        }
        if (/^\/imagine(?:\/|$)/.test(path)) {
            if (dwellMs >= GROK_UI_DWELL_MS) _grokCacheDetectedMode('old');
            return 'old';
        }
        if (/^\/library(?:\/|$)/.test(path)) {
            if (dwellMs >= GROK_UI_DWELL_MS) _grokCacheDetectedMode('new');
            return 'new';
        }

        const sig = grokDomNavSignals();
        if (sig.hasImagine) {
            _grokCacheDetectedMode('old');
            return 'old';
        }
        if (sig.hasLibrary && !sig.hasImagine) {
            _grokCacheDetectedMode('new');
            return 'new';
        }

        try {
            const cached = localStorage.getItem(GROK_UI_DETECTED_LS_KEY);
            if (cached === 'new' || cached === 'old') return cached;
        } catch (e) {}
        return 'old';
    }

    function grokEffectiveUiMode() {
        const manual = grokGetUiMode();
        if (manual === 'old' || manual === 'new') return manual;
        return grokDetectAutoUiMode();
    }

    if (rootDomain === 'grok.com' && typeof window !== 'undefined') {
        if (/^\/library(?:\/|$)/.test(location.pathname) || /^\/imagine(?:\/|$)/.test(location.pathname)) {
            _grokDwellTimer = setTimeout(() => {
                _grokDwellTimer = null;
                grokDetectAutoUiMode();
                grokRefreshUiModeBadges();
            }, GROK_UI_DWELL_MS + 100);
        }
        try {
            const wrapHist = (orig) => function (...args) {
                const res = orig.apply(this, args);
                _grokTouchPathTracker();
                return res;
            };
            if (history && history.pushState) history.pushState = wrapHist(history.pushState);
            if (history && history.replaceState) history.replaceState = wrapHist(history.replaceState);
            window.addEventListener('popstate', _grokTouchPathTracker);
        } catch (e) {}
    }

    window.isGrokLibraryPage = isGrokLibraryPage;
    window.grokGetUiMode = grokGetUiMode;
    window.grokSetUiMode = grokSetUiMode;
    window.grokEffectiveUiMode = grokEffectiveUiMode;
    window.grokRefreshUiModeBadges = grokRefreshUiModeBadges;

    if (typeof MossadEngineRegistry !== 'undefined') {
        MossadEngineRegistry.register('grok', {
            id: 'grok',
            isSupported: () => rootDomain === 'grok.com'
        });
    }
