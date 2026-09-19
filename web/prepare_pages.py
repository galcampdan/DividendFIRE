#!/usr/bin/env python3
from pathlib import Path
import shutil

ROOT=Path(__file__).resolve().parents[1]
SITE=ROOT/"site"
STATIC=ROOT/"app"/"static"
WEB=ROOT/"web"

if SITE.exists():
    shutil.rmtree(SITE)
SITE.mkdir(parents=True)

for p in STATIC.iterdir():
    if p.is_file():
        shutil.copy2(p,SITE/p.name)

shutil.copy2(WEB/"web-api.js",SITE/"web-api.js")
(SITE/"data").mkdir(exist_ok=True)
shutil.copy2(WEB/"data"/"market.json",SITE/"data"/"market.json")
(SITE/".nojekyll").write_text("",encoding="utf-8")

index=(SITE/"index.html").read_text(encoding="utf-8")
needle='<script src="app.js?v=8.9.3-nominal-real-hover-1"></script>'
replacement='<script src="web-api.js?v=1"></script>\n'+needle
if needle not in index:
    raise SystemExit("app.js script tag not found")
index=index.replace(needle,replacement)
index=index.replace('<title>','<title>Web · ',1)
(SITE/"index.html").write_text(index,encoding="utf-8")
print("Prepared Pages site at",SITE)
