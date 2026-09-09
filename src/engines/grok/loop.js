    // ============================================================
    // GROK ENGINE: Loop State Manager (R button in playlist & tick)
    // ============================================================

    /** Читает текущий объект loopSet из sessionStorage */
    function getGrokLoopSet() {
        try {
            const lr = _gSS.getItem(GALLERY_LOOP_KEY);
            if (lr) {
                const parsed = JSON.parse(lr);
                return {
                    urls: Array.isArray(parsed.urls) ? parsed.urls : [],
                    groupIds: Array.isArray(parsed.groupIds) ? parsed.groupIds : []
                };
            }
        } catch (e) {
            console.error('[MOSSAD] Failed to parse loop set:', e);
        }
        return { urls: [], groupIds: [] };
    }

    /** Сохраняет объект loopSet в sessionStorage */
    function saveGrokLoopSet(loopSet) {
        try {
            _gSS.setItem(GALLERY_LOOP_KEY, JSON.stringify(loopSet || { urls: [], groupIds: [] }));
        } catch (e) {
            console.error('[MOSSAD] Failed to save loop set:', e);
        }
    }

    /** Полная очистка всех зацикленных элементов */
    function clearGrokLoopSet() {
        saveGrokLoopSet({ urls: [], groupIds: [] });
    }

    /** Проверяет, зациклен ли URL поста */
    function isGrokUrlLooped(url, loopSet = null) {
        if (!url) return false;
        const ls = loopSet || getGrokLoopSet();
        const base = url.split('?')[0];
        return ls.urls.some(u => u.split('?')[0] === base);
    }

    /** Проверяет, зациклена ли группа */
    function isGrokGroupLooped(gid, loopSet = null) {
        if (!gid) return false;
        const ls = loopSet || getGrokLoopSet();
        return ls.groupIds.includes(gid);
    }

    /** Переключает зацикливание для URL. Возвращает новое состояние (true/false) */
    function toggleGrokUrlLoop(url) {
        const ls = getGrokLoopSet();
        const base = (url || '').split('?')[0];
        const idx = ls.urls.findIndex(u => u.split('?')[0] === base);
        let isActive = false;
        if (idx >= 0) {
            ls.urls.splice(idx, 1);
            isActive = false;
        } else {
            ls.urls.push(url);
            isActive = true;
        }
        saveGrokLoopSet(ls);
        return isActive;
    }

    /** Переключает зацикливание для группы (convId). Возвращает новое состояние (true/false) */
    function toggleGrokGroupLoop(gid) {
        const ls = getGrokLoopSet();
        const idx = ls.groupIds.indexOf(gid);
        let isActive = false;
        if (idx >= 0) {
            ls.groupIds.splice(idx, 1);
            isActive = false;
        } else {
            ls.groupIds.push(gid);
            isActive = true;
        }
        saveGrokLoopSet(ls);
        return isActive;
    }

    /** Возвращает количество всех активных зацикленных правил (url + groups) */
    function getGrokLoopCount(loopSet = null) {
        const ls = loopSet || getGrokLoopSet();
        return ls.urls.length + ls.groupIds.length;
    }

    /**
     * Извлекает список зацикленных элементов из полной коллекции.
     * Если ничего не зациклено — возвращает пустой массив.
     */
    function getGrokActiveLoopItems(allItems, loopSet = null) {
        const ls = loopSet || getGrokLoopSet();
        if (ls.urls.length === 0 && ls.groupIds.length === 0) return [];
        if (!Array.isArray(allItems) || allItems.length === 0) return [];

        const loopItems = [];
        for (const item of allItems) {
            const baseUrl = (item.url || '').split('?')[0];
            const inUrls = ls.urls.some(u => u.split('?')[0] === baseUrl);
            const inGroups = ls.groupIds.includes(item.convId || '__noconv__');
            if (inUrls || inGroups) {
                loopItems.push(item);
            }
        }
        return loopItems;
    }
