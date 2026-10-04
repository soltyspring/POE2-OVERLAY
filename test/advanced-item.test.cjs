const test=require('node:test');
const assert=require('node:assert/strict');
const {parseItem,tradeQuery}=require('../src/core.cjs');
const text=`아이템 종류: 목걸이 
아이템 희귀도: 희귀 
부패하는 구슬 
태양의 목걸이 
-------- 
요구 사항: 레벨 52 
-------- 
아이템 레벨: 81 
-------- 
{ 고정 속성 부여 }
정신력 +13(10-15) 
-------- 
{ 접두어 속성 부여 "완강한" (등급: 5) — 생명력 }
생명력 최대치 +62(60-69) 
{ 접미어 속성 부여 "- 설인" (등급: 5) — 원소, 냉기, 저항 }
냉기 저항 +22(21-25)% 
{ 접미어 속성 부여 "- 학자" (등급: 2) — 능력치 }
지능 +28(28-30) 
{ 접미어 속성 부여 "- 원기왕성" (등급: 4) — 마나 }
마나 재생 속도 34(30-39)% 증가`;
const stats=[{id:'implicit.spirit',text:'정신력 +#'},{id:'explicit.spirit',text:'정신력 +#'},{id:'explicit.life',text:'생명력 최대치 +#'},{id:'explicit.cold',text:'냉기 저항 +#%'},{id:'explicit.int',text:'지능 +#'},{id:'explicit.mana',text:'마나 재생 속도 #% 증가'}];
test('사용자의 고급 복사 텍스트를 실제 옵션 5개로 파싱하고 범위·등급을 검색값에서 제외한다',()=>{
  const item=parseItem(text,stats);assert.equal(item.type,'태양의 목걸이');assert.equal(item.filters.length,5);assert.equal(item.unmatched.length,0);
  assert.deepEqual(item.filters.map(f=>[f.id,f.value.min,f.value.max]),[['implicit.spirit',13,13],['explicit.life',62,62],['explicit.cold',22,22],['explicit.int',28,28],['explicit.mana',34,34]]);
  assert.equal(tradeQuery(item).query.type,'태양의 목걸이');
});
test('Unknown metadata and multiple actual values remain unmatched instead of guessing',()=>{
  const item=parseItem('아이템 희귀도: 희귀\n이름\n목걸이\n--------\n{ 알 수 없는 속성 }\n생명력 최대치 +62(60-69)\n--------\n화염 피해 10(8-12)~20(18-22) 추가',stats);
  assert.equal(item.filters.length,0);assert.equal(item.unmatched.length,2);
});
module.exports={text};
