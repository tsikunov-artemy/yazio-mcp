# Yazio MCP — Улучшения и идеи

Этот файл отслеживает сделанные доработки и идеи для будущего развития.
Ведётся вручную + через Hermes Agent.

---

## Сделано

### v0.0.14 — Обогащение recipe_portions (03.05.2026)
Коммит: a782710. Автор: Hermes Agent.

Инструмент `get_user_consumed_items` теперь обогащает `recipe_portions` названиями рецептов.
SDK не поддерживает рецепты (`recipe_portions: unknown[]`), поэтому используется прямой fetch к `/v15/user/recipes/{id}`.

Было: `{ recipe_id: "8aa0f9bb-...", amount: 200 }`
Стало: `{ recipe_id: "8aa0f9bb-...", amount: 200, recipe_name: "Овсянка с бананом" }`

Ошибки при получении рецептов не ломают запрос — возвращается `recipe_name: null`.

### v0.0.13 — Обогащение products (ранее)
Коммит: e284fe3.

Инструмент `get_user_consumed_items` обогащает `products` названиями и производителями.

Было: `{ product_id: 12345, amount: 100 }`
Стало: `{ product_id: 12345, amount: 100, product_name: 'Греческий йогурт', product_producer: 'Danone' }`

### v0.0.13 — Custom Products (ранее)
Добавлены инструменты:
- `get_user_products` — список ID кастомных продуктов
- `create_custom_product` — создание приватного продукта с нутриентами
- `delete_custom_product` — удаление кастомного продукта

---

## Анализ покрытия Yazio API

### ✅ Foods (обычные продукты) — ПОЛНОСТЬЮ ПОКРЫТО
- Поиск: `search_products`
- Просмотр: `get_product`
- Добавить в дневник: `add_user_consumed_item`
- Убрать из дневника: `remove_user_consumed_item`
- Просмотр дневника: `get_user_consumed_items` → `products[]` (обогащено)

### ⚠️ Custom Foods (свои продукты) — ЧАСТИЧНО
- ✅ Список ID: `get_user_products`
- ✅ Создать: `create_custom_product`
- ✅ Удалить: `delete_custom_product`
- ❌ **Обогащение `get_user_products`** — сейчас только ID, нужно подтягивать детали через `get_product`

### ❌ Recipes (рецепты) — НЕ ПОКРЫТО
SDK: `recipe_portions: unknown[]` — вне SDK, всё через прямой fetch.

Что есть в Yazio:
- Список рецептов пользователя
- Получить рецепт по ID (используется для обогащения)
- Создать рецепт
- Добавить рецепт в дневник

Что есть в MCP:
- ⚠️ Просмотр дневника: `get_user_consumed_items` → `recipe_portions[]` (обогащено только `recipe_name`)

**Нужно:**
1. `get_user_recipes` — список рецептов (`GET /v15/user/recipes`?)
2. `get_recipe` — детали рецепта (уже используется внутри для обогащения)
3. `create_recipe` — создание рецепта
4. `add_recipe_to_diary` — добавить рецепт в дневник

### ❌ Meals (блюда) — НЕ ПОКРЫТО
SDK: `simple_products: unknown[]` — предположительно это Meals.

Что есть в Yazio:
- Список блюд пользователя
- Создать блюдо (набор продуктов)
- Добавить блюдо в дневник

Что есть в MCP:
- ⚠️ `get_user_consumed_items` → `simple_products[]` — **не обогащается, не документировано**

**Нужно:**
1. Исследовать `simple_products` через живой API
2. `get_user_meals` — список блюд (`GET /v15/user/meals`?)
3. `create_meal` — создание блюда
4. `add_meal_to_diary` — добавить блюдо в дневник
5. Обогатить `simple_products` в `get_user_consumed_items`

### ❌ Quick Add — НЕ ПОКРЫТО
Быстрое добавление калорий без привязки к продукту.
Endpoint неизвестен, требует реверса.

### ❌ Barcode Lookup — НЕ ПОКРЫТО
Создание продукта через EAN/штрихкод.
Отдельного endpoint в SDK нет. Через `search_products` иногда находит по EAN, но целенаправленного инструмента нет.

---

## Приоритеты

### Высокий (реально нужно для работы с дневником)
1. **Recipes API** — `get_user_recipes`, `add_recipe_to_diary`, `create_recipe`
2. **Meals/simple_products** — исследовать и обогатить
3. **Обогатить `get_user_products`** — подтягивать детали через `get_product`

