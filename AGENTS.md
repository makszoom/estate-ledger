---
name: estate-ledger
version: 2.1.0
updated: 2026-10-17 (v2 complete + domain LIVE)
---

# AGENTS.md — Estate Ledger

> Бесплатный браузерный estate accounting для executor'ов США: инвентарь активов (DOD-value) + cashflow ledger → автосборка Charge-and-Discharge отчёта (Summary of Account + Schedules) в судебном PDF-формате. No account, no upload, 100% local. Free-first (реклама позже); нет paywall в v1.

## Basic Data

| Key | Value |
|-----|-------|
| **Live URL** | **https://estateledger.app** (домен LIVE 17.10, HTTPS enforced, canonical) |
| GitHub.io (redirect-фаза) | https://makszoom.github.io/estate-ledger/ (работает параллельно; в SEO не используется) |
| Repo | **makszoom/estate-ledger** (Pages main/, custom domain + https_enforced через GitHub API) |
| DNS (CF) | 4×A 185.199.108-111.153 + CNAME www, все DNS only (proxy OFF обязателен) |
| Hosting | GitHub Pages (13 файлов, deploy = Python requests + REST API, PAT из ~/Projects/csvtojson/.env) |
| Монетизация | free-first → 3 канала при ≥5K pv (ROADMAP.md §Монетизация): donate/affiliate/крипто-сети — AdSense из РФ недоступен (деактивации авг 2024) |
| GSC | ✅ sc-domain:estateledger.app verified (TXT через CF Authorize), sitemap 8 URL, SA gsc-bot Full. Ресабмит 18.11.2026 (204) |
| Analytics | ✅ Cloudflare Web Analytics (без куки, YMYL-clean) — подключён 17.11, на всех 9 страницах |
| Donate | ✅ USDT TRC-20 `TLdbF5RTXHTax71H9cAeU573pXxtMPZUuw` (общий OGFY-кошелёк, решение Макса) + Copy-кнопка, commit 8aa4198 |
| Крон-дата решения | Д90 = 2027-01-15 (kill <300 pv/30д) |
| Проект-папка | ~/Projects/estate-ledger |


## SEO-гигиена 14.11.2026 (аудит + исправления)

Аудит нашёл три класса проблем; все закрыты, регрессию держит `tests/test-seo.js` (53 проверки).

| Было | Стало |
|---|---|
| title >60 символов на 5 из 7 лендингов (максимум 80 у `/final-accounting-probate`) — обрезались в выдаче | все ≤60, каждый начинается с фразы запроса |
| description >160 на 4 страницах (до 180) | все ≤160, формат «кому / сколько / в чём подвох» |
| **FAQPage размечен в JSON-LD, но не виден на странице** на 6 лендингах — нарушение правил Google по structured data | FAQ развёрнут в видимые `<details>` + CSS, вопросы для экрана берутся из той же схемы |
| на главной наоборот: 4 видимых FAQ без разметки | добавлена FAQPage-схема из видимых вопросов |
| `privacy.html` несла шаблонную FAQPage с вопросами «Will my court accept this?» | схема убрана — на странице приватности эти вопросы неуместны |
| ни одного `<lastmod>` в sitemap | 8 URL с реальными датами |
| `app.html` индексировался (3 показа в GSC), но отсутствовал в карте, без H1 и без description | добавлен в sitemap (priority 0.9), H1 на логотипе, description, WebApplication JSON-LD |
| тонкий контент: 260 и 286 слов | 353 и 485 (FAQ дал объём без воды) |

**Деплой:** `scripts/deploy.py` — новый, сравнивает содержимое с нормализацией CRLF (git-blob SHA на Windows врёт: локально CRLF, в репозитории LF, «изменённым» выглядит каждый файл). Бэкап перед правками: `backup-2026-11-14/`.

**GSC:** sitemap пересабмичен (стоял с 17.10), `lastSubmitted` = 2026-11-14.

---

## Адаптивность 17.11.2026 (мобильные дефекты)

Оба дефекта не видны на скриншоте — только замером `document.documentElement.scrollWidth`
против ширины эмуляции. Регрессию держит `tests/test-responsive.js` (14 проверок).

