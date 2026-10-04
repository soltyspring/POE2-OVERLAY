const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {readDictionary,writeDictionary}=require('../src/dictionary-cache.cjs');
const {Market}=require('../src/market.cjs');
async function temporary(run){
  const base=path.resolve(os.tmpdir()),directory=await fs.mkdtemp(path.join(base,'poe-dictionary-test-'));
  try{await run(directory);}finally{assert.ok(path.resolve(directory).startsWith(base+path.sep));await fs.rm(directory,{recursive:true,force:true});}
}
test('A saved dictionary is reused on restart without a network request',()=>temporary(async directory=>{
  const value={result:[{id:'Currency',entries:[{id:'exalted',text:'엑잘티드 오브'}]}]};
  await writeDictionary(directory,'static',{time:Date.now(),value});
  const market=new Market();market.cacheDirectory=directory;market.request=async()=>{throw Error('must not download');};
  assert.deepEqual(await market.cached('static','unused',86400000),value);
}));
test('Expired or corrupt dictionaries are rejected; market prices are never persisted',()=>temporary(async directory=>{
  await writeDictionary(directory,'static',{time:Date.now()-86400001,value:{result:[]}});
  assert.equal(await readDictionary(directory,'static',86400000),null);
  await fs.writeFile(path.join(directory,'static.json'),'broken');assert.equal(await readDictionary(directory,'static',86400000),null);
  await writeDictionary(directory,'[trade]',{time:Date.now(),value:1});
  assert.deepEqual(await fs.readdir(directory),['static.json']);
}));
test('Empty listing searches are cached to avoid repeating fruitless requests',async()=>{
  const market=new Market();let calls=0;market.request=async()=>{calls++;return {id:'abc',result:[],total:0};};
  await market.search('Standard',{query:{type:'test'}});await market.search('Standard',{query:{type:'test'}});assert.equal(calls,1);
});
