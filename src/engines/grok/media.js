    // ============================================================
    // GROK: Prompt & Media Finders
    // ============================================================

    /**
     * Извлекает текст промпта для текущего поста Imagine.
     */
    function getGrokCurrentPrompt() {
        // 1. Поле ввода промпта (textarea или contenteditable)
        const ta = document.querySelector('textarea, div[contenteditable="true"]');
        if (ta) {
            const val = (ta.value !== undefined ? ta.value : (ta.innerText || ta.textContent || '')).trim();
            if (val) return val;
        }

        // 2. Alt-атрибут главного изображения поста
        const mainImg = document.querySelector('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img');
        if (mainImg) {
            const alt = (mainImg.getAttribute('alt') || '').trim();
            if (alt && alt.length > 2 && !/^(pfp|profile|avatar|logo|image)$/i.test(alt)) {
                return alt;
            }
        }

        // 3. Мета-теги OpenGraph / description
        const metaDesc = document.querySelector('meta[property="og:description"], meta[name="description"]');
        if (metaDesc) {
            const content = (metaDesc.getAttribute('content') || '').trim();
            if (content && !content.toLowerCase().includes('grok is an ai') && !content.toLowerCase().includes('imagine anything')) {
                return content;
            }
        }

        // 4. Текстовые блоки с классом prose или атрибутами
        const promptBlock = document.querySelector('[data-testid*="prompt"], .prose');
        if (promptBlock && promptBlock.textContent.trim()) {
            return promptBlock.textContent.trim();
        }

        return '';
    }

    /**
     * Находит активный медиа-элемент на странице поста Grok (видео или изображение).
     */
    function getGrokMedia() {
        // 1. Видео
        const video = getActiveVideo() || document.querySelector('main video, div[role="dialog"] video, video');
        if (video) {
            let src = '';
            const sources = Array.from(video.querySelectorAll('source'));
            for (const s of sources) {
                if (s.src) { src = s.src; break; }
            }
            if (!src && video.currentSrc) src = video.currentSrc;
            if (!src && video.src) src = video.src;
            if (src) return { url: src, type: 'video', ext: 'mp4' };
        }

        // 2. Изображение
        const candidates = Array.from(document.querySelectorAll('main img, div[role="dialog"] img, [data-filmstrip-item="true"] img, img'));
        const validImgs = candidates.filter(img => {
            if (!img.src) return false;
            const s = img.src.toLowerCase();
            if (s.includes('avatar') || s.includes('profile') || s.includes('pfp') || s.includes('icon')) return false;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            return (w >= 150 && h >= 150) || s.includes('share-images') || s.includes('imagine-public') || s.includes('assets.grok.com');
        }).sort((a, b) => {
            const areaA = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
            const areaB = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
            return areaB - areaA;
        });

        if (validImgs.length > 0) {
            const bestImg = validImgs[0];
            let ext = 'jpg';
            const srcLower = bestImg.src.toLowerCase();
            if (srcLower.includes('.png')) ext = 'png';
            else if (srcLower.includes('.webp')) ext = 'webp';
            return { url: bestImg.src, type: 'photo', ext };
        }

        return null;
    }

    /**
     * Извлекает текущую модель генерации Grok (или возвращает дефолтное 'Grok Imagine').
     */
    function getGrokCurrentModel() {
        const selectors = [
            'button[aria-haspopup="menu"] span',
            'button[data-testid*="model"]',
            '[aria-label*="model" i]',
            '[aria-label*="режим" i]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
                const txt = el.textContent.trim();
                if (/grok|flux|aurora|imagine/i.test(txt)) {
                    return txt;
                }
            }
        }
        return 'Grok Imagine';
    }

    /**
     * Вычисляет короткий хэш промпта (12 hex символов).
     */
    function computeGrokPromptHash(str) {
        if (!str) return '';
        let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, '0').slice(-12);
    }

    /**
     * Фолбэк на клик нативной кнопки Download при невозможности прямой загрузки.
     * Поиск строго по aria-label="download".
     */
    function fallbackGrokNativeClick(onSuccess) {
        let directBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
            const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
            return aria === 'download';
        });

        if (directBtn) {
            triggerClick(directBtn, 'Grok Direct Download (Fallback)');
            if (onSuccess) onSuccess();
            return;
        }

        const dotsBtn = findGrok3DotsMenuButton();
        if (dotsBtn) {
            triggerClick(dotsBtn, 'Post actions (for Fallback Download)');
            retryAction((attempt) => {
                const innerDl = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
                    const aria = (b.getAttribute('aria-label') || '').trim().toLowerCase();
                    return aria === 'download';
                });
                if (innerDl) {
                    triggerClick(innerDl, 'Grok Download from 3-dots (Fallback)');
                    if (onSuccess) onSuccess();
                    return true;
                }
                return false;
            }, [100, 300, 500]);
        }
    }