| Было | Стало |
|---|---|
| На главной на `.cmp` висел инлайн `grid-template-columns:1.2fr 1fr 1fr`. Инлайн сильнее любого селектора, поэтому правило `@media(max-width:880px){.cmp{grid-template-columns:1fr}}` не срабатывало: сетка сравнения оставалась трёхколоночной и растягивала страницу **до 548px при экране 390px** | пропорции вынесены в класс `.cmp-3`, инлайн убран, media сворачивает сетку в одну колонку — 390px |
| В калькуляторе `<table id="tbl">` (4 колонки: State/Schedule/Basis/Statute) без контейнера прокрутки — страница растягивалась **до 459px** | `.table-wrap{overflow-x:auto}` + обёртка, таблица прокручивается внутри себя |
| Таблицы на `/estate-inventory-template` и `/final-accounting-probate` тоже без обёртки (2 колонки, влезали по случайности) | обёрнуты, чтобы не сломались при росте числа колонок |

**Урок:** инлайн-стиль раскладки нельзя переопределить через `@media` — специфичность инлайна выше любого селектора. Если в инлайне стоит `grid-template-columns`, `grid-template-rows` или `flex-direction`, медиазапрос для этого свойства мёртв.

**Деплой:** `scripts/sync-root.py` → `scripts/deploy.py`, 4 файла, все 200.

---

## Соответствие интенту 18.11.2026 (шаблон, авторство, связность)

Аудит GSC: 12% всех показов сайта (14 из 113) — запрос **«estate inventory template»**, позиция **74**. Выдача по нему: четыре из десяти результатов — **прямые PDF-бланки** (университет Конкорд, Freshwater Trust, Heritage Law, TIAA), остальные — Schwab, суд Флориды, Pinterest. По правилу «смотри, что ранжируется, прежде чем строить» (`product-seo` → `task-pages-and-tools`) статья в такой выдаче не встанет: нужен файл.

| Было | Стало |
|---|---|
| На `/estate-inventory-template` ноль вхождений `download`, `.csv`, `.pdf`, `.xlsx` — только текст и кнопка «постройте в инструменте» | блок **Download the blank template**: `templates/estate-inventory-template.csv` (7 колонок, 5 примеров) + `templates/estate-ledger-template.csv` (8 колонок). Без регистрации и email |
| Колонки шаблона могли разойтись с инструментом | заголовки **совпадают с экспортом** `js/app.js` (`Name,Class,DOD value,In probate?,Value source,Reference,Sold`), классы активов — из `ASSET_CLASSES` (`core.js`). Заполненный вручную лист сверяется с Ledger без перенабора |
| Доки трижды требуют editorial-дату (AGENTS.md §Key Decisions п.4, COMPETITIVE-ANALYSIS §Settled и §Выводы), но ни на одной странице её не было месяц | **Last checked 2026-11-17** на всех 9 страницах |
| В JSON-LD не было `author` и `dateModified` — слабый сигнал для YMYL | добавлены во все блоки (author = Organization Estate Ledger; выдуманный эксперт запрещён) |
| `/executor-accounting-spreadsheet` и `/receipts-disbursements-schedule` — **сироты**: ноль входящих внутренних ссылок | по 3 входящих с `/estate-inventory-template`, `/probate-accounting`, `/final-accounting-probate` |
| Ссылки в инструмент без меток | 24 ссылки с `utm_source=<slug>&utm_medium=site` |
| `deploy.py` не знал `.csv` и не заходил в подпапки (`os.listdir`) | `EXTS` += `.csv`, обход через `rglob`; `sync-root.py` тоже рекурсивный |

**Тест:** `tests/test-intent.js` (41 проверка) — существование шаблонов, совпадение колонок с экспортом, editorial-дата, `author`/`dateModified` в схеме, отсутствие сирот, UTM.

**Урок:** требование, записанное в доках, но не покрытое тестом, живёт ровно до первого релиза. Editorial-дата стояла в трёх документах и отсутствовала на всех страницах.

**Деплой:** 11 файлов (9 страниц + 2 CSV), 200/201. CSV отдаются как `text/csv`.

---

## Утечка внутренних документов 18.11.2026 (закрыта)

Pages настроен на `main` + **корень**, поэтому публично доступно всё, что лежит в репозитории, — не только сайт. Проверка живьём нашла открытыми:

