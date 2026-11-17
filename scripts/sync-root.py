# -*- coding: utf-8 -*-
"""Синк site/ -> repo ROOT (Pages отдаёт КОРЕНЬ по source main/path=/).
Запуск перед каждым git push. Урок Д17.10: root vs site дубли — Pages отдаёт ROOT.
Правило: редактируем ТОЛЬКО site/, root генерируется этим скриптом."""
import shutil, pathlib, sys
P = pathlib.Path(__file__).resolve().parent.parent
SITE = P / 'site'
ROOT = P
# rglob: site/templates/*.csv тоже должны попасть в корень (Pages отдаёт ROOT)
FILES = [p.relative_to(SITE) for p in SITE.rglob('*') if p.is_file()]
copied = 0
for rel in FILES:
    src = SITE / rel
    dst = ROOT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or src.read_bytes() != dst.read_bytes():
        shutil.copy2(src, dst)
        copied += 1
        print(f'  synced {rel}')
print(f'Done: {copied} файл(ов) синхронизировано root <- site')
