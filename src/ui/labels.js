    // ============================================
    // LABELS (v1.3.46): подписи кнопок и надписей MOSSAD — одна карта + помощник L('key').
    // Свои подписи пользователь задаёт на вкладке «✏ Подписи» (Ctrl+F1). Хранятся в GM
    // (общие для всех сайтов и контейнеров), только изменённые ключи. Пустое значение = по умолчанию.
    // ============================================
    const LABELS_GM_KEY = 'mossad_labels';

    // [ключ, подпись по умолчанию, комментарий]; строки-заголовки — ['#', 'Раздел']
    const LABEL_DEFS = [
        ['#', 'Верхняя полоса виджета'],
        ['start',          '🚀',            'кнопка запуска слайд-шоу (Insert)'],
        ['download',       '💾',            'кнопка «Скачать»'],
        ['update',         '🔄',            'кнопка «Обновить скрипт»'],
        ['togglePanel',    '▼',             'кнопка «Меню настроек» (развернуть/свернуть)'],
        ['hideWidget',     '✕',             'кнопка «Скрыть виджет»'],
        ['#', 'Полоса Grok (верхний ряд)'],
        ['collect',        'Собрать',       'кнопка сбора ссылок на странице Saved (потом там число)'],
        ['slideshow',      'Слайдшоу',      'кнопка запуска большого слайд-шоу'],
        ['pause',          '❚❚',            'кнопка «Пауза» (во время слайд-шоу)'],
        ['resume',         '▶',             'кнопка «Продолжить» (на паузе)'],
        ['stop',           '■',             'кнопка «Остановить слайд-шоу»'],
        ['grPrefix',       'Gr',            'кнопка порядка групп (к ней добавляется ↓ ↑ ↺ −)'],
        ['mdPrefix',       'Md',            'кнопка порядка файлов (к ней добавляется ↓ ↑ ↺ −)'],
        ['random',         '🔀',            'кнопка «Случайно»'],
        ['settingsHk',     '⌨',             'кнопка окна настроек (горячие клавиши)'],
        ['#', 'Меню настроек виджета'],
        ['dpadUp',         '▲',             'D-pad: листать вверх'],
        ['dpadLeft',       '◀',             'D-pad: листать влево'],
        ['dpadRight',      '▶',             'D-pad: листать вправо'],
        ['dpadDown',       '▼',             'D-pad: листать вниз'],
        ['dpadLoop',       'R',             'D-pad: повторять ленту'],
        ['loopsLabel',     'Видео (↺):',    'надпись у поля «кругов видео»'],
        ['photoLabel',     'Фото (сек):',   'надпись у поля «показ фото»'],
        ['pauseLabel',     'Пауза (сек):',  'надпись у поля «пауза после видео»'],
        ['exportList',     '💾 Список',     'кнопка «Скачать список ссылок (.txt)»'],
        ['zoomDec',        '−',             'кнопка «Уменьшить масштаб»'],
        ['zoomInc',        '+',             'кнопка «Увеличить масштаб»'],
        ['tplLabel',       'Шаблон:',       'надпись у шаблона имени файла'],
        ['saveTplGlobal',  '💾',            'кнопка «Сохранить шаблон для всех вкладок»'],
        ['settings',       '⚙ Настройки',   'кнопка открытия окна настроек'],
        ['importDb',       '📥 База',       'кнопка «Импорт базы хешей»'],
        ['resetCfg',       '↺ Сброс',       'кнопка «Сбросить все настройки»'],
        ['#', 'Список (плейлист)'],
        ['playlistTitle',  '📋 Список',     'заголовок списка (к нему добавляется число)'],
        ['fontDec',        'A−',            'кнопка «Шрифт меньше»'],
        ['fontInc',        'A+',            'кнопка «Шрифт больше»'],
        ['clearLoops',     'R ✕',           'кнопка «Отключить все зацикленные»'],
        ['resetSize',      '⤢',             'кнопка «Сбросить размер списка»'],
        ['closeList',      '×',             'кнопка «Закрыть список»'],
        ['loopItem',       'R',             'кнопка «Зациклить» у строки'],
        ['groupCount',     'ген.',          'подпись числа генераций в группе'],
        ['#', 'Окно настроек'],
        ['settingsTitle',  '⚙ Настройки MOSSAD', 'заголовок окна'],
        ['tabGeneral',     '⚙ Общие',       'вкладка «Общие»'],
        ['tabHotkeys',     '⌨ Горячие клавиши', 'вкладка «Горячие клавиши»'],
        ['tabDefaults',    '🌐 По умолчанию', 'вкладка общих умолчаний'],
        ['tabLabels',      '✏ Подписи',     'вкладка подписей (эта)'],
        ['close',          'Закрыть',       'кнопка закрытия окна'],
        ['hkDefaultsLabel', 'По умолчанию:', 'надпись перед кнопками сброса на вкладке клавиш'],
        ['hkResetKeys',    'Клавиши',       'кнопка «Сбросить клавиши к умолчаниям» (🔒 не меняются)'],
        ['hkResetOrder',   'Порядок',       'кнопка «Сбросить порядок строк» (🔒 остаются на месте)'],
        ['hkSaveDefaults', 'Сохранить это', 'кнопка «Сохранить клавиши, порядок и 🔒 как общие умолчания»'],
        ['hkTop',          '⤒',             'кнопка строки клавиши: в самый верх'],
        ['hkBottom',       '⤓',             'кнопка строки клавиши: в самый низ'],
        ['hkPin',          '🔒',            'кнопка строки клавиши: закрепить'],
        ['hkUnpin',        '🔓',            'кнопка закреплённой строки: открепить'],
        ['debugCopy',      '📋 лог',        'кнопка копирования debug-лога'],
        ['updateLink',     '🔄 Обновить',   'ссылка «Обновить скрипт»'],
        ['#', 'Тудушки (задачи для ассистента)'],
        ['todoBtn',        '2DO',           'кнопка на верхней полосе: открыть тудушки'],
        ['tabTodos',       '📝 Тудушки',    'вкладка тудушек в окне настроек'],
        ['todoAdd',        '➕ Добавить',   'кнопка «Добавить задачу»'],
        ['todoAttach',     '📎',            'кнопка «Прикрепить фото»'],
        ['todoDelete',     '🗑',            'кнопка «Удалить задачу»'],
        ['todoCopy',       '📋 Копировать для ассистента', 'кнопка копирования открытых задач текстом'],
        ['todoGitHub',     '📤 На GitHub',  'кнопка отправки задач в issue на GitHub'],
        ['todoExport',     '💾 Экспорт',    'кнопка экспорта в HTML-файл с фото'],
        ['todoClearDone',  'Удалить выполненные', 'кнопка удаления выполненных задач'],
        ['#', 'Сайты (v1.3.50)'],
        ['tabSites',       '🌍 Сайты',      'вкладка списка сайтов в окне настроек'],
        ['sitesAdd',       'Добавить',      'кнопка «Добавить сайт из поля»'],
        ['sitesAddCurrent', '➕ Этот сайт', 'кнопка «Добавить текущий сайт»'],
        ['sitesRemove',    '✕',             'кнопка «Убрать сайт» у строки'],
        ['sitesBuiltin',   'Встроенные',    'заголовок списка встроенных сайтов'],
        ['sitesUser',      'Свои',          'заголовок списка своих сайтов'],
        ['#', 'Pinterest (v1.3.51)'],
        ['pinModeLabel',   'Пин:',          'надпись у выбора следующего пина'],
        ['pinRand',        'rand',          'режим «случайный похожий пин»'],
        ['pinPlus1',       '+1',            'режим «по очереди: 1-й, 2-й, 3-й…»'],
        ['pinNum',         '№',             'режим «всегда N-й похожий пин» (рядом поле с числом)'],
        ['pinDirBack',     '◀',             'направление слайдшоу: назад по истории'],
        ['pinAutoFS',      '⛶ FS',          'авто «Показать в полном масштабе» (галочка в блоке Pinterest)'],
        ['pinJumpLabel',   'Клавиши:',      'переход к похожему пину по клавише'],
        ['pinJumpOff',     'Выкл',          'режим клавиш: выключено'],
        ['pinJumpFocus',   'Фокус',         'режим клавиш: фокус на N-й похожий пин (открыть — Пробел/Enter)'],
        ['pinJumpKeys',    'Переход',       'режим клавиш: сразу открыть N-й похожий, без номеров'],
        ['pinJumpBadges',  'Переход + номера', 'режим клавиш: переход, номера на пинах всегда'],
        ['pinJumpShift',   'Переход, номера по Shift', 'режим клавиш: переход, номера пока зажат Shift или включён CapsLock'],
        ['pinJumpSkipped', 'Заняты хоткеями MOSSAD (пропущены):', 'список пропущенных клавиш в настройках'],
        ['pinJumpNoSkipped', 'Все клавиши свободны', 'нет пропущенных клавиш'],
        ['pinDirFwd',      '▶',             'направление слайдшоу: вперёд по новым пинам'],
        ['#', 'Горячие клавиши: занятые сочетания (v1.3.60)'],
        ['hkConflict',     'Эта клавиша уже занята:', 'начало предупреждения о занятом сочетании'],
        ['hkConflictAsk',  'Переназначить?', 'вопрос в предупреждении'],
        ['hkYes',          'Да',            'кнопка: переназначить (у другого действия клавиша очищается)'],
        ['hkCancel',       'Отмена',        'кнопка: оставить как было'],
        ['hkCleared',      'очищено:',      'тост после переназначения'],
        ['hkDupHint',      'Дубликат — та же клавиша у:', 'подсказка на красной (дублирующейся) клавише'],
        ['hkResetCleared', 'Сброс: клавиша уже занята — очищено:', 'тост, если сброс очистил клавишу из-за дубликата'],
        ['hkSecSite',      'Только для этого сайта', 'вкладка клавиш: заголовок секции клавиш этого сайта (v1.3.63)'],
        ['hkSecSiteEmpty', 'Перетащите сюда строку (или ⤒ с верха общих) — клавиша будет своя для этого сайта', 'вкладка клавиш: подсказка в пустой секции сайта'],
        ['hkSecGlobal',    'Общие для всех сайтов', 'вкладка клавиш: заголовок общей секции (разделитель)'],
        ['hkPinJumpNote',  'На Pinterest эта клавиша будет пропущена в «Клавиши» похожих пинов', 'заметка: клавиша совпадает с клавишами похожих пинов'],
        ['#', 'После скачивания (v1.3.56)'],
        ['pdLabel',        'После скачивания:', 'надпись у выбора действия после скачивания'],
        ['pdNone',         '—',             'ничего не делать'],
        ['pdUpNoSs',       'Не СШ +1',      'следующий, только когда слайдшоу не запущено'],
        ['pdUpAlways',     '+1 всегда',     'следующий всегда (кроме скачивания самим слайдшоу)'],
        ['pdDel',          'Delete',        'удалить пост (только Grok)'],
        ['#', 'Шаблон имени файла (v1.3.53)'],
        ['noPromptLabel',  'Клавиши, которые не кидают в промт:', 'Grok, «Общие»: поле клавиш, после которых Grok не переводит фокус в промт (v1.3.64)'],
        ['keyHelpTitle',   'Клавиши — клик дописывает в поле', 'окно «?» у поля клавиш'],
        ['keyHelpNote',    'Буква/цифра/знак — сама клавиша в любой раскладке (К = R). Пробел = Space. Остальные — {Имя}: {Enter}, {F5}, {ArrowUp}. Ctrl/Alt не учитываются (с ними Grok фокус не забирает).', 'окно «?» у поля клавиш: пояснение формата'],
        ['tplHelpBtn',     '?',             'кнопка у поля шаблона: окно тегов'],
        ['tplHelpTitle',   '🏷 Теги шаблона имени файла', 'заголовок окна «?»'],
        ['tplHelpNow',     'Сейчас скачается как:', 'строка с итоговым именем в окне «?»'],
        ['tplHelpUnknown', '⚠ Неизвестные теги — в имени файла пропадут:', 'предупреждение в окне «?»'],
        ['tplSiteLabel',   'Шаблон имени:', 'поле шаблона сайта во вкладке «Общие»'],
        ['#', 'Уведомления'],
        ['toastClose',     '×',             'крестик на тосте звука'],
    ];
    const LABEL_DEFAULTS = {};
    const LABEL_COMMENTS = {};
    for (const d of LABEL_DEFS) { if (d[0] !== '#') { LABEL_DEFAULTS[d[0]] = d[1]; LABEL_COMMENTS[d[0]] = d[2]; } }

    // Значки для копирования/вставки (вкладка «✏ Подписи»): сначала уже используемые в MOSSAD, затем запас
    const LABEL_PALETTE = [
        ['В MOSSAD', '⤒ ⤓ 🔒 🔓 🚀 💾 🔄 🔀 ⌨ 📋 👁 ⚙ 🌐 ⇄ ⤤ ⤢ × ✕ 📹 🖼 🎬 ❔ 📥 📌 🔍 ⏳ ⏱ 🗑 ✅ ❌ ⚠️ 💡 🔊 🔇 ↺ ↕ ▲ ▼ ◀ ▶ ■ ❚❚ ✏ 🩺 🗂 🔁'],
        ['Плеер', '▶ ⏸ ⏹ ⏺ ⏯ ⏭ ⏮ ⏩ ⏪ 🔁 🔂 🔀 🔈 🔉 🔊 🔇 🎵 🎞 📺 🎥'],
        ['Стрелки', '← → ↑ ↓ ↔ ↕ ↖ ↗ ↘ ↙ ⇐ ⇒ ⇑ ⇓ ⤴ ⤵ ↩ ↪ ⟲ ⟳ ➜ ➤ ⮕'],
        ['Действия', '🗑 ⬇ ⬆ 📤 📥 📂 📁 🗃 🔗 📎 ✂ 🖊 🔒 🔓 🔑 🧹 🛠 🔧 ⚡ 🔥'],
        ['Отметки', '✔ ✓ ✗ ✘ ☐ ☑ ★ ☆ ⭐ ❤ 💔 👍 👎 ⚑ 🏁 ● ○ ◆ ◇ •'],
        ['Разное', '👁 🕒 ⏰ ⌛ 📅 🔔 🔕 💬 ℹ ❓ ❗ ➕ ➖ ✖ ➗ 🎯 🧭 🌙 ☀ 🌀'],
    ];

    let _mossadLabelOverrides = null;

    function mossadReadLabelOverrides() {
        let raw = null;
        try { if (typeof GM_getValue === 'function') raw = GM_getValue(LABELS_GM_KEY, null); } catch (e) {}
        let obj = null;
        try { obj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { obj = null; }
        return mossadSanitizeLabelOverrides(obj);
    }
    /** Только известные ключи, только непустые строки, отличные от значения по умолчанию. */
    function mossadSanitizeLabelOverrides(obj) {
        const out = {};
        if (!obj || typeof obj !== 'object') return out;
        for (const k of Object.keys(obj)) {
            if (!Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, k)) continue;
            const v = typeof obj[k] === 'string' ? obj[k].trim().slice(0, 200) : '';
            if (v && v !== LABEL_DEFAULTS[k]) out[k] = v;
        }
        return out;
    }

    /** Подпись по ключу: своя (если задана) или по умолчанию. Неизвестный ключ — пустая строка. */
    function L(key) {
        if (_mossadLabelOverrides === null) _mossadLabelOverrides = mossadReadLabelOverrides();
        const o = _mossadLabelOverrides[key];
        if (o) return o;
        return Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, key) ? LABEL_DEFAULTS[key] : '';
    }
    /** То же, экранированное для вставки в innerHTML-шаблоны. */
    function LH(key) {
        return String(L(key)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    /** Поставить подпись элементу и пометить его для живого обновления (pre/suf — неизменяемые части). */
    function mossadLabelEl(el, key, pre = '', suf = '') {
        if (!el) return el;
        el.dataset.mossadLabel = key;
        if (pre) el.dataset.mossadPre = pre; else delete el.dataset.mossadPre;
        if (suf) el.dataset.mossadSuf = suf; else delete el.dataset.mossadSuf;
        el.textContent = pre + L(key) + suf;
        return el;
    }
    /** Элемент больше не показывает подпись (например, «Собрать» сменилось числом). */
    function mossadUnlabelEl(el) {
        if (el && el.dataset) { delete el.dataset.mossadLabel; delete el.dataset.mossadPre; delete el.dataset.mossadSuf; }
        return el;
    }
    /** Перерисовать все помеченные подписи (один querySelectorAll; вызывается только при сохранении). */
    function mossadApplyLabels(root) {
        const r = root || document;
        let n = 0;
        r.querySelectorAll('[data-mossad-label]').forEach(el => {
            const t = (el.dataset.mossadPre || '') + L(el.dataset.mossadLabel) + (el.dataset.mossadSuf || '');
            if (el.textContent !== t) { el.textContent = t; n++; }
        });
        return n;
    }

    function mossadGetLabelOverrides() {
        if (_mossadLabelOverrides === null) _mossadLabelOverrides = mossadReadLabelOverrides();
        return Object.assign({}, _mossadLabelOverrides);
    }
    /** Записать свои подписи (только отличные от умолчаний) в GM и перерисовать. */
    function mossadSetLabelOverrides(obj) {
        _mossadLabelOverrides = mossadSanitizeLabelOverrides(obj);
        try {
            if (typeof GM_setValue === 'function') GM_setValue(LABELS_GM_KEY, JSON.stringify(_mossadLabelOverrides));
        } catch (e) {}
        mossadApplyLabels();
        return Object.keys(_mossadLabelOverrides).length;
    }

    /** Текст для textarea: «# комментарий» + «ключ = подпись» по разделам. */
    function mossadLabelsToText(overrides) {
        const ov = overrides || mossadGetLabelOverrides();
        const lines = ['# Подписи MOSSAD: «ключ = подпись». Строки с # — комментарии.',
                       '# Пустая подпись или удалённая строка = по умолчанию. Неизвестные ключи игнорируются.', ''];
        for (const d of LABEL_DEFS) {
            if (d[0] === '#') { if (lines[lines.length - 1] !== '') lines.push(''); lines.push(`# ── ${d[1]} ──`); continue; }
            lines.push(`# ${d[2]}` + (ov[d[0]] ? ` (по умолчанию: ${d[1]})` : ''));
            lines.push(`${d[0]} = ${ov[d[0]] || d[1]}`);
        }
        return lines.join('\n') + '\n';
    }
    /** Разбор textarea → только изменённые ключи. Возвращает {overrides, unknown: [ключи]}. */
    function mossadParseLabelsText(text) {
        const raw = {};
        const unknown = [];
        String(text || '').split(/\r?\n/).forEach(line => {
            const s = line.trim();
            if (!s || s.startsWith('#')) return;
            const i = s.indexOf('=');
            if (i <= 0) return;
            const k = s.slice(0, i).trim();
            const v = s.slice(i + 1).trim();
            if (!Object.prototype.hasOwnProperty.call(LABEL_DEFAULTS, k)) { unknown.push(k); return; }
            raw[k] = v;
        });
        return { overrides: mossadSanitizeLabelOverrides(raw), unknown };
    }

    // Другие вкладки/контейнеры: подхватить изменения сразу (одно событие на сохранение, не опрос)
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            GM_addValueChangeListener(LABELS_GM_KEY, (name, oldVal, newVal, remote) => {
                if (!remote) return;
                _mossadLabelOverrides = null;
                try { mossadApplyLabels(); } catch (e) {}
            });
        } catch (e) {}
    }
