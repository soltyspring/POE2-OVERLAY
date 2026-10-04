const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, clipboard, shell, screen } = require('electron');
const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Market } = require('./market.cjs');
const { scanLines, parseItem, tradeQuery, applyGearPrices } = require('./core.cjs');
const { WindowState } = require('./window-state.cjs');
const {OcrWorker} = require('./ocr-worker.cjs');
const {captureRegion} = require('./capture-region.cjs');
const {readGeometry,saveGeometry}=require('./window-geometry.cjs');
const ocr = new OcrWorker();
const market = new Market({exchangeUrl:process.env.POE_EXCHANGE_URL ?? 'https://poe-exchange.tail37463f.ts.net'});
let win, windowState, busy = false;
const league = process.env.POE_LEAGUE || 'Forbidden Rites';
if (process.argv.includes('--smoke-test')) app.setPath('userData',path.join(os.tmpdir(),'poe2-overlay-smoke-profile'));
let lastHash=null,lastOcr=null;
let lastRowsSignature=null;
function send(event, value) { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(event, value); }
function setBusy(value) { busy = value; send('busy', value); }
function gearQuery(row){return tradeQuery({kind:row.kind,tier:row.tier,level:row.level,name:row.kind==='candidate'?null:row.uniqueName,type:row.type,rarity:'고유',filters:[]});}
function publishRows(rows,data) {
  const divineEx=data.prices.get('divine');
  const payload={rows:rows.map(row=>({...row,totalDivine:Number.isFinite(divineEx)&&divineEx>0&&row.totalEx!==null?row.totalEx/divineEx:null})),updatedAt:data.updatedAt,priceSource:data.priceSource,league,warnings:data.warnings};
  const signature=JSON.stringify(payload);
  if(signature!==lastRowsSignature){lastRowsSignature=signature;send('rows',payload);}
}
async function captureImage(mode) {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const nativeWidth=display.size.width*display.scaleFactor,nativeHeight=display.size.height*display.scaleFactor;
    const captureScale=Math.min(1,2400/nativeWidth,1350/nativeHeight);
    const sources = await windowState.capture(()=>desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(nativeWidth*captureScale), height: Math.round(nativeHeight*captureScale) },fetchWindowIcons:false }));

    const source = sources.find(s => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : null);
    if (!source) throw new Error('마우스가 있는 모니터를 찾을 수 없습니다.');
    if (source.thumbnail.isEmpty()) throw new Error('전체 화면을 캡처할 수 없습니다.');
    let thumbnail=source.thumbnail;
    const size=thumbnail.getSize();
    const region = captureRegion(mode, cursor, display.bounds, size);
    if (mode === 'mouse') thumbnail=thumbnail.crop(region);
    const hash=display.id+':'+JSON.stringify(region)+':'+createHash('sha256').update(thumbnail.toBitmap()).digest('hex');
    const reused=!!(hash===lastHash && lastOcr);
    let image,folder;
    if (!reused) {
      folder = await fs.mkdtemp(path.join(os.tmpdir(), 'poe2-scan-'));
      image = path.join(folder, 'capture.png');
      try {await fs.writeFile(image, thumbnail.toPNG());}
      catch(error){await fs.rm(folder,{recursive:true,force:true});throw error;}
    }
    return {hash,reused,image,folder,region};
}
async function scan(mode = 'full') {
  if (busy) { send('status', '현재 조회가 끝난 뒤 다시 시도하세요.'); return; }
  setBusy(true);
  send('health','loading');
  const scanLeague = league;
  const started=Date.now();
  let folder;
  try {
    send('status', mode === 'mouse' ? '마우스 주변 캡처 중…' : '전체 화면 캡처 중…');
    const captured=await captureImage(mode);
    const {hash,reused,image,region}=captured;folder=captured.folder;
    const captureMs=Date.now()-started;
    windowState.show();
    send('status', '아이템 이름 인식·시세 불러오는 중…');
    const ocrStarted=Date.now();
    const dataPromise=market.loadQuick(scanLeague);dataPromise.catch(()=>{});
    let resolvedData;dataPromise.then(data=>{resolvedData=data;},()=>{});
    const [recognized,catalog]=await Promise.all([reused ? Promise.resolve(lastOcr) : ocr.recognize(image),market.loadCatalog()]);
    const lines=recognized.lines.map(line=>({...line,x:line.x+region.x,y:line.y+region.y}));
    const firstResultMs=Date.now()-started;
    if(!resolvedData){
      const preview=scanLines(lines,catalog,new Map());
      for(const row of preview)row.status='가격 조회 중…';
      publishRows(preview,{prices:new Map(),warnings:[],updatedAt:null});
      send('status','아이템 인식 완료 · 가격 조회 중…');
    }
    const data=await dataPromise;
    const recognizeAndPriceMs=Date.now()-ocrStarted;
    lastHash=hash;lastOcr=recognized;
    const rows = scanLines(lines, data.catalog, data.prices);
    const emit=()=>{
      rows.sort((a,b)=>(b.totalEx??-1)-(a.totalEx??-1));
      publishRows(rows,data);
    };
    const gear = rows.filter(row => ['named-gear','base'].includes(row.kind) || row.kind === 'waystone' || row.kind === 'unique' || (row.kind === 'candidate' && row.type) || (row.kind === 'gem' && row.level));
    const uniques=[];
    for(const row of gear){
      const hit=market.cache.get(JSON.stringify([scanLeague,gearQuery(row)]));
      if(hit)applyGearPrices(row,hit.value);else uniques.push(row);
    }
    emit();
    const byName = new Map();
    for (const row of uniques) {
      const candidate = row.kind === 'candidate';
      const searchKey = ['named-gear','base'].includes(row.kind)?`gear-base:${row.type}`:row.kind==='waystone' ? `waystone:${row.tier}` : row.kind === 'gem' ? `gem:${row.type}:${row.level}` : candidate ? `base:${row.type}` : `name:${row.uniqueName}:${row.type}`;
      if (!byName.has(searchKey) && byName.size >= 5) { row.status = '이번 스캔 장비·젬 검색 5종 한도 · 복사 후 조회'; continue; }
      try {
        send('status', ['named-gear','base'].includes(row.kind)?`${row.type} 베이스 최저 매물 조회…`:row.kind==='waystone' ? `${row.tier}등급 경로석 매물 조회…` : row.kind === 'gem' ? `레벨 ${row.level} 젬 최저 매물 조회: ${row.type}…` : candidate ? `고유 후보 최저 매물 조회: ${row.type}…` : `고유 이름 시세 조회: ${row.uniqueName}…`);
        let result = byName.get(searchKey);
        if (!result) {
          const query=gearQuery(row);
          result = await market.search(scanLeague, query, data.prices);
          byName.set(searchKey, result);
        }
        applyGearPrices(row, result);
        emit();
      } catch (error) { row.status = error.message; byName.set(searchKey, { prices: [] }); }
    }
    rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
    emit();
    windowState.show();
    send('metrics',{...recognized.metrics,reused:!!reused,captureMs,recognizeAndPriceMs,firstResultMs,totalMs:Date.now()-started});
    send('status', `갱신 완료 · ${Date.now()-started}ms${reused?' · 같은 화면, 인식 재사용':''}`);
    send('health','ready');
  } catch (error) { send('health','error');send('status', error.message); windowState?.show(); }
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
  market.cacheDirectory=path.join(app.getPath('userData'),'dictionary-cache');
  const geometryFile=path.join(app.getPath('userData'),'window-geometry.json');
  const geometry=readGeometry(geometryFile,screen.getAllDisplays().map(display=>display.workArea));
  win = new BrowserWindow({ ...geometry, minWidth: Math.min(450,geometry.width), minHeight: Math.min(400,geometry.height), show:!process.argv.includes('--smoke-test'), minimizable: false, focusable: true, alwaysOnTop: true, title: 'PoE2 드랍 시세', backgroundColor: '#111820', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.on('close',()=>{if(!process.argv.includes('--smoke-test'))saveGeometry(geometryFile,win.getNormalBounds());});
  win.setOpacity(0.94);
  windowState = new WindowState(win);
  // Visible to screen sharing; hide only while desktopCapturer takes the frame.
  win.setContentProtection(false);
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
  win.webContents.on('did-finish-load', () => {lastRowsSignature=null;send('busy', busy);});
  win.loadFile(path.join(__dirname, 'index.html'));
  // Warm dictionaries and prices before the first hotkey without capturing the screen.
  if(!process.argv.includes('--smoke-test'))market.loadQuick(league).catch(error=>console.error('Price preload:',error.message));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const full = globalShortcut.register('F6', () => scan('full'));
  const mouse = globalShortcut.register('F7', () => scan('mouse'));
  win.webContents.once('did-finish-load', () => send('status', full && mouse ? 'F6 전체 화면 · F7 마우스 주변 캡처' : '단축키가 다른 앱에서 사용 중입니다. 스캔 버튼을 이용하세요.'));
  if (process.argv.includes('--smoke-test')) win.webContents.once('did-finish-load', async () => {
    try {
      const ready = await win.webContents.executeJavaScript("Boolean(window.poe && document.getElementById('scan') && document.getElementById('item'))");
      if (!ready) throw new Error('Renderer/preload not ready');
      send('rows',{rows:[{key:'example1',name:'상위 카오스 오브',count:3,totalEx:120,unitEx:40,status:'검증용 예시 시세',kind:'commodity',candidates:[]},{key:'example2',name:'무거운 허리띠',count:1,totalEx:null,unitEx:null,status:'종류·옵션 확인 필요',kind:'candidate',candidates:['고유 후보']}],league:'Forbidden Rites',priceSource:'검증용 예시',updatedAt:new Date().toISOString(),warnings:[]});
      await new Promise(resolve=>setTimeout(resolve,150));
      win.setContentProtection(false);
      const image = await win.webContents.capturePage();
      await fs.writeFile(path.join(os.tmpdir(), 'poe2-overlay-ui-smoke.png'), image.toPNG());
      console.log('UI smoke passed: renderer, sandboxed preload, capturePage');
      app.quit();
    } catch (error) { console.error(error); app.exit(1); }
  });
}).catch(error => { console.error('Startup failed:', error); app.quit(); });
}
ipcMain.handle('scan', (_event,mode='full') => {if (!['full','mouse'].includes(mode)) throw new Error('캡처 모드 오류');return scan(mode);});
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
  if (parsed.origin !== 'https://www.pathofexile.com' || !parsed.pathname.startsWith('/trade2/search/')) throw new Error('허용되지 않은 거래 링크입니다.');
  await shell.openExternal(url);
});
app.on('will-quit', () => {ocr.stop();globalShortcut.unregisterAll();});
app.on('window-all-closed', () => app.quit());
