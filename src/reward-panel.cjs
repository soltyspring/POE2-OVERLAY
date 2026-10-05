// Coarse parchment detection: only sample one pixel per 16px cell.
function rewardPanel(pixels,{width,height}){
 const step=16,cols=Math.floor(width/step),rows=Math.floor(height/step),mask=new Uint8Array(cols*rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const at=((y*step+8)*width+x*step+8)*4,b=pixels[at],g=pixels[at+1],r=pixels[at+2];
  if(r>100&&g>90&&b>65&&r>=g&&g>=b&&r-g<45&&g-b<50)mask[y*cols+x]=1;
 }
 let best=null;
 for(let start=0;start<mask.length;start++){
  if(!mask[start])continue;
  const queue=[start];mask[start]=0;let left=cols,right=0,top=rows,bottom=0;
  for(let i=0;i<queue.length;i++){
   const pos=queue[i],x=pos%cols,y=Math.floor(pos/cols);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(const next of [x>0?pos-1:-1,x+1<cols?pos+1:-1,y>0?pos-cols:-1,y+1<rows?pos+cols:-1])if(next>=0&&mask[next]){mask[next]=0;queue.push(next);}
  }
  const w=(right-left+1)*step,h=(bottom-top+1)*step;
  if(w<300||h<160||queue.length<200||queue.length/((right-left+1)*(bottom-top+1))<.5)continue;
  if(!best||queue.length>best.area)best={x:Math.max(0,left*step-16),y:Math.max(0,top*step-16),width:Math.min(width-left*step,w+32),height:Math.min(height-top*step,h+32),area:queue.length};
 }
 if(best){delete best.area;best.width=Math.min(best.width,width-best.x);best.height=Math.min(best.height,height-best.y);}
 return best;
}
module.exports={rewardPanel};
