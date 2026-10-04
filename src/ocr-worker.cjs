const {spawn} = require('node:child_process');
const {createInterface} = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
class OcrWorker {
  constructor() { this.child=null; this.pending=null; this.lastError='';this.idleTimer=null; }
  start() {
    if (this.child) return;
    const python=process.env.POE_OCR_PYTHON || path.join(__dirname,'../.ocr-venv/Scripts/python.exe');
    const rapid=process.env.POE_OCR_ENGINE === 'rapidocr';
    if (rapid && !fs.existsSync(python)) throw new Error('RapidOCR Python이 없습니다. .ocr-venv를 설치하거나 POE_OCR_PYTHON을 설정하세요.');
    this.child=rapid ? spawn(python,['-u',path.join(__dirname,'../scripts/rapidocr-worker.py')],{windowsHide:true}) :
      spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'../scripts/ocr.ps1'),'-Worker'],{windowsHide:true});
    const child=this.child;
    this.lastError='';
    child.stderr.on('data',data=>{this.lastError=(this.lastError+data.toString()).slice(-2500);});
    createInterface({input:child.stdout}).on('line',line=>{
      if (this.child!==child || !this.pending) return;
      try {
        const response=JSON.parse(line.replace(/^\uFEFF/,''));
        const pending=this.pending; this.pending=null; clearTimeout(pending.timer);
        if (response.error) pending.reject(new Error(response.error)); else pending.resolve(response);
        this.idleTimer=setTimeout(()=>{if(!this.pending)this.stop();},60000);
        this.idleTimer.unref();
      } catch(error) { this.fail(error); }
    });
    child.on('error',error=>this.fail(error));
    child.on('exit',()=>{ if(this.child===child) {this.child=null;this.fail(new Error(this.lastError || 'OCR 프로세스 종료'));} });
    child.stdin.on('error',error=>this.fail(error));
  }
  fail(error) { if(this.pending) {const pending=this.pending;this.pending=null;clearTimeout(pending.timer);pending.reject(error);} }
  async recognize(image) {
    if (this.pending) throw new Error('OCR 중복 요청');
    clearTimeout(this.idleTimer);
    this.start();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.fail(new Error('OCR 시간 초과'));this.stop();},90000);
      this.pending={resolve,reject,timer};
      this.child.stdin.write(JSON.stringify({path:path.resolve(image)})+'\n');
    });
  }
  stop() { clearTimeout(this.idleTimer);const child=this.child;this.child=null;this.fail(new Error('OCR 중지'));child?.kill(); }
}
module.exports={OcrWorker};
