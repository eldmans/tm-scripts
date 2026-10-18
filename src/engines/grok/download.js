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
        const lockedMediaUrl = media ? media.url : null;
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl) && !isDuplicateConfirmed(lockedMediaUrl)) {
            checkFileInHistory(null, lockedMediaUrl, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record, onDoneCallback), currentPostUrl, lockedMediaUrl);
                } else {
                    triggerGrokDownload(true, null, onDoneCallback);
                }
            });
            return true;
        }

        const prompt = getGrokCurrentPrompt();
        const model = getGrokCurrentModel();
        const promptHash = computeGrokPromptHash(prompt);
        if (prompt) {
            sendPromptToVault(prompt, model, 'grok.com', currentPostUrl);
        }
        const shortId = currentPostId ? currentPostId.slice(0, 8) : String(Date.now()).slice(-8);
        const shortId4 = currentPostId ? currentPostId.slice(0, 4) : '';
        const shortConv4 = currentConvId ? currentConvId.slice(0, 4) : '';
        const ext2 = media ? media.ext : (hasVid ? 'mp4' : 'jpg');
        const rootBase = duplicateRecord ? (duplicateRecord.rootFilename || (extractRootFilename(duplicateRecord.filename))) : '';
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
            grokFilename = renderFilenameTemplate(config.filenameTemplate, vars, Boolean(duplicateRecord), dblSuffix, ext2);
        }

        const onDownloadFinalized = () => {
            performPostDownloadAction();
            if (onDoneCallback) onDoneCallback();
        };

        if (media && media.url) {
            showToast(`⏳ Загрузка: ${grokFilename}...`);
            const isBlobUrl = media.url.startsWith('blob:');

            const handleBlobResponse = async (rawBlob) => {
                try {
                    showToast('⏳ Запись метаданных...');
                    const enrichedBlob = await injectGrokMetadataToBlob(rawBlob, prompt, currentPostUrl, model, promptHash);
                    saveBlobToDisk(enrichedBlob, grokFilename, media.url, currentPostUrl);
                    onDownloadFinalized();
                } catch (err) {
                    console.error('[MOSSAD] Metadata injection failed, saving raw blob:', err);
                    saveBlobToDisk(rawBlob, grokFilename, media.url, currentPostUrl);
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


    // Автоматический перехват отправки промпта в Grok в Universal Prompt Vault
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', function handleGrokPromptSubmit(e) {
            if (rootDomain !== 'grok.com') return;
            if (e.key === 'Enter' && !e.shiftKey) {
                const ta = document.querySelector('textarea, div[contenteditable="true"]');
                if (ta && (ta === e.target || ta.contains(e.target))) {
                    const txt = (ta.value !== undefined ? ta.value : (ta.innerText || ta.textContent || '')).trim();
                    if (txt && txt.length > 2) {
                        const model = getGrokCurrentModel();
                        sendPromptToVault(txt, model, 'grok.com', location.href);
                    }
                }
            }
        }, true);
    }
