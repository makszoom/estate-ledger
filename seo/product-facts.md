# Product facts — estate-ledger

Единственный источник правды для всего, что пишется о продукте. Собирается из самого
продукта, не из памяти и не из старых статей. Каждая строка с датой проверки.

Источник истины при расхождении: **живой сайт `estateledger.app`** (он же продакшн-код
в `site/`), затем владелец.

## Что делает

| Задача | Что делает продукт | Проверено | Где |
|---|---|---|---|
| Инвентарь активов | 8 классов (real estate, bank, brokerage, cash, personal property, vehicle, business interest, other), стоимость на дату смерти, источник оценки (appraisal / account statement / market estimate / tax assessment / other), флаг «passes outside probate» (yes/no/unknown — unknown не двигает итоги) | 2026-11-18 | `js/core.js` |
| Учёт движений денег | 4 типа: money in, money out, distribution, reimbursable. Поля: дата, сумма, описание, payee, purpose, source, флаг Principal/Income, номер чека | 2026-11-18 | `js/core.js` |
| Продажа актива | proceeds против стоимости на дату смерти → автоматический gain/loss. Proceeds НЕ дублируются как income (защита от двойного счёта) | 2026-11-18 | `js/core.js` |
| Отчёт Charge-and-Discharge | Summary of Account + Schedules; автопроверка TOTAL CHARGES = TOTAL CREDITS с красным флагом расхождения | 2026-11-18 | `js/core.js` |
| Carry value | переключатель standard ↔ carry (обязателен в CA/KY/OH/MN/SC/VA/WI) | 2026-11-18 | `js/core.js`, Setup |
| Гонорар исполнителя | статутные расписания по 24 штатам (включая CA §10810 от gross probate) + модуль «My fee» | 2026-11-18 | `js/fee-schedules.js` |
| Импорт банковской выписки | CSV/TSV, авто-детект формата и сепаратора, дедупликация по отпечатку, превью с подтверждением | 2026-11-18 | `js/bank-import.js` |
| CA companion worksheet | рабочий лист-компаньон (GC-400/405 — это conservatorship/guardianship, НЕ decedent; основной путь CA — carry) | 2026-11-18 | `js/court-forms.js` |
| Несколько наследств | дашборд с карточками, архивирование и восстановление | 2026-11-18 | `js/app.js` |
| Экспорт | print-CSS в PDF судебного вида, CSV (активы / реестр / сводка), JSON backup и restore, недельный reminder | 2026-11-18 | `js/app.js` |

## Чего НЕ делает

| Не умеет | Проверено |
|---|---|
| Аккаунтов и облачной синхронизации — данные только в localStorage браузера | 2026-11-18 |
| Не сверяет банковский счёт (reconciliation) | 2026-11-18 |
| Не готовит Form 1041 и налоговую отчётность | 2026-11-18 |
| Не выдаёт certified court form — только companion worksheet | 2026-11-18 |
| Не даёт юридических, налоговых или фидуциарных консультаций | 2026-11-18 |
| Не загружает файлы на сервер — конвертация и расчёты только в браузере | 2026-11-18 |

## Цены и лимиты

| Пункт | Значение | Проверено | Источник |
|---|---|---|---|
| Цена | **бесплатно, без пейволла** | 2026-11-18 | живой сайт |
| Регистрация | не требуется | 2026-11-18 | живой сайт |
| Лимит наследств | нет в v2 | 2026-11-18 | `js/app.js` |
| Квота localStorage | ~5 МБ; при подходе к 4 МБ предупреждение | 2026-11-18 | `docs/V2-SPEC.md` §0 п.5 |
| Donate | USDT TRC-20 `TLdbF5RTXHTax71H9cAeU573pXxtMPZUuw` (общий кошелёк OGFY) | 2026-11-18 | `site/index.html` |

Можно ли упоминать цену в контенте: **да** — «free» можно писать прямо, это правда.

## Платформы

Браузер: Chrome, Edge, Firefox, Safari (современные версии). Хостинг GitHub Pages.
Никакого сервера, никакой установки. Печать в PDF — через системный диалог печати.

## Одобренные формулировки

- «Free estate accounting for US executors» — подзаголовок в футере.
- «Estate Ledger organizes records; it does not provide legal, tax or fiduciary advice.» — дисклеймер.
- «Companion worksheet» — про CA-лист. Никогда «court form» или «certified form».
- «Educational organizing tool — not legal advice. Court filing formats vary; confirm your court's requirements.» — `.disc` на страницах.
