# Estate Ledger — подробный план реализации
> Версия 1.0 (15.10.2026) · Ниша: крон v3 прогон №6 (15.10) ⭐⭐⭐⭐, gap подтверждён живой проверкой LegatePro
> Модель: free-first (концепция Макса) → копим трафик → монетизация рекламой (AdSense) по факту

---

## 0. Резюме (одна страница)

**Продукт:** Estate Ledger — бесплатный браузерный инструмент учёта наследства (estate accounting) для executor'ов США. Инвентарь активов на дату смерти + журнал всех движений денег → автоматический **Charge-and-Discharge отчёт (Summary of Account + Schedules)** в PDF с судебным форматированием. Без аккаунта, без лимитов, данные не покидают устройство.

**Кому:** executor / personal representative США (обычно назначен впервые, не финансист). Probate длится 6–18 месяцев. Платные конкуренты берут $19.99–199 per estate — спрос доказан их кассами; у ВСЕХ free урезан (проверено 15.10: LegatePro — free нет вообще, слова «free» на сайте 0 вхождений).

**Модель монетизации:** v1.0 = 100% бесплатно. Реклама (AdSense) позже при ≥5K pv/мес — только на лендинге/education-страницах, НЕ внутри инструмента (судебный отчёт с рекламой = удар по доверию). Платные Pro-фичи — решение по данным через 60–90 дней (не обещаем в v1).

**Стек:** статический сайт (GitHub Pages/CF Pages, $0) + vanilla JS + localStorage + print-CSS PDF. Никаких серверов, API, аккаунтов.

**Домен:** estateledger.app ($12/год, CF Registrar, oplatym) — **ПОКУПАЕТСЯ ПОСЛЕ ГОТОВОГО САЙТА** (решение Макса 15.10). Продукт живёт на makszoom.github.io/estate-ledger (паттерн ogfy/imgtopdf); на github.io-фазе: `<meta name="robots" content="noindex">` → при покупке домена снять → чистая индексация от домена. Домен нужен только для GSC-старта и AdSense-заявки.

**Timeline:** MVP 8 дней → deploy на github.io (+donate-кнопка) → SEO-контент → **домен+GSC** (когда сайт готов) → 30-дневный трафик-тест → kill/push решение.

---

## 1. Конкурентный анализ (живая проверка 15.10.2026)

| Продукт | Цена | «Бесплатное» | Чего не хватает |
|---|---|---|---|
| EstateExec | $199/estate | 10-дневный триал (полный) | после триала платно; сервер-базирован |
| Settled Estate | $19.99/estate | preview + 10 AI-вопросов | рабочие инструменты платно |
| SwiftProbate | $39 estate | questionnaire + checklist | полный accounting платно |
| Executor.org | $8/мес | трекинг БЕЗ сохранения | сохранение = подписка |
| LegatePro | цены скрыты (checkout) | **free-тира нет вообще** (проверено живьём: 0 вхождений «free») | всё платно |
| Excel-шаблоны | $0–14.95 (Etsy) | пустые структуры | **балансы не считаются, отчёт не генерируется** |
| **Estate Ledger** | **$0 навсегда** | **всё** | privacy = фича |

**Wedge (структурный, неповторимый):** вендоры per-estate не могут отдать отчет бесплатно — отчёт и есть их продукт. Наша модель free-first (реклама на трафике) позволяет отдать всё.

**Судебный формат (из PDF-образцов NV LKP firm + VA Fairfax CC-1680):**
- Summary of Account: CHARGES (Property on Hand begin + Additional Received + Receipts + Gains) = CREDITS (Disbursements + Losses + Distributions + Property on Hand end) — **TOTAL CHARGES = TOTAL CREDITS**, автопроверка баланса обязательна
- Schedules: Receipts (amount/date/source/description) · Disbursements (amount/date/payee/purpose) · Distributions (кому/что/когда)
- Income Receipts отдельно от Principal (суд-требование)
- Блок подписи под oath + заголовок «IN THE MATTER OF THE ESTATE OF [NAME], Deceased»

