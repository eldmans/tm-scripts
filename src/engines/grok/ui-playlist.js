    // ============================================================
    // GROK ENGINE: UI Playlist Panel (Monolithic List & Active Highlight)
    // ============================================================

    /** Подсвечивает кнопку [📋 Список] в баре при открытом списке */
    function grokUpdatePlaylistBtnState(isOpen) {
        const btn = document.getElementById('mossad-gallery-collect');
        if (!btn) return;
        if (isOpen) {
            btn.style.boxShadow = '0 0 0 1px #3b82f6, 0 0 8px rgba(59,130,246,0.5)';
        } else {
            btn.style.boxShadow = 'none';
        }
    }

    /** Подсвечивает активный файл в открытом списке (плейлисте) и скроллит к нему */
    function grokHighlightActivePlaylistItem(overrideUrl = null) {
        const panel = document.getElementById('mossad-playlist-panel');
        if (!panel) return;

        // Извлекаем активный UUID
        let activeUuid = '';
        if (overrideUrl) {
            activeUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(overrideUrl)
                : '';
        } else {
            activeUuid = (typeof grokExtractUuid === 'function')
                ? grokExtractUuid(location.pathname)
                : '';
            if (!activeUuid && location.search) {
                activeUuid = (typeof grokExtractUuid === 'function')
                    ? grokExtractUuid(location.search)
                    : '';
            }
        }

        const currentCleanUrl = (overrideUrl || location.href).split('?')[0].toLowerCase();
        let currentPath = '';
        try {
            currentPath = (overrideUrl ? new URL(overrideUrl, location.origin).pathname : location.pathname).toLowerCase();
        } catch(e) {
            currentPath = location.pathname.toLowerCase();
        }

        const items = panel.querySelectorAll('.mossad-playlist-item');
        let matchedEl = null;

        items.forEach(el => {
            const itemUrl = (el.dataset.url || '').toLowerCase();
            const itemUuid = (el.dataset.uuid || '').toLowerCase();
            const cleanItemUrl = itemUrl.split('?')[0];

            let isActive = false;
            if (activeUuid && itemUuid && activeUuid === itemUuid) {
                isActive = true;
            } else if (cleanItemUrl && (cleanItemUrl === currentCleanUrl || (currentPath && cleanItemUrl.endsWith(currentPath)))) {
                isActive = true;
            }

            const label = el.querySelector('.mossad-playlist-label');
            const origText = el.dataset.origText || (label ? label.textContent.replace(/^▶\s*/, '') : '');
            if (!el.dataset.origText && origText) el.dataset.origText = origText;

            if (isActive) {
                matchedEl = el;
                el.style.background = 'rgba(59, 130, 246, 0.28)';
                el.style.border = '1px solid rgba(96, 165, 250, 0.6)';
                el.style.borderRadius = '6px';
                el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.35)';
                if (label) {
                    label.style.color = '#ffffff';
                    label.style.fontWeight = '700';
                    label.textContent = '▶ ' + origText;
                }
                const grpEl = el.closest('.mossad-playlist-group');
                if (grpEl) {
                    grpEl.style.borderColor = 'rgba(96, 165, 250, 0.4)';
                    const gh = grpEl.querySelector('.mossad-playlist-grp-header');
                    if (gh) gh.style.background = 'rgba(59, 130, 246, 0.12)';
                }
            } else {
                el.style.background = 'transparent';
                el.style.border = '1px solid transparent';
                el.style.boxShadow = 'none';
                if (label) {
                    label.style.color = '#9ca3af';
                    label.style.fontWeight = 'normal';
                    label.textContent = origText;
                }
            }
            el.dataset.active = isActive ? 'true' : 'false';
        });

        // Сбросить оформление групп, в которых нет активного элемента
        panel.querySelectorAll('.mossad-playlist-group').forEach(grp => {
            const hasActive = !!grp.querySelector('.mossad-playlist-item[data-active="true"]');
            if (!hasActive) {
                grp.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                const gh = grp.querySelector('.mossad-playlist-grp-header');
                if (gh) gh.style.background = 'rgba(255, 255, 255, 0.04)';
            }
        });

        if (matchedEl) {
            try {
                matchedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } catch(e) {}
        }
    }

    /** Список (плейлист): открыть/закрыть. Монолитно крепится к меню виджета MOSSAD */
    function grokTogglePlaylistPanel(forceOpen = false) {
        const existing = document.getElementById('mossad-playlist-panel');
        if (existing) {
            if (forceOpen) {
                grokHighlightActivePlaylistItem();
                return;
            }
            existing.remove();
            _gSS.removeItem('mossad_playlist_open');
            grokUpdatePlaylistBtnState(false);
            return;
        }

        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            if (!forceOpen) showToast('⚠️ Коллекция не собрана', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (!items.length) {
            if (!forceOpen) showToast('⚠️ Коллекция пуста', true);
            return;
        }

        // Запоминаем состояние открытия плейлиста для сохранения между переходами
        _gSS.setItem('mossad_playlist_open', 'true');

        // Читаем текущий loop-set
        let loopSet = { urls: [], groupIds: [] };
        try {
            const lr = _gSS.getItem('mossad_grok_loop_set');
            if (lr) loopSet = JSON.parse(lr);
        } catch(e) {}
        const saveLoopSet = () => _gSS.setItem('mossad_grok_loop_set', JSON.stringify(loopSet));

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';

        const container = document.getElementById('mossad-widget-container');
        if (container) {
            // Монолитно внутри контейнера виджета
            panel.style.cssText = `
                box-sizing: border-box; width: 100%; min-width: 320px; max-width: 380px;
                max-height: 62vh; overflow-y: auto;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
            `;
        } else {
            // Fallback (если виджет ещё не создан)
            panel.style.cssText = `
                position: fixed; top: 70px; right: 16px; z-index: 9999999;
                width: 320px; max-height: 62vh; overflow-y: auto;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
            `;
        }

        // ── Заголовок (липкий вверху с поддержкой перетаскивания всего меню) ──
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 6px; position: sticky; top: 0; background: rgba(14, 14, 18, 0.98);
            backdrop-filter: blur(16px); z-index: 2; border-top-left-radius: 12px; border-top-right-radius: 12px;
            cursor: grab;
        `;
        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(header);
        }

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight: 700; font-size: 13px; flex: 1;`;
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
            grokTogglePlaylistPanel(true);
        };

        const btnClose = document.createElement('button');
        btnClose.textContent = '×';
        btnClose.title = 'Закрыть список';
        btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;transition:color 0.15s;`;
        btnClose.onmouseenter = () => btnClose.style.color = '#f87171';
        btnClose.onmouseleave = () => btnClose.style.color = '#9ca3af';
        btnClose.onclick = () => {
            panel.remove();
            _gSS.removeItem('mossad_playlist_open');
            grokUpdatePlaylistBtnState(false);
        };

        header.append(titleEl, btnClearLoop, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding: 6px;`;

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
                grpEl.className = 'mossad-playlist-group';
                grpEl.style.cssText = `margin-bottom:6px;border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;transition:border-color 0.2s;`;

                const grpHeader = document.createElement('div');
                grpHeader.className = 'mossad-playlist-grp-header';
                const shortId = gid === '__noconv__' ? 'Без группы' : gid.slice(0, 8) + '…';
                grpHeader.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(255,255,255,0.04);transition:background 0.2s;`;
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
                grpLabel.onclick = (e) => {
                    e.stopPropagation();
                    grokStartGallerySlideshowFrom(gItems[0]);
                    grokHighlightActivePlaylistItem(gItems[0].url);
                };

                const grpCount = document.createElement('span');
                grpCount.style.cssText = `color:#6b7280;font-size:10px;`;
                grpCount.textContent = `${gItems.length} ген.`;

                grpHeader.append(rGrp, grpLabel, grpCount);
                grpEl.appendChild(grpHeader);

                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:3px 6px;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.className = 'mossad-playlist-item';
                    li.dataset.url = item.url || '';
                    const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                    li.dataset.uuid = itemUuid;
                    li.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;margin-bottom:2px;border-radius:6px;font-size:10px;border:1px solid transparent;cursor:pointer;transition:all 0.15s;`;

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
                    label.className = 'mossad-playlist-label';
                    label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;`;
                    const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 22)}`;
                    label.textContent = baseText;
                    li.dataset.origText = baseText;
                    label.title = item.url;

                    li.onmouseover = () => {
                        if (li.dataset.active !== 'true') li.style.background = 'rgba(255,255,255,0.05)';
                    };
                    li.onmouseout = () => {
                        if (li.dataset.active !== 'true') li.style.background = 'transparent';
                    };

                    const onPlayItem = (e) => {
                        e.stopPropagation();
                        grokStartGallerySlideshowFrom(item);
                        grokHighlightActivePlaylistItem(item.url);
                    };
                    label.onclick = onPlayItem;
                    li.onclick = onPlayItem;

                    li.append(rItem, label);
                    listEl.appendChild(li);
                });
                grpEl.appendChild(listEl);
                body.appendChild(grpEl);
            }
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.className = 'mossad-playlist-item';
                li.dataset.url = item.url || '';
                const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                li.dataset.uuid = itemUuid;
                li.style.cssText = `display:flex;align-items:center;gap:4px;padding:3px 6px;margin-bottom:2px;border-radius:6px;font-size:11px;border:1px solid transparent;cursor:pointer;transition:all 0.15s;`;

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
                label.className = 'mossad-playlist-label';
                label.style.cssText = `flex:1;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color 0.15s;`;
                const baseText = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${(item.url.split('/').pop() || '').split('?')[0].slice(0, 26)}`;
                label.textContent = baseText;
                li.dataset.origText = baseText;
                label.title = item.url;

                li.onmouseover = () => {
                    if (li.dataset.active !== 'true') li.style.background = 'rgba(255,255,255,0.06)';
                };
                li.onmouseout = () => {
                    if (li.dataset.active !== 'true') li.style.background = 'transparent';
                };

                const onPlayItem = (e) => {
                    e.stopPropagation();
                    grokStartGallerySlideshowFrom(item);
                    grokHighlightActivePlaylistItem(item.url);
                };
                label.onclick = onPlayItem;
                li.onclick = onPlayItem;

                li.append(rItem, label);
                body.appendChild(li);
            });
        }

        panel.appendChild(body);

        // Монолитное крепление к контейнеру виджета
        if (container) {
            const settingsPanel = document.getElementById('mossad-panel');
            if (settingsPanel && settingsPanel.parentNode === container) {
                container.insertBefore(panel, settingsPanel);
            } else {
                container.appendChild(panel);
            }
        } else {
            document.body.appendChild(panel);
        }

        grokUpdatePlaylistBtnState(true);

        // Подсвечиваем активный элемент сразу при открытии списка
        grokHighlightActivePlaylistItem();
    }
