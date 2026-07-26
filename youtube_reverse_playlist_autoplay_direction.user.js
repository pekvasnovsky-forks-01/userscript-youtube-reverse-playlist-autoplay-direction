// ==UserScript==
// @name         Autoplay Youtube playlist in reverse order
// @namespace    https://github.com/pekvasnovsky/userscript-youtube-reverse-playlist-autoplay-direction/
// @version      1.0
// @description  Adds buttons for loading the previous video in a YT playlist. Adjustment of https://github.com/Dragosarus/Userscripts/blob/master/youtube_playlist_reverse.js
// @author       pekvasnovsky
// @match        http://www.youtube.com/*
// @match        https://www.youtube.com/*
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_registerMenuCommand
// @noframes
// ==/UserScript==

// Cookies (current session):
// pytplir_playPrevious - saves the button state between loads

/* NOTES:
 *    - If the button is not displayed (but the script is running), pause and unpause the video.
 *    - If it still does not appear, reload the page.
 *    - If it *still* does not appear, let me know through Greasy Fork or GitHub.
 *    - If the button is displayed but does not work properly/consistently, increase the value of redirectWhenTimeLeft.
*/

// @ts-check

(function() {
    'use strict';


    // @ts-ignore
    let debug = GM_getValue("debug", false);

    const MENU_ID = "debug-toggle";

    function registerMenu() {
        // @ts-ignore
        GM_registerMenuCommand(
            `Debug: ${debug ? "ON" : "OFF"}`,
            () => {
                debug = !debug;
                // @ts-ignore
                GM_setValue("debug", debug);

                // Update the menu item in place
                registerMenu();
            },
            { id: MENU_ID }
        );
    }

    registerMenu();


    // https://stackoverflow.com/a/7053197
    /**
     * @param {{ (): void; (this: Document, ev: Event): any; }} callback
     */
    function ready(callback) {
        // in case the document is already rendered
        if (document.readyState!='loading') callback();
        // modern browsers
        else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback);
        // IE <= 8
        // else document.attachEvent('onreadystatechange', function() {
        //     if (document.readyState=='complete') callback();
        // });
    }

    ready(function() {
        // Determines when to load the next video.
        // Increase these if the redirect does not work as intended (i.e. fails to override Youtube's redirect),
        // Decreasing these will let you see more of the video before it redirects, but the redirect might stop working (consistently)
        const redirectWhenTimeLeft = 0.3; // seconds before the end of the video
        const redirectWhenTimeLeft_miniplayer = 0.6;
        const skipUnplayable = true; // Skip videos that have not been premiered yet/upcoming livestreams

        const activeColor = "rgb(64,166,255)";
        const inactiveColor = "rgb(144,144,144)";
        const circleColor = "rgb(144,144,144)";
        const ttBGColor = "rgb(100,100,100)";
        const ttTextColor = "rgb(237,240,243)";

        const selectors = {
            "buttonLocation":            "div[id=playlist-action-menu] > .ytd-playlist-panel-renderer > div[id=top-level-buttons-computed]",
            "content":                   "#content",
            "player":                    ".html5-main-video",
            "miniplayerDiv":             "div.miniplayer",
            "playlistButtons":           ".ytd-watch-flexy #playlist #playlist-action-menu",
            "playlistButtonsMiniplayer": "ytd-miniplayer #playlist-action-menu",
            "playlistCurrentVideo":      "ytd-playlist-panel-video-renderer[selected]",
            "playlistVideos":            "#publisher-container span.index-message",
            "playlistVideosMiniplayer":  ".ytdMiniplayerInfoBarPlaylistIndex > span:nth-child(2)",
            "shuffleButtonActive":       "path[d='M16.293 13.293a1 1 0 011.414 0L22.414 18l-4.707 4.707a1 1 0 01-1.414-1.413L18.586 19H17.21a7.001 7.001 0 01-5.824-3.117l-.186-.278 1.202-1.803.648.972A5.001 5.001 0 0017.21 17h1.375l-2.293-2.293a1 1 0 010-1.414Zm0-12a1 1 0 011.414 0L22.414 6l-4.707 4.707a1 1 0 01-1.414-1.414L18.586 7H17.21a5 5 0 00-4.16 2.227l-4.438 6.656A7 7 0 012.79 19H2a1 1 0 010-2h.79a5 5 0 004.16-2.226l4.437-6.656A7 7 0 0117.21 5h1.375l-2.293-2.292a1 1 0 010-1.415ZM3 10.001a2 2 0 110 4 2 2 0 010-4Zm-.21-5a7 7 0 015.823 3.117l.185.277-1.202 1.803-.647-.971A5 5 0 002.79 7H2a1 1 0 010-2h.79Z']",
            "shuffleButtonInactive":     "path[d='M16.293 1.293a1 1 0 00-.001 1.415L18.585 5H17.21a7 7 0 00-5.823 3.118L6.95 14.774A5 5 0 012.79 17H2a1 1 0 000 2h.79a7 7 0 005.822-3.117l4.438-6.656A5 5 0 0117.21 7h1.376l-2.293 2.293a1 1 0 001.414 1.414L22.414 6l-4.707-4.707a1 1 0 00-1.414 0ZM2.789 5H2a1 1 0 000 2h.79a5 5 0 014.159 2.227l.647.97 1.202-1.802-.185-.277A7 7 0 002.789 5Zm13.504 8.293a1 1 0 00-.001 1.414L18.585 17H17.21a5 5 0 01-4.16-2.226l-.648-.972-1.202 1.803.186.278A7 7 0 0017.21 19h1.376l-2.293 2.294-.068.076a1 1 0 001.406 1.406l.076-.07L22.414 18l-4.707-4.707a1 1 0 00-1.414 0Z']",
            "shuffleButtonLegacy":       "path[d='M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z']",
            "timestamp":                 "span.ytd-thumbnail-overlay-time-status-renderer",
            "videoPlayer":               ".html5-video-player"
        }

        const ytdApp = /** @type {Element} */ (document.querySelector("ytd-app"));

        /**
         * @type {{ 
         *      addEventListener: (arg0: string, arg1: { (): void; (): void; }) => void; 
         *      duration: number; 
         *      currentTime: number; 
         *      hasAttribute: (arg0: string) => any; 
         *      pause: () => void; 
         * }}
         */
        let player;
        /**
         * @type {boolean}
         */
        let playPrevious;
        let redirectFlag = false;
        /**
         * @type {Element | undefined}
         */
        let shuffle;
        let miniplayerActive = false;
        let miniplayerFlag = false; // keep track of switches between miniplayer and normal mode
        let playerListenersAdded = false;

        // create button
        const svgNS = "http://www.w3.org/2000/svg";
        const btn_div = document.createElement("div");
        const bg_circle = document.createElementNS(svgNS, "circle");
        const bg_circle_anim = document.createElementNS(svgNS, "animate");
        const bg_circle_fadein_anim = document.createElementNS(svgNS, "animate");
        const bg_circle_fadeout_anim = document.createElementNS(svgNS, "animate");
        const arrow_up = document.createElementNS(svgNS, "polygon");
        const arrow_down = document.createElementNS(svgNS, "polygon");
        const btn_svg = document.createElementNS(svgNS, "svg");
        const tt_svg = document.createElementNS(svgNS, "svg");
        const tt_svg_fadein = document.createElementNS(svgNS, "animate");
        const tt_svg_fadeout = document.createElementNS(svgNS, "animate");
        const tt_rect = document.createElementNS(svgNS, "rect");
        const tt_text = document.createElementNS(svgNS, "text");
        const tt_div = document.createElement("div");

        setAttributes(bg_circle_anim, [["attributeName", "fill-opacity"],
                                       ["by", "0.2"],
                                       ["values", "0;0.5;0"],
                                       ["dur", "0.3s"],
                                       ["additive", "sum"],
                                       ["restart", "always"],
                                       ["repeatCount", "1"],
                                       ["begin", "indefinite"],
                                       ["id", "pytplir_bg_circle_anim"]]);
        setAttributes(bg_circle_fadein_anim, [["attributeType", "CSS"],
                                              ["attributeName", "fill-opacity"],
                                              ["values", "0;0.3"],
                                              ["dur", "0.1s"],
                                              ["restart", "always"],
                                              ["repeatCount", "1"],
                                              ["begin", "indefinite"],
                                              ["id", "pytplir_bg_circle_fadein_anim"],
                                              ["fill", "freeze"]]);
        setAttributes(bg_circle_fadeout_anim, [["attributeType", "CSS"],
                                               ["attributeName", "fill-opacity"],
                                               ["values", "0.3;0"],
                                               ["dur", "0.1s"],
                                               ["restart", "always"],
                                               ["repeatCount", "1"],
                                               ["begin", "indefinite"],
                                               ["id", "pytplir_bg_circle_fadeout_anim"],
                                               ["fill", "freeze"]]);
        setAttributes(bg_circle, [["cx", "20"],
                                  ["cy", "20"],
                                  ["r", "20"],
                                  ["fill", circleColor],
                                  ["fill-opacity", "0"]]);
        setAttributes(arrow_up, [["points", "17,19 17,17 13,17 20,11 27,17 23,17 23,19"],
                                 ["id", "pytplir_arrow_up"]]);
        setAttributes(arrow_down, [["points", "17,21 17,23 13,23 20,29 27,23 23,23 23,21"],
                                   ["id", "pytplir_arrow_down"]]);
        setAttributes(btn_svg, [["xmlns", svgNS],
                                 ["viewbox", "0 0 40 40"],
                                 ["width", "40"],
                                 ["height", "40"],
                                 ["style", "cursor: pointer; margin-left: 8px;"],
                                 ["id", "pytplir_btn"]]);
        setAttributes(tt_rect, [["x", "0"],
                                ["y", "0"],
                                ["rx", "2"],
                                ["ry", "2"],
                                ["width", "110"],
                                ["height", "34"],
                                ["fill", ttBGColor],
                                ["fill-opacity", "0.9"]]);
        setAttributes(tt_text, [["x", "8"],
                                ["y", "22"],
                                ["font-family", "Roboto, Noto, sans-serif"],
                                ["font-size", "13px"],
                                ["fill", ttTextColor],
                                ["style", "user-select:none;"]]);
        setAttributes(tt_svg_fadein, [["attributeType", "CSS"],
                                      ["attributeName", "opacity"],
                                      ["values", "0;1"],
                                      ["dur", "0.1s"],
                                      ["restart", "always"],
                                      ["repeatCount", "1"],
                                      ["begin", "indefinite"],
                                      ["id", "pytplir_tt_fadein"],
                                      ["fill", "freeze"]]);
        setAttributes(tt_svg_fadeout, [["attributeType", "CSS"],
                                       ["attributeName", "opacity"],
                                       ["values", "1;0"],
                                       ["dur", "0.1s"],
                                       ["restart", "always"],
                                       ["repeatCount", "1"],
                                       ["begin", "indefinite"],
                                       ["id", "pytplir_tt_fadeout"],
                                       ["fill", "freeze"]]);
        const tt_svg_offset = "position:absolute; top:13px; left:-32px; z-index:100; opacity:0.0;";
        setAttributes(tt_svg, [["viewbox", "0 0 100 34"],
                               ["xmlns", "http://www.w3.org/2000/svg"],
                               ["width", "100"],
                               ["height", "34"],
                               ["style", "padding-left: 10px; fill:" + ttBGColor + "; " + tt_svg_offset],
                               ["id", "pytplir_tt"]]);
        setAttributes(tt_div, [["style", "position:relative; width:0; height:0;"]]);
        setAttributes(btn_div, [["id", "pytplir_div"],
                                ["style", "display: flex;"],
                                ["style", "flex-direction: column;"]]);
        tt_text.textContent = "Autoplay order";
        appendChildren(bg_circle, [bg_circle_anim, bg_circle_fadein_anim, bg_circle_fadeout_anim]);
        appendChildren(btn_svg, [bg_circle, arrow_up, arrow_down]);
        appendChildren(tt_svg, [tt_rect, tt_text, tt_svg_fadein, tt_svg_fadeout]);
        tt_div.appendChild(tt_svg);
        appendChildren(btn_div, [btn_svg, tt_div]);

        init();

        /**
         * @param {SVGSVGElement} cloned_btn_svg
         */
        function attachHandlers(cloned_btn_svg) {
            cloned_btn_svg.addEventListener("click", onButtonClick);
            cloned_btn_svg.addEventListener("click", (e) => {
                // @ts-ignore
                e.currentTarget.parentElement
                    .querySelector("#pytplir_bg_circle_anim")
                    .beginElement();
            });
            cloned_btn_svg.addEventListener("mouseenter", (e) => {
                // @ts-ignore
                e.currentTarget.parentElement
                    .querySelector("#pytplir_tt_fadein")
                    .beginElement();
                // @ts-ignore
                e.currentTarget.parentElement
                    .querySelector("#pytplir_bg_circle_fadein_anim")
                    .beginElement();
            });
            cloned_btn_svg.addEventListener("mouseleave", (e) => {
                // @ts-ignore
                e.currentTarget.parentElement
                    .querySelector("#pytplir_tt_fadeout")
                    .beginElement();
                // @ts-ignore
                e.currentTarget.parentElement
                    .querySelector("#pytplir_bg_circle_fadeout_anim")
                    .beginElement();
            });
        }

        /**
         * @param {Element} node
         * @param {string[][]} attributeValuePairs
         */
        function setAttributes(node, attributeValuePairs) { // [["id", "example"], ["width","20"], ...]
            for (let attVal of attributeValuePairs){
                node.setAttribute(attVal[0], attVal[1]);
            }
        }

        /**
         * @param {Element} node
         * @param {(Element)[]} childList
         */
        function appendChildren(node, childList) {
            for (let child of childList) {
                node.appendChild(child);
            }
        }

        function init() {
            debugLog("Calling init()");
            // the button needs to be re-added whenever the playlist is updated (e.g when a video is loaded or removed)
            /**
             * @param {any} mutationList
             * @param {any} observer
             */
            function observerCallback(mutationList, observer) {
                debugLog("Observer triggered!")
                start();
            }
            const playlistObserver = new MutationObserver(observerCallback);
            const observerOptions = {subtree:true, childList:true, characterData:true};
            initObserver(playlistObserver, observerOptions);
            const playPreviousCookie = getCookie("pytplir_playPrevious");
            if (playPreviousCookie === "") { // cookie has not been set yet
                playPrevious = false; // inital state
                setCookie("pytplir_playPrevious", playPrevious);
            } else {
                playPrevious = playPreviousCookie;
            }

            start();
        }

        /**
         * @param {MutationObserver} observer
         * @param {{ subtree: boolean; childList: boolean; characterData: boolean; } | undefined} [options]
         */
        function initObserver(observer, options) {
            debugLog("Calling initObserver()");
            try {
                const playlistVideos = document.querySelector(selectors.playlistVideos);

                if (playlistVideos) {
                    observer.observe(playlistVideos, options);
                }

                const playlistVideosMiniplayer = document.querySelector(selectors.playlistVideosMiniplayer);
                if (playlistVideosMiniplayer) {
                    observer.observe(playlistVideosMiniplayer, options);
                }
            } catch (e) {
                setTimeout(function(){initObserver(observer)}, 100);
            }
        }

        function onButtonClick() { // toggle
            playPrevious = !playPrevious;
            setCookie("pytplir_playPrevious", playPrevious);
            updateButtonState();
        }

        function addButton() { // Add button(s)
            debugLog("addButton start")
            withQuery(selectors.buttonLocation, false, function(res) {
                res.forEach(function(/** @type {Element} */ element) {
                    if (!element.querySelector("#pytplir_div")) {
                        const clone = /** @type {HTMLDivElement} */ (btn_div.cloneNode(true));
                        
                        attachHandlers(/** @type {SVGSVGElement} */ (clone.querySelector(':scope > svg')));
                        element.appendChild(clone);

                        updateButtonState();
                        debugLog("button added");
                    }
                });
            });
            debugLog("addButton finish")
        }

        function updateButtonState() {
            if (playPrevious) { // play previous video
                document.querySelectorAll("polygon[id=pytplir_arrow_up]").forEach(function (polygon) {
                    polygon.setAttribute("style", "fill:" + activeColor);
                });
                document.querySelectorAll("polygon[id=pytplir_arrow_down]").forEach(function (polygon) {
                    polygon.setAttribute("style", "fill:" + inactiveColor);
                });
            } else { // play next video
                document.querySelectorAll("polygon[id=pytplir_arrow_up]").forEach(function (polygon) {
                    polygon.setAttribute("style", "fill:" + inactiveColor);
                });
                document.querySelectorAll("polygon[id=pytplir_arrow_down]").forEach(function (polygon) {
                    polygon.setAttribute("style", "fill:" + activeColor);
                });
            }

            miniplayerActive = isMiniplayerActive();
            let ctx = miniplayerActive ? selectors.miniplayerDiv : selectors.content;

            const button = document.querySelector(ctx + " #pytplir_btn");
            if (button) {
                button.setAttribute("activated", String(playPrevious));
                debugLog(button);
            }
        }

        function start() { // Add button(s) and event listeners
            addButton();
            debugLog("playerListenersAdded = " + playerListenersAdded);
            if (!playerListenersAdded) {
                withQuery(selectors.player, true, function(res) {
                    player = res[0];
                    player.addEventListener("timeupdate", checkTime);
                    player.addEventListener("play", addButton); // ensure button is added
                    playerListenersAdded = true;
                });
            }
        }

        /**
         * @param {string} query
         */
        function withQuery(query, filterItemsOnlyReturnVisible = false, onSuccess = function(/** @type {any} */ r){}) {
            let res;
            if (!filterItemsOnlyReturnVisible) {
                res = document.querySelectorAll(query);
            } else {
                res = Array.from(document.querySelectorAll(query)).filter(function (elem) {
                    return /** @type {HTMLElement} */ (elem).offsetParent !== null;
                });
            }
            if (res.length) { // >= 1 result
                onSuccess(res);
                return res;
            } else { // not loaded yet => retry
                setTimeout(function(){withQuery(query, filterItemsOnlyReturnVisible, onSuccess)});
            }
        }

        function isMiniplayerActive() {
            // Youtube seems to change this quite often, and due to A/B testing all of them need to be checked
            let miniplayer_attributes = ["miniplayer-is-active", "miniplayer-active_", "miniplayer-active"];
            miniplayerActive = false;
            for (let attr of miniplayer_attributes) {
                miniplayerActive ||= ytdApp.hasAttribute(attr);
            }
            return miniplayerActive;
        }

        function checkTime() {
            let miniplayerActive = isMiniplayerActive();
            let context = miniplayerActive ? selectors.miniplayerDiv : selectors.content;
            let buttonSelector = context + " " + selectors.buttonLocation + " #pytplir_div";
            let noButton = !document.querySelector(buttonSelector);

            let playlistHeaderQuery = miniplayerActive
                ? document.querySelector(selectors.playlistVideosMiniplayer)?.parentElement
                : document.querySelector(selectors.playlistVideos)?.parentElement;

            let playlistVisible = !!playlistHeaderQuery && playlistHeaderQuery.offsetParent !== null;

            // exit early when not watching a playlist
            if (!playlistVisible) {return;} // button not loaded
            else if (noButton) { // button was removed
                debugLog("failsafe: adding button");
                addButton();
            }

            debugLog("checkTime: miniplayer: " + miniplayerActive +
                     ", button == " + !noButton);

            let timeLeft = player.duration - player.currentTime;
            let videoPlayer = document.querySelector(selectors.videoPlayer);
            if (!videoPlayer) {
                throw new Error("Video player not found");
            }

            let redirectTime;
            let shuffleContext;
            if (miniplayerActive) {
                redirectTime = redirectWhenTimeLeft_miniplayer;
                shuffleContext = selectors.playlistButtonsMiniplayer;
            } else {
                redirectTime = redirectWhenTimeLeft;
                shuffleContext = selectors.playlistButtons;
            }

            if (miniplayerActive != miniplayerFlag) {
                shuffle = undefined;
            }

            if (!shuffle) {
                let shuffleLocal = document.querySelector(shuffleContext + " " + selectors.shuffleButtonActive)
                    ?.closest("button[aria-pressed]");

                if (!shuffleLocal) { // shuffle not activated
                    shuffleLocal = document.querySelector(shuffleContext + " " + selectors.shuffleButtonInactive)
                        ?.closest("button[aria-pressed]");
                }

                shuffle = shuffleLocal ?? undefined;
                miniplayerFlag = miniplayerActive;
            }
            
            try {videoPlayer.classList.contains("ad-showing");} // ensure it will work below
            catch (TypeError) { // video player undefined
            	return;
            }

            /**
             * @type {boolean}
             */
            let shuffleEnabled;
            try {
                shuffleEnabled = !!shuffle && strToBool(shuffle.getAttribute("aria-pressed"));
            } catch (TypeError) { // e.g. when using Queues
                shuffleEnabled = false;
            }
            if (timeLeft < redirectTime && !redirectFlag && playPrevious && !shuffleEnabled && !player.hasAttribute("loop")
                    && !videoPlayer.classList.contains("ad-showing")) {
                // attempt to prevent the default redirect from triggering
                player.pause();
                player.currentTime -= 2;

                const vidNum = getVidNum();
                if (vidNum && vidNum[0] !== "1") {
                    redirectFlag = true;
                    redirect();
                    setTimeout(function() {redirectFlag = false;}, 1000);
                }
            }
        }

        function getVidNum() {
            /**
             * @type {NodeListOf<HTMLElement>}
             */
            let elements;

            if (ytdApp.hasAttribute("miniplayer-active") || ytdApp.hasAttribute("miniplayer-active_")) {
                elements = document.querySelectorAll(selectors.playlistVideosMiniplayer);
            } else {
                elements = document.querySelectorAll(selectors.playlistVideos);
            }

            // the desired element is hidden; filter out those which are not in visible parent
            const visibleElement = Array.from(elements).find(function (elem) {
                return elem.parentElement && elem.parentElement.offsetParent !== null;
            });

            if (!visibleElement) {
                return null;
            }

            return visibleElement.innerText.split(" / ");
        }

        function redirect() {
            let previousURL = getPreviousURL();
            if (previousURL) {
                previousURL.click();
            }
        }

        function getPreviousURL() { // returns <a> element
            let elem;

            if (ytdApp.hasAttribute("miniplayer-active") || ytdApp.hasAttribute("miniplayer-active_")) {
                elem = document.querySelector(selectors.miniplayerDiv)
                    ?.querySelector(selectors.playlistCurrentVideo)
                    ?.previousElementSibling;
            } else {
                elem = document.querySelector(selectors.content)
                    ?.querySelector(selectors.playlistCurrentVideo)
                    ?.previousElementSibling;
            }

            let ts;

            /**
             * @param {Element | null | undefined} element
             */
            function getTimestamp(element) {
                if (skipUnplayable) {
                    /**
                     * @type {HTMLElement | null | undefined}
                     */
                    const timestamp = element?.querySelector(selectors.timestamp);
                    return timestamp ? timestamp.innerText : undefined;
                }
            }

            ts = getTimestamp(elem);

            while (
                elem &&
                ((/** @type {HTMLElement | null | undefined} */ (elem.querySelector("#unplayableText")))?.hidden === false ||
                    (skipUnplayable && typeof ts === "string" && !ts.includes(":")))
            ) {
                elem = elem.previousElementSibling;

                if (!elem) return null; // first video in playlist

                ts = getTimestamp(elem);
            }

            return /** @type {HTMLAnchorElement | null} */ (elem?.children[0] ?? null);
        }

        /**
         * @param {string | null} str
         */
        function strToBool(str) {
            return !!str && str.toLowerCase() == "true";
        }

        /**
         * @param {any[]} args
         */
        function debugLog(...args) {
            if (debug) {
                args.unshift("yt-reverse-autoplay:");
                console.log.apply(console, args);
            }
        }

        // adapted from https://www.w3schools.com/js/js_cookies.asp
        /**
         * @param {string} cname
         * @param {string | boolean} cvalue
         */
        function setCookie(cname, cvalue) {
            document.cookie = cname + "=" + cvalue + ";sameSite=lax;path=www.youtube.com/watch";
        }

        /**
         * @param {string} cname
         */
        function getCookie(cname) {
            let name = cname + "=";
            let decodedCookie = decodeURIComponent(document.cookie);
            let ca = decodedCookie.split(';');
            for(let i = 0; i <ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) == ' ') {
                c = c.substring(1);
                }
                if (c.indexOf(name) == 0) {
                    let x = c.substring(name.length, c.length);
                    return strToBool(x);
                }
            }
            return "";
        }
    });
})();
