    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.3.59';
    console.log(`%c[MOSSAD v${SCRIPT_VERSION}] Скрипт загружен`, 'color:#10b981; font-weight:bold');

    const hostname = location.hostname.toLowerCase();
    
    function getRootDomain(host) {
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }
    const rootDomain = getRootDomain(hostname);
    const STORAGE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_config`;

    // ── v1.3.50: список сайтов MOSSAD ──
    // Встроенные сайты + свои сайты пользователя в GM-ключе `mossad_sites` (общий для всех сайтов и
    // контейнеров). Сравнение по суффиксу: host === d или host оканчивается на '.' + d
    // (раньше было hostname.includes(d) — «grok.com.evil.net» тоже проходил).
    // Старый per-site localStorage `allowedDomains` читается и переносится в GM, но больше не пишется.
    // Добавить/убрать сайт — команда в меню Tampermonkey или вкладка «🌍 Сайты» (Ctrl+F1).
    // На сайте не из списка скрипт регистрирует ТОЛЬКО команду меню: ни DOM, ни слушателей.
    const MOSSAD_BUILTIN_SITES = ['grok.com', 'redgifs.com', 'pinterest.com', 'pinterest.ru', 'civitai.red', 'vkvideo.ru', 'vk.video', 'noodlemagazine.com', 'instagram.com'];
    const MOSSAD_SITES_GM_KEY = 'mossad_sites';

    /** «https://www.Site.com:8080/path» → «site.com»; мусор → ''. */
    function mossadNormSite(s) {
        let d = String(s == null ? '' : s).trim().toLowerCase();
        d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
        d = d.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '').replace(/^www\./, '');
        return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(d) ? d : '';
    }
    function mossadHostMatches(host, site) {
        const d = mossadNormSite(site);
        const h = String(host || '').toLowerCase();
        return !!d && (h === d || h.endsWith('.' + d));
    }
    function mossadReadUserSites() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(MOSSAD_SITES_GM_KEY, null); } catch (e) {}
        let arr = raw;
        try { if (typeof raw === 'string') arr = JSON.parse(raw); } catch (e) { arr = null; }
        if (!Array.isArray(arr)) return [];
        const out = [];
        for (const x of arr) { const d = mossadNormSite(x); if (d && !out.includes(d)) out.push(d); }
        return out;
    }
    function mossadWriteUserSites(list) {
        const out = [];
        for (const x of (list || [])) { const d = mossadNormSite(x); if (d && !out.includes(d) && !MOSSAD_BUILTIN_SITES.includes(d)) out.push(d); }
        try { if (typeof GM_setValue === 'function') { GM_setValue(MOSSAD_SITES_GM_KEY, JSON.stringify(out)); return out; } } catch (e) {}
        return null;
    }
    function mossadIsBuiltinHost(host) { return MOSSAD_BUILTIN_SITES.some(d => mossadHostMatches(host, d)); }
    function mossadIsHostAllowed(host) { return mossadIsBuiltinHost(host) || mossadReadUserSites().some(d => mossadHostMatches(host, d)); }
    /** Добавить сайт в общий список. Возвращает нормализованный домен или '' (мусор/нет GM). */
    function mossadAddUserSite(site) {
        const d = mossadNormSite(site);
        if (!d) return '';
        if (MOSSAD_BUILTIN_SITES.includes(d)) return d;
        const list = mossadReadUserSites();
        if (!list.includes(d)) list.push(d);
        return mossadWriteUserSites(list) ? d : '';
    }
    /** Убрать из своего списка все записи, под которые попадает host (или ровно этот домен). */
    function mossadRemoveUserSite(hostOrSite) {
        const h = mossadNormSite(hostOrSite);
        const list = mossadReadUserSites();
        const keep = list.filter(d => d !== h && !mossadHostMatches(h, d));
        if (keep.length === list.length) return 0;
        return mossadWriteUserSites(keep) ? list.length - keep.length : 0;
    }

    // Миграция: свои домены из старого per-site localStorage `allowedDomains` → GM (один раз, при чтении)
    try {
        const _legacyCfg = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (_legacyCfg && Array.isArray(_legacyCfg.allowedDomains) && typeof GM_setValue === 'function') {
            const cur = mossadReadUserSites();
            const add = _legacyCfg.allowedDomains.map(mossadNormSite).filter(d => d && !MOSSAD_BUILTIN_SITES.includes(d) && !cur.includes(d));
            if (add.length) { mossadWriteUserSites(cur.concat(add)); console.log('[MOSSAD] v1.3.50: сайты перенесены в общий список:', add.join(', ')); }
            // Убрать старый ключ сразу, иначе удалённый во «🌍 Сайты» домен вернулся бы при следующей загрузке
            delete _legacyCfg.allowedDomains;
            // (старая кнопка «➕ MOSSAD» писала конфиг только из allowedDomains — пустой удаляем, чтобы сайт жил на 🌐 общих умолчаниях)
            if (Object.keys(_legacyCfg).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(_legacyCfg));
            else localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {}

    const _isAllowed = mossadIsHostAllowed(hostname);

    // Команда меню Tampermonkey: «➕ Добавить этот сайт» / «➖ Убрать этот сайт» (встроенный — только «🌍 Сайты»)
    let _mossadMenuId = null;
    // v1.3.54: всё после выхода ниже лежит внутри mossadMain() (см. build.py), отсюда openSettingsWindow
    // не виден — src/core/boot.js кладёт его сюда и перерегистрирует команду меню.
    let mossadOpenSettingsHook = null;
    function mossadRegisterSiteMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        try { if (_mossadMenuId !== null && typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(_mossadMenuId); } catch (e) {}
        _mossadMenuId = null;
        const builtin = mossadIsBuiltinHost(hostname);
        const added = !builtin && mossadIsHostAllowed(hostname);
        let title, fn;
        if (builtin) {
            if (!_isAllowed || typeof mossadOpenSettingsHook !== 'function') return;
            title = '🌍 Сайты MOSSAD';
            fn = () => { try { mossadOpenSettingsHook('sites'); } catch (e) {} };
        } else if (added) {
            title = '➖ Убрать этот сайт из MOSSAD';
            fn = () => {
                mossadRemoveUserSite(hostname);
                mossadRegisterSiteMenu();
                if (confirm(`MOSSAD: ${hostname} убран из списка сайтов.\nПерезагрузить страницу, чтобы выключить скрипт здесь?`)) location.reload();
            };
        } else {
            title = '➕ Добавить этот сайт в MOSSAD';
            fn = () => {
                const d = mossadAddUserSite(hostname);
                if (!d) { alert('MOSSAD: не удалось сохранить (GM-хранилище недоступно)'); return; }
                mossadRegisterSiteMenu();
                if (confirm(`MOSSAD: ${d} добавлен в список сайтов.\nПерезагрузить страницу, чтобы включить скрипт здесь?`)) location.reload();
            };
        }
        try { _mossadMenuId = GM_registerMenuCommand(title, fn); } catch (e) {}
    }
    mossadRegisterSiteMenu();
    if (!_isAllowed) return; // Выход — сайт не в списке (только команда меню, без DOM и слушателей)
