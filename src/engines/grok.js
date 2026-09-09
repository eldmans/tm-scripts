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
            if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
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
            if (b.offsetParent === null) return false;
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
            const ext2 = hasVid ? 'mp4' : 'jpg';
            const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (typeof extractRootFilename === 'function' ? extractRootFilename(duplicateRecord.filename) : (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim())) : '';
            const dblSuffix = duplicateRecord ? ` (${rootBase || 'original'}) DBL` : '';

            let grokFilename = `${shortId}-grok${dblSuffix}.${ext2}`;

            if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
                const now2 = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
                const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
                const vars = {
                    id:       currentPostId || '',
                    uuid:     currentPostId || '',
                    hash:     currentPostId || '',
                    postid:   currentPostId || '',
                    id8:      shortId,
                    hash8:    shortId,
                    uuid8:    shortId,
                    domain:   'grok',
                    title:    'Imagine - Grok',
                    username: 'grok',
                    user:     'grok',
                    author:   'grok',
                    date:     dateStr,
                    time:     timeStr,
                    ext:      ext2,
                    n:        String(Date.now()).slice(-6),
                    dbl:      dblSuffix,
                    oldname:  rootBase,
                    copy:     rootBase,
                    root:     rootBase
                };
                const tplStr = config.filenameTemplate.trim();
                const hasDblVar = /\{dbl\}/i.test(tplStr);
                grokFilename = tplStr.replace(/\{(\w+)(?:\[(\d+)\])?\}/gi, (_, name, lenStr) => {
                    const key = name.toLowerCase();
                    const val = key in vars ? vars[key] : '';
                    const len = lenStr ? parseInt(lenStr, 10) : 0;
                    return len > 0 ? val.slice(0, len) : val;
                }).replace(/[\\/:*?"<>|]/g, '_');

                if (!grokFilename.includes('.')) grokFilename += `.${ext2}`;
                if (duplicateRecord && !hasDblVar) {
                    const lastDot = grokFilename.lastIndexOf('.');
                    const base = lastDot !== -1 ? grokFilename.slice(0, lastDot) : grokFilename;
                    const extPart = lastDot !== -1 ? grokFilename.slice(lastDot) : `.${ext2}`;
                    grokFilename = `${base}${dblSuffix}${extPart}`;
                }
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
                if (b.offsetParent === null) return false;
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
    // GROK: Smart Delete (3-dots fallback, a.confirm, hold-post)
    // ============================================================
    function getGrokNeighborPostUrl() {
        // 1. Проверяем карточки постов в текущем DOM
        const cards = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        const currentIdMatch = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
        const currentId = currentIdMatch ? currentIdMatch[1] : null;

        if (cards.length > 0 && currentId) {
            const urls = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
            const seen = new Map();
            for (const u of urls) {
                const m = u.match(/\/imagine\/post\/([^/?#]+)/);
                if (m && !seen.has(m[1])) seen.set(m[1], u);
            }
            const unique = Array.from(seen.keys());
            const idx = unique.indexOf(currentId);
            const dir = (config.slideshowDirections && config.slideshowDirections.length) ? config.slideshowDirections[0] : 'up';

            let targetId = null;
            if (dir === 'down' || dir === 'right') {
                targetId = (idx >= 0 && idx < unique.length - 1) ? unique[idx + 1] : (unique.length > 0 ? unique[0] : null);
            } else {
                targetId = (idx > 0) ? unique[idx - 1] : (unique.length > 0 ? unique[unique.length - 1] : null);
            }
            if (targetId && seen.get(targetId)) return seen.get(targetId);
        }

        // 2. Проверяем ссылки из сохраненной коллекции галереи
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw && currentId) {
                const items = (JSON.parse(raw).items || []).map(i => i.url || i);
                const idx = items.findIndex(u => u.includes(currentId));
                if (idx !== -1) {
                    const nextIdx = (idx + 1) % items.length;
                    return items[nextIdx];
                }
            }
        } catch (e) {}

        return null;
    }

    let _grokDeleteInProgress = false;

    async function runSmartDelete() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        if (_grokDeleteInProgress) return;
        _grokDeleteInProgress = true;

        try {
            blurActiveInput();
            const initialUrl = location.href;
            let finalTargetUrl = null;

            // hold post: предварительный шаг в направлении DPad и возврат для надежной фиксации целевого URL
            if (config.deleteHoldpost) {
                const dirs = config.slideshowDirections;
                const dPadDir = (dirs && dirs.length) ? dirs[0] : 'up';
                const forwardKey = getArrowKey(dPadDir);
                const oppDir = dPadDir === 'up' ? 'down' : (dPadDir === 'down' ? 'up' : (dPadDir === 'left' ? 'right' : 'left'));
                const backKey = getArrowKey(oppDir);

                showToast('🔍 Фиксация позиции...');

                const sendKey = (k) => {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                    document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
                };

                // 1. Листаем вперед в сторону DPad
                sendKey(forwardKey);

                // Ждем смены URL на целевой пост
                const peekStart = Date.now();
                while (Date.now() - peekStart < 1500) {
                    await new Promise(r => setTimeout(r, 40));
                    if (location.href !== initialUrl && isGrokPostPage()) {
                        finalTargetUrl = location.href;
                        break;
                    }
                    if (Date.now() - peekStart > 350 && location.href === initialUrl && !finalTargetUrl) {
                        sendKey(forwardKey);
                    }
                }

                // 2. Листаем обратно на исходный пост
                if (finalTargetUrl) {
                    console.log(`[MOSSAD] hold post: найден целевой финишный пост: ${finalTargetUrl}`);
                    sendKey(backKey);

                    const backStart = Date.now();
                    while (Date.now() - backStart < 1500) {
                        await new Promise(r => setTimeout(r, 40));
                        if (location.href === initialUrl) break;
                        if (Date.now() - backStart > 350 && location.href !== initialUrl) {
                            sendKey(backKey);
                        }
                    }
                    await new Promise(r => setTimeout(r, 250)); // пауза для готовности DOM исходного поста
                } else {
                    // Фолбэк на анализ DOM / коллекцию, если шаг не изменил URL
                    finalTargetUrl = getGrokNeighborPostUrl();
                    console.warn('[MOSSAD] hold post: шаг вперед не изменил URL, fallback:', finalTargetUrl);
                }
            }

            // 3. Запуск удаления и подтверждения
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];

            const triggerConfirm = () => {
                if (!config.deleteAutoconfirm) return;
                retryAction((attempt) => {
                    const confirmKeywords = ['удалить изображение', 'удалить видео', 'удалить', 'delete', 'confirm', 'ok', 'yes', 'да'];
                    const dialog = document.querySelector('[role="dialog"]') || document;
                    const confirmBtn = findGrokButton(confirmKeywords, dialog);
                    if (confirmBtn) {
                        triggerClick(confirmBtn, 'Confirm Delete');
                        console.log('[MOSSAD] Delete confirmed on attempt', attempt);
                        return true;
                    }
                    return false;
                }, [100, 250, 450, 750]);
            };

            const directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;

            if (directDelBtn) {
                triggerClick(directDelBtn, 'Delete Button');
                showToast('✕ Удаление...');
                triggerConfirm();
                deleteClicked = true;
            } else {
                const dotsBtn = findGrok3DotsMenuButton();
                if (dotsBtn) {
                    triggerClick(dotsBtn, 'Post actions (for Delete)');
                    deleteClicked = await new Promise((resolve) => {
                        retryAction((attempt) => {
                            const innerDel = findGrokButton(deleteBtnLabels);
                            if (innerDel) {
                                triggerClick(innerDel, 'Delete Button (from menu)');
                                showToast('✕ Удаление...');
                                triggerConfirm();
                                resolve(true);
                                return true;
                            }
                            if (attempt === 3) resolve(false);
                            return false;
                        }, [100, 250, 450]);
                    });
                }
            }

            if (!deleteClicked) {
                showToast('⚠️ Кнопка удаления не найдена', true);
                _grokDeleteInProgress = false;
                return;
            }

            // 4. Если включен hold post и зафиксирован finalTargetUrl:
            // ждем, пока сменится URL (пост удалился и Grok перекинул со страницы),
            // и в этот момент немедленно переходим на целевой сохранённый URL
            if (config.deleteHoldpost && finalTargetUrl) {
                const waitStart = Date.now();
                let urlRedirected = false;
                while (Date.now() - waitStart < 8000) {
                    await new Promise(r => setTimeout(r, 40));
                    if (location.href !== initialUrl) {
                        urlRedirected = true;
                        break;
                    }
                }

                console.log(`[MOSSAD] hold post: удаление завершено (смена URL: ${urlRedirected}). Переход на: ${finalTargetUrl}`);
                showToast('🎯 Переход к сохранённому посту...');
                window.location.href = finalTargetUrl;
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }

    // Граница: только на странице поста grok.com/imagine/post/... работают DL, Delete, слайдшоу и т.д.
    const isGrokPostPage  = () => rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    const isGrokSavedPage = () => rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);

    // ============================================================
    // GROK IMAGINE GALLERY — сбор ссылок + рандомное слайдшоу
    // ============================================================
    // sessionStorage: живёт только в текущей вкладке, умирает при закрытии, не смешивается между вкладками
    const GALLERY_COLLECTION_KEY = 'mossad_grok_imagine_collection';
    const GALLERY_SS_KEY         = 'mossad_grok_imagine_ss';
    const _gSS = sessionStorage; // короткий псевдоним

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

    /** Собирает все уникальные ссылки /imagine/post/... из DOM + определяет тип по span с таймером + convId */
    function grokCollectLinks() {
        const seen = new Set();
        const items = [];
        document.querySelectorAll('a[href*="/imagine/post/"]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (!href) return;
            const url = href.startsWith('http') ? href : 'https://grok.com' + href;
            // Нормализуем URL (убираем query-string для дедупликации по базовому URL поста)
            const baseUrl = url.split('?')[0];
            if (seen.has(baseUrl)) return;
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
        });
        return items;
    }

    /** Fisher-Yates перемешивание */
    function fisherYatesShuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** Звуковой сигнал окончания круга (до-ми-соль) */
    function playCircleDoneSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [523, 659, 784].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g   = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                const t0 = ctx.currentTime + i * 0.18;
                g.gain.setValueAtTime(0.25, t0);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
                osc.start(t0); osc.stop(t0 + 0.35);
            });
        } catch(e) { /* AudioContext может быть заблокирован */ }
    }

    /** Кнопка 1: сохранить коллекцию в sessionStorage — МЕРЖИТ с уже собранными */
    function grokSaveCollection(btnEl) {
        const newItems = grokCollectLinks();
        if (newItems.length === 0) {
            showToast('⚠️ Ссылки не найдены. Проскролльте страницу до конца!', true);
            return;
        }
        // Загружаем существующую коллекцию
        let existingItems = [];
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw) existingItems = JSON.parse(raw).items || [];
        } catch(e) {}
        // Мерж: ключ — базовый URL без query string
        const seenBase = new Set(existingItems.map(i => (i.url || '').split('?')[0]));
        let addedCount = 0;
        for (const item of newItems) {
            const base = (item.url || '').split('?')[0];
            if (!seenBase.has(base)) {
                existingItems.push(item);
                seenBase.add(base);
                addedCount++;
            }
        }
        const date   = new Date().toISOString().slice(0, 10);
        const videos = existingItems.filter(i => i.type === 'video').length;
        const photos = existingItems.length - videos;
        _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify({ date, items: existingItems }));
        if (btnEl) {
            btnEl.textContent = `📋 Список (${existingItems.length})`;
            btnEl.style.background = '#065f46';
            btnEl.style.color = '#e5e7eb';
            btnEl.dataset.collectedCount = String(existingItems.length);
        }
        const addMsg = addedCount > 0 ? ` (+${addedCount} новых)` : ' (нет новых)';
        showToast(`✅ Итого: ${existingItems.length}${addMsg} → 📹${videos} видео, 🖼${photos} фото`);
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
    function grokSpaNavigate(url) {
        if (!url) return;
        try {
            const urlObj = new URL(url, location.origin);
            const path = urlObj.pathname + urlObj.search;

            let navigated = false;

            // 1. Next.js router.push — основной метод (SPA без перезагрузки)
            if (window.next && window.next.router && typeof window.next.router.push === 'function') {
                window.next.router.push(path);
                navigated = true;
            } else {
                // 2. Клик по ссылке в DOM (если есть)
                const anchor = document.querySelector(`a[href="${path}"]`)
                            || document.querySelector(`a[href="${url}"]`);
                if (anchor) {
                    anchor.click();
                    navigated = true;
                }
            }

            if (navigated) {
                // Ждём смены URL и перезапускаем/обновляем тик слайдшоу
                let checks = 0;
                const checkInterval = setInterval(() => {
                    checks++;
                    if (location.pathname === urlObj.pathname || checks >= 15) {
                        clearInterval(checkInterval);
                        if (typeof grokGallerySlideshowTick === 'function') {
                            grokGallerySlideshowTick();
                        }
                    }
                }, 40);
                return;
            }
        } catch (e) {
            console.error('[MOSSAD] grokSpaNavigate error:', e);
        }
        // 3. Fallback: полный переход
        window.location.href = url;
    }

    /** Кнопка 2: запустить слайдшоу по коллекции (с учётом текущего режима) */
    function grokStartGallerySlideshow() {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) {
            showToast('⚠️ Сначала соберите коллекцию (кнопка 📋)', true);
            return;
        }
        let data;
        try { data = JSON.parse(raw); } catch { showToast('⚠️ Ошибка чтения коллекции', true); return; }
        const allItems = data.items || [];
        if (allItems.length === 0) { showToast('⚠️ Коллекция пуста', true); return; }

        // Читаем настройки режима из данных коллекции или дефолт (новые поля grpMode/itemMode)
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };

        const queue = grokBuildGalleryQueue(allItems, ssState);
        const ss = {
            active: true,
            queue,
            circle: 1,
            total: allItems.length,
            grpMode:  ssState.grpMode,
            itemMode: ssState.itemMode,
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeLabel = `Gr${grIcon[ssState.grpMode]||'↓'} Md${grIcon[ssState.itemMode]||'↓'}`;
        showToast(`▶ Слайдшоу [${modeLabel}]: ${allItems.length} генераций`);
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { grokSpaNavigate(next.url); }, 300);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const allItems = data.items || [];
        const ssState = {
            grpMode:  data.grpMode  || 'seq',
            itemMode: data.itemMode || 'fwd',
        };
        let queue = grokBuildGalleryQueue(allItems, ssState);
        // Переставляем startItem в начало очереди
        const startBase = (startItem.url || '').split('?')[0];
        const idx = queue.findIndex(i => (i.url || '').split('?')[0] === startBase);
        if (idx > 0) queue = [...queue.slice(idx), ...queue.slice(0, idx)];
        const ss = { active: true, queue: queue.slice(1), circle: 1, total: allItems.length,
            grpMode: ssState.grpMode, itemMode: ssState.itemMode };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        showToast(`▶ Слайдшоу с выбранного элемента`);
        setTimeout(() => { grokSpaNavigate(startItem.url); }, 300);
    }

    /** Останавливает Gallery Slideshow */
    function grokStopGallerySlideshow() {
        _gSS.removeItem(GALLERY_SS_KEY);
        window._mossadGalleryActive = false;
        window._mossadGalleryNextFn = null;
        window._mossadGalleryPaused = false;
        const ind = document.getElementById('mossad-gallery-indicator');
        if (ind) ind.remove();
        updateGalleryStatusBtn('idle');
        showToast('⏹ Gallery слайдшоу остановлено');
    }

    /** Обновляет текст/цвет кнопки статуса слайдшоу */
    function updateGalleryStatusBtn(state) {
        // state: 'idle' | 'playing' | 'paused'
        const btn = document.getElementById('mossad-gallery-status');
        if (!btn) return;
        if (state === 'playing') {
            btn.textContent = '▶ Идёт';
            btn.style.background = '#064e3b';
            btn.style.color = '#34d399';
        } else if (state === 'paused') {
            btn.textContent = '⏸ Пауза';
            btn.style.background = '#451a03';
            btn.style.color = '#fbbf24';
        } else {
            btn.textContent = '🎲 Слайдшоу';
            btn.style.background = '#1e3a5f';
            btn.style.color = '#93c5fd';
        }
    }

    /** Переключить паузу галерейного слайдшоу */
    function toggleGalleryPause() {
        if (!window._mossadGalleryActive) return;
        window._mossadGalleryPaused = !window._mossadGalleryPaused;
        if (window._mossadGalleryPaused) {
            slideshowPaused = true;
            updateGalleryStatusBtn('paused');
            showToast('⏸ Пауза');
        } else {
            slideshowPaused = false;
            updateGalleryStatusBtn('playing');
            showToast('▶ Продолжаем');
            // Если был фото-таймер, перезапускаем
            if (typeof scheduleNextSlideCycle === 'function') scheduleNextSlideCycle(0);
        }
    }

    /** Инициализация строки галереи внутри виджета MOSSAD (для всех страниц grok.com) */
    function initGrokGalleryBar() {
        if (rootDomain !== 'grok.com') return;
        if (document.getElementById('mossad-gallery-row')) return;

        const container = document.getElementById('mossad-widget-container');
        if (!container) return;

        const row = document.createElement('div');
        row.id = 'mossad-gallery-row';
        row.style.cssText = `
            background: rgba(20,20,20,0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 6px 10px;
            display: flex; align-items: center; gap: 6px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab; flex-wrap: wrap;
        `;

        // ── Утилита создания маленьких кнопок ──
        const mkBtn = (id, text, title, css) => {
            const b = document.createElement('button');
            b.id = id; b.textContent = text; b.title = title;
            b.style.cssText = `cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 8px;font-weight:700;font-size:11px;transition:all 0.2s;${css}`;
            return b;
        };

        // ── 1. Кнопка «Собрать» ──
        const btnCollect = document.createElement('button');
        btnCollect.id = 'mossad-gallery-collect';
        let savedCount = 0;
        try {
            const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (cRaw) savedCount = (JSON.parse(cRaw).items || []).length;
        } catch(e) {}
        btnCollect.textContent = savedCount > 0 ? `📋 Список (${savedCount})` : '📋 Собрать';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;

        // Клик: на /saved — собирать; иначе — открывать плейлист (если есть коллекция)
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else if (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0) {
                grokTogglePlaylistPanel();
            } else {
                showToast('ℹ️ Переход на /imagine/saved для сбора...');
                setTimeout(() => { window.location.href = 'https://grok.com/imagine/saved'; }, 300);
            }
        };

        if (isGrokSavedPage()) {
            // Мониторим изменение числа ссылок на странице каждые 2с
            setInterval(() => {
                const currentCount = document.querySelectorAll('a[href*="/imagine/post/"]').length;
                const sc = parseInt(btnCollect.dataset.collectedCount || String(savedCount), 10);
                if (sc === 0) return;
                if (currentCount !== sc) {
                    const diff = currentCount - sc;
                    const sign = diff > 0 ? '+' : '';
                    btnCollect.textContent = `📋 Список (${sc}) 🔴${sign}${diff}`;
                    btnCollect.style.color = '#fca5a5';
                }
            }, 2000);
        }

        // ── 2. Кнопка-статус воспроизведения (Идёт / Пауза / Слайдшоу) ──
        const _ssActive = (() => {
            if (isGrokSavedPage()) return false;
            try {
                const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                return !!item.active && (slideshowActive || sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true');
            } catch { return false; }
        })();

        const btnStatus = document.createElement('button');
        btnStatus.id = 'mossad-gallery-status';
        btnStatus.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-weight:700;font-size:12px;transition:all 0.2s;`;
        if (_ssActive) {
            btnStatus.textContent = '▶ Идёт'; btnStatus.style.background = '#064e3b'; btnStatus.style.color = '#34d399';
        } else {
            btnStatus.textContent = '🎲 Слайдшоу'; btnStatus.style.background = '#1e3a5f'; btnStatus.style.color = '#93c5fd';
        }
        btnStatus.onclick = () => {
            const active = window._mossadGalleryActive || (() => {
                try { return !!(JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active); } catch { return false; }
            })();
            if (active) {
                // Активно → переключаем паузу
                toggleGalleryPause();
            } else {
                // Не активно → запускаем
                grokStartGallerySlideshow();
            }
        };

        // ── 3. Кнопка [■] стоп ──
        const btnStop = mkBtn('mossad-gallery-stop', '■', 'Остановить слайдшоу', 'background:#1f2937;color:#f87171;');
        btnStop.onclick = () => {
            grokStopGallerySlideshow();
            stopSlideshow();
        };

        // ── 4. Режимы Gr / Md — 4 состояния: ↓ seq | ↑ rev | ↺ rnd | − off ──
        // По умолчанию: grpMode=seq (прямой порядок групп), itemMode=fwd (прямой порядок файлов)
        const GR_STATES  = ['seq', 'rev', 'rnd', 'off'];
        const GR_ICONS   = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const GR_TIPS    = {
            seq: 'Gr↓ — группы по порядку',
            rev: 'Gr↑ — группы в обратном порядке',
            rnd: 'Gr↺ — случайный порядок групп (без повторов за круг)',
            off: 'Gr− — без учёта групп (режим Md применяется ко всей коллекции)',
        };
        const MD_STATES  = ['fwd', 'rev', 'rnd', 'off'];
        const MD_ICONS   = { fwd: '↓', rev: '↑', rnd: '↺', off: '−' };
        const MD_TIPS    = {
            fwd: 'Md↓ — файлы в прямом порядке',
            rev: 'Md↑ — файлы в обратном порядке',
            rnd: 'Md↺ — случайный порядок файлов (без повторов за круг)',
            off: 'Md− — файлы в случайном порядке (оба − = полный хаос)',
        };

        // Читаем текущие настройки из коллекции
        let grpModeCfg = 'seq', itemModeCfg = 'fwd';
        try {
            const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (colRaw) {
                const colData = JSON.parse(colRaw);
                grpModeCfg  = colData.grpMode  || 'seq';
                itemModeCfg = colData.itemMode || 'fwd';
            }
        } catch(e) {}

        // Функция сохранения режима в коллекцию
        const saveModeToCollection = (key, val) => {
            try {
                const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                const data = raw ? JSON.parse(raw) : {};
                data[key] = val;
                _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(data));
            } catch(e) {}
        };

        // Helper: цвет кнопки по состоянию
        const grBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1a2e3a;color:#7dd3fc;';
        const mdBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1e1a3a;color:#c4b5fd;';
        const BASE_BTN = 'cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 8px;font-weight:700;font-size:11px;transition:all 0.2s;';

        // Кнопка Gr (порядок групп)
        const btnGr = mkBtn('mossad-gallery-grmode',
            `Gr${GR_ICONS[grpModeCfg]}`,
            GR_TIPS[grpModeCfg] || '',
            grBtnCss(grpModeCfg));
        btnGr.onclick = () => {
            const idx = GR_STATES.indexOf(grpModeCfg);
            grpModeCfg = GR_STATES[(idx + 1) % GR_STATES.length];
            saveModeToCollection('grpMode', grpModeCfg);
            btnGr.textContent = `Gr${GR_ICONS[grpModeCfg]}`;
            btnGr.title       = GR_TIPS[grpModeCfg];
            btnGr.style.cssText = BASE_BTN + grBtnCss(grpModeCfg);
        };

        // Кнопка Md (порядок внутри группы)
        const btnMd = mkBtn('mossad-gallery-mdmode',
            `Md${MD_ICONS[itemModeCfg]}`,
            MD_TIPS[itemModeCfg] || '',
            mdBtnCss(itemModeCfg));
        btnMd.onclick = () => {
            const idx = MD_STATES.indexOf(itemModeCfg);
            itemModeCfg = MD_STATES[(idx + 1) % MD_STATES.length];
            saveModeToCollection('itemMode', itemModeCfg);
            btnMd.textContent = `Md${MD_ICONS[itemModeCfg]}`;
            btnMd.title       = MD_TIPS[itemModeCfg];
            btnMd.style.cssText = BASE_BTN + mdBtnCss(itemModeCfg);
        };

        // ── 5. Кнопка скачать коллекцию .txt ──
        const btnDl = mkBtn('mossad-gallery-dl', '★', 'Скачать коллекцию .txt', 'background:#1f2937;color:#fbbf24;');
        btnDl.onclick = () => grokDownloadCollection();

        // ── 6. Стрелочка скрыть панель ──
        const btnToggleTop = document.createElement('button');
        btnToggleTop.id = 'mossad-gallery-toggle-top';
        btnToggleTop.innerHTML = '▼';
        btnToggleTop.title = 'Показать / скрыть панель управления';
        btnToggleTop.style.cssText = `background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:12px;padding:0 4px;transition:color 0.2s;`;
        btnToggleTop.onclick = () => {
            window.widgetState = window.widgetState === 'hidden' ? 'bar' : 'hidden';
            if (window.updateWidgetUI) window.updateWidgetUI();
        };

        row.append(btnCollect, btnStatus, btnStop, btnGr, btnMd, btnDl, btnToggleTop);
        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
        }
    }

    /** На странице поста — продолжение Gallery Slideshow через стандартный движок MOSSAD */
    function grokGallerySlideshowTick() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_SS_KEY);
        if (!raw) return;
        let ss;
        try { ss = JSON.parse(raw); } catch { return; }
        if (!ss.active) return;

        // Показываем компактный индикатор (или обновляем существующий)
        let indicator = document.getElementById('mossad-gallery-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'mossad-gallery-indicator';
            indicator.style.cssText = `
                position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
                z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
                border:1px solid rgba(255,255,255,0.1); border-radius:10px;
                padding:5px 14px; font-family:system-ui,sans-serif; font-size:11px;
                color:#9ca3af; display:flex; align-items:center; gap:8px;
                box-shadow:0 4px 20px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(indicator);
        }
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        const grIcon = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const modeTag = `Gr${grIcon[ss.grpMode]||'↓'} Md${grIcon[ss.itemMode]||'↓'}`;
        indicator.innerHTML = `<span id="mgi-status">▶ ${modeTag} · ${showed}/${ss.total} · Круг ${ss.circle}</span>`;

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn('playing');
        window._mossadGalleryPaused = false;

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            const statusEl = document.getElementById('mgi-status');
            if (statusEl) statusEl.textContent = '⏳ Переход...';
            window._mossadGalleryActive = false;
            window._mossadGalleryNextFn = null;

            let queue  = ss.queue  || [];
            let circle = ss.circle || 1;

            if (queue.length === 0) {
                playCircleDoneSound();
                circle++;
                const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                let allItems = [];
                if (colRaw) { try { allItems = JSON.parse(colRaw).items || []; } catch {} }
                // Новый круг — снова строим очередь с теми же настройками
                const ssState = {
                    grpMode:   ss.grpMode   || ss.ssMode    || 'seq',
                    itemMode:  ss.itemMode  || ss.itemOrder || 'fwd',
                };
                queue = grokBuildGalleryQueue(allItems, ssState);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            // ── Проверяем loop (R): зациклен ли один/несколько элементов ──
            const loopRaw = _gSS.getItem('mossad_grok_loop_set');
            if (loopRaw) {
                try {
                    const loopSet = JSON.parse(loopRaw);
                    const loopUrls = loopSet.urls || [];
                    const loopGroupIds = loopSet.groupIds || [];
                    if (loopUrls.length > 0 || loopGroupIds.length > 0) {
                        let loopItems = [];
                        const colRaw2 = _gSS.getItem(GALLERY_COLLECTION_KEY);
                        if (colRaw2) {
                            const allCol = JSON.parse(colRaw2).items || [];
                            for (const item of allCol) {
                                const baseUrl = (item.url || '').split('?')[0];
                                const inUrls = loopUrls.some(u => u.split('?')[0] === baseUrl);
                                const inGroups = loopGroupIds.includes(item.convId || '__noconv__');
                                if (inUrls || inGroups) loopItems.push(item);
                            }
                        }
                        if (loopItems.length > 0) {
                            const loopIdx = (ss.loopIdx || 0) % loopItems.length;
                            const loopNext = loopItems[loopIdx];
                            ss.loopIdx = loopIdx + 1;
                            ss.queue  = queue;
                            ss.circle = circle;
                            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
                            if (loopNext.type) sessionStorage.setItem('mossad_expected_type', loopNext.type);
                            grokSpaNavigate(loopNext.url);
                            return;
                        }
                    }
                } catch(e) {}
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            grokSpaNavigate(next.url || next);
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = false;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        setTimeout(() => scheduleNextSlideCycle(0), 300);
    }

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


    /** Клавиши ←→ по коллекции (только если текущий пост есть в списке) */
    function grokGalleryKeyboardNav() {
        if (!isGrokPostPage()) return;
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (items.length === 0) return;

        // UUID текущего поста
        const currentId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
        if (!currentId) return;
        if (!items.some(it => it.url.includes(currentId))) return; // не наш пост — не перехватываем

        document.addEventListener('keydown', function _gNav(e) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

            // Перепроверяем по актуальному URL
            const curId = location.pathname.match(/\/imagine\/post\/([^/?]+)/)?.[1];
            const curIdx = curId ? items.findIndex(it => it.url.includes(curId)) : -1;
            if (curIdx === -1) {
                document.removeEventListener('keydown', _gNav, true);
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const nextIdx = e.key === 'ArrowRight'
                ? (curIdx + 1) % items.length
                : (curIdx - 1 + items.length) % items.length;
            const next = items[nextIdx];
            if (next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            showToast(`←→ ${nextIdx + 1}/${items.length} • ${next.type === 'video' ? '📹' : '🖼'}`);
            grokSpaNavigate(next.url);
        }, true); // capture — раньше страницы
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => res.blob()).then(blob => saveBlobToDisk(blob, filename))
        .catch(err => {
            showToast('⚠️ Прямое скачивание недоступно, открыто в новой вкладке', true);
            window.open(url, '_blank');
        });
    }

    function saveBlobToDisk(blob, filename) {
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            computeSHA256(blob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: (typeof extractRootFilename === 'function') ? extractRootFilename(filename) : '',
                    url: location.href,
                    postUrl: location.href,
                    size: blob.size,
                    domain: rootDomain
                });
            });
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        showToast('✅ Сохранено!');
    }

    // Точная копия из 2.1.7-redgifs-drag
    function getActiveRedGifsItem() {
        return document.querySelector('.GifPreview_isActive')
            || document.querySelector('.GifPreview')
            || document.querySelector('[data-feed-item-id]');
    }

    function getRedGifsVideo() {
        const active = getActiveRedGifsItem();
        if (active) {
            const v = active.querySelector('video');
            if (v) return v;
        }
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;
        let bestVideo = null;
        let maxVisibleHeight = 0;
        const vh = window.innerHeight;
        for (const v of videos) {
            const rect = v.getBoundingClientRect();
            const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
            if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                bestVideo = v;
            }
        }
        return bestVideo || videos[0];
    }

    function getRedGifsTitleFilename(itemId) {
        let rawTitle = (document.title || '').trim();
        if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
            rawTitle = rawTitle.slice(1, -1).trim();
        }
        if (rawTitle) {
            const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
            if (safeTitle.length > 0) return `${safeTitle}.mp4`;
        }
        return `redgifs_${itemId}_${Date.now()}.mp4`;
    }

    function getPinterestMainPinData() {
        try {
            // 1. Прямой осмотр DOM тегов видео главного пина (closeup-video-main, duplo-hls-video)
            const mainVideo = document.querySelector('video[elementtiming*="video"], video[data-test-id="duplo-hls-video"], video[src*="v1.pinimg.com"], video.jI_JN7');
            if (mainVideo) {
                const src = mainVideo.src || (mainVideo.querySelector('source') && mainVideo.querySelector('source').src) || '';
                const sigMatch = src.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 src.match(/expMp4\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})/i);
                let bestMp4Url = null;
                if (sigMatch) {
                    const sig = sigMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                } else if (src.endsWith('.mp4')) {
                    bestMp4Url = src;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            // 2. Сканирование разметки DOM на предмет v1.pinimg.com/videos/iht/hls/ или elementtiming="closeup-video-main"
            const fullHtml = document.documentElement.innerHTML || '';
            const hlsMatch = fullHtml.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/iht\\?\/hls\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{2})\\?\/([a-f0-9]{32})\.m3u8/i) ||
                             fullHtml.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i);

            if (hlsMatch || fullHtml.includes('elementtiming="closeup-video-main') || fullHtml.includes('data-test-id="duplo-hls-video"')) {
                let bestMp4Url = null;
                if (hlsMatch) {
                    const sig = hlsMatch[4];
                    bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                }
                return { isFound: true, type: 'video', bestMp4Url };
            }

            const scanText = (txt) => {
                if (!txt || !txt.includes('auth_web_main_pin')) return null;
                const idx = txt.indexOf('resource_response');
                if (idx === -1) return null;
                
                // Берем с запасом 40000 символов, т.к. story_pin_data с видео-блоком лежит глубоко внизу JSON
                const slice = txt.slice(Math.max(0, idx - 500), idx + 40000);

                // 1. ПЕРВЫМ ДЕЛОМ ИЩЕМ СИГНАТУРЫ И БЛОКИ ВИДЕО
                const sigMatch = slice.match(/"video_signature"\s*:\s*"([a-f0-9]{32})"/i) ||
                                 slice.match(/hls\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\.m3u8/i) ||
                                 slice.match(/thumbnails\/originals\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{2})\/([a-f0-9]{32})\./i);

                const hasVideoKeywords = /story_pin_video_block/i.test(slice) || 
                                         /"video_list"\s*:\s*\{/i.test(slice) || 
                                         /"videos"\s*:\s*\{/i.test(slice) || 
                                         /duplo-hls/i.test(slice);

                if (sigMatch || hasVideoKeywords) {
                    let bestMp4Url = null;
                    const mp4Matches = slice.match(/https:\\?\/\\?\/v1\.pinimg\.com\\?\/videos\\?\/[^\s"',]+?\.mp4/g) ||
                                       slice.match(/https:\/\/v1\.pinimg\.com\/videos\/[^\s"',]+?\.mp4/g);
                    if (mp4Matches && mp4Matches.length > 0) {
                        bestMp4Url = mp4Matches[0].replace(/\\/g, '');
                    }
                    
                    if (!bestMp4Url && sigMatch) {
                        const sig = sigMatch[4] || sigMatch[1];
                        if (sig && sig.length === 32) {
                            bestMp4Url = `https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`;
                        }
                    }
                    return { isFound: true, type: 'video', bestMp4Url };
                }

                // 2. И ТОЛЬКО ЕСЛИ НИ ОДНОГО ПРИЗНАКА ВИДЕО НЕТ — ЭТО ФОТО
                if (/"images"\s*:\s*\{/i.test(slice) || /"image_signature"/i.test(slice)) {
                    return { isFound: true, type: 'image', bestMp4Url: null };
                }

                return null;
            };

            if (window.__PJS_OUTPUT__) {
                const res = scanText(JSON.stringify(window.__PJS_OUTPUT__));
                if (res) return res;
            }

            const scripts = document.querySelectorAll('script');
            for (const s of scripts) {
                const res = scanText(s.textContent || '');
                if (res) return res;
            }
        } catch (e) {
            console.error('[MOSSAD] PinResource JSON parse error:', e);
        }
        return { isFound: false, type: 'unknown', bestMp4Url: null };
    }
