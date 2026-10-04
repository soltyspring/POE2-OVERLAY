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
