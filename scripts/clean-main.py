"""Удаление внутренних файлов из ветки main (то, что отдаёт GitHub Pages).

Pages настроен на main + корень, поэтому публично доступно ВСЁ, что лежит в
репозитории, а не только сайт. На 18.11.2026 на сайте лежали:
  - PLAN-DETAILED.md (план с экономикой проекта)
  - AGENTS.md (инструкции агенту)
  - docs/ (V2-SPEC, COMPETITIVE-ANALYSIS, ROADMAP, CF-TOKEN-STEPS)
  - tests/ (25 файлов тестов)
  - site/ (полный дубль сайта — ещё и риск дублированного контента)
  - scripts/, package.json

Оставляем только то, что нужно самому сайту: HTML, js/, templates/, css/,
favicon.svg, robots.txt, sitemap.xml, CNAME, qr-donate.png, ключ IndexNow.

Запуск: python scripts/clean-main.py --dry-run   (показать)
        python scripts/clean-main.py             (удалить)
"""
import os
import sys

import requests

OWNER, REPO, BRANCH = 'makszoom', 'estate-ledger', 'main'
ENV = os.path.join(os.path.expanduser('~'), 'Projects', 'csvtojson', '.env')

# Папки и файлы, которых не должно быть в публикуемой ветке
DROP_PATHS = ['PLAN-DETAILED.md', 'AGENTS.md', 'docs', 'tests', 'site', 'scripts',
              'package.json', 'package-lock.json']
# Что обязано остаться: сайт не работает без этих путей
KEEP_PATHS = ['js', 'templates', 'css']


def token():
    with open(ENV, encoding='utf-8') as fh:
        for line in fh:
            if line.startswith('GITHUB_TOKEN='):
                return line.split('=', 1)[1].strip()
    raise SystemExit('GITHUB_TOKEN не найден в ' + ENV)


def list_tree(session, path=''):
    """Вернуть список файлов (не папок) под path."""
    url = f'https://api.github.com/repos/{OWNER}/{REPO}/contents/{path}'
    r = session.get(url, params={'ref': BRANCH}, timeout=30)
    if r.status_code != 200:
        return []
    out = []
    for item in r.json():
        if item['type'] == 'file':
            out.append(item['path'])
        elif item['type'] == 'dir':
            out.extend(list_tree(session, item['path']))
    return out


def main():
    dry = '--dry-run' in sys.argv
    session = requests.Session()
    session.headers.update({'Authorization': f'Bearer {token()}',
                            'Accept': 'application/vnd.github+json'})

    targets = []
    for p in DROP_PATHS:
        r = session.get(f'https://api.github.com/repos/{OWNER}/{REPO}/contents/{p}',
                        params={'ref': BRANCH}, timeout=30)
        if r.status_code != 200:
            print(f'  нет в main: {p}')
            continue
        data = r.json()
        if isinstance(data, list):
            targets.extend(list_tree(session, p))
        else:
            targets.append(data['path'])

    # страховка: не удаляем ничего из KEEP_PATHS
    risky = [t for t in targets if any(t == k or t.startswith(k + '/') for k in KEEP_PATHS)]
    if risky:
        raise SystemExit('ОСТАНОВКА: в списке на удаление есть нужное сайту: ' + ', '.join(risky))

    print(f'к удалению: {len(targets)} файлов')
    for t in targets[:12]:
        print('   ', t)
    if len(targets) > 12:
        print(f'    ... и ещё {len(targets) - 12}')

    if dry:
        print('\n--dry-run: ничего не удалено')
        return 0

    ok = bad = 0
    for path in targets:
        url = f'https://api.github.com/repos/{OWNER}/{REPO}/contents/{path}'
        r = session.get(url, params={'ref': BRANCH}, timeout=30)
        if r.status_code != 200:
            bad += 1
            print(f'  [SKIP] {path}: нет sha')
            continue
        sha = r.json()['sha']
        d = session.delete(url, json={'message': f'clean: {path} не должен публиковаться на Pages',
                                      'sha': sha, 'branch': BRANCH}, timeout=30)
        if d.status_code in (200, 204):
            ok += 1
        else:
            bad += 1
            print(f'  [FAIL] {path}: {d.status_code} {d.text[:80]}')
    print(f'\nудалено: {ok}, ошибок: {bad}')
    return 0 if bad == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
