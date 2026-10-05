# RuneHelper 방식 한국어 OCR 실험

## 목적

RuneHelper가 사용하는 게임 글꼴 특화 행 단위 OCR을 현재 오버레이의 한국어 바닥 라벨에 적용할 수 있는지 확인한다. 실험은 앱의 기본 OCR과 배포 설정을 바꾸지 않는다.

참고한 공개 구현은 [Denzeriko/RuneHelper](https://github.com/Denzeriko/RuneHelper)이며, 검사 당시 커밋은 `ee81c24e2ab40a986e4de792a8362e9b1472df80`이다. 저장소 설명상 한국어 포함 언어별 약 0.6MB 소형 CNN/CTC 모델을 사용하고, Runeshape 행 crop을 합성 글꼴 데이터와 실제 캡처로 학습한다. 코드는 MIT 라이선스다. upstream 한국어 가중치와 라이선스는 `src/ocr-experiments/` 아래에 실험용으로 보관한다.

## 데이터와 방법

- 현재 프로젝트 정답 세트 19장, 144개 라벨을 사용했다. 평가 이미지는 임시 캡처 폴더에서 읽으며 저장소에 스크린샷을 복사하지 않는다.
- crop은 정답 위치 주변에서 만들고, 이미지 단위로 나눠 같은 이미지의 라벨이 학습과 평가에 동시에 들어가지 않게 했다.
- RuneHelper 공개 한국어 모델을 로드해 CPU 추론을 확인한 다음, train 이미지 crop으로 32 step 미세조정한 모델을 held-out 5장/42라벨에서 평가했다. RuneShape 모델과 같은 어두운 글자/밝은 바탕 입력 극성을 사용했다.
- Windows OCR 비교 수치는 같은 held-out 5장에 대해 기존 프로젝트에서 저장한 전체 화면 인식 결과를 사용한다. 이 비교는 모델 추론 정확도 비교이며, 별도 GUI 성능 비교가 아니다.

## 결과

| 경로 | Held-out 정확 라벨 | 전체 19장 정확 라벨 |
|---|---:|---:|
| 현재 Windows OCR 전체 화면 경로 | 32/42 | 평가 기록에서 76/103 (기존 17장 부분 세트) |
| RuneHelper 공개 한국어 모델, 행 crop | 0/42 | 0/144 |
| RuneHelper 모델, 32 step fine-tune | 0/42 | 미평가 |

32 step 미세조정은 102개 학습 crop으로 CPU에서 약 28초 걸렸고, 프로세스 RSS는 약 0.8GB까지 관측됐다. 전체 144 crop에 공개 모델을 적용한 Python 추론은 약 0.5초였다. 이는 upstream C++ 추론 성능이나 제품 빌드의 속도 측정이 아니다.

## 해석

현재 공개 가중치는 Runeshape 보상 행 분포에 맞춰져 있어 일반 드랍 툴팁/바닥 라벨에 전이되지 않았다. 빠른 미세조정 한 번으로도 회복되지 않았다. 또한 현재 프로젝트는 다양한 아이템·희귀 이름·화면 색상과 위치를 다루므로, 전용 모델은 더 큰 crop 데이터셋과 이미지 단위 교차검증이 있어야 의미 있게 평가할 수 있다.

**현재 결과로는 RuneHelper OCR을 기본 엔진으로 채택하지 않는다.** 기존 Windows OCR을 유지한다. 행별 OCR을 다시 시도하려면 실제 게임 화면의 다양한 아이템/화면 크기/밝기 crop을 추가하고, 어휘·수량 문자를 확장한 뒤 최소 4-fold 이미지 단위 검증을 해야 한다.

## 재현

이 실험은 Windows Python 3.12 가상환경 `.ocr-venv`를 사용한다. PyTorch CPU 의존성을 설치해야 한다. 이 환경에서는 `NotoSansKR-VF.ttf`를 시스템 폰트 경로에서 읽도록 설정한다.

```powershell
$env:RUNEHELPER_ML = "$env:TEMP\poe2-glyph-ml"
$env:RUNEHELPER_LANGUAGE = 'ko'
\.ocr-venv\Scripts\python.exe src/ocr-experiments/runehelper-text-model/prepare_crops.py
\.ocr-venv\Scripts\python.exe src/ocr-experiments/runehelper-text-model/evaluate.py --out src/ocr-experiments/upstream-model-eval.json
```

학습 crop은 `%TEMP%\poe2-glyph-ml`에 만든다. 실험 가중치와 평가 결과는 개발 자료이며 앱 패키징에는 포함하지 않는다.
