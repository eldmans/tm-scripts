    // ============================================================
    // GROK: Download with Metadata Injection & Fallback
    // ============================================================
    // ============================================================
    // v1.3.53: GROK — данные для шаблона имени (общие для скачивания и окна «?»)
    // ============================================================
    /** UUID беседы текущего поста: ?conversation= / собранная коллекция / ссылка на странице. */
    function grokCurrentConvId(postId) {
        let convId = '';
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
                try { convId = new URL(a.href, location.origin).searchParams.get('conversation') || ''; } catch(e) {}
            }
        }
        return convId;
    }

    // {account}: e-mail/имя вошедшего аккаунта Grok. Источник — GET /rest/user (тот же сайт, куки сессии)
    // + общие per-container хелперы mossadGetAccount / mossadSetAccount (localStorage).
    const GROK_ACCOUNT_SS_FLAG = 'mossad_grok_account_checked';
    const _emailRe = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    function _grokFindEmailDeep(obj, depth = 0) {
        if (!obj || depth > 4) return '';
        if (typeof obj === 'string') return '';
        if (typeof obj.email === 'string' && _emailRe.test(obj.email)) return obj.email.trim();
        for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (v && typeof v === 'object') { const r = _grokFindEmailDeep(v, depth + 1); if (r) return r; }
        }
        return '';
    }
    function grokAccountFromDom() {
        return typeof mossadAccountFromDom === 'function' ? mossadAccountFromDom() : '';
    }
    /** Синхронно: известный e-mail / аккаунт Grok или ''. */
    function grokAccountEmail() {
        if (rootDomain !== 'grok.com') return '';
        return typeof mossadGetAccount === 'function' ? mossadGetAccount() : '';
    }
    /** Один запрос /rest/user за сессию вкладки; обновляет кэш. force — для окна «?». */
    function grokRefreshAccount(force = false) {
        if (rootDomain !== 'grok.com' || typeof fetch !== 'function') return Promise.resolve(grokAccountEmail());
        if (!force && sessionStorage.getItem(GROK_ACCOUNT_SS_FLAG)) return Promise.resolve(grokAccountEmail());
        try { sessionStorage.setItem(GROK_ACCOUNT_SS_FLAG, '1'); } catch (e) {}
        return fetch('/rest/user', { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
            .then(r => r.ok ? r.json() : null)
            .then(j => {
                const email = _grokFindEmailDeep(j);
                if (email && typeof mossadSetAccount === 'function') mossadSetAccount(email);
                return email || grokAccountEmail();
            })
            .catch(() => grokAccountEmail());
    }
    window.grokRefreshAccount = grokRefreshAccount;
    // Лёгкий префетч: один раз за сессию на grok.com, через 4 с после загрузки (если аккаунт ещё неизвестен)
    if (rootDomain === 'grok.com') {
        setTimeout(() => {
            if (!grokAccountEmail()) grokRefreshAccount(false);
        }, 4000);
    }

    /** Извлекает устойчивый ID генерации из media.url для /library (где URL страницы не меняется). */
    function grokDeriveIdFromMediaUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const genM = url.match(/\/(?:generated|post)\/([a-f0-9-]{36})/i);
        if (genM) return genM[1];
        const uuids = url.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi);
        if (uuids && uuids.length > 0) return uuids[uuids.length - 1];
        if (!url.startsWith('blob:') && !url.startsWith('data:') && typeof mossadHashString12 === 'function') {
            const cleaned = typeof cleanMediaUrl === 'function' ? cleanMediaUrl(url) : url.split('?')[0];
            return mossadHashString12(cleaned);
        }
        return '';
    }

    /** Контекст для buildFilenameVars на посте Grok / в Library (без пометки дубликата). */
    function grokFilenameContext(media) {
        let postId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';
        if (!postId && media && media.postId) postId = media.postId;
        if (!postId && media && media.url) postId = grokDeriveIdFromMediaUrl(media.url);
        const hasVid = media ? (media.type === 'video') : (getActiveVideo() !== null);
        let prompt = '';
        try { prompt = getGrokCurrentPrompt() || ''; } catch (e) {}
        const srcname = (media && media.url && typeof mossadExtractUrlFilenameStem === 'function')
            ? mossadExtractUrlFilenameStem(media.url)
            : '';
        const inLib = (typeof isGrokLibraryPage === 'function' && isGrokLibraryPage());
        return {
            postId,
            convId: grokCurrentConvId(postId),
            type: hasVid ? 'video' : 'photo',
            ext: media ? media.ext : (hasVid ? 'mp4' : 'jpg'),
            authorName: 'grok',
            title: inLib ? 'Library - Grok' : 'Imagine - Grok',
            desc: prompt,
            srcname,
            account: grokAccountEmail(),
        };
    }

    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null) {
        if (rootDomain !== 'grok.com') return false;
        const onPost = isGrokPostPage();
        const onLib = (typeof isGrokLibraryPage === 'function' && isGrokLibraryPage());
        const isNewMode = (typeof grokEffectiveUiMode === 'function' && grokEffectiveUiMode() === 'new');
        if (!onPost && !onLib && !isNewMode) return false;

        const media = getGrokMedia();
        if (!onPost && !media) {
            if (onLib) {
                showToast('❌ Медиа не найдено', true);
                if (onDoneCallback) onDoneCallback();
                return true;
            }
            return false;
        }

        blurActiveInput();

        // v1.4.36: Запрос/автоопределение аккаунта контейнера перед первым скачиванием
        if (typeof mossadEnsureAccountForDownload === 'function' && !mossadGetAccount() && !mossadIsAccountSkipped()) {
            mossadEnsureAccountForDownload().then(ok => {
                if (ok) triggerGrokDownload(bypassDuplicateCheck, duplicateRecord, onDoneCallback);
                else if (onDoneCallback) onDoneCallback();
            });
            return true;
        }

        if (config && config.checkHistory === false) {
            bypassDuplicateCheck = true;
        }

        const fctxPre = grokFilenameContext(media);
        const currentPostUrl = (media && media.postUrl) || location.href;
        const currentPostId = fctxPre.postId || '';
        const currentConvId = fctxPre.convId || '';

        const hasVid = media ? (media.type === 'video') : (getActiveVideo() !== null);
        const currentMediaType = hasVid ? 'video' : 'photo';

        // Проверка дубликата в истории (по URL или 64 КБ Fast-Hash контента)
        const lockedMediaUrl = media ? media.url : null;
        if (!bypassDuplicateCheck && !isDuplicateConfirmed(currentPostUrl) && !isDuplicateConfirmed(lockedMediaUrl)) {
            checkFileInHistory(null, lockedMediaUrl, currentPostUrl, currentMediaType).then(record => {
                if (record) {
                    // v1.4.22: НЕ срывать слайд сразу при обнаружении дубликата!
                    // Даем пользователю 6 секунд на решение. Если не скачал — перелистываем только по таймауту.
                    const onTimeout = () => {
                        if (!config.allowDuplicates) {
                            const act = mossadPdAction();
                            if (act === 'upns' || act === 'always') {
                                performPostDownloadAction();
                            }
                        }
                    };
                    showDuplicateDownloadNotice(record, () => triggerGrokDownload(true, record, onDoneCallback), currentPostUrl, lockedMediaUrl, onTimeout);
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

        const pendingConfirm = (typeof getPendingDuplicateInfo === 'function') ? getPendingDuplicateInfo() : null;
        const currentDup = duplicateRecord || (pendingConfirm && pendingConfirm.record ? pendingConfirm.record : null);
        const dupInfo = currentDup ? (typeof findOriginalRecordInfo === 'function' ? findOriginalRecordInfo(currentDup) : null) : null;
        const isDup = Boolean(currentDup && (currentDup.filename || currentDup.rootFilename));
        const rootBase = dupInfo ? dupInfo.rootBase : (isDup ? (currentDup.rootFilename || extractRootFilename(currentDup.filename)) : '');
        const dupNum = dupInfo ? (dupInfo.count || 1) : 1;
        const dblSuffix = isDup ? ` (${rootBase || 'original'}) DBL${dupNum}` : '';
        const siteCount = (typeof mossadIncSiteDlCount === 'function') ? mossadIncSiteDlCount('grok.com') : 1;

        // Дефолтное имя без включенного шаблона: {conv4}-{id4}-grok~{account}.mp4 (с учетом dblPosition)
        const defaultPrefix = shortConv4 ? `${shortConv4}-${shortId4 || shortId}` : (shortId || 'media');
        const accSuffix = fctxPre.account ? `~${typeof mossadSafeNamePart === 'function' ? mossadSafeNamePart(fctxPre.account) : fctxPre.account}` : '';
        let defaultBase = `${defaultPrefix}-grok${accSuffix}`;
        if (isDup) {
            defaultBase = (typeof formatDblMark === 'function')
                ? formatDblMark(defaultBase, dblSuffix, rootBase, dupNum, config.dblPosition || 'end')
                : `${defaultBase}${dblSuffix}`;
        }
        let grokFilename = `${defaultBase}.${ext2}`;

        if (config.filenameTemplateEnabled) {
            // v1.3.53: общий словарь тегов (buildFilenameVars) — тот же, что в окне «?»
            const vars = buildFilenameVars(Object.assign(grokFilenameContext(media), { dblSuffix, rootBase, siteCount, dupNum }));
            grokFilename = renderFilenameTemplate(config.filenameTemplate, vars, isDup, dblSuffix, ext2);
        }

        let postActionTriggered = false;
        // v1.3.85: для действия +1 переходим на следующий элемент сразу при старте скачивания,
        // не дожидаясь окончания загрузки файла и записи метаданных.
        // Действие 'del' (удаление) по-прежнему выполняется только после полного сохранения файла на диск.
        const triggerImmediatePostAction = () => {
            if (postActionTriggered) return;
            const act = mossadPdAction();
            if (act === 'upns' || act === 'always') {
                postActionTriggered = true;
                performPostDownloadAction();
            }
        };

        const onDownloadFinalized = () => {
            if (!postActionTriggered) {
                postActionTriggered = true;
                performPostDownloadAction();
            }
            if (onDoneCallback) onDoneCallback();
        };

        if (media && media.url) {
            showToast(`⏳ Загрузка: ${grokFilename}...`);
            try { mossadBeep('start'); } catch (e) {} // v1.3.82
            const isBlobUrl = media.url.startsWith('blob:');

            const handleBlobResponse = async (rawBlob) => {
                try {
                    showToast('⏳ Запись метаданных...');
                    const enrichedBlob = await injectGrokMetadataToBlob(rawBlob, prompt, currentPostUrl, model, promptHash);
                    saveBlobToDisk(enrichedBlob, grokFilename, media.url, currentPostUrl, rawBlob);
                    onDownloadFinalized();
                } catch (err) {
                    console.error('[MOSSAD] Metadata injection failed, saving raw blob:', err);
                    saveBlobToDisk(rawBlob, grokFilename, media.url, currentPostUrl, rawBlob);
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
                triggerImmediatePostAction();
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
                triggerImmediatePostAction();
            } else {
                fetch(media.url)
                    .then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.blob();
                    })
                    .then(handleBlobResponse)
                    .catch(finalizeFallback);
                triggerImmediatePostAction();
            }
            return true;
        }

        // Если медиа-URL не найден — стандартный клик кнопки
        try { mossadBeep('start'); } catch (e) {} // v1.3.82
        fallbackGrokNativeClick(onDownloadFinalized);
        triggerImmediatePostAction();
        return true;
    }


    // Автоматический перехват отправки промпта в Grok в Universal Prompt Vault
    if (rootDomain === 'grok.com' && typeof document !== 'undefined') {
        document.addEventListener('keydown', function handleGrokPromptSubmit(e) {
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
