const {tradeQuery}=require('./core.cjs');

async function searchSale(market,league,item,rates,signal){
  const excluded=item.filters.filter(filter=>/시야 반경|처치한 적 하나당/.test(filter.text||''));
  let selected=item.filters.filter(filter=>!excluded.includes(filter));
  if(!selected.length)selected=item.filters;
  const priority=filter=>/생명력 최대치|저항/.test(filter.text||'')?3:/피해|치명타|속도/.test(filter.text||'')?2:1;
  selected=[...selected].sort((a,b)=>priority(b)-priority(a));
  const adjusted=selected.map(filter=>({...filter,value:{...filter.value,min:filter.value.min>0?Math.max(filter.value.min<1?filter.value.min*.8:1,Math.floor(filter.value.min*.8)):filter.value.min}}));
  const original=tradeQuery({...item,filters:adjusted}),total=selected.length;
  let nameLookup=null;
  if(item.displayName&&item.rarity!=='고유'){
    // Official item-name search accepts dictionary names, not arbitrary rare
    // generated names. Check that dictionary before issuing a rejected request.
    const catalog=typeof market.loadCatalog==='function'?await market.loadCatalog():[];
    const normalize=text=>text.replace(/\s/g,'');
    const known=catalog.some(entry=>entry.kind==='unique'&&normalize(entry.name)===normalize(item.displayName)&&normalize(entry.type||'')===normalize(item.type));
    nameLookup={name:item.displayName,state:known?'no-listings':'not-in-dictionary'};
    if(known){
      const query=structuredClone(original);query.query.name=item.displayName;
      const result=await market.search(league,query,rates,signal);
      if(result.total>0)return {...result,comparison:{required:total,total,relaxed:false},nameLookup:{name:item.displayName,state:'matched'}};
    }
  }
  // Never broaden a server error or missing currency conversion into another search.
  const thresholds=[total,...(total>1?[Math.ceil(total/2),1]:[])].filter((n,i,a)=>a.indexOf(n)===i);
  for(const required of thresholds){
    signal?.throwIfAborted();
    const query=structuredClone(original);
    if(required<total)query.query.stats=[{type:'and',filters:original.query.stats[0].filters.slice(0,required)}];
    const result=await market.search(league,query,rates,signal);
    const comparison={required,total,relaxed:required<total,policy:'priority-and',ratio:.8,excluded:excluded.map(filter=>filter.text),selected:adjusted.slice(0,required).map(filter=>({text:filter.text,min:filter.value.min}))};
    if(result.total>0 || required===thresholds.at(-1))return {...result,comparison,nameLookup};
  }
}
module.exports={searchSale};
