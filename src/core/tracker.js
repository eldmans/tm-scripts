// ============================================================================
// MOSSAD USAGE TRACKER («Дяденька с блокнотом»)
// Тихий локальный логер кликов и хоткеев для анализа реальной эргономики
// Хранит счётчики использования элементов в GM: mossad_usage_stats
// ============================================================================

(function initMossadTracker() {
    const TRACKER_STORAGE_KEY = 'mossad_usage_stats';
    let _statsCache = null;
    let _saveTimer = null;

    function getStats() {
        if (!_statsCache) {
            try {
                if (typeof GM_getValue === 'function') {
                    _statsCache = GM_getValue(TRACKER_STORAGE_KEY, {});
                } else {
                    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
                    _statsCache = raw ? JSON.parse(raw) : {};
                }
            } catch (e) {
                _statsCache = {};
            }
        }
        return _statsCache;
    }

    function saveStats() {
        if (!_statsCache) return;
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(TRACKER_STORAGE_KEY, _statsCache);
            } else {
                localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(_statsCache));
            }
        } catch (e) {}
    }

    function scheduleSave() {
        if (_saveTimer) return;
        _saveTimer = setTimeout(() => {
            _saveTimer = null;
            saveStats();
        }, 5000);
    }

    window.mossadTrackEvent = function(category, id) {
        if (!category || !id) return;
        const stats = getStats();
        if (!stats[category]) stats[category] = {};
        if (!stats[category][id]) stats[category][id] = { count: 0, firstUsed: Date.now() };
        stats[category][id].count = (stats[category][id].count || 0) + 1;
        stats[category][id].lastUsed = Date.now();
        scheduleSave();
    };

    window.mossadGetStats = function() {
        return getStats();
    };

    // Слушатель кликов по элементам MOSSAD (виджет, окно настроек, плашки)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button, [data-mossad-track], .mossad-trackable');
        if (!btn) return;
        const id = btn.id || btn.getAttribute('data-mossad-label') || btn.title || btn.textContent.trim().slice(0, 20);
        if (id && (btn.closest('#mossad-widget-container') || btn.closest('#mossad-hk-modal') || (btn.id && btn.id.startsWith('mossad-')))) {
            window.mossadTrackEvent('click', id);
        }
    }, true);

    window.addEventListener('beforeunload', saveStats);
})();
