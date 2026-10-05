const test=require('node:test'),assert=require('node:assert/strict');
const {prepareLabel,sheet,mapLines}=require('../src/label-pipeline.cjs');
const {evaluate}=require('../src/ocr-evaluation.cjs');
test('밝은 배경 검정 글자는 보존하고 영역 밖 및 경계를 넘는 OCR 줄은 제외한다',()=>{
  const size={width:100,height:40},pixels=Buffer.alloc(100*40*4,220);pixels.fill(0,2000,2004);
  const label=prepareLabel(pixels,size,{x:0,y:0,width:100,height:40,id:3});assert.equal(label.mode,'original');
  const packed=sheet([label]);
  const rows=mapLines([{text:'오브',x:16,y:16,width:40,height:20},{text:'잘못된 결합',x:16,y:40,width:40,height:40}],packed.placements);
  assert.equal(rows.length,1);assert.equal(rows[0].regionId,3);assert.equal(rows[0].x,0);
});
test('같은 아이템 여러 개도 위치·수량별로 따로 평가하며 중복은 오탐으로 센다',()=>{
  const expected=[{name:'오브',count:2,box:[0,0,.2,.2]},{name:'오브',count:1,box:[.5,.5,.2,.2]}];
  const actual=[{name:'오브',count:2,x:5,y:5},{name:'오브',count:2,x:5,y:5},{name:'오브',count:2,x:55,y:55}];
  const score=evaluate(expected,actual,{width:100,height:100});assert.equal(score.correct,1);assert.equal(score.missing,1);assert.equal(score.falsePositive,2);
});
