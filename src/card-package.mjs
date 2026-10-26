import {mutate} from './inventory.mjs';
const fail=m=>{throw Error(m)};
const text=(v,n=150)=>{if(typeof v!=='string'||!v.trim()||v.length>n)fail('卡图包文字字段无效');return v.trim()};
export function validateCardPackage(p){
 if(p?.format!=='merch-card-package-v1'||!Array.isArray(p.groups)||!p.groups.length||p.groups.length>100)fail('请选择卡图入库包（最多100组）');
 text(p.id);const keys=new Set();
 for(const g of p.groups){if(g.mode!==undefined&&!['attach-images','complete-images','replace-images','reconcile-stock'].includes(g.mode))fail('卡图包操作无效');for(const a of [g.series_aliases||[],g.role_aliases||[]]){if(!Array.isArray(a)||a.length>10)fail('匹配名称无效');a.forEach(v=>text(v))}text(g.key);if(keys.has(g.key))fail('卡图包存在重复组');keys.add(g.key);for(const k of ['name','category','series','ip'])text(g[k]);
  if(!Array.isArray(g.members)||!g.members.length||g.members.length>10||new Set(g.members).size!==g.members.length)fail('卡图成员无效');g.members.forEach(x=>text(x));
  let total=0;for(const m of g.members){const q=g.member_quantities?.[m],k=g.keep_quantities?.[m]??0;if(!Number.isSafeInteger(q)||q<0||q>1000000||!Number.isSafeInteger(k)||k<0||k>q)fail('数量或自留数量无效');total+=q}if(!total&&!g.mode)fail('组库存必须大于零');
  for(const obj of [g.member_quantities,g.keep_quantities||{},g.member_images||{}])if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!g.members.includes(k)))fail('成员映射不一致');
  for(const v of Object.values(g.member_images||{}))if(typeof v!=='string'||v.length>500000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v))fail('卡图无效或超过375KB');
 }
 return p;
}
export function applyCardGroup(state,packageId,g){
 if(g.mode==='reconcile-stock'){
  const key=packageId+'/'+g.key,matches=state.items.filter(i=>i.category===g.category&&i.series===g.series&&i.ip.toLowerCase()===g.ip.toLowerCase());if(matches.length>1)fail('重复组合，请先核对');let item=matches[0];if(item?.stock_corrections?.some(x=>x.key===key))return {status:'skipped',name:g.name,qty:0,keep:0};
  const before=item?state.batches.filter(b=>b.item_id===item.id):[];if(item&&(state.sales.some(x=>x.item_id===item.id)||state.allocations.some(a=>before.some(b=>b.id===a.batch_id))||before.some(b=>b.reserved||b.remaining!==b.qty)))fail('已有售出或自留，不能直接校正：'+g.name);
  const actual={};for(const b of before)actual[b.member]=(actual[b.member]||0)+b.remaining;const expected=g.expected_quantities;if(!expected||typeof expected!=='object'||Object.keys({...actual,...expected}).some(m=>(actual[m]||0)!==(expected[m]||0)))fail('现有数量已变化，请重新核对：'+g.name);
  if(!Array.isArray(g.stock_batches)||!g.stock_batches.length||g.stock_batches.length>100)fail('校正批次无效');const totals={};for(const b of g.stock_batches){if(!g.members.includes(b.member)||!Number.isSafeInteger(b.qty)||b.qty<=0||!Number.isSafeInteger(b.total_cost)||b.total_cost<0||b.total_cost>1e10)fail('校正成本或数量无效');totals[b.member]=(totals[b.member]||0)+b.qty}if(g.members.some(m=>(totals[m]||0)!==g.member_quantities[m]))fail('批次与成员数量不一致');
  let oldMembers=item?JSON.parse(item.members):[];if(oldMembers.some(m=>!g.members.includes(m)))fail('校正不能移除已有成员');const members=[...oldMembers,...g.members.filter(m=>!oldMembers.includes(m))];let choice=state.catalog.find(c=>c.category===g.category&&c.series===g.series&&c.role.toLowerCase()===g.ip.toLowerCase());if(choice)choice.members=JSON.stringify(members);else state.catalog.push({category:g.category,series:g.series,role:g.ip,members:JSON.stringify(members)});
  if(!item){item={id:Math.max(0,...state.items.map(i=>i.id))+1,name:g.name,category:g.category,series:g.series,ip:g.ip,members:JSON.stringify(members),image:'',member_images:'{}',note:''};state.items.push(item)}
  item.stock_corrections=[...(item.stock_corrections||[]),{key,at:new Date().toISOString(),batches:structuredClone(before)}];item.members=JSON.stringify(members);item.member_images=JSON.stringify({...JSON.parse(item.member_images||'{}'),...g.member_images});let bid=Math.max(0,...state.batches.map(b=>b.id))+1;state.batches=state.batches.filter(b=>b.item_id!==item.id);for(const b of g.stock_batches)state.batches.push({id:bid++,item_id:item.id,member:b.member,qty:b.qty,remaining:b.qty,total_cost:b.total_cost,remaining_cost:b.total_cost,cost:Math.round(b.total_cost/b.qty),cost_known:true,reserved:false,date:before[0]?.date||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),location:before[0]?.location||'',note:String(b.note||'').slice(0,1000)});return {status:'corrected',name:g.name,qty:Object.values(totals).reduce((a,b)=>a+b,0),keep:0};
 }

 if(g.mode==='complete-images'||g.mode==='replace-images'){
  const matches=state.items.filter(i=>i.category===g.category&&i.series===g.series&&i.ip.toLowerCase()===g.ip.toLowerCase());if(matches.length!==1)fail('请核对补图组合：'+g.name);
  const item=matches[0],old=JSON.parse(item.members||'[]');if(old.some(m=>!g.members.includes(m)))fail('补图包缺少已有成员');
  const images=JSON.parse(item.member_images||'{}');let changed=false;for(const [m,url] of Object.entries(g.member_images||{})){if(!images[m]||g.mode==='replace-images'&&images[m]!==url){images[m]=url;changed=true}}
  const members=[...old,...g.members.filter(m=>!old.includes(m))];if(members.length!==old.length){changed=true;const choices=state.catalog.filter(c=>c.category===g.category&&c.series===g.series&&c.role.toLowerCase()===g.ip.toLowerCase());for(const c of choices)c.members=JSON.stringify(members);item.members=JSON.stringify(members)}
  item.member_images=JSON.stringify(images);return {status:changed?'images':'skipped',name:g.name,qty:0,keep:0};
 }
 if(g.mode==='attach-images'){
  if(g.members.length!==1)fail('补图每行只对应一个成员');const member=g.members[0],roles=[g.ip,...(g.role_aliases||[])],series=[g.series,...(g.series_aliases||[])],norm=v=>String(v).toLowerCase().replace(/\s/g,'');
  const matches=state.items.filter(i=>i.category===g.category&&series.includes(i.series)&&roles.some(r=>norm(i.ip)===norm(r+' / '+member)||norm(i.ip)===norm(r)&&JSON.parse(i.members||'[]').includes(member)));
  if(matches.length!==1)fail((matches.length?'存在多个匹配':'未找到已入库款式')+'，未改动数量：'+g.name);
  const item=matches[0],members=JSON.parse(item.members||'[]'),images=JSON.parse(item.member_images||'{}');
  if(members.length?images[member]:item.image)return {status:'skipped',name:g.name,qty:0,keep:0};
  if(members.length){images[member]=g.member_images[member];item.member_images=JSON.stringify(images)}else item.image=g.member_images[member];
  return {status:'images',name:g.name,qty:0,keep:0};
 }
 const key=packageId+'/'+g.key;
 if(state.items.some(i=>i.import_key===key))return {status:'skipped',name:g.name,qty:0,keep:0};
 if(state.items.some(i=>i.name===g.name||i.category===g.category&&i.series===g.series&&i.ip.toLowerCase()===g.ip.toLowerCase()))fail('已存在同名款式，请核对避免重复入库：'+g.name);
 const members=JSON.stringify(g.members);let choice=state.catalog.find(c=>c.category===g.category&&c.series===g.series&&c.role.toLowerCase()===g.ip.toLowerCase());
 if(choice&&choice.members!==members)fail('现有分类成员顺序不同，请先核对：'+g.name);
 if(!choice)state.catalog.push({category:g.category,series:g.series,role:g.ip,members});
 mutate(state,'intake',{rows:[{name:g.name,category:g.category,series:g.series,ip:g.ip,member_quantities:g.member_quantities,keep_qty:g.members.map(m=>g.keep_quantities?.[m]||0).join('-'),note:String(g.note||'').slice(0,1000)}]});
 let item=state.items.at(-1);item.member_images=JSON.stringify(g.member_images||{});item.import_key=key;
 return {status:'added',name:g.name,qty:Object.values(g.member_quantities).reduce((a,b)=>a+b,0),keep:Object.values(g.keep_quantities||{}).reduce((a,b)=>a+b,0)};
}
export function previewCardPackage(state,p){validateCardPackage(p);let copy=structuredClone(state);return p.groups.map(g=>applyCardGroup(copy,p.id,g))}
