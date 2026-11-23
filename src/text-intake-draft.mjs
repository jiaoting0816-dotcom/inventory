import {splitCost} from './cost-math.mjs';
// Model output is an untrusted proposal. Only directory IDs selected and validated
// here may become an ordinary intake request; no model can mutate inventory.
export function unitTotal(value,qty){if(typeof value!=='string'||!/^\d+(\.\d{1,6})?$/.test(value)||!Number.isSafeInteger(qty)||qty<1)throw Error('单张成本须为非负金额，最多六位小数');const [whole,fraction='']=value.split('.');const micros=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));const total=(micros*BigInt(qty)+5000n)/10000n;if(total>10000000000n)throw Error('本批金额过大');return Number(total)}
export function validateTextDraft(draft,assets,text){
 const issues=[],rows=[];if(!draft||!Array.isArray(draft.lines)||draft.lines.length>200)throw Error('整理结果格式无效');
 if(!draft.lines.length)return {rows,issues:[{reason:'请至少添加一张卡面'}]};
 if(draft.intent!=='purchase')return {rows:[],issues:[{reason:'这段文字可能是盘点、更正或补成本，请进入原记录核对，不作为新增采购。'}]};
 const costs=new Map();
 for(const [i,l]of draft.lines.entries()){
  if(!l||typeof l!=='object'){issues.push({index:i,reason:'卡面内容无效'});continue}
  const asset=assets.find(a=>a.id===l.shared_id),variant=asset?.variants?.find(v=>v.id===l.variant_id);
  const problem=reason=>issues.push({index:i,series:asset?.series||'',ip:asset?.ip||'',member:variant?.name||l.label||'',evidence:l.evidence||'',reason});
  if(!variant)problem('请选择真实卡池中的卡面');
  if(!Number.isSafeInteger(l.qty)||l.qty<1||l.qty>1000000)problem('请确认新增数量');
  if(!Number.isSafeInteger(l.keep)||l.keep<0||l.keep>l.qty)problem('自留须为0至新增数量的整数');
  for(const k of ['name','source','batch','note','date'])if(l[k]!==undefined&&(typeof l[k]!=='string'||l[k].length>(k==='note'?1000:150)))problem('文字格式不正确或过长');
  if(typeof text==='string'&&(!l.evidence||!text.includes(l.evidence)))problem('原文依据无法核对，请重新选择原文短句');
  if(typeof l.evidence!=='string'||!l.evidence.trim())problem('缺少原文依据');
  if(l.total_cents!==null&&(!Number.isSafeInteger(l.total_cents)||l.total_cents<0))problem('成本必须为整数分或待补');
  let cost=l.total_cents;if(l.cost_mode!=='unit'&&l.total_amount!==undefined){if(l.total_amount==='')cost=null;else if(typeof l.total_amount==='string'&&/^\d+(\.\d{1,2})?$/.test(l.total_amount)&&Number(l.total_amount)<=100000000)cost=Math.round(Number(l.total_amount)*100);else problem('本批总成本须为非负金额，最多两位小数')}if(l.cost_mode==='unit'){try{cost=l.unit_cost===''?null:unitTotal(l.unit_cost,l.qty)}catch(e){problem(e.message)}}costs.set(i,cost);
 }
 for(const g of draft.cost_groups||[]){
  if(!g||typeof g!=='object'){issues.push({reason:'金额分摊格式无效'});continue}
  if(!g.confirmed){issues.push({reason:'请确认金额覆盖范围及分摊方式'});continue}
  if(!Array.isArray(g.indices)||!g.indices.length||new Set(g.indices).size!==g.indices.length||g.indices.some(i=>!Number.isInteger(i)||!draft.lines[i])||!Number.isSafeInteger(g.total_cents)||g.total_cents<0){issues.push({reason:'金额分摊范围或总额无效'});continue}
  if(g.indices.some(i=>costs.get(i)!==null)){issues.push({reason:'金额覆盖重复，请选择独立成本或组内分摊'});continue}
  if(g.indices.some(i=>!Number.isSafeInteger(draft.lines[i].qty)||draft.lines[i].qty<1))continue;
  splitCost(g.total_cents,g.indices.map(i=>draft.lines[i].qty)).forEach((amount,k)=>costs.set(g.indices[k],amount));
 }
 if(issues.length)return {rows,issues};
 draft.lines.forEach((l,i)=>{const a=assets.find(a=>a.id===l.shared_id),v=a.variants.find(v=>v.id===l.variant_id);rows.push({cost_allocation:(draft.cost_groups||[]).filter(g=>g.indices.includes(i)).map(g=>({total_cents:g.total_cents,total_qty:g.indices.reduce((n,j)=>n+draft.lines[j].qty,0),basis:'原购入数量',cards:g.indices.map(j=>({shared_id:draft.lines[j].shared_id,variant_id:draft.lines[j].variant_id,qty:draft.lines[j].qty}))})),shared_id:a.id,name:l.name||a.name||a.series+' · '+a.ip,variant_quantities:{[v.id]:l.qty},cost_mode:'total',total_cost:costs.get(i)===null?'':(costs.get(i)/100).toFixed(2),date:l.date||'',note:l.note||'',keep_qty:(JSON.parse(a.members||'[]').length?JSON.parse(a.members).map(n=>n===v.name?l.keep:0).join('-'):String(l.keep)),purchase_source:l.source||'',batch_name:l.batch||'',evidence:l.evidence})});
 return {rows,issues,quantity:draft.lines.reduce((n,l)=>n+l.qty,0),keep:draft.lines.reduce((n,l)=>n+l.keep,0),known_cost:[...costs.values()].reduce((n,c)=>n+(c??0),0),unknown_quantity:draft.lines.reduce((n,l,i)=>n+(costs.get(i)===null?l.qty:0),0)};
}
