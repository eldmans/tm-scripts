    // ============================================
    // TOAST NOTIFICATIONS
    // ============================================
    function showToast(message, isError = false) {
        let toast = document.getElementById('mossad-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'mossad-toast';
            toast.style.cssText = `
                position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 9999999;
                padding: 10px 18px; background: rgba(20, 20, 20, 0.92); backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 10px; color: #ffffff;
                font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none;
                transition: opacity 0.2s ease; opacity: 0;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.borderColor = isError ? '#ef4444' : '#10b981';
        toast.style.color = isError ? '#fca5a5' : '#6ee7b7';
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 3500);
    }

    // ============================================
    // GENERAL HELPERS & RETRY ENGINE
    // ============================================

    /**
     * Снимает фокус с активного поля ввода, если он там остался.
     */
    function blurActiveInput() {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
            try { activeEl.blur(); } catch (e) {}
        }
    }

    /**
     * Полный программный клик по элементу с эмуляцией pointer/mouse событий.
     */
    function triggerClick(el, label = '') {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
            try {
                el.dispatchEvent(new MouseEvent(evtType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                }));
            } catch (e) {}
        });
        if (typeof el.click === 'function') {
            try { el.click(); } catch(e) {}
        }
        if (label) {
            console.log(`%c[MOSSAD] Clicked "${label}"`, 'color:#10b981;', el);
        }
    }

    /**
     * Выполняет действие с серией попыток (по умолчанию через 100, 300, 500 мс).
     * Если fn возвращает truthy значение (например, true или найденный элемент) — цепочка немедленно прерывается.
     * @param {(attempt: number) => any} fn Функция-попытка.
     * @param {number[]} delays Задержки в миллисекундах от старта.
     * @returns {() => void} Функция принудительной отмены оставшихся попыток.
     */
    function retryAction(fn, delays = [100, 300, 500]) {
        let stopped = false;
        const timeouts = [];
        delays.forEach((delay, idx) => {
            const tid = setTimeout(() => {
                if (stopped) return;
                try {
                    const res = fn(idx + 1);
                    if (res) {
                        stopped = true;
                        timeouts.forEach(t => clearTimeout(t));
                    }
                } catch (e) {
                    console.error('[MOSSAD] retryAction error:', e);
                }
            }, delay);
            timeouts.push(tid);
        });
        return () => {
            stopped = true;
            timeouts.forEach(t => clearTimeout(t));
        };
    }

    /**
     * Выполняет пост-действие после фактического скачивания (+1 или del).
     * Срабатывает ТОЛЬКО когда скачивание реально началось, а не при блокировке дубликата.
     */
    function performPostDownloadAction() {
        if (!config || config.pdAction === 'none') return;
        if (config.pdAction === 'up') {
            setTimeout(() => {
                const dirs = config.slideshowDirections;
                const key = getArrowKey(dirs && dirs.length ? dirs[0] : 'up');
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                if (typeof triggerUniversalFullScreen === 'function') {
                    triggerUniversalFullScreen();
                }
            }, 600);
        } else if (config.pdAction === 'del' && rootDomain === 'grok.com') {
            setTimeout(() => {
                if (typeof runSmartDelete === 'function') {
                    runSmartDelete();
                }
            }, 1000);
        }
    }

    /**
     * Преобразует строковое направление в имя клавиши KeyboardEvent
     */
    function getArrowKey(dir) {
        if (dir === 'up') return 'ArrowUp';
        if (dir === 'down') return 'ArrowDown';
        if (dir === 'left') return 'ArrowLeft';
        return 'ArrowRight';
    }

    /**
     * Извлекает чистое первоначальное (искомое) имя файла из истории или дубликата.
     * Срезает любые уровни вложенных "(...) DBL", чтобы все дубли всегда ссылались
     * на один общий исходный файл, а не порождали матрёшку из имен.
     */
    function extractRootFilename(rawName) {
        if (!rawName || typeof rawName !== 'string') return 'original';
        let name = rawName.replace(/\.[^/.]+$/, '').trim();
        if (!name) return 'original';

        if (name.includes('(')) {
            // Разворачиваем вложенные DBL-матрёшки
            while (/\bDBL\b/i.test(name)) {
                const m = name.match(/\(([^()]+)\)\s*DBL/i);
                if (m && m[1]) {
                    name = m[1].trim();
                } else {
                    name = name.replace(/\s*[-_]?\s*DBL\b/gi, '').trim();
                    break;
                }
            }

            if (name.includes('(')) {
                const parts = name.split('(').map(p => p.replace(/[()]/g, '').trim()).filter(Boolean);
                if (parts.length > 1) {
                    name = parts[1];
                } else if (parts.length === 1) {
                    name = parts[0];
                }
            }
        }

        name = name.replace(/\s*[-_]?\s*DBL\b/gi, '').trim();
        name = name.replace(/^[()]+|[()]+$/g, '').trim();
        name = name.replace(/[\s_-]+$/, '').trim();

        // Ограничиваем длину исходного имени максимум 50 символов
        if (name.length > 50) {
            name = name.slice(0, 50).trim() + '…';
        }

        return name || 'original';
    }
    window.extractRootFilename = extractRootFilename;

    /**
     * Флаг выполнения перемотки ленты
     */
    let _isRewinding = false;
    window._isRewinding = false;

    /**
     * Мотает ленту в противоположную сторону от выбранного DPad направления до самого начала/конца.
     * По завершении (когда URL перестает меняться 5 раз подряд) вызывает onComplete callback.
     */
    function doRewind(onComplete) {
        if (_isRewinding) return;
        _isRewinding = true;
        window._isRewinding = true;

        let oppDir = 'down';
        const d0 = (config.slideshowDirections || ['up'])[0];
        if (d0 === 'up') oppDir = 'down';
        else if (d0 === 'down') oppDir = 'up';
        else if (d0 === 'left') oppDir = 'right';
        else if (d0 === 'right') oppDir = 'left';
        const key = getArrowKey(oppDir);

        showToast('↺ Перемотка на начало ленты...');
        let lastUrl = location.href;
        let unchangedCount = 0;

        const interval = setInterval(() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
            document.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));

            setTimeout(() => {
                if (location.href === lastUrl) {
                    unchangedCount++;
                    if (unchangedCount >= 5) {
                        clearInterval(interval);
                        _isRewinding = false;
                        window._isRewinding = false;
                        showToast('🏁 Достигнуто начало ленты');
                        if (typeof onComplete === 'function') {
                            setTimeout(onComplete, 400);
                        }
                    }
                } else {
                    lastUrl = location.href;
                    unchangedCount = 0;
                }
            }, 60);
        }, 120);
    }
    window.doRewind = doRewind;

    /**
     * Возвращает дефолтный шаблон имени файла для текущего сайта (отображается серым плейсхолдером)
     */
    function getDefaultFilenameTemplate() {
        if (typeof rootDomain !== 'undefined' && rootDomain.includes('redgifs.com')) {
            return '{userName}-{domain[4]}';
        }
        if (typeof rootDomain !== 'undefined' && rootDomain === 'grok.com') {
            return '{conv4}-{id4}-{domain}.{ext}';
        }
        return '{id8}-{domain}.{ext}';
    }
    window.getDefaultFilenameTemplate = getDefaultFilenameTemplate;

    /**
     * Форматирует имя файла по шаблону и словарю переменных.
     * Поддерживает:
     * - {varN} (например {conv4}, {id4}, {id8}, {conv8})
     * - {var[N]} (например {domain[4]}, {id[8]})
     * - {var} (полное значение без обрезки)
     * - авто-очистку висячих разделителей при пустых переменных
     * - подстановку суффикса дубликата {dbl}
     */
    function renderFilenameTemplate(rawTpl, vars, isDup = false, dblSuffix = '', defaultExt = 'mp4') {
        const tplStr = (rawTpl && rawTpl.trim())
            ? rawTpl.trim()
            : (typeof getDefaultFilenameTemplate === 'function' ? getDefaultFilenameTemplate() : '{id8}-{domain}.{ext}');

        const hasDblVar = /\{dbl\}/i.test(tplStr);

        const aliasMap = {
            conversation: 'conv',
            uuid: 'id',
            hash: 'id',
            postid: 'id',
            user: 'username',
            author: 'username',
            copy: 'oldname',
            root: 'oldname'
        };

        let filename = tplStr.replace(
            /\{([a-zA-Z]+)(\d+)?(?:\[(\d+)\])?\}/g,
            (_, name, inlineLen, bracketLen) => {
                const rawName = name.toLowerCase();
                const key = aliasMap[rawName] || rawName;
                const len = parseInt(bracketLen || inlineLen || '0', 10);
                if (key in vars) {
                    const val = vars[key] != null ? String(vars[key]) : '';
                    return len > 0 ? val.slice(0, len) : val;
                }
                if (rawName in vars) {
                    const val = vars[rawName] != null ? String(vars[rawName]) : '';
                    return len > 0 ? val.slice(0, len) : val;
                }
                return '';
            }
        ).replace(/[\\/:*?"<>|]/g, '_');

        // Очистка возможных двойных или висячих дефисов/подчеркиваний (например, если conv пустой)
        filename = filename
            .replace(/-{2,}/g, '-')
            .replace(/_{2,}/g, '_')
            .replace(/^[-_\s]+/, '')
            .replace(/[-_\s]+(?=\.[a-zA-Z0-9]+$)/, '');

        const ext = vars.ext || defaultExt;
        if (!filename.includes('.')) {
            filename += `.${ext}`;
        }

        if (isDup && !hasDblVar && dblSuffix) {
            const lastDot = filename.lastIndexOf('.');
            const base = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
            const extPart = lastDot !== -1 ? filename.slice(lastDot) : `.${ext}`;
            filename = `${base}${dblSuffix}${extPart}`;
        }

        return filename;
    }
    window.renderFilenameTemplate = renderFilenameTemplate;

    /**
     * Асинхронно отправляет промпт в локальный Universal Prompt Vault (http://127.0.0.1:5999).
     * Работает в фоне без блокировки интерфейса и без назойливых ошибок при выключенном сервере.
     */
    function sendPromptToVault(prompt, model = '', source = '', url = '') {
        if (!prompt || !prompt.trim()) return;
        const payload = JSON.stringify({
            prompt: prompt.trim(),
            model: model || '',
            source: source || location.hostname,
            url: url || location.href
        });

        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'http://127.0.0.1:5999/api/save_prompt',
                    headers: { 'Content-Type': 'application/json' },
                    data: payload,
                    timeout: 3000,
                    onload: () => {},
                    onerror: () => {}
                });
            } else if (typeof fetch === 'function') {
                fetch('http://127.0.0.1:5999/api/save_prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload,
                    mode: 'cors'
                }).catch(() => {});
            }
        } catch (e) {}
    }
    window.sendPromptToVault = sendPromptToVault;

