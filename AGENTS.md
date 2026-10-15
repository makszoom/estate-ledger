---
name: estate-ledger
version: 1.0.0
updated: 2026-10-15
---

# AGENTS.md — Estate Ledger

> Бесплатный браузерный estate accounting для executor'ов США: инвентарь активов (DOD-value) + cashflow ledger → автосборка Charge-and-Discharge отчёта (Summary of Account + Schedules) в судебном PDF-формате. No account, no upload, 100% local. Free-first (реклама позже); нет paywall в v1.

## Basic Data

| Key | Value |
|-----|-------|
| Домен (план) | https://estateledger.app |
| Repo (план) | makszoom/estate-ledger |
| Hosting | GitHub Pages + Cloudflare DNS |
| Монетизация | free-first → AdSense (лендинг/education при ≥5K pv/мес) + donate USDT (v1.1) |
| GSC | pending (после домена) |
| Analytics | Cloudflare Web Analytics (без куки, YMYL-clean) |
| Проект-папка | ~/Projects/estate-ledger |

## Architecture (план MVP)

```
estate-ledger/
├── PLAN-DETAILED.md          # Подробный план (источник решений)
├── PLAN.md                   # Создаётся при MVP-старте (summary)
├── docs/
│   ├── COMPETITIVE-ANALYSIS.md  # Ресёрч конкурентов (15.10, живая проверка)
│   ├── LAUNCH-CHECKLIST.md      # (создать при deploy)
│   └── landing/                  # workDir лендинга по landing-production skill
│       ├── landing.json          # журнал решений лендинга
│       ├── layout/               # ImageGen-макеты + PROMPTS.md + sections/
│       └── assets/
├── site/                     # корень деплоя (GitHub Pages)
│   ├── index.html            # лендинг
│   ├── app.html              # сам инструмент (единственная страница-приложение)
│   ├── estate-inventory-template.html      # SEO 1
│   ├── executor-accounting-spreadsheet.html # SEO 2
│   ├── final-accounting-probate.html        # SEO 3
│   ├── receipts-disbursements-schedule.html # SEO 4
│   ├── probate-accounting.html              # SEO 5 (education-хаб)
│   ├── executor-fee-calculator.html         # SEO 6 (v2-вход, см. §V2)
│   ├── privacy.html
│   ├── about.html
│   ├── css/style.css          # Trust Legal палитра + Apple Design CSS
│   ├── js/app.js              # роутинг-модули (setup/assets/ledger/report/export)
│   └── js/sample-estate.js    # fictional demo data (конверсия лендинга)
├── scripts/                   # деплой-скрипты (паттерн csv-to-json/scripts/)
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
| План + конкурентный анализ | ✅ 15.10 (commit 79dc072) |
| AGENTS.md документация по паттерну pdf-merge | ✅ 15.10 (commit 35dfd84) |
| landing.json (журнал решений лендинга) | ✅ 15.10 (commit 35dfd84) — 7 секций, 2 ассета, все copy |
| Ниша найдена кроном v3 №6 | ✅ 15.10 ⭐⭐⭐⭐ |
| Gap подтверждён (LegatePro живьём) | ✅ 15.10: free НЕТ вообще |
| Скилл landing-production (метод сборки лендинга) | ✅ создан 15.10 |
| ImageGen-макет лендинга (Phase 1) | ⏳ следующий шаг → approval Макса |
| Домен estateledger.app | ⏳ ПОСЛЕ готового сайта (решение Макса 15.10: сначала github.io) |
| Лендинг (landing.json + макет) | ⏳ следующий шаг |
| MVP модули E/A/B/C/D/P/S | ❌ не начато |
| SEO-страницы + education | ❌ после MVP |
| GSC + sitemap | ❌ после домена |
| AdSense | ❌ после 5K pv (реалистично 8-12 недель post-launch) |

## Priorities (порядок работ, решено с Максом 15.10)

1. **День 0:** landing.json (✅ выполнено) + ImageGen-макет лендинга → approval Макса. **Домен НЕ покупаем до готового сайта** (Zuev: нулевые затраты до продакшена; ogfy/imgtopdf живут на github.io)
2. **День 1-4:** MVP-модули (код не зависит от домена)
3. **День 5:** лендинг по утверждённому макету + Sample Estate
4. **День 6:** deploy на GitHub Pages (makszoom.github.io/estate-ledger) + donate-кнопка USDT
5. **День 7-14:** 6 SEO страниц + 2-3 education-гайда + Reddit/FB посты
6. **Позже, когда сайт готов:** покупка estateledger.app → DNS/CNAME → GSC → sitemap → заявка AdSense при трафике
7. **Indexing-гигиена:** на github.io-фазе `<meta name="robots" content="noindex">` → при переходе на домен убрать → чистая индексация с кастомного домена без каннибализации/301-потерь


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

## Kill Criteria (Зуев-стопы)

- Launch+30д: <300 pv/мес → заморозка контента
- Launch+60д: <500 pv/мес → пересмотр; ≥1,500 — продолжаем
- Launch+90д: ≥5K pv → включаем AdSense
- Sample→Start конверсия: ≥15%

## Documentation Update Rule

After significant changes — update this file and relevant skill before ending session. Significant: files/dirs added/removed, stack changes, key URLs/IDs, architecture, monetization config. Not significant: single content pages, cosmetic CSS, temporary fixes.