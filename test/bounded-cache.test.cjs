const test=require('node:test');
const assert=require('node:assert/strict');
const {BoundedCache}=require('../src/bounded-cache.cjs');
test('Long sessions bound cached searches while preserving the localized dictionaries',()=>{
  const cache=new BoundedCache(128),time=Date.now();
  cache.set('static',{time,value:'dictionary'});
  for(let i=0;i<5000;i++)cache.set(JSON.stringify([i]),{time,value:i});
  assert.equal(cache.size,128);assert.equal(cache.get('static').value,'dictionary');
  assert.equal(cache.get('[0]'),undefined);assert.equal(cache.get('[4999]').value,4999);
});
test('Expired searches are released on access and pruning; dictionaries keep their 24h lifetime',()=>{
  const cache=new BoundedCache(),time=Date.now()-61000;
  cache.set('static',{time,value:1});cache.set('[1]',{time,value:2});
  assert.equal(cache.get('[1]'),undefined);assert.equal(cache.get('static').value,1);
  cache.set('[2]',{time,value:2});cache.set('[3]',{time:Date.now(),value:3});
  assert.equal(cache.has('[2]'),false);
});
