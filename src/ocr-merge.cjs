const {scanLines}=require('./core.cjs');
// Only add dictionary-confirmed currencies from the original image. Never
// combine an unverified rare name with a nearby, unrelated base.
function mergeCurrencies(primary,secondary,catalog,kinds=['commodity']){
  const rows=scanLines(secondary,catalog,new Map()).filter(row=>kinds.includes(row.kind));
  const result=[...primary];
  for(const row of rows){
    const line=secondary.find(line=>line.x===row.x&&line.y===row.y);
    if(!line)continue;
    const at=result.findIndex(existing=>Math.abs(existing.x-line.x)<25&&Math.abs(existing.y-line.y)<14);
    if(at>=0){
      const existing=scanLines([result[at]],catalog,new Map())[0];
      if(!existing||existing.name.replace(/\s/g,'')===row.name.replace(/\s/g,''))result[at]=line;
    }else result.push(line);
  }
  return result;
}
module.exports={mergeCurrencies};
