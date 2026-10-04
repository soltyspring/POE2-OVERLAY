const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, clipboard, shell, screen } = require('electron');
const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Market } = require('./market.cjs');
const { scanLines, parseItem, tradeQuery, applyGearPrices } = require('./core.cjs');
const { WindowState } = require('./window-state.cjs');
const {OcrWorker} = require('./ocr-worker.cjs');
const {AutoScan} = require('./auto-scan.cjs');
const ocr = new OcrWorker();
const market = new Market({exchangeUrl:process.env.POE_EXCHANGE_URL ?? 'https://poe-exchange.tail37463f.ts.net'});
let win, windowState, busy = false, league = 'Forbidden Rites';
const autoScan = new AutoScan(scan,()=>busy);
let lastHash=null,lastOcr=null;
function send(event, value) { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(event, value); }
function setBusy(value) { busy = value; send('busy', value); }
async function scan(automatic = false) {
  if (busy) { send('status', '현재 조회가 끝난 뒤 다시 시도하세요.'); return; }
  setBusy(true);
  const scanLeague = league;
  const started=Date.now();
  let folder;
  try {
    send('status', '전체 화면 캡처 중…');
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 2400, height: 1350 } });
    const source = sources.find(s => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : null);
    if (!source) throw new Error('마우스가 있는 모니터를 찾을 수 없습니다.');
    if (source.thumbnail.isEmpty()) throw new Error('전체 화면을 캡처할 수 없습니다.');
    folder = await fs.mkdtemp(path.join(os.tmpdir(), 'poe2-scan-'));
    const image = path.join(folder, 'capture.png');
    const png=source.thumbnail.toPNG();
    const hash=createHash('sha256').update(png).digest('hex');
    await fs.writeFile(image, png);
    windowState.show();
    const reused=hash===lastHash && lastOcr;
    const [recognized,data]=await Promise.all([reused ? Promise.resolve(lastOcr) : ocr.recognize(image),market.load(scanLeague)]);
    lastHash=hash;lastOcr=recognized;
    const lines=recognized.lines;
    const rows = scanLines(lines, data.catalog, data.prices);
    const emit=()=>{
      rows.sort((a,b)=>(b.totalEx??-1)-(a.totalEx??-1));
      send('rows',{rows,updatedAt:data.updatedAt,priceSource:data.priceSource,league:scanLeague,warnings:data.warnings});
    };
    emit(); // Show currency/reward prices before slower trade-site enrichment.
    const uniques = rows.filter(row => row.kind === 'unique' || (row.kind === 'candidate' && row.type) || (row.kind === 'gem' && row.level));
    const byName = new Map();
    for (const row of uniques) {
      const candidate = row.kind === 'candidate';
      const searchKey = row.kind === 'gem' ? `gem:${row.type}:${row.level}` : candidate ? `base:${row.type}` : `name:${row.uniqueName}:${row.type}`;
      if (!byName.has(searchKey) && byName.size >= 5) { row.status = '이번 스캔 장비·젬 검색 5종 한도 · 복사 후 조회'; continue; }
      try {
        send('status', row.kind === 'gem' ? `레벨 ${row.level} 젬 최저 매물 조회: ${row.type}…` : candidate ? `고유 후보 최저 매물 조회: ${row.type}…` : `고유 이름 시세 조회: ${row.uniqueName}…`);
        let result = byName.get(searchKey);
        if (!result) {
          const query=tradeQuery({ kind:row.kind, level:row.level, name: candidate ? null : row.uniqueName, type: row.type, rarity: '고유', filters: [] });
          if (automatic) {
            const cached=market.cache.get(JSON.stringify([scanLeague,query]));
            if (!cached || Date.now()-cached.time >= 60000) {row.status='F6으로 상세 매물 조회 · 자동 스캔은 집계 시세 우선';continue;}
            result=cached.value;
          } else result = await market.search(scanLeague, query, data.prices);
          byName.set(searchKey, result);
        }
        applyGearPrices(row, result);
        if (!automatic) emit();
      } catch (error) { row.status = error.message; byName.set(searchKey, { prices: [] }); }
    }
    rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
    send('rows', { rows, updatedAt: data.updatedAt, priceSource:data.priceSource, league: scanLeague, warnings: data.warnings });
    windowState.show();
    send('status', `스캔 ${Date.now()-started}ms · ${recognized.metrics.engine} ${reused ? '화면 동일, OCR 재사용' : recognized.metrics.ocrMs+'ms'} · OCR 메모리 ${recognized.metrics.rssMB}MB · F8 숨기기/표시`);
  } catch (error) { send('status', error.message); windowState?.show(); }
  finally {
    try { if (folder) await fs.rm(folder, { recursive: true, force: true }); }
    catch (error) { console.error('Temporary capture cleanup failed:', error.message); }
    finally { setBusy(false); }
  }
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
app.on('second-instance', () => { if (windowState) { windowState.visible = true; windowState.show(); win.focus(); } });
app.whenReady().then(() => {
  win = new BrowserWindow({ width: 570, height: 730, minWidth: 450, minHeight: 400, minimizable: false, focusable: true, alwaysOnTop: true, title: 'PoE2 드랍 시세', backgroundColor: '#111820', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  windowState = new WindowState(win);
  // Windows 10 2004+: exclude our window from capture instead of hiding it on click.
  win.setContentProtection(true);
  windowState.pin();
  win.on('focus', () => windowState.pin());
  win.on('show', () => windowState.pin());
  win.on('restore', () => windowState.pin());
  let rendererRecoveries = 0;
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer stopped:', details.reason);
    if (details.reason !== 'clean-exit' && !win.isDestroyed() && rendererRecoveries < 2) {
      rendererRecoveries++;
      win.reload();
    }
  });
  win.webContents.on('did-finish-load', () => {send('busy', busy);send('auto-state',!!autoScan.timer);});
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const ok = globalShortcut.register('F6', () => scan(false));
  const toggle = globalShortcut.register('F8', () => windowState.toggle());
  win.webContents.once('did-finish-load', () => send('status', ok && toggle ? 'F6 전체 화면 스캔 · F8 표시/숨기기' : '단축키가 다른 앱에서 사용 중입니다. 스캔 버튼을 이용하세요.'));
  if (process.argv.includes('--smoke-test')) win.webContents.once('did-finish-load', async () => {
    try {
      const ready = await win.webContents.executeJavaScript("Boolean(window.poe && document.getElementById('scan') && document.getElementById('item'))");
      if (!ready) throw new Error('Renderer/preload not ready');
      win.setContentProtection(false);
      const image = await win.webContents.capturePage();
      await fs.writeFile(path.join(os.tmpdir(), 'poe2-overlay-ui-smoke.png'), image.toPNG());
      console.log('UI smoke passed: renderer, sandboxed preload, capturePage');
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  });
}).catch(error => { console.error('Startup failed:', error); app.quit(); });
}
ipcMain.handle('scan', () => scan(false));
ipcMain.handle('auto',(_event,enabled)=>{if(typeof enabled!=='boolean') throw new Error('자동 스캔 설정 오류');autoScan.set(enabled);return enabled;});
ipcMain.handle('league', (_event, value) => { if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error('리그 이름을 입력하세요.'); league = value.trim(); });
ipcMain.handle('item', async () => {
  if (busy) throw new Error('현재 조회가 끝난 뒤 다시 시도하세요.');
  setBusy(true);
  const itemLeague = league;
  try {
    const text = clipboard.readText();
    const item = parseItem(text, await market.stats());
    const data = await market.load(itemLeague);
    const result = await market.search(itemLeague, tradeQuery(item), data.prices);
    return { ...result, item };
  } finally { setBusy(false); }
});
ipcMain.handle('open', async (_event, url) => {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://poe.kakaogames.com' || !parsed.pathname.startsWith('/trade2/search/')) throw new Error('허용되지 않은 거래 링크입니다.');
  await shell.openExternal(url);
});
app.on('will-quit', () => {autoScan.stop();ocr.stop();globalShortcut.unregisterAll();});
app.on('window-all-closed', () => app.quit());
