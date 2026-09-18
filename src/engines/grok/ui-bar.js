    // ============================================================
    // GROK ENGINE: UI Gallery Bar (Main Widget Sub-panel)
    // ============================================================

    /** Инициализация строки галереи внутри виджета MOSSAD (для всех страниц grok.com) */
    function initGrokGalleryBar() {
        if (rootDomain !== 'grok.com') return;
        if (document.getElementById('mossad-gallery-row')) return;

        const container = document.getElementById('mossad-widget-container');
        if (!container) return;

        const row = document.createElement('div');
        row.id = 'mossad-gallery-row';
        row.style.cssText = `
            background: rgba(20,20,20,0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 5px 8px;
            display: flex; align-items: center; gap: 4px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: system-ui,-apple-system,sans-serif; cursor: grab; flex-wrap: nowrap; pointer-events: auto;
            width: fit-content; max-width: 100%; box-sizing: border-box;
        `;

        // ── Утилита создания маленьких кнопок ──
        const mkBtn = (id, text, title, css) => {
            const b = document.createElement('button');
            b.id = id; b.textContent = text; b.title = title;
            b.style.cssText = `cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 6px;font-weight:700;font-size:11px;transition:all 0.2s;${css}`;
            return b;
        };

        // ── 1. Кнопка «Собрать» / Количество ──
        const btnCollect = document.createElement('button');
        btnCollect.id = 'mossad-gallery-collect';
        let savedCount = 0;
        try {
            const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (cRaw) savedCount = (JSON.parse(cRaw).items || []).length;
        } catch(e) {}
        btnCollect.textContent = savedCount > 0 ? String(savedCount) : 'Собрать';
        btnCollect.title = savedCount > 0 ? `Коллекция (${savedCount}): открыть список` : 'Собрать коллекцию ссылок';
        btnCollect.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:3px 7px;font-weight:700;font-size:11px;background:#1f2937;color:#e5e7eb;transition:all 0.2s;`;

        // Клик: на /saved — собирать; иначе — открывать плейлист (если есть коллекция)
        btnCollect.onclick = () => {
            if (isGrokSavedPage()) {
                grokSaveCollection(btnCollect);
            } else if (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0) {
                grokTogglePlaylistPanel();
            } else {
                showToast('ℹ️ Переход на /imagine/saved для сбора...');
                setTimeout(() => { window.location.href = 'https://grok.com/imagine/saved'; }, 300);
            }
        };

        // Правый клик: очистить коллекцию
        btnCollect.oncontextmenu = (e) => {
            e.preventDefault();
            if (confirm('Очистить собранную коллекцию?')) {
                _gSS.removeItem(GALLERY_COLLECTION_KEY);
                btnCollect.textContent = 'Собрать';
                btnCollect.dataset.collectedCount = '0';
                btnCollect.style.background = '#1f2937';
                btnCollect.style.color = '#e5e7eb';
                const pl = document.getElementById('mossad-playlist-panel');
                if (pl) pl.remove();
                showToast('🗑 Коллекция очищена');
            }
        };


        if (isGrokSavedPage()) {
            // Мониторим появление новых ссылок на странице каждые 2с (количество только увеличивается!)
            setInterval(() => {
                let currentTotal = savedCount;
                const existingUrls = new Set();
                try {
                    const cRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                    if (cRaw) {
                        const items = JSON.parse(cRaw).items || [];
                        currentTotal = items.length;
                        items.forEach(it => existingUrls.add((it.url || '').split('?')[0].toLowerCase()));
                    }
                } catch(e) {}

                if (currentTotal === 0 && !btnCollect.dataset.collectedCount) return;

                const anchors = Array.from(document.querySelectorAll('a[href*="/imagine/post/"]'));
                let uncollected = 0;
                anchors.forEach(a => {
                    const href = a.getAttribute('href') || '';
                    if (!href) return;
                    const url = href.startsWith('http') ? href : 'https://grok.com' + href;
                    if (!existingUrls.has(url.split('?')[0].toLowerCase())) {
                        uncollected++;
                    }
                });

                if (uncollected > 0) {
                    btnCollect.textContent = `${currentTotal} 🟢+${uncollected}`;
                    btnCollect.style.color = '#34d399';
                    btnCollect.title = `Собрано: ${currentTotal}, новых на странице: +${uncollected}. Кликните для добавления!`;
                } else if (currentTotal > 0) {
                    btnCollect.textContent = String(currentTotal);
                    btnCollect.style.color = '#e5e7eb';
                    btnCollect.title = `Коллекция (${currentTotal}): открыть список`;
                }
            }, 2000);
        }

        // ── 3. Кнопка-статус воспроизведения (Слайдшоу / ❚❚ / ▶) ──
        const _ssActive = (() => {
            if (isGrokSavedPage()) return false;
            try {
                const item = JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}');
                return !!item.active && (slideshowActive || sessionStorage.getItem(SESSION_ACTIVE_KEY) === 'true');
            } catch { return false; }
        })();
        const _isPaused = sessionStorage.getItem('mossad_gallery_paused') === 'true' ||
                          (typeof SESSION_PAUSED_KEY !== 'undefined' && sessionStorage.getItem(SESSION_PAUSED_KEY) === 'true');

        const btnStatus = document.createElement('button');
        btnStatus.id = 'mossad-gallery-status';
        btnStatus.style.cssText = `cursor:pointer;border:none;border-radius:6px;padding:3px 7px;font-weight:700;font-size:11px;transition:all 0.2s;`;
        if (_ssActive) {
            btnStatus.textContent = _isPaused ? '▶' : '❚❚';
            btnStatus.title = _isPaused ? 'Продолжить' : 'Пауза';
            btnStatus.style.background = _isPaused ? '#d97706' : '#059669';
            btnStatus.style.color = '#ffffff';
        } else {
            btnStatus.textContent = 'Слайдшоу';
            btnStatus.title = 'Запустить слайдшоу по генерациям';
            btnStatus.style.background = '#1e3a5f';
            btnStatus.style.color = '#93c5fd';
        }
        btnStatus.onclick = () => {
            const active = window._mossadGalleryActive || (() => {
                try { return !!(JSON.parse(_gSS.getItem(GALLERY_SS_KEY) || '{}').active); } catch { return false; }
            })();
            if (active) {
                toggleGalleryPause();
            } else {
                grokStartGallerySlideshow();
            }
        };

        // ── 4. Кнопка [■] стоп — появляется только когда слайдшоу запущено ──
        const btnStop = mkBtn('mossad-gallery-stop', '■', 'Остановить слайдшоу', 'background:#1f2937;color:#f87171;');
        btnStop.style.display = _ssActive ? 'inline-block' : 'none';
        btnStop.onclick = () => {
            grokStopGallerySlideshow();
            stopSlideshow();
        };

        // ── 5. Режимы Gr / Md — 4 состояния: ↓ seq | ↑ rev | ↺ rnd | − off ──
        // По умолчанию: grpMode=seq (прямой порядок групп), itemMode=fwd (прямой порядок файлов)
        const GR_STATES  = ['seq', 'rev', 'rnd', 'off'];
        const GR_ICONS   = { seq: '↓', rev: '↑', rnd: '↺', off: '−' };
        const GR_TIPS    = {
            seq: 'Gr↓ — группы по порядку',
            rev: 'Gr↑ — группы в обратном порядке',
            rnd: 'Gr↺ — случайный порядок групп (без повторов за круг)',
            off: 'Gr− — без учёта групп (режим Md применяется ко всей коллекции)',
        };
        const MD_STATES  = ['fwd', 'rev', 'rnd', 'off'];
        const MD_ICONS   = { fwd: '↓', rev: '↑', rnd: '↺', off: '−' };
        const MD_TIPS    = {
            fwd: 'Md↓ — файлы в прямом порядке',
            rev: 'Md↑ — файлы в обратном порядке',
            rnd: 'Md↺ — случайный порядок файлов (без повторов за круг)',
            off: 'Md− — файлы в случайном порядке (оба − = полный хаос)',
        };

        // Читаем текущие настройки из коллекции
        let grpModeCfg = 'seq', itemModeCfg = 'fwd';
        try {
            const colRaw = _gSS.getItem(GALLERY_COLLECTION_KEY);
            if (colRaw) {
                const colData = JSON.parse(colRaw);
                grpModeCfg  = colData.grpMode  || 'seq';
                itemModeCfg = colData.itemMode || 'fwd';
            }
        } catch(e) {}

        // Функция сохранения режима в коллекцию
        const saveModeToCollection = (key, val) => {
            try {
                const raw = _gSS.getItem(GALLERY_COLLECTION_KEY);
                const data = raw ? JSON.parse(raw) : {};
                data[key] = val;
                _gSS.setItem(GALLERY_COLLECTION_KEY, JSON.stringify(data));
            } catch(e) {}
        };

        // Helper: цвет кнопки по состоянию
        const grBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1a2e3a;color:#7dd3fc;';
        const mdBtnCss = (state) => state === 'off' ? 'background:#1a1a2e;color:#4b5563;' : 'background:#1e1a3a;color:#c4b5fd;';
        const BASE_BTN = 'cursor:pointer;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:3px 6px;font-weight:700;font-size:11px;transition:all 0.2s;';

        // Кнопка Gr (порядок групп)
        const btnGr = mkBtn('mossad-gallery-grmode',
            `Gr${GR_ICONS[grpModeCfg]}`,
            GR_TIPS[grpModeCfg] || '',
            grBtnCss(grpModeCfg));
        btnGr.onclick = () => {
            const idx = GR_STATES.indexOf(grpModeCfg);
            grpModeCfg = GR_STATES[(idx + 1) % GR_STATES.length];
            saveModeToCollection('grpMode', grpModeCfg);
            btnGr.textContent = `Gr${GR_ICONS[grpModeCfg]}`;
            btnGr.title       = GR_TIPS[grpModeCfg];
            btnGr.style.cssText = BASE_BTN + grBtnCss(grpModeCfg);
        };

        // Кнопка Md (порядок внутри группы)
        const btnMd = mkBtn('mossad-gallery-mdmode',
            `Md${MD_ICONS[itemModeCfg]}`,
            MD_TIPS[itemModeCfg] || '',
            mdBtnCss(itemModeCfg));
        btnMd.onclick = () => {
            const idx = MD_STATES.indexOf(itemModeCfg);
            itemModeCfg = MD_STATES[(idx + 1) % MD_STATES.length];
            saveModeToCollection('itemMode', itemModeCfg);
            btnMd.textContent = `Md${MD_ICONS[itemModeCfg]}`;
            btnMd.title       = MD_TIPS[itemModeCfg];
            btnMd.style.cssText = BASE_BTN + mdBtnCss(itemModeCfg);
        };

        // ── 6. Быстрые кнопки генерации видео (6s / 10s) ──
        const btnVid6 = mkBtn('mossad-grok-vid6', '6s', 'Генерация видео 6 сек (Shift+Enter)', 'background:#1a2332;color:#38bdf8;');
        btnVid6.onclick = () => {
            if (typeof triggerGrokVideoGeneration === 'function') triggerGrokVideoGeneration(6);
        };
        const btnVid10 = mkBtn('mossad-grok-vid10', '10s', 'Генерация видео 10 сек (Ctrl+Enter)', 'background:#1e1a3a;color:#a78bfa;');
        btnVid10.onclick = () => {
            if (typeof triggerGrokVideoGeneration === 'function') triggerGrokVideoGeneration(10);
        };

        row.append(btnCollect, btnStatus, btnStop, btnGr, btnMd, btnVid6, btnVid10);

        // ── Кнопка вызова настроек горячих клавиш (⌨) слева от крестика (✕) ──
        const btnHk = mkBtn('mossad-gallery-hk', '⌨', 'Настройки горячих клавиш', 'background:#1f2937;color:#9ca3af;font-size:12px;padding:2px 6px;margin-left:auto;');
        btnHk.onclick = () => {
            const existingModal = document.getElementById('mossad-hk-modal');
            if (existingModal) {
                existingModal.remove();
                return;
            }
            if (typeof openHotkeySettings === 'function') openHotkeySettings();
        };

        // Переносим крестик закрытия на самый верхний ряд (на Grok это mossad-gallery-row)
        const closeBtn = document.getElementById('mossad-btn-close');
        if (closeBtn) {
            closeBtn.style.marginLeft = '4px';
            row.append(btnHk, closeBtn);
        } else {
            row.append(btnHk);
        }

        container.insertBefore(row, container.firstChild);

        if (typeof window.makeWidgetDraggable === 'function') {
            window.makeWidgetDraggable(row);
        }

        // Если список был открыт ранее — восстанавливаем его монолитно в контейнере виджета
        if (_gSS.getItem('mossad_playlist_open') === 'true' && (savedCount > 0 || parseInt(btnCollect.dataset.collectedCount || '0') > 0)) {
            setTimeout(() => {
                if (typeof grokTogglePlaylistPanel === 'function') {
                    grokTogglePlaylistPanel(true);
                }
            }, 60);
        }
    }

