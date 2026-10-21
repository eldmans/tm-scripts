    // ============================================
    // v1.3.66: настройки лёгкого слоя (DND; с v1.3.67 — видео/скорость). Одна функция-рендер для двух мест:
    //   • вкладка «🎬 Видео / DND» окна настроек MOSSAD (сайты из списка);
    //   • команда меню Tampermonkey «🎬 MOSSAD: видео и DND» — плавающее окно на ЛЮБОМ сайте (без mossadMain).
    // Тело функций компилируется только при открытии (на загрузке — одна команда меню).
    // ============================================
    const mossadLightSections = []; // [{ id, render(container) }] — разделы добавляют модули лёгкого слоя

    mossadLightSections.push({ id: 'dnd', render(box) {
        const c = mossadDndCfg();
        const sec = document.createElement('div');
        sec.setAttribute('data-light', 'dnd');
        sec.style.cssText = 'background:#1f2937;border:1px solid #374151;border-radius:6px;padding:8px;margin-bottom:8px;font-size:12px;color:#d1d5db;';
        sec.innerHTML = `<div style="font-weight:bold;color:#fff;margin-bottom:4px;">⬇ DND: скачивание по Ctrl+клик (все сайты)</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;"><input data-dnd-cfg="enabled" type="checkbox" ${c.enabled ? 'checked' : ''} style="accent-color:#3b82f6;"> Включено</label>
            <label style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">Подпапка в «Загрузках»:
              <input data-dnd-cfg="folder" type="text" value="${String(c.folder).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" placeholder="пусто — корень" style="width:120px;background:#111827;border:1px solid #374151;border-radius:4px;color:#e5e7eb;padding:2px 6px;font-size:12px;"></label>
            <div style="color:#9ca3af;line-height:1.35;">Ctrl + левый клик по картинке/видео — скачать. Ctrl + правый клик — меню: Скачать, Папка…, Копировать кадр.
            Для подпапок в Tampermonkey: Настройки → «Режим загрузки: Browser API».</div>`;
        sec.querySelector('[data-dnd-cfg="enabled"]').onchange = (e) => mossadDndSave({ enabled: e.target.checked });
        const f = sec.querySelector('[data-dnd-cfg="folder"]');
        f.onchange = () => { const v = mossadDndNormFolder(f.value); f.value = v; mossadDndSave({ folder: v }); };
        box.appendChild(sec);
    } });

    /** Отрисовать все разделы лёгкого слоя в container (очищается). */
    function mossadLightRenderSettings(container) {
        container.innerHTML = '';
        for (const s of mossadLightSections) { try { s.render(container); } catch (e) { console.warn('[MOSSAD] light settings', s.id, e); } }
    }
    /** Плавающее окно настроек лёгкого слоя (команда меню Tampermonkey на любом сайте). */
    function mossadLightOpenPanel() {
        let p = document.getElementById('mossad-light-panel');
        if (p) { p.remove(); return; }
        p = document.createElement('div');
        p.id = 'mossad-light-panel';
        p.style.cssText = 'position:fixed;top:40px;right:20px;z-index:2147483646;width:440px;max-width:94vw;max-height:85vh;overflow:auto;background:rgba(17,24,39,0.97);' +
            'border:1px solid #4b5563;border-radius:10px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,0.6);font:12px system-ui,sans-serif;color:#e5e7eb;';
        p.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:6px;"><b style="flex:1;">🎬 MOSSAD: видео и DND</b><button data-x style="background:none;border:none;color:#9ca3af;font-size:16px;cursor:pointer;">×</button></div><div data-body></div>';
        (document.body || document.documentElement).appendChild(p);
        p.querySelector('[data-x]').onclick = () => p.remove();
        mossadLightRenderSettings(p.querySelector('[data-body]'));
    }
    try { if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('🎬 MOSSAD: видео и DND', mossadLightOpenPanel); } catch (e) {}
