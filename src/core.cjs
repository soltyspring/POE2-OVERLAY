const normalize = value => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const catalogIndexes = new WeakMap();
function catalogIndex(catalog) {
  if (catalogIndexes.has(catalog)) return catalogIndexes.get(catalog);
  const index = new Map();
  for (const item of catalog) {
    const name=normalize(item.name);
    if (!index.has(name)) index.set(name,[]);
    index.get(name).push(item);
  }
  catalogIndexes.set(catalog,index);
  return index;
}

function quantity(text) {
  // Windows OCR reads this reward menu's 1x as lx or 1)(.
  // Only repair a leading quantity marker; item names remain exact matches.
  const repaired = text.match(/^\s*(\d+|[lI])\s*(?:[x×]|\)\s*\()\s*(.+)$/i);
  if (repaired) return { name: repaired[2].trim(), count: /^\d+$/.test(repaired[1]) ? Number(repaired[1]) : 1, explicit: true };
  const m = text.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i) || text.match(/^\s*(.+?)\s*[x×]\s*(\d+)\s*$/i);
  if (!m) return { name: text.trim(), count: 1, explicit: false };
  const leading = /^\d+$/.test(m[1]);
  const count = Number(leading ? m[1] : m[2]);
  return { name: leading ? m[2] : m[1], count, explicit: true };
}

