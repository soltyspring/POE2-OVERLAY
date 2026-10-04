const test=require('node:test');
const assert=require('node:assert/strict');
const {scanLines,tradeQuery,applyGearPrices}=require('../src/core.cjs');
const catalog=[{id:'unique',name:'키메라의 선회',uniqueName:'키메라의 선회',type:'루비 반지',kind:'unique'},{id:'base',name:'루비 반지',uniqueName:'키메라의 선회',type:'루비 반지',kind:'candidate'}];
test('단독 종류 반지는 추가하지 않고 알려진 고유 이름의 반지 베이스는 연결한다',()=>{
  const dictionary=[...catalog,{id:'generic',name:'반지',type:'반지',kind:'candidate',uniqueName:'칼란드라의 손길'},
    {id:'kalandra',name:'칼란드라의 손길',uniqueName:'칼란드라의 손길',type:'반지',kind:'unique'}];
  const rows=scanLines([{text:'반지',x:2,y:2},{text:'루비 반지',x:100,y:100}],dictionary,new Map());
  assert.equal(rows.length,1);assert.equal(rows[0].name,'루비 반지');
  const unique=scanLines([{text:'칼란드라의 손길',x:30,y:20},{text:'반지',x:35,y:50}],dictionary,new Map());
  assert.equal(unique.length,1);assert.equal(unique[0].name,'칼란드라의 손길 · 반지');
});
test('첨부 고유 툴팁의 두 줄을 한 아이템으로 검색한다',()=>{
  const rows=scanLines([{text:'키메라의 선회',x:54,y:7},{text:'루비 반지',x:77,y:40}],catalog,new Map());
  assert.equal(rows.length,1);assert.equal(rows[0].name,'키메라의 선회 · 루비 반지');assert.equal(rows[0].kind,'unique');
  const query=tradeQuery({...rows[0],name:rows[0].uniqueName,rarity:'고유',filters:[]});
  assert.equal(query.query.name,'키메라의 선회');assert.equal(query.query.type,'루비 반지');
});
test('떨어진 라벨과 불일치 베이스를 합치지 않고 같은 고유 여러 개를 보존한다',()=>{
  assert.equal(scanLines([{text:'키메라의 선회',x:0,y:0},{text:'루비 반지',x:500,y:40}],catalog,new Map()).length,2);
  const rows=scanLines([{text:'루비 반지',x:77,y:40},{text:'키메라의 선회',x:54,y:7},{text:'키메라의 선회',x:500,y:7},{text:'루비 반지',x:523,y:40}],catalog,new Map());
  assert.equal(rows.length,2);assert.ok(rows.every(row=>row.kind==='unique'));
});
test('사전에 없는 이름은 베이스와 결합하지만 고유 후보 가격으로 바꾸지 않는다',()=>{
  const bases=[{id:'a',name:'에메랄드 반지',type:'에메랄드 반지',kind:'candidate',uniqueName:'도둑의 고통'},{id:'b',name:'균열 반지',type:'균열 반지',kind:'base'}];
  const rows=scanLines([{text:'복수의 눈',x:122,y:206},{text:'에메랄드 반지',x:99,y:242},{text:'거대한 유지',x:415,y:205},{text:'균열 반지',x:427,y:242}],bases,new Map());
  assert.equal(rows.length,2);assert.deepEqual(rows.map(row=>row.name),['복수의 눈 · 에메랄드 반지','거대한 유지 · 균열 반지']);
  assert.ok(rows.every(row=>row.kind==='named-gear'&&row.totalEx===null));
  const query=tradeQuery(rows[0]);assert.equal(query.query.type,'에메랄드 반지');assert.equal(query.query.name,undefined);assert.equal(query.query.filters,undefined);
  applyGearPrices(rows[0],{url:'test',prices:[10,2,5]});assert.equal(rows[0].totalEx,2);assert.equal(rows[0].priceKind,'base-minimum');assert.match(rows[0].status,/희귀도·옵션 미반영/);
  assert.equal(scanLines([{text:'복수의 눈',x:500,y:206},{text:'에메랄드 반지',x:99,y:242}],bases,new Map())[0].kind,'candidate');
});
