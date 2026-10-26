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

        /**
         * Поиск готового результата для скачивания (img / video / download button)
         */
        function findMedia() {
            if (!isSupported()) return null;

            // 1. Проверяем готовое видео в Gradio / Streamlit
            const videos = Array.from(document.querySelectorAll('.gradio-video video, .output-video video, div[data-testid="video"] video, video'));
            const validVideo = videos.find(v => {
                const src = v.src || (v.querySelector('source') && v.querySelector('source').src) || v.currentSrc;
                return src && !src.startsWith('blob:http') && !src.includes('tampermonkey') && v.videoWidth > 100;
            }) || videos.find(v => (v.src || v.currentSrc) && (v.offsetWidth > 150 || v.videoWidth > 100));

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
                        itemId: String(Date.now()).slice(-8),
                        postUrl: location.href
                    };
                }
            }

            // 2. Ссылки скачивания a[download]
            const dlLinks = Array.from(document.querySelectorAll('a[download], a.download-button, a[title*="Download" i]'));
            for (const a of dlLinks) {
                const href = a.href;
                if (href && (href.startsWith('http') || href.startsWith('blob:'))) {
                    const isVid = /\.(mp4|webm)(\?|$)/i.test(href);
                    const meta = getSpaceMetadata();
                    return {
                        urls: [href],
                        type: isVid ? 'video' : 'image',
                        userName: meta.author,
                        spaceName: meta.space,
                        subtype: meta.subtype,
                        itemId: String(Date.now()).slice(-8),
                        postUrl: location.href
                    };
                }
            }

            // 3. Выходные изображения Gradio / Streamlit
            const imgSelectors = [
                '.gradio-image img',
                'div[data-testid="image"] img',
                '.output-image img',
                '.gallery img',
                'div.image-container img',
                'div[data-testid="stImage"] img'
            ];
            for (const sel of imgSelectors) {
                const imgs = Array.from(document.querySelectorAll(sel));
                const goodImg = imgs.find(i => (i.naturalWidth > 150 || i.width > 150) && i.src && !i.src.includes('avatar') && !i.src.includes('icon'));
                if (goodImg && goodImg.src) {
                    const meta = getSpaceMetadata();
                    return {
                        urls: [goodImg.src],
                        type: 'image',
                        userName: meta.author,
                        spaceName: meta.space,
                        subtype: meta.subtype,
                        itemId: String(Date.now()).slice(-8),
                        postUrl: location.href
                    };
                }
            }

            // 4. Fallback: любое крупное изображение на странице (кроме шапки и логотипов)
            const allImgs = Array.from(document.querySelectorAll('img')).filter(i => {
                if (i.naturalWidth < 200 && i.width < 200) return false;
                const src = i.src || '';
                if (src.includes('logo') || src.includes('avatar') || src.includes('badge')) return false;
                return true;
            });
            if (allImgs.length > 0) {
                const meta = getSpaceMetadata();
                return {
                    urls: [allImgs[allImgs.length - 1].src],
                    type: 'image',
                    userName: meta.author,
                    spaceName: meta.space,
                    subtype: meta.subtype,
                    itemId: String(Date.now()).slice(-8),
                    postUrl: location.href
                };
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
            if (_isWaitingForGeneration) return;
            _isWaitingForGeneration = true;
            showToast('⏳ Ждун автосохранения активен...');

            const startMedia = findMedia();
            const initialSrc = startMedia && startMedia.urls ? startMedia.urls[0] : null;
            let checkCount = 0;
            const maxChecks = 300; // до 5 минут

            if (_autoSaveTimer) clearInterval(_autoSaveTimer);

            _autoSaveTimer = setInterval(() => {
                checkCount++;
                const curMedia = findMedia();
                const curSrc = curMedia && curMedia.urls ? curMedia.urls[0] : null;

                // Индикатор загрузки Gradio (progress bar или статус generating)
                const isGenerating = Boolean(document.querySelector('.generating, .loading, .progress-bar, div[data-testid="status-tracker"]'));

                // Если появилось новое изображение/видео, и генерация завершена
                if (curSrc && curSrc !== initialSrc && curSrc !== _lastDownloadedSrc && !isGenerating) {
                    clearInterval(_autoSaveTimer);
                    _autoSaveTimer = null;
                    _isWaitingForGeneration = false;
                    _lastDownloadedSrc = curSrc;
                    showToast('🎉 Генерация завершена! Автоскачивание...');
                    triggerDownload(true);
                    return;
                }

                if (checkCount >= maxChecks) {
                    clearInterval(_autoSaveTimer);
                    _autoSaveTimer = null;
                    _isWaitingForGeneration = false;
                    console.log('[MOSSAD HF] Тайм-аут ожидания генерации');
                }
            }, 1000);
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
