# 오버레이 일괄 시세와 웹 개선 사항

2026-10-05 실제 `/api/markets?league=Forbidden%20Rites` 응답은 1,356항목,
756,529바이트였다. 같은 PC에서 PowerShell HTTP 요청 세 번은 964/916/1,028ms였다.
네트워크·다운로드·클라이언트 처리 시간을 포함하므로 DB 실행 시간으로 해석하면 안 된다.

오버레이 스캔은 이제 이 스냅샷을 한 번 받아 화폐 및 확인된 고유 참고가를 처리한다.
장비별 공식 거래 검색은 스캔에서 제거했다. 옵션 복사 후 상세 조회는 유지한다.
60초 메모리 캐시와 동시 요청 공유는 유지한다. 유효한 캐시가 있으면 추가 요청 없이 표시한다.
30분보다 오래된 시세는 제외한다. 희귀 베이스/등급별 경로석/레벨별 젬 가격이
서버에 없으면 확인 필요로 남는다. 고유 참고가를 희귀 베이스 최저가로 사용하지 않는다.
서버 장애 시 기존 화폐 시세 대체 경로는 남아 있어, 그 경우에는 요청 한 번을 보장하지 않는다.

## 웹에서 개선할 부분

로컬 웹 소스 `../chart/backend/app.py`의 markets 라우트(1045행부터)를 확인했다.
현재는 DB가 비어 있으면 collector.refresh를 응답 전에 기다린다. 초기 수집은 백그라운드로
옮기고 즉시 ready/collecting 상태를 반환하면 첫 요청의 긴 대기를 방지할 수 있다.
리그 목록 조회도 요청 중 외부 HTTP가 필요할 수 있으므로 마지막 유효 목록을 우선 사용한다.

권장 추가 API: `POST /api/overlay/prices`.
요청은 league와 중복 제거한 아이템 배열(id 또는 name/baseType/kind/tier/level)이다.
응답은 요청 key마다 priceExalted, priceDivine, priceKind, observedAt, source,
sampleCount, state(ready/missing/stale)를 반환하고 snapshotVersion과 rates를 포함한다.
한 요청 안에서 항목마다 외부 거래 API를 부르지 말고, 미리 수집한 스냅샷을 조회한다.
희귀 베이스 최저가 및 젬/경로석은 각각 별도 스냅샷 종류로 수집해야 한다.

- 선택된 아이템만 반환하고 아이콘·추세·전체 목록은 제외한다.
- 메모리 스냅샷을 수집 완료 시 교체해 DB 직렬화 비용을 줄인다.
- gzip/Brotli와 ETag를 지원한다.
- Server-Timing에 db/serialize/cache 시간을 기록한다.
- p50/p95 응답 시간과 응답 바이트를 측정한다.
- (league, kind, base_type, tier, level) 조회에 맞는 인덱스를 실행 계획으로 검증한다.
- 고유 장비 observed_at가 화폐보다 오래된 현상도 별도로 확인한다.

이 문서는 웹 변경 요구사항이며 새 엔드포인트의 구현/배포는 아직 하지 않았다.
