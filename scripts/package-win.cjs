const path=require('node:path');
const fs=require('node:fs/promises');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {packager}=require('@electron/packager');
const packageInfo=require('../package.json');

const execFileAsync=promisify(execFile);
const root=path.resolve(__dirname,'..');
const appName='PoE2 Item Price Overlay';
const out=path.join(root,'dist');
const archive=path.join(out,`${appName.replaceAll(' ','-')}-v${packageInfo.version}-win-x64.zip`);

function quotePowerShell(value){return `'${value.replaceAll("'","''")}'`;}

async function main(){
  await fs.mkdir(out,{recursive:true});
  const [appPath]=await packager({
    dir:root,
    name:appName,
    platform:'win32',
    arch:'x64',
    out,
    overwrite:true,
    asar:false,
    prune:true,
    ignore:[/(?:^|[\\/])(?:\.git|\.ocr-venv|docs|test|dist|ocr-experiments)(?:[\\/]|$)/]
  });

  await fs.writeFile(path.join(appPath,'사용법.txt'),[
    'PoE2 아이템 시세 오버레이',
    '',
    '1. ZIP 전체를 원하는 폴더에 압축 해제합니다.',
    '2. PoE2 Item Price Overlay.exe를 실행합니다.',
    '3. Path of Exile 2를 창 모드 또는 테두리 없는 창 모드로 실행합니다.',
    '4. 앱의 스캔 단축키 설정에서 전체 화면과 마우스 주변 키를 바꿀 수 있습니다. 기본 키는 F6/F7입니다.',
    '5. 아이템 옵션 시세는 게임에서 아이템을 Ctrl+C로 복사한 다음 앱의 복사한 아이템 조회를 사용합니다.',
    '',
    '요구 사항: Windows 10/11 64비트, Windows 한국어 OCR 기능, 인터넷 연결.',
    '가격 서버가 연결되지 않으면 일부 화폐 가격 조회가 지연되거나 직접 조회로 전환될 수 있습니다.',
    '이 빌드에는 계정 토큰이나 게임 계정 정보가 포함되어 있지 않습니다.',
    ''
  ].join('\r\n'),'utf8');

  await fs.rm(archive,{force:true});
  const command=`$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath ${quotePowerShell(appPath)} -DestinationPath ${quotePowerShell(archive)} -CompressionLevel Optimal -Force`;
  await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,maxBuffer:4*1024*1024});
  const info=await fs.stat(archive);
  console.log(`App folder: ${appPath}`);
  console.log(`Shareable ZIP: ${archive} (${(info.size/1024/1024).toFixed(1)} MB)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
