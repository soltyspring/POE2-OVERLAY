const test=require('node:test');
const assert=require('node:assert/strict');
const {restoreGeometry}=require('../src/window-geometry.cjs');
const primary={x:0,y:0,width:1920,height:1040};
test('Restores exact position and size including a monitor with negative coordinates',()=>{
  const saved={x:-1500,y:50,width:600,height:800};
  assert.deepEqual(restoreGeometry(saved,[primary,{x:-1920,y:0,width:1920,height:1040}]),saved);
});
test('Disconnected displays and oversized windows are clamped into the work area',()=>{
  assert.deepEqual(restoreGeometry({x:3000,y:100,width:600,height:800},[primary]),{x:1320,y:100,width:600,height:800});
  assert.deepEqual(restoreGeometry({x:-100,y:-100,width:4000,height:2000},[primary]),{x:0,y:0,width:1920,height:1040});
  assert.deepEqual(restoreGeometry({x:'bad'},[primary]),{width:530,height:760});
});
