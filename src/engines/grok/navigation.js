    // ============================================================
    // GROK: навигация в Saved (/imagine/saved)
    // (v1.3.40: кнопки/хоткеи генерации видео 6s / 10s удалены вместе с video-gen.js)
    // ============================================================

    /**
     * Универсальная навигация в Saved Grok (/imagine/saved) из любого места grok.com.
     * Если уже на /imagine/saved — плавно скроллит в начало ленты.
     */
    function grokNavigateToSaved() {
        if (isGrokSavedPage()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
            const scrollables = document.querySelectorAll('main, [role="main"], [data-scroll-container], div[class*="overflow-y"]');
            scrollables.forEach(el => {
                if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
            });
            showToast('🔝 В начало Saved Grok');
            return;
        }

        showToast('📂 Переход в Saved Grok...');

        // 1. Попытка нативного SPA перехода через ссылку в DOM
        const savedLink = document.querySelector('a[href="/imagine/saved"], a[href*="/imagine/saved"]');
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
