const indexes=new WeakMap();
const normalize=value=>value.normalize('NFKC').replace(/\s+/g,'').toLowerCase();
function gemIndex(catalog){
 if(indexes.has(catalog))return indexes.get(catalog);
 const exact=new Map(),aliases=new Map();
 for(const item of catalog){
  if(item.kind!=='gem')continue;
  const key=normalize(item.name);
  if(!exact.has(key))exact.set(key,new Set());exact.get(key).add(item.name);
  const match=item.name.match(/^(.*?)\s+(스킬\s*젬|보조\s*젬|젬|룬)$/);
  if(!match)continue;
  const suffix=normalize(match[2]),roles=suffix==='룬'||suffix==='보조젬'?['보조']:suffix==='스킬젬'?['스킬']:['스킬','보조'];
  for(const role of roles){const alias=role+':'+normalize(match[1]);if(!aliases.has(alias))aliases.set(alias,new Set());aliases.get(alias).add(item.name);}
 }
 const result={exact,aliases};indexes.set(catalog,result);return result;
}
function resolveGemName(name,role,catalog){
 const {exact,aliases}=gemIndex(catalog),key=normalize(name);
 const candidates=exact.get(key)||aliases.get(role+':'+key);
 return candidates?.size===1?[...candidates][0]:null;
}
module.exports={resolveGemName};
