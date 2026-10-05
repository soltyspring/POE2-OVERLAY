const test=require('node:test'),assert=require('node:assert/strict');
const {resolveCopiedBase}=require('../src/copied-base.cjs');
const {Market}=require('../src/market.cjs');
test('마법 아이템 접두·접미 이름에서 가장 구체적인 DB 베이스를 찾는다',()=>{
  const item={rarity:'마법',type:'흐릿한 분광 반지 - 사자',filters:[{id:'test'}]};
  const result=resolveCopiedBase(item,[{type:'반지'},{type:'분광 반지'}]);
  assert.equal(result.type,'분광 반지');assert.equal(result.originalType,item.type);assert.equal(item.type,'흐릿한 분광 반지 - 사자');
});
test('베이스 후보가 모호하거나 없으면 요청 전에 안내한다',()=>{
  assert.throws(()=>resolveCopiedBase({rarity:'마법',type:'분광 반지 태양 반지'},[{type:'분광 반지'},{type:'태양 반지'}]),/확정/);
});
test('HTTP 400은 서버의 실제 검색 오류를 보여주고 로그인 오류로 안내하지 않는다',async()=>{
  const market=new Market({fetch:async()=>({ok:false,status:400,headers:new Headers(),json:async()=>({error:{message:'Unknown item type'}})})});
  await assert.rejects(market.request('https://example.test',{}),error=>error.message.includes('Unknown item type')&&!error.message.includes('로그인'));
});
