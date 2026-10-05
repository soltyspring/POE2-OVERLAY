const key=value=>String(value||'').normalize('NFKC').replace(/[\s·]/g,'');
function evaluate(expected,actual,size){
  const used=new Set(),nameUsed=new Set(),matches=[];let nameCorrect=0,quantityCorrect=0;
  for(const label of expected){
    const [x,y,w,h]=label.box;
    const candidates=actual.map((row,i)=>({row,i})).filter(({row,i})=>!used.has(i)&&row.x>=x*size.width-12&&row.x<=(x+w)*size.width+12&&row.y>=y*size.height-12&&row.y<=(y+h)*size.height+12);
    const named=candidates.find(({row,i})=>!nameUsed.has(i)&&key(row.name)===key(label.name));
    if(named){nameUsed.add(named.i);nameCorrect++;if(named.row.count===(label.count||1))quantityCorrect++;}
    const hit=candidates.find(({row})=>key(row.name)===key(label.name)&&row.count===(label.count||1));
    if(hit){used.add(hit.i);matches.push({expected:label,actual:hit.row});}
  }
  const correct=matches.length,falsePositive=actual.length-correct,missing=expected.length-correct;
  return {correct,nameCorrect,quantityCorrect,expected:expected.length,actual:actual.length,missing,falsePositive,precision:actual.length?correct/actual.length:expected.length?0:1,recall:expected.length?correct/expected.length:1,matches};
}
module.exports={evaluate};
