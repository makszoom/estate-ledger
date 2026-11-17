'use strict';
/* Соответствие интенту, авторство и связность estate-ledger.

Зачем (17.11.2026): аудит GSC показал, что 12% всех показов сайта приходится
на запрос «estate inventory template», где страница стоит на позиции 74.
В топе Google по этому запросу четыре из десяти результатов — прямые PDF-бланки
для скачивания (университет Конкорд, Freshwater Trust, Heritage Law, TIAA).
Люди хотят СКАЧАТЬ бланк, а на странице не было ни одного файла.

Второй дефект: доки проекта трижды требуют editorial-дату «Checked 2026-XX-XX»
(AGENTS.md §Key Decisions, COMPETITIVE-ANALYSIS §Settled, §Выводы), но ни на
одной странице её не было. Для YMYL-темы (probate, деньги, суд) это слабый
сигнал доверия.

Третий: две страницы были сиротами — на них не вела ни одна внутренняя ссылка.
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
const SITE = path.join(ROOT, 'site');
const pages = fs.readdirSync(SITE).filter((f) => f.endsWith('.html')).sort();
const read = (f) => fs.readFileSync(path.join(SITE, f), 'utf8');

// --- 1. Скачиваемый шаблон существует и на него ведёт ссылка ------------
// Интент запроса «template» = получить файл. Без файла страница не отвечает.
const TPL_DIR = path.join(SITE, 'templates');
ok('папка site/templates существует', fs.existsSync(TPL_DIR));
const tplFiles = fs.existsSync(TPL_DIR) ? fs.readdirSync(TPL_DIR) : [];
ok('в templates есть хотя бы один .csv', tplFiles.some((f) => f.endsWith('.csv')), tplFiles.join(', '));

for (const f of tplFiles.filter((x) => x.endsWith('.csv'))) {
    const raw = fs.readFileSync(path.join(TPL_DIR, f), 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    ok(`templates/${f}: есть строка заголовка`, lines.length > 0);
    ok(`templates/${f}: не пустой (есть примеры строк)`, lines.length >= 2, `${lines.length} строк`);
    // CSV не должен содержать секретов и чужих персональных данных
    ok(`templates/${f}: без email и телефонов`, !/@\w+\.\w+|\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(raw));
}

// --- 2. Колонки шаблона совпадают с экспортом инструмента ----------------
// Иначе человек заполнит файл и не сможет сверить его с тем, что отдаёт Ledger.
const core = read('js/core.js');
const appJs = read('js/app.js');
const assetsHeader = (appJs.match(/const L = \['([^']*Name,Class[^']*)'\]/) || [])[1] || '';
ok('экспорт активов в инструменте найден', assetsHeader.length > 0, assetsHeader);
if (assetsHeader && tplFiles.includes('estate-inventory-template.csv')) {
    const tplHeader = fs.readFileSync(path.join(TPL_DIR, 'estate-inventory-template.csv'), 'utf8').split(/\r?\n/)[0];
    const norm = (h) => h.split(',').map((x) => x.trim().toLowerCase());
    ok('колонки шаблона = колонки экспорта инструмента',
        JSON.stringify(norm(tplHeader)) === JSON.stringify(norm(assetsHeader)),
        `шаблон: ${tplHeader} | экспорт: ${assetsHeader}`);
}
// Классы активов в шаблоне должны быть из списка инструмента, иначе импорт не поймёт
const classes = (core.match(/ASSET_CLASSES = \[([\s\S]*?)\]/) || [])[1] || '';
const labels = { real_estate: 'Real Estate', bank_account: 'Bank Account', brokerage: 'Brokerage Account',
    cash: 'Cash', personal_property: 'Personal Property', vehicle: 'Vehicle',
    business_interest: 'Business Interest', other: 'Other' };
if (classes && tplFiles.includes('estate-inventory-template.csv')) {
    const tpl = fs.readFileSync(path.join(TPL_DIR, 'estate-inventory-template.csv'), 'utf8');
    const usedClasses = tpl.split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(',')[1]).filter(Boolean);
    const unknown = usedClasses.filter((c) => !Object.values(labels).includes(c.trim()));
    ok('классы активов в шаблоне совпадают с инструментом', unknown.length === 0, unknown.join(', '));
}

// --- 3. На страницах есть ссылка на скачивание ---------------------------
const invPage = read('estate-inventory-template.html');
ok('inventory-страница ссылается на .csv', /href="[^"]*\.csv"/.test(invPage),
    (invPage.match(/href="([^"]*\.csv)"/) || [])[1] || 'ни одной ссылки на .csv');
ok('inventory-страница говорит словом download', /download/i.test(invPage));

// --- 4. Editorial-дата «Checked 2026-XX-XX» на каждой странице ----------
// Требование доков проекта: AGENTS.md §Key Decisions п.4, COMPETITIVE-ANALYSIS §Settled.
for (const f of pages) {
    if (f === 'app.html') continue; // инструмент, а не статья: editorial-дата не нужна
    const s = read(f);
    ok(`${f}: есть editorial-дата проверки`,
        /(Checked|Last checked|Reviewed)\s+(on\s+)?\d{4}-\d{2}(-\d{2})?/.test(s) ||
        /(Checked|Last checked|Reviewed)\s+(on\s+)?[A-Z][a-z]+\s+\d{1,2},\s+20\d\d/.test(s));
}

// --- 5. Дата и автор в структурированных данных -------------------------
// Google для YMYL смотрит на dateModified и на то, кто отвечает за контент.
for (const f of ['estate-inventory-template.html', 'probate-accounting.html', 'executor-fee-calculator.html']) {
    const s = read(f);
    const blocks = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    let hasDate = false, hasAuthor = false;
    for (const b of blocks) {
        if (/"dateModified"\s*:\s*"20\d\d-\d\d-\d\d"/.test(b[1])) hasDate = true;
        if (/"author"\s*:/.test(b[1])) hasAuthor = true;
    }
    ok(`${f}: dateModified в JSON-LD`, hasDate);
    ok(`${f}: author в JSON-LD`, hasAuthor);
}

// --- 6. Нет страниц-сирот ------------------------------------------------
// На каждую контентную страницу должна вести хотя бы одна ссылка с другой страницы.
for (const f of pages) {
    if (f === 'index.html' || f === 'privacy.html') continue;
    const slug = f.replace(/\.html$/, '');
    const incoming = pages.filter((other) => {
        if (other === f) return false;
        // ссылка может быть и "slug.html", и "slug.html?utm_source=..." — закрывающая
        // кавычка стоит уже после параметров, поэтому (?:\\.html)?" не ловит
        return new RegExp('href="[^"]*' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.html').test(read(other));
    });
    ok(`${slug}: есть входящие внутренние ссылки`, incoming.length > 0, incoming.length + ' шт.');
}

// --- 7. Ссылки в продукт несут UTM --------------------------------------
// Без метки нельзя понять, какая страница приводит людей в инструмент.
for (const f of pages) {
    if (f === 'app.html' || f === 'privacy.html') continue;
    const s = read(f);
    const appLinks = [...s.matchAll(/href="([^"]*app\.html[^"]*)"/g)].map((m) => m[1]);
    if (!appLinks.length) continue;
    const withoutUtm = appLinks.filter((h) => !/utm_source=/.test(h));
    ok(`${f}: все ссылки в инструмент с utm_source`, withoutUtm.length === 0, withoutUtm.slice(0, 2).join(' | '));
}

console.log(`\nИНТЕНТ И АВТОРСТВО: ${passed}/${passed + failed} PASS` + (failed ? `, ${failed} FAIL` : ''));
if (failed) console.log('провалы: ' + fails.join(' | '));
process.exit(failed ? 1 : 0);
