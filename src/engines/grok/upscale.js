    // ============================================================
    // GROK: PageUp Upscale (RU/EN, Case-insensitive, Submenu -> 720p)
    // ============================================================
    function runGrokUpscale() {
        if (rootDomain !== 'grok.com' || !isGrokPostPage()) return;
        blurActiveInput();

        const upscaleKeywords = ['upscale', 'enhance', 'improve quality', 'повысить качество', 'улучшить качество', 'увеличить'];

        const triggerPhase2Submenu = () => {
            // Фаза 2: выбор «Увеличить до 720p» / «Upscale to 720p» / «720p»
            const target720pKeywords = ['увеличить до 720p', 'upscale to 720p', '720p'];
            retryAction((attempt) => {
                const subItem = findGrokButton(target720pKeywords);
                if (subItem) {
                    triggerClick(subItem, 'Upscale to 720p');
                    showToast('✅ Увеличение до 720p запущено');
                    return true; // прерывает попытки
                }
                if (attempt === 3) {
                    showToast('ℹ️ Меню 720p не появилось', true);
                }
                return false;
            }, [100, 300, 500]);
        };

        // Фаза 1: ищем основную кнопку Upscale
        const directBtn = findGrokButton(upscaleKeywords);
        if (directBtn) {
            triggerClick(directBtn, 'Upscale Phase 1');
            triggerPhase2Submenu();
            return;
        }

        // Если прямой кнопки нет — пробуем через 3 точки
        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Upscale)');
            retryAction((attempt) => {
                const menuBtn = findGrokButton(upscaleKeywords);
                if (menuBtn) {
                    triggerClick(menuBtn, 'Upscale Phase 1 from 3-dots');
                    triggerPhase2Submenu();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
        } else {
            showToast('⚠️ Кнопка Upscale не найдена', true);
        }
    }

    // ============================================================
