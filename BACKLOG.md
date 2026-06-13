# Backlog

## FatSecret food-search (новая инициатива)

Добавить инструменты поиска еды из FatSecret в этот же MCP — как альтернативный
источник к Yazio. Food-search НЕ требует пользовательского OAuth: server-to-server
OAuth2 client_credentials → bearer-токен → REST. Архитектура yazio-mcp подходит
один-в-один (та же `registerTool`-схема, stdio, `console.error`).

**Донор кода:** [fliptheweb/fatsecret-mcp](https://github.com/fliptheweb/fatsecret-mcp)
— тот же автор, MIT. Брать только OAuth2/endpoint-логику как референс (у него
openapi-fetch, у нас сырой `fetch`), переписать без новых зависимостей.

### ⚠️ Блокеры — решить ДО кода

- [ ] **IP-whitelist на VPS.** FatSecret блокирует запрос токена с не-whitelisted
  IP (проверка на `/connect/token`). Вписать статический публичный IP VPS
  (146.103.124.48) в Dashboard → IP Restrictions. Динамический IP = токен отлетает.
- [ ] **Русская еда = ПЛАТНЫЙ Premier.** Главная поправка к маркетингу FatSecret:
  бесплатный Basic — US/English only (5000 вызовов/день). Premier Free даёт
  безлимит, но по официальной editions-таблице языки = English; русская
  локализация (`region=RU`) и русская база — только на платном Premier (цена
  по запросу). Бесплатно через API получишь только англоязычный US-датасет.

### Подготовка (аккаунт)

- [ ] Регистрация platform.fatsecret.com → Basic edition
- [ ] Manage API Keys → OAuth2 → Client ID + Client Secret
- [ ] IP Restrictions → IP VPS
- [ ] (опц.) платный Premier — если нужна именно русская еда

### Реализация (база: ~/Documents/yazio-mcp/src/)

- [ ] `src/fatsecret.ts` — класс `FatSecretClient`: OAuth2 client_credentials,
  кэш токена (TTL ~24ч, рефреш по 401/истечению), методы `searchFoods`,
  `getFood`, `getFoodByBarcode`, `autocomplete`. Сырой `fetch` + `URLSearchParams`,
  `format=json`. Без новых депов. Ленивый токен (на первом вызове, не в конструкторе).
- [ ] `src/schemas.ts` — `FatSecret*InputSchema` (zod v4; `food_id = z.string()`,
  НЕ `z.uuid()` — это числовая строка, не UUID).
- [ ] `src/index.ts` — поле `fatSecretClient`; `initializeFatSecret()` БЕЗ
  `process.exit` (Yazio остаётся обязательным, FatSecret опциональный); registerTool
  `fatsecret_*` под `if (this.fatSecretClient)`; хендлеры + `ensureFatSecret()` guard.
- [ ] `.env.example` + README + CLAUDE.md — `FATSECRET_CLIENT_ID/SECRET`, новые тулы,
  требование attribution FatSecret.

### Тулы

- [ ] `fatsecret_search_foods` (query, page?, max_results? 1–50)
- [ ] `fatsecret_get_food` (food_id)
- [ ] `fatsecret_get_food_by_barcode` (barcode GTIN-13) — premier scope `barcode`
- [ ] `fatsecret_autocomplete` (expression, max_results? ≤10) — premier, опц.

### Watch out

- Логгинг только `console.error` (`console.log` ломает stdio JSON-RPC).
- `client_secret` только из env, не логировать.
- FatSecret `food_id` (число) ≠ Yazio `product_id` (UUID) — namespace `fatsecret_*`,
  не переиспользовать `ProductIdSchema`.
- Единицы: FatSecret per-serving kcal/g ≠ Yazio kJ/g — конвертить при кросс-сорсе
  (если когда-то логировать FatSecret-еду в дневник Yazio).

---

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

## Деплой и доступ

- [ ] Поднять на VPS с доступом для нескольких устройств  
  Нужна аутентификация перед mcp-proxy (порт 3000 нельзя открывать без защиты).  
  Варианты: nginx + basic auth, или SSH-туннель на каждом устройстве.

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
