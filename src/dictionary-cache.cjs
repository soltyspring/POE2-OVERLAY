const fs=require('node:fs/promises');
const path=require('node:path');
const keys=new Set(['static','items','stats']);
function cacheFile(directory,key){return directory&&keys.has(key)?path.join(directory,`${key}.json`):null;}
async function readDictionary(directory,key,ttl){
  const file=cacheFile(directory,key);if(!file)return null;
  try {
    const saved=JSON.parse(await fs.readFile(file,'utf8'));
    if(saved.version!==1||!Number.isFinite(saved.time)||Date.now()-saved.time<0||Date.now()-saved.time>=ttl)return null;
    if(!Array.isArray(saved.value?.result)||!saved.value.result.every(g=>Array.isArray(g.entries)))return null;
    return saved;
  } catch{return null;}
}
async function writeDictionary(directory,key,entry){
  const file=cacheFile(directory,key);if(!file)return;
  try {await fs.mkdir(directory,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify({version:1,...entry}));await fs.rename(file+'.tmp',file);}catch{}
}
module.exports={readDictionary,writeDictionary};
