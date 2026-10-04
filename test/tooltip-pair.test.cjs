const test=require('node:test');
const assert=require('node:assert/strict');
const {scanLines,tradeQuery}=require('../src/core.cjs');
const catalog=[{id:'unique',name:'키메라의 선회',uniqueName:'키메라의 선회',type:'루비 반지',kind:'unique'},{id:'base',name:'루비 반지',uniqueName:'키메라의 선회',type:'루비 반지',kind:'candidate'}];
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
