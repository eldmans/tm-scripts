    // ============================================
    // v1.3.67: ЛЁГКИЙ СЛОЙ — скорость видео на всех сайтах (по образцу расширения Speed Control / VideoSpeed)
    // Список клавиш: строки { a: действие, code, key, ctrl, alt, shift, v: значение }. Сверка по e.code — любая
    // раскладка и CapsLock. В поле ввода не срабатывает. Цель — одно активное видео: под курсором, иначе играющее
    // и самое видимое (не все превью). Значок скорости — в правом верхнем углу этого видео (y = 0), без мыши.
    // Загрузка страницы: чтение одного GM-ключа + слушатели keydown / pointermove / ratechange / play (capture).
    // ============================================
    const MOSSAD_SPEED_GM_KEY = 'mossad_speed';
    const MOSSAD_SPEED_LIST_DEFAULT = '0.1,0.2,0.3,0.5,0.7,0.8,0.9,1,1.1,1.2,1.3,1.5,1.7,2,2.5,3,4,5,7.5,10,15,20';
    const MOSSAD_SPEED_ACTIONS = [
        ['badge', 'Показать/скрыть скорость'], ['slower', 'Медленнее'], ['faster', 'Быстрее'],
        ['rewind', 'Перемотка назад'], ['advance', 'Вперёд'], ['reset', 'Сброс'], ['fav', 'Любимая скорость'],
    ];
    const _spRow = (a, code, key, v) => ({ a, code, key, ctrl: false, alt: false, shift: false, v: v == null ? '' : String(v) });
    // Как на скриншоте владельца (Speed Control отключён — клавиши свободны)
    const MOSSAD_SPEED_ROWS_DEFAULT = [
        _spRow('badge', 'F2', 'F2'), _spRow('slower', 'KeyW', 'w'), _spRow('faster', 'KeyE', 'e'),
        _spRow('rewind', 'KeyZ', 'z', 5), _spRow('advance', 'KeyX', 'x', 5), _spRow('reset', 'KeyR', 'r'),
        _spRow('fav', 'KeyG', 'g', 2), _spRow('advance', 'KeyV', 'v', 30), _spRow('rewind', 'KeyC', 'c', 30),
        _spRow('rewind', 'Numpad0', '0', 5), _spRow('advance', 'NumpadDecimal', '.', 5), _spRow('reset', 'Numpad3', '3'),
    ];
    let _spCfg = null;
    function mossadSpeedCfg(fresh) {
        if (_spCfg && !fresh) return _spCfg;
        let o = null;
        try { if (typeof GM_getValue === 'function') o = GM_getValue(MOSSAD_SPEED_GM_KEY, null); } catch (e) {}
        try { if (typeof o === 'string') o = JSON.parse(o); } catch (e) { o = null; }
        o = (o && typeof o === 'object') ? o : {};
        _spCfg = {
            enabled: o.enabled !== false, remember: o.remember !== false, hold: o.hold !== false, audio: !!o.audio,
            badge: ['off', 'ne1', 'always'].includes(o.badge) ? o.badge : 'ne1',
            list: typeof o.list === 'string' && o.list.trim() ? o.list : MOSSAD_SPEED_LIST_DEFAULT,
            rows: Array.isArray(o.rows) ? o.rows.filter(r => r && typeof r === 'object' && r.a) : MOSSAD_SPEED_ROWS_DEFAULT.map(r => Object.assign({}, r)),
        };
        return _spCfg;
    }
    function mossadSpeedSave(patch) {
        const c = Object.assign({}, mossadSpeedCfg(), patch || {});
        _spCfg = c;
        try { if (typeof GM_setValue === 'function') GM_setValue(MOSSAD_SPEED_GM_KEY, JSON.stringify(c)); } catch (e) {}
        return c;
    }
    if (typeof GM_addValueChangeListener === 'function') { try { GM_addValueChangeListener(MOSSAD_SPEED_GM_KEY, () => { _spCfg = null; }); } catch (e) {} }
    function mossadSpeedList() {
        const arr = String(mossadSpeedCfg().list).split(/[,;\s]+/).map(Number).filter(x => isFinite(x) && x > 0 && x <= 100);
        return Array.from(new Set(arr)).sort((a, b) => a - b);
    }
    /** Строка-привязка скорости, совпавшая с нажатием (или null). */
    function mossadSpeedMatch(e) {
        const c = mossadSpeedCfg();
        if (!c.enabled || !e.code) return null;
        return c.rows.find(r => r.code && r.code === e.code && !!r.ctrl === !!e.ctrlKey && !!r.alt === !!e.altKey && !!r.shift === !!e.shiftKey && !e.metaKey) || null;
    }
    /** Коды без модификаторов, занятые скоростью (для пропуска в клавишах похожих пинов Pinterest). */
    function mossadSpeedBusyCodes() {
        const c = mossadSpeedCfg();
        return c.enabled ? c.rows.filter(r => r.code && !r.ctrl && !r.alt).map(r => r.code) : [];
    }

    const _sp = { x: -1, y: -1, last: 1, hidden: false, badge: null, badgeFor: null, onMove: null };
    function _spEditable(el) {
        if (!el || !el.tagName) return false;
        const t = el.tagName;
        if (t === 'TEXTAREA' || t === 'SELECT') return true;
        if (t === 'INPUT') return !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/i.test(el.type || '');
        return !!(el.isContentEditable || (el.closest && el.closest('[contenteditable=""],[contenteditable="true"],[role="textbox"]')));
    }
    function _spArea(v) {
        const r = v.getBoundingClientRect();
        const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
        return Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    }
    /** Активное медиа: под курсором → играющее и самое видимое → самое видимое. */
    function mossadSpeedTarget() {
        const audio = mossadSpeedCfg().audio;
        if (_sp.x >= 0 && document.elementsFromPoint) {
            for (const el of document.elementsFromPoint(_sp.x, _sp.y)) {
                if (el.tagName === 'VIDEO' || (audio && el.tagName === 'AUDIO')) return el;
            }
        }
        const all = Array.from(document.querySelectorAll(audio ? 'video, audio' : 'video'));
        if (!all.length) return null;
        const vis = (m) => m.tagName === 'AUDIO' ? 1 : _spArea(m);
        const best = (list) => { let b = null, mx = 0; for (const m of list) { const a = vis(m); if (a > mx) { mx = a; b = m; } } return b; };
        return best(all.filter(m => !m.paused && !m.ended)) || best(all) || (audio ? all.find(m => m.tagName === 'AUDIO') : null);
    }
    function _spFmt(r) { return (Math.round(r * 100) / 100).toString(); }
    function _spBadgeWanted(m) {
        const mode = mossadSpeedCfg().badge;
        if (mode === 'off' || _sp.hidden || !m || m.tagName !== 'VIDEO') return false;
        return mode === 'always' || Math.abs(m.playbackRate - 1) > 1e-6;
    }
    function _spPlaceBadge() {
        const b = _sp.badge, m = _sp.badgeFor;
        if (!b || !m) return;
        if (!m.isConnected || !_spBadgeWanted(m)) { _spHideBadge(); return; }
        const r = m.getBoundingClientRect();
        b.textContent = _spFmt(m.playbackRate) + '×';
        const host = document.fullscreenElement && document.fullscreenElement !== m && document.fullscreenElement.contains(m) ? document.fullscreenElement : (document.body || document.documentElement);
        if (b.parentNode !== host) host.appendChild(b);
        b.style.top = Math.max(0, r.top) + 'px';
        b.style.left = Math.max(0, r.right - (b.offsetWidth || 40)) + 'px';
    }
    function _spHideBadge() {
        if (_sp.badge) _sp.badge.remove();
        _sp.badge = null; _sp.badgeFor = null;
        if (_sp.onMove) { window.removeEventListener('scroll', _sp.onMove, true); window.removeEventListener('resize', _sp.onMove); _sp.onMove = null; }
    }
    function mossadSpeedShowBadge(m) {
        if (!_spBadgeWanted(m)) { if (!m || _sp.badgeFor === m || !_sp.badgeFor || mossadSpeedCfg().badge === 'off') _spHideBadge(); return; }
        if (!_sp.badge) {
            const b = document.createElement('div');
            b.id = 'mossad-speed-badge';
            b.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;padding:1px 6px;border-radius:0 0 0 6px;background:rgba(0,0,0,0.65);' +
                'color:#fff;font:600 12px/16px system-ui,sans-serif;';
            _sp.badge = b;
            _sp.onMove = () => _spPlaceBadge();
            window.addEventListener('scroll', _sp.onMove, { capture: true, passive: true });
            window.addEventListener('resize', _sp.onMove, { passive: true });
        }
        _sp.badgeFor = m;
        _spPlaceBadge();
    }
    function _spRememberKey() { return 'mossad_speed_rate'; }
    /** Поставить скорость (с охраной от сброса сайтом). */
    function mossadSetRate(m, r) {
        r = Math.max(0.0625, Math.round(r * 1000) / 1000);
        // Chrome/Edge: максимум 16 (больше — исключение); Firefox пропускает больше
        m._mossadRate = r; // до присваивания: охрана ratechange не должна «вернуть» старое значение
        m._mossadGuardUntil = Date.now() + 2000;
        try { m.playbackRate = r; } catch (e) { r = Math.min(r, 16); m._mossadRate = r; try { m.playbackRate = r; } catch (e2) {} }
        if (mossadSpeedCfg().remember) { try { localStorage.setItem(_spRememberKey(), String(r)); } catch (e) {} }
        mossadSpeedShowBadge(m);
        if (!_sp.badge || _sp.badgeFor !== m) mossadLightToast('⏩ ' + _spFmt(r) + '×');
        return r;
    }
    function mossadSpeedAction(row, m) {
        const list = mossadSpeedList();
        const cur = m.playbackRate || 1;
        const num = parseFloat(row.v);
        switch (row.a) {
            case 'badge':
                _sp.hidden = !_sp.hidden;
                if (_sp.hidden) _spHideBadge(); else { mossadSpeedShowBadge(m); if (!_sp.badge) mossadLightToast('⏩ ' + _spFmt(cur) + '×'); }
                return;
            case 'faster': case 'slower': {
                const up = row.a === 'faster';
                let next;
                if (isFinite(num) && num > 0) next = up ? cur + num : cur - num;
                else next = up ? (list.find(x => x > cur + 1e-6) || list[list.length - 1] || cur) : (list.slice().reverse().find(x => x < cur - 1e-6) || list[0] || cur);
                if (Math.abs(cur - 1) > 1e-6) _sp.last = cur;
                mossadSetRate(m, next);
                return;
            }
            case 'rewind': case 'advance': {
                const s = isFinite(num) ? num : 5;
                try { m.currentTime = Math.max(0, (m.currentTime || 0) + (row.a === 'advance' ? s : -s)); } catch (e) {}
                return;
            }
            case 'reset':
                if (Math.abs(cur - 1) > 1e-6) { _sp.last = cur; mossadSetRate(m, 1); }
                else mossadSetRate(m, _sp.last && Math.abs(_sp.last - 1) > 1e-6 ? _sp.last : 1);
                return;
            case 'fav':
                if (Math.abs(cur - 1) > 1e-6) _sp.last = cur;
                mossadSetRate(m, isFinite(num) && num > 0 ? num : 2);
                return;
        }
    }

    function _spOnKey(e) {
        if (e.repeat && !/^(faster|slower|rewind|advance)$/.test((mossadSpeedMatch(e) || {}).a || '')) return;
        if (window.capturingFor != null || window.mossadSpeedCapturing) return; // идёт запись клавиши в настройках
        const row = mossadSpeedMatch(e);
        if (!row || _spEditable(document.activeElement) || _spEditable(e.target)) return;
        const m = mossadSpeedTarget();
        if (!m) return; // на странице нет видео — клавиша сайту
        mossadSpeedAction(row, m);
    }
    window.addEventListener('keydown', _spOnKey, true);
    window.addEventListener('pointermove', (e) => { _sp.x = e.clientX; _sp.y = e.clientY; }, { capture: true, passive: true });
    // Сайт сбросил скорость: 2 с после нашего изменения — всегда; «Удерживать скорость» — постоянно
    window.addEventListener('ratechange', (e) => {
        const m = e.target;
        if (!m || m._mossadRate == null) { if (m === _sp.badgeFor) _spPlaceBadge(); return; }
        if (Math.abs(m.playbackRate - m._mossadRate) > 1e-6 && (Date.now() < m._mossadGuardUntil || mossadSpeedCfg().hold)) {
            try { m.playbackRate = m._mossadRate; } catch (err) {}
            return;
        }
        if (m === _sp.badgeFor) _spPlaceBadge();
    }, true);
    // «Запоминать скорость»: новое видео начинает с последней скорости; «всегда» — значок на играющем
    window.addEventListener('play', (e) => {
        const m = e.target;
        const c = mossadSpeedCfg();
        if (!c.enabled || !m || (m.tagName !== 'VIDEO' && !(c.audio && m.tagName === 'AUDIO'))) return;
        if (c.remember && m._mossadRate == null) {
            let r = NaN;
            try { r = parseFloat(localStorage.getItem(_spRememberKey())); } catch (err) {}
            if (isFinite(r) && r > 0 && Math.abs(r - (m.playbackRate || 1)) > 1e-6) { m._mossadRate = r; m._mossadGuardUntil = Date.now() + 2000; try { m.playbackRate = r; } catch (err) {} }
        }
        if (c.badge === 'always' || (m._mossadRate != null && Math.abs(m.playbackRate - 1) > 1e-6)) mossadSpeedShowBadge(m);
    }, true);

    /** Строки скорости с тем же сочетанием, что binding: [{ label, clear() }]. comboId — функция сравнения (из MOSSAD или своя). */
    function mossadSpeedOwners(binding, comboId, exceptIdx) {
        const id = comboId(binding);
        if (!id) return [];
        const c = mossadSpeedCfg();
        const names = Object.fromEntries(MOSSAD_SPEED_ACTIONS);
        return c.rows.map((r, i) => ({ r, i })).filter(({ r, i }) => i !== exceptIdx && r.code && comboId({ key: r.key, code: r.code, ctrl: r.ctrl, alt: r.alt, shift: r.shift }) === id)
            .map(({ r, i }) => ({ label: '🎬 ' + (names[r.a] || r.a) + (r.v !== '' ? ' ' + r.v : ''), clear: () => {
                const rows = mossadSpeedCfg().rows.slice(); if (rows[i]) rows[i] = Object.assign({}, rows[i], { code: '', key: '' }); mossadSpeedSave({ rows });
            } }));
    }
    /** Своё сравнение сочетаний (когда MOSSAD не загружен): модификаторы + физическая клавиша. */
    function mossadSpeedComboId(b) {
        if (!b || !(b.code || b.key)) return '';
        return [b.ctrl, b.alt, b.shift].map(x => x ? 1 : 0).join('') + '|' + (b.code || String(b.key).toLowerCase());
    }
    // Крючок: mossadMain (на сайтах из списка) кладёт сюда поиск/очистку совпадений среди хоткеев MOSSAD
    let mossadLightHkHook = null;
