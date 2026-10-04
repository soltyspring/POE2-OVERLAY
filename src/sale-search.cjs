const {tradeQuery}=require('./core.cjs');

async function searchSale(market,league,item,rates){
  const original=tradeQuery(item),total=item.filters.length;
  // Never broaden a server error or missing currency conversion into another search.
  const thresholds=[total,...(total>1?[Math.ceil(total/2),1]:[])].filter((n,i,a)=>a.indexOf(n)===i);
  for(const required of thresholds){
    const query=structuredClone(original);
    if(required<total)query.query.stats=[{type:'count',value:{min:required},filters:original.query.stats[0].filters}];
    const result=await market.search(league,query,rates);
    const comparison={required,total,relaxed:required<total};
    if(result.total>0 || required===thresholds.at(-1))return {...result,comparison};
  }
}
module.exports={searchSale};
