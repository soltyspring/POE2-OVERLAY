const test=require('node:test');
const assert=require('node:assert/strict');
const {AutoScan}=require('../src/auto-scan.cjs');
test('3초 tick은 진행 중인 OCR/조회와 겹치거나 쌓이지 않는다',async()=>{
  let count=0,release;
  const controller=new AutoScan(()=>{count++;return new Promise(resolve=>release=resolve);},()=>false);
  const first=controller.tick();await controller.tick();await controller.tick();
  assert.equal(count,1);release();await first;
  const next=controller.tick();assert.equal(count,2);release();await next;
});
test('수동 작업 중에는 생략하고 오류 뒤에 다시 자동 스캔한다',async()=>{
  let busy=true,count=0;
  const controller=new AutoScan(()=>{count++;throw new Error('OCR failure');},()=>busy);
  await controller.tick();assert.equal(count,0);busy=false;
  await controller.tick();await controller.tick();assert.equal(count,2);assert.equal(controller.active,false);
  controller.set(true);assert.ok(controller.timer);controller.stop();assert.equal(controller.timer,null);
});
test('간격 변경은 실행 상태를 보존하고 숨긴 창은 추가 작업 없이 생략한다',async()=>{
  let visible=false,count=0;
  const controller=new AutoScan(()=>{count++;},()=>!visible);
  controller.set(true);controller.setIntervalMs(10000);
  assert.equal(controller.interval,10000);assert.ok(controller.timer);
  await controller.tick();assert.equal(count,0);visible=true;
  await controller.tick();assert.equal(count,1);
  assert.throws(()=>controller.setIntervalMs(1));controller.stop();
});
