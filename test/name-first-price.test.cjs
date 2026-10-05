const test=require('node:test'),assert=require('node:assert/strict');
const {applySnapshotPrices}=require('../src/exchange.cjs');
const data={quotes:[{name:'가시나무 고리',type:'루비 반지',source:'stash',unitEx:30},{name:'다른 고유',type:'루비 반지',source:'stash',unitEx:80}]};
test('두 줄 이름을 먼저 찾아 다른 베이스 후보 시세와 섞지 않는다',()=>{
  const row={kind:'named-gear',name:'가시나무 고리 · 루비 반지',type:'루비 반지',count:1};applySnapshotPrices([row],data);
  assert.equal(row.totalEx,30);assert.equal(row.totalExMax,30);assert.match(row.status,/이름 일치/);
});
test('이름 시세가 없으면 같은 베이스 고유 참고 범위를 명시한다',()=>{
  const row={kind:'named-gear',name:'없는 이름 · 루비 반지',type:'루비 반지',count:1};applySnapshotPrices([row],data);
  assert.equal(row.totalEx,30);assert.equal(row.totalExMax,80);assert.match(row.status,/이름 시세 없음/);assert.match(row.status,/고유 후보/);
});
