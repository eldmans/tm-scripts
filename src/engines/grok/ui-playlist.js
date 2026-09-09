    // ============================================================
    // GROK ENGINE: UI Playlist Panel (Modal List with Loop R controls)
    // ============================================================

    /** Список (плейлист): открыть/закрыть. Кнопка R — зациклить группу или файл */
    function grokTogglePlaylistPanel() {
        const existing = document.getElementById('mossad-playlist-panel');
        if (existing) { existing.remove(); return; }

        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (!items.length) { showToast('⚠️ Коллекция пуста', true); return; }

        // Читаем текущий loop-set
        let loopSet = { urls: [], groupIds: [] };
        try {
            const lr = _gSS.getItem('mossad_grok_loop_set');
            if (lr) loopSet = JSON.parse(lr);
        } catch(e) {}
        const saveLoopSet = () => _gSS.setItem('mossad_grok_loop_set', JSON.stringify(loopSet));

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';
        panel.style.cssText = `
            position:fixed; top:70px; right:16px; z-index:9999999;
            width:320px; max-height:75vh; overflow-y:auto;
            background:rgba(12,12,16,0.96); backdrop-filter:blur(20px);
            border:1px solid rgba(255,255,255,0.12); border-radius:14px;
            font-family:system-ui,sans-serif; font-size:12px; color:#d1d5db;
            box-shadow:0 20px 60px rgba(0,0,0,0.7);
        `;

        // ── Заголовок ──
        const header = document.createElement('div');
        header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);gap:6px;`;

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight:700;font-size:13px;flex:1;`;
        titleEl.textContent = `📋 Список (${items.length})`;

        // Кнопка «отключить все R» — появляется если зациклено 2+ элементов
        const btnClearLoop = document.createElement('button');
        btnClearLoop.textContent = 'R ✕';
        btnClearLoop.title = 'Отключить все зацикленные';
        btnClearLoop.style.cssText = `background:#7f1d1d;border:none;border-radius:4px;color:#fca5a5;padding:2px 7px;font-size:10px;font-weight:700;cursor:pointer;display:${(loopSet.urls.length + loopSet.groupIds.length) > 1 ? 'inline-block' : 'none'};`;
        btnClearLoop.onclick = () => {
            loopSet = { urls: [], groupIds: [] };
            saveLoopSet();
            panel.remove();
            grokTogglePlaylistPanel();
        };

        const btnClose = document.createElement('button');
        btnClose.textContent = '×';
        btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;`;
        btnClose.onclick = () => panel.remove();

        header.append(titleEl, btnClearLoop, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding:8px;`;

        // ── Утилита: кнопка R ──
        const makeRBtn = (isActive, onToggle) => {
            const btn = document.createElement('button');
            btn.textContent = 'R';
            btn.style.cssText = `
                background:none;border:none;cursor:pointer;font-weight:700;font-size:11px;
                padding:0 4px;flex-shrink:0;transition:color 0.15s;
                color:${isActive ? '#f87171' : '#374151'};
            `;
            btn.title = isActive ? 'Зациклено — клик для отмены' : 'Зациклить';
            btn.onclick = (e) => {
                e.stopPropagation();
                onToggle(btn);
            };
            return btn;
        };

        // ── Группируем по convId ──
        const groups = {};
        const groupOrder = [];
        for (const item of items) {
            const gid = item.convId || '__noconv__';
            if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
            groups[gid].push(item);
        }

        const hasGroups = groupOrder.length > 1 || (groupOrder.length === 1 && groupOrder[0] !== '__noconv__');

        if (hasGroups) {
            for (const gid of groupOrder) {
                const gItems = groups[gid];
                const grpEl = document.createElement('div');
                grpEl.style.cssText = `margin-bottom:8px;border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;`;

                const grpHeader = document.createElement('div');
                const shortId = gid === '__noconv__' ? 'Без группы' : gid.slice(0, 8) + '…';
                grpHeader.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);`;
                grpHeader.title = `Группа: ${gid}`;

                const isGrpLooped = loopSet.groupIds.includes(gid);
                const rGrp = makeRBtn(isGrpLooped, (btn) => {
                    const i = loopSet.groupIds.indexOf(gid);
                    if (i >= 0) { loopSet.groupIds.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                    else { loopSet.groupIds.push(gid); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                    saveLoopSet();
                    const total = loopSet.urls.length + loopSet.groupIds.length;
                    btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                });

                const grpLabel = document.createElement('span');
                grpLabel.style.cssText = `flex:1;font-weight:600;font-size:11px;color:#7dd3fc;cursor:pointer;`;
                grpLabel.textContent = shortId;
                grpLabel.onclick = () => { panel.remove(); grokStartGallerySlideshowFrom(gItems[0]); };

                const grpCount = document.createElement('span');
                grpCount.style.cssText = `color:#6b7280;font-size:10px;`;
                grpCount.textContent = `${gItems.length} ген.`;

                grpHeader.append(rGrp, grpLabel, grpCount);
                grpEl.appendChild(grpHeader);

                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:3px 8px;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 2px;border-radius:4px;font-size:10px;`;

                    const baseUrl = (item.url || '').split('?')[0];
                    const isLooped = loopSet.urls.some(u => u.split('?')[0] === baseUrl);
                    const rItem = makeRBtn(isLooped, (btn) => {
                        const i = loopSet.urls.findIndex(u => u.split('?')[0] === baseUrl);
                        if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                        else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                        saveLoopSet();
                        const total = loopSet.urls.length + loopSet.groupIds.length;
                        btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                    });

                    const label = document.createElement('span');
                    label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
                    label.textContent = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${item.url.split('/').pop().split('?')[0].slice(0, 22)}`;
                    label.title = item.url;
                    label.onmouseover = () => li.style.background = 'rgba(255,255,255,0.04)';
                    label.onmouseout  = () => li.style.background = 'transparent';
                    label.onclick = () => { panel.remove(); grokStartGallerySlideshowFrom(item); };

                    li.append(rItem, label);
                    listEl.appendChild(li);
                });
                grpEl.appendChild(listEl);
                body.appendChild(grpEl);
            }
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 4px;border-radius:6px;font-size:11px;`;

                const baseUrl = (item.url || '').split('?')[0];
                const isLooped = loopSet.urls.some(u => u.split('?')[0] === baseUrl);
                const rItem = makeRBtn(isLooped, (btn) => {
                    const i = loopSet.urls.findIndex(u => u.split('?')[0] === baseUrl);
                    if (i >= 0) { loopSet.urls.splice(i, 1); btn.style.color = '#374151'; btn.title = 'Зациклить'; }
                    else { loopSet.urls.push(item.url); btn.style.color = '#f87171'; btn.title = 'Зациклено — клик для отмены'; }
                    saveLoopSet();
                    const total = loopSet.urls.length + loopSet.groupIds.length;
                    btnClearLoop.style.display = total > 1 ? 'inline-block' : 'none';
                });

                const label = document.createElement('span');
                label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
                label.textContent = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${item.url.split('/').pop().split('?')[0].slice(0, 26)}`;
                label.title = item.url;
                label.onmouseover = () => li.style.background = 'rgba(255,255,255,0.06)';
                label.onmouseout  = () => li.style.background = 'transparent';
                label.onclick = () => { panel.remove(); grokStartGallerySlideshowFrom(item); };

                li.append(rItem, label);
                body.appendChild(li);
            });
        }

        panel.appendChild(body);
        document.body.appendChild(panel);
    }


