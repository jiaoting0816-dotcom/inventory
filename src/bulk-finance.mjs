import {costPortion,splitCost} from './cost-math.mjs';
const fail=m=>{throw Error(m)};
const money=v=>{if(!/^\d+(\.\d{1,2})?$/.test(String(v))||+v>1e8)fail('金额须为非负数，最多两位小数');return Math.round(+v*100)};
function shares(total,weights){let sum=weights.reduce((a,b)=>a+b,0),cum=0,prev=0;return weights.map(w=>{cum+=w;let value=Math.round(total*cum/sum),part=value-prev;prev=value;return part})}
export function financePreview(s,r){
 if(r.kind!=='cost')fail('无效金额操作');
 const itemIds=s.items.filter(i=>i.category===r.category&&i.series===r.series).map(i=>i.id);
 let rows=s.batches.filter(b=>itemIds.includes(b.item_id)&&!b.deletion&&b.cost_known===false);
 if(r.ids!==undefined){if(!Array.isArray(r.ids)||!r.ids.length||r.ids.length>1000||new Set(r.ids).size!==r.ids.length||r.ids.some(id=>!rows.some(b=>b.id===id)))fail('请选择本系列待补成本批次；已有成本不能覆盖');rows=rows.filter(b=>r.ids.includes(b.id))}
 if(!rows.length)fail('该系列没有待补成本的批次');
 if(r.estimated!==undefined&&typeof r.estimated!=='boolean')fail('估算选项无效');
 const total=money(r.total),qty=rows.reduce((n,b)=>n+b.qty,0),parts=splitCost(total,rows.map(b=>b.qty));
 const lines=rows.map((b,index)=>{const allocations=s.allocations.filter(a=>a.batch_id===b.id),gifts=(s.gifts||[]).filter(g=>g.batch_id===b.id),weights=[...allocations.map(a=>a.qty),...gifts.flatMap(g=>[g.sent,g.remaining]),b.remaining];
 if(weights.reduce((n,q)=>n+q,0)!==b.qty)fail('批次 #'+b.id+' 原购入数量与当前去向不一致，数据可能已变化，请先核对历史调整；本次未保存');
 const amounts=splitCost(parts[index],weights),item=s.items.find(i=>i.id===b.item_id);
 return {batch_id:b.id,item_id:b.item_id,member:b.member||'',name:item.name,date:b.date,qty:b.qty,remaining:b.remaining,total_cost:parts[index],remaining_cost:amounts.at(-1),before_total_cost:b.total_cost,before_remaining_cost:b.remaining_cost,allocations:allocations.map((a,k)=>({sale_id:a.sale_id,qty:a.qty,before_cost:a.cost,cost:amounts[k]})),gifts:gifts.map((g,k)=>({id:g.id,sent:g.sent,remaining:g.remaining,before_sent_cost:g.sent_cost,before_remaining_cost:g.remaining_cost,sent_cost:amounts[allocations.length+k*2],remaining_cost:amounts[allocations.length+k*2+1]}))};});
 const saleIds=[...new Set(lines.flatMap(l=>l.allocations.map(a=>a.sale_id)))];
 const sales=s.sales.filter(x=>saleIds.includes(x.id)).map(sale=>{const as=s.allocations.filter(a=>a.sale_id===sale.id);return {id:sale.id,qty:sale.qty,revenue:sale.revenue,before_cost:sale.cost,before_known:sale.cost_known!==false,cost:as.reduce((n,a)=>n+(lines.find(l=>l.batch_id===a.batch_id)?.allocations.find(x=>x.sale_id===sale.id)?.cost??a.cost),0),cost_known:as.every(a=>rows.some(b=>b.id===a.batch_id)||s.batches.find(b=>b.id===a.batch_id)?.cost_known!==false)}});
 const token=JSON.stringify({rows,allocations:s.allocations.filter(a=>rows.some(b=>b.id===a.batch_id)),gifts:(s.gifts||[]).filter(g=>rows.some(b=>b.id===g.batch_id)),sales:s.sales.filter(x=>saleIds.includes(x.id)),total,estimated:r.estimated===true});
 return {ids:rows.map(b=>b.id),qty,total,estimated:r.estimated===true,lines,sales,token};
}
export function applyEstimatedCost(state,r){
 if(r.request_key&&state.cost_entries?.some(e=>e.request_key===r.request_key))return;
 if(r.request_key&&!/^[-a-zA-Z0-9]{16,100}$/.test(r.request_key))fail('请求标识无效');
 const p=financePreview(state,r);if(r.token!==p.token)fail('库存、成本或金额已变化，请重新预览');
 const s=structuredClone(state),at=new Date().toISOString(),key=r.request_key||crypto.randomUUID();
 for(const l of p.lines){const b=s.batches.find(b=>b.id===l.batch_id);Object.assign(b,{total_cost:l.total_cost,remaining_cost:l.remaining_cost,cost:costPortion(l.total_cost,1,b.qty),cost_known:true,cost_estimated:p.estimated,cost_source:'bulk',cost_entry_id:key,cost_updated_at:at});
 for(const a of l.allocations)s.allocations.find(x=>x.batch_id===b.id&&x.sale_id===a.sale_id).cost=a.cost;
 for(const g of l.gifts)Object.assign(s.gifts.find(x=>x.id===g.id),{sent_cost:g.sent_cost,remaining_cost:g.remaining_cost,cost_known:true,cost_estimated:p.estimated});
 }
 for(const pSale of p.sales){const sale=s.sales.find(x=>x.id===pSale.id);Object.assign(sale,{cost:pSale.cost,cost_known:pSale.cost_known,cost_estimated:s.allocations.filter(a=>a.sale_id===sale.id).some(a=>s.batches.find(b=>b.id===a.batch_id).cost_estimated)})}
 s.cost_entries=[...(s.cost_entries||[]),{request_key:key,at,source:'bulk',category:r.category,series:r.series,total:p.total,qty:p.qty,estimated:p.estimated,basis:'按所选批次原购入数量分摊，再按当前数量去向分配；以分为单位累计分摊尾差',lines:p.lines,sales:p.sales}];Object.assign(state,s);return p;
}
export function salesPreview(s,r){if(!Array.isArray(r.ids)||!r.ids.length||r.ids.length>500||new Set(r.ids).size!==r.ids.length)fail('请选择销售记录');let lines=s.sales.filter(x=>r.ids.includes(x.id));if(lines.length!==r.ids.length)fail('销售记录已变化');for(let x of lines)if(x.order_id&&s.sales.some(y=>y.order_id===x.order_id&&!r.ids.includes(y.id)))fail('请选中完整订单');let gross=money(r.gross),shipping=money(r.shipping),qty=lines.reduce((n,x)=>n+x.qty,0);return {qty,gross,shipping,token:JSON.stringify(lines.map(x=>[x.id,x.qty,x.revenue,x.order_id,s.orders.find(o=>o.id===x.order_id)]))}}
export function applyEstimatedSales(s,r){let p=salesPreview(s,r);if(r.token!==p.token)fail('销售金额已变化，请重新预览');let lines=s.sales.filter(x=>r.ids.includes(x.id));let keys=[...new Set(lines.map(x=>x.order_id?'o'+x.order_id:'s'+x.id))],groups=keys.map(k=>lines.filter(x=>(x.order_id?'o'+x.order_id:'s'+x.id)===k)),weights=groups.map(g=>g.reduce((n,x)=>n+x.qty,0)),gross=shares(p.gross,weights),shipping=shares(p.shipping,weights);for(let [i,g]of groups.entries()){let o=s.orders.find(o=>o.id===g[0].order_id);if(!o){o={id:Math.max(0,...s.orders.map(x=>x.id))+1,gross:g[0].revenue,shipping:0};s.orders.push(o);g[0].order_id=o.id}o.edits=[...(o.edits||[]),{at:new Date().toISOString(),before:{gross:o.gross,shipping:o.shipping},after:{gross:gross[i],shipping:shipping[i]},estimated:true}];o.gross=gross[i];o.shipping=shipping[i];o.estimated=true;let revenues=shares(gross[i]-shipping[i],g.map(x=>x.qty));g.forEach((x,j)=>{x.revenue=revenues[j];x.price=Math.round(x.revenue/x.qty);x.revenue_estimated=true})}return p}
