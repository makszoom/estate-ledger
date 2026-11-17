#!/usr/bin/env python3
"""deploy.py — деплой site/ в репозиторий makszoom/estate-ledger (GitHub Pages, корень).

Правила проекта (AGENTS.md):
  - site/ = ЕДИНСТВЕННЫЙ источник, ROOT генерируется scripts/sync-root.py;
  - backup перед деплоем: backup-YYYY-MM-DD/;
  - деплой через GitHub REST API (PAT из ~/Projects/csvtojson/.env).

Почему не «деплоить всё»: git-blob SHA сравнивать нельзя — на Windows файлы
с CRLF, в репозитории LF, и сравнение по SHA объявляет изменённым каждый файл.
Здесь содержимое сравнивается после нормализации переводов строк.

  python scripts/deploy.py            # только изменённые файлы
  python scripts/deploy.py --all      # все файлы из site/
  python scripts/deploy.py --dry-run  # показать, что уйдёт
"""
import base64
import os
import sys
from pathlib import Path

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
SITE_PATH = Path(SITE)
ENV = os.path.join(os.path.expanduser('~'), 'Projects', 'csvtojson', '.env')
OWNER, REPO, BRANCH = 'makszoom', 'estate-ledger', 'main'
# .csv добавлен 17.11.2026: шаблоны инвентаря и реестра живут в site/templates/
EXTS = ('.html', '.xml', '.svg', '.png', '.json', '.jpg', '.webp', '.txt', '.csv')


def token():
    with open(ENV, encoding='utf-8') as f:
        for line in f:
            if line.startswith('GITHUB_TOKEN='):
                return line.split('=', 1)[1].strip()
    raise SystemExit('GITHUB_TOKEN не найден в ' + ENV)


def norm(b):
    return b.replace(b'\r\n', b'\n')


def main():
    dry = '--dry-run' in sys.argv
    force_all = '--all' in sys.argv
    H = {'Authorization': f'Bearer {token()}', 'Accept': 'application/vnd.github+json'}

    # rglob, а не listdir: site/templates/*.csv лежат в подпапке
    files = sorted(str(f.relative_to(SITE_PATH)).replace(os.sep, '/') for f in SITE_PATH.rglob('*')
                   if f.is_file() and f.name.endswith(EXTS))
    if not files:
        raise SystemExit('в site/ нет файлов для деплоя')

    todo = []
    for name in files:
        local = open(os.path.join(SITE, name), 'rb').read()
        r = requests.get(f'https://api.github.com/repos/{OWNER}/{REPO}/contents/{name}',
                         headers=H, params={'ref': BRANCH}, timeout=25)
        if r.status_code == 404:
            todo.append((name, local, None))
            continue
        if r.status_code != 200:
            print(f'  [!] {name}: GET {r.status_code}')
            continue
        remote = base64.b64decode(r.json()['content'])
        if force_all or norm(local) != norm(remote):
            todo.append((name, local, r.json()['sha']))

    print(f'файлов в site/: {len(files)} | к деплою: {len(todo)}')
    for name, local, sha in todo:
        print(f'  {"НОВЫЙ   " if sha is None else "ИЗМЕНЁН "} {name} ({len(local)} b)')
    if dry:
        return 0
    if not todo:
        print('нечего деплоить — site/ совпадает с репозиторием')
        return 0

    ok = 0
    for name, local, sha in todo:
        body = {'message': f'seo: {name} — lastmod, visible FAQ, snippet lengths',
                'content': base64.b64encode(local).decode('ascii'), 'branch': BRANCH}
        if sha:
            body['sha'] = sha
        r = requests.put(f'https://api.github.com/repos/{OWNER}/{REPO}/contents/{name}',
                         headers=H, json=body, timeout=40)
        print(f'  [{"OK " if r.status_code in (200, 201) else "ERR"}] {name} {r.status_code}')
        if r.status_code in (200, 201):
            ok += 1
        else:
            print('       ', str(r.json().get('message'))[:150])
    print(f'\nзадеплоено {ok} из {len(todo)}')
    return 0 if ok == len(todo) else 1


if __name__ == '__main__':
    sys.exit(main())
