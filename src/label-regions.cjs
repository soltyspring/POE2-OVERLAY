// Group text-colored pixels next to dark label backgrounds on a coarse grid.
// Work stays bounded by screen size; no neural detector or extra OCR process.
function labelRegions(pixels,{width,height}){
  const cell=8,cols=Math.ceil(width/cell),rows=Math.ceil(height/cell);
  const counts=new Uint16Array(cols*rows);
  const dark=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return false;const i=(y*width+x)*4;return Math.max(pixels[i],pixels[i+1],pixels[i+2])<55;};
  const warm=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return false;const i=(y*width+x)*4;return pixels[i+2]>160&&pixels[i+1]>100&&pixels[i]<100;};
  for(let y=8;y<height-8;y++)for(let x=8;x<width-8;x++){
    const i=(y*width+x)*4,b=pixels[i],g=pixels[i+1],r=pixels[i+2];
    const bright=(b>140&&b>r*1.35&&g>65)||(r>160&&g>140&&b<g*.7)||(r>150&&g>150&&b>150);
    const darkOnWarm=r<100&&g<90&&b<90&&Number(warm(x-8,y))+Number(warm(x+8,y))+Number(warm(x,y-8))+Number(warm(x,y+8))>=2;
    if(!darkOnWarm&&(!bright||Number(dark(x-8,y))+Number(dark(x+8,y))+Number(dark(x,y-8))+Number(dark(x,y+8))<1))continue;
    counts[Math.floor(y/cell)*cols+Math.floor(x/cell)]++;
  }
  const seen=new Uint8Array(counts.length),regions=[];
  for(let start=0;start<counts.length;start++){
    if(seen[start]||counts[start]<1)continue;
    const stack=[start];seen[start]=1;let minX=cols,maxX=0,minY=rows,maxY=0,total=0;
    while(stack.length){const index=stack.pop(),x=index%cols,y=Math.floor(index/cols);total+=counts[index];minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;const next=ny*cols+nx;if(!seen[next]&&counts[next]>=2){seen[next]=1;stack.push(next);}}
    }
    const x=Math.max(0,minX*cell-8),y=Math.max(0,minY*cell-8);
    const w=Math.min(width-x,(maxX-minX+1)*cell+16),h=Math.min(height-y,(maxY-minY+1)*cell+16);
    if(w>=55&&w<=550&&h>=24&&h<=110&&total>=35&&w/h>=1.5)regions.push({x,y,width:w,height:h});
  }
  return regions.sort((a,b)=>a.y-b.y||a.x-b.x);
}
function packLabels(pixels,size,regions){
  if(!regions.length||regions.length>48)return null;
  const padding=12,width=Math.max(...regions.map(r=>r.width))+padding*2;
  const height=regions.reduce((sum,r)=>sum+r.height+padding*2,0);
  if(width>2600||height>2600||width*height>=size.width*size.height*.65)return null;
  const buffer=Buffer.alloc(width*height*4,255),placements=[];let top=0;
  for(const region of regions){
    for(let y=0;y<region.height;y++)pixels.copy(buffer,((top+padding+y)*width+padding)*4,((region.y+y)*size.width+region.x)*4,((region.y+y)*size.width+region.x+region.width)*4);
    placements.push({...region,packedX:padding,packedY:top+padding});top+=region.height+padding*2;
  }
  return {buffer,width,height,placements};
}
function restoreLines(lines,placements){
  return lines.flatMap(line=>{
    const region=placements.find(r=>line.y>=r.packedY-4&&line.y<r.packedY+r.height+4);
    return region?[{...line,x:line.x-region.packedX+region.x,y:line.y-region.packedY+region.y}]:[];
  });
}
module.exports={labelRegions,packLabels,restoreLines};
