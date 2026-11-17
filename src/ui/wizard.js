    // ============================================
    // WIZARD (v1.4.15): Мастер первичной настройки сайта
    // Позволяет за 1 минуту настроить MOSSAD под новый (или текущий) сайт:
    // - тип контента (🎬 видео, 🖼️ фото, 📦 всё)
    // - направление листания D-pad (⬇️ вниз, ➡️ вправо, ⏹️ без прокрутки)
    // - Related Nav (листание похожих 1-4 или 1..0, стрелки с живым превью)
    // - шаблон имени файла (изолирован строго для этого сайта)
    // - быстрая проверка поиска медиа на текущей странице (findMediaForDownload)
    // ============================================

    let _mossadWizardModal = null;

    function mossadOpenSiteWizard(targetHost) {
        const domain = (typeof mossadNormSite === 'function' ? mossadNormSite(targetHost || hostname) : (targetHost || hostname)) || hostname;
        const cat = (typeof mossadGetSiteCategory === 'function') ? mossadGetSiteCategory(domain) : { icon: '🌐', label: 'Общий', id: 'general' };
        const isCurrent = (typeof mossadHostMatches === 'function') ? mossadHostMatches(hostname, domain) : (hostname === domain);

        if (_mossadWizardModal && document.body.contains(_mossadWizardModal)) {
            _mossadWizardModal.remove();
            _mossadWizardModal = null;
        }

        const overlay = document.createElement('div');
        overlay.id = 'mossad-wizard-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            z-index: 99999999; display: flex; align-items: center; justify-content: center;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            opacity: 0; transition: opacity 0.25s ease;
        `;

        const box = document.createElement('div');
        box.id = 'mossad-wizard-box';
        box.style.cssText = `
            width: 600px; max-width: 95vw; max-height: 92vh; overflow-y: auto;
            background: #0f172a; border: 1px solid #334155; border-radius: 14px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06);
            color: #e2e8f0; padding: 20px 24px; box-sizing: border-box; display: flex;
            flex-direction: column; gap: 14px;
        `;

        // Текущие значения
        const curDlType = config.downloadType || (cat.id === 'video' ? 'video' : 'all');
        const curDirs = config.slideshowDirections || (cat.id === 'video' ? ['down'] : ['up']);
        const curDir = curDirs[0] || (cat.id === 'video' ? 'down' : 'up');
        const curPreset = config.relatedNavPreset || 'cycle';
        const curArrows = config.relatedNavArrows !== false;
        const curTpl = (config.filenameTemplate || '');
        const defTpl = typeof getDefaultFilenameTemplate === 'function' ? getDefaultFilenameTemplate() : '{id8}-{domain}';

        box.innerHTML = `
            <!-- Header -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:12px;">
                <div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:20px;">🪄</span>
                        <h2 style="margin:0;font-size:17px;font-weight:700;color:#f8fafc;">Мастер настройки сайта</h2>
                        <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:#1e293b;color:#94a3b8;border:1px solid #334155;font-weight:600;" title="Категория сайта в каталоге MOSSAD">${cat.icon} ${cat.label}</span>
                    </div>
                    <div style="font-size:13px;color:#38bdf8;margin-top:3px;font-family:ui-monospace,Consolas,monospace;font-weight:600;">${mossadEscHtml(domain)}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Быстрый опросник для адаптации MOSSAD под этот сайт. Наведите мышь на любой пункт для подробностей.</div>
                </div>
                <button id="mossad-wiz-close" title="Закрыть мастер настройки" style="background:transparent;border:none;color:#64748b;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;border-radius:4px;transition:color 0.2s;">&times;</button>
            </div>

            <!-- Section 1: Что искать и качать -->
            <div style="background:#131d31;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:12px;font-weight:700;color:#cbd5e1;" title="Приоритет алгоритма поиска медиа по PageDown на этом сайте">🎯 1. Что искать и скачивать на этом сайте?</span>
                    <span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:1px 6px;border-radius:4px;" title="Алгоритм извлечения контента">Режим поиска</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    <label class="mossad-wiz-card" title="Ищет строго видео (HTML5 video, прямые MP4/WebM, HLS потоки). Полностью игнорирует иконки, аватарки и шапки сайта" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${curDlType === 'video' ? '#38bdf8' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dl" value="video" ${curDlType === 'video' ? 'checked' : ''} style="accent-color:#38bdf8;">
                            <b style="font-size:12px;color:#f8fafc;">🎬 Только Видео</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Строгий фильтр видео (MP4/HLS). Защита от скачивания иконок и превью.</span>
                    </label>
                    <label class="mossad-wiz-card" title="Ищет полноразмерные изображения и фотографии (srcset, data-src, оригиналы высокого разрешения)" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${curDlType === 'photo' ? '#38bdf8' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dl" value="photo" ${curDlType === 'photo' ? 'checked' : ''} style="accent-color:#38bdf8;">
                            <b style="font-size:12px;color:#f8fafc;">🖼️ Только Фото</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Изображения высокого качества, пины, галереи, арты.</span>
                    </label>
                    <label class="mossad-wiz-card" title="Сначала ищет видео; если видео на текущем экране нет — скачивает главное изображение страницы" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${(curDlType !== 'video' && curDlType !== 'photo') ? '#38bdf8' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dl" value="all" ${(curDlType !== 'video' && curDlType !== 'photo') ? 'checked' : ''} style="accent-color:#38bdf8;">
                            <b style="font-size:12px;color:#f8fafc;">📦 Всё подряд</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Сначала видео, если нет — фотографии. Универсальный режим.</span>
                    </label>
                </div>
            </div>

            <!-- Section 2: Направление листания D-pad -->
            <div style="background:#131d31;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:12px;font-weight:700;color:#cbd5e1;" title="Направление автоматического сдвига ленты при запуске слайдшоу (Insert / Shift+Insert)">🔄 2. Направление листания ленты (D-pad)</span>
                    <span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:1px 6px;border-radius:4px;" title="Поведение при автопрокрутке">Автопрокрутка</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    <label class="mossad-wiz-card" title="Листать страницу сверху вниз. Идеально для бесконечных лент Shorts, Reels, видеохостингов (xHamster, xVideos, TikTok)" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${curDir === 'down' ? '#10b981' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dir" value="down" ${curDir === 'down' ? 'checked' : ''} style="accent-color:#10b981;">
                            <b style="font-size:12px;color:#f8fafc;">⬇️ Сверху вниз</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Для вертикальных лент, Reels, каталогов видео.</span>
                    </label>
                    <label class="mossad-wiz-card" title="Листать слева направо. Для сайтов-галерей с горизонтальной каруселью (Grok, Instagram, карусели)" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${(curDir === 'right' || curDir === 'up') ? '#10b981' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dir" value="right" ${(curDir === 'right' || curDir === 'up') ? 'checked' : ''} style="accent-color:#10b981;">
                            <b style="font-size:12px;color:#f8fafc;">➡️ Слева направо</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Для горизонтальных слайдеров и галерей.</span>
                    </label>
                    <label class="mossad-wiz-card" title="Без прокрутки окна. Подходит для просмотра отдельного плеера на странице" style="display:flex;flex-direction:column;gap:4px;background:#1e293b;border:1px solid ${!curDirs.length ? '#10b981' : '#334155'};border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color 0.2s;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <input type="radio" name="mossad-wiz-dir" value="none" ${!curDirs.length ? 'checked' : ''} style="accent-color:#10b981;">
                            <b style="font-size:12px;color:#f8fafc;">⏹️ Без прокрутки</b>
                        </div>
                        <span style="font-size:10px;color:#94a3b8;line-height:1.25;">Окно не скроллится автоматически.</span>
                    </label>
                </div>
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#cbd5e1;cursor:pointer;margin-top:2px;" title="Когда ролик заканчивается (событие onended), MOSSAD автоматически переходит к следующему слайду (идеально для Shorts, Reels, видеохостингов)">
                    <input id="mossad-wiz-auto-advance" type="checkbox" style="accent-color:#10b981;" ${config.videoAutoAdvanceOnEnd !== false ? 'checked' : ''}>
                    <span>⏭ Автопереход к следующему слайду по окончании видео (onended)</span>
                </label>
            </div>

            <!-- Section 3: Навигация по похожим медиа -->
            <div style="background:#131d31;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:12px;font-weight:700;color:#cbd5e1;" title="Быстрое переключение фокуса на похожие видео/пины с клавиатуры без мыши">🎯 3. Навигация по похожим медиа / рекомендациям</span>
                    <span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:1px 6px;border-radius:4px;" title="Горячие клавиши для похожих">Related Nav</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;" title="Пресет цифровых клавиш для выбора карточек">
                        Пресет клавиш:
                        <select id="mossad-wiz-rel-preset" style="background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f8fafc;padding:3px 8px;font-size:12px;">
                            <option value="cycle" ${curPreset === 'cycle' ? 'selected' : ''}>Листание 1-4 (1-первый, 4-посл, 2-назад, 3-вперёд)</option>
                            <option value="digits" ${curPreset === 'digits' ? 'selected' : ''}>Десятки (1..0, Shift — 11..20, Alt — 21..30)</option>
                            <option value="off" ${curPreset === 'off' ? 'selected' : ''}>Отключено</option>
                        </select>
                    </label>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;cursor:pointer;" title="Стрелки ← → перемещают фокус между карточками похожих с живым предпросмотром (без звука)">
                        <input id="mossad-wiz-rel-arrows" type="checkbox" style="accent-color:#10b981;" ${curArrows ? 'checked' : ''}>
                        <span>Стрелки ← → ↑ ↓ с живым видео-превью</span>
                    </label>
                </div>
            </div>

            <!-- Section 4: Шаблон имени файла для ЭТОГО сайта -->
            <div style="background:#131d31;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span style="font-size:12px;font-weight:700;color:#cbd5e1;" title="Формат имени сохраняемого файла на диске">🏷️ 4. Шаблон имени файла для этого сайта</span>
                        <span style="font-size:10px;padding:1px 6px;border-radius:4px;background:#1e3a8a;color:#93c5fd;border:1px solid #3b82f6;font-weight:600;" title="Шаблон изолирован strictly для ${mossadEscHtml(domain)}">🎯 Только для ${mossadEscHtml(domain)}</span>
                    </div>
                    <span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:1px 6px;border-radius:4px;">Изолирован</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <input id="mossad-wiz-tpl" type="text" placeholder="${defTpl}" value="${curTpl.replace(/"/g, '&quot;')}"
                        title="Доступные теги: {id8} {domain} {title} {desc} {date} {time} {ext} {account} {username} {n}"
                        style="flex:1;background:#0b1220;border:1px solid #334155;border-radius:6px;color:#f8fafc;padding:5px 8px;font-size:12px;font-family:ui-monospace,Consolas,monospace;">
                    <button id="mossad-wiz-tpl-help" class="mossad-tpl-help-btn" data-for="mossad-wiz-tpl" title="Справка по тегам и пример имени" style="${typeof MOSSAD_TPL_HELP_BTN_CSS !== 'undefined' ? MOSSAD_TPL_HELP_BTN_CSS : 'background:#1f2937;border:1px solid #374151;color:#60a5fa;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:bold;font-size:11px;'}">?</button>
                    <button id="mossad-wiz-tpl-reset" title="Сбросить на стандартный шаблон этого сайта (${defTpl})" style="background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f87171;padding:5px 8px;cursor:pointer;font-size:12px;font-weight:700;">↺</button>
                </div>
                <div style="font-size:11px;color:#94a3b8;line-height:1.3;">
                    ⚠️ Изменение этого шаблона сохраняется <b>строго для ${mossadEscHtml(domain)}</b>. Оно никогда не попадет на Grok или другие сайты.
                </div>
            </div>

            <!-- Section 5: Экспресс-проверка (если на текущей странице) -->
            ${isCurrent ? `
            <div style="background:#131d31;border:1px solid #1e293b;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <span style="font-size:12px;font-weight:700;color:#cbd5e1;" title="Протестировать алгоритм MOSSAD на текущей странице прямо сейчас">🔍 5. Экспресс-проверка на этой странице</span>
                    <span style="font-size:10px;color:#10b981;background:#064e3b;padding:1px 6px;border-radius:4px;">Живой тест</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button id="mossad-wiz-btn-test" title="Запустить findMediaForDownload() и проверить, что видит MOSSAD на странице" style="background:#0284c7;border:none;border-radius:6px;color:#fff;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background 0.2s;">
                        <span>🔍 Найти медиа сейчас</span>
                    </button>
                    <button id="mossad-wiz-btn-sample-dl" title="Эмулировать нажатие PageDown для пробного скачивания" style="background:#1e293b;border:1px solid #334155;border-radius:6px;color:#38bdf8;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:background 0.2s;">
                        <span>⬇️ Пробное скачивание (PageDown)</span>
                    </button>
                </div>
                <div id="mossad-wiz-test-result" style="display:none;background:#0b1220;border:1px solid #334155;border-radius:6px;padding:6px 10px;font-size:11px;color:#cbd5e1;font-family:ui-monospace,Consolas,monospace;word-break:break-all;"></div>
            </div>
            ` : ''}

            <!-- Section 6: Справка о глобальных и локальных настройках -->
            <details style="background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:8px 12px;font-size:11px;color:#94a3b8;cursor:pointer;">
                <summary style="font-weight:600;color:#cbd5e1;user-select:none;outline:none;" title="Нажмите, чтобы раскрыть подробную справку о глобальных и локальных настройках">
                    💡 Как устроены настройки MOSSAD: где глобальные, а где сугубо для сайта?
                </summary>
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;line-height:1.4;cursor:default;">
                    <div><b style="color:#60a5fa;">🌐 Глобальные (общие для ВСЕХ сайтов):</b> Горячие клавиши (PageDown, Delete, Insert), звуковые сигналы (бипы), DND Ctrl-клик, список сайтов в Tampermonkey. Настроив их однажды, вы используете их везде одинаково.</div>
                    <div><b style="color:#34d399;">🎯 Сугубо для этого сайта (${mossadEscHtml(domain)}):</b> Шаблон имени файла, направление D-pad, индивидуальные задержки фото/видео, история скачанных файлов (база защиты от дублей). Они изолированы и не влияют на другие сайты.</div>
                </div>
            </details>

            <!-- Footer Buttons -->
            <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;border-top:1px solid #1e293b;padding-top:14px;margin-top:4px;">
                <button id="mossad-wiz-btn-skip" title="Закрыть мастер без изменения настроек" style="background:#1e293b;border:1px solid #334155;border-radius:6px;color:#94a3b8;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Пропустить</button>
                <button id="mossad-wiz-btn-save" title="Применить выбранные параметры для этого сайта" style="background:#10b981;border:none;border-radius:6px;color:#fff;padding:6px 18px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.3);transition:background 0.2s;">💾 Сохранить и применить</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        _mossadWizardModal = overlay;
        requestAnimationFrame(() => { overlay.style.opacity = '1'; });

        // Highlight selected cards on radio change
        box.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const name = radio.name;
                box.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                    const card = r.closest('.mossad-wiz-card');
                    if (card) {
                        card.style.borderColor = r.checked ? (name === 'mossad-wiz-dl' ? '#38bdf8' : '#10b981') : '#334155';
                    }
                });
            });
        });

        const closeWizard = () => {
            overlay.style.opacity = '0';
            setTimeout(() => { overlay.remove(); if (_mossadWizardModal === overlay) _mossadWizardModal = null; }, 250);
        };

        const btnClose = box.querySelector('#mossad-wiz-close');
        if (btnClose) btnClose.onclick = closeWizard;
        const btnSkip = box.querySelector('#mossad-wiz-btn-skip');
        if (btnSkip) btnSkip.onclick = closeWizard;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeWizard();
        });

        // Tpl reset button
        const btnResetTpl = box.querySelector('#mossad-wiz-tpl-reset');
        const inTpl = box.querySelector('#mossad-wiz-tpl');
        if (btnResetTpl && inTpl) {
            btnResetTpl.onclick = (e) => {
                e.preventDefault();
                inTpl.value = '';
                if (typeof showToast === 'function') showToast(`↺ Шаблон очищен — будет использован стандартный (${defTpl})`);
            };
        }

        // Tpl help wiring
        if (typeof mossadWireTplHelp === 'function') {
            mossadWireTplHelp(box);
        }

        // Express test button
        const btnTest = box.querySelector('#mossad-wiz-btn-test');
        const resBox = box.querySelector('#mossad-wiz-test-result');
        if (btnTest && resBox) {
            btnTest.onclick = () => {
                resBox.style.display = 'block';
                resBox.innerHTML = '<i>Поиск медиа...</i>';
                try {
                    let media = null;
                    if (typeof findMediaForDownload === 'function') {
                        media = findMediaForDownload();
                    }
                    if (media && media.urls && media.urls.length) {
                        const isVid = media.type === 'video';
                        const firstUrl = media.urls[0];
                        resBox.innerHTML = `
                            <div style="color:#10b981;font-weight:700;">✅ Найдено ${isVid ? '🎬 Видео' : '🖼 Изображение'} (${media.urls.length} вариантов):</div>
                            <div style="color:#60a5fa;margin-top:2px;font-size:10px;">${mossadEscHtml(firstUrl.slice(0, 100))}${firstUrl.length > 100 ? '...' : ''}</div>
                        `;
                    } else {
                        resBox.innerHTML = `<span style="color:#f87171;">⚠️ Медиа не обнаружено на текущем экране.</span> <span style="color:#94a3b8;">Убедитесь, что видео/изображение в видимой области и плеер запущен.</span>`;
                    }
                } catch (e) {
                    resBox.innerHTML = `<span style="color:#f87171;">Ошибка поиска: ${mossadEscHtml(e.message)}</span>`;
                }
            };
        }

        // Sample download button
        const btnSampleDl = box.querySelector('#mossad-wiz-btn-sample-dl');
        if (btnSampleDl) {
            btnSampleDl.onclick = () => {
                if (typeof triggerDownload === 'function') {
                    if (typeof showToast === 'function') showToast('⬇️ Запуск скачивания (PageDown)...');
                    triggerDownload();
                } else {
                    alert('triggerDownload недоступен');
                }
            };
        }

        // Save button
        const btnSave = box.querySelector('#mossad-wiz-btn-save');
        if (btnSave) {
            btnSave.onclick = () => {
                const dlRad = box.querySelector('input[name="mossad-wiz-dl"]:checked');
                const dirRad = box.querySelector('input[name="mossad-wiz-dir"]:checked');
                const relPreset = box.querySelector('#mossad-wiz-rel-preset');
                const relArrows = box.querySelector('#mossad-wiz-rel-arrows');
                const tplVal = inTpl ? inTpl.value.trim() : '';

                if (dlRad && dlRad.value) {
                    config.downloadType = dlRad.value;
                }
                if (dirRad) {
                    if (dirRad.value === 'none') config.slideshowDirections = [];
                    else if (dirRad.value === 'right') config.slideshowDirections = ['right'];
                    else config.slideshowDirections = ['down'];
                }
                if (relPreset && relPreset.value) {
                    config.relatedNavPreset = relPreset.value;
                }
                if (relArrows) {
                    config.relatedNavArrows = !!relArrows.checked;
                }
                const autoAdv = box.querySelector('#mossad-wiz-auto-advance');
                if (autoAdv) {
                    config.videoAutoAdvanceOnEnd = !!autoAdv.checked;
                }

                // Сохранение шаблона сайта
                if (typeof mossadSaveSiteTemplate === 'function') {
                    mossadSaveSiteTemplate(tplVal);
                } else {
                    config.filenameTemplate = tplVal;
                }

                if (typeof Settings !== 'undefined' && typeof Settings.save === 'function') {
                    Settings.save();
                }
                if (typeof window.updateWidgetUI === 'function') {
                    window.updateWidgetUI();
                }
                if (typeof showToast === 'function') {
                    showToast(`🎉 Настройки для ${domain} успешно применены!`);
                }
                closeWizard();
            };
        }
    }

    window.mossadOpenSiteWizard = mossadOpenSiteWizard;
