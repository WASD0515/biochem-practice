/* Use the latest prepared teacher bank; retain source answers/statuses and audit exclusions. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),E=require('../dist/engine.js');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'source-data');
const input=path.join(folder,'生物化学题库_风险修复第五版.json'),report=path.join(folder,'生物化学题库_风险修复第五版_核对报告.md');
const source=JSON.parse(fs.readFileSync(input,'utf8')),previous=JSON.parse(fs.readFileSync(path.join(root,'dist/question-bank.json'),'utf8'));
const nonBioIds=new Set(['cx-00139','cx-00140','cx-00142','cx-00143','cx-00144','cx-00145']);
const unrelated=q=>nonBioIds.has(q.id)||/唐代著名诗人|下列哪一个不属于颜色|简述人的五官|依法治国和以德治国|学习通是生物化学课程/.test(q.stem);
const excluded=source.questions.filter(unrelated),changes=[];
const questions=source.questions.filter(q=>!unrelated(q)).map(q=>{
 if(E.TOPICS.includes(q.topic)&&!/章节模型推断|章节需人工归类/.test(q.reviewReason||''))return {...q};
 changes.push({id:q.id,from:q.topic,to:'其他章节',reason:'未明确归章或章节建议仍需复核'});
 return {...q,topic:'其他章节'};
});
const signature=q=>E.hash(JSON.stringify([q.type,q.stem,q.options,q.answer,q.status]));
const oldMap=new Map(previous.questions.map(q=>[q.id,q]));
const removedIds=previous.questions.filter(q=>!questions.some(n=>n.id===q.id)).map(q=>q.id);
const managedQuestionIds=[...new Set([...(previous.managedQuestionIds||[]),...(previous.replacesQuestionIds||[]),...previous.questions.map(q=>q.id),...questions.map(q=>q.id)])];
const currentIds=new Set(questions.map(q=>q.id));
const changedQuestionIds=[...new Set([...(previous.changedQuestionIds||[]),...questions.filter(q=>oldMap.has(q.id)&&signature(q)!==signature(oldMap.get(q.id))).map(q=>q.id)])].filter(id=>currentIds.has(id));
const questionHashes=Object.fromEntries(questions.map(q=>[q.id,signature(q)]));
const bank={version:source.version+'-app-1',revision:crypto.createHash('sha256').update(JSON.stringify(questions)).digest('hex'),title:'生物化学题库（风险修复第五版）',chapters:['其他章节'],chapterCatalog:E.TOPICS,sources:[path.basename(input),path.basename(report)],replacesQuestionIds:[...new Set([...(previous.replacesQuestionIds||[]),...removedIds])],managedQuestionIds,changedQuestionIds,questionHashes,note:'采用老师整理的风险修复第五版，保留原答案和安全/待确认状态。安全题可自动判分；待确认题可参考作答、自评，是否纳入正确率与通过概率由独立统计开关决定，默认关闭。',questions};
const checked=E.validateBank(bank);if(checked.errors.length)throw Error(checked.errors.slice(0,10).join('\n'));
fs.writeFileSync(path.join(root,'dist/question-bank.json'),JSON.stringify(bank,null,2)+'\n');fs.writeFileSync(path.join(root,'dist/bank.js'),'window.SEED_BANK='+JSON.stringify(bank)+';\n');
fs.mkdirSync(path.join(root,'release'),{recursive:true});
const audit={input:path.basename(input),revision:bank.revision,total:questions.length,safe:questions.filter(q=>q.status==='active').length,review:questions.filter(q=>q.status==='review').length,other:questions.filter(q=>q.topic==='其他章节').length,excluded,removedFromPrevious:previous.questions.filter(q=>removedIds.includes(q.id)).map(q=>({id:q.id,stem:q.stem})),changedQuestionIds,chapterChanges:changes};
fs.writeFileSync(path.join(root,'release/题库更新与清理记录-1.4.0.json'),JSON.stringify(audit,null,2));
console.log(JSON.stringify({total:audit.total,safe:audit.safe,review:audit.review,other:audit.other,excludedNow:excluded.length,removedFromPrevious:removedIds.length,changed:changedQuestionIds.length}));
