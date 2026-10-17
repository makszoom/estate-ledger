# Как создать Cloudflare API токен (Edit zone DNS) — 2 минуты

## Шаг 1: Открой страницу токенов

Прямая ссылка:
**https://dash.cloudflare.com/profile/api-tokens**

(справа сверху аватар → My Profile → API Tokens → Create Token)

## Шаг 2: Выбери шаблон

Нажми **Use template** напротив **Edit zone DNS** (шаблон №2 в списке).

## Шаг 3: Настрой права (важнее всего)

В секции **Permissions** уже должно стоять:
- `Zone` → `DNS` → `Edit`

В секции **Zone Resources** — сузим до одного домена (безопаснее):
- Replace: `Include - All zones` → **`Include - Specific zone` → estateledger.app**

(Bypass cache / TTL строки не трогай)

## Шаг 4: (опционально) IP-фильтр

`Client IP Address Filtering` → можно указать твой IP 192.168.1.64 — но учти,
что это внутренний адрес; наружный у тебя динамический, фильтр сломается после
ребута роутера. **Рекомендую оставить пустым.**

## Шаг 5: Create Token

Скопируй токен (показывается ОДИН раз). Вставь его в файл:

```
C:\Users\MiniPC\Projects\estate-ledger\.env
```

Добавь строку (в конец):
```
CLOUDFLARE_API_TOKEN=<ВСТАВЬ_ТОКЕН_СЮДА>
```

(если файла нет — просто создай блокнотом, я продолжу)

## Что дальше (я делаю после «токен в .env»)

1. Проверю токен (`user/tokens/verify`) — право write
2. Добавлю автоматически: 4× A-записи (185.199.108-111.153) + CNAME www → makszoom.github.io (все DNS only)
3. GitHub Pages: `PUT cname=estateledger.app` + HTTPS-enforce
4. Сверка DNS резолва (185.199.x из домена)
5. Обновление canonical/sitemap на 7 страницах + снятие noindex + коммит
6. GSC-настройка (property sc-domain:estateledger.app + sitemap + request indexing)
7. Full live-регресс по домену