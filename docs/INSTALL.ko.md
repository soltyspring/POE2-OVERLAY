# Windows 설치

1. [GitHub Releases](https://github.com/soltyspring/POE2-OVERLAY/releases)에서 `PoE2 Item Price Overlay Setup ...exe`를 받습니다. `Source code` ZIP은 설치 파일이 아닙니다.
2. 설치 파일을 실행하고 설치 위치를 선택합니다. 바탕 화면 또는 시작 메뉴 바로 가기로 실행합니다. Node.js와 Python은 필요하지 않습니다.
3. Windows 10/11 64비트가 필요합니다. 설정 → 시간 및 언어 → 언어 및 지역에서 한국어 언어 기능을 설치하세요. 한국어 OCR이 없으면 스캔이 작동하지 않습니다.
4. 한국어 PoE2를 창 모드 또는 테두리 없는 창 모드로 실행합니다. 기본 F6은 전체 화면, F7은 마우스 주변을 스캔합니다. 키가 다른 앱과 겹치면 **스캔 단축키 설정**에서 F1~F12 또는 Ctrl·Alt·Shift 조합으로 바꿀 수 있습니다. 아이템 옵션은 게임에서 복사한 뒤 오버레이에서 Ctrl+V로 조회합니다.

현재 기본 시세 서버는 `https://poe-exchange.tail37463f.ts.net`입니다. 배포 주소에서 조회가 되는지 먼저 확인하세요. Tailscale 전용으로 운영되면 서버 소유자가 허용한 Tailscale 접근이 필요합니다. 설치만으로 네트워크 권한이 생기지 않습니다.

별도 서버를 사용할 경우 앱을 종료하고 PowerShell에서 아래처럼 사용자 환경변수를 설정한 뒤 다시 실행합니다.

```powershell
[Environment]::SetEnvironmentVariable('POE_EXCHANGE_URL', 'https://본인의-서버주소', 'User')
```

서버는 `/api/overlay/prices`를 지원해야 합니다. 현재 기본 리그는 Forbidden Rites입니다. 서버 연결 실패 시 화면 인식 결과와 가격 확인 상태가 다를 수 있습니다.

설치 파일은 코드 서명이 없는 시험 배포본입니다. 배포자와 저장소를 확인하고 설치하세요. 삭제는 Windows 설정 → 앱 → 설치된 앱에서 할 수 있습니다.

## 소스에서 실행

```powershell
git clone --branch feature/korean-loot-scanner https://github.com/soltyspring/POE2-OVERLAY.git
cd POE2-OVERLAY
npm ci
npm start
```

소스 실행에는 Node.js 24가 필요합니다. 설치 파일을 직접 만들려면 `npm run package:installer`를 실행합니다. 출력은 `dist/installer/`입니다.
