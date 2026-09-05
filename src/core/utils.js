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



