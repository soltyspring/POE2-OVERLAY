# PoE2 한국어 드랍·판매 도구: 저장소 분석

조사일: **2026-10-04 (한국 시간)**. GitHub REST API로 별 수와 라이선스를 확인하고 6개 저장소를 shallow clone하여 소스를 읽었습니다. 별 수는 사용량·정확도를 뜻하지 않습니다. 조사한 앱을 직접 빌드하거나 게임에서 비교 실험한 것은 아닙니다.

## 비교

| 저장소 | 별 | 기술 | 라이선스 | 참고할 부분 |
|---|---:|---|---|---|
| [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) | 2,587 | Electron/TypeScript/Vue | MIT | 클립보드·단축키·검색 UX. PoE1 중심 |
| [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) | 1,188 | Electron/TypeScript/Vue | MIT | PoE2 파싱·옵션 필터·매물 비교 |
| [Sidekick](https://github.com/Sidekick-Poe/Sidekick) | 512 | C#/.NET | MIT | 한국어 파싱·Kakao 주소·요청 제한 |
| [RuneHelper](https://github.com/Denzeriko/RuneHelper) | 15 | C++/OpenCV/ImGui | MIT | 다국어 OCR·영역 선택·가격 캐시 |
| [MaxOverlay-POE2](https://github.com/MaxDistroyer/MaxOverlay-POE2) | 0 | Python/Windows OCR | MIT | 전체 화면 OCR·위치·툴팁 연결 |
| [VerisiumLedger](https://github.com/skyjacc/VerisiumLedger) | 0 | C#/Windows OCR | API에서 미확인 | 캡처·수량·언어 변환·기준 화폐 |

인기 프로젝트 세 개와 OCR 요구에 직접 관련된 소규모 세 개를 함께 선정했습니다. 모두 인기 있다고 평가하지 않습니다. VerisiumLedger는 라이선스 조건을 확정하기 전 소스 재사용 대상에서 제외합니다. 이번 구현에는 다른 저장소 코드를 복사하지 않았습니다.

## 1. Exiled Exchange 2

검토 커밋: `cca30662bf31eaf38bd711e2ec1a6b899a06c40e`.

[pathofexile-trade.ts](https://github.com/Kvan7/Exiled-Exchange-2/blob/cca30662bf31eaf38bd711e2ec1a6b899a06c40e/renderer/src/web/price-check/trade/pathofexile-trade.ts)는 아이템 속성과 옵션을 검색 JSON으로 옮기고 search/fetch를 분리합니다. [trade-api.ts](https://github.com/Kvan7/Exiled-Exchange-2/blob/cca30662bf31eaf38bd711e2ec1a6b899a06c40e/renderer/src/web/price-check/trade/trade-api.ts)는 동일 판매자의 반복 매물을 묶고 결과 요청을 나눕니다. [RateLimiter.ts](https://github.com/Kvan7/Exiled-Exchange-2/blob/cca30662bf31eaf38bd711e2ec1a6b899a06c40e/renderer/src/web/price-check/trade/RateLimiter.ts)는 여러 제한 창을 함께 기다립니다.

**적용 판단:** 판매 전 옵션 비교의 우선 참고 대상입니다. 검토한 주 흐름은 복사 아이템 기반으로, 흩어진 바닥 라벨의 전체 인식 성능을 입증하지는 않습니다. 전체 포크는 성숙한 거래 기능을 얻지만 OCR·여러 아이템 목록을 기존 상태와 UI에 통합하는 비용이 있습니다. 판매자 중복 제거는 우리 후속 구현에 필요합니다.

## 2. Sidekick

검토 커밋: `194621647c675233656d548c9345565c22bb0812`.

[GameLanguageKo.cs](https://github.com/Sidekick-Poe/Sidekick/blob/194621647c675233656d548c9345565c22bb0812/src/Sidekick.Game.Providers/Languages/Implementations/GameLanguageKo.cs)에 한국어 희귀도·아이템 레벨·타락·미확인 문자열과 Kakao `/api/trade2/`가 명시되어 있습니다. [ItemParser.cs](https://github.com/Sidekick-Poe/Sidekick/blob/194621647c675233656d548c9345565c22bb0812/src/Sidekick.Game.Parser/ItemParser.cs) 및 같은 폴더의 StatParser/PropertyParser는 아이템·옵션·속성을 나눕니다. [서버 동기화 limiter](https://github.com/Sidekick-Poe/Sidekick/blob/194621647c675233656d548c9345565c22bb0812/src/Sidekick.Apis.Common/Limiter/ServerSynchronizedRateLimiter.cs)는 서버 사용량과 제한 창을 반영합니다.

**적용 판단:** 한국어를 영문 규칙에 끼워 맞추지 않는 언어 계층과 API 책임 분리가 유용합니다. C# 네이티브 OCR 구현에도 적합한 참고입니다. 현재 개발 환경에서 확인된 SDK는 .NET 3.0.100이라 최신 C# 앱 기반을 선택하면 런타임 정비가 추가로 필요합니다.

## 3. Awakened PoE Trade

검토 커밋: `3188208957422b21b69b12083a03edf3d1bac187`.

[HostClipboard.ts](https://github.com/SnosMe/awakened-poe-trade/blob/3188208957422b21b69b12083a03edf3d1bac187/main/src/shortcuts/HostClipboard.ts)는 복사 결과 대기, 동일 아이템 재복사, 운영체제별 클립보드 문제, 복원 시점을 처리합니다. [Parser.ts](https://github.com/SnosMe/awakened-poe-trade/blob/3188208957422b21b69b12083a03edf3d1bac187/renderer/src/parser/Parser.ts)는 복사 텍스트의 파싱 진입점입니다.

**적용 판단:** 화면 전체에서 볼 수 없는 옵션을 얻는 보완 경로와 단축키 UX에 가치가 있습니다. PoE1 데이터·옵션·API 경로를 PoE2에 그대로 사용하면 안 됩니다. 초기 버전은 사용자가 게임에서 Ctrl+C로 복사한 텍스트만 읽습니다.

## 4. RuneHelper

검토 커밋: `ee81c24e2ab40a986e4de792a8362e9b1472df80`.

[소스 구조](https://github.com/Denzeriko/RuneHelper/tree/ee81c24e2ab40a986e4de792a8362e9b1472df80/RuneHelper)는 OCR·가격·UI·플랫폼을 분리합니다. `core/Config.h`의 한국어 선택과 `ui/ImGuiStyleSetup.cpp`의 한글 글리프 처리를 확인했습니다. [PoeNinjaPriceProvider.cpp](https://github.com/Denzeriko/RuneHelper/blob/ee81c24e2ab40a986e4de792a8362e9b1472df80/RuneHelper/price/PoeNinjaPriceProvider.cpp)는 분류별 다운로드·취소·구조 검증·부분 실패를 처리하고 기본 프록시 실패 시 직접 API로 전환합니다. [OCR 테스트](https://github.com/Denzeriko/RuneHelper/tree/ee81c24e2ab40a986e4de792a8362e9b1472df80/tests/ocr)는 골든 장면·강건성·행 캐시를 검증합니다.

**적용 판단:** 한국어와 OCR 검증 자료에 가까운 대상입니다. 정해진 메뉴/선택 영역 성능을 겹친 바닥 라벨로 일반화할 수는 없습니다. 검토한 provider는 환산에 `rates.exalted`를 사용하며, 우리 구현은 기준 화폐가 이미 엑잘인 경우도 처리합니다.

## 5. MaxOverlay-POE2

검토 커밋: `6765bdccb1b4e788070ca6e15e567082f23fd886`.

[maxoverlay.py](https://github.com/MaxDistroyer/MaxOverlay-POE2/blob/6765bdccb1b4e788070ca6e15e567082f23fd886/maxoverlay.py)의 `run_ocr_fullscreen`은 화면 텍스트와 위치를 반환하고 `resolve_fullscreen`은 사전 이름에 연결합니다. `match_stats`는 stat ID와 숫자를 찾아 일부 범위의 평균을 사용하고 근사 일치를 표시합니다. `_build_query`는 검색 조건을 구성합니다.

**적용 판단:** 전체 화면→아이템→툴팁 흐름에 직접적입니다. 영문 중심 숫자·문장 규칙을 한국어에 그대로 적용하면 안 됩니다. 범위값 평균, 비슷한 옵션 단어, implicit/explicit 모호성은 별도 검증이 필요합니다. 우리 초기 구현은 정확한 단일 수치만 대응합니다.

## 6. VerisiumLedger

검토 커밋: `e2b48e7032044042b6b219145a709b6a6b813b64`.

[OcrScanner.cs](https://github.com/skyjacc/VerisiumLedger/blob/e2b48e7032044042b6b219145a709b6a6b813b64/src/PoeAncientsPriceHelper/OcrScanner.cs)는 줄/좌표·업스케일·수량·언어를 처리합니다. [NameTranslator.cs](https://github.com/skyjacc/VerisiumLedger/blob/e2b48e7032044042b6b219145a709b6a6b813b64/src/PoeAncientsPriceHelper/NameTranslator.cs)는 선택한 언어만 영문 시세 키로 변환합니다. [PriceRepository.cs](https://github.com/skyjacc/VerisiumLedger/blob/e2b48e7032044042b6b219145a709b6a6b813b64/src/PoeAncientsPriceHelper/PriceRepository.cs)는 리그 기준 화폐가 달라질 수 있음을 반영합니다.

**적용 판단:** 수량 표기와 언어 변환의 예외를 파악하는 데 유용했습니다. 우리 구현은 문자열 번역보다 공식 한국어 static ID와 가격 ID를 연결합니다. 실제 캡처 방식과 OCR 처리에서는 WGC/GDI 전환, 해상도별 처리를 후속 참고할 수 있습니다.

## 설계 결정

독립 Electron 앱에 Windows 한국어 OCR을 PowerShell로 연결했습니다. OCR·거래·계산·UI를 분리해 이후 네이티브 캡처/인식으로 교체할 수 있습니다. 현재 환경에서 검증하기 쉬운 선택이며 Electron 메모리 사용과 OCR 프로세스 시작 지연은 측정이 필요합니다.

| 입력 | 현재 동작 | 남은 일 |
|---|---|---|
| 화폐·소모품 이름/수량 | static ID → 시세 → 엑잘 정렬 | 다양한 묶음/레벨 표기 |
| 확정 고유 이름 | 옵션 없으면 최대 10매물의 환산 가능한 최저가 | 판매자 중복·표본 경고·옵션 범위 |
| 고유 베이스 이름 | 후보와 조회 매물 최저가 참고 표시 | 주황색 영역·실제 라벨 표기 확인 |
| 희귀 이름만 | 제외 | 감정 후 복사/툴팁 |
| 한국어 복사 옵션 | 유일한 단일 수치를 동일 값으로 검색 | 범위·DPS·옵션 그룹·타락·소켓 |
| 화면 툴팁 옵션 | 아직 미구현 | 라벨/툴팁 분리·속성 파싱 |

고유 조회 최저가는 옵션 미반영 참고값이며 소모품은 집계 가격입니다. 실제 판매 체결 가격을 뜻하지 않습니다. 이름만 읽어 숨겨진 장비 옵션을 평가할 수는 없습니다. 현재 버전은 마우스가 있는 모니터 전체의 텍스트를 읽으며 주황색 픽셀 판별과 클릭 통과는 아직 없습니다.

## 검증

- 핵심 테스트 6개 통과: 기준 화폐, 수량/위치별 중복, 고유 후보, 동일 옵션 값, 암시/명시 구분, 미확인 장비 차단. 공식 한국어 stats 응답에서 실제 옵션 문자열과 그룹 중복을 확인해 파서를 보정했습니다.
- 공식 한국어 `data/static`, `data/items`, poe.ninja Standard API를 실제 호출했습니다. 연결 검사에서 사전 2,340항목·가격 257항목과 한국어 화폐 연결을 확인했습니다. 항목 수·시세는 바뀔 수 있습니다.
- Windows 한국어 OCR에 인위적으로 그린 `신성한 오브`, `카오스 오브`를 넣어 텍스트/좌표를 확인했습니다. **실제 게임 인식률 검증이 아닙니다.**
- 앱 UI smoke 실행은 두 번 시도했지만 이 실행 환경에서 `[Error: UnknownVizError]`로 종료됐습니다. 패널 로딩/외관은 검증하지 못했습니다. 구문 검사와 OCR/API 검증 통과가 GUI 실행 성공을 뜻하지 않습니다. npm audit 결과 알려진 취약점 0개를 확인했습니다.
- 실제 게임 화면의 바닥/툴팁, 1080p/1440p/4K, HDR, DPI, 라벨 겹침은 미검증입니다. 공식 POST 검색의 실사용 인증 조건과 즉시 구매 시장도 확인이 필요합니다.

다음 순서는 실제 한국어 화면 정답 세트와 오인식률 측정 → 주황색 영역/툴팁 분리 → 전체 옵션 파싱 → 검색 조건 수정 UI → 클릭 통과·포커스 처리 → 설치 파일입니다. 첫 프로토타입의 존재와 게임에서 정확히 작동하는 완성 제품을 구분해야 합니다.

2026-10-05 추가 변경: F6으로 마우스가 있는 모니터 전체를 캡처합니다. 오버레이는 캡처 동안 숨겨 자체 결과의 재인식을 줄입니다. 옵션 없는 확정 고유의 가격도 중앙값에서 조회 최저가로 바꿨습니다. 화폐·소모품은 집계 시세를 유지하며 옵션 없는 희귀 장비의 평가 가격은 만들지 않습니다. 전체 화면 캡처와 다중 모니터 동작의 실제 GUI 검증은 남아 있습니다.

2026-10-05 변경: 허리띠처럼 베이스만 보일 때 고유 후보 전체를 검색하여 환산 가능한 조회 매물의 최저가를 표시합니다. 후보를 특정 고유로 확정하지 않습니다. 최대 10개 매물 기준으로 전체 시장 최저가를 보장하지 않으며, 현재 주황색 판별이 없으므로 일반/마법 베이스에도 고유 후보 참고가가 나타날 수 있습니다. 이 동작과 시세 없음·확정 고유 중앙값을 확인하는 테스트 2개를 추가했습니다.
