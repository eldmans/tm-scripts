    // ============================================
    // v1.3.53: «?» у шаблона имени файла — окно с итоговым именем и тегами
    // Создаётся лениво при первом клике, одно на страницу; Esc / клик вне / × закрывают (слушатели снимаются).
    // Имя считается тем же кодом, что и настоящее скачивание: mossadFilenameContext / grokFilenameContext →
    // buildFilenameVars → renderFilenameTemplate. Данные поста берутся один раз при открытии, дальше —
    // пересчёт при каждом вводе в поле шаблона. ANTI_PATTERNS §32.
    // ============================================
    let _tplHelp = null; // { box, input, btn, ctx, vars, cleanup }

    function _tplEsc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Данные текущего поста для предпросмотра (асинхронно: Pinterest — API пина, Grok — e-mail аккаунта). */
    async function mossadTplPreviewContext() {
        try {
            if (rootDomain === 'grok.com') {
                if (!grokAccountEmail()) await grokRefreshAccount(true);
                if (typeof isGrokPostPage === 'function' && isGrokPostPage()) return grokFilenameContext(getGrokMedia());
                return mossadFilenameContext({});
            }
            if (rootDomain.includes('pinterest.')) {
                const m = await pinterestResolveMedia();
                if (m && m.error) return mossadFilenameContext({ type: 'video', desc: (pinterestCachedPinInfo() || {}).desc || '' });
                return mossadFilenameContext(m || {});
            }
            return mossadFilenameContext(findMediaForDownload() || {});
        } catch (e) {
            console.warn('[MOSSAD] tpl preview context:', e);
            return mossadFilenameContext({});
        }
    }

    /** Сохранить шаблон ЭТОГО сайта (поле меню / окно настроек). Если есть GM-шаблон сайта (💾) — обновить и его,
     *  иначе он при следующей загрузке вернул бы старое значение. */
    function mossadSaveSiteTemplate(val) {
        const v = String(val == null ? '' : val).trim();
        Settings.setQuiet('filenameTemplate', v);
        if (typeof GM_getValue === 'function' && typeof GM_setValue === 'function') {
            try { if (GM_getValue('mossad_tpl_' + rootDomain, null)) GM_setValue('mossad_tpl_' + rootDomain, v); } catch (e) {}
        }
        document.querySelectorAll('#mossad-in-fn-tpl, #mossad-gen-tpl').forEach(el => { if (el.value !== v && el !== document.activeElement) el.value = v; });
    }
    window.mossadSaveSiteTemplate = mossadSaveSiteTemplate;

    function _tplCurrent(input) {
        const v = input ? String(input.value || '').trim() : '';
        return v || (input && input.placeholder) || getDefaultFilenameTemplate();
    }

    function _tplRenderDynamic() {
        const h = _tplHelp;
        if (!h || !h.vars) return;
        const tpl = _tplCurrent(h.input);
        const name = renderFilenameTemplate(tpl, h.vars, false, '', h.vars.ext);
        const unknown = mossadTemplateUnknownTags(tpl, h.vars);
        h.box.querySelector('[data-th="name"]').textContent = name;
        h.box.querySelector('[data-th="tpl"]').innerHTML = _tplEsc(tpl).replace(/\{([a-zA-Z]+)(\d+)?(?:\[(\d+)\])?\}/g, (m) =>
            unknown.includes(m) ? `<span style="color:#f87171;text-decoration:line-through;">${m}</span>` : `<span style="color:#93c5fd;">${m}</span>`);
        const warn = h.box.querySelector('[data-th="warn"]');
        warn.style.display = unknown.length ? 'block' : 'none';
        warn.textContent = unknown.length ? `${L('tplHelpUnknown')} ${unknown.join(' ')}` : '';
        h.box.querySelector('[data-th="off"]').style.display = config.filenameTemplateEnabled ? 'none' : 'block';
    }

    function _tplRenderTable() {
        const h = _tplHelp;
        const rows = MOSSAD_TPL_TAGS.map(t => {
            const val = h.vars ? String(h.vars[t.k] == null ? '' : h.vars[t.k]) : '…';
            const len = h.vars ? val.length : 0;
            const nRange = len > 1 ? `{${t.k}[1..${len}]}` : (len === 1 ? `{${t.k}[1]}` : '—');
            const shown = val.length > 60 ? val.slice(0, 60) + '…' : val;
            return `<tr>
                <td style="padding:2px 6px;white-space:nowrap;"><code data-th-ins="{${t.k}}" title="Вставить в шаблон" style="cursor:pointer;color:#93c5fd;">{${t.k}}</code></td>
                <td style="padding:2px 6px;color:#9ca3af;white-space:nowrap;">${t.aliases.map(a => `{${a}}`).join(' ')}</td>
                <td style="padding:2px 6px;color:#9ca3af;white-space:nowrap;">${nRange}</td>
                <td style="padding:2px 6px;color:#fbbf24;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_tplEsc(val)}">${val ? _tplEsc(shown) : '<span style="color:#6b7280;">пусто</span>'}</td>
                <td style="padding:2px 6px;color:#d1d5db;">${_tplEsc(t.what)}</td></tr>`;
        }).join('');
        h.box.querySelector('[data-th="tbody"]').innerHTML = rows;
    }

    function mossadCloseTplHelp() {
        const h = _tplHelp;
        if (!h) return;
        _tplHelp = null;
        if (h.cleanup) h.cleanup();
        h.box.remove();
    }
    window.mossadCloseTplHelp = mossadCloseTplHelp;

    /** Открыть/закрыть окно «?» для поля шаблона input (btn — кнопка «?», к ней прикладывается окно). */
    function mossadToggleTplHelp(btn, input) {
        if (_tplHelp && _tplHelp.input === input) { mossadCloseTplHelp(); return; }
        mossadCloseTplHelp();
        if (!input) return;
        const box = document.createElement('div');
        box.id = 'mossad-tpl-help';
        box.style.cssText = 'position:fixed;z-index:2147483646;background:rgba(17,24,39,0.97);border:1px solid #4b5563;border-radius:10px;' +
            'padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,0.6);color:#e5e7eb;font:12px system-ui,-apple-system,sans-serif;' +
            'max-width:min(640px,96vw);max-height:72vh;overflow:auto;';
        box.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <b style="flex:1;" data-mossad-label="tplHelpTitle">${LH('tplHelpTitle')}</b>
              <button data-th="close" title="Закрыть (Esc)" style="background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:14px;">✕</button>
            </div>
            <div style="margin-bottom:4px;"><span style="color:#9ca3af;" data-mossad-label="tplHelpNow">${LH('tplHelpNow')}</span>
              <code data-th="name" style="color:#34d399;font-weight:700;word-break:break-all;">…</code></div>
            <div style="margin-bottom:4px;color:#9ca3af;">Шаблон: <code data-th="tpl" style="word-break:break-all;"></code></div>
            <div data-th="warn" style="display:none;color:#f87171;margin-bottom:4px;"></div>
            <div data-th="off" style="display:none;color:#fbbf24;margin-bottom:4px;">Галочка «Шаблон» выключена — сейчас файл сохранится с именем по умолчанию (без шаблона).</div>
            <table style="border-collapse:collapse;width:100%;margin-top:4px;">
              <thead><tr style="color:#6b7280;text-align:left;"><th style="padding:2px 6px;">Тег</th><th style="padding:2px 6px;">Синонимы</th><th style="padding:2px 6px;">Длина N</th><th style="padding:2px 6px;">Сейчас</th><th style="padding:2px 6px;">Что это</th></tr></thead>
              <tbody data-th="tbody"></tbody>
            </table>
            <div style="margin-top:6px;color:#9ca3af;line-height:1.4;">
              {тег} — целиком; {тегN} или {тег[N]} — первые N символов (например {id8}, {desc[40]}).
              Регистр не важен. Неизвестный тег в имени файла пропадает. Расширение (.mp4 / .jpg) добавляется само,
              если имя на него не оканчивается. Пустые теги убирают лишние «-», «_», «~». Клик по тегу — вставить в шаблон.
            </div>`;
        document.body.appendChild(box);
        // Позиция: под кнопкой, в пределах экрана
        try {
            const r = (btn || input).getBoundingClientRect();
            const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
            box.style.left = Math.max(4, Math.min(r.left, vw - Math.min(640, vw * 0.96) - 4)) + 'px';
            if (r.bottom + 300 > vh && r.top > 300) box.style.bottom = Math.max(4, vh - r.top + 4) + 'px';
            else box.style.top = Math.max(4, r.bottom + 4) + 'px';
        } catch (e) {}

        const onInput = () => _tplRenderDynamic();
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
            mossadCloseTplHelp();
        };
        const onDown = (e) => {
            const t = e.target;
            if (box.contains(t) || t === btn || t === input) return;
            mossadCloseTplHelp();
        };
        input.addEventListener('input', onInput);
        window.addEventListener('keydown', onKey, true);
        document.addEventListener('pointerdown', onDown, true);
        _tplHelp = { box, input, btn, ctx: null, vars: null, cleanup: () => {
            input.removeEventListener('input', onInput);
            window.removeEventListener('keydown', onKey, true);
            document.removeEventListener('pointerdown', onDown, true);
        } };
        box.querySelector('[data-th="close"]').onclick = () => mossadCloseTplHelp();
        box.addEventListener('click', (e) => {
            const ins = e.target.closest && e.target.closest('[data-th-ins]');
            if (!ins) return;
            const text = ins.getAttribute('data-th-ins');
            const s0 = input.selectionStart ?? input.value.length, s1 = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, s0) + text + input.value.slice(s1);
            try { input.setSelectionRange(s0 + text.length, s0 + text.length); } catch (err) {}
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        _tplRenderTable();
        const mine = _tplHelp;
        mossadTplPreviewContext().then(ctx => {
            if (_tplHelp !== mine) return; // окно уже закрыто/переоткрыто
            mine.ctx = ctx;
            mine.vars = buildFilenameVars(ctx);
            _tplRenderTable();
            _tplRenderDynamic();
        });
    }
    window.mossadToggleTplHelp = mossadToggleTplHelp;

    /** Подключить кнопки «?» (class mossad-tpl-help-btn, data-for = id поля шаблона) внутри root. */
    function mossadWireTplHelp(root) {
        (root || document).querySelectorAll('.mossad-tpl-help-btn').forEach(b => {
            b.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                mossadToggleTplHelp(b, document.getElementById(b.dataset.for));
            };
        });
    }
    window.mossadWireTplHelp = mossadWireTplHelp;
    const MOSSAD_TPL_HELP_BTN_CSS = 'background:#1f2937;border:1px solid #4b5563;color:#fbbf24;border-radius:50%;width:18px;height:18px;padding:0;cursor:pointer;font-size:11px;font-weight:700;line-height:16px;flex:none;';
