const test = require('node:test');
const assert = require('node:assert/strict');
const lines = require('./fixtures/runeshape-ocr.json');
const { scanLines, quantity } = require('../src/core.cjs');
test('첨부 룬 보상 화면의 실제 OCR 6줄을 수량별로 가격화하고 정렬한다', () => {
  const catalog = [
    {id:'greater-regal-orb',name:'상위 제왕의 오브',kind:'commodity'},
    {id:'greater-chaos-orb',name:'상위 카오스 오브',kind:'commodity'},
    {id:'greater-exalted-orb',name:'상위 엑잘티드 오브',kind:'commodity'}
  ];
  // Synthetic rates verify arithmetic, not current market values.
  const rows = scanLines(lines, catalog, new Map([['greater-regal-orb',2],['greater-chaos-orb',4],['greater-exalted-orb',6]]));
  assert.equal(rows.length,6);
  assert.deepEqual(rows.map(row => row.totalEx), [18,12,6,6,4,2]);
  for (const item of catalog) assert.deepEqual(rows.filter(row => row.name === item.name).map(row => row.count).sort(), [1,3]);
});
test('수량 오독 보정이 아이템 이름이나 등급을 변경하지 않는다', () => {
  assert.equal(quantity('lx 상위 카오스 오브').count,1);
  assert.equal(quantity('1)( 상위 엑잘티드 오브').name,'상위 엑잘티드 오브');
  const rows = scanLines([{text:'3x 상위 카오스 오브',x:0,y:0}], [{id:'chaos',name:'카오스 오브',kind:'commodity'}],new Map([['chaos',1]]));
  assert.equal(rows.length,0);
});
