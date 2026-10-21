    // ============================================
    // GITHUB SYNC
    // ============================================
    const GITHUB_OWNER = 'eldmans';
    const GITHUB_REPO = 'tm-scripts';
    const GITHUB_BRANCH = 'grok';

    let _syncQueue = []; // батч изменений
    let _syncTimer = null;
    let _syncStatusEl = null;

    function getSyncStatusEl() {
        if (!_syncStatusEl || !document.body.contains(_syncStatusEl)) {
            _syncStatusEl = document.createElement('div');
            _syncStatusEl.id = 'mossad-sync-status';
            _syncStatusEl.style.cssText = `position:fixed;bottom:8px;right:8px;z-index:9999998;font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(15,15,15,0.85);backdrop-filter:blur(6px);border:1px solid #374151;color:#9ca3af;font-family:system-ui;pointer-events:none;transition:opacity 0.3s;opacity:0;`;
            document.body.appendChild(_syncStatusEl);
        }
        return _syncStatusEl;
    }

    function showSyncStatus(text, color = '#9ca3af', autoHide = false) {
        const el = getSyncStatusEl();
        el.textContent = text;
        el.style.color = color;
        el.style.opacity = '1';
        if (autoHide) setTimeout(() => { el.style.opacity = '0'; }, 3000);
    }

    async function pushConfigToGitHub() {
        if (!config.githubToken) return;
        const token = config.githubToken;
        const path = config.githubConfigPath || 'mossad-config.json';
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        
        // Получаем текущий SHA файла
        let sha = null;
        try {
            const res = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: apiUrl,
                    headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                    onload: resolve,
                    onerror: reject
                });
            });
            if (res.status === 200) {
                const data = JSON.parse(res.responseText);
                sha = data.sha;
            }
        } catch (e) {}
        
        // Экспортируем конфиг без токена
        const exportCfg = JSON.parse(JSON.stringify(config));
        delete exportCfg.githubToken;
        delete exportCfg.allowedDomains; // v1.3.50: список сайтов живёт в GM `mossad_sites`
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportCfg, null, 2))));
        
        const body = JSON.stringify({
            message: `mossad: sync config from ${hostname}`,
            content,
            branch: GITHUB_BRANCH,
            ...(sha ? { sha } : {})
        });
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'PUT',
                url: apiUrl,
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
                data: body,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) resolve();
                    else reject(new Error(`HTTP ${res.status}: ${res.responseText}`));
                },
                onerror: reject
            });
        });
    }

    async function pullConfigFromGitHub() {
        if (!config.githubToken) return;
        const token = config.githubToken;
        const path = config.githubConfigPath || 'mossad-config.json';
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?t=${Date.now()}`;
        
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' },
                onload: (res) => {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            const decoded = JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))));
                            // Применяем конфиг, сохраняя локальный токен
                            const token = config.githubToken;
                            Object.assign(config, decoded);
                            config.githubToken = token;
                            try { normalizeAllHotkeys(); } catch (e) {} // v1.3.45: одна привязка на действие
                            persistLocalConfig();
                            if (window.updateWidgetUI) window.updateWidgetUI();
                            resolve(true);
                        } catch (e) { reject(e); }
                    } else {
                        reject(new Error(`HTTP ${res.status}`));
                    }
                },
                onerror: reject
            });
        });
    }

    // Отложенный батч-пуш
    function scheduleSyncPush() {
        if (!config.githubToken) return;
        if (_syncTimer) clearTimeout(_syncTimer);
        showSyncStatus('🔄 Синхронизация...', '#f59e0b');
        
        _syncTimer = setTimeout(async () => {
            try {
                await pushConfigToGitHub();
                showSyncStatus('✅ Синхронизировано', '#10b981', true);
            } catch (e) {
                showSyncStatus('⚠️ Ошибка синхронизации', '#ef4444');
                console.error('[MOSSAD Sync] Push failed:', e);
            }
        }, 2000); // Батчим: ждём 2 секунды после последнего изменения
    }

    // Проверка при старте
    async function checkAndPullOnStartup() {
        if (!config.githubToken) return;
        try {
            const pulled = await pullConfigFromGitHub();
            if (pulled) showSyncStatus('✅ Конфиг обновлён', '#10b981', true);
        } catch (e) {
            // Тихо — возможно нет файла ещё
        }
    }

    window.addEventListener('storage', (ev) => {
        if (ev.key !== STORAGE_KEY || window.capturingFor !== null) return;
        try { 
            const nc = JSON.parse(ev.newValue); 
            if (nc) {
                Object.assign(config, nc);
                if (window.updateWidgetUI) window.updateWidgetUI();
            } 
        } catch {}
    });

    function formatHotkey(hk) {
        if (!hk || !hk.key) return '—';
        const parts = [];
        if (hk.ctrl)  parts.push('Ctrl');
        if (hk.alt)   parts.push('Alt');
        if (hk.shift) parts.push('Shift');
        parts.push(hk.key === '+' ? '«+»' : hk.key);
        return parts.join('+');
    }
    // ── v1.3.43: физическая клавиша (KeyboardEvent.code) для символа — раскладко-независимые хоткеи ──
    // Строки: code, символ US без Shift, с Shift, символ русской раскладки (ЙЦУКЕН) без Shift / с Shift.
    // Раньше (v1.3.37) по e.code сверялись только латинские буквы и цифры, а (v1.3.39) — хоткеи,
    // записанные с полем code. Знаки («/», «.», «;», «[» …) и хоткеи, записанные в русской
    // раскладке до v1.3.39 (key: 'и' без code), в другой раскладке не срабатывали. ANTI_PATTERNS §22.
    const MOSSAD_KEY_LAYOUT = (() => {
        const rows = [
            ['Backquote', '`', '~', 'ё', 'Ё'], ['Minus', '-', '_'], ['Equal', '=', '+'],
            ['BracketLeft', '[', '{', 'х', 'Х'], ['BracketRight', ']', '}', 'ъ', 'Ъ'], ['Backslash', '\\', '|'],
            ['Semicolon', ';', ':', 'ж', 'Ж'], ['Quote', "'", '"', 'э', 'Э'],
            ['Comma', ',', '<', 'б', 'Б'], ['Period', '.', '>', 'ю', 'Ю'], ['Slash', '/', '?'],
            ['Digit1', '1', '!'], ['Digit2', '2', '@'], ['Digit3', '3', '#'], ['Digit4', '4', '$'], ['Digit5', '5', '%'],
            ['Digit6', '6', '^'], ['Digit7', '7', '&'], ['Digit8', '8', '*'], ['Digit9', '9', '('], ['Digit0', '0', ')'],
            ['Space', ' ', ' ']
        ];
        const ru = 'йцукенгшщзфывапролдячсмитьбю';
        const us = 'qwertyuiopasdfghjklzxcvbnm';
        for (let i = 0; i < us.length; i++) rows.push(['Key' + us[i].toUpperCase(), us[i], us[i].toUpperCase(), ru[i], ru[i].toUpperCase()]);
        const charToCode = new Map();
        const codeToUs = new Map();
        const codeToUsShift = new Map();
        // Сначала US (без Shift / с Shift), затем русские буквы — «.» и «,» остаются за US-клавишами
        rows.forEach(([code, u, us2]) => {
            codeToUs.set(code, u);
            if (us2) codeToUsShift.set(code, us2);
            if (!charToCode.has(u)) charToCode.set(u, code);
            if (us2 && !charToCode.has(us2)) charToCode.set(us2, code);
        });
        rows.forEach(([code, , , r, r2]) => {
            if (r && !charToCode.has(r)) charToCode.set(r, code);
            if (r2 && !charToCode.has(r2)) charToCode.set(r2, code);
        });
        // ю/б заняты клавишами Period/Comma; в ряду букв у них свои code — исправляем
        charToCode.set('ю', 'Period'); charToCode.set('Ю', 'Period'); charToCode.set('б', 'Comma'); charToCode.set('Б', 'Comma');
        return { charToCode, codeToUs, codeToUsShift };
    })();

    /** e.code для символа хоткея (или ''): 'b' / 'и' → 'KeyB', '/' → 'Slash', '.' → 'Period'. */
    function mossadCodeForKey(key) {
        if (typeof key !== 'string' || key.length !== 1) return '';
        return MOSSAD_KEY_LAYOUT.charToCode.get(key) || MOSSAD_KEY_LAYOUT.charToCode.get(key.toLowerCase()) || '';
    }

    /** Символ US-раскладки для e.code (shift — с Shift) или ''. */
    function mossadUsKeyForCode(code, shift = false) {
        return (shift && MOSSAD_KEY_LAYOUT.codeToUsShift.get(code)) || MOSSAD_KEY_LAYOUT.codeToUs.get(code) || '';
    }

    function hotkeyMatches(e, hk) {
        if (!hk) return false;
        if (Array.isArray(hk)) return hk.some(k => hotkeyMatches(e, k));
        if (!hk.key) return false;
        let keyMatch = e.key === hk.key || (typeof e.key === 'string' && typeof hk.key === 'string' && e.key.toLowerCase() === hk.key.toLowerCase());
        // «+» на основном ряду (Equal) и на цифровом блоке (NumpadAdd) считаются одной клавишей (v1.3.39).
        const PLUS_CODES = ['Equal', 'NumpadAdd'];
        if (!keyMatch && typeof e.code === 'string' && (hk.key === '+' || PLUS_CODES.includes(hk.code))) {
            keyMatch = PLUS_CODES.includes(e.code);
        } else if (!keyMatch && typeof e.code === 'string' && e.code) {
            // v1.3.39: записанная физическая клавиша (hk.code); v1.3.43: иначе — code, выведенный из символа
            // (буквы US/RU, цифры, знаки). Так Ctrl+B / Ctrl+/ / Alt+R работают в любой раскладке.
            const code = hk.code || mossadCodeForKey(hk.key);
            if (code) keyMatch = e.code === code;
        }
        return keyMatch &&
            !!e.ctrlKey  === !!hk.ctrl &&
            !!e.altKey   === !!hk.alt &&
            !!e.shiftKey === !!hk.shift &&
            (hk.meta === undefined ? true : !!e.metaKey === !!hk.meta);
    }

