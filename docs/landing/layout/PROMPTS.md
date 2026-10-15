# Layout prompts — Estate Ledger landing v1

## PROMPT v1 (полный лендинг, 7 секций, Trust Legal)

```
Full-page website mockup screenshot, EN language, desktop, entire landing page from top to bottom (7 sections visible stacked vertically), photorealistic UI design render.

STYLE: Trust Legal aesthetic — warm paper white background #FAFAF8, ink black text #1A1A1A, deep navy #1E3A5F for headings and primary buttons, restrained green #2D6A4F only in balance-checkmarks, clean sans-serif (Inter-like) for UI, Georgia serif ONLY inside court-document imagery. Generous whitespace, thin warm gray borders #E5E2DC, no dark theme, no gradients. Calm, official, trustworthy feel like UScourts.gov or IRS.gov — NOT startup flash, NOT dark SaaS.

SECTION 1 (hero, top): left side — big ink headline "Estate Accounting Without the Spreadsheet Chaos", subtext below, two buttons: filled navy "Open the Ledger", outlined ghost "Try the Sample Estate"; three small trust badges under buttons (Free forever · No account · Data stays local); right side — a slight-tilted (like paper on desk) white court document card titled "STATEMENT OF RECEIPTS AND DISBURSEMENTS — FINAL ACCOUNT" rendered in Georgia serif with two columns CHARGES / CREDITS with realistic dollar amounts, a green "TOTAL CHARGES = TOTAL CREDITS ✓" balance line at bottom.

SECTION 2: headline "Settling an estate is hard enough. The accounting shouldn't be." Three pricing-comparison cards in a row: green-accented card "Estate Ledger — FREE" slightly emphasized with navy border; gray card "EstateExec — $199 per estate"; gray card "Attorney — $3,000–$10,000+". Small caption under table: "Informational organizing tool — not legal advice."

SECTION 3: headline "Three steps to a balanced account", three numbered navy circles: 1 List the assets, 2 Record every movement, 3 Generate the Summary of Account (with small green "balanced ✓" badge on step 3).

SECTION 4: headline "Everything the court expects to see", six feature cards in 3x2 grid with thin borders and simple line icons: Charge-and-Discharge Account, Automatic balance check, Income vs Principal, Asset sale gains/losses, Executor expense tracking, PDF CSV JSON export.

SECTION 5: headline "See it before you trust it", left — realistic ledger table screenshot card (columns Date / Description / In / Out with rows like "Funeral home", "Estate bank interest", "County filing fee", green final balance row), right — short text and "Open the Sample Estate →" button.

SECTION 6: headline "Questions executors ask", four FAQ accordion cards 2x2 grid (Is this really free? / Will the court accept this form? / Where is my data stored? / What about taxes?).

SECTION 7 (footer CTA): centered deep-navy full-width block "Ready to start the ledger?" with white button "Open the free Estate Ledger", below a light footer bar with small links (Probate accounting guide, State guides, Glossary) and tiny disclaimer line.

Realistic proportions, browser-like page, crisp readable text, professional web design, 8k quality render-like screenshot.
```

Модель: google/gemini-3.1-flash-image-preview (default). Aspect: 4:3 portrait-friendly. Сохранение: layout/full-page-v1.png


## ИСТОРИЯ ГЕНЕРАЦИЙ (уроки)
- v1 (gemini-3.1-flash, промпт «весь лендинг 7 секций») → ЧУЖОЙ продукт (Synergy Flow) — модель игнорирует длинные промпты целиком
- v2 (gemini, детальный промпт на весь лендинг) → тема estate подтянулась, но 7/9 структурных пунктов FAIL (чужие секции/тексты)
- v3 (gemini, hero-only промпт) → фото-офис с человеком — модель игнорирует запреты на людей, добавляет фотографию
- v4 (gemini, hero-only + «no people») → ЧУЖИЕ тексты («Solaris/Transforming the Future…») — модель фантазирует при длинном промпте
- **v5 (SEEDREAM-4.5, короткий промпт, «flat vector UI mockup») → 7/7 ПУНКТОВ PASS** (текст headline точен, document card с CHARGES/CREDITS, кнопки, бейджи, палитра) — только paragraph gibberish
- **v6 (gemini EDIT hero-v5: «Replace ONLY paragraph → точный текст») → 7/7 + paragraph исправлен, артефактов нет ✅ ИТОГОВЫЙ МАКЕТ**

## ФИНАЛЬНЫЙ ПРОМПТ (выжимка метода, для переиспользования)
1. Генерация: seedream-4.5, короткий промпт (~700 симв), «flat vector UI mockup, no people, no devices» + точный headline и лейблы кнопок/бейджей
2. Полировка текстов: gemini-3.1-flash-image EDIT с «Replace ONLY <элемент> … Keep everything else exactly the same»
3. Ожидать 1-2 edit-итерации на мелкие тексты; НЕ полировать мелкий текст в document card — это заглушка, реальный контент = код/CSS
