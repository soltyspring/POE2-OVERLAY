const test=require('node:test'),assert=require('node:assert/strict');
const {mergeCurrencies}=require('../src/ocr-merge.cjs');
test('원본에서 누락 화폐와 수량을 보완하고 가까운 중복은 추가하지 않는다',()=>{
  const catalog=[{name:'진화의 오브',kind:'commodity',id:'transmutation'}];
  const primary=[{text:'진화의 오브',x:10,y:10}];
  const secondary=[{text:'진화의 오브',x:12,y:11},{text:'20x 진화의 오브',x:12,y:50},{text:'가짜 장비',x:12,y:90}];
  const merged=mergeCurrencies(primary,secondary,catalog);
  assert.equal(merged.length,2);assert.equal(merged[1].text,'20x 진화의 오브');
});
