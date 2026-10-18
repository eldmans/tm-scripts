    // ============================================================
    // GROK: Filmstrip (Киноплёнка) & Intra-group Navigation Helpers
    // ============================================================

    /**
     * Извлекает 36-значный UUID генерации из URL или пути к ассету.
     */
    function grokExtractUuid(urlOrStr) {
        if (!urlOrStr) return '';
        const m = urlOrStr.match(/(?:post|generated)\/([a-f0-9-]{36})/i);
        return m ? m[1].toLowerCase() : '';
    }

    /**
     * Возвращает массив кнопок кадров на полосе киноплёнки (filmstrip).
     */
    function grokGetFilmstripItems() {
        return Array.from(document.querySelectorAll('[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]'));
    }

    /**
     * Находит кнопку в киноплёнке по UUID генерации.
     * Возвращает элемент ТОЛЬКО если он реально присутствует на текущей киноплёнке.
     */
    function grokFindFilmstripItemByUuid(uuid) {
        if (!uuid) return null;
        const items = grokGetFilmstripItems();
        if (items.length === 0) return null;
        const cleanUuid = uuid.toLowerCase();
        return items.find(btn => {
            const img = btn.querySelector('img, video, source');
            if (img && img.src && img.src.toLowerCase().includes(cleanUuid)) return true;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes(cleanUuid)) return true;
            const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
            if (dataId && dataId.includes(cleanUuid)) return true;
            return false;
        }) || null;
    }

    /**
     * Находит индекс активного (выбранного) кадра на киноплёнке.
     */
    function grokGetActiveFilmstripIndex() {
        const items = grokGetFilmstripItems();
        if (items.length === 0) return -1;

        // 1. По классу выделения (ring-white, border-white, aria-selected="true") БЕЗ ложных Tailwind focus:*
        const activeByClass = items.findIndex(btn => {
            if (btn.getAttribute('aria-selected') === 'true') return true;
            const cls = btn.className || '';
            const tokens = cls.split(/\s+/);
            return tokens.some(t => /^(ring-white|border-white|ring-2|ring-4|active)$/i.test(t));
        });
        if (activeByClass !== -1) return activeByClass;

        // 2. По совпадению UUID ассета с текущим URL (fallback если класс ещё не применился)
        const curUuid = grokExtractUuid(location.pathname);
        if (curUuid) {
            const activeByMatch = items.findIndex(btn => {
                const imgSrc = btn.querySelector('img, video, source')?.src || '';
                const genMatch = imgSrc.match(/generated\/([a-f0-9-]+)\//)?.[1];
                if (genMatch && curUuid.includes(genMatch.toLowerCase())) return true;
                if (imgSrc.toLowerCase().includes(curUuid)) return true;
                const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
                if (dataId && dataId.includes(curUuid)) return true;
                return false;
            });
            if (activeByMatch !== -1) return activeByMatch;
        }

        return -1;
    }

    /**
     * Шаг по киноплёнке (вперёд: down/right, назад: up/left).
     * Возвращает:
     * - true: клик выполнен успешно
     * - 'end': достигнут край киноплёнки при выключенном R (config.loopFeed)
     * - false: нет киноплёнки или одиночный кадр
     */
    function grokStepFilmstrip(isNext = true) {
        const items = grokGetFilmstripItems();
        if (items.length <= 1) return false;
        const curIdx = grokGetActiveFilmstripIndex();
        const safeCurIdx = curIdx !== -1 ? curIdx : 0;
        const loop = !!config.loopFeed;

        let nextIdx;
        let reachedEnd = false;

        if (isNext) {
            if (safeCurIdx + 1 < items.length) {
                nextIdx = safeCurIdx + 1;
            } else {
                reachedEnd = true;
                if (loop) {
                    nextIdx = 0;
                } else {
                    return 'end'; // Достигнут конец, повтор выключен
                }
            }
        } else {
            if (safeCurIdx > 0) {
                nextIdx = safeCurIdx - 1;
            } else {
                reachedEnd = true;
                if (loop) {
                    nextIdx = items.length - 1;
                } else {
                    return 'end'; // Достигнуто начало, повтор выключен
                }
            }
        }

        if (nextIdx >= 0 && nextIdx < items.length) {
            items[nextIdx].click();
            if (reachedEnd && loop) {
                showToast('🔄 Конец киноплёнки: повтор (R)...');
            }
            setTimeout(() => {
                grokHighlightActivePlaylistItem();
            }, 120);
            return true;
        }

        return false;
    }
