    // ============================================================
    // GROK ENGINE: Collection Management (Scraping, Saving, Export)
    // ============================================================

    /** Извлекает email из Next.js Flight данных на странице */
    function grokExtractEmail() {
        // Просто находим слово email, затем вытащиваем email-паттерн после него
        // Работает для "email":"val", \"email\":\"val\", любого варианта
        const re = /email[^a-zA-Z0-9]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
        for (const s of document.querySelectorAll('script')) {
            const m = s.textContent.match(re);
            if (m) return m[1];
        }
        try {
            const m = document.documentElement.innerHTML.match(re);
            if (m) return m[1];
        } catch(e) {}
        return 'unknown';
    }

    /** Собирает все уникальные ссылки /imagine/post/... из DOM в хронологическом порядке (снизу вверх страницы) */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        // Идём от конца к началу DOM: всё, что в самом низу, создавалось раньше (хронологический порядок)
        for (let i = anchors.length - 1; i >= 0; i--) {
            const a = anchors[i];
            const href = a.getAttribute('href') || '';
            if (!href) continue;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            // Нормализуем URL (убираем query-string для дедупликации по базовому URL поста)
            const baseUrl = url.split('?')[0];
            if (seen.has(baseUrl)) continue;
            seen.add(baseUrl);
            // Карточка — ближайший listitem / masonry-item родитель
            const card = a.closest('[role="listitem"], [data-masonry-key]') || a.parentElement;
            // Видео = есть span с классом tabular-nums (таймер 0:06)
            const hasTimer = !!(card && card.querySelector('span.tabular-nums'));
            // Conversation ID из ?conversation=UUID параметра
            let convId = null;
            try {
                const urlObj = new URL(url, 'https://grok.com');
                convId = urlObj.searchParams.get('conversation') || null;
            } catch(e) {}
            items.push({ url, type: hasTimer ? 'video' : 'photo', convId });
        }
        return items;
    }



    /** Кнопка 1: сохранить коллекцию в sessionStorage (хронологический порядок) */
    function grokSaveCollection(btnEl) {
        const newItems = grokCollectLinks();
        if (newItems.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
            return;
        }

        let existingData = {};
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw) existingData = JSON.parse(raw);
        } catch(e) {}

        const grpMode  = existingData.grpMode  || 'seq';
        const itemMode = existingData.itemMode || 'fwd';
        const date     = new Date().toISOString().slice(0, 10);
        const videos   = newItems.filter(i => i.type === 'video').length;
        const photos   = newItems.length - videos;

        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({
            date,
            items: newItems,
            grpMode,
            itemMode
        }));

        if (btnEl) {
            btnEl.textContent = String(newItems.length);
            btnEl.title = `Коллекция (${newItems.length}): открыть список`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(newItems.length);
            const dlBtn = document.getElementById('mossad-gallery-dl');
            if (dlBtn) dlBtn.style.display = 'inline-block';
        }

        // Если открыт список (плейлист) — обновляем его под новый порядок
        const playlistPanel = document.getElementById('mossad-playlist-panel');
        if (playlistPanel) {
            playlistPanel.remove();
            if (typeof grokTogglePlaylistPanel === 'function') {
                grokTogglePlaylistPanel(true);
            }
        }

        showToast(`✅ Собрано: ${newItems.length} (хронологически) → 📹${videos} видео, 🖼${photos} фото`);
    }

    /** Отдельная кнопка — скачать .txt с коллекцией (только тогда извлекает email) */
    function grokDownloadCollection() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Сначала нажмите «Собрать»', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения', true); return; }
        const items = data.items || [];
        const email = grokExtractEmail();
        const date  = data.date || new Date().toISOString().slice(0, 10);
        const filename = `${email}_${date}_${items.length}_links.txt`;
        const blob = new Blob([items.map(i => `${i.url}\t${i.type}`).join('\n')], { type: 'text/plain' });
        const bUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = bUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(bUrl); }, 2000);
        showToast(`📥 Скачано: ${filename}`);
    }

