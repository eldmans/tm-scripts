// ============================================================
    // GROK HELPERS: Button Finders (см. также sound / upscale / media / download / filmstrip / navigation)
    // ============================================================

    /**
     * Поиск кнопки/кликабельного элемента по ключевым словам (aria-label, title, textContent).
     * Регистронезависимый (case-insensitive) поиск, универсален для RU/EN.
     */
    function findGrokButton(keywords, rootEl = document) {
        if (!Array.isArray(keywords)) keywords = [keywords];
        const lowerKeywords = keywords.map(k => k.toLowerCase().trim());
        const candidates = Array.from(rootEl.querySelectorAll('button, [role="button"], [role="menuitem"], a'));
        return candidates.find(el => {
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) return false;
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const txt = (el.textContent || '').trim().toLowerCase();
            return lowerKeywords.some(k => aria.includes(k) || title.includes(k) || txt.includes(k));
        }) || null;
    }

    /**
     * Находит кнопку «три точки» (меню действий с постом) в Grok.
     */
    function findGrok3DotsMenuButton() {
        // 1. Поиск по aria-label и тексту
        const byLabel = findGrokButton([
            'действия с постом', 'post actions', 'more options', 'more', 'ещё', 'три точки'
        ]);
        if (byLabel) return byLabel;

        // 2. Поиск по SVG иконке (кнопка с 3 точками / кругами)
        return Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes('post') || aria.includes('действи') || aria.includes('more')) return true;
            const svgs = b.querySelectorAll('svg');
            for (const svg of svgs) {
                if (svg.querySelectorAll('circle').length >= 3) return true;
                const path = svg.querySelector('path');
                const d = path ? (path.getAttribute('d') || '') : '';
                if (d.includes('M12') && d.includes('C12')) return true;
            }
            return false;
        }) || null;
    }
