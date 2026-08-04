// ==UserScript==
// @name         NoodleMagazine - Hide Join Now & Expand Video
// @namespace    https://github.com/eldmans/tm-scripts
// @version      1.2
// @description  Убирает рекламную кнопку Join Now / боковую панель и расширяет видеоплеер на 100% ширины на hot.noodlemagazine.com
// @author       eldmans
// @match        *://hot.noodlemagazine.com/*
// @match        *://*.noodlemagazine.com/*
// @match        *://noodlemagazine.com/*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/eldmans/tm-scripts/grok/noodle_hide_join_now.user.js
// @downloadURL  https://raw.githubusercontent.com/eldmans/tm-scripts/grok/noodle_hide_join_now.user.js
// @supportURL   https://github.com/eldmans/tm-scripts
// ==/UserScript==

(function () {
    'use strict';

    const css = `
        /* 1. Скрываем боковую панель с кнопкой "Join Now" и рекламные блоки */
        .c_video > div[data-noscript],
        .c_video > div:not(.video_player),
        .fh-button,
        a[href*="faphouse.com"],
        a[href*="join"],
        .join-now,
        div:has(> a[href*="faphouse"]) {
            display: none !important;
            visibility: hidden !important;
            width: 0 !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

        /* 2. Растягиваем родительский контейнер на 100% ширины */
        .c_video {
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            height: auto !important;
            flex: 1 1 100% !important;
        }

        /* 3. Фиксируем пропорции видеоплеера (16:9), чтобы высота не схлопывалась */
        .c_video > .video_player {
            width: 100% !important;
            max-width: 100% !important;
            aspect-ratio: 16 / 9 !important;
            height: auto !important;
            min-height: 420px !important;
            margin: 0 auto !important;
        }

        /* 4. Внутренний контейнер плеера и iframe/video заполняют всю область */
        .c_video .player_wrap,
        .c_video .video_player iframe,
        .c_video .video_player video,
        .c_video .video_player #player,
        .c_video .video_player .plyr {
            width: 100% !important;
            height: 100% !important;
            min-height: 100% !important;
            padding-bottom: 0 !important;
        }
    `;

    function injectStyles() {
        if (document.head || document.documentElement) {
            let style = document.getElementById('hide-join-now-styles');
            if (!style) {
                style = document.createElement('style');
                style.id = 'hide-join-now-styles';
                (document.head || document.documentElement).appendChild(style);
            }
            style.textContent = css;
        }
    }

    function cleanupJoinNow() {
        const targets = document.querySelectorAll('.fh-button, a[href*="faphouse.com"], .c_video > div[data-noscript]');
        targets.forEach(el => {
            if (el.style.display !== 'none') {
                el.style.setProperty('display', 'none', 'important');
                el.remove();
            }
        });
    }

    injectStyles();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            cleanupJoinNow();
        });
    } else {
        cleanupJoinNow();
    }

    const observer = new MutationObserver(() => cleanupJoinNow());
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    setInterval(cleanupJoinNow, 500);
})();
