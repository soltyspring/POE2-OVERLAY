// Keep explicit user visibility separate from asynchronous scan completion.
class WindowState {
  constructor(window) { this.window = window; this.visible = true; }
  alive() { return !this.window.isDestroyed(); }
  pin() {
    if (!this.alive() || !this.visible) return;
    this.window.setAlwaysOnTop(true, 'screen-saver');
    this.window.setIgnoreMouseEvents(false);
  }
  show() {
    if (!this.alive() || !this.visible) return;
    if (this.window.isMinimized()) this.window.restore();
    this.pin();
    if (!this.window.isVisible()) this.window.showInactive();
  }
  toggle() {
    if (!this.alive()) return;
    this.visible = !this.visible;
    if (this.visible) this.show(); else this.window.hide();
  }
}
module.exports = { WindowState };
