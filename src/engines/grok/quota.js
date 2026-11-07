    // ============================================
    // GROK QUOTA & LIMIT DISPLAY (v1.3.87)
    // Определение расхода квоты, времени до сброса и тарифа Grok.
    // Отображение компактной плашки по центру вверху экрана с перетаскиванием.
    // ============================================

    let _cachedGrokQuota = null;
    let _lastGrokQuotaFetchAt = 0;
    let _grokQuotaPillEl = null;
    let _grokQuotaTickTimer = null;
    let _grokQuotaFetchTimer = null;

    try {
        const _saved = sessionStorage.getItem('mossad_grok_quota');
        if (_saved) _cachedGrokQuota = JSON.parse(_saved);
    } catch (e) {}

    function _grokHostWindow() {
        try {
            if (typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.document) return unsafeWindow;
        } catch (e) {}
        return window;
    }

    const _grokEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ── Protobuf & gRPC-Web декодеры (GetGrokCreditsConfig) ──
    function _decodeVarint(buf, offset) {
        let result = 0;
        let shift = 0;
        let pos = offset;
        while (pos < buf.length) {
            const byte = buf[pos++];
            result |= (byte & 0x7f) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        return { value: result, next: pos };
    }

    function _parseProtobufTimestamp(buf, offset, length) {
        const end = offset + length;
        let pos = offset;
        let seconds = 0;
        let nanos = 0;
        while (pos < end) {
            const tag = buf[pos++];
            const field = tag >> 3;
            const wire = tag & 0x07;
            if (wire === 0) {
                const decoded = _decodeVarint(buf, pos);
                pos = decoded.next;
                if (field === 1) seconds = decoded.value;
                else if (field === 2) nanos = decoded.value;
            } else {
                break;
            }
        }
        if (!seconds) return null;
        return new Date(seconds * 1000 + nanos / 1e6).toISOString();
    }

    function _parseGrpcWebCreditsConfig(buffer) {
        const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        if (buf.length < 10) return null;

        let usagePercent = null;
        const productUsage = [];
        let periodStart = null;
        let periodEnd = null;

        for (let i = 0; i < buf.length - 5; i++) {
            if (buf[i] === 0x0d) {
                const view = new DataView(buf.buffer, buf.byteOffset + i + 1, 4);
                const val = Math.round(view.getFloat32(0, true));
                if (val >= 0 && val <= 100) usagePercent = val;
                break;
            }
        }

        for (let i = 0; i < buf.length - 7; i++) {
            if (buf[i] === 0x3a && buf[i + 1] === 0x07 && buf[i + 2] === 0x08) {
                const product = buf[i + 3];
                if (buf[i + 4] === 0x15) {
                    const view = new DataView(buf.buffer, buf.byteOffset + i + 5, 4);
                    const pct = Math.round(view.getFloat32(0, true));
                    if (pct >= 0 && pct <= 100) {
                        productUsage.push({ product, usagePercent: pct });
                    }
                }
            }
        }

        for (let i = 0; i < buf.length - 4; i++) {
            if (buf[i] === 0x42 && buf[i + 1] > 0 && buf[i + 1] < 40) {
                const blockLen = buf[i + 1];
                const blockStart = i + 2;
                const blockEnd = blockStart + blockLen;
                if (blockEnd > buf.length) continue;
                let pos = blockStart;
                while (pos < blockEnd - 1) {
                    const tag = buf[pos++];
                    const field = tag >> 3;
                    const wire = tag & 0x07;
                    if (wire === 2) {
                        const len = buf[pos++];
                        if (field === 2 && !periodStart) {
                            periodStart = _parseProtobufTimestamp(buf, pos, len);
                        } else if (field === 3 && !periodEnd) {
                            periodEnd = _parseProtobufTimestamp(buf, pos, len);
                        }
                        pos += len;
                    } else if (wire === 0) {
                        const decoded = _decodeVarint(buf, pos);
                        pos = decoded.next;
                    } else {
                        break;
                    }
                }
                if (periodStart || periodEnd) break;
            }
        }

        if (usagePercent === null && productUsage.length === 0) {
            if (periodStart || periodEnd) {
                return {
                    usagePercent: 0,
                    currentPeriod: { type: 'weekly', start: periodStart, end: periodEnd },
                    productUsage: [],
                };
            }
            return null;
        }

        return {
            usagePercent: usagePercent ?? 0,
            currentPeriod: { type: 'weekly', start: periodStart, end: periodEnd },
            productUsage,
        };
    }

    // ── JSON декодер ──
    function _finiteNum(v) {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
        return null;
    }

    function _isoFromAny(v) {
        if (!v) return null;
        if (typeof v === 'string' || typeof v === 'number') {
            const d = new Date(v);
            return Number.isNaN(d.getTime()) ? null : d.toISOString();
        }
        if (typeof v === 'object') {
            const sec = _finiteNum(v.seconds);
            if (sec == null) return null;
            const nanos = _finiteNum(v.nanos) || 0;
            return new Date(sec * 1000 + nanos / 1e6).toISOString();
        }
        return null;
    }

    function _parseCreditsJson(text) {
        let obj;
        try { obj = JSON.parse(text); } catch (e) { return null; }
        if (!obj || typeof obj !== 'object') return null;
        const cfg = obj.config && typeof obj.config === 'object' ? obj.config : obj;
        const pct = _finiteNum(cfg.creditUsagePercent != null ? cfg.creditUsagePercent : cfg.credit_usage_percent);
        const period = cfg.currentPeriod || cfg.current_period || {};
        const end = _isoFromAny(period.end) || _isoFromAny(cfg.billingPeriodEnd || cfg.billing_period_end);
        const start = _isoFromAny(period.start) || _isoFromAny(cfg.billingPeriodStart || cfg.billing_period_start);
        if (pct == null && !end && !start) return null;
        return {
            usagePercent: pct == null ? 0 : Math.round(pct),
            currentPeriod: { type: 'weekly', start, end },
        };
    }

    const GROK_CREDIT_PATHS = [
        '/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig',
        '/prod_mc_billing.ConsumerUiSvc/GetGrokUsageInfo',
    ];

    function _isWeeklyCreditsUrl(urlStr) {
        return typeof urlStr === 'string' && (urlStr.includes('GetGrokCreditsConfig') || urlStr.includes('GetGrokUsageInfo'));
    }

    async function _readCreditsResponse(res) {
        const grpcStatus = res.headers.get('grpc-status');
        if (grpcStatus && grpcStatus !== '0') return null;
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('json')) {
            const text = await res.clone().text().catch(() => '');
            return _parseCreditsJson(text);
        }
        const buf = await res.clone().arrayBuffer().catch(() => null);
        if (!buf) return null;
        const proto = _parseGrpcWebCreditsConfig(buf);
        if (proto && typeof proto.usagePercent === 'number') return proto;
        try {
            const text = new TextDecoder().decode(buf).replace(/^\s+/, '');
            if (text.startsWith('{')) return _parseCreditsJson(text);
        } catch (e) {}
        return null;
    }

    function rememberGrokQuota(parsed, source) {
        if (!parsed || typeof parsed.usagePercent !== 'number') return false;
        _cachedGrokQuota = { ...parsed, source: source || 'api' };
        _lastGrokQuotaFetchAt = Date.now();
        try {
            sessionStorage.setItem('mossad_grok_quota', JSON.stringify(_cachedGrokQuota));
        } catch (e) {}
        updateGrokQuotaPill();
        return true;
    }

    async function _fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const w = _grokHostWindow();
            return await w.fetch.call(w, url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchGrokCreditsConfig(maxAttempts = 1) {
        const origin = _grokHostWindow().location.origin;
        const protoInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
                'content-type': 'application/grpc-web+proto',
                'x-grpc-web': '1',
                'x-user-agent': 'connect-es/2.1.1',
            },
            body: new Uint8Array([0, 0, 0, 0, 0]),
        };
        const jsonInit = {
            method: 'POST',
            credentials: 'include',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'connect-protocol-version': '1',
            },
            body: '{}',
        };
        let lastErr = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            for (const path of GROK_CREDIT_PATHS) {
                const url = origin + path;
                for (const init of [protoInit, jsonInit]) {
                    try {
                        const res = await _fetchWithTimeout(url, init, 8000);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        const parsed = await _readCreditsResponse(res);
                        if (parsed && typeof parsed.usagePercent === 'number') return parsed;
                        lastErr = new Error('empty credits response');
                    } catch (e) {
                        lastErr = e;
                    }
                }
            }
            if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 350 * attempt));
        }
        if (lastErr) throw lastErr;
        return null;
    }

    async function grokFetchQuota(force = false, maxAttempts = 1) {
        const now = Date.now();
        if (!force && _cachedGrokQuota && typeof _cachedGrokQuota.usagePercent === 'number' && (now - _lastGrokQuotaFetchAt) < 300000) {
            return _cachedGrokQuota;
        }
        try {
            const parsed = await fetchGrokCreditsConfig(maxAttempts);
            if (parsed && typeof parsed.usagePercent === 'number') {
                rememberGrokQuota(parsed, 'api');
                return _cachedGrokQuota;
            }
        } catch (e) {
            // Тихое игнорирование при сбоях сети
        }
        return _cachedGrokQuota;
    }

    function grokGetCachedQuota() {
        return _cachedGrokQuota;
    }

    // ── Определение тарифа (SuperGrok -> S, Premium -> P, Free/Guest -> F) ──
    function detectGrokSubscription(cachedUsage) {
        try {
            const fullText = (document.body?.innerText || '').toLowerCase();
            const headerEl = document.querySelector('header, nav, [class*="header"], [data-testid*="top"]');
            const headerText = headerEl ? headerEl.innerText.toLowerCase() : '';
            const blob = headerText + '\n' + fullText;

            if (/supergrok|grok\s*heavy/.test(blob)) return 'super';
            if (cachedUsage && typeof cachedUsage.usagePercent === 'number') {
                return 'super';
            }
            if (blob.includes('premium+') || blob.includes('premium plus') || /\bpremium\b/.test(headerText)) {
                return 'premium';
            }
            const loginBtn = document.querySelector(
                'a[href*="login"], a[href*="sign-in"], button[aria-label*="sign in" i], button[aria-label*="log in" i], [data-testid*="login"]'
            );
            if (loginBtn && !/sign\s*out|log\s*out|выйти|выход/.test(blob)) {
                return 'guest';
            }
            return 'free';
        } catch (e) {
            return 'free';
        }
    }

    function getGrokTierLetter(tierId) {
        if (tierId === 'super') return 'S';
        if (tierId === 'premium') return 'P';
        return 'F';
    }

    function getGrokTierColor(tierId) {
        if (tierId === 'super') return '#34d399';
        if (tierId === 'premium') return '#60a5fa';
        return '#9ca3af';
    }

    function getGrokUsagePercentStr(cachedUsage) {
        if (!cachedUsage || typeof cachedUsage.usagePercent !== 'number') {
            return '—';
        }
        const pct = Math.max(0, Math.min(100, Math.round(cachedUsage.usagePercent)));
        return pct + '%';
    }

    function getGrokQuotaPctColor(cachedUsage) {
        if (!cachedUsage || typeof cachedUsage.usagePercent !== 'number') return '#9ca3af';
        const pct = cachedUsage.usagePercent;
        if (pct >= 90) return '#ef4444';
        if (pct >= 70) return '#f59e0b';
        return '#10b981';
    }

    function formatGrokResetTime(resetIso, mode = 'auto') {
        if (!resetIso) return '';
        const end = new Date(resetIso).getTime();
        if (!Number.isFinite(end)) return '';
        const sec = Math.max(0, Math.floor((end - Date.now()) / 1000));
        const days = Math.floor(sec / 86400);
        const remHours = Math.floor((sec % 86400) / 3600);
        const totalHours = Math.floor(sec / 3600);

        if (mode === 'hours') {
            return totalHours + 'ч';
        }
        if (mode === 'both') {
            if (days >= 1) {
                return `${days}д ${remHours}ч`;
            }
            return totalHours + 'ч';
        }
        // auto
        if (days >= 1) {
            return days + 'д';
        }
        return totalHours + 'ч';
    }

    function buildGrokQuotaText(cachedUsage, cfg) {
        const sep = (cfg && cfg.grokQuotaSep != null) ? cfg.grokQuotaSep : ' · ';
        const mode = (cfg && cfg.grokQuotaTimeMode) || 'auto';
        
        const pctStr = getGrokUsagePercentStr(cachedUsage);
        const tierId = detectGrokSubscription(cachedUsage);
        const tierLetter = getGrokTierLetter(tierId);
        const resetIso = cachedUsage?.currentPeriod?.end;
        const timeStr = formatGrokResetTime(resetIso, mode);

        const parts = [pctStr];
        if (timeStr) parts.push(timeStr);
        parts.push(tierLetter);
        return parts.join(sep);
    }

    function renderGrokQuotaHtml(cachedUsage, cfg) {
        const sep = (cfg && cfg.grokQuotaSep != null) ? cfg.grokQuotaSep : ' · ';
        const mode = (cfg && cfg.grokQuotaTimeMode) || 'auto';
        
        const pctStr = getGrokUsagePercentStr(cachedUsage);
        const pctColor = getGrokQuotaPctColor(cachedUsage);
        const tierId = detectGrokSubscription(cachedUsage);
        const tierLetter = getGrokTierLetter(tierId);
        const tierColor = getGrokTierColor(tierId);
        const resetIso = cachedUsage?.currentPeriod?.end;
        const timeStr = formatGrokResetTime(resetIso, mode);

        let html = `<span style="color:${pctColor};font-weight:700;">${_grokEsc(pctStr)}</span>`;
        if (timeStr) {
            html += `<span style="color:#6b7280;margin:0 2px;">${_grokEsc(sep)}</span><span style="color:#d1d5db;">${_grokEsc(timeStr)}</span>`;
        }
        html += `<span style="color:#6b7280;margin:0 2px;">${_grokEsc(sep)}</span><span style="color:${tierColor};font-weight:700;">${_grokEsc(tierLetter)}</span>`;
        return html;
    }

    // ── Перетаскивание плашки ──
    function initGrokQuotaPillDrag(pill) {
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let isDragging = false;
        let dragThresholdPassed = false;

        const onPointerMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!dragThresholdPassed && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                dragThresholdPassed = true;
            }
            if (!dragThresholdPassed) return;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const vw = window.innerWidth || 1024;
            const vh = window.innerHeight || 768;
            const rect = pill.getBoundingClientRect();
            newLeft = Math.max(4, Math.min(newLeft, vw - rect.width - 4));
            newTop = Math.max(4, Math.min(newTop, vh - rect.height - 4));

            pill.style.left = newLeft + 'px';
            pill.style.top = newTop + 'px';
            pill.style.transform = 'none';
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);

            if (dragThresholdPassed) {
                const rect = pill.getBoundingClientRect();
                config.grokQuotaPos = { left: Math.round(rect.left), top: Math.round(rect.top) };
                Settings.save();
            } else {
                grokFetchQuota(true).then(() => {
                    showToast('✓ Квота Grok обновлена');
                }).catch(() => {
                    showToast('Ошибка обновления квоты');
                });
            }
        };

        pill.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const rect = pill.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
            isDragging = true;
            dragThresholdPassed = false;
            window.addEventListener('pointermove', onPointerMove, true);
            window.addEventListener('pointerup', onPointerUp, true);
            e.preventDefault();
        });
    }

    // ── Рендер плашки на странице ──
    function updateGrokQuotaPill() {
        if (rootDomain !== 'grok.com') return;
        if (config.grokQuotaEnabled === false) {
            if (_grokQuotaPillEl) _grokQuotaPillEl.style.display = 'none';
            return;
        }

        if (!_grokQuotaPillEl) {
            _grokQuotaPillEl = document.createElement('div');
            _grokQuotaPillEl.id = 'mossad-grok-quota-pill';
            _grokQuotaPillEl.style.cssText = `
                position: fixed; z-index: 9999999;
                display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 12px;
                background: rgba(17, 24, 39, 0.88);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(75, 85, 99, 0.65);
                border-radius: 9999px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
                color: #e5e7eb;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                font-weight: 600;
                letter-spacing: 0.02em;
                cursor: move;
                user-select: none;
                transition: border-color 0.15s, box-shadow 0.15s;
            `;
            initGrokQuotaPillDrag(_grokQuotaPillEl);
            document.body.appendChild(_grokQuotaPillEl);
        } else if (!_grokQuotaPillEl.parentNode) {
            document.body.appendChild(_grokQuotaPillEl);
        }

        _grokQuotaPillEl.style.display = 'inline-flex';

        // Положение
        const pos = config.grokQuotaPos;
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            _grokQuotaPillEl.style.left = pos.left + 'px';
            _grokQuotaPillEl.style.top = pos.top + 'px';
            _grokQuotaPillEl.style.transform = 'none';
        } else {
            _grokQuotaPillEl.style.left = '50%';
            _grokQuotaPillEl.style.top = '10px';
            _grokQuotaPillEl.style.transform = 'translateX(-50%)';
        }

        _grokQuotaPillEl.innerHTML = renderGrokQuotaHtml(_cachedGrokQuota, config);

        // Tooltip
        const pctNum = (_cachedGrokQuota && typeof _cachedGrokQuota.usagePercent === 'number') ? Math.round(_cachedGrokQuota.usagePercent) : null;
        const tierId = detectGrokSubscription(_cachedGrokQuota);
        const tierLetter = getGrokTierLetter(tierId);
        const resetIso = _cachedGrokQuota?.currentPeriod?.end;
        const timeStr = formatGrokResetTime(resetIso, config.grokQuotaTimeMode || 'auto');

        let tooltip = `Grok Quota: ${getGrokUsagePercentStr(_cachedGrokQuota)}`;
        if (pctNum != null) {
            tooltip += ` израсходовано (${Math.max(0, 100 - pctNum)}% осталось)`;
        }
        if (resetIso) {
            tooltip += `\nСброс через: ${timeStr} (${new Date(resetIso).toLocaleString()})`;
        }
        tooltip += `\nТариф: ${tierId === 'super' ? 'SuperGrok' : tierId === 'premium' ? 'Premium' : 'Free'} (${tierLetter})`;
        tooltip += `\n(Клик — обновить данные, зажатие — переместить)`;
        _grokQuotaPillEl.title = tooltip;
    }

    // ── Перехват сетевых запросов fetch на странице ──
    function initGrokQuotaFetchInterceptor() {
        try {
            const page = _grokHostWindow();
            if (page._mossadQuotaFetchHooked) return;
            page._mossadQuotaFetchHooked = true;
            const origFetch = page.fetch.bind(page);
            page.fetch = async function (input, init) {
                const res = await origFetch(input, init);
                try {
                    const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
                    if (typeof urlStr === 'string' && res.ok && _isWeeklyCreditsUrl(urlStr)) {
                        const parsed = await _readCreditsResponse(res);
                        if (parsed && typeof parsed.usagePercent === 'number') {
                            rememberGrokQuota(parsed, 'intercepted');
                        }
                    }
                } catch (e) {}
                return res;
            };
        } catch (e) {}
    }

    // ── Инициализация ──
    function initGrokQuota() {
        if (rootDomain !== 'grok.com') return;
        initGrokQuotaFetchInterceptor();
        updateGrokQuotaPill();

        setTimeout(() => {
            grokFetchQuota(false, 3).catch(() => {});
        }, 1200);

        if (!_grokQuotaTickTimer) {
            _grokQuotaTickTimer = setInterval(() => {
                if (rootDomain === 'grok.com' && config.grokQuotaEnabled !== false) {
                    updateGrokQuotaPill();
                }
            }, 60000);
        }

        if (!_grokQuotaFetchTimer) {
            _grokQuotaFetchTimer = setInterval(() => {
                if (rootDomain === 'grok.com' && config.grokQuotaEnabled !== false && document.visibilityState !== 'hidden') {
                    grokFetchQuota(true, 1).catch(() => {});
                }
            }, 300000);
        }
    }

    if (rootDomain === 'grok.com') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initGrokQuota);
        } else {
            initGrokQuota();
        }
    }