### Средний
4. `create_meal` — создание блюд
5. `get_user_meals` — список блюд

### Низкий
6. Quick Add — реверс endpoint
7. Barcode lookup — поиск по EAN

---

## Следующие шаги

1. Достать токен из Yazio client
2. Зондировать API:
   - `GET /v15/user/recipes` — список рецептов
   - `POST /v15/user/recipes` — создание рецепта
   - `GET /v15/user/meals` — список блюд
   - `POST /v15/user/consumed-items` с `simple_product` — добавление блюда
3. Реверсить структуру `simple_products` через живой дневник
4. Имплементировать недостающие инструменты

---

## Результаты исследования API (03.05.2026)

### ✅ Recipes — ENDPOINTS НАЙДЕНЫ

**GET /v15/user/recipes**
- Возвращает: массив ID рецептов пользователя `["uuid1", "uuid2", ...]`
- Статус: работает

**GET /v15/recipes/{id}**
- Возвращает: полные данные рецепта (name, nutrients, portion_count, locale, products, recipe_portions)
- Статус: работает
- Используется для обогащения в v0.0.14

**Структура recipe_portion в дневнике:**
```json
{
  "id": "consumed-item-id",
  "date": "2026-05-03 12:42:24",
  "daytime": "breakfast",
  "type": "recipe_portion",
  "recipe_id": "uuid",
  "portion_count": 2
}
```

### ✅ Meals — ENDPOINTS НАЙДЕНЫ

**GET /v15/user/meals**
- Возвращает: массив объектов meals с полной структурой
- Структура meal:
```json
{
  "id": "uuid",
  "name": "Кофе с молоком",
  "recipe_portions": [],
  "products": [
    {
      "product_id": "uuid",
      "amount": 110.0,
      "serving": null,
      "serving_quantity": null,
      "type": "product"
    }
  ]
}
```
- Статус: работает

**GET /v15/meals/{id}** — 404 (не существует)
**GET /v15/user/meals/{id}** — 405 (Method Not Allowed)

Meals можно получить только списком через `/v15/user/meals`, детали по ID недоступны.

### ❌ simple_products — НЕ СУЩЕСТВУЕТ

- `simple_products` в consumed items всегда пустой массив
- Endpoint `/v15/user/simple-products` — 404
- Вероятно, устаревшее поле или зарезервировано для будущего

### 📋 Итоговая таблица покрытия

| Сущность | Список | Детали по ID | Создать | Добавить в дневник | Обогащение в MCP |
|---|---|---|---|---|---|
| **Products** | ✅ search | ✅ get | ✅ create_custom | ✅ add_consumed | ✅ name+producer |
| **Recipes** | ✅ /user/recipes | ✅ /recipes/{id} | ❌ | ❌ | ✅ name |
| **Meals** | ✅ /user/meals | ❌ | ❌ | ❌ | ❌ |
| **simple_products** | ❌ не существует | — | — | — | — |

### 🎯 Приоритеты имплементации (обновлено)

**Высокий:**
1. ✅ `get_user_recipes` — список рецептов (`GET /v15/user/recipes`)
2. ✅ `get_recipe` — детали рецепта (`GET /v15/recipes/{id}`) — уже используется внутри
3. ❌ `add_recipe_to_diary` — добавить рецепт в дневник (endpoint неизвестен, нужно реверсить POST)
4. ✅ `get_user_meals` — список блюд (`GET /v15/user/meals`)

**Средний:**
5. ❌ `create_recipe` — создание рецепта (endpoint неизвестен)
6. ❌ `create_meal` — создание блюда (endpoint неизвестен)
7. ❌ `add_meal_to_diary` — добавить блюдо в дневник (endpoint неизвестен)
8. ⚠️ Обогатить `get_user_products` — подтягивать детали через `get_product`

**Низкий:**
9. ❌ Quick Add — endpoint неизвестен
10. ❌ Barcode lookup — endpoint неизвестен

### 🔧 Следующие шаги

1. Добавить `get_user_recipes` — простой инструмент, endpoint готов
2. Добавить `get_recipe` — публичный инструмент для получения деталей рецепта
3. Добавить `get_user_meals` — простой инструмент, endpoint готов
4. Реверсить POST endpoints для добавления recipes/meals в дневник
5. Обогатить `get_user_products` деталями продуктов
