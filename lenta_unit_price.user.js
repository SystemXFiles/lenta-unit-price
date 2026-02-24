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

    // Стиль: Желтый стикер (яркий и заметный)
    const STYLES = {
        backgroundColor: '#FFEB3B', // Желтый фон
        color: '#D50000',           // Красный текст
        fontSize: '13px',           // Читаемый размер
        fontWeight: '700',          // Жирный
        padding: '2px 6px',         // Отступы внутри плашки
        borderRadius: '6px',        // Скругление
        marginTop: '4px',           // Отступ сверху
        display: 'block',           // Блочный элемент, чтобы переносился на новую строку
        width: 'fit-content',       // Ширина по содержимому
        lineHeight: '1',
    };

    const SELECTORS = {
        card: 'lu-product-card',
        priceBlock: '.product-price', // Куда вставляем
        mainPrice: '.main-price',     // Откуда берем цену
        weight: '.card-name_package', // Вес (приоритет 1)
        title: '.lu-product-card-name' // Вес (приоритет 2)
    };

    // Форматирование: 1 200
    function formatMoney(num) {
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    function parsePrice(str) {
        if (!str) return null;
        const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(cleaned);
    }

    // Универсальная логика (как в v6)
    function parseDynamicUnit(str) {
        if (!str) return null;

        // Ищем: Число + Текст
        const match = str.trim().match(/^(\d+(?:[.,]\d+)?)\s*([а-яa-z.]+)/i);
        const looseMatch = str.match(/(\d+(?:[.,]\d+)?)\s*([а-яa-z.]+)/i);
        const bestMatch = match || looseMatch;

        if (!bestMatch) return null;

        let val = parseFloat(bestMatch[1].replace(',', '.'));
        let unitRaw = bestMatch[2].toLowerCase();

        if (unitRaw === '%') return null; // Игнорируем проценты

        // Нормализация
        if ((unitRaw.startsWith('г') || unitRaw === 'g') && val >= 1) {
            val = val / 1000;
            unitRaw = 'кг';
        }
        else if (unitRaw.startsWith('м') || unitRaw.startsWith('m')) {
            val = val / 1000;
            unitRaw = 'л';
        }
        else if (unitRaw.startsWith('к') || unitRaw.startsWith('k')) {
            unitRaw = 'кг';
        }
        else if (unitRaw === 'л' || unitRaw === 'l') {
            unitRaw = 'л';
        }

        return { value: val, label: unitRaw };
    }

    function addPricePerUnit(card) {
        if (card.getAttribute('data-ppu-done')) return;

        const priceContainer = card.querySelector(SELECTORS.priceBlock);
        const priceEl = card.querySelector(SELECTORS.mainPrice);

        let weightSource = card.querySelector(SELECTORS.weight);
        if (!weightSource) weightSource = card.querySelector(SELECTORS.title);

        if (!priceEl || !weightSource || !priceContainer) return;

        const price = parsePrice(priceEl.textContent);
        const unitData = parseDynamicUnit(weightSource.textContent);

        if (price && unitData && unitData.value > 0) {
            const pricePerUnit = price / unitData.value;

            // Создаем стикер
            const badge = document.createElement('div');
            badge.textContent = `${formatMoney(pricePerUnit)} ₽/${unitData.label}`;

            Object.assign(badge.style, STYLES);

            // Вставляем ВНУТРЬ .product-price
            // flexWrap заставит блок перескочить на новую строку, если там Flexbox
            priceContainer.style.flexWrap = 'wrap';
            priceContainer.appendChild(badge);

            card.setAttribute('data-ppu-done', 'true');
        }
    }

    function processCards() {
        const cards = document.querySelectorAll(SELECTORS.card);
        if (cards.length > 0) {
            cards.forEach(addPricePerUnit);
        }
    }

    const observer = new MutationObserver((mutations) => {
        const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
        if (hasNewNodes) processCards();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(processCards, 1000);
})();
