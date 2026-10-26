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

    /**
     * v1.3.70: Универсальный запуск генерации / отправки промпта на Grok по Ctrl+Enter.
     * Стабильный маркер кнопки: SVG <g id="name=arrow-up"> или path d="...5V19...".
     * Работает из любого места (внутри textarea, настроек, кнопок и т.д.)
     */
    function triggerGrokSubmit() {
        if (rootDomain !== 'grok.com') return false;

        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        let submitBtn = buttons.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            if (b.querySelector('g#name\\=arrow-up, g[id*="arrow-up"]')) return true;
            const path = b.querySelector('path');
            const d = path ? (path.getAttribute('d') || '') : '';
            return (d.includes('M6 11L12 5') || d.includes('5V19')) && (b.closest('div.query-bar') || b.closest('div.relative.z-10') || (b.className && b.className.includes('rounded-full')));
        });

        if (!submitBtn) {
            submitBtn = buttons.find(b => {
                if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const type = (b.getAttribute('type') || '').toLowerCase();
                if (type === 'submit' && (b.closest('div.query-bar') || b.closest('form') || b.closest('div.relative.z-10'))) return true;
                return (aria === 'submit' || aria === 'make video' || aria === 'edit' || aria.includes('send') || aria.includes('отправить')) &&
                       (b.closest('div.query-bar') || b.closest('div.relative.z-10') || (b.className && b.className.includes('rounded-full')));
            });
        }

        if (!submitBtn) {
            submitBtn = document.querySelector('div.query-bar button[type="submit"], div.query-bar div.relative.z-10 button');
        }

        if (submitBtn) {
            if (submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true') {
                showToast('⚠️ Кнопка отправки Grok неактивна (введите промпт)', true);
                return true;
            }
            triggerClick(submitBtn, 'Grok Universal Submit (Ctrl+Enter)');
            showToast('🚀 Запрос Grok отправлен!');
            return true;
        }

        return false;
    }
    window.triggerGrokSubmit = triggerGrokSubmit;
