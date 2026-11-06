'use strict';
const assert=require('node:assert/strict'),E=require('../dist/engine'),seed=require('../dist/question-bank.json');
const s=E.migrate(E.empty()),a=E.TOPICS[1],b=E.TOPICS[2];
const q=(id,topic,type,status='active')=>({id,topic,type,status,stem:id,explanation:''});
const bank=[q('a-single',a,'single'),q('a-fill',a,'fill'),q('b-single',b,'single'),q('a-review',a,'single','review')];
assert.equal(s.settings.practiceType,'');assert.equal(s.settings.practiceTopic,'');
s.settings.practiceType='single';s.settings.practiceTopic=a;
assert.deepEqual(E.specialtyPool(bank,s).map(q=>q.id),['a-single']);
assert.equal(E.questionPool(bank,s).length,3,'home/daily pool is not changed by specialty selection');
assert.equal(E.specialtyPool(bank,s,{type:'fill'}).length,1);
assert.equal(E.specialtyPool(bank,s,{topic:b}).length,1);
s.settings.includeReview=true;assert.equal(E.specialtyPool(bank,s).length,2);
assert.equal(E.specialtyPool(bank,s,{search:'review'}).length,1);
s.settings.scopeExplicit=true;s.settings.examTopics=[b];assert.equal(E.specialtyPool(bank,s).length,0,'no fallback outside the exam chapter scope');
s.settings.examTopics=[];assert.equal(E.specialtyPool(bank,s).length,0);
const restored=E.migrate(JSON.parse(JSON.stringify(s)));assert.equal(restored.settings.practiceType,'single');assert.equal(restored.settings.practiceTopic,a);
assert.equal(E.migrate({settings:{practiceType:'bad',practiceTopic:'bad'}}).settings.practiceType,'');
assert.equal(E.migrate({settings:{practiceTopic:'氨基酸'}}).settings.practiceTopic,a);
for(const review of [false,true])for(const type of Object.keys(E.TYPES))for(const topic of [a,b,'其他章节']){
 const state=E.empty();state.settings.includeReview=review;state.settings.practiceType=type;state.settings.practiceTopic=topic;
 const expected=seed.questions.filter(q=>q.type===type&&q.topic===topic&&(q.status==='active'||review&&q.status==='review'));
 assert.deepEqual(E.specialtyPool(seed.questions,state).map(q=>q.id),expected.map(q=>q.id));
}
console.log('PASS 1.7.0: type × chapter × review × exam scope intersection, no empty fallback, search, migration/persistence and isolation from home pools.');
