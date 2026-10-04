const test=require('node:test');const assert=require('node:assert/strict');
const {encodeBitmap}=require('../src/ocr-bitmap.cjs');
test('라벨 전처리는 파랑 노랑 흰 글자를 검정으로 배경을 흰색으로 변환한다',()=>{
  const {isolateLabels}=require('../src/ocr-bitmap.cjs');
  const pixels=Buffer.from([220,110,80,255,30,190,220,255,200,200,200,255,30,60,90,255]);
  const result=isolateLabels(pixels);
  assert.deepEqual([...result],[0,0,0,255,0,0,0,255,0,0,0,255,255,255,255,255]);
  assert.equal(pixels[0],220);
});
test('OCR BMP preserves BGRA pixels and top-down dimensions without compression',()=>{
  const pixels=Buffer.from([1,2,3,255,4,5,6,255]);const bmp=encodeBitmap(pixels,{width:1,height:2});
  assert.equal(bmp.toString('ascii',0,2),'BM');assert.equal(bmp.readUInt32LE(2),62);
  assert.equal(bmp.readInt32LE(22),-2);assert.equal(bmp.readUInt16LE(28),32);
  assert.deepEqual(bmp.subarray(54),pixels);
  assert.throws(()=>encodeBitmap(pixels,{width:2,height:2}));
});
