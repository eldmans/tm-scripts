// ==UserScript==
// @name         SimpleLink
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Открывает страницу истории сохранённых в новой вкладке по нажатию End.
// @author       eldmans
// @match        *://grok.com/*
// @match        *://*.grok.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', function(e) {
        if (e.key === 'End') {
            // Проверяем, не пишет ли пользователь в текстовом поле
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.isContentEditable
            );
            if (isEditing) return;

            e.preventDefault();
            window.open('https://grok.com/imagine/saved', '_blank');
        }
    });
})();
