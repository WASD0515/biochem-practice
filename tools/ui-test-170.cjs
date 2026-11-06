'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist'),server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname+(req.url==='/'?'index.html':''));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
(async()=>{
 fs.mkdirSync(path.resolve(__dirname,'../release'),{recursive:true});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await chromium.launch({headless:true,...(process.env.BIOCHEM_CHROME?{executablePath:process.env.BIOCHEM_CHROME}:{})}),c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await c.route(/https:\/\/(raw.githubusercontent.com|api.github.com)\//,r=>r.abort());
 const go=async page=>p.locator(`#nav [data-page="${page}"]`).click();
 const view=async v=>p.locator(`[data-action="specialty-view"][data-view="${v}"]`).first().click();
 const count=async()=>assert.equal(Number(await p.locator('[data-specialty-count]').innerText()),await p.evaluate(()=>filtered(studyPool()).length));
 const end=async()=>{await p.locator('#question-progress summary').click();await p.locator('[data-action="end-practice"]').click();};
 try{
  await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.evaluate(()=>{state.settings.autoCheckUpdates=false;persist();});
  await go('practice');assert.equal(await p.locator('#nav [data-page="practice"]').innerText(),'▤\n专项练习');assert.equal(await p.locator('.specialty-entry').count(),2);
  await p.screenshot({path:'release/specialty-home-1.7.0.jpg',fullPage:true});
  await view('types');assert.equal(await p.locator('.type-card').count(),8);
  await p.locator('[data-action="specialty-type"][data-type="single"]').click();
  const topic='氨基酸、肽和蛋白质';await p.locator('#topic-filter').selectOption(topic);await count();
  assert((await p.locator('.specialty-selection').innerText()).includes(topic+' × 单选题'));
  const ids=await p.evaluate(()=>specialtyPool().map(q=>q.id));assert(ids.length>1);
  await p.locator('[data-mode="sequential"]').click();assert.deepEqual(await p.evaluate(()=>state.practice.ids),ids);
  assert(await p.evaluate(()=>state.practice.ids.every(id=>byId(id).type==='single'&&byId(id).topic===state.settings.practiceTopic)));
  await p.locator('[data-action="select"]').first().click();assert.equal(await p.locator('.answer-box').count(),1);
  const box=await p.locator('[data-testid="next-question"]').boundingBox();assert(box.y>=0&&box.y+box.height<=844);await p.locator('[data-testid="next-question"]').click();
  assert.equal(await p.evaluate(()=>state.practice.index),1);assert((await p.locator('.subtitle').innerText()).includes(topic+' × 单选题'));await end();
  await go('practice');await view('chapters');assert.equal(await p.locator('#type-filter').inputValue(),'single');assert.equal(await p.locator('#topic-filter').inputValue(),topic);
  const card=p.locator(`.topic-card[data-topic="${topic}"]`);assert((await card.innerText()).includes('当前可练 '+ids.length));await card.click();
  await p.locator('#type-filter').selectOption('fill');await count();await p.locator('[data-mode="random"]').click();assert(await p.evaluate(()=>state.practice.ids.every(id=>byId(id).type==='fill'&&byId(id).topic===state.settings.practiceTopic)));await end();
  await go('practice');await view('types');assert.equal(await p.locator('#type-filter').inputValue(),'fill');assert.equal(await p.locator('#topic-filter').inputValue(),topic);
  for(const type of await p.locator('.type-card').all()){
   const key=await type.getAttribute('data-type'),n=await p.evaluate(t=>specialtyPool({type:t}).length,key);assert((await type.innerText()).includes('当前可练 '+n));
  }
  await p.screenshot({path:'release/specialty-types-1.7.0.jpg',fullPage:true});
  await p.reload();await go('practice');await view('chapters');assert.equal(await p.locator('#type-filter').inputValue(),'fill');assert.equal(await p.locator('#topic-filter').inputValue(),topic);
  await p.locator('.topic-card[data-topic="其他章节"]').click();await p.locator('#type-filter').selectOption('single');assert.equal(await p.locator('[data-mode="sequential"]').isEnabled(),false);
  await p.locator('#specialty-options summary').click();await p.locator('[data-include-review]').check();await count();assert(await p.locator('[data-mode="sequential"]').isEnabled());
  await p.locator('[data-mode="sequential"]').click();assert(await p.evaluate(()=>state.practice.ids.every(id=>byId(id).status==='review'&&byId(id).topic==='其他章节'&&byId(id).type==='single')));await end();
  await p.evaluate(()=>{state.settings.scopeExplicit=true;state.settings.examTopics=['氨基酸、肽和蛋白质'];persist();});await go('practice');await view('types');await p.locator('[data-action="specialty-type"][data-type="single"]').click();await count();assert.equal(await p.locator('[data-specialty-count]').innerText(),'0');assert.equal(await p.locator('[data-mode="random"]').isEnabled(),false);
  await p.locator('[data-action="reset-specialty"]').click();assert(await p.evaluate(()=>state.settings.scopeExplicit&&state.settings.examTopics.length===1));await count();
  await p.evaluate(()=>{state.settings.practiceType='flashcard';state.settings.practiceTopic='其他章节';});await go('mock');await p.locator('[data-action="generate-exam"]').click();assert(await p.evaluate(()=>state.exam.items.every(x=>byId(x.id).topic==='氨基酸、肽和蛋白质')));assert(await p.evaluate(()=>state.exam.items.some(x=>byId(x.id).type!=='flashcard')));
  await p.locator('[data-testid="submit-exam-now"]').click();await p.locator('[data-action="confirm-exam"]').click();
  for(const size of [{width:320,height:568},{width:360,height:640},{width:844,height:390},{width:1440,height:1000}]){
   await p.setViewportSize(size);await go('practice');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await view('types');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await view('chapters');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await p.setViewportSize({width:1440,height:1000});await p.locator('[data-action="reset-specialty"]').click();await go('practice');await p.screenshot({path:'release/specialty-desktop-1.7.0.jpg',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS UI 1.7.0: both entries, bidirectional filters/counts, exact sequential/random pools, immediate answer/next, review/zero scope, reload persistence, reset isolation, scoped mocks and responsive layouts.');
 }catch(error){await p.screenshot({path:'release/specialty-failure-1.7.0.png'}).catch(()=>{});throw error;}
 finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
