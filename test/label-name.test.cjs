const test=require('node:test'),assert=require('node:assert/strict');
const {scanLines}=require('../src/core.cjs');
const catalog=[{name:'방랑자 신발',type:'방랑자 신발',kind:'base'},{name:'철목 단궁',type:'철목 단궁',kind:'base'}];
test('첨부 이미지의 등급 장비와 단궁 주변 기호를 처리하며 원래 등급 표시는 유지한다',()=>{
 const rows=scanLines([{text:'상급 방랑자 신발 (2등급)',x:113,y:448},{text:'-철목 단궁`',x:197,y:539}],catalog,new Map());
 assert.equal(rows.length,2);assert.equal(rows[0].name,'상급 방랑자 신발 (2등급)');assert.equal(rows[0].type,'방랑자 신발');assert.equal(rows[1].type,'철목 단궁');
});
test('사전에 없는 장비 등급과 이름은 추측하지 않는다',()=>{
 assert.equal(scanLines([{text:'상급 미지의 신발 (2등급)',x:1,y:1}],catalog,new Map()).length,0);
});
