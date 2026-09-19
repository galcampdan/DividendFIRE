#define MyAppName "Dividend FIRE Simulator"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Dividend FIRE"
#define MyAppExeName "DividendFIRE.exe"

[Setup]
AppId={{A2BA1F12-E9D4-4A61-8D3B-7F1ADDC3F9B1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\DividendFIRE
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir=..\release
OutputBaseFilename=DividendFIRE-Setup-v1.0.0
SetupIconFile=..\assets\app.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=1.0.0.0
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}

[Files]
Source: "..\dist\DividendFIRE\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "바탕화면 아이콘 만들기"; GroupDescription: "추가 바로가기:"; Flags: unchecked

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Dividend FIRE Simulator 실행"; Flags: nowait postinstall skipifsilent
