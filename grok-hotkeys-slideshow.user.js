// ==UserScript==
// @name         Grok Hotkeys + Slideshow 2.0
// @namespace    https://grok.com/
// @version      2.1.4-redgifs-title
// @description  Advanced hotkeys, slideshow engine and auto-navigation for Grok /imagine & RedGifs
// @author       eldmans
// @match        https://grok.com/*
// @match        https://*.redgifs.com/*
// @match        https://redgifs.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys-slideshow.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/grok-hotkeys-slideshow.user.js
// @supportURL   https://github.com/eldmans/tm-scripts/tree/grok
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  //  CONSTANTS & DEFAULTS
  // ─────────────────────────────────────────────

  const WIDGET_ID      = 'grok-ss-widget';
  const MODAL_ID       = 'grok-ss-modal';
  const STORAGE_KEY    = 'grokSS_settings';

  // ─────────────────────────────────────────────
  //  DOM SELECTORS (single source of truth)
  //  Update these when Grok changes its UI.
  // ─────────────────────────────────────────────

  const SEL = {
    // Prompt input field (text box)
    promptInput:   'textarea, div[contenteditable="true"]',

    // Media on /imagine/post/... page
    video:         'video[src]',
    videoAny:      'main video, div[role="dialog"] video, video',
    imageMain:     'main img, div[role="dialog"] img',
    imageFilmstrip:'button[data-filmstrip-item="true"] img',

    // Trusted media CDN patterns (use .includes() checks)
    mediaCDN: ['imagine-public.x.ai', 'assets.grok.com/users/', 'assets.grok.com/videos/'],

    // Post cards on /imagine/saved
    savedCards:    'a[href*="/imagine/post/"]',

    // Buttons (aria-label based — most reliable on Grok)
    btnDownload:   'button[aria-label*="Download"], button[aria-label*="Скачать"]',
    btnDelete:     'button[aria-label*="Delete"], button[aria-label*="Удалить"]',
    btnUpscale:    'button[aria-label*="Upscale"], button[aria-label*="Увеличить"], button[aria-label*="Enhance"]',
    btnPostMenu:   'button[aria-label*="Post actions"], button[aria-label*="More"], button[aria-label*="Ещё"]',
    btnMakeVideo:  'button[aria-label="Make video"]',
    btnSubmit:     'button[aria-label="Submit"]',

    // Modals / overlays
    confirmDelete: 'button',   // filter by textContent 'Delete'|'Удалить' inside modal
    modalDialog:   '[role="dialog"]',

    // Loading / moderation detectors
    loadingSpinner:'[class*="spin"], [class*="loading"], [class*="skeleton"]',
    moderationImg: 'img[src*="moderation"]',
    errorEl:       '[data-testid*="moderation"], [data-testid*="error"]',
  };

  const DEFAULTS = {
    // Panel visibility
    panelVisible: true,

    // Slideshow mode: 'manual' | 'auto'
    slideshowMode: 'manual',

    // Manual interval seconds
    manualInterval: 7,

    // AUTO countdown seconds after media ends
    autoCountdown: 1,

    // AUTO loops count
    autoLoops: 1,

    // D-pad direction: 'up' | 'down' | 'left' | 'right'
    dpadDir: 'right',

    // D-pad center mode: 'stop' | 'repeat' | 'auto'
    dpadCenter: 'stop',

    // Download mode: 'none' | 'photo' | 'video' | 'all'
    downloadMode: 'none',

    // Checkboxes
    autoDel:  false,
    autoTab:  false,
    autoBrsr: false,

    // PageDown intercept mode: 'off' | 'next' | 'del'
    pgDownMode: 'off',

    // Delete options
    autoConfirm: false,
    holdPost:    false,

    // Hotkeys (key codes)
    hk: {
      download:   'PageDown',
      upscale:    'PageUp',
      deletePub:  'Delete',
      toggleMute: 'ScrollLock',
      playPause:  'Pause',
      help:       'F1',
      lagMonitor: 'F8',
      goSaved:    'Home',
      togglePanel:'Insert',       // Ctrl+Insert
      startStop:  'Insert',
      focusPanel: 'F7',
    },
  };

  // ─────────────────────────────────────────────
  //  SETTINGS MANAGER
  // ─────────────────────────────────────────────

  const Settings = (() => {
    let _cache = null;

    function _load() {
      try {
        const raw = GM_getValue(STORAGE_KEY, null);
        if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
      } catch (_) {}
      return Object.assign({}, DEFAULTS);
    }

    function get() {
      if (!_cache) _cache = _load();
      return _cache;
    }

    function save() {
      GM_setValue(STORAGE_KEY, JSON.stringify(_cache));
    }

    function set(key, value) {
      get()[key] = value;
      save();
    }

    function setNested(parentKey, childKey, value) {
      get()[parentKey][childKey] = value;
      save();
    }

    // Download mode is session-only — always reset to 'none'
    function initSession() {
      get().downloadMode = 'none';
      // Do NOT persist this reset so it stays 'none' on reload
    }

    return { get, save, set, setNested, initSession };
  })();

  // ─────────────────────────────────────────────
  //  CSS — GLASSMORPHIC DESIGN SYSTEM
  // ─────────────────────────────────────────────

  GM_addStyle(/* css */`
    /* ── Google Font ── */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    /* ── CSS Variables ── */
    #${WIDGET_ID}, #${MODAL_ID} {
      --font:       'Inter', system-ui, sans-serif;
      --clr-bg:     rgba(14, 17, 23, 0.82);
      --clr-glass:  rgba(255, 255, 255, 0.04);
      --clr-border: rgba(255, 255, 255, 0.10);
      --clr-text:   #e2e8f0;
      --clr-muted:  #64748b;
      --clr-green:  #22c55e;
      --clr-blue:   #3b82f6;
      --clr-red:    #ef4444;
      --clr-amber:  #f59e0b;
      --clr-btn:    rgba(255, 255, 255, 0.07);
      --clr-btn-h:  rgba(255, 255, 255, 0.14);
      --radius:     8px;
      --radius-sm:  5px;
      --gap:        6px;
      --transition: 0.18s ease;
    }

    /* ── Widget Container ── */
    #${WIDGET_ID} {
      position: fixed;
      top: 50px;
      right: 50px;
      z-index: 999999;
      width: 280px;
      font-family: var(--font);
      font-size: 12px;
      color: var(--clr-text);
      background: var(--clr-bg);
      border: 1px solid var(--clr-border);
      border-radius: 12px;
      backdrop-filter: blur(24px) saturate(1.6);
      -webkit-backdrop-filter: blur(24px) saturate(1.6);
      box-shadow:
        0 8px 32px rgba(0,0,0,0.55),
        0 0 0 1px rgba(255,255,255,0.03) inset,
        0 1px 0 rgba(255,255,255,0.08) inset;
      overflow: hidden;
      transition: opacity var(--transition), transform var(--transition);
      user-select: none;
    }

    #${WIDGET_ID}.ss-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-8px) scale(0.97);
    }

    /* ── Header Bar ── */
    #grok-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      cursor: pointer;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid var(--clr-border);
      transition: background var(--transition);
    }
    #grok-header-bar:hover { background: rgba(255,255,255,0.07); }

    #grok-numpad-indicator {
      font-size: 10px;
      font-weight: 600;
      color: var(--clr-green);
      letter-spacing: 0.04em;
      min-width: 36px;
    }

    #grok-header-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--clr-text);
      text-transform: uppercase;
    }

    #grok-header-close {
      font-size: 16px;
      color: var(--clr-muted);
      line-height: 1;
      transition: color var(--transition);
    }
    #grok-header-bar:hover #grok-header-close { color: var(--clr-text); }

    /* ── Widget Body ── */
    #grok-widget-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: var(--gap);
    }

    /* ── Generic Row ── */
    .ss-row {
      display: flex;
      align-items: center;
      gap: var(--gap);
    }
    .ss-row-label {
      font-size: 10px;
      color: var(--clr-muted);
      min-width: 38px;
    }

    /* ── Buttons (generic) ── */
    .ss-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--clr-btn);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-sm);
      color: var(--clr-text);
      font-family: var(--font);
      font-size: 11px;
      font-weight: 500;
      padding: 3px 8px;
      min-width: 26px;
      height: 24px;
      cursor: pointer;
      transition: background var(--transition), border-color var(--transition), color var(--transition);
      white-space: nowrap;
    }
    .ss-btn:hover  { background: var(--clr-btn-h); }
    .ss-btn.active { background: rgba(34,197,94,0.18); border-color: var(--clr-green); color: var(--clr-green); }
    .ss-btn.active-blue { background: rgba(59,130,246,0.18); border-color: var(--clr-blue); color: var(--clr-blue); }

    /* ── Mode Toggle Row ── */
    #grok-mode-row {
      display: flex;
      align-items: center;
      gap: var(--gap);
    }
    #grok-mode-manual, #grok-mode-auto {
      flex: 1;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.06em;
      justify-content: center;
    }
    #grok-mode-manual.active { background: rgba(34,197,94,0.15); border-color: var(--clr-green); color: var(--clr-green); }
    #grok-mode-auto.active   { background: rgba(59,130,246,0.15); border-color: var(--clr-blue);  color: var(--clr-blue);  }
    #grok-btn-rewind {
      font-size: 14px;
      width: 28px;
      height: 24px;
      padding: 0;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* ── Manual / Auto Sections ── */
    #grok-timing-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .ss-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--clr-glass);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius);
      padding: 6px 8px;
    }
    .ss-section-title {
      font-size: 9px;
      letter-spacing: 0.1em;
      color: var(--clr-muted);
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }

    /* Manual section */
    #grok-manual-section .ss-row { justify-content: space-between; }
    #grok-manual-interval-display {
      font-size: 14px;
      font-weight: 700;
      color: var(--clr-text);
      min-width: 28px;
      text-align: center;
    }
    .ss-preset-row {
      display: flex;
      gap: 4px;
      margin-top: 2px;
    }
    .ss-preset-row .ss-btn {
      flex: 1;
      font-size: 10px;
      padding: 2px 4px;
      height: 20px;
    }

    /* AUTO section */
    #grok-auto-section .ss-row { justify-content: space-between; font-size: 11px; }
    #grok-auto-countdown-display,
    #grok-auto-loops-display {
      font-weight: 700;
      color: var(--clr-text);
      min-width: 28px;
      text-align: center;
    }
    #grok-auto-timer {
      font-size: 10px;
      color: var(--clr-muted);
      text-align: center;
      margin-top: 2px;
      min-height: 14px;
      font-variant-numeric: tabular-nums;
    }

    /* ── D-Pad ── */
    #grok-dpad-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 4px 0;
    }
    .dpad-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .dpad-btn {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      padding: 0;
    }
    .dpad-btn.active {
      background: rgba(34,197,94,0.20);
      border-color: var(--clr-green);
      color: var(--clr-green);
    }
    #grok-dpad-center {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 700;
      padding: 0;
      letter-spacing: 0;
    }
    /* Center mode colors */
    #grok-dpad-center.mode-stop   { color: var(--clr-muted);  border-color: var(--clr-muted);  background: transparent; }
    #grok-dpad-center.mode-repeat { color: var(--clr-blue);   border-color: var(--clr-blue);   background: rgba(59,130,246,0.15); }
    #grok-dpad-center.mode-auto   { color: var(--clr-green);  border-color: var(--clr-green);  background: rgba(34,197,94,0.15); }

    /* ── Options Section ── */
    #grok-options-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .ss-options-row {
      display: flex;
      align-items: center;
      gap: var(--gap);
      flex-wrap: wrap;
    }

    /* Select */
    .ss-select {
      background: var(--clr-btn);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-sm);
      color: var(--clr-text);
      font-family: var(--font);
      font-size: 11px;
      font-weight: 500;
      padding: 2px 6px;
      height: 24px;
      cursor: pointer;
      outline: none;
      flex: 1;
      min-width: 80px;
    }
    .ss-select option { background: #0f172a; color: var(--clr-text); }

    /* Checkbox styled */
    .ss-check-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 11px;
      color: var(--clr-text);
      padding: 2px 6px;
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-sm);
      background: var(--clr-btn);
      transition: background var(--transition), border-color var(--transition);
    }
    .ss-check-label:hover { background: var(--clr-btn-h); }
    .ss-check-label input[type="checkbox"] { display: none; }
    .ss-check-label.checked {
      background: rgba(34,197,94,0.15);
      border-color: var(--clr-green);
      color: var(--clr-green);
    }
    .ss-check-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      flex-shrink: 0;
    }
    .ss-check-label.checked .ss-check-dot { background: var(--clr-green); }

    /* Radio buttons */
    .ss-radio-group {
      display: flex;
      gap: 4px;
    }
    .ss-radio-label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 11px;
      color: var(--clr-text);
      padding: 2px 8px;
      height: 24px;
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-sm);
      background: var(--clr-btn);
      transition: background var(--transition), border-color var(--transition);
    }
    .ss-radio-label:hover { background: var(--clr-btn-h); }
    .ss-radio-label input[type="radio"] { display: none; }
    .ss-radio-label.checked {
      background: rgba(34,197,94,0.15);
      border-color: var(--clr-green);
      color: var(--clr-green);
    }

    /* ── Divider ── */
    .ss-divider {
      height: 1px;
      background: var(--clr-border);
      margin: 2px 0;
    }

    /* ── Section heading ── */
    .ss-sub-label {
      font-size: 9px;
      color: var(--clr-muted);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 600;
    }

    /* ════════════════════════════════════════════
       F1 MODAL
    ════════════════════════════════════════════ */
    #${MODAL_ID}-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 1000000;
      background: rgba(0,0,0,0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      align-items: center;
      justify-content: center;
    }
    #${MODAL_ID}-overlay.open { display: flex; }

    #${MODAL_ID} {
      font-family: var(--font);
      font-size: 12px;
      color: var(--clr-text);
      background: rgba(14, 17, 23, 0.95);
      border: 1px solid var(--clr-border);
      border-radius: 14px;
      backdrop-filter: blur(32px) saturate(1.8);
      -webkit-backdrop-filter: blur(32px) saturate(1.8);
      box-shadow: 0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset;
      width: 520px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: modalIn 0.2s cubic-bezier(0.34,1.2,0.64,1);
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.93) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    #grok-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      border-bottom: 1px solid var(--clr-border);
      background: rgba(255,255,255,0.02);
    }
    #grok-modal-header h2 {
      font-size: 15px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 0.04em;
    }
    #grok-modal-close {
      cursor: pointer;
      font-size: 20px;
      color: var(--clr-muted);
      line-height: 1;
      transition: color var(--transition);
      background: none;
      border: none;
      padding: 0 2px;
    }
    #grok-modal-close:hover { color: var(--clr-text); }

    #grok-modal-body {
      overflow-y: auto;
      padding: 16px 20px;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--clr-border) transparent;
    }

    .hk-table {
      width: 100%;
      border-collapse: collapse;
    }
    .hk-table th {
      font-size: 9px;
      color: var(--clr-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--clr-border);
    }
    .hk-table td {
      padding: 8px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      vertical-align: middle;
    }
    .hk-table tr:last-child td { border-bottom: none; }
    .hk-table tr:hover td { background: rgba(255,255,255,0.02); }

    .hk-key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font);
      font-size: 10px;
      font-weight: 600;
      color: var(--clr-text);
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-bottom: 2px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      padding: 2px 8px;
      min-width: 64px;
      text-align: center;
      letter-spacing: 0.02em;
      cursor: pointer;
      transition: background var(--transition), border-color var(--transition);
    }
    .hk-key:hover { background: rgba(255,255,255,0.14); border-color: var(--clr-green); }
    .hk-key.recording {
      background: rgba(239,68,68,0.2);
      border-color: var(--clr-red);
      color: var(--clr-red);
      animation: pulse 0.8s ease infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 1; }
      to   { opacity: 0.5; }
    }

    .hk-desc { color: var(--clr-muted); font-size: 11px; }

    #grok-modal-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--clr-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .ss-btn-primary {
      background: rgba(34,197,94,0.20);
      border-color: var(--clr-green);
      color: var(--clr-green);
      font-weight: 600;
    }
    .ss-btn-primary:hover { background: rgba(34,197,94,0.32); }
  `);

  // ─────────────────────────────────────────────
  //  STATE
  // ─────────────────────────────────────────────

  const State = {
    numLock: null,          // null = unknown, true, false
    slideshowRunning: false,
    recordingHotkey: null,  // key name being recorded in F1 modal
  };

  // ─────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function makeCheckLabel(text, storageKey, onChange) {
    const s = Settings.get();
    const label = el('label', { class: `ss-check-label${s[storageKey] ? ' checked' : ''}` });
    const inp   = el('input', { type: 'checkbox' });
    const dot   = el('span', { class: 'ss-check-dot' });
    if (s[storageKey]) inp.checked = true;
    label.appendChild(inp);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(' ' + text));
    label.addEventListener('click', () => {
      const val = !Settings.get()[storageKey];
      Settings.set(storageKey, val);
      inp.checked = val;
      label.classList.toggle('checked', val);
      if (onChange) onChange(val);
    });
    return label;
  }

  function makeRadioGroup(name, options, storageKey, onChange) {
    const wrap = el('div', { class: 'ss-radio-group' });
    options.forEach(({ label: lText, value }) => {
      const lbl = el('label', { class: `ss-radio-label${Settings.get()[storageKey] === value ? ' checked' : ''}` });
      const inp = el('input', { type: 'radio', name });
      if (Settings.get()[storageKey] === value) inp.checked = true;
      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(lText));
      lbl.addEventListener('click', () => {
        Settings.set(storageKey, value);
        wrap.querySelectorAll('.ss-radio-label').forEach(l => l.classList.remove('checked'));
        lbl.classList.add('checked');
        if (onChange) onChange(value);
      });
      wrap.appendChild(lbl);
    });
    return wrap;
  }

  // ─────────────────────────────────────────────
  //  NUMLOCK DETECTOR
  // ─────────────────────────────────────────────

  function detectNumLock(e) {
    if (e.getModifierState) {
      State.numLock = e.getModifierState('NumLock');
      updateNumLockUI();
    }
  }

  function updateNumLockUI() {
    const ind = document.getElementById('grok-numpad-indicator');
    if (!ind) return;
    if (State.numLock === null) { ind.textContent = 'Num ?'; ind.style.color = 'var(--clr-amber)'; }
    else if (State.numLock)    { ind.textContent = 'Num ВКЛ'; ind.style.color = 'var(--clr-green)'; }
    else                       { ind.textContent = 'Num ВЫКЛ'; ind.style.color = 'var(--clr-red)'; }
  }

  // ─────────────────────────────────────────────
  //  WIDGET BUILD
  // ─────────────────────────────────────────────

  function buildWidget() {
    const s = Settings.get();

    // ── Root ──
    const widget = el('div', { id: WIDGET_ID });
    if (!s.panelVisible) widget.classList.add('ss-hidden');

    // ── 1. Header Bar ──
    const header = el('div', { id: 'grok-header-bar' });
    const numInd = el('span', { id: 'grok-numpad-indicator' });
    const title  = el('span', { id: 'grok-header-title' }, 'SlideShow');
    const closeX = el('span', { id: 'grok-header-close' }, '×');
    header.appendChild(numInd);
    header.appendChild(title);
    header.appendChild(closeX);
    // Клик по тексту SlideShow = сворачивает body (full ↔ mini)
    title.addEventListener('click', (e) => { e.stopPropagation(); collapseToMini(); });
    // Клик по крестику = скрыть полностью
    closeX.addEventListener('click', (e) => { e.stopPropagation(); hidePanel(); });
    widget.appendChild(header);

    // Update numlock text immediately
    updateNumLockUI();

    // ── Body ──
    const body = el('div', { id: 'grok-widget-body' });

    // ── 2. Mode Toggle Row ──
    const modeRow = el('div', { id: 'grok-mode-row' });

    const btnManual = el('button', { id: 'grok-mode-manual', class: 'ss-btn' }, 'Manual');
    const btnRewind = el('button', { id: 'grok-btn-rewind',  class: 'ss-btn' }, '↺');
    const btnAuto   = el('button', { id: 'grok-mode-auto',   class: 'ss-btn' }, 'AUTO');

    if (s.slideshowMode === 'manual') btnManual.classList.add('active');
    else                               btnAuto.classList.add('active');

    // Клик Manual: если уже Manual + запущен — стоп; если не запущен / был AUTO — запуск
    btnManual.addEventListener('click', () => {
      if (Settings.get().slideshowMode === 'manual' && State.slideshowRunning) {
        stopSlideshow('manual-btn');
      } else {
        setSlideshowMode('manual');
        startSlideshow();
      }
    });
    // Клик AUTO: аналогично
    btnAuto.addEventListener('click', () => {
      if (Settings.get().slideshowMode === 'auto' && State.slideshowRunning) {
        stopSlideshow('auto-btn');
      } else {
        setSlideshowMode('auto');
        startSlideshow();
      }
    });
    btnRewind.addEventListener('click', () => rewindToStart());

    modeRow.appendChild(btnManual);
    modeRow.appendChild(btnRewind);
    modeRow.appendChild(btnAuto);
    body.appendChild(modeRow);

    // ── 3. Timing Row (Manual + AUTO) ──
    const timingRow = el('div', { id: 'grok-timing-row' });

    // Manual Section
    const manualSec = el('div', { id: 'grok-manual-section', class: 'ss-section' });
    const manualTitle = el('div', { class: 'ss-section-title' }, 'Manual');

    const manualCtrl = el('div', { class: 'ss-row' });
    const btnMinus  = el('button', { class: 'ss-btn', id: 'grok-manual-minus' }, '−');
    const manualNum = el('span',   { id: 'grok-manual-interval-display' }, String(s.manualInterval) + 'с');
    const btnPlus   = el('button', { class: 'ss-btn', id: 'grok-manual-plus' }, '+');

    btnMinus.addEventListener('click', () => adjustManualInterval(-1));
    btnPlus.addEventListener('click',  () => adjustManualInterval(+1));
    manualCtrl.appendChild(btnMinus);
    manualCtrl.appendChild(manualNum);
    manualCtrl.appendChild(btnPlus);

    const presetRow = el('div', { class: 'ss-preset-row' });
    [7, 12, 17].forEach(sec => {
      const pb = el('button', { class: 'ss-btn ss-preset', 'data-sec': String(sec) }, `[${sec}]`);
      pb.addEventListener('click', () => setManualInterval(sec));
      presetRow.appendChild(pb);
    });

    manualSec.appendChild(manualTitle);
    manualSec.appendChild(manualCtrl);
    manualSec.appendChild(presetRow);

    // AUTO Section
    const autoSec = el('div', { id: 'grok-auto-section', class: 'ss-section' });
    const autoTitle = el('div', { class: 'ss-section-title' }, 'AUTO');

    // Countdown row
    const cdRow = el('div', { class: 'ss-row' });
    const cdMinus = el('button', { class: 'ss-btn', id: 'grok-auto-cd-minus' }, '−');
    const cdNum   = el('span',   { id: 'grok-auto-countdown-display' }, `${String(s.autoCountdown).padStart(2,'0')}с`);
    const cdPlus  = el('button', { class: 'ss-btn', id: 'grok-auto-cd-plus' }, '+');
    cdMinus.addEventListener('click', () => adjustAutoCountdown(-1));
    cdPlus.addEventListener('click',  () => adjustAutoCountdown(+1));
    cdRow.appendChild(cdMinus);
    cdRow.appendChild(cdNum);
    cdRow.appendChild(cdPlus);

    // Loops row
    const loopRow = el('div', { class: 'ss-row' });
    const lpMinus = el('button', { class: 'ss-btn', id: 'grok-auto-lp-minus' }, '÷');
    const lpNum   = el('span',   { id: 'grok-auto-loops-display' }, `${s.autoLoops}x`);
    const lpPlus  = el('button', { class: 'ss-btn', id: 'grok-auto-lp-plus' }, '×');
    lpMinus.addEventListener('click', () => adjustAutoLoops(-1));
    lpPlus.addEventListener('click',  () => adjustAutoLoops(+1));
    loopRow.appendChild(lpMinus);
    loopRow.appendChild(lpNum);
    loopRow.appendChild(lpPlus);

    // Timer display
    const timerDisp = el('div', { id: 'grok-auto-timer' }, '—');

    autoSec.appendChild(autoTitle);
    autoSec.appendChild(cdRow);
    autoSec.appendChild(loopRow);
    autoSec.appendChild(timerDisp);

    timingRow.appendChild(manualSec);
    timingRow.appendChild(autoSec);
    body.appendChild(timingRow);

    // ── 4. D-Pad ──
    const dpadWrap = el('div', { id: 'grok-dpad-wrap' });

    const dpadUp  = makeDpadBtn('up',    '▲', 'grok-dpad-up');
    const dpadDn  = makeDpadBtn('down',  '▼', 'grok-dpad-down');
    const dpadL   = makeDpadBtn('left',  '◄', 'grok-dpad-left');
    const dpadR   = makeDpadBtn('right', '►', 'grok-dpad-right');
    const dpadC   = makeDpadCenterBtn();

    const topRow  = el('div', { class: 'dpad-row' }, dpadUp);
    const midRow  = el('div', { class: 'dpad-row' });
    midRow.appendChild(dpadL);
    midRow.appendChild(dpadC);
    midRow.appendChild(dpadR);
    const botRow  = el('div', { class: 'dpad-row' }, dpadDn);

    dpadWrap.appendChild(topRow);
    dpadWrap.appendChild(midRow);
    dpadWrap.appendChild(botRow);
    body.appendChild(dpadWrap);

    // ── 5. Options ──
    body.appendChild(el('div', { class: 'ss-divider' }));

    const optSec = el('div', { id: 'grok-options-section' });

    // Download + del/Tab/Brsr row
    const opt1 = el('div', { class: 'ss-options-row' });
    const dlSelect = el('select', { class: 'ss-select', id: 'grok-dl-select' });
    [
      { v: 'none',  t: '↓ выкл' },
      { v: 'photo', t: '↓ фото' },
      { v: 'video', t: '↓ видео' },
      { v: 'all',   t: '↓ всё'  },
    ].forEach(({ v, t }) => {
      const opt = el('option', { value: v }, t);
      if (v === 'none') opt.selected = true; // session default always none
      dlSelect.appendChild(opt);
    });
    dlSelect.addEventListener('change', () => {
      Settings.get().downloadMode = dlSelect.value;
    });
    opt1.appendChild(dlSelect);

    const chkDel  = makeCheckLabel('del',  'autoDel',  null);
    const chkTab  = makeCheckLabel('Tab',  'autoTab',  null);
    const chkBrsr = makeCheckLabel('Brsr', 'autoBrsr', null);
    opt1.appendChild(chkDel);
    opt1.appendChild(chkTab);
    opt1.appendChild(chkBrsr);
    optSec.appendChild(opt1);

    // ── 6. PageDown intercept ──
    const opt2 = el('div', { class: 'ss-options-row' });
    opt2.appendChild(el('span', { class: 'ss-sub-label' }, 'PageDown:'));
    opt2.appendChild(makeRadioGroup('pgdown', [
      { label: '—',   value: 'off'  },
      { label: '+1',  value: 'next' },
      { label: 'del', value: 'del'  },
    ], 'pgDownMode', null));
    optSec.appendChild(opt2);

    // ── 7. Delete options ──
    body.appendChild(el('div', { class: 'ss-divider' }));
    const opt3 = el('div', { class: 'ss-options-row' });
    opt3.appendChild(el('span', { class: 'ss-sub-label' }, 'Delete:'));
    const chkConfirm   = makeCheckLabel('a.confirm', 'autoConfirm', null);
    const chkHoldPost  = makeCheckLabel('hold post', 'holdPost',    null);
    opt3.appendChild(chkConfirm);
    opt3.appendChild(chkHoldPost);
    optSec.appendChild(opt3);

    body.appendChild(optSec);

    widget.appendChild(body);
    document.body.appendChild(widget);
  }

  function makeDpadBtn(dir, symbol, id) {
    const s = Settings.get();
    const btn = el('button', { class: `ss-btn dpad-btn${s.dpadDir === dir ? ' active' : ''}`, id });
    btn.textContent = symbol;
    btn.addEventListener('click', () => setDpadDir(dir));
    return btn;
  }

  function makeDpadCenterBtn() {
    const s = Settings.get();
    const modeMap = { stop: { text: '—', cls: 'mode-stop' }, repeat: { text: 'R', cls: 'mode-repeat' }, auto: { text: 'A', cls: 'mode-auto' } };
    const m = modeMap[s.dpadCenter] || modeMap.stop;
    const btn = el('button', { id: 'grok-dpad-center', class: `ss-btn dpad-btn ${m.cls}` });
    btn.textContent = m.text;
    btn.addEventListener('click', cycleDpadCenter);
    return btn;
  }

  // ─────────────────────────────────────────────
  //  F1 MODAL BUILD
  // ─────────────────────────────────────────────

  const HOTKEY_DEFS = [
    { key: 'download',   label: 'PageDown',       desc: 'Скачать медиа' },
    { key: 'upscale',    label: 'PageUp',          desc: 'Улучшить качество (Upscale)' },
    { key: 'deletePub',  label: 'Delete',          desc: 'Удалить публикацию' },
    { key: 'toggleMute', label: 'ScrollLock',      desc: 'Вкл / Выкл звук' },
    { key: 'playPause',  label: 'Pause',           desc: 'Play / Pause видео' },
    { key: 'help',       label: 'F1',              desc: 'Справка / Настройки' },
    { key: 'lagMonitor', label: 'F8',              desc: 'Lag Monitor' },
    { key: 'goSaved',    label: 'Home',            desc: 'Перейти в /imagine/saved' },
    { key: 'togglePanel',label: 'Ctrl+Insert',     desc: 'Скрыть / Показать панель' },
    { key: 'startStop',  label: 'Insert',          desc: 'Запуск / Остановка слайд-шоу' },
    { key: 'focusPanel', label: 'F7',              desc: 'Фокус на панель управления' },
  ];

  function buildModal() {
    const overlay = el('div', { id: `${MODAL_ID}-overlay` });
    const modal   = el('div', { id: MODAL_ID });

    // Header
    const mHeader = el('div', { id: 'grok-modal-header' });
    const mTitle  = el('h2', {}, '⌨️  Настройки хоткеев — Grok Hotkeys 2.0');
    const mClose  = el('button', { id: 'grok-modal-close' }, '×');
    mClose.addEventListener('click', closeModal);
    mHeader.appendChild(mTitle);
    mHeader.appendChild(mClose);

    // Body
    const mBody = el('div', { id: 'grok-modal-body' });
    const table = el('table', { class: 'hk-table' });
    const thead = el('thead');
    const hRow  = el('tr');
    hRow.appendChild(el('th', {}, 'Клавиша'));
    hRow.appendChild(el('th', {}, 'Действие'));
    hRow.appendChild(el('th', {}, ''));
    thead.appendChild(hRow);
    table.appendChild(thead);

    const tbody = el('tbody', { id: 'grok-modal-tbody' });
    renderHotkeyRows(tbody);
    table.appendChild(tbody);
    mBody.appendChild(table);

    // Footer
    const mFooter = el('div', { id: 'grok-modal-footer' });
    const btnReset = el('button', { class: 'ss-btn', id: 'grok-modal-reset' }, 'Сбросить');
    const btnClose = el('button', { class: 'ss-btn ss-btn-primary', id: 'grok-modal-ok' }, 'Готово');
    btnReset.addEventListener('click', resetHotkeys);
    btnClose.addEventListener('click', closeModal);
    mFooter.appendChild(btnReset);
    mFooter.appendChild(btnClose);

    modal.appendChild(mHeader);
    modal.appendChild(mBody);
    modal.appendChild(mFooter);
    overlay.appendChild(modal);

    // Close on backdrop click
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    document.body.appendChild(overlay);
  }

  function renderHotkeyRows(tbody) {
    const hk = Settings.get().hk;
    tbody.innerHTML = '';
    HOTKEY_DEFS.forEach(def => {
      const tr = el('tr');
      // Key cell
      const tdKey  = el('td');
      const keyBtn = el('span', { class: 'hk-key', 'data-hkname': def.key }, hk[def.key] || def.label);
      keyBtn.addEventListener('click', () => startRecording(def.key, keyBtn));
      tdKey.appendChild(keyBtn);
      // Description
      const tdDesc = el('td', { class: 'hk-desc' }, def.desc);
      // Reset single key
      const tdReset = el('td');
      const rsBtn  = el('button', { class: 'ss-btn', style: { fontSize: '10px', padding: '1px 6px', height: '20px' } }, '↺');
      rsBtn.addEventListener('click', () => resetSingleHotkey(def.key));
      tdReset.appendChild(rsBtn);

      tr.appendChild(tdKey);
      tr.appendChild(tdDesc);
      tr.appendChild(tdReset);
      tbody.appendChild(tr);
    });
  }

  function startRecording(hkName, keyBtn) {
    if (State.recordingHotkey) return; // already recording
    State.recordingHotkey = hkName;
    keyBtn.classList.add('recording');
    keyBtn.textContent = '…жди нажатия';

    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();

      const parts = [];
      if (e.ctrlKey)  parts.push('Ctrl');
      if (e.altKey)   parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      // Ignore modifier-only presses
      if (['Control','Alt','Shift','Meta'].includes(e.key)) return;
      parts.push(e.key);
      const combo = parts.join('+');

      Settings.setNested('hk', hkName, combo);
      keyBtn.textContent = combo;
      keyBtn.classList.remove('recording');
      State.recordingHotkey = null;
      document.removeEventListener('keydown', onKey, true);
    }
    document.addEventListener('keydown', onKey, true);
  }

  function resetSingleHotkey(hkName) {
    const def = HOTKEY_DEFS.find(d => d.key === hkName);
    if (!def) return;
    Settings.setNested('hk', hkName, def.label);
    const btn = document.querySelector(`.hk-key[data-hkname="${hkName}"]`);
    if (btn) { btn.textContent = def.label; btn.classList.remove('recording'); }
    State.recordingHotkey = null;
  }

  function resetHotkeys() {
    HOTKEY_DEFS.forEach(def => Settings.setNested('hk', def.key, def.label));
    renderHotkeyRows(document.getElementById('grok-modal-tbody'));
    State.recordingHotkey = null;
  }

  function openModal()  { document.getElementById(`${MODAL_ID}-overlay`).classList.add('open'); }
  function closeModal() {
    document.getElementById(`${MODAL_ID}-overlay`).classList.remove('open');
    State.recordingHotkey = null;
  }

  // ─────────────────────────────────────────────
  //  PANEL TOGGLE
  // ─────────────────────────────────────────────

  // ── 3-состояниевый виджет: full / mini / hidden ─────────────────
  // full    = шапка + всё содержимое
  // mini    = только полоска-шапка
  // hidden  = полностью невидимо

  let _panelState = 'full'; // текущее состояние

  function applyPanelState(state) {
    _panelState = state;
    Settings.set('panelState', state);
    const widget = document.getElementById(WIDGET_ID);
    const body   = document.getElementById('grok-widget-body');
    if (!widget) return;
    if (state === 'hidden') {
      widget.style.display = 'none';
    } else {
      widget.style.display = '';
      if (body) body.style.display = state === 'full' ? '' : 'none';
    }
  }

  /** Ctrl+Insert: переключает full ↔ hidden */
  function togglePanel() {
    applyPanelState(_panelState === 'hidden' ? 'full' : 'hidden');
  }

  /** Клик по SlideShow: сворачивает full ↔ mini */
  function collapseToMini() {
    applyPanelState(_panelState === 'full' ? 'mini' : 'full');
  }

  /** Клик по крестику: скрыть полностью */
  function hidePanel() {
    applyPanelState('hidden');
  }

  // ─────────────────────────────────────────────
  //  UI ACTIONS (STUBS — filled in later stages)
  // ─────────────────────────────────────────────

  function setSlideshowMode(mode) {
    Settings.set('slideshowMode', mode);
    const btnManual = document.getElementById('grok-mode-manual');
    const btnAuto   = document.getElementById('grok-mode-auto');
    if (!btnManual || !btnAuto) return;
    btnManual.classList.toggle('active', mode === 'manual');
    btnAuto.classList.toggle('active',   mode === 'auto');
  }

  // rewindToStart() определена в блоке SLIDESHOW ENGINE (Этап 3)

  function adjustManualInterval(delta) {
    const s = Settings.get();
    const val = Math.max(0, s.manualInterval + delta);
    Settings.set('manualInterval', val);
    const disp = document.getElementById('grok-manual-interval-display');
    if (disp) disp.textContent = `${val}с`;
  }

  function setManualInterval(sec) {
    Settings.set('manualInterval', sec);
    const disp = document.getElementById('grok-manual-interval-display');
    if (disp) disp.textContent = `${sec}с`;
    setSlideshowMode('manual');
  }

  function adjustAutoCountdown(delta) {
    const s = Settings.get();
    const val = Math.max(0, s.autoCountdown + delta);
    Settings.set('autoCountdown', val);
    const disp = document.getElementById('grok-auto-countdown-display');
    if (disp) disp.textContent = `${String(val).padStart(2, '0')}с`;
  }

  function adjustAutoLoops(delta) {
    const s = Settings.get();
    const val = Math.max(1, s.autoLoops + delta);
    Settings.set('autoLoops', val);
    const disp = document.getElementById('grok-auto-loops-display');
    if (disp) disp.textContent = `${val}x`;
  }

  function setDpadDir(dir) {
    Settings.set('dpadDir', dir);
    document.querySelectorAll('.dpad-btn').forEach(b => {
      if (b.id === 'grok-dpad-center') return;
      b.classList.remove('active');
    });
    const btn = document.getElementById(`grok-dpad-${dir}`);
    if (btn) btn.classList.add('active');
  }

  function cycleDpadCenter() {
    const cycle = { stop: 'repeat', repeat: 'auto', auto: 'stop' };
    const labels = { stop: '—', repeat: 'R', auto: 'A' };
    const clsMap = { stop: 'mode-stop', repeat: 'mode-repeat', auto: 'mode-auto' };
    const cur = Settings.get().dpadCenter;
    const next = cycle[cur] || 'stop';
    Settings.set('dpadCenter', next);
    const btn = document.getElementById('grok-dpad-center');
    if (!btn) return;
    btn.textContent = labels[next];
    btn.classList.remove('mode-stop', 'mode-repeat', 'mode-auto');
    btn.classList.add(clsMap[next]);
  }

  // ─────────────────────────────────────────────
  //  BLUR GUARD — Защита фокуса
  // ─────────────────────────────────────────────

  /**
   * Снимает фокус с поля ввода (промпт Grok).
   * Вызывается перед КАЖДЫМ хоткей-действием и при навигации.
   */
  function blurActiveInput() {
    const ae = document.activeElement;
    if (!ae) return;
    const tag = ae.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      ae.getAttribute('contenteditable') === 'true' ||
      ae.isContentEditable
    ) {
      ae.blur();
    }
  }

  // ─────────────────────────────────────────────
  //  DOM HELPERS (Grok UI actions — stubs for
  //  later stages; safe to call at any time)
  // ─────────────────────────────────────────────

  /** Найти кнопку в DOM по SEL-строке. */
  function findBtn(sel) {
    return document.querySelector(sel) || null;
  }

  /** Кликнуть кнопку если она найдена. */
  function clickBtn(sel) {
    const btn = findBtn(sel);
    if (btn) { btn.click(); return true; }
    return false;
  }

  /**
   * Скачать текущее медиа через GM_download.
   * Порядок: поиск video[src] → поиск img[src] → клик кнопки Download как fallback.
   */
  function actionDownload() {
    blurActiveInput();
    downloadCurrentMedia();
  }

  /**
   * Upscale текущего медиа.
   */
  function actionUpscale() {
    blurActiveInput();
    clickBtn(SEL.btnUpscale);
  }

  /**
   * Удалить публикацию.
   * Алгоритм hold post + a.confirm из ТЗ.
   */
  function actionDeletePub() {
    blurActiveInput();
    deleteCurrentPost();
  }

  /** Вкл/выкл звук текущего видео. */
  function actionToggleMute() {
    blurActiveInput();
    const v = document.querySelector(SEL.video);
    if (v) v.muted = !v.muted;
  }

  /** Play / Pause текущего видео. */
  function actionPlayPause() {
    blurActiveInput();
    const v = document.querySelector(SEL.video);
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else          v.pause();
  }

  /** Перейти на /imagine/saved. */
  function actionGoSaved() {
    blurActiveInput();
    location.href = 'https://grok.com/imagine/saved';
  }

  /** Запуск / остановка слайдшоу (реализация — Этап 3). */
  function actionToggleSlideshow() {
    blurActiveInput();
    if (State.slideshowRunning) {
      stopSlideshow('manual');
    } else {
      startSlideshow();
    }
  }

  /** Фокус на виджет панели. */
  function actionFocusPanel() {
    const w = document.getElementById(WIDGET_ID);
    if (w) w.focus();
  }

  // ─────────────────────────────────────────────
  //  PAGE DOWN INTERCEPT
  // ─────────────────────────────────────────────

  function handlePageDown(e) {
    const mode = Settings.get().pgDownMode;
    if (mode === 'off') return;
    e.preventDefault();
    blurActiveInput();
    if (mode === 'next') {
      actionDownload();
      // Stage 3: also advance slide
    } else if (mode === 'del') {
      actionDeletePub();
    }
  }

  // ─────────────────────────────────────────────
  //  TAB / BROWSER FOCUS LISTENERS
  // ─────────────────────────────────────────────

  /**
   * Auto-pause slideshow when tab becomes hidden (autoTab)
   * or browser loses focus (autoBrsr).
   * Stage 3 will call actual pause; here we store the flag.
   */
  document.addEventListener('visibilitychange', () => {
    if (!Settings.get().autoTab) return;
    if (document.hidden) {
      State._pausedByTab = true;
      if (State.slideshowRunning) stopSlideshow('tab');
    } else {
      if (State._pausedByTab) {
        State._pausedByTab = false;
        startSlideshow();
      }
    }
  });

  window.addEventListener('blur', () => {
    if (!Settings.get().autoBrsr) return;
    State._pausedByBrsr = true;
    if (State.slideshowRunning) stopSlideshow('brsr');
  });

  window.addEventListener('focus', () => {
    if (!Settings.get().autoBrsr) return;
    if (State._pausedByBrsr) {
      State._pausedByBrsr = false;
      startSlideshow();
    }
  });

  // ─────────────────────────────────────────────
  //  KEYBOARD LISTENER — полный набор хоткеев
  // ─────────────────────────────────────────────

  function matchHotkey(e, combo) {
    const parts = combo.split('+');
    const key   = parts[parts.length - 1];
    const ctrl  = parts.includes('Ctrl');
    const alt   = parts.includes('Alt');
    const shift = parts.includes('Shift');
    return (
      e.key      === key   &&
      e.ctrlKey  === ctrl  &&
      e.altKey   === alt   &&
      e.shiftKey === shift
    );
  }

  document.addEventListener('keydown', e => {
    // Всегда обновляем NumLock
    detectNumLock(e);

    // Не стреляем если сейчас идёт запись хоткея
    if (State.recordingHotkey) return;

    // Не стреляем если фокус в промпт-инпуте
    // (кроме специальных системных клавиш)
    const ae = document.activeElement;
    const inInput = ae && (
      ae.tagName === 'INPUT' ||
      ae.tagName === 'TEXTAREA' ||
      ae.getAttribute('contenteditable') === 'true' ||
      ae.isContentEditable
    );

    const hk = Settings.get().hk;

    // ── F1: Справка/Настройки ──────────────────
    if (matchHotkey(e, hk.help)) {
      e.preventDefault();
      openModal();
      return;
    }

    // ── Ctrl+Insert: Toggle Panel ──────────────
    if (matchHotkey(e, 'Ctrl+Insert')) {
      e.preventDefault();
      togglePanel();
      return;
    }

    // ── F7: Фокус на панель ───────────────────
    if (matchHotkey(e, hk.focusPanel)) {
      e.preventDefault();
      actionFocusPanel();
      return;
    }

    // ── Ниже — не работаем если фокус в инпуте
    if (inInput) return;

    // ── Insert: Запуск/Стоп слайдшоу ──────────
    if (matchHotkey(e, hk.startStop) && !e.ctrlKey) {
      e.preventDefault();
      actionToggleSlideshow();
      return;
    }

    // ── PageDown: Скачать (или intercept-режим)
    if (e.key === 'PageDown') {
      const pgMode = Settings.get().pgDownMode;
      if (pgMode !== 'off') {
        handlePageDown(e);
        return;
      }
      if (matchHotkey(e, hk.download)) {
        e.preventDefault();
        actionDownload();
        return;
      }
    }

    // ── PageUp: Upscale ────────────────────────
    if (matchHotkey(e, hk.upscale)) {
      e.preventDefault();
      actionUpscale();
      return;
    }

    // ── Delete: Удалить публикацию ─────────────
    if (matchHotkey(e, hk.deletePub)) {
      e.preventDefault();
      actionDeletePub();
      return;
    }

    // ── ScrollLock: Вкл/Выкл звук ─────────────
    if (matchHotkey(e, hk.toggleMute)) {
      e.preventDefault();
      actionToggleMute();
      return;
    }

    // ── Pause: Play/Pause видео ────────────────
    if (matchHotkey(e, hk.playPause)) {
      e.preventDefault();
      actionPlayPause();
      return;
    }

    // ── Home: Перейти в /imagine/saved ─────────
    if (matchHotkey(e, hk.goSaved)) {
      e.preventDefault();
      actionGoSaved();
      return;
    }

    // ── F8: Lag Monitor (stub) ─────────────────
    if (matchHotkey(e, hk.lagMonitor)) {
      e.preventDefault();
      // Stage 3+: lag monitor overlay
      console.log('[GrokSS] Lag Monitor — TODO');
      return;
    }
  }, true);

  // ─────────────────────────────────────────────
  //  SLIDESHOW ENGINE — Этап 3
  // ─────────────────────────────────────────────

  // ── Внутреннее состояние движка ──────────────
  const SS = {
    // Таймер ручного режима
    manualTimer:   null,

    // AUTO-режим
    autoTimer:     null,      // requestAnimationFrame handle
    autoRAF:       null,      // alias
    currentLoop:   0,         // текущий круг повтора видео
    timerStart:    0,         // timestamp начала отсчёта
    timerTarget:   0,         // timestamp когда истекает
    countdownStart:0,         // timestamp начала countdown после медиа

    // Флаги состояния
    inCountdown:   false,     // идёт отсчёт после медиа
    lastVideoSrc:  '',        // для отслеживания смены видео
    _rafId:        null,
  };

  // ── Утилиты ───────────────────────────────────

  /** Форматирует секунды в M:SS */
  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Обновить табло секундомера в AUTO-секции */
  function updateTimerDisplay(text) {
    const el = document.getElementById('grok-auto-timer');
    if (el) el.textContent = text;
  }

  /**
   * Найти текущее видео на странице.
   * Возвращает video-элемент или null.
   */
  function getCurrentVideo() {
    // Сначала ищем в main, потом везде
    return document.querySelector('main video[src]')
        || document.querySelector('video[src]')
        || null;
  }

  /**
   * Проверить: видео полностью загружено и готово
   * (нет loading/moderation).
   */
  function isVideoReady() {
    const v = getCurrentVideo();
    if (!v || !v.src) return false;
    if (document.querySelector(SEL.moderationImg)) return false;
    if (document.querySelector(SEL.loadingSpinner)) return false;
    return true;
  }

  /**
   * Проверить: текущая страница — пост с медиа.
   * URL вида /imagine/post/...
   */
  function isOnPostPage() {
    return location.pathname.includes('/imagine/post/');
  }

  // ── Навигация слайдов ─────────────────────────

  /**
   * Переключить слайд в направлении D-pad.
   * Stub: в Этапе 4 будет межпостовая навигация.
   * Здесь: клик по стрелкам в filmstrip Grok.
   */
  function navigateSlide() {
    const dir = Settings.get().dpadDir;
    blurActiveInput();

    // Ищем кнопки листания в filmstrip / carousel Grok
    let btn = null;
    if (dir === 'right' || dir === 'down') {
      btn = document.querySelector(
        'button[aria-label*="Next"], button[aria-label*="Следующ"], ' +
        'button[aria-label*="forward"], [data-testid*="next"]'
      );
    } else {
      btn = document.querySelector(
        'button[aria-label*="Prev"], button[aria-label*="Предыд"], ' +
        'button[aria-label*="back"], [data-testid*="prev"]'
      );
    }

    if (btn) {
      btn.click();
      return true;
    }

    // Fallback: Этап 4 заменит это межпостовой навигацией
    return false;
  }

  // ── executeResetToStart ───────────────────────

  /**
   * Разгон в противоположный конец пачки.
   * Жмёт стрелку в обратном направлении пока URL не перестаёт меняться.
   * callback() вызывается когда упёрлись в край.
   * Используется при входе в новый пост (режим A) и петле (режим R).
   */
  function executeResetToStart(callback) {
    const dir = Settings.get().dpadDir;
    const reverseDir = { right: 'left', left: 'right', down: 'up', up: 'down' }[dir] || 'left';
    const arrowKey = { right: 'ArrowRight', left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown' }[reverseDir];

    let lastUrl = location.href;
    let stuckCount = 0;
    const MAX_STUCK = 5;
    const INTERVAL = 300;

    function step() {
      const currentUrl = location.href;
      if (currentUrl === lastUrl) {
        stuckCount++;
      } else {
        stuckCount = 0;
        lastUrl = currentUrl;
      }

      if (stuckCount >= MAX_STUCK) {
        if (callback) callback();
        return;
      }

      // Клавишные события работают в Grok (v6.x проверено)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: arrowKey, code: arrowKey, bubbles: true, cancelable: true
      }));

      setTimeout(step, INTERVAL);
    }

    setTimeout(step, 100);
  }

  // ── Manual Mode ───────────────────────────────

  /**
   * Запускает шаг Manual-режима.
   * Если interval === 0 — переключает немедленно.
   */
  function manualStep() {
    const s = Settings.get();
    const interval = s.manualInterval * 1000;

    navigateSlide();

    // Авто-скачивание (если включено)
    if (s.downloadMode !== 'none') {
      setTimeout(() => autoDownloadIfNeeded(), 300);
    }

    // Авто-удаление
    if (s.autoDel) {
      setTimeout(() => actionDeletePub(), 500);
    }

    if (!State.slideshowRunning) return;
    SS.manualTimer = setTimeout(manualStep, interval);
  }

  function startManual() {
    clearTimeout(SS.manualTimer);
    const interval = Settings.get().manualInterval * 1000;
    if (interval === 0) {
      // 0 секунд — немедленно крутим
      SS.manualTimer = setTimeout(manualStep, 0);
    } else {
      SS.manualTimer = setTimeout(manualStep, interval);
    }
  }

  function stopManual() {
    clearTimeout(SS.manualTimer);
    SS.manualTimer = null;
  }

  // ── AUTO Mode ────────────────────────────────

  /**
   * Основной тик AUTO-режима (requestAnimationFrame loop).
   * Логика разделена на: видео-трекинг и фото-таймер.
   */
  function autoTick(ts) {
    if (!State.slideshowRunning) return;

    const s = Settings.get();
    const v = getCurrentVideo();

    if (v && isVideoReady()) {
      // ── ВИДЕО-режим ──────────────────────────
      const cur = v.currentTime;
      const dur = v.duration || 0;

      // Обновить табло: «круг/всего  текущее/длительность»
      const loopStr = s.autoLoops > 1 ? `${SS.currentLoop + 1}/${s.autoLoops} ` : '';
      updateTimerDisplay(`${loopStr}${fmtTime(cur)} / ${fmtTime(dur)}`);

      // Защита видеопотока (Хитрость 3 из ТЗ):
      // за 0.2с до конца — засчитываем круг
      if (dur > 0 && cur >= dur - 0.2) {
        SS.currentLoop++;

        if (SS.currentLoop < s.autoLoops) {
          // Ещё не все круги — перемотать и продолжить
          v.currentTime = 0;
          v.play().catch(() => {});
          SS._rafId = requestAnimationFrame(autoTick);
          return; // ← обязательный return (Хитрость 3)
        }

        // Все круги пройдены — начать countdown
        SS.currentLoop = 0;
        SS.inCountdown = true;
        SS.countdownStart = performance.now();
        SS._rafId = requestAnimationFrame(autoTick);
        return;
      }

      // Пауза 400мс защита: если cur близко к 0 — дать время
      if (cur < 0.1 && dur > 0) {
        setTimeout(() => {
          if (State.slideshowRunning)
            SS._rafId = requestAnimationFrame(autoTick);
        }, 400);
        return;
      }

    } else {
      // ── ФОТО-режим ───────────────────────────
      // Если не видео — считаем время как photoBaseSeconds * loops
      // По умолчанию: autoCountdown секунд на фото
      if (!SS.inCountdown) {
        SS.inCountdown = true;
        SS.countdownStart = performance.now();
      }
    }

    // ── Countdown после медиа ─────────────────
    if (SS.inCountdown) {
      const elapsed = (performance.now() - SS.countdownStart) / 1000;
      const target  = s.autoCountdown;
      const remain  = Math.max(0, target - elapsed);
      updateTimerDisplay(`⏱ ${fmtTime(remain)}`);

      if (elapsed >= target) {
        // Время вышло — переключить слайд
        SS.inCountdown = false;
        SS.currentLoop = 0;
        onAutoSlideEnd();
        return;
      }
    }

    SS._rafId = requestAnimationFrame(autoTick);
  }

  /**
   * Вызывается когда AUTO-режим решил переключить слайд.
   * Учитывает режим D-pad центра (—, R, A).
   */
  function onAutoSlideEnd() {
    const s = Settings.get();

    // Авто-скачивание
    if (s.downloadMode !== 'none') autoDownloadIfNeeded();
    // Авто-удаление
    if (s.autoDel) setTimeout(() => actionDeletePub(), 300);

    const center = s.dpadCenter;

    if (center === 'stop') {
      // — : остановка в конце пачки
      const moved = navigateSlide();
      if (!moved) {
        stopSlideshow('edge');
        return;
      }
    } else if (center === 'repeat') {
      // R : петля внутри поста — разгон в обратную сторону
      executeResetToStart(() => {
        if (State.slideshowRunning) {
          SS._rafId = requestAnimationFrame(autoTick);
        }
      });
      return;
    } else if (center === 'auto') {
      // A : межпостовая навигация через /imagine/saved
      const moved = navigateSlide();
      if (!moved) {
        // Упёрлись в край пачки — переходим на соседний пост
        stopSlideshow('inter-post-nav');
        interPostNavigate(() => {
          // После входа в новый пост — запускаем слайдшоу
          if (!State.slideshowRunning) startSlideshow();
        });
        return;
      }
    }

    if (State.slideshowRunning) {
      // Небольшая пауза после смены слайда
      setTimeout(() => {
        SS.inCountdown = false;
        SS.currentLoop = 0;
        SS._rafId = requestAnimationFrame(autoTick);
      }, 600);
    }
  }

  function startAuto() {
    if (SS._rafId) cancelAnimationFrame(SS._rafId);
    SS.inCountdown = false;
    SS.currentLoop = 0;
    SS._rafId = requestAnimationFrame(autoTick);
  }

  function stopAuto() {
    if (SS._rafId) { cancelAnimationFrame(SS._rafId); SS._rafId = null; }
    updateTimerDisplay('—');
  }

  // ─────────────────────────────────────────────
  //  INTER-POST NAVIGATION — Этап 4
  //  Навигация между постами через /imagine/saved
  // ─────────────────────────────────────────────

  /**
   * Извлечь conversation ID из текущего URL.
   * Варианты:
   *   - /imagine/post/<convId>?...
   *   - /imagine/post/<convId>/<mediaId>
   *   - ?conversation=<convId>
   */
  function getConversationId() {
    // Сначала пробуем параметр conversation=...
    const params = new URLSearchParams(location.search);
    if (params.has('conversation')) return params.get('conversation');

    // Тогда извлекаем из pathname: /imagine/post/<ID>[/<mediaId>]
    const match = location.pathname.match(/\/imagine\/post\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  /**
   * Получить массив карточек постов с /imagine/saved.
   * Опрос DOM каждые 150мс, максимум 9 сек.
   * Возвращает массив href-строк через callback(urls) или callback(null) при timeout.
   */
  function pollSavedCards(callback) {
    const INTERVAL  = 150;  // мс
    const TIMEOUT   = 9000; // мс
    const started   = Date.now();

    function poll() {
      const cards = Array.from(document.querySelectorAll(SEL.savedCards));
      if (cards.length > 0) {
        callback(cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean));
        return;
      }
      if (Date.now() - started >= TIMEOUT) {
        console.warn('[GrokSS] pollSavedCards: timeout — no cards found');
        callback(null);
        return;
      }
      setTimeout(poll, INTERVAL);
    }

    poll();
  }

  /**
   * Найти соседний пост в списке cards.
   * currentId — conversation ID текущего поста.
   * dir — направление (right/down = следующий, иначе предыдущий).
   * Возвращает href-строку или null если не найден.
   */
  function findNeighborPost(cards, currentId, dir) {
    // Извлекаем conversation ID из каждого href
    function idFromUrl(url) {
      const m = url.match(/\/imagine\/post\/([^/?#]+)/);
      return m ? m[1] : null;
    }

    // Дедуплицируем: берём только уникальные и сохраняем первый url каждого ID
    const seen = new Map();
    for (const url of cards) {
      const id = idFromUrl(url);
      if (id && !seen.has(id)) seen.set(id, url);
    }
    const unique = Array.from(seen.keys());

    // Находим текущий индекс
    const idx = unique.indexOf(currentId);

    let targetId = null;
    if (dir === 'right' || dir === 'down') {
      // Следующий post (indexOf + 1)
      if (idx >= 0 && idx < unique.length - 1) {
        targetId = unique[idx + 1];
      } else if (idx < 0 && unique.length > 0) {
        // Текущего нет в списке — берём первый
        targetId = unique[0];
      }
    } else {
      // Предыдущий post
      if (idx > 0) {
        targetId = unique[idx - 1];
      } else if (idx < 0 && unique.length > 0) {
        targetId = unique[unique.length - 1];
      }
    }

    return targetId ? seen.get(targetId) : null;
  }

  /**
   * Действия после входа в новый пост (режим A и режим R):
   * 1. blurActiveInput()
   * 2. Пауза 2 сек (DOM должен отрендерить)
   * 3. executeResetToStart(разгон в начало пачки)
   * 4. В callback: callback() (запуск слайдшоу)
   */
  function onNewPostEntry(callback) {
    blurActiveInput();
    updateTimerDisplay('⏳');

    // Пауза 2 сек пока DOM отрендерится
    setTimeout(() => {
      executeResetToStart(() => {
        if (callback) callback();
      });
    }, 2000);
  }

  /**
   * Основная функция межпостовой навигации.
   *
   * 1. Запоминаем текущий conversation ID
   * 2. Переходим на /imagine/saved через location.href
   * 3. Поллинг карточек (150мс, макс 9с)
   * 4. Находим соседний пост с ДРУГИМ conversation ID
   * 5. Переход через location.href (НЕ .click())
   * 6. onNewPostEntry() → разгон → callback()
   */
  function interPostNavigate(callback) {
    const currentId = getConversationId();
    const dir = Settings.get().dpadDir;

    console.log(`[GrokSS] interPostNavigate: currentId=${currentId} dir=${dir}`);

    // Переходим на /imagine/saved
    location.href = 'https://grok.com/imagine/saved';

    // Ждём загрузки страницы и поллинга карточек
    pollSavedCards((urls) => {
      if (!urls) {
        console.warn('[GrokSS] interPostNavigate: no cards, stopping');
        return;
      }

      const targetUrl = findNeighborPost(urls, currentId, dir);

      if (!targetUrl) {
        console.warn('[GrokSS] interPostNavigate: no neighbor found, stopping');
        return;
      }

      console.log(`[GrokSS] interPostNavigate: navigating to ${targetUrl}`);

      // Переход через location.href (не через .click()!)
      location.href = targetUrl.startsWith('http')
        ? targetUrl
        : `https://grok.com${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

      // После перехода — onNewPostEntry вызовется через visibilitychange/load
      // запускаем через setTimeout (страница уже начнёт загружаться)
      setTimeout(() => onNewPostEntry(callback), 500);
    });
  }

  /**
   * Ручная межпостовая навигация D-pad (клавиши влево/вправо).
   * Запускается из keydown-обработчика (Этап 4).
   * Сначала пробуем navigateSlide(), при неудаче — interPostNavigate().
   */
  function manualInterPostStep(dir) {
    blurActiveInput();
    // Переопределяем направление D-pad временно
    const origDir = Settings.get().dpadDir;
    // Читаем режим центра
    const center = Settings.get().dpadCenter;
    if (center !== 'auto') {
      // В режиме — или R — просто переключаем слайд
      navigateSlide();
      return;
    }
    const moved = navigateSlide();
    if (!moved) {
      interPostNavigate(() => {});
    }
  }

  // ── Подключаем стрелки D-pad к межпостовой навигации

  /**
   * NumPad/стрелки: ручная навигация без запущенного слайдшоу.
   * Если слайдшоу запущен — стрелки игнорируются (слайдшоу управляет навигацией).
   * Обрабатывает ArrowКлавиши и Numpad (хоткей hk.dpad* из Settings).
   */
  document.addEventListener('keydown', (e) => {
    if (State.slideshowRunning) return;    // слайдшоу сам управляет
    if (State.recordingHotkey) return;
    const ae = document.activeElement;
    const inInput = ae && (
      ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' ||
      ae.getAttribute('contenteditable') === 'true' || ae.isContentEditable
    );
    if (inInput) return;

    const hk = Settings.get().hk;

    // D-pad навигация: NumPad8/2/4/6 и ArrowKeys
    const navMap = {
      'ArrowRight': 'right', 'Numpad6': 'right', '6': 'right',
      'ArrowLeft':  'left',  'Numpad4': 'left',  '4': 'left',
      'ArrowDown':  'down',  'Numpad2': 'down',  '2': 'down',
      'ArrowUp':    'up',    'Numpad8': 'up',    '8': 'up',
    };
    const mappedDir = navMap[e.key];
    if (mappedDir) {
      e.preventDefault();
      manualInterPostStep(mappedDir);
      return;
    }

    // Rewind: NumPad5 или '5'
    if (e.key === '5' || e.key === 'Numpad5') {
      e.preventDefault();
      rewindToStart();
      return;
    }
  }, true);

  // ── Авто─скачивание ───────────────────────────

  function autoDownloadIfNeeded() {
    const mode = Settings.get().downloadMode;
    if (mode === 'none') return;
    const v = getCurrentVideo();
    const hasVideo = !!(v && v.src);
    if (mode === 'video' && !hasVideo) return;
    if (mode === 'photo' && hasVideo) return;
    // mode === 'all' || (mode === 'video' && hasVideo) || (mode === 'photo' && !hasVideo)
    actionDownload();
  }

  // ── Публичное API слайдшоу ───────────────────

  /**
   * Запустить слайдшоу в текущем режиме (manual/auto).
   */
  function startSlideshow() {
    if (State.slideshowRunning) return;
    State.slideshowRunning = true;
    updateSlideshowUI(true);

    const mode = Settings.get().slideshowMode;
    if (mode === 'auto') {
      startAuto();
    } else {
      startManual();
    }
  }

  /**
   * Остановить слайдшоу.
   * @param {string} reason — причина остановки (для отладки)
   */
  function stopSlideshow(reason = 'user') {
    State.slideshowRunning = false;
    stopManual();
    stopAuto();
    updateSlideshowUI(false);
    updateTimerDisplay('—');
    console.log(`[GrokSS] Slideshow stopped: ${reason}`);
  }

  /**
   * Обновить визуальные индикаторы запущенного слайдшоу в виджете.
   */
  function updateSlideshowUI(running) {
    // Кнопки Manual/AUTO светятся ярче когда запущено
    const btnManual = document.getElementById('grok-mode-manual');
    const btnAuto   = document.getElementById('grok-mode-auto');
    const mode = Settings.get().slideshowMode;

    if (btnManual) btnManual.classList.toggle('active', mode === 'manual');
    if (btnAuto)   btnAuto.classList.toggle('active',   mode === 'auto');

    // Добавляем пульсирующую рамку виджету пока запущено
    const widget = document.getElementById(WIDGET_ID);
    if (widget) widget.classList.toggle('ss-running', running);
  }

  // ── CSS для состояния running ─────────────────
  GM_addStyle(`
    #${WIDGET_ID}.ss-running {
      box-shadow:
        0 8px 32px rgba(0,0,0,0.55),
        0 0 0 2px rgba(34,197,94,0.6),
        0 0 12px rgba(34,197,94,0.25);
    }
    #${WIDGET_ID}.ss-running #grok-header-title::after {
      content: ' ●';
      color: #22c55e;
      font-size: 8px;
      vertical-align: super;
      animation: ss-blink 1s ease infinite alternate;
    }
    @keyframes ss-blink {
      from { opacity: 1; }
      to   { opacity: 0.3; }
    }
  `);

  // ── ↺ Кнопка ручной отмотки ──────────────────

  /**
   * Мгновенная ручная отмотка в начало пачки текущего поста.
   * Реализация executeResetToStart без callback.
   */
  function rewindToStart() {
    blurActiveInput();
    const wasRunning = State.slideshowRunning;
    if (wasRunning) stopSlideshow('rewind');

    executeResetToStart(() => {
      if (wasRunning) startSlideshow();
    });
  }

  // ─────────────────────────────────────────────
  //  DOWNLOAD ENGINE — Этап 5
  // ─────────────────────────────────────────────

  /**
   * Проверить: url относится к доверенному CDN Grok.
   */
  function isGrokCDN(src) {
    if (!src) return false;
    return SEL.mediaCDN.some(host => src.includes(host));
  }

  /**
   * Получить URL для скачивания текущего медиа.
   * Приоритет: video[src] → main img[src] → любой img[src] с CDN.
   */
  function getMediaDownloadUrl() {
    // 1. Видео
    const v = document.querySelector('main video[src]') || document.querySelector('video[src]');
    if (v && v.src && isGrokCDN(v.src)) return { url: v.src, type: 'video' };

    // 2. Основное фото в main (biggest by area)
    const imgs = Array.from(document.querySelectorAll('main img[src], div[role="dialog"] img[src]'));
    const cdnImgs = imgs
      .filter(img => isGrokCDN(img.src || img.currentSrc))
      .filter(img => {
        const alt = (img.alt || '').toLowerCase();
        return alt !== 'pfp' && !alt.includes('profile') && !alt.includes('most recent');
      })
      .map(img => ({ img, area: img.naturalWidth * img.naturalHeight || img.width * img.height }))
      .sort((a, b) => b.area - a.area);

    if (cdnImgs.length > 0) return { url: cdnImgs[0].img.src, type: 'photo' };

    return null;
  }

  /**
   * Сборка имени файла для скачивания.
   * Формат: grok_<timestamp>_<id>.<ext>
   */
  function buildDownloadFilename(url, type) {
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const ts  = Date.now();
    // Извлекаем conversation ID если есть
    const convId = getConversationId() || 'unknown';
    return `grok_${convId}_${ts}.${ext}`;
  }

  /**
   * Скачать текущее медиа:
   * 1. Ищем URL через getMediaDownloadUrl()
   * 2. Если нашли — GM_download
   * 3. Fallback: клик кнопки Download при нажатии на 3ю кнопку мыши (если GM_download не работает)
   */
  function downloadCurrentMedia() {
    const media = getMediaDownloadUrl();

    if (media) {
      const filename = buildDownloadFilename(media.url, media.type);
      console.log(`[GrokSS] Downloading: ${filename}`);
      try {
        GM_download({
          url:      media.url,
          name:     filename,
          saveAs:   false,
          onerror:  (err) => {
            console.warn('[GrokSS] GM_download failed, fallback click:', err);
            clickBtn(SEL.btnDownload);
          }
        });
      } catch (e) {
        console.warn('[GrokSS] GM_download exception, fallback:', e);
        clickBtn(SEL.btnDownload);
      }
      return;
    }

    // Fallback: нет URL через DOM — кликаем кнопку
    clickBtn(SEL.btnDownload);
  }

  // ─────────────────────────────────────────────
  //  DELETE ENGINE — Этап 5
  //  hold post + a.confirm
  // ─────────────────────────────────────────────

  /**
   * Найти URL соседнего поста для hold post.
   * Ищем карточки в SEL.savedCards — если не на /saved —
   * запоминаем URL соседа через history API Grok.
   */
  function getNeighborPostUrl() {
    const currentId = getConversationId();
    if (!currentId) return null;

    // Ищем ссылки на соседние посты в текущем DOM
    const cards = Array.from(document.querySelectorAll(SEL.savedCards));
    if (cards.length === 0) return null;

    const urls  = cards.map(c => c.href || c.getAttribute('href') || '').filter(Boolean);
    const dir   = Settings.get().dpadDir;

    // Используем findNeighborPost — он уже умеет дедуплицировать
    return findNeighborPost(urls, currentId, dir);
  }

  /**
   * Найти кнопку подтверждения удаления в модалом.
   * Ищем button с текстом Delete / Удалить / OK внутри [role="dialog"].
   */
  function findConfirmDeleteBtn() {
    const dialog = document.querySelector(SEL.modalDialog);
    if (!dialog) return null;

    const btns = Array.from(dialog.querySelectorAll('button'));
    const keywords = ['delete', 'удалить', 'confirm', 'ok', 'yes', 'да'];
    return btns.find(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();
      return keywords.some(k => txt.includes(k));
    }) || null;
  }

  /**
   * Полный флоу удаления с hold post + a.confirm:
   *
   * 0. Если hold post включён — запоминаем URL соседа
   * 1. Клик кнопки Delete
   * 2. Ждём появления модала (300мс)
   * 3. Если a.confirm — кликаем подтверждение
   * 4. Если hold post — ждём 800мс и переходим на сохранённый URL
   */
  function deleteCurrentPost() {
    const s = Settings.get();
    blurActiveInput();

    // Шаг 0: запоминаем соседа ДО клика
    const neighborUrl = s.holdPost ? getNeighborPostUrl() : null;

    // Шаг 1: клик Delete
    const deleted = clickBtn(SEL.btnDelete);
    if (!deleted) {
      console.warn('[GrokSS] deleteCurrentPost: Delete button not found');
      return;
    }

    // Шаг 2-3: ждём модал и кликаем a.confirm
    setTimeout(() => {
      if (s.autoConfirm) {
        const confirmBtn = findConfirmDeleteBtn();
        if (confirmBtn) {
          confirmBtn.click();
          console.log('[GrokSS] deleteCurrentPost: confirmed');
        }
      }

      // Шаг 4: hold post — переходим на сохранённый URL
      if (neighborUrl) {
        setTimeout(() => {
          console.log(`[GrokSS] hold post: navigating to ${neighborUrl}`);
          location.href = neighborUrl.startsWith('http')
            ? neighborUrl
            : `https://grok.com${neighborUrl.startsWith('/') ? '' : '/'}${neighborUrl}`;
        }, 800);
      }
    }, 300);
  }



  // ─────────────────────────────────────────────
  //  REDGIFS MODULE (Дополнительный модуль для redgifs.com)
  // ─────────────────────────────────────────────

  const REDGIFS_STORAGE_KEY = 'redgifsSS_settings';
  const REDGIFS_WIDGET_ID   = 'redgifs-ss-widget';

  const RedGifsSettings = {
    defaults: {
      autoCountdown: 1,  // секунд после завершения медиа (выдержка)
      autoLoops: 1,      // кругов повтора видео
      direction: 'down', // 'down' (вниз) или 'up' (вверх)
      panelState: 'full' // 'full', 'mini', 'hidden'
    },
    get() {
      try {
        const raw = GM_getValue(REDGIFS_STORAGE_KEY);
        return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
      } catch (e) {
        return { ...this.defaults };
      }
    },
    set(key, val) {
      const curr = this.get();
      curr[key] = val;
      GM_setValue(REDGIFS_STORAGE_KEY, JSON.stringify(curr));
    }
  };

  const RedGifsState = {
    slideshowRunning: false,
    currentLoop: 0,
    inCountdown: false,
    countdownStart: 0,
    _rafId: null,
    _panelState: 'full'
  };

  function getActiveRedGifsItem() {
    return document.querySelector('.GifPreview_isActive')
        || document.querySelector('.GifPreview')
        || document.querySelector('[data-feed-item-id]');
  }

  function getRedGifsVideo() {
    const active = getActiveRedGifsItem();
    if (active) {
      const v = active.querySelector('video');
      if (v) return v;
    }
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    let bestVideo = null;
    let maxVisibleHeight = 0;
    const vh = window.innerHeight;

    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        bestVideo = v;
      }
    }
    return bestVideo || videos[0];
  }

  function redGifsNavigate(dir) {
    const active = getActiveRedGifsItem();
    if (active) {
      const target = dir === 'up' ? active.previousElementSibling : active.nextElementSibling;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const clickTarget = target.querySelector('.TapTracker, video, img') || target;
        clickTarget.click();
        return;
      }
    }

    const key = dir === 'up' ? 'ArrowUp' : 'ArrowDown';
    const keyCode = dir === 'up' ? 38 : 40;

    document.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode, bubbles: true, cancelable: true }));

    setTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, keyCode, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, keyCode, bubbles: true, cancelable: true }));
    }, 50);

    const scrollAmount = dir === 'up' ? -window.innerHeight * 0.85 : window.innerHeight * 0.85;
    window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
  }

  function redGifsAutoTick() {
    if (!RedGifsState.slideshowRunning) return;

    const s = RedGifsSettings.get();
    const v = getRedGifsVideo();

    if (v && v.src && !v.paused && v.duration > 0) {
      const cur = v.currentTime;
      const dur = v.duration;

      const loopStr = s.autoLoops > 1 ? `${RedGifsState.currentLoop + 1}/${s.autoLoops} ` : '';
      updateRedGifsTimerDisplay(`${loopStr}${fmtTime(cur)} / ${fmtTime(dur)}`);

      if (cur >= dur - 0.2) {
        RedGifsState.currentLoop++;

        if (RedGifsState.currentLoop < s.autoLoops) {
          v.currentTime = 0;
          v.play().catch(() => {});
          RedGifsState._rafId = requestAnimationFrame(redGifsAutoTick);
          return;
        }

        RedGifsState.currentLoop = 0;
        RedGifsState.inCountdown = true;
        RedGifsState.countdownStart = performance.now();
        RedGifsState._rafId = requestAnimationFrame(redGifsAutoTick);
        return;
      }
    } else {
      if (!RedGifsState.inCountdown) {
        RedGifsState.inCountdown = true;
        RedGifsState.countdownStart = performance.now();
      }
    }

    if (RedGifsState.inCountdown) {
      const elapsed = (performance.now() - RedGifsState.countdownStart) / 1000;
      const target  = s.autoCountdown;
      const remain  = Math.max(0, target - elapsed);
      updateRedGifsTimerDisplay(`⏱ ${fmtTime(remain)}`);

      if (elapsed >= target) {
        RedGifsState.inCountdown = false;
        RedGifsState.currentLoop = 0;

        redGifsNavigate(s.direction);

        setTimeout(() => {
          if (RedGifsState.slideshowRunning) {
            RedGifsState._rafId = requestAnimationFrame(redGifsAutoTick);
          }
        }, 1000);
        return;
      }
    }

    RedGifsState._rafId = requestAnimationFrame(redGifsAutoTick);
  }

  function startRedGifsSlideshow() {
    if (RedGifsState.slideshowRunning) return;
    RedGifsState.slideshowRunning = true;
    RedGifsState.inCountdown = false;
    RedGifsState.currentLoop = 0;
    updateRedGifsUI(true);
    RedGifsState._rafId = requestAnimationFrame(redGifsAutoTick);
  }

  function stopRedGifsSlideshow() {
    RedGifsState.slideshowRunning = false;
    if (RedGifsState._rafId) {
      cancelAnimationFrame(RedGifsState._rafId);
      RedGifsState._rafId = null;
    }
    updateRedGifsUI(false);
    updateRedGifsTimerDisplay('—');
  }

  function toggleRedGifsSlideshow() {
    if (RedGifsState.slideshowRunning) {
      stopRedGifsSlideshow();
    } else {
      startRedGifsSlideshow();
    }
  }

  function getRedGifsDownloadUrls() {
    const active = getActiveRedGifsItem();
    const urls = [];
    const itemId = active ? active.getAttribute('data-feed-item-id') : null;

    // 1. Из картинки poster в DOM (media.redgifs.com -> MP4)
    if (active) {
      const poster = active.querySelector('img.Player-Poster, img[src*="media.redgifs.com"]');
      if (poster && poster.src) {
        const mp4Hd = poster.src.replace(/-mobile\.(jpg|png|jpeg)/i, '.mp4').replace(/\.(jpg|png|jpeg)/i, '.mp4');
        const mp4Sd = poster.src.replace(/\.(jpg|png|jpeg)/i, '-mobile.mp4');
        urls.push(mp4Hd, mp4Sd);
      }
    }

    // 2. Из тэга video src
    const v = getRedGifsVideo();
    if (v) {
      const src = v.currentSrc || v.src || v.querySelector('source')?.src;
      if (src && !urls.includes(src)) urls.push(src);
    }

    // 3. Из data-feed-item-id
    if (itemId) {
      const capId = itemId.charAt(0).toUpperCase() + itemId.slice(1);
      urls.push(`https://media.redgifs.com/${capId}.mp4`);
      urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/hd.m3u8`);
      urls.push(`https://api.redgifs.com/v2/gifs/${itemId}/sd.m3u8`);
    }

    return { itemId: itemId || 'video', urls: Array.from(new Set(urls.filter(Boolean))) };
  }

  function getRedGifsTitleFilename(itemId) {
    let rawTitle = (document.title || '').trim();

    // Очистим кавычки по краям
    if (rawTitle.startsWith('"') && rawTitle.endsWith('"')) {
      rawTitle = rawTitle.slice(1, -1).trim();
    }

    if (rawTitle) {
      // Заменяем запрещённые символы файловой системы Windows/OS (\ / : * ? " < > |) на безопасные
      const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
      if (safeTitle.length > 0) {
        return `${safeTitle}.mp4`;
      }
    }

    return `redgifs_${itemId}_${Date.now()}.mp4`;
  }

  function triggerDirectBlobDownload(targetUrl, filename) {
    console.log(`[RedGifsSS] Fetching blob for "${filename}": ${targetUrl}`);

    GM_xmlhttpRequest({
      method: 'GET',
      url: targetUrl,
      responseType: 'blob',
      onload: function(res) {
        if ((res.status === 200 || res.status === 0) && res.response) {
          const blob = res.response;
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }, 10000);
          console.log(`[RedGifsSS] Blob download triggered successfully as "${filename}"`);
        } else {
          console.warn('[RedGifsSS] GM_xmlhttpRequest failed, fallback GM_download:', res.status);
          GM_download({ url: targetUrl, name: filename, saveAs: false });
        }
      },
      onerror: function(err) {
        console.warn('[RedGifsSS] GM_xmlhttpRequest error, fallback GM_download:', err);
        GM_download({ url: targetUrl, name: filename, saveAs: false });
      }
    });
  }

  function downloadRedGifsVideo() {
    const { itemId, urls } = getRedGifsDownloadUrls();

    if (urls.length === 0) {
      console.warn('[RedGifsSS] No download URL found.');
      return;
    }

    const filename = getRedGifsTitleFilename(itemId);
    let attemptedIndex = 0;

    function tryNext() {
      if (attemptedIndex >= urls.length) {
        console.warn('[RedGifsSS] All download URLs failed.');
        window.open(urls[0], '_blank');
        return;
      }

      const targetUrl = urls[attemptedIndex++];
      console.log(`[RedGifsSS] Downloading (${attemptedIndex}/${urls.length}) as "${filename}": ${targetUrl}`);

      if (targetUrl.endsWith('.m3u8')) {
        GM_download({
          url: targetUrl,
          name: filename.replace(/\.mp4$/i, '.m3u8'),
          saveAs: false,
          onerror: () => tryNext()
        });
      } else {
        triggerDirectBlobDownload(targetUrl, filename);
      }
    }

    tryNext();
  }

  function updateRedGifsTimerDisplay(text) {
    const el = document.getElementById('redgifs-auto-timer');
    if (el) el.textContent = text;
  }

  function updateRedGifsUI(running) {
    const widget = document.getElementById(REDGIFS_WIDGET_ID);
    const startBtn = document.getElementById('redgifs-btn-start');
    if (widget) widget.classList.toggle('ss-running', running);
    if (startBtn) {
      startBtn.textContent = running ? '⏸ Stop' : '▶ Start';
      startBtn.classList.toggle('active', running);
    }
  }

  function applyRedGifsPanelState(state) {
    RedGifsState._panelState = state;
    RedGifsSettings.set('panelState', state);
    const widget = document.getElementById(REDGIFS_WIDGET_ID);
    const body   = document.getElementById('redgifs-widget-body');
    if (!widget) return;
    if (state === 'hidden') {
      widget.style.display = 'none';
    } else {
      widget.style.display = '';
      if (body) body.style.display = state === 'full' ? '' : 'none';
    }
  }

  function buildRedGifsWidget() {
    const s = RedGifsSettings.get();

    GM_addStyle(`
      #${REDGIFS_WIDGET_ID} {
        position: fixed;
        top: 50px;
        right: 20px;
        z-index: 999999;
        width: 210px;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f3f4f6;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        user-select: none;
      }
      #${REDGIFS_WIDGET_ID}.ss-running {
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 2px rgba(34,197,94,0.6);
      }
      #redgifs-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-weight: 700;
        font-size: 13px;
        margin-bottom: 8px;
        cursor: pointer;
      }
      #redgifs-widget-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .rg-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
      }
      .rg-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e5e7eb;
        border-radius: 6px;
        padding: 3px 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.15s ease;
      }
      .rg-btn:hover {
        background: rgba(255, 255, 255, 0.18);
      }
      .rg-btn.active {
        background: rgba(34, 197, 94, 0.2);
        border-color: #22c55e;
        color: #22c55e;
      }
      .rg-dir-btn {
        flex: 1;
        text-align: center;
        margin: 0 2px;
      }
      #redgifs-auto-timer {
        text-align: center;
        font-family: monospace;
        font-size: 13px;
        color: #38bdf8;
        background: rgba(0,0,0,0.3);
        padding: 4px;
        border-radius: 6px;
        margin-top: 2px;
      }
      #redgifs-btn-start, #redgifs-btn-dl {
        width: 100%;
        padding: 6px;
        font-size: 12px;
      }
      #redgifs-btn-dl {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.4);
        color: #60a5fa;
      }
      #redgifs-btn-dl:hover {
        background: rgba(59, 130, 246, 0.3);
      }
    `);

    const widget = el('div', { id: REDGIFS_WIDGET_ID });

    // Header
    const header = el('div', { id: 'redgifs-header-bar' });
    const title  = el('span', {}, 'RedGifs Auto v2.1.4');
    const controls = el('div', { style: { display: 'flex', gap: '6px' } });
    const btnMini  = el('span', { style: { cursor: 'pointer', opacity: 0.7 } }, '_');
    const btnClose = el('span', { style: { cursor: 'pointer', opacity: 0.7 } }, '×');

    controls.appendChild(btnMini);
    controls.appendChild(btnClose);
    header.appendChild(title);
    header.appendChild(controls);
    widget.appendChild(header);

    btnMini.addEventListener('click', (e) => {
      e.stopPropagation();
      applyRedGifsPanelState(RedGifsState._panelState === 'full' ? 'mini' : 'full');
    });
    title.addEventListener('click', () => {
      applyRedGifsPanelState(RedGifsState._panelState === 'full' ? 'mini' : 'full');
    });
    btnClose.addEventListener('click', (e) => {
      e.stopPropagation();
      applyRedGifsPanelState('hidden');
    });

    // Body
    const body = el('div', { id: 'redgifs-widget-body' });

    // Countdown row: - 01c +
    const cdRow = el('div', { class: 'rg-row' });
    const cdLabel = el('span', {}, 'Задержка:');
    const cdCtrl  = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } });
    const cdMinus = el('button', { class: 'rg-btn' }, '−');
    const cdDisp  = el('span', { id: 'redgifs-cd-disp', style: { width: '28px', textAlign: 'center', fontWeight: 'bold' } }, `${String(s.autoCountdown).padStart(2,'0')}с`);
    const cdPlus  = el('button', { class: 'rg-btn' }, '+');
    cdCtrl.appendChild(cdMinus);
    cdCtrl.appendChild(cdDisp);
    cdCtrl.appendChild(cdPlus);
    cdRow.appendChild(cdLabel);
    cdRow.appendChild(cdCtrl);

    cdMinus.addEventListener('click', () => {
      const val = Math.max(0, RedGifsSettings.get().autoCountdown - 1);
      RedGifsSettings.set('autoCountdown', val);
      cdDisp.textContent = `${String(val).padStart(2,'0')}с`;
    });
    cdPlus.addEventListener('click', () => {
      const val = RedGifsSettings.get().autoCountdown + 1;
      RedGifsSettings.set('autoCountdown', val);
      cdDisp.textContent = `${String(val).padStart(2,'0')}с`;
    });

    // Loops row: ÷ 1x ×
    const lpRow = el('div', { class: 'rg-row' });
    const lpLabel = el('span', {}, 'Кругов:');
    const lpCtrl  = el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } });
    const lpMinus = el('button', { class: 'rg-btn' }, '÷');
    const lpDisp  = el('span', { id: 'redgifs-lp-disp', style: { width: '28px', textAlign: 'center', fontWeight: 'bold' } }, `${s.autoLoops}x`);
    const lpPlus  = el('button', { class: 'rg-btn' }, '×');
    lpCtrl.appendChild(lpMinus);
    lpCtrl.appendChild(lpDisp);
    lpCtrl.appendChild(lpPlus);
    lpRow.appendChild(lpLabel);
    lpRow.appendChild(lpCtrl);

    lpMinus.addEventListener('click', () => {
      const val = Math.max(1, RedGifsSettings.get().autoLoops - 1);
      RedGifsSettings.set('autoLoops', val);
      lpDisp.textContent = `${val}x`;
    });
    lpPlus.addEventListener('click', () => {
      const val = RedGifsSettings.get().autoLoops + 1;
      RedGifsSettings.set('autoLoops', val);
      lpDisp.textContent = `${val}x`;
    });

    // Direction row: ▲ Up | ▼ Down
    const dirRow = el('div', { class: 'rg-row', style: { marginTop: '2px' } });
    const btnUp   = el('button', { class: `rg-btn rg-dir-btn${s.direction === 'up' ? ' active' : ''}` }, '▲ Up');
    const btnDown = el('button', { class: `rg-btn rg-dir-btn${s.direction === 'down' ? ' active' : ''}` }, '▼ Down');

    btnUp.addEventListener('click', () => {
      RedGifsSettings.set('direction', 'up');
      btnUp.classList.add('active');
      btnDown.classList.remove('active');
    });
    btnDown.addEventListener('click', () => {
      RedGifsSettings.set('direction', 'down');
      btnDown.classList.add('active');
      btnUp.classList.remove('active');
    });

    dirRow.appendChild(btnUp);
    dirRow.appendChild(btnDown);

    // Timer display
    const timerDisp = el('div', { id: 'redgifs-auto-timer' }, '—');

    // Start/Stop & Download buttons
    const btnStart = el('button', { id: 'redgifs-btn-start', class: 'rg-btn' }, '▶ Start');
    btnStart.addEventListener('click', () => toggleRedGifsSlideshow());

    const btnDl = el('button', { id: 'redgifs-btn-dl', class: 'rg-btn' }, '⬇ Скачать (PgDown)');
    btnDl.addEventListener('click', () => downloadRedGifsVideo());

    body.appendChild(cdRow);
    body.appendChild(lpRow);
    body.appendChild(dirRow);
    body.appendChild(timerDisp);
    body.appendChild(btnStart);
    body.appendChild(btnDl);

    widget.appendChild(body);
    document.body.appendChild(widget);

    applyRedGifsPanelState(s.panelState || 'full');
  }

  function bindRedGifsHotkeys() {
    document.addEventListener('keydown', (e) => {
      const ae = document.activeElement;
      const inInput = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      if (inInput) return;

      if (e.key === 'Insert' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggleRedGifsSlideshow();
      } else if (e.key === 'Insert' && e.ctrlKey) {
        e.preventDefault();
        applyRedGifsPanelState(RedGifsState._panelState === 'hidden' ? 'full' : 'hidden');
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        downloadRedGifsVideo();
      }
    }, true);
  }

  function initRedGifs() {
    buildRedGifsWidget();
    bindRedGifsHotkeys();
    console.log('[RedGifsSS] Initialized on redgifs.com');
  }

  const IS_REDGIFS = location.hostname.includes('redgifs.com');

  function init() {
    if (IS_REDGIFS) {
      initRedGifs();
      return;
    }
    Settings.initSession(); // reset downloadMode to 'none'
    buildWidget();
    buildModal();
    // Восстановить состояние панели из Storage
    const saved = Settings.get().panelState || 'full';
    _panelState = saved;
    applyPanelState(saved);
  }

  // Wait for body
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