| Путь | Что это было |
|---|---|
| `/PLAN-DETAILED.md` | план проекта с экономикой, kill-критериями и разбором конкурентов |
| `/AGENTS.md` | инструкции агенту по проекту |
| `/docs/V2-SPEC.md`, `/docs/COMPETITIVE-ANALYSIS.md`, `/docs/ROADMAP.md`, `/docs/CF-TOKEN-STEPS.md` | спека, анализ конкурентов, roadmap с монетизацией, инструкция по Cloudflare-токенам |
| `/docs/landing/*.png` | 20+ скриншотов внутренних экранов |
| `/tests/*` (25 файлов) | исходники тестов |
| `/site/*` (14 файлов) | **полный дубль сайта** — плюс риск дублированного контента для Google |
| `/scripts/sync-root.py`, `/package.json` | скрипты и манифест |

Удалено 93 файла через `scripts/clean-main.py` (идемпотентный, с `--dry-run` и страховкой: отказывается удалять `js/`, `templates/`, `css/`). Всё перечисленное остаётся в ветке `source` — история и доки не потеряны, они просто больше не публикуются.

**Проверка после чистки:** 10 путей → 404; сайт целиком жив (страницы, `js/core.js`, `js/app.js`, оба CSV, robots, sitemap, favicon — 200); приложение грузится, 5 вкладок, ноль JS-ошибок.

**Урок:** «сайт в репозитории» и «сайт на Pages» — не одно и то же, если Pages смотрит в корень. Любой служебный файл, положенный рядом с `index.html`, становится публичным. Держать внутреннее в отдельной ветке (`source`) и проверять живьём, а не по `.gitignore`: `.env.example` Pages не отдаёт (файлы с точкой), а `PLAN-DETAILED.md` отдавал.



---

## Architecture (план MVP)

```
estate-ledger/
├── PLAN-DETAILED.md          # Подробный план v1 (источник решений v1)
├── docs/
│   ├── COMPETITIVE-ANALYSIS.md  # Ресёрч конкурентов (15.10, живая проверка)
│   ├── ROADMAP.md               # ★ v2/v3 решение: дата Д90=2027-01-15, kill-условия, триггеры
│   ├── V2-SPEC.md               # ★ v2 полная спека (§0 self-audit 12 gaps) — источник решений v2
│   ├── LAUNCH-CHECKLIST.md      # (создать при deploy домена)
│   └── landing/
│       ├── landing.json          # журнал решений лендинга
│       ├── layout/               # ImageGen-макеты (hero-v6 approved) + PROMPTS.md
│       ├── page-template.html    # ★ переиспользуемый шаблон SEO-страниц (D8)
│       └── assets/
├── site/                     # корень деплоя (GitHub Pages, LIVE)
│   ├── index.html            # лендинг (+guides-block, donate-modal, "Why is it free?" fix)
│   ├── app.html              # сам инструмент (6 вкладок; ЕДИНСТВЕННАЯ страница-приложение)
│   ├── estate-inventory-template.html      # SEO 1
│   ├── executor-accounting-spreadsheet.html # SEO 2
│   ├── final-accounting-probate.html        # SEO 3
│   ├── receipts-disbursements-schedule.html # SEO 4
│   ├── probate-accounting.html              # SEO 5 (education-хаб, глоссарий, state notes)
│   ├── privacy.html
│   ├── templates/            # ★ скачиваемые CSV-шаблоны (18.11): инвентарь + реестр,
│   │                         #   колонки совпадают с экспортом js/app.js
│   ├── sitemap.xml           # estateledger.app URLs (8); canonical-теги на всех 9 страницах; корень КОРЕНЬ = Pages source
│   ├── robots.txt
│   ├── css/style.css          # Trust Legal палитра + Apple Design CSS
│   ├── js/core.js             # ★ вся логика (649 строк): Store, assets, tx, sales, report, export
│   ├── js/app.js              # UI glue (tabs, toasts, sample-banner)
│   ├── js/fee-schedules.js    # 24 штата, статут-refs (D11)
│   ├── js/bank-import.js      # CSV parse/mapping/dedupe (D12)
│   └── js/sample-estate.js    # Jane E. Sample demo (?sample=1, idempotent)
├── tests/                     # ★ 581 проверка: 14 unit-файлов + 14 e2e-day1..18 (CDP 9333, profile + --disk-cache-size=1)
├── scripts/                   # деплой-скрипты
└── .env                       # секреты (НЕ в git)
```

## Stack

| Layer | Tech | Cost |
|-------|------|------|
| Frontend | HTML + CSS + vanilla JS | $0 |
| Persist | localStorage (+ JSON export) | $0 |
| PDF | print-CSS (браузерная печать) | $0 |
| Hosting | GitHub Pages | $0 |
| Domain | CF Registrar (oplatym) | ~$12/yr |
| Analytics | Cloudflare Web Analytics | $0 |
| Ads (later) | AdSense | $0 fix |

