'use strict';
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),U=require('../dist/update');
const root=path.resolve(__dirname,'../dist'),prefix='/biochem-practice/dist/';let revision=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))return res.writeHead(404).end();
 const file=path.resolve(root,decodeURIComponent(url.pathname.slice(prefix.length)||'index.html'));
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/html');
  res.setHeader('Cache-Control','no-cache');
  if(file.endsWith('/sw.js')&&revision)data=Buffer.from(data.toString().replace("CACHE=PREFIX+'1.6.0'","CACHE=PREFIX+'1.6.1'"));
  res.end(data);
 });
});
(async()=>{fs.mkdirSync(path.resolve(__dirname,'../release'),{recursive:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}),p=await c.newPage(),errors=[];
 p.on('pageerror',error=>errors.push(error.message));
 await c.route(/https:\/\/(?:raw.githubusercontent.com|api.github.com)\//,route=>route.abort());
 const url=`http://127.0.0.1:${server.address().port}${prefix}`;
 try{
  await p.goto(url);await p.waitForFunction(()=>navigator.serviceWorker.controller&&document.querySelector('#connection').textContent==='离线已就绪');
  assert.equal(await p.locator('#install').isVisible(),true);await p.locator('#install').click();
  assert((await p.locator('#modal').innerText()).includes('Safari'));await p.locator('#modal [data-action="close-modal"]').click();
  await p.screenshot({path:'release/preview-iphone-install-1.6.0.jpg',fullPage:true});
  await p.evaluate(async()=>{state.settings.autoCheckUpdates=false;state.settings.includeReview=true;persist();render();await caches.open('another-app-cache');});
  assert.equal(await p.evaluate(()=>studyPool().length),2433);
  // Fully offline navigation and reload, preserving a real first answer and the current question.
  await c.setOffline(true);await p.reload();await p.locator('[data-mode="infinite-sequential"]').click();
  assert.equal(await p.evaluate(()=>state.practice.ids.length),2433);
  await p.evaluate(()=>{const q=active().find(q=>q.status==='active'&&q.type==='single');startPractice('sequential',[q.id,...active().filter(x=>x.id!==q.id).slice(0,2).map(x=>x.id)]);});
  await p.locator('[data-action="select"]').first().click();assert.equal(await p.locator('.answer-box').count(),1);
  const next=await p.locator('[data-testid="next-question"]').boundingBox();assert(next.y>=0&&next.y+next.height<=844,'next question remains visible');
  await p.locator('[data-testid="next-question"]').click();await p.reload();
  assert.equal(await p.evaluate(()=>state.practice.index),1);assert.equal(await p.evaluate(()=>Object.keys(state.records).length),1);
  await p.screenshot({path:'release/preview-iphone-offline-1.6.0.jpg',fullPage:false});
  await c.setOffline(false);revision=1;await p.evaluate(()=>webRegistration.update());
  await p.waitForFunction(()=>webRegistration?.waiting&&webUpdateReady);
  // An active mock blocks a requested update. After submission the user's explicit update reloads.
  await p.evaluate(()=>{state.practice=null;nav('mock');actions['generate-exam']();});
  assert.equal(await p.evaluate(()=>!!state.exam&&!state.exam.graded),true);
  await p.evaluate(()=>applyWebUpdate());assert.equal(await p.evaluate(()=>refreshForUpdate),false);
  assert((await p.locator('#toast').innerText()).includes('先交卷'));
  await p.locator('[data-testid="submit-exam-now"]').click();await p.locator('[data-action="confirm-exam"]').click();
  await p.evaluate(()=>nav('settings'));await p.locator('[data-action="apply-web-update"]').click();
  await p.waitForFunction(async()=>navigator.serviceWorker.controller&&(await caches.keys()).some(k=>k.endsWith(':1.6.1')));
  await p.waitForFunction(()=>typeof state!=='undefined'&&state.exam?.graded);
  assert.equal(await p.evaluate(()=>Object.keys(state.records).length),1);
  assert((await p.evaluate(()=>caches.keys())).includes('another-app-cache'),'another app cache survives');
  await c.setOffline(true);await p.reload();assert.equal(await p.evaluate(()=>bank().length),2433);
  await p.evaluate(()=>{window.DesktopBridge={platform:'darwin'};});
  assert.equal(await p.evaluate(()=>P.downloadTarget({macos:'mac.dmg',windows:'windows.exe'}).url),'mac.dmg');
  await p.evaluate(()=>{delete window.DesktopBridge;});assert.equal(await p.evaluate(()=>P.downloadTarget({android:'app.apk',windows:'app.exe'})),null);
  for(const size of [{width:320,height:568},{width:844,height:390},{width:1024,height:768}]){
   await p.setViewportSize(size);await p.evaluate(()=>nav('home'));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const future='1.7.0',name=`Biochem-Practice-${future}-mac-universal.dmg`,asset=U.RELEASES+`/download/v${future}/`+name;
  assert.equal(U.parseRelease({tag_name:'v'+future,html_url:U.RELEASES+'/tag/v'+future,assets:[{name,browser_download_url:asset}]}).assets.macos,asset);
  assert.equal(U.parseRelease({tag_name:'v'+future,html_url:U.RELEASES+'/tag/v'+future,assets:[{name,browser_download_url:'https://evil.example/'+name}]}).assets.macos,undefined);
  assert.deepEqual(errors,[]);
  console.log('PASS 1.6.0: iPhone install help, subdirectory offline cache/reload, 2433 pool, answer/next/persistence, explicit atomic web update, exam protection, foreign-cache preservation, Mac-only download selection, trusted Mac asset and responsive layouts.');
 }catch(error){await p.screenshot({path:'release/ui-test-failure-1.6.0.png'}).catch(()=>{});throw error;}
 finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
