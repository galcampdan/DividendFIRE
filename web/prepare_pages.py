#!/usr/bin/env python3
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1];SITE=ROOT/"site";STATIC=ROOT/"app"/"static";WEB=ROOT/"web";SHARED=ROOT/"shared"
if SITE.exists(): shutil.rmtree(SITE)
SITE.mkdir(parents=True)
for p in STATIC.iterdir():
    if p.is_file(): shutil.copy2(p,SITE/p.name)
for src,name in [(SHARED/"simulation-core.js","simulation-core.js"),(WEB/"web-api.js","web-api.js"),(WEB/"pwa.js","pwa.js"),(WEB/"service-worker.js","service-worker.js"),(WEB/"manifest.webmanifest","manifest.webmanifest"),(WEB/"app-icon.svg","app-icon.svg")]:
    shutil.copy2(src,SITE/name)
(SITE/"data").mkdir(exist_ok=True);shutil.copy2(WEB/"data"/"market.json",SITE/"data"/"market.json");(SITE/".nojekyll").write_text("",encoding="utf-8")
index=(SITE/"index.html").read_text(encoding="utf-8")
index=index.replace('<link rel="stylesheet" href="style.css?v=2.0.4-salary-growth-1">','<meta name="theme-color" content="#111111">\n  <meta name="apple-mobile-web-app-capable" content="yes">\n  <meta name="apple-mobile-web-app-status-bar-style" content="default">\n  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="icon" href="app-icon.svg" type="image/svg+xml">\n  <link rel="stylesheet" href="style.css?v=2.0.4-salary-growth-1">')
needle='<script src="app.js?v=2.0.4-salary-growth-1"></script>'
replacement='<script src="simulation-core.js?v=2.0.4"></script>\n<script src="web-api.js?v=2.0.4"></script>\n<script src="pwa.js?v=2.0.4"></script>\n'+needle
if needle not in index: raise SystemExit("app.js script tag not found")
(SITE/"index.html").write_text(index.replace(needle,replacement),encoding="utf-8")
print("Prepared cross-platform static site at",SITE)
