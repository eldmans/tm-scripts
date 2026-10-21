    // ============================================
    // BOOT (v1.3.54): первый модуль внутри mossadMain() — выполняется только на сайтах из списка
    // ============================================
    // build.py оборачивает всё после src/core/domain.js в function mossadMain() { … } и вызывает её
    // после проверки сайта. На чужих сайтах V8 только пробегает тело (pre-parse) и ничего не создаёт.
    // Код из domain.js (снаружи) не видит функций отсюда — нужное передаём через переменные-крючки.
    mossadOpenSettingsHook = openSettingsWindow;
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
