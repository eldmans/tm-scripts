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
