// Keep legacy editing/restock and owner maintenance; route discovery to the full page.
const previousPoolOpen=openIntake;
openIntake=function(id,manual=false){if(id||manual)return previousPoolOpen(id,manual);location.href='/pools'};
const maintainLibrary=libraryPanel;
libraryPanel=function(){location.href='/pools'};
libraryButton.textContent='卡池中心';libraryButton.onclick=libraryPanel;
const poolAction=new URLSearchParams(location.search).get('poolAction');
if(poolAction){history.replaceState(null,'',location.pathname);accountRequest('account').then(a=>{if(poolAction==='admin'&&a.role==='owner')maintainLibrary();else if(poolAction==='package')openCardPackage()}).catch(e=>toast(e.message))}
