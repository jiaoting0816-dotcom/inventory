let poolRequestKey;
function poolQuantities(){const inputs=[...document.querySelectorAll('[data-pool-member]')];return inputs.length===1&&inputs[0].dataset.poolMember===''?{qty:inputs[0].value}:{member_quantities:Object.fromEntries(inputs.map(x=>[x.dataset.poolMember,x.value]))}}
// Public selection reads shared metadata; saving uses the existing account-scoped intake API.
const legacyPoolIntake = openIntake;
openIntake = async function(id, manual=false) {
 if(id || manual) return legacyPoolIntake(id,manual);
 try {
  const assets=await accountRequest('library');
  mode='public-pool'; selected=null;poolRequestKey=crypto.randomUUID();
  modal('从公共卡池入库',`<div class="grid"><label>分类<select id="poolCategory"></select></label><label>卡池<select id="poolSeries"></select></label><label>CP / 角色<select id="poolRole"></select></label><label>自动名称<input id="poolName" readonly></label><div id="poolMembers" class="wide"></div><p id="poolTotal" aria-live="polite"></p>${field('total_cost','本次总成本（元，可留空）','number','','min="0" step="0.01"')}${field('note','备注')}</div><button type="button" id="poolManual">自行录入其他物品</button>`,'保存入库');
  const cat=$('#poolCategory'),series=$('#poolSeries'),role=$('#poolRole');
  const draw=()=>{const a=assets.find(x=>x.id===role.value);$('#submit').disabled=!a;if(!a){$('#poolMembers').textContent='该卡池暂无卡款';return}$('#poolName').value=a.series+' · '+a.ip;const images=JSON.parse(a.member_images||'{}');$('#poolMembers').innerHTML='<div class="grid">'+(JSON.parse(a.members).length?JSON.parse(a.members):['']).map(m=>`<label>${images[m]?`<img src="${esc(images[m])}" alt="${esc(m)}" style="width:70px;height:100px;object-fit:contain">`:'<span>暂无图片</span>'}${esc(m||'数量')}<input type="number" data-pool-member="${esc(m)}" min="0" max="1000000" step="1" value="0" required></label>`).join('')+'</div>';const total=()=>$('#poolTotal').textContent='合计 '+[...document.querySelectorAll('[data-pool-member]')].reduce((n,e)=>n+Number(e.value||0),0)+' 张';$('#poolMembers').oninput=total;total()};
  series.onchange=()=>{role.innerHTML=assets.filter(a=>a.category===cat.value&&a.series===series.value).map(a=>`<option value="${esc(a.id)}">${esc(a.ip)}</option>`).join('');draw()};cat.onchange=()=>{series.innerHTML=options([...new Set(assets.filter(a=>a.category===cat.value).map(a=>a.series))]);series.onchange()};role.onchange=draw;cat.innerHTML=options([...new Set(assets.map(a=>a.category))]);cat.onchange();$('#poolManual').onclick=()=>{$('#modal').close();legacyPoolIntake(undefined,true)};
 }catch(e){toast(e.message)}
};
const poolPreviousSubmit=$('#form').onsubmit;
$('#form').onsubmit=async function(e){if(mode!=='public-pool')return poolPreviousSubmit.call(this,e);e.preventDefault();if(busy)return;busy=true;$('#submit').disabled=true;try{await post('/api/intake',{request_key:poolRequestKey,rows:[{shared_id:$('#poolRole').value,name:$('#poolName').value,...poolQuantities(),cost_mode:'total',total_cost:this.elements.total_cost.value,note:this.elements.note.value}]});$('#modal').close();await load();toast('已入库')}catch(err){$('#error').textContent=err.message}finally{busy=false;$('#submit').disabled=false}};

