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
function isolateLabels(pixels){
  const result=Buffer.allocUnsafe(pixels.length);
  for(let i=0;i<pixels.length;i+=4){
    const b=pixels[i],g=pixels[i+1],r=pixels[i+2];
    const blue=b>140&&b>r*1.35&&g>65;
    const yellow=r>160&&g>140&&b<g*.7;
    const white=r>170&&g>170&&b>170;
    const value=blue||yellow||white?0:255;
    result[i]=result[i+1]=result[i+2]=value;result[i+3]=255;
  }
  return result;
}
module.exports.isolateLabels=isolateLabels;
