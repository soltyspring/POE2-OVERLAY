const test=require('node:test');
const assert=require('node:assert/strict');
const {overlayMask,maskBitmap}=require('../src/capture-mask.cjs');
test('Overlay bounds map into full and mouse crops including negative monitor coordinates',()=>{
  const display={x:-1920,y:0,width:1920,height:1080},size={width:960,height:540};
  const window={x:-1800,y:100,width:400,height:300};
  assert.deepEqual(overlayMask(window,display,size,{x:0,y:0,width:960,height:540},0),{x:60,y:50,width:200,height:150});
  assert.deepEqual(overlayMask(window,display,size,{x:100,y:100,width:300,height:300},0),{x:0,y:0,width:160,height:100});
  assert.equal(overlayMask({x:50,y:0,width:500,height:700},display,size,{x:0,y:0,width:960,height:540}),null);
});
test('Only the panel rectangle is blacked out; surrounding image pixels stay unchanged',()=>{
  const pixels=Buffer.alloc(3*2*4,99);
  maskBitmap(pixels,{width:3,height:2},{x:1,y:0,width:1,height:2});
  assert.deepEqual([...pixels.subarray(4,8)],[0,0,0,255]);assert.deepEqual([...pixels.subarray(16,20)],[0,0,0,255]);
  assert.equal(pixels[0],99);assert.equal(pixels[8],99);
});
