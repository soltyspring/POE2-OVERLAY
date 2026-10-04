const test=require('node:test');
const assert=require('node:assert/strict');
const {formatPrice}=require('../src/price-format.js');
test('Exchange display precision preserves small prices and promotes rounded K/M/B boundaries',()=>{
  for(const [value,expected] of [[0,'0'],[12.345,'12.3'],[0.012345,'0.0123'],[0.0000012345,'0.00000123'],[1234,'1.23K'],[999999,'1M'],[1e9,'1B'],[null,'—']])assert.equal(formatPrice(value),expected);
});
