// Keep the stable batch ID and purchase receipt; only effective stock is withdrawn.
export function previewBatchDeletion(s,r){
 const b=s.batches.find(b=>b.id===+r.batch_id);if(!b)throw Error('批次不存在或不属于当前账号');
 if(b.deletion)throw Error('该批次已删除，请刷新详情查看记录');
 if(typeof r.reason!=='string'||!r.reason.trim()||r.reason.length>1000)throw Error('请填写删除原因（最多1000字）');
 const allocations=s.allocations.filter(a=>a.batch_id===b.id),gifts=(s.gifts||[]).filter(g=>g.batch_id===b.id&&(g.remaining||g.sent)),children=s.batches.filter(x=>x.source_batch_id===b.id),item=s.items.find(i=>i.id===b.item_id);
 const adjustments=(item?.stock_adjustments||[]).filter(e=>e.changes?.some(c=>c.batch_id===b.id));
 const blockers=[...allocations.map(a=>({kind:'sale',id:a.sale_id,text:`销售 #${a.sale_id} · ${a.qty} 张，请核对订单；仅误录销售才撤销`})),...gifts.map(g=>({kind:'gift',id:g.id,text:`赠品 #${g.id} · 待赠 ${g.remaining} / 已赠 ${g.sent}，请先核对赠品去向`})),...children.map(c=>({kind:'batch',id:c.id,text:`关联子批次 #${c.id} · ${c.reserved?'自留':'转移'}，请先核对来源链`})),...(b.source_batch_id?[{kind:'batch',id:b.source_batch_id,text:`来源批次 #${b.source_batch_id}：这是转移记录，请在来源链中处理，不作为独立采购删除`}]:[]),...(adjustments.length?[{kind:'history',text:'存在盘点/自留调整记录，请先核对库存变更，不能删除采购代替调整'}]:[])];
 if(b.remaining!==b.qty||b.remaining_cost!==b.total_cost)blockers.push({kind:'history',text:'原购入与当前剩余不一致，存在已消耗或未确认去向，请先核对'});
 const token=JSON.stringify({b,allocations,gifts,children,adjustments});
 return {token,before:structuredClone(b),quantity:b.remaining,cost:b.remaining_cost,cost_known:b.cost_known!==false,blockers};
}
export function deleteBatch(s,r){
 if(!/^[-a-zA-Z0-9]{16,100}$/.test(r.request_key||''))throw Error('请求标识无效');
 const replay=s.batches.find(b=>b.deletion?.key===r.request_key);if(replay){if(replay.id!==+r.batch_id)throw Error('请求编号已用于其他批次');return}
 const p=previewBatchDeletion(s,r);if(p.token!==r.token)throw Error('批次或关联记录已变化，请重新预览');
 if(p.blockers.length)throw Error(p.blockers.map(x=>x.text).join('；'));
 const b=s.batches.find(b=>b.id===+r.batch_id);b.deletion={key:r.request_key,at:new Date().toISOString(),reason:r.reason.trim(),before:p.before};b.remaining=0;b.remaining_cost=0;
}
