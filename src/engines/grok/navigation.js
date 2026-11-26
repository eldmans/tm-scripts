    // ============================================================
    // GROK: навигация в Saved (/imagine/saved) и Library (/library)
    // (v1.3.40: кнопки/хоткеи генерации видео 6s / 10s удалены вместе с video-gen.js)
    // ============================================================

    function _grokScrollTopSmooth() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
        const scrollables = document.querySelectorAll('main, [role="main"], [data-scroll-container], div[class*="overflow-y"]');
        scrollables.forEach(el => {
            if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /**
     * Навигация в новый раздел Library Grok (/library) из любого места grok.com.
     * Если уже на /library — плавно скроллит в начало ленты.
     */
    function grokNavigateToLibrary() {
        if (typeof isGrokLibraryPage === 'function' && isGrokLibraryPage()) {
            _grokScrollTopSmooth();
            showToast('🔝 В начало Library Grok');
            return;
        }

        showToast('📂 Переход в Library Grok...');

        const libLink = Array.from(document.querySelectorAll('a[href="/library"], a[href^="/library"]'))
            .find(a => !a.closest || !a.closest('[id^="mossad"]'));
        if (libLink) {
            try {
                libLink.click();
                setTimeout(() => {
                    if (typeof isGrokLibraryPage === 'function' && !isGrokLibraryPage()) {
                        window.location.href = 'https://grok.com/library';
                    }
                }, 250);
                return;
            } catch (e) {}
        }

        window.location.href = 'https://grok.com/library';
    }
    window.grokNavigateToLibrary = grokNavigateToLibrary;

    /**
     * Универсальная навигация в Saved (/imagine/saved) или Library (/library) в зависимости от режима интерфейса.
     * Если уже на целевой странице — плавно скроллит в начало ленты.
     */
    function grokNavigateToSaved() {
        const mode = (typeof grokEffectiveUiMode === 'function') ? grokEffectiveUiMode() : 'old';
        if (mode === 'new') {
            grokNavigateToLibrary();
            return;
        }

        if (isGrokSavedPage()) {
            _grokScrollTopSmooth();
            showToast('🔝 В начало Saved Grok');
            return;
        }

        showToast('📂 Переход в Saved Grok...');

        // 1. Попытка нативного SPA перехода через ссылку в DOM
        const savedLink = Array.from(document.querySelectorAll('a[href="/imagine/saved"], a[href*="/imagine/saved"]'))
            .find(a => !a.closest || !a.closest('[id^="mossad"]'));
        if (savedLink) {
            try {
                savedLink.click();
                setTimeout(() => {
                    if (!isGrokSavedPage()) {
                        window.location.href = 'https://grok.com/imagine/saved';
                    }
                }, 250);
                return;
            } catch(e) {}
        }

        // 2. Прямой переход по URL
        window.location.href = 'https://grok.com/imagine/saved';
    }
    window.grokNavigateToSaved = grokNavigateToSaved;
