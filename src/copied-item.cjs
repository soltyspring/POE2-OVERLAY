const {parseItem}=require('./core.cjs');
async function readCopiedItem(readText,loadStats){
  const text=await readText();
  // Validate before downloading option dictionaries or querying prices.
  parseItem(text,[]);
  return parseItem(text,await loadStats());
}
module.exports={readCopiedItem};
