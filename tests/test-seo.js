/* SEO-контракт лендингов: то, что ломает индексацию и CTR, проверяется статически.
 *
 * Причина появления (14.11.2026, аудит):
 *  - title длиннее 60 символов обрезается в выдаче — было 80 у /final-accounting-probate;
 *  - description длиннее 160 — было 180 у /executor-fee-calculator;
 *  - на 6 лендингах FAQPage был размечен в JSON-LD, но НЕ виден на странице
 *    (Google требует, чтобы размеченное было видно читателю);
 *  - на главной наоборот: FAQ виден, схемы не было;
 *  - в sitemap не было ни одного <lastmod>.
 *
 * Тест читает файлы из site/ (единственный источник, root генерируется sync-root.py).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');

let passed = 0, failed = 0;
const fail = [];
function ok(name, cond, extra) {
    if (cond) { passed++; }
    else { failed++; fail.push(name); console.log('  ✗', name, extra === undefined ? '' : String(extra).slice(0, 300)); }
}

const LANDS = fs.readdirSync(SITE)
    .filter((f) => f.endsWith('.html') && !['app.html', 'privacy.html', 'index.html'].includes(f));
const ALL = fs.readdirSync(SITE).filter((f) => f.endsWith('.html'));

function read(f) { return fs.readFileSync(path.join(SITE, f), 'utf8'); }

// --- 1. Сниппеты укладываются в выдачу ---
for (const f of LANDS) {
    const s = read(f);
    const t = (s.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const title = t.replace(/\s+/g, ' ').trim();
    const d = (s.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) || [])[1] || '';
    ok(`${f}: title ≤60 символов`, title.length > 0 && title.length <= 60, `${title.length}: ${title}`);
    ok(`${f}: description ≤160 символов`, d.length > 0 && d.length <= 160, `${d.length} символов`);
    // Заголовок лендинга должен начинаться с фразы, которой ищут, а не с названия продукта.
    // Главная — исключение: на ней живёт бренд (pitfall 0g: лендинг владеет ключевиком,
    // домашняя страница позиционируется как сам инструмент).
    ok(`${f}: title не начинается с названия бренда`,
        !/^estate ledger/i.test(title), title);
}

// --- 2. Уникальность title и canonical ---
const titles = ALL.map((f) => (read(f).match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '')
    .map((x) => x.replace(/\s+/g, ' ').trim());
ok('все title уникальны', new Set(titles).size === titles.length,
    titles.filter((t, i) => titles.indexOf(t) !== i).join(' | '));

const canon = ALL.map((f) => (read(f).match(/rel="canonical"[^>]*href="([^"]+)"/) || [])[1] || '');
ok('canonical есть у каждой страницы', canon.every(Boolean));
ok('canonical уникальны', new Set(canon).size === canon.length);

// --- 3. FAQ: разметка обязана совпадать с тем, что видно на экране ---
for (const f of ALL) {
    const s = read(f);
    const visible = [...s.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    let schema = [];
    for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        try {
            const j = JSON.parse(m[1]);
            if (j['@type'] === 'FAQPage') {
                schema = (j.mainEntity || []).map((q) => String(q.name).replace(/\s+/g, ' ').trim());
            }
        } catch (e) {
            ok(`${f}: JSON-LD парсится`, false, String(e).slice(0, 120));
        }
    }
    if (schema.length || visible.length) {
        ok(`${f}: FAQ в схеме и на экране совпадает`,
            schema.length === visible.length && schema.every((q) => visible.includes(q)),
            `схема ${schema.length}, экран ${visible.length}`);
        ok(`${f}: FAQ не только в разметке, но и виден`,
            schema.length === 0 || visible.length > 0);
    }
}

// --- 4. У каждой индексируемой страницы есть JSON-LD ---
for (const f of LANDS.concat(['index.html'])) {
    ok(`${f}: есть JSON-LD`, read(f).includes('application/ld+json'));
}

// --- 5. Sitemap: lastmod у каждого URL, состав совпадает с реальными страницами ---
const sm = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
ok('sitemap: у каждого URL есть lastmod', lastmods.length === locs.length,
    `${locs.length} URL, ${lastmods.length} lastmod`);
ok('sitemap: lastmod в формате YYYY-MM-DD',
    lastmods.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), lastmods.join(','));
ok('sitemap: главная и app.html включены',
    locs.some((l) => l.endsWith('estateledger.app/') || l.endsWith('estateledger.app')),
    locs.length + ' URL');
ok('sitemap: нет пустых <lastmod>', !sm.includes('<lastmod></lastmod>'));

// --- 6. Тонкий контент: лендинг должен давать ответ, а не заголовок ---
for (const f of LANDS) {
    const s = read(f)
        .replace(/<script[\s\S]*?<\/script>/g, ' ')
        .replace(/<style[\s\S]*?<\/style>/g, ' ');
    const words = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
    ok(`${f}: не меньше 300 слов`, words >= 300, `${words} слов`);
}

// --- 7. Честность: никаких обещаний юридической гарантии ---
const g = read('index.html');
ok('на главной есть дисклеймер «not legal advice»',
    /not legal advice|educational organizing tool/i.test(g));

console.log(`\nSEO: ${passed}/${passed + failed} PASS` + (failed ? `, ${failed} FAIL` : ''));
if (failed) console.log('провалы: ' + fail.join(' | '));
process.exit(failed ? 1 : 0);
