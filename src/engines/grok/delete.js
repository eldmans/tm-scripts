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

            // hold post: предварительный шаг в направлении DPad и возврат для надежной фиксации целевого URL
            if (config.deleteHoldpost) {
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

                // 1. Листаем вперед в сторону DPad
                sendKey(forwardKey);

                // Ждем смены URL на целевой пост
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

                // 2. Листаем обратно на исходный пост
                if (finalTargetUrl) {
                    console.log(`[MOSSAD] hold post: найден целевой финишный пост: ${finalTargetUrl}`);
                    sendKey(backKey);

                    const backStart = Date.now();
                    while (Date.now() - backStart < 1500) {
                        await new Promise(r => setTimeout(r, 40));
                        if (location.href === initialUrl) break;
                        if (Date.now() - backStart > 350 && location.href !== initialUrl) {
                            sendKey(backKey);
                        }
                    }
                    await new Promise(r => setTimeout(r, 250)); // пауза для готовности DOM исходного поста
                } else {
                    // Фолбэк на анализ DOM / коллекцию, если шаг не изменил URL
                    finalTargetUrl = getGrokNeighborPostUrl();
                    console.warn('[MOSSAD] hold post: шаг вперед не изменил URL, fallback:', finalTargetUrl);
                }
            }

            // 3. Запуск удаления и подтверждения
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];

            const triggerConfirm = () => {
                if (!config.deleteAutoconfirm) return;
                retryAction((attempt) => {
                    const confirmKeywords = ['удалить изображение', 'удалить видео', 'удалить', 'delete', 'confirm', 'ok', 'yes', 'да'];
                    const dialog = document.querySelector('[role="dialog"]') || document;
                    const confirmBtn = findGrokButton(confirmKeywords, dialog);
                    if (confirmBtn) {
                        triggerClick(confirmBtn, 'Confirm Delete');
                        console.log('[MOSSAD] Delete confirmed on attempt', attempt);
                        return true;
                    }
                    return false;
                }, [100, 250, 450, 750]);
            };

            const directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;

            if (directDelBtn) {
                triggerClick(directDelBtn, 'Delete Button');
                showToast('✕ Удаление...');
                triggerConfirm();
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
                                triggerConfirm();
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

            // 4. Если включен hold post и зафиксирован finalTargetUrl:
            // ждем, пока сменится URL (пост удалился и Grok перекинул со страницы),
            // и в этот момент немедленно переходим на целевой сохранённый URL
            if (config.deleteHoldpost && finalTargetUrl) {
                const waitStart = Date.now();
                let urlRedirected = false;
                while (Date.now() - waitStart < 8000) {
                    await new Promise(r => setTimeout(r, 40));
                    if (location.href !== initialUrl) {
                        urlRedirected = true;
                        break;
                    }
                }

                console.log(`[MOSSAD] hold post: удаление завершено (смена URL: ${urlRedirected}). Переход на: ${finalTargetUrl}`);
                showToast('🎯 Переход к сохранённому посту...');
                window.location.href = finalTargetUrl;
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }

    // Граница: только на странице поста grok.com/imagine/post/... работают DL, Delete, слайдшоу и т.д.
    const isGrokPostPage  = () => rootDomain === 'grok.com' && /\/imagine\/post\//.test(location.pathname);
    const isGrokSavedPage = () => rootDomain === 'grok.com' && /\/imagine\/saved/.test(location.pathname);

