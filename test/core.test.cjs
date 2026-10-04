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
test('한국어 아이템 뒤의 영어 이름은 사전에 일치할 때만 제거한다',()=>{
  const catalog=[{id:'charm',name:'황금 호신부',type:'황금 호신부',kind:'candidate',uniqueName:'통과의례'},
    {id:'waystone',name:'경로석 (15등급)',type:'경로석 (15등급)',kind:'waystone',tier:15}];
  const rows=scanLines([{text:'황금 호신부 (Golden Charm)',x:1,y:1},
    {text:'경로석 (15등급)',x:2,y:2},{text:'알 수 없는 이름 (Golden Charm)',x:3,y:3}],catalog,new Map());
  assert.equal(rows.length,2);
  assert.equal(rows[0].name,'황금 호신부');assert.equal(rows[0].type,'황금 호신부');
  assert.equal(rows[1].tier,15);
  assert.equal(tradeQuery({type:rows[0].type,rarity:'고유',filters:[]}).query.type,'황금 호신부');
});
test('실제 G01den 오독과 빈 사전 항목을 처리한다',()=>{
  const catalog=[{id:'empty',name:'',kind:'candidate'},{id:'charm',name:'황금 호신부',type:'황금 호신부',kind:'base'}];
  const rows=scanLines([{text:'황금 호신부 (G01den Charm)',x:74,y:12},{text:'',x:3,y:4}],catalog,new Map());
  assert.equal(rows.length,1);assert.equal(rows[0].name,'황금 호신부');
});
test('화폐 사전에도 있는 경로석은 등급 검색 항목을 우선한다',()=>{
  const rows=scanLines([{text:'경로석 (15등급)',x:1,y:2}],[
    {id:'static-map',name:'경로석 (15등급)',kind:'commodity'},
    {id:'tier-map',name:'경로석 (15등급)',type:'경로석 (15등급)',kind:'waystone',tier:15}
  ],new Map());
  assert.equal(rows[0].kind,'waystone');assert.equal(rows[0].tier,15);
});
test('첨부 화면의 실제 Windows OCR 잡음과 대엘름 오독을 제한적으로 복구한다',()=>{
  const catalog=[{id:'bow',name:'음산한 석궁',type:'음산한 석궁',kind:'base'},
    {id:'wisdom',name:'감정 주문서',kind:'commodity'},
    {id:'helm',name:'흉악한 대헬름',type:'흉악한 대헬름',kind:'candidate'}];
  const rows=scanLines([{text:'1 는님음산한석궁* 특` ~고',x:370,y:60},
    {text:'감정 주문서 1; ,- ? 가~弋“',x:441,y:94},
    {text:'흉악한 대엘름',x:149,y:316}],catalog,new Map([['wisdom',0.01]]));
  assert.equal(rows.length,3);assert.deepEqual(new Set(rows.map(r=>r.name)),new Set(['음산한 석궁','감정 주문서','흉악한 대헬름']));
  assert.equal(scanLines([{text:'감정 주문서를 구매하세요',x:0,y:0}],catalog,new Map()).length,0);
});
test('전체 화면 장비의 등급 접미사와 한자 잡음을 복구하고 경로석 등급은 유지한다',()=>{
  const catalog=['호전적인 활','수호자 육척봉','엄숙한 대형 망치'].map(name=>({id:name,name,type:name,kind:'base'}));
  const rows=scanLines([{text:'호전적인활寸',x:660,y:369},{text:'수호자 육적봉',x:1359,y:587},
    {text:'엄숙한 대형 망치 (2등급)',x:1152,y:1075}],catalog,new Map());
  assert.deepEqual(rows.map(r=>r.type),['호전적인 활','수호자 육척봉','엄숙한 대형 망치']);
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
  applyGearPrices(row, {prices:[50, 2, 12, NaN, 0], url:'https://www.pathofexile.com/trade2/search/Standard/test'});
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
