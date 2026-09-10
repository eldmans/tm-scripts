    // ============================================================
    // GROK: Smart Delete (3-dots fallback, a.confirm, hold-post)
    // ============================================================
    function getGrokNeighborPostUrl() {
        // 1. Проверяем карточки постов в текущем DOM
        const cards = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        const currentIdMatch = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
        const currentId = currentIdMatch ? currentIdMatch[1] : null;

        if (cards.length > 0 && currentId) {
            const urls = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
            const seen = new Map();
            for (const u of urls) {
                const m = u.match(/\/imagine\/post\/([^/?#]+)/);
                if (m && !seen.has(m[1])) seen.set(m[1], u);
            }
            const unique = Array.from(seen.keys());
            const idx = unique.indexOf(currentId);
            const dir = (config.slideshowDirections && config.slideshowDirections.length) ? config.slideshowDirections[0] : 'up';

            let targetId = null;
            if (dir === 'down' || dir === 'right') {
                targetId = (idx >= 0 && idx < unique.length - 1) ? unique[idx + 1] : (unique.length > 0 ? unique[0] : null);
            } else {
                targetId = (idx > 0) ? unique[idx - 1] : (unique.length > 0 ? unique[unique.length - 1] : null);
            }
            if (targetId && seen.get(targetId)) return seen.get(targetId);
        }

        // 2. Проверяем ссылки из сохраненной коллекции галереи
        try {
            const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (raw && currentId) {
                const items = (JSON.parse(raw).items || []).map(i => i.url || i);
                const idx = items.findIndex(u => u.includes(currentId));
                if (idx !== -1) {
                    const nextIdx = (idx + 1) % items.length;
                    return items[nextIdx];
                }
            }
        } catch (e) {}

        return null;
    }

    let _grokDeleteInProgress = false;

    async function runSmartDelete() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        if (_grokDeleteInProgress) return;
        _grokDeleteInProgress = true;

        try {
            blurActiveInput();
            const initialUrl = location.href;
            let finalTargetUrl = null;

            let targetFilmstripBtn = null;
            let targetFilmstripUuid = null;

            // 1. hold post: определяем целевой кадр / пост перед удалением
            if (config.deleteHoldpost) {
                // А. Приоритет: кадры на полосе киноплёнки (filmstrip)
                const items = (typeof grokGetFilmstripItems === 'function')
                    ? grokGetFilmstripItems()
                    : Array.from(document.querySelectorAll('[data-filmstrip-item="true"]'));

                if (items.length > 1) {
                    const currentIdx = items.findIndex(btn => 
                        btn.className.includes('ring-white') || 
                        location.pathname.includes(btn.querySelector('img')?.src.match(/generated\/([a-f0-9-]+)\//)?.[1] || '---')
                    );
                    const safeCurIdx = currentIdx !== -1 ? currentIdx : ((typeof grokGetActiveFilmstripIndex === 'function') ? grokGetActiveFilmstripIndex() : 0);
                    const nextIdx = (safeCurIdx + 1) % items.length;
                    targetFilmstripBtn = items[nextIdx];

                    const nextImgSrc = targetFilmstripBtn?.querySelector('img, video, source')?.src || '';
                    const m = nextImgSrc.match(/generated\/([a-f0-9-]+)\//);
                    targetFilmstripUuid = m ? m[1] : (typeof grokExtractUuid === 'function' ? grokExtractUuid(nextImgSrc) : null);
                    if (targetFilmstripUuid) {
                        finalTargetUrl = `/imagine/post/${targetFilmstripUuid}`;
                    }
                    console.log(`[MOSSAD] hold post: найден целевой кадр киноплёнки ${safeCurIdx + 1} -> ${nextIdx + 1} (UUID: ${targetFilmstripUuid || 'н/д'})`);
                } else {
                    // Б. Киноплёнка из 1 кадра или не найдена — ищем URL соседа по коллекции / DOM
                    finalTargetUrl = getGrokNeighborPostUrl();
                    console.log('[MOSSAD] hold post: киноплёнка одиночная/отсутствует, fallback URL соседа:', finalTargetUrl);
                }

                // В. Крайний фолбэк: шаг стрелками, если нет киноплёнки и не найден URL соседа
                if (!targetFilmstripBtn && !finalTargetUrl) {
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'up';
                    const forwardKey = getArrowKey(dPadDir);
                    const oppDir = dPadDir === 'up' ? 'down' : (dPadDir === 'down' ? 'up' : (dPadDir === 'left' ? 'right' : 'left'));
                    const backKey = getArrowKey(oppDir);

                    showToast('🔍 Фиксация позиции...');

                    const sendKey = (k) => {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                        document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
                    };

                    sendKey(forwardKey);
                    const peekStart = Date.now();
                    while (Date.now() - peekStart < 1500) {
                        await new Promise(r => setTimeout(r, 40));
                        if (location.href !== initialUrl && isGrokPostPage()) {
                            finalTargetUrl = location.href;
                            break;
                        }
                        if (Date.now() - peekStart > 350 && location.href === initialUrl && !finalTargetUrl) {
                            sendKey(forwardKey);
                        }
                    }

                    if (finalTargetUrl) {
                        console.log(`[MOSSAD] hold post: найден целевой финишный пост (fallback peek): ${finalTargetUrl}`);
                        sendKey(backKey);
                        const backStart = Date.now();
                        while (Date.now() - backStart < 1500) {
                            await new Promise(r => setTimeout(r, 40));
                            if (location.href === initialUrl) break;
                            if (Date.now() - backStart > 350 && location.href !== initialUrl) {
                                sendKey(backKey);
                            }
                        }
                        await new Promise(r => setTimeout(r, 250));
                    }
                }
            }

            // 2. Запуск удаления и подтверждения
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];

            let deleteConfirmed = false;
            const triggerConfirm = () => {
                if (!config.deleteAutoconfirm) return Promise.resolve(false);
                return new Promise((resolve) => {
                    retryAction((attempt) => {
                        const confirmKeywords = ['удалить изображение', 'удалить видео', 'удалить', 'delete', 'confirm', 'ok', 'yes', 'да'];
                        const dialog = document.querySelector('[role="dialog"]') || document;
                        const confirmBtn = findGrokButton(confirmKeywords, dialog);
                        if (confirmBtn) {
                            triggerClick(confirmBtn, 'Confirm Delete');
                            console.log('[MOSSAD] Delete confirmed on attempt', attempt);
                            deleteConfirmed = true;
                            resolve(true);
                            return true;
                        }
                        if (attempt === 4) resolve(false);
                        return false;
                    }, [100, 250, 450, 750]);
                });
            };

            const directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;

            if (directDelBtn) {
                triggerClick(directDelBtn, 'Delete Button');
                showToast('✕ Удаление...');
                deleteClicked = true;
            } else {
                const dotsBtn = findGrok3DotsMenuButton();
                if (dotsBtn) {
                    triggerClick(dotsBtn, 'Post actions (for Delete)');
                    deleteClicked = await new Promise((resolve) => {
                        retryAction((attempt) => {
                            const innerDel = findGrokButton(deleteBtnLabels);
                            if (innerDel) {
                                triggerClick(innerDel, 'Delete Button (from menu)');
                                showToast('✕ Удаление...');
                                resolve(true);
                                return true;
                            }
                            if (attempt === 3) resolve(false);
                            return false;
                        }, [100, 250, 450]);
                    });
                }
            }

            if (!deleteClicked) {
                showToast('⚠️ Кнопка удаления не найдена', true);
                _grokDeleteInProgress = false;
                return;
            }

            // Ожидаем подтверждения удаления
            await triggerConfirm();

            // 3. hold post: переход на следующий кадр / пост без перезагрузки страницы
            if (config.deleteHoldpost) {
                const executeTransition = () => {
                    // А. Приоритет: переключение по киноплёнке (только видео, без перезагрузки)
                    if (targetFilmstripBtn) {
                        console.log('[MOSSAD] hold post: переключаем кадр по киноплёнке (SPA, без перезагрузки)...');
                        showToast('🎯 Переход к следующему кадру...');

                        if (targetFilmstripBtn.isConnected) {
                            targetFilmstripBtn.click();
                            return;
                        }

                        // Если DOM обновился, ищем по UUID
                        if (targetFilmstripUuid && typeof grokFindFilmstripItemByUuid === 'function') {
                            const refetched = grokFindFilmstripItemByUuid(targetFilmstripUuid);
                            if (refetched) {
                                refetched.click();
                                return;
                            }
                        }

                        // Или первый доступный кадр в киноплёнке
                        const currentItems = (typeof grokGetFilmstripItems === 'function')
                            ? grokGetFilmstripItems()
                            : Array.from(document.querySelectorAll('[data-filmstrip-item="true"]'));
                        if (currentItems.length > 0) {
                            currentItems[0].click();
                            return;
                        }
                    }

                    // Б. Межпостовой переход через SPA-роутер (если киноплёнки не было)
                    if (finalTargetUrl) {
                        console.log(`[MOSSAD] hold post: переход на сохранённый URL: ${finalTargetUrl}`);
                        showToast('🎯 Переход к соседнему посту...');
                        if (typeof grokSpaNavigate === 'function') {
                            grokSpaNavigate(finalTargetUrl);
                        } else {
                            window.location.href = finalTargetUrl;
                        }
                    }
                };

                if (deleteConfirmed) {
                    // Небольшая задержка (150мс), чтобы сетевой запрос на удаление успел инициироваться
                    await new Promise(r => setTimeout(r, 150));
                    executeTransition();
                } else if (!config.deleteAutoconfirm) {
                    // При ручном подтверждении ждём закрытия диалога
                    const waitStart = Date.now();
                    const checkInterval = setInterval(() => {
                        const dialog = document.querySelector('[role="dialog"]');
                        if (!dialog || Date.now() - waitStart > 15000) {
                            clearInterval(checkInterval);
                            if (!dialog && Date.now() - waitStart < 14500) {
                                setTimeout(executeTransition, 150);
                            }
                        }
                    }, 100);
                } else {
                    // Фолбэк, если автоподтверждение не вернуло подтверждение
                    await new Promise(r => setTimeout(r, 300));
                    executeTransition();
                }
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }


