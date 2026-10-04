const test=require('node:test');
const assert=require('node:assert/strict');
const {retryRegions,isolateYellow,padBitmap,mergeRetry}=require('../src/ocr-retry.cjs');
const catalog=[{name:'균열 반지',kind:'base'}];
test('Only garbled names above known equipment bases trigger small bounded OCR retries',()=>{
  const lines=[{text:'포 L—',x:55,y:40,width:74,height:24},{text:'균열 반지',x:43,y:76,width:100,height:25}];
  const regions=retryRegions(lines,catalog,{width:512,height:210});
  assert.deepEqual(regions,[{x:31,y:30,width:124,height:81}]);
  assert.equal(retryRegions([{...lines[0],text:'폭풍 눈'},lines[1]],catalog,{width:512,height:210}).length,0);
});
test('Yellow text is isolated without retaining or modifying source pixels',()=>{
  const source=Buffer.from([40,220,240,255,40,70,90,255]);
  assert.deepEqual([...isolateYellow(source)],[0,0,0,255,255,255,255,255]);
  assert.equal(source[0],40);
  const padded=padBitmap(Buffer.from([0,0,0,255]),{width:1,height:1},1);
  assert.equal(padded.width,3);assert.equal(padded.height,3);assert.equal(padded.buffer[16],0);assert.equal(padded.buffer[0],255);
});
test('Improved names map back to original coordinates while readable labels remain intact',()=>{
  const lines=[{text:'포 L—',x:55,y:40},{text:'균열 반지',x:43,y:76}];
  const result=mergeRetry(lines,[{text:'폭풍 눈',x:48,y:20,width:150,height:46},{text:'균열 반지',x:24,y:92}],{x:31,y:30,width:124,height:81});
  assert.equal(result[0].text,'폭풍 눈');assert.equal(result[0].x,55);assert.equal(result[0].y,40);assert.equal(result[1],lines[1]);
  assert.deepEqual(mergeRetry(lines,[{text:'포L',x:48,y:20}],{x:31,y:30,width:124,height:81}),lines);
});
