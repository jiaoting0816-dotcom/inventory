import {sameRole} from './pool-identity.mjs';
const names=i=>JSON.parse(i.members||'[]');
const images=i=>JSON.parse(i.member_images||'{}');
const product=i=>i.ip||i.name;
export function sameStyle(a,b){
 if((String(a.pool_id||'').startsWith('private-')||String(b.pool_id||'').startsWith('private-'))&&a.pool_id!==b.pool_id)return false;
 if(String(a.pool_id||'').startsWith('private-')&&a.pool_id===b.pool_id&&a.cp_id===b.cp_id)return true;
 if(a.category!==b.category)return false;
 if(a.shared_id&&a.shared_id===(b.shared_id||b.id))return true;
 if(a.pool_id&&b.pool_id&&a.cp_id&&b.cp_id)return a.pool_id===b.pool_id&&a.cp_id===b.cp_id;
 return a.series===b.series&&sameRole(product(a),product(b));
}
// Read-only projection: source IDs, batches, allocations and historical labels never move.
export function inventorySummaries(state,assets=[]){
 const groups=[];
 for(const item of state.items){const hits=groups.filter(g=>g.some(x=>sameStyle(x,item)));if(!hits.length)groups.push([item]);else{hits[0].push(item);for(const other of hits.slice(1)){hits[0].push(...other);groups.splice(groups.indexOf(other),1)}}}
 return groups.map(sources=>{
  const ordered=[...sources].sort((a,b)=>Number(!!b.standard_intake)-Number(!!a.standard_intake)||a.id-b.id),primary=ordered[0];
  const catalog=assets.filter(a=>sources.some(i=>sameStyle(i,a))),descriptors=new Map();
  // Current catalog names win by fixed ID, historical names remain aliases for old batches.
  for(const a of [...catalog,...ordered])for(const v of a.variants||[]){let d=descriptors.get(v.id);if(!d){d={id:v.id,name:v.name,aliases:[],image:images(a)[v.name]||'',batches:[]};descriptors.set(v.id,d)}for(const alias of [v.name,...(v.aliases||[])])if(!d.aliases.includes(alias))d.aliases.push(alias)}
  // Keep private image overrides scoped to this account.
  for(const i of [...ordered].reverse())for(const v of i.variants||[]){const pic=images(i)[v.name];if(pic&&descriptors.has(v.id)&&!(String(i.pool_id||'').startsWith('private-')&&pic.startsWith('/api/private-media/')&&catalog.some(a=>a.variants?.some(x=>x.id===v.id))))descriptors.get(v.id).image=pic}
  const ids=sources.map(i=>i.id),bs=state.batches.filter(b=>ids.includes(b.item_id)),cards=[...descriptors.values()];
  const resolveName=m=>cards.filter(c=>c.aliases?.includes(m));
  for(const b of bs){const link=(state.card_links||[]).filter(l=>l.batch_id===b.id).at(-1);let card=descriptors.get(link?.variant_id||b.variant_id);
   if(!card&&!b.variant_id&&!link&&b.member){const matches=resolveName(b.member);if(matches.length===1)card=matches[0]}
   if(!card){const pending=cards.some(c=>!c.legacy)||!b.member,key='legacy:'+JSON.stringify([b.member||'',pending]);card=cards.find(c=>c.id===key);if(!card){card={id:key,name:b.member||'未拆分',pending,legacy:true,image:sources.map(i=>images(i)[b.member]).find(Boolean)||'',batches:[]};cards.push(card)}}
   if(!b.deletion)card.batches.push({...b,original_member:b.member,display_member:card.name,pending:!!card.pending});
  }
  // Empty options belong to the style, never create another homepage row.
  if(!descriptors.size)for(const i of sources)for(const n of names(i))if(!cards.some(c=>c.name===n))cards.push({id:'legacy:'+n,name:n,legacy:true,image:images(i)[n]||'',batches:[]});
  return {...primary,source_ids:ids,source_names:sources.map(i=>i.name),cards,batches:cards.flatMap(c=>c.batches),pending_count:cards.filter(c=>c.pending).reduce((n,c)=>n+c.batches.reduce((n,b)=>n+b.remaining,0),0),members:JSON.stringify(cards.map(c=>c.name)),member_images:JSON.stringify(Object.fromEntries(cards.map(c=>[c.name,c.image])))};
 });
}
export function extendStyle(item,asset){
 const variants=new Map((item.variants||[]).map(v=>[v.id,v]));for(const v of asset.variants||[]){const old=variants.get(v.id);variants.set(v.id,{...v,aliases:[...new Set([...(old?.aliases||[]),...(old?[old.name]:[]),v.name])]})}
 item.standard_intake=true;item.shared_id=asset.id;item.pool_id=asset.pool_id;item.cp_id=asset.cp_id;item.variants=[...variants.values()];
 item.members=JSON.stringify([...new Set([...names(item),...names(asset)])]);
 item.member_images=JSON.stringify({...images(asset),...Object.fromEntries(Object.entries(images(item)).filter(([,v])=>v))});
}
export function linkCard(state,r){
 const summary=inventorySummaries(state,r._assets||[]).find(g=>g.source_ids.includes(+r.item_id)),batch=state.batches.find(b=>b.id===+r.batch_id);
 const card=summary?.cards.find(c=>c.id===r.variant_id&&!c.legacy);
 if(!summary||!batch||!summary.source_ids.includes(batch.item_id)||!card)throw Error('请选择同一库存汇总内的批次和标准卡面');
 const previous=(state.card_links||[]).filter(l=>l.batch_id===batch.id).at(-1);
 if(previous?.variant_id===card.id)return;
 if((previous?.variant_id||'')!==(r.expected_variant_id||''))throw Error('关联已变化，请刷新后确认');
 state.card_links=[...(state.card_links||[]),{batch_id:batch.id,item_id:batch.item_id,variant_id:card.id,member:card.name,previous_variant_id:previous?.variant_id||'',at:new Date().toISOString(),source:'manual'}];
}
