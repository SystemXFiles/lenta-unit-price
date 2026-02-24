// ==UserScript==
// @name         Lenta.com | Цена за единицу
// @namespace    https://github.com/SystemXFiles/
// @version      1.0
// @author       System X-Files
// @description  Показывает цену за 1 кг, 1 л или 1 шт. (желтый стикер).
// @icon         https://lenta.com/favicon.ico
// @homepageURL  https://github.com/SystemXFiles/lenta-unit-price
// @supportURL   https://github.com/SystemXFiles/lenta-unit-price/issues
// @updateURL    https://raw.githubusercontent.com/SystemXFiles/lenta-unit-price/master/lenta_unit_price.user.js
// @downloadURL  https://raw.githubusercontent.com/SystemXFiles/lenta-unit-price/master/lenta_unit_price.user.js
// @match        https://lenta.com/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__lupUnitPriceLoaded) return;
    window.__lupUnitPriceLoaded = true;

    const BADGE_CLASS = 'lup-unit-price-badge';
    const BADGE_PDP_CLASS = 'lup-unit-price-badge--pdp';
    const BADGE_ROW_CLASS = 'lup-unit-price-row';
    const STYLE_ID = 'lup-style';
    const THROTTLE_MS = 250;
    const MONEY_FORMATTER = new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: 2
    });

    const SELECTORS = {
        cards: 'lu-product-card, a.product-card, .product-card',
        nativeCard: 'lu-product-card',
        priceBlock: '.product-price, [class*="product-price"]',
        mainPrice: '.main-price, [class*="main-price"]',
        title: '.lu-product-card-name, [class*="product-card-name"]',
        weight: '.card-name_package, [class*="package"]',
        pdpRoot: '.right-column'
    };

    const BADGE_CSS = `
.${BADGE_CLASS} {
    background: #FFEB3B;
    color: #D50000;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
    border-radius: 6px;
    padding: 2px 6px;
    margin-top: 6px;
    display: block;
    width: fit-content;
    max-width: 100%;
    align-self: flex-start;
    pointer-events: none;
}
.${BADGE_CLASS}.${BADGE_PDP_CLASS} {
    margin-top: 20px;
}
.${BADGE_ROW_CLASS} {
    display: block;
    width: 100%;
}
`;

    function installStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = BADGE_CSS;
        document.head.appendChild(style);
    }

    function toText(node, visibleOnly = false) {
        const raw = visibleOnly ? (node?.innerText || '') : (node?.textContent || '');
        return raw.replace(/\s+/g, ' ').trim();
    }

    function formatMoney(value) {
        return MONEY_FORMATTER.format(value);
    }

    function parseNumeric(text) {
        const cleaned = (text || '').replace(/[^\d.,]/g, '');
        if (!cleaned) return null;

        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        const splitIndex = Math.max(lastComma, lastDot);

        let normalized = '';

        if (splitIndex === -1) {
            normalized = cleaned.replace(/[^\d]/g, '');
        } else {
            const intPart = cleaned.slice(0, splitIndex).replace(/[^\d]/g, '');
            const fracPart = cleaned.slice(splitIndex + 1).replace(/[^\d]/g, '');
            normalized = fracPart ? `${intPart}.${fracPart}` : intPart;
        }

        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function parsePrice(text) {
        if (!text) return null;

        const money = text.match(/(\d[\d\s.,]*)\s*(?:₽|руб)/i);
        return parseNumeric(money ? money[1] : text);
    }

    function normalizeUnit(value, unitRaw = '') {
        let amount = value;
        let unit = unitRaw.toLowerCase();

        if ((unit.startsWith('г') || unit === 'g' || unit === 'гр') && amount >= 1) {
            return { value: amount / 1000, label: 'кг' };
        }

        if (unit.startsWith('м') || unit.startsWith('ml')) {
            return { value: amount / 1000, label: 'л' };
        }

        if (unit.startsWith('к') || unit === 'kg' || unit === 'k') {
            return { value: amount, label: 'кг' };
        }

        if (unit === 'л' || unit === 'l') {
            return { value: amount, label: 'л' };
        }

        if (unit.startsWith('шт') || unit === 'pc' || unit === 'pcs') {
            return { value: amount, label: 'шт' };
        }

        return { value: amount, label: unit };
    }

    function parseUnitFromTitle(text = '') {
        if (!text) return null;

        const match = text.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|к|г|гр|g|л|l|мл|ml|шт|pc|pcs)/i);
        if (!match) return null;

        const amount = parseFloat(match[1].replace(',', '.'));
        const unitRaw = match[2];

        if (!Number.isFinite(amount) || amount <= 0 || unitRaw === '%') return null;

        return normalizeUnit(amount, unitRaw);
    }

    function parseUnitFromPrice(text = '') {
        if (!text) return null;

        const withAmount = text.match(/(?:\/|за\s*1)\s*(\d+(?:[.,]\d+)?)\s*(шт|кг|л)/i);
        if (withAmount) {
            const amount = parseFloat(withAmount[1].replace(',', '.'));
            if (Number.isFinite(amount) && amount > 0) {
                return { value: amount, label: withAmount[2].toLowerCase() };
            }
        }

        const match = text.match(/(?:\/|за\s*1)\s*(шт|кг|л)/i);
        if (!match) return null;

        return { value: 1, label: match[1].toLowerCase() };
    }

    function parseCounterPieces(root) {
        const area = root.querySelector(
            '.product-card-purchase, [class*="product-card-purchase"], .counter-and-favorite-buttons, .product-base-info_controls'
        ) || root;

        const nodes = area.querySelectorAll('*');
        for (const node of nodes) {
            const text = toText(node);
            const match = text.match(/^(\d+(?:[.,]\d+)?)\s*шт$/i);
            if (!match) continue;

            const count = parseFloat(match[1].replace(',', '.'));
            if (Number.isFinite(count) && count > 0) return count;
        }

        return 1;
    }

    function resolveUnit(titleText, priceText) {
        return parseUnitFromTitle(titleText) || parseUnitFromPrice(priceText);
    }

    function findPdpRoot() {
        const fixed = document.querySelector(SELECTORS.pdpRoot);
        if (fixed?.querySelector(SELECTORS.priceBlock)) return fixed;

        const h1 = document.querySelector('h1');
        let node = h1?.parentElement || null;
        while (node && node !== document.body) {
            if (node.querySelector(SELECTORS.priceBlock)) return node;
            node = node.parentElement;
        }

        return null;
    }

    function collectContexts() {
        const contexts = [];
        const seen = new Set();

        const add = (root, type, titleSelector) => {
            if (!root || seen.has(root)) return;
            seen.add(root);
            contexts.push({ root, type, titleSelector });
        };

        document.querySelectorAll(SELECTORS.cards).forEach((card) => {
            if (!card.matches(SELECTORS.nativeCard) && card.closest(SELECTORS.nativeCard)) return;
            add(card, 'card', SELECTORS.title);
        });

        if (/^\/product\//i.test(window.location.pathname)) {
            const pdpRoot = findPdpRoot();
            if (pdpRoot?.querySelector('h1')) add(pdpRoot, 'pdp', 'h1');
        }

        return contexts;
    }

    function resolveBadgeMount(type, priceContainer) {
        if (type === 'card') {
            const purchaseBlock = priceContainer.closest('.product-card-purchase, [class*="product-card-purchase"]');
            if (purchaseBlock) {
                let row = purchaseBlock.querySelector(`:scope > .${BADGE_ROW_CLASS}`);
                if (!row) {
                    row = document.createElement('div');
                    row.className = BADGE_ROW_CLASS;
                    purchaseBlock.appendChild(row);
                }
                return { host: row, anchor: null };
            }
        }

        const controlsBlock = priceContainer.closest(
            '.product-base-info_controls, [class*="base-info_controls"], .product-card_controls, [class*="product-card_controls"]'
        );

        if (controlsBlock) {
            const anchor = controlsBlock.querySelector(
                'lu-product-card-counter-manager, lu-product-counter-manager, .counter-and-favorite-buttons'
            );
            return { host: controlsBlock, anchor };
        }

        const anchor = priceContainer.closest(
            'lu-product-card-counter-manager, lu-product-counter-manager, lu-product-counter, lu-counter, .counter-and-favorite-buttons, .price-and-buttons'
        ) || priceContainer;
        const host = anchor.parentElement;
        return host ? { host, anchor: null } : null;
    }

    function mountBadge(type, priceContainer, badge) {
        const mount = resolveBadgeMount(type, priceContainer);
        if (!mount) return;

        const { host, anchor } = mount;
        if (anchor && anchor.parentElement === host) {
            if (badge.parentElement !== host || badge.previousElementSibling !== anchor) {
                anchor.insertAdjacentElement('afterend', badge);
            }
            return;
        }

        if (badge.parentElement !== host || host.lastElementChild !== badge) {
            host.appendChild(badge);
        }
    }

    function updateContext(context) {
        const { root, titleSelector, type } = context;
        const priceContainer = root.querySelector(SELECTORS.priceBlock);
        if (!priceContainer) return;

        const priceSource = root.querySelector(SELECTORS.mainPrice) || priceContainer;
        const priceText = toText(priceSource, true);
        const weightText = toText(root.querySelector(SELECTORS.weight));
        const fallbackTitleText = toText(root.querySelector(titleSelector));
        const titleText = weightText || fallbackTitleText;
        if (!titleText && !priceText) return;

        const price = parsePrice(priceText);
        const unit = resolveUnit(titleText, priceText);
        const pieces = parseCounterPieces(root);

        const existingBadge = root.querySelector(`.${BADGE_CLASS}`);
        if (!price || !unit || unit.value <= 0) {
            existingBadge?.remove();
            const row = root.querySelector(`.${BADGE_ROW_CLASS}`);
            if (row && row.childElementCount === 0) row.remove();
            return;
        }

        const unitBasePrice = price / pieces;
        const badgeText = `${formatMoney(unitBasePrice / unit.value)} ₽/${unit.label}`;
        const badge = existingBadge || document.createElement('div');

        badge.className = type === 'pdp' ? `${BADGE_CLASS} ${BADGE_PDP_CLASS}` : BADGE_CLASS;
        badge.textContent = badgeText;

        mountBadge(type, priceContainer, badge);
    }

    function processAll() {
        installStyles();
        collectContexts().forEach(updateContext);
    }

    function throttle(fn, waitMs) {
        let lastCallAt = 0;
        let timerId = null;

        return function throttled() {
            const now = Date.now();
            const remaining = waitMs - (now - lastCallAt);

            if (remaining <= 0) {
                if (timerId !== null) {
                    clearTimeout(timerId);
                    timerId = null;
                }
                lastCallAt = now;
                fn();
                return;
            }

            if (timerId !== null) return;

            timerId = setTimeout(() => {
                timerId = null;
                lastCallAt = Date.now();
                fn();
            }, remaining);
        };
    }

    let isProcessing = false;

    const scheduleProcess = throttle(() => {
        if (isProcessing) return;

        isProcessing = true;
        requestAnimationFrame(() => {
            processAll();
            isProcessing = false;
        });
    }, THROTTLE_MS);

    function shouldIgnoreMutations(mutations) {
        let touched = 0;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                touched += 1;
                if (!(node instanceof HTMLElement)) return false;
                if (!node.classList.contains(BADGE_CLASS) && !node.classList.contains(BADGE_ROW_CLASS)) return false;
            }

            for (const node of mutation.removedNodes) {
                touched += 1;
                if (!(node instanceof HTMLElement)) return false;
                if (!node.classList.contains(BADGE_CLASS) && !node.classList.contains(BADGE_ROW_CLASS)) return false;
            }
        }

        return touched > 0;
    }

    function installObservers() {
        const observer = new MutationObserver((mutations) => {
            if (isProcessing) return;
            if (shouldIgnoreMutations(mutations)) return;
            scheduleProcess();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function installNavigationHooks() {
        const patch = (methodName) => {
            const original = history[methodName];
            if (typeof original !== 'function') return;

            history[methodName] = function (...args) {
                const result = original.apply(this, args);
                window.dispatchEvent(new Event('lup:locationchange'));
                return result;
            };
        };

        patch('pushState');
        patch('replaceState');

        window.addEventListener('popstate', () => window.dispatchEvent(new Event('lup:locationchange')));
        window.addEventListener('hashchange', () => window.dispatchEvent(new Event('lup:locationchange')));
        window.addEventListener('pageshow', () => window.dispatchEvent(new Event('lup:locationchange')));
        window.addEventListener('lup:locationchange', scheduleProcess);
    }

    installObservers();
    installNavigationHooks();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleProcess, { once: true });
    }

    processAll();
})();
