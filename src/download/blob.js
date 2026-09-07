    // ============================================
    // PINTEREST / DOWNLOAD ENGINE
    // ============================================
    function triggerDirectBlobDownload(url, filename, onErrorCallback) {
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                headers: {
                    'Referer': location.origin + '/',
                    'Origin': location.origin
                },
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
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'GET', url: url, responseType: 'blob',
                onload: function (response) {
                    if (response.status === 200 && response.response) {
                        saveBlobToDisk(response.response, filename);
                    } else { fetchBlobFallback(url, filename); }
                },
                onerror: function () { fetchBlobFallback(url, filename); }
            });
        } else { fetchBlobFallback(url, filename); }
    }

