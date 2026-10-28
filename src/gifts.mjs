// Gift stock stays outside saleable stock; every movement retains its source cost.
export function giftMove(s,r){
 if(!/^[a-zA-Z0-9-]{16,100}$/.test(r.request_key||''))throw Error('请求标识无效');
 if(s.gift_events?.some(e=>e.key===r.request_key))return;
 if(!['transfer','return','send'].includes(r.action)||!Number.isSafeInteger(+r.qty)||+r.qty<1||+r.qty>1000000)throw Error('操作或数量无效');
 if(typeof r.note!=='string'||!r.note.trim()||r.note.length>1000)throw Error('请填写原因或赠送备注');
 const c=structuredClone(s);c.gifts??=[];c.gift_events??=[];let qty=+r.qty,cost=0,known=true,item_id,member;
 if(r.action==='transfer'){
 const b=c.batches.find(b=>b.id===+r.id);if(!b||b.remaining<qty)throw Error('原库存不足，请刷新');
 item_id=b.item_id;member=b.member;cost=Math.round(b.remaining_cost*qty/b.remaining);known=b.cost_known!==false;
 b.remaining-=qty;b.remaining_cost-=cost;
 c.gifts.push({id:Math.max(0,...c.gifts.map(g=>g.id))+1,batch_id:b.id,item_id,member,qty,remaining:qty,remaining_cost:cost,sent:0,sent_cost:0,cost_known:known,note:r.note.trim()});
 }else{
 const g=c.gifts.find(g=>g.id===+r.id);if(!g||g.remaining<qty)throw Error('赠品库存不足，请刷新');
 item_id=g.item_id;member=g.member;cost=Math.round(g.remaining_cost*qty/g.remaining);known=g.cost_known!==false;g.remaining-=qty;g.remaining_cost-=cost;
 if(r.action==='send'){g.sent+=qty;g.sent_cost+=cost}else{const b=c.batches.find(b=>b.id===g.batch_id);if(!b)throw Error('原批次不存在');b.remaining+=qty;b.remaining_cost+=cost;g.qty-=qty}
 }
 c.gift_events.push({key:r.request_key,at:new Date().toISOString(),action:r.action,item_id,member,qty,cost,cost_known:known,note:r.note.trim()});Object.assign(s,c);
}
export function giftBulk(s,r){
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(r.request_key||''))throw Error('请求标识无效');
 if(s.gift_events?.some(e=>e.key===r.request_key+'-0'))return;
 if(!Array.isArray(r.rows)||!r.rows.length||r.rows.length>100||new Set(r.rows.map(x=>+x.id)).size!==r.rows.length)throw Error('请选择1至100个不同批次');
 const c=structuredClone(s);r.rows.forEach((row,n)=>giftMove(c,{id:row.id,qty:row.qty,action:'transfer',note:r.note,request_key:r.request_key+'-'+n}));Object.assign(s,c);
}
