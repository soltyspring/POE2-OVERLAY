const test=require('node:test'),assert=require('node:assert/strict');
const {Market}=require('../src/market.cjs');
const {prepareBatch,applyBatch}=require('../src/overlay-prices.cjs');
const catalog=[{kind:'commodity',name:'엑잘티드 오브',category:'Currency',id:'exalted'},{kind:'unique',name:'고유 반지',type:'루비 반지'}];
const rows=()=>[{key:'a',name:'엑잘티드 오브',kind:'commodity',count:20},{key:'b',name:'엑잘티드 오브',kind:'commodity',count:10},{key:'c',name:'가시나무 고리 · 루비 반지',kind:'named-gear',type:'루비 반지',count:1}];
const response=()=>({items:{'0':{name:'엑잘티드 오브',state:'ready',priceExalted:1,observedAt:Date.now()/1000},'1':{state:'missing'},'2':{name:'고유 반지',id:'stash:ring',state:'ready',priceExalted:30,observedAt:Date.now()/1000}},rates:{state:'ready',exaltedPerDivine:600,observedAt:Date.now()/1000},state:'ready'});
test('중복 화폐 요청을 공유하고 수량과 희귀 후보 가격을 구분한다',()=>{
 const list=rows(),batch=prepareBatch(list,catalog);
 assert.equal(batch.items.length,3);assert.equal(batch.items[0].kind,'currency');
 const data=applyBatch(list,batch,response());
 assert.equal(list[0].totalEx,20);assert.equal(list[1].totalEx,10);assert.equal(list[2].totalEx,30);
 assert.equal(list[2].priceKind,'candidate-reference');assert.equal(data.siteItems[1].id,'stash:ring');
 const stale=response();stale.rates.observedAt-=1801;applyBatch(list,batch,stale);assert.equal(list[0].totalEx,null);
});
test('동시 스캔과 60초 캐시는 한 POST를 공유하며 전체 markets 요청을 하지 않는다',async()=>{
 let calls=0;
 const market=new Market({exchangeUrl:'https://example.com',fetch:async(url,options)=>{
   calls++;assert.equal(url,'https://example.com/api/overlay/prices');assert.equal(options.method,'POST');
   await new Promise(resolve=>setTimeout(resolve,10));return {ok:true,json:async()=>response()};
 }});
 await Promise.all([market.priceRows('Standard',rows(),catalog),market.priceRows('Standard',rows(),catalog)]);
 await market.priceRows('Standard',rows(),catalog);assert.equal(calls,1);
});
test('서버 실패는 명시적으로 전달하고 숨은 전체 목록 요청을 하지 않는다',async()=>{
 const market=new Market({exchangeUrl:'https://example.com',fetch:async()=>({ok:false,status:503})});
 await assert.rejects(market.priceRows('Standard',rows(),catalog),/HTTP 503/);
});
