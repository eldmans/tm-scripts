    // ============================================================
    // GROK ENGINE: Playlist Structure & Navigation Resolver
    // ============================================================

    /** Fisher-Yates перемешивание */
    function fisherYatesShuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Строит каноническую структуру плейлиста из сохранённой коллекции:
     * - items: плоский массив в хронологическом порядке (снизу вверх страницы Grok)
     * - groups: массив групп в порядке первого появления элементов снизу вверх
     * - grpMode: режим переключения групп (seq | rev | rnd | off)
     * - itemMode: режим порядка внутри группы (fwd | rev | rnd | off)
     */
    function grokGetPlaylistStructure() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return null;
        let data;
        try { data = JSON.parse(raw); } catch { return null; }
        const items = data.items || [];
        if (!items.length) return null;

        const grpMode  = data.grpMode  || 'seq';
        const itemMode = data.itemMode || 'fwd';

        const groups = [];
        const groupMap = new Map();
        for (const item of items) {
            const gid = item.convId || '__noconv__';
            let grp = groupMap.get(gid);
            if (!grp) {
                grp = { id: gid, items: [] };
                groupMap.set(gid, grp);
                groups.push(grp);
            }
            grp.items.push(item);
        }

        return { items, groups, grpMode, itemMode };
    }

    /**
     * Находит текущее положение на странице/в коллекции:
     * Возвращает { flatIndex, grpIndex, itemInGrpIndex, currentItem }
     */
    function grokFindCurrentPosition(structure, url = null) {
        if (!structure || !structure.items.length) return null;
        const targetUrl = url || location.href;
        const curUuid = (typeof grokExtractUuid === 'function')
            ? grokExtractUuid(targetUrl)
            : (targetUrl.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
        const cleanTarget = targetUrl.split('?')[0].toLowerCase();

        const isMatch = (item) => {
            if (!item || !item.url) return false;
            if (curUuid) {
                const itemUuid = (typeof grokExtractUuid === 'function')
                    ? grokExtractUuid(item.url)
                    : (item.url.match(/\/imagine\/post\/([a-f0-9-]+)/i) || [])[1];
                if (itemUuid && itemUuid.toLowerCase() === curUuid.toLowerCase()) return true;
            }
            return (item.url.split('?')[0].toLowerCase() === cleanTarget);
        };

        let flatIndex = structure.items.findIndex(isMatch);
        let grpIndex = -1;
        let itemInGrpIndex = -1;

        for (let g = 0; g < structure.groups.length; g++) {
            const idx = structure.groups[g].items.findIndex(isMatch);
            if (idx !== -1) {
                grpIndex = g;
                itemInGrpIndex = idx;
                break;
            }
        }

        // На странице группы с киноплёнкой синхронизируем индекс кадра с реальным активным элементом в DOM
        if (!url && typeof isGrokPostPage === 'function' && isGrokPostPage() && typeof grokGetActiveFilmstripIndex === 'function') {
            if (grpIndex === -1 && location.search) {
                const convMatch = location.search.match(/conversation=([a-f0-9-]+)/i);
                if (convMatch) {
                    const cId = convMatch[1].toLowerCase();
                    const g = structure.groups.findIndex(gr => (gr.id || '').toLowerCase() === cId);
                    if (g !== -1) grpIndex = g;
                }
            }
            if (grpIndex !== -1) {
                const filmIdx = grokGetActiveFilmstripIndex();
                if (filmIdx !== -1 && filmIdx < structure.groups[grpIndex].items.length) {
                    itemInGrpIndex = filmIdx;
                    const actItem = structure.groups[grpIndex].items[filmIdx];
                    const fIdx = structure.items.indexOf(actItem);
                    if (fIdx !== -1) flatIndex = fIdx;
                    return {
                        flatIndex,
                        grpIndex,
                        itemInGrpIndex,
                        currentItem: actItem
                    };
                }
            }
        }

        return {
            flatIndex,
            grpIndex,
            itemInGrpIndex,
            currentItem: flatIndex !== -1 ? structure.items[flatIndex] : null
        };
    }

    /**
     * Главный диспетчер навигации по списку:
     * - direction === 'down': строго вниз по нашему списку (в хронологическом порядке)
     * - direction === 'up': строго вверх по нашему списку (в обратном порядке)
     * - direction === 'next_grp': шаг к следующей группе
     * - direction === 'prev_grp': шаг к предыдущей группе
     * - direction === 'auto': шаг автоматического слайдшоу с учётом grpMode и itemMode
     */
    function grokGetNextSlideItem(direction = 'auto', overrideUrl = null) {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) return null;

        const curPos = grokFindCurrentPosition(struct, overrideUrl);

        // ── 1. Зацикленный набор (R / loopSet) ──
        let loopSet = { urls: [], groupIds: [] };
        try {
            const lr = _gSS.getItem('mossad_grok_loop_set');
            if (lr) loopSet = JSON.parse(lr);
        } catch(e) {}
        const loopUrls = loopSet.urls || [];
        const loopGroupIds = loopSet.groupIds || [];

        if (loopUrls.length > 0 || loopGroupIds.length > 0) {
            const loopItems = struct.items.filter(item => {
                const base = (item.url || '').split('?')[0].toLowerCase();
                const inUrls = loopUrls.some(u => u.split('?')[0].toLowerCase() === base);
                const inGrps = loopGroupIds.includes(item.convId || '__noconv__');
                return inUrls || inGrps;
            });
            if (loopItems.length > 0) {
                const curLoopIdx = loopItems.findIndex(item => {
                    if (!curPos || !curPos.currentItem) return false;
                    return (item.url || '').split('?')[0].toLowerCase() === (curPos.currentItem.url || '').split('?')[0].toLowerCase();
                });
                let targetIdx = 0;
                if (curLoopIdx !== -1) {
                    if (direction === 'up' || (direction === 'auto' && struct.itemMode === 'rev')) {
                        targetIdx = (curLoopIdx - 1 + loopItems.length) % loopItems.length;
                    } else {
                        targetIdx = (curLoopIdx + 1) % loopItems.length;
                    }
                }
                const circleCompleted = (curLoopIdx === loopItems.length - 1 && targetIdx === 0);
                return { item: loopItems[targetIdx], circleCompleted };
            }
        }

        // ── 2. Переходы по группам (Alt+ArrowDown / Alt+ArrowUp) ──
        if (direction === 'next_grp' || direction === 'prev_grp') {
            if (!struct.groups.length) return null;
            const curG = (curPos && curPos.grpIndex !== -1) ? curPos.grpIndex : 0;
            const nextG = direction === 'next_grp'
                ? (curG + 1) % struct.groups.length
                : (curG - 1 + struct.groups.length) % struct.groups.length;
            const targetGrp = struct.groups[nextG];
            const targetItem = struct.itemMode === 'rev'
                ? targetGrp.items[targetGrp.items.length - 1]
                : targetGrp.items[0];
            return { item: targetItem, circleCompleted: false };
        }

        // ── 3. Ручной переход ВНИЗ (ArrowDown / PageDown) — СТРОГО ВНИЗ ПО СПИСКУ ──
        if (direction === 'down') {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[0], circleCompleted: false };
            }
            if (struct.grpMode === 'off' || !struct.groups.length) {
                const nextFlat = (curPos.flatIndex + 1) % struct.items.length;
                return { item: struct.items[nextFlat], circleCompleted: nextFlat === 0 };
            }
            const g = curPos.grpIndex;
            const curGrp = struct.groups[g];
            const i = curPos.itemInGrpIndex;
            if (curGrp && i + 1 < curGrp.items.length) {
                return { item: curGrp.items[i + 1], circleCompleted: false };
            }
            // Конец группы -> переход к первой записи следующей группы вниз
            const nextG = (g + 1) % struct.groups.length;
            const nextGrp = struct.groups[nextG];
            return { item: nextGrp.items[0], circleCompleted: nextG === 0 };
        }

        // ── 4. Ручной переход ВВЕРХ (ArrowUp / PageUp) — СТРОГО ВВЕРХ ПО СПИСКУ ──
        if (direction === 'up') {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[struct.items.length - 1], circleCompleted: false };
            }
            if (struct.grpMode === 'off' || !struct.groups.length) {
                const prevFlat = (curPos.flatIndex - 1 + struct.items.length) % struct.items.length;
                return { item: struct.items[prevFlat], circleCompleted: prevFlat === struct.items.length - 1 };
            }
            const g = curPos.grpIndex;
            const curGrp = struct.groups[g];
            const i = curPos.itemInGrpIndex;
            if (curGrp && i - 1 >= 0) {
                return { item: curGrp.items[i - 1], circleCompleted: false };
            }
            // Начало группы -> переход к последней записи предыдущей группы вверх
            const prevG = (g - 1 + struct.groups.length) % struct.groups.length;
            const prevGrp = struct.groups[prevG];
            return { item: prevGrp.items[prevGrp.items.length - 1], circleCompleted: prevG === struct.groups.length - 1 };
        }

        // ── 5. Автоматический шаг слайдшоу (direction === 'auto') ──
        let ss = {};
        try { ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}'); } catch(e) {}
        let visitedInCurGroup = ss.visitedInCurGroup || [];
        let visitedGroups = ss.visitedGroupsInCircle || [];
        let visitedInCircle = ss.visitedInCircle || [];

        // Режим без групп (grpMode === 'off')
        if (struct.grpMode === 'off' || !struct.groups.length) {
            if (!curPos || curPos.flatIndex === -1) {
                return { item: struct.items[0], circleCompleted: false };
            }
            if (struct.itemMode === 'rev') {
                const prevIdx = curPos.flatIndex - 1;
                if (prevIdx < 0) {
                    return { item: struct.items[struct.items.length - 1], circleCompleted: true };
                }
                return { item: struct.items[prevIdx], circleCompleted: false };
            }
            if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
                const curBase = (curPos.currentItem?.url || '').split('?')[0].toLowerCase();
                if (!visitedInCircle.includes(curBase)) visitedInCircle.push(curBase);
                const unvisited = struct.items.filter(it => !visitedInCircle.includes((it.url || '').split('?')[0].toLowerCase()));
                if (unvisited.length === 0) {
                    ss.visitedInCircle = [];
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    const rndItem = struct.items[Math.floor(Math.random() * struct.items.length)];
                    return { item: rndItem, circleCompleted: true };
                }
                const rndItem = unvisited[Math.floor(Math.random() * unvisited.length)];
                visitedInCircle.push((rndItem.url || '').split('?')[0].toLowerCase());
                ss.visitedInCircle = visitedInCircle;
                _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                return { item: rndItem, circleCompleted: false };
            }
            // itemMode === 'fwd' (прямой порядок)
            const nextIdx = curPos.flatIndex + 1;
            if (nextIdx >= struct.items.length) {
                return { item: struct.items[0], circleCompleted: true };
            }
            return { item: struct.items[nextIdx], circleCompleted: false };
        }

        // Режим с группами
        let g = (curPos && curPos.grpIndex !== -1) ? curPos.grpIndex : 0;
        let curGrp = struct.groups[g];
        let i = (curPos && curPos.itemInGrpIndex !== -1) ? curPos.itemInGrpIndex : 0;

        const curBase = (curPos?.currentItem?.url || '').split('?')[0].toLowerCase();
        if (!visitedInCurGroup.includes(curBase)) visitedInCurGroup.push(curBase);
        if (!visitedGroups.includes(curGrp.id)) visitedGroups.push(curGrp.id);

        let nextItemInGrp = null;
        let groupDone = false;

        if (struct.itemMode === 'fwd') {
            // Идем вниз по элементам группы
            if (i + 1 < curGrp.items.length) {
                nextItemInGrp = curGrp.items[i + 1];
            } else {
                groupDone = true;
            }
        } else if (struct.itemMode === 'rev') {
            // Идем вверх по элементам группы
            if (i - 1 >= 0) {
                nextItemInGrp = curGrp.items[i - 1];
            } else {
                groupDone = true;
            }
        } else {
            // rnd / off: случайный выбор среди непосещенных в текущей группе
            const unvisitedInGrp = curGrp.items.filter(it => !visitedInCurGroup.includes((it.url || '').split('?')[0].toLowerCase()));
            if (unvisitedInGrp.length > 0) {
                nextItemInGrp = unvisitedInGrp[Math.floor(Math.random() * unvisitedInGrp.length)];
            } else {
                groupDone = true;
            }
        }

        if (!groupDone && nextItemInGrp) {
            visitedInCurGroup.push((nextItemInGrp.url || '').split('?')[0].toLowerCase());
            ss.visitedInCurGroup = visitedInCurGroup;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            return { item: nextItemInGrp, circleCompleted: false };
        }

        // Группа завершена! Переходим к следующей группе
        ss.visitedInCurGroup = [];
        let nextG = -1;
        let circleCompleted = false;

        if (struct.grpMode === 'rev') {
            // Группы вверх по списку
            nextG = g - 1;
            if (nextG < 0) {
                nextG = struct.groups.length - 1;
                circleCompleted = true;
            }
        } else if (struct.grpMode === 'rnd') {
            // Случайный выбор следующей группы
            const unvisitedGrps = struct.groups.filter(grp => !visitedGroups.includes(grp.id));
            if (unvisitedGrps.length === 0) {
                circleCompleted = true;
                visitedGroups = [];
                const rndGrp = struct.groups[Math.floor(Math.random() * struct.groups.length)];
                nextG = struct.groups.indexOf(rndGrp);
            } else {
                const rndGrp = unvisitedGrps[Math.floor(Math.random() * unvisitedGrps.length)];
                nextG = struct.groups.indexOf(rndGrp);
            }
            visitedGroups.push(struct.groups[nextG].id);
        } else {
            // grpMode === 'seq': группы вниз по списку
            nextG = g + 1;
            if (nextG >= struct.groups.length) {
                nextG = 0;
                circleCompleted = true;
            }
        }

        ss.visitedGroupsInCircle = visitedGroups;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        const targetGrp = struct.groups[nextG];
        let targetItem = null;
        if (struct.itemMode === 'rev') {
            targetItem = targetGrp.items[targetGrp.items.length - 1];
        } else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') {
            targetItem = targetGrp.items[Math.floor(Math.random() * targetGrp.items.length)];
        } else {
            targetItem = targetGrp.items[0];
        }

        ss.visitedInCurGroup = [(targetItem.url || '').split('?')[0].toLowerCase()];
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        return { item: targetItem, circleCompleted };
    }

    /** Совместимость: возвращает плоскую очередь элементов */
    function grokBuildGalleryQueue(allItems, ssState) {
        const struct = grokGetPlaylistStructure();
        if (struct && struct.items.length) {
            const queue = [];
            const grpOrder = struct.grpMode === 'rev'
                ? struct.groups.slice().reverse()
                : (struct.grpMode === 'rnd' ? fisherYatesShuffle(struct.groups) : struct.groups.slice());

            for (const g of grpOrder) {
                let itms = g.items.slice();
                if (struct.itemMode === 'rev') itms.reverse();
                else if (struct.itemMode === 'rnd' || struct.itemMode === 'off') itms = fisherYatesShuffle(itms);
                queue.push(...itms);
            }
            return queue;
        }
        return (allItems || []).slice();
    }

    /**
     * SPA-навигация на grok.com через Next.js router.push() — без перезагрузки страницы.
     * Подтверждено: window.next.router доступен на grok.com.
     * Fallback: клик по <a> или window.location.href (полный переход).
     */
