    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.4.33';
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
    const MOSSAD_BUILTIN_SITES = ['grok.com', 'redgifs.com', 'pinterest.com', 'pinterest.ru', 'civitai.red', 'vkvideo.ru', 'vk.video', 'noodlemagazine.com', 'instagram.com', 'huggingface.co', 'hf.space', 'xv-ru.com', 'xvideos.com', 'faphouse.com', 'xhamster.com', 'xhamster.desi', 'xhamster2.com', 'telegram.org'];
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
    const MOSSAD_SITES_META_KEY = 'mossad_sites_meta';

    // ── v1.4.14: Категории сайтов MOSSAD ──
    const MOSSAD_SITE_CATEGORIES = {
        video: { id: 'video', label: 'Видео', icon: '🎬', sites: ['faphouse.com', 'xvideos.com', 'xv-ru.com', 'xnxx.com', 'xhamster.com', 'xhamster.desi', 'xhamster2.com', 'noodlemagazine.com', 'vkvideo.ru', 'vk.video', 'pornhub.com'] },
        feed:  { id: 'feed', label: 'Ленты / Пины', icon: '📌', sites: ['pinterest.com', 'pinterest.ru', 'instagram.com', 'redgifs.com'] },
        ai:    { id: 'ai', label: 'Нейросети', icon: '🤖', sites: ['grok.com', 'huggingface.co', 'hf.space', 'civitai.red'] },
        general: { id: 'general', label: 'Общие', icon: '🌐', sites: [] }
    };

    function mossadGetSiteCategory(site) {
        const d = mossadNormSite(site);
        if (!d) return MOSSAD_SITE_CATEGORIES.general;
        for (const cat of ['video', 'feed', 'ai']) {
            if (MOSSAD_SITE_CATEGORIES[cat].sites.some(s => d === s || d.endsWith('.' + s))) {
                return MOSSAD_SITE_CATEGORIES[cat];
            }
        }
        return MOSSAD_SITE_CATEGORIES.general;
    }

    function mossadReadSiteMeta() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(MOSSAD_SITES_META_KEY, null); } catch (e) {}
        let obj = raw;
        try { if (typeof raw === 'string') obj = JSON.parse(raw); } catch (e) { obj = null; }
        if (!obj || typeof obj !== 'object') obj = {};
        return obj;
    }

    function mossadWriteSiteMeta(meta) {
        try { if (typeof GM_setValue === 'function') { GM_setValue(MOSSAD_SITES_META_KEY, JSON.stringify(meta)); return true; } } catch (e) {}
        return false;
    }

    function mossadRecordSiteVisit(site) {
        const d = mossadNormSite(site);
        if (!d) return;
        const meta = mossadReadSiteMeta();
        meta.stats = meta.stats || {};
        meta.stats[d] = meta.stats[d] || { visits: 0, downloads: 0, lastVisited: 0 };
        meta.stats[d].visits = (meta.stats[d].visits || 0) + 1;
        meta.stats[d].lastVisited = Date.now();
        mossadWriteSiteMeta(meta);
    }

    function mossadRecordSiteDownload(site) {
        const d = mossadNormSite(site);
        if (!d) return;
        const meta = mossadReadSiteMeta();
        meta.stats = meta.stats || {};
        meta.stats[d] = meta.stats[d] || { visits: 0, downloads: 0, lastVisited: 0 };
        meta.stats[d].downloads = (meta.stats[d].downloads || 0) + 1;
        meta.stats[d].lastDownloaded = Date.now();
        mossadWriteSiteMeta(meta);
    }

    function mossadGetSiteStatsSummary() {
        const meta = mossadReadSiteMeta();
        const stats = meta.stats || {};
        const first = meta.firstAdded || (MOSSAD_BUILTIN_SITES.length ? MOSSAD_BUILTIN_SITES[0] : '—');
        const last = meta.lastAdded || (MOSSAD_BUILTIN_SITES.length ? MOSSAD_BUILTIN_SITES[MOSSAD_BUILTIN_SITES.length - 1] : '—');
        let topDomain = '—';
        let topScore = 0;
        for (const [dom, st] of Object.entries(stats)) {
            const score = (st.visits || 0) + (st.downloads || 0) * 3;
            if (score > topScore) {
                topScore = score;
                topDomain = dom;
            }
        }
        return {
            firstAdded: first,
            lastAdded: last,
            mostFrequent: topDomain,
            topScore: topScore,
            stats: stats
        };
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
        const ok = mossadWriteUserSites(list);
        if (ok) {
            const meta = mossadReadSiteMeta();
            if (!meta.firstAdded) meta.firstAdded = d;
            meta.lastAdded = d;
            meta.sites = meta.sites || {};
            meta.sites[d] = { addedAt: Date.now() };
            mossadWriteSiteMeta(meta);
        }
        return ok ? d : '';
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
    let mossadOpenWizardHook = null;
    let _mossadWizardMenuId = null;
    function mossadRegisterSiteMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        try { if (_mossadMenuId !== null && typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(_mossadMenuId); } catch (e) {}
        try { if (_mossadWizardMenuId !== null && typeof GM_unregisterMenuCommand === 'function') GM_unregisterMenuCommand(_mossadWizardMenuId); } catch (e) {}
        _mossadMenuId = null;
        _mossadWizardMenuId = null;
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
                try { if (typeof GM_setValue === 'function') GM_setValue('mossad_wizard_pending_' + d, true); } catch (e) {}
                if (confirm(`MOSSAD: ${d} добавлен в список сайтов.\nПерезагрузить страницу, чтобы открыть мастер первичной настройки сайта?`)) location.reload();
            };
        }
        try { _mossadMenuId = GM_registerMenuCommand(title, fn); } catch (e) {}
        if (_isAllowed && typeof mossadOpenWizardHook === 'function') {
            try { _mossadWizardMenuId = GM_registerMenuCommand('🪄 Мастер настройки сайта (' + hostname + ')', () => mossadOpenWizardHook(hostname)); } catch (e) {}
        }
    }
    mossadRegisterSiteMenu();
    if (!_isAllowed) return; // Выход — сайт не в списке (только команда меню, без DOM и слушателей)
    try { mossadRecordSiteVisit(rootDomain); } catch (e) {}
