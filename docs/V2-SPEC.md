# Estate Ledger — V2 SPEC (полная спецификация реализации)

> Создан 17.10.2026, решение Макса: **строим весь v2 сразу (все 5 фич), не ждём триггеров ROADMAP**.
> Оценка работ: **3–4 недели** (13-17 рабочих дней кода + тестов).
> Базируется на: v1.0 (219 тестов PASS, core.js модульная архитектура), ROADMAP.md, факты из живой
> проверки EstateExec (carry-value = charges/credits подход, bank import через Plaid/CSV),
> statutory fee-расписания штатов (CPC §10810, NY SCPA, FL, VA, NC, MD, WI). Ссылки на источники — в конце.

---

# Ф1. CARRY VALUE SWITCH (Standard ↔ Carry)

## Что делает
Переключатель в Setup (радио): **Accounting basis: Standard (market value) | Carry value**.
buildAccountReport строит ДВА РАЗНЫХ отчёта:

### Standard (текущая v1-логика, не трогаем)
- CHARGES = inventory DOD + receipts (без proceeds!) + gains
- CREDITS = disbursements + losses + distributions + assetsOnHand (по DOD)
- Проданный актив: уходит из on-hand, его gain/loss = proceeds − DOD

### Carry value (новая логика, подход CA/VA — Charges/Credits по EstateExec)
Определение: активы учитываются ПО цене принятия под контроль (DOD value), **рыночные
колебания игнорируются**. При продаже актива: proceeds поступают в кассу как Receipt;
Gain/loss на диспозицию = proceeds − carry value (только в момент выхода актива).

Structure (3 секции + summary — как в Sample_Carry_Value_Accounting_Report.pdf EstateExec):

**CHARGES** (на что возложена ответственность):
1. Property on hand at beginning (инвентарь DOD, probate-активы)
2. Additional property received (найденные активы, ретрофит)
3. Receipts (income + proceeds продаж — ПОЛНЫЙ приход, включая sale proceeds, т.к.
   актив на момент продажи «вышел» из carrying и переходит в cash)
4. **Gains on dispositions** (proceeds − carry value актива, только при продаже)

**CREDITS** (куда это делось):
1. Disbursements (расходы)
2. **Losses on dispositions** (отрицательный gain)
3. Distributions (раздачи наследникам)
4. **Property on hand now** (несрочные активы по carry value + остаток cash)

### Ключевое отличие от Standard
| Аспект | Standard | Carry |
|---|---|---|
| Sale proceeds | НЕ в receipts (идут через on-hand cash) | В receipts (+gain/loss отдельно) |
| Непроданные активы в on-hand | DOD value | DOD value (то же) |
| Рыночный рост акции/дома | Идёт через "Changes to inventory" | НЕ показывается до продажи |
| Баланс-идентичность | сходится по построению | сходится по построению |

ВАЖНО (усвоено в D3/D5): proceeds НЕ попадают в 2 места одновременно. В carry-подходе
proceeds = Receipt (приход кассы), и одновременно актив снимается с carrying (по carry
value), а разница = gain/loss. Это ДРУГОЕ распределение, чем в Standard, и его нужно
отдельно протестировать (двойной-счёт-детектор: e2e-day9).

## UX
- Setup: поле «Accounting basis», дефолт Standard. Tooltip «Which should I pick?»:
  «Carry value required in CA/KY/OH/MN/SC/VA/WI; if unsure, check with your court or attorney».
- При смене basis на уже заполненном estate: confirm-modal «Report appearance will
  change; your records stay the same». Все данные совместимы, меняется только расчёт.
- В Report-вью: бейдж «Carry value approach (CA/VA format)» или «Standard (market value)».

## Техн. детали
- core.js: `setAccountingBasis(id, 'standard'|'carry')` в estate; `buildAccountReport(est, mode)`
  → диспетчер на `reportStandard(est)` (существующий) и `reportCarry(est)` (новый).
- reportCarry: чистая функция, 0 DOM. Вход: estate. Выход: тот же shape отчета + поле basis.
- CSV-export: добавить колонку "Basis".
- Print-CSS: тот же courts-doc шаблон, заголовок меняется на «CHARGES/CREDITS» (совпадает
  со Standard-заголовком — удачно!).

