    // ============================================
    // v1.3.78: окна MOSSAD (настройки, «?» шаблона, теги страницы, список) — ресайз за любой край/угол,
    // перетаскивание за шапку и кнопки «запомнить геометрию окна» в правом нижнем углу:
    //   S (зелёная) — для этого сайта, A (красная) — для всех сайтов. Сайт важнее общего.
    // Хранится ТОЛЬКО размер и положение окна (GM + копия в localStorage), не настройки.
    // ============================================
    const MOSSAD_WIN_EDGE = 6;

    function _winStoreKey(key, site) { return 'mossad_win_' + key + (site ? '@' + rootDomain : ''); }

    function _winRead(k) {
        let v = null;
        try { if (typeof GM_getValue === 'function') v = GM_getValue(k, null); } catch (e) {}
        if (v == null || v === '') { try { v = localStorage.getItem(k); } catch (e) {} }
        if (!v) return null;
        try { const g = typeof v === 'string' ? JSON.parse(v) : v; return g && g.w > 0 ? g : null; } catch (e) { return null; }
    }

    /** Сохранённая геометрия окна key: сначала сайт, потом общая. { l, t, w, h, scope } или null. */
    function mossadWinLoad(key) {
        const s = _winRead(_winStoreKey(key, true));
        if (s) return Object.assign({ scope: 'site' }, s);
        const a = _winRead(_winStoreKey(key, false));
        return a ? Object.assign({ scope: 'all' }, a) : null;
    }

    function mossadWinSave(key, g, site) {
        const k = _winStoreKey(key, site), v = g ? JSON.stringify(g) : '';
        try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (e) {}
        try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {}
    }

    /** Подогнать геометрию под текущий экран. */
    function mossadWinClamp(g) {
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        const w = Math.max(120, Math.min(Math.round(g.w || 0), vw - 8));
        const h = g.h > 0 ? Math.max(60, Math.min(Math.round(g.h), vh - 8)) : 0;
        const out = { w, h };
        if (g.l != null && g.t != null) {
            out.l = Math.max(0, Math.min(Math.round(g.l), vw - w));
            out.t = Math.max(0, Math.min(Math.round(g.t), vh - (h || 60)));
        }
        return out;
    }

    function _winEnsureStyle() {
        if (document.getElementById('mossad-win-style')) return;
        const st = document.createElement('style');
        st.id = 'mossad-win-style';
        st.textContent = '[data-mossad-edge="n"],[data-mossad-edge="s"]{cursor:ns-resize!important}' +
            '[data-mossad-edge="e"],[data-mossad-edge="w"]{cursor:ew-resize!important}' +
            '[data-mossad-edge="ne"],[data-mossad-edge="sw"]{cursor:nesw-resize!important}' +
            '[data-mossad-edge="nw"],[data-mossad-edge="se"]{cursor:nwse-resize!important}' +
            '.mossad-win-geo button{opacity:.22;transition:opacity .15s}.mossad-win-geo[data-dirty="1"] button,.mossad-win-geo button:hover{opacity:1}';
        (document.head || document.documentElement).appendChild(st);
    }

    function _winEdgeAt(el, x, y) {
        const r = el.getBoundingClientRect();
        if (!r.width || x < r.left - 1 || x > r.right + 1 || y < r.top - 1 || y > r.bottom + 1) return '';
        let e = '';
        if (y - r.top <= MOSSAD_WIN_EDGE) e += 'n'; else if (r.bottom - y <= MOSSAD_WIN_EDGE) e += 's';
        if (x - r.left <= MOSSAD_WIN_EDGE) e += 'w'; else if (r.right - x <= MOSSAD_WIN_EDGE) e += 'e';
        return e;
    }

    const MOSSAD_WIN_ICON = '<svg width="9" height="9" viewBox="0 0 10 10" style="vertical-align:-1px;margin-right:1px;"><rect x=".5" y=".5" width="9" height="9" rx="1" fill="none" stroke="currentColor"/><line x1=".5" y1="3" x2="9.5" y2="3" stroke="currentColor"/></svg>';

    /**
     * Подключить окно. key — имя окна в хранилище; opts:
     *   handle — элемент-шапка для перетаскивания (нет — окно не двигается);
     *   resize — свой ресайз за края (false — у окна свой, как у списка);
     *   move — хранить/восстанавливать положение (false — только размер, окно стоит в виджете);
     *   onGeom(el) — вызвать после восстановления / ресайза (подстроить содержимое).
     * Возвращает true, если геометрия восстановлена из сохранённой.
     */
    function mossadWinAttach(el, key, opts) {
        const o = Object.assign({ handle: null, resize: true, move: true, onGeom: null }, opts || {});
        _winEnsureStyle();
        const geo = document.createElement('div');
        geo.className = 'mossad-win-geo';
        const scroller = /auto|scroll/.test((getComputedStyle(el).overflowY || '') + (el.style.overflowY || el.style.overflow || ''));
        // В прокручиваемом окне — «липкая» полоса внизу видимой области, иначе — абсолютно в углу
        geo.style.cssText = scroller
            ? 'position:sticky;bottom:0;height:0;display:flex;justify-content:flex-end;pointer-events:none;z-index:3;overflow:visible;'
            : 'position:absolute;right:10px;bottom:1px;display:flex;pointer-events:none;z-index:3;';
        if (scroller) el.style.paddingBottom = '20px';
        else if (!/fixed|absolute|relative/.test(el.style.position)) el.style.position = 'relative';
        const bcss = 'pointer-events:auto;border:none;border-radius:3px;padding:0 3px;margin-left:2px;font:700 9px/13px system-ui,sans-serif;cursor:pointer;color:#fff;';
        const what = o.move ? 'размер и положение' : 'размер';
        geo.innerHTML = `<span style="display:flex;${scroller ? 'position:relative;top:-16px;right:-6px;' : ''}">` +
            `<button type="button" data-win="site" style="${bcss}background:#15803d;" title="Запомнить ${what} ЭТОГО ОКНА на сайте ${rootDomain}.\nСохраняется только геометрия окна — не настройки.\nНа этом сайте важнее общего (A). Shift+клик — забыть.">${MOSSAD_WIN_ICON}S</button>` +
            `<button type="button" data-win="all" style="${bcss}background:#b91c1c;" title="Запомнить ${what} ЭТОГО ОКНА для всех сайтов.\nСохраняется только геометрия окна — не настройки.\nСайт со своим размером (S) использует свой. Shift+клик — забыть.">${MOSSAD_WIN_ICON}A</button></span>`;
        el.appendChild(geo);
        const dirty = (v) => { geo.dataset.dirty = v ? '1' : '0'; };
        dirty(false);
        el._mossadWinDirty = () => dirty(true);

        const current = () => {
            const r = el.getBoundingClientRect();
            const g = { w: Math.round(r.width), h: Math.round(r.height) };
            if (o.move) { g.l = Math.round(r.left); g.t = Math.round(r.top); }
            return g;
        };
        geo.addEventListener('mousedown', (e) => e.stopPropagation(), true);
        geo.querySelectorAll('[data-win]').forEach(b => {
            b.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const site = b.dataset.win === 'site';
                if (e.shiftKey) {
                    mossadWinSave(key, null, site);
                    if (typeof showToast === 'function') showToast(site ? `🗗 Размер окна для ${rootDomain} забыт` : '🗗 Общий размер окна забыт');
                    return;
                }
                const g = current();
                if (!(g.w > 0)) return;
                mossadWinSave(key, g, site);
                dirty(false);
                if (typeof showToast === 'function') showToast(site ? `🗗 Размер окна запомнен для ${rootDomain}` : '🗗 Размер окна запомнен для всех сайтов');
            };
        });

        // Восстановление (сайт важнее общего), в пределах экрана
        let restored = false;
        const saved = mossadWinLoad(key);
        if (saved) {
            const g = mossadWinClamp(o.move ? saved : { w: saved.w, h: saved.h });
            el.style.width = g.w + 'px'; el.style.maxWidth = 'none';
            if (g.h) { el.style.height = g.h + 'px'; el.style.maxHeight = 'none'; }
            if (o.move && g.l != null) {
                el.style.left = g.l + 'px'; el.style.top = g.t + 'px';
                el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
            }
            el.dataset.winRestored = saved.scope;
            restored = true;
            if (o.onGeom) { try { o.onGeom(el); } catch (e) {} }
        }

        // Зафиксировать текущие px (окна по центру через transform / по right/bottom)
        const freeze = () => {
            const r = el.getBoundingClientRect();
            el.style.left = Math.round(r.left) + 'px'; el.style.top = Math.round(r.top) + 'px';
            el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.transform = 'none';
            el.style.width = Math.round(r.width) + 'px'; el.style.height = Math.round(r.height) + 'px';
            el.style.maxWidth = 'none'; el.style.maxHeight = 'none';
            return r;
        };
        if (o.resize) {
            el.addEventListener('mousemove', (e) => {
                if (el._mossadWinDrag) return;
                const ed = _winEdgeAt(el, e.clientX, e.clientY);
                if (ed) el.dataset.mossadEdge = ed; else delete el.dataset.mossadEdge;
            });
            el.addEventListener('mouseleave', () => { if (!el._mossadWinDrag) delete el.dataset.mossadEdge; });
        }
        el.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const ed = o.resize ? _winEdgeAt(el, e.clientX, e.clientY) : '';
            const t = e.target;
            const onHandle = !ed && o.handle && o.handle.contains(t) &&
                !(t.closest && t.closest('button,input,select,textarea,a,summary,label,code,[data-th-ins],[contenteditable]'));
            if (!ed && !onHandle) return;
            e.preventDefault(); e.stopPropagation();
            const r = freeze();
            const d = el._mossadWinDrag = { ed, x: e.clientX, y: e.clientY, l: r.left, t: r.top, w: r.width, h: r.height, moved: false };
            const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
            const onMove = (ev) => {
                const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
                if (!d.ed) {
                    el.style.left = Math.round(Math.max(0, Math.min(vw - d.w, d.l + dx))) + 'px';
                    el.style.top = Math.round(Math.max(0, Math.min(vh - 30, d.t + dy))) + 'px';
                } else {
                    if (d.ed.includes('e')) el.style.width = Math.round(Math.max(160, Math.min(vw - d.l, d.w + dx))) + 'px';
                    if (d.ed.includes('s')) el.style.height = Math.round(Math.max(80, Math.min(vh - d.t, d.h + dy))) + 'px';
                    if (d.ed.includes('w')) {
                        const nw = Math.max(160, Math.min(d.l + d.w, d.w - dx));
                        el.style.width = Math.round(nw) + 'px'; el.style.left = Math.round(d.l + d.w - nw) + 'px';
                    }
                    if (d.ed.includes('n')) {
                        const nh = Math.max(80, Math.min(d.t + d.h, d.h - dy));
                        el.style.height = Math.round(nh) + 'px'; el.style.top = Math.round(d.t + d.h - nh) + 'px';
                    }
                }
                d.moved = true;
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove, true);
                document.removeEventListener('mouseup', onUp, true);
                el._mossadWinDrag = null;
                delete el.dataset.mossadEdge;
                if (!d.moved) return;
                dirty(true);
                el.dataset.winMoved = '1';
                if (o.onGeom) { try { o.onGeom(el); } catch (err) {} }
            };
            document.addEventListener('mousemove', onMove, true);
            document.addEventListener('mouseup', onUp, true);
        }, true);
        return restored;
    }
    window.mossadWinAttach = mossadWinAttach;
