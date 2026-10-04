// Keep explicit user visibility separate from asynchronous scan completion.
class WindowState {
  constructor(window) { this.window = window; this.visible = true;this.capturing=false; }
  alive() { return !this.window.isDestroyed(); }
  pin() {
    if (!this.alive() || !this.visible || this.capturing) return;
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setIgnoreMouseEvents(false);
  }
  show() {
    if (!this.alive() || !this.visible || this.capturing) return;
    if (this.window.isMinimized()) this.window.restore();
    this.pin();
    if (!this.window.isVisible()) this.window.showInactive();
  }
  async capture(callback,settle=()=>new Promise(resolve=>setTimeout(resolve,100))) {
    if(this.capturing)throw new Error('화면 캡처 중입니다.');
    const restore=this.alive()&&this.window.isVisible();
    this.capturing=true;
    try {
      if(restore){this.window.hide();await settle();}
      return await callback();
    } finally {this.capturing=false;if(restore)this.show();}
  }
  toggle() {
    if (!this.alive()) return;
    this.visible = !this.visible;
    if (this.visible) this.show(); else this.window.hide();
  }
}
module.exports = { WindowState };
