    // ============================================
    // BEEPS (v1.3.82): звуковые сигналы скачивания (issue #2, п.5)
    //  • dup   — «уже скачивали» (по умолчанию двойной низкий короткий);
    //  • start — скачивание началось (по умолчанию один высокий).
    // Настройки — вкладка «⚙ Общие» → «🔔 Сигналы»: общий вкл/выкл, громкость, у каждого сигнала —
    // вкл/выкл, высота (Гц), сколько раз, длительность (мс) и ▶ проба.
    // Хранение: GM `mossad_beeps` (общее для всех сайтов), запасной вариант — localStorage.
    // Звук — через общий AudioContext (getCircleAudioCtx, ANTI_PATTERNS §17).
    // ============================================
    const BEEPS_GM_KEY = 'mossad_beeps';
    const BEEP_DEFAULTS = {
        on: true, volume: 40,
        dup: { on: true, hz: 330, count: 2, ms: 90 },
        start: { on: true, hz: 1320, count: 1, ms: 90 },
    };
    const BEEP_LIMITS = { hz: [50, 8000], count: [1, 5], ms: [20, 1000], volume: [0, 100] };
    const BEEP_DEDUP_MS = 400; // один и тот же сигнал из нескольких мест одного скачивания — звучит один раз
    const _beepLast = {};
    const _beepLog = [];

    function _beepNum(v, lim, dflt) {
        const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
        if (!isFinite(n)) return dflt;
        return Math.max(lim[0], Math.min(lim[1], Math.round(n)));
    }
    /** Нормализовать настройки (непонятные значения → по умолчанию, числа — в допустимых пределах). */
    function mossadBeepsNormalize(b) {
        const src = (b && typeof b === 'object') ? b : {};
        const out = { on: src.on !== false, volume: _beepNum(src.volume, BEEP_LIMITS.volume, BEEP_DEFAULTS.volume) };
        ['dup', 'start'].forEach(k => {
            const s = (src[k] && typeof src[k] === 'object') ? src[k] : {};
            const d = BEEP_DEFAULTS[k];
            out[k] = { on: s.on !== false, hz: _beepNum(s.hz, BEEP_LIMITS.hz, d.hz), count: _beepNum(s.count, BEEP_LIMITS.count, d.count), ms: _beepNum(s.ms, BEEP_LIMITS.ms, d.ms) };
        });
        return out;
    }
    function mossadBeepsRead() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(BEEPS_GM_KEY, null); } catch (e) {}
        if (raw == null) { try { raw = localStorage.getItem(BEEPS_GM_KEY); } catch (e) {} }
        let obj = null;
        try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) {}
        return mossadBeepsNormalize(obj);
    }
    function mossadBeepsWrite(b) {
        const n = mossadBeepsNormalize(b);
        const s = JSON.stringify(n);
        try { if (typeof GM_setValue === 'function') GM_setValue(BEEPS_GM_KEY, s); } catch (e) {}
        try { localStorage.setItem(BEEPS_GM_KEY, s); } catch (e) {}
        return n;
    }
    /** Последние сыгранные сигналы (для тестов и диагностики): [{kind, hz, count, ms, t}]. */
    function mossadBeepLog() { return _beepLog.slice(); }

    /**
     * Сыграть сигнал kind ('dup' | 'start'). opts.test — проба из настроек (звучит, даже если сигнал
     * или все сигналы выключены, и без защиты от повтора); opts.cfg — свои настройки (проба несохранённых полей).
     * Возвращает true, если звук запущен.
     */
    function mossadBeep(kind, opts = {}) {
        const b = opts.cfg ? mossadBeepsNormalize(opts.cfg) : mossadBeepsRead();
        const s = b[kind];
        if (!s) return false;
        if (!opts.test) {
            if (!b.on || !s.on) return false;
            const now = Date.now();
            if (_beepLast[kind] && now - _beepLast[kind] < BEEP_DEDUP_MS) return false;
            _beepLast[kind] = now;
        }
        const vol = b.volume / 100;
        _beepLog.push({ kind, hz: s.hz, count: s.count, ms: s.ms, volume: b.volume, t: Date.now() });
        if (_beepLog.length > 20) _beepLog.shift();
        if (vol <= 0) return false;
        try {
            const ctx = getCircleAudioCtx();
            if (!ctx) return false;
            if (ctx.state === 'suspended' && typeof ctx.resume === 'function') { try { ctx.resume().catch(() => {}); } catch (e) {} }
            const dur = s.ms / 1000;
            const gap = Math.max(0.04, dur * 0.8);
            for (let i = 0; i < s.count; i++) {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = s.hz;
                const t0 = ctx.currentTime + 0.01 + i * (dur + gap);
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.5 * vol), t0 + Math.min(0.01, dur / 4));
                g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                osc.start(t0); osc.stop(t0 + dur + 0.02);
                osc.onended = () => { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
            }
            return true;
        } catch (e) { return false; } // AudioContext может быть заблокирован до первого клика
    }
