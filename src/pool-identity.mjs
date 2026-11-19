import registry from './pool-registry.mjs';
const aliases={dt:['dt','dewtee'],sk:['sk','seakeen'],fb:['fb','forcebook'],tn:['tn','taynew'],we:['we','williamest'],sn:['sn','skynani'],ca:['ca','chokunaston'],ppw:['ppw','pondphuwin'],ks:['ks','kristsingto'],og:['og','offgun'],em:['em','earthmix'],bp:['bp','bounprem'],jd:['jd','joongdunk'],js:['js','jimmysea'],fkt:['fkt','firstkhaotang','firstkhaotung'],gf:['gf','geminifourth'],ps:['ps','perthsanta'],jm:['jm','juniormark'],jg:['jg','jossgawin'],mo:['mo','markohm'],ab:['ab','aouboom'],sj:['sj','surfjava'],ap:['ap','almondprogress'],lm:['lm','lukemick','luckmick'],op:['op','ohmpoon'],tp:['tp','teshowping'],tm:['tm','thammac'],ws:['ws','winnysatang']};
const normalize=x=>String(x||'').toLowerCase().replace(/[\s._/'’-]/g,'');
export function roleIdentity(value){const key=normalize(value);return Object.keys(aliases).find(id=>aliases[id].includes(key))||key}
export function sameRole(a,b){return roleIdentity(a)===roleIdentity(b)}
export function poolIdentity(id,p){
 const saved=p.identity||registry[id], names=JSON.parse(p.members||'[]');
 return {pool_id:saved?.pool_id||'pool-'+id,cp_id:saved?.cp_id||'cp-'+roleIdentity(p.ip),variants:(names.length?names:['']).map(m=>({id:saved?.variants?.[m]||id+':member:'+encodeURIComponent(m),member_id:'member-'+encodeURIComponent(normalize(m)||'default'),name:m}))};
}

export function roleAliases(value){return aliases[roleIdentity(value)]||[value]}
