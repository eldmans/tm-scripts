    // ============================================
    // v1.3.66: настройки лёгкого слоя (DND; v1.3.67 — видео/скорость). Одна функция-рендер для двух мест:
    //   • вкладка «🎬 Видео / DND» окна настроек MOSSAD (сайты из списка);
    //   • команда меню Tampermonkey «🎬 MOSSAD: видео и DND» — плавающее окно на ЛЮБОМ сайте (без mossadMain).
    // Тело функций компилируется только при открытии (на загрузке — одна команда меню).
    // ============================================
    const mossadLightSections = []; // [{ id, render(container) }] — разделы добавляют модули лёгкого слоя

    mossadLightSections.push({ id: 'dnd', render(box) {
        const c = mossadDndCfg();
        const sec = document.createElement('div');
        sec.setAttribute('data-light', 'dnd');
        sec.style.cssText = 'background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:8px;font-size:12px;color:#d1d5db;';
        sec.innerHTML = `<div style="font-weight:bold;color:#fff;margin-bottom:4px;">⬇ DND: скачивание по Ctrl+клик (все сайты)</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;"><input data-dnd-cfg="enabled" type="checkbox" ${c.enabled ? 'checked' : ''} style="accent-color:#3b82f6;"> Включено</label>
            <label style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">Подпапка в «Загрузках»:
              <input data-dnd-cfg="folder" type="text" value="${String(c.folder).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" placeholder="пусто — корень" style="width:120px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;"></label>
            <div style="color:#9ca3af;line-height:1.35;">Ctrl + левый клик по картинке/видео — скачать. Ctrl + правый клик — меню: Скачать, Папка…, Копировать кадр.
            Для подпапок в Tampermonkey: Настройки → «Режим загрузки: Browser API».</div>`;
        sec.querySelector('[data-dnd-cfg="enabled"]').onchange = (e) => mossadDndSave({ enabled: e.target.checked });
        const f = sec.querySelector('[data-dnd-cfg="folder"]');
        f.onchange = () => { const v = mossadDndNormFolder(f.value); f.value = v; mossadDndSave({ folder: v }); };
        box.appendChild(sec);
    } });

    mossadLightSections.push({ id: 'speed', render(box) {
        const c = mossadSpeedCfg(true);
        const esc = (x) => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const inCss = 'background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;';
        const sec = document.createElement('div');
        sec.setAttribute('data-light', 'speed');
        sec.style.cssText = 'background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:8px;font-size:12px;color:#d1d5db;';
        const keyLabel = (r) => r.code ? [r.ctrl && 'Ctrl', r.alt && 'Alt', r.shift && 'Shift', r.code.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ').replace('Num Decimal', 'Num .')].filter(Boolean).join('+') : '—';
        const cb = (k, t) => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:3px;"><input data-sp-cfg="${k}" type="checkbox" ${c[k] ? 'checked' : ''} style="accent-color:#3b82f6;"> ${t}</label>`;
        sec.innerHTML = `<div style="font-weight:bold;color:#fff;margin-bottom:4px;">⏩ Видео / скорость (все сайты)</div>
            <div data-sp-rows style="display:flex;flex-direction:column;gap:3px;margin-bottom:4px;"></div>
            <button data-sp-add style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#e5e7eb;padding:2px 10px;cursor:pointer;font-size:12px;margin-bottom:8px;">+ Добавить</button>
            ${cb('enabled', 'Включено')}${cb('remember', 'Запоминать скорость')}${cb('hold', 'Удерживать скорость (если сайт её сбрасывает)')}${cb('audio', 'Работать на аудио')}
            <label style="display:flex;align-items:center;gap:6px;margin:4px 0;">Значок скорости:
              <select data-sp-cfg="badge" style="${inCss}"><option value="off">не показывать</option><option value="ne1">показывать, когда ≠ 1</option><option value="always">всегда</option></select></label>
            <label style="display:flex;align-items:center;gap:6px;">Скорости:
              <input data-sp-cfg="list" type="text" value="${esc(c.list)}" style="flex:1;min-width:0;${inCss}"></label>
            <div style="color:#9ca3af;line-height:1.35;margin-top:4px;">Медленнее/Быстрее: значение пусто — соседняя скорость из списка, число — шаг. Назад/Вперёд — секунды. Сброс: ≠1 → 1, при 1 — прошлая. Клавиши работают на всех сайтах, кроме полей ввода.</div>`;
        sec.querySelector('[data-sp-cfg="badge"]').value = c.badge;
        ['enabled', 'remember', 'hold', 'audio'].forEach(k => { sec.querySelector(`[data-sp-cfg="${k}"]`).onchange = (e) => mossadSpeedSave({ [k]: e.target.checked }); });
        sec.querySelector('[data-sp-cfg="badge"]').onchange = (e) => { mossadSpeedSave({ badge: e.target.value }); };
        const listIn = sec.querySelector('[data-sp-cfg="list"]');
        listIn.onchange = () => { const v = listIn.value.trim() || MOSSAD_SPEED_LIST_DEFAULT; mossadSpeedSave({ list: v }); listIn.value = v; };
        const rowsBox = sec.querySelector('[data-sp-rows]');
        const opts = MOSSAD_SPEED_ACTIONS.map(([k, t]) => `<option value="${k}">${t}</option>`).join('');
        const setRows = (rows) => { mossadSpeedSave({ rows }); paint(); };
        const paint = () => {
            const rows = mossadSpeedCfg().rows;
            rowsBox.innerHTML = rows.map((r, i) => `<div data-sp-row="${i}" style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                <select data-sp="a" style="width:190px;${inCss}">${opts}</select>
                <button data-sp="key" style="min-width:70px;${inCss}cursor:pointer;color:#93c5fd;font-weight:bold;">${esc(keyLabel(r))}</button>
                <input data-sp="v" type="text" value="${esc(r.v)}" placeholder="${r.a === 'slower' || r.a === 'faster' ? 'шаг списка' : (r.a === 'fav' ? '2' : (r.a === 'reset' || r.a === 'badge' ? '' : '5'))}" ${r.a === 'reset' || r.a === 'badge' ? 'disabled' : ''} style="width:60px;${inCss}">
                <button data-sp="x" title="Удалить строку" style="background:#374151;border:1px solid #4b5563;border-radius:4px;color:#f87171;cursor:pointer;padding:1px 7px;">X</button></div>`).join('');
            rowsBox.querySelectorAll('[data-sp-row]').forEach(el => { el.querySelector('[data-sp="a"]').value = rows[+el.dataset.spRow].a; });
        };
        rowsBox.addEventListener('change', (e) => {
            const rowEl = e.target.closest('[data-sp-row]'); if (!rowEl) return;
            const i = +rowEl.dataset.spRow, rows = mossadSpeedCfg().rows.slice(), k = e.target.getAttribute('data-sp');
            if (k === 'a') { rows[i] = Object.assign({}, rows[i], { a: e.target.value }); setRows(rows); }
            if (k === 'v') { rows[i] = Object.assign({}, rows[i], { v: e.target.value.trim() }); mossadSpeedSave({ rows }); }
        });
        rowsBox.addEventListener('click', (e) => {
            const b = e.target.closest('button[data-sp]'); if (!b) return;
            e.preventDefault(); e.stopPropagation();
            const rowEl = b.closest('[data-sp-row]'); const i = +rowEl.dataset.spRow;
            if (b.dataset.sp === 'x') { const rows = mossadSpeedCfg().rows.slice(); rows.splice(i, 1); setRows(rows); return; }
            // запись клавиши
            b.textContent = '...'; b.style.color = '#ef4444';
            window.mossadSpeedCapturing = true;
            const h = (ev) => {
                ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
                if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(ev.key)) return;
                window.removeEventListener('keydown', h, true);
                window.mossadSpeedCapturing = false;
                if (ev.key === 'Escape') { paint(); return; }
                const nb = { key: ev.key, code: ev.code || '', ctrl: ev.ctrlKey, alt: ev.altKey, shift: ev.shiftKey };
                const own = mossadSpeedOwners(nb, mossadLightHkHook ? mossadLightHkHook.comboId : mossadSpeedComboId, i);
                const hk = mossadLightHkHook ? mossadLightHkHook.owners(nb) : [];
                const all = own.concat(hk);
                const apply = () => { const rows = mossadSpeedCfg().rows.slice(); rows[i] = Object.assign({}, rows[i], nb); setRows(rows); };
                if (!all.length) { apply(); return; }
                const box2 = document.createElement('div');
                box2.className = 'mossad-sp-conflict';
                box2.style.cssText = 'flex-basis:100%;color:#fbbf24;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
                box2.innerHTML = '<span>Эта клавиша уже занята: <b></b>. Переназначить?</span><button data-yes style="background:#b91c1c;border:none;color:#fff;border-radius:4px;padding:1px 8px;cursor:pointer;">Да</button><button data-no style="background:#374151;border:none;color:#e5e7eb;border-radius:4px;padding:1px 8px;cursor:pointer;">Отмена</button>';
                box2.querySelector('b').textContent = all.map(o => o.label).join(', ');
                rowEl.appendChild(box2);
                b.textContent = keyLabel(Object.assign({ a: '' }, nb)); b.style.color = '#fbbf24';
                box2.querySelector('[data-yes]').onclick = (e2) => { e2.stopPropagation(); all.forEach(o => o.clear()); apply(); };
                box2.querySelector('[data-no]').onclick = (e2) => { e2.stopPropagation(); paint(); };
            };
            window.addEventListener('keydown', h, true);
        });
        sec.querySelector('[data-sp-add]').onclick = (e) => { e.preventDefault(); setRows(mossadSpeedCfg().rows.concat([_spRow('faster', '', '', '')])); };
        paint();
        box.appendChild(sec);
    } });

    /** Отрисовать все разделы лёгкого слоя в container (очищается). */
    function mossadLightRenderSettings(container) {
        container.innerHTML = '';
        for (const s of mossadLightSections) { try { s.render(container); } catch (e) { console.warn('[MOSSAD] light settings', s.id, e); } }
    }
    /** Плавающее окно настроек лёгкого слоя (команда меню Tampermonkey на любом сайте). */
    function mossadLightOpenPanel() {
        let p = document.getElementById('mossad-light-panel');
        if (p) { p.remove(); return; }
        p = document.createElement('div');
        p.id = 'mossad-light-panel';
        p.style.cssText = 'position:fixed;top:40px;right:20px;z-index:2147483646;width:440px;max-width:94vw;max-height:85vh;overflow:auto;background:rgba(17,24,39,0.97);' +
            'border:1px solid #4b5563;border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,0.6);font:12px system-ui,sans-serif;color:#e5e7eb;';
        p.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:6px;"><b style="flex:1;">🎬 MOSSAD: видео и DND</b><button data-x style="background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;">×</button></div><div data-body></div>';
        (document.body || document.documentElement).appendChild(p);
        p.querySelector('[data-x]').onclick = () => p.remove();
        mossadLightRenderSettings(p.querySelector('[data-body]'));
    }
    try { if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('🎬 MOSSAD: видео и DND', mossadLightOpenPanel); } catch (e) {}
