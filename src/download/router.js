    function findMediaForDownload() {
        // Instagram — делегируем к движку
        if (window.MOSSAD_ENGINES.instagram?.isSupported()) {
            return window.MOSSAD_ENGINES.instagram.findMedia();
        }

        if (rootDomain.includes('pinterest.')) {
            const pinType = getPinMediaType();
            const mainPin = getPinterestMainPinData();
            
            // 1. Если главный пин - ВИДЕО
            if (pinType === 'video' || mainPin.bestMp4Url) {
                if (mainPin.bestMp4Url) {
                    return { urls: [mainPin.bestMp4Url], type: 'video' };
                }
                const stageSig = document.querySelector('div[data-test-id="closeup-stage"] [data-video-signature], div[data-test-id="pin-closeup"] [data-video-signature]');
                if (stageSig) {
                    const sig = stageSig.getAttribute('data-video-signature');
                    if (sig && sig.length === 32) {
                        return { urls: [`https://v1.pinimg.com/videos/iht/expMp4/${sig.slice(0,2)}/${sig.slice(2,4)}/${sig.slice(4,6)}/${sig}_720w.mp4`], type: 'video' };
                    }
                }
            }

            // 2. Если главный пин - ФОТО (или не содержит видео)
            const stageImg = document.querySelector('div[data-test-id="closeup-stage"] img, div[data-test-id="pin-closeup"] img, div[role="main"] img');
            if (stageImg && stageImg.src) {
                let imgUrl = stageImg.src;
                imgUrl = imgUrl.replace(/\/(236x|474x|564x|736x|1200x)\//, '/originals/');
                return { urls: [imgUrl], type: 'photo' };
            }
        }

        // 1. Точная копия логики из старого скрипта (grok_hotkeys_plus_slideshow.user.js от 4 августа)
        if (rootDomain.includes('redgifs.com')) {
            const active = getActiveRedGifsItem();
            const urls = [];
            const itemId = active ? active.getAttribute('data-feed-item-id') : null;

            // Из картинки poster
            if (active) {
                const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]');
                if (poster && poster.src) {
                    const mp4Hd = poster.src.replace(/-mobile\.(jpg|png|jpeg)/i, '.mp4').replace(/\.(jpg|png|jpeg)/i, '.mp4');
                    const mp4Sd = poster.src.replace(/\.(jpg|png|jpeg)/i, '-mobile.mp4');
                    urls.push(mp4Hd, mp4Sd);
                }
            }

            const v = getRedGifsVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/hd.m3u8`);
                urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/sd.m3u8`);
            }

            if (urls.length > 0) return { urls: Array.from(new Set(urls.filter(Boolean))), type: 'video', itemId: itemId || 'video' };
        }

        const video = getActiveVideo();
        if (video) {
            let src = '';
            if (!src) {
                const sources = Array.from(video.querySelectorAll('source'));
                for (const s of sources) {
                    if (s.src && !s.src.startsWith('blob:')) { src = s.src; break; }
                }
                if (!src && video.src && !video.src.startsWith('blob:')) src = video.src;
                if (!src && video.currentSrc && !video.currentSrc.startsWith('blob:')) src = video.currentSrc;
            }
            if (src) return { urls: [src], type: 'video' };
        }

        const img = document.querySelector('img[src*="pinimg.com/originals/"]') || document.querySelector('img[src*="pinimg.com/736x/"]');
        if (img && img.src) {
            const fullImg = img.src.replace(/\/736x\//, '/originals/').replace(/\/474x\//, '/originals/');
            return { urls: [fullImg], type: 'image' };
        }
        
        const allImgs = Array.from(document.querySelectorAll('img')).filter(i => i.width > 200 && i.height > 200);
        if (allImgs.length > 0 && !rootDomain.includes('redgifs.com') && !rootDomain.includes('vk')) {
            return { urls: [allImgs[0].src], type: 'image' };
        }
        
        return null;
    }

    function triggerDownload() {
        if (rootDomain === 'grok.com') {
            if (triggerGrokDownload()) return;
        }

        const media = findMediaForDownload();
        if (!media || !media.urls || media.urls.length === 0) { showToast('❌ Медиа не найдено', true); return; }

        // Защита от повторного скачивания одного файла за короткое время
        const primaryUrl = media.urls[0];
        const now = Date.now();
        if (primaryUrl === _lastDownloadUrl && (now - _lastDownloadTime) < 5000) {
            console.warn('[MOSSAD] Повторное скачивание того же файла за 5сек, пропущено.');
            return;
        }
        _lastDownloadUrl = primaryUrl;
        _lastDownloadTime = now;
        
        // --- Вспомогательная функция: применить {var[N]} синтаксис ---
        function applyTplVar(value, len) {
            return len > 0 ? value.slice(0, len) : value;
        }

        // --- Базовое имя файла (без шаблона) ---
        let filename;
        if (rootDomain.includes('redgifs.com') && media.itemId) {
            filename = getRedGifsTitleFilename(media.itemId);
        } else {
            const ext = media.type === 'video' ? 'mp4' : 'jpg';
            const titleClean = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            filename = `${titleClean}.${ext}`;
        }

        // --- Применяем шаблон имени файла, если включён ---
        if (config.filenameTemplateEnabled && config.filenameTemplate && config.filenameTemplate.trim()) {
            const now2 = new Date();
            const pad2 = (n) => String(n).padStart(2, '0');
            const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
            const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
            const ext2 = media.type === 'video' ? 'mp4' : 'jpg';
            const titleClean2 = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            const domainClean = rootDomain.replace(/[^a-z0-9._-]/gi, '_');
            const nStr = String(Date.now()).slice(-6);

            // Словарь переменных (значение без обрезки)
            const vars = {
                title: titleClean2,
                date:  dateStr,
                time:  timeStr,
                ext:   ext2,
                domain: domainClean,
                n:     nStr,
            };

            // Регулярка: {varname} или {varname[N]}
            filename = config.filenameTemplate.trim().replace(
                /\{(\w+)(?:\[(\d+)\])?\}/gi,
                (_, name, lenStr) => {
                    const key = name.toLowerCase();
                    const val = key in vars ? vars[key] : '';
                    const len = lenStr ? parseInt(lenStr, 10) : 0;
                    return applyTplVar(val, len);
                }
            ).replace(/[\\/:*?"<>|]/g, '_');

            // Добавить расширение, если шаблон его не содержит
            if (!filename.includes('.')) filename += `.${ext2}`;
        }

        // --- Счётчик дубликатов: (001), (002)... ---
        {
            // Разбиваем имя на базу и расширение
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : '';
            const count = (_filenameCounter.get(base) || 0) + 1;
            _filenameCounter.set(base, count);
            if (count > 1) {
                filename = `${base} (${String(count - 1).padStart(3, '0')})${extPart}`;
            }
        }

        const urls = media.urls;
        let attemptedIndex = 0;

        function tryNext() {
            if (attemptedIndex >= urls.length) {
                console.warn('Все ссылки не сработали, fallback на Blob...');
                downloadBlobMedia(urls[0], filename);
                return;
            }
            const targetUrl = urls[attemptedIndex++];
            const isM3u8 = targetUrl.includes('.m3u8');
            const targetFilename = isM3u8 ? filename.replace('.mp4', '.m3u8') : filename;
            
            if (typeof GM_download === 'function' && targetUrl.endsWith('.m3u8')) {
                try {
                    GM_download({
                        url: targetUrl,
                        name: targetFilename,
                        saveAs: false,
                        onerror: (err) => {
                            console.warn(`GM_download failed for ${targetUrl}:`, err);
                            tryNext();
                        }
                    });
                } catch (e) {
                    tryNext();
                }
            } else {
                showToast('⏳ Запуск скачивания...');
                triggerDirectBlobDownload(targetUrl, targetFilename, tryNext);
            }
        }
        
        tryNext();
    }

