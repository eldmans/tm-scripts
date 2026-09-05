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
            const oldBase = duplicateRecord ? (duplicateRecord.filename || '').replace(/\.[^/.]+$/, '').trim() : '';
            const dblSuffix = duplicateRecord ? ` (${oldBase || 'original'}) DBL` : '';

            let grokFilename = `${shortId}-grok${dblSuffix}.${ext2}`;

            if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
                const now2 = new Date();
                const pad2 = (n) => String(n).padStart(2, '0');
                const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
                const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
                const vars = {
                    id:      currentPostId || '',
                    uuid:    currentPostId || '',
                    hash:    currentPostId || '',
                    postid:  currentPostId || '',
                    id8:     shortId,
                    hash8:   shortId,
                    uuid8:   shortId,
                    domain:  'grok',
                    title:   'Imagine - Grok',
                    date:    dateStr,
                    time:    timeStr,
                    ext:     ext2,
                    n:       String(Date.now()).slice(-6),
                    dbl:     dblSuffix,
                    oldname: oldBase,
                    copy:    oldBase
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
            btnEl.textContent = `📋 Собрано (${existingItems.length})`;
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
        const ssMode   = ssState.ssMode   || 'rnd'; // 'rnd' | 'grp'
        const grpOrder = ssState.grpOrder || 'rnd'; // 'rnd' | 'seq'
        const itemOrder= ssState.itemOrder|| 'rev'; // 'fwd' | 'rev' | 'rnd'

        if (ssMode === 'rnd') {
            return fisherYatesShuffle(allItems);
        }

        // GRP: группируем по convId
        const groups = {};
        const groupOrder = [];
        for (const item of allItems) {
            const gid = item.convId || '__noconv__';
            if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
            groups[gid].push(item);
        }

        // Порядок групп
        const orderedGroups = grpOrder === 'rnd' ? fisherYatesShuffle(groupOrder) : groupOrder;

        // Строим итоговую очередь
        const queue = [];
        for (const gid of orderedGroups) {
            let items = groups[gid].slice();
            // itemOrder: fwd = порядок сбора (новые первые в DOM, т.е. старые в конце)
            // rev = обратный (старые первые = "снизу вверх" из DOM = хронологический)
            // rnd = случайно
            if (itemOrder === 'rev') items = items.reverse();
            else if (itemOrder === 'rnd') items = fisherYatesShuffle(items);
            // fwd = как собрали (оставляем как есть)
            queue.push(...items);
        }
        return queue;
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

        // Читаем настройки режима из данных коллекции или дефолт
        const ssState = {
            ssMode:    data.ssMode    || 'rnd',
            grpOrder:  data.grpOrder  || 'rnd',
            itemOrder: data.itemOrder || 'rev',
        };

        const queue = grokBuildGalleryQueue(allItems, ssState);
        const ss = {
            active: true,
            queue,
            circle: 1,
            total: allItems.length,
            ssMode:    ssState.ssMode,
            grpOrder:  ssState.grpOrder,
            itemOrder: ssState.itemOrder,
        };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));

        const modeLabel = ssState.ssMode === 'grp'
            ? `GRP·${ssState.grpOrder === 'rnd' ? 'GRn' : 'GSq'}·${ssState.itemOrder === 'rev' ? 'IRv' : ssState.itemOrder === 'rnd' ? 'IRn' : 'ISq'}`
            : 'RND';
        showToast(`▶ Слайдшоу [${modeLabel}]: ${allItems.length} генераций`);
        const next = queue.shift();
        ss.queue = queue;
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
        setTimeout(() => { window.location.href = next.url; }, 300);
    }

    /** Запускает GRP-слайдшоу с конкретной стартовой позиции (для плейлиста) */
    function grokStartGallerySlideshowFrom(startItem) {
        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const allItems = data.items || [];
        const ssState = {
            ssMode:    data.ssMode    || 'rnd',
            grpOrder:  data.grpOrder  || 'rnd',
            itemOrder: data.itemOrder || 'rev',
        };
        let queue = grokBuildGalleryQueue(allItems, ssState);
        // Переставляем startItem в начало очереди
        const startBase = (startItem.url || '').split('?')[0];
        const idx = queue.findIndex(i => (i.url || '').split('?')[0] === startBase);
        if (idx > 0) queue = [...queue.slice(idx), ...queue.slice(0, idx)];
        const ss = { active: true, queue: queue.slice(1), circle: 1, total: allItems.length,
            ssMode: ssState.ssMode, grpOrder: ssState.grpOrder, itemOrder: ssState.itemOrder };
        _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
        if (startItem.type) sessionStorage.setItem('mossad_expected_type', startItem.type);
        showToast(`▶ Слайдшоу с выбранного элемента`);
        setTimeout(() => { window.location.href = startItem.url; }, 300);
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
        btnCollect.textContent = savedCount > 0 ? `📋 Собрано (${savedCount})` : '📋 Собрать';
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
                    btnCollect.textContent = `📋 Собрано (${sc}) 🔴${sign}${diff}`;
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

        // ── 4. Режимы — тогл-кнопки ──
        // Читаем текущие настройки из коллекции
        let ssModeCfg = 'rnd', grpOrderCfg = 'rnd', itemOrderCfg = 'rev';
        try {
            const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (colRaw) {
                const colData = JSON.parse(colRaw);
                ssModeCfg    = colData.ssMode    || 'rnd';
                grpOrderCfg  = colData.grpOrder  || 'rnd';
                itemOrderCfg = colData.itemOrder  || 'rev';
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

        // Кнопка RND/GRP
        const btnSsMode = mkBtn('mossad-gallery-ssmode', ssModeCfg === 'rnd' ? 'RND' : 'GRP',
            'RND — случайный порядок из всей коллекции\nGRP — по группам (диалогам)',
            `background:${ssModeCfg === 'rnd' ? '#1e3a5f' : '#1a3327'};color:${ssModeCfg === 'rnd' ? '#93c5fd' : '#6ee7b7'};`);
        btnSsMode.onclick = () => {
            ssModeCfg = ssModeCfg === 'rnd' ? 'grp' : 'rnd';
            saveModeToCollection('ssMode', ssModeCfg);
            btnSsMode.textContent = ssModeCfg === 'rnd' ? 'RND' : 'GRP';
            btnSsMode.style.background = ssModeCfg === 'rnd' ? '#1e3a5f' : '#1a3327';
            btnSsMode.style.color      = ssModeCfg === 'rnd' ? '#93c5fd' : '#6ee7b7';
            // Показываем/прячем sub-опции
            const grpBtns = document.getElementById('mossad-grp-opts');
            if (grpBtns) grpBtns.style.display = ssModeCfg === 'grp' ? 'flex' : 'none';
        };

        // Sub-опции для GRP (видны только когда GRP активен)
        const grpOpts = document.createElement('span');
        grpOpts.id = 'mossad-grp-opts';
        grpOpts.style.cssText = `display:${ssModeCfg === 'grp' ? 'flex' : 'none'};gap:4px;align-items:center;`;

        // Порядок групп: GSq (seq) / GRn (rnd)
        const grpOrderLabels = { seq: 'GSq', rnd: 'GRn' };
        const grpOrderTips   = { seq: 'GSq — группы по порядку', rnd: 'GRn — случайная группа' };
        const btnGrpOrder = mkBtn('mossad-gallery-grporder',
            grpOrderLabels[grpOrderCfg] || 'GRn',
            grpOrderTips[grpOrderCfg]   || '',
            'background:#1a2e3a;color:#7dd3fc;');
        btnGrpOrder.onclick = () => {
            grpOrderCfg = grpOrderCfg === 'rnd' ? 'seq' : 'rnd';
            saveModeToCollection('grpOrder', grpOrderCfg);
            btnGrpOrder.textContent = grpOrderLabels[grpOrderCfg];
            btnGrpOrder.title       = grpOrderTips[grpOrderCfg];
        };

        // Порядок внутри группы: ISq / IRv / IRn
        const itemOrderSeq = ['fwd', 'rev', 'rnd'];
        const itemOrderLabels = { fwd: 'ISq', rev: 'IRv', rnd: 'IRn' };
        const itemOrderTips   = {
            fwd: 'ISq — в порядке сбора (новые первые)',
            rev: 'IRv — обратный порядок (старые первые / хронологический)',
            rnd: 'IRn — случайный порядок внутри группы',
        };
        const btnItemOrder = mkBtn('mossad-gallery-itemorder',
            itemOrderLabels[itemOrderCfg] || 'IRv',
            itemOrderTips[itemOrderCfg]   || '',
            'background:#1a2e3a;color:#c4b5fd;');
        btnItemOrder.onclick = () => {
            const idx = itemOrderSeq.indexOf(itemOrderCfg);
            itemOrderCfg = itemOrderSeq[(idx + 1) % 3];
            saveModeToCollection('itemOrder', itemOrderCfg);
            btnItemOrder.textContent = itemOrderLabels[itemOrderCfg];
            btnItemOrder.title       = itemOrderTips[itemOrderCfg];
        };

        grpOpts.append(btnGrpOrder, btnItemOrder);

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

        row.append(btnCollect, btnStatus, btnStop, btnSsMode, grpOpts, btnDl, btnToggleTop);
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

        // Показываем компактный индикатор
        const indicator = document.createElement('div');
        indicator.id = 'mossad-gallery-indicator';
        const qLeft  = (ss.queue || []).length;
        const showed = (ss.total || 0) - qLeft;
        const modeTag = ss.ssMode === 'grp' ? `GRP` : 'RND';
        indicator.style.cssText = `
            position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
            z-index:999999; background:rgba(15,15,15,0.88); backdrop-filter:blur(12px);
            border:1px solid rgba(255,255,255,0.1); border-radius:10px;
            padding:5px 14px; font-family:system-ui,sans-serif; font-size:11px;
            color:#9ca3af; display:flex; align-items:center; gap:8px;
            box-shadow:0 4px 20px rgba(0,0,0,0.5);
        `;
        indicator.innerHTML = `<span id="mgi-status">▶ ${modeTag} · ${showed}/${ss.total} · Круг ${ss.circle}</span>`;
        document.body.appendChild(indicator);

        // Обновляем статус-кнопку в галерейной строке
        updateGalleryStatusBtn('playing');
        window._mossadGalleryPaused = false;

        // Устанавливаем функцию перехода: её вызовет triggerNextSlide
        window._mossadGalleryActive = true;
        window._mossadGalleryNextFn = () => {
            indicator.remove();
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
                const ssState = { ssMode: ss.ssMode || 'rnd', grpOrder: ss.grpOrder || 'rnd', itemOrder: ss.itemOrder || 'rev' };
                queue = grokBuildGalleryQueue(allItems, ssState);
                showToast(`🔄 Круг ${circle} начался! (${queue.length} генераций)`);
            }

            const next = queue.shift();
            ss.queue  = queue;
            ss.circle = circle;
            _gSS.setItem(GALLERY_SS_KEY, JSON.stringify(ss));
            if (next && next.type) sessionStorage.setItem('mossad_expected_type', next.type);
            window.location.href = next.url || next;
        };

        // Запускаем стандартный движок — он сам разберётся фото/видео/циклы/паузы
        slideshowActive = true;
        slideshowPaused = false;
        sessionStorage.setItem(SESSION_ACTIVE_KEY, 'true');
        window.widgetState = 'bar';
        if (window.updateWidgetUI) window.updateWidgetUI();
        setTimeout(() => scheduleNextSlideCycle(0), 300);
    }

    /** Плейлист-панель: открыть/закрыть */
    function grokTogglePlaylistPanel() {
        const existing = document.getElementById('mossad-playlist-panel');
        if (existing) { existing.remove(); return; }

        const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
        if (!raw) { showToast('⚠️ Коллекция не собрана', true); return; }
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const items = data.items || [];
        if (!items.length) { showToast('⚠️ Коллекция пуста', true); return; }

        const panel = document.createElement('div');
        panel.id = 'mossad-playlist-panel';
        panel.style.cssText = `
            position:fixed; top:70px; right:16px; z-index:9999999;
            width:300px; max-height:70vh; overflow-y:auto;
            background:rgba(12,12,16,0.96); backdrop-filter:blur(20px);
            border:1px solid rgba(255,255,255,0.12); border-radius:14px;
            font-family:system-ui,sans-serif; font-size:12px; color:#d1d5db;
            box-shadow:0 20px 60px rgba(0,0,0,0.7);
        `;

        const header = document.createElement('div');
        header.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.08);`;
        header.innerHTML = `<span style="font-weight:700;font-size:13px;">📋 Плейлист (${items.length})</span>`;
        const btnClose = document.createElement('button');
        btnClose.textContent = '×';
        btnClose.style.cssText = `background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;line-height:1;padding:0;`;
        btnClose.onclick = () => panel.remove();
        header.appendChild(btnClose);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `padding:8px;`;

        const ssMode = data.ssMode || 'rnd';

        if (ssMode === 'grp') {
            // Группируем по convId
            const groups = {};
            const groupOrder = [];
            for (const item of items) {
                const gid = item.convId || '__noconv__';
                if (!groups[gid]) { groups[gid] = []; groupOrder.push(gid); }
                groups[gid].push(item);
            }
            for (const gid of groupOrder) {
                const gItems = groups[gid];
                const grpEl = document.createElement('div');
                grpEl.style.cssText = `margin-bottom:8px;border:1px solid rgba(255,255,255,0.07);border-radius:8px;overflow:hidden;`;

                const grpHeader = document.createElement('div');
                const shortId = gid === '__noconv__' ? 'Без группы' : gid.slice(0, 8) + '…';
                grpHeader.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.04);cursor:pointer;`;
                grpHeader.innerHTML = `<span style="flex:1;font-weight:600;font-size:11px;color:#7dd3fc;">${shortId}</span><span style="color:#6b7280;font-size:10px;">${gItems.length} ген.</span>`;
                grpHeader.title = `Группа: ${gid}\nКликни чтобы начать SS с этой группы`;
                grpHeader.onclick = () => {
                    // Запускаем с первого элемента этой группы (с учётом itemOrder)
                    const itemOrderLocal = data.itemOrder || 'rev';
                    let startItem = gItems[0];
                    if (itemOrderLocal === 'rev') startItem = gItems[gItems.length - 1];
                    else if (itemOrderLocal === 'rnd') startItem = gItems[Math.floor(Math.random() * gItems.length)];
                    panel.remove();
                    grokStartGallerySlideshowFrom(startItem);
                };

                grpEl.appendChild(grpHeader);

                // Список постов внутри группы (компактный)
                const listEl = document.createElement('div');
                listEl.style.cssText = `padding:4px 8px;`;
                gItems.forEach((item, idx) => {
                    const li = document.createElement('div');
                    li.style.cssText = `padding:2px 4px;cursor:pointer;border-radius:4px;color:#9ca3af;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
                    li.textContent = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${item.url.split('/').pop().split('?')[0].slice(0, 24)}`;
                    li.title = item.url;
                    li.onmouseover = () => li.style.background = 'rgba(255,255,255,0.05)';
                    li.onmouseout  = () => li.style.background = 'transparent';
                    li.onclick = () => { panel.remove(); grokStartGallerySlideshowFrom(item); };
                    listEl.appendChild(li);
                });
                grpEl.appendChild(listEl);
                body.appendChild(grpEl);
            }
        } else {
            // RND: линейный список
            items.forEach((item, idx) => {
                const li = document.createElement('div');
                li.style.cssText = `padding:4px 8px;cursor:pointer;border-radius:6px;color:#9ca3af;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
                li.textContent = `${idx + 1}. ${item.type === 'video' ? '📹' : '🖼'} ${item.url.split('/').pop().split('?')[0].slice(0, 28)}`;
                li.title = item.url;
                li.onmouseover = () => li.style.background = 'rgba(255,255,255,0.06)';
                li.onmouseout  = () => li.style.background = 'transparent';
                li.onclick = () => { panel.remove(); grokStartGallerySlideshowFrom(item); };
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
            window.location.href = next.url;
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
