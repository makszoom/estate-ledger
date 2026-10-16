---
name: estate-ledger
version: 2.0.0-spec
updated: 2026-10-17
---

# AGENTS.md — Estate Ledger

> Бесплатный браузерный estate accounting для executor'ов США: инвентарь активов (DOD-value) + cashflow ledger → автосборка Charge-and-Discharge отчёта (Summary of Account + Schedules) в судебном PDF-формате. No account, no upload, 100% local. Free-first (реклама позже); нет paywall в v1.

## Basic Data

| Key | Value |
|-----|-------|
| Live URL (github.io-фаза) | **https://makszoom.github.io/estate-ledger/** (LIVE 17.10, noindex до домена) |
| Домен (план, отложен Максом 17.10) | https://estateledger.app |
| Repo (fact) | **makszoom/estate-ledger** (создан 17.10 через GitHub API, Pages main/ enabled) |
| Hosting | GitHub Pages (13 файлов, deploy = Python requests + REST API, PAT из ~/Projects/csvtojson/.env) |
| Монетизация | free-first → AdSense (лендинг/education при ≥5K pv/мес) + donate USDT modal (адрес ждёт Макса) |
| GSC | pending (после домена) |
| Analytics | Cloudflare Web Analytics (без куки, YMYL-clean) — пока НЕ подключен |
| Проект-папка | ~/Projects/estate-ledger |

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
│   ├── sitemap.xml           # github.io canonical (сменить при домене)
│   ├── robots.txt
│   ├── css/style.css          # Trust Legal палитра + Apple Design CSS
│   ├── js/core.js             # ★ вся логика (649 строк): Store, assets, tx, sales, report, export
│   ├── js/app.js              # UI glue (tabs, toasts, sample-banner)
│   ├── js/fee-schedules.js    # 24 штата, статут-refs (D11)
│   ├── js/bank-import.js      # CSV parse/mapping/dedupe (D12)
│   └── js/sample-estate.js    # Jane E. Sample demo (?sample=1, idempotent)
├── tests/                     # ★ 381 тест: 9 unit-файлов + e2e-day1..12/d9-ui (CDP 9333, профиль 2, cache-size=1)
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
| **v2: Д17-18 (cудебный worksheet CA + multi-estate dash)** | ⏳ NEXT |
| Домен estateledger.app | ⏸ ОТЛОЖЕН Максом 17.10 («давай отложим») |
| USDT-кошелёк donate | ⏸ ждёт адрес от Макса (placeholder в модалке) |
| GSC / AdSense / Reddit-FB посты | ⏸ после домена / 5K pv / руками Макса |

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