const poolDetail=detail;
detail=function(id){
 poolDetail(id);
 const item=db.items.find(x=>x.id===id),legacy=db.batches.filter(b=>b.item_id===id&&!b.member&&b.remaining>0);
 const panel=document.createElement('section');panel.className='allocation-panel';
 panel.innerHTML=(legacy.length?'<h3>未分配成员的库存</h3><p class="hint">只分配在库数量，合计及成本保持不变；自留批次仍为自留。</p>'+legacy.map(b=>`<p>批次 #${b.id} · ${b.remaining} 张${b.reserved?' · 自留':''} <button type="button" data-allocate-batch="${b.id}">分配成员</button></p>`).join(''):'')+(item.member_allocations?.length?'<details><summary>手动分配记录（'+item.member_allocations.length+'）</summary>'+item.member_allocations.map(a=>`<p>${esc(a.at)} · 批次 #${a.before.id}：${a.before.remaining} 张 → ${a.after.map(x=>esc(x.member)+' '+x.qty).join('、')} · 手动修改</p>`).join('')+'</details>':'');
 $('#fields').append(panel);panel.querySelectorAll('[data-allocate-batch]').forEach(b=>b.onclick=()=>openMemberAllocation(id,Number(b.dataset.allocateBatch)));
};
async function openMemberAllocation(itemId,batchId){
 const item=db.items.find(x=>x.id===itemId),batch=db.batches.find(x=>x.id===batchId);let members=JSON.parse(item.members||'[]'),assets=[];
 try{if(!members.length)assets=(await accountRequest('library')).filter(a=>JSON.parse(a.members).length);$('#modal').close();mode='allocate-members';const requestKey=crypto.randomUUID();
 modal('分配成员 · '+item.name,`<p>批次 #${batch.id}：需分配 <strong>${batch.remaining}</strong> 张${batch.reserved?'（自留，不可售）':''}。不会更改成本。</p>${members.length?'':'<label>选择对应公共卡款<select id="allocationAsset"><option value="">请选择卡池 / CP</option>'+assets.map(a=>`<option value="${esc(a.id)}">${esc(a.category+' · '+a.series+' · '+a.ip)}</option>`).join('')+'</select></label>'}<div id="allocationInputs" class="grid"></div><p id="allocationSum" aria-live="polite"></p>`,'保存分配');
 const draw=()=>{if(!JSON.parse(item.members||'[]').length)members=JSON.parse(assets.find(a=>a.id===$('#allocationAsset').value)?.members||'[]');$('#allocationInputs').innerHTML=members.map(m=>`<label>${esc(m)}<input type="number" data-allocate-member="${esc(m)}" min="0" max="1000000" step="1" value="0" required></label>`).join('');sum()};
 const sum=()=>{const total=[...document.querySelectorAll('[data-allocate-member]')].reduce((n,x)=>n+Number(x.value||0),0);$('#allocationSum').textContent=`已分配 ${total} / ${batch.remaining} 张`;$('#submit').disabled=total!==batch.remaining||!members.length};
 $('#allocationInputs').oninput=sum;if($('#allocationAsset'))$('#allocationAsset').onchange=draw;draw();
 allocationRequest={item_id:itemId,batch_id:batchId,request_key:requestKey,token:JSON.stringify([batch.remaining,batch.remaining_cost,!!batch.reserved])};
 }catch(e){toast(e.message)}
}
let allocationRequest;
const allocationPreviousSubmit=$('#form').onsubmit;
$('#form').onsubmit=async function(e){if(mode!=='allocate-members')return allocationPreviousSubmit.call(this,e);e.preventDefault();if(busy)return;busy=true;$('#submit').disabled=true;try{await post('/api/allocate-members',{...allocationRequest,shared_id:$('#allocationAsset')?.value,quantities:Object.fromEntries([...document.querySelectorAll('[data-allocate-member]')].map(x=>[x.dataset.allocateMember,x.value]))});$('#modal').close();await load();detail(allocationRequest.item_id);toast('成员已分配，变更记录已保存')}catch(err){$('#error').textContent=err.message}finally{busy=false;$('#submit').disabled=false}};