---

## 2. Продуктовая спецификация MVP v1.0

### Модуль E: Estate Setup
- Поля: имя покойного, case/court file №, штат (select 50+DC), дата смерти, роль (executor/administrator/personal representative/trustee), период учёта (за произвольный период или Final Accounting)
- Мульти-estate: список дел, переключение (localStorage-вкладки)

### Модуль A: Assets (инвентарь)
- Классы: real estate / bank account / brokerage / cash / personal property / vehicle / business interest / other
- Поля: название, класс, **DOD value** (стоимость на дату смерти), источник оценки (appraisal letter/statement), ref-дetail (адрес/последние 4 цифры счёта)
- Флаг «passes outside probate» (yes/no/unknown): да → не входит в probate inventory (паттерн Settled; «unknown» НЕ двигает итоги, помечает строку)

### Модуль B: Cashflow Ledger (сердце, как у EstateExec)
- Единая таблица всех движений. **4 семантики (Settled-паттерн):**
  - **Money in** (Receipts): interest, rent, dividends, refunds — доходы estate за процесс
  - **Money out** (Disbursements): похороны, налоги, долги, юристы, суд-fee, содержание — с полем payee и purpose
  - **Distribution** кому/что/когда/сумма
  - **Reimbursable**: executor платил лично → строка «Unreimbursed Executor Expenses» (EstateExec-паттерн, автоматически в Debts-статус)
- Каждая транзакция: date, amount, description («County filing fee», не «check»), source/reference, **flag Principal/Income** (суд-требование раздельного учёта), опц. чек-№

### Модуль C: Asset Sale (автоматические Gains/Losses)
- Продажа актива: ввод net proceeds → **авто-сравнение с DOD value → Gain/Loss строка отчёта** (НЕ дублировать proceeds как Money in! Settled-паттерн двойного счёта)
- Proceeds попадают в cash автоматически (движение между активами)

### Модуль D: Charge-and-Discharge отчёт (killer-фича)
- Автосборка из модулей A/B/C:
  ```
  SUMMARY OF ACCOUNT (период, дело №)
  CHARGES:                              CREDITS:
    Property on Hand (begin)   $X          Disbursements     $Y
    Additional Property Recv   $X          Losses on Sales   $Y
    Receipts (Principal)       $X          Distributions     $Y
    Gains on Sales             $X          Property on Hand  $Y
    ─────────────                          ─────────────
    TOTAL CHARGES              $T          TOTAL CREDITS     $T
  ```
- **Автопроверка баланса: если Charges ≠ Credits → красный флаг + список расхождений** (Excel не делает и никогда не делал)
- Income Receipts и Income Disbursements отдельными подпунктами (Principal/Income разделение)
- Расхождение ledger vs сумма → объяснительные подсказки (education-паттерн, YMYL-безопасные формулировки)

### Модуль P: Экспорт и вывод
- **PDF (print-CSS)**: заголовок «IN THE MATTER OF THE ESTATE OF [NAME], Deceased» + case № + суд, Summary of Account страница + Schedules А/D + **Executor's oath/signature block** («signed and sworn under penalty of perjury») — печать из браузера (Ctrl+P)
- **CSV** (для бухгалтера/attorney): все таблицы
- **JSON backup/restore** — КРИТИЧНО: юзер ведёт данные 6–18 месяцев, одна кнопка «Download backup», одна «Restore» + еженедельное напоминание (не nag, banner)

### Модуль S: Sample Estate
- Fictional demo-estate в 1 клик с лендинга: read-only, 12-15 транзакций, красивый готовый отчёт — юзер смотрит продукт БЕЗ ввода своих (конверсионный паттерн Settled, «Try a fictional workspace»)

