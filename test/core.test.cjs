const test = require('node:test');
const assert = require('node:assert/strict');
const { scanLines, parseNinja, parseItem, tradeQuery, applyGearPrices } = require('../src/core.cjs');
test('리그 기준 화폐가 디바인 또는 엑잘이어도 환산한다', () => {
  const data = { items: [], lines: [{id:'alch',primaryValue:0.1}], core:{primary:'divine',rates:{exalted:200,chaos:4}} };
  const rates = parseNinja(data);
  assert.equal(rates.get('alch'),20); assert.equal(rates.get('chaos'),50); assert.equal(rates.get('divine'),200);
  data.core = {primary:'exalted',rates:{divine:0.005}};
  assert.equal(parseNinja(data).get('alch'),0.1); assert.equal(parseNinja(data).get('divine'),200);
  data.core = {primary:'divine',rates:{}}; assert.throws(() => parseNinja(data));
});
test('같은 이름의 다른 위치는 보존하고 겹친 결과만 제거한다', () => {
  const catalog = [{id:'chaos',name:'카오스 오브',kind:'commodity'}];
  const lines = [{text:'카오스 오브',x:1,y:2},{text:'카오스오브',x:1,y:2},{text:'3 x 카오스 오브',x:10,y:20}];
  const rows = scanLines(lines,catalog,new Map([['chaos',2]]));
  assert.equal(rows.length,2); assert.equal(rows[0].totalEx,6); assert.equal(rows[1].totalEx,2);
});
test('고유 베이스 후보를 임의로 확정하거나 희귀 이름을 가격화하지 않는다', () => {
  const catalog = [{id:'a',name:'황금 반지',kind:'candidate',uniqueName:'A'},{id:'b',name:'황금 반지',kind:'candidate',uniqueName:'B'}];
  const rows = scanLines([{text:'황금 반지',x:0,y:0},{text:'희귀 반지',x:1,y:1}],catalog,new Map([['a',100]]));
  assert.equal(rows.length,1); assert.equal(rows[0].totalEx,null); assert.deepEqual(rows[0].candidates,['A','B']);
});
test('한국어 옵션의 단일 수치만 정확히 검색하고 모호한 옵션은 남긴다', () => {
  const item = parseItem('아이템 종류: 반지\n아이템 희귀도: 희귀\n폭풍 고리\n황금 반지\n--------\n아이템 레벨: 80\n--------\n생명력 최대치 +80\n냉기 저항 +35%\n화염 피해 10~20 추가', [{id:'explicit.stat_3299347043',text:'생명력 최대치 #'},{id:'implicit.stat_3299347043',text:'생명력 최대치 #'},{id:'explicit.stat_4220027924',text:'냉기 저항 #%'}]);
  assert.equal(item.filters.length,2); assert.equal(item.filters[0].value.min,80); assert.equal(item.filters[0].value.max,80); assert.equal(item.unmatched.length,1);
  const query = tradeQuery(item); assert.equal(query.query.type,'황금 반지'); assert.equal(query.query.filters.type_filters.filters.rarity.option,'rare');
});
test('암시 옵션 표시는 명시 옵션과 구분한다', () => {
  const item = parseItem('아이템 희귀도: 고유\n고유 이름\n황금 반지\n--------\n냉기 저항 +35% (implicit)', [{id:'explicit.res',text:'냉기 저항 #%'},{id:'implicit.res',text:'냉기 저항 #%'}]);
  assert.equal(item.filters[0].id,'implicit.res');
});
test('미확인 희귀와 옵션 없는 희귀 검색을 차단한다', () => {
  const item = parseItem('아이템 희귀도: 희귀\n폭풍 고리\n황금 반지\n--------\n미확인', []);
  assert.throws(() => tradeQuery(item)); assert.throws(() => tradeQuery({...item,unidentified:false}));
});
test('고유 허리띠 베이스는 종류를 확정하지 않고 고유 전체에서 검색한다', () => {
  const catalog = ['A', 'B'].map(name => ({ id: name, name: '무거운 허리띠', type: '무거운 허리띠', kind: 'candidate', uniqueName: name }));
  const [row] = scanLines([{text:'무거운 허리띠',x:10,y:20}], catalog, new Map());
  assert.equal(row.type, '무거운 허리띠'); assert.equal(row.uniqueName, undefined);
  const query = tradeQuery({type: row.type, rarity:'고유', filters:[]});
  assert.equal(query.query.name, undefined);
  assert.equal(query.query.filters.type_filters.filters.rarity.option, 'unique');
  applyGearPrices(row, {prices:[50, 2, 12, NaN, 0], url:'https://poe.kakaogames.com/trade2/search/Standard/test'});
  assert.equal(row.totalEx,2); assert.equal(row.priceKind,'candidate-minimum');
  assert.deepEqual(row.candidates,['A','B']); assert.match(row.status,/종류·옵션 미확정/);
});
test('시세가 없으면 가격을 만들지 않으며 옵션 없는 확정 고유도 최저가를 사용한다', () => {
  const unknown = {kind:'candidate',unitEx:null,totalEx:null,count:1};
  applyGearPrices(unknown,{prices:[]}); assert.equal(unknown.totalEx,null);
  const known = {kind:'unique',unitEx:null,totalEx:null,count:1};
  applyGearPrices(known,{prices:[50,2,12]}); assert.equal(known.totalEx,2);
  assert.equal(known.priceKind,'unique-minimum'); assert.match(known.status,/옵션 미반영/);
});