## Product Modules (MVP v1.0)

- **E (Setup):** decedent/case №/штат/дата смерти/роль; мульти-estate
- **A (Assets):** классы (real estate/bank/brokerage/cash/personal/vehicle/business/other), DOD value, источник оценки, флаг «passes outside probate» (yes/no/unknown — unknown не двигает итоги)
- **B (Cashflow):** единый реестр, 4 семантики (Money in / Money out / Distribution / Reimbursable), поля date/amount/description/payee/purpose/source/flag Principal–Income/чек №
- **C (Asset Sale):** proceeds vs DOD → авто Gain/Loss; НЕ дублировать как income (двойной счёт)
- **D (Report):** Charge-and-Discharge Summary (CHARGES = CREDITS автопроверка + красный флаг расхождений), Income отдельно от Principal
- **P (Export):** PDF print-CSS («IN THE MATTER OF THE ESTATE OF...», oath/signature block), CSV, JSON backup/restore (+ еженедельный reminder-banner)
- **S (Sample Estate):** fictional read-only demo с лендинга (конверсия)

**v1 НЕ делает:** carry-value переключатель (CA/KY/OH/MN/SC/VA/WI — v2), формы конкретных судов (CA GC-405, NY — v2/v3), банк-импорт, e-sign, cloud-sync, аккаунты, executor fee calculator (v2-отдельный SEO-калькулятор), multi-estate pro (v3).

## Design (подтверждено 15.10)

**Palette Trust Legal** (для аудитории 50-75, YMYL):
- Фон: `#FAFAF8` (бумажный белый, тёплый)
- Текст: `#1A1A1A`
- Accent/navy: `#1E3A5F` (юридическая синь)
- Баланс-OK: `#2D6A4F` (зелёный ТОЛЬКО для Total Charges = Credits ✓)
- Ошибки/расхождения: `#B00020`

**Типографика:** UI = Inter; **судебный PDF = Georgia/serif** (judicial convention). Base 16-18px, touch-таргеты ≥44px (возраст!). Без тёмной темы. Apple Design CSS: modal class-toggle (никогда display:flex !important — баг csvtojson Day 1), :active scale(.97), letter-spacing в em, reduced-motion. Motion: CSS-only без GSAP (landing-production/motion-recipes-css.md).

## Key Decisions

1. **Free-first, no paywall** — концепция Макса (15.10): популярный платный продукт → наша бесплатная копия → копим трафик → AdSense по факту. Wedge структурный: per-estate вендор не может отдать отчёт бесплатно.
2. **Сайт, не расширение** — probate = one-time 6-18 мес процесс; SEO-спрос живой (Suggest probate 334/estate accounting 216); не тратит CWS-слот.
3. **AdSense реклама ТОЛЬКО на лендинге/education** — не внутри инструмента (судебный отчёт с рекламой = удар по доверию).
4. **YMYL-гигиена:** education-first дисклеймер на каждой странице, .gov-ссылки (IRS Pub 559), никогда «legal advice», editorial «Checked 2026-XX-XX» (паттерн Settled).
5. **JSON backup = фича не опция** — юзер держит данные 6-18 мес.
6. **Sample Estate до данных юзера** — конверсионный ход из Settled.

## Development Conventions

- Деплой: Python requests + GitHub REST API (паттерн csv-to-json/scripts/deploy-*.py)
- Домен/оплата: oplatym.ru (зарубежная Visa); CF Registrar
- CSS-only: никаких анимационных либ
- Скиллы: landing-production (лендинг), micro-saas-static-frontend patterns, Apple Design CSS референс
- Валидация расчётов: контрольные кейсы sample-estate (сверка Total Charges = Credits)
- Backup перед деплоем: backup-YYYY-MM-DD/
- **Требование из доков = тест.** Если правило записано здесь (editorial-дата, YMYL-дисклеймер, .gov-ссылки, колонки шаблона = экспорт), оно должно проверяться в `tests/test-*.js`. Правило без теста не выполняется: editorial-дата стояла в трёх документах и отсутствовала на всех страницах месяц (выяснилось 18.11.2026)
- **Инлайн-стиль раскладки запрещён.** `grid-template-columns`, `grid-template-rows`, `flex-direction` в атрибуте `style` нельзя переопределить через `@media` — инлайн сильнее селектора. Проверяется `tests/test-responsive.js`
- **Pages отдаёт КОРЕНЬ репозитория.** Всё, что положено рядом с `index.html` в ветке `main`, становится публичным: доки, тесты, дубли сайта. Внутреннее держим в ветке `source`; после добавления любых файлов проверяем живьём (`curl -o /dev/null -w "%{http_code}"`), а не по `.gitignore`. Чистка — `scripts/clean-main.py --dry-run`

