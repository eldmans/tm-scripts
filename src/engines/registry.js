    // ============================================
    // DOMAIN ENGINE REGISTRY & LIFECYCLE (v1.4.18)
    // ============================================
    // Централизованный реестр специализированных движков сайтов (Grok, Pinterest, RedGifs,
    // Instagram, HuggingFace, Faphouse, xVideos, xHamster и др.).
    // Гарантирует On-Demand инициализацию: наблюдатели (MutationObserver), перехватчики сетевых
    // запросов (fetch/XHR) и слушатели горячих клавиш конкретной платформы инициализируются
    // ТОЛЬКО на поддерживаемых доменах.
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};

    const MossadEngineRegistry = {
        /**
         * Регистрация движка в реестре
         * @param {string} id - уникальный идентификатор (например, 'grok', 'pinterest')
         * @param {object} engineDef - объект с методами isSupported(), init(), findMedia() и т.д.
         */
        register(id, engineDef) {
            if (!id || !engineDef) return;
            window.MOSSAD_ENGINES[id] = engineDef;
            if (!engineDef.id) engineDef.id = id;
        },

        /**
         * Получение движка по ID
         */
        get(id) {
            return window.MOSSAD_ENGINES[id] || null;
        },

        /**
         * Получение активного движка для текущего сайта (первый, чьё isSupported() === true)
         */
        getActiveEngine() {
            for (const key of Object.keys(window.MOSSAD_ENGINES)) {
                const eng = window.MOSSAD_ENGINES[key];
                if (eng && typeof eng.isSupported === 'function') {
                    try {
                        if (eng.isSupported()) return eng;
                    } catch (e) {
                        console.warn(`[MOSSAD/Registry] Ошибка isSupported в движке ${key}:`, e);
                    }
                }
            }
            return null;
        },

        /**
         * Инициализация активного движка (вызывается один раз при старте MOSSAD)
         */
        initActiveEngine() {
            const active = this.getActiveEngine();
            if (active) {
                if (typeof active.init === 'function') {
                    try {
                        active.init();
                        console.log(`%c[MOSSAD/Engine] Инициализирован движок: ${active.id || 'unnamed'}`, 'color:#3b82f6;font-weight:bold;');
                    } catch (err) {
                        console.error(`[MOSSAD/Engine] Ошибка инициализации движка ${active.id}:`, err);
                    }
                }
            }
        }
    };
