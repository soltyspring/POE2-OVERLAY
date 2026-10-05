const test=require('node:test'),assert=require('node:assert/strict');
const {parseExchange,applySnapshotPrices}=require('../src/exchange.cjs');
test('웹 응답 한 개에서 고유 참고가를 적용하고 희귀 베이스 가격을 추측하지 않는다',()=>{
  const now=Date.now(),observed_at=Math.floor(now/1000),league='Standard';
  const data=parseExchange({markets:[{league,id:'exchange:Currency:exalted',name:'엑잘티드 오브',price_divine:.01,observed_at},{league,id:'stash:ring',name:'고유 반지',base_type:'루비 반지',source_kind:'stash',price_divine:2,observed_at}]},league,now);
  const rows=[{kind:'unique',name:'고유 반지',type:'루비 반지',count:2},{kind:'candidate',type:'루비 반지',count:1},{kind:'base',type:'루비 반지',count:1,unitEx:null}];
  applySnapshotPrices(rows,data);
  assert.equal(rows[0].totalEx,400);assert.equal(rows[1].unitEx,200);assert.equal(rows[2].unitEx,null);
});
test('다른 리그와 오래된 고유 시세는 일괄 가격에 포함하지 않는다',()=>{
  const now=Date.now(),observed_at=Math.floor(now/1000),league='Standard';
  const data=parseExchange({markets:[{league,id:'exchange:Currency:exalted',name:'엑잘티드 오브',price_divine:.01,observed_at},{league,id:'stash:old',name:'고유',price_divine:2,observed_at:observed_at-1801},{league:'Other',id:'stash:other',name:'고유',price_divine:3,observed_at}]},league,now);
  assert.equal(data.quotes.length,1);
});
