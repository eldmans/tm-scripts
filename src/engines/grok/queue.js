    // ============================================================
    // GROK ENGINE: Playlist Structure & Navigation Resolver
    // ============================================================

    /**
     * Строит каноническую структуру плейлиста из сохранённой коллекции:
     * - items: плоский массив в хронологическом порядке (снизу вверх страницы Grok)
     * - groups: массив групп в порядке первого появления элементов снизу вверх
     * - grpMode: режим переключения групп (seq | rev | rnd | off)
     * - itemMode: режим порядка внутри группы (fwd | rev | rnd | off)
     */
    // v1.3.38: кэш разобранной структуры. Раньше вся коллекция (растёт за сессию, хранится в sessionStorage
    // до перезапуска браузера) парсилась JSON.parse 5–8 раз на каждый шаг/клавишу. Теперь — только при
    // изменении сохранённой строки. Результат общий: НЕ мутировать struct/items/groups у вызывающих.
    let _plStructCacheRaw = null;
    let _plStructCache = null;

    function grokGetPlaylistStructure() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return null;
        if (raw === _plStructCacheRaw) return _plStructCache;
        const built = grokBuildPlaylistStructure(raw);
        _plStructCacheRaw = raw;
        _plStructCache = built;
        return built;
    }

    function grokBuildPlaylistStructure(raw) {
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
        const curUuid = grokExtractUuid(targetUrl);
        const cleanTarget = normUrlKey(targetUrl);

        const isMatch = (item) => {
            if (!item || !item.url) return false;
            if (curUuid) {
                const itemUuid = grokExtractUuid(item.url);
                if (itemUuid && itemUuid.toLowerCase() === curUuid.toLowerCase()) return true;
            }
            return (normUrlKey(item.url) === cleanTarget);
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
    // ── v1.3.38: история показанных элементов (для «назад» в случайных режимах) и явная синхронизация позиции ──
    const GALLERY_HISTORY_MAX = 200;

    function grokReadSS() {
        try { return JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}') || {}; } catch(e) { return {}; }
    }

    function grokIsRandomMode(struct) {
        return !!struct && (struct.grpMode === 'rnd' || struct.itemMode === 'rnd' || struct.itemMode === 'off');
    }

    /** Добавляет url в историю (без повторов подряд), ограничивая размер. Мутирует ss. */
    function grokHistoryPushInto(ss, url) {
        if (!url) return;
        const hist = Array.isArray(ss.history) ? ss.history : [];
        const key = normUrlKey(url);
        if (!hist.length || normUrlKey(hist[hist.length - 1]) !== key) hist.push(url);
        if (hist.length > GALLERY_HISTORY_MAX) hist.splice(0, hist.length - GALLERY_HISTORY_MAX);
        ss.history = hist;
    }

    /**
     * Явно фиксирует «текущий» элемент слайдшоу в SS: targetUrl/targetUuid, curGrpIdx/curItemIdx, отметки
     * посещения и история. Вызывается при ЛЮБОМ переходе по плейлисту (авто, хоткеи, клик в списке),
     * чтобы следующий автошаг считался от реально выбранного элемента, а не от устаревшей позиции.
     */
    function grokSyncSlidePosition(item, opts = {}) {
        if (!item || !item.url) return;
        const struct = opts.struct || grokGetPlaylistStructure();
        const ss = opts.ss || grokReadSS();
        if (!ss.active && !opts.force) return; // слайдшоу по коллекции не запущено — позицию не ведём
        const base = normUrlKey(item.url);
        ss.targetUrl = item.url;
        ss.targetUuid = grokExtractUuid(item.url);
        if (struct) {
            for (let g = 0; g < struct.groups.length; g++) {
                const i = struct.groups[g].items.findIndex(it => normUrlKey(it.url) === base);
                if (i !== -1) {
                    if (ss.curGrpIdx !== g) ss.visitedInCurGroup = [];
                    ss.curGrpIdx = g;
                    ss.curItemIdx = i;
                    const vg = Array.isArray(ss.visitedGroupsInCircle) ? ss.visitedGroupsInCircle : [];
                    if (!vg.includes(struct.groups[g].id)) vg.push(struct.groups[g].id);
                    ss.visitedGroupsInCircle = vg;
                    break;
                }
            }
        }
        const vcg = Array.isArray(ss.visitedInCurGroup) ? ss.visitedInCurGroup : [];
        if (!vcg.includes(base)) vcg.push(base);
        ss.visitedInCurGroup = vcg;
        const vc = Array.isArray(ss.visitedInCircle) ? ss.visitedInCircle : [];
        if (!vc.includes(base)) vc.push(base);
        ss.visitedInCircle = vc;
        if (opts.pushHistory !== false) grokHistoryPushInto(ss, item.url);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        mossadDebug('pos', 'позиция синхронизирована', { source: opts.source, g: ss.curGrpIdx, i: ss.curItemIdx, hist: (ss.history || []).length });
    }

    function grokGetNextSlideItem(direction = 'auto', overrideUrl = null) {
        const struct = grokGetPlaylistStructure();
        if (!struct || !struct.items.length) return null;

        // v1.3.38: «текущий» элемент — тот, что явно выбран скриптом (ss.targetUrl), а не URL страницы:
        // URL отстаёт при переключении киноплёнки и может принадлежать предыдущему посту во время перехода.
        if (!overrideUrl) {
            const ssPos = grokReadSS();
            if (ssPos.active && ssPos.targetUrl &&
                struct.items.some(it => normUrlKey(it.url) === normUrlKey(ssPos.targetUrl))) {
                overrideUrl = ssPos.targetUrl;
            }
        }
        const curPos = grokFindCurrentPosition(struct, overrideUrl);

        // ── 1. Зацикленный набор (R / loopSet) ──
        const loopSet = getGrokLoopSet(); // loop.js: всегда { urls: [], groupIds: [] }
        const loopUrls = loopSet.urls;
        const loopGroupIds = loopSet.groupIds;

        if (loopUrls.length > 0 || loopGroupIds.length > 0) {
            const loopItems = struct.items.filter(item => {
                const base = normUrlKey(item.url);
                const inUrls = loopUrls.some(u => normUrlKey(u) === base);
                const inGrps = loopGroupIds.includes(item.convId || '__noconv__');
                return inUrls || inGrps;
            });
            if (loopItems.length > 0) {
                const curLoopIdx = loopItems.findIndex(item => {
                    if (!curPos || !curPos.currentItem) return false;
                    return normUrlKey(item.url) === normUrlKey(curPos.currentItem.url);
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

        // ── 4а. «Назад» в случайных режимах — по истории показанных элементов (v1.3.38) ──
        if (direction === 'up' && grokIsRandomMode(struct)) {
            const ssH = grokReadSS();
            const hist = Array.isArray(ssH.history) ? ssH.history.slice() : [];
            const curKey = normUrlKey((curPos && curPos.currentItem && curPos.currentItem.url) || overrideUrl || location.href);
            while (hist.length && normUrlKey(hist[hist.length - 1]) === curKey) hist.pop();
            while (hist.length) {
                const prevKey = normUrlKey(hist[hist.length - 1]);
                const prevItem = struct.items.find(it => normUrlKey(it.url) === prevKey);
                if (prevItem) {
                    ssH.history = hist; // вершина истории = элемент, на который возвращаемся
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ssH));
                    mossadDebug('pos', 'назад по истории', { left: hist.length });
                    return { item: prevItem, circleCompleted: false, fromHistory: true };
                }
                hist.pop(); // элемента уже нет в коллекции
            }
            // История пуста — обычный шаг вверх по списку
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
                const curBase = normUrlKey(curPos.currentItem?.url);
                if (!visitedInCircle.includes(curBase)) visitedInCircle.push(curBase);
                const unvisited = struct.items.filter(it => !visitedInCircle.includes(normUrlKey(it.url)));
                if (unvisited.length === 0) {
                    ss.visitedInCircle = [];
                    _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                    const rndItem = struct.items[Math.floor(Math.random() * struct.items.length)];
                    return { item: rndItem, circleCompleted: true };
                }
                const rndItem = unvisited[Math.floor(Math.random() * unvisited.length)];
                visitedInCircle.push(normUrlKey(rndItem.url));
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
        // Читаем позицию из SS — она явно записывается на каждом шаге и не зависит от DOM
        let g, i;
        const hasSsPos = typeof ss.curGrpIdx === 'number' && ss.curGrpIdx >= 0 &&
                         typeof ss.curItemIdx === 'number' && ss.curItemIdx >= 0 &&
                         ss.curGrpIdx < struct.groups.length;
        if (hasSsPos) {
            g = ss.curGrpIdx;
            i = Math.min(ss.curItemIdx, struct.groups[g].items.length - 1);
        } else {
            // Fallback: определяем по URL (первый запуск или внешняя навигация)
            g = (curPos && curPos.grpIndex !== -1) ? curPos.grpIndex : 0;
            i = (curPos && curPos.itemInGrpIndex !== -1) ? curPos.itemInGrpIndex : 0;
        }
        let curGrp = struct.groups[g];

        const curItemForVisited = curGrp.items[i];
        const curBase = normUrlKey(curItemForVisited?.url);
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
            const unvisitedInGrp = curGrp.items.filter(it => !visitedInCurGroup.includes(normUrlKey(it.url)));
            if (unvisitedInGrp.length > 0) {
                nextItemInGrp = unvisitedInGrp[Math.floor(Math.random() * unvisitedInGrp.length)];
            } else {
                groupDone = true;
            }
        }

        if (!groupDone && nextItemInGrp) {
            const newItemIdx = curGrp.items.indexOf(nextItemInGrp);
            visitedInCurGroup.push(normUrlKey(nextItemInGrp.url));
            ss.visitedInCurGroup = visitedInCurGroup;
            ss.curGrpIdx = g;
            ss.curItemIdx = newItemIdx >= 0 ? newItemIdx : i + 1;
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

        ss.visitedInCurGroup = [normUrlKey(targetItem.url)];
        ss.curGrpIdx = nextG;
        ss.curItemIdx = targetGrp.items.indexOf(targetItem);
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        return { item: targetItem, circleCompleted };
    }

    /**
     * SPA-навигация на grok.com через Next.js router.push() — без перезагрузки страницы.
     * Подтверждено: window.next.router доступен на grok.com.
     * Fallback: клик по <a> или window.location.href (полный переход).
     */
