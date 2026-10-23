"""Build a signed, architecture-independent WebView APK with official SDK tools."""
from pathlib import Path
import subprocess,shutil,os,zipfile
R=Path(__file__).resolve().parents[1];N=R/'native/android';B=N/'build';B.mkdir(exist_ok=True)
J=Path(os.environ['JAVA_HOME']);sdk=Path(os.environ['ANDROID_SDK_ROOT']);tools=sdk/'build-tools'/os.environ.get('ANDROID_BUILD_TOOLS_VERSION','35.0.0');jar=sdk/'platforms/android-35/android.jar';env={**os.environ,'PATH':str(J/'bin')+os.pathsep+os.environ['PATH']}
def run(*args,cwd=None):subprocess.run([str(x) for x in args],cwd=cwd,env=env,check=True)
res=N/'res/drawable';res.mkdir(parents=True,exist_ok=True);shutil.copy(R/'dist/icon-192.png',res/'icon.png')
run(tools/'aapt2','compile','--dir',N/'res','-o',B/'resources.zip')
run(tools/'aapt2','link','-o',B/'unsigned.apk','-I',jar,'--manifest',N/'AndroidManifest.xml','-A',R/'dist',B/'resources.zip')
(B/'classes').mkdir(exist_ok=True);(B/'dex').mkdir(exist_ok=True)
run(J/'bin/javac','--release','8','-encoding','UTF-8','-classpath',jar,'-d',B/'classes',*N.glob('src/**/*.java'))
run(tools/'d8','--min-api','26','--lib',jar,'--output',B/'dex',*B.glob('classes/**/*.class'))
with zipfile.ZipFile(B/'unsigned.apk','a',compression=zipfile.ZIP_STORED) as z:z.write(B/'dex/classes.dex','classes.dex')
run(tools/'zipalign','-f','4',B/'unsigned.apk',B/'aligned.apk')
key=Path(os.environ['BIOCHEM_KEYSTORE']);alias=os.environ['BIOCHEM_KEY_ALIAS']
if not key.is_file():raise SystemExit('BIOCHEM_KEYSTORE must point to an existing private signing key')
for required in ['BIOCHEM_STORE_PASSWORD','BIOCHEM_KEY_PASSWORD']:
 if not os.environ.get(required):raise SystemExit('Missing '+required)
out=R/'release/android/Biochem-Practice-1.5.0.apk';out.parent.mkdir(parents=True,exist_ok=True)
run(tools/'apksigner','sign','--ks',key,'--ks-key-alias',alias,'--ks-pass','env:BIOCHEM_STORE_PASSWORD','--key-pass','env:BIOCHEM_KEY_PASSWORD','--out',out,B/'aligned.apk')
run(tools/'apksigner','verify','--verbose',out);run(tools/'aapt2','dump','badging',out)
print('Built:',out)
