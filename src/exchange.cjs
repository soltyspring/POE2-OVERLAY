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
  return {prices,catalog,warnings,updatedAt:new Date(oldest * 1000).toISOString(),priceSource:'POE2-Exchange DB'};
}
module.exports = { serverUrl, parseExchange };
