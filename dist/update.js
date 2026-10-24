(function(root){
'use strict';
const VERSION='1.6.0',REPOSITORY='WASD0515/biochem-practice',RELEASES='https://github.com/'+REPOSITORY+'/releases',API='https://api.github.com/repos/'+REPOSITORY+'/releases/latest',FEED='https://raw.githubusercontent.com/'+REPOSITORY+'/main/app-update.json';
function versionParts(value){const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));if(!match||match.slice(1).some(x=>!Number.isSafeInteger(Number(x))))throw Error('版本号格式无效');return match.slice(1).map(Number);}
function compare(a,b){const av=versionParts(a),bv=versionParts(b);for(let i=0;i<3;i++)if(av[i]!==bv[i])return av[i]>bv[i]?1:-1;return 0;}
function allowedURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.port&&!u.username&&!u.password&&(u.pathname==='/'+REPOSITORY+'/releases'||u.pathname.startsWith('/'+REPOSITORY+'/releases/'));}catch(_){return false;}}
function parseRelease(payload){
 if(!payload||payload.draft||payload.prerelease)throw Error('没有可用的正式版本');
 const version=versionParts(payload.tag_name).join('.'),tag=payload.tag_name,url=RELEASES+'/tag/'+encodeURIComponent(tag);
 if(payload.html_url!==url)throw Error('更新来源与项目不匹配');
 const assets={};for(const [platform,name] of [['android',`Biochem-Practice-${version}.apk`],['windows',`Biochem-Practice-Setup-${version}-x64.exe`],['macos',`Biochem-Practice-${version}-mac-universal.dmg`]]){
  const asset=(Array.isArray(payload.assets)?payload.assets:[]).find(a=>a.name===name),expected=RELEASES+'/download/'+encodeURIComponent(tag)+'/'+name;
  if(asset?.browser_download_url===expected&&allowedURL(expected))assets[platform]=expected;
 }
 return {version,newer:compare(version,VERSION)>0,url,assets,notes:String(payload.body||'暂无更新说明。').slice(0,12000),publishedAt:payload.published_at||'',checkedAt:new Date().toISOString()};
}
async function check(fetcher=fetch){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{
 let lastError;for(const url of [FEED,API])try{
  const response=await fetcher(url,{cache:'no-store',headers:{Accept:url===API?'application/vnd.github+json':'application/json'},signal:controller.signal});
  if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub检查次数暂时受限，请稍后重试':'更新服务暂时无法访问（'+response.status+'）');
  const text=await response.text();if(text.length>250000)throw Error('更新信息过大');return parseRelease(JSON.parse(text));
 }catch(error){if(controller.signal.aborted)throw error;lastError=error;}throw lastError;
 }finally{clearTimeout(timer);}}
const api={VERSION,REPOSITORY,RELEASES,API,FEED,compare,allowedURL,parseRelease,check};if(typeof module!=='undefined')module.exports=api;else root.AppUpdate=api;
})(typeof window!=='undefined'?window:globalThis);
