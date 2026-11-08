    // ============================================
    // BOOT (v1.3.54): первый модуль внутри mossadMain() — выполняется только на сайтах из списка
    // ============================================
    // build.py оборачивает всё после src/core/domain.js в function mossadMain() { … } и вызывает её
    // после проверки сайта. На чужих сайтах V8 только пробегает тело (pre-parse) и ничего не создаёт.
    // Код из domain.js (снаружи) не видит функций отсюда — нужное передаём через переменные-крючки.
    // ── v1.4.4: Ключи сессии и глобальные флаги слайд-шоу ──
    // Объявляются через var в самом начале mossadMain(), чтобы избежать
    // Temporal Dead Zone (TDZ) ReferenceError при обращении из ранних модулей Grok/UI.
    var SESSION_ACTIVE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_active`;
    var SESSION_STATE_KEY  = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_wstate`;
    var SESSION_PAUSED_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_paused`;
    var SESSION_NAV_KEY    = 'mossad_navigating';
    var slideshowActive    = sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true';
    var slideshowPaused    = sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true';

    mossadOpenSettingsHook = openSettingsWindow;
    // v1.3.67: настройки скорости видео (лёгкий слой) сверяют клавиши с хоткеями MOSSAD
    mossadLightHkHook = {
        comboId: (b) => hotkeyComboId(b),
        owners: (b) => {
            const id = hotkeyComboId(b);
            if (!id || !config.hk) return [];
            return Object.keys(config.hk).filter(k => hotkeyComboId(config.hk[k]) === id)
                .map(k => ({ label: 'MOSSAD: ' + k, clear: () => { config.hk[k] = normalizeHotkeyBinding(null); Settings.save(); } }));
        },
    };
    if (mossadIsBuiltinHost(hostname)) mossadRegisterSiteMenu(); // «🌍 Сайты MOSSAD» (до v1.3.54 регистрировалась сразу)

    // Список изменили в другой вкладке/контейнере — обновить подпись команды меню и вкладку «🌍 Сайты»
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(MOSSAD_SITES_GM_KEY, (name, oldVal, newVal, remote) => {
                if (!remote) return;
                mossadRegisterSiteMenu();
                try { mossadSitesRerender(); } catch (e) {}
            });
        } catch (e) {}
    }
