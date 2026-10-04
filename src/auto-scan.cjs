class AutoScan {
  constructor(scan,isBusy,interval=3000) { this.scan=scan;this.isBusy=isBusy;this.interval=interval;this.timer=null;this.active=false; }
  async tick() {
    if (this.active || this.isBusy()) return;
    this.active=true;
    try {await this.scan(true);} catch {} finally {this.active=false;}
  }
  set(enabled) { this.stop();if(enabled) this.timer=setInterval(()=>this.tick(),this.interval); }
  setIntervalMs(interval) {
    if (![3000,5000,10000].includes(interval)) throw new Error('자동 스캔 간격은 3·5·10초입니다.');
    const enabled=!!this.timer;this.interval=interval;this.set(enabled);
  }
  stop() { if(this.timer) clearInterval(this.timer);this.timer=null; }
}
module.exports={AutoScan};
