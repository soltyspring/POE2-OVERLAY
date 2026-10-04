const test = require('node:test');
const assert = require('node:assert/strict');
const {scanLines,tradeQuery} = require('../src/core.cjs');
test('스크린샷의 레벨 20 스킬과 레벨 미표시 보조를 구분한다',()=>{
  const catalog=[{id:'a',name:'베리시움 현신',type:'베리시움 현신',kind:'gem'},{id:'b',name:'정제의 불길',type:'정제의 불길',kind:'gem'}];
  const rows=scanLines([{text:'스킬 레벨 20: 베리시움 현신',x:410,y:101},{text:'스킬: 베리시움 현신',x:490,y:605},{text:'보조: 정제의 불길',x:512,y:479}],catalog,new Map());
  assert.equal(rows.length,3);
  const known=rows.find(r=>r.level===20),unknown=rows.find(r=>r.level===null);
  const q=tradeQuery(known); assert.deepEqual(q.query.filters.misc_filters.filters.gem_level,{min:20,max:20});
  assert.equal(q.query.filters.type_filters.filters.category.option,'gem');
  assert.throws(()=>tradeQuery(unknown));
});
test('마석학 유동체 레벨 19를 레벨 20 가격으로 대체하지 않는다',()=>{
  const catalog=[{id:'flux19',name:'마석학 유동체 (19레벨)',kind:'commodity'},{id:'flux20',name:'마석학 유동체 (20레벨)',kind:'commodity'}];
  const [row]=scanLines([{text:'1)( 마석학 유동체 (19레벨)',x:423,y:37}],catalog,new Map([['flux20',100]]));
  assert.equal(row.name,'마석학 유동체 (19레벨)'); assert.equal(row.count,1); assert.equal(row.totalEx,null);
});
