    // ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function triggerDirectBlobDownload(url, filename, onErrorCallback) {
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
                        if (typeof saveFileToHistory === 'function') {
                            saveFileToHistory({
                                hash: '',
                                filename,
                                rootFilename: (typeof extractRootFilename === 'function') ? extractRootFilename(filename) : '',
                                url: location.href,
                                postUrl: location.href,
                                domain: rootDomain
                            });
                        }
                    },
                    onerror: (err) => {
                        console.warn('[MOSSAD] GM_download failed, trying fallback:', err);
                        _downloadViaXhrOrFetch(url, filename, onErrorCallback);
                    }
                });
                return;
            } catch(e) {
                console.warn('[MOSSAD] GM_download call exception:', e);
            }
        }
        _downloadViaXhrOrFetch(url, filename, onErrorCallback);
    }

    function _downloadViaXhrOrFetch(url, filename, onErrorCallback) {
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
                        saveBlobToDisk(res.response, filename);
                    } else {
                        if (onErrorCallback) onErrorCallback();
                        else fetchBlobFallback(url, filename);
                    }
                },
                onerror: () => {
                    if (onErrorCallback) onErrorCallback();
                    else fetchBlobFallback(url, filename);
                }
            });
        } else {
            if (onErrorCallback) onErrorCallback();
            else fetchBlobFallback(url, filename);
        }
    }

    function downloadBlobMedia(url, filename) {
        triggerDirectBlobDownload(url, filename);
    }

    function fetchAndDownloadBlob(url, filename) {
        triggerDirectBlobDownload(url, filename);
    }

    function fetchBlobFallback(url, filename) {
        fetch(url).then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.blob();
        }).then(blob => saveBlobToDisk(blob, filename))
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

    function saveBlobToDisk(blob, filename) {
        if (typeof computeSHA256 === 'function' && typeof saveFileToHistory === 'function') {
            computeSHA256(blob).then(hash => {
                saveFileToHistory({
                    hash,
                    filename,
                    rootFilename: (typeof extractRootFilename === 'function') ? extractRootFilename(filename) : '',
                    url: location.href,
                    postUrl: location.href,
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

