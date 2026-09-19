from pathlib import Path
import ast, re, sys

root = Path(__file__).resolve().parent
app = (root/"app"/"app.py").read_text(encoding="utf-8")
js = (root/"app"/"static"/"app.js").read_text(encoding="utf-8")
spec = (root/"DividendFIRE.spec").read_text(encoding="utf-8")
iss = (root/"installer"/"DividendFIRE.iss").read_text(encoding="utf-8")

ast.parse(app)
checks = {
    "settings in LOCALAPPDATA": 'USER_DATA_DIR = os.path.join(_local_appdata, "DividendFIRE")' in app,
    "PyInstaller static bundle support": 'sys._MEIPASS' in app,
    "heartbeat endpoint": '/api/heartbeat' in app,
    "browser heartbeat JS": '/api/heartbeat' in js,
    "onedir/no UPX": 'exclude_binaries=True' in spec and 'upx=False' in spec and 'COLLECT(' in spec,
    "per-user installer": 'DefaultDirName={localappdata}\\Programs\\DividendFIRE' in iss and 'PrivilegesRequired=lowest' in iss,
    "no packaged settings": not (root/"app"/"settings.json").exists(),
}
bad = [k for k,v in checks.items() if not v]
for k,v in checks.items():
    print(("[OK] " if v else "[FAIL] ") + k)
if bad:
    raise SystemExit(1)
print("[OK] Distribution source verified.")
