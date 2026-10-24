"""Create public source, teacher resources, iPhone web deployment and checksums.

Run from the public repository after native builds. Keys and personal backups are
never included. Native installers must already exist in release/android, windows,
and macos. No GitHub writes are performed by this script.
"""
from pathlib import Path
import hashlib, json, shutil, zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
OUT = ROOT / 'release' / ('github-v' + VERSION)
OUT.mkdir(parents=True, exist_ok=True)

def allowed(path):
    rel = path.relative_to(ROOT)
    return not any(part in ['.git', 'build', 'node_modules', '__pycache__'] for part in rel.parts) and path.suffix.lower() not in ['.keystore', '.jks', '.p12', '.pem', '.pyc'] and not path.name.startswith('.env')

def archive(name, paths, prefix=''):
    with zipfile.ZipFile(OUT / name, 'w', zipfile.ZIP_DEFLATED) as target:
        for file in sorted(set(paths)):
            if file.is_file() and allowed(file): target.write(file, prefix + file.relative_to(ROOT).as_posix())

folders = ['dist', 'native', 'tools', 'docs', 'templates', 'ai', 'data', 'source-data']
source = [file for folder in folders for file in (ROOT / folder).rglob('*')]
source += [ROOT / name for name in ['README.md', 'package.json', 'pnpm-lock.yaml', 'app-update.json', '.gitignore', 'index.html', '_config.yml']]
archive(f'Biochem-Practice-Source-{VERSION}.zip', source, f'biochem-practice-{VERSION}/')
archive(f'Biochem-Teacher-Templates-and-AI-{VERSION}.zip', [f for folder in ['templates', 'ai'] for f in (ROOT / folder).rglob('*')] + [ROOT / 'docs/题库导入教程.md', ROOT / 'docs/题库格式规则.md'])
with zipfile.ZipFile(OUT / f'Biochem-Practice-{VERSION}-iPhone-Web.zip', 'w', zipfile.ZIP_DEFLATED) as target:
    for file in sorted((ROOT / 'dist').rglob('*')):
        if file.is_file(): target.write(file, file.relative_to(ROOT / 'dist').as_posix())
    target.write(ROOT / 'docs/苹果设备安装与使用.md', '部署与安装.md')
shutil.copy2(ROOT / 'dist/question-bank.json', OUT / 'Biochem-Question-Bank-v5.json')
for source_path in [f'android/Biochem-Practice-{VERSION}.apk', f'windows/Biochem-Practice-Setup-{VERSION}-x64.exe', f'macos/Biochem-Practice-{VERSION}-mac-universal.dmg', f'macos/Biochem-Practice-{VERSION}-mac-universal.zip']:
    source_file = ROOT / 'release' / source_path
    if not source_file.is_file(): raise SystemExit('Missing native build: ' + str(source_file))
    shutil.copy2(source_file, OUT / source_file.name)
files = sorted(f for f in OUT.iterdir() if f.is_file() and not f.name.startswith('SHA256SUMS'))
(OUT / f'SHA256SUMS-{VERSION}.txt').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest() + '  ' + f.name + '\n' for f in files))
print('Release files:', OUT)
