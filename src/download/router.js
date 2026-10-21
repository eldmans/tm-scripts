    function findMediaForDownload() {
        // Instagram — делегируем к движку
        if (window.MOSSAD_ENGINES.instagram?.isSupported()) {
            return window.MOSSAD_ENGINES.instagram.findMedia();
        }

        // v1.3.52: Pinterest — асинхронно через pinterestResolveMedia() в triggerDownload (API пина).
        // Синхронный путь сюда больше не заходит; запасной ответ — только главный пин, без «первой картинки страницы».
        if (rootDomain.includes('pinterest.')) {
            const img = pinterestMainImage();
            return img ? { urls: [img.currentSrc || img.src], type: 'photo' } : null;
        }

        if (rootDomain.includes('redgifs.com')) {
            if (window.MOSSAD_ENGINES?.redgifs?.findMedia) {
                const res = window.MOSSAD_ENGINES.redgifs.findMedia();
                if (res) return res;
            }
            const active = getActiveRedGifsItem();
            const urls = [];
            const itemId = active ? active.getAttribute('data-feed-item-id') : null;

            // Из картинки poster
            if (active) {
                const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]')
                            || (itemId ? document.querySelector(`img[src*="${itemId}"]`) : null)
                            || document.querySelector('img[src*="media.redgifs.com"]');
                if (poster && poster.src) {
                    const mp4Hd = poster.src.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg)/i, '.mp4').replace(/\.(?:jpg|png|jpeg)/i, '.mp4');
                    const mp4Sd = poster.src.replace(/-(?:mobile|poster|thumbnail)\.(?:jpg|png|jpeg)/i, '-mobile.mp4').replace(/\.(?:jpg|png|jpeg)/i, '-mobile.mp4');
                    urls.push(mp4Hd, mp4Sd);
                }
            }

            const v = getRedGifsVideo();
            if (v) {
                const src = v.currentSrc || v.src || (v.querySelector('source') && v.querySelector('source').src);
                if (src && !src.startsWith('blob:') && !urls.includes(src)) urls.push(src);
            }

            if (itemId) {
                const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
                urls.push(`https://media.redgifs.com/${capId}.mp4`);
                urls.push(`https://media.redgifs.com/${capId}-mobile.mp4`);
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

    let _activeDuplicateRecord = null;

    function triggerDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null, presetMedia = null) {
        // v1.3.52: Pinterest — медиа главного пина из PinResource API (асинхронно, кэш по id пина)
        if (rootDomain.includes('pinterest.') && !presetMedia) {
            const pinUrlAtStart = location.href;
            pinterestResolveMedia().then(m => {
                if (location.href !== pinUrlAtStart) return; // ушли на другой пин, пока ждали
                if (!m || m.error || !m.urls || !m.urls.length) {
                    showToast(m && m.error === 'video-not-found' ? '❌ Видео не найдено (фото вместо видео не качаю)' : '❌ Медиа не найдено', true);
                    if (onDoneCallback) onDoneCallback(); // слайдшоу не ждёт 8 с
                    return;
                }
                triggerDownload(bypassDuplicateCheck, duplicateRecord, onDoneCallback, m);
            }).catch(e => { console.error('[MOSSAD] Pinterest download resolve error:', e); showToast('❌ Медиа не найдено', true); if (onDoneCallback) onDoneCallback(); });
            return;
        }
        if (duplicateRecord) {
            _activeDuplicateRecord = duplicateRecord;
        } else if (!bypassDuplicateCheck) {
            _activeDuplicateRecord = null;
        }

        if (rootDomain === 'grok.com') {
            if (triggerGrokDownload(bypassDuplicateCheck, duplicateRecord || _activeDuplicateRecord, onDoneCallback)) return;
        }

        const media = presetMedia || findMediaForDownload();
        if (!media || !media.urls || media.urls.length === 0) { showToast('❌ Медиа не найдено', true); return; }

        const primaryUrl = media.urls[0];
        const canonicalPostUrl = media.postUrl || location.href;

        // Проверка дубликата в истории (для Pinterest, Instagram, RedGifs и др.)
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(primaryUrl) && !isDuplicateConfirmed(canonicalPostUrl)) {
            checkFileInHistory(null, primaryUrl, canonicalPostUrl, media.type).then(record => {
                if (record) {
                    _activeDuplicateRecord = record;
                    showDuplicateDownloadNotice(record, () => triggerDownload(true, record, null, presetMedia), canonicalPostUrl, primaryUrl);
                } else {
                    _activeDuplicateRecord = null;
                    triggerDownload(true, null, onDoneCallback, presetMedia);
                }
            });
            return;
        }

        // Защита от повторного скачивания одного файла за короткое время
        const now = Date.now();
        if (primaryUrl === _lastDownloadUrl && (now - _lastDownloadTime) < 5000) {
            console.warn('[MOSSAD] Повторное скачивание того же файла за 5сек, пропущено.');
            return;
        }
        _lastDownloadUrl = primaryUrl;
        _lastDownloadTime = now;

        const currentDup = duplicateRecord || _activeDuplicateRecord;
        const isDup = Boolean(currentDup && (currentDup.filename || currentDup.rootFilename));
        const rootBase = isDup ? (currentDup.rootFilename || (extractRootFilename(currentDup.filename))) : '';
        const dblSuffix = isDup ? ` (${rootBase || 'original'}) DBL` : '';
        
        // Извлечение UUID / ID поста для короткого именования (первые 8 символов)
        let postId = '';
        let convId = '';
        if (rootDomain === 'grok.com') {
            const m = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
            if (m) postId = m[1];
            try {
                const u = new URL(location.href);
                convId = u.searchParams.get('conversation') || u.searchParams.get('conv') || '';
            } catch(e) {}
            if (!convId && postId) {
                try {
                    const raw = sessionStorage.getItem('grok_gallery_collection');
                    if (raw) {
                        const data = JSON.parse(raw);
                        const found = (data.items || []).find(it => it.url && it.url.includes(postId));
                        if (found && found.convId) convId = found.convId;
                    }
                } catch(e) {}
            }
            if (!convId && postId) {
                const a = document.querySelector(`a[href*="${postId}"][href*="conversation="]`);
                if (a) {
                    try {
                        const u = new URL(a.href, location.origin);
                        convId = u.searchParams.get('conversation') || '';
                    } catch(e) {}
                }
            }
        } else if (rootDomain.includes('pinterest.')) {
            const m = location.pathname.match(/\/pin\/(\d+)/);
            if (m) postId = m[1];
        } else if (rootDomain.includes('redgifs.com')) {
            postId = media.itemId || '';
        } else if (rootDomain.includes('instagram.com')) {
            const m = location.pathname.match(/\/(?:p|reel)\/([^/?#]+)/);
            if (m) postId = m[1];
        }
        if (!postId && media.itemId) postId = media.itemId;
        if (!postId) postId = String(Date.now());

        const shortId = postId.replace(/^grok-video-/, '').slice(0, 8);
        const domainClean = rootDomain.replace(/[^a-z0-9._-]/gi, '_');

        // Извлечение имени автора/пользователя (для RedGifs, Instagram и др.)
        let authorName = '';
        if (media && media.userName) {
            authorName = media.userName;
        } else if (rootDomain.includes('redgifs.com')) {
            authorName = getRedGifsUserName();
        } else if (rootDomain.includes('instagram.com')) {
            const m = location.pathname.match(/^\/([A-Za-z0-9_.]+)\//);
            if (m && !['p', 'reel', 'stories', 'explore'].includes(m[1])) authorName = m[1];
        }

        // --- Вспомогательная функция: применить {var[N]} синтаксис ---
        function applyTplVar(value, len) {
            return len > 0 ? value.slice(0, len) : value;
        }

        // --- Базовое имя файла (по умолчанию: 8 символов ID + домен) ---
        let filename;
        const ext = media.type === 'video' ? 'mp4' : 'jpg';
        if (rootDomain.includes('redgifs.com') && media.itemId) {
            filename = `${getRedGifsTitleFilename(media.itemId)}`;
        } else if (rootDomain === 'grok.com' && shortId && shortId.length >= 4) {
            const shortConv4 = convId ? convId.slice(0, 4) : '';
            const shortId4 = postId ? postId.slice(0, 4) : '';
            const defaultPrefix = shortConv4 ? `${shortConv4}-${shortId4 || shortId}` : shortId;
            filename = `${defaultPrefix}-${domainClean}.${ext}`;
        } else if (shortId && shortId.length >= 4) {
            // Формат по умолчанию: {8 символов UUID}-{домен}.{ext}
            filename = `${shortId}-${domainClean}.${ext}`;
        } else {
            const titleClean = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            filename = `${titleClean}.${ext}`;
        }

        // --- Применяем шаблон имени файла, если включён ---
        if (config.filenameTemplateEnabled) {
            const now2 = new Date();
            const pad2 = (n) => String(n).padStart(2, '0');
            const dateStr = `${now2.getFullYear()}-${pad2(now2.getMonth()+1)}-${pad2(now2.getDate())}`;
            const timeStr = `${pad2(now2.getHours())}-${pad2(now2.getMinutes())}-${pad2(now2.getSeconds())}`;
            const ext2 = media.type === 'video' ? 'mp4' : 'jpg';
            const titleClean2 = (document.title || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || `media_${Date.now()}`;
            const nStr = String(Date.now()).slice(-6);

            // Словарь переменных (значение без обрезки)
            const vars = {
                id:           postId,
                conv:         convId,
                conversation: convId,
                uuid:         postId,
                hash:         postId,
                postid:       postId,
                id8:          shortId,
                hash8:        shortId,
                uuid8:        shortId,
                title:        titleClean2,
                date:         dateStr,
                time:         timeStr,
                ext:          ext2,
                domain:       domainClean,
                username:     authorName || shortId,
                user:         authorName || shortId,
                author:       authorName || shortId,
                n:            nStr,
                dbl:          dblSuffix,
                oldname:      rootBase,
                copy:         rootBase,
                root:         rootBase,
            };

            filename = renderFilenameTemplate(config.filenameTemplate, vars, isDup, dblSuffix, ext2);
        } else if (isDup) {
            // Без шаблона: добавляем разметку дубликата перед расширением
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : (media.type === 'video' ? '.mp4' : '.jpg');
            filename = `${base}${dblSuffix}${extPart}`;
        }

        const urls = media.urls;
        let attemptedIndex = 0;

        let postActionDone = false; // v1.3.52: «После DL» — один раз, а не на каждую запасную ссылку (_720w → _360w)
        function tryNext() {
            if (attemptedIndex >= urls.length) {
                console.warn('Все ссылки не сработали, fallback на Blob...');
                if (onDoneCallback) onDoneCallback();
                downloadBlobMedia(urls[0], filename, canonicalPostUrl);
                return;
            }
            const targetUrl = urls[attemptedIndex++];
            showToast('⏳ Запуск скачивания...');
            // v1.3.52: слайдшоу листает, как только файл сохранён (раньше колбэк не вызывался — всегда ждали 8 с страховки)
            triggerDirectBlobDownload(targetUrl, filename, tryNext, canonicalPostUrl, onDoneCallback);
            if (!postActionDone) { postActionDone = true; performPostDownloadAction(); }
        }
        
        tryNext();
    }

