const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowState } = require('../src/window-state.cjs');
function fakeWindow() {
  return { visible: true, minimized: false, destroyed: false, calls: [],
    isDestroyed() { return this.destroyed; }, isVisible() { return this.visible; }, isMinimized() { return this.minimized; },
    setAlwaysOnTop(...args) { this.calls.push(['top', ...args]); },
    setIgnoreMouseEvents(value) { this.calls.push(['ignoreMouse', value]); },
    hide() { this.visible = false; this.calls.push(['hide']); },
    restore() { this.minimized = false; this.calls.push(['restore']); },
    showInactive() { this.visible = true; this.calls.push(['show']); } };
}
test('스캔 완료·실패 뒤에도 사용자가 F8로 숨긴 상태를 유지한다', () => {
  const window = fakeWindow(), state = new WindowState(window);
  state.toggle(); state.show(); state.pin();
  assert.equal(window.visible, false); assert.deepEqual(window.calls,[['hide']]);
  state.toggle(); assert.equal(window.visible,true);
});
test('표시 상태의 창은 최상위·클릭 가능 상태를 유지하며 불필요하게 숨기지 않는다', () => {
  const window = fakeWindow(), state = new WindowState(window);
  state.show(); state.pin();
  assert.ok(window.calls.some(c => c[0] === 'top' && c[2] === 'screen-saver'));
  assert.ok(window.calls.some(c => c[0] === 'ignoreMouse' && c[1] === false));
  assert.ok(!window.calls.some(c => c[0] === 'hide' || c[0] === 'show'));
});
test('최소화 복구와 닫힌 창에 대한 비동기 완료를 처리한다', () => {
  const window = fakeWindow(), state = new WindowState(window);
  window.minimized = true; state.show(); assert.equal(window.minimized,false);
  window.destroyed = true; const count = window.calls.length;
  state.show(); state.pin(); state.toggle(); assert.equal(window.calls.length,count);
});
test('캡처 동안만 숨기고 성공·실패 모두 비활성 표시로 복구한다',async()=>{
  const window=fakeWindow(),state=new WindowState(window);
  const result=await state.capture(async()=>{assert.equal(window.visible,false);state.show();assert.equal(window.visible,false);return 123;},async()=>{});
  assert.equal(result,123);assert.equal(window.visible,true);
  await assert.rejects(state.capture(async()=>{throw Error('capture failed');},async()=>{}),/capture failed/);
  assert.equal(window.visible,true);assert.equal(state.capturing,false);
});
test('캡처 중 사용자 숨김이나 창 종료를 복원으로 덮어쓰지 않는다',async()=>{
  const window=fakeWindow(),state=new WindowState(window);
  await state.capture(async()=>state.toggle(),async()=>{});assert.equal(window.visible,false);
  state.toggle();await state.capture(async()=>{window.destroyed=true;},async()=>{});
  assert.equal(state.capturing,false);assert.equal(window.calls.at(-1)[0],'hide');
});
