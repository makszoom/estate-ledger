'use strict';
/* Адаптивность estate-ledger: то, что ломает мобильную вёрстку молча.

Зачем (17.11.2026): на главной на `.cmp` висел инлайн-стиль
`grid-template-columns:1.2fr 1fr 1fr`. Инлайн перебивает и базовое правило CSS,
и правило внутри @media, поэтому на экране 390px сетка сравнения оставалась
трёхколоночной и растягивала страницу до 548px. В калькуляторе 4-колоночная
таблица не имела контейнера прокрутки и растягивала страницу до 459px.

Оба дефекта не видны на скриншоте — только замером scrollWidth против ширины
эмуляции. Поэтому они ловятся здесь статически.
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
// Корень отдаётся копией site/ (scripts/sync-root.py), поэтому проверяем site/.
const SITE = path.join(ROOT, 'site');
const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html')).sort();
const read = (f) => fs.readFileSync(path.join(SITE, f), 'utf8');

// --- 1. Инлайн-стили не должны перебивать адаптивность -------------------
// Свойство раскладки, заданное инлайном, нельзя переопределить через @media:
// инлайн всегда сильнее селектора. Проверяем только те свойства, которые
// действительно ломают адаптивность — display:flex и flex-wrap:wrap сами по
// себе безопасны, если в @media для элемента нет конфликтующего правила.
const LAYOUT_PROPS = ['grid-template-columns', 'grid-template-rows', 'flex-direction'];
for (const f of pages) {
    const s = read(f);
    const offenders = [];
    for (const m of s.matchAll(/style="([^"]*)"/g)) {
        for (const prop of LAYOUT_PROPS) {
            if (new RegExp('(^|;)\\s*' + prop + '\\s*:', 'i').test(m[1])) {
                offenders.push(prop + ' в "' + m[1].slice(0, 46) + '"');
            }
        }
    }
    ok(`${f}: нет инлайн-раскладки, перебивающей @media`, offenders.length === 0, offenders.join(' | '));
}

// --- 2. Каждая таблица должна уметь прокручиваться -----------------------
// Без контейнера с overflow-x таблица на узком экране расширяет всю страницу:
// горизонтальный скролл появляется у body, а не у таблицы. Обёрткой считается
// любой родитель с классом, у которого в стилях задан overflow-x: auto.
for (const f of pages) {
    const s = read(f);
    const tables = [...s.matchAll(/<table[\s\S]*?<\/table>/g)];
    if (!tables.length) continue;
    const wrapClasses = [...s.matchAll(/\.([\w-]+)\s*\{[^}]*overflow-x\s*:\s*auto/g)].map((m) => m[1]);
    const unwrapped = tables.filter((m) => {
        const around = s.slice(Math.max(0, m.index - 300), m.index + m[0].length + 300);
        // обёртка классом с overflow-x:auto в стилях
        if (wrapClasses.some((cls) => new RegExp('class="[^"]*\\b' + cls + '\\b').test(around))) return false;
        // либо родитель с overflow/overflow-x:auto прямо в инлайн-стиле
        if (/style="[^"]*overflow(-x)?\s*:\s*auto/.test(around)) return false;
        return true;
    }).length;
    ok(`${f}: все таблицы (${tables.length}) в контейнере прокрутки`, unwrapped === 0,
        unwrapped + ' без обёртки; найденные обёртки: ' + (wrapClasses.join(', ') || 'нет'));
}


// --- 3. Контейнер прокрутки должен быть определён в CSS ------------------
const cssPages = pages.filter((f) => read(f).includes('table-scroll'));
for (const f of cssPages) {
    ok(`${f}: .table-scroll описан в своих стилях`, /\.table-scroll\s*\{[^}]*overflow-x\s*:\s*auto/.test(read(f)));
}

// --- 4. Сетка сравнения сворачивается в одну колонку ---------------------
const idx = read('index.html');
ok('index.html: @media сужает .cmp до одной колонки', /@media[^{]*\{[\s\S]{0,600}\.cmp\s*\{\s*grid-template-columns\s*:\s*1fr/.test(idx));

console.log(`\nАДАПТИВНОСТЬ: ${passed}/${passed + failed} PASS` + (failed ? `, ${failed} FAIL` : ''));
if (failed) console.log('провалы: ' + fails.join(' | '));
process.exit(failed ? 1 : 0);
