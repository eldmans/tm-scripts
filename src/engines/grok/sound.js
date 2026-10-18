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
    function findGrokSoundToggleButton() {
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
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && (!el.getClientRects || !el.getClientRects().length)) continue;
            if (el.closest('#mossad-widget, [id^="mossad-"]')) continue; // свои кнопки MOSSAD не трогаем
            if (isGrokMusicNoteButton(el)) continue;
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
                showToast(nowMuted ? '🔇 Звук выключен' : '🔊 Звук включен');
            }, 150);
            return;
        }

        // Фолбэк на HTML5 video, если кнопка mute в DOM не найдена.
        // ANTI_PATTERNS §2: прямое video.muted может рассинхронизировать иконку плеера Grok,
        // поэтому это только последний вариант (как и до v1.3.32), а не основной путь.
        const video = getActiveVideo();
        if (video) {
            video.muted = !video.muted;
            showToast(video.muted ? '🔇 Звук выключен' : '🔊 Звук включен');
        } else {
            showToast('⚠️ Видео не найдено', true);
        }
    }
