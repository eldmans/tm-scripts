// ==UserScript==
// @name         SimpleLink
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Открывает страницу истории сохраненных в новой вкладке по нажатию клавиши Home на любом сайте.
// @author       eldmans
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Home') {
            window.open('https://grok.com/imagine/saved', '_blank');
        }
    });
})();
