    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '1.2.45';
    console.log(`%c[MOSSAD v${SCRIPT_VERSION}] Скрипт загружен`, 'color:#10b981; font-weight:bold');

    const hostname = location.hostname.toLowerCase();
    
    function getRootDomain(host) {
        const parts = host.split('.');
        if (parts.length <= 2) return host;
        return parts.slice(-2).join('.');
    }
    const rootDomain = getRootDomain(hostname);
    const STORAGE_KEY = `mossad_${rootDomain.replace(/[^a-z0-9]/g, '_')}_config`;

    // Загрузка конфига из localStorage для проверки allowedDomains
    const _quickCfg = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } })();
    const _allowedDomains = _quickCfg.allowedDomains || ['grok.com','redgifs.com','pinterest.com','pinterest.ru','civitai.red','vkvideo.ru','vk.video','noodlemagazine.com','instagram.com'];
    const _isAllowed = _allowedDomains.some(d => hostname.includes(d.split('/')[0]));
    if (!_isAllowed) {
        // Показываем маленькую кнопку «+ Добавить сайт в MOSSAD»
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.createElement('button');
            btn.id = 'mossad-add-site';
            btn.textContent = '➕ MOSSAD';
            btn.title = 'Добавить этот сайт в MOSSAD';
            btn.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999999;background:rgba(20,20,20,0.85);color:#60a5fa;border:1px solid #374151;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;font-family:system-ui;backdrop-filter:blur(8px);';
            btn.onclick = () => {
                const cfg = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } })();
                const domains = cfg.allowedDomains || _allowedDomains;
                if (!domains.includes(hostname)) domains.push(hostname);
                cfg.allowedDomains = domains;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
                btn.textContent = '✅ Добавлено! Перезагрузи страницу';
                btn.style.color = '#10b981';
            };
            document.body.appendChild(btn);
        });
        return; // Выход — сайт не в списке
    }

