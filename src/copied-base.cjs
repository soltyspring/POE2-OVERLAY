const {normalize}=require('./core.cjs');
function resolveCopiedBase(item,catalog){
  if(item.rarity!=='마법')return item;
  const types=[...new Set(catalog.map(entry=>entry.type).filter(Boolean))];
  const text=normalize(item.type);
  const exact=types.find(type=>normalize(type)===text);
  if(exact)return {...item,type:exact};
  const candidates=types.filter(type=>normalize(type).length>=3&&text.includes(normalize(type))).sort((a,b)=>normalize(b).length-normalize(a).length);
  if(!candidates.length||(candidates.length>1&&normalize(candidates[0]).length===normalize(candidates[1]).length))throw new Error('마법 아이템의 베이스를 확정할 수 없습니다. 복사한 이름과 아이템 DB를 확인하세요.');
  return {...item,originalType:item.type,type:candidates[0]};
}
module.exports={resolveCopiedBase};
