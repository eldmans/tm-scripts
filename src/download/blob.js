    // ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function triggerDirectBlobDownload(url, filename, onErrorCallback, postUrl = null) {
        // 1. Предпочитаем GM_download (без CORS-проблем, скачивает напрямую в Загрузки)
        if (typeof GM_download === 'function') {
            try {
                showToast(`⏳ Скачивание: ${filename}...`);
                GM_download({
                    url: url,
                    name: filename,
                    saveAs: false,
                    onload: () => {
                        showToast('✅ Сохранено!');
                        saveFileToHistory({
                            hash: '',
                            filename,
                            rootFilename: extractRootFilename(filename),
                            url: url || location.href,
                            postUrl: postUrl || location.href,
                            domain: rootDomain
                        });
                    },
                    onerror: (err) => {
                        console.warn('[MOSSAD] GM_download failed, trying fallback:', err);
                        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl);
                    }
                });
                return;
            } catch(e) {
                console.warn('[MOSSAD] GM_download call exception:', e);
            }
        }
        _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl);
    }

    function _downloadViaXhrOrFetch(url, filename, onErrorCallback, postUrl = null) {
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

    function fetchAndDownloadBlob(url, filename, postUrl = null) {
        triggerDirectBlobDownload(url, filename, null, postUrl);
    }

    function fetchBlobFallback(url, filename, postUrl = null) {
        fetch(url).then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        }).then(blob => saveBlobToDisk(blob, filename, url, postUrl))
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
        });
    }

    function saveBlobToDisk(blob, filename, directUrl = null, postUrl = null) {
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            computeSHA256(blob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: extractRootFilename(filename),
                    url: directUrl || location.href,
                    postUrl: postUrl || location.href,
                    size: blob.size,
                    domain: rootDomain
                });
            });
        }
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);
        showToast('✅ Сохранено!');
    }

