// Split only remaining units. Sold/gift source batches remain available for reversals.
export function allocateMembers(state,r){
 const item=state.items.find(x=>x.id===Number(r.item_id));
 if(!item)throw Error('卡款不存在');
 if(typeof r.request_key!=='string'||!/^[-a-zA-Z0-9]{16,100}$/.test(r.request_key))throw Error('请求标识无效');
 if(item.member_allocations?.some(x=>x.key===r.request_key))return;
 const s=structuredClone(state),target=s.items.find(x=>x.id===item.id),batch=s.batches.find(x=>x.id===Number(r.batch_id)&&x.item_id===item.id);
 if(!batch||batch.member||!batch.remaining)throw Error('请选择尚未分配成员的在库批次');
 if(JSON.stringify([batch.remaining,batch.remaining_cost,!!batch.reserved])!==r.token)throw Error('库存已变化，请重新打开');
 let members=JSON.parse(target.members||'[]');
 if(!members.length&&r._asset){members=JSON.parse(r._asset.members);target.members=JSON.stringify(members);target.shared_id=r._asset.id;target.pool_id=r._asset.pool_id;target.cp_id=r._asset.cp_id;target.variants=r._asset.variants;}
 if(!members.length||!r.quantities||Object.keys(r.quantities).length!==members.length)throw Error('请选择公共卡款并填写全部成员数量');
 const entries=members.map(m=>{const q=r.quantities[m];if(!/^\d+$/.test(String(q))||!Number.isSafeInteger(+q)||+q>1000000)throw Error('数量须为非负整数');return [m,+q]});
 if(entries.reduce((n,x)=>n+x[1],0)!==batch.remaining)throw Error('分配合计必须等于原在库数量');
 const before=structuredClone(batch),total=batch.remaining,cost=batch.remaining_cost;let cumulative=0,assigned=0;
 const rows=entries.filter(x=>x[1]).map(([member,qty],index)=>{cumulative+=qty;const share=Math.round(cost*cumulative/total)-assigned;assigned+=share;return {...batch,id:Math.max(0,...s.batches.map(x=>x.id))+index+1,member,variant_id:target.variants?.find(v=>v.name===member)?.id,qty,remaining:qty,total_cost:share,remaining_cost:share,cost:Math.round(share/qty),note:(batch.note||'')+'；手动分配成员',source_batch_id:batch.id}});
 batch.qty-=total;batch.total_cost-=cost;batch.remaining=0;batch.remaining_cost=0;
 if(!batch.qty){if(s.allocations.some(x=>x.batch_id===batch.id)||(s.gifts||[]).some(x=>x.batch_id===batch.id))throw Error('原批次有关联记录，请先核对数量');s.batches=s.batches.filter(x=>x.id!==batch.id)}
 s.batches.push(...rows);
 target.member_allocations=[...(target.member_allocations||[]),{key:r.request_key,at:new Date().toISOString(),type:'手动分配成员',source:'manual',before,after:rows.map(x=>({id:x.id,member:x.member,qty:x.qty,cost:x.total_cost})),shared_id:r._asset?.id}];
 Object.assign(state,s);
}
