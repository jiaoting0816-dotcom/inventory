// Owner-only catalog. No quantities, costs or stock mutations belong here.
import {roleAliases} from './pool-identity.mjs';
export const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(v);
const text=(v,n=150)=>typeof v==='string'?v.trim().slice(0,n):'';
export function validatePrivatePool(input,previous=null,publish=false){
 if(!input||!validId(input.id))throw Error('私人卡池编号无效');
 const p={id:input.id,category:text(input.category),name:text(input.name),month:text(input.month,7),originals:[],cards:[]};
 if(p.month&&!/^20\d\d-(0[1-9]|1[0-2])$/.test(p.month))throw Error('请选择有效年月，未知月份可以留空');
 if(!Array.isArray(input.originals)||input.originals.length>30||!Array.isArray(input.cards)||input.cards.length>500)throw Error('每个卡池支持最多30张原图、500个卡面');
 const image=v=>!v?'':(/^\/api\/private-media\/[a-zA-Z0-9-]{16,80}$/.test(v)?v:(()=>{throw Error('图片必须来自本账号上传')})());
 for(const o of input.originals){if(!validId(o.id)||p.originals.some(x=>x.id===o.id))throw Error('原图编号重复或无效');p.originals.push({id:o.id,name:text(o.name),url:image(o.url)})}
 for(const c of input.cards){if(!validId(c.id)||!validId(c.group_id)||p.cards.some(x=>x.id===c.id))throw Error('卡面编号重复或无效');let crop=null;if(c.crop){crop=Object.fromEntries(['x','y','w','h'].map(k=>[k,Number(c.crop[k])]));if(Object.values(crop).some(x=>!Number.isFinite(x)||x<0)||crop.w<=0||crop.h<=0||crop.x+crop.w>1.00001||crop.y+crop.h>1.00001)throw Error('裁切区域超出原图');}const card={id:c.id,group_id:c.group_id,group:text(c.group),member:text(c.member,80),version:text(c.version,60),image:image(c.image),original_id:c.original_id||'',crop};if(card.original_id&&!p.originals.some(o=>o.id===card.original_id))throw Error('找不到卡面对应原图');p.cards.push(card)}
 const groups=new Map();for(const c of p.cards){if(groups.has(c.group_id)&&groups.get(c.group_id)!==c.group)throw Error('同一组合编号的名称不一致');groups.set(c.group_id,c.group)}
 if(previous){for(const old of previous.cards){const c=p.cards.find(c=>c.id===old.id);if(!c||c.group_id!==old.group_id)throw Error('已发布卡面不能删除或更换组合编号；请保留原卡面，新增版本');}}
 if(publish){if([...groups.keys()].some(id=>p.cards.filter(c=>c.group_id===id).length>100))throw Error('每个组合最多100个卡面，请按实际组别分组');if(!p.category||!p.name||!p.cards.length)throw Error('请填写分类、系列名称，并至少校对一个卡面');const keys=new Set();for(const c of p.cards){if(!c.group||!c.member||!c.version)throw Error('请补齐每张卡面的组合、成员及版本');const key=JSON.stringify([c.group.toLowerCase(),c.member,c.version]);if(keys.has(key))throw Error('同组合成员与版本重复，请区分不同卡面版本');keys.add(key);if([...groups].some(([id,name])=>id!==c.group_id&&name.toLowerCase()===c.group.toLowerCase()))throw Error('同名组合请使用同一组编号（重新选择组合即可）')}}
 return p;
}
export function privateAssets(row){if(!row.published_payload)return [];const p=JSON.parse(row.published_payload),groups=[...new Set(p.cards.map(c=>c.group_id))];return groups.map(id=>{const cs=p.cards.filter(c=>c.group_id===id),labels=cs.map(c=>c.member+' · '+c.version);return {id:'private-'+p.id+'-'+id,scope:'private',private_pool_id:p.id,pool_id:'private-'+p.id,cp_id:'private-'+id,category:p.category,series:p.name,series_month:p.month,ip:cs[0].group,search_aliases:roleAliases(cs[0].group),members:JSON.stringify(labels),variants:cs.map((c,i)=>({id:'private-'+p.id+'-'+c.id,name:labels[i]})),member_images:JSON.stringify(Object.fromEntries(cs.map((c,i)=>[labels[i],c.image]))),image:'',active:1}})}
export async function ownerPrivateAssets(db,owner){const rows=await db.prepare('SELECT * FROM private_pools WHERE owner_id=? AND published_payload IS NOT NULL').bind(owner).all();return rows.results.flatMap(privateAssets)}
