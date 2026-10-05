// Windows nativeImage BGRA pixels become an uncompressed top-down BMP.
// Avoid PNG compression for short-lived OCR inputs.
function encodeBitmap(pixels,{width,height}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||pixels.length!==width*height*4)throw new Error('Invalid OCR bitmap');
  const result=Buffer.allocUnsafe(54+pixels.length);
  result.fill(0,0,54);result.write('BM');result.writeUInt32LE(result.length,2);
  result.writeUInt32LE(54,10);result.writeUInt32LE(40,14);
  result.writeInt32LE(width,18);result.writeInt32LE(-height,22);
  result.writeUInt16LE(1,26);result.writeUInt16LE(32,28);result.writeUInt32LE(pixels.length,34);
  pixels.copy(result,54);return result;
}
module.exports={encodeBitmap};
function isolateLabels(pixels,size,colors=[]){
  // Quantized palette lookup bounds work per pixel regardless of filter size.
  const palette=size?new Uint8Array(32768):null;
  for(const [r,g,b] of size?colors:[]){
    if(Math.max(r,g,b)<100)continue;
    for(let rr=Math.max(0,(r>>3)-2);rr<=Math.min(31,(r>>3)+2);rr++)
      for(let gg=Math.max(0,(g>>3)-2);gg<=Math.min(31,(g>>3)+2);gg++)
        for(let bb=Math.max(0,(b>>3)-2);bb<=Math.min(31,(b>>3)+2);bb++)palette[(rr<<10)|(gg<<5)|bb]=1;
  }
  const result=Buffer.allocUnsafe(pixels.length);
  const offsets=size?[-24,24,-size.width*24,size.width*24]:[];
  for(let i=0;i<pixels.length;i+=4){
    const b=pixels[i],g=pixels[i+1],r=pixels[i+2];
    const blue=b>140&&b>r*1.35&&g>65;
    const yellow=r>160&&g>140&&b<g*.7;
    const white=r>170&&g>170&&b>170;
    let ink=blue||yellow||white;
    const matched=palette?.[((r>>3)<<10)|((g>>3)<<5)|(b>>3)];
    if(!ink && size && (matched || Math.max(r,g,b)<100)){
      const p=i/4,x=p%size.width,y=Math.floor(p/size.width);
      let contrast=0,fb=-1,fg=0,fr=0;
      if(x>=6&&x<size.width-6&&y>=6&&y<size.height-6)for(let j=0;j<4;j++){
        const n=i+offsets[j];
        const brightness=(pixels[n]+pixels[n+1]+pixels[n+2])/3;
        if(!(matched?brightness<(r+g+b)/3-65:brightness>140))break;
        if(fb>=0&&(Math.abs(pixels[n]-fb)>22||Math.abs(pixels[n+1]-fg)>22||Math.abs(pixels[n+2]-fr)>22))break;
        fb=pixels[n];fg=pixels[n+1];fr=pixels[n+2];contrast++;
      }
      if(contrast===4)ink=true;
    }
    const value=ink?0:255;
    result[i]=result[i+1]=result[i+2]=value;result[i+3]=255;
  }
  return result;
}
module.exports.isolateLabels=isolateLabels;
