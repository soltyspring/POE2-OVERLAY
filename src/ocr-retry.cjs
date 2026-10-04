const {normalize}=require('./core.cjs');
function retryRegions(lines,catalog,size){
  const bases=new Set(catalog.filter(e=>['candidate','base'].includes(e.kind)).map(e=>normalize(e.name)));
  const regions=[];
  for(const base of lines){
    if(!bases.has(normalize(base.text.replace(/^[-•]+\s*/,''))))continue;
    const above=lines.filter(line=>base.y-line.y>=8&&base.y-line.y<=60&&Math.abs(base.x-line.x)<=80&&/[A-Za-z“”—_]/.test(line.text)).sort((a,b)=>b.y-a.y)[0];
    if(!above)continue;
    const x=Math.max(0,Math.floor(Math.min(base.x,above.x)-12)),y=Math.max(0,Math.floor(above.y-10));
    const right=Math.max(base.x+(base.width||base.text.length*22),above.x+(above.width||above.text.length*22))+12;
    const bottom=base.y+(base.height||30)+10;
    const width=Math.min(size.width-x,Math.ceil(right-x)),height=Math.min(size.height-y,Math.ceil(bottom-y));
    if(width>0&&height>0&&width<=400&&height<=130&&!regions.some(r=>Math.abs(r.x-x)<10&&Math.abs(r.y-y)<10))regions.push({x,y,width,height});
    if(regions.length>=2)break;
  }
  return regions;
}
function isolateYellow(bitmap,size){
  // nativeImage.toBitmap() is BGRA on Windows. Use a separate bounded buffer.
  const result=Buffer.alloc(bitmap.length,255);
  for(let i=0;i<bitmap.length;i+=4)if(bitmap[i+2]>180&&bitmap[i+1]>144&&bitmap[i]<bitmap[i+1]*.8){result[i]=0;result[i+1]=0;result[i+2]=0;}
  if(size)for(let x=0;x<size.width;x++){
    let ink=0;for(let y=0;y<size.height;y++)if(result[(y*size.width+x)*4]===0)ink++;
    if(ink>size.height*.65)for(let y=0;y<size.height;y++){const i=(y*size.width+x)*4;result[i]=result[i+1]=result[i+2]=255;}
  }
  return result;
}
function padBitmap(bitmap,size,padding=40){
  const width=size.width+padding*2,height=size.height+padding*2,buffer=Buffer.alloc(width*height*4,255);
  for(let y=0;y<size.height;y++)bitmap.copy(buffer,((y+padding)*width+padding)*4,y*size.width*4,(y+1)*size.width*4);
  return {buffer,width,height};
}
function mergeRetry(lines,retry,region,padding=0){
  const repaired=retry.map(line=>({...line,x:line.x/2-padding+region.x,y:line.y/2-padding+region.y,width:line.width/2,height:line.height/2}));
  if(!repaired.some(line=>/^[가-힣]+(?:\s+[가-힣]+){1,4}$/.test(line.text)))return lines;
  // Preserve original readable lines; replace only garbled text in this crop.
  const updated=lines.map(line=>{
    if(line.x<region.x||line.x>=region.x+region.width||line.y<region.y||line.y>=region.y+region.height||!/[A-Za-z“”—_]/.test(line.text))return line;
    const nearest=repaired.filter(r=>Math.abs(r.y-line.y)<=12&&Math.abs(r.x-line.x)<=25&&/^[가-힣]+(?:\s+[가-힣]+){1,4}$/.test(r.text)).sort((a,b)=>Math.abs(a.y-line.y)-Math.abs(b.y-line.y))[0];
    return nearest||line;
  });
  return updated;
}
module.exports={retryRegions,isolateYellow,padBitmap,mergeRetry};
