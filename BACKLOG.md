# Backlog

## Высокий приоритет

- [ ] `add_recipe_to_diary` — добавить рецепт в дневник  
  Endpoint неизвестен, нужно реверсить POST в consumed-items с type=recipe_portion

- [ ] Обогатить `get_user_products` — сейчас возвращает только ID  
  Нужно подтянуть детали каждого через `get_product` (+ название, КБЖУ)

## Средний приоритет

- [ ] `create_recipe` — создание рецепта  
  Endpoint неизвестен, нужно реверсить

- [ ] `create_meal` — создание блюда (набор продуктов)

- [ ] `add_meal_to_diary` — добавить блюдо в дневник  
  Endpoint неизвестен, нужно реверсить POST с `simple_product`

## Низкий приоритет

- [ ] Quick Add — быстрое добавление калорий без продукта  
  Endpoint неизвестен, нужен реверс

- [ ] Barcode lookup — поиск по EAN/штрихкоду  
  `search_products` иногда находит по EAN, но целевого инструмента нет

## Технический долг

- [ ] Убрать `.editorconfig`, `.eslintrc.js`, `.prettierrc` или привести к единому стандарту (есть конфликт `.eslintrc.js` vs `eslint.config.js`)
- [ ] `dist/` должен билдиться на CI, не коммититься в репо

## Исследование API (результаты)

Что работает:
- `GET /v15/user/recipes` → массив ID рецептов
- `GET /v15/recipes/{id}` → полные данные рецепта
- `GET /v15/user/meals` → массив meal-объектов

Что не работает:
- `GET /v15/meals/{id}` → 404
- `GET /v15/user/meals/{id}` → 405
- `GET /v15/user/simple-products` → 404 (поле `simple_products` зарезервировано)
