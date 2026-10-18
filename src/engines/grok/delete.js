    // ============================================================
    // GROK: Smart Delete (3-dots fallback, a.confirm, hold-post)
    // ============================================================
    function getGrokNeighborPostUrl(dirOverride = null, isDelete = false) {
        // 1. Проверяем карточки постов в текущем DOM
        const cards = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
        const currentIdMatch = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
        const currentId = currentIdMatch ? currentIdMatch[1] : null;

        const dirs = config.slideshowDirections;
        const dir = dirOverride || ((dirs && dirs.length) ? dirs[0] : 'down');
        const isFwd = (dir === 'down' || dir === 'right');
        const loop = !!config.loopFeed;

        if (cards.length > 0 && currentId) {
            const urls = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
            const seen = new Map();
            for (const u of urls) {
                const m = u.match(/\/imagine\/post\/([^/?#]+)/);
                if (m && !seen.has(m[1])) seen.set(m[1], u);
            }
            const unique = Array.from(seen.keys());
            const idx = unique.indexOf(currentId);

            let targetId = null;
            if (isFwd) {
                if (idx >= 0 && idx < unique.length - 1) {
                    targetId = unique[idx + 1];
                } else if (loop && unique.length > 0) {
                    targetId = unique[0];
                } else if (isDelete && !loop && idx > 0) {
                    targetId = unique[idx - 1];
                }
            } else {
                if (idx > 0) {
                    targetId = unique[idx - 1];
                } else if (loop && unique.length > 0) {
                    targetId = unique[unique.length - 1];
                } else if (isDelete && !loop && idx < unique.length - 1) {
                    targetId = unique[idx + 1];
                }
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
                    let nextIdx = -1;
                    if (isFwd) {
                        if (idx + 1 < items.length) {
                            nextIdx = idx + 1;
                        } else if (loop) {
                            nextIdx = 0;
                        } else if (isDelete && !loop && idx > 0) {
                            nextIdx = idx - 1;
                        }
                    } else {
                        if (idx > 0) {
                            nextIdx = idx - 1;
                        } else if (loop) {
                            nextIdx = items.length - 1;
                        } else if (isDelete && !loop && idx + 1 < items.length) {
                            nextIdx = idx + 1;
                        }
                    }
                    if (nextIdx !== -1 && items[nextIdx]) return items[nextIdx];
                }
            }
        } catch (e) {}

        return null;
    }

    // ── Диалог подтверждения удаления (v1.3.37) ──
    const GROK_DIALOG_SELECTOR = '[role="alertdialog"], [role="dialog"], [aria-modal="true"]';
    const GROK_CANCEL_WORDS = ['отмена', 'отменить', 'cancel', 'закрыть', 'close', 'нет', 'no'];
    const GROK_CONFIRM_RE = /удалить|delete|подтвердить|confirm/;
    const GROK_CONFIRM_EXACT = ['да', 'yes', 'ok', 'ок'];
    // v1.3.38: точные подписи кнопки подтверждения в приоритете (англ. UI Grok: «Delete video»)
    const GROK_CONFIRM_PRIORITY = [
        'delete video', 'delete image', 'delete post', 'delete',
        'удалить видео', 'удалить изображение', 'удалить пост', 'удалить'
    ];

    function _btnLabel(btn) {
        const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
        const txt = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return { aria, txt };
    }

    /**
     * Одиночный клик для шагов удаления (v1.3.38). Общий triggerClick() шлёт синтетический click И вызывает
     * el.click() — это ДВА клика: на кнопке-триггере диалога второй клик может закрыть только что открытый
     * диалог, а на подтверждении — отправить второй запрос. Здесь: pointer/mouse down/up + один el.click().
     */
    function grokDeleteClickOnce(el, label) {
        if (!el) return;
        ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => {
            try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 })); } catch(e) {}
        });
        try { el.click(); } catch(e) {}
        mossadDebug('delete', `клик: ${label}`, { text: (el.textContent || '').trim().slice(0, 40), aria: el.getAttribute('aria-label') || '' });
    }

    function _isVisibleEl(el) {
        return !!el && el.isConnected && !(el.offsetWidth === 0 && el.offsetHeight === 0 &&
            (!el.getClientRects || !el.getClientRects().length));
    }

    /** Все видимые диалоги страницы (кроме окон MOSSAD). */
    function listGrokDialogs() {
        return Array.from(document.querySelectorAll(GROK_DIALOG_SELECTOR))
            .filter(d => _isVisibleEl(d) && !(d.id || '').startsWith('mossad-') && !d.closest('[id^="mossad-"]'));
    }

    /** Кнопка — подтверждение удаления (а не «Отмена» и не исходная кнопка «Удалить» поста)? */
    function isGrokConfirmButton(btn, excludeBtn = null) {
        if (!btn || btn === excludeBtn) return false;
        const label = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.textContent || '')).trim().toLowerCase();
        if (!label) return false;
        if (GROK_CANCEL_WORDS.some(w => label === w || label.startsWith(w + ' '))) return false;
        return GROK_CONFIRM_RE.test(label) || GROK_CONFIRM_EXACT.includes(label);
    }

    function findGrokConfirmButtonIn(dialog, excludeBtn = null) {
        if (!dialog || !dialog.isConnected) return null;
        const btns = Array.from(dialog.querySelectorAll('button, [role="button"]'))
            .filter(b => _isVisibleEl(b) && b !== excludeBtn && !b.disabled);
        // 1) Точное совпадение подписи по приоритету («Delete video» → … → «Удалить»)
        for (const want of GROK_CONFIRM_PRIORITY) {
            const exact = btns.find(b => { const l = _btnLabel(b); return l.txt === want || l.aria === want; });
            if (exact && isGrokConfirmButton(exact, excludeBtn)) return exact;
        }
        // 2) Любая кнопка подтверждения (содержит delete/удалить/confirm…, не «Отмена»)
        return btns.find(b => isGrokConfirmButton(b, excludeBtn)) || null;
    }

    /** Новый (появившийся после клика «Удалить») диалог с кнопкой подтверждения; самый верхний. */
    function findGrokConfirmDialog(preDialogs, excludeBtn = null) {
        const fresh = listGrokDialogs().filter(d => !preDialogs.has(d) && findGrokConfirmButtonIn(d, excludeBtn));
        if (fresh.length) return fresh[fresh.length - 1];
        // Фолбэк: alertdialog, даже если существовал раньше (Grok может переиспользовать узел)
        const alerts = listGrokDialogs().filter(d => d.getAttribute('role') === 'alertdialog' && findGrokConfirmButtonIn(d, excludeBtn));
        return alerts.length ? alerts[alerts.length - 1] : null;
    }

    function isGrokDialogOpen(dialog) {
        return _isVisibleEl(dialog) && dialog.getAttribute('data-state') !== 'closed';
    }

    let _grokDeleteInProgress = false;

    async function runSmartDelete() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        if (_grokDeleteInProgress) return;
        _grokDeleteInProgress = true;

        try {
            blurActiveInput();
            const initialUrl = location.href;
            mossadDebug('delete', 'старт удаления', { holdpost: !!config.deleteHoldpost, autoconfirm: !!config.deleteAutoconfirm });
            let finalTargetUrl = null;

            let targetFilmstripBtn = null;
            let targetFilmstripUuid = null;

            // 1. hold post: определяем целевой кадр / пост перед удалением
            if (config.deleteHoldpost) {
                // А. Приоритет: кадры на полосе киноплёнки (filmstrip)
                const items = grokGetFilmstripItems();

                if (items.length > 1) {
                    const currentIdx = items.findIndex(btn => 
                        btn.className.includes('ring-white') || 
                        location.pathname.includes(btn.querySelector('img')?.src.match(/generated\/([a-f0-9-]+)\//)?.[1] || '---')
                    );
                    const safeCurIdx = currentIdx !== -1 ? currentIdx : (grokGetActiveFilmstripIndex());
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    const isFwd = (dPadDir === 'down' || dPadDir === 'right');
                    const loop = !!config.loopFeed;

                    let nextIdx;
                    if (isFwd) {
                        // Д-пад вниз/вправо: шагаем на следующее видео вниз по ленте
                        if (safeCurIdx + 1 < items.length) {
                            nextIdx = safeCurIdx + 1;
                        } else if (loop) {
                            nextIdx = 0; // петля R: в начало
                        } else {
                            nextIdx = safeCurIdx > 0 ? safeCurIdx - 1 : 0; // R выключен: не зацикливаем, отступаем назад
                        }
                    } else {
                        // Д-пад вверх/влево: шагаем на предыдущее видео вверх по ленте (на 4-е от 5-го)
                        if (safeCurIdx > 0) {
                            nextIdx = safeCurIdx - 1;
                        } else if (loop) {
                            nextIdx = items.length - 1; // петля R: в конец
                        } else {
                            nextIdx = items.length > 1 ? 1 : 0; // R выключен: не зацикливаем, отступаем вперёд
                        }
                    }
                    targetFilmstripBtn = items[nextIdx];

                    const nextImgSrc = targetFilmstripBtn?.querySelector('img, video, source')?.src || '';
                    const m = nextImgSrc.match(/generated\/([a-f0-9-]+)\//);
                    targetFilmstripUuid = m ? m[1] : (grokExtractUuid(nextImgSrc));
                    if (targetFilmstripUuid) {
                        finalTargetUrl = `/imagine/post/${targetFilmstripUuid}`;
                    }
                    mossadDebug('delete', 'hold post: цель по киноплёнке', { from: safeCurIdx + 1, to: nextIdx + 1, uuid: targetFilmstripUuid || '' });
                    console.log(`[MOSSAD] hold post: DPad=${dPadDir} (${isFwd ? 'вниз' : 'вверх'}), целевой кадр: ${safeCurIdx + 1} -> ${nextIdx + 1} (UUID: ${targetFilmstripUuid || 'н/д'}, loop=${loop})`);
                } else {
                    // Б. Киноплёнка из 1 кадра или не найдена — ищем URL соседа по коллекции / DOM
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    finalTargetUrl = getGrokNeighborPostUrl(dPadDir, true);
                    console.log('[MOSSAD] hold post: киноплёнка одиночная/отсутствует, fallback URL соседа:', finalTargetUrl);
                    mossadDebug('delete', 'hold post: цель — сосед по коллекции/DOM', { url: finalTargetUrl || '' });
                }

                // В. Крайний фолбэк: шаг стрелками, если нет киноплёнки и не найден URL соседа
                if (!targetFilmstripBtn && !finalTargetUrl) {
                    const dirs = config.slideshowDirections;
                    const dPadDir = (dirs && dirs.length) ? dirs[0] : 'down';
                    const forwardKey = getArrowKey(dPadDir);
                    const oppDir = dPadDir === 'up' ? 'down' : (dPadDir === 'down' ? 'up' : (dPadDir === 'left' ? 'right' : 'left'));
                    const backKey = getArrowKey(oppDir);

                    showToast('🔍 Фиксация позиции...');

                    const sendKey = (k) => {
                        if (typeof sendDpadKeyEvent === 'function') {
                            sendDpadKeyEvent(k);
                        } else {
                            document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
                            document.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
                        }
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
            // v1.3.37: страница поста Grok сама является [role="dialog"] (просмотрщик), поэтому старый поиск
            // `document.querySelector('[role="dialog"]')` находил просмотрщик, «подтверждал» повторным кликом
            // по кнопке «Удалить» самого поста и сразу уходил на соседа, пока настоящий диалог висел открытым.
            // Теперь: ищем только НОВЫЙ диалог (появившийся после клика), кнопку подтверждения — только внутри
            // него, и переходим на соседа ТОЛЬКО после подтверждения и закрытия диалога (ANTI_PATTERNS §16).
            const deleteBtnLabels = [
                'удалить видео', 'delete video',
                'удалить изображение', 'delete image',
                'удалить', 'delete'
            ];
            const preDialogs = new Set(listGrokDialogs());

            let directDelBtn = findGrokButton(deleteBtnLabels);
            let deleteClicked = false;
            let clickedDelBtn = null;

            mossadDebug('delete', directDelBtn ? 'кнопка удаления найдена' : 'кнопки удаления нет — пробуем меню «⋯»', { preDialogs: preDialogs.size });
            if (directDelBtn) {
                grokDeleteClickOnce(directDelBtn, 'Delete Button');
                clickedDelBtn = directDelBtn;
                showToast('✕ Удаление...');
                deleteClicked = true;
            } else {
                const dotsBtn = findGrok3DotsMenuButton();
                if (dotsBtn) {
                    grokDeleteClickOnce(dotsBtn, 'Post actions (for Delete)');
                    const innerDel = await waitForCondition(() => findGrokButton(deleteBtnLabels), 1500, 100);
                    if (innerDel) {
                        grokDeleteClickOnce(innerDel, 'Delete Button (from menu)');
                        clickedDelBtn = innerDel;
                        showToast('✕ Удаление...');
                        deleteClicked = true;
                    }
                }
            }

            if (!deleteClicked) {
                mossadDebug('delete', 'СТОП: кнопка удаления не найдена');
                showToast('⚠️ Кнопка удаления не найдена', true);
                return;
            }

            const filmstripCountBefore = grokGetFilmstripItems().length;
            const confirmDialog = await waitForCondition(
                () => findGrokConfirmDialog(preDialogs, clickedDelBtn), 3000, 50);

            mossadDebug('delete', confirmDialog ? 'диалог подтверждения найден' : 'диалог подтверждения НЕ появился за 3 с', confirmDialog ? {
                role: confirmDialog.getAttribute('role') || '',
                btn: ((findGrokConfirmButtonIn(confirmDialog, clickedDelBtn) || {}).textContent || '').trim().slice(0, 30)
            } : undefined);
            let deleteConfirmed = false;
            if (!confirmDialog) {
                // Диалог не появился: считаем удаление выполненным, только если есть признаки удаления
                const removed = await waitForCondition(() =>
                    location.href !== initialUrl ||
                    (filmstripCountBefore > 1 && grokGetFilmstripItems().length < filmstripCountBefore), 2000, 100);
                if (removed) {
                    deleteConfirmed = true;
                    mossadDebug('delete', 'удалено без диалога (есть признаки удаления)');
                } else {
                    console.warn('[MOSSAD] Delete: диалог подтверждения не найден, переход отменён');
                    showToast('⚠️ Диалог подтверждения не найден — переход отменён', true);
                }
            } else {
                // Фиксируем ручные клики пользователя по кнопкам диалога (Удалить / Отмена)
                let userChoice = null; // 'confirm' | 'cancel'
                const onDialogClick = (ev) => {
                    const b = ev.target && ev.target.closest && ev.target.closest('button, [role="button"]');
                    if (!b || !confirmDialog.contains(b)) return;
                    userChoice = isGrokConfirmButton(b, clickedDelBtn) ? 'confirm' : 'cancel';
                };
                const onDialogKey = (ev) => {
                    if (ev.key === 'Escape') userChoice = 'cancel';
                    // Enter на сфокусированной кнопке подтверждения (браузер сам превратит его в click)
                    if (ev.key === 'Enter' && document.activeElement && confirmDialog.contains(document.activeElement) &&
                        isGrokConfirmButton(document.activeElement, clickedDelBtn)) userChoice = 'confirm';
                };
                document.addEventListener('click', onDialogClick, true);
                document.addEventListener('keydown', onDialogKey, true);
                const isClosed = () => !isGrokDialogOpen(confirmDialog);

                try {
                    if (config.deleteAutoconfirm) {
                        const confirmBtn = await waitForCondition(
                            () => findGrokConfirmButtonIn(confirmDialog, clickedDelBtn), 2000, 50);
                        if (confirmBtn) {
                            // Даём Radix закончить анимацию открытия (иначе клик может уйти в «пустоту»)
                            await new Promise(r => setTimeout(r, 120));
                            grokDeleteClickOnce(confirmBtn, 'Confirm Delete');
                            console.log('[MOSSAD] Delete: подтверждение нажато, ждём закрытия диалога');
                            if (await waitForCondition(isClosed, 5000, 50)) deleteConfirmed = true;
                            if (!deleteConfirmed && !isClosed()) {
                                // Вторая попытка: фокус + Enter-эквивалент через повторный одиночный клик
                                mossadDebug('delete', 'диалог не закрылся за 5 с — повторное подтверждение');
                                const again = findGrokConfirmButtonIn(confirmDialog, clickedDelBtn);
                                if (again) {
                                    try { again.focus({ preventScroll: true }); } catch(e) {}
                                    grokDeleteClickOnce(again, 'Confirm Delete (retry)');
                                    if (await waitForCondition(isClosed, 3000, 50)) deleteConfirmed = true;
                                }
                            }
                            mossadDebug('delete', deleteConfirmed ? 'подтверждено, диалог закрыт' : 'автоподтверждение не удалось');
                        } else {
                            mossadDebug('delete', 'кнопка подтверждения в диалоге не найдена');
                        }
                        if (!deleteConfirmed && !isClosed()) {
                            showToast('⚠️ Не удалось подтвердить автоматически — подтвердите вручную', true);
                        }
                    } else {
                        // v1.3.38: без автоподтверждения — ставим фокус на «Delete video», чтобы Enter подтверждал.
                        // Radix при открытии сам фокусирует «Cancel», поэтому повторяем фокус после монтирования.
                        const focusConfirm = () => {
                            if (isClosed() || userChoice) return;
                            const b = findGrokConfirmButtonIn(confirmDialog, clickedDelBtn);
                            if (b && document.activeElement !== b) {
                                try { b.focus({ preventScroll: true }); } catch(e) {}
                            }
                        };
                        focusConfirm();
                        [60, 200, 450].forEach(ms => setTimeout(focusConfirm, ms));
                        mossadDebug('delete', 'ручной режим: фокус на кнопке подтверждения (Enter = удалить)');
                        showToast('🗑 Enter — удалить, Esc — отмена');
                    }

                    if (!deleteConfirmed && !isClosed()) {
                        // Ручное подтверждение: ждём закрытия диалога до 60 с
                        await waitForCondition(isClosed, 60000, 100);
                        deleteConfirmed = isClosed() && userChoice === 'confirm';
                        mossadDebug('delete', 'ручной режим: диалог закрыт', { userChoice, deleteConfirmed });
                        if (isClosed() && userChoice !== 'confirm') {
                            console.log('[MOSSAD] Delete: диалог закрыт без подтверждения — остаёмся на посту');
                        }
                    }
                } finally {
                    document.removeEventListener('click', onDialogClick, true);
                    document.removeEventListener('keydown', onDialogKey, true);
                }
            }

            // 2б. v1.3.38: ждём признаков фактического удаления (до 4 с), а не фиксированные 150 мс
            let grokNavigatedItself = false;
            if (deleteConfirmed && config.deleteHoldpost) {
                const removedSignal = await waitForCondition(() => {
                    if (location.href !== initialUrl) return 'url';
                    if (filmstripCountBefore > 1 && grokGetFilmstripItems().length < filmstripCountBefore) return 'filmstrip';
                    return null;
                }, 4000, 100);
                grokNavigatedItself = removedSignal === 'url';
                mossadDebug('delete', removedSignal ? `удаление подтверждено признаком: ${removedSignal}` : 'нет явного признака за 4 с (диалог закрыт после подтверждения — продолжаем)', { url: location.pathname });
            }

            // 3. hold post: переход на следующий кадр / пост — только после подтверждённого удаления
            if (config.deleteHoldpost && deleteConfirmed) {
                const executeTransition = () => {
                    // А. Приоритет: переключение по киноплёнке (только видео, без перезагрузки)
                    if (targetFilmstripBtn) {
                        console.log('[MOSSAD] hold post: переключаем кадр по киноплёнке (SPA, без перезагрузки)...');
                        showToast('🎯 Переход к следующему кадру...');

                        if (targetFilmstripBtn.isConnected && !grokNavigatedItself) {
                            mossadDebug('delete', 'hold post: клик по целевому кадру');
                            targetFilmstripBtn.click();
                            return;
                        }

                        // Если DOM обновился, ищем по UUID
                        if (targetFilmstripUuid) {
                            const refetched = grokFindFilmstripItemByUuid(targetFilmstripUuid);
                            if (refetched) {
                                mossadDebug('delete', 'hold post: клик по целевому кадру (найден заново по UUID)');
                                refetched.click();
                                return;
                            }
                        }

                        // Если есть URL цели — надёжнее перейти по нему, чем кликать «первый попавшийся» кадр
                        if (!finalTargetUrl) {
                            const currentItems = grokGetFilmstripItems();
                            if (currentItems.length > 0 && !grokNavigatedItself) {
                                mossadDebug('delete', 'hold post: цель не найдена — первый кадр киноплёнки');
                                currentItems[0].click();
                                return;
                            }
                        }
                    }

                    // Б. Межпостовой переход через SPA-роутер (если киноплёнки не было)
                    if (finalTargetUrl) {
                        const curU = (grokExtractUuid(location.pathname) || '').toLowerCase();
                        const tgtU = (grokExtractUuid(finalTargetUrl) || '').toLowerCase();
                        if (curU && tgtU && curU === tgtU) {
                            mossadDebug('delete', 'hold post: Grok уже открыл целевой пост — переход не нужен');
                            return;
                        }
                        mossadDebug('delete', 'hold post: переход по URL цели', { url: finalTargetUrl });
                        console.log(`[MOSSAD] hold post: переход на сохранённый URL: ${finalTargetUrl}`);
                        showToast('🎯 Переход к соседнему посту...');
                        if (typeof grokSpaNavigate === 'function') {
                            grokSpaNavigate(finalTargetUrl);
                        } else {
                            window.location.href = finalTargetUrl;
                        }
                    }
                };

                // Небольшая пауза, чтобы Grok перерисовал киноплёнку после удаления
                await new Promise(r => setTimeout(r, 150));
                executeTransition();
            } else if (config.deleteHoldpost) {
                mossadDebug('delete', 'hold post: переход отменён (удаление не подтверждено)');
            }
        } finally {
            setTimeout(() => {
                _grokDeleteInProgress = false;
            }, 1200);
        }
    }


