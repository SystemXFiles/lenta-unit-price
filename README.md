# Lenta.com | Цена за единицу

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/github/license/SystemXFiles/lenta-unit-price)

Userscript для `lenta.com`, который добавляет на карточки товаров цену за единицу:
- `₽/кг`
- `₽/л`
- `₽/шт`

## Возможности

- Считает цену за единицу из цены и фасовки.
- Нормализует `г -> кг`, `мл -> л`.
- Добавляет желтый стикер в блок цены.
- Обрабатывает динамически подгружаемые карточки (`MutationObserver`).

## Установка

1. Установите менеджер userscript:
   - **Tampermonkey** (Chrome, Edge, Safari, Opera)
   - **Violentmonkey** или **Greasemonkey** (Firefox)
2. Установите скрипт:

[![УСТАНОВИТЬ](https://img.shields.io/badge/УСТАНОВИТЬ-СКРИПТ-success?style=for-the-badge&logo=tampermonkey)](https://github.com/SystemXFiles/lenta-unit-price/raw/master/lenta_unit_price.user.js)

## Использование

1. Откройте `https://lenta.com/`.
2. Перейдите в каталог или поиск товаров.
3. На карточках появится дополнительный стикер с ценой за единицу.
