const test=require('node:test'),assert=require('node:assert/strict');
const {resolveGemName}=require('../src/gem-name.cjs');
const catalog=['뇌진탕 룬','임의의 보조 룬','화염 보조 젬','번개 스킬 젬','기타 젬'].map(name=>({name,kind:'gem'}));
test('특정 이름 목록 없이 공식 사전의 접미어에서 보상 별칭을 생성한다',()=>{
 for(const [name,role,expected] of [['뇌진탕','보조','뇌진탕 룬'],['임의의 보조','보조','임의의 보조 룬'],['화염','보조','화염 보조 젬'],['번개','스킬','번개 스킬 젬'],['기타','스킬','기타 젬']])assert.equal(resolveGemName(name,role,catalog),expected);
 assert.equal(resolveGemName('뇌 진 탕','보조',catalog),'뇌진탕 룬');
 assert.equal(resolveGemName('뇌진탕','스킬',catalog),null);
});
test('원래 이름을 우선하고 후보가 여러 개이거나 실제 이름 일부가 틀리면 추측하지 않는다',()=>{
 const ambiguous=[...catalog,{name:'뇌진탕 젬',kind:'gem'}];
 assert.equal(resolveGemName('뇌진탕','보조',ambiguous),null);
 assert.equal(resolveGemName('뇌진탕 룬','보조',ambiguous),'뇌진탕 룬');
 assert.equal(resolveGemName('뇌진탐','보조',catalog),null);
 assert.equal(resolveGemName('기타 20','스킬',catalog),null);
});
