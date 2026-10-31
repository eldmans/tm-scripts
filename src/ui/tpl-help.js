    // ============================================
    // v1.3.53: «?» у шаблона имени файла — окно с итоговым именем и тегами
    // Создаётся лениво при первом клике, одно на страницу; Esc / клик вне / × закрывают (слушатели снимаются).
    // Имя считается тем же кодом, что и настоящее скачивание: mossadFilenameContext / grokFilenameContext →
    // buildFilenameVars → renderFilenameTemplate. Данные поста берутся один раз при открытии, дальше —
    // пересчёт при каждом вводе в поле шаблона. ANTI_PATTERNS §32.
    // ============================================
    let _tplHelp = null; // { box, input, btn, ctx, vars, cleanup }

    // v1.3.74: справка по модификаторам (клик по примеру — вставить в шаблон)
    const _tplEx = (t, what) => `<div><code data-th-ins="${t.replace(/"/g, '&quot;')}" title="Вставить в шаблон" style="cursor:pointer;color:#93c5fd;">${t.replace(/</g, '&lt;')}</code> — ${what}</div>`;
    const MOSSAD_TPL_HELP_MODS = `
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #374151;line-height:1.5;">
              <b style="color:#e5e7eb;">✂ Модификаторы — дописываются внутрь скобок любого тега</b>
              <div style="color:#9ca3af;">Применяются всегда по порядку: минус-слова → слова → символы.</div>
              ${_tplEx('{title--Watch Online}', 'убрать «Watch Online» (регистр не важен, все повторы; лишние пробелы и разделители по краям подчищаются)')}
              ${_tplEx('{title--Watch Online--Brave}', 'убрать несколько: каждое после своих «--»')}
              ${_tplEx('{title--" - Brave"}', 'текст со своими дефисами или пробелами по краям — в кавычках')}
              ${_tplEx('{title[[2]]}', 'первые 2 слова')}
              ${_tplEx('{title[[-2]]}', 'последние 2 слова')}
              ${_tplEx('{title[[2:]]}', 'без первых 2 слов')}
              ${_tplEx('{title[[:-2]]}', 'без последних 2 слов')}
              ${_tplEx('{title[[1:3]]}', 'слова со 2-го по 3-е (как срез в Python, счёт с 0)')}
              ${_tplEx('{title[40]}', 'первые 40 символов (то же, что {title40})')}
              ${_tplEx('{title--Watch Online[[3]][40]}', 'всё вместе: убрать, взять 3 слова, обрезать до 40 символов')}
              <div style="color:#9ca3af;">Слова разделяются пробелом, точкой, запятой, «_», «|» и тире (- – —); разделители между оставшимися словами остаются как были.
              Ошибка в модификаторе — тег красный и в имени пропадает.</div>
            </div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #374151;line-height:1.5;">
              <b style="color:#e5e7eb;">🌐 Теги со страницы</b> <span style="color:#9ca3af;">(то, что видно в «Просмотр кода страницы»; берётся в момент скачивания)</span>
              ${_tplEx('{meta:og:title}', 'содержимое &lt;meta property=&quot;og:title&quot; content=&quot;…&quot;&gt; (так же name= и itemprop=)')}
              ${_tplEx('{ld:name}', 'поле из блока schema.org &lt;script type=&quot;application/ld+json&quot;&gt; (сначала VideoObject / ImageObject)')}
              ${_tplEx('{ld:author.name}', 'вложенное поле — через точку; номер элемента списка — {ld:thumbnailUrl.0}')}
              ${_tplEx('{css:h1}', 'текст первого элемента по CSS-селектору; можно с пробелами и [атрибутами]: {css:div.info [itemprop=name]}')}
              ${_tplEx('{css:video@poster}', 'значение атрибута элемента — через @ в конце')}
              ${_tplEx('{css:"a.b--c"}', 'селектор с «--» или «[[» — в кавычках')}
              ${_tplEx('{ld:description--watch online hight quality video}', 'модификаторы --, [[ ]], [ ] работают и тут')}
              ${_tplEx('{re:ld:description/^(.+?) watch online/$1}', 'регулярка с группами, как в PowerRename: re:ИСТОЧНИК/РЕГУЛЯРКА/ЗАМЕНА')}
              <div style="color:#9ca3af;">Регулярка: ИСТОЧНИК — любой тег без скобок (title, desc, meta:…, ld:…, css:…); регистр не важен; в ЗАМЕНЕ $1…$9 — группы в любом порядке
              (например <code>$2 - $1</code>), $&amp; — всё совпадение. Результат — только ЗАМЕНА с подставленными группами (нет совпадения — пусто); без ЗАМЕНЫ — группа 1 (или всё совпадение).
              «/» внутри регулярки — <code>\\/</code>. Модификаторы к результату — после ещё одного «/»: <code>{re:title/(\\w+)/$1/[10]}</code>. Ошибка в регулярке — тег красный.</div>
              <div style="color:#9ca3af;">Пример: страница с og:title «Pppe 062 en» и описанием «Pppe 062 en watch online hight quality video» — все три
              <code>{meta:og:title}</code>, <code>{ld:description--watch online hight quality video}</code>, <code>{re:ld:description/^(.+?) watch online/$1}</code> дают «Pppe 062 en».</div>
            </div>`;

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

    // ── v1.3.65: разделитель между тегами при вставке кликом (общий для всех сайтов: GM, копия в localStorage) ──
    const TPL_SEP_KEY = 'mossad_tpl_sep';
    const TPL_SEP_CHARS = '-_~.+ ()[]';
    function mossadTplSep() {
        let v = null;
        try { if (typeof GM_getValue === 'function') v = GM_getValue(TPL_SEP_KEY, null); } catch (e) {}
        if (v == null) { try { v = localStorage.getItem(TPL_SEP_KEY); } catch (e) {} }
        return v == null ? '~' : String(v);
    }
    function mossadSetTplSep(v) {
        const x = String(v == null ? '' : v).slice(0, 8);
        try { if (typeof GM_setValue === 'function') GM_setValue(TPL_SEP_KEY, x); } catch (e) {}
        try { localStorage.setItem(TPL_SEP_KEY, x); } catch (e) {}
    }
    /** Текст для вставки после prefix: разделитель, если prefix не пуст и не кончается разделителем (в т.ч. кончается тегом «}»). */
    function mossadTplInsertText(prefix, tag, sep) {
        const p = String(prefix || '');
        if (!p || !sep) return tag;
        const last = p[p.length - 1];
        if (p.endsWith(sep) || (last !== '}' && TPL_SEP_CHARS.includes(last))) return tag;
        return sep + tag;
    }

    function _tplCurrent(input) {
        const v = input ? String(input.value || '').trim() : '';
        return v || (input && input.placeholder) || getDefaultFilenameTemplate();
    }

    function _tplRenderDynamic() {
        const h = _tplHelp;
        if (!h || !h.vars) return;
        const tpl = _tplCurrent(h.input);
        const name = renderFilenameTemplate(tpl, h.vars, false, '', h.vars.ext);
        const issues = mossadTemplateTagIssues(tpl, h.vars); // v1.3.74: понимает --минус, [[слова]]
        const bad = (raw) => issues.find(x => x.raw === raw);
        h.box.querySelector('[data-th="name"]').textContent = name;
        h.box.querySelector('[data-th="tpl"]').innerHTML = mossadTplScan(tpl).map(p => p.raw == null ? _tplEsc(p.text) :
            (bad(p.raw) ? `<span style="color:#f87171;text-decoration:line-through;" title="${_tplEsc(bad(p.raw).err)}">${_tplEsc(p.raw)}</span>` : `<span style="color:#93c5fd;">${_tplEsc(p.raw)}</span>`)).join('');
        const warn = h.box.querySelector('[data-th="warn"]');
        warn.style.display = issues.length ? 'block' : 'none';
        warn.textContent = issues.length ? `${L('tplHelpUnknown')} ${issues.map(x => `${x.raw} (${x.err})`).join(' ')}` : '';
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

    /** v1.3.75: список meta-тегов и полей ld+json текущей страницы со значениями (клик — вставить тег). */
    function _tplRenderPageTags() {
        const h = _tplHelp;
        const el = h && h.box.querySelector('[data-th="pagelist"]');
        if (!el) return;
        const cat = mossadPageTagCatalog(document);
        const q = (k) => /--|\[\[|\[\d+\]/.test(k) ? `"${k}"` : k;
        const row = (tag, name, val) => `<tr><td style="padding:1px 6px;white-space:nowrap;"><code data-th-ins="${_tplEsc(tag)}" title="Вставить ${_tplEsc(tag)}" style="cursor:pointer;color:#93c5fd;">${_tplEsc(name)}</code></td>` +
            `<td style="padding:1px 6px;color:#fbbf24;word-break:break-word;" title="${_tplEsc(val)}">${_tplEsc(val.length > 120 ? val.slice(0, 120) + '…' : val) || '<span style="color:#6b7280;">пусто</span>'}</td></tr>`;
        const tbl = (title, rows) => `<div style="color:#9ca3af;margin-top:4px;">${title}</div>` +
            (rows.length ? `<table style="border-collapse:collapse;width:100%;">${rows.join('')}</table>` : '<div style="color:#6b7280;">— нет на этой странице</div>');
        el.innerHTML = tbl('meta → {meta:…}', cat.meta.map(([n, v]) => row(`{meta:${q(n)}}`, n, v))) +
            tbl('ld+json → {ld:…}', cat.ld.map(([n, v]) => row(`{ld:${q(n)}}`, n, v)));
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
            <div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;" title="Вставляется перед тегом, если шаблон не пуст и не кончается разделителем (общий для всех сайтов). Пусто — без разделителя">
              <span style="color:#9ca3af;" data-mossad-label="tplSepLabel">${LH('tplSepLabel')}</span>
              <input data-th="sep" type="text" maxlength="8" style="width:46px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:1px 4px;font-size:12px;">
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
            </div>
            ${MOSSAD_TPL_HELP_MODS}
            <details data-th="page" style="margin-top:8px;padding-top:6px;border-top:1px solid #374151;" open>
              <summary style="cursor:pointer;color:#e5e7eb;font-weight:700;">📄 На этой странице: meta и ld+json (клик — вставить тег)</summary>
              <div data-th="pagelist" style="margin-top:4px;"></div>
            </details>
            <div style="margin-top:6px;display:flex;align-items:center;gap:6px;" title="Через запятую. Убираются из {title} и {desc} всегда, без правки шаблона (без учёта регистра). Текст с запятой или пробелами по краям — в кавычках: &quot; - Brave&quot;. Свой список у каждого сайта">
              <span style="color:#9ca3af;white-space:nowrap;">Минус-слова сайта ${_tplEsc(rootDomain)} (title, desc):</span>
              <input data-th="junk" type="text" placeholder="Watch Online, &quot; - Brave&quot;" style="flex:1;min-width:0;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:1px 4px;font-size:12px;">
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
        const mine = _tplHelp = { box, input, btn, ctx: null, vars: null, cleanup: () => {
            input.removeEventListener('input', onInput);
            window.removeEventListener('keydown', onKey, true);
            document.removeEventListener('pointerdown', onDown, true);
        } };
        box.querySelector('[data-th="close"]').onclick = () => mossadCloseTplHelp();
        const sepIn = box.querySelector('[data-th="sep"]');
        sepIn.value = mossadTplSep();
        sepIn.oninput = () => mossadSetTplSep(sepIn.value);
        _tplRenderPageTags(); // v1.3.75
        const junkIn = box.querySelector('[data-th="junk"]'); // v1.3.74
        junkIn.value = mossadJunkText();
        junkIn.oninput = () => {
            mossadSetJunkText(junkIn.value);
            if (mine.ctx) { mine.vars = buildFilenameVars(mine.ctx); _tplRenderTable(); _tplRenderDynamic(); }
        };
        box.addEventListener('click', (e) => {
            const ins = e.target.closest && e.target.closest('[data-th-ins]');
            if (!ins) return;
            const s0 = input.selectionStart ?? input.value.length, s1 = input.selectionEnd ?? input.value.length;
            const text = mossadTplInsertText(input.value.slice(0, s0), ins.getAttribute('data-th-ins'), mossadTplSep()); // v1.3.65
            input.value = input.value.slice(0, s0) + text + input.value.slice(s1);
            try { input.setSelectionRange(s0 + text.length, s0 + text.length); } catch (err) {}
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        _tplRenderTable();
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
