# -*- coding: utf-8 -*-
"""Синк site/ -> repo ROOT (Pages отдаёт КОРЕНЬ по source main/path=/).
Запуск перед каждым git push. Урок Д17.10: root vs site дубли — Pages отдаёт ROOT.
Правило: редактируем ТОЛЬКО site/, root генерируется этим скриптом."""
import shutil, pathlib, sys
P = pathlib.Path(__file__).resolve().parent.parent
SITE = P / 'site'
ROOT = P
FILES = [p.name for p in SITE.iterdir() if p.is_file()]
copied = 0
for name in FILES:
    src = SITE / name
    dst = ROOT / name
    if not dst.exists() or src.read_bytes() != dst.read_bytes():
        shutil.copy2(src, dst)
        copied += 1
        print(f'  synced {name}')
print(f'Done: {copied} файл(ов) синхронизировано root <- site')
