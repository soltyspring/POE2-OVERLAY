const normalize = value => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

function quantity(text) {
  const m = text.match(/^\s*(\d+)\s*[x×]\s*(.+)$/i) || text.match(/^\s*(.+?)\s*[x×]\s*(\d+)\s*$/i);
  if (!m) return { name: text.trim(), count: 1, explicit: false };
  const leading = /^\d+$/.test(m[1]);
  const count = Number(leading ? m[1] : m[2]);
  return { name: leading ? m[2] : m[1], count, explicit: true };
}

function scanLines(lines, catalog, prices) {
  const rows = [];
  const seen = new Set();
  for (const line of lines) {
    const q = quantity(line.text);
    if (!Number.isSafeInteger(q.count) || q.count < 1) continue;
    const matches = catalog.filter(item => normalize(item.name) === normalize(q.name));
    if (!matches.length) continue;
    const key = `${normalize(q.name)}:${Math.round(line.x)}:${Math.round(line.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = matches.length === 1 ? matches[0] : null;
    const unit = item?.kind === 'commodity' ? prices.get(item.id) : undefined;
    rows.push({ key, name: q.name, count: q.count, x: line.x, y: line.y,
      kind: item?.kind || 'candidate', type: item?.type, uniqueName: item?.uniqueName, candidates: matches.map(m => m.uniqueName || m.name),
      unitEx: Number.isFinite(unit) && unit > 0 ? unit : null,
      totalEx: Number.isFinite(unit) && unit > 0 ? unit * q.count : null,
      status: item?.kind === 'commodity' ? (unit > 0 ? '참고 시세' : '시세 없음') : '고유 종류·옵션 확인 필요' });
  }
  return rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
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
  if (item.unidentified && item.rarity !== '고유') throw new Error('미확인 장비는 옵션 검색할 수 없습니다.');
  if (item.rarity !== '고유' && !item.filters.length) throw new Error('확인된 옵션이 없습니다. 베이스만으로 희귀 장비 가격을 평가하지 않습니다.');
  return { query: { status: { option: 'online' }, ...(item.name ? { name: item.name } : {}), type: item.type,
    stats: [{ type: 'and', filters: item.filters.map(({ text, ...filter }) => filter) }],
    filters: { type_filters: { filters: { rarity: { option: ({ '고유': 'unique', '희귀': 'rare', '마법': 'magic', '일반': 'normal' })[item.rarity] || 'any' } } } } }, sort: { price: 'asc' } };
}
module.exports = { normalize, quantity, scanLines, parseNinja, parseItem, tradeQuery };
