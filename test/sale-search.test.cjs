const test=require('node:test');
const assert=require('node:assert/strict');
const {searchSale}=require('../src/sale-search.cjs');
const item={rarity:'희귀',type:'균열 반지',filters:[125,12.5,18,37].map((min,i)=>({id:`explicit.${i}`,value:{min},disabled:false}))};
test('매물 0개면 전체 → 절반 → 하나 이상 일치로 완화하고 베이스와 희귀도를 유지한다',async()=>{
  const queries=[];
  const market={search:async(league,query)=>{queries.push(query);return {total:queries.length===3?9:0,prices:queries.length===3?[2]:[],url:'test'};}};
  const result=await searchSale(market,'test',item,new Map());
  assert.equal(queries.length,3);
  assert.deepEqual(queries.map(q=>q.query.stats[0].type),['and','count','count']);
  assert.deepEqual(queries.slice(1).map(q=>q.query.stats[0].value.min),[2,1]);
  for(const q of queries){assert.equal(q.query.type,'균열 반지');assert.equal(q.query.filters.type_filters.filters.rarity.option,'rare');assert.equal(q.query.stats[0].filters.length,4);}
  assert.deepEqual(result.comparison,{required:1,total:4,relaxed:true});
});
test('매물이 있거나 환산 가격만 없으면 추가 요청하지 않는다',async()=>{
  let calls=0;
  const result=await searchSale({search:async()=>{calls++;return {total:8,prices:[],skippedCurrencies:['unknown']};}},'test',item,new Map());
  assert.equal(calls,1);assert.equal(result.comparison.relaxed,false);
});
test('서버 오류는 전달하고 단일 옵션 0매물은 재조회하지 않는다',async()=>{
  let calls=0;
  await assert.rejects(searchSale({search:async()=>{calls++;throw new Error('HTTP 429');}},'test',item,new Map()),/HTTP 429/);
  assert.equal(calls,1);
  calls=0;await searchSale({search:async()=>{calls++;return {total:0,prices:[]};}},'test',{...item,filters:item.filters.slice(0,1)},new Map());assert.equal(calls,1);
});
