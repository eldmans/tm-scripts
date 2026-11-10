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
        let _autoSaveTimer = null;
        let _isWaitingForGeneration = false;

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
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]'));
            
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

            // 1. Проверяем готовое видео в Gradio / Streamlit
            const videos = Array.from(document.querySelectorAll('.gradio-video video, .output-video video, div[data-testid="video"] video, video'));
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
            const dlLinks = Array.from(document.querySelectorAll('a[download], a.download-button, a[title*="Download" i]'));
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
                const imgs = Array.from(document.querySelectorAll(sel));
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
            const allImgs = Array.from(document.querySelectorAll('img')).filter(i => {
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
                        type: 'image',
                        userName: meta.author,
                        spaceName: meta.space,
                        subtype: meta.subtype,
                        itemId: extractItemId(src),
                        postUrl: location.href
                    };
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
                const isGenerating = Boolean(document.querySelector('.generating, .loading, .progress-bar, div[data-testid="status-tracker"], [aria-busy="true"]'));

                const curMedia = findMedia();
                const curSrc = curMedia && curMedia.urls ? curMedia.urls[0] : null;

                // Если появилось новое изображение/видео, и генерация завершена
                if (curSrc && curSrc !== initialSrc && curSrc !== _lastDownloadedSrc && !isGenerating) {
                    clearInterval(_autoSaveTimer);
                    _autoSaveTimer = null;
                    _isWaitingForGeneration = false;
                    _lastDownloadedSrc = curSrc;
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
         * v1.4.7: Автоматическое отслеживание клика «Generate/Submit» и нажатия Enter
         * для гарантированного запуска «ждуна» при включенном Авто-DL.
         */
        let _hfAutoDlHooked = false;
        function initAutoDlListeners() {
            if (_hfAutoDlHooked || !isSupported()) return;
            _hfAutoDlHooked = true;

            // 1. Клик по кнопке генерации на странице
            document.addEventListener('click', (e) => {
                if (!isAutoSaveEnabled()) return;
                const target = e.target;
                if (!target) return;
                const btn = target.closest('button, input[type="submit"], input[type="button"], [role="button"]');
                if (!btn) return;
                const submitBtn = findSubmitButton();
                if (btn === submitBtn || /generate|submit|run|старт|создать/i.test((btn.textContent || '') + (btn.getAttribute('aria-label') || '') + (btn.id || ''))) {
                    setTimeout(() => startWatcher(), 200);
                }
            }, true);

            // 2. Нажатие Enter в поле промпта
            document.addEventListener('keydown', (e) => {
                if (!isAutoSaveEnabled()) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                    const tag = (e.target && e.target.tagName || '').toLowerCase();
                    if (tag === 'textarea' || tag === 'input') {
                        setTimeout(() => startWatcher(), 300);
                    }
                }
            }, true);

            // 3. Наблюдатель за появлением статуса генерации Gradio
            try {
                const observer = new MutationObserver((mutations) => {
                    if (!isAutoSaveEnabled() || _isWaitingForGeneration) return;
                    for (const m of mutations) {
                        if (m.type === 'childList' || m.type === 'attributes') {
                            const isGen = document.querySelector('.generating, .loading, .progress-bar, div[data-testid="status-tracker"]');
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
            isSupported,
            getSpaceMetadata,
            findSubmitButton,
            findMedia,
            triggerGenerate,
            startWatcher,
            isAutoSaveEnabled
        };
    })();