### Что НЕ в v1.0 (честно)
- ❌ Carry Value vs Standard переключатель (обязателен CA/KY/OH/MN/SC/VA/WI — v2; в v1 делаем Standard с дисклеймером «если ваш суд требует carry-value отчёт, покажите юристу структуру»)
- ❌ Формы конкретных судов (CA Judicial Council GC-405 series, NY AF-series) — v2/v3 by-state
- ❌ CSV/TSV bank import (v2, Settled-паттерн: mapping + dub-flags)
- ❌ Executor fee calculator по статутным % (v2 = отдельный SEO-калькулятор-лендинг, воронка)
- ❌ Multi-estate профессиональный (v3)
- ❌ Аккаунты, cloud-sync, e-sign, bank feeds, ИИ-ассистент
- ❌ Юридические советы: дисклеймер «educational organizing tool, not legal advice; court may require its own form» на каждой странице и в отчёте (YMYL)

### Дизайн
- Apple Design CSS (твой стандарт): serif для судебного PDF-рендера (Georgia/Times — судебная конвенция!), sans-serif в интерфейсе
- Палитра: soft muted, нейтральный тёмный интерфейс, светлое документное поле (южно-e-filing стиль)
- max-width 880px, крупная типографика (возраст юзеров 50-75!)

---

## 3. Техническая архитектура ($0)

