const test=require('node:test'),assert=require('node:assert/strict');
const {scanLines}=require('../src/core.cjs');
test('실제 파란 라벨의 단일 글자 오독과 끝 역슬래시를 DB 기준으로 복구한다',()=>{
  const catalog=[{name:'검은불 석궁',type:'검은불 석궁',kind:'base'},{name:'험한 눈빛의 문양 방패',type:'험한 눈빛의 문양 방패',kind:'base'}];
  const rows=scanLines([{text:'검은불식궁',x:10,y:10},{text:'험한 눈빛의 문양 방패 \\',x:10,y:100}],catalog,new Map());
  assert.deepEqual(rows.map(r=>r.name),['검은불 석궁','험한 눈빛의 문양 방패']);
});
test('한 글자 차이의 후보가 여러 개거나 이름이 짧으면 추측하지 않는다',()=>{
  const catalog=['검은불 석궁','검은불 설궁','루비 반지'].map(name=>({name,type:name,kind:'base'}));
  assert.equal(scanLines([{text:'검은불식궁',x:0,y:0},{text:'루비반저',x:0,y:100}],catalog,new Map()).length,0);
});
