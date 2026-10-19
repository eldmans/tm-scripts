    // ============================================================
    // GROK: Sound Toggle (Mute / Unmute via Player DOM Button)
    // ============================================================
    // v1.3.32: Grok добавил кнопку, начинающуюся с иконки ноты (выбор музыки / аудио-дорожки).
    // Старый поиск findGrokButton(['звук','sound',...]) брал ПЕРВУЮ видимую кнопку, у которой
    // одно из слов встречалось в aria-label / title / textContent (подстрокой). Кнопка с нотой
    // (например «Добавить звук» / «Sound» / «Music») стоит в DOM раньше кнопки mute и
    // перехватывала хоткей. Теперь — скоринг кандидатов с явным исключением «музыкальных» кнопок.

    // Сильные признаки именно mute/unmute (сравниваем с aria-label / title).
    const GROK_MUTE_WORDS = [
        'mute', 'unmute', 'заглушить', 'включить звук', 'выключить звук', 'отключить звук', 'без звука', 'со звуком'
    ];
    // Слабые признаки — только в aria-label / title, не в textContent.
    const GROK_SOUND_WORDS = ['звук', 'sound', 'volume', 'громкость'];
    // Признаки кнопок выбора музыки / аудио-дорожки — такие кнопки НИКОГДА не кликаем.
    const GROK_MUSIC_WORDS = [
        'music', 'музык', 'song', 'песн', 'track', 'трек', 'дорожк', 'melod', 'мелод', 'soundtrack',
        'add sound', 'add audio', 'добавить звук', 'добавить аудио', 'choose', 'select', 'выбрать', 'generate', 'сгенерир'
    ];
    const GROK_MUSIC_GLYPHS = /^[\s]*[\u266A\u266B\u266C\u{1F3B5}\u{1F3B6}\u{1F3BC}]/u; // ♪ ♫ ♬ 🎵 🎶 🎼

    /** true, если ведущая иконка / подпись кнопки — нота (кнопка выбора музыки). */
    function isGrokMusicNoteButton(el) {
        const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase();
        if (GROK_MUSIC_WORDS.some(w => label.includes(w))) return true;
        const txt = (el.textContent || '').trim();
        if (GROK_MUSIC_GLYPHS.test(txt)) return true;
        if (GROK_MUSIC_WORDS.some(w => txt.toLowerCase().includes(w))) return true;
        // Ведущая иконка: первый <img>/<svg> внутри кнопки
        const icon = el.querySelector('img, svg');
        if (icon) {
            const iconSig = [
                icon.getAttribute('alt'), icon.getAttribute('src'), icon.getAttribute('aria-label'),
                icon.getAttribute('data-icon'), icon.getAttribute('class')
            ].map(s => (s || '').toLowerCase()).join(' ');
            if (/music|note|nota|нота|музык|audio-lines|audio_track|song/.test(iconSig)) return true;
        }
        return false;
    }

    /**
     * Находит настоящую кнопку mute/unmute плеера Grok (или null).
     * Скоринг: сильные слова в aria/title, иконка громкости, близость к активному <video>.
     * Исключаются: невидимые, «музыкальные» кнопки, кнопки, открывающие меню (aria-haspopup).
     */
    function findGrokSoundToggleButton(opts = {}) {
        // v1.3.42: opts.includeHidden — для определения «видео или фото» (grokDetectSlideMedia):
        // кнопка mute плеера Grok скрыта, пока мышь не над видео, но в DOM она есть. Кликать по ней
        // хоткеем по-прежнему можно только по видимой (вызов без опций).
        const includeHidden = !!opts.includeHidden;
        const video = (typeof getActiveVideo === 'function') ? getActiveVideo() : null;
        // Контейнер плеера: несколько уровней вверх от <video>
        const playerRoots = [];
        if (video) {
            let n = video.parentElement;
            for (let i = 0; i < 4 && n; i++, n = n.parentElement) playerRoots.push(n);
        }
        let best = null, bestScore = 0;
        const candidates = document.querySelectorAll('button, [role="button"]');
        for (const el of candidates) {
            if (!includeHidden && el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) continue;
            if (el.closest('#mossad-widget, [id^="mossad-"]')) continue; // свои кнопки MOSSAD не трогаем
            if (el.closest(GROK_FILMSTRIP_SEL)) continue; // кадры киноплёнки — не плеер
            if (isGrokMusicNoteButton(el)) continue;
            // v1.3.43: «Make video» (белый треугольник в круге) — генерация видео из фото, не плеер
            if (/make\s*video/i.test([el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent].map(x => x || '').join(' '))) continue;
            if (el.hasAttribute('aria-haspopup')) continue; // mute не открывает меню
            const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '')).toLowerCase().trim();
            const txt = (el.textContent || '').trim().toLowerCase();
            const svgCls = Array.from(el.querySelectorAll('svg')).map(s => (s.getAttribute('class') || '').toLowerCase()).join(' ');
            let score = 0;
            if (GROK_MUTE_WORDS.some(w => label.includes(w))) score += 10;
            else if (GROK_MUTE_WORDS.some(w => txt === w)) score += 8;
            else if (txt === '' && GROK_SOUND_WORDS.some(w => label.includes(w))) score += 4;
            // ↑ слабое слово («звук»/«sound») засчитываем только для icon-only кнопки:
            //   у кнопки с нотой есть видимая подпись, у mute-иконки плеера — нет.
            if (txt === '' && /volume|speaker|mute/.test(svgCls)) score += 4; // lucide-volume-2 / lucide-volume-x и т.п.
            if (score === 0) continue;
            const nearPlayer = playerRoots.some(r => r.contains(el));
            if (score < 8 && !nearPlayer) continue; // слабые совпадения — только рядом с активным <video>
            if (nearPlayer) score += 3;
            if (score > bestScore) { best = el; bestScore = score; }
        }
        return best;
    }

    // ── v1.3.39: отдельный тост состояния звука (~5 с) с крестиком ──
    // × закрывает ТОЛЬКО текущий тост — ничего не запоминается. Показ включается/выключается в F1
    // (config.showSoundToast, по умолчанию вкл.). Крепится к fullscreen-элементу, если он есть
    // (иначе в полноэкранном плеере тост в document.body не виден).
    let _soundToastTimer = null;

    function showSoundToast(message) {
        if (config.showSoundToast === false) return;
        const host = document.fullscreenElement || document.body;
        let t = document.getElementById('mossad-sound-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'mossad-sound-toast';
            t.style.cssText = `
                position: fixed; bottom: 64px; left: 50%; transform: translateX(-50%); z-index: 2147483646;
                display: flex; align-items: center; gap: 10px;
                padding: 8px 10px 8px 16px; background: rgba(20, 20, 20, 0.92); backdrop-filter: blur(10px);
                border: 1px solid #10b981; border-radius: 10px; color: #6ee7b7;
                font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: auto;
                transition: opacity 0.2s ease; opacity: 0;
            `;
            const txt = document.createElement('span');
            txt.className = 'mossad-sound-toast-text';
            const x = document.createElement('button');
            x.textContent = '×';
            x.title = 'Закрыть (только это уведомление)';
            x.style.cssText = 'background:none;border:none;color:#9ca3af;font-size:16px;line-height:1;cursor:pointer;padding:0 4px;';
            x.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (_soundToastTimer) { clearTimeout(_soundToastTimer); _soundToastTimer = null; }
                t.style.opacity = '0';
                setTimeout(() => { if (t.style.opacity === '0') t.remove(); }, 250);
            };
            t.append(txt, x);
        }
        if (t.parentNode !== host) host.appendChild(t);
        t.querySelector('.mossad-sound-toast-text').textContent = message;
        t.style.opacity = '1';
        if (_soundToastTimer) clearTimeout(_soundToastTimer);
        _soundToastTimer = setTimeout(() => {
            _soundToastTimer = null;
            t.style.opacity = '0';
            setTimeout(() => { if (t.style.opacity === '0') t.remove(); }, 250);
        }, 5000);
    }

    function toggleGrokSound() {
        if (rootDomain !== 'grok.com') return;
        blurActiveInput();

        const btn = findGrokSoundToggleButton();
        if (btn) {
            const video = (typeof getActiveVideo === 'function') ? getActiveVideo() : null;
            const labelBefore = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.textContent || '').toLowerCase();
            triggerClick(btn, 'Grok Sound Toggle');
            // Тост по фактическому состоянию <video> (после того как плеер применит клик);
            // если видео нет — по подписи кнопки до клика.
            setTimeout(() => {
                let nowMuted;
                if (video && video.isConnected) nowMuted = video.muted;
                else nowMuted = !(labelBefore.includes('включить') || labelBefore.includes('unmute'));
                showSoundToast(nowMuted ? '🔇 Звук выключен' : '🔊 Звук включен');
            }, 150);
            return;
        }

        // Фолбэк на HTML5 video, если кнопка mute в DOM не найдена.
        // ANTI_PATTERNS §2: прямое video.muted может рассинхронизировать иконку плеера Grok,
        // поэтому это только последний вариант (как и до v1.3.32), а не основной путь.
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            showSoundToast(video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
        } else {
            showToast('⚠️ Видео не найдено', true);
        }
    }
