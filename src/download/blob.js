    // ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function triggerDirectBlobDownload(url, filename, onErrorCallback, postUrl = null, onSuccess = null) {
        // v1.4.19: blob: URL (Telegram Web, Gradio, Hls) читаются напрямую через fetchBlobFallback без падений GM_download
        if (url && typeof url === 'string' && url.startsWith('blob:')) {
            fetchBlobFallback(url, filename, postUrl, onSuccess);
            return;
        }

        // v1.3.52: onSuccess — файл сохранён (для слайдшоу «скачать и листать»: не ждать страховочные 8 с)
        // 1. Предпочитаем GM_download (без CORS-проблем, скачивает напрямую в Загрузки)
        if (typeof GM_download === 'function') {
            try {
                const subfolder = (typeof mossadGetSiteSubfolder === 'function' ? mossadGetSiteSubfolder() : '') || (config && config.subfolder) || '';
                const finalName = subfolder ? (subfolder.replace(/^\/+|\/+$/g, '') + '/' + filename) : filename;
                showToast(`⏳ Скачивание: ${finalName}...`);
                GM_download({
                    url: url,
                    name: finalName,
                    saveAs: false,
                    onload: () => {
                        const siteCount = (typeof mossadGetSiteDlCount === 'function') ? mossadGetSiteDlCount() : 0;
                        showToast(siteCount ? `✅ Сохранено! [№${siteCount} на ${rootDomain}]` : '✅ Сохранено!');
                        if (onSuccess) { try { onSuccess(); } catch (e) {} }
                        const doSave = (hashVal = '') => {
                            saveFileToHistory({
                                hash: hashVal,
                                filename,
                                rootFilename: extractRootFilename(filename),
                                url: url || location.href,
                                postUrl: postUrl || location.href,
                                domain: rootDomain
                            });
                            if (typeof mossadRecordSiteDownload === 'function') mossadRecordSiteDownload(rootDomain);
                        };
                        if (typeof resolveMediaHash === 'function') {
                            resolveMediaHash(url).then(h => doSave(h || '')).catch(() => doSave(''));
                        } else {
                            doSave('');
                        }
                    },
                    onerror: (err) => {
                        console.warn('[MOSSAD] GM_download failed, trying fallback:', err);
                        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl, onSuccess);
                    }
                });
                return;
            } catch(e) {
                console.warn('[MOSSAD] GM_download call exception:', e);
            }
        }
        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl, onSuccess);
    }

    function _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl = null, onSuccess = null) {
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                onprogress: (p) => {
                    if (p.total > 0) {
                        const pct = Math.round((p.loaded / p.total) * 100);
                        showToast(`⏳ Скачивание: ${pct}%`);
                    }
                },
                onload: (res) => {
                    if (res.status === 200 && res.response) {
                        saveBlobToDisk(res.response, filename, url, postUrl);
                        if (onSuccess) { try { onSuccess(); } catch (e) {} }
                    } else {
                        if (onErrorCallback) onErrorCallback();
                        else fetchBlobFallback(url, filename, postUrl);
                    }
                },
                onerror: () => {
                    if (onErrorCallback) onErrorCallback();
                    else fetchBlobFallback(url, filename, postUrl);
                }
            });
        } else {
            if (onErrorCallback) onErrorCallback();
            else fetchBlobFallback(url, filename, postUrl);
        }
    }

    function downloadBlobMedia(url, filename, postUrl = null) {
        triggerDirectBlobDownload(url, filename, null, postUrl);
    }

    function fetchBlobFallback(url, filename, postUrl = null, onSuccess = null) {
        fetch(url).then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        }).then(blob => {
            saveBlobToDisk(blob, filename, url, postUrl);
            if (onSuccess) { try { onSuccess(); } catch (e) {} }
        })
        .catch(err => {
            console.warn('[MOSSAD] fetch blob failed, using <a> download:', err);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_self';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 1000);
            showToast('📥 Скачивание запущено через браузер');
            if (onSuccess) { try { onSuccess(); } catch (e) {} }
        });
    }

    function saveBlobToDisk(blob, filename, directUrl = null, postUrl = null) {
        const activeDom = (typeof canonicalDomain !== 'undefined' ? canonicalDomain : rootDomain);
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            // v1.4.34: Унификация Fast-Hash среза до 64 КБ (65536 байт) для 100% совпадения с resolveMediaHash
            const sliceBlob = blob.slice(0, 65536);
            computeSHA256(sliceBlob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: extractRootFilename(filename),
                    url: directUrl || location.href,
                    postUrl: postUrl || location.href,
                    size: blob.size,
                    domain: activeDom
                });
                if (typeof mossadRecordSiteDownload === 'function') mossadRecordSiteDownload(activeDom);
            });
        }
        const subfolder = (typeof mossadGetSiteSubfolder === 'function' ? mossadGetSiteSubfolder() : '') || (config && config.subfolder) || '';
        const finalName = subfolder ? (subfolder.replace(/^\/+|\/+$/g, '') + '/' + filename) : filename;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = finalName;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        const siteCount = (typeof mossadGetSiteDlCount === 'function') ? mossadGetSiteDlCount() : 0;
        showToast(siteCount ? `✅ Сохранено! [№${siteCount} на ${activeDom}]` : '✅ Сохранено!');
    }