function scanLines(lines, catalog, prices) {
  const rows = [];
  const seen = new Set();
  const index = catalogIndex(catalog);
  for (const line of lines) {
    const q = quantity(line.text);
    const gem = q.name.match(/^(스킬|보조)(?:\s*레벨\s*(\d+))?\s*:\s*(.+)$/);
    const lookupName = gem ? gem[3].trim() : q.name;
    if (!Number.isSafeInteger(q.count) || q.count < 1) continue;
    const matches = (index.get(normalize(lookupName)) || []).filter(item => gem ? item.kind === 'gem' : item.kind !== 'gem');
    if (!matches.length) continue;
    const key = `${normalize(q.name)}:${Math.round(line.x)}:${Math.round(line.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = matches.length === 1 ? matches[0] : null;
    const candidateType = matches.every(m => m.kind === 'candidate' && m.type && m.type === matches[0].type) ? matches[0].type : undefined;
    const unit = item?.kind === 'commodity' ? prices.get(item.id) : undefined;
    rows.push({ key, name: q.name, count: q.count, x: line.x, y: line.y,
      kind: item?.kind || 'candidate', type: item?.type || candidateType, tier:item?.tier, level: gem?.[2] ? Number(gem[2]) : null, uniqueName: item?.uniqueName, candidates: matches.map(m => m.uniqueName || m.name),
      unitEx: Number.isFinite(unit) && unit > 0 ? unit : null,
      totalEx: Number.isFinite(unit) && unit > 0 ? unit * q.count : null,
      status: item?.kind === 'commodity' ? (unit > 0 ? '참고 시세' : '시세 없음') : item?.kind==='waystone'?'동일 등급 경로석 조회 대기':item?.kind === 'gem' ? (gem?.[2] ? '동일 레벨 젬 조회 대기' : '젬 레벨 확인 필요') : item?.kind === 'unpriced' ? '보상 수량·거래 종류 확인 필요' : '고유 종류·옵션 확인 필요' });
  }
  return rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
}

function applyGearPrices(row, result) {
  row.url = result.url;
  const prices = result.prices.filter(price => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  if (!prices.length) { row.status = '환산 가능한 비교 매물 없음'; return row; }
  const candidate = row.kind === 'candidate';
  row.unitEx = prices[0];
  row.totalEx = row.unitEx * row.count;
  row.priceKind = candidate ? 'candidate-minimum' : row.kind === 'waystone'?'waystone-minimum':row.kind === 'gem' ? 'gem-minimum' : 'unique-minimum';
  row.status = candidate
    ? `같은 베이스의 고유 후보 · 조회 ${prices.length}매물 최저 · 종류·옵션 미확정`
    :row.kind==='waystone'?`${row.tier}등급 경로석 · 조회 ${prices.length}매물 최저 · 희귀도·옵션 미반영`: row.kind === 'gem' ? `레벨 ${row.level} 동일 젬 · 조회 ${prices.length}매물 최저 · 품질 미반영` : `이름 기준 조회 ${prices.length}매물 최저 · 옵션 미반영`;
  if (result.skippedCurrencies?.length) row.status += ' · 환율 없는 매물 제외';
  return row;
}

function parseNinja(data) {
  if (!Array.isArray(data.items) || !Array.isArray(data.lines) || !data.core?.primary) throw new Error('poe.ninja 응답 구조가 변경되었습니다.');
  const multiplier = data.core.primary === 'exalted' ? 1 : data.core.rates?.exalted;
  if (!Number.isFinite(multiplier) || multiplier <= 0) throw new Error('엑잘 환율을 확인할 수 없습니다.');
  const prices = new Map();
  for (const line of data.lines) {
    if (Number.isFinite(line.primaryValue) && line.primaryValue > 0) prices.set(line.id, line.primaryValue * multiplier);
  }
  prices.set('exalted', 1);
  prices.set(data.core.primary, multiplier);
  for (const [id, rate] of Object.entries(data.core.rates || {})) {
    if (Number.isFinite(rate) && rate > 0) prices.set(id, multiplier / rate);
  }
  return prices;
}

function parseItem(text, statEntries) {
  const sections = text.replace(/\r/g, '').trim().split(/\n-{4,}\n/);
  const header = sections[0].split('\n');
  const index = header.findIndex(line => /^아이템 희귀도:/.test(line));
  if (index < 0 || !header[index + 1]) throw new Error('게임에서 Ctrl+C로 복사한 한국어 아이템 정보가 필요합니다.');
  const rarity = header[index].split(':')[1].trim();
  const names = header.slice(index + 1).filter(Boolean);
  const unidentified = sections.some(section => section.split('\n').includes('미확인'));
  const filters = [], unmatched = [];
  if (!unidentified) for (const section of sections.slice(1)) for (const raw of section.split('\n')) {
    const marker = raw.match(/\s*\((implicit|enchant|fractured|crafted|rune|desecrated|명시|암시|인챈트)\)\s*$/);
    const group = ({ '명시': 'explicit', '암시': 'implicit', '인챈트': 'enchant' })[marker?.[1]] || marker?.[1] || 'explicit';
    const line = marker ? raw.slice(0, marker.index).trim() : raw.trim();
    if (!line || line.includes(':') || !/[\d]/.test(line)) continue;
    const template = line.replace(/[+-]?\d+(?:\.\d+)?/g, '#');
    const matches = statEntries.filter(stat => stat.id.startsWith(group + '.') && normalize(stat.text.replace(/\+#/g, '#')) === normalize(template));
    const values = (line.match(/[+-]?\d+(?:\.\d+)?/g) || []).map(Number);
    if (matches.length === 1 && values.length === 1) {
      filters.push({ id: matches[0].id, value: { min: values[0], max: values[0] }, disabled: false, text: raw });
    } else unmatched.push(raw);
  }
  return { rarity, name: rarity === '고유' ? names[0] : null, type: names.at(-1), unidentified, filters, unmatched };
}

function tradeQuery(item) {
  if(item.kind==='waystone'){
    if(!Number.isInteger(item.tier)||item.tier<1||item.tier>16)throw new Error('경로석 등급 확인이 필요합니다.');
    return {query:{status:{option:'online'},type:item.type,stats:[{type:'and',filters:[]}],filters:{map_filters:{filters:{map_tier:{min:item.tier,max:item.tier}}}}},sort:{price:'asc'}};
  }
  if (item.kind === 'gem') {
    if (!Number.isInteger(item.level) || item.level < 1 || item.level > 40) throw new Error('젬 레벨 확인이 필요합니다.');
    return { query: { status: { option: 'online' }, type: item.type, stats: [{type:'and',filters:[]}], filters: {
      type_filters: {filters:{category:{option:'gem'}}},
      misc_filters: {filters:{gem_level:{min:item.level,max:item.level}}}
    } }, sort:{price:'asc'} };
  }
  if (item.unidentified && item.rarity !== '고유') throw new Error('미확인 장비는 옵션 검색할 수 없습니다.');
  if (item.rarity !== '고유' && !item.filters.length) throw new Error('확인된 옵션이 없습니다. 베이스만으로 희귀 장비 가격을 평가하지 않습니다.');
  return { query: { status: { option: 'online' }, ...(item.name ? { name: item.name } : {}), type: item.type,
    stats: [{ type: 'and', filters: item.filters.map(({ text, ...filter }) => filter) }],
    filters: { type_filters: { filters: { rarity: { option: ({ '고유': 'unique', '희귀': 'rare', '마법': 'magic', '일반': 'normal' })[item.rarity] || 'any' } } } } }, sort: { price: 'asc' } };
}
module.exports = { normalize, quantity, scanLines, parseNinja, parseItem, tradeQuery, applyGearPrices };
