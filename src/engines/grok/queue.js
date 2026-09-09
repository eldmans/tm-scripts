    // ============================================================
    // GROK ENGINE: Gallery Queue Builder & Shuffling
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



    /** Строит очередь с учётом режима ssMode / grpOrder / itemOrder */
    function grokBuildGalleryQueue(allItems, ssState) {
        // Поддерживаем как новые поля (grpMode/itemMode), так и старые (ssMode/grpOrder/itemOrder) для совместимости
        const grpMode  = ssState.grpMode  || (ssState.ssMode === 'grp' ? 'seq' : (ssState.ssMode === 'rnd' ? 'off' : 'seq'));
        const itemMode = ssState.itemMode || ssState.itemOrder || 'fwd';

        // Оба выключены → полный рандом по всей коллекции
        if (grpMode === 'off' && itemMode === 'off') {
            return fisherYatesShuffle(allItems);
        }

        // grpMode выключен → не группируем, применяем itemMode ко всему списку
        if (grpMode === 'off') {
            let flat = allItems.slice();
            if (itemMode === 'rev')      flat = flat.reverse();
            else if (itemMode === 'rnd') flat = fisherYatesShuffle(flat);
            return flat;
        }

        // GRP: группируем по convId
        const groups = {};
        const groupOrder = [];
        for (const item of allItems) {
            const gid = item.convId || '__noconv__';
            if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
            groups[gid].push(item);
        }

        // Порядок групп (grpMode: seq / rev / rnd)
        let orderedGroups = groupOrder.slice();
        if (grpMode === 'rev')      orderedGroups = orderedGroups.reverse();
        else if (grpMode === 'rnd') orderedGroups = fisherYatesShuffle(orderedGroups);
        // seq = как собрали (оставляем)

        // Строим итоговую очередь
        const queue = [];
        for (const gid of orderedGroups) {
            let items = groups[gid].slice();
            // itemMode: fwd / rev / rnd / off
            if (itemMode === 'rev')      items = items.reverse();
            else if (itemMode === 'rnd') items = fisherYatesShuffle(items);
            else if (itemMode === 'off') items = fisherYatesShuffle(items);
            // fwd = как собрали (оставляем как есть)
            queue.push(...items);
        }
        return queue;
    }

    /**
     * SPA-навигация на grok.com через Next.js router.push() — без перезагрузки страницы.
     * Подтверждено: window.next.router доступен на grok.com.
     * Fallback: клик по <a> или window.location.href (полный переход).
     */
