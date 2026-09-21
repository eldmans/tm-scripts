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
    // ============================================================
    // GROK: Prompt & Media Finders
    // ============================================================

    /**
     * Извлекает текст промпта для текущего поста Imagine.
     */
    function getGrokCurrentPrompt() {
        // 1. Поле ввода промпта (textarea или contenteditable)
        const ta = document.querySelector('textarea, div[contenteditable="true"]');
        if (ta) {
            const val = (ta.value !== undefined ? ta.value : (ta.innerText || ta.textContent || '')).trim();
            if (val) return val;
        }

        // 2. Alt-атрибут главного изображения поста
        const mainImg = document.querySelector('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img');
        if (mainImg) {
            const alt = (mainImg.getAttribute('alt') || '').trim();
            if (alt && alt.length > 2 && !/^(pfp|profile|avatar|logo|image)$/i.test(alt)) {
                return alt;
            }
        }

        // 3. Мета-теги OpenGraph / description
        const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
        if (metaDesc) {
            const content = (metaDesc.getAttribute('content') || '').trim();
            if (content && !content.toLowerCase().includes('grok is an ai') && !content.toLowerCase().includes('imagine anything')) {
                return content;
            }
        }

        // 4. Текстовые блоки с классом prose или атрибутами
        const promptBlock = document.querySelector('[data-testid*="prompt"], .prose');
        if (promptBlock && promptBlock.textContent.trim()) {
            return promptBlock.textContent.trim();
        }

        return '';
    }

    /**
     * Находит активный медиа-элемент на странице поста Grok (видео или изображение).
     */
    function getGrokMedia() {
        // 1. Видео
        const video = getActiveVideo() || document.querySelector('main video, div[role="dialog"] video, video');
        if (video) {
            let src = '';
            const sources = Array.from(video.querySelectorAll('source'));
            for (const s of sources) {
                if (s.src) { src = s.src; break; }
            }
            if (!src && video.currentSrc) src = video.currentSrc;
            if (!src && video.src) src = video.src;
            if (src) return { url: src, type: 'video', ext: 'mp4' };
        }

        // 2. Изображение
        const candidates = Array.from(document.querySelectorAll('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img, img'));
        const validImgs = candidates.filter(img => {
            if (!img.src) return false;
            const s = img.src.toLowerCase();
            if (s.includes('avatar') || s.includes('profile') || s.includes('pfp') || s.includes('icon')) return false;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            return (w >= 150 && h >= 150) || s.includes('share-images') || s.includes('imagine-public') || s.includes('assets.grok.com');
        }).sort((a, b) => {
            const areaA = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
            const areaB = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
            return areaB - areaA;
        });

        if (validImgs.length > 0) {
            const bestImg = validImgs[0];
            let ext = 'jpg';
            const srcLower = bestImg.src.toLowerCase();
            if (srcLower.includes('.png')) ext = 'png';
            else if (srcLower.includes('.webp')) ext = 'webp';
            return { url: bestImg.src, type: 'photo', ext };
        }

        return null;
    }

    /**
     * Извлекает текущую модель генерации Grok (или возвращает дефолтное 'Grok Imagine').
     */
    function getGrokCurrentModel() {
        const selectors = [
            'button[aria-haspopup="menu"] span',
            'button[data-testid*="model"]',
            '[aria-label*="model" i]',
            '[aria-label*="режим" i]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
                const txt = el.textContent.trim();
                if (/grok|flux|aurora|imagine/i.test(txt)) {
                    return txt;
                }
            }
        }
        return 'Grok Imagine';
    }

    /**
     * Вычисляет короткий хэш промпта (12 hex символов).
     */
    function computeGrokPromptHash(str) {
        if (!str) return '';
        let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, '0').slice(-12);
    }

    let _isGrokInternalClick = false;

    /**
     * Фолбэк на клик нативной кнопки Download при невозможности прямой загрузки.
     * Поиск строго по aria-label="download".
     */
    function fallbackGrokNativeClick(onSuccess) {
        _isGrokInternalClick = true;
        try {
            let directBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                return aria === 'download';
            });

            if (directBtn) {
                triggerClick(directBtn, 'Grok Direct Download (Fallback)');
                if (onSuccess) onSuccess();
                return;
            }

            const dotsBtn = findGrok3DotsMenuButton();
            if (dotsBtn) {
                triggerClick(dotsBtn, 'Post actions (for Fallback Download)');
                retryAction((attempt) => {
                    const innerDl = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                        const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                        return aria === 'download';
                    });
                    if (innerDl) {
                        triggerClick(innerDl, 'Grok Download from 3-dots (Fallback)');
                        if (onSuccess) onSuccess();
                        return true;
                    }
                    return false;
                }, [100, 300, 500]);
            }
        } finally {
            setTimeout(() => { _isGrokInternalClick = false; }, 1000);
        }
    }

    // ============================================================
    // GROK: Download with Metadata Injection & Fallback
    // ============================================================
    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null) {
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

        const media = getGrokMedia();
        const hasVid = media ? (media.type === 'video') : (getActiveVideo() !== null);
        const currentMediaType = hasVid ? 'video' : 'photo';

        // Проверка дубликата в истории
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl)) {
            checkFileInHistory(null, media ? media.url : null, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record, onDoneCallback));
                } else {
                    triggerGrokDownload(true, null, onDoneCallback);
                }
            });
            return true;
        }

        const prompt = getGrokCurrentPrompt();
        const model = getGrokCurrentModel();
        const promptHash = computeGrokPromptHash(prompt);
        const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
        const shortId4 = currentPostId ? currentPostId.slice(0, 4) : '';
        const shortConv4 = currentConvId ? currentConvId.slice(0, 4) : '';
        const ext2 = media ? media.ext : (hasVid ? 'mp4' : 'jpg');
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

        const onDownloadFinalized = () => {
            if (typeof performPostDownloadAction === 'function') {
                performPostDownloadAction();
            }
            if (onDoneCallback) onDoneCallback();
        };

        if (media && media.url) {
            showToast(`⏳ Загрузка: ${grokFilename}...`);
            const isBlobUrl = media.url.startsWith('blob:');

            const handleBlobResponse = async (rawBlob) => {
                try {
                    showToast('⏳ Запись метаданных...');
                    const enrichedBlob = await injectGrokMetadataToBlob(rawBlob, prompt, currentPostUrl, model, promptHash);
                    saveBlobToDisk(enrichedBlob, grokFilename);
                    onDownloadFinalized();
                } catch (err) {
                    console.error('[MOSSAD] Metadata injection failed, saving raw blob:', err);
                    saveBlobToDisk(rawBlob, grokFilename);
                    onDownloadFinalized();
                }
            };

            const finalizeFallback = () => {
                console.warn('[MOSSAD] Media fetch failed, using native Grok download button fallback');
                fallbackGrokNativeClick(onDownloadFinalized);
            };

            if (isBlobUrl) {
                fetch(media.url)
                    .then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.blob();
                    })
                    .then(handleBlobResponse)
                    .catch(finalizeFallback);
                return true;
            }

            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: media.url,
                    responseType: 'blob',
                    onprogress: (p) => {
                        if (p.total > 0) {
                            const pct = Math.round((p.loaded / p.total) * 100);
                            showToast(`⏳ Скачивание: ${pct}%`);
                        }
                    },
                    onload: (res) => {
                        if (res.status === 200 && res.response) {
                            handleBlobResponse(res.response);
                        } else {
                            finalizeFallback();
                        }
                    },
                    onerror: () => finalizeFallback()
                });
            } else {
                fetch(media.url)
                    .then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.blob();
                    })
                    .then(handleBlobResponse)
                    .catch(finalizeFallback);
            }
            return true;
        }

        // Если медиа-URL не найден — стандартный клик кнопки
        fallbackGrokNativeClick(onDownloadFinalized);
        return true;
    }

    // Перехват клика по нативной кнопке скачивания Grok на странице
    if (typeof document !== 'undefined') {
        document.addEventListener('click', function handleGrokNativeDownloadClick(e) {
            if (rootDomain !== 'grok.com' || _isGrokInternalClick) return;
            const btn = e.target.closest('button, [role="button"]');
            if (!btn || (btn.id && btn.id.startsWith('mossad-'))) return;

            const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
            const isDl = aria === 'download';

            if (isDl) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                console.log('[MOSSAD] Intercepted native Grok download button -> triggerGrokDownload with metadata');
                triggerGrokDownload();
            }
        }, true);
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

    function waitForCondition(checkFn, timeoutMs = 2500, intervalMs = 50) {
        return new Promise(resolve => {
            const start = Date.now();
            const timer = setInterval(() => {
                let res = null;
                try { res = checkFn(); } catch(e) {}
                if (res) {
                    clearInterval(timer);
                    return resolve(res);
                }
                if (Date.now() - start >= timeoutMs) {
                    clearInterval(timer);
                    return resolve(null);
                }
            }, intervalMs);
        });
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
