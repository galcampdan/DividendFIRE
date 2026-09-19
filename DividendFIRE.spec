# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

project = Path(SPECPATH)
app_dir = project / "app"
assets = project / "assets"

a = Analysis(
    [str(app_dir / "app.py")],
    pathex=[str(app_dir)],
    binaries=[],
    datas=[(str(app_dir / "static"), "static")],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="DividendFIRE",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    icon=str(assets / "app.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="DividendFIRE",
)