- **Hosting:** GitHub Pages (как csv-to-json.com) или CF Pages — решаем по скорости деплоя
- **Frontend:** vanilla JS + CSS, без фреймворков; хэш-роутинг для страниц (/#/assets, /#/ledger, /#/report)
- **Persist:** localStorage (одно estate ≈ 50-200KB JSON — лимит 5MB = ~25 estates, хватает)
- **PDF:** print-CSS media queries (браузер сам делает PDF, надёжно и без библиотек)
- **Backup:** JSON export-import (кнопки в header)
- **Analytics:** Cloudflare Web Analytics free (без куки, YMYL-clean)
- **Реклама:** AdSense слоты подгружаются ТОЛЬКО на лендинг/education (не в /app!) — код в pages, физически не в tool-странице

---

## 4. План по дням (MVP — 8 дней)

| День | Что | Выход |
|---|---|---|
| **0** | ImageGen-макет лендинга → approval Макса (домен НЕ покупается до готового сайта) | макет утверждён |
| **6б** | Покупка estateledger.app → DNS/CNAME → GSC → sitemap (снять noindex) | домен+GSC live |
| **1** | Скелет: хэш-роутинг, localStorage-схема (estate/assets/transactions), UI shell, модуль E (Setup) | ввод estate работает |
| **2** | Модуль A: Asset Inventory (все классы, DOD value, probate-флаг) | инвентарь живой |
| **3** | Модуль B: Cashflow Ledger (4 семантики, Principal/Income flag, payee/purpose) | ledger живой |
| **4** | Модуль C (Asset Sale → авто-Gain/Loss) + авто-связь proceeds↔cash | без двойного счёта |
| **5** | Модуль D: Charge-and-Discharge Summary + автопроверка баланса + флаги расхождений | killer живой |
| **6** | Модуль P: print-CSS PDF (судебный формат) + CSV + JSON backup/restore | экспорт живой |
| **7** | Sample Estate (fictional data) + лендинг (hero: боль, таблица FREE vs $199 vs $3000, бейджи privacy, CTA) | лендинг готов |
| **8** | 6 SEO-страниц + /probate-accounting guide + glossary (контент-скелет) + GSC + sitemap | полный launch-контур |

**Параллельно Day 9-14:** контент SEO-страниц (реальные тексты), 2-3 поста (r/EstatePlanning, r/inheritance, r/legaladvice — вопрос-формат), FB-группы executor'ов.

## 5. SEO-архитектура (6 страниц + education)

| URL | Ключ | Намерение |
|---|---|---|
| / | estate accounting software free, executor accounting | основной tool-CTA |
| /estate-inventory-template | estate inventory template | high-Suggest (крон: probate 334) |
| /executor-accounting-spreadsheet | executor accounting spreadsheet | сравнение с Excel |
| /final-accounting-probate | final accounting probate | high-intent |
| /receipts-disbursements-schedule | receipt disbursement schedule estate | format-поиск |
| /probate-accounting (guide) | probate accounting | education-хаб + glossary |
| **/executor-fee-calculator (v2)** | executor fee calculator california | воронка-калькулятор |

YMYL-паттерны: дисклеймер на каждой странице, references на IRS Pub 559/state-courts (.gov), editorial-block («not legal advice»), author/brand-page, консистентные даты «Checked 2026-10-XX» (паттерн Settled).

---

## 6. Монетизация (по концепции Макса)

- **v1.0: $0, без ограничений.** Никаких paywall, лимитов, e-mail-гейтов
- **AdSense: при ≥5K pv/мес** — только на лендинг/SEO/education страницах. Слоты физически отсутствуют в /app
- **Donate (v1.1 при живом трафике):** «Buy me a coffee» $3 — классика free-tools; USDT-кошелёк проекта
- **Pro (v2+, решение по данным 60-90 дней):** возможные: по-штатные судебные формы (CA/NY), fee-calc по всем 50, multi-estate pro — ТОЛЬКО если трафик покажет спрос

## 7. KPI / Kill criteria (Зуев-стопы)

| Период | Метрика | Порог |
|---|---|---|
| Launch+30д | органический GSC-трафик | ≥300 pv/мес, иначе заморозка контента |
| Launch+60д | pv/мес | ≥1,500 — продолжаем; <500 — пересмотр |
| Launch+90д | pv/мес | ≥5,000 → включаем AdSense |
| Engagement | Sample Estate → Ledger конверсия | ≥15% клик на «Start your ledger» |

## 8. Риски и митигация

| # | Риск | Уровень | Митигация |
|---|---|---|---|
| 1 | YMYL-строгость Google (legal) | высокий | education-first, .gov-references, дисклеймеры, нет «legal advice» формулировок |
| 2 | Суд может не принять формат | средний | честный copy «organize and present», не «court-approved form»; v2 = по-штатные формы |
| 3 | Юзер теряет данные за 6-18 мес | средний | JSON backup + еженедельный banner-reminder; localStorage выживает, но очистка браузера = потеря |
| 4 | LegatePro/новые вендоры сделают free | низкий | наша структура free-first (реклама) структурно недоступна per-estate вендорам |
| 5 | Suggest-плотность ≠ живой трафик | средний | GSC-check на Day+30 — early сигналы |
| 6 | Возрастная аудитория: UX | средний | крупная типографика, короткие формы, Sample Estate — try-before-data |

## 9. Что нужно от Макса

1. **Домен estateledger.app** — покупка $12 ПОСЛЕ готового сайта (решение Макса); donate-кнопка сразу после deploy
2. **Подтверждение хостинга:** GitHub Pages vs CF Pages (решаю сам, если без разницы)
3. **USDT-кошелёк проекта** (для donate v1.1) — по традиции, отдельный
4. **Согласие на Reddit/FB-посты** (2-3, вопрос-формат, после MVP)

---

## 10. Timeline summary

- Day 0: ImageGen-макет + approval
- Day 1-8: MVP (8 дней)
- Day 9-14: SEO-контент + Reddit/FB посты
- Day 15-45: GSC-наблюдение (first-data), итерации UX по фидбеку
- Day 45-90: решения по AdSense (≥5K pv) и Pro-фичам (по данным)
- Kill-check: Day+30 (≥300 pv/мес) и Day+90 (≥5K pv для рекламы)

*Ниша найдена кроном zuev-nisha-daily-v3 (7ff3b40af145), прогон №6, 15.10.2026.*
*Gap подтверждён живой проверкой LegatePro + конкурентного ландшафта 15.10.*