## Status

| Component | Status |
|-----------|--------|
| План v1 + конкурентный анализ | ✅ 15.10 (commit 79dc072) |
| landing.json + hero-v6 макет (approved) | ✅ 15.10 |
| MVP модули E/A/B/C/D/P/S (Дни 1-7) | ✅ 16-17.10 — **219 тестов PASS** (99 unit + 118 e2e) |
| SEO 5 страниц + privacy + sitemap/robots (Д8) | ✅ 17.10 (schema FAQPage, noindex) |
| **DEPLOY: GitHub Pages LIVE** | ✅ 17.10 (commit eea4c00) — 13 файлов, все URL 200 OK, live E2E 20/20 |
| Fix: compare-секция «tariff look» | ✅ 17.10 (0b43915) — «Why is it free?» + EstateExec anonymized |
| Fix CRITICAL: absolute hrefs → 404 | ✅ 17.10 (a8c8d82) — 10 линков в index.html + ../index.html в app.html; full link-crawl PASS |
| docs/ROADMAP.md (v2 решение, kill) | ✅ 17.10 (0821269) |
| docs/V2-SPEC.md (+§0 self-audit 12 gaps) | ✅ 17.10 (b3791ad → 35c369d) |
| v2: Д9-Д10 carry-value (ядро+UI+печать+sample, vision-verified) | ✅ 17.10 (e44eea5, 7a71d85, 12dbe95) — 284 теста |
| v2: Д11 fee calculator (24 штата + SEO-лендинг) | ✅ 17.10 (ee0bb83) — 344 теста |
| v2: Д12-13 bank CSV import (parse/dedupe/preview/commit) | ✅ 17.10 (cda0759) — 381 тест, LIVE 20/20 |
| v2: Д18 multi-estate dashboard (cards/archive/restore) | ✅ 17.10 (f215662) — 472 теста, LIVE 19/19 |
| v2: Д19-20 полировка (debug-sweep, vision-ревью всех вью, live-верификация) | ✅ 17.10 |
| **Домен estateledger.app** | ✅ 17.10 — куплен ($8.20 1-й год, CF Registrar/oplatym), DNS через Edit-zone-DNS токен (.env), Pages cname + HTTPS enforced |
| **Canonical + noindex снят** | ✅ 17.10 (commits 7fd71bb + 56bb7b6 fix root-duality: Pages отдаёт КОРЕНЬ, не site/!) |
| **GSC** | ✅ 17.10 — TXT verify (Макс Authorize), SA Full, sitemap submitted; URL inspection NEUTRAL → краул 1-7 дней. На 18.11: 8 URL, ресабмит 204 |
| **Donate USDT-модалка** | ✅ 17.10 (8aa4198) — адрес TLdbF5RTXHTax71H9cAeU573pXxtMPZUuw (OGFY-кошелёк) + Copy-кнопка, live-verified |
| Reddit-FB посты | ⏸ руками Макса (тексты готовы) |
| Мониторинг трафика | gsc-monitor.py видит sc-domain:estateledger.app; первый чек 3-7 дней |
| **Адаптивность: мобильные дефекты** | ✅ 17.11 (92d58d9) — инлайн `grid-template-columns` на `.cmp` ломал `@media` (548px при экране 390), таблица калькулятора без прокрутки (459px); `tests/test-responsive.js` 14 проверок |
| **Интент «template»: скачиваемые CSV** | ✅ 18.11 (abcd294) — `templates/*.csv` (7 и 8 колонок, совпадают с экспортом `app.js`), блок Download на `/estate-inventory-template`; страница не отвечала на интент при 12% показов сайта и позиции 74 |
| **Editorial-дата + авторство** | ✅ 18.11 — `Last checked 2026-11-17` на 9 страницах, `author` + `dateModified` в JSON-LD. Требование стояло в доках месяц и не выполнялось |
| **Сироты и UTM** | ✅ 18.11 — `/executor-accounting-spreadsheet` и `/receipts-disbursements-schedule` получили по 3 входящих ссылки; 24 ссылки в инструмент с `utm_source` |
| **Тесты** | ✅ 18.11 — **581 проверка** (345 unit/SEO/адаптивность/интент + 236 e2e), 0 FAIL |
| **Чистка main от внутренних файлов** | ✅ 18.11 — 93 файла убраны из публикуемой ветки: `PLAN-DETAILED.md`, `AGENTS.md`, `docs/` (5), `docs/landing/*.png` (20+), `tests/` (25), `site/` (14, дубль сайта), `scripts/`, `package.json`. Все 10 путей → 404, сайт жив. Скрипт `scripts/clean-main.py` с `--dry-run` и защитой `js/`/`templates/`/`css/` |

