# Estate Ledger — competitive analysis (живая проверка 15.10.2026)

## Источники проверены
- EstateExec: дом, /Docs/estate-accounting-software, /Docs/Print_Reports_and_Tables (+3 sample PDF)
- Settled Estate: /executor-software/accounting (полный текст), sample workspace + sample PDF/CSV/JSON
- SwiftProbate: главная (продажа через боль, таблица vs attorney)
- LegatePro: главная / pricing / register / terms (браузером) — free-тира НЕТ (0 вхождений «free»)
- Судебные образцы: lkpfirm.com (NV), rexcrandell.com (CA), fairfaxcommissionerofaccounts.org (VA CC-1680), piercelaw.com (NC), calegaldocs.com (CA GC-405)

## EstateExec ($199/estate, лидер) — функциональное ядро
1. Cashflow Tab = сердце учёта (все транзакции в одном реестре)
2. Assets/Debts: DOD value (стоимость на дату смерти), долги
3. ТРИ подхода к отчёту, штат задаёт: Standard (market-value) | **Carry Value — ОБЯЗАТЕЛЕН CA/KY/OH/MN/SC/VA/WI** | Chronological Activity
4. Income vs Principal раздельно (требование trust'ов и ряда судов)
5. Unreimbursed Executor Expenses (личные траты → строка в Debts → возврат estate)
6. Executor fee calculator автоматом (статутные %)
7. Step-up cost basis автоматом
8. Отчёты PDF/CSV за произвольный период; опции чек-№/адреса/аккаунт-№
9. Sample estate (fictional) — конверсионный паттерн

## Settled ($19.99/estate) — как подают
1. Charge-and-Discharge: Charges = inventory DOD + receipts + gains; Credits = losses + payments + distributions + cash on hand
2. 4 семантики движения: Money in / Money out / Distribution / Reimbursable
3. CSV/TSV import 500 rows, mapping + duplicate-flags
4. Asset sale: proceeds vs DOD → Gain/Loss; НЕ дублировать proceeds как Money in (двойной счёт!)
5. «Passes outside probate» флаг на активах (yes/no/unknown — unknown НЕ двигает итоги)
6. Честные FAQ: не reconcile банк, не Form 1041, не certified court form
7. Fictional read-only workspace + sample PDF/CSV/JSON на лендинге
8. Education guide /probate-accounting отдельно; editorial dates «Checked 2026-XX»

## SwiftProbate ($39) — UX-паттерны лендинга
1. Боль вместо фич: overload / hidden assets / deadlines / jurisdiction / attorney $3–10K
2. Таблица сравнения: tool $39 vs attorney $3000–10,000 vs concierge $2500–6500
3. «No credit card. 5 minutes» барьер
4. 3200 бесплатных probate-ресурсов (SEO-магнит)
5. Дисклеймер «informational, not legal advice» везде

## Судебный формат отчёта (2 образца + CA правила)
**Summary of Account:**
- CHARGES: Property on Hand (begin: cash + non-cash carry) + Additional Property Received + Receipts + Gains on Sales (+ Other)
- CREDITS: Disbursements (debts & expenses) + Losses on Sales + Distributions + Property on Hand (end)
- TOTAL CHARGES = TOTAL CREDITS (сбалансированно, автопроверка)
**Schedule of Receipts:** amount / date / source (включая № счёта) / description (природа: interest, dividend)
**Schedule of Disbursements:** amount / date / payee / purpose (insurance, tax, filing fee)
**Schedule of Distributions:** кому / что / когда (+ при preliminary distribution)
- Хронологически ИЛИ по категориям; Income Receipts ОТДЕЛЬНО от Principal
- Vouchers обязательны (NC: cancelled checks; подпись под oath)
- CA: если Schedule >5 страниц → стандартные формы GC-400(A)(C) вместо simplified GC-405

## Выводы для нашего MVP (перенесено в PLAN-DETAILED §2)
- Ядро = Cashflow Ledger + 4 семантики + DOD-value инвентарь + Income/Principal флаг
- Killer = автосборка Charge-and-Discharge + баланс-проверка (Excel никогда не делал)
- Обязательные поля судебных schedules: amount/date/source/payee/purpose/description
- Механика asset sale → Gain/Loss без двойного счёта
- Unreimbursed Executor Expenses — доверие юзера
- Sample Estate — конверсия без ввода данных
- Дисклеймер + editorial dates + .gov references — YMYL-гигиена
- Carry Value, fee-calc, bank import, судебные формы — v2 (не блокер)