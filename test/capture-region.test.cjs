const test=require('node:test');
const assert=require('node:assert/strict');
const {captureRegion}=require('../src/capture-region.cjs');
test('F6 uses the full thumbnail; F7 scales cursor coordinates on another monitor',()=>{
  const bounds={x:-1920,y:0,width:1920,height:1080},size={width:2400,height:1350};
  assert.deepEqual(captureRegion('full',{x:-960,y:540},bounds,size),{x:0,y:0,width:2400,height:1350});
  assert.deepEqual(captureRegion('mouse',{x:-960,y:540},bounds,size),{x:638,y:113,width:1125,height:1125});
});
test('F7 stays inside screen edges and accommodates small screens',()=>{
  const bounds={x:0,y:0,width:1920,height:1080},size={width:1920,height:1080};
  assert.deepEqual(captureRegion('mouse',{x:1919,y:1079},bounds,size),{x:1020,y:180,width:900,height:900});
  assert.deepEqual(captureRegion('mouse',{x:0,y:0},{x:0,y:0,width:640,height:480},{width:640,height:480}),{x:0,y:0,width:640,height:480});
});
