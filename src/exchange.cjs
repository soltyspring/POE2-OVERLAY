function serverUrl(value) {
  if (!value) return null;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('시세 서버 주소는 인증 정보·쿼리가 없는 HTTP/HTTPS 주소여야 합니다.');
  return url.href.replace(/\/$/, '');
}
function parseExchange(payload, league, now = Date.now()) {
  if (!Array.isArray(payload.markets)) throw new Error('POE2-Exchange 응답 구조를 확인하세요.');
  const valid = payload.markets.filter(row => row.league === league && row.id?.startsWith('exchange:') &&
    typeof row.name === 'string' && Number.isFinite(row.price_divine) && row.price_divine > 0 &&
    Number.isFinite(row.observed_at) && now / 1000 - row.observed_at >= -60 && now / 1000 - row.observed_at <= 1800);
  const reference = valid.find(row => row.id === 'exchange:Currency:exalted');
  if (!reference) throw new Error('서버의 해당 리그 엑잘 환율이 없거나 30분 이상 오래됐습니다.');
  const prices = new Map(), catalog = [];
  for (const row of valid) {
    const [, category, ...idParts] = row.id.split(':');
    const id = idParts.join(':');
    const price = row.price_divine / reference.price_divine;
    if (!id || !Number.isFinite(price) || price <= 0) continue;
    prices.set(id, price);
    catalog.push({ id, name:row.name, category, kind:'commodity' });
  }
  prices.set('exalted',1);
  if (!prices.has('divine')) prices.set('divine',1/reference.price_divine);
  // All server values share a league reference unit; derive the conversion
  // from the exalted row rather than trusting a rounded display rate.
  const warnings = [];
  const excluded = payload.markets.filter(row => row.league === league && row.id?.startsWith('exchange:')).length - valid.length;
  if (excluded) warnings.push(`서버 시세 ${excluded}개: 오래되었거나 유효하지 않아 제외`);
  const oldest = Math.min(...valid.map(row => row.observed_at));
  const siteItems=payload.markets.filter(row=>row.league===league&&typeof row.id==='string'&&typeof row.name==='string').map(row=>({id:row.id,name:row.name,type:row.base_type||null}));
  const quotes=payload.markets.filter(row=>row.league===league&&typeof row.name==='string'&&Number.isFinite(row.price_divine)&&row.price_divine>0&&Number.isFinite(row.observed_at)&&now/1000-row.observed_at>=-60&&now/1000-row.observed_at<=1800).map(row=>({id:row.id,name:row.name,type:row.base_type||null,unitEx:row.price_divine/reference.price_divine,observedAt:row.observed_at,source:row.source_kind}));
  return {prices,catalog,siteItems,quotes,warnings,updatedAt:new Date(oldest * 1000).toISOString(),priceSource:'POE2-Exchange DB'};
}
function applySnapshotPrices(rows,data){
  const normalize=value=>(value||'').replace(/\s/g,'');
  const quotes=data.quotes||[];
  for(const row of rows){
    if(row.kind==='commodity'||row.kind==='unpriced')continue;
    const fullName=row.uniqueName||(['unique','named-gear'].includes(row.kind)?row.name.split(' · ')[0]:null);
    let matches=fullName?quotes.filter(q=>normalize(q.name)===normalize(fullName)&&normalize(q.type)===normalize(row.type)):[];
    const namedMatch=matches.length>0;
    if(!matches.length&&['candidate','named-gear','unique'].includes(row.kind))matches=quotes.filter(q=>q.type&&normalize(q.type)===normalize(row.type)&&q.source==='stash');
    if(!matches.length){row.status='서버에 최신 비교 시세 없음 · 옵션 복사 후 조회';continue;}
    row.unitEx=Math.min(...matches.map(q=>q.unitEx));row.totalEx=row.unitEx*row.count;
    row.totalExMax=Math.max(...matches.map(q=>q.unitEx))*row.count;
    row.priceKind=namedMatch?'unique-reference':'candidate-reference';
    row.status=namedMatch?'이름 일치 · 서버 참고 시세 · 옵션 미반영':`${fullName?'이름 시세 없음 · ':''}${row.type} 고유 후보 참고 범위 · 희귀 옵션 미반영`;
  }
  return rows;
}
function siteItemUrl(row,data,base,league){
  if(!base)return null;
  const normalize=value=>value.replace(/\s/g,'');
  const name=row.uniqueName||row.name.split(' · ')[0];
  const matches=(data.siteItems||[]).filter(item=>normalize(item.name)===normalize(name)&&(!row.uniqueName||!row.type||normalize(item.type||'')===normalize(row.type)));
  if(matches.length!==1)return null;
  const url=new URL(base);url.search=new URLSearchParams({league,item:matches[0].id}).toString();return url.href;
}
module.exports = { serverUrl, parseExchange, siteItemUrl,applySnapshotPrices };
