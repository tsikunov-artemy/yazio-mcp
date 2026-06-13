# Backlog

## FatSecret food-search (новая инициатива)

Добавить инструменты поиска русской еды из FatSecret в этот же MCP — как
справочник-альтернатива к Yazio (дневник ведём в Yazio, FatSecret для поиска КБЖУ
русских продуктов, которых нет/мало в Yazio).

**Путь: реверс CONSUMER-веба, БЕЗ логина, БЕЗ developer-аккаунта, БЕЗ Premier.**
Подтверждено живыми запросами. У FatSecret нет Yazio-style password-grant
(проверено ~12 проектов + декомпил APK — все требуют developer-ключи), НО для
поиска логин и не нужен: регион зашит в хост/маркет, русская БД отдаётся даром.

> Платный Platform API (Premier для RU) НЕ используем — это был тупик. Consumer-веб
> даёт ту же русскую еду бесплатно.

### Эндпоинты (все ВНЕ Cloudflare — `www.fatsecret.com` НЕ трогать, он за CF)

- **Автокомплит (JSON):** `GET https://auto.fatsecret.com/?m=26&l=13&query=<expr>&fn=autoComplete`
  → `autoComplete({...})` (JSONP, снять обёртку). `m=26&l=13` = RU-маркет, `m=1&l=1` = US.
- **Полный поиск (HTML, скрейп):** `GET https://www.fatsecret.ru/калории-питание/search?q=<term>`
  (кириллица url-encoded) → `<a class="prominent" href="/calories-nutrition/<brand>/<slug>">Название</a>`,
  пагинация `&pg=`. Карточку КБЖУ тянуть отдельным GET по href.

### Реализация (база: ~/Documents/yazio-mcp/src/)

- [ ] `src/fatsecret.ts` — класс `FatSecretClient` (БЕЗ авторизации): методы
  `autocomplete(query)` (парс JSONP) и `searchFoods(query)` (скрейп HTML
  `www.fatsecret.ru`), `getFood(href)` (парс карточки КБЖУ). Браузерный
  User-Agent + `Accept-Language: ru` обязательно. Сырой `fetch`.
- [ ] HTML-парсинг: regex или лёгкий парсер (cheerio = новая зависимость — решить
  при реализации; для regex-парса селекторов `a.prominent` зависимость не нужна).
- [ ] `src/schemas.ts` — `FatSecretSearchInputSchema` (query: string), zod v4.
- [ ] `src/index.ts` — поле `fatSecretClient` (всегда доступен, кредов не нужно);
  registerTool `fatsecret_*`; хендлеры.
- [ ] README / CLAUDE.md — описать новые тулы.

### Тулы

- [x] `fatsecret_search_foods` (query, page?) — поиск русской еды, список с КБЖУ ✅ v0.0.16
- [x] `fatsecret_autocomplete` (query) — быстрые подсказки ✅ v0.0.16
- [ ] `fatsecret_get_food` (href/id) — детальная карточка КБЖУ (пока КБЖУ есть прямо в поиске, отдельная карточка не срочна)

### Опционально (если когда-нибудь захочется СИНК дневника FatSecret)

Дневник возможен через ASP.NET WebForms-логин (`foods.fatsecret.com/Auth.aspx?pa=s`,
кука + VIEWSTATE-танцы, `/Diary.aspx?pa=...`). Потребует **HAR-дамп** залогиненной
сессии с устройства (Chrome DevTools → Network → Save as HAR). Сейчас НЕ нужно —
дневник ведём в Yazio.

### Watch out

- Логгинг только `console.error` (`console.log` ломает stdio JSON-RPC).
- **Хрупкость:** парсим HTML их сайта → смена вёрстки ломает селекторы. Автокомплит-JSON
  стабильнее HTML-скрейпа. Закладываться на периодическую починку парсера.
- Если `auto.`/`www.fatsecret.ru` однажды уедут за Cloudflare → `curl_cffi`/headless.
- ToS: скрейп для личного использования — риск низкий, но ставить паузы, разумный rate-limit.
- Описания тулов: явно «ищет в базе FatSecret», id не взаимозаменяемы с Yazio.

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
