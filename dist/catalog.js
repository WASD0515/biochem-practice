(function(root){
'use strict';
const E=typeof module!=='undefined'?require('./engine.js'):root.Engine;
function indexURL(config){
 const owner=String(config.owner||'').trim(),repo=String(config.repo||'').trim(),ref=String(config.ref||'main').trim(),path=String(config.path||'data').replace(/^\/+|\/+$/g,'');
 if(!/^[\w-]{1,100}$/.test(owner)||! /^[\w.-]{1,100}$/.test(repo)||repo==='.'||repo==='..')throw Error('请填写有效的 GitHub 用户名与仓库名');
 if(!ref||ref.length>200||/[\s?#\\]/.test(ref)||ref.split('/').includes('..'))throw Error('分支名称无效');
 if(!path||path.split('/').some(p=>!p||p==='.'||p==='..'||! /^[\w.-]+$/.test(p)))throw Error('数据目录请使用字母、数字、短横线、下划线和目录斜线');
 return `https://raw.githubusercontent.com/${owner}/${repo}/${ref.split('/').map(encodeURIComponent).join('/')}/${path}/index.json`;
}
function validateIndex(input){
 if(input?.schemaVersion!==1||!Array.isArray(input.versions)||input.versions.length>100)throw Error('索引须使用 schemaVersion: 1 和 versions 数组（最多100个版本）');
 const seen=new Set();return input.versions.map(v=>{
  if(!v||! /^[\w-]{1,80}$/.test(v.id)||seen.has(v.id))throw Error('版本 id 无效或重复');seen.add(v.id);
  if(typeof v.title!=='string'||!v.title.trim()||v.title.length>150)throw Error('版本缺少 title');
  if(!Array.isArray(v.files)||!v.files.length||v.files.length>20)throw Error('每个版本须有1–20个 JSON 题库文件');
  if(new Set(v.files).size!==v.files.length||v.files.some(f=>typeof f!=='string'||!new RegExp('^'+v.id+'/[a-zA-Z0-9_./-]+\\.json$').test(f)||f.split('/').some(p=>!p||p==='.'||p==='..')))throw Error('题库文件必须位于与版本 id 同名的文件夹中，且为 JSON 文件');
  return {id:v.id,title:v.title,description:String(v.description||'').slice(0,2000),files:[...v.files]};
 });
}
async function getJSON(url,fetcher=fetch){
 const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('下载失败 HTTP '+r.status);
 const len=Number(r.headers?.get('content-length')||0);if(len>15000000)throw Error('文件超过15MB');
 const text=await r.text();if(text.length>15000000)throw Error('文件超过15MB');return JSON.parse(text);
}
async function loadIndex(config,fetcher){const url=indexURL(config);return {url,versions:validateIndex(await getJSON(url,fetcher))};}
async function loadVersion(catalog,id,registered=[],fetcher){
 const v=catalog.versions.find(x=>x.id===id);if(!v)throw Error('版本不存在，请刷新版本列表');
 const questions=[],chapters=new Set(),ids=new Set();
 // Validate every file before returning; the caller commits exactly once.
 for(const file of v.files){const payload=await getJSON(new URL(file,catalog.url).href,fetcher),checked=E.validateBank(payload,[...registered,...chapters]);
  if(checked.errors.length)throw Error(file+'：'+checked.errors[0]);
  checked.chapters.forEach(t=>chapters.add(t));
  checked.good.forEach(q=>{if(ids.has(q.id))throw Error('跨文件重复题目 ID：'+q.id);ids.add(q.id);questions.push(q);});
  if(questions.length>10000)throw Error('一个版本最多10000题');
 }
 return {questions,chapters:[...chapters],version:{id:v.id,title:v.title,at:new Date().toISOString(),index:catalog.url}};
}
const api={indexURL,validateIndex,loadIndex,loadVersion};if(typeof module!=='undefined')module.exports=api;else root.BankCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
