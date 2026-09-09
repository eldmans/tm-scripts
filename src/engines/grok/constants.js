    // ============================================================
    // GROK ENGINE: Constants & Page Predicates
    // ============================================================
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const GALLERY_LOOP_KEY       = 'mossad_grok_loop_set';
    const _gSS                   = sessionStorage; // короткий псевдоним

    /** Проверка: находимся ли мы на странице поста Grok Imagine */
    function isGrokPostPage() {
        return rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    }

    /** Проверка: находимся ли мы на странице сохраненных постов Grok Imagine */
    function isGrokSavedPage() {
        return rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);
    }
