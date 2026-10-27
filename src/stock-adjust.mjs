export function adjustStock(state,r){
 const item=state.items.find(i=>i.id===+r.item_id);if(!item)throw Error('卡款不存在');
 if(typeof r.request_key!=='string'||!/^[-a-zA-Z0-9]{16,100}$/.test(r.request_key))throw Error('请求标识无效');
 if(item.stock_adjustments?.some(x=>x.key===r.request_key))return;
 const batches=state.batches.filter(b=>b.item_id===item.id);
 const token=JSON.stringify(batches.map(b=>[b.id,b.remaining,b.remaining_cost,!!b.reserved]));
 if(r.token!==token)throw Error('库存或成本已变化，请重新打开调整页面');
 if(typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)throw Error('请填写调整原因（最多1000字）');
 const members=JSON.parse(item.members||'[]');if(!members.length)members.push('');
 if(!Array.isArray(r.rows)||r.rows.length!==members.length*2)throw Error('请填写全部成员的可售和自留数量');
 const seen=new Set(),before=[],after=[];
 for(const row of r.rows){const key=JSON.stringify([row.member,row.reserved]);if(!members.includes(row.member)||typeof row.reserved!=='boolean'||seen.has(key)||!/^\d+$/.test(String(row.qty))||!Number.isSafeInteger(+row.qty)||+row.qty>1000000)throw Error('成员或数量无效');seen.add(key);const qty=batches.filter(b=>b.member===row.member&&!!b.reserved===row.reserved).reduce((n,b)=>n+b.remaining,0);before.push({member:row.member,reserved:row.reserved,qty});after.push({...before.at(-1),qty:+row.qty})}
 if(before.every((x,i)=>x.qty===after[i].qty))throw Error('数量没有变化');
 const copy=structuredClone(state),target=copy.items.find(i=>i.id===item.id),pool=[],changes=[];
 for(let i=0;i<before.length;i++){let need=before[i].qty-after[i].qty;if(need<=0)continue;for(const b of copy.batches.filter(b=>b.item_id===item.id&&b.member===before[i].member&&!!b.reserved===before[i].reserved&&b.remaining>0).sort((a,b)=>b.id-a.id)){const take=Math.min(need,b.remaining),cost=Math.round(b.remaining_cost*take/b.remaining);pool.push({...b,remaining:take,remaining_cost:cost});changes.push({batch_id:b.id,qty:-take,cost:-cost});b.remaining-=take;b.remaining_cost-=cost;need-=take;if(!need)break}}
 let id=Math.max(0,...copy.batches.map(b=>b.id))+1;
 for(let i=0;i<before.length;i++){let need=after[i].qty-before[i].qty;if(need<=0)continue;while(need){const source=pool.find(b=>b.remaining>0),take=source?Math.min(source.remaining,need):need,cost=source?Math.round(source.remaining_cost*take/source.remaining):0;const b={id:id++,item_id:item.id,member:after[i].member,reserved:after[i].reserved,qty:take,remaining:take,total_cost:cost,remaining_cost:cost,cost:Math.round(cost/take),cost_known:source?source.cost_known!==false:false,cost_estimated:!!source?.cost_estimated,date:source?.date||new Date().toISOString().slice(0,10),location:source?.location||'',note:'手动调整：'+r.reason.trim()};copy.batches.push(b);changes.push({batch_id:b.id,qty:take,cost});if(source){source.remaining-=take;source.remaining_cost-=cost}need-=take}}
 target.stock_adjustments=[...(target.stock_adjustments||[]),{key:r.request_key,at:new Date().toISOString(),source:'manual',reason:r.reason.trim(),before,after,changes,removed_cost:pool.reduce((n,b)=>n+b.remaining_cost,0)}];Object.assign(state,copy);
}
