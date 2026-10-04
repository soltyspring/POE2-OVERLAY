const {OcrWorker}=require('../src/ocr-worker.cjs');
(async()=>{
  const image=process.argv[2];if(!image) throw new Error('이미지 경로가 필요합니다.');
  const worker=new OcrWorker();
  try {
    for(let i=0;i<4;i++) { const start=Date.now(); const result=await worker.recognize(image);
      console.log(JSON.stringify({run:i,wallMs:Date.now()-start,...result})); }
  } finally {worker.stop();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
