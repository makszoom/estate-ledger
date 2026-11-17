# Site profile — estate-ledger

Читать в начале каждой сессии. Обновлять, когда владелец что-то решает.

## Product

- **Name:** Estate Ledger
- **Site:** https://estateledger.app
- **What it does, in one line:** бесплатный браузерный учёт наследства для executor'ов США — инвентарь активов по стоимости на дату смерти, реестр движений денег и автосборка отчёта Charge-and-Discharge в судебном формате.
- **Language of the site:** английский (рынок США). Коммуникация с владельцем — русский.
- **Markets that matter:** США. Приоритетные штаты — CA, NY, TX, FL, PA, VA, NC (там прописаны судебные форматы и state notes). Отдельно CA/KY/OH/MN/SC/VA/WI — штаты, где обязателен carry-value подход.

## Who pays

**Платящих нет — модель free-first.** Решение владельца (15.10.2026): бесплатный инструмент
копит трафик, монетизация включается при ≥5000 pv/мес. AdSense недоступен (Google
деактивировал RU-based аккаунты в авг 2024), поэтому каналы: ① donate USDT TRC-20 с первого
дня ② affiliate на SEO-страницах ③ крипто-рекламные сети при 5K pv.

Кто пользователь: executor / administrator / personal representative — обычно 50–75 лет,
ведёт дела умершего родственника 6–18 месяцев, боится судебных требований и переплаты юристу
($3–10K). Платные конкуренты: EstateExec $199/estate, Settled $19.99, SwiftProbate $39.

## Topics

Согласовано с владельцем: 17.10.2026, уточнено 18.11.2026

**Pile A: продукт и есть ответ** (работать здесь)

| Тема | Главные запросы | Страница |
|---|---|---|
| Шаблон инвентаря | estate inventory template (14 показов, поз. 74), inventory of assets template (6, поз. 62), estate inventory list template (2, поз. 85), estate inventory example (1, поз. 98) | `/estate-inventory-template` |
| Учёт для executor'а | executor accounting spreadsheet | `/executor-accounting-spreadsheet` |
| Итоговый отчёт | final accounting probate (1 показ, поз. 30), final accounting for estate (1, поз. 81) | `/final-accounting-probate` |
| Поступления и выплаты | receipts and disbursements schedule | `/receipts-disbursements-schedule` |
| Гонорар исполнителя | executor fee calculator | `/executor-fee-calculator` |

**Pile B: только трафик, отложено**

| Тема | Почему отложено |
|---|---|
| Общие гайды по probate («what is probate», «how long does probate take») | Нет продукта-ответа: человек ищет объяснение, а не инструмент. Конкуренты — юрфирмы и Nolo с DR 70+. Годится как education-хаб позже, не как вход |
| Штат-специфичные гайды (50 страниц) | По ROADMAP включаются только при ≥30 визитах/нед на probate-хаб. Сейчас трафика нет — страницы будут пустыми |
| Формы конкретных судов (CA GC-405, NY AF-series) | Продукт их не заполняет. Обещать «court-ready form» нельзя — только companion worksheet |

## Standing decisions

- **Никогда не «legal advice».** Education-first дисклеймер на каждой странице, ссылки на .gov (IRS Pub 559), editorial-дата «Last checked ГГГГ-ММ-ДД». Записано в AGENTS.md §Key Decisions п.4.
- **Автор — Organization, не выдуманный эксперт.** Владелец не практикующий probate-специалист США; придумывать имя нельзя. В JSON-LD `author = Organization Estate Ledger`.
- **Реклама только на SEO/лендинг/education.** Никогда в `app.html`, print-вью, sample-вью. ADSLOT-плейсхолдеры остаются пустыми.
- **Никогда не обещать «certified court form».** Отчёт — companion worksheet, не официальная форма. Согласовано с конкурентным анализом (Settled делает так же).
- **Kill-условие:** <300 pv/30д на Д90 (2027-01-15) → заморозка контента.

## Where things live

- **Продукт меняется:** `site/` (единственный источник), деплой `scripts/sync-root.py` → `scripts/deploy.py`.
- **Аналитика:** Cloudflare Web Analytics (cookieless), подключён 17.11.2026, на всех 9 страницах.
- **Search Console:** `sc-domain:estateledger.app`, сервисный аккаунт gsc-bot с правами Full.
- **Тесты:** `tests/test-seo.js` (53), `tests/test-intent.js` (41), `tests/test-responsive.js` (14).
- **Внутренние доки НЕ публикуются:** Pages отдаёт корень `main`, внутреннее живёт в ветке `source`. Чистка — `scripts/clean-main.py`.

**Дата последней сверки фактов продукта:** 2026-11-18
