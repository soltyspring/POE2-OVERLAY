# OCR 비교 실험 (2026-10-05)

목표는 한국어 드랍 라벨 인식과 CPU·메모리 절감이다. 라이브 게임에서 저장한 동일 캡처를 반복 사용했다. 화면 오른쪽 기존 오버레이 영역은 매칭에서 제외했다. 색상 흑백 전처리와 같은 아이템 사전을 사용했다. 결과는 이 한 화면에 한정한다.

## 조사 후보

- [EasyOCR](https://github.com/JaidedAI/EasyOCR): 다국어·CPU 실행을 지원하나 PyTorch/torchvision 배포가 필요하다. 이번 실측 대상은 아니다.
- [Surya](https://github.com/datalab-to/surya): 문서 분석 중심의 650M 모델과 별도 추론 서버가 필요하다. 경량 게임 오버레이의 우선 후보에서 제외했다. 실측하지 않았다.
- [Paddle/RapidOCR](https://github.com/RapidAI/RapidOCR): 기존 한국어 mobile ONNX 경로를 이전 실험에서 측정했다.
- [Tesseract fast](https://github.com/tesseract-ocr/tessdata_fast): 한국어 빠른 정수 모델을 추가 실험 대상으로 선정했다. Electron 통합 편의를 고려해 Tesseract.js의 WASM 실행을 사용했다. 네이티브 Tesseract 성능을 대표하지 않는다.

## 전체 화면 (모델 초기화 이후 반복)

| 엔진 | 인식 | 처리 시간 | CPU 시간 | 관측 최대 RSS |
|---|---|---|---|---|
| Windows OCR | 7/7 | 236–365ms | 234–281ms | 159MB |
| RapidOCR 한국어 mobile | 6/7 | 2260–2762ms | 4281–5078ms | 273MB |
| Tesseract.js kor fast / sparse text | 4/7 | 11583–11693ms | 11593–11703ms | 666MB (최초 추론 포함) |

## 라벨만 모은 작은 이미지

같은 캡처의 7개 라벨을 수동으로 잘라 320×525 이미지에 모았다. 이는 영역 축소의 잠재 효과를 확인하는 실험이다. 자동 탐지·크롭·전처리 시간은 측정에 포함하지 않았다.

| 엔진 | 인식 | 반복 처리 시간 | 반복 CPU 시간 | 관측 최대 RSS |
|---|---|---|---|---|
| Windows OCR | 7/7 | 28–32ms | 31ms | 112MB |
| Tesseract.js kor fast / single block | 6/7 | 91–92ms | 94–125ms | 84MB |

Tesseract는 관통 석궁 라인을 놓쳤다. Windows는 이 작은 이미지에서 모두 찾았다. Windows 최초 실행은 637ms로, 프로세스·OCR 초기화 비용이 포함되어 있다.

RSS는 OCR 프로세스 기준이며 Tesseract는 Node와 WASM 워커를 포함한다. Windows/Rapid는 각 워커 기준이다. 순간 최대 RAM을 고빈도 샘플링한 수치가 아니라 각 작업 종료 시 관측된 최대값이다. CPU 시간은 코어 합산 사용 시간이며 작업관리자 CPU 퍼센트가 아니다. GPU를 사용하지 않았다.

## 선정

기본 엔진은 Windows OCR을 유지한다. 이 화면에서는 가장 정확하고 CPU 사용 시간이 적었다. 새로운 오픈소스 엔진 중 Tesseract fast를 실제 시험했으나 교체 이득은 확인되지 않았다. 다음 개선 후보는 라벨 영역 자동 추출이며, 여러 화면에서 탐지 누락·오인식과 전체 처리 비용을 함께 검증해야 한다.

테스트 의존성은 임시 디렉터리에 설치했고 앱 패키지에는 추가하지 않았다. 결과 JSON과 실험 스크립트는 `%TEMP%/poe2-tesseract-benchmark`에 있다.
