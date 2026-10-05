const test=require('node:test'),assert=require('node:assert/strict');
const {parseFilter}=require('../src/filter-profile.cjs');
const {isolateLabels}=require('../src/ocr-bitmap.cjs');
test('필터 팔레트는 주석·잘못된 색상·투명 글자를 제외하고 중복을 제거한다',()=>{
  assert.deepEqual(parseFilter('# SetTextColor 255 0 0\nShow\n SetTextColor 216 168 255 # purple\nSetTextColor 216 168 255 255\nSetTextColor 256 0 0\nSetTextColor 0 0 0 0'),[[216,168,255]]);
});
test('균일한 밝은 배경의 검정 글자는 보존하되 어두운 배경은 글자로 만들지 않는다',()=>{
  const size={width:25,height:25},pixels=Buffer.alloc(25*25*4);
  for(let i=0;i<pixels.length;i+=4){pixels[i]=80;pixels[i+1]=144;pixels[i+2]=233;pixels[i+3]=255;}
  const center=(12*25+12)*4;pixels.fill(0,center,center+3);
  assert.equal(isolateLabels(pixels,size)[center],0);
  pixels.fill(0);assert.equal(isolateLabels(pixels,size)[center],255);
});
test('사용자 필터의 보라 글자를 어두운 배경에서 추가 인식한다',()=>{
  const size={width:25,height:25},pixels=Buffer.alloc(25*25*4);
  const center=(12*25+12)*4;pixels.set([255,168,216,255],center);
  assert.equal(isolateLabels(pixels,size)[center],255);
  assert.equal(isolateLabels(pixels,size,[[216,168,255]])[center],0);
});
