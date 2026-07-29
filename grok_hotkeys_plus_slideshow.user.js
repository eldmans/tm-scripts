// ==UserScript==
// @name         Grok Hotkeys + Slideshow
// @namespace    http://tampermonkey.net/
// @version      5.7
// @description  Полный набор горячих клавиш + автолистание слайдов + Lag Monitor + Help/Settings (F1) + Play/Pause (Pause) + ScrollLock (звук). Клавиши можно переназначить через F1.
// @author       Grok + eldmans
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @match        *://civitai.red/*
// @match        *://*.civitai.red/*
// @match        *://vkvideo.ru/*
// @match        *://*.vkvideo.ru/*
// @match        *://vk.video/*
// @match        *://*.vk.video/*
// @grant        GM_openInTab
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok_hotkeys_plus_slideshow.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok_hotkeys_plus_slideshow.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    console.log('%c[Grok Hotkeys + Slideshow v5.7] Скрипт загружен', 'color:#10b981; font-weight:bold');

    function checkIsPostPage() {
        const host = location.hostname.toLowerCase();
        if (host.includes('civitai.red') || host.includes('vkvideo.ru') || host.includes('vk.video') || host.includes('vk.com')) {
            return true; // На этих сайтах разрешаем запуск слайдшоу со страницы просмотра медиа
        }
        return location.pathname.includes('/imagine/post/');
    }

    // ============================================
    // КОНФИГУРАЦИЯ ГОРЯЧИХ КЛАВИШ
    // ============================================

    const STORAGE_KEY = 'grok_hotkeys_config';

    // Описание всех действий с клавишами по умолчанию.
    // onlyF1F4: true — для этого действия допустимы только F1-F4 без модификаторов.
    // postOnly: true  — действие отображается и работает только на страницах поста.
    const ACTIONS = {
        download:       { label: 'Скачать',                                         defaultKey: { key: 'PageDown',   ctrl: false, alt: false, shift: false } },
        upscale:        { label: 'Улучшить качество',                              defaultKey: { key: 'PageUp',     ctrl: false, alt: false, shift: false } },
        deleteVid:      { label: 'Удалить видео',                                   defaultKey: { key: 'Delete',     ctrl: false, alt: false, shift: false } },
        sound:          { label: 'Вкл/Выкл звук',                                  defaultKey: { key: 'ScrollLock', ctrl: false, alt: false, shift: false } },
        playPause:      { label: 'Play / Pause видео',                             defaultKey: { key: 'Pause',      ctrl: false, alt: false, shift: false } },
        help:           { label: 'Справка / Настройки',                            defaultKey: { key: 'F1',         ctrl: false, alt: false, shift: false }, onlyF1F4: true },
        lagMonitor:     { label: 'Lag Monitor (страница поста)',                    defaultKey: { key: 'F8',         ctrl: false, alt: false, shift: false }, postOnly: true },
        history:        { label: 'История сохранённых',                             defaultKey: { key: 'Home',       ctrl: false, alt: false, shift: false } },
        slideshowPanel: { label: 'Виджет: нажать = полоска → настройки → скрыт', defaultKey: { key: 'Insert', ctrl: true, alt: false, shift: false } },
        slideshow:      { label: 'Запуск/остановка слайдшоу',                       defaultKey: { key: 'Insert',     ctrl: false, alt: false, shift: false }, postOnly: true },
        focusWidget:    { label: 'Фокус на панель управления',                          defaultKey: { key: 'F7',         ctrl: false, alt: false, shift: false }, postOnly: true },
    };

    // Загрузка конфига
    let config = {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        config = stored ? JSON.parse(stored) : {};
    } catch (e) {}

    // Заполняем пропущенные записи дефолтами
    for (const [id, action] of Object.entries(ACTIONS)) {
        if (!config[id]) config[id] = { ...action.defaultKey };
    }

    // Миграция v4.4: Delete стал без Ctrl
    if (config.deleteVid && config.deleteVid.ctrl === true && config.deleteVid.key === 'Delete') {
        config.deleteVid = { ...ACTIONS.deleteVid.defaultKey };
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }

    // Синхронизация конфига между вкладками
    window.addEventListener('storage', (ev) => {
        if (ev.key !== STORAGE_KEY || capturingFor !== null) return;
        try { 
            const nc = JSON.parse(ev.newValue); 
            if (nc) {
                Object.assign(config, nc);
                if (widgetState === 'panel' && refreshHotkeyLabels) {
                    refreshHotkeyLabels();
                }
            } 
        } catch {}
    });

    // Форматирует хоткей в читаемую строку: "Ctrl+PageDown"
    function formatHotkey(hk) {
        if (!hk || !hk.key) return '—';
        const parts = [];
        if (hk.ctrl)  parts.push('Ctrl');
        if (hk.alt)   parts.push('Alt');
        if (hk.shift) parts.push('Shift');
        parts.push(hk.key);
        return parts.join('+');
    }

    // Извлекает хоткей-объект из события (возвращает null если нажат только модификатор)
    function hotkeyFromEvent(e) {
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
        return { key: e.key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
    }

    // Проверяет, совпадает ли событие с хоткеем
    function hotkeyMatches(e, hk) {
        if (!hk || !hk.key) return false;
        return e.key === hk.key &&
               !!e.ctrlKey  === !!hk.ctrl &&
               !!e.altKey   === !!hk.alt  &&
               !!e.shiftKey === !!hk.shift;
    }

    // Сравнивает два хоткей-объекта
    function hotkeyEquals(a, b) {
        if (!a || !b || !a.key || !b.key) return false;
        return a.key === b.key &&
               !!a.ctrl  === !!b.ctrl  &&
               !!a.alt   === !!b.alt   &&
               !!a.shift === !!b.shift;
    }

    // Ищет конфликтующее действие (возвращает id или null)
    function findConflict(hk, excludeId) {
        for (const [id, hkCurrent] of Object.entries(config)) {
            if (id === excludeId) continue;
            if (hotkeyEquals(hk, hkCurrent)) return id;
        }
        return null;
    }

    // ============================================
    // ГЛОБАЛЬНЫЙ ОБРАБОТЧИК КЛАВИШ
    // ============================================

    let capturingFor = null; // id действия, для которого ждём нажатие новой клавиши

    document.addEventListener('keydown', function (e) {
        // Обновляем NumLock-индикатор на любом нажатии
        if (numLockEl) {
            const nl = e.getModifierState('NumLock');
            if (numLockState !== nl) { numLockState = nl; numLockEl.textContent = nl ? 'NumPad' : 'Mouse'; }
        }

        if (capturingFor !== null) return; // не выполняем действия во время захвата

        // В текстовых полях разрешаем только F-клавиши — остальное браузеру
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
            activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable
        );
        if (isEditing && !/^F\d+$/.test(e.key)) return;

        if (hotkeyMatches(e, config.download)) {
            e.preventDefault();
            triggerDownloadForCurrentSite();
            if (checkIsPostPage()) {
                if (pdAction === 'up') {
                    const firstUrl = location.href;
                    setTimeout(() => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: slideshowOrientation === 'h' ? 'ArrowRight' : 'ArrowUp', bubbles: true }));
                        if (transRight) checkAndDispatchRight(firstUrl);
                    }, 500);
                } else if (pdAction === 'note') {
                    const firstUrl = location.href;
                    setTimeout(() => {
                        addNotePrefix(true);
                        setTimeout(() => {
                            if (slideshowDirections.length > 0) {
                                const key = getArrowKeyForDirection(slideshowDirections[0]);
                                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                            } else {
                                document.dispatchEvent(new KeyboardEvent('keydown', { key: slideshowOrientation === 'h' ? 'ArrowRight' : 'ArrowUp', bubbles: true }));
                            }
                            if (transRight) checkAndDispatchRight(firstUrl);
                        }, 150);
                    }, 500);
                } else if (pdAction === 'del') {
                    setTimeout(() => runSmartDelete(), 1000);
                }
            }
        }

        if (hotkeyMatches(e, config.noteAction)) {
            e.preventDefault();
            const firstUrl = location.href;
            addNotePrefix(false);
            setTimeout(() => {
                if (slideshowDirections.length > 0) {
                    const key = getArrowKeyForDirection(slideshowDirections[0]);
                    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                } else {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: slideshowOrientation === 'h' ? 'ArrowRight' : 'ArrowUp', bubbles: true }));
                }
                if (transRight) checkAndDispatchRight(firstUrl);
            }, 150);
        }

        if (hotkeyMatches(e, config.upscale)) {
            e.preventDefault();
            triggerClick(findButton(['Upscale', 'Enhance', 'Improve quality', 'Повысить качество']), 'Upscale');
        }

        if (hotkeyMatches(e, config.deleteVid)) {
            e.preventDefault();
            runSmartDelete();
        }

        if (hotkeyMatches(e, config.sound)) {
            e.preventDefault();
            toggleSound();
        }

        if (hotkeyMatches(e, config.playPause)) {
            e.preventDefault();
            togglePlayPause();
        }

        if (hotkeyMatches(e, config.help)) {
            e.preventDefault();
            toggleHelpOverlay();
        }

        if (hotkeyMatches(e, config.lagMonitor) && checkIsPostPage()) {
            e.preventDefault();
            toggleLagMonitor();
        }

        // История: базовая клавиша → перейти, Ctrl + базовая (если Ctrl не часть хоткея) → открыть в новой вкладке
        if (config.history.key && e.key === config.history.key &&
            !!e.altKey === !!config.history.alt && !!e.shiftKey === !!config.history.shift) {
            e.preventDefault();
            const url = 'https://grok.com/imagine/saved';
            if (!config.history.ctrl && e.ctrlKey) window.open(url, '_blank');
            else if (hotkeyMatches(e, config.history)) window.location.href = url;
        }

        if (hotkeyMatches(e, config.slideshowPanel)) {
            e.preventDefault();
            cycleWidgetState();
        }

        if (hotkeyMatches(e, config.slideshow)) {
            e.preventDefault();
            if (slideshowActive || slideshowPaused) { if (slideshowStop) slideshowStop(); }
            else { if (slideshowStart) slideshowStart(); }
        }

        if (hotkeyMatches(e, config.focusWidget)) {
            e.preventDefault();
            if (widgetState !== 'panel') setWidgetState('panel');
            setTimeout(() => panelEl?.querySelector('button, input[type="radio"], input[type="checkbox"]')?.focus(), 50);
        }

    }, true);

    // ============================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ============================================

    function runSmartDelete(callback) {
        const delPubBtn = findButton(['Delete post', 'Удалить публикацию']);
        if (delPubBtn) {
            triggerClick(delPubBtn, 'Delete post');
            setTimeout(() => {
                window.close();
            }, 300);
            return;
        }

        const delItemBtn = findButton(['Delete video', 'Удалить видео', 'Delete image', 'Удалить изображение']);
        if (delItemBtn) {
            if (!holdPost) {
                const firstUrl = location.href;
                triggerDeleteWithConfirm(delItemBtn);
                if (callback || transRight) {
                    let checkCount = 0;
                    const checkInterval = setInterval(() => {
                        checkCount++;
                        if (location.href !== firstUrl || checkCount > 30) {
                            clearInterval(checkInterval);
                            if (transRight && location.href !== firstUrl) {
                                setTimeout(() => {
                                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
                                }, 100);
                            }
                            if (callback) callback();
                        }
                    }, 100);
                }
                return;
            }

            const firstUrl = location.href;
            const navKey = slideshowOrientation === 'h' ? 'ArrowLeft' : 'ArrowUp';
            
            document.dispatchEvent(new KeyboardEvent('keydown', { key: navKey, bubbles: true }));
            
            setTimeout(() => {
                if (location.href === firstUrl) {
                    setTimeout(() => {
                        if (location.href === firstUrl) {
                            showToast('Ссылка не меняется, по умному не получится');
                            triggerDeleteWithConfirm(delItemBtn);
                            if (callback) callback();
                        } else {
                            const activeBtn = Array.from(document.querySelectorAll('button[data-filmstrip-item="true"]'))
                                .find(btn => btn.classList.contains('ring-white') || btn.className.includes('ring-white'));
                            const targetImgSrc = activeBtn ? activeBtn.querySelector('img')?.src : null;
                            proceedSmartDelete(firstUrl, location.href, delItemBtn, targetImgSrc, callback);
                        }
                    }, 500);
                } else {
                    const activeBtn = Array.from(document.querySelectorAll('button[data-filmstrip-item="true"]'))
                        .find(btn => btn.classList.contains('ring-white') || btn.className.includes('ring-white'));
                    const targetImgSrc = activeBtn ? activeBtn.querySelector('img')?.src : null;
                    proceedSmartDelete(firstUrl, location.href, delItemBtn, targetImgSrc, callback);
                }
            }, 200);
        } else {
            console.log('%c❌ Кнопка удаления не найдена', 'color:#ef4444');
            if (callback) callback();
        }
    }

    function proceedSmartDelete(firstUrl, secondUrl, delItemBtn, targetImgSrc, callback) {
        const backKey = slideshowOrientation === 'h' ? 'ArrowRight' : 'ArrowDown';
        document.dispatchEvent(new KeyboardEvent('keydown', { key: backKey, bubbles: true }));
        
        setTimeout(() => {
            triggerDeleteWithConfirm(delItemBtn);
            
            // Ждем смены URL (удаление завершено)
            let deleteCheckCount = 0;
            const deleteCheckInterval = setInterval(() => {
                deleteCheckCount++;
                if (location.href !== firstUrl || deleteCheckCount > 30) {
                    clearInterval(deleteCheckInterval);
                    
                    // Пытаемся найти и кликнуть иконку в ленте в течение 1 секунды (10 попыток каждые 100мс)
                    let searchCheckCount = 0;
                    const searchInterval = setInterval(() => {
                        searchCheckCount++;
                        let clicked = false;
                        if (targetImgSrc) {
                            const btn = Array.from(document.querySelectorAll('button[data-filmstrip-item="true"]'))
                                .find(b => b.querySelector('img')?.src === targetImgSrc);
                            if (btn) {
                                btn.click();
                                clicked = true;
                                console.log('%c[Grok Smart Delete] Успешный переход кликом по иконке превью', 'color:#10b981;');
                            }
                        }
                        
                        if (clicked || searchCheckCount >= 10) {
                            clearInterval(searchInterval);
                            if (!clicked) {
                                console.log('%c[Grok Smart Delete] Иконка не появилась за 1с, жесткий переход по ссылке', 'color:#ef4444;');
                                window.location.href = secondUrl;
                            }
                            if (transRight) {
                                setTimeout(() => {
                                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
                                }, 100);
                            }
                            if (callback) {
                                setTimeout(() => callback(), 500);
                            }
                        }
                    }, 100);
                }
            }, 100);
        }, 200);
    }

    function triggerDeleteWithConfirm(delItemBtn) {
        triggerClick(delItemBtn, 'Delete item');
        if (autoConfirm) {
            setTimeout(() => {
                const confirmBtn = Array.from(document.querySelectorAll('button')).find(btn =>
                    btn !== delItemBtn && btn.offsetParent !== null &&
                    (btn.textContent || '').trim().includes('Удалить')
                );
                if (confirmBtn) confirmBtn.click();
            }, 500);
        }
    }

    function addNotePrefix(isDownloaded) {
        const textarea = document.querySelector('textarea, input[type="text"]');
        if (!textarea) return;

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const timeStr = `${hh}:${mm} ${dd}.${mo}`;
        
        const actionWord = isDownloaded ? 'Скачано' : 'Просмотрено';
        const prefix = `${actionWord} в ${timeStr}\n`;

        textarea.focus();
        
        const oldValue = textarea.value || '';
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
            || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            
        if (setter) {
            setter.call(textarea, prefix + oldValue);
        } else {
            textarea.value = prefix + oldValue;
        }
        
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        textarea.blur();
    }

    function checkAndDispatchRight(firstUrl) {
        let count = 0;
        const interval = setInterval(() => {
            count++;
            if (location.href !== firstUrl || count > 30) {
                clearInterval(interval);
                if (location.href !== firstUrl) {
                    setTimeout(() => {
                        console.log('%c[Grok Transition] Переход выполнен, нажимаем стрелку Вправо (ArrowRight)', 'color:#10b981;');
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
                    }, 100);
                }
            }
        }, 100);
    }

    let timerPill = null;
    function createTimerPill() {
        if (timerPill) return;
        timerPill = document.createElement('div');
        timerPill.id = 'grok-timer-pill';
        timerPill.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 10, 10, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            padding: 6px 16px;
            font-family: monospace;
            font-size: 14px;
            font-weight: 700;
            z-index: 1000000;
            box-shadow: 0 6px 18px rgba(0,0,0,0.6);
            pointer-events: none;
            display: none;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(timerPill);
    }

    function showTimerPill(text, isRed) {
        createTimerPill();
        timerPill.textContent = text;
        timerPill.style.color = isRed ? '#ef4444' : '#ffffff';
        timerPill.style.display = 'block';
    }

    function hideTimerPill() {
        if (timerPill) timerPill.style.display = 'none';
    }

    function formatTime(sec) {
        if (isNaN(sec) || sec < 0) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(31, 41, 55, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f3f4f6;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            z-index: 1000000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        document.body.appendChild(toast);
        toast.offsetHeight; // force reflow
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function triggerDownloadForCurrentSite() {
        const host = location.hostname.toLowerCase();

        // 1. CIVITAI.RED
        if (host.includes('civitai.red')) {
            const btn = document.querySelector('button:has(svg.tabler-icon-download), button:has(svg[class*="tabler-icon-download"])') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.tabler-icon-download, svg[class*="tabler-icon-download"]'));
            if (btn) {
                triggerClick(btn, 'Civitai Download');
                return true;
            }
        }

        // 2. VKVIDEO.RU / VK.VIDEO
        if (host.includes('vkvideo.ru') || host.includes('vk.video') || host.includes('vk.com')) {
            const doClickDownloadItem = (dlItem) => {
                const originalOpen = window.open;
                window.open = function (url, target, features) {
                    if (typeof GM_openInTab === 'function' && url) {
                        GM_openInTab(url, { active: false });
                        window.open = originalOpen;
                        return null;
                    }
                    const res = originalOpen.call(window, url, target, features);
                    if (res) { try { window.focus(); } catch (e) {} }
                    window.open = originalOpen;
                    return res;
                };
                triggerClick(dlItem, 'VKVideo Download');
                setTimeout(() => { window.open = originalOpen; }, 2000);
            };

            // Если меню "Скачать" уже отрендерено или открыто пользователем вручную
            const existingDl = Array.from(document.querySelectorAll('button, a, div[role="button"], span, div[class*="MenuItem"], div[class*="Action"], div[class*="item"]')).find(el => {
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const text = (el.textContent || '').toLowerCase();
                return (aria.includes('скачать') || text.includes('скачать')) && el.offsetParent !== null;
            });
            if (existingDl) {
                doClickDownloadItem(existingDl);
                return true;
            }

            // Ищем круговые три точки или кнопку "Ещё" (включая оверлей клипов/шортсов)
            const moreBtn = document.querySelector('button[aria-label*="Ещё"], button[aria-label*="Еще"], button[aria-label*="еще"], button[aria-label*="ещё"]') ||
                            document.querySelector('.VideoPageInfoRow__more button, .VideoCard__more button, [class*="more"], [class*="More"]') ||
                            Array.from(document.querySelectorAll('button, div[role="button"], svg')).find(b => {
                                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                                const text = (b.textContent || '').toLowerCase();
                                return aria.includes('еще') || aria.includes('ещё') || text.includes('еще') || text.includes('ещё') ||
                                       (b.tagName === 'DIV' && b.childElementCount === 1 && b.firstElementChild?.tagName === 'SVG');
                            });

            if (moreBtn) {
                const targetBtn = moreBtn.tagName === 'SVG' ? moreBtn.parentElement : moreBtn;
                targetBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                targetBtn.click();

                setTimeout(() => {
                    const dlItem = Array.from(document.querySelectorAll('button, a, div[role="button"], span, div[class*="MenuItem"], div[class*="Action"], div[class*="item"]')).find(el => {
                        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                        const text = (el.textContent || '').toLowerCase();
                        return (aria.includes('скачать') || text.includes('скачать') || aria.includes('download') || text.includes('download')) && el.offsetParent !== null;
                    });

                    if (dlItem) {
                        doClickDownloadItem(dlItem);
                    } else {
                        console.log('%c❌ Пункт "Скачать" не найден в меню VKVideo', 'color:#ef4444');
                    }
                }, 200);
                return true;
            }
        }

        // 3. GROK.COM или дефолтный поиск
        // Сначала ищем прямо доступную и видимую кнопку Скачать/Download
        const visibleDlBtn = Array.from(document.querySelectorAll('button, a')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            const isMatch = aria.includes('download') || aria.includes('скачать') || text.includes('download') || text.includes('скачать');
            return isMatch && b.offsetParent !== null;
        });

        if (visibleDlBtn) {
            triggerClick(visibleDlBtn, 'Download');
            return true;
        }

        // Если видимой кнопки нет, ищем кнопку меню "Действия с постом"
        const postActionsBtn = document.querySelector('button[aria-label*="Действия с постом"], button[aria-label*="Post actions"]') ||
                               Array.from(document.querySelectorAll('button, div[role="button"]')).find(b => {
                                   const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                                   return aria.includes('действия с постом') || aria.includes('post actions');
                               });

        if (postActionsBtn) {
            triggerClick(postActionsBtn, 'Post actions');
            setTimeout(() => {
                const innerDlBtn = Array.from(document.querySelectorAll('button, a, div[role="button"], span')).find(b => {
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    const text = (b.textContent || '').toLowerCase();
                    return (aria.includes('download') || aria.includes('скачать') || text.includes('download') || text.includes('скачать')) && b.offsetParent !== null;
                });

                if (innerDlBtn) {
                    triggerClick(innerDlBtn, 'Download');
                    // После клика скачивания имитируем клик по полю страницы для закрытия меню без нажатия Escape
                    setTimeout(() => {
                        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
                        try { document.body.click(); } catch(e) {}
                    }, 200);
                } else {
                    console.log('%c❌ Пункт "Скачать" не найден в меню действий поста', 'color:#ef4444');
                    setTimeout(() => {
                        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
                        try { document.body.click(); } catch(e) {}
                    }, 200);
                }
            }, 200);
            return true;
        }

        // Фоллбек на любой найденный элемент Download
        const grokBtn = findButton(['Download', 'Скачать']);
        if (grokBtn) {
            triggerClick(grokBtn, 'Download');
            return true;
        }

        return false;
    }

    function findButton(labels) {
        if (!Array.isArray(labels)) labels = [labels];
        for (const label of labels) {
            let btn = document.querySelector(`button[aria-label="${label}"]`) ||
                      document.querySelector(`button[aria-label*="${label}"]`);
            if (btn) return btn;
        }
        return Array.from(document.querySelectorAll('button')).find(btn => {
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const text = (btn.textContent || '').toLowerCase();
            return labels.some(l => aria.includes(l.toLowerCase()) || text.includes(l.toLowerCase()));
        });
    }

    function triggerClick(btn, action) {
        if (!btn) {
            console.log(`%c❌ "${action}" не найдена`, 'color:#ef4444');
            return;
        }
        console.log(`%c✅ ${action}`, 'color:#10b981');
        btn.click();
        const orig = btn.style.transform;
        btn.style.transition = 'transform 0.1s cubic-bezier(0.34,1.56,0.64,1)';
        btn.style.transform = 'scale(0.82)';
        setTimeout(() => { btn.style.transform = orig || ''; }, 120);
    }

    function toggleSound() {
        const btn = findSoundButton();
        if (btn) triggerClick(btn, 'Toggle sound');
        else console.log('%c❌ Кнопка звука не найдена', 'color:#ef4444');
    }



    function findSoundButton() {
        const words = ['заглушить', 'включить звук', 'звук', 'sound', 'mute', 'unmute'];
        let btn = Array.from(document.querySelectorAll('button')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            return words.some(w => aria.includes(w) || text.includes(w));
        });
        if (btn) return btn;
        return document.querySelector('button[aria-label*="Заглушить"]') ||
               document.querySelector('button[aria-label*="Включить звук"]') ||
               document.querySelector('button[aria-label*="Mute"]') ||
               document.querySelector('button[aria-label*="Unmute"]');
    }

    function togglePlayPause() {
        const pauseBtn = document.querySelector('button[aria-label*="Приостановить"]');
        const playBtn  = document.querySelector('button[aria-label*="Воспроизвести"]');
        if (pauseBtn) triggerClick(pauseBtn, 'Pause video');
        else if (playBtn) triggerClick(playBtn, 'Play video');
        else console.log('%c❌ Кнопка Play/Pause не найдена', 'color:#ef4444');
    }

    // ============================================
    // HELP / SETTINGS OVERLAY (F1)
    // ============================================

    let helpOverlay = null;
    let captureListener = null;

    function toggleHelpOverlay() {
        if (!helpOverlay) createHelpOverlay();
        else rebuildHelpContent();
        helpOverlay.style.display = helpOverlay.style.display === 'none' ? 'flex' : 'none';
    }

    function createHelpOverlay() {
        helpOverlay = document.createElement('div');
        helpOverlay.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 9999999; background: rgba(11,13,18,0.98); color: #ddd;
            padding: 22px 26px; border-radius: 14px; border: 1px solid #2a2f3e;
            font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5;
            box-shadow: 0 16px 48px rgba(0,0,0,0.85); width: 460px;
            display: flex; flex-direction: column; gap: 14px;
        `;

        // Закрыть по клику вне overlay
        document.addEventListener('mousedown', function (e) {
            if (helpOverlay &&
                helpOverlay.style.display !== 'none' &&
                !helpOverlay.contains(e.target)) {
                helpOverlay.style.display = 'none';
                cancelCapture();
            }
        });

        document.body.appendChild(helpOverlay);
        rebuildHelpContent();
    }

    function rebuildHelpContent() {
        if (!helpOverlay) return;
        cancelCapture();
        helpOverlay.innerHTML = '';

        // ── Заголовок ──────────────────────────────────
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex; justify-content:space-between; align-items:baseline;';
        titleRow.innerHTML = `
            <span style="font-weight:700; font-size:16px; color:#fff; letter-spacing:0.3px;">Grok Hotkeys</span>
            <span style="font-size:11px; color:#4b5563;">нажмите на клавишу чтобы переназначить</span>
        `;
        helpOverlay.appendChild(titleRow);

        // ── Разделитель ────────────────────────────────
        const hr = document.createElement('div');
        hr.style.cssText = 'border-top:1px solid #1e2433; margin:-4px 0;';
        helpOverlay.appendChild(hr);

        // ── Таблица хоткеев ────────────────────────────
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 165px 1fr; gap: 6px 14px; align-items:center;';

        for (const [id, action] of Object.entries(ACTIONS)) {
            if (action.postOnly && !checkIsPostPage()) continue;

            const keyCell = document.createElement('div');
            keyCell.dataset.actionId = id;
            keyCell.style.cssText = `
                background: #161b27; border: 1px solid #252d3d; border-radius: 7px;
                padding: 4px 10px; cursor: pointer; text-align: center; font-weight: 600;
                color: #c9d1e0; transition: background 0.15s, border-color 0.15s, color 0.15s;
                font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                user-select: none;
            `;
            keyCell.textContent = formatHotkey(config[id]);
            keyCell.title = 'Нажмите чтобы переназначить';

            keyCell.addEventListener('mouseenter', () => {
                if (capturingFor !== id) {
                    keyCell.style.background = '#1e2840';
                    keyCell.style.borderColor = '#3b4a6b';
                    keyCell.style.color = '#e2e8f0';
                }
            });
            keyCell.addEventListener('mouseleave', () => {
                if (capturingFor !== id) {
                    keyCell.style.background = '#161b27';
                    keyCell.style.borderColor = '#252d3d';
                    keyCell.style.color = '#c9d1e0';
                }
            });
            keyCell.addEventListener('click', () => startCapture(id));

            const descCell = document.createElement('div');
            descCell.style.cssText = 'color: #6b7280; font-size:13px;';
            descCell.textContent = action.label;

            grid.appendChild(keyCell);
            grid.appendChild(descCell);
        }
        helpOverlay.appendChild(grid);

        // Настройки слайдшоу (по умолчанию 3с и 5с)
        const settingsContainer = document.createElement('div');
        settingsContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px; font-size:13px; color:#9ca3af; margin-top:10px; border-top:1px solid #1e2433; padding-top:8px;';
        settingsContainer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>Секунд ожидания (фото):</span>
                <input type="number" id="grok-photo-base-input" value="${photoBaseSeconds}" min="1" max="60" style="
                    width: 50px; background: #161b27; border: 1px solid #252d3d;
                    border-radius: 6px; color: #fff; text-align: center; padding: 2px 4px; font-weight: 600;
                ">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>Секунд отсчета (фото/видео):</span>
                <input type="number" id="grok-countdown-input" value="${countdownSeconds}" min="1" max="60" style="
                    width: 50px; background: #161b27; border: 1px solid #252d3d;
                    border-radius: 6px; color: #fff; text-align: center; padding: 2px 4px; font-weight: 600;
                ">
            </div>
        `;
        helpOverlay.appendChild(settingsContainer);
        
        const pInput = settingsContainer.querySelector('#grok-photo-base-input');
        pInput.addEventListener('change', () => {
            let val = parseInt(pInput.value, 10);
            if (isNaN(val) || val < 1) val = 5;
            photoBaseSeconds = val;
            setSiteStorageItem('slideshow_photo_base_sec', photoBaseSeconds);
        });

        const cInput = settingsContainer.querySelector('#grok-countdown-input');
        cInput.addEventListener('change', () => {
            let val = parseInt(cInput.value, 10);
            if (isNaN(val) || val < 1) val = 3;
            countdownSeconds = val;
            setSiteStorageItem('slideshow_countdown_sec', countdownSeconds);
        });

        // ── Зона конфликта ─────────────────────────────
        const conflictArea = document.createElement('div');
        conflictArea.id = 'hk-conflict';
        conflictArea.style.cssText = `
            display:none; background:#2d0a0a; border:1px solid #7f1d1d;
            border-radius:8px; padding:10px 14px; font-size:13px; color:#fca5a5;
        `;
        helpOverlay.appendChild(conflictArea);

        // ── Подсказка захвата ──────────────────────────
        const captureHint = document.createElement('div');
        captureHint.id = 'hk-capture-hint';
        captureHint.style.cssText = 'display:none; font-size:12px; color:#60a5fa; text-align:center; letter-spacing:0.2px;';
        captureHint.textContent = '⌨️  Нажмите новую клавишу или комбинацию…  Esc — отмена';
        helpOverlay.appendChild(captureHint);

        // ── Кнопка сброса ──────────────────────────────
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↺  Сбросить к значениям по умолчанию';
        resetBtn.style.cssText = `
            padding:7px 0; background:transparent; border:1px solid #252d3d;
            border-radius:8px; color:#4b5563; cursor:pointer; font-size:12px;
            transition: all 0.15s; width:100%; letter-spacing:0.2px;
        `;
        resetBtn.addEventListener('mouseenter', () => {
            resetBtn.style.borderColor = '#374151';
            resetBtn.style.color = '#9ca3af';
            resetBtn.style.background = '#161b27';
        });
        resetBtn.addEventListener('mouseleave', () => {
            resetBtn.style.borderColor = '#252d3d';
            resetBtn.style.color = '#4b5563';
            resetBtn.style.background = 'transparent';
        });
        resetBtn.addEventListener('click', () => {
            for (const [id, action] of Object.entries(ACTIONS)) {
                config[id] = { ...action.defaultKey };
            }
            saveConfig();
            rebuildHelpContent();
        });
        helpOverlay.appendChild(resetBtn);
    }

    // ── Начать захват новой клавиши ────────────────────

    function startCapture(actionId) {
        if (capturingFor !== null) cancelCapture();
        capturingFor = actionId;

        const keyCell = helpOverlay.querySelector(`[data-action-id="${actionId}"]`);
        if (keyCell) {
            keyCell.style.background    = '#0f2340';
            keyCell.style.borderColor   = '#3b82f6';
            keyCell.style.color         = '#93c5fd';
            keyCell.textContent         = '…';
        }

        const hint = helpOverlay.querySelector('#hk-capture-hint');
        if (hint) hint.style.display = 'block';

        captureListener = function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (e.key === 'Escape') {
                cancelCapture();
                rebuildHelpContent();
                return;
            }

            const hk = hotkeyFromEvent(e);
            if (!hk) return; // нажата только клавиша-модификатор

            // Ограничение для help: только F1-F4 без модификаторов
            if (actionId === 'help') {
                if (!['F1', 'F2', 'F3', 'F4'].includes(hk.key) || hk.ctrl || hk.alt || hk.shift) {
                    showCaptureError('Для «Справки» допустимы только F1, F2, F3 или F4 (без модификаторов)');
                    return;
                }
            }

            const conflictId = findConflict(hk, actionId);
            if (conflictId) {
                showConflictDialog(actionId, conflictId, hk);
            } else {
                applyHotkey(actionId, hk);
            }
        };

        document.addEventListener('keydown', captureListener, true);
    }

    function cancelCapture() {
        if (captureListener) {
            document.removeEventListener('keydown', captureListener, true);
            captureListener = null;
        }
        capturingFor = null;
    }

    function applyHotkey(actionId, hk) {
        config[actionId] = hk;
        saveConfig();
        cancelCapture();
        rebuildHelpContent();
    }

    function showCaptureError(msg) {
        const area = helpOverlay.querySelector('#hk-conflict');
        if (!area) return;
        area.style.display = 'block';
        area.innerHTML = `<span>⛔  ${msg}</span>`;
        setTimeout(() => { cancelCapture(); rebuildHelpContent(); }, 2000);
    }

    function showConflictDialog(actionId, conflictId, newHk) {
        // Снимаем обработчик на время диалога
        document.removeEventListener('keydown', captureListener, true);

        const area = helpOverlay.querySelector('#hk-conflict');
        if (!area) return;

        const conflictLabel = ACTIONS[conflictId].label;
        const defaultHk     = ACTIONS[conflictId].defaultKey;
        const defaultTaken  = findConflict(defaultHk, conflictId);
        const canUseDefault = !defaultTaken && defaultHk.key;

        const destText = canUseDefault
            ? `«${conflictLabel}» переедет на дефолтную&nbsp;<b>${formatHotkey(defaultHk)}</b>`
            : `«${conflictLabel}» останется <b>без клавиши</b> (дефолтная ${formatHotkey(defaultHk)} занята)`;

        area.style.display = 'block';
        area.innerHTML = `
            <div style="margin-bottom:7px;">
                ⚠️ <b>${formatHotkey(newHk)}</b> уже используется для «${conflictLabel}».
            </div>
            <div style="margin-bottom:10px; color:#fda4af; font-size:12px;">${destText}</div>
            <div style="display:flex; gap:8px;">
                <button id="hk-ok" style="padding:5px 16px; background:#b91c1c; border:none; border-radius:6px; color:#fff; cursor:pointer; font-size:13px; font-weight:600;">Переназначить</button>
                <button id="hk-cancel" style="padding:5px 16px; background:#161b27; border:1px solid #2d3748; border-radius:6px; color:#94a3b8; cursor:pointer; font-size:13px;">Отмена</button>
            </div>
        `;

        area.querySelector('#hk-ok').addEventListener('click', () => {
            config[conflictId] = canUseDefault
                ? { ...defaultHk }
                : { key: null, ctrl: false, alt: false, shift: false };
            applyHotkey(actionId, newHk);
        });

        area.querySelector('#hk-cancel').addEventListener('click', () => {
            cancelCapture();
            rebuildHelpContent();
        });
    }

    // ============================================
    // LAG MONITOR (F8) — только на /imagine/post/*
    // ============================================

    let lagPanel   = null;
    let lagRunning = false;
    let lagTimer   = null;
    let lagPrev    = 0;

    function toggleLagMonitor() {
        if (!checkIsPostPage()) return;
        if (!lagPanel) createLagPanel();
        if (lagRunning) stopLagMonitor();
        else startLagMonitor();
    }

    function createLagPanel() {
        lagPanel = document.createElement('div');
        lagPanel.style.cssText = `
            position:fixed; top:20px; right:20px; z-index:999999;
            background:#111; color:#0f0; padding:8px 14px; border-radius:8px;
            font-family:monospace; font-size:16px; border:1px solid #444; display:none;
        `;
        lagPanel.textContent = '0 ms';
        document.body.appendChild(lagPanel);
    }

    function startLagMonitor() {
        if (!lagPanel) createLagPanel();
        lagRunning = true;
        lagPanel.style.display = 'block';
        lagPrev = performance.now();

        lagTimer = setInterval(() => {
            const now   = performance.now();
            const drift = now - lagPrev - 500;
            lagPrev = now;
            lagPanel.textContent = `${Math.round(drift)} ms`;

            if      (drift < 50)   lagPanel.style.color = '#00ff00';
            else if (drift < 200)  lagPanel.style.color = '#ffff00';
            else if (drift < 1000) lagPanel.style.color = '#ff8800';
            else                   lagPanel.style.color = '#ff0000';
        }, 500);
    }

    function stopLagMonitor() {
        lagRunning = false;
        clearInterval(lagTimer);
        if (lagPanel) lagPanel.style.display = 'none';
    }

    // ============================================
    // WIDGET — NumLock-полоска + панель управления
    // Ctrl+Insert = цикл (полоска → настройки → скрыт)
    // Insert      = старт/стоп слайдшоу
    // F7          = фокус на панель (Tab-навигация)
    // ============================================

    let slideshowActive      = false;
    let slideshowTimeoutId   = null;
    let downloadTimeoutId    = null;
    let slideshowPaused      = false;
    let slideshowStart       = null;
    let slideshowStop        = null;
    let slideshowResetTimer   = null;
    let slideshowOrientation = localStorage.getItem('grok_slideshow_orientation') || 'v';
    let currentInterval      = 7;

    const WIDGET_STATE_KEY = 'grok_widget_state';
    const PD_ACTION_KEY    = 'grok_pd_action';
    const AUTO_CONFIRM_KEY = 'grok_delete_autoconfirm';
    function getSitePrefix() {
        const host = location.hostname.toLowerCase();
        if (host.includes('civitai')) return 'civitai_';
        if (host.includes('vkvideo') || host.includes('vk.video')) return 'vkvideo_';
        return 'grok_';
    }

    function getSiteStorageItem(key, defaultVal) {
        const prefix = getSitePrefix();
        const val = localStorage.getItem(prefix + key);
        if (val !== null) return val;
        // Fallback to legacy global key if present
        const globalVal = localStorage.getItem('grok_' + key);
        return globalVal !== null ? globalVal : defaultVal;
    }

    function setSiteStorageItem(key, val) {
        const prefix = getSitePrefix();
        localStorage.setItem(prefix + key, val);
    }

    const VIDEO_LOOPS_KEY = 'slideshow_video_loops';

    let widgetState  = getSiteStorageItem('widget_state', 'strip');
    let pdAction     = getSiteStorageItem('pd_action', 'up');
    let autoConfirm  = getSiteStorageItem('delete_autoconfirm', 'true') !== 'false';
    let holdPost     = getSiteStorageItem('delete_holdpost', 'true') !== 'false';
    let slideshowMode = getSiteStorageItem('slideshow_mode', 'auto');
    let countdownSeconds = parseInt(getSiteStorageItem('slideshow_countdown_sec', '3'), 10);
    if (isNaN(countdownSeconds)) countdownSeconds = 3;
    let photoBaseSeconds = parseInt(getSiteStorageItem('slideshow_photo_base_sec', '5'), 10);
    if (isNaN(photoBaseSeconds)) photoBaseSeconds = 5;

    let videoTargetLoops = parseInt(getSiteStorageItem('slideshow_video_loops', '1'), 10);
    if (isNaN(videoTargetLoops) || videoTargetLoops < 1) videoTargetLoops = 1;

    let slideshowRepeat  = getSiteStorageItem('slideshow_repeat', 'true') !== 'false';
    let slideshowDirections = [];
    try {
        slideshowDirections = JSON.parse(getSiteStorageItem('slideshow_directions', '["left"]'));
    } catch(e) {}
    if (!Array.isArray(slideshowDirections) || slideshowDirections.length === 0) {
        slideshowDirections = ['left'];
    }
    let downloadType = getSiteStorageItem('slideshow_download_type', 'all');
    let transRight   = getSiteStorageItem('transition_right', 'false') === 'true';

    let widgetEl     = null; // весь виджет
    let gearRowEl    = null; // строка с шестерёнкой
    let panelEl      = null; // развёрнутая панель
    let numLockEl    = null; // индикатор NumLock
    let numLockState = null; // null=?, true=вкл, false=выкл
    let refreshHotkeyLabels = null;

    function setWidgetState(state) {
        widgetState = state;
        localStorage.setItem(WIDGET_STATE_KEY, state);
        applyWidgetState();
        if (state === 'panel' && refreshHotkeyLabels) {
            refreshHotkeyLabels();
        }
    }

    function cycleWidgetState() {
        const states = ['strip', 'panel', 'hidden'];
        setWidgetState(states[(states.indexOf(widgetState) + 1) % states.length]);
        if (widgetState === 'panel' && refreshHotkeyLabels) {
            refreshHotkeyLabels();
        }
    }

    function applyWidgetState() {
        if (!widgetEl) return;
        widgetEl.style.display = widgetState === 'hidden' ? 'none' : 'block';
        if (panelEl) panelEl.style.display = widgetState === 'panel' ? 'flex' : 'none';
    }

    function updateGearRow() {
        if (gearRowEl) gearRowEl.textContent = `↓ ${formatHotkey(config.slideshowPanel)} ⚙ ↓`;
    }

    function initWidget() {
        if (widgetEl) return;

        // Внедряем стили для виджета
        const style = document.createElement('style');
        style.textContent = `
            #grok-widget-container {
                position: fixed;
                top: 50px;
                right: 50px;
                z-index: 999999;
                background: rgba(20, 20, 20, 0.85);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                font-family: system-ui, -apple-system, sans-serif;
                color: #e5e7eb;
                display: none;
                flex-direction: column;
                gap: 8px;
                padding: 10px 14px;
                min-width: 155px;
                user-select: none;
                transition: box-shadow 0.3s ease;
            }
            #grok-widget-container:hover {
                box-shadow: 0 10px 30px rgba(0,0,0,0.7), 0 0 10px rgba(59, 130, 246, 0.2);
                border-color: rgba(255, 255, 255, 0.15);
            }
            .grok-widget-btn {
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 6px;
                color: #e5e7eb;
                font-weight: 500;
            }
            .grok-widget-btn:hover {
                background: #374151;
                border-color: #4b5563;
                transform: translateY(-1px);
            }
            .grok-widget-btn:active {
                transform: translateY(0);
            }
            .grok-preset-item {
                cursor: pointer;
                padding: 2px 6px;
                border: 1px solid #374151;
                border-radius: 4px;
                background: #1f2937;
                transition: all 0.15s ease;
            }
            .grok-preset-item:hover {
                background: #374151;
                border-color: #ef4444;
                color: #fff;
            }
            .grok-preset-item:active {
                transform: scale(0.95);
            }
            .grok-plus-minus {
                font-size: 14px;
                color: #9ca3af;
                cursor: pointer;
                padding: 2px 8px;
                line-height: 1;
                transition: color 0.15s ease, transform 0.15s ease;
            }
            .grok-plus-minus:hover {
                color: #fff;
                transform: scale(1.2);
            }
            #grok-widget-close {
                cursor: pointer;
                color: #9ca3af;
                font-weight: bold;
                font-size: 16px;
                transition: color 0.15s ease, transform 0.15s ease;
                line-height: 1;
            }
            #grok-widget-close:hover {
                color: #f87171;
                transform: scale(1.1);
            }
            #grok-gear-row {
                cursor: pointer;
                color: #9ca3af;
                font-size: 11px;
                padding: 3px 6px;
                border-radius: 6px;
                border: 1px solid #374151;
                background: #1f2937;
                transition: all 0.2s ease;
            }
            #grok-gear-row:hover {
                background: #374151;
                color: #fff;
                border-color: #4b5563;
            }
            #grok-btn-interval {
                padding: 6px 14px;
                background: #1f2937;
                color: #e5e7eb;
                border: 2px solid #374151;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                min-width: 48px;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            #grok-btn-interval:hover {
                border-color: #4b5563;
            }
            #grok-btn-x2 {
                border-color: rgba(239, 68, 68, 0.4);
            }
            #grok-btn-x2:hover {
                background: rgba(239, 68, 68, 0.2);
                border-color: #ef4444;
                color: #fff;
            }
            #grok-btn-div2 {
                border-color: rgba(59, 130, 246, 0.4);
            }
            #grok-btn-div2:hover {
                background: rgba(59, 130, 246, 0.2);
                border-color: #3b82f6;
                color: #fff;
            }
            .grok-settings-row label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 4px;
                transition: background 0.15s ease;
            }
            .grok-settings-row label:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            .grok-settings-row input[type="radio"], 
            .grok-settings-row input[type="checkbox"] {
                cursor: pointer;
            }
            #grok-widget-container *:focus {
                outline: 2px solid #3b82f6 !important;
                outline-offset: 1px !important;
            }
        `;
        document.head.appendChild(style);

        // Загружаем сохраненный интервал
        const saved = localStorage.getItem('grok_slideshow_interval');
        if (saved) currentInterval = parseInt(saved, 10) || 7;

        widgetEl = document.createElement('div');
        widgetEl.id = 'grok-widget-container';
        
        let stripHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 500; width: 100%;">
                <span id="grok-numlock" style="color: #10b981;" title="Статус NumLock">?</span>
                <span id="grok-gear-row">↓ ${formatHotkey(config.slideshowPanel)} ⚙ ↓</span>
                <span id="grok-widget-close" title="Скрыть виджет">×</span>
            </div>
        `;
        widgetEl.innerHTML = stripHtml;
        document.body.appendChild(widgetEl);

        numLockEl = widgetEl.querySelector('#grok-numlock');
        const closeBtn = widgetEl.querySelector('#grok-widget-close');

        closeBtn.onclick = (e) => {
            e.stopPropagation();
            setWidgetState('hidden');
        };

        gearRowEl = widgetEl.querySelector('#grok-gear-row');
        gearRowEl.onclick = (e) => {
            e.stopPropagation();
            setWidgetState(widgetState === 'panel' ? 'strip' : 'panel');
        };

        panelEl = document.createElement('div');
        panelEl.id = 'grok-settings-panel';
        panelEl.style.cssText = `
            display: none;
            flex-direction: column;
            gap: 10px;
            border-top: 1px solid #374151;
            padding-top: 8px;
            margin-top: 4px;
            width: 100%;
        `;
        widgetEl.appendChild(panelEl);

        initPanelContent(panelEl);

        applyWidgetState();
    }

    function initPanelContent(container) {
        const initDelete   = localStorage.getItem('grok_slideshow_delete')   === 'true';
        const initTab      = localStorage.getItem('grok_slideshow_tab')      === 'true';
        const initBrsr     = localStorage.getItem('grok_slideshow_brsr')     === 'true';

        container.innerHTML = `
            <!-- Заголовок Слайдшоу -->
            <div style="font-weight: bold; font-size: 13px; color: #fff; margin-bottom: 4px; text-align: center; width: 100%;">
                SlideShow
            </div>

            <!-- Режимы: Manual, Кнопка Ориентации, AUTO -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 11px; color: #9ca3af; font-weight: 600; text-align: center; margin-bottom: 2px;">
                <div id="grok-label-manual-header" style="width: 40%; text-align: right; padding-right: 4px; transition: color 0.2s ease;">Manual</div>
                <button id="grok-btn-orient" class="grok-widget-btn" style="font-size: 11px; padding: 2px 4px; line-height: 1; border-radius: 4px; min-width: 20px;" title="Переключить ориентацию">${slideshowOrientation === 'h' ? '↔' : '↕'}</button>
                <div id="grok-label-auto-header" style="width: 40%; text-align: left; padding-left: 4px; transition: color 0.2s ease;">AUTO</div>
            </div>

            <!-- Строка управления -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 10px; margin-bottom: 4px;">
                <!-- Manual контроллер -->
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; width: 50%;">
                    <div id="grok-manual-minus" class="grok-plus-minus" tabindex="0" style="font-size: 16px; padding: 2px 4px;">−</div>
                    <button id="grok-btn-manual" class="grok-widget-btn" style="width: 44px; height: 32px; font-size: 14px; font-weight: bold; border-radius: 8px;">${currentInterval}</button>
                    <div id="grok-manual-plus" class="grok-plus-minus" tabindex="0" style="font-size: 16px; padding: 2px 4px;">+</div>
                </div>

                <!-- AUTO контроллер с секцией секунд (верх) и кругов (низ) -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 50%;">
                    <!-- Верхняя строка: секунды задержки -->
                    <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                        <div id="grok-auto-sec-minus" class="grok-plus-minus" tabindex="0" style="font-size: 14px; padding: 1px 3px;" title="Уменьшить секунды задержки">−</div>
                        <button id="grok-btn-auto" class="grok-widget-btn" style="width: 42px; height: 22px; font-size: 12px; font-weight: bold; border-radius: 6px;" title="Запуск/стоп AUTO слайдшоу">${countdownSeconds < 10 ? '0' + countdownSeconds : countdownSeconds}с</button>
                        <div id="grok-auto-sec-plus" class="grok-plus-minus" tabindex="0" style="font-size: 14px; padding: 1px 3px;" title="Увеличить секунды задержки">+</div>
                    </div>
                    <!-- Нижняя строка: проигрывания видео -->
                    <div style="display: flex; align-items: center; justify-content: center; gap: 2px;">
                        <div id="grok-auto-loop-div" class="grok-plus-minus" tabindex="0" style="font-size: 12px; padding: 1px 3px;" title="Уменьшить число кругов видео">÷</div>
                        <button id="grok-btn-loops" class="grok-widget-btn" style="width: 42px; height: 18px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #161b27; color: #60a5fa; border-color: #252d3d;" title="Число полных кругов проигрывания видео">${videoTargetLoops}х</button>
                        <div id="grok-auto-loop-mul" class="grok-plus-minus" tabindex="0" style="font-size: 12px; padding: 1px 3px;" title="Увеличить число кругов видео">×</div>
                    </div>
                </div>
            </div>

            <!-- Нижняя строка режимов (пресеты и постоянный секундомер) -->
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; height: 22px; font-size: 11px; margin-bottom: 6px;">
                <!-- Пресеты под Manual -->
                <div style="display: flex; gap: 4px; width: 50%; justify-content: center;">
                    <div id="grok-preset-7" class="grok-preset-item" tabindex="0" style="padding: 2px 5px;">7</div>
                    <div id="grok-preset-12" class="grok-preset-item" tabindex="0" style="padding: 2px 5px;">12</div>
                    <div id="grok-preset-17" class="grok-preset-item" tabindex="0" style="padding: 2px 5px;">17</div>
                </div>

                <!-- Постоянный пустой контейнер секундомера под AUTO -->
                <div style="width: 50%; display: flex; justify-content: center;">
                    <div id="grok-auto-stopwatch" style="width: 68px; height: 18px; border: 1px solid #374151; border-radius: 4px; background: #111827; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 10px; color: #fff; font-weight: bold; line-height: 1;"></div>
                </div>
            </div>

            <!-- D-pad перекрестие 3x3 с кнопкой R по центру -->
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%; margin-bottom: 6px;">
                <div style="display: grid; grid-template-columns: repeat(3, 26px); grid-template-rows: repeat(3, 26px); gap: 2px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 14px; padding: 4px; align-items: center; justify-content: center;">
                    <!-- Строка 1 -->
                    <div></div>
                    <button id="grok-dpad-up" class="grok-widget-btn" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0;" title="Вверх">▲</button>
                    <div></div>
                    
                    <!-- Строка 2 -->
                    <button id="grok-dpad-left" class="grok-widget-btn" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0;" title="Влево">◀</button>
                    <button id="grok-dpad-repeat" class="grok-widget-btn" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; border-radius: 50%; padding: 0;" title="Повтор/Петля (R)">R</button>
                    <button id="grok-dpad-right" class="grok-widget-btn" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0;" title="Вправо">▶</button>
                    
                    <!-- Строка 3 -->
                    <div></div>
                    <button id="grok-dpad-down" class="grok-widget-btn" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0;" title="Вниз">▼</button>
                    <div></div>
                </div>
            </div>

            <!-- Нижняя строка слайдшоу: чекбоксы в ряд -->
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 4px; font-size: 11px; color: #9ca3af;">
                <div class="grok-settings-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <label>
                        <select id="grok-select-download-type" style="background: #1f2937; border: 1px solid #374151; border-radius: 4px; color: #fff; font-size: 11px; padding: 1px 2px; outline: none; cursor: pointer;">
                            <option value="all" ${downloadType === 'all' ? 'selected' : ''}>↓ всё</option>
                            <option value="photo" ${downloadType === 'photo' ? 'selected' : ''}>↓ фото</option>
                            <option value="video" ${downloadType === 'video' ? 'selected' : ''}>↓ видео</option>
                            <option value="none" ${downloadType === 'none' ? 'selected' : ''}>↓ выкл</option>
                        </select>
                    </label>
                    <label title="Удалять каждый слайд в слайдшоу">
                        <input type="checkbox" id="grok-cb-delete" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${initDelete ? 'checked' : ''}>
                        <span>del</span>
                    </label>
                    <label title="Пауза при переключении вкладки">
                        <input type="checkbox" id="grok-cb-tab" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${initTab ? 'checked' : ''}>
                        <span>Tab</span>
                    </label>
                    <label title="Пауза при потере фокуса браузера">
                        <input type="checkbox" id="grok-cb-brsr" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${initBrsr ? 'checked' : ''}>
                        <span>Brsr</span>
                    </label>
                </div>
            </div>

            <!-- Разделитель -->
            <div style="border-top: 1px solid #374151; margin: 4px 0; width: 100%;"></div>

            <!-- Секция Скачивание: radio-кнопки -->
            <div class="grok-settings-row" style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; width: 100%;">
                <div id="grok-label-download-hotkey" style="color: #9ca3af; font-weight: 500;">
                    ${formatHotkey(config.download)} :
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <label>
                        <input type="radio" name="grok-pd-action" value="none" style="accent-color: #3b82f6;" ${pdAction === 'none' ? 'checked' : ''}>
                        <span>—</span>
                    </label>
                    <label title="Скачать + листать вверх/вправо">
                        <input type="radio" name="grok-pd-action" value="up" style="accent-color: #3b82f6;" ${pdAction === 'up' ? 'checked' : ''}>
                        <span>+↑</span>
                    </label>
                    <label title="Скачать + написать Заметку + Вверх">
                        <input type="radio" name="grok-pd-action" value="note" style="accent-color: #3b82f6;" ${pdAction === 'note' ? 'checked' : ''}>
                        <span>note</span>
                    </label>
                    <label title="Скачать + подождать 1с + Удалить">
                        <input type="radio" name="grok-pd-action" value="del" style="accent-color: #3b82f6;" ${pdAction === 'del' ? 'checked' : ''}>
                        <span>del</span>
                    </label>
                </div>
                <!-- Вторая строка для чекбокса "стрелка вправо" по центру -->
                <div style="display: flex; justify-content: center; width: 100%; margin-top: 2px;">
                    <label title="Нажать стрелку Вправо после перехода на новый пост">
                        <input type="checkbox" id="grok-cb-transright" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${transRight ? 'checked' : ''}>
                        <span style="font-weight: 600;">→</span>
                    </label>
                </div>
            </div>

            <!-- Разделитель -->
            <div style="border-top: 1px solid #374151; margin: 4px 0; width: 100%;"></div>

            <!-- Секция Del: чекбоксы -->
            <div class="grok-settings-row" style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; width: 100%;">
                <div id="grok-label-delete-hotkey" style="color: #9ca3af; font-weight: 500;">
                    ${formatHotkey(config.deleteVid)} :
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <label title="Автоподтверждение при удалении одиночного видео">
                        <input type="checkbox" id="grok-cb-aconfirm" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${autoConfirm ? 'checked' : ''}>
                        <span>a.confirm</span>
                    </label>
                    <label title="Умный возврат к посту (перелистывание)">
                        <input type="checkbox" id="grok-cb-holdpost" style="width: 12px; height: 12px; accent-color: #3b82f6;" ${holdPost ? 'checked' : ''}>
                        <span>hold post</span>
                    </label>
                </div>
            </div>
        `;

        refreshHotkeyLabels = () => {
            const labelDl = container.querySelector('#grok-label-download-hotkey');
            const labelDel = container.querySelector('#grok-label-delete-hotkey');
            if (labelDl) labelDl.textContent = `${formatHotkey(config.download)} :`;
            if (labelDel) labelDel.textContent = `${formatHotkey(config.deleteVid)} :`;
        };

        const btnManual   = container.querySelector('#grok-btn-manual');
        const manualMinus = container.querySelector('#grok-manual-minus');
        const manualPlus  = container.querySelector('#grok-manual-plus');

        const btnAuto        = container.querySelector('#grok-btn-auto');
        const autoSecMinus   = container.querySelector('#grok-auto-sec-minus');
        const autoSecPlus    = container.querySelector('#grok-auto-sec-plus');
        const btnLoops       = container.querySelector('#grok-btn-loops');
        const autoLoopDiv    = container.querySelector('#grok-auto-loop-div');
        const autoLoopMul    = container.querySelector('#grok-auto-loop-mul');

        const btnUp       = container.querySelector('#grok-dpad-up');
        const btnDown     = container.querySelector('#grok-dpad-down');
        const btnLeft     = container.querySelector('#grok-dpad-left');
        const btnRight    = container.querySelector('#grok-dpad-right');
        const btnRepeat   = container.querySelector('#grok-dpad-repeat');

        const preset17    = container.querySelector('#grok-preset-17');
        const preset12    = container.querySelector('#grok-preset-12');
        const preset7     = container.querySelector('#grok-preset-7');
        const btnOrient   = container.querySelector('#grok-btn-orient');
        const selectDl    = container.querySelector('#grok-select-download-type');
        const cbDelete    = container.querySelector('#grok-cb-delete');
        const cbTab       = container.querySelector('#grok-cb-tab');
        const cbBrsr      = container.querySelector('#grok-cb-brsr');
        const radios      = container.querySelectorAll('input[name="grok-pd-action"]');
        const cbAConfirm  = container.querySelector('#grok-cb-aconfirm');
        const cbHoldPost  = container.querySelector('#grok-cb-holdpost');
        const cbTransRight = container.querySelector('#grok-cb-transright');

        selectDl.addEventListener('change', () => {
            downloadType = selectDl.value;
            setSiteStorageItem('slideshow_download_type', downloadType);
        });
        cbDelete.addEventListener('change',   () => localStorage.setItem('grok_slideshow_delete',   cbDelete.checked));
        cbTab.addEventListener('change',      () => localStorage.setItem('grok_slideshow_tab',      cbTab.checked));
        cbBrsr.addEventListener('change',     () => localStorage.setItem('grok_slideshow_brsr',     cbBrsr.checked));

        function updateDpadStyles() {
            if (!btnUp || !btnDown || !btnLeft || !btnRight || !btnRepeat) return;
            const setGreen = (btn, active) => {
                if (active) {
                    btn.style.background = '#10b981';
                    btn.style.borderColor = '#10b981';
                    btn.style.color = '#ffffff';
                } else {
                    btn.style.background = '#1f2937';
                    btn.style.borderColor = '#374151';
                    btn.style.color = '#e5e7eb';
                }
            };
            setGreen(btnUp, slideshowDirections.includes('up'));
            setGreen(btnDown, slideshowDirections.includes('down'));
            setGreen(btnLeft, slideshowDirections.includes('left'));
            setGreen(btnRight, slideshowDirections.includes('right'));

            if (slideshowRepeat) {
                btnRepeat.style.background = '#3b82f6';
                btnRepeat.style.borderColor = '#3b82f6';
                btnRepeat.style.color = '#ffffff';
            } else {
                btnRepeat.style.background = '#1f2937';
                btnRepeat.style.borderColor = '#374151';
                btnRepeat.style.color = '#9ca3af';
            }
        }

        const toggleDirection = (dir, opposite) => {
            const idx = slideshowDirections.indexOf(dir);
            if (idx > -1) {
                slideshowDirections.splice(idx, 1);
            } else {
                slideshowDirections.push(dir);
                const oppIdx = slideshowDirections.indexOf(opposite);
                if (oppIdx > -1) slideshowDirections.splice(oppIdx, 1);
            }
            setSiteStorageItem('slideshow_directions', JSON.stringify(slideshowDirections));
            updateDpadStyles();
        };

        btnUp.onclick = (e) => { e.stopPropagation(); toggleDirection('up', 'down'); };
        btnDown.onclick = (e) => { e.stopPropagation(); toggleDirection('down', 'up'); };
        btnLeft.onclick = (e) => { e.stopPropagation(); toggleDirection('left', 'right'); };
        btnRight.onclick = (e) => { e.stopPropagation(); toggleDirection('right', 'left'); };
        btnRepeat.onclick = (e) => {
            e.stopPropagation();
            slideshowRepeat = !slideshowRepeat;
            setSiteStorageItem('slideshow_repeat', slideshowRepeat);
            updateDpadStyles();
        };

        updateDpadStyles();

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                pdAction = radio.value;
                setSiteStorageItem('pd_action', pdAction);
            });
        });

        cbAConfirm.addEventListener('change', () => {
            autoConfirm = cbAConfirm.checked;
            setSiteStorageItem('delete_autoconfirm', autoConfirm);
        });

        cbHoldPost.addEventListener('change', () => {
            holdPost = cbHoldPost.checked;
            setSiteStorageItem('delete_holdpost', holdPost);
        });

        cbTransRight.addEventListener('change', () => {
            transRight = cbTransRight.checked;
            setSiteStorageItem('transition_right', transRight);
        });

        function updateButtonStyles() {
            if (!btnManual || !btnAuto) return;

            if (slideshowActive && !slideshowPaused) {
                if (slideshowMode === 'manual') {
                    btnManual.style.background  = '#1f2937';
                    btnManual.style.borderColor = '#3b82f6';
                    btnManual.style.color       = '#3b82f6';
                    btnManual.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.5)';

                    btnAuto.style.background    = '#1f2937';
                    btnAuto.style.borderColor   = '#374151';
                    btnAuto.style.color         = '#e5e7eb';
                    btnAuto.style.boxShadow     = 'none';
                    btnAuto.textContent         = (countdownSeconds < 10 ? '0' + countdownSeconds : countdownSeconds) + 'с';
                } else {
                    btnManual.style.background  = '#1f2937';
                    btnManual.style.borderColor = '#374151';
                    btnManual.style.color       = '#e5e7eb';
                    btnManual.style.boxShadow   = 'none';

                    btnAuto.style.background    = '#ef4444';
                    btnAuto.style.borderColor   = '#ef4444';
                    btnAuto.style.color         = '#ffffff';
                    btnAuto.style.boxShadow     = '0 0 0 2px rgba(239,68,68,0.5)';
                }
            } else {
                btnManual.style.background  = '#1f2937';
                btnManual.style.borderColor = '#374151';
                btnManual.style.color       = '#e5e7eb';
                btnManual.style.boxShadow   = 'none';

                btnAuto.style.background    = '#1f2937';
                btnAuto.style.borderColor   = '#374151';
                btnAuto.style.color         = '#e5e7eb';
                btnAuto.style.boxShadow     = 'none';
                btnAuto.textContent         = (countdownSeconds < 10 ? '0' + countdownSeconds : countdownSeconds) + 'с';
            }
        }

        let timerSilent = false;
        let checkTimerSilentOnResume = false;
        let checkIsFirstStart = false;

        function clearSlideshowTimers() {
            if (slideshowTimeoutId) {
                clearTimeout(slideshowTimeoutId);
                slideshowTimeoutId = null;
            }
            if (downloadTimeoutId) {
                clearTimeout(downloadTimeoutId);
                downloadTimeoutId = null;
            }
        }

        function stopSlideshow() {
            clearSlideshowTimers();
            const stopwatchEl = container.querySelector('#grok-auto-stopwatch');
            if (stopwatchEl) stopwatchEl.textContent = '';
            slideshowActive   = false;
            slideshowPaused   = false;
            updateButtonStyles();
        }

        function nextSlide() {
            const key = slideshowOrientation === 'h' ? 'ArrowRight' : 'ArrowUp';
            document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        }

        function downloadIfChecked() {
            if (downloadType === 'none') return;
            const hasVideo = document.querySelector('video') !== null;
            if (downloadType === 'photo' && hasVideo) return;
            if (downloadType === 'video' && !hasVideo) return;
            triggerDownloadForCurrentSite();
        }

        function getArrowKeyForDirection(dir) {
            if (dir === 'up') return 'ArrowUp';
            if (dir === 'down') return 'ArrowDown';
            if (dir === 'left') return 'ArrowLeft';
            return 'ArrowRight';
        }

        function scrollToFarEnd(dir, callback) {
            const key = getArrowKeyForDirection(dir);
            let lastUrl = location.href;
            let unchangedCount = 0;
            const interval = setInterval(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                setTimeout(() => {
                    if (location.href === lastUrl) {
                        unchangedCount++;
                        if (unchangedCount >= 5) {
                            clearInterval(interval);
                            callback();
                        }
                    } else {
                        lastUrl = location.href;
                        unchangedCount = 0;
                    }
                }, 50);
            }, 100);
        }

        function loopBackToBottom(callback) {
            let lastUrl = location.href;
            let unchangedCount = 0;
            const vInterval = setInterval(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
                setTimeout(() => {
                    if (location.href === lastUrl) {
                        unchangedCount++;
                        if (unchangedCount >= 5) {
                            clearInterval(vInterval);
                            scrollToFarEnd('right', callback);
                        }
                    } else {
                        lastUrl = location.href;
                        unchangedCount = 0;
                    }
                }, 50);
            }, 100);
        }

        function loopBackToOpposite(dir, callback) {
            const oppDir = dir === 'left' ? 'right' : (dir === 'right' ? 'left' : (dir === 'up' ? 'down' : 'up'));
            scrollToFarEnd(oppDir, callback);
        }

        function performDpadStep(seconds) {
            if (slideshowDirections.length === 0) {
                stopSlideshow();
                return;
            }

            const delPubBtn = findButton(['Delete post', 'Удалить публикацию']);
            if (delPubBtn) {
                if (!slideshowRepeat) {
                    console.log('%c[Grok Slideshow] Достигнут первый пост и повтор выключен, останавливаем слайдшоу', 'color:#ef4444;');
                    stopSlideshow();
                    return;
                } else {
                    console.log('%c[Grok Slideshow] Достигнут первый пост, петля включена. Мотаем в самый вниз...', 'color:#3b82f6;');
                    loopBackToBottom(() => {
                        scheduleNextSlideCycle(seconds);
                    });
                    return;
                }
            }

            if (slideshowDirections.length === 1) {
                const dir = slideshowDirections[0];
                const key = getArrowKeyForDirection(dir);
                const beforeUrl = location.href;
                document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                setTimeout(() => {
                    if (location.href === beforeUrl) {
                        if (!slideshowRepeat) {
                            stopSlideshow();
                        } else {
                            loopBackToOpposite(dir, () => {
                                scheduleNextSlideCycle(seconds);
                            });
                        }
                    } else {
                        scheduleNextSlideCycle(seconds);
                    }
                }, 500);
            } else if (slideshowDirections.length === 2) {
                const hDir = slideshowDirections.find(d => d === 'left' || d === 'right');
                const vDir = slideshowDirections.find(d => d === 'up' || d === 'down');
                if (!hDir || !vDir) {
                    const dir = slideshowDirections[0];
                    const key = getArrowKeyForDirection(dir);
                    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
                    setTimeout(() => scheduleNextSlideCycle(seconds), 500);
                    return;
                }
                const hKey = getArrowKeyForDirection(hDir);
                const vKey = getArrowKeyForDirection(vDir);
                const beforeUrl = location.href;
                document.dispatchEvent(new KeyboardEvent('keydown', { key: hKey, bubbles: true }));
                setTimeout(() => {
                    if (location.href === beforeUrl) {
                        console.log('%c[Grok Slideshow] Уперлись по горизонтали, делаем шаг по вертикали', 'color:#3b82f6;');
                        const delPubBtnCheck = findButton(['Delete post', 'Удалить публикацию']);
                        if (delPubBtnCheck && vDir === 'up' && !slideshowRepeat) {
                            stopSlideshow();
                            return;
                        }
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: vKey, bubbles: true }));
                        setTimeout(() => {
                            if (location.href === beforeUrl) {
                                if (!slideshowRepeat) {
                                    stopSlideshow();
                                } else {
                                    loopBackToBottom(() => {
                                        scheduleNextSlideCycle(seconds);
                                    });
                                }
                            } else {
                                const oppHDir = hDir === 'left' ? 'right' : 'left';
                                scrollToFarEnd(oppHDir, () => {
                                    scheduleNextSlideCycle(seconds);
                                });
                            }
                        }, 500);
                    } else {
                        scheduleNextSlideCycle(seconds);
                    }
                }, 500);
            }
        }

        function executeSlideTransition(seconds) {
            const hasVideo = document.querySelector('video') !== null;
            let downloaded = false;
            if (downloadType !== 'none') {
                if (downloadType === 'all' || (downloadType === 'photo' && !hasVideo) || (downloadType === 'video' && hasVideo)) {
                    downloadIfChecked();
                    downloaded = true;
                }
            }
            if (pdAction === 'note') {
                addNotePrefix(downloaded);
                setTimeout(() => {
                    if (cbDelete && cbDelete.checked) {
                        runSmartDelete(() => {
                            scheduleNextSlideCycle(seconds);
                        });
                    } else {
                        performDpadStep(seconds);
                    }
                }, 150);
            } else {
                if (cbDelete && cbDelete.checked) {
                    runSmartDelete(() => {
                        scheduleNextSlideCycle(seconds);
                    });
                } else {
                    performDpadStep(seconds);
                }
            }
        }

        function scheduleNextSlideCycle(seconds) {
            clearSlideshowTimers();
            
            const stopwatchEl = container.querySelector('#grok-auto-stopwatch');
            if (stopwatchEl) stopwatchEl.textContent = '';

            if (!slideshowActive || slideshowPaused) {
                updateButtonStyles();
                return;
            }
            updateButtonStyles();

            if (slideshowMode === 'manual') {
                // ==========================================
                // MANUAL MODE
                // ==========================================
                slideshowTimeoutId = setTimeout(() => {
                    executeSlideTransition(currentInterval);
                }, currentInterval * 1000);
            } else {
                // ==========================================
                // AUTO MODE
                // ==========================================
                const video = document.querySelector('video');
                
                // Проверяем timerSilent при возврате фокуса/активности
                if (checkTimerSilentOnResume) {
                    checkTimerSilentOnResume = false;
                    if (video && !isNaN(video.duration) && video.duration > 0) {
                        let threshold = 5;
                        if (video.duration <= 7) threshold = 1;
                        else if (video.duration <= 12) threshold = 3;

                        if (video.currentTime > threshold) {
                            timerSilent = true;
                            console.log('%c[Grok Slideshow] Возобновлено mid-play, таймер уходит в тихий режим', 'color:#f59e0b;');
                        } else {
                            timerSilent = false;
                        }
                    } else {
                        timerSilent = false;
                    }
                } else if (checkIsFirstStart) {
                    checkIsFirstStart = false;
                    if (video && !isNaN(video.duration) && video.duration > 0) {
                        let threshold = 5;
                        if (video.duration <= 7) threshold = 1;
                        else if (video.duration <= 12) threshold = 3;

                        if (video.currentTime > threshold) {
                            timerSilent = true;
                            console.log('%c[Grok Slideshow] Запущено на середине видео, таймер уходит в тихий режим', 'color:#f59e0b;');
                        } else {
                            timerSilent = false;
                        }
                    } else {
                        timerSilent = false;
                    }
                } else {
                    timerSilent = false;
                }

                if (!video) {
                    // Фото: Ожидание (photoBaseSeconds) + обратный отсчет (countdownSeconds)
                    let elapsed = 0;
                    function photoTick() {
                        if (!slideshowActive || slideshowPaused || slideshowMode !== 'auto') return;

                        if (elapsed < photoBaseSeconds) {
                            if (stopwatchEl) {
                                stopwatchEl.textContent = `0:0${elapsed} / 0:0${photoBaseSeconds}`;
                                stopwatchEl.style.display = 'block';
                            }
                            elapsed++;
                            slideshowTimeoutId = setTimeout(photoTick, 1000);
                        } else {
                            let countdownLeft = countdownSeconds;
                            function countdownTick() {
                                if (!slideshowActive || slideshowPaused || slideshowMode !== 'auto') return;
                                if (countdownLeft > 0) {
                                    if (btnAuto) {
                                        btnAuto.textContent = countdownLeft < 10 ? `0${countdownLeft}` : `${countdownLeft}`;
                                    }
                                    countdownLeft--;
                                    slideshowTimeoutId = setTimeout(countdownTick, 1000);
                                } else {
                                    if (btnAuto) btnAuto.textContent = '00';
                                    slideshowTimeoutId = setTimeout(() => {
                                        executeSlideTransition(countdownSeconds);
                                    }, 500);
                                }
                            }
                            countdownTick();
                        }
                    }
                    photoTick();
                } else {
                    // Видео: поддержка n-полных кругов (videoTargetLoops) + обратный отсчет
                    let currentLoop = 1;
                    let prevTime = video.currentTime;

                    function videoPoll() {
                        if (!slideshowActive || slideshowPaused || slideshowMode !== 'auto') return;

                        const videoCurrent = document.querySelector('video');
                        if (!videoCurrent) {
                            scheduleNextSlideCycle(countdownSeconds);
                            return;
                        }

                        const cur = videoCurrent.currentTime;
                        const dur = videoCurrent.duration;

                        if (!isNaN(dur) && dur > 0) {
                            // Если произошел перезапуск круга
                            if (cur < prevTime - 0.5 && prevTime > dur - 1.5) {
                                currentLoop++;
                            }
                            prevTime = cur;

                            if (videoCurrent.ended || cur >= dur - 0.2) {
                                if (currentLoop < videoTargetLoops) {
                                    currentLoop++;
                                    videoCurrent.currentTime = 0;
                                    videoCurrent.play().catch(() => {});
                                } else {
                                    videoCurrent.pause();
                                    let countdownLeft = countdownSeconds;
                                    function videoCountdownTick() {
                                        if (!slideshowActive || slideshowPaused || slideshowMode !== 'auto') return;
                                        if (countdownLeft > 0) {
                                            if (btnAuto) {
                                                btnAuto.textContent = countdownLeft < 10 ? `0${countdownLeft}` : `${countdownLeft}`;
                                            }
                                            countdownLeft--;
                                            slideshowTimeoutId = setTimeout(videoCountdownTick, 1000);
                                        } else {
                                            if (btnAuto) btnAuto.textContent = '00';
                                            slideshowTimeoutId = setTimeout(() => {
                                                executeSlideTransition(countdownSeconds);
                                            }, 500);
                                        }
                                    }
                                    videoCountdownTick();
                                    return;
                                }
                            } else {
                                if (stopwatchEl) {
                                    const loopStr = videoTargetLoops > 1 ? `${currentLoop}/${videoTargetLoops} ` : '';
                                    stopwatchEl.textContent = `${loopStr}${formatTime(cur)} / ${formatTime(dur)}`;
                                }
                            }
                        } else {
                            if (stopwatchEl) {
                                stopwatchEl.textContent = '0:00 / 0:00';
                            }
                        }

                        slideshowTimeoutId = setTimeout(videoPoll, 100);
                    }
                    videoPoll();
                }
            }
        }

        function startSlideshow(seconds, mode) {
            if (!checkIsPostPage()) {
                alert("Слайдшоу можно запустить только на странице поста (изображения)!");
                return;
            }
            stopSlideshow();
            slideshowActive = true;
            slideshowMode   = mode || 'auto';
            setSiteStorageItem('slideshow_mode', slideshowMode);

            if (slideshowMode === 'auto') {
                currentInterval = countdownSeconds;
            } else {
                currentInterval = seconds;
                const mBtn = container.querySelector('#grok-btn-manual');
                if (mBtn) mBtn.textContent = currentInterval;
            }

            scheduleNextSlideCycle(currentInterval);
        }

        slideshowStart = () => startSlideshow(slideshowMode === 'manual' ? currentInterval : countdownSeconds, slideshowMode);
        slideshowStop  = stopSlideshow;
        slideshowResetTimer = () => scheduleNextSlideCycle(slideshowMode === 'manual' ? currentInterval : countdownSeconds);

        // Пауза/возобновление (Tab + Brsr)
        let tabVisible    = !document.hidden;
        let windowFocused = document.hasFocus();

        function checkPauseResume() {
            const shouldPause = (cbTab.checked && !tabVisible) || (cbBrsr.checked && !windowFocused);
            if (shouldPause) {
                if (slideshowActive) {
                    clearSlideshowTimers();
                    slideshowPaused = true;
                }
            } else {
                if (slideshowPaused) {
                    slideshowPaused = false;
                    startSlideshow(slideshowMode === 'manual' ? currentInterval : countdownSeconds, slideshowMode);
                }
            }
        }

        document.addEventListener('visibilitychange', () => {
            tabVisible = !document.hidden;
            checkPauseResume();
        });

        window.addEventListener('focus', () => {
            windowFocused = true;
            checkPauseResume();
        });

        window.addEventListener('blur', () => {
            setTimeout(() => {
                if (!document.hidden) windowFocused = false;
                checkPauseResume();
            }, 100);
        });

        btnManual.onclick = () => {
            if (slideshowActive && slideshowMode === 'manual') stopSlideshow();
            else startSlideshow(currentInterval, 'manual');
        };

        btnAuto.onclick = () => {
            if (slideshowActive && slideshowMode === 'auto') stopSlideshow();
            else startSlideshow(countdownSeconds, 'auto');
        };

        btnOrient.onclick = (e) => {
            e.stopImmediatePropagation();
            slideshowOrientation = slideshowOrientation === 'v' ? 'h' : 'v';
            setSiteStorageItem('slideshow_orientation', slideshowOrientation);
            btnOrient.textContent = slideshowOrientation === 'h' ? '↔' : '↕';
        };

        manualPlus.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = Math.min(currentInterval + 1, 100);
            btnManual.textContent = currentInterval;
            setSiteStorageItem('slideshow_interval', currentInterval);
            if (slideshowActive && slideshowMode === 'manual') startSlideshow(currentInterval, 'manual');
        };

        manualMinus.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = Math.max(currentInterval - 1, 3);
            btnManual.textContent = currentInterval;
            setSiteStorageItem('slideshow_interval', currentInterval);
            if (slideshowActive && slideshowMode === 'manual') startSlideshow(currentInterval, 'manual');
        };

        if (autoSecPlus) {
            autoSecPlus.onclick = (e) => {
                e.stopImmediatePropagation();
                countdownSeconds = Math.min(countdownSeconds + 1, 60);
                if (btnAuto) btnAuto.textContent = (countdownSeconds < 10 ? '0' + countdownSeconds : countdownSeconds) + 'с';
                setSiteStorageItem('slideshow_countdown_sec', countdownSeconds);
                if (slideshowActive && slideshowMode === 'auto') startSlideshow(countdownSeconds, 'auto');
            };
        }

        if (autoSecMinus) {
            autoSecMinus.onclick = (e) => {
                e.stopImmediatePropagation();
                countdownSeconds = Math.max(countdownSeconds - 1, 1);
                if (btnAuto) btnAuto.textContent = (countdownSeconds < 10 ? '0' + countdownSeconds : countdownSeconds) + 'с';
                setSiteStorageItem('slideshow_countdown_sec', countdownSeconds);
                if (slideshowActive && slideshowMode === 'auto') startSlideshow(countdownSeconds, 'auto');
            };
        }

        if (autoLoopMul) {
            autoLoopMul.onclick = (e) => {
                e.stopImmediatePropagation();
                videoTargetLoops = Math.min(videoTargetLoops + 1, 10);
                if (btnLoops) btnLoops.textContent = videoTargetLoops + 'х';
                setSiteStorageItem('slideshow_video_loops', videoTargetLoops);
                if (slideshowActive && slideshowMode === 'auto') startSlideshow(countdownSeconds, 'auto');
            };
        }

        if (autoLoopDiv) {
            autoLoopDiv.onclick = (e) => {
                e.stopImmediatePropagation();
                videoTargetLoops = Math.max(videoTargetLoops - 1, 1);
                if (btnLoops) btnLoops.textContent = videoTargetLoops + 'х';
                setSiteStorageItem('slideshow_video_loops', videoTargetLoops);
                if (slideshowActive && slideshowMode === 'auto') startSlideshow(countdownSeconds, 'auto');
            };
        }

        preset17.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 17;
            btnManual.textContent = 17;
            setSiteStorageItem('slideshow_interval', currentInterval);
            if (slideshowActive && slideshowMode === 'manual') startSlideshow(17, 'manual');
        };

        preset12.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 12;
            btnManual.textContent = 12;
            setSiteStorageItem('slideshow_interval', currentInterval);
            if (slideshowActive && slideshowMode === 'manual') startSlideshow(12, 'manual');
        };

        preset7.onclick = (e) => {
            e.stopImmediatePropagation();
            currentInterval = 7;
            btnManual.textContent = 7;
            setSiteStorageItem('slideshow_interval', currentInterval);
            if (slideshowActive && slideshowMode === 'manual') startSlideshow(7, 'manual');
        };

        const handleDivKey = (el) => {
            if (!el) return;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    el.click();
                }
            });
        };
        handleDivKey(preset17);
        handleDivKey(preset12);
        handleDivKey(preset7);
        handleDivKey(manualPlus);
        handleDivKey(manualMinus);
        handleDivKey(autoSecPlus);
        handleDivKey(autoSecMinus);
        handleDivKey(autoLoopMul);
        handleDivKey(autoLoopDiv);
    }

    // Инициализация виджета
    initWidget();

    // Отслеживание ручной смены URL во время слайдшоу для сброса счетчика
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            if (slideshowActive && !slideshowPaused && slideshowResetTimer) {
                console.log('%c[Grok Slideshow] URL сменился вручную, сбрасываем таймер', 'color:#3b82f6;');
                slideshowResetTimer();
            }
        }
    }, 200);

    console.log('%c[Grok Hotkeys + Slideshow] Все модули инициализированы', 'color:#10b981');

})();
