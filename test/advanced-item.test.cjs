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

const ring=`아이템 종류: 반지
아이템 희귀도: 희귀
거대한 유지
균열 반지
--------
요구 사항: 레벨 52
--------
아이템 레벨: 79
--------
{ 고정 속성 부여 }
최대 퀄리티 +20% — 변경이 불가능한 값
--------
{ 접두어 속성 부여 "쪽빛" (등급: 3) — 마나 }
마나 최대치 +125(125-149)
{ 접두어 속성 부여 "날이 선" (등급: 3) — 피해, 물리, 공격 }
공격 시 물리 피해 11(7-11)~14(14-20) 추가
{ 접미어 속성 부여 "- 대재난" — 시전, 치명타 }
주문 치명타 명중 확률 18(16-18)% 증가
{ 접미어 속성 부여 "- 격파" (등급: 2) — 생명력 }
처치한 적 하나당 생명력 37(29-40) 획득 `;
// Official Korean trade dictionary IDs and templates, checked 2026-10-05.
const ringStats=[
  {id:'implicit.stat_275498888',text:'최대 퀄리티 #%'},
  {id:'implicit.stat_2039822488',text:'최대 퀄리티 #%'},
  {id:'explicit.stat_1050105434',text:'마나 최대치 #'},
  {id:'explicit.stat_3032590688',text:'공격 시 물리 피해 #~# 추가'},
  {id:'explicit.stat_737908626',text:'주문 치명타 명중 확률 #% 증가'},
  {id:'explicit.stat_3695891184',text:'처치한 적 하나당 생명력 # 획득'}
];
test('균열 반지의 피해 범위는 평균으로 검색하고 중복 퀄리티 ID는 임의 선택하지 않는다',()=>{
  const item=parseItem(ring,ringStats);
  assert.equal(item.type,'균열 반지');
  assert.deepEqual(item.filters.map(f=>[f.id,f.value.min,f.value.max]),[
    ['explicit.stat_1050105434',125,125],['explicit.stat_3032590688',12.5,12.5],
    ['explicit.stat_737908626',18,18],['explicit.stat_3695891184',37,37]
  ]);
  assert.deepEqual(item.unmatched,['최대 퀄리티 +20% — 변경이 불가능한 값']);
  assert.match(item.filters[1].text,/검색 평균 12\.5/);
  const query=tradeQuery(item);
  assert.equal(query.query.type,'균열 반지');assert.equal(query.query.stats[0].filters.length,4);
  assert.equal(query.query.stats[0].filters[1].text,undefined);
  assert.deepEqual(query.query.stats[0].filters.map(f=>f.value),[{min:125},{min:12.5},{min:18},{min:37}]);
});
test('변경 불가능 안내문은 유일한 사전 항목에 매칭하며 다른 복수 수치는 제외한다',()=>{
  const item=parseItem(ring,ringStats.filter(s=>s.id!=='implicit.stat_2039822488'));
  assert.equal(item.filters[0].id,'implicit.stat_275498888');assert.equal(item.filters[0].value.min,20);
  assert.equal(item.filters.length,5);
  const unsupported=parseItem('아이템 희귀도: 희귀\n이름\n반지\n--------\n생명력 10당 마나 +2',[
    {id:'explicit.test',text:'생명력 #당 마나 +#'}
  ]);
  assert.equal(unsupported.filters.length,0);assert.equal(unsupported.unmatched.length,1);
});
