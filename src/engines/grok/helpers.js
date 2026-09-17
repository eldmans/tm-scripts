// ============================================================
    // GROK HELPERS: Button Finders & Actions
    // ============================================================

    /**
     * Поиск кнопки/кликабельного элемента по ключевым словам (aria-label, title, textContent).
     * Регистронезависимый (case-insensitive) поиск, универсален для RU/EN.
     */
    function findGrokButton(keywords, rootEl = document) {
        if (!Array.isArray(keywords)) keywords = [keywords];
        const lowerKeywords = keywords.map(k => k.toLowerCase().trim());
        const candidates = Array.from(rootEl.querySelectorAll('button, [role="button"], [role="menuitem"], a'));
        return candidates.find(el => {
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) return false;
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('title') || '').toLowerCase();
            const txt = (el.textContent || '').trim().toLowerCase();
            return lowerKeywords.some(k => aria.includes(k) || title.includes(k) || txt.includes(k));
        }) || null;
    }

    /**
     * Находит кнопку «три точки» (меню действий с постом) в Grok.
     */
    function findGrok3DotsMenuButton() {
        // 1. Поиск по aria-label и тексту
        const byLabel = findGrokButton([
            'действия с постом', 'post actions', 'more options', 'more', 'ещё', 'три точки'
        ]);
        if (byLabel) return byLabel;

        // 2. Поиск по SVG иконке (кнопка с 3 точками / кругами)
        return Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
            if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes('post') || aria.includes('действи') || aria.includes('more')) return true;
            const svgs = b.querySelectorAll('svg');
            for (const svg of svgs) {
                if (svg.querySelectorAll('circle').length >= 3) return true;
                const path = svg.querySelector('path');
                const d = path ? (path.getAttribute('d') || '') : '';
                if (d.includes('M12') && d.includes('C12')) return true;
            }
            return false;
        }) || null;
    }

    // ============================================================
    // GROK: Sound Toggle (Mute / Unmute via Player DOM Button)
    // ============================================================
    function toggleGrokSound() {
        if (rootDomain !== 'grok.com') return;
        blurActiveInput();

        // Ищем кнопку звука в интерфейсе плеера Grok
        const soundWords = ['заглушить', 'включить звук', 'звук', 'sound', 'mute', 'unmute'];
        const btn = findGrokButton(soundWords);

        if (btn) {
            triggerClick(btn, 'Grok Sound Toggle');
            const isMuted = (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase().includes('включить') ||
                            (btn.getAttribute('aria-label') || btn.textContent || '').toLowerCase().includes('unmute');
            showToast(isMuted ? '🔊 Звук включен' : '🔇 Звук выключен');
            return;
        }

        // Фолбэк на HTML5 video, если кнопка в DOM не найдена
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            showToast(video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
        } else {
            showToast('⚠️ Видео не найдено', true);
        }
    }

    // ============================================================
    // GROK: PageUp Upscale (RU/EN, Case-insensitive, Submenu -> 720p)
    // ============================================================
    function runGrokUpscale() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        blurActiveInput();

        const upscaleKeywords = ['upscale', 'enhance', 'improve quality', 'повысить качество', 'улучшить качество', 'увеличить'];

        const triggerPhase2Submenu = () => {
            // Фаза 2: выбор «Увеличить до 720p» / «Upscale to 720p» / «720p»
            const target720pKeywords = ['увеличить до 720p', 'upscale to 720p', '720p'];
            retryAction((attempt) => {
                const subItem = findGrokButton(target720pKeywords);
                if (subItem) {
                    triggerClick(subItem, 'Upscale to 720p');
                    showToast('✅ Увеличение до 720p запущено');
                    return true; // прерывает попытки
                }
                if (attempt === 3) {
                    showToast('ℹ️ Меню 720p не появилось', true);
                }
                return false;
            }, [100, 300, 500]);
        };

        // Фаза 1: ищем основную кнопку Upscale
        const directBtn = findGrokButton(upscaleKeywords);
        if (directBtn) {
            triggerClick(directBtn, 'Upscale Phase 1');
            triggerPhase2Submenu();
            return;
        }

        // Если прямой кнопки нет — пробуем через 3 точки
        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Upscale)');
            retryAction((attempt) => {
                const menuBtn = findGrokButton(upscaleKeywords);
                if (menuBtn) {
                    triggerClick(menuBtn, 'Upscale Phase 1 from 3-dots');
                    triggerPhase2Submenu();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
        } else {
            showToast('⚠️ Кнопка Upscale не найдена', true);
        }
    }

    // ============================================================
    // GROK: Download with 3-Dots Fallback
    // ============================================================
    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null) {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return false;
        blurActiveInput();

        const currentPostUrl = location.href;
        const currentPostId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';
        let currentConvId = '';
        try {
            const u = new URL(currentPostUrl);
            currentConvId = u.searchParams.get('conversation') || u.searchParams.get('conv') || '';
        } catch(e) {}
        if (!currentConvId && currentPostId) {
            try {
                const raw = sessionStorage.getItem('grok_gallery_collection');
                if (raw) {
                    const data = JSON.parse(raw);
                    const found = (data.items || []).find(it => it.url && it.url.includes(currentPostId));
                    if (found && found.convId) currentConvId = found.convId;
                }
            } catch(e) {}
        }
        if (!currentConvId && currentPostId) {
            const a = document.querySelector(`a[href*="${currentPostId}"][href*="conversation="]`);
            if (a) {
                try {
                    const u = new URL(a.href, location.origin);
                    currentConvId = u.searchParams.get('conversation') || '';
                } catch(e) {}
            }
        }

        // Проверка дубликата в истории
        const hasVid = getActiveVideo() !== null;
        const currentMediaType = hasVid ? 'video' : 'photo';
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl)) {
            checkFileInHistory(null, null, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record));
                } else {
                    triggerGrokDownload(true, null);
                }
            });
            return true;
        }

        const dlKeywords = ['download', 'скачать'];

        const onDownloadTriggered = () => {
            const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
            const shortId4 = currentPostId ? currentPostId.slice(0, 4) : '';
            const shortConv4 = currentConvId ? currentConvId.slice(0, 4) : '';
            const ext2 = hasVid ? 'mp4' : 'jpg';
            const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(duplicateRecord.filename) : (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim())) : '';
            const dblSuffix = duplicateRecord ? ` (${rootBase || 'original'}) DBL` : '';

            // Дефолтное имя без включенного шаблона: {conv4}-{id4}-grok.mp4
            const defaultPrefix = shortConv4 ? `${shortConv4}-${shortId4 || shortId}` : (shortId || 'media');
            let grokFilename = `${defaultPrefix}-grok${dblSuffix}.${ext2}`;

            if (config.filenameTemplateEnabled) {
                const now2 = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
                const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
                const vars = {
                    id:           currentPostId || '',
                    conv:         currentConvId || '',
                    conversation: currentConvId || '',
                    uuid:         currentPostId || '',
                    hash:         currentPostId || '',
                    postid:       currentPostId || '',
                    id8:          shortId,
                    hash8:        shortId,
                    uuid8:        shortId,
                    domain:       'grok',
                    title:        'Imagine - Grok',
                    username:     'grok',
                    user:         'grok',
                    author:       'grok',
                    date:         dateStr,
                    time:         timeStr,
                    ext:          ext2,
                    n:            String(Date.now()).slice(-6),
                    dbl:          dblSuffix,
                    oldname:      rootBase,
                    copy:         rootBase,
                    root:         rootBase
                };
                grokFilename = typeof renderFilenameTemplate === 'function'
                    ? renderFilenameTemplate(config.filenameTemplate, vars, Boolean(duplicateRecord), dblSuffix, ext2)
                    : grokFilename;
            }

            showToast(`📥 Скачивание: ${grokFilename}...`);
            saveFileToHistory({
                hash: '',
                filename: grokFilename,
                rootFilename: rootBase || (typeof extractRootFilename === 'function' ? extractRootFilename(grokFilename) : grokFilename),
                url: currentPostUrl,
                postUrl: currentPostUrl,
                domain: 'grok.com',
                type: currentMediaType
            });
            if (typeof performPostDownloadAction === 'function') {
                performPostDownloadAction();
            }
        };

        // 1. Прямая кнопка на панели
        let directBtn = findGrokButton(dlKeywords);
        if (!directBtn) {
            // Поиск по SVG характерной иконки загрузки
            directBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                const path = b.querySelector('path');
                const d = path ? (path.getAttribute('d') || '') : '';
                return d.includes('17v2') || d.includes('v2a2') || (d.includes('M12') && d.includes('17')) || d.includes('20C');
            });
        }

        if (directBtn) {
            triggerClick(directBtn, 'Grok Direct Download');
            onDownloadTriggered();
            return true;
        }

        // 2. Если прямой кнопки нет — открываем три точки
        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Download)');
            retryAction((attempt) => {
                const innerDl = findGrokButton(dlKeywords);
                if (innerDl) {
                    triggerClick(innerDl, 'Grok Download from 3-dots');
                    onDownloadTriggered();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
            return true;
        }

        return false;
    }


    // ============================================================
    // GROK: Filmstrip (Киноплёнка) & Intra-group Navigation Helpers
    // ============================================================

    /**
     * Извлекает 36-значный UUID генерации из URL или пути к ассету.
     */
    function grokExtractUuid(urlOrStr) {
        if (!urlOrStr) return '';
        const m = urlOrStr.match(/(?:post|generated)\/([a-f0-9-]{36})/i);
        return m ? m[1].toLowerCase() : '';
    }

    /**
     * Возвращает массив кнопок кадров на полосе киноплёнки (filmstrip).
     */
    function grokGetFilmstripItems() {
        return Array.from(document.querySelectorAll('[data-filmstrip-item="true"], button[aria-label*="Thumbnail"], button[aria-label*="thumbnail"]'));
    }

    /**
     * Находит кнопку в киноплёнке по UUID генерации.
     * Возвращает элемент ТОЛЬКО если он реально присутствует на текущей киноплёнке.
     */
    function grokFindFilmstripItemByUuid(uuid) {
        if (!uuid) return null;
        const items = grokGetFilmstripItems();
        if (items.length === 0) return null;
        const cleanUuid = uuid.toLowerCase();
        return items.find(btn => {
            const img = btn.querySelector('img, video, source');
            if (img && img.src && img.src.toLowerCase().includes(cleanUuid)) return true;
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (aria.includes(cleanUuid)) return true;
            const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
            if (dataId && dataId.includes(cleanUuid)) return true;
            return false;
        }) || null;
    }

    /**
     * Находит индекс активного (выбранного) кадра на киноплёнке.
     */
    function grokGetActiveFilmstripIndex() {
        const items = grokGetFilmstripItems();
        if (items.length === 0) return -1;

        // 1. По классу выделения (ring-white, border-white, aria-selected="true") БЕЗ ложных Tailwind focus:*
        const activeByClass = items.findIndex(btn => {
            if (btn.getAttribute('aria-selected') === 'true') return true;
            const cls = btn.className || '';
            const tokens = cls.split(/\s+/);
            return tokens.some(t => /^(ring-white|border-white|ring-2|ring-4|active)$/i.test(t));
        });
        if (activeByClass !== -1) return activeByClass;

        // 2. По совпадению UUID ассета с текущим URL (fallback если класс ещё не применился)
        const curUuid = grokExtractUuid(location.pathname);
        if (curUuid) {
            const activeByMatch = items.findIndex(btn => {
                const imgSrc = btn.querySelector('img, video, source')?.src || '';
                const genMatch = imgSrc.match(/generated\/([a-f0-9-]+)\//)?.[1];
                if (genMatch && curUuid.includes(genMatch.toLowerCase())) return true;
                if (imgSrc.toLowerCase().includes(curUuid)) return true;
                const dataId = (btn.dataset.id || btn.dataset.uuid || '').toLowerCase();
                if (dataId && dataId.includes(curUuid)) return true;
                return false;
            });
            if (activeByMatch !== -1) return activeByMatch;
        }

        return -1;
    }

    /**
     * Шаг по киноплёнке (вперёд: down/right, назад: up/left).
     * Возвращает true, если клик выполнен, false — если край или нет киноплёнки.
     */
    function grokStepFilmstrip(isNext = true) {
        const items = grokGetFilmstripItems();
        if (items.length <= 1) return false;
        const curIdx = grokGetActiveFilmstripIndex();
        if (curIdx === -1) return false;
        const nextIdx = isNext ? (curIdx + 1) % items.length : (curIdx - 1 + items.length) % items.length;
        items[nextIdx].click();
        setTimeout(() => {
            if (typeof grokHighlightActivePlaylistItem === 'function') {
                grokHighlightActivePlaylistItem();
            }
        }, 120);
        return true;
    }
