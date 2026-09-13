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

        // Если URL не передан явно — определяем текущий элемент через grokFindCurrentPosition (учитывая киноплёнку)
        if (!overrideUrl && typeof grokGetPlaylistStructure === 'function' && typeof grokFindCurrentPosition === 'function') {
            const struct = grokGetPlaylistStructure();
            const curPos = grokFindCurrentPosition(struct);
            if (curPos && curPos.currentItem && curPos.currentItem.url) {
                overrideUrl = curPos.currentItem.url;
            }
        }

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
                el.style.borderRadius = '4px';
                el.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.3)';
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

        const savedCustomWidth = (typeof config !== 'undefined' && config.playlistWidth)
            ? config.playlistWidth
            : parseInt(localStorage.getItem('mossad_playlist_width') || '0', 10);
        const savedCustomHeight = parseInt(localStorage.getItem('mossad_playlist_height') || '0', 10);
        let currentFontSize = parseInt(localStorage.getItem('mossad_playlist_font_size') || '11', 10);
        if (isNaN(currentFontSize) || currentFontSize < 8) currentFontSize = 8;
        if (currentFontSize > 20) currentFontSize = 20;

        const initialWidth = savedCustomWidth > 0 ? `${savedCustomWidth}px` : '100%';
        const initialHeight = savedCustomHeight > 0 ? `${savedCustomHeight}px` : 'auto';

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';

        const container = document.getElementById('mossad-widget-container');
        if (container) {
            // Монолитно внутри контейнера виджета
            panel.style.cssText = `
                box-sizing: border-box; width: ${initialWidth}; ${savedCustomHeight > 0 ? `height: ${initialHeight};` : ''}
                min-width: 140px; max-width: 95vw; min-height: 90px; max-height: 85vh;
                overflow-y: auto; overflow-x: hidden; resize: both;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: var(--mossad-pl-font-size, 11px); color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                pointer-events: auto;
                --mossad-pl-font-size: ${currentFontSize}px;
            `;
        } else {
            // Fallback (если виджет ещё не создан)
            panel.style.cssText = `
                position: fixed; top: 70px; right: 16px; z-index: 9999999;
                width: ${savedCustomWidth > 0 ? `${savedCustomWidth}px` : '240px'}; ${savedCustomHeight > 0 ? `height: ${initialHeight};` : ''}
                min-width: 140px; max-width: 95vw; min-height: 90px; max-height: 85vh;
                overflow-y: auto; overflow-x: hidden; resize: both;
                background: rgba(14, 14, 18, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
                font-family: system-ui, -apple-system, sans-serif; font-size: var(--mossad-pl-font-size, 11px); color: #d1d5db;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
                scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
                --mossad-pl-font-size: ${currentFontSize}px;
            `;
        }

        // Сохраняем пользовательские размеры при интерактивном ресайзе мышью
        if (window.ResizeObserver) {
            let lastW = savedCustomWidth || 0;
            let lastH = savedCustomHeight || 0;
            const ro = new ResizeObserver(entries => {
                for (const entry of entries) {
                    const w = Math.round(entry.contentRect.width);
                    const h = Math.round(entry.contentRect.height);
                    if (w >= 120 && Math.abs(w - lastW) > 6) {
                        lastW = w;
                        localStorage.setItem('mossad_playlist_width', String(w));
                        if (typeof Settings !== 'undefined') {
                            Settings.setQuiet('playlistWidth', w);
                        }
                    }
                    if (h >= 80 && Math.abs(h - lastH) > 6) {
                        lastH = h;
                        localStorage.setItem('mossad_playlist_height', String(h));
                    }
                }
            });
            ro.observe(panel);
        }

        // ── Заголовок (липкий вверху с поддержкой перетаскивания всего меню) ──
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            gap: 6px; position: sticky; top: 0; background: rgba(14, 14, 18, 0.98);
            backdrop-filter: blur(16px); z-index: 2; border-top-left-radius: 12px; border-top-right-radius: 12px;
            cursor: grab; min-width: 0; max-width: 100%; box-sizing: border-box;
        `;
        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(header);
        }

        const titleEl = document.createElement('span');
        titleEl.style.cssText = `font-weight: 700; font-size: calc(var(--mossad-pl-font-size, 11px) + 2px); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;`;
        titleEl.textContent = `📋 Список (${items.length})`;
        titleEl.title = 'Двойной клик — сбросить ширину и высоту списка';
        titleEl.ondblclick = () => {
            panel.style.width = '100%';
            panel.style.height = 'auto';
            localStorage.removeItem('mossad_playlist_width');
            localStorage.removeItem('mossad_playlist_height');
            if (typeof Settings !== 'undefined') {
                Settings.setQuiet('playlistWidth', 0);
            }
            showToast('↔ Размеры списка сброшены');
        };

        // Кнопки масштабирования шрифта списка (A− / A+)
        const fontControls = document.createElement('div');
        fontControls.style.cssText = `display: flex; align-items: center; gap: 3px; flex-shrink: 0;`;

        const btnFontDec = document.createElement('button');
        btnFontDec.textContent = 'A−';
        btnFontDec.title = 'Уменьшить шрифт списка';
        btnFontDec.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#9ca3af;padding:1px 5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;transition:all 0.15s;`;
        btnFontDec.onmouseenter = () => { btnFontDec.style.color = '#ffffff'; btnFontDec.style.background = 'rgba(255,255,255,0.14)'; };
        btnFontDec.onmouseleave = () => { btnFontDec.style.color = '#9ca3af'; btnFontDec.style.background = 'rgba(255,255,255,0.06)'; };
        btnFontDec.onclick = (e) => {
            e.stopPropagation();
            if (currentFontSize > 8) {
                currentFontSize--;
                panel.style.setProperty('--mossad-pl-font-size', `${currentFontSize}px`);
                localStorage.setItem('mossad_playlist_font_size', String(currentFontSize));
            }
        };

        const btnFontInc = document.createElement('button');
        btnFontInc.textContent = 'A+';
        btnFontInc.title = 'Увеличить шрифт списка';
        btnFontInc.style.cssText = `background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#9ca3af;padding:1px 5px;font-size:10px;font-weight:700;cursor:pointer;line-height:1.2;transition:all 0.15s;`;
        btnFontInc.onmouseenter = () => { btnFontInc.style.color = '#ffffff'; btnFontInc.style.background = 'rgba(255,255,255,0.14)'; };
        btnFontInc.onmouseleave = () => { btnFontInc.style.color = '#9ca3af'; btnFontInc.style.background = 'rgba(255,255,255,0.06)'; };
        btnFontInc.onclick = (e) => {
            e.stopPropagation();
            if (currentFontSize < 20) {
                currentFontSize++;
                panel.style.setProperty('--mossad-pl-font-size', `${currentFontSize}px`);
                localStorage.setItem('mossad_playlist_font_size', String(currentFontSize));
            }
        };
        fontControls.append(btnFontDec, btnFontInc);

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

        header.append(titleEl, fontControls, btnClearLoop, btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding: 2px; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: hidden;`;

        // ── Утилита: кнопка R ──
        const makeRBtn = (isActive, onToggle) => {
            const btn = document.createElement('button');
            btn.textContent = 'R';
            btn.style.cssText = `
                background:none;border:none;cursor:pointer;font-weight:700;font-size:var(--mossad-pl-font-size, 10px);
                padding:0 2px;line-height:1;flex-shrink:0;transition:color 0.15s;
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
            groupOrder.forEach((gid, gIdx) => {
                const gItems = groups[gid];
                const grpEl = document.createElement('div');
                grpEl.className = 'mossad-playlist-group';
                grpEl.style.cssText = `margin-bottom:2px;border:1px solid rgba(255,255,255,0.07);border-radius:5px;overflow:hidden;transition:border-color 0.2s;min-width:0;max-width:100%;box-sizing:border-box;`;

                const grpHeader = document.createElement('div');
                grpHeader.className = 'mossad-playlist-grp-header';
                const shortId = gid === '__noconv__' ? 'Без группы' : `Гр. ${gIdx + 1}: ${gid.slice(0, 8)}…`;
                grpHeader.style.cssText = `display:flex;align-items:center;gap:3px;padding:2px 5px;background:rgba(255,255,255,0.04);line-height:1.15;transition:background 0.2s;min-width:0;max-width:100%;box-sizing:border-box;`;
                grpHeader.title = `Группа ${gIdx + 1}: ${gid}`;

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
                grpLabel.style.cssText = `flex:1;min-width:0;font-weight:600;font-size:var(--mossad-pl-font-size, 11px);color:#7dd3fc;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15;`;
                grpLabel.textContent = shortId;
                grpLabel.onclick = (e) => {
                    e.stopPropagation();
                    const rawCol = _gSS.getItem(GALLERY_COLLECTION_KEY);
                    let itemMode = 'fwd';
                    if (rawCol) {
                        try { itemMode = JSON.parse(rawCol).itemMode || 'fwd'; } catch(err) {}
                    }
                    let startItem = gItems[0];
                    if (itemMode === 'rev') {
                        startItem = gItems[gItems.length - 1];
                    } else if (itemMode === 'rnd') {
                        startItem = gItems[Math.floor(Math.random() * gItems.length)];
                    }
                    grokStartGallerySlideshowFrom(startItem);
                    grokHighlightActivePlaylistItem(startItem.url);
                };

                const grpCount = document.createElement('span');
                grpCount.style.cssText = `color:#6b7280;font-size:calc(var(--mossad-pl-font-size, 11px) - 1px);flex-shrink:0;white-space:nowrap;line-height:1.15;`;
                grpCount.textContent = `${gItems.length} ген.`;

                grpHeader.append(rGrp, grpLabel, grpCount);
                grpEl.appendChild(grpHeader);

                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:1px 2px;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.className = 'mossad-playlist-item';
                    li.dataset.url = item.url || '';
                    const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                    li.dataset.uuid = itemUuid;
                    li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 10px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

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
                    label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
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
            });
        } else {
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.className = 'mossad-playlist-item';
                li.dataset.url = item.url || '';
                const itemUuid = (typeof grokExtractUuid === 'function') ? grokExtractUuid(item.url) : '';
                li.dataset.uuid = itemUuid;
                li.style.cssText = `display:flex;align-items:center;gap:3px;padding:1px 3px;margin:0 0 1px 0;border-radius:3px;font-size:var(--mossad-pl-font-size, 11px);line-height:1.15;border:1px solid transparent;cursor:pointer;transition:all 0.12s;min-width:0;max-width:100%;box-sizing:border-box;`;

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
                label.style.cssText = `flex:1;min-width:0;cursor:pointer;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;transition:color 0.12s;`;
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
