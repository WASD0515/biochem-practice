(function(root){
'use strict';
const TOPICS=Object.freeze(["生命的分子基础", "氨基酸、肽和蛋白质", "蛋白质的三维结构", "蛋白质的生物学功能", "蛋白质的性质、分离纯化和鉴定", "酶的催化作用", "酶动力学", "酶作用机制和酶活性调节", "糖类和糖生物学", "脂质和生物膜", "核酸的结构和功能", "核酸的物理化学性质和研究方法", "维生素和辅酶", "激素和信号转导", "新陈代谢总论", "生物能学", "六碳糖的分解和糖酵解作用", "柠檬酸循环", "氧化磷酸化作用", "戊糖磷酸途径", "糖异生和糖的其他代谢途径", "糖原的分解和生物合成", "光合作用", "脂质的代谢", "蛋白质降解和氨基酸的分解代谢", "氨基酸的生物合成和生物固氮", "核酸的降解和核苷酸代谢", "新陈代谢的调节控制", "基因和染色体", "DNA的复制和修复", "DNA的重组", "RNA的生物合成和加工", "蛋白质合成、加工和定位", "基因表达调节", "基因工程、蛋白质工程及相关技术", "基因组学和蛋白质组学"]);
const GRADUATE_PLAN=[{type:'definition',count:6,points:5},{type:'fill',count:10,points:2},{type:'single',count:10,points:2},{type:'judge',count:10,points:1},{type:'short',count:5,points:10},{type:'essay',count:1,points:20}];
function canonicalTopic(topic,q={}){
 const stem=String(q.stem||'');
 if(['待归类','未归类','未分类','其它章节'].includes(topic))return '其他章节';
 if(topic==='氨基酸')return TOPICS[1];
 if(topic==='蛋白质的结构与功能')return /血红蛋白|肌红蛋白|协同|氧合|抗体|免疫球蛋白|别构|波尔|Bohr/i.test(stem)?TOPICS[3]:TOPICS[2];
 if(topic==='蛋白质的分离纯化与鉴定')return TOPICS[4];
 if(topic==='酶学')return /Km|Vmax|米氏|动力学|竞争性|抑制|反应速度|反应速率/i.test(stem)?TOPICS[6]:/调节|调控|酶原|别构|共价修饰|机制|丝氨酸蛋白酶/.test(stem)?TOPICS[7]:TOPICS[5];
 if(topic==='维生素')return TOPICS[12];if(topic==='糖')return TOPICS[8];
 return topic;
}
function validChapter(name){return typeof name==='string'&&name.trim()===name&&name.length>0&&name.length<=80&&!/[<>\r\n]/.test(name);}
function topicList(state){return [...TOPICS,...new Set(['其他章节',...(state.chapters||[]).map(t=>canonicalTopic(t))].filter(t=>!TOPICS.includes(t)))];}
function migrate(saved){
 const base=empty(),state={...base,...saved,settings:{...base.settings,...saved?.settings}};
 state.reviewRecords=state.reviewRecords&&typeof state.reviewRecords==='object'?state.reviewRecords:{};
 if(state.settings.preset==='midterm')state.settings.preset='regular';
 const oldGrad=[{type:'definition',count:6,points:5},{type:'fill',count:10,points:2},{type:'single',count:10,points:2},{type:'judge',count:10,points:1},{type:'short',count:3,points:10},{type:'essay',count:2,points:20}];
 if(state.settings.preset==='graduate'&&JSON.stringify(state.settings.plan)===JSON.stringify(oldGrad))state.settings.plan=GRADUATE_PLAN.map(r=>({...r}));
 state.deletedIds=Array.isArray(state.deletedIds)?[...new Set(state.deletedIds.filter(id=>typeof id==='string'))]:[];
 state.chapters=[...new Set(['其他章节',...(state.chapters||[]).filter(validChapter).map(t=>canonicalTopic(t))].filter(t=>!TOPICS.includes(t)))];
 state.custom=(state.custom||[]).map(q=>({...q,topic:canonicalTopic(q.topic,q)}));
 Object.values(state.overrides||{}).forEach(q=>{if(q.topic)q.topic=canonicalTopic(q.topic,q);});
 state.custom.forEach(q=>{if(validChapter(q.topic)&&!topicList(state).includes(q.topic))state.chapters.push(q.topic);});
 if(!Array.isArray(state.settings.examTopics))state.settings.examTopics=[];
 else state.settings.examTopics=[...new Set(state.settings.examTopics.map(t=>canonicalTopic(t)).filter(t=>topicList(state).includes(t)))];
 return state;
}
function visibleBank(seed,state){const m=new Map((state.seedEnabled===false?[]:seed).map(q=>[q.id,q]));state.custom.forEach(q=>m.set(q.id,q));const deleted=new Set(state.deletedIds||[]);return [...m.values()].filter(q=>!deleted.has(q.id)).map(q=>{const v={...q,...state.overrides[q.id]};return {...v,topic:canonicalTopic(v.topic,v)};});}
function syncSeed(state,seed){
 const version=seed.revision||seed.version;if(state.seedVersion===version)return {state,changed:false,sessionClosed:false};
 const managed=new Set(seed.managedQuestionIds||seed.replacesQuestionIds||[]),hashes=seed.questionHashes||{};
 const changed=new Set(state.seedQuestionHashes?Object.keys(hashes).filter(id=>state.seedQuestionHashes[id]&&state.seedQuestionHashes[id]!==hashes[id]):seed.changedQuestionIds||[]);
 const next={...state,seedVersion:version,seedQuestionHashes:hashes,custom:state.custom.filter(q=>!managed.has(q.id)),overrides:Object.fromEntries(Object.entries(state.overrides).filter(([id])=>!managed.has(id))),records:Object.fromEntries(Object.entries(state.records).filter(([id])=>!changed.has(id))),reviewRecords:Object.fromEntries(Object.entries(state.reviewRecords||{}).filter(([id])=>!changed.has(id)))};
 const available=new Set(visibleBank(seed.questions,next).map(q=>q.id));let sessionClosed=false;
 if(next.practice?.ids.some(id=>!available.has(id)||changed.has(id))){next.practice=null;next.lastPractice=null;sessionClosed=true;}
 if(next.exam?.items.some(x=>!available.has(x.id)||changed.has(x.id))){next.exam=null;sessionClosed=true;}
 next.favorites=next.favorites.filter(id=>available.has(id));return {state:next,changed:true,sessionClosed};
}
function clearBank(state){return {...empty(),seedEnabled:false,seedVersion:state.seedVersion,seedQuestionHashes:state.seedQuestionHashes,chapters:[...(state.chapters||[])],settings:{...state.settings,remote:'',folderAuto:false},github:state.github,installedVersion:null};}
// Keep tombstones so removing bundled questions survives restarts and app upgrades.
function deleteQuestions(state,bank,selectedIds){
 const wanted=new Set(selectedIds),ids=new Set(bank.filter(q=>wanted.has(q.id)).map(q=>q.id));if(!ids.size)throw Error('请选择要删除的题目');
 const next={...state,deletedIds:[...new Set([...(state.deletedIds||[]),...ids])],custom:state.custom.filter(q=>!ids.has(q.id)),overrides:Object.fromEntries(Object.entries(state.overrides).filter(([id])=>!ids.has(id))),records:Object.fromEntries(Object.entries(state.records).filter(([id])=>!ids.has(id))),reviewRecords:Object.fromEntries(Object.entries(state.reviewRecords||{}).filter(([id])=>!ids.has(id))),history:state.history.filter(r=>!ids.has(r.id)),favorites:state.favorites.filter(id=>!ids.has(id)),settings:{...state.settings,remote:'',folderAuto:false},remoteSignature:null,lastPractice:null};
 if(state.practice?.ids.some(id=>ids.has(id)))next.practice=null;if(state.exam?.items.some(x=>ids.has(x.id)))next.exam=null;return {state:next,count:ids.size};
}
function clearTopics(state,bank,topics){if(!Array.isArray(topics)||!topics.length)throw Error('请至少选择一个章节');return deleteQuestions(state,bank,bank.filter(q=>topics.includes(q.topic)).map(q=>q.id));}
function questionPool(bank,state,options={}){
 const includeReview=options.includeReview??state.settings.includeReview;
 const scope=options.scope===false||!state.settings.scopeExplicit?null:new Set(state.settings.examTopics);
 return bank.filter(q=>(q.status==='active'||includeReview&&q.status==='review')&&(!scope||scope.has(q.topic))&&(!options.topic||q.topic===options.topic)&&(!options.type||q.type===options.type));
}
function selectedTopics(bank,state){return state.settings.scopeExplicit?[...state.settings.examTopics]:topicList(state).filter(t=>bank.some(q=>q.topic===t));}
function practiceRecord(state,q){return q.status==='review'?(state.reviewRecords||{})[q.id]:state.records[q.id];}
function metrics(bank,state,now=new Date()){
 const pool=questionPool(bank,state),ids=new Map(pool.map(q=>[q.id,q])),today=localDate(now);
 const events=state.history.filter(r=>{const q=ids.get(r.id);return q&&practiceRecord(state,q)&&!!r.review===(q.status==='review');}),firstTimes=new Map();
 events.forEach(r=>{if(!firstTimes.has(r.id)||r.at<firstTimes.get(r.id))firstTimes.set(r.id,r.at);});
 const todayIds=new Set(events.filter(r=>localDate(new Date(r.at))===today).map(r=>r.id));
 const newToday=pool.filter(q=>{const record=practiceRecord(state,q);return record&&localDate(new Date(record.firstAt??firstTimes.get(q.id)??record.last))===today;}).length;
 return {total:bank.length,safe:bank.filter(q=>q.status==='active').length,review:bank.filter(q=>q.status==='review').length,pool:pool.length,done:pool.filter(q=>practiceRecord(state,q)).length,unseen:pool.filter(q=>!practiceRecord(state,q)).length,today:todayIds.size,newToday,byType:Object.fromEntries(Object.keys(TYPES).map(t=>[t,pool.filter(q=>q.type===t).length]))};
}
function localDate(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dateAfter(days,now=new Date()){const d=new Date(now);d.setDate(d.getDate()+days);return localDate(d);}
function dailyPlan(bank,state,now=new Date(),daysOverride){
 const stats=metrics(bank,state,now),dayNumber=x=>Date.parse(x+'T00:00:00Z')/86400000;
 const days=daysOverride!==undefined?daysOverride:state.settings.examDate?Math.max(0,Math.round(dayNumber(state.settings.examDate)-dayNumber(localDate(now)))):null;
 const suggested=days===null?null:Math.ceil((stats.unseen+stats.newToday)/Math.max(1,days));
 const requested=state.settings.dailyMode==='manual'?state.settings.dailyTarget:suggested===null?20:suggested;
 const target=Math.min(stats.pool,Math.max(0,requested));return {...stats,days,suggested,requested,target,remainingToday:Math.max(0,target-stats.today)};
}

const TYPES={single:'单选题',multiple:'多选题',judge:'判断题',fill:'填空题',definition:'名词解释',short:'简答题',essay:'论述题',flashcard:'记忆卡'};
const DEFAULT_PLAN=[{type:'definition',count:8,points:2.5},{type:'fill',count:10,points:2},{type:'single',count:10,points:2},{type:'judge',count:10,points:1},{type:'short',count:2,points:10},{type:'essay',count:1,points:10}];
const autoScored=q=>q.status!=='review'&&objective(q);
const objective=q=>['single','multiple','judge','fill'].includes(q.type);
const norm=x=>String(x??'').normalize('NFKC').trim().toLowerCase().replace(/[\s（）()]/g,'').replace(/⁺/g,'+');
function grade(q,a){
 if(q.type==='fill'){let ok=0;q.answer.forEach((aliases,i)=>{if((Array.isArray(aliases)?aliases:[aliases]).some(v=>norm(v)===norm(a?.[i])))ok++;});return ok/q.answer.length;}
 if(!objective(q))return null;
 return JSON.stringify([...(a||[])].sort())===JSON.stringify([...q.answer].sort())?1:0;
}
function empty(){return {schema:1,seedEnabled:true,deletedIds:[],chapters:['其他章节'],records:{},reviewRecords:{},history:[],favorites:[],custom:[],overrides:{},exam:null,practice:null,lastPractice:null,settings:{includeReview:false,examDate:'',dailyMode:'auto',dailyTarget:20,minutes:90,pass:60,total:100,examTopics:[],scopeExplicit:false,preset:'regular',folderAuto:true,subjective:60,plan:DEFAULT_PLAN.map(r=>({...r})),remote:''}};}
function record(state,q,ratio,self=false){
 if(q.status==='review'){state.reviewRecords||={};const old=state.reviewRecords[q.id]||{attempts:0,firstAt:Date.now(),wrong:false,streak:0,errors:0};old.attempts++;old.last=Date.now();old.ratio=ratio;old.self=true;if(ratio<1){old.errors++;old.wrong=true;old.streak=0;}else{old.streak++;if(old.streak>=2)old.wrong=false;}state.reviewRecords[q.id]=old;state.history.push({id:q.id,at:Date.now(),ratio,self:true,review:true});return;}
 const old=state.records[q.id]||{attempts:0,firstAt:Date.now(),first:null,wrong:false,streak:0,errors:0};
 old.attempts++;old.last=Date.now();old.ratio=ratio;old.self=self;
 if(old.first===null&&!self&&objective(q))old.first=ratio;
 if(ratio<1){old.errors++;old.wrong=true;old.streak=0;}else{old.streak++;if(old.streak>=2)old.wrong=false;}
 state.records[q.id]=old;state.history.push({id:q.id,at:Date.now(),ratio,self});
}
function shuffle(a,rng=Math.random){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function practiceOrder(questions,order,rng=Math.random,includeReview=false){
 const pool=questions.filter(q=>q.status==='active'||includeReview&&q.status==='review');
 return order==='random'?shuffle(pool,rng):[...pool].sort((a,b)=>(TOPICS.includes(a.topic)?TOPICS.indexOf(a.topic):TOPICS.length)-(TOPICS.includes(b.topic)?TOPICS.indexOf(b.topic):TOPICS.length)||(!TOPICS.includes(a.topic)&&!TOPICS.includes(b.topic)?a.topic.localeCompare(b.topic,'zh-CN'):0));
}
function nextPractice(session,questions,rng=Math.random){
 const before=questions.find(q=>q.id===session.ids[session.index]);
 let completed=null;
 if(session.index===session.ids.length-1){
  completed={at:Date.now(),count:Object.keys(session.graded).length,total:session.ids.length,round:session.round||1,mode:session.mode,infinite:!!session.infinite};
  if(!session.infinite)return {finished:true,completed};
  const ids=new Set(session.ids),pool=practiceOrder(questions.filter(q=>ids.has(q.id)),session.order,rng,!!session.includeReview);
  if(!pool.length)return {finished:true,completed};
  session.ids=pool.map(q=>q.id);session.index=0;session.round=(session.round||1)+1;session.answers={};session.graded={};session.revealed={};
 }else session.index++;
 const after=questions.find(q=>q.id===session.ids[session.index]);
 const sequential=session.order==='sequential'||session.mode==='sequential';
 return {finished:false,completed,chapter:sequential&&before?.topic!==after?.topic?after?.topic:null};
}
function learningInsights(bank,state){
 const all=bank.filter(q=>q.status==='active');
 const topics=topicList(state).filter(t=>all.some(q=>q.topic===t)).map(topic=>{
  const qs=all.filter(q=>q.topic===topic&&objective(q));
  const attempted=qs.filter(q=>typeof state.records[q.id]?.first==='number');
  const sum=attempted.reduce((n,q)=>n+(state.records[q.id].ratio??state.records[q.id].first),0);
  return {topic,n:attempted.length,total:qs.length,accuracy:attempted.length?Math.round(sum/attempted.length*100):null,wrong:qs.filter(q=>state.records[q.id]?.wrong).length};
 });
 const weak=topics.filter(t=>t.n>0&&(t.accuracy<80||t.wrong>0)).sort((a,b)=>a.accuracy-b.accuracy||b.wrong-a.wrong);
 const mistakes=all.filter(q=>objective(q)&&state.records[q.id]?.wrong).sort((a,b)=>state.records[b.id].errors-state.records[a.id].errors).slice(0,5);
 return {topics,weak,untested:topics.filter(t=>t.n<3),mistakes};
}
function makeExam(bank,plan,minutes,rng=Math.random,config={}){
 const full=config.total??100,pass=config.pass??60,topics=config.topics??[...new Set(bank.map(q=>q.topic))];
 if(!Number.isFinite(minutes)||minutes<1||minutes>600)throw Error('时长须为1–600分钟');
 if(!Number.isFinite(full)||full<1||full>1000)throw Error('满分须为1–1000分');
 if(!Number.isFinite(pass)||pass<0||pass>full)throw Error('目标分数须为0至满分之间');
 if(!Array.isArray(topics)||!topics.length)throw Error('请至少选择一个考试章节');
 if(!Array.isArray(plan)||!plan.length||new Set(plan.map(r=>r.type)).size!==plan.length)throw Error('题型配置为空或重复');
 let total=0,qs=[],topicCounts=Object.fromEntries(topics.map(t=>[t,0]));
 for(const row of plan){
  if(!TYPES[row.type]||!Number.isInteger(row.count)||row.count<0||row.count>1000||!Number.isFinite(row.points)||row.points<=0)throw Error('题量须为0–1000的整数，分值须大于0');
  const pool=bank.filter(q=>(q.status==='active'||config.includeReview&&q.status==='review')&&topics.includes(q.topic)&&q.type===row.type);if(pool.length<row.count)throw Error(`所选章节中${TYPES[row.type]}仅有${pool.length}题，少于所选${row.count}题`);
  let candidates=shuffle(pool,rng);
  for(let i=0;i<row.count;i++){
   candidates.sort((a,b)=>topicCounts[a.topic]-topicCounts[b.topic]);const q=candidates.shift();topicCounts[q.topic]++;qs.push({id:q.id,points:row.points});
  }total+=row.count*row.points;
 }
 if(Math.abs(total-full)>.001)throw Error(`当前题目合计${total}分，请调整为设定的满分${full}分`);
 const started=Date.now();return {id:'exam-'+started,items:qs,index:0,answers:{},selfScores:{},graded:false,started,deadline:started+minutes*60000,minutes,total,pass,includeReview:!!config.includeReview,topics:[...topics],topicCounts};
}
function validateBank(input,registered=[]){
 if(input?.chapters!==undefined&&!Array.isArray(input.chapters))throw Error('chapters 须为章节名称数组');
 const chapters=Array.isArray(input?.chapters)?input.chapters:[];
 if(chapters.some(t=>!validChapter(t)))throw Error('chapters 须为1–80字的章节名称数组');
 const allowed=[...TOPICS,'其他章节',...registered.map(t=>canonicalTopic(t)),...chapters.map(t=>canonicalTopic(t))];
 const rows=Array.isArray(input)?input:input?.questions;if(!Array.isArray(rows)||!rows.length)throw Error('题库须为非空数组或包含 questions 数组的对象');if(rows.length>10000)throw Error('一次最多导入10000题');
 const good=[],errors=[],seen=new Set();
 rows.forEach((r,i)=>{try{
  if(!r||typeof r.stem!=='string'||!r.stem.trim())throw Error('缺少题干 stem');
  r={...r,topic:canonicalTopic(r.topic,r)};if(!allowed.includes(r.topic))throw Error('章节 topic 未注册，请先新增章节或在题库 chapters 数组声明');
  if(!TYPES[r.type])throw Error('不支持的题型 type');
  const review=r.status==='review';
  const answer=Array.isArray(r.answer)?r.answer:[];if(!review&&!answer.length)throw Error('缺少 answer 数组');
  if(!review&&!objective(r)&&!answer.every(x=>typeof x==='string'&&x.trim()))throw Error('主观题答案须为文字数组');
  const options=Array.isArray(r.options)?r.options:[];
  if(!review&&['single','multiple','judge'].includes(r.type)){
   if(options.length<2||options.length>8||!options.every(o=>o&&typeof o.key==='string'&&typeof o.text==='string'&&o.text.trim()))throw Error('选项须为2–8个 key/text 对象');
   const keys=options.map(o=>o.key);if(new Set(keys).size!==keys.length||answer.some(a=>!keys.includes(a)))throw Error('选项键重复或答案不在选项中');
   if(r.type!=='multiple'&&answer.length!==1)throw Error('单选与判断必须只有一个答案');
  }
  if(r.type==='fill'&&!answer.every(a=>typeof a==='string'||(Array.isArray(a)&&a.length&&a.every(s=>typeof s==='string'))))throw Error('填空答案须为文字或同义词数组');
  const id=typeof r.id==='string'&&r.id?r.id:'import-'+hash(r.topic+r.type+r.stem);
  if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id)||['__proto__','constructor','prototype'].includes(id))throw Error('id须为1–120位字母、数字、短横线或下划线');
  if(seen.has(id))throw Error('同一文件 id 重复');seen.add(id);
  good.push({id,topic:r.topic,type:r.type,stem:r.stem.trim(),options,answer,explanation:String(r.explanation||''),source:String(r.source||'用户导入'),status:r.status==='review'?'review':'active',reviewReason:String(r.reviewReason||'')});
 }catch(e){errors.push(`第${i+1}题：${e.message}`);}});return {good,errors,chapters:[...new Set(chapters.map(t=>canonicalTopic(t)).filter(t=>!TOPICS.includes(t)))]};
}
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function parseCSV(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw Error('CSV 引号不成对');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 const headers=(rows.shift()||[]).map(x=>x.replace(/^\uFEFF/,'').trim());
 return rows.map(r=>{const o=Object.fromEntries(headers.map((h,i)=>[h,r[i]||'']));o.options=['A','B','C','D','E','F'].filter(k=>o[k]).map(k=>({key:k,text:o[k]}));o.answer=o.type==='fill'?o.answer.split('|').map(x=>x.split('/')):objective(o)?o.answer.split(/[|,、\s]+/).filter(Boolean):[o.answer];return o;});
}
function parseText(text){
 return text.split(/\n\s*\n/).filter(s=>s.trim()).map(b=>{
  const get=label=>b.match(new RegExp('^'+label+'[：:]\\s*(.*)$','m'))?.[1]?.trim()||'';
  const opts=[...b.matchAll(/^([A-H])[.、．]\s*(.+)$/gm)].map(m=>({key:m[1],text:m[2]}));
  const type=get('题型'),a=get('答案');return {topic:get('章节'),type,stem:get('题目'),options:opts,answer:type==='fill'?a.split('|').map(x=>x.split('/')):['single','multiple','judge'].includes(type)?a.split(/[,，、\s|]+/).filter(Boolean):[a],explanation:get('解析'),source:get('来源')||'文本导入'};
 });
}
// Beta-binomial posterior predictive distribution for equally weighted future items.
function betaBinomial(n,a,b){let p=1;for(let j=0;j<n;j++)p*=(b+j)/(a+b+j);const out=[p];for(let k=0;k<n;k++){p*=((n-k)/(k+1))*((a+k)/(b+n-k-1));out.push(p);}return out;}
function prediction(bank,state){
 const scope=selectedTopics(bank,state);bank=bank.filter(q=>scope.includes(q.topic));
 const records=bank.filter(q=>q.status==='active'&&objective(q)&&state.records[q.id]?.first!==null&&state.records[q.id]?.first!==undefined);
 const topics=scope.map(topic=>{const rows=records.filter(q=>q.topic===topic);const s=rows.reduce((n,q)=>n+state.records[q.id].first,0);return {topic,n:rows.length,a:2+s,b:2+rows.length-s};});
 const enoughSamples=records.length>=30&&topics.length>0&&topics.every(x=>x.n>=3);
 // Estimate only objective knowledge; subjective score is a transparent scenario.
 const autoPoints=state.settings.plan.filter(r=>['single','multiple','judge','fill'].includes(r.type)).reduce((n,r)=>n+r.count*r.points,0);
 const subjectivePoints=state.settings.plan.filter(r=>!['single','multiple','judge','fill'].includes(r.type)).reduce((n,r)=>n+r.count*r.points,0),assumed=subjectivePoints*state.settings.subjective/100;
 const perTopic=Math.ceil(60/Math.max(topics.length,1)),slots=perTopic*Math.max(topics.length,1);let dist=[1];
 topics.forEach(t=>{const d=betaBinomial(perTopic,t.a,t.b),next=Array(dist.length+d.length-1).fill(0);dist.forEach((p,i)=>d.forEach((v,j)=>next[i+j]+=p*v));dist=next;});
 const required=Math.ceil((state.settings.pass-assumed)/Math.max(autoPoints,.01)*slots-1e-9);
 const p=required<=0?1:required>slots?0:dist.slice(required).reduce((a,b)=>a+b,0);
 const configured=state.settings.scopeExplicit===true&&scope.length>0&&bank.some(q=>q.status==='active')&&state.settings.plan.every(r=>Number.isInteger(r.count)&&r.count>=0&&Number.isFinite(r.points)&&r.points>0)&&Math.abs(autoPoints+subjectivePoints-state.settings.total)<.001&&state.settings.pass>=0&&state.settings.pass<=state.settings.total;
 return {configured,ready:configured&&enoughSamples,n:records.length,topics,probability:Math.round(p*100),assumed,autoPoints,subjectivePoints,expected:topics.reduce((s,t)=>s+t.a/(t.a+t.b),0)/Math.max(topics.length,1)*autoPoints+assumed};
}
const api={questionPool,practiceRecord,metrics,localDate,dateAfter,dailyPlan,deleteQuestions,autoScored,canonicalTopic,validChapter,topicList,migrate,visibleBank,syncSeed,clearBank,clearTopics,selectedTopics,GRADUATE_PLAN,TOPICS,TYPES,DEFAULT_PLAN,objective,norm,grade,empty,record,shuffle,practiceOrder,nextPractice,learningInsights,makeExam,validateBank,parseCSV,parseText,betaBinomial,prediction,hash};
if(typeof module!=='undefined')module.exports=api;else root.Engine=api;
})(typeof window!=='undefined'?window:globalThis);
