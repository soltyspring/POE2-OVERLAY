const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, clipboard, shell, screen,nativeImage } = require('electron');
const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Market } = require('./market.cjs');
const { scanLines, parseItem, tradeQuery, normalize } = require('./core.cjs');
const { WindowState } = require('./window-state.cjs');
const {OcrWorker} = require('./ocr-worker.cjs');
const {captureRegion} = require('./capture-region.cjs');
const {readGeometry,saveGeometry}=require('./window-geometry.cjs');
const {retryRegions,isolateYellow,padBitmap,mergeRetry}=require('./ocr-retry.cjs');
const {overlayMask,maskBitmap}=require('./capture-mask.cjs');
const {readCopiedItem}=require('./copied-item.cjs');
const {searchSale}=require('./sale-search.cjs');
const {siteItemUrl}=require('./exchange.cjs');
const {encodeBitmap,isolateLabels}=require('./ocr-bitmap.cjs');
const {labelRegions,packLabels,restoreLines}=require('./label-regions.cjs');
const {FilterProfile}=require('./filter-profile.cjs');
const {mergeCurrencies}=require('./ocr-merge.cjs');
const {recognizeLabels}=require('./label-pipeline.cjs');
const {resolveCopiedBase}=require('./copied-base.cjs');
const {inspectCraftCandidate}=require('./craft-analysis.cjs');
const {withDeadline}=require('./search-deadline.cjs');
const filterProfile=new FilterProfile(path.join(app.getPath('documents'),'My Games','Path of Exile 2'));
const ocr = new OcrWorker();
const market = new Market({exchangeUrl:process.env.POE_EXCHANGE_URL ?? 'https://poe-exchange.tail37463f.ts.net'});
let win, windowState, trackerWindow, busy = false;
const trackerSlots = new Map();
let trackerStoreFile,trackerEnabled=false;
let hotkeyStoreFile;
let hotkeys={full:'F6',mouse:'F7'};
let hotkeyRegistered={full:false,mouse:false};
let pendingHotkeyAction=null;
let trackerSaveQueue=Promise.resolve();
const league = process.env.POE_LEAGUE || 'Forbidden Rites';
if (process.argv.includes('--smoke-test')) app.setPath('userData',path.join(os.tmpdir(),'poe2-overlay-smoke-profile'));
let lastHash=null,lastOcr=null;
let lastRowsSignature=null;
function send(event, value) { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(event, value); }
function setBusy(value) { busy = value; send('busy', value); }
function isScanAccelerator(value) {
  if(typeof value!=='string')return false;
  const parts=value.split('+');
  const key=parts.pop();
  const modifiers=parts;
  return /^F(?:[1-9]|1[0-2])$/.test(key)&&modifiers.every(modifier=>['Control','Alt','Shift'].includes(modifier))&&new Set(modifiers).size===modifiers.length;
}
function hotkeyState(){return {bindings:{...hotkeys},registered:{...hotkeyRegistered}};}
function publishHotkeys(){send('hotkeys',hotkeyState());}
function registerScanHotkey(action,accelerator=hotkeys[action]){
  const registered=globalShortcut.register(accelerator,()=>void scan(action));
  hotkeyRegistered[action]=registered;
  return registered;
}
async function restoreHotkeys(){
  try{
    const saved=JSON.parse(await fs.readFile(hotkeyStoreFile,'utf8'));
    if(isScanAccelerator(saved.full)&&!['F9','F10','Alt+F11'].includes(saved.full))hotkeys.full=saved.full;
    if(isScanAccelerator(saved.mouse)&&!['F9','F10','Alt+F11'].includes(saved.mouse))hotkeys.mouse=saved.mouse;
  }catch(error){if(error.code!=='ENOENT')console.error('Hotkey settings:',error.message);}
  if(hotkeys.full===hotkeys.mouse)hotkeys.mouse=hotkeys.full==='F7'?'F6':'F7';
}
async function saveHotkeys(next){
  const temporary=hotkeyStoreFile+'.tmp';
  await fs.mkdir(path.dirname(hotkeyStoreFile),{recursive:true});
  await fs.writeFile(temporary,JSON.stringify(next,null,2),'utf8');
  await fs.rename(temporary,hotkeyStoreFile);
}
function beginHotkeyCapture(action){
  if(!['full','mouse'].includes(action))throw new Error('변경할 수 없는 단축키입니다.');
  if(pendingHotkeyAction&&pendingHotkeyAction!==action)throw new Error('다른 단축키를 변경 중입니다.');
  pendingHotkeyAction=action;
  globalShortcut.unregister(hotkeys[action]);
  hotkeyRegistered[action]=false;
  publishHotkeys();
  return hotkeyState();
}
function cancelHotkeyCapture(action){
  if(pendingHotkeyAction!==action)return hotkeyState();
  pendingHotkeyAction=null;
  registerScanHotkey(action);
  publishHotkeys();
  return hotkeyState();
}
async function setScanHotkey(action,accelerator){
  if(!['full','mouse'].includes(action)||pendingHotkeyAction!==action)throw new Error('단축키 변경을 먼저 시작하세요.');
  if(!isScanAccelerator(accelerator))throw new Error('F1~F12 또는 Ctrl/Alt/Shift 조합만 사용할 수 있습니다.');
  if(hotkeys[action=== 'full'?'mouse':'full']===accelerator)throw new Error('두 스캔 기능에 같은 키를 지정할 수 없습니다.');
  if(['F9','F10','Alt+F11'].includes(accelerator))throw new Error('F9, F10, Alt+F11은 보관함 기능에서 사용 중입니다.');
  if(!registerScanHotkey(action,accelerator)){
    pendingHotkeyAction=null;
    registerScanHotkey(action,hotkeys[action]);
    publishHotkeys();
    throw new Error(`${accelerator.replace('Control','Ctrl')} 키를 등록하지 못했습니다. 다른 프로그램과 충돌하는지 확인하세요.`);
  }
  const previous=hotkeys[action],next={...hotkeys,[action]:accelerator};
  try{await saveHotkeys(next);}
  catch(error){
    globalShortcut.unregister(accelerator);
    hotkeyRegistered[action]=false;
    registerScanHotkey(action,previous);
    pendingHotkeyAction=null;
    publishHotkeys();
    throw new Error(`단축키를 저장하지 못했습니다: ${error.message}`);
  }
  hotkeys=next;
  pendingHotkeyAction=null;
  publishHotkeys();
  send('status',`단축키 저장됨 · ${accelerator.replace('Control','Ctrl')}`);
  return hotkeyState();
}
function trackerDesktopBounds() {
  const bounds=screen.getAllDisplays().map(display=>display.bounds);
  const left=Math.min(...bounds.map(rect=>rect.x)),top=Math.min(...bounds.map(rect=>rect.y));
  const right=Math.max(...bounds.map(rect=>rect.x+rect.width)),bottom=Math.max(...bounds.map(rect=>rect.y+rect.height));
  return {x:left,y:top,width:right-left,height:bottom-top};
}
function trackerPoint(slot) {
  const display=screen.getAllDisplays().find(entry=>String(entry.id)===String(slot.displayId));
  if(display&&Number.isFinite(slot.relativeX)&&Number.isFinite(slot.relativeY))return {
    x:display.bounds.x+Math.max(0,Math.min(1,slot.relativeX))*display.bounds.width,
    y:display.bounds.y+Math.max(0,Math.min(1,slot.relativeY))*display.bounds.height
  };
  return {x:slot.screenX,y:slot.screenY};
}
async function restoreTrackerSlots() {
  trackerStoreFile=path.join(app.getPath('userData'),'stash-tracker.json');
  try {
    const saved=JSON.parse(await fs.readFile(trackerStoreFile,'utf8'));
    if(saved?.version!==1||!Array.isArray(saved.slots))return;
    trackerEnabled=!!saved.enabled;
    for(const slot of saved.slots.slice(-500)){
      if(!slot||typeof slot.key!=='string'||typeof slot.name!=='string'||typeof slot.commodityId!=='string'||!Number.isSafeInteger(slot.stackSize)||slot.stackSize<1||!Number.isFinite(slot.unitEx)||slot.unitEx<0||!Number.isFinite(slot.totalEx)||slot.totalEx<0)continue;
      if(!Number.isFinite(slot.screenX)||!Number.isFinite(slot.screenY))continue;
      if(slot.displayId!==undefined&&(!Number.isFinite(slot.relativeX)||!Number.isFinite(slot.relativeY)||slot.relativeX<0||slot.relativeX>1||slot.relativeY<0||slot.relativeY>1))continue;
      trackerSlots.set(slot.key,{...slot});
    }
  } catch(error) {
    if(error.code!=='ENOENT')console.error('Stash tracker restore:',error.message);
  }
}
function persistTrackerSlots() {
  if(!trackerStoreFile)return Promise.resolve();
  const payload=JSON.stringify({version:1,enabled:trackerEnabled,slots:[...trackerSlots.values()].slice(-500)});
  trackerSaveQueue=trackerSaveQueue.catch(()=>{}).then(async()=>{
    await fs.mkdir(path.dirname(trackerStoreFile),{recursive:true});
    const temporary=`${trackerStoreFile}.tmp`;
    await fs.writeFile(temporary,payload,'utf8');
    await fs.rename(temporary,trackerStoreFile);
  });
  return trackerSaveQueue;
}
async function refreshTrackerPrices() {
  if(!trackerSlots.size)return;
  const leagues=[...new Set([...trackerSlots.values()].map(slot=>slot.league).filter(value=>typeof value==='string'&&value.length>0))];
  let changed=false;
  for(const activeLeague of leagues){
    try {
      const data=await market.loadExchange(activeLeague);
      for(const slot of trackerSlots.values())if(slot.league===activeLeague){
        const unitEx=data.prices.get(slot.commodityId);
        if(Number.isFinite(unitEx)&&unitEx>0){slot.unitEx=unitEx;slot.totalEx=unitEx*slot.stackSize;slot.source=data.priceSource;slot.updatedAt=data.updatedAt;changed=true;}
      }
    } catch(error) { console.error(`Stash tracker price refresh (${activeLeague}):`,error.message); }
  }
  if(changed){publishTrackerSlots();void persistTrackerSlots().catch(error=>console.error('Stash tracker save:',error.message));}
}
function publishTrackerSlots() {
  if(!trackerWindow||trackerWindow.isDestroyed()||trackerWindow.webContents.isDestroyed())return;
  const bounds=trackerDesktopBounds();
  trackerWindow.setBounds(bounds);
  const slots=[...trackerSlots.values()].map(slot=>{const point=trackerPoint(slot);return {...slot,x:point.x-bounds.x,y:point.y-bounds.y};});
  trackerWindow.webContents.send('stash-items',slots);
  send('stash-state',{enabled:trackerWindow.isVisible(),count:slots.length});
}
function showTrackerOverlay() {
  if(!trackerWindow||trackerWindow.isDestroyed())return;
  trackerEnabled=true;
  trackerWindow.setBounds(trackerDesktopBounds());
  trackerWindow.setIgnoreMouseEvents(true,{forward:true});
  trackerWindow.setAlwaysOnTop(true,'screen-saver');
  trackerWindow.showInactive();
  publishTrackerSlots();
}
function createTrackerOverlay() {
  trackerWindow=new BrowserWindow({
    ...trackerDesktopBounds(),show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,skipTaskbar:true,focusable:false,
    webPreferences:{preload:path.join(__dirname,'stash-overlay-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  trackerWindow.setIgnoreMouseEvents(true,{forward:true});
  trackerWindow.setAlwaysOnTop(true,'screen-saver');
  trackerWindow.setContentProtection(false);
  trackerWindow.loadFile(path.join(__dirname,'stash-overlay.html')).then(()=>{if(trackerEnabled)showTrackerOverlay();else publishTrackerSlots();}).catch(error=>console.error('Stash overlay startup:',error.message));
  trackerWindow.on('closed',()=>{trackerWindow=null;});
}
function removeNearestTrackerSlot() {
  const cursor=screen.getCursorScreenPoint();
  let nearest=null,distance=48;
  for(const slot of trackerSlots.values()){
    const point=trackerPoint(slot),next=Math.hypot(point.x-cursor.x,point.y-cursor.y);
    if(next<distance){nearest=slot;distance=next;}
  }
  if(!nearest){send('status','커서 근처에 등록된 가격표가 없습니다.');return;}
  trackerSlots.delete(nearest.key);
  publishTrackerSlots();
  void persistTrackerSlots().catch(error=>console.error('Stash tracker save:',error.message));
  send('status',`${nearest.name} 가격표를 제거했습니다.`);
}
async function pinCopiedCurrencyAtCursor() {
  if(busy){send('status','현재 조회가 끝난 뒤 F9를 다시 누르세요.');return;}
  const cursor=screen.getCursorScreenPoint();
  const display=screen.getDisplayNearestPoint(cursor);
  const relativeX=(cursor.x-display.bounds.x)/display.bounds.width,relativeY=(cursor.y-display.bounds.y)/display.bounds.height;
  setBusy(true);
  try {
    send('status','복사한 화폐의 환산가 확인 중…');
    const copied=parseItem(clipboard.readText(),[]);
    const catalog=await market.loadCatalog();
    const item=resolveCopiedBase(copied,catalog);
    const matches=catalog.filter(entry=>entry.kind==='commodity'&&normalize(entry.name)===normalize(item.type||''));
    if(matches.length!==1)throw new Error('F9 고정은 화폐 시세 사전에 정확히 있는 아이템만 지원합니다. 장비 옵션 감정과는 별도입니다.');
    const data=await market.loadQuick(league);
    const unitEx=data.prices.get(matches[0].id);
    if(!Number.isFinite(unitEx)||unitEx<=0)throw new Error('선택한 리그에 이 화폐의 환산가가 없습니다.');
    const stackSize=Number.isSafeInteger(copied.stackSize)&&copied.stackSize>0?copied.stackSize:1;
    const key=`${display.id}:${Math.round((cursor.x-display.bounds.x)/32)}:${Math.round((cursor.y-display.bounds.y)/32)}`;
    trackerSlots.set(key,{key,displayId:String(display.id),relativeX,relativeY,screenX:cursor.x,screenY:cursor.y,commodityId:matches[0].id,name:item.type,stackSize,unitEx,totalEx:unitEx*stackSize,league,source:data.priceSource,updatedAt:data.updatedAt});
    showTrackerOverlay();
    try{await persistTrackerSlots();send('status',`${item.type} · ${stackSize}개 · 가격표에 등록하고 저장했습니다.`);}
    catch(error){console.error('Stash tracker save:',error.message);send('status',`${item.type} · 가격표는 등록했지만 재실행 후 복원되도록 저장하지 못했습니다.`);}
  } catch(error){send('status',error.message);}
  finally{setBusy(false);}
}
function publishRows(rows,data) {
  const divineEx=data.prices.get('divine');
  const payload={rows:rows.map(row=>({...row,siteUrl:siteItemUrl(row,data,market.exchangeUrl,league),totalDivineMax:Number.isFinite(divineEx)&&divineEx>0&&Number.isFinite(row.totalExMax)?row.totalExMax/divineEx:null,totalDivine:Number.isFinite(divineEx)&&divineEx>0&&row.totalEx!==null?row.totalEx/divineEx:null})),updatedAt:data.updatedAt,priceSource:data.priceSource,league,warnings:data.warnings};
  const signature=JSON.stringify(payload);
  if(signature!==lastRowsSignature){lastRowsSignature=signature;send('rows',payload);}
}
async function captureImage(mode) {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const nativeWidth=display.size.width*display.scaleFactor,nativeHeight=display.size.height*display.scaleFactor;
    // Windows OCR accepts dimensions up to 2600px. Preserve native text sizes
    // on 1440p monitors instead of reducing every capture to 1350px high.
    const captureScale=Math.min(1,2600/nativeWidth,2600/nativeHeight);
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(nativeWidth*captureScale), height: Math.round(nativeHeight*captureScale) },fetchWindowIcons:false });

    const source = sources.find(s => s.display_id === String(display.id)) || (sources.length === 1 ? sources[0] : null);
    if (!source) throw new Error('마우스가 있는 모니터를 찾을 수 없습니다.');
    if (source.thumbnail.isEmpty()) throw new Error('전체 화면을 캡처할 수 없습니다.');
    let thumbnail=source.thumbnail;
    const size=thumbnail.getSize();
    const region = captureRegion(mode, cursor, display.bounds, size);
    if (mode === 'mouse') thumbnail=thumbnail.crop(region);
    const bitmap=thumbnail.toBitmap();
    const mask=win&&!win.isDestroyed()&&win.isVisible()?overlayMask(win.getBounds(),display.bounds,size,region):null;
    maskBitmap(bitmap,thumbnail.getSize(),mask);
    const filterAware=process.env.POE_OCR_FILTER_PROFILE==='1'||process.env.POE_OCR_LABEL_PIPELINE==='1';
    const colors=filterAware?await filterProfile.load():[];
    const hash=display.id+':'+JSON.stringify(region)+':'+filterProfile.signature+':'+createHash('sha256').update(bitmap).digest('hex');
    const reused=!!(hash===lastHash && lastOcr);
    let image,originalImage,folder,placements=null,ocrSize=null;
    if (!reused) {
      folder = await fs.mkdtemp(path.join(os.tmpdir(), 'poe2-scan-'));
      image = path.join(folder, 'capture.bmp');
      originalImage=path.join(folder,'original.bmp');
      try {
        const captureSize=thumbnail.getSize();
        const useRegions=process.env.POE_OCR_LABEL_PIPELINE!=='1'&&mode==='full'&&captureSize.width>=1200&&captureSize.height>=700;
        // F7 uses the original pixels already: retries can reuse this same file.
        if(useRegions)await fs.writeFile(originalImage,encodeBitmap(bitmap,captureSize));
        else originalImage=image;
        const labelBitmap=useRegions?(filterAware?isolateLabels(bitmap,captureSize,colors):isolateLabels(bitmap)):bitmap;
        // F7 and small captures already contain little background; packing can
        // hurt line segmentation there and offers little processing benefit.
        const regions=useRegions&&process.env.POE_OCR_PACKED==='1'?labelRegions(bitmap,captureSize):[];
        // Joined tall regions often contain effects crossing multiple labels.
        // Preserve the full-frame path rather than silently dropping a label.
        const packed=process.env.POE_OCR_PACKED==='1'&&useRegions&&regions.every(r=>r.height<=80)
          ?packLabels(labelBitmap,captureSize,regions):null;
        placements=packed?.placements||null;ocrSize=packed?{width:packed.width,height:packed.height}:thumbnail.getSize();
        await fs.writeFile(image,encodeBitmap(packed?.buffer||labelBitmap,ocrSize));
      }
      catch(error){await fs.rm(folder,{recursive:true,force:true});throw error;}
    }
    return {hash,reused,image,originalImage,folder,region,placements,ocrSize};
}
async function scan(mode = 'full') {
  if (busy) { send('status', '현재 조회가 끝난 뒤 다시 시도하세요.'); return; }
  setBusy(true);
  send('health','loading');
  const scanLeague = league;
  const started=Date.now();
  let folder,trackerWasVisible=false;
  try {
    send('status', mode === 'mouse' ? '마우스 주변 캡처 중…' : '전체 화면 캡처 중…');
    trackerWasVisible=!!trackerWindow&&!trackerWindow.isDestroyed()&&trackerWindow.isVisible();
    if(trackerWasVisible)trackerWindow.hide();
    const captured=await captureImage(mode);
    if(trackerWasVisible)showTrackerOverlay();
    const {hash,reused,image,originalImage,region,placements,ocrSize}=captured;folder=captured.folder;
    const captureMs=Date.now()-started;
    windowState.show();
    send('status', '아이템 이름 인식·시세 불러오는 중…');
    const ocrStarted=Date.now();

    const labelMode=process.env.POE_OCR_LABEL_PIPELINE==='1';
    let catalog,recognized;
    if(!labelMode)[recognized,catalog]=await Promise.all([reused?Promise.resolve(lastOcr):ocr.recognize(image),market.loadCatalog()]);
    else catalog=await market.loadCatalog();
    if(labelMode&&reused)recognized=lastOcr;
    else if(labelMode){
      const original=nativeImage.createFromPath(originalImage);let serial=0;
      recognized=await recognizeLabels(original.toBitmap(),original.getSize(),catalog,async(buffer,size)=>{
        const file=path.join(folder,`label-${serial++}.bmp`);await fs.writeFile(file,encodeBitmap(buffer,size));
        try{return await ocr.recognize(file);}finally{await fs.unlink(file);}
      },await filterProfile.load());
    }
    if(!reused&&placements){
      recognized.lines=restoreLines(recognized.lines,placements);
      recognized.metrics.labelRegions=placements.length;
      recognized.metrics.ocrPixels=ocrSize.width*ocrSize.height;
      if(!scanLines(recognized.lines,catalog,new Map()).length){
        const original=nativeImage.createFromPath(originalImage),fullSize=original.getSize();
        const fallbackFile=path.join(folder,'fallback.bmp');
        await fs.writeFile(fallbackFile,encodeBitmap(original.toBitmap(),fullSize));
        const fallback=await ocr.recognize(fallbackFile);
        fallback.metrics.ocrMs+=recognized.metrics.ocrMs;
        fallback.metrics.cpuMs+=recognized.metrics.cpuMs;
        fallback.metrics.labelFallback=true;recognized=fallback;
      }
    }
    if(!reused&&mode==='full'){
      const original=nativeImage.createFromPath(originalImage),size=original.getSize();
      const panel=require('./reward-panel.cjs').rewardPanel(original.toBitmap(),size);
      if(panel){
        const crop=original.crop(panel),file=path.join(folder,'reward-panel.bmp');
        await fs.writeFile(file,encodeBitmap(crop.toBitmap(),crop.getSize()));
        const reward=await ocr.recognize(file);
        const lines=reward.lines.map(line=>({...line,x:line.x+panel.x,y:line.y+panel.y}));
        recognized.lines=mergeCurrencies(recognized.lines,lines,catalog,['commodity','unpriced','gem']);
        recognized.metrics.ocrMs+=reward.metrics.ocrMs;recognized.metrics.cpuMs+=reward.metrics.cpuMs;
        recognized.metrics.rewardPanel=true;
      }
    }
    if(!labelMode&&!reused&&mode==='full'&&region.width>=1200&&scanLines(recognized.lines,catalog,new Map()).length<=3){
      const original=nativeImage.createFromPath(originalImage),size=original.getSize(),pixels=original.toBitmap();
      const boxes=labelRegions(pixels,size);
      if(boxes.length>=2&&boxes.length<=8){
        const sheet=packLabels(isolateLabels(pixels),size,boxes);
        if(sheet&&sheet.width<=1300&&sheet.height<=1300){
          const enlarged=nativeImage.createFromBitmap(sheet.buffer,sheet).resize({width:sheet.width*2,height:sheet.height*2,quality:'best'});
          const retryFile=path.join(folder,'labels.bmp');await fs.writeFile(retryFile,encodeBitmap(enlarged.toBitmap(),enlarged.getSize()));
          const retry=await ocr.recognize(retryFile);
          const lines=restoreLines(retry.lines.map(line=>({...line,x:line.x/2,y:line.y/2,width:line.width/2,height:line.height/2})),sheet.placements);
          recognized.lines=mergeCurrencies(recognized.lines,lines,catalog,['commodity','base','candidate']);
          recognized.metrics.ocrMs+=retry.metrics.ocrMs;recognized.metrics.cpuMs+=retry.metrics.cpuMs;
          recognized.metrics.regionRetry=true;
        }
      }
    }
    if(!labelMode&&!reused&&mode==='full'&&region.width>=1200&&region.height>=700){
      const original=await ocr.recognize(originalImage);
      const knownRows=scanLines(recognized.lines,catalog,new Map());
      if(knownRows.length)recognized.lines=mergeCurrencies(recognized.lines,original.lines,catalog);
      else {
        // Reward panels use dark text on bright parchment and disappear in the
        // default loot-label color filter. Recover only dictionary-matched
        // quantity rows from the original full-frame OCR to limit false hits.
        const quantityLines=original.lines.filter(line=>/^\s*(?:\d+|[lI])\s*(?:[x×]|\)\s*\()/i.test(line.text));
        const matchedLines=quantityLines.filter(line=>scanLines([line],catalog,new Map()).length>0);
        if(matchedLines.length){recognized.lines=matchedLines;recognized.metrics.quantityFallback=true;}
      }
      recognized.metrics.ocrMs+=original.metrics.ocrMs;
      recognized.metrics.cpuMs+=original.metrics.cpuMs;
      recognized.metrics.rssMB=Math.max(recognized.metrics.rssMB,original.metrics.rssMB);
    }
    const regions=!labelMode&&!reused&&process.env.POE_OCR_ENGINE!=='rapidocr'?retryRegions(recognized.lines,catalog,{width:region.width,height:region.height}):[];
    if(regions.length){
      const bitmap=nativeImage.createFromPath(originalImage);
      let retryMs=0;
      for(let i=0;i<regions.length;i++){
        const region=regions[i],crop=bitmap.crop(region),size=crop.getSize();
        const padded=padBitmap(isolateYellow(crop.toBitmap(),size),size);
        const enhanced=nativeImage.createFromBitmap(padded.buffer,{width:padded.width,height:padded.height}).resize({width:padded.width*2,height:padded.height*2,quality:'best'});
        const retryFile=path.join(folder,`retry-${i}.png`);
        try{
          await fs.writeFile(retryFile,enhanced.toPNG());
          const result=await ocr.recognize(retryFile);retryMs+=result.metrics.ocrMs;
          recognized={...recognized,lines:mergeRetry(recognized.lines,result.lines,region,40)};
        }catch(error){console.error('Label OCR retry:',error.message);}
      }
      recognized.metrics.retryMs=retryMs;
    }
    const lines=recognized.lines.map(line=>({...line,x:line.x+region.x,y:line.y+region.y}));
    const firstResultMs=Date.now()-started;
    {
      const preview=scanLines(lines,catalog,new Map());
      for(const row of preview)row.status='가격 조회 중…';
      publishRows(preview,{prices:new Map(),warnings:[],updatedAt:null});
      send('status','아이템 인식 완료 · 가격 조회 중…');
    }
    const rows=scanLines(lines,catalog,new Map());
    const data=await market.priceRows(scanLeague,rows,catalog);
    const recognizeAndPriceMs=Date.now()-ocrStarted;
    lastHash=hash;lastOcr=recognized;

    const emit=()=>{
      rows.sort((a,b)=>(b.totalEx??-1)-(a.totalEx??-1));
      publishRows(rows,data);
    };
    const gearStarted=Date.now();

    rows.sort((a, b) => (b.totalEx ?? -1) - (a.totalEx ?? -1));
    emit();
    windowState.show();
    send('metrics',{...recognized.metrics,reused:!!reused,captureMs,recognizeAndPriceMs,firstResultMs,gearSearchMs:Date.now()-gearStarted,totalMs:Date.now()-started});
    send('status', `갱신 완료 · ${Date.now()-started}ms${reused?' · 같은 화면, 인식 재사용':''}`);
    send('health',data.warnings.length?'error':'ready');
  } catch (error) { send('health','error');send('status', error.message); windowState?.show(); }
  finally {
    if(trackerWasVisible)showTrackerOverlay();
    try { if (folder) await fs.rm(folder, { recursive: true, force: true }); }
    catch (error) { console.error('Temporary capture cleanup failed:', error.message); }
    finally { setBusy(false); }
  }
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
app.on('second-instance', () => { if (windowState) { windowState.visible = true; windowState.show(); win.focus(); } });
app.whenReady().then(async () => {
  market.cacheDirectory=path.join(app.getPath('userData'),'dictionary-cache');
  hotkeyStoreFile=path.join(app.getPath('userData'),'scan-hotkeys.json');
  await restoreHotkeys();
  await restoreTrackerSlots();
  const geometryFile=path.join(app.getPath('userData'),'window-geometry.json');
  const geometry=readGeometry(geometryFile,screen.getAllDisplays().map(display=>display.workArea));
  win = new BrowserWindow({ ...geometry, minWidth: Math.min(450,geometry.width), minHeight: Math.min(400,geometry.height), show:!process.argv.includes('--smoke-test'), minimizable: false, focusable: true, alwaysOnTop: true, title: 'PoE2 드랍 시세', backgroundColor: '#111820', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.on('close',()=>{if(!process.argv.includes('--smoke-test'))saveGeometry(geometryFile,win.getNormalBounds());});
  win.on('closed',()=>{if(trackerWindow&&!trackerWindow.isDestroyed())trackerWindow.close();});
  win.setOpacity(0.9);
  windowState = new WindowState(win);
  // Visible to screen sharing; mask our rectangle in the OCR image without hiding.
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
  win.webContents.on('did-finish-load', () => {lastRowsSignature=null;send('busy', busy);send('stash-state',{enabled:!!trackerWindow&&!trackerWindow.isDestroyed()&&trackerWindow.isVisible(),count:trackerSlots.size});});
  win.loadFile(path.join(__dirname, 'index.html'));
  createTrackerOverlay();
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,()=>publishTrackerSlots());
  // Warm dictionaries and prices before the first hotkey without capturing the screen.
  if(!process.argv.includes('--smoke-test'))market.loadCatalog().catch(error=>console.error('Dictionary preload:',error.message));
  if(!process.argv.includes('--smoke-test'))void refreshTrackerPrices();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const full = registerScanHotkey('full');
  const mouse = registerScanHotkey('mouse');
  const stashCapture = globalShortcut.register('F9', () => { void pinCopiedCurrencyAtCursor(); });
  const stashToggle = globalShortcut.register('F10', () => {
    if(!trackerWindow||trackerWindow.isDestroyed())return;
    if(trackerWindow.isVisible()){trackerEnabled=false;trackerWindow.hide();}else showTrackerOverlay();
    publishTrackerSlots();
    void persistTrackerSlots().catch(error=>console.error('Stash tracker save:',error.message));
  });
  const stashRemove=globalShortcut.register('Alt+F11',removeNearestTrackerSlot);
  win.webContents.once('did-finish-load', () => {
    const failed=[!full?`전체 화면 ${hotkeys.full.replace('Control','Ctrl')}`:'',!mouse?`마우스 주변 ${hotkeys.mouse.replace('Control','Ctrl')}`:'',!stashCapture?'슬롯 등록 F9':'',!stashToggle?'가격표 표시 F10':'',!stashRemove?'슬롯 제거 Alt+F11':''].filter(Boolean);
    send('status',failed.length?`단축키 등록 실패: ${failed.join(', ')} · 단축키 설정에서 변경하세요.`:`전체 화면 ${hotkeys.full.replace('Control','Ctrl')} · 마우스 주변 ${hotkeys.mouse.replace('Control','Ctrl')} · F9 슬롯 등록 · F10 표시 전환 · Alt+F11 제거`);
    publishHotkeys();
  });
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
ipcMain.handle('hotkeys:get',()=>hotkeyState());
ipcMain.handle('hotkeys:begin',(_event,action)=>beginHotkeyCapture(action));
ipcMain.handle('hotkeys:cancel',(_event,action)=>cancelHotkeyCapture(action));
ipcMain.handle('hotkeys:set',(_event,action,accelerator)=>setScanHotkey(action,accelerator));
ipcMain.handle('item', async () => {
  if (busy) throw new Error('현재 조회가 끝난 뒤 다시 시도하세요.');
  setBusy(true);
  const itemLeague = league;
  const started=Date.now();
  let stage='clipboard';
  try {
    return await withDeadline(async(signal)=>{
    send('status','복사한 아이템 확인 중…');
    const copied = await readCopiedItem(()=>clipboard.readText(),()=>market.stats());
    signal.throwIfAborted();
    stage='base';
    const item=resolveCopiedBase(copied,await market.loadCatalog());
    stage='rates';
    send('status','환율 불러오는 중…');
    const data = await market.loadQuick(itemLeague);
    signal.throwIfAborted();stage='trade';send('status','옵션 비교 매물 검색 중…');
    const result = await searchSale(market,itemLeague,item,data.prices,signal);
    send('status',`옵션 비교 완료 · ${Date.now()-started}ms`);
    return { ...result, item, craftInspection:inspectCraftCandidate(item) };
    });
  } catch(error){
    send('status',error.message);
    const log=path.join(app.getPath('userData'),'search-errors.ndjson');
    try{const stat=await fs.stat(log).catch(()=>null);if(stat?.size>1048576)await fs.writeFile(log,'');await fs.appendFile(log,JSON.stringify({time:new Date().toISOString(),stage,durationMs:Date.now()-started,error:error.message})+'\n');}catch(logError){console.error('Search error log:',logError.message);}
    throw error;
  } finally { setBusy(false); }
});
ipcMain.handle('open', async (_event, url) => {
  const parsed = new URL(url);
  const site=market.exchangeUrl?new URL(market.exchangeUrl):null;
  const siteAllowed=site&&parsed.origin===site.origin&&parsed.pathname===site.pathname&&parsed.searchParams.has('item')&&parsed.searchParams.get('league')===league;
  if (!siteAllowed&&(parsed.origin !== 'https://www.pathofexile.com' || !parsed.pathname.startsWith('/trade2/search/'))) throw new Error('허용되지 않은 거래 링크입니다.');
  await shell.openExternal(url);
});
ipcMain.handle('stash-toggle',()=>{
  if(!trackerWindow||trackerWindow.isDestroyed())throw new Error('슬롯 오버레이를 시작할 수 없습니다.');
  if(trackerWindow.isVisible()){trackerEnabled=false;trackerWindow.hide();}else showTrackerOverlay();
  publishTrackerSlots();
  void persistTrackerSlots().catch(error=>console.error('Stash tracker save:',error.message));
  return {enabled:trackerWindow.isVisible(),count:trackerSlots.size};
});
ipcMain.handle('stash-remove-at-cursor',()=>{
  const before=trackerSlots.size;
  removeNearestTrackerSlot();
  return {enabled:!!trackerWindow&&!trackerWindow.isDestroyed()&&trackerWindow.isVisible(),count:trackerSlots.size,removed:trackerSlots.size<before};
});
ipcMain.handle('stash-clear',async()=>{
  trackerSlots.clear();
  publishTrackerSlots();
  await persistTrackerSlots();
  return {enabled:!!trackerWindow&&!trackerWindow.isDestroyed()&&trackerWindow.isVisible(),count:0};
});
app.on('will-quit', () => {ocr.stop();globalShortcut.unregisterAll();});
app.on('window-all-closed', () => app.quit());
