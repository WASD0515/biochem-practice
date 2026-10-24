"""Build a universal offline macOS app with Xcode. No paid signing account needed.

The ad-hoc signature provides local integrity, not Developer ID/notarization.
"""
from pathlib import Path
import json, os, plistlib, shutil, subprocess
ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
OUT = ROOT / 'release/macos'
BUILD = ROOT / 'build-tools/macos'
APP = OUT / '生化练习室.app'
def run(*args): subprocess.run([str(x) for x in args], check=True)
OUT.mkdir(parents=True, exist_ok=True)
BUILD.mkdir(parents=True, exist_ok=True)
if APP.exists(): shutil.rmtree(APP)
resources = APP / 'Contents/Resources'
binary = APP / 'Contents/MacOS'
resources.mkdir(parents=True)
binary.mkdir()
shutil.copytree(ROOT / 'dist', resources / 'dist')
info = plistlib.loads((ROOT / 'native/macos/Info.plist').read_bytes())
info['CFBundleShortVersionString'] = VERSION
(APP / 'Contents/Info.plist').write_bytes(plistlib.dumps(info))
iconset = BUILD / 'AppIcon.iconset'
iconset.mkdir(exist_ok=True)
for pixels in [16, 32, 128, 256, 512]:
    for scale in [1, 2]:
        name = f'icon_{pixels}x{pixels}' + ('@2x' if scale == 2 else '') + '.png'
        run('sips', '-z', pixels * scale, pixels * scale, ROOT / 'dist/icon-512.png', '--out', iconset / name)
run('iconutil', '-c', 'icns', iconset, '-o', resources / 'AppIcon.icns')
sdk = subprocess.check_output(['xcrun', '--sdk', 'macosx', '--show-sdk-path'], text=True).strip()
for arch in ['arm64', 'x86_64']:
    run('xcrun', 'swiftc', '-O', '-sdk', sdk, '-target', f'{arch}-apple-macos12.3',
        '-module-cache-path', BUILD / 'module-cache', '-framework', 'AppKit', '-framework', 'WebKit',
        ROOT / 'native/macos/Main.swift', '-o', BUILD / f'BiochemPractice-{arch}')
run('lipo', '-create', BUILD / 'BiochemPractice-arm64', BUILD / 'BiochemPractice-x86_64', '-output', binary / 'BiochemPractice')
run('codesign', '--force', '--sign', '-', '--timestamp=none', APP)
run('codesign', '--verify', '--deep', '--strict', APP)
zip_path = OUT / f'Biochem-Practice-{VERSION}-mac-universal.zip'
if zip_path.exists(): zip_path.unlink()
run('ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', APP, zip_path)
stage = BUILD / 'dmg-root'
if stage.exists(): shutil.rmtree(stage)
stage.mkdir()
shutil.copytree(APP, stage / APP.name)
os.symlink('/Applications', stage / 'Applications')
(stage / '安装说明.txt').write_text('将“生化练习室”拖到 Applications（应用程序）。\n支持 macOS 12.3 及以上、Apple 芯片和 Intel。\n此包尚无 Developer ID 签名与苹果公证；请遵循学校及系统安全策略。\n若系统不允许打开，可直接使用通用网页版本：\nhttps://wasd0515.github.io/biochem-practice/dist/\n升级前建议导出学习备份。\n', encoding='utf-8')
dmg = OUT / f'Biochem-Practice-{VERSION}-mac-universal.dmg'
if dmg.exists(): dmg.unlink()
run('hdiutil', 'create', '-volname', f'生化练习室 {VERSION}', '-srcfolder', stage, '-ov', '-format', 'UDZO', dmg)
print(f'Built: {dmg}\nBuilt: {zip_path}')
