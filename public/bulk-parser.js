(function(root){
function parseBulk(text){
 text=text.replace(/^\uFEFF/,'');let delimiter=text.includes('\t')?'\t':',',rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&(c===delimiter||c==='\n')){row.push(cell.trim());cell='';if(c==='\n'){rows.push(row);row=[]}}else if(c!=='\r')cell+=c}
 if(quoted)throw Error('CSV 引号未闭合');row.push(cell.trim());rows.push(row);rows=rows.filter(r=>r.some(Boolean));if(!rows.length)throw Error('请先填写入库清单');
 const aliases={'名称':'name','周边名称':'name','数量':'qty','周边类型':'category','类型':'category','分类':'category','系列大类':'series','系列':'series','角色':'ip','角色/IP':'ip','单件成本':'cost','成本':'cost','总成本':'total_cost','入库日期':'date','日期':'date','存放位置':'location','位置':'location','备注':'note'};
 let header=rows[0].map(x=>aliases[x]),hasHeader=header.includes('name')||header.includes('qty');
 if(hasHeader){if(!header.includes('name')||!header.includes('qty'))throw Error('表头需要包含“名称”和“数量”');if(header.some(x=>!x))throw Error('存在无法识别的列名，请使用模板列名');if(new Set(header).size!==header.length)throw Error('表头存在重复列');if(header.includes('cost')&&header.includes('total_cost'))throw Error('单件成本和总成本请选择一种');rows.shift()}
 else header=rows[0].length===2?['name','qty']:['name','category','series','ip','qty','cost','date','location','note'];
 if(!rows.length||rows.length>500)throw Error('每批支持1至500行');return rows.map((r,index)=>{if(r.length>header.length||!hasHeader&&header.length===9&&r.length<7)throw Error(`第 ${index+1} 行列数不正确`);let result={simple:true};header.forEach((key,i)=>result[key]=r[i]||'');if(!result.name||!result.qty)throw Error(`第 ${index+1} 行缺少名称或数量`);if('total_cost'in result)result.cost_mode='total';return result})
}
root.parseBulk=parseBulk;
})(globalThis);
