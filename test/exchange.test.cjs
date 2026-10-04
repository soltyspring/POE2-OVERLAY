const test = require('node:test');
const assert = require('node:assert/strict');
const {parseExchange,serverUrl} = require('../src/exchange.cjs');
const {Market} = require('../src/market.cjs');
function snapshot(league='Standard') {
  const observed_at=Math.floor(Date.now()/1000);
  return {markets:[
    {league,id:'exchange:Currency:exalted',name:'엑잘티드 오브',price_divine:.005,observed_at},
    {league,id:'exchange:Currency:divine',name:'신성한 오브',price_divine:1,observed_at},
    {league,id:'exchange:Currency:greater-chaos-orb',name:'상위 카오스 오브',price_divine:.2,observed_at}
  ]};
}
test('빠른 조회는 동시 요청을 공유하고 유효한 시세를 먼저 반환하며 뒤에서 갱신한다',async()=>{
  const market=new Market();let calls=0,finish;
  const first={updatedAt:new Date().toISOString(),prices:new Map([['exalted',1]])};
  market.load=async()=>{calls++;return first;};
  const results=await Promise.all([market.loadQuick('Standard'),market.loadQuick('Standard')]);
  assert.equal(calls,1);assert.equal(results[0],first);
  market.snapshots.get('Standard').time-=61000;
  market.load=()=>{calls++;return new Promise(resolve=>finish=resolve);};
  assert.equal(await market.loadQuick('Standard'),first);assert.equal(await market.loadQuick('Standard'),first);assert.equal(calls,2);
  const updated={...first,prices:new Map([['exalted',2]])};finish(updated);await market.loads.get('Standard');
  assert.equal(await market.loadQuick('Standard'),updated);
  market.snapshots.set('Standard',{time:0,value:{...first,updatedAt:new Date(Date.now()-1800001).toISOString()}});
  market.load=async()=>updated;
  assert.equal(await market.loadQuick('Standard'),updated);
});
test('DB 스냅샷을 엑잘로 환산하고 다른 리그·오래된 가격을 제외한다',()=>{
  const data=snapshot();
  data.markets.push({...data.markets[2],id:'exchange:Currency:old',observed_at:1});
  data.markets.push({...data.markets[2],league:'Other',id:'exchange:Currency:other'});
  const result=parseExchange(data,'Standard');
  assert.equal(result.prices.get('greater-chaos-orb'),40);
  assert.equal(result.prices.get('divine'),200);
  assert.equal(result.prices.get('exalted'),1);
  assert.equal(result.prices.has('old'),false); assert.equal(result.prices.has('other'),false);
  assert.equal(result.warnings.length,1);
  assert.throws(()=>parseExchange(data,'Unknown'));
});
test('우분투 스냅샷 한 번으로 분류별 원천 API 조회를 건너뛰며 60초 캐시한다',async()=>{
  let calls=0;
  const market=new Market({exchangeUrl:'http://127.0.0.1:18000',fetch:async()=>{calls++;return {ok:true,json:async()=>snapshot()};}});
  market.cached=async(key)=>key==='static'?{result:[]}:{result:[]};
  market.request=async()=>{throw new Error('upstream must not be called');};
  const first=await market.load('Standard'),second=await market.load('Standard');
  assert.equal(calls,1); assert.equal(first.priceSource,'POE2-Exchange DB');
  assert.equal(second.prices.get('greater-chaos-orb'),40);
});
test('서버 오류면 원천 조회로 복구하고 출처와 경고를 표시한다',async()=>{
  const market=new Market({exchangeUrl:'http://127.0.0.1:18000',fetch:async()=>{throw new Error('offline');}});
  market.cached=async key=>['static','items'].includes(key)?{result:[]}:{items:[],lines:[],core:{primary:'exalted'}};
  const result=await market.load('Standard');
  assert.equal(result.priceSource,'poe.ninja 직접 조회'); assert.match(result.warnings[0],/offline/);
});
test('서버 URL은 HTTP/HTTPS만 허용한다',()=>{
  assert.equal(serverUrl('http://127.0.0.1:18000/'),'http://127.0.0.1:18000');
  assert.throws(()=>serverUrl('file:///tmp/db')); assert.throws(()=>serverUrl('https://user:pass@example.com'));
});
test('실제 HTTP 경로·리그 인코딩과 서버 스냅샷 캐시를 연결한다',async()=>{
  const http=require('node:http');
  let requests=0;
  const league='Forbidden Rites';
  const server=http.createServer((request,response)=>{
    requests++;
    assert.equal(request.url,'/api/markets?league=Forbidden%20Rites');
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify(snapshot(league)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const market=new Market({exchangeUrl:`http://127.0.0.1:${server.address().port}`});
    const first=await market.loadExchange(league),second=await market.loadExchange(league);
    assert.equal(first.prices.get('divine'),200); assert.equal(second.prices.get('exalted'),1);
    assert.equal(requests,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
