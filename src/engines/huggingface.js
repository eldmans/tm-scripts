    // ============================================
    // HUGGING FACE SPACES ENGINE (v1.3.70)
    // Поддержка Gradio / Streamlit спейсов:
    // - Поиск кнопки отправки/генерации (Generate / Submit / Run / Queue)
    // - Поиск готового медиа (выходные изображения/видео Gradio/Streamlit, кнопки a[download])
    // - Извлечение метаданных спейса (автор, название спейса, подтип/модель) для шаблона имён файлов
    // - Наблюдатель («ждун») автосохранения
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.huggingface = (() => {
        let _lastDownloadedSrc = null;
        let _downloadedContentHashes = new Set(); // v1.4.32: кеш хешей содержимого скачанных медиа
        let _downloadedSignatures = new Set();
        let _autoSaveTimer = null;
        let _isWaitingForGeneration = false;

        function getMediaContentHash(media) {
            if (!media) return null;
            const el = media.element;
            if (el && el.tagName === 'IMG' && (el.naturalWidth > 0 || el.offsetWidth > 0)) {
                try {
                    const canvas = document.createElement('canvas');
                    const w = Math.min(el.naturalWidth || el.offsetWidth || 64, 64);
                    const h = Math.min(el.naturalHeight || el.offsetHeight || 64, 64);
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(el, 0, 0, w, h);
                    const data = ctx.getImageData(0, 0, w, h).data;
                    let hash = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        hash = ((hash << 5) - hash + data[i] + (data[i+1] << 8) + (data[i+2] << 16)) | 0;
                    }
                    return 'img_' + (hash >>> 0).toString(16) + `_${el.naturalWidth || el.offsetWidth}x${el.naturalHeight || el.offsetHeight}`;
                } catch (_) {
                    // CORS tainted canvas fallback
                }
            }
            if (el && el.tagName === 'VIDEO') {
                const dur = Math.round((el.duration || 0) * 10) / 10;
                const vw = el.videoWidth || el.offsetWidth || 0;
                const vh = el.videoHeight || el.offsetHeight || 0;
                if (dur > 0 || vw > 0) {
                    return `vid_${vw}x${vh}_${dur}s`;
                }
            }
            const u = (media.urls && media.urls[0]) || '';
            const itemId = media.itemId || '';
            return 'media_' + itemId + '_' + u.slice(-30);
        }

        function getMediaSignature(media) {
            if (!media) return '';
            const u = (media.urls && media.urls[0]) || '';
            const el = media.element;
            const w = el ? (el.naturalWidth || el.videoWidth || el.offsetWidth || 0) : 0;
            const h = el ? (el.naturalHeight || el.videoHeight || el.offsetHeight || 0) : 0;
            return `${u}#${w}x${h}#${media.itemId || ''}`;
        }

        function markMediaDownloaded(media) {
            if (!media) return;
            const ch = getMediaContentHash(media);
            if (ch) _downloadedContentHashes.add(ch);
            if (media.element) {
                try {
                    media.element.dataset.mossadDownloaded = 'true';
                    if (ch) media.element.dataset.mossadHash = ch;
                } catch (_) {}
            }
            const sig = getMediaSignature(media);
            if (sig) _downloadedSignatures.add(sig);
            const src = (media.urls && media.urls[0]) || '';
            if (src) _lastDownloadedSrc = src;
        }

        function isMediaDownloaded(media) {
            if (!media) return true;
            const ch = getMediaContentHash(media);
            // Если на элементе уже сохранён совпавший хеш
            if (media.element && media.element.dataset && media.element.dataset.mossadHash && ch) {
                if (media.element.dataset.mossadHash === ch) return true;
            }
            // Проверка по кешу хешей содержимого
            if (ch && _downloadedContentHashes.has(ch)) return true;
            // Сигнатура (URL + размеры + ID)
            const sig = getMediaSignature(media);
            if (sig && _downloadedSignatures.has(sig)) return true;
            return false;
        }

        function isSupported() {
            return hostname.includes('huggingface.co') || hostname.includes('hf.space');
        }

        /**
         * Извлечение метаданных спейса (автор, название спейса, тип/подтип модели)
         */
        function getSpaceMetadata() {
            let author = '';
            let space = '';
            let subtype = '';

            // 1. Извлечение из URL huggingface.co/spaces/{author}/{space}
            if (hostname.includes('huggingface.co')) {
                const m = location.pathname.match(/\/spaces\/([^/]+)\/([^/?#]+)/i);
                if (m) {
                    author = m[1];
                    space = m[2];
                }
            } else if (hostname.includes('hf.space')) {
                // {author}-{space}.hf.space или {space}.hf.space
                const sub = hostname.replace('.hf.space', '');
                const parts = sub.split('-');
                if (parts.length >= 2) {
                    author = parts[0];
                    space = parts.slice(1).join('-');
                } else {
                    space = sub;
                }
            }

            // Fallback: title или h1
            if (!space) {
                const h1 = document.querySelector('h1, h2, title');
                if (h1) space = (h1.textContent || '').trim().toLowerCase();
            }

            const cleanStr = (s) => (s || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
            author = cleanStr(author);
            space = cleanStr(space);

            // Определение подтипа / семейства модели из названия спейса или контекста страницы
            const fullContext = `${author} ${space} ${document.title || ''} ${(document.querySelector('h1, h2, .gradio-container')?.textContent || '').slice(0, 500)}`.toLowerCase();
            
            const models = [
                'qwen2.5', 'qwen2', 'qwen', 'flux-schnell', 'flux-dev', 'flux', 'sdxl', 'sd-turbo', 'stable-diffusion',
                'wan2.1', 'wan', 'hunyuan', 'cogvideo', 'svd', 'animatediff', 'midjourney', 'omnigen', 'kolors', 'lumina',
                'mochi', 'ltx-video', 'aura-flow', 'pixart', 'playground'
            ];
            for (const m of models) {
                if (fullContext.includes(m)) {
                    subtype = m.replace(/[^a-z0-9._-]/g, '_');
                    break;
                }
            }
            if (!subtype) {
                const verMatch = fullContext.match(/\b(?:v)?(\d+\.\d+|\d{2}\.\d{2})\b/);
                if (verMatch) subtype = verMatch[1].replace('.', '_');
            }
            if (!subtype && space) {
                subtype = space.slice(0, 12);
            }

            return {
                author: author || 'hf',
                space: space || 'space',
                subtype: subtype || 'model'
            };
        }

        /**
         * Поиск кнопки генерации (Generate / Submit / Run) в Gradio / Streamlit
         */
        function findSubmitButton() {
            const docRoots = [document];
            try {
                document.querySelectorAll('iframe').forEach(f => {
                    try {
                        if (f.contentDocument && f.contentDocument.body) docRoots.push(f.contentDocument);
                    } catch (_) {}
                });
            } catch (_) {}

            for (const doc of docRoots) {
                const buttons = Array.from(doc.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]'));
                const byGradioId = buttons.find(b => {
                    if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                    const id = (b.id || '').toLowerCase();
                    const cls = (b.className || '').toLowerCase();
                    const variant = (b.getAttribute('variant') || '').toLowerCase();
                    return id === 'submit' || id === 'generate' || id === 'run' || 
                           variant === 'primary' || cls.includes('primary') || cls.includes('generate-btn');
                });
                if (byGradioId) return byGradioId;

                const submitKeywords = [
                    'generate', 'submit', 'run', 'queue', 'render', 'start', 'create',
                    'сгенерировать', 'запуск', 'создать', 'отправить', 'старт'
                ];
                const byText = buttons.find(b => {
                    if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                    const txt = (b.textContent || '').trim().toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const title = (b.getAttribute('title') || '').toLowerCase();
                    return submitKeywords.some(kw => txt === kw || aria === kw || title === kw || txt.startsWith(kw + ' '));
                });
                if (byText) return byText;

                const partial = buttons.find(b => {
                    if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                    const txt = (b.textContent || '').trim().toLowerCase();
                    return submitKeywords.some(kw => txt.includes(kw));
                });
                if (partial) return partial;
            }
            return null;
        }
        function _legacyFindSubmitButton_UNUSED() {
            const buttons = [];
            
            // 1. По стандартным Gradio ID / классам
            const byGradioId = buttons.find(b => {
                if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                const id = (b.id || '').toLowerCase();
                const cls = (b.className || '').toLowerCase();
                const variant = (b.getAttribute('variant') || '').toLowerCase();
                return id === 'submit' || id === 'generate' || id === 'run' || 
                       variant === 'primary' || cls.includes('primary') || cls.includes('generate-btn');
            });
            if (byGradioId) return byGradioId;

            // 2. По тексту на кнопке или aria-label
            const submitKeywords = [
                'generate', 'submit', 'run', 'queue', 'render', 'start', 'create',
                'сгенерировать', 'запуск', 'создать', 'отправить', 'старт'
            ];
            const byText = buttons.find(b => {
                if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                const txt = (b.textContent || '').trim().toLowerCase();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const title = (b.getAttribute('title') || '').toLowerCase();
                return submitKeywords.some(kw => txt === kw || aria === kw || title === kw || txt.startsWith(kw + ' '));
            });
            if (byText) return byText;

            // 3. Частичное совпадение
            return buttons.find(b => {
                if (b.offsetWidth === 0 && b.offsetHeight === 0 && (!b.getClientRects || !b.getClientRects().length)) return false;
                const txt = (b.textContent || '').trim().toLowerCase();
                return submitKeywords.some(kw => txt.includes(kw));
            }) || null;
        }

        function isSvgMedia(src) {
            if (!src || typeof src !== 'string') return true;
            const s = src.toLowerCase();
            return s.includes('.svg') || s.startsWith('data:image/svg') || s.includes('image/svg+xml');
        }

        function extractItemId(src) {
            if (!src) return String(Date.now()).slice(-8);
            const m = src.match(/\/([a-zA-Z0-9_-]{6,36})\.(?:png|jpe?g|webp|mp4|webm)/i);
            if (m && m[1]) return m[1].slice(0, 12);
            return String(Date.now()).slice(-8);
        }

        /**
         * Поиск готового результата для скачивания (img / video / download button)
         * Исключает любые SVG-логотипы (включая placeholder Gradio 576x576), иконки и инпуты.
         */
        function findMedia() {
            if (!isSupported()) return null;

            const docRoots = [document];
            try {
                document.querySelectorAll('iframe').forEach(f => {
                    try {
                        if (f.contentDocument && f.contentDocument.body) docRoots.push(f.contentDocument);
                    } catch (_) {}
                });
            } catch (_) {}

            for (const doc of docRoots) {
                // 1. Проверяем готовое видео в Gradio / Streamlit
                const videos = Array.from(doc.querySelectorAll('.gradio-video video, .output-video video, div[data-testid="video"] video, video'));
                const validVideo = videos.find(v => {
                    const src = v.src || (v.querySelector('source') && v.querySelector('source').src) || v.currentSrc;
                    return src && !src.startsWith('blob:http') && !src.includes('tampermonkey') && !isSvgMedia(src) && (v.videoWidth > 100 || v.offsetWidth > 150);
                });

                if (validVideo) {
                    const src = validVideo.src || (validVideo.querySelector('source') && validVideo.querySelector('source').src) || validVideo.currentSrc;
                    if (src) {
                        const meta = getSpaceMetadata();
                        return {
                            urls: [src],
                            element: validVideo,
                            type: 'video',
                            userName: meta.author,
                            spaceName: meta.space,
                            subtype: meta.subtype,
                            itemId: extractItemId(src),
                            postUrl: location.href
                        };
                    }
                }

                // 2. Ссылки скачивания a[download] (строго исключая .svg файлы и логотипы)
                const dlLinks = Array.from(doc.querySelectorAll('a[download], a.download-button, a[title*="Download" i]'));
                for (const a of dlLinks) {
                    const href = a.href || '';
                    const dlAttr = a.getAttribute('download') || '';
                    if (isSvgMedia(href) || isSvgMedia(dlAttr)) continue;
                    if (a.closest('.empty, .placeholder, .input-image, [data-testid="empty-image"]')) continue;
                    if (href && (href.startsWith('http') || href.startsWith('blob:'))) {
                        const isVid = /\.(mp4|webm)(\?|$)/i.test(href) || /\.(mp4|webm)$/i.test(dlAttr);
                        const meta = getSpaceMetadata();
                        return {
                            urls: [href],
                            element: a,
                            type: isVid ? 'video' : 'image',
                            userName: meta.author,
                            spaceName: meta.space,
                            subtype: meta.subtype,
                            itemId: extractItemId(href) || extractItemId(dlAttr),
                            postUrl: location.href
                        };
                    }
                }

                // 3. Выходные изображения Gradio / Streamlit (строго выходные контейнеры, исключая пустые SVG плейсхолдеры)
                const imgSelectors = [
                    '.output-image img',
                    'div[data-testid="image"]:not(.input-image) img',
                    '.image-preview img',
                    '.gallery img',
                    'div[data-testid="stImage"] img',
                    '.gradio-image:not(.input-image) img',
                    'div.image-container img'
                ];
                for (const sel of imgSelectors) {
                    const imgs = Array.from(doc.querySelectorAll(sel));
                    const goodImg = imgs.find(i => {
                        const src = i.currentSrc || i.src || '';
                        if (!src || isSvgMedia(src)) return false;
                        if (src.includes('avatar') || src.includes('icon') || src.includes('logo') || src.includes('badge')) return false;
                        if (i.closest('.empty, .placeholder, .input-image, [data-testid="empty-image"], [data-testid="upload"]')) return false;
                        if (i.naturalWidth > 0 && i.naturalWidth < 120) return false;
                        if (i.naturalWidth === 0 && (i.offsetWidth < 120 || i.offsetHeight < 120)) return false;
                        return true;
                    });
                    if (goodImg) {
                        const src = goodImg.currentSrc || goodImg.src;
                        if (src) {
                            const meta = getSpaceMetadata();
                            return {
                                urls: [src],
                                element: goodImg,
                                type: 'image',
                                userName: meta.author,
                                spaceName: meta.space,
                                subtype: meta.subtype,
                                itemId: extractItemId(src),
                                postUrl: location.href
                            };
                        }
                    }
                }

                // 4. Fallback: крупное растровое изображение (строго без SVG, логотипов и плейсхолдеров)
                const allImgs = Array.from(doc.querySelectorAll('img')).filter(i => {
                    if (i.naturalWidth < 200 && i.width < 200) return false;
                    const src = i.currentSrc || i.src || '';
                    if (!src || isSvgMedia(src)) return false;
                    if (src.includes('logo') || src.includes('avatar') || src.includes('badge') || src.includes('icon')) return false;
                    if (i.closest('.empty, .placeholder, .input-image, [data-testid="empty-image"], [data-testid="upload"]')) return false;
                    return true;
                });
                if (allImgs.length > 0) {
                    const targetImg = allImgs[allImgs.length - 1];
                    const src = targetImg.currentSrc || targetImg.src;
                    if (src && !isSvgMedia(src)) {
                        const meta = getSpaceMetadata();
                        return {
                            urls: [src],
                            element: targetImg,
                            type: 'image',
                            userName: meta.author,
                            spaceName: meta.space,
                            subtype: meta.subtype,
                            itemId: extractItemId(src),
                            postUrl: location.href
                        };
                    }
                }
            }

            return null;
        }

        /**
         * Запуск генерации по кнопке
         */
        function triggerGenerate() {
            if (!isSupported()) return false;
            const btn = findSubmitButton();
            if (btn) {
                if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
                    showToast('⚠️ Кнопка генерации Space неактивна', true);
                    return true;
                }
                triggerClick(btn, 'HuggingFace Space Generate');
                showToast('🚀 Генерация в Space запущена!');

                // Если включен режим автосохранения — запускаем "ждуна"
                if (isAutoSaveEnabled()) {
                    startWatcher();
                }
                return true;
            }
            return false;
        }

        /**
         * Проверка включен ли режим автосохранения
         */
        function isAutoSaveEnabled() {
            const mode = config.hfAutoSave || 'off';
            if (mode === 'always') return true;
            if (mode === 'page') return true;
            if (mode === 'space') {
                const meta = getSpaceMetadata();
                const key = `mossad_hf_autosave_${meta.space}`;
                return localStorage.getItem(key) === 'true';
            }
            return false;
        }

        /**
         * "Ждун" готового результата генерации
         */
        function startWatcher() {
            if (_isWaitingForGeneration) {
                console.log('[MOSSAD HF] Ждун уже активен, проверка продолжается...');
                return;
            }
            _isWaitingForGeneration = true;
            showToast('⏳ Ждун HF Авто-DL активен...');

            const startMedia = findMedia();
            const initialSrc = startMedia && startMedia.urls ? startMedia.urls[0] : null;
            let checkCount = 0;
            const maxChecks = 500; // до 5 минут

            if (_autoSaveTimer) clearInterval(_autoSaveTimer);

            _autoSaveTimer = setInterval(() => {
                checkCount++;
                // v1.4.32: точный селектор статуса (не ловить голый div[data-testid="status-tracker"], который всегда есть в DOM)
                const isGenerating = Boolean(document.querySelector('.generating, .loading, .progress-bar, div[data-testid="status-tracker"].generating, div[data-testid="status-tracker"] .progress-bar, div[data-testid="status-tracker"] .loading, [aria-busy="true"]'));

                const curMedia = findMedia();
                const curSrc = curMedia && curMedia.urls ? curMedia.urls[0] : null;

                // Если появилось новое изображение/видео, и генерация завершена
                if (curMedia && (!isMediaDownloaded(curMedia) || (curSrc && curSrc !== initialSrc)) && !isGenerating) {
                    clearInterval(_autoSaveTimer);
                    _autoSaveTimer = null;
                    _isWaitingForGeneration = false;
                    markMediaDownloaded(curMedia);
                    showToast('🎉 Генерация завершена! HF Авто-DL...');
                    triggerDownload(true, null, null, curMedia);
                    return;
                }

                if (checkCount >= maxChecks) {
                    clearInterval(_autoSaveTimer);
                    _autoSaveTimer = null;
                    _isWaitingForGeneration = false;
                    console.log('[MOSSAD HF] Тайм-аут ожидания генерации');
                }
            }, 600);
        }

        /**
         * v1.4.23 / v1.4.32: Защита от потери результатов генерации на Hugging Face Spaces
         * Предупреждает пользователя, если он запускает новую генерацию при нескачанном результате.
         * Полная поддержка хоткеев: Enter (скачать+пуск), Ctrl+Enter (пуск без скачивания), Esc (отмена).
         */
        let _warnModal = null;
        function showUnsavedResultWarning(media, proceedCallback) {
            // Если предупреждение отключено пользователем в меню или результат уже скачан — сразу продолжаем
            if (config && config.hfWarnUnsaved === false) {
                if (typeof proceedCallback === 'function') proceedCallback();
                return;
            }
            if (isMediaDownloaded(media)) {
                if (typeof proceedCallback === 'function') proceedCallback();
                return;
            }

            if (_warnModal && _warnModal.parentNode) _warnModal.remove();

            const modal = document.createElement('div');
            modal.id = 'mossad-hf-unsaved-modal';
            modal.tabIndex = -1;
            modal.style.cssText = `
                position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
                z-index: 2147483647; background: rgba(20, 18, 24, 0.96); backdrop-filter: blur(16px);
                border: 1px solid #f59e0b; border-radius: 12px; padding: 12px 16px;
                box-shadow: 0 12px 36px rgba(0,0,0,0.8), 0 0 15px rgba(245, 158, 11, 0.25);
                font-family: system-ui, -apple-system, sans-serif; color: #fff;
                display: flex; flex-direction: column; gap: 8px; animation: mossadFadeIn 0.2s ease;
                min-width: 330px;
            `;

            modal.innerHTML = `
                <div style="font-weight:bold; color:#fbbf24; font-size:13px; display:flex; align-items:center; gap:6px;">
                    ⚠️ Предыдущий результат ещё не скачан!
                </div>
                <div style="font-size:11px; color:#d1d5db; line-height:1.4;">
                    Запуск новой генерации сотрёт текущее медиа без сохранения.
                </div>
                <div style="font-size:10px; color:#9ca3af; line-height:1.3; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">
                    ⌨ <b>Enter</b> — Скачать и запустить &nbsp;|&nbsp; <b>Ctrl+Enter</b> — Всё равно запустить &nbsp;|&nbsp; <b>Esc</b> — Отмена
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; flex-wrap:wrap; gap:6px;">
                    <label style="display:flex; align-items:center; gap:5px; font-size:10px; color:#9ca3af; cursor:pointer;" title="Отключить предупреждения о нескачанном результате на этом сайте">
                        <input id="mossad-hf-dont-warn" type="checkbox" style="accent-color:#f59e0b;">
                        <span>Больше не спрашивать</span>
                    </label>
                    <div style="display:flex; gap:6px;">
                        <button id="mossad-hf-save-and-gen" style="background:#10b981; color:#fff; border:2px solid #34d399; box-shadow:0 0 10px rgba(16,185,129,0.5); border-radius:6px; padding:6px 12px; cursor:pointer; font-weight:bold; font-size:11px; transition:all 0.2s;">💾 Скачать и запустить</button>
                        <button id="mossad-hf-ignore-and-gen" style="background:#374151; color:#e5e7eb; border:1px solid #4b5563; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px;">Всё равно запустить</button>
                        <button id="mossad-hf-cancel" style="background:transparent; color:#9ca3af; border:1px solid #4b5563; border-radius:6px; padding:6px 8px; cursor:pointer; font-size:11px;">Отмена (Esc)</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            _warnModal = modal;

            const btnSave = modal.querySelector('#mossad-hf-save-and-gen');
            const btnIgnore = modal.querySelector('#mossad-hf-ignore-and-gen');
            const btnCancel = modal.querySelector('#mossad-hf-cancel');

            // Визуальный фокус СРАЗУ на кнопку «Скачать и запустить»
            setTimeout(() => {
                if (btnSave) {
                    btnSave.focus();
                    btnSave.style.outline = '2px solid #34d399';
                    btnSave.style.boxShadow = '0 0 14px rgba(16,185,129,0.8)';
                }
            }, 30);

            const close = () => {
                window.removeEventListener('keydown', keyHandler, true);
                document.removeEventListener('keydown', keyHandler, true);
                if (modal && modal.parentNode) modal.remove();
                _warnModal = null;
            };

            const keyHandler = (ke) => {
                if (!_warnModal) return;
                if (ke.key === 'Escape') {
                    ke.preventDefault();
                    ke.stopPropagation();
                    close();
                    const ta = document.querySelector('textarea, input[type="text"]');
                    if (ta) ta.focus();
                    return;
                }
                if (ke.key === 'Enter') {
                    ke.preventDefault();
                    ke.stopPropagation();
                    if (ke.ctrlKey) {
                        btnIgnore.click();
                    } else {
                        btnSave.click();
                    }
                }
            };
            window.addEventListener('keydown', keyHandler, true);
            document.addEventListener('keydown', keyHandler, true);

            btnSave.onclick = () => {
                const cbDontWarn = modal.querySelector('#mossad-hf-dont-warn');
                if (cbDontWarn && cbDontWarn.checked) {
                    Settings.set('hfWarnUnsaved', false);
                    showToast('⚡ Защита нескачанного отключена');
                }
                close();
                markMediaDownloaded(media);
                if (typeof triggerDownload === 'function') {
                    triggerDownload(false, null, null, media);
                }
                if (typeof proceedCallback === 'function') proceedCallback();
            };

            btnIgnore.onclick = () => {
                const cbDontWarn = modal.querySelector('#mossad-hf-dont-warn');
                if (cbDontWarn && cbDontWarn.checked) {
                    Settings.set('hfWarnUnsaved', false);
                    showToast('⚡ Защита нескачанного отключена');
                }
                close();
                markMediaDownloaded(media);
                if (typeof proceedCallback === 'function') proceedCallback();
            };

            btnCancel.onclick = () => {
                close();
                const ta = document.querySelector('textarea, input[type="text"]');
                if (ta) ta.focus();
            };
        }

        /**
         * Быстрый переход по слэшу (\) между ключевыми блоками спейса:
         * 1) Поле ввода промпта
         * 2) Пресеты качества / разрешения
         * 3) Продолжительность / слайдер
         * 4) Кнопка «2input»
         */
        let _hfCycleStep = 0;
        function cycleHfSections() {
            const targets = [
                {
                    name: 'Промпт',
                    el: document.querySelector('textarea[data-testid="textbox"], textarea, input[type="text"]')
                },
                {
                    name: 'Пресеты качества',
                    el: document.querySelector('.gradio-dropdown input, select, fieldset, div[data-testid="radio-group"]')
                },
                {
                    name: 'Продолжительность',
                    el: document.querySelector('input[type="range"], div[data-testid="slider"] input, input[type="number"]')
                },
                {
                    name: '2input (в инпут)',
                    el: Array.from(document.querySelectorAll('button, a')).find(b => /2input|to\s*input|send\s*to|image\s*to|результат\s*в\s*инпут/i.test((b.textContent || '') + (b.id || '')))
                }
            ].filter(t => t.el && t.el.isConnected && t.el.offsetWidth > 0);

            if (!targets.length) {
                showToast('ℹ️ Поля ввода для слэша не найдены', true);
                return;
            }

            _hfCycleStep = (_hfCycleStep + 1) % targets.length;
            const cur = targets[_hfCycleStep];
            try {
                cur.el.focus();
                cur.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const prevOutline = cur.el.style.outline;
                cur.el.style.outline = '2px solid #38bdf8';
                cur.el.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.6)';
                setTimeout(() => {
                    cur.el.style.outline = prevOutline;
                    cur.el.style.boxShadow = '';
                }, 1200);
                showToast(`🎯 Фокус: ${cur.name}`);
            } catch (_) {}
        }

        /**
         * v1.4.7: Автоматическое отслеживание клика «Generate/Submit» и нажатия Enter
         * для гарантированного запуска «ждуна» при включенном Авто-DL.
         */
        let _hfAutoDlHooked = false;
        function initAutoDlListeners() {
            if (_hfAutoDlHooked || !isSupported()) return;
            _hfAutoDlHooked = true;

            // 1. Клик по кнопке генерации на странице (с защитой от стирания нескачанного медиа)
            document.addEventListener('click', (e) => {
                const target = e.target;
                if (!target) return;
                const btn = target.closest('button, input[type="submit"], input[type="button"], [role="button"]');
                if (!btn) return;
                const submitBtn = findSubmitButton();
                const isGenBtn = btn === submitBtn || /generate|submit|run|старт|создать/i.test((btn.textContent || '') + (btn.getAttribute('aria-label') || '') + (btn.id || ''));
                if (!isGenBtn) return;

                const curMedia = findMedia();
                if (config && config.hfWarnUnsaved !== false && curMedia && !isMediaDownloaded(curMedia) && !btn.dataset.mossadConfirmed) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    showUnsavedResultWarning(curMedia, () => {
                        btn.dataset.mossadConfirmed = 'true';
                        btn.click();
                        setTimeout(() => { delete btn.dataset.mossadConfirmed; }, 500);
                    });
                    return;
                }

                if (isAutoSaveEnabled()) {
                    setTimeout(() => startWatcher(), 200);
                }
            }, true);

            // 2. Нажатия клавиш: слэш (\) для навигации, Enter для генерации с защитой, Ctrl+Shift+Enter для прямого пуска
            document.addEventListener('keydown', (e) => {
                // Переход по слэшу (\)
                if ((e.code === 'Backslash' || e.key === '\\') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    const tag = (e.target && e.target.tagName || '').toLowerCase();
                    // Если курсор не внутри обычного набора текста
                    if (tag !== 'textarea' && tag !== 'input') {
                        e.preventDefault();
                        e.stopPropagation();
                        cycleHfSections();
                        return;
                    }
                }

                // v1.4.32: Сквозной Ctrl+Shift+Enter — запускает генерацию в любом случае в обход проверок нескачанного
                if (e.key === 'Enter' && e.ctrlKey && e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast('⚡ Прямой запуск генерации (Ctrl+Shift+Enter)...');
                    triggerGenerate();
                    if (isAutoSaveEnabled()) {
                        setTimeout(() => startWatcher(), 200);
                    }
                    return;
                }

                if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) {
                    const tag = (e.target && e.target.tagName || '').toLowerCase();
                    if (tag === 'textarea' || tag === 'input') {
                        const curMedia = findMedia();
                        if (config && config.hfWarnUnsaved !== false && curMedia && !isMediaDownloaded(curMedia)) {
                            e.preventDefault();
                            e.stopPropagation();
                            showUnsavedResultWarning(curMedia, () => {
                                triggerGenerate();
                            });
                            return;
                        }
                        if (isAutoSaveEnabled()) {
                            setTimeout(() => startWatcher(), 300);
                        }
                    }
                }
            }, true);

            // 3. Наблюдатель за появлением статуса генерации Gradio
            try {
                const observer = new MutationObserver((mutations) => {
                    if (!isAutoSaveEnabled() || _isWaitingForGeneration) return;
                    for (const m of mutations) {
                        if (m.type === 'childList' || m.type === 'attributes') {
                            const isGen = document.querySelector('.generating, .loading, .progress-bar, div[data-testid="status-tracker"].generating, div[data-testid="status-tracker"] .progress-bar, div[data-testid="status-tracker"] .loading, [aria-busy="true"]');
                            if (isGen) {
                                startWatcher();
                                break;
                            }
                        }
                    }
                });
                observer.observe(document.body || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-testid', 'aria-busy'] });
            } catch(e) {}
        }

        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initAutoDlListeners);
            } else {
                initAutoDlListeners();
            }
        }

        return {
            id: 'huggingface',
            isSupported,
            getSpaceMetadata,
            findSubmitButton,
            findMedia,
            triggerGenerate,
            startWatcher,
            isAutoSaveEnabled,
            init: initAutoDlListeners
        };
    })();
    if (typeof MossadEngineRegistry !== 'undefined') {
        MossadEngineRegistry.register('huggingface', window.MOSSAD_ENGINES.huggingface);
    }
