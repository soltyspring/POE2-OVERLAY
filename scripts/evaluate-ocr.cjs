// electron scripts/evaluate-ocr.cjs output-directory [image-directory]
const {app,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {OcrWorker}=require('../src/ocr-worker.cjs');
const {Market}=require('../src/market.cjs');
const {encodeBitmap,isolateLabels}=require('../src/ocr-bitmap.cjs');
const {recognizeLabels}=require('../src/label-pipeline.cjs');
const {scanLines}=require('../src/core.cjs');
const {evaluate}=require('../src/ocr-evaluation.cjs');
app.whenReady().then(async()=>{
  const output=process.argv[2],directory=process.argv[3]||app.getPath('temp');
  await fs.mkdir(output,{recursive:true});
  const dataset=JSON.parse(await fs.readFile(path.join(__dirname,'../test/fixtures/ocr-ground-truth.json'),'utf8'));
  const market=new Market();market.cacheDirectory=path.join(app.getPath('appData'),'poe2-overlay','dictionary-cache');
  const catalog=await market.loadCatalog(),worker=new OcrWorker(),results=[];
  let serial=0;
  const recognize=async(buffer,size)=>{
    const file=path.join(output,`input-${serial++}.bmp`);await fs.writeFile(file,encodeBitmap(buffer,size));
    try{return await worker.recognize(file);}finally{await fs.unlink(file);}
  };
  try{for(const entry of dataset.images){
    const file=path.join(directory,`codex-clipboard-${entry.id}.png`),image=nativeImage.createFromPath(file);
    if(image.isEmpty()){results.push({id:entry.id,error:'Image unavailable'});continue;}
    const size=image.getSize(),pixels=image.toBitmap();
    for(const [x,y,w,h] of entry.exclude||[])for(let row=Math.floor(y*size.height);row<Math.ceil((y+h)*size.height);row++)pixels.fill(0,(row*size.width+Math.floor(x*size.width))*4,(row*size.width+Math.min(size.width,Math.ceil((x+w)*size.width)))*4);
    const baseline=await recognize(size.width>=1200?isolateLabels(pixels):pixels,size);
    const labels=await recognizeLabels(pixels,size,catalog,recognize);
    for(const [mode,response] of [['baseline',baseline],['labels',labels]]){
      const rows=scanLines(response.lines,catalog,new Map());
      results.push({id:entry.id,scene:entry.scene,mode,size,score:evaluate(entry.labels,rows,size),metrics:response.metrics,lines:response.lines,rows});
    }
    await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify({id:entry.id,results:results.slice(-2).map(r=>({mode:r.mode,score:{...r.score,matches:undefined},metrics:r.metrics}))}));
  }}finally{worker.stop();}
  app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
