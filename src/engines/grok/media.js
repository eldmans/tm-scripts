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

    // ── v1.3.42: быстрое определение «видео или фото» на странице поста ──
    // Раньше слайдшоу ждало до 6 с (см. CHANGELOG v1.3.42, ANTI_PATTERNS §21). Теперь признаки
    // берутся только из просмотрщика текущего поста (без киноплёнки и без кнопок MOSSAD).

    /** <video> просмотрщика поста (без кадров киноплёнки и без элементов MOSSAD). */
    function grokGetViewerVideos() {
        return Array.from(document.querySelectorAll('video')).filter(v =>
            v.isConnected && !v.closest(GROK_FILMSTRIP_SEL) && !v.closest('#mossad-widget, [id^="mossad-"]'));
    }

    /**
     * v1.3.43: лучший <video> поста из списка. Раньше брали «самое видимое», при равенстве — первое в DOM.
     * После круга (повтор) Grok может держать в DOM старый элемент того же поста (на паузе, «замёрзший»
     * на ~1 с) раньше свежего — слайдшоу считало круги по нему и висело. Теперь важнее: src с UUID
     * текущего поста, видео играет, есть данные (readyState), затем видимая площадь.
     */
    /** v1.3.43: src ролика указывает на ДРУГУЮ генерацию (…/generated/<uuid>/…), не на текущий пост. */
    function grokIsForeignVideo(v) {
        const uuid = grokExtractUuid(location.pathname);
        if (!uuid || !v) return false;
        const src = (v.currentSrc || v.src || '').toLowerCase();
        const m = src.match(/(?:generated|post)\/([a-f0-9-]{36})/);
        return !!(m && m[1] !== uuid);
    }

    function grokPickBestVideo(videos) {
        if (!videos || !videos.length) return null;
        if (videos.length === 1) return videos[0];
        const uuid = grokExtractUuid(location.pathname);
        let best = null, bestScore = -1;
        for (const v of videos) {
            const src = (v.currentSrc || v.src || '').toLowerCase();
            let area = 0;
            try {
                const r = v.getBoundingClientRect();
                const vh = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
                const vw = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
                area = vh * vw;
            } catch (e) {}
            let score = 0;
            if (uuid && src.includes(uuid)) score += 8;
            else if (grokIsForeignVideo(v)) score -= 8; // ролик другой генерации
            if (!v.paused && !v.ended) score += 4;
            if (v.readyState >= 2) score += 1;
            if (area > 0) score += 2;
            // площадь — только для различения равных (0..1)
            score += Math.min(1, area / Math.max(1, window.innerWidth * window.innerHeight));
            if (score > bestScore) { best = v; bestScore = score; }
        }
        return best;
    }

    /** Главная картинка поста (сгенерированное изображение, не миниатюра и не аватар) или null. */
    function grokFindMainImage() {
        const uuid = grokExtractUuid(location.pathname);
        let best = null, bestScore = 0;
        for (const img of document.querySelectorAll('img')) {
            if (img.closest(GROK_FILMSTRIP_SEL) || img.closest('#mossad-widget, [id^="mossad-"]')) continue;
            const src = (img.currentSrc || img.src || '').toLowerCase();
            if (!src) continue;
            if (/avatar|profile|pfp|icon|logo|favicon/.test(src)) continue;
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            let score = 0;
            if (uuid && src.includes(uuid)) score += 10;                     // картинка именно этого поста
            if (/assets\.grok\.com|imagine-public|share-images|\/generated\//.test(src)) score += 5;
            if (w >= 150 && h >= 150) score += 3;
            if (score < 3) continue;
            if (score > bestScore) { best = img; bestScore = score; }
        }
        return best;
    }

    /**
     * Признаки медиа текущего поста. Ничего не ждёт — только читает DOM; ожиданием управляет
     * scheduleNextSlideCycle (src/slideshow/engine.js).
     *   staleSrc — src <video> предыдущего слайда: такой ролик ещё не сменился, он «старый».
     * Возвращает { video, staleVideo, soundBtn, mainImg, imageBtn, makeVideoBtn, settled }.
     */
    function grokDetectSlideMedia(staleSrc = '') {
        const vids = grokGetViewerVideos();
        let video = null, staleVideo = null;
        // v1.3.43: «чужой» ролик — src с UUID другой генерации (остался от прошлого слайда/круга) — как старый
        const isOld = (v) => {
            const src = v.currentSrc || v.src || '';
            if (staleSrc && src && src === staleSrc) return true;
            return grokIsForeignVideo(v);
        };
        const fresh = [];
        for (const v of vids) {
            if (isOld(v)) { staleVideo = staleVideo || v; continue; }
            fresh.push(v);
        }
        // Если «свежих» видео несколько — лучшее (v1.3.43: UUID поста в src, играет, видимо)
        video = fresh.length > 1 ? grokPickBestVideo(fresh) : (fresh[0] || null);
        let soundBtn = null;
        try { soundBtn = findGrokSoundToggleButton({ includeHidden: true }); } catch (e) {}
        // «Удалить изображение» (видно, если меню поста раскрыто) — железное подтверждение фото
        const imageBtn = Array.from(document.querySelectorAll('button, [role="button"], [role="menuitem"]')).some(el => {
            if (el.closest('#mossad-widget, [id^="mossad-"]')) return false;
            const t = (el.textContent || '').trim();
            const a = (el.getAttribute('aria-label') || '').trim();
            return t === 'Удалить изображение' || t === 'Delete image' || a === 'Удалить изображение' || a === 'Delete image';
        });
        // Страница «устоялась»: документ загружен и URL уже указывает на целевой пост слайдшоу
        let settled = document.readyState === 'complete';
        if (settled) {
            try {
                const ss = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                const cur = grokExtractUuid(location.pathname);
                if (ss.active && ss.targetUuid && cur && cur !== String(ss.targetUuid).toLowerCase()) settled = false;
            } catch (e) {}
        }
        // v1.3.43: «Make video» (сделать видео из картинки) бывает только у фото — сильный признак фото
        let makeVideoBtn = null;
        try {
            makeVideoBtn = Array.from(document.querySelectorAll('button, [role="button"], a')).find(el =>
                !el.closest(GROK_FILMSTRIP_SEL) && !el.closest('#mossad-widget, [id^="mossad-"]') &&
                GROK_MAKE_VIDEO_RE.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' '))) || null;
        } catch (e) {}
        return { video, staleVideo, soundBtn, mainImg: grokFindMainImage(), imageBtn, makeVideoBtn, settled };
    }
