const test=require('node:test'),assert=require('node:assert/strict');
const {withDeadline}=require('../src/search-deadline.cjs');
const {Market}=require('../src/market.cjs');
test('검색이 응답하지 않으면 제한 시간에 취소하고 다음 작업을 허용한다',async()=>{
  let signal;
  await assert.rejects(withDeadline(s=>{signal=s;return new Promise(()=>{});},15),/시간이 초과/);
  assert.equal(signal.aborted,true);assert.equal(await withDeadline(async()=>42,100),42);
});
test('긴 요청 제한은 조용히 기다리지 않고 즉시 안내하며 대기열은 복구된다',async()=>{
  let calls=0;
  const market=new Market({fetch:async()=>{calls++;return {ok:true,status:200,headers:new Headers(),json:async()=>({ok:true})};}});
  market.nextRequest=Date.now()+60000;
  await assert.rejects(market.request('https://example.test'),/초 후 다시/);assert.equal(calls,0);
  market.nextRequest=0;assert.deepEqual(await market.request('https://example.test'),{ok:true});
});
test('취소된 검색 요청은 네트워크로 보내지 않는다',async()=>{
  const controller=new AbortController();controller.abort(new Error('취소'));
  const market=new Market({fetch:async()=>{throw new Error('network must not run');}});
  await assert.rejects(market.request('https://example.test',{},controller.signal),/취소/);
});
