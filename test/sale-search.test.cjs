const test=require('node:test');
const assert=require('node:assert/strict');
const {searchSale}=require('../src/sale-search.cjs');
const item={rarity:'희귀',type:'균열 반지',filters:[125,12.5,18,37].map((min,i)=>({id:`explicit.${i}`,value:{min},disabled:false}))};
test('매물 0개면 우선순위 옵션을 줄이되 남긴 조건은 모두 만족해야 한다',async()=>{
  const queries=[];
  const market={search:async(league,query)=>{queries.push(query);return {total:queries.length===3?9:0,prices:queries.length===3?[2]:[],url:'test'};}};
  const result=await searchSale(market,'test',item,new Map());
  assert.equal(queries.length,3);
  assert.deepEqual(queries.map(q=>q.query.stats[0].type),['and','and','and']);
  assert.deepEqual(queries.map(q=>q.query.stats[0].filters.length),[4,2,1]);
  for(const q of queries){assert.equal(q.query.type,'균열 반지');assert.equal(q.query.filters.type_filters.filters.rarity.option,'rare');}
  assert.equal(result.comparison.required,1);assert.equal(result.comparison.policy,'priority-and');
});
test('생명력·저항을 유지하고 보조 옵션은 제외하며 비교 수치를 완화한다',async()=>{
  let query;
  const filters=[['생명력 최대치 +81',81],['화염 저항 +20%',20],['시야 반경 10% 증가',10],['처치한 적 하나당 생명력 12 획득',12]].map(([text,min],i)=>({text,id:`explicit.${i}`,value:{min},disabled:false}));
  const result=await searchSale({search:async(league,q)=>{query=q;return {total:2,prices:[10]};}},'test',{...item,filters},new Map());
  assert.equal(query.query.stats[0].filters.length,2);assert.deepEqual(query.query.stats[0].filters.map(f=>f.value.min),[64,16]);assert.equal(result.comparison.excluded.length,2);
});
test('매물이 있거나 환산 가격만 없으면 추가 요청하지 않는다',async()=>{
  let calls=0;
  const result=await searchSale({search:async()=>{calls++;return {total:8,prices:[],skippedCurrencies:['unknown']};}},'test',item,new Map());
  assert.equal(calls,1);assert.equal(result.comparison.relaxed,false);
});
test('희귀 전체 이름을 DB에서 먼저 확인하고 없으면 이름 없이 옵션 검색한다',async()=>{
  let sent;
  const result=await searchSale({loadCatalog:async()=>[],search:async(league,query)=>{sent=query;return {total:106,prices:[1,5]};}},'test',{...item,displayName:'가시나무 고리',type:'루비 반지'},new Map());
  assert.equal(sent.query.name,undefined);assert.deepEqual(result.nameLookup,{name:'가시나무 고리',state:'not-in-dictionary'});
});
test('서버 오류는 전달하고 단일 옵션 0매물은 재조회하지 않는다',async()=>{
  let calls=0;
  await assert.rejects(searchSale({search:async()=>{calls++;throw new Error('HTTP 429');}},'test',item,new Map()),/HTTP 429/);
  assert.equal(calls,1);
  calls=0;await searchSale({search:async()=>{calls++;return {total:0,prices:[]};}},'test',{...item,filters:item.filters.slice(0,1)},new Map());assert.equal(calls,1);
});
