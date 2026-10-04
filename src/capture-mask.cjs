function overlayMask(windowBounds,displayBounds,size,region,padding=8){
  const sx=size.width/displayBounds.width,sy=size.height/displayBounds.height;
  const left=Math.floor((windowBounds.x-padding-displayBounds.x)*sx)-region.x;
  const top=Math.floor((windowBounds.y-padding-displayBounds.y)*sy)-region.y;
  const right=Math.ceil((windowBounds.x+windowBounds.width+padding-displayBounds.x)*sx)-region.x;
  const bottom=Math.ceil((windowBounds.y+windowBounds.height+padding-displayBounds.y)*sy)-region.y;
  const x=Math.max(0,left),y=Math.max(0,top),width=Math.min(region.width,right)-x,height=Math.min(region.height,bottom)-y;
  return width>0&&height>0?{x,y,width,height}:null;
}
function maskBitmap(bitmap,size,mask){
  if(!mask)return bitmap;
  for(let y=mask.y;y<mask.y+mask.height;y++){
    const start=(y*size.width+mask.x)*4,end=start+mask.width*4;
    bitmap.fill(0,start,end);
    for(let i=start+3;i<end;i+=4)bitmap[i]=255;
  }
  return bitmap;
}
module.exports={overlayMask,maskBitmap};
