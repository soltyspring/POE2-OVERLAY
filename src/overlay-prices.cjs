const normalize=value=>(value||'').replace(/\s/g,'');
function prepareBatch(rows,catalog){
  const items=[],refs=new Map(),seen=new Map();
  const add=(name,kind,baseType,id)=>{
    const signature=JSON.stringify([name,kind,baseType,id]);
    if(seen.has(signature))return seen.get(signature);
    if(items.length>=500)return null;
    const key=String(items.length);seen.set(signature,key);
    items.push({key,name,kind,...(baseType?{baseType}:{}),...(id?{id}:{})});return key;
  };
  for(const row of rows){
    const keys=[];
    if(row.kind==='commodity'){
      const entry=catalog.find(e=>e.kind==='commodity'&&normalize(e.name)===normalize(row.name));
      keys.push(add(row.name,/tablet/i.test(entry?.category||'')?'tablet':'currency',null,entry?.category&&entry.id?`exchange:${entry.category}:${entry.id}`:null));
    }else if(['unique','candidate','named-gear'].includes(row.kind)){
      const name=row.uniqueName||(['unique','named-gear'].includes(row.kind)?row.name.split(' · ')[0]:null);
      if(name)keys.push(add(name,'unique',row.type));
      for(const entry of catalog.filter(e=>e.kind==='unique'&&normalize(e.type)===normalize(row.type)))keys.push(add(entry.name,'unique',row.type));
    }
    refs.set(row.key,[...new Set(keys.filter(k=>k!==null))]);
  }
  return {items,refs};
}
function applyBatch(rows,batch,payload,now=Date.now()){
  if(!payload||!payload.items||!payload.rates)throw new Error('일괄 시세 서버 응답 구조를 확인하세요.');
  const prices=new Map(),rate=payload.rates;
  if(rate.state==='ready'&&Number.isFinite(rate.exaltedPerDivine)&&rate.exaltedPerDivine>0&&now/1000-rate.observedAt<=1800&&now/1000-rate.observedAt>=-60)prices.set('divine',rate.exaltedPerDivine);
  for(const row of rows){
    row.unitEx=null;row.totalEx=null;delete row.totalExMax;
    const candidates=(batch.refs.get(row.key)||[]).map(key=>payload.items[key]).filter(q=>q?.state==='ready'&&Number.isFinite(q.priceExalted)&&q.priceExalted>0&&Number.isFinite(q.observedAt)&&now/1000-q.observedAt<=1800&&now/1000-q.observedAt>=-60&&prices.has('divine'));
    const fullName=row.uniqueName||(['unique','named-gear'].includes(row.kind)?row.name.split(' · ')[0]:row.name);
    const exact=candidates.filter(q=>normalize(q.name)===normalize(fullName));
    const matches=exact.length?exact:candidates;
    if(!matches.length){row.status=payload.state==='collecting'?'서버 시세 수집 중':rate.state==='stale'?'서버 환율 갱신 필요 · 오래된 시세 제외':'서버에 최신 비교 시세 없음 · 옵션 복사 후 조회';continue;}
    row.unitEx=Math.min(...matches.map(q=>q.priceExalted));row.totalEx=row.unitEx*row.count;
    row.totalExMax=Math.max(...matches.map(q=>q.priceExalted))*row.count;
    row.priceKind=row.kind==='commodity'?'consumable-reference':exact.length?'unique-reference':'candidate-reference';
    row.status=row.kind==='commodity'?'참고 시세':exact.length?'이름 일치 · 서버 참고 시세 · 옵션 미반영':`${row.type} 고유 후보 참고 범위 · 희귀 옵션 미반영`;
  }
  const siteItems=batch.items.flatMap(item=>{const q=payload.items[item.key];return q?.id||item.id?[{id:q?.id||item.id,name:item.name,type:item.baseType||null}]:[];});
  return {prices,siteItems,warnings:prices.has('divine')?[]:['서버 환율이 없거나 오래되어 가격 표시를 보류했습니다.'],updatedAt:Number.isFinite(rate.observedAt)?new Date(rate.observedAt*1000).toISOString():null,priceSource:'POE2-Exchange 일괄 API'};
}
module.exports={prepareBatch,applyBatch};
