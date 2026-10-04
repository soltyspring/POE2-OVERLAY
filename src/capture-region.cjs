// Cursor and bounds are Electron DIP coordinates; thumbnails use image pixels.
function captureRegion(mode,cursor,bounds,size) {
  if(mode==='full') return {x:0,y:0,width:size.width,height:size.height};
  const scaleX=size.width/bounds.width,scaleY=size.height/bounds.height;
  const width=Math.min(size.width,Math.round(900*scaleX));
  const height=Math.min(size.height,Math.round(900*scaleY));
  const x=Math.max(0,Math.min(size.width-width,Math.round((cursor.x-bounds.x)*scaleX-width/2)));
  const y=Math.max(0,Math.min(size.height-height,Math.round((cursor.y-bounds.y)*scaleY-height/2)));
  return {x,y,width,height};
}
module.exports={captureRegion};
