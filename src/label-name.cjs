function cleanLabelName(text,catalog){
  const normalize=value=>value.replace(/\s/g,'');
  const cleaned=text.replace(/^[\s•;`\\『』「」-]+|[\s•;`\\『』「」-]+$/g,'').trim();
  const ranked=cleaned.match(/^(?:상급|고급)\s+(.+?)\s*\((\d+)등급\)$/);
  if(ranked){
    const entries=catalog.filter(e=>normalize(e.name)===normalize(ranked[1]));
    if(entries.length&&entries.every(e=>['base','candidate'].includes(e.kind)))return {text:entries[0].name,displayName:cleaned};
  }
  return {text:cleaned};
}
module.exports={cleanLabelName};
