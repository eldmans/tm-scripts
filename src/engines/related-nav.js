    // ============================================
    // RELATED MEDIA NAVIGATION & LIVE PREVIEW ENGINE
    // ============================================
    // v1.4.14: Универсальная навигация по блоку похожих/рекомендованных карточек
    // (Faphouse, xHamster, xVideos, NoodleMagazine, Pinterest и др.).
    // Поддерживает 2 пресета:
    //  1. 'cycle' («Листание 1-4»): 1 - первый, 4 - последний, 2 - назад, 3 - вперёд.
    //  2. 'digits' («Десятки»): 1..10, Shift+1..10 = 11..20, Alt+1..10 = 21..30.
    //  + Стрелки ← → ↑ ↓ для перемещения с живым предпросмотром (видео без звука).
    //  + Enter/Пробел — открыть, Ctrl+Enter — открыть в новой вкладке.
    // ============================================
    window.MOSSAD_ENGINES = window.MOSSAD_ENGINES || {};
    window.MOSSAD_ENGINES.related = (() => {
        let _currentIndex = -1;
        let _activeHoverVideo = null;
        let _hudTimer = null;

        /**
         * Получение списка всех карточек похожих медиа на текущей странице
         */
        function getCandidateItems() {
            // 1. Pinterest — делегируем к getPinterestCandidatePins()
            if (rootDomain.includes('pinterest.') && typeof getPinterestCandidatePins === 'function') {
                const pins = getPinterestCandidatePins();
                return pins.map((p, idx) => ({
                    element: (p.element && p.element.closest && p.element.closest('[data-grid-item]')) || p.element,
                    link: (p.element && p.element.querySelector && p.element.querySelector('a[href*="/pin/"]')) || p.element,
                    url: p.url,
                    title: p.title || `Пин #${idx + 1}`,
                    type: p.type || 'image',
                    video: p.element && p.element.querySelector ? p.element.querySelector('video') : null
                })).filter(x => x.element);
            }

            // 2. xVideos / XV-RU / XNXX
            if (/(?:xvideos|xnxx|xv-ru)/i.test(rootDomain)) {
                const cards = Array.from(document.querySelectorAll('#related-videos .thumb-block, .related-videos .thumb-block, .video-related .thumb-block, .thumb-block'));
                if (cards.length) {
                    return cards.map((el, idx) => {
                        const a = el.querySelector('a[href*="/video"]') || el.querySelector('a');
                        const v = el.querySelector('video');
                        const t = (el.querySelector('.title, p a, .video-title') || {}).textContent || `Видео #${idx + 1}`;
                        return { element: el, link: a, url: a ? a.href : '', title: t.trim(), type: 'video', video: v };
                    }).filter(x => x.link);
                }
            }

            // 3. xHamster
            if (/(?:xhamster|xh\d*)/i.test(rootDomain)) {
                const cards = Array.from(document.querySelectorAll('.video-thumb, [data-qa="video-thumb"], .thumb-list__item, .role-popover-root'));
                if (cards.length) {
                    return cards.map((el, idx) => {
                        const a = el.querySelector('a[href*="/videos/"]') || el.querySelector('a');
                        const v = el.querySelector('video');
                        const t = (el.querySelector('.video-thumb__title, [data-qa="video-thumb-title"]') || {}).textContent || `Видео #${idx + 1}`;
                        return { element: el, link: a, url: a ? a.href : '', title: t.trim(), type: 'video', video: v };
                    }).filter(x => x.link);
                }
            }

            // 4. Faphouse
            if (/faphouse/i.test(rootDomain)) {
                const cards = Array.from(document.querySelectorAll('.video-preview, .thumb, .item, a[href*="/videos/"]')).map(el => {
                    const card = el.closest('.video-preview, .thumb, .item') || el;
                    return card;
                });
                const uniqCards = Array.from(new Set(cards));
                if (uniqCards.length) {
                    return uniqCards.map((el, idx) => {
                        const a = el.tagName === 'A' ? el : el.querySelector('a[href*="/videos/"]') || el.querySelector('a');
                        const v = el.querySelector('video');
                        const t = (el.querySelector('.title, h3, .video-title') || {}).textContent || `Видео #${idx + 1}`;
                        return { element: el, link: a, url: a ? a.href : '', title: t.trim(), type: 'video', video: v };
                    }).filter(x => x.link);
                }
            }

            // 5. NoodleMagazine
            if (/noodlemagazine/i.test(rootDomain)) {
                const cards = Array.from(document.querySelectorAll('.c_video .item, .related .item, .video_item, a[href*="/video/"]'));
                const uniq = Array.from(new Set(cards));
                if (uniq.length) {
                    return uniq.map((el, idx) => {
                        const a = el.tagName === 'A' ? el : el.querySelector('a[href*="/video/"]') || el.querySelector('a');
                        const v = el.querySelector('video');
                        const t = (el.querySelector('.title, .item_title') || {}).textContent || `Видео #${idx + 1}`;
                        return { element: el, link: a, url: a ? a.href : '', title: t.trim(), type: 'video', video: v };
                    }).filter(x => x.link);
                }
            }

            // 6. Универсальный fallback: ищем любые блоки со ссылками на видео
            const generic = Array.from(document.querySelectorAll('[data-grid-item], .video-card, .media-card, .thumbnail'));
            if (generic.length) {
                return generic.map((el, idx) => {
                    const a = el.querySelector('a') || el;
                    const v = el.querySelector('video');
                    return { element: el, link: a, url: a ? a.href : '', title: (el.textContent || '').slice(0, 40).trim() || `#${idx + 1}`, type: 'video', video: v };
                }).filter(x => x.link);
            }

            return [];
        }

        /**
         * Подсветка и фокус на карточке по индексу с предвоспроизведением
         */
        function focusItem(index, doOpen = false, inBackground = false) {
            const items = getCandidateItems();
            if (!items.length) {
                showToast('⚠️ Похожие медиа не найдены на странице', true);
                return false;
            }

            const clamped = Math.max(0, Math.min(items.length - 1, index));
            _currentIndex = clamped;
            const item = items[clamped];
            const el = item.element || item.link;

            if (doOpen) {
                if (inBackground && typeof GM_openInTab === 'function') {
                    GM_openInTab(item.url, { active: false, insert: true });
                    showToast(`📑 В фоновой вкладке: ${item.title}`);
                } else if (inBackground) {
                    window.open(item.url, '_blank');
                    showToast(`📑 В новой вкладке: ${item.title}`);
                } else {
                    showToast(`➡️ Открываю: ${item.title}`);
                    if (item.link) {
                        try { item.link.click(); } catch (_) { window.location.href = item.url; }
                    } else if (item.url) {
                        window.location.href = item.url;
                    }
                }
                return true;
            }

            // Снимаем подсветку со всех карточек
            document.querySelectorAll('.mossad-related-focused').forEach(c => {
                c.classList.remove('mossad-related-focused');
                c.style.outline = '';
                c.style.boxShadow = '';
            });

            // Останавливаем предыдущее активное видео-превью
            if (_activeHoverVideo && _activeHoverVideo !== item.video) {
                try { _activeHoverVideo.pause(); } catch (_) {}
                _activeHoverVideo = null;
            }

            // Подсвечиваем активный элемент
            if (el) {
                el.classList.add('mossad-related-focused');
                el.style.outline = '3px solid #3b82f6';
                el.style.boxShadow = '0 0 16px rgba(59, 130, 246, 0.7)';
                try {
                    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                } catch (_) {}
                try {
                    (item.link || el).focus({ preventScroll: true });
                } catch (_) {}

                // Запуск предвоспроизведения (Live Preview) без звука
                if (item.video) {
                    try {
                        item.video.muted = true;
                        const p = item.video.play();
                        if (p && p.catch) p.catch(() => {});
                        _activeHoverVideo = item.video;
                    } catch (_) {}
                }

                // Всплывающая плашка-HUD
                _showRelatedHud(clamped + 1, items.length, item.title);
            }

            return true;
        }

        function _showRelatedHud(curr, total, title) {
            let hud = document.getElementById('mossad-related-hud');
            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'mossad-related-hud';
                hud.style.cssText = `
                    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
                    background: rgba(17, 24, 39, 0.94); border: 1px solid #3b82f6; border-radius: 8px;
                    padding: 8px 16px; color: #fff; font: 600 13px system-ui, sans-serif;
                    z-index: 2147483646; box-shadow: 0 8px 24px rgba(0,0,0,0.6); pointer-events: none;
                    display: flex; align-items: center; gap: 8px; max-width: 90vw; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis; transition: opacity 0.2s;
                `;
                document.body.appendChild(hud);
            }
            hud.innerHTML = `
                <span style="color:#60a5fa; font-weight:700;">[${curr}/${total}]</span>
                <span style="overflow:hidden; text-overflow:ellipsis; max-width:500px;">${String(title).replace(/</g, '&lt;')}</span>
                <span style="color:#9ca3af; font-size:11px; margin-left:4px;">Enter — перейти · Ctrl+Enter — вкладка</span>
            `;
            hud.style.opacity = '1';
            if (_hudTimer) clearTimeout(_hudTimer);
            _hudTimer = setTimeout(() => {
                if (hud) hud.style.opacity = '0';
            }, 3500);
        }

        /**
         * Обработчик нажатий клавиш для навигации по Related карточкам
         */
        function handleKeyDown(e) {
            // Pinterest обслуживается собственным модулем pinterest-keys.js
            if (rootDomain.includes('pinterest.')) return false;

            // Если фокус в поле ввода — не перехватываем
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
            if (window.capturingFor !== null && window.capturingFor !== undefined) return false;

            const preset = config.relatedNavPreset || 'cycle'; // 'cycle' | 'digits'
            const items = getCandidateItems();
            if (!items.length) return false;

            // 1. Enter и Пробел при активном фокусе на карточке
            if (_currentIndex >= 0 && _currentIndex < items.length) {
                if (e.key === 'Enter') {
                    e.preventDefault(); e.stopPropagation();
                    const inBg = !!e.ctrlKey || !!e.metaKey;
                    focusItem(_currentIndex, true, inBg);
                    return true;
                }
            }

            // 2. Стрелки ← → ↑ ↓ для перемещения фокуса
            if (config.relatedNavArrows !== false && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    // Если фокус на карточке или если нажат Shift/Alt
                    if (_currentIndex >= 0 || e.shiftKey) {
                        e.preventDefault(); e.stopPropagation();
                        const nextIdx = _currentIndex < 0 ? 0 : Math.min(items.length - 1, _currentIndex + 1);
                        focusItem(nextIdx);
                        return true;
                    }
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    if (_currentIndex > 0) {
                        e.preventDefault(); e.stopPropagation();
                        focusItem(_currentIndex - 1);
                        return true;
                    }
                }
            }

            // 3. Пресет 'cycle': 1 - первый, 4 - последний, 2 - назад, 3 - вперёд
            if (preset === 'cycle' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (e.code === 'Digit1' || e.key === '1') {
                    e.preventDefault(); e.stopPropagation();
                    focusItem(0);
                    return true;
                }
                if (e.code === 'Digit4' || e.key === '4') {
                    e.preventDefault(); e.stopPropagation();
                    focusItem(items.length - 1);
                    return true;
                }
                if (e.code === 'Digit2' || e.key === '2') {
                    e.preventDefault(); e.stopPropagation();
                    const prev = _currentIndex <= 0 ? items.length - 1 : _currentIndex - 1;
                    focusItem(prev);
                    return true;
                }
                if (e.code === 'Digit3' || e.key === '3') {
                    e.preventDefault(); e.stopPropagation();
                    const next = _currentIndex >= items.length - 1 ? 0 : _currentIndex + 1;
                    focusItem(next);
                    return true;
                }
            }

            // 4. Пресет 'digits': 1..10 (+ Shift для 11..20, + Alt для 21..30)
            if (preset === 'digits' && !e.ctrlKey && !e.metaKey) {
                const digitCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
                const dIdx = digitCodes.indexOf(e.code);
                if (dIdx >= 0) {
                    e.preventDefault(); e.stopPropagation();
                    let target = dIdx; // 0..9 (элементы 1..10)
                    if (e.shiftKey) target += 10; // 10..19 (элементы 11..20)
                    else if (e.altKey) target += 20; // 20..29 (элементы 21..30)
                    focusItem(target);
                    return true;
                }
            }

            return false;
        }

        // Слушатель keydown в capture-фазе
        function init() {
            window.addEventListener('keydown', handleKeyDown, true);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        return {
            getCandidateItems,
            focusItem,
            handleKeyDown
        };
    })();
