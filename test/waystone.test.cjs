const test=require('node:test');
const assert=require('node:assert/strict');
const {scanLines,tradeQuery,applyGearPrices}=require('../src/core.cjs');
const {Market}=require('../src/market.cjs');
test('첨부 툴팁의 경로석 베이스·15등급을 매칭하며 희귀 이름은 가격화하지 않는다',async()=>{
  const market=new Market();market.cached=async key=>key==='items'?{result:[{id:'map',entries:[{type:'경로석 (15등급)'},{type:'경로석 (14등급)'}]}]}:{result:[]};
  const catalog=await market.loadCatalog();
  const rows=scanLines([{text:'얼룩진 궤적',x:355,y:25},{text:'경로석 (15등급)',x:336,y:49}],catalog,new Map());
  assert.equal(rows.length,1);assert.equal(rows[0].tier,15);assert.equal(rows[0].totalEx,null);
  const query=tradeQuery(rows[0]);assert.equal(query.query.type,'경로석 (15등급)');
  assert.deepEqual(query.query.filters.map_filters.filters.map_tier,{min:15,max:15});
  applyGearPrices(rows[0],{prices:[5,8],url:'test'});assert.equal(rows[0].totalEx,5);assert.equal(rows[0].priceKind,'waystone-minimum');assert.match(rows[0].status,/옵션 미반영/);
  assert.equal(scanLines([{text:'경로석',x:0,y:0}],catalog,new Map()).length,0);
});
