const test=require('node:test'),assert=require('node:assert/strict');
const {mergeCurrencies}=require('../src/ocr-merge.cjs');
const {scanLines}=require('../src/core.cjs');
const {prepareBatch}=require('../src/overlay-prices.cjs');
test('룬 보상 목록의 스킬과 보조를 병합하고 레벨별 요청을 분리한다',()=>{
 const catalog=['베리시움 현신','원통한 망자','정제의 불길'].map(name=>({name,type:name,kind:'gem'}));
 const lines=['스킬 레벨 20: 베리시움 현신','스킬 레벨 20: 원통한 망자 『','보조: 정제의 불길','스킬: 베리시움 현신'].map((text,i)=>({text,x:100,y:i*60}));
 const merged=mergeCurrencies([],lines,catalog,['commodity','unpriced','gem']);
 const rows=scanLines(merged,catalog,new Map());assert.equal(rows.length,4);assert.equal(rows[1].type,'원통한 망자');
 const batch=prepareBatch(rows,catalog);assert.equal(batch.items.length,4);assert.equal(batch.items[0].level,20);assert.equal(batch.items[3].level,undefined);
 assert.notEqual(batch.refs.get(rows[0].key)[0],batch.refs.get(rows[3].key)[0]);
});
test('보상 창의 뇌진탕 표기를 공식 뇌진탕 룬 젬과 유일하게 연결한다',()=>{
 const catalog=[{name:'뇌진탕 룬',type:'뇌진탕 룬',kind:'gem'}];
 const rows=scanLines([{text:'보조: 뇌진탕',x:10,y:10}],catalog,new Map());
 assert.equal(rows.length,1);assert.equal(rows[0].type,'뇌진탕 룬');
 assert.equal(scanLines([{text:'스킬: 뇌진탕',x:10,y:10}],catalog,new Map()).length,0);
});
