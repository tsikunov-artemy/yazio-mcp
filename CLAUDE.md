# Yazio MCP

Неофициальный MCP-сервер для работы с данными Yazio. Форк [fliptheweb/yazio-mcp](https://github.com/fliptheweb/yazio-mcp) с расширениями.

## Суть проекта

MCP-сервер даёт Claude доступ к дневнику питания Yazio: просмотр, добавление еды, работа с кастомными продуктами, рецептами и блюдами.

Авторизация через email/пароль аккаунта Yazio (токен получается автоматически).

## Запуск локально

```bash
cp .env.example .env
# заполни YAZIO_USERNAME и YAZIO_PASSWORD

npm install
npm run build   # компилирует src/ → dist/
npm run dev     # запуск без компиляции (через tsx)
```

## Подключение к Claude Desktop

В `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yazio": {
      "command": "node",
      "args": ["/Users/tsikunov/Documents/yazio-mcp/dist/index.js"],
      "env": {
        "YAZIO_USERNAME": "your@email.com",
        "YAZIO_PASSWORD": "yourpassword"
      }
    }
  }
}
```

## Структура

```
src/
  index.ts    — MCP сервер, все инструменты
  schemas.ts  — Zod-схемы для валидации входных/выходных данных
  types.ts    — TypeScript типы
dist/         — скомпилированный код (не коммитить)
```

## Инструменты (tools)

### Дневник питания
- `get_food_entries` — записи за день
- `get_daily_summary` — КБЖУ за день
- `add_user_consumed_item` — добавить продукт в дневник
- `remove_user_consumed_item` — убрать из дневника
- `get_user_consumed_items` — полный список (обогащён: названия продуктов + рецептов)

### Продукты
- `search_products` — поиск по базе Yazio
- `get_product` — детали продукта по ID
- `get_user_suggested_products` — рекомендации

### Кастомные продукты (добавлено нами)
- `get_user_products` — список своих продуктов
- `create_custom_product` — создать приватный продукт с КБЖУ
- `delete_custom_product` — удалить кастомный продукт

### Рецепты (добавлено нами)
- `get_user_recipes` — список рецептов пользователя
- `get_recipe` — детали рецепта по ID

### Блюда (добавлено нами)
- `get_user_meals` — список блюд (`GET /v15/user/meals`)

### Пользователь
- `get_user_info` — профиль
- `get_user_weight` — история веса
- `get_user_settings` — настройки
- `get_user_goals` — цели по питанию
- `get_dietary_preferences` — диетические предпочтения
- `get_water_intake` — потребление воды за день
- `add_water_intake` — добавить воду
- `get_user_exercises` — тренировки за день

### FatSecret (добавлено нами — отдельный источник, русская база)
- `fatsecret_search_foods` — поиск русской еды/брендов (которых нет в Yazio), с КБЖУ на порцию
- `fatsecret_autocomplete` — подсказки по частичному вводу

## Важные детали

- Аутентификация: `YAZIO_USERNAME` + `YAZIO_PASSWORD` → токен через `yazio` npm-пакет
- Рецепты вне SDK: работаем через прямой `fetch` к `/v15/user/recipes` и `/v15/recipes/{id}`
- `add_water_intake` — monkey-patch поверх yazio-клиента (SDK не поддерживает, см. [issue #3](https://github.com/juriadams/yazio/issues/3))
- `simple_products` в consumed items — всегда пустой массив, endpoint не существует

### FatSecret (`src/fatsecret.ts`) — без авторизации, скрейп consumer-веба
- Только поиск (справочник), дневник НЕ трогаем — его ведём в Yazio
- Автокомплит: `auto.fatsecret.com?m=26&l=13` (JSONP), русский маркет
- Поиск с КБЖУ: HTML-скрейп `www.fatsecret.ru/калории-питание/search`
- ⚠️ У `www.fatsecret.ru` **просроченный TLS-серт** (CN=fatsecret.com, истёк 2022) → запрос идёт через `node:https` с `rejectUnauthorized:false` **только для этого хоста** (публичный поиск, кредов не передаём; Yazio — строгий TLS)
- ⚠️ Хрупко: парсим их HTML регэкспами (`a.prominent`, `a.brand`, `div.smallText`) → смена вёрстки ломает парсер
- `www.fatsecret.com` НЕ трогать — он за Cloudflare (403)

## Версии

- v0.0.13 — кастомные продукты + обогащение consumed items
- v0.0.14 — обогащение recipe_portions именами рецептов
- v0.0.15 — get_user_recipes, get_recipe, get_user_meals + исследование API
