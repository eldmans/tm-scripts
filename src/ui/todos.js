    // ============================================
    // TODOS (v1.3.49): вкладка «📝 Тудушки» — задачи владельца для ассистента (текст + фото).
    // Хранение: GM (общее для всех сайтов и контейнеров). Список — один маленький ключ mossad_todos;
    // каждое фото — свой ключ mossad_todo_img_<id> (data URL), читается только при открытой вкладке.
    // Фото при добавлении уменьшаются (canvas, длинная сторона ≤ 1280 px, JPEG 0.8; маленький PNG — как есть).
    // В фоне ничего не работает: всё строится при открытии вкладки и живёт только в DOM окна настроек.
    // ============================================
    const TODOS_GM_KEY = 'mossad_todos';
    const TODO_IMG_PREFIX = 'mossad_todo_img_';
    const TODO_IMG_MAX_SIDE = 1280;
    const TODO_IMG_JPEG_Q = 0.8;
    const TODO_PNG_KEEP_BYTES = 150 * 1024;
    const TODO_WARN_BYTES = 20 * 1024 * 1024;

    function todoNewId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
    function todoReadList() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(TODOS_GM_KEY, null); } catch (e) {}
        try {
            const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!Array.isArray(arr)) return [];
            return arr.filter(t => t && typeof t === 'object' && t.id).map(t => ({
                id: String(t.id), text: typeof t.text === 'string' ? t.text : '', done: !!t.done, ts: Number(t.ts) || 0,
                imgs: Array.isArray(t.imgs) ? t.imgs.filter(i => i && i.id).map(i => ({ id: String(i.id), bytes: Number(i.bytes) || 0, w: Number(i.w) || 0, h: Number(i.h) || 0 })) : [],
                sent: (t.sent && Number(t.sent.n)) ? { n: Number(t.sent.n), url: String(t.sent.url || ''), ts: Number(t.sent.ts) || 0 } : null,
            }));
        } catch (e) { return []; }
    }
    function todoWriteList(list) {
        try { if (typeof GM_setValue === 'function') GM_setValue(TODOS_GM_KEY, JSON.stringify(list)); } catch (e) { return false; }
        return true;
    }
    function todoReadImg(imgId) {
        try { if (typeof GM_getValue === 'function') { const v = GM_getValue(TODO_IMG_PREFIX + imgId, ''); return typeof v === 'string' ? v : ''; } } catch (e) {}
        return '';
    }
    function todoWriteImg(imgId, dataUrl) {
        try { if (typeof GM_setValue === 'function') { GM_setValue(TODO_IMG_PREFIX + imgId, dataUrl); return true; } } catch (e) {}
        return false;
    }
    function todoDeleteImg(imgId) {
        try {
            if (typeof GM_deleteValue === 'function') GM_deleteValue(TODO_IMG_PREFIX + imgId);
            else if (typeof GM_setValue === 'function') GM_setValue(TODO_IMG_PREFIX + imgId, '');
        } catch (e) {}
    }
    /** Сумма байт фото (по метаданным списка — без чтения самих фото). */
    function todoTotalBytes(list) {
        return (list || todoReadList()).reduce((s, t) => s + t.imgs.reduce((a, i) => a + i.bytes, 0) + (t.text || '').length, 0);
    }
    function todoFmtMb(b) { return (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' МБ'; }

    function _todoReadAsDataUrl(blob) {
        return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    }
    function _todoDecode(blob) {
        if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
        return new Promise((res, rej) => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
            img.src = url;
        });
    }
    /**
     * Уменьшить картинку: длинная сторона ≤ 1280 px, JPEG 0.8. Маленький PNG (≤150 КБ и ≤1280 px) — как есть.
     * Возвращает {dataUrl, bytes, w, h}. Холст и bitmap освобождаются сразу.
     */
    async function mossadDownscaleImage(blob) {
        if (!blob || !/^image\//.test(blob.type || '')) throw new Error('not an image');
        const src = await _todoDecode(blob);
        const w0 = src.width || src.naturalWidth || 0, h0 = src.height || src.naturalHeight || 0;
        if (!w0 || !h0) { try { src.close && src.close(); } catch (e) {} throw new Error('empty image'); }
        const k = Math.min(1, TODO_IMG_MAX_SIDE / Math.max(w0, h0));
        const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
        let dataUrl;
        if (blob.type === 'image/png' && k === 1 && blob.size <= TODO_PNG_KEEP_BYTES) {
            dataUrl = await _todoReadAsDataUrl(blob);
        } else {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            if (!ctx) { try { src.close && src.close(); } catch (e) {} throw new Error('canvas unavailable'); }
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // прозрачность PNG → белый фон (JPEG)
            ctx.drawImage(src, 0, 0, w, h);
            dataUrl = c.toDataURL('image/jpeg', TODO_IMG_JPEG_Q);
            c.width = c.height = 0; // освободить память холста
        }
        try { src.close && src.close(); } catch (e) {}
        return { dataUrl, bytes: dataUrl.length, w, h };
    }

    /** Текст для чата: открытые задачи, пронумерованные. */
    function mossadTodosAsText(list) {
        const open = (list || todoReadList()).filter(t => !t.done && (t.text.trim() || t.imgs.length));
        if (!open.length) return '';
        return open.map((t, i) => {
            const body = t.text.trim().replace(/\n/g, '\n   ');
            const ph = t.imgs.length ? ` [фото: ${t.imgs.length}]` : '';
            return `${i + 1}. ${body || '(без текста)'}${ph}`;
        }).join('\n');
    }
    /** Один HTML-файл со всеми задачами и встроенными фото (без zip-библиотек). */
    function mossadTodosAsHtml(list) {
        const L0 = list || todoReadList();
        const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const items = L0.map((t, i) => {
            const imgs = t.imgs.map(im => { const u = todoReadImg(im.id); return u ? `<a href="${u}" target="_blank"><img src="${u}" style="max-width:100%;max-height:420px;margin:4px 6px 0 0;border:1px solid #ccc;"></a>` : ''; }).join('');
            return `<li style="margin:0 0 14px;${t.done ? 'color:#888;' : ''}"><div style="white-space:pre-wrap;">${t.done ? '✔ ' : ''}${esc(t.text || '(без текста)')}</div>${imgs ? `<div>${imgs}</div>` : ''}</li>`;
        }).join('\n');
        return `<!doctype html><html><head><meta charset="utf-8"><title>MOSSAD — тудушки ${new Date().toISOString().slice(0, 10)}</title></head>` +
               `<body style="font-family:system-ui,sans-serif;max-width:960px;margin:20px auto;padding:0 12px;">` +
               `<h2>MOSSAD — тудушки (${L0.filter(t => !t.done).length} открыто, ${L0.length} всего)</h2><ol>\n${items}\n</ol></body></html>`;
    }

    function _todoCopyText(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
        } catch (e) {}
        try {
            const ta = document.createElement('textarea');
            ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta); ta.select();
            const ok = document.execCommand && document.execCommand('copy');
            ta.remove();
            return Promise.resolve(!!ok);
        } catch (e) { return Promise.resolve(false); }
    }

    /** Просмотр фото на весь экран (клик или Esc — закрыть). */
    function mossadTodoOpenOverlay(dataUrl) {
        if (!dataUrl) return;
        const ov = document.createElement('div');
        ov.id = 'mossad-todo-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000000;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'max-width:96vw;max-height:96vh;box-shadow:0 10px 40px rgba(0,0,0,0.8);';
        ov.appendChild(img);
        const close = (e) => { if (e) { e.stopPropagation(); } document.removeEventListener('keydown', onKey, true); ov.remove(); };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
        ov.addEventListener('click', close);
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(ov);
        return ov;
    }

    // ── «📤 На GitHub»: одно issue в eldmans/tm-scripts + фото в ветке todo-assets ──
    const TODO_GH_OWNER = 'eldmans';
    const TODO_GH_REPO = 'tm-scripts';
    const TODO_GH_BRANCH = 'todo-assets';
    const TODO_GH_LABEL = 'mossad-todo';
    function todoGh(token, method, path, body) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest !== 'function') { resolve({ status: 0, json: null, headers: '' }); return; }
            GM_xmlhttpRequest({
                method,
                url: `https://api.github.com${path}`,
                headers: Object.assign({ 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
                data: body ? JSON.stringify(body) : undefined,
                onload: (res) => { let json = null; try { json = JSON.parse(res.responseText || 'null'); } catch (e) {} resolve({ status: res.status, json, headers: res.responseHeaders || '' }); },
                onerror: () => resolve({ status: 0, json: null, headers: '' }),
                ontimeout: () => resolve({ status: 0, json: null, headers: '' }),
            });
        });
    }
    /** Понятное объяснение ошибки GitHub (403/404/401) для тоста. */
    function todoGhError(step, r) {
        const need = (/x-accepted-github-permissions:\s*([^\r\n]+)/i.exec(r.headers || '') || [])[1];
        const msg = (r.json && r.json.message) ? r.json.message : '';
        if (r.status === 0) return `${step}: нет связи с api.github.com`;
        if (r.status === 401) return `${step}: токен недействителен (401) — обновите его в «⚙ Общие»`;
        if (r.status === 403) return `${step}: нет прав (403)${need ? ' — нужно: ' + need : ''}. Fine-grained токен: Contents и Issues — Read and write для ${TODO_GH_OWNER}/${TODO_GH_REPO}${/rate limit/i.test(msg) ? ' (или превышен лимит запросов)' : ''}`;
        if (r.status === 404) return `${step}: не найдено (404) — токену не открыт репозиторий ${TODO_GH_OWNER}/${TODO_GH_REPO} (fine-grained: добавьте его в Repository access)`;
        if (r.status === 422) return `${step}: отклонено (422) ${msg}`;
        return `${step}: HTTP ${r.status} ${msg}`;
    }
    function _todoB64ofDataUrl(u) { const i = String(u).indexOf(','); return i >= 0 ? String(u).slice(i + 1) : ''; }
    function _todoExtOfDataUrl(u) { const m = /^data:image\/(png|jpeg|jpg|gif|webp)/i.exec(String(u)); return m ? (m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : 'jpg'; }
    /**
     * Отправить открытые задачи. Шаги:
     *  1) фото (если есть): ветка todo-assets (GET ref → при 404 создать от ветки по умолчанию),
     *     PUT contents todo/<дата>/<id>-<n>.<ext> в эту ветку;
     *  2) метка mossad-todo (POST labels; 422 «уже есть» — нормально; нет прав — без метки);
     *  3) POST issues «2DO <дата>», тело — нумерованный список со ссылками raw.githubusercontent на фото;
     *  4) задачи помечаются sent {n, url} (остаются в списке).
     * Возвращает {ok, issue?, error?}.
     */
    async function mossadSendTodosToGitHub(onProgress) {
        const token = (config && config.githubToken) || (typeof GM_getValue === 'function' ? GM_getValue('mossad_github_token', '') : '');
        if (!token) return { ok: false, error: 'Нет GitHub-токена — укажите его во вкладке «⚙ Общие»' };
        const list = todoReadList();
        const open = list.filter(t => !t.done && !t.sent && (t.text.trim() || t.imgs.length));
        if (!open.length) return { ok: false, error: 'Нет открытых неотправленных задач' };
        const repo = `/repos/${TODO_GH_OWNER}/${TODO_GH_REPO}`;
        const date = new Date().toISOString().slice(0, 10);
        const say = (m) => { try { onProgress && onProgress(m); } catch (e) {} };

        // 1) Фото
        const imgLinks = {}; // todoId → [url]
        const withImgs = open.filter(t => t.imgs.length);
        if (withImgs.length) {
            say('ветка для фото…');
            let ref = await todoGh(token, 'GET', `${repo}/git/ref/heads/${TODO_GH_BRANCH}`);
            if (ref.status === 404) {
                const info = await todoGh(token, 'GET', repo);
                if (info.status !== 200) return { ok: false, error: todoGhError('Репозиторий', info) };
                const def = (info.json && info.json.default_branch) || 'main';
                const base = await todoGh(token, 'GET', `${repo}/git/ref/heads/${def}`);
                if (base.status !== 200) return { ok: false, error: todoGhError('Ветка по умолчанию', base) };
                ref = await todoGh(token, 'POST', `${repo}/git/refs`, { ref: `refs/heads/${TODO_GH_BRANCH}`, sha: base.json.object.sha });
                if (ref.status !== 201) return { ok: false, error: todoGhError(`Создание ветки ${TODO_GH_BRANCH}`, ref) };
            } else if (ref.status !== 200) {
                return { ok: false, error: todoGhError(`Ветка ${TODO_GH_BRANCH}`, ref) };
            }
            let done = 0;
            const total = withImgs.reduce((a, t) => a + t.imgs.length, 0);
            for (const t of withImgs) {
                imgLinks[t.id] = [];
                for (let n = 0; n < t.imgs.length; n++) {
                    const u = todoReadImg(t.imgs[n].id);
                    if (!u) continue;
                    const path = `todo/${date}/${t.id}-${n + 1}.${_todoExtOfDataUrl(u)}`;
                    say(`фото ${++done}/${total}…`);
                    const put = await todoGh(token, 'PUT', `${repo}/contents/${path}`, { message: `todo: ${path}`, content: _todoB64ofDataUrl(u), branch: TODO_GH_BRANCH });
                    if (put.status !== 201 && put.status !== 200) {
                        // 422 «sha wasn't supplied» — файл уже есть (повторная отправка): ссылка та же
                        if (put.status !== 422) return { ok: false, error: todoGhError('Загрузка фото', put) };
                    }
                    imgLinks[t.id].push(`https://raw.githubusercontent.com/${TODO_GH_OWNER}/${TODO_GH_REPO}/${TODO_GH_BRANCH}/${path}`);
                }
            }
        }

        // 2) Метка (необязательно)
        say('метка…');
        const lab = await todoGh(token, 'POST', `${repo}/labels`, { name: TODO_GH_LABEL, color: 'f59e0b', description: 'Задачи из MOSSAD (вкладка «Тудушки»)' });
        const labelOk = lab.status === 201 || lab.status === 422;

        // 3) Issue
        const body = open.map((t, i) => {
            const text = (t.text.trim() || '(без текста)').replace(/\n/g, '\n   ');
            const pics = (imgLinks[t.id] || []).map((u, k) => `   ![${i + 1}.${k + 1}](${u})`).join('\n');
            return `${i + 1}. ${text}${pics ? '\n' + pics : ''}`;
        }).join('\n') + `\n\n— отправлено из MOSSAD v${SCRIPT_VERSION}`;
        say('issue…');
        let iss = await todoGh(token, 'POST', `${repo}/issues`, Object.assign({ title: `2DO ${date}`, body }, labelOk ? { labels: [TODO_GH_LABEL] } : {}));
        if ((iss.status === 403 || iss.status === 422) && labelOk) {
            iss = await todoGh(token, 'POST', `${repo}/issues`, { title: `2DO ${date}`, body }); // без метки
        }
        if (iss.status !== 201 || !iss.json || !iss.json.number) return { ok: false, error: todoGhError('Создание issue', iss) };

        // 4) Отметить отправленные
        const sent = { n: iss.json.number, url: iss.json.html_url || '', ts: Date.now() };
        const ids = new Set(open.map(t => t.id));
        const fresh = todoReadList();
        fresh.forEach(t => { if (ids.has(t.id)) t.sent = sent; });
        todoWriteList(fresh);
        return { ok: true, issue: sent, count: open.length };
    }

    /** Вкладка «📝 Тудушки» — строится лениво при первом открытии вкладки. */
    function initTodosTab(modal) {
        const pane = modal.querySelector('[data-pane="todos"]');
        if (!pane) return;
        // v1.3.73: повторное открытие — перерисовка ПРЕЖНЕЙ сборкой. Раньше здесь вызывалась renderTodos() нового вызова,
        // чьи const (listEl…) ещё не инициализированы → ReferenceError → вкладка «Тудушки» переставала щёлкаться.
        if (pane.dataset.built) {
            if (typeof modal._mossadTodosFlush === 'function') modal._mossadTodosFlush();
            if (typeof modal._mossadRenderTodos === 'function') modal._mossadRenderTodos();
            return;
        }
        pane.dataset.built = '1';
        const btnCss = 'background:#374151;border:1px solid #4b5563;padding:5px 9px;border-radius:6px;color:#e5e7eb;cursor:pointer;font-weight:bold;font-size:11px;';
        const inputCss = 'background:#111827;border:1px solid #374151;border-radius:6px;color:#e5e7eb;padding:5px 8px;font-size:12px;font-family:inherit;';
        pane.innerHTML = `
            <div id="mossad-todo-new" class="mossad-todo-drop" style="display:flex;flex-direction:column;gap:4px;background:#1f2937;border:1px dashed #374151;border-radius:6px;padding:6px;">
              <textarea id="mossad-todo-new-text" rows="2" placeholder="Новая задача… (Ctrl+V — вставить фото, можно перетащить файл)" style="${inputCss}resize:vertical;"></textarea>
              <div style="display:flex;gap:6px;align-items:center;">
                <div class="mossad-todo-thumbs" style="display:flex;gap:4px;flex-wrap:wrap;flex:1;"></div>
                <button class="mossad-todo-attach" title="Прикрепить фото" style="${btnCss}" data-mossad-label="todoAttach">${LH('todoAttach')}</button>
                <button id="mossad-todo-add" style="${btnCss}background:#065f46;border-color:#10b981;" data-mossad-label="todoAdd">${LH('todoAdd')}</button>
              </div>
            </div>
            <div id="mossad-todo-list" style="display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:calc(85vh - 330px);padding-right:4px;position:relative;"></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <button id="mossad-todo-copy" style="${btnCss}" title="Открытые задачи — нумерованным текстом в буфер обмена" data-mossad-label="todoCopy">${LH('todoCopy')}</button>
              <button id="mossad-todo-gh" style="${btnCss}background:#1e3a8a;border-color:#3b82f6;" title="Открытые неотправленные задачи → одно issue в ${TODO_GH_OWNER}/${TODO_GH_REPO} (фото — в ветку ${TODO_GH_BRANCH}). Нужен GitHub-токен (вкладка «⚙ Общие»)" data-mossad-label="todoGitHub">${LH('todoGitHub')}</button>
              <button id="mossad-todo-export" style="${btnCss}" title="Один HTML-файл: все задачи и фото внутри" data-mossad-label="todoExport">${LH('todoExport')}</button>
              <button id="mossad-todo-clear-done" style="${btnCss}color:#f87171;" data-mossad-label="todoClearDone">${LH('todoClearDone')}</button>
              <span id="mossad-todo-size" style="font-size:11px;color:#9ca3af;margin-left:auto;"></span>
            </div>
            <input id="mossad-todo-file" type="file" accept="image/*" multiple style="display:none;">`;
        const listEl = pane.querySelector('#mossad-todo-list');
        const newBox = pane.querySelector('#mossad-todo-new');
        const newText = pane.querySelector('#mossad-todo-new-text');
        const fileIn = pane.querySelector('#mossad-todo-file');
        const sizeEl = pane.querySelector('#mossad-todo-size');
        let pendingImgs = []; // фото новой задачи (ещё не добавленной): [{id, bytes, w, h, dataUrl}]
        let attachTarget = null; // id задачи для 📎 или null (новая)

        const updateSize = (list) => {
            const b = todoTotalBytes(list) + pendingImgs.reduce((a, i) => a + i.bytes, 0);
            sizeEl.textContent = `Хранилище: ${todoFmtMb(b)}` + (b > TODO_WARN_BYTES ? ' ⚠️ больше 20 МБ — удалите лишние фото' : '');
            sizeEl.style.color = b > TODO_WARN_BYTES ? '#fbbf24' : '#9ca3af';
            return b;
        };
        const mkThumb = (imgId, dataUrl, removable) => {
            const wrap = document.createElement('span');
            wrap.className = 'mossad-todo-thumb';
            wrap.dataset.img = imgId;
            wrap.style.cssText = 'position:relative;display:inline-block;width:64px;height:64px;border-radius:4px;overflow:hidden;border:1px solid #374151;background:#111827;cursor:zoom-in;flex:none;';
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = dataUrl;
            img.style.cssText = 'width:64px;height:64px;object-fit:cover;display:block;';
            wrap.appendChild(img);
            if (removable) {
                const x = document.createElement('button');
                x.className = 'mossad-todo-img-del';
                x.title = 'Убрать фото';
                x.textContent = '×';
                x.style.cssText = 'position:absolute;top:0;right:0;background:rgba(0,0,0,0.65);border:none;color:#f87171;font-size:12px;line-height:1;padding:1px 4px;cursor:pointer;';
                wrap.appendChild(x);
            }
            return wrap;
        };
        const renderPending = () => {
            const box = newBox.querySelector('.mossad-todo-thumbs');
            box.innerHTML = '';
            pendingImgs.forEach(p => box.appendChild(mkThumb(p.id, p.dataUrl, true)));
        };
        const renderRow = (t) => {
            const row = document.createElement('div');
            row.className = 'mossad-todo-item mossad-todo-drop';
            row.dataset.todo = t.id;
            row.style.cssText = `display:flex;gap:6px;align-items:flex-start;background:#1f2937;border:1px solid #374151;border-radius:6px;padding:6px;box-sizing:border-box;${t.done ? 'opacity:0.55;' : ''}`;
            row.innerHTML = `
                <span class="mossad-todo-handle" title="Перетащите, чтобы изменить порядок" style="cursor:grab;user-select:none;touch-action:none;color:#6b7280;padding:2px 2px 0;font-size:13px;line-height:1;">⋮⋮</span>
                <input type="checkbox" class="mossad-todo-done" ${t.done ? 'checked' : ''} title="Выполнено" style="margin-top:4px;cursor:pointer;accent-color:#10b981;">
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
                  <textarea class="mossad-todo-text" rows="${Math.min(6, Math.max(1, (t.text.match(/\n/g) || []).length + 1))}" style="${inputCss}resize:vertical;${t.done ? 'text-decoration:line-through;' : ''}"></textarea>
                  <div class="mossad-todo-thumbs" style="display:flex;gap:4px;flex-wrap:wrap;"></div>
                  ${t.sent ? `<a class="mossad-todo-sent" href="${String(t.sent.url).replace(/"/g, '&quot;')}" target="_blank" rel="noopener" title="Отправлено на GitHub ${new Date(t.sent.ts).toLocaleString()}" style="align-self:flex-start;font-size:10px;color:#93c5fd;background:#1e3a8a;border-radius:4px;padding:1px 6px;text-decoration:none;">📤 #${t.sent.n}</a>` : ''}
                </div>
                <button class="mossad-todo-attach" title="Прикрепить фото" style="background:transparent;border:none;cursor:pointer;font-size:13px;padding:2px;" data-mossad-label="todoAttach">${LH('todoAttach')}</button>
                <button class="mossad-todo-del" title="Удалить задачу" style="background:transparent;border:none;cursor:pointer;font-size:13px;padding:2px;color:#f87171;" data-mossad-label="todoDelete">${LH('todoDelete')}</button>`;
            row.querySelector('.mossad-todo-text').value = t.text;
            const thumbs = row.querySelector('.mossad-todo-thumbs');
            t.imgs.forEach(im => { const u = todoReadImg(im.id); if (u) thumbs.appendChild(mkThumb(im.id, u, true)); });
            return row;
        };
        function renderTodos() {
            const list = todoReadList();
            listEl.innerHTML = '';
            if (!list.length) listEl.innerHTML = '<div style="font-size:12px;color:#6b7280;padding:6px;">Задач пока нет.</div>';
            list.forEach(t => listEl.appendChild(renderRow(t)));
            updateSize(list);
        }
        modal._mossadRenderTodos = renderTodos;
        const mutate = (fn) => { const list = todoReadList(); const r = fn(list); todoWriteList(list); updateSize(list); return r; };

        // ── Добавление фото: файл / вставка / перетаскивание ──
        const addImages = async (files, todoId) => {
            const imgs = Array.from(files || []).filter(f => f && /^image\//.test(f.type || ''));
            if (!imgs.length) return 0;
            let n = 0;
            for (const f of imgs) {
                let r;
                try { r = await mossadDownscaleImage(f); } catch (e) { showToast('⚠️ Не удалось обработать фото', true); continue; }
                const id = todoNewId();
                if (todoId) {
                    if (!todoWriteImg(id, r.dataUrl)) { showToast('❌ GM-хранилище недоступно', true); return n; }
                    mutate(list => { const t = list.find(x => x.id === todoId); if (t) t.imgs.push({ id, bytes: r.bytes, w: r.w, h: r.h }); });
                    const row = listEl.querySelector(`[data-todo="${todoId}"] .mossad-todo-thumbs`);
                    if (row) row.appendChild(mkThumb(id, r.dataUrl, true));
                } else {
                    pendingImgs.push({ id, bytes: r.bytes, w: r.w, h: r.h, dataUrl: r.dataUrl });
                    renderPending();
                }
                n++;
            }
            const total = updateSize();
            if (total > TODO_WARN_BYTES) showToast(`⚠️ Тудушки занимают ${todoFmtMb(total)} (больше 20 МБ)`, true);
            return n;
        };
        modal._mossadTodoAddImages = addImages; // для тестов
        const targetOf = (el) => {
            const row = el && el.closest ? el.closest('[data-todo]') : null;
            return row ? row.dataset.todo : null;
        };
        pane.addEventListener('paste', (e) => {
            const files = Array.from((e.clipboardData && e.clipboardData.files) || []);
            if (!files.some(f => /^image\//.test(f.type || ''))) return; // обычный текст вставляется как обычно
            e.preventDefault();
            addImages(files, targetOf(e.target));
        });
        pane.addEventListener('dragover', (e) => {
            if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
            e.preventDefault();
        });
        pane.addEventListener('drop', (e) => {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (!files || !files.length) return;
            e.preventDefault();
            addImages(files, targetOf(e.target));
        });
        fileIn.addEventListener('change', () => { const files = Array.from(fileIn.files || []); fileIn.value = ''; addImages(files, attachTarget); });

        // ── Делегированные клики ──
        pane.addEventListener('click', (e) => {
            const t = e.target;
            if (!t || !t.closest) return;
            const delImg = t.closest('.mossad-todo-img-del');
            if (delImg) {
                e.stopPropagation();
                const wrap = delImg.closest('.mossad-todo-thumb');
                const imgId = wrap.dataset.img;
                const todoId = targetOf(wrap);
                if (todoId) {
                    mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.imgs = it.imgs.filter(i => i.id !== imgId); });
                    todoDeleteImg(imgId);
                } else {
                    pendingImgs = pendingImgs.filter(p => p.id !== imgId);
                }
                wrap.remove();
                updateSize();
                return;
            }
            const thumb = t.closest('.mossad-todo-thumb');
            if (thumb) { const img = thumb.querySelector('img'); mossadTodoOpenOverlay(img && img.src); return; }
            if (t.closest('.mossad-todo-attach')) { attachTarget = targetOf(t); fileIn.click(); return; }
            if (t.closest('.mossad-todo-del')) {
                const todoId = targetOf(t);
                const it = todoReadList().find(x => x.id === todoId);
                if (it && (it.text.trim() || it.imgs.length) && !confirm('Удалить задачу?')) return;
                mutate(list => { const i = list.findIndex(x => x.id === todoId); if (i >= 0) { list[i].imgs.forEach(im => todoDeleteImg(im.id)); list.splice(i, 1); } });
                renderTodos();
                return;
            }
            if (t.id === 'mossad-todo-add') {
                const text = newText.value.trim();
                if (!text && !pendingImgs.length) { newText.focus(); return; }
                const imgs = [];
                for (const p of pendingImgs) { if (todoWriteImg(p.id, p.dataUrl)) imgs.push({ id: p.id, bytes: p.bytes, w: p.w, h: p.h }); }
                mutate(list => { list.push({ id: todoNewId(), text, done: false, ts: Date.now(), imgs }); });
                pendingImgs = []; newText.value = ''; renderPending();
                renderTodos();
                return;
            }
            if (t.id === 'mossad-todo-copy') {
                const text = mossadTodosAsText();
                if (!text) { showToast('Открытых задач нет'); return; }
                _todoCopyText(text).then(ok => showToast(ok ? `📋 Скопировано: ${text.split(/\n(?=\d+\. )/).length} задач` : '⚠️ Не удалось скопировать', !ok));
                modal._mossadTodoLastCopy = text;
                return;
            }
            if (t.id === 'mossad-todo-gh') {
                if (t.disabled) return;
                if (modal._mossadTodosFlush) modal._mossadTodosFlush();
                t.disabled = true;
                const lbl = t.textContent;
                const p = mossadSendTodosToGitHub((m) => { t.textContent = `📤 ${m}`; }).then(r => {
                    t.disabled = false; t.textContent = lbl;
                    if (r.ok) { showToast(`📤 Отправлено: ${r.count} задач → issue #${r.issue.n}`); renderTodos(); }
                    else showToast(`❌ ${r.error}`, true);
                    return r;
                });
                modal._mossadTodoLastSend = p;
                return;
            }
            if (t.id === 'mossad-todo-export') {
                const html = mossadTodosAsHtml();
                try {
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `mossad-todos-${new Date().toISOString().slice(0, 10)}.html`;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                    showToast(`💾 Экспорт: ${todoFmtMb(html.length)}`);
                } catch (err) { showToast('❌ Экспорт не удался', true); }
                modal._mossadTodoLastExport = html;
                return;
            }
            if (t.id === 'mossad-todo-clear-done') {
                const n = todoReadList().filter(x => x.done).length;
                if (!n) { showToast('Выполненных нет'); return; }
                if (!confirm(`Удалить выполненные (${n})?`)) return;
                mutate(list => {
                    for (let i = list.length - 1; i >= 0; i--) if (list[i].done) { list[i].imgs.forEach(im => todoDeleteImg(im.id)); list.splice(i, 1); }
                });
                renderTodos();
            }
        });
        pane.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || !t.classList) return;
            const todoId = targetOf(t);
            if (!todoId) return;
            if (t.classList.contains('mossad-todo-done')) {
                mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.done = !!t.checked; });
                const row = t.closest('[data-todo]');
                row.style.opacity = t.checked ? '0.55' : '';
                const ta = row.querySelector('.mossad-todo-text');
                if (ta) ta.style.textDecoration = t.checked ? 'line-through' : '';
            } else if (t.classList.contains('mossad-todo-text')) {
                mutate(list => { const it = list.find(x => x.id === todoId); if (it) it.text = t.value; });
            }
        });
        // Текст сохраняется и при закрытии окна (change мог не прийти)
        modal._mossadTodosFlush = () => {
            const list = todoReadList();
            let dirty = false;
            listEl.querySelectorAll('[data-todo]').forEach(row => {
                const it = list.find(x => x.id === row.dataset.todo);
                const ta = row.querySelector('.mossad-todo-text');
                if (it && ta && ta.value !== it.text) { it.text = ta.value; dirty = true; }
            });
            if (dirty) todoWriteList(list);
        };

        // ── Перетаскивание задач (pointer events, как строки хоткеев) ──
        mossadMakeSortable(listEl, {
            rowSel: '[data-todo]', handleSel: '.mossad-todo-handle',
            onDrop: (ids) => mutate(list => { const by = {}; list.forEach(x => { by[x.id] = x; }); const out = ids.map(id => by[id]).filter(Boolean); list.forEach(x => { if (!out.includes(x)) out.push(x); }); list.splice(0, list.length, ...out); }),
        });
        renderTodos();
    }

    /**
     * Лёгкая сортировка перетаскиванием: тянем за handleSel, строка поднимается (absolute внутри
     * list с position:relative), пунктирный заполнитель. Слушатели документа — только на время тяги.
     */
    function mossadMakeSortable(list, { rowSel, handleSel, onDrop }) {
        let d = null;
        const rows = () => Array.from(list.children).filter(el => el.matches && el.matches(rowSel));
        const move = (e) => {
            if (!d) return;
            const dy = e.clientY - d.startY;
            if (!d.active) {
                if (Math.abs(dy) < 4) return;
                d.active = true;
                d.ph = document.createElement('div');
                d.ph.className = 'mossad-sort-placeholder';
                d.ph.style.cssText = `height:${d.row.offsetHeight || 40}px;border:1px dashed #3b82f6;border-radius:6px;background:rgba(59,130,246,0.08);flex:none;`;
                d.top0 = d.row.offsetTop;
                list.insertBefore(d.ph, d.row);
                Object.assign(d.row.style, { position: 'absolute', left: '0', right: '4px', zIndex: '2', opacity: '0.92', pointerEvents: 'none' });
                d.handle.style.cursor = 'grabbing';
                d.prevCursor = document.body.style.cursor;
                document.body.style.cursor = 'grabbing';
            }
            e.preventDefault();
            d.row.style.top = `${d.top0 + dy}px`;
            let before = null;
            for (const r of rows()) {
                if (r === d.row) continue;
                const rc = r.getBoundingClientRect();
                if (e.clientY < rc.top + rc.height / 2) { before = r; break; }
            }
            if (before) { if (d.ph.nextSibling !== before) list.insertBefore(d.ph, before); }
            else if (list.lastChild !== d.ph) list.appendChild(d.ph);
        };
        const end = () => {
            if (!d) return;
            const x = d; d = null;
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('pointerup', end, true);
            document.removeEventListener('pointercancel', end, true);
            x.handle.style.cursor = 'grab';
            if (!x.active) return;
            ['position', 'left', 'right', 'top', 'zIndex', 'opacity', 'pointerEvents'].forEach(p => { x.row.style[p] = ''; });
            if (x.ph.parentNode === list) { list.insertBefore(x.row, x.ph); x.ph.remove(); }
            document.body.style.cursor = x.prevCursor || '';
            const ids = rows().map(r => r.dataset.todo || r.dataset.hk || r.dataset.id);
            if (ids.join('|') !== x.before && typeof onDrop === 'function') onDrop(ids);
        };
        list.addEventListener('pointerdown', (e) => {
            const h = e.target && e.target.closest ? e.target.closest(handleSel) : null;
            if (!h || !list.contains(h) || d) return;
            if (e.button != null && e.button !== 0) return;
            e.preventDefault();
            const row = h.closest(rowSel);
            d = { row, handle: h, startY: e.clientY, active: false, ph: null, before: rows().map(r => r.dataset.todo || r.dataset.hk || r.dataset.id).join('|') };
            document.addEventListener('pointermove', move, true);
            document.addEventListener('pointerup', end, true);
            document.addEventListener('pointercancel', end, true);
        });
        return { cancel: end };
    }
