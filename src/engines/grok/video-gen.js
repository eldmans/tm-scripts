    // ============================================================
    // GROK: Video Generation Shortcuts (6s & 10s)
    // ============================================================
    let _isGeneratingGrokVideo = false;

    function findMakeVideoButton() {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        // 1. По aria-label или title
        const byLabel = buttons.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const title = (b.getAttribute('title') || '').toLowerCase();
            return aria === 'make video' || aria.includes('make video') || aria.includes('создать видео') ||
                   title === 'make video' || title.includes('make video');
        });
        if (byLabel) return byLabel;

        // 2. По SVG стрелке отправки (path: M6 11L12 5M12 5L18 11M12 5V19)
        const bySvg = buttons.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const path = b.querySelector('path');
            const d = path ? (path.getAttribute('d') || '') : '';
            return (d.includes('M6 11L12 5') || d.includes('5V19')) && (b.closest('div.relative.z-10') || (b.className && b.className.includes('rounded-full')));
        });
        return bySvg || null;
    }

    function findGrokVideoModeRadio() {
        const candidates = Array.from(document.querySelectorAll('button[role="radio"], [role="radio"]'));
        return candidates.find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const txt = (b.textContent || '').trim().toLowerCase();
            return aria === 'video' || aria.includes('video') || aria === 'видео' || txt === 'video' || txt === 'видео';
        }) || null;
    }

    function isGrokVideoModeActive() {
        const radio = findGrokVideoModeRadio();
        if (radio) {
            return radio.getAttribute('aria-checked') === 'true';
        }
        // Fallback: если Make video уже есть на экране
        const makeBtn = findMakeVideoButton();
        return Boolean(makeBtn);
    }

    function findVideoDurationButton() {
        const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
        return candidates.find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (aria === 'video duration' || aria.includes('video duration') || aria.includes('длительность')) return true;
            if (b.getAttribute('aria-haspopup') === 'menu' && (b.textContent.trim() === '6s' || b.textContent.trim() === '10s')) return true;
            return false;
        }) || null;
    }

    function findDurationMenuItem(targetSeconds) {
        const targetStr = `${targetSeconds}s`.toLowerCase();
        // 1. Поиск элементов меню Radix UI
        const candidates = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], [role="menu"] button, [role="menu"] [tabindex]'));
        for (const item of candidates) {
            if (item.offsetWidth === 0 && item.offsetHeight === 0 && (!item.getClientRects || !item.getClientRects().length)) continue;
            const spans = Array.from(item.querySelectorAll('span'));
            if (spans.some(s => s.textContent.trim().toLowerCase() === targetStr)) {
                return item;
            }
            if (item.textContent.trim().toLowerCase() === targetStr) {
                return item;
            }
        }
        // 2. Поиск любого открытого span с точным текстом "6s" или "10s"
        const allSpans = Array.from(document.querySelectorAll('[role="menu"] span, div[data-radix-popper-content-wrapper] span, span'));
        const matchedSpan = allSpans.find(s => {
            if (s.offsetWidth === 0 && s.offsetHeight === 0 && (!s.getClientRects || !s.getClientRects().length)) return false;
            return s.textContent.trim().toLowerCase() === targetStr;
        });
        if (matchedSpan) {
            return matchedSpan.closest('[role="menuitem"], [role="menuitemradio"], [data-radix-collection-item], button, [tabindex]') || matchedSpan;
        }
        return null;
    }

    async function triggerGrokVideoGeneration(targetSeconds = 6) {
        if (rootDomain !== 'grok.com') return;
        if (_isGeneratingGrokVideo) {
            showToast('⏳ Уже выполняется выбор режима видео...');
            return;
        }
        _isGeneratingGrokVideo = true;

        try {
            const targetStr = `${targetSeconds}s`.toLowerCase();

            // ── Шаг 1: Проверка режима «Видео» ──
            if (!isGrokVideoModeActive()) {
                const videoRadio = findGrokVideoModeRadio();
                if (videoRadio) {
                    showToast('🎥 Переключение в режим видео...');
                    triggerClick(videoRadio, 'Switch to Video Mode');
                    const switched = await waitForCondition(() => isGrokVideoModeActive(), 2500);
                    if (!switched) {
                        showToast('⚠️ Не удалось переключить в режим видео', true);
                        _isGeneratingGrokVideo = false;
                        return;
                    }
                } else {
                    console.log('[MOSSAD] Video mode radio not found, proceeding with Make video check');
                }
            }

            // Небольшая пауза для рендера контролов длительности
            await new Promise(r => setTimeout(r, 100));

            // ── Шаг 2: Проверка и выбор длительности (6s / 10s) ──
            const durBtn = await waitForCondition(() => findVideoDurationButton(), 2000);
            if (durBtn) {
                const curText = durBtn.textContent.trim().toLowerCase();
                if (!curText.includes(targetStr)) {
                    showToast(`⏱ Выбор длительности ${targetSeconds}с...`);
                    triggerClick(durBtn, 'Open Video Duration Menu');

                    const menuItem = await waitForCondition(() => findDurationMenuItem(targetSeconds), 2000);
                    if (menuItem) {
                        triggerClick(menuItem, `Select ${targetSeconds}s`);
                        // Ждем обновления текста на кнопке длительности
                        await waitForCondition(() => {
                            const updated = durBtn.textContent.trim().toLowerCase();
                            return updated.includes(targetStr);
                        }, 1500);
                    } else {
                        showToast(`⚠️ Пункт ${targetSeconds}с не найден в меню`, true);
                    }
                }
            }

            // Небольшая пауза перед кликом по финальной кнопке
            await new Promise(r => setTimeout(r, 120));

            // ── Шаг 3: Нажатие кнопки Make video ──
            const makeBtn = await waitForCondition(() => findMakeVideoButton(), 2500);
            if (!makeBtn) {
                showToast('⚠️ Кнопка «Make video» не найдена', true);
                _isGeneratingGrokVideo = false;
                return;
            }

            if (makeBtn.disabled || makeBtn.getAttribute('aria-disabled') === 'true') {
                showToast('⚠️ Кнопка «Make video» неактивна (введите промпт)', true);
                _isGeneratingGrokVideo = false;
                return;
            }

            triggerClick(makeBtn, `Make Video (${targetSeconds}s)`);
            showToast(`🎬 Генерация видео ${targetSeconds}с запущена!`);
        } catch (err) {
            console.error('[MOSSAD] Error in triggerGrokVideoGeneration:', err);
            showToast('❌ Ошибка генерации видео: ' + err.message, true);
        } finally {
            _isGeneratingGrokVideo = false;
        }
    }
    window.triggerGrokVideoGeneration = triggerGrokVideoGeneration;

    /**
     * Универсальная навигация в Saved Grok (/imagine/saved) из любого места grok.com.
     * Если уже на /imagine/saved — плавно скроллит в начало ленты.
     */
    function grokNavigateToSaved() {
        if (isGrokSavedPage()) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.documentElement) document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
            if (document.body) document.body.scrollTo({ top: 0, behavior: 'smooth' });
            const scrollables = document.querySelectorAll('main, [role="main"], [data-scroll-container], div[class*="overflow-y"]');
            scrollables.forEach(el => {
                if (el.scrollTop > 0) el.scrollTo({ top: 0, behavior: 'smooth' });
            });
            showToast('🔝 В начало Saved Grok');
            return;
        }

        showToast('📂 Переход в Saved Grok...');

        // 1. Попытка нативного SPA перехода через ссылку в DOM
        const savedLink = document.querySelector('a[href="/imagine/saved"], a[href*="/imagine/saved"]');
        if (savedLink) {
            try {
                savedLink.click();
                setTimeout(() => {
                    if (!isGrokSavedPage()) {
                        window.location.href = 'https://grok.com/imagine/saved';
                    }
                }, 250);
                return;
            } catch(e) {}
        }

        // 2. Прямой переход по URL
        window.location.href = 'https://grok.com/imagine/saved';
    }
    window.grokNavigateToSaved = grokNavigateToSaved;
