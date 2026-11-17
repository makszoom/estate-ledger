'use strict';
/* Анимации появления не должны прятать контент, если JS не выполнился.

Найдено 18.11.2026 по вопросу владельца «куда делись визуальные эффекты».
Разбор показал обратное: эффекты на месте (26 блоков, IntersectionObserver работает,
при прокрутке появляются все 26), но базовое правило CSS было написано наоборот:

    [data-motion]{opacity:0;transform:translateY(24px)}     ← по умолчанию СКРЫТО

Скрытие включается сразу, а показ зависит от класса `.in-view`, который ставит JS.
Проверка с отключённым JS: 26 блоков, видимых 0. Текст в DOM есть, на экране пусто.

Правильный паттерн — прогрессивное улучшение: контент виден по умолчанию, анимация
включается только если JS работает (класс `motion-armed` на body).

Тест статический: проверяет порядок и содержание правил в CSS главной страницы.
*/
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const fails = [];
function ok(name, cond, extra) {
    if (cond) { passed++; }
    else { failed++; fails.push(name); console.log('  \u2717', name, extra === undefined ? '' : String(extra).slice(0, 240)); }
}

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8');
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n');

// --- 1. Базовое правило не должно скрывать контент -----------------------
const baseRule = (css.match(/(^|\n)\s*\[data-motion\]\s*\{([^}]*)\}/) || [])[2] || '';
ok('базовое правило [data-motion] найдено', baseRule.length > 0, baseRule.slice(0, 100));
ok('по умолчанию контент ВИДЕН (opacity не 0)',
    !/opacity\s*:\s*0/.test(baseRule), baseRule.slice(0, 120));

// --- 2. Скрытие включается только классом от JS --------------------------
const armedRule = (css.match(/\.motion-armed\s+\[data-motion="fade-up"\]\s*\{([^}]*)\}/) || [])[1] || '';
ok('правило .motion-armed скрывает блоки', /opacity\s*:\s*0/.test(armedRule), armedRule.slice(0, 120));

// --- 3. Показ по .in-view остаётся ---------------------------------------
const inViewRule = (css.match(/\.motion-armed\s+\[data-motion="fade-up"\]\.in-view\s*\{([^}]*)\}/) || [])[1] || '';
ok('правило .in-view показывает блоки', /opacity\s*:\s*1/.test(inViewRule), inViewRule.slice(0, 120));

// --- 4. prefers-reduced-motion показывает всё ----------------------------
ok('reduced-motion показывает контент',
    /prefers-reduced-motion[\s\S]{0,400}\[data-motion\][^{]*\{[^}]*opacity\s*:\s*1/.test(css));

// --- 5. Класс motion-armed ставит JS, не разметка ------------------------
ok('motion-armed добавляется из скрипта', /classList\.add\(['"]motion-armed['"]\)/.test(html));
ok('в разметке нет захардкоженного motion-armed', !/class="[^"]*motion-armed/.test(html));

console.log(`\nАНИМАЦИИ БЕЗ JS: ${passed}/${passed + failed} PASS` + (failed ? `, ${failed} FAIL` : ''));
if (failed) console.log('провалы: ' + fails.join(' | '));
process.exit(failed ? 1 : 0);
