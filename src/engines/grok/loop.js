    // ============================================================
    // GROK ENGINE: Loop R State Manager (Unified Storage & Lookup)
    // ============================================================

    function getGrokLoopSet() {
        const raw = _gSS.getItem(GALLERY_LOOP_KEY);
        if (!raw) return { urls: [], groupIds: [] };
        try {
            const parsed = JSON.parse(raw);
            return {
                urls: Array.isArray(parsed.urls) ? parsed.urls : [],
                groupIds: Array.isArray(parsed.groupIds) ? parsed.groupIds : []
            };
        } catch {
            return { urls: [], groupIds: [] };
        }
    }

    function saveGrokLoopSet(loopSet) {
        _gSS.setItem(GALLERY_LOOP_KEY, JSON.stringify(loopSet));
    }

    function clearGrokLoopSet() {
        _gSS.removeItem(GALLERY_LOOP_KEY);
    }

    function isGrokItemLooped(url, loopSet = null) {
        if (!url) return false;
        const set = loopSet || getGrokLoopSet();
        const baseUrl = url.split('?')[0];
        return set.urls.some(u => (u || '').split('?')[0] === baseUrl);
    }

    function isGrokGroupLooped(convId, loopSet = null) {
        if (!convId || convId === '__noconv__') return false;
        const set = loopSet || getGrokLoopSet();
        return set.groupIds.includes(convId);
    }

    function getGrokActiveLoopItems(allItems) {
        const set = getGrokLoopSet();
        if (set.urls.length === 0 && set.groupIds.length === 0) return [];
        return allItems.filter(it => {
            const baseUrl = (it.url || '').split('?')[0];
            const inUrls = set.urls.some(u => (u || '').split('?')[0] === baseUrl);
            const inGrps = it.convId && set.groupIds.includes(it.convId);
            return inUrls || inGrps;
        });
    }
