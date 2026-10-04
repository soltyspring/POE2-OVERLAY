// Run with Electron: electron scripts/benchmark-images.cjs manifest.json output-dir
// The manifest lists explicit user-provided images; no clipboard folder sweep.
const {app,desktopCapturer,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {OcrWorker}=require('../src/ocr-worker.cjs');
const {Market}=require('../src/market.cjs');
const {scanLines}=require('../src/core.cjs');
const {encodeBitmap,isolateLabels}=require('../src/ocr-bitmap.cjs');
const {labelRegions,packLabels,restoreLines}=require('../src/label-regions.cjs');
const {retryRegions,isolateYellow,padBitmap,mergeRetry}=require('../src/ocr-retry.cjs');
app.whenReady().then(async()=>{
  const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8')),output=process.argv[3];
  await fs.mkdir(output,{recursive:true});
  const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:2600,height:2600},fetchWindowIcons:false});
  for(let i=0;i<sources.length;i++){
    const file=path.join(output,`live-monitor-${i}.png`);await fs.writeFile(file,sources[i].thumbnail.toPNG());
    manifest.push({file,live:true});
  }
  const market=new Market();market.cacheDirectory=path.join(app.getPath('appData'),'poe2-overlay','dictionary-cache');
  const catalog=await market.loadCatalog(),worker=new OcrWorker(),results=[];
  try{for(let i=0;i<manifest.length;i++){
    const entry=manifest[i],started=Date.now();
    const original=nativeImage.createFromPath(entry.file);if(original.isEmpty())throw new Error('Missing image: '+entry.file);
    const size=original.getSize(),bitmap=original.toBitmap();
    // Full screenshots include a visible overlay on the right. Exclude its
    // text when checking game labels; leave the stored original untouched.
    if(size.width>=1200)for(let y=0;y<size.height;y++)bitmap.fill(0,(y*size.width+Math.floor(size.width*.78))*4,(y+1)*size.width*4);
    const useRegions=size.width>=1200&&size.height>=700,regions=useRegions?labelRegions(bitmap,size):[];
    const filtered=useRegions?isolateLabels(bitmap,size):bitmap;
    const packed=process.env.POE_OCR_PACKED==='1'&&useRegions&&regions.every(r=>r.height<=80)?packLabels(filtered,size,regions):null;
    const file=path.join(output,`input-${i}.bmp`);await fs.writeFile(file,encodeBitmap(packed?.buffer||filtered,packed||size));
    let recognized=await worker.recognize(file);
    if(packed){recognized.lines=restoreLines(recognized.lines,packed.placements);
      if(!scanLines(recognized.lines,catalog,new Map()).length){
        const full=path.join(output,`fallback-${i}.bmp`);await fs.writeFile(full,encodeBitmap(filtered,size));
        const retry=await worker.recognize(full);retry.metrics.cpuMs+=recognized.metrics.cpuMs;retry.metrics.ocrMs+=recognized.metrics.ocrMs;recognized=retry;
      }
    }
    const retryBitmap=nativeImage.createFromBitmap(bitmap,size);
    for(const [n,region] of retryRegions(recognized.lines,catalog,size).entries()){
      const crop=retryBitmap.crop(region),padded=padBitmap(isolateYellow(crop.toBitmap(),crop.getSize()),crop.getSize());
      const enhanced=nativeImage.createFromBitmap(padded.buffer,padded).resize({width:padded.width*2,height:padded.height*2,quality:'best'});
      const retryFile=path.join(output,`retry-${i}-${n}.png`);await fs.writeFile(retryFile,enhanced.toPNG());
      const retry=await worker.recognize(retryFile);recognized.lines=mergeRetry(recognized.lines,retry.lines,region,40);
      recognized.metrics.cpuMs+=retry.metrics.cpuMs;recognized.metrics.ocrMs+=retry.metrics.ocrMs;
    }
    const rows=scanLines(recognized.lines,catalog,new Map());
    const result={file:entry.file,live:!!entry.live,size,packed:!!packed,totalMs:Date.now()-started,metrics:recognized.metrics,items:rows.map(r=>({name:r.name,type:r.type,count:r.count,kind:r.kind})),lines:recognized.lines};
    results.push(result);await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({...result,lines:undefined}));
  }}finally{worker.stop();}
  console.log('DONE '+output);app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
