/* Local-only DOCX text extraction. Unsupported equations/images are quarantined. */
(function(){
function parseWordText(text,name){
 if(/^题目[：:]/m.test(text)&&/^章节[：:]/m.test(text))return Engine.parseText(text);
 const rows=[];let topic='',type='',pending=null,answers=false;
 const types=[[/名词解释|解释下列名词/,'definition'],[/填空|填充/,'fill'],[/多选/,'multiple'],[/选择/,'single'],[/判断|是非/,'judge'],[/简答|问答|分析和计算/,'short'],[/论述/,'essay']];
 const infer=s=>/维生素|泛酸|核黄素|硫胺|生物素|TPP/.test(s)?'维生素':/层析|电泳|盐析|洗脱|分离|鉴定|纯化/.test(s)?'蛋白质的分离纯化与鉴定':/氨基酸|等电点/.test(s)?'氨基酸':/蛋白|血红|肽键|螺旋/.test(s)?'蛋白质的结构与功能':/糖|淀粉|纤维素/.test(s)?'糖':/酶|催化|Km|Vmax/.test(s)?'酶学':'';
 function flush(){if(!pending)return;let body=pending.lines.join('\n').trim();const original=body;
  const aMatch=body.match(/(?:参考)?答案[：:]\s*([^\n]+)/),ex=body.match(/解析[：:]\s*([\s\S]*)/);body=body.split(/(?:参考)?答案[：:]|解析[：:]/)[0].trim();
  const ms=[...body.matchAll(/(?:^|\s)([A-H])[.、．]\s*/g)];let opts=ms.map((m,i)=>({key:m[1],text:body.slice(m.index+m[0].length,ms[i+1]?.index??body.length).trim()}));let stem=ms.length?body.slice(0,ms[0].index).trim():body;
  const typ=opts.length?((aMatch?.[1].match(/[A-H]/g)||[]).length>1?'multiple':pending.type||'single'):pending.type||'short';let ans=[],reason='';
  if(aMatch){const a=aMatch[1].trim();if(typ==='fill')ans=a.split(/[|；;]/).map(x=>x.split('/'));else if(typ==='judge')ans=/对|正确|√/.test(a)?['A']:/错|错误|×/.test(a)?['B']:a.match(/[AB]/g)||[];else if(['single','multiple'].includes(typ))ans=a.match(/[A-H]/g)||[];else ans=[a];}
  if(typ==='judge')opts=[{key:'A',text:'正确'},{key:'B',text:'错误'}];
  if(!ans.length)reason='未识别到本题紧随的明确答案。请核对原文；独立答案表不自动配对。';
  const inferred=pending.topic||infer(stem)||infer(name)||'酶学';if(!pending.topic)reason+=(reason?' ':'')+'章节由关键词推断，需确认。';
  if(/图|表|EMBED|Equation/.test(original))reason+=(reason?' ':'')+'可能依赖图片、表格或公式，请核对原文。';
  if(stem.length>2)rows.push({id:'word-'+Engine.hash(name+pending.n+typ+stem),topic:inferred,type:typ,stem,options:opts,answer:ans,explanation:ex?.[1]?.trim()||'',source:name+' · 自动提取 '+pending.n,status:reason?'review':'active',reviewReason:reason});pending=null;
 }
 for(const line of text.split('\n')){const s=line.trim();if(!s)continue;if(/^参考答案|^答\s*案[：:]?$/.test(s)){flush();answers=true;continue;}if(answers)continue;
  if(s.length<80&&/^(?:第.{1,8}[章节单元]|[一二三四五六七八九十]+[、．.]|[（(][一二三四五六七八九十]+[）)]|章节[：:])/.test(s)){
   const entry=types.find(([r])=>r.test(s));if(entry){flush();type=entry[1];continue;}
   const next=Engine.TOPICS.find(t=>s.includes(t))||infer(s);if(next){flush();topic=next;}continue;
  }
  const m=s.match(/^(\d+)[.．、](?!\d)\s*(.+)/);if(m){flush();pending={n:m[1],lines:[m[2]],topic,type};}else if(pending)pending.lines.push(s);
 }flush();
 if(!rows.length)throw Error('未识别到编号题目。建议按导入模板整理，或将 Word 转为规范文本。');return rows;
}
async function readWord(file){const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>15000000)throw Error('Word 文件超过15MB');const entries=fflate.unzipSync(bytes,{filter:e=>e.name==='word/document.xml'}),xml=entries['word/document.xml'];if(!xml)throw Error('缺少 Word 正文');const doc=new DOMParser().parseFromString(fflate.strFromU8(xml),'application/xml');const paragraphs=[...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''));return parseWordText(paragraphs.join('\n'),file.name);}
window.WordImport={readWord,parseWordText};
})();
