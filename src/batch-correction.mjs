import {splitCost,costPortion} from './cost-math.mjs';
const fail=m=>{throw Error(m)};
export function previewBatchCorrection(s,r){
 const b=s.batches.find(x=>x.id===+r.batch_id);if(!b)fail('批次不存在');
 if(!/^\d+$/.test(String(r.qty))||+r.qty<1||+r.qty>1000000)fail('原购入数量须为1–1000000的整数');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date)fail('购入日期无效');
 if(typeof r.note!=='string'||r.note.length>1000||typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)fail('请填写更正原因，备注及原因最多1000字');
 const known=r.total_cost!=='';if(known&&(!/^\d+(\.\d{1,2})?$/.test(String(r.total_cost))||+r.total_cost>1e8))fail('批次总成本须为非负金额，最多两位小数');
 if(b.cost_known!==false&&!known)fail('已有成本不能清空为未知，请填写更正后的实际金额');
 if(typeof r.estimated!=='boolean'&&r.estimated!==undefined)fail('估算标记无效');
 for(const k of ['purchase_source','batch_name'])if(r[k]!==undefined&&(typeof r[k]!=='string'||r[k].length>150))fail('来源和批次名称最多150字');
 const total=known?Math.round(+r.total_cost*100):0,qty=+r.qty;
 const family=[],visit=(node,seen=new Set())=>{if(seen.has(node.id))fail('来源批次关联循环');seen.add(node.id);family.push(node);for(const child of s.batches.filter(x=>x.source_batch_id===node.id)){if(child.item_id!==b.item_id)fail('来源批次归属不一致');visit(child,seen)}};visit(b);
 const ids=new Set(family.map(x=>x.id)),as=s.allocations.filter(a=>ids.has(a.batch_id)),gs=(s.gifts||[]).filter(g=>ids.has(g.batch_id));
 const financial=total!==b.total_cost||known!==(b.cost_known!==false)||qty!==b.qty||!!r.estimated!==!!b.cost_estimated;
 if(financial&&b.source_batch_id)fail('此记录由批次 #'+b.source_batch_id+' 转移，请在来源批次更正总购入成本；本记录可更正日期与备注');
 const remaining=b.remaining+qty-b.qty;if(remaining<0)fail('更正数量不能少于已售、已赠及已转移数量');
 if(as.some(a=>s.sales.find(x=>x.id===a.sale_id)?.date<r.date))fail('购入日期不能晚于已关联的售出日期');
 const after={...b,qty,remaining,date:r.date,note:r.note,date_auto:false};let allocations=[],gifts=[],batches=[];
 function distribute(node,amount){
  const aa=as.filter(a=>a.batch_id===node.id),gg=gs.filter(g=>g.batch_id===node.id),children=family.filter(x=>x.source_batch_id===node.id),rem=node.id===b.id?remaining:node.remaining,count=node.id===b.id?qty:node.qty;
  const weights=[...aa.map(a=>a.qty),...gg.flatMap(g=>[g.sent,g.remaining]),...children.map(c=>c.qty),rem];
  if(weights.reduce((n,x)=>n+x,0)!==count)fail('批次 #'+node.id+' 有未明确归属的盘点差异，请先核对数量去向；可单独更正日期与备注');
  const parts=splitCost(amount,weights),next={...node,total_cost:amount,remaining_cost:parts.at(-1),cost:costPortion(amount,1,count),cost_known:known,cost_estimated:r.estimated===true,cost_source:'correction'};
  if(node.id===b.id)Object.assign(after,next,{qty,remaining,date:r.date,note:r.note,date_auto:false});else batches.push(next);
  allocations.push(...aa.map((a,i)=>({...a,cost:parts[i]})));
  gifts.push(...gg.map((g,i)=>({...g,sent_cost:parts[aa.length+2*i],remaining_cost:parts[aa.length+2*i+1],cost_known:known,cost_estimated:r.estimated===true})));
  children.forEach((c,i)=>distribute(c,parts[aa.length+2*gg.length+i]));
 }
 if(financial)distribute(b,total);
 for(const k of ['purchase_source','batch_name'])if(r[k]!==undefined)after[k]=r[k].trim();
 const sales=[...new Set(allocations.map(a=>a.sale_id))].map(id=>{const old=s.sales.find(x=>x.id===id),aa=s.allocations.filter(a=>a.sale_id===id);return {id,before_cost:old.cost,before_known:old.cost_known!==false,revenue:old.revenue,cost:aa.reduce((n,a)=>n+(allocations.find(x=>x.sale_id===id&&x.batch_id===a.batch_id)?.cost??a.cost),0),cost_known:aa.every(a=>ids.has(a.batch_id)?known:s.batches.find(x=>x.id===a.batch_id).cost_known!==false)}});
 const token=JSON.stringify({b,as,gs,sales:s.sales.filter(x=>as.some(a=>a.sale_id===x.id)),related:s.batches.filter(x=>x.item_id===b.item_id)});
 return {token,before:structuredClone(b),after,batches,allocations,gifts,sales,financial};
}
export function correctBatch(state,r){
 if(state.batch_corrections?.some(e=>e.key===r.request_key))return;
 if(!/^[-a-zA-Z0-9]{16,100}$/.test(r.request_key||''))fail('请求标识无效');
 const p=previewBatchCorrection(state,r);if(p.token!==r.token)fail('批次或关联记录已变化，请重新预览');
 const s=structuredClone(state),at=new Date().toISOString();Object.assign(s.batches.find(b=>b.id===p.before.id),p.after,{updated_at:at,...(p.financial?{cost_updated_at:at}:{})});
 for(const b of p.batches)Object.assign(s.batches.find(x=>x.id===b.id),b,{cost_updated_at:at});
 for(const a of p.allocations)Object.assign(s.allocations.find(x=>x.batch_id===a.batch_id&&x.sale_id===a.sale_id),a);
 for(const g of p.gifts)Object.assign(s.gifts.find(x=>x.id===g.id),g);
 for(const x of p.sales)Object.assign(s.sales.find(a=>a.id===x.id),{cost:x.cost,cost_known:x.cost_known,cost_estimated:s.allocations.filter(a=>a.sale_id===x.id).some(a=>s.batches.find(b=>b.id===a.batch_id).cost_estimated)});
 s.batch_corrections=[...(s.batch_corrections||[]),{key:r.request_key,at,item_id:p.before.item_id,batch_id:p.before.id,reason:r.reason.trim(),before:p.before,after:p.after,sales:p.sales,allocations:p.allocations,gifts:p.gifts,related_before:state.batches.filter(b=>p.batches.some(x=>x.id===b.id)),related_after:p.batches}];Object.assign(state,s);
}
