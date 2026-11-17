    // ============================================
    // SITES (v1.3.50): вкладка «🌍 Сайты» — где работает MOSSAD.
    // Встроенные сайты (MOSSAD_BUILTIN_SITES, только чтение) + свои (GM `mossad_sites`, общий для всех
    // сайтов и контейнеров; логика — src/core/domain.js). Строится лениво при первом открытии вкладки;
    // один делегированный обработчик на списке. Добавление/удаление вступает в силу после перезагрузки
    // страницы нужного сайта.
    // ============================================
    let _mossadSitesPane = null;

    function mossadEscHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Перерисовать список, если вкладка уже построена (вызывается и из GM-слушателя в domain.js). */
    function mossadSitesRerender() {
        const pane = _mossadSitesPane;
        if (!pane || !pane.isConnected) { _mossadSitesPane = null; return; }
        const user = mossadReadUserSites();
        const here = (d) => mossadHostMatches(hostname, d) ? ' <span style="color:#10b981;" title="Текущий сайт">● здесь</span>' : '';
        const chip = 'display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid #374151;border-radius:6px;background:#0b1220;font:12px ui-monospace,Consolas,monospace;color:#e5e7eb;';
        const getCatBadge = (d) => {
            const c = (typeof mossadGetSiteCategory === 'function') ? mossadGetSiteCategory(d) : { icon: '🌐', label: 'Общий' };
            return `<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:#1e293b;color:#94a3b8;border:1px solid #334155;" title="${c.label}">${c.icon} ${c.label}</span>`;
        };

        const statsBox = pane.querySelector('#mossad-sites-stats-box');
        if (statsBox && typeof mossadGetSiteStatsSummary === 'function') {
            const sum = mossadGetSiteStatsSummary();
            statsBox.innerHTML = `
                <span title="Первый добавленный сайт">🏁 <b>Первый:</b> <code style="color:#60a5fa;">${mossadEscHtml(sum.firstAdded)}</code></span>
                <span style="color:#4b5563;">·</span>
                <span title="Последний добавленный сайт">🕒 <b>Последний:</b> <code style="color:#34d399;">${mossadEscHtml(sum.lastAdded)}</code></span>
                <span style="color:#4b5563;">·</span>
                <span title="Самый активный по визитам и скачиваниям">🔥 <b>Самый частый:</b> <code style="color:#fbbf24;">${mossadEscHtml(sum.mostFrequent)}</code></span>
            `;
        }

        pane.querySelector('#mossad-sites-builtin').innerHTML = MOSSAD_BUILTIN_SITES.map(d =>
            `<div style="${chip}color:#9ca3af;" title="Встроенный сайт — убрать нельзя">🔒 ${mossadEscHtml(d)}${here(d)}<div style="margin-left:auto;display:flex;align-items:center;gap:6px;">${getCatBadge(d)}<button data-site-wiz="${mossadEscHtml(d)}" title="Открыть мастер настройки сайта для ${mossadEscHtml(d)}" style="background:#1e3a8a;border:1px solid #3b82f6;border-radius:4px;color:#93c5fd;padding:0 5px;cursor:pointer;font-size:11px;font-weight:bold;">🪄</button></div></div>`).join('');
        pane.querySelector('#mossad-sites-user').innerHTML = user.length ? user.map(d =>
            `<div data-site="${mossadEscHtml(d)}" style="${chip}">${mossadEscHtml(d)}${here(d)}<div style="margin-left:auto;display:flex;align-items:center;gap:6px;">${getCatBadge(d)}<button data-site-wiz="${mossadEscHtml(d)}" title="Открыть мастер настройки сайта для ${mossadEscHtml(d)}" style="background:#1e3a8a;border:1px solid #3b82f6;border-radius:4px;color:#93c5fd;padding:0 5px;cursor:pointer;font-size:11px;font-weight:bold;">🪄 Настроить</button><button data-site-del="${mossadEscHtml(d)}" title="Убрать сайт из списка" style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#f87171;padding:0 7px;cursor:pointer;font-size:11px;font-weight:bold;">${LH('sitesRemove')}</button></div></div>`).join('')
            : '<div style="font-size:11px;color:#6b7280;">Пока пусто</div>';
        const cur = pane.querySelector('#mossad-sites-add-current');
        const curNorm = mossadNormSite(hostname);
        const already = mossadIsBuiltinHost(hostname) || user.some(d => mossadHostMatches(hostname, d));
        cur.disabled = already || !curNorm;
        cur.style.opacity = cur.disabled ? '0.5' : '1';
        cur.title = already ? `${hostname} уже в списке` : `Добавить ${curNorm}`;
    }

    function initSitesTab(modal) {
        const pane = modal.querySelector('[data-pane="sites"]');
        if (!pane || pane.dataset.built) return;
        pane.dataset.built = '1';
        _mossadSitesPane = pane;
        const btnCss = 'background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;';
        pane.innerHTML = `
            <div style="font-size:11px;color:#9ca3af;line-height:1.35;">Сайты, где работает MOSSAD. Список общий для всех сайтов и контейнеров. Поддомены входят автоматически (<code>site.com</code> → <code>m.site.com</code>). То же — в меню Tampermonkey: «➕ Добавить этот сайт в MOSSAD».</div>
            <div style="font-size:11px;color:#fbbf24;">⚠️ После добавления или удаления перезагрузи страницу того сайта.</div>
            <div id="mossad-sites-stats-box" style="display:flex;gap:8px;padding:5px 10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;font-size:11px;color:#c9d1d9;align-items:center;flex-wrap:wrap;"></div>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="mossad-sites-input" type="text" placeholder="example.com" spellcheck="false" style="flex:1;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:4px 6px;font-size:12px;">
              <button id="mossad-sites-add" style="${btnCss}background:#065f46;border-color:#10b981;" data-mossad-label="sitesAdd">${LH('sitesAdd')}</button>
              <button id="mossad-sites-add-current" style="${btnCss}color:#60a5fa;" data-mossad-label="sitesAddCurrent">${LH('sitesAddCurrent')}</button>
            </div>
            <div id="mossad-sites-status" style="font-size:11px;color:#9ca3af;min-height:14px;"></div>
            <div style="overflow-y:auto;max-height:calc(85vh - 340px);display:flex;flex-direction:column;gap:6px;padding-right:4px;">
              <div style="font-size:11px;color:#6b7280;" data-mossad-label="sitesUser">${LH('sitesUser')}</div>
              <div id="mossad-sites-user" style="display:flex;flex-direction:column;gap:3px;"></div>
              <div style="font-size:11px;color:#6b7280;margin-top:4px;" data-mossad-label="sitesBuiltin">${LH('sitesBuiltin')}</div>
              <div id="mossad-sites-builtin" style="display:flex;flex-direction:column;gap:3px;"></div>
            </div>`;
        const input = pane.querySelector('#mossad-sites-input');
        const status = pane.querySelector('#mossad-sites-status');
        const say = (t, bad) => { status.textContent = t; status.style.color = bad ? '#f87171' : '#10b981'; };
        const add = (raw) => {
            const d = mossadNormSite(raw);
            if (!d) { say('Не похоже на домен: ' + String(raw || '').slice(0, 60), true); return false; }
            if (MOSSAD_BUILTIN_SITES.includes(d)) { say(`${d} — встроенный, уже работает`); return false; }
            if (mossadReadUserSites().includes(d)) { say(`${d} уже в списке`); return false; }
            if (!mossadAddUserSite(d)) { say('GM-хранилище недоступно', true); return false; }
            try { if (typeof GM_setValue === 'function') GM_setValue('mossad_wizard_pending_' + d, true); } catch (e) {}
            say(`✅ ${d} добавлен — перезагрузи страницу сайта`);
            mossadSitesRerender();
            try { mossadRegisterSiteMenu(); } catch (e) {}
            if (mossadHostMatches(hostname, d)) {
                setTimeout(() => { if (typeof mossadOpenSiteWizard === 'function') mossadOpenSiteWizard(d); }, 400);
            }
            return true;
        };
        pane.querySelector('#mossad-sites-add').onclick = () => { if (add(input.value)) input.value = ''; };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (add(input.value)) input.value = ''; } });
        pane.querySelector('#mossad-sites-add-current').onclick = () => add(hostname);
        const handleSiteClick = (e) => {
            const wiz = e.target && e.target.closest ? e.target.closest('[data-site-wiz]') : null;
            if (wiz) {
                const d = wiz.dataset.siteWiz;
                if (typeof mossadOpenSiteWizard === 'function') mossadOpenSiteWizard(d);
                return;
            }
            const b = e.target && e.target.closest ? e.target.closest('[data-site-del]') : null;
            if (!b) return;
            const d = b.dataset.siteDel;
            const list = mossadReadUserSites().filter(x => x !== d);
            if (!mossadWriteUserSites(list)) { say('GM-хранилище недоступно', true); return; }
            say(`${d} убран — перезагрузи страницу сайта`);
            mossadSitesRerender();
            try { mossadRegisterSiteMenu(); } catch (e2) {}
        };
        pane.querySelector('#mossad-sites-user').addEventListener('click', handleSiteClick);
        pane.querySelector('#mossad-sites-builtin').addEventListener('click', handleSiteClick);
        mossadSitesRerender();
    }