## Тесты
- test-carry.js: ~18 unit (balance identity, proceeds-single-entry, gain при продаже,
  нет gain при простом удержании растущего актива, distributions не двигают carry).
- e2e-day9.js: ~20 E2E (переключение, оба отчёта на том же sample, CSV/print).

---

# Ф2. EXECUTOR FEE CALCULATOR (SEO-лендинг + модуль в инструменте)

## Что делает
Две части:

### (а) Модуль в app (Setup → «My fee»):
- Поле estate: «Statutory fee for this estate» — расчёт по штату из Setup (state уже есть!)
- Показывает: комиссию по статутной табличке штата, базис (gross estate, receipts+disbursements etc.)
- Кнопка «Record my commission as expense» → создает money_out с description
  «Executor commission per [statute]» (Principal), категория explicit, не reimbursable.

### (б) SEO-лендинг /executor-fee-calculator.html (воронка):
- Интерактивный калькулятор на странице (input estate value + select state → fee)
- Работает СО СТРАНИЦЕЙ (stateless, на JS на клиенте, без бэкенда)
- SEO-ключи: executor fee calculator california / probate fee calculator [state]
- schema.org WebApplication + FAQPage rich snippet

## Fee-расписания (статутные, вшитые в core.js как FEE_SCHEDULES):
| Штат | Формула | Источник |
|---|---|---|
| **CA** | 4% first 100K / 3% next 100K / 2% next 800K / 1% next 9M / 0.5% next 15M, на GROSS estate (не минус долги!) | Prob. Code §10810 (PR = §10800) |
| **NY** | 5% first 100K / 4% next 200K / 3% next 700K / 2.5% next 4M / 2% over 5M | SCPA 2307 |
| **FL** | 3% first 1M / 2.5% next 4M / 2% next 5M / 1.5% over 10M | Fla. Stat. §733.617 |
| **VA** | guideline: 5% first 400K / 4% next 300K / 3% next 300K / 2% >1M + 5% on income | Commissioner of Accounts guideline (Va. Code §64.2-1208) |
| **MD** | 9% first 20K / 3.6% over | Md. Code Estates §6-107 |
| **NC** | tiered, max 5% of receipts + disbursements | G.S. §28A-6-1 |
| **MO** | 4%/3%/2%/1% (как CA, минимум) | RSMo 473.153 |
| **OH** | 4%/3%/2% + 1% unsold realty | ORC 2113.35 |
| **OK** | 5%/4%/2.5% | Okla. Stat. §58-301 |
| **SD** | 5%/4%/2.5% default | SDCL |
| **GA** | 2.5% money in + 2.5% money out | OCGA §53-6-60 |
| **SC** | capped 5% | §62-3-719 |
| **AR** | 10%/5%/3% personal property | §28-48-108 |
| **WI** | ≤2% gross estate (up to court add'l) | §851.34 |
| **TX/AL** | TX 5% receipts+disb; AL 2.5% | TX Prob Code §242; AL §43-2-844 |
| Остальные | «reasonable compensation» — показываем диапазон 1.5–5% + hint «check local custom» | — |

Базис уточнения:
- CA: gross (mortgage НЕ вычитается) — это надо обязательно показать юзеру, это
  классический шок (дом $1M с ипотекой $900K = fee на $1M).
- GA/TX/NC: базис = receipts + disbursements (не gross estate!) — для этого нужны
  ledger-итоги, в app-модуле берём из ledgerTotals; на лендинге просим ввести 2 числа.
- unsold realty (OH): чекбокс «estate includes unsold real property» → +1%.

## UX
- На лендинге: инлайн-калькулятор в hero-области (state + value → fee моментально)
- В app: в Setup и в Export-панели
- Дисклеймер везде: «statutory maximum; court may adjust; reasonable-fee states vary»

## Тесты
- test-fees.js ~14 unit (CA tiers 23K@$1M, NY 18K@$500K, FL 15K@$500K, MD 9%/3.6%,
  GA basis из totals, OH +1% realty, boundary values 10M/25M).
- e2e-day10: калькулятор на лендинге (3 states), app-модуль, «Record commission» создаёт
  tx и попадает в отчёт.

---

# Ф3. BANK CSV IMPORT

## Что делает
Export-панель → «Import bank CSV»: загружает файл, парсит, матч-мапит колонки,
превращает в money_in/money_out с dedupe.

## Пайплайн (по EstateExec-паттерну accept/modify/reject)
1. **Parse**: PapaParse (тот же стек, что csv-to-json-extension — уже знакомый код).
   Поддержка: comma/semicolon/tab, «$1,234.56», (1,234.56) = −, «12/31/2025» и ISO.
2. **Column mapping** (auto-detect + ручной override):
   - date: колонки с датами (parse-проба на первых 5 строках)
   - amount: одиночная колонка ИЛИ пара debit/credit
   - description: самая длинная text-колонка
   - опционально: payee, check#, memo
3. **Preview-таблица** (все строки, editable): юзер помечает каждую как
   **accept / modify / reject** (чекбоксы). Auto-suggest типа по ключевым словам описания:
   interest/dividend/rent → money_in, fee/payment/tax → money_out (только SUGGEST,
   юзер подтверждает — YMYL: не делаем silent AI).
4. **Dedupe**: fingerprint = date+amount+normalized description → совпадение с уже
   существующими tx (за 90 дней) → строка помечается «possible duplicate» жёлтым.
5. **Commit**: выбранные → addTransaction (bulk), Principal default (income юзер
   уточняет по чекбоксу «is income?»), source = название файла.
6. Post-import: показываем summary «38 added, 12 skipped as duplicates, 5 rejected».

## UX / ограничения
- Файл читается ТОТ-ТОТ локально (FileReader) — privacy-модель сохранена полностью.
- Лимит 3000 строк (больше — просим разбить; N100-браузеры ок, но UX).
- Ошибки строк (не-парсится) собираются в preview с причиной и не попадают в commit
  до исправления или reject.

## Тесты
- test-import.js ~16 unit (parse money форматы, debit/credit пары, dedupe fingerprint,
  date-форматы, mapping auto-detect).
- e2e-day11: загрузка fixture-CSV (10 строк, 2 дубля), маппинг, preview, commit,
  итоги в Ledger.

---

# Ф4. СУДЕБНЫЕ ФОРМЫ ПО ШТАТАМ (CA GC-405 first)

## Что делает
Report-вью → «Export for court form»: выбор «California GC-405 (simplified accounting)»
генерирует заполненные данные в формате бланка, который юзер переносит / распечатывает
поверх официального PDF.

## Scope честно
Мы НЕ воспроизводим официальный PDF (это protected doc Judicial Council). Мы делаем **companion worksheet**:
1. **Fill worksheet**: страница с полями в ПОРЯДКЕ полей GC-405(SUM) + GC-405(A) Receipts
   + GC-405(C) Disbursements: каждая строка помечена номером поля бланка
2. Юзер копирует значения в официальный PDF (courts.ca.gov, fillable) — или просто
   передаёт worksheet юристу
3. Проверка: если receipts > 5 строк → hint «GC-405 требует Standard формат (GC-400) при >5 страницах»
   → предлагается переход к GC-400 series (Schedule A(1)-(6))

## Данные → поля GC-405(SUM)
| Поле бланка | Откуда |
|---|---|
| Case number, decedent | estate.caseNumber/.decedent |
| Summary: receipts total | ledgerTotals receipts income (non-capital!) |
| Summary: disbursements total | ledgerTotals disbursements |
| Schedule A rows | tx money_in (income), date/amount/description |
| Schedule C rows | tx money_out, date/payee/purpose/amount |

ВАЖНО: GC-405 предназначен для conservatorships/guardianships, НЕ decedent estates
(там GC-015/DE-серия нестандартизована). Проверка в D-этапе: для decedent CA estates
суд обычно принимает narrative accounting в формате Charge-and-Discharge (наш v1!
CA = carry value штат → наш Ф1 carry-режим как раз решает CA). Поэтому:
- **GC-405 worksheet = «CA conservatorship/guardianship companion», позиционируется
  как бонус для смежных дел** (у executor'ов часто есть и консерваторство родителя!)
- Основное CA-предложение = **carry value report + worksheet mapping carry → CA
  Probate Code §1060-1064 требования** (itemized receipts/disbursements, подпись,
  vouchers) — мы уже почти всё выдаём.

## Отложено из Ф4 (v2.1)
- NY AF-series (иная структура, отдельный worksheet) — после CA-фидбека
- VA CC-1680 worksheet

## Тесты
- test-ca-form.js ~10 unit (mapping estate → поля GC-405(SUM), receipts >5 hint).
- e2e-day12: worksheet рендер, print-CSS (только worksheet на печати).

---

# Ф5. MULTI-ESTATE (проф. режим)

## Что делает
- Estate-switcher расширяется: список всех estates с полями (decedent, case#, дата
  DOD, статус progress-bar: % закрытых задач отчета)
- **Dash-вью** (вкладка над switcher при ≥3 estates): таблица всех дел — decedent,
  case#, days since DOD, unbalanced/OK, reimbursable pending总额, next action hint
- «Archive»: estate → archived (не отображается в dash, доступен через switcher
  «Show archived»)

## Что НЕ делает
- Shared данные между estates (beneficiary/payee база) — v3.1
- Общий cash-flow через дела — v3.1
- Командный доступ / роли — навсегда нет (privacy-модель)

## Триггер v2 → v3
Multi-estate уже сейчас работает в v1 (несколько estates, switcher). Формально Ф5 —
«проф. удобство»: dash + archive + progress. Реализуем ПОСЛЕДНЕЙ (Ф1-Ф4 приоритет).

## Тесты
- e2e-day13: 3+ estates, dash-таблица, archive/unarchive, switcher-флаги.

---

# ПОРЯДОК РЕАЛИЗАЦИИ (14-17 рабочих дней)

| День | Фича | Что |
|---|---|---|
| Д9 | Ф1 carry value | core.reportCarry + setAccountingBasis + 18 unit |
| Д10 | Ф1 | UI (radio, tooltip, confirm-modal, badge) + 20 E2E |
| Д11 | Ф2 fees (core) | FEE_SCHEDULES 15 штатов + calculateStatutoryFee + 14 unit |
| Д12 | Ф2 | app-модуль «My fee» + record-as-expense + E2E |
| Д13 | Ф2 | SEO-лендинг executor-fee-calculator.html (stateless JS-calc) |
| Д14 | Ф3 core | parse/mapping/dedupe чистые функции + 16 unit |
| Д15 | Ф3 UI | Import-панель: FileReader, preview-таблица, commit |
| Д16 | Ф3 | E2Eday11 + fixture-CSV + error-handling |
| Д17 | Ф4 | CA worksheet + mapping + print-CSS + E2E |
| Д18 | Ф5 | Dash-вью + archive + E2E |
| Д19 | Полировка | полный suite прогон, баги, скриншот-ревью всех новых вью |
| Д20 | Финал | sitemap + новые SEO-страницы в sitemap.xml, версия v2.0 в footer, |

Общая длина: 3-4 недели с тестами (тот же стандарт: каждый день = unit + E2E + скрин).

# РИСКИ
1. **Carry-value логика** — самая сложная (по EstatesExec docs, это другой подход).
   Митигация: пишем reportCarry как отдельную чистую функцию, не трогаем reportStandard;
   тесты на identity в обоих режимах на ОДНОМ и том же sample-estate.
2. **Fee-расписания вшиты в код** — законы меняются. Митигация: FEE_SCHEDULES —
   отдельный файл `fee-schedules.js` с комментом на каждый штат + «Checked 2026-10-17»
   + страница с датой проверки.
3. **GC-405 ≠ decedent estate** — нашли в research. Рефрейм: worksheet как companion
   для conservatorship/guardianship (родительский пакет executor'а), а CA-декедент =
   carry value (Ф1). Это ЧЕСТНОЕ позиционирование, не подделка формы.
4. **CSV-import UX** — главная опасность: юзер импортирует мусор. Митигация:
   preview с accept/modify/reject (EstateExec-паттерн), dedupe с fingerprint, лимит строк.

# ИСТОЧНИКИ (research 17.10.2026)
- EstateExec /Docs/Final_Accounting (carry value = charges/credits + 3 секции)
- EstateExec /Docs/estate-accounting-software, /Docs/Bank_Import, /Docs/Enter_Asset (CA/VA/WI carry)
- californiacalculators.com, ridleylawoffices.com (CPC §10810 tiers, gross basis)
- executor.org, meetalix.com, familyestateguide.com (fee-расписания по штатам)
- calegaldocs.com, courts.ca.gov GC-405 (simplified, conservatorship/guardianship — НЕ decedent)
- SwiftProbate /blog/executor-compensation-by-state (NY/FL tiers)