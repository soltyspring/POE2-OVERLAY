const {OcrWorker}=require('../src/ocr-worker.cjs');
const {Market}=require('../src/market.cjs');
const {scanLines}=require('../src/core.cjs');
(async()=>{
  const image=process.argv[2];if(!image)throw new Error('이미지 경로가 필요합니다.');
  const league=process.argv[3]||'Forbidden Rites';
  const worker=new OcrWorker();
  const market=new Market({exchangeUrl:process.env.POE_EXCHANGE_URL||'https://poe-exchange.tail37463f.ts.net'});
  try {for(let i=0;i<3;i++){
    const start=Date.now();
    const [result,data]=await Promise.all([worker.recognize(image),market.load(league)]);
    const rows=scanLines(result.lines,data.catalog,data.prices);
    console.log(JSON.stringify({run:i,elapsedMs:Date.now()-start,...result.metrics,priceSource:data.priceSource,recognizedRows:rows.length,pricedRows:rows.filter(r=>r.totalEx!==null).length,warnings:data.warnings}));
  }} finally {worker.stop();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
