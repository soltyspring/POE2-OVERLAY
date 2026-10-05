// Find flat rectangular label backgrounds independently of glyph color.
function backgroundRegions(pixels,{width,height}){
  const candidates=[];
  for(let y=0;y<height;y+=3){
    let start=0,r0=-1,g0=-1,b0=-1;
    for(let x=0;x<=width;x++){
      const i=(y*width+x)*4,b=pixels[i],g=pixels[i+1],r=pixels[i+2];
      const eligible=x<width&&((r+g+b>300&&Math.max(r,g,b)>130)||Math.max(r,g,b)<55);
      const same=eligible&&Math.abs(r-r0)<=5&&Math.abs(g-g0)<=5&&Math.abs(b-b0)<=5;
      if(!same){
        const run=x-start;
        if(run>=65&&run<=600){
          const old=candidates.findLast(box=>y-box.bottom<=48&&Math.abs(box.x-start)<=5&&Math.abs(box.right-x)<=5&&Math.abs(box.r-r0)<=5&&Math.abs(box.g-g0)<=5&&Math.abs(box.b-b0)<=5);
          if(old)old.bottom=y;
          else candidates.push({x:start,y,top:y,bottom:y,right:x,r:r0,g:g0,b:b0});
        }
        start=eligible?x:x+1;r0=r;g0=g;b0=b;
      }
    }
  }
  const result=[];
  for(const box of candidates){
    const h=box.bottom-box.top;
    if(h<15||h>95)continue;
    // Require consistent vertical sides; a flat strip in scenery is insufficient.
    let valid=0,total=0;
    for(let y=box.top;y<=box.bottom;y+=3)for(const x of [box.x+2,box.right-3]){
      const i=(y*width+x)*4;total++;
      if(Math.abs(pixels[i]-box.b)<18&&Math.abs(pixels[i+1]-box.g)<18&&Math.abs(pixels[i+2]-box.r)<18)valid++;
    }
    if(valid/total<.8)continue;
    result.push({x:Math.max(0,box.x-2),y:Math.max(0,box.top-2),width:Math.min(width-box.x,box.right-box.x+4),height:Math.min(height-box.top,h+5),background:true});
  }
  return result.filter((box,i)=>!result.some((other,j)=>i!==j&&other.width*other.height>box.width*box.height&&box.x>=other.x-4&&box.y>=other.y-4&&box.x+box.width<=other.x+other.width+4&&box.y+box.height<=other.y+other.height+4));
}
module.exports={backgroundRegions};
