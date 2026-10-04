const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, clipboard, shell } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Market } = require('./market.cjs');
const { scanLines, parseItem, tradeQuery } = require('./core.cjs');
const market = new Market();
let win, busy = false, league = 'Standard';
function send(event, value) { if (win && !win.isDestroyed()) win.webContents.send(event, value); }
async function scan() {
  if (busy) return;
  busy = true;
  let folder;
  try {
    send('status', '게임 화면 캡처 중…');
    const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 2400, height: 1350 } });
    const games = sources.filter(s => /path of exile 2/i.test(s.name));
    if (games.length !== 1) throw new Error('Path of Exile 2 게임 창 하나를 열어 주세요. 창 모드 또는 테두리 없는 창 모드를 사용하세요.');
    if (games[0].thumbnail.isEmpty()) throw new Error('게임 화면을 캡처할 수 없습니다.');
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'poe2-scan-'));
    const image = path.join(folder, 'capture.png');
    await fs.writeFile(image, games[0].thumbnail.toPNG());
    const lines = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '../scripts/ocr.ps1'), '-ImagePath', image], { windowsHide: true, timeout: 45000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr.trim() || error.message));
      try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, ''))); } catch { reject(new Error('OCR 결과를 읽을 수 없습니다.')); }
    }));
    send('status', '한국어 사전·시세 불러오는 중…');
    const data = await market.load(league);
    const rows = scanLines(lines, data.catalog, data.prices);
    const uniques = rows.filter(row => row.kind === 'unique');
    const byName = new Map();
    for (const row of uniques) {
      if (!byName.has(row.uniqueName) && byName.size >= 5) { row.status = '이번 스캔 고유 검색 5종 한도 · 복사 후 조회'; continue; }
      try {
        send('status', `고유 이름 시세 조회: ${row.uniqueName}…`);
        let result = byName.get(row.uniqueName);
        if (!result) {
          result = await market.search(league, tradeQuery({ name: row.uniqueName, type: row.type, rarity: '고유', filters: [] }), data.prices);
          byName.set(row.uniqueName, result);
        }
        row.url = result.url;
        if (result.prices.length) {
          row.unitEx = result.prices[Math.floor(result.prices.length / 2)];
          row.totalEx = row.unitEx * row.count;
          row.status = `이름 기준 매물 ${result.prices.length}개 중앙값 · 옵션 미반영`;
        } else row.status = '환산 가능한 비교 매물 없음';
      } catch (error) { row.status = error.message; byName.set(row.uniqueName, { prices: [] }); }
    }
    rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
    send('rows', { rows, updatedAt: data.updatedAt, league, warnings: data.warnings });
    win.showInactive();
    send('status', `스캔 완료 · OCR ${lines.length}줄 · F8 숨기기/표시`);
  } catch (error) { send('status', error.message); win?.showInactive(); }
  finally { if (folder) await fs.rm(folder, { recursive: true, force: true }); busy = false; }
}
app.whenReady().then(() => {
  win = new BrowserWindow({ width: 570, height: 730, alwaysOnTop: true, title: 'PoE2 드랍 시세', backgroundColor: '#111820', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const ok = globalShortcut.register('F7', scan);
  const toggle = globalShortcut.register('F8', () => win.isVisible() ? win.hide() : win.showInactive());
  win.webContents.once('did-finish-load', () => send('status', ok && toggle ? 'F7 게임 화면 스캔 · F8 표시/숨기기' : '단축키가 다른 앱에서 사용 중입니다. 스캔 버튼을 이용하세요.'));
  if (process.argv.includes('--smoke-test')) win.webContents.once('did-finish-load', async () => {
    try {
      const ready = await win.webContents.executeJavaScript("Boolean(window.poe && document.getElementById('scan') && document.getElementById('item'))");
      if (!ready) throw new Error('Renderer/preload not ready');
      const image = await win.webContents.capturePage();
      await fs.writeFile(path.join(os.tmpdir(), 'poe2-overlay-ui-smoke.png'), image.toPNG());
      console.log('UI smoke passed: renderer, sandboxed preload, capturePage');
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  });
});
ipcMain.handle('scan', scan);
ipcMain.handle('league', (_event, value) => { if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error('리그 이름을 입력하세요.'); league = value.trim(); });
ipcMain.handle('item', async () => {
  if (busy) throw new Error('현재 조회가 끝난 뒤 다시 시도하세요.');
  busy = true;
  try {
    const item = parseItem(clipboard.readText(), await market.stats());
    const data = await market.load(league);
    const result = await market.search(league, tradeQuery(item), data.prices);
    return { ...result, item };
  } finally { busy = false; }
});
ipcMain.handle('open', async (_event, url) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://poe.kakaogames.com' || !parsed.pathname.startsWith('/trade2/search/')) throw new Error('허용되지 않은 거래 링크입니다.');
  await shell.openExternal(url);
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
