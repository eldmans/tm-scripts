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

    // {account}: e-mail вошедшего аккаунта Grok. Источник — GET /rest/user (тот же сайт, куки сессии), один раз за
    // сессию вкладки и только если шаблон использует {account}/{email}; результат — в localStorage grok.com (у
    // каждого контейнера свой аккаунт, поэтому НЕ в общем GM). Запасной путь — e-mail в aria-label/title/alt страницы.
    const GROK_ACCOUNT_LS_KEY = 'mossad_grok_account';
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
        const el = document.querySelector('[aria-label*="@"], [title*="@"], img[alt*="@"]');
        if (!el) return '';
        const m = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')].join(' ').match(_emailRe);
        return m ? m[0] : '';
    }
    /** Синхронно: известный e-mail аккаунта Grok или ''. */
    function grokAccountEmail() {
        if (rootDomain !== 'grok.com') return '';
        let v = '';
        try { v = localStorage.getItem(GROK_ACCOUNT_LS_KEY) || ''; } catch (e) {}
        if (!v) {
            v = grokAccountFromDom();
            if (v) { try { localStorage.setItem(GROK_ACCOUNT_LS_KEY, v); } catch (e) {} }
        }
        return v;
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
                if (email) { try { localStorage.setItem(GROK_ACCOUNT_LS_KEY, email); } catch (e) {} }
                return email || grokAccountEmail();
            })
            .catch(() => grokAccountEmail());
    }
    window.grokRefreshAccount = grokRefreshAccount;
    // Лёгкий префетч: только если действующий шаблон использует {account}/{email}, через 4 с после загрузки
    if (rootDomain === 'grok.com') {
        setTimeout(() => {
            const tpl = (config.filenameTemplate && config.filenameTemplate.trim()) || getDefaultFilenameTemplate();
            if (config.filenameTemplateEnabled && /\{(account|email)/i.test(tpl)) grokRefreshAccount(false);
        }, 4000);
    }

    /** Контекст для buildFilenameVars на посте Grok (без пометки дубликата). */
    function grokFilenameContext(media) {
        const postId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';
        const hasVid = media ? (media.type === 'video') : (getActiveVideo() !== null);
        let prompt = '';
        try { prompt = getGrokCurrentPrompt() || ''; } catch (e) {}
        return {
            postId,
            convId: grokCurrentConvId(postId),
            type: hasVid ? 'video' : 'photo',
            ext: media ? media.ext : (hasVid ? 'mp4' : 'jpg'),
            authorName: 'grok',
            title: 'Imagine - Grok',
            desc: prompt,
            account: grokAccountEmail(),
        };
    }

    function triggerGrokDownload(bypassDuplicateCheck = false, duplicateRecord = null, onDoneCallback = null) {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return false;
        blurActiveInput();

        const currentPostUrl = location.href;
        const currentPostId = (location.pathname.match(/\/imagine\/post\/([^/?#]+)/) || [])[1] || '';
        const currentConvId = grokCurrentConvId(currentPostId);

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
            // v1.3.53: общий словарь тегов (buildFilenameVars) — тот же, что в окне «?»
            const vars = buildFilenameVars(Object.assign(grokFilenameContext(media), { dblSuffix, rootBase }));
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