## V2 Development Plan (см. docs/V2-SPEC.md — полный)

| День | Фича | Суть |
|---|---|---|
| Д9 | Миграция v1→v2 + carry core | state.version migration + reportCarry (charges/credits, proceeds В receipts) + 18 unit |
| Д10 | Carry UI | basis-switch в Setup, confirm-modal, badge, sample carry-demo + 20 e2e |
| Д11-13 | Fee calculator | FEE_SCHEDULES 15 штатов (CA §10810 gross-probate basis!) + «My fee» в app + SEO-лендинг |
| Д14-16 | Bank CSV import | PapaParse, mapping, accept/modify/reject, dedupe fingerprint, quota guard |
| Д17 | CA court worksheet | GC-405 companion (⚠ GC-405 = conservatorship, основной CA-путь = carry Ф1) |
| Д18 | Multi-estate dash | dash-таблица + archive |
| Д19-20 | Полировка + sitemap-обновление | полный регресс каждый день |

**Правило Д9-Д20:** каждый день unit+E2E+скрин; полный suite-регресс; деплой на Pages после каждого дня (тот же API-паттерн).


## Ad Placement Map (монетизация, заранее решено)

**Принцип (Макс, 15.10): free-first, реклама = основная монетизация. Слоты физически ИЗОЛИРОВАНЫ от инструмента.**

| Страница | Ad-слоты | Когда |
|---|---|---|
| SEO-страницы (6 шт) | top-of-content (336x280 inline) + end-of-content (responsive) + sidebar 300x600 desktop | после трафика |
| probate-accounting.html (education-хаб) | in-article между секциями + end-of-guide | после трафика |
| index.html (лендинг) | между секциями ПОСЛЕ pain-comparison + над footer | опционально (если RPM-выгода окупит UX) |
| future гайды (10+ education) | in-article | основной поток дохода |
| **app.html (инструмент)** | ❌ НИКОГДА — head чистый без ад-скриптов | — |
| Sample Estate view | ❌ нет | — |
| PDF print view | ❌ никогда (документ юзера) | — |
| privacy/about/404 | ❌ нет | — |

**Правила:**
- Ad-скрипты ТОЛЬКО в head SEO/landing/guide страниц; app.html физически без них
- ads.txt в корне при заявке
- Прогноз дохода: legal+US in-content display RPM $15-30 → при 5K pv = $75-150/мес; scaling с education-гайдами (10-20 страниц: $200-600/мес при 20-30K pv)
- GDPR (EU-трафик): Google Consent Mode v2 в consent.js (~30 строк), ад-скрипты после consent
- AdSense-заявка: НЕ раньше стабильных 5K pv/мес 2 месяца подряд; approval ~2 нед
- **v2-правило (17.10): новые SEO-страницы (executor-fee-calculator) проектируются СРАЗУ с пустыми ad-placeholder-комментариями (<!-- ADSLOT-TOP -->) — включение рекламы позже = вставка 1 блока, не редизайн; noindex до домена, sitemap-обновление в Д19-20**

## Kill Criteria (Зуев-стопы)

- Launch+30д: <300 pv/мес → заморозка контента
- Launch+60д: <500 pv/мес → пересмотр; ≥1,500 — продолжаем
- Launch+90д: ≥5K pv → включаем AdSense
- Sample→Start конверсия: ≥15%

## Documentation Update Rule

After significant changes — update this file and relevant skill before ending session. Significant: files/dirs added/removed, stack changes, key URLs/IDs, architecture, monetization config. Not significant: single content pages, cosmetic CSS, temporary fixes.