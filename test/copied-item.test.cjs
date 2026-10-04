const test=require('node:test');
const assert=require('node:assert/strict');
const {readCopiedItem}=require('../src/copied-item.cjs');
test('Waits for Electron asynchronous clipboard text before parsing options',async()=>{
  const item=await readCopiedItem(async()=> '아이템 희귀도: 희귀\n복수의 눈\n에메랄드 반지\n--------\n생명력 최대치 +80',async()=>[{id:'explicit.life',text:'생명력 최대치 #'}]);
  assert.equal(item.type,'에메랄드 반지');assert.equal(item.filters[0].value.min,80);
});
test('Empty or non-item clipboard content yields a readable error without network work',async()=>{
  let loads=0;const stats=async()=>{loads++;return [];};
  await assert.rejects(readCopiedItem(async()=>'',stats),/복사된 아이템 정보가 없습니다/);
  await assert.rejects(readCopiedItem(async()=>({}),stats),/복사된 아이템 정보가 없습니다/);
  await assert.rejects(readCopiedItem(async()=>'일반 메모',stats),/한국어 아이템 정보/);
  assert.equal(loads,0);
});
