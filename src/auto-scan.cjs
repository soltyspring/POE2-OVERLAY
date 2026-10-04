class AutoScan {
  constructor(scan,isBusy,interval=3000) { this.scan=scan;this.isBusy=isBusy;this.interval=interval;this.timer=null;this.active=false; }
  async tick() {
    if (this.active || this.isBusy()) return;
    this.active=true;
    try {await this.scan(true);} catch {} finally {this.active=false;}
  }
  set(enabled) { this.stop();if(enabled) this.timer=setInterval(()=>this.tick(),this.interval); }
  stop() { if(this.timer) clearInterval(this.timer);this.timer=null; }
}
module.exports={AutoScan};
