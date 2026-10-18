# POE2 Overlay

**한국어 PoE2 아이템 화면을 읽고 가격 정보를 연결하는 Windows 데스크톱 개인 프로젝트입니다.**

> Korean OCR, item matching, and market-data lookup in an Electron overlay.

## 구현 위치

현재 `main`은 소개용 브랜치입니다. **실행 코드와 상세 문서는 [`feature/korean-loot-scanner`](https://github.com/soltyspring/POE2-OVERLAY/tree/feature/korean-loot-scanner)에 있습니다.** 아래는 해당 브랜치의 구현을 설명합니다.

## 주요 기능

- 전체 화면·마우스 주변 캡처와 한국어 OCR
- 아이템 사전 매칭, 엑잘 기준 가격 표시
- POE2 Exchange API 연동과 직접 조회 fallback
- 복사한 아이템 조회와 보관함 슬롯 가격표
- 사전·가격 캐시와 변경 없는 화면 재사용
- Windows OCR 기본 경로, 선택적 RapidOCR

```text
단축키 → 화면 캡처 → 한국어 OCR → 사전 매칭
                                  ↓
                         시세 서버 / 거래 조회
                                  ↓
                          오버레이 목록 갱신
```

OCR은 로컬에서 처리합니다. 외부 요청은 시세·사전·거래 조회에 사용됩니다. 화폐 집계 가격과 옵션별 매물 가격을 구분합니다.

## 개발 실행

Windows 10/11, Node.js 22 이상과 Windows 한국어 OCR 언어 기능이 필요합니다.

```powershell
git clone --branch feature/korean-loot-scanner https://github.com/soltyspring/POE2-OVERLAY.git
cd POE2-OVERLAY
npm install
npm start
```

기본 키는 F6(전체 화면), F7(마우스 주변)이며 앱에서 변경할 수 있습니다. 게임은 창 또는 테두리 없는 창 모드로 실행하고 읽을 라벨을 표시합니다.

| 변수 | 용도 |
| --- | --- |
| `POE_EXCHANGE_URL` | 시세 서버 주소 |
| `POE_LEAGUE` | 시세 조회 리그 |
| `POE_OCR_ENGINE` | `windows` 또는 `rapidocr` |

RapidOCR는 Python 환경과 개발 브랜치의 `scripts/ocr-requirements.txt` 설치가 별도로 필요합니다.

## 문서

- [전체 사용 안내](https://github.com/soltyspring/POE2-OVERLAY/blob/feature/korean-loot-scanner/README.md)
- [다른 PC 설치](https://github.com/soltyspring/POE2-OVERLAY/blob/feature/korean-loot-scanner/docs/INSTALL.ko.md)
- [OCR 측정 범위](https://github.com/soltyspring/POE2-OVERLAY/blob/feature/korean-loot-scanner/docs/ocr-performance.ko.md)
- [Windows 배포 파일](https://github.com/soltyspring/POE2-OVERLAY/releases)

## 현재 제약

초기 프로토타입입니다. 배율·글자색·배경에 따라 인식 결과가 달라집니다. API 변경·제한으로 조회가 실패할 수 있으며 집계 가격은 실제 판매 가능 가격을 보장하지 않습니다. UI·OCR·캐시 구현과 실제 게임 환경 성능 검증을 구분합니다.
