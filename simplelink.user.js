// ==UserScript==
// @name         SimpleLink
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Открывает страницу истории сохраненных в фоновой вкладке по нажатию клавиши Home на любом сайте.
// @author       eldmans
// @match        *://*/*
// @grant        GM_openInTab
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Home') {
            GM_openInTab('https://grok.com/imagine/saved', { active: false, insert: true, setParent: true });
        }
    });
})();
