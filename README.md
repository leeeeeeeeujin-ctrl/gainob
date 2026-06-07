# Coin AI Briefing

## Liquidity Dashboard MVP

현재 프로젝트는 기존 Express API를 유지하면서 별도 Next.js 프론트엔드를 `/frontend`에 둡니다.

```text
/server
  기존 Express API 진입점

/frontend
  Next.js
  TypeScript
  Tailwind
  Recharts
  Zustand
```

배포 기준:

- Vercel 루트 도메인: `https://gainob.vercel.app/`
- Vercel build command: `npm run build:frontend`
- Vercel output directory: `frontend/out`
- `/api/*` 요청은 기존 Express serverless API로 rewrite됩니다.

로컬 실행:

```bash
npm run dev
npm run frontend:dev
```

프론트엔드가 다른 API 서버를 호출해야 하면 `/frontend/.env.local`에 다음 값을 둡니다.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

같은 도메인에서 배포할 때는 이 값을 비워두면 프론트엔드가 상대 경로 `/api/public/liquidity-dashboard`를 호출합니다.

### Public Endpoint: Liquidity Dashboard

```http
GET https://gainob.vercel.app/api/public/liquidity-dashboard
```

MVP 범위:

- BTC Dominance
- ETH/BTC
- SOL/ETH
- Stablecoin Market Cap
- BTC ETF Net Flow
- ETH ETF Net Flow

현재 데이터 공급자는 Mock Provider입니다. 가격 예측, 매매 신호, 목표가 산출은 포함하지 않습니다.

응답 구조 요약:

```json
{
  "asOf": "2026-06-07T00:00:00.000Z",
  "provider": {
    "id": "mock",
    "name": "Mock Liquidity Dashboard Provider",
    "mode": "mock"
  },
  "scope": {
    "purpose": "briefing",
    "excludes": ["price_prediction", "trade_signal"]
  },
  "marketRegime": [],
  "cycleRotation": [],
  "cryptoLiquidity": [],
  "etfFlows": [],
  "capitalFlowSummary": []
}
```

Provider Interface:

```ts
interface LiquidityDashboardProvider {
  getBTCDominance(): Promise<MetricPoint[]>;
  getETHBTC(): Promise<MetricPoint[]>;
  getSOLETH(): Promise<MetricPoint[]>;
  getStablecoinMarketCap(): Promise<MetricPoint[]>;
  getETFNetFlow(asset: "BTC" | "ETH"): Promise<MetricPoint[]>;
}
```

교체 지점:

- Server mock provider: `src/liquidity-dashboard.js`
- Frontend provider contract: `frontend/lib/providers/types.ts`
- Frontend API client: `frontend/lib/api-client.ts`

대시보드의 목적은 단기 매매가 아니라 시장 전체의 자금 흐름과 사이클 위치를 브리핑하는 것입니다.

바이낸스 시세를 메인 차트 기준으로 보고, 빗썸 가격을 국내 비교점으로 함께 확인한 뒤 개인 컨텍스트까지 묶어서 GPT 또는 Gemini에 넘기는 개인용 웹앱입니다.

## 기능

- 바이낸스 현물 심볼 자동 수집과 검색
- 바이낸스 현재가, 24시간 변동률, 거래량, 호가, 최근 체결, 캔들 조회
- 빗썸 비교가와 가격 괴리 계산
- `15분`, `1시간`, `4시간`, `일봉`, `주봉` 차트
- 개인 프로필, 리스크 원칙, 당일 메모를 로컬에 저장
- 모듈 단위로 컨텍스트를 수집하고 부분 실패를 분리
- OpenAI 또는 Gemini로 시장 데이터 + 개인 컨텍스트 분석 요청

## 현재 모듈

- `market`: 빗썸/바이낸스 비교 시세
- `profile`: 개인 투자 스타일, 리스크 원칙, 주시 항목
- `journal`: 당일 메모, 지금 확인하고 싶은 질문

모듈 구조라서 이후 `portfolio`, `news`, `onchain`, `alerts` 같은 모듈을 추가하기 쉽게 분리해두었습니다.

## 실행

```bash
npm install
copy .env.example .env
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

간단 검증은 아래로 실행합니다.

```bash
npm run smoke
```

## Vercel

- 루트 디렉터리는 프로젝트 루트 그대로 `d:\\aass\\gainob`
- API는 [api/index.js](d:/aass/gainob/api/index.js) 를 통해 서버리스 함수로 배포됩니다.
- 실제 Express 앱 엔트리는 [src/web-handler.js](d:/aass/gainob/src/web-handler.js) 입니다.
- 정적 파일은 `public/`에서 그대로 서빙됩니다.
- Vercel 환경변수에 `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`를 넣으면 됩니다.

## 환경변수

- `AI_PROVIDER`: `auto`, `openai`, `gemini`
- `OPENAI_API_KEY`: GPT 분석 기능 사용 시 필요
- `OPENAI_MODEL`: 기본값 `gpt-4.1-mini`
- `GEMINI_API_KEY`: Gemini 분석 기능 사용 시 필요
- `GEMINI_MODEL`: 기본값 `gemini-2.5-flash`
- `PORT`: 기본값 `3000`

## 공개 엔드포인트

### AI 소비자용 빠른 가이드

- 시장 전체 분위기부터 볼 때
  - `/api/public/direction`
  - `/api/public/sector-flow`
- 지금 당장 볼 만한 자리 후보를 고를 때
  - `/api/public/opportunity`
- 특정 심볼을 깊게 해석할 때
  - `/api/public/briefing`
  - `/api/public/liquidity`
  - `/api/public/overlay`
- 저장 추세 변화를 확인할 때
  - `/api/public/direction/history`
  - `/api/public/liquidity/history`

권장 조회 순서:

1. `/api/public/direction`으로 시장 breadth와 상위/하위 후보를 확인합니다.
2. `/api/public/sector-flow`로 어떤 섹터에 상대강도가 붙는지 봅니다.
3. `/api/public/opportunity`로 추세 추종 후보, 반등 감시 후보, 회피 후보를 나눕니다.
4. 관심 심볼은 `/api/public/briefing`, `/api/public/liquidity`, `/api/public/overlay`로 상세 확인합니다.
5. 특정 가격대에 지지/저항 벽이 반복되는지 보려면 `/api/public/liquidity/history`를 함께 확인합니다.

- `GET /api/public`
  - 어떤 공개 엔드포인트가 있는지 설명 JSON을 반환합니다.
- `GET /api/public/readme`
  - README의 공개 API 관련 문서를 그대로 텍스트로 반환합니다.
- `GET /api/public/info`
  - 서비스 설명, 사용 엔드포인트, 예시 URL을 한 번에 반환합니다.
- `GET /api/public/briefing?symbol=BTC&timeframe=1h`
  - 바이낸스 메인 시세, 빗썸 비교가, 호가/매물벽 요약, 매크로/뉴스 요약, 기본 차트 주석을 JSON으로 반환합니다.
- `GET /api/public/briefing?symbol=BTC&timeframe=1h&format=text`
  - 같은 내용을 ChatGPT 웹에 붙여넣기 쉬운 텍스트로 반환합니다.
- `GET /api/public/snapshot?symbol=BTC&timeframe=1h&concise=true`
  - 메인 시세에 매크로 필드까지 붙인 스냅샷을 반환합니다.
- `GET /api/public/direction?timeframe=1h&limit=5&universe=10`
  - 상위 거래량 코인을 훑어서 다중 타임프레임 변화율, 호가 불균형, 프리미엄, 펀딩, 거래대금을 합산한 방향성 후보를 반환합니다.
- `GET /api/public/sector-flow?timeframe=1h&universe=24`
  - 상위 거래대금 코인을 섹터별로 묶어서 어느 섹터에 유동성이 붙거나 빠지는지 집계합니다.
- `GET /api/public/opportunity?timeframe=1h&universe=24&limit=6`
  - 섹터 상대강도, 호가 불균형, 점수 변화량을 합쳐서 추세 추종 후보 / 반등 감시 후보 / 회피 후보를 반환합니다.
- `GET /api/public/direction/history?symbol=BTC&timeframe=1h&limit=24`
  - 저장된 방향 점수와 신뢰도 이력을 반환합니다.
- `GET /api/public/liquidity/history?symbol=BTC&timeframe=1h&limit=48`
  - 저장된 호가 요약 이력(스프레드, 불균형, bid/ask wall, support/resistance wall)을 반환합니다.
- `GET /api/public/overlay?symbol=BTC&timeframe=1h&candles=96`
  - AI 오버레이 구간 지표, 신호, 바이어스를 JSON으로 반환합니다.
  - `start`, `end`를 넘기면 해당 구간 기준으로 계산하고, 없으면 타임프레임별 기본 visible 범위를 사용합니다.
  - `indicators`로 `range,midpoint,vwap,trend,breakout,pressure,volume` 중 필요한 항목만 선택할 수 있습니다.

예:

```text
https://<your-domain>/api/public
https://<your-domain>/api/public/readme
https://<your-domain>/api/public/info
https://<your-domain>/api/public/briefing?symbol=BTC&timeframe=1h
https://<your-domain>/api/public/briefing?symbol=BTC&timeframe=1h&format=text
https://<your-domain>/api/public/snapshot?symbol=BTC&timeframe=1h&concise=true
https://<your-domain>/api/public/direction?timeframe=1h&limit=5&universe=10
https://<your-domain>/api/public/sector-flow?timeframe=1h&universe=24
https://<your-domain>/api/public/opportunity?timeframe=1h&universe=24&limit=6
https://<your-domain>/api/public/direction/history?symbol=BTC&timeframe=1h&limit=24
https://<your-domain>/api/public/liquidity/history?symbol=BTC&timeframe=1h&limit=48
https://<your-domain>/api/public/overlay?symbol=BTC&timeframe=1h&candles=96
```

브리핑 최상단에는 외부 AI가 바로 쓰기 쉽게 다음 같은 평탄화 키가 함께 포함됩니다.

- `price`
- `bithumb_price`
- `premium`
- `spread_usdt`
- `depth_imbalance_pct`
- `wall_pressure`
- `bid_wall_price`
- `ask_wall_price`
- `btc_dominance`
- `total_marketcap_usd`
- `news_summary`

### Public API 사용법 (요약)

- 기본 엔드포인트
  - `GET /api/public/readme`
    - README의 공개 API 안내 텍스트를 그대로 반환
  - `GET /api/public/info`
    - 외부 툴 연결용 서비스 설명, 대표 엔드포인트, 예시 URL 반환
  - `GET /api/public/market?symbol=BTC&timeframe=1h&concise=true`
    - 기본은 간결 응답(캔들 24개, 최근 거래 20개, 호가 깊이 20)
    - 쿼리 파라미터: `concise`(true|false), `candles`, `trades`, `orderbookDepth`, `start`, `end`(ISO 또는 epoch ms)
  - `GET /api/public/snapshot?symbol=BTC&timeframe=1h&concise=true`
    - market 응답에 매크로 필드와 편의 필드를 더해 바로 소비하기 쉬운 스냅샷 반환
  - `GET /api/public/liquidity?symbol=BTC&orderbookDepth=10`
    - 호가/유동성(스프레드, 매물벽, bids/asks 배열 제한)
  - `GET /api/public/liquidity/history?symbol=BTC&timeframe=1h&limit=48`
    - 저장된 호가/매물벽 요약 이력 조회
  - `GET /api/public/structure?symbol=BTC&recent=12`
    - 다중 타임프레임 요약 및 차트 주석(최근 캔들 수 제한)
  - `GET /api/public/direction?timeframe=1h&limit=5&universe=10`
    - 상위 코인 후보, 하위 후보, 시장 breadth, BTC/ETH dominance, 신뢰도, 점수 변화량
  - `GET /api/public/sector-flow?timeframe=1h&universe=24`
    - 섹터별 평균 점수, 평균 호가 불균형, 총 거래대금, 대표 강세/약세 종목 조회
  - `GET /api/public/opportunity?timeframe=1h&universe=24&limit=6`
    - 추세 추종 후보, 반등 감시 후보, 회피 후보 조회
  - `GET /api/public/direction/history?symbol=BTC&timeframe=1h&limit=24`
    - 저장된 direction/trust 이력 조회
  - `GET /api/public/overlay?symbol=BTC&timeframe=1h&candles=96`
    - AI 오버레이 구간 지표, 신호, 바이어스 조회
    - 쿼리 파라미터: `start`, `end`(ISO 또는 epoch ms), `candles`, `indicators`

- 응답에 항상 포함되는 유용한 필드
  - `serverTime` (epoch seconds): 응답 시점 기준 타임스탬프(지연 계산에 사용)
  - `fundingRate` (number|null): 선물 펀딩비(가능하면 포함)
  - `openInterest` (number|null): 선물 미체결약정(OI)
    - `btc_dominance` (number|null): 글로벌 시총 기준 BTC 도미넌스(%) — 이제 `/api/public/market`에도 포함됩니다
    - `eth_dominance` (number|null): ETH 도미넌스(%)
    - `total_marketcap_usd` (number|null): 전체 시가총액(USD)

- 레버리지 흐름 간단 해석(외부에서 빠르게 읽는 법)
  - 가격 상승 + `openInterest` 상승 => 추세 강화 (레버리지 유입)
  - 가격 상승 + `openInterest` 감소 => 숏커버(공매수 청산 또는 숏 포지션 축소)
  - `fundingRate`는 양수면 롱 포지션이 숏보다 비용을 지불하는 구조(롱 쏠림), 음수면 숏 쏠림

- 사용 예시 (curl)

```bash
curl 'http://localhost:3000/api/public/readme'

curl 'http://localhost:3000/api/public/info'

curl 'http://localhost:3000/api/public/market?symbol=BTC&timeframe=1h&candles=12&trades=10&orderbookDepth=10'

curl 'http://localhost:3000/api/public/snapshot?symbol=BTC&timeframe=1h&concise=true'

curl 'http://localhost:3000/api/public/liquidity?symbol=BTC&orderbookDepth=10'

curl 'http://localhost:3000/api/public/liquidity/history?symbol=BTC&timeframe=1h&limit=48'

curl 'http://localhost:3000/api/public/structure?symbol=BTC&recent=6'

curl 'http://localhost:3000/api/public/sector-flow?timeframe=1h&universe=24'

curl 'http://localhost:3000/api/public/opportunity?timeframe=1h&universe=24&limit=6'

curl 'http://localhost:3000/api/public/overlay?symbol=BTC&timeframe=1h&candles=96'

curl 'http://localhost:3000/api/public/overlay?symbol=BTC&timeframe=1h&start=2026-03-08T00:00:00Z&end=2026-03-08T08:00:00Z&indicators=range,midpoint,vwap,breakout,pressure,volume'
```

- 빠른 파싱 팁
  - `serverTime`로 응답 지연(응답 시간 - 서버Time)을 계산해 데이터를 신선도 검사
  - `fundingRate`/`openInterest`가 `null`이면 해당 심볼에서 선물 데이터가 제공되지 않음
  - 큰 페이로드가 문제면 `concise=true` 또는 `candles`/`trades`/`orderbookDepth`를 낮춰 요청
  - `direction.storage.enabled`가 `true`여도 `persistedSymbols`가 `0`일 수 있음
    - 이 경우 DB는 연결되어 있지만 `market_direction_history` 테이블이 아직 생성되지 않았거나, 최근 5분 이내 동일 심볼이 이미 저장된 상태입니다.

### Direction Scanner 필드

- `leaders[]`
  - `score`: 방향성 종합 점수
  - `bias`: 상승 우위 / 하락 우위 / 중립
  - `trustScore`: 거래대금, 호가 두께, 파생 데이터, 국내 비교 가능 여부를 반영한 신뢰도 점수
  - `trustReasons[]`: 신뢰도 점수의 근거
  - `scoreDelta`, `trustDelta`: 직전 저장값 대비 변화량
- `breadth`
  - `upCount`, `downCount`, `neutralCount`, `tone`
- `storage`
  - `enabled`: DB 연결 여부
  - `persistedSymbols`: 이번 스캔에서 새로 저장된 심볼 수

### 저장 이력 활성화

`/api/public/direction/history`, `/api/public/liquidity/history`와 저장 추적은 DB 테이블이 있어야 제대로 동작합니다.

```bash
npm run db:init
```

테이블이 없으면 direction/liquidity 엔드포인트 자체는 계속 응답하지만, 저장 관련 응답은 비활성 또는 빈 배열로 폴백됩니다.

호가 히스토리는 현재 `briefing`, `market`, `snapshot`, `liquidity` 공개 호출 시점의 요약값을 저장합니다.

- 저장되는 핵심 필드
  - `imbalancePct`
  - `wallPressure`
  - `bidWallPrice`, `bidWallValueUsdt`
  - `askWallPrice`, `askWallValueUsdt`
  - `supportWallPrice`, `resistanceWallPrice`
- 따라서 과거에 `65k 부근 지지 벽이 반복적으로 생겼는지` 같은 질문을 추적할 수 있습니다.

이 섹션을 README에 추가하여 외부 툴(예: GPT 플러그인, 파이프라인)에서 바로 호출해 사용할 수 있도록 했습니다.

### 브리핑 자동 실행 규약

사용자가 `브리핑해줘`, `BTC 브리핑`, `지금 시장 어때`, `지금 들어가도 돼?`처럼 짧게 요청해도, 아래 규칙으로 공개 엔드포인트와 공개 웹 정보를 함께 확인한 뒤 바로 브리핑합니다.

- 기본 가정
  - 심볼 미지정: 시장 전체 브리핑이면 `BTC`를 기준축으로 보고 `ETH`와 시장 breadth를 함께 확인
  - 타임프레임 미지정: 기본 `1h`
  - 시장 범위 미지정: `direction`, `sector-flow`, `opportunity`는 기본 `universe=24`
  - 저장 이력 확인: `direction.history`는 기본 `limit=24`, `liquidity.history`는 기본 `limit=48`

- 최소 수집 순서
  1. `/api/public/briefing?symbol=<SYMBOL>&timeframe=<TF>`로 종합 브리핑 본문 확보
  2. `/api/public/liquidity?symbol=<SYMBOL>&timeframe=<TF>`로 현재 호가 압력, 벽 위치, 불균형 확인
  3. `/api/public/liquidity/history?symbol=<SYMBOL>&timeframe=<TF>&limit=48`로 최근 호가 구조 반복 여부 확인
  4. `/api/public/direction?timeframe=<TF>&limit=5&universe=24`로 시장 breadth와 리더/약세 후보 확인
  5. `/api/public/sector-flow?timeframe=<TF>&universe=24`와 `/api/public/opportunity?timeframe=<TF>&universe=24&limit=6`로 섹터 흐름과 후보군 확인
  6. 필요 시 `/api/public/overlay?symbol=<SYMBOL>&timeframe=<TF>&candles=96`로 범위, VWAP, breakout, pressure 신호 확인
  7. 공개 웹 검색으로 뉴스, ETF 흐름, 매크로 이벤트, 위험자산 분위기 보강

- 웹 검색으로 같이 볼 항목
  - 즉시성 정보: 거래소 장애, 규제, 해킹, ETF 유입/유출, 대형 청산, 급격한 risk-on/risk-off 뉴스
  - 배경 정보: 당일 거시 이벤트 일정, 미국 지수 선물 분위기, 달러/금리 관련 기사, 시장 전반 뉴스 톤
  - 원칙: 공개 웹에서 확인 가능한 내용만 사용하고, 초단위 유료 플로우는 없는 것으로 간주

- 추가 질문 없이 처리하는 범위
  - `브리핑해줘`: BTC 기준 시장 브리핑으로 처리
  - `ETH 브리핑`: ETH 단일 심볼 브리핑으로 처리
  - `지금 시장 브리핑`: BTC 기준 + 시장 breadth + 섹터 흐름까지 포함
  - `지금 들어가도 돼?`: 단순 가격 보고가 아니라 진입 적합성 브리핑으로 처리
  - 아래 정보가 빠져도 재질문 없이 진행: 거래소, 국가, 차트 종류, 지표 종류

- 꼭 다시 물어봐야 하는 경우
  - 서로 다른 심볼을 동시에 비교해달라고 했는데 우선순위가 불명확한 경우
  - 현물/선물 관점이 해석에 직접 영향을 주는데 요청이 모순되는 경우
  - 특정 시간 구간(`어제 CPI 직후만`)처럼 범위가 결과를 바꾸는데 누락된 경우

- 권장 브리핑 출력 양식
  1. 결론: 지금 자리가 `진입 가능 / 확인 필요 / 보류` 중 어디인지 한두 문장으로 정리
  2. 가격 위치: 현재가가 예상 구간, 지지/저항, 확인 구간 중 어디에 있는지
  3. 호가/유동성: `imbalancePct`, `wallPressure`, bid/ask wall, 최근 liquidity history 반복 여부
  4. 시장 상태: `direction`, `sector-flow`, `opportunity` 기준으로 시장 breadth와 주도 섹터 정리
  5. 글로벌 유동성/거시: 공개 웹 검색으로 확인한 risk-on/risk-off, ETF, 주요 이벤트 요약
  6. 뉴스: 지금 반영해야 할 속보성 재료와 배경 재료 구분
  7. 시나리오: 상승 지속 조건, 보류 조건, 무효화 조건을 짧게 제시

- 짧은 브리핑 예시 템플릿

```text
[결론]
- 지금은 확인 필요. 가격은 확인 구간에 왔지만 호가 구조와 외부 재료 확인이 더 필요.

[가격 위치]
- 현재가: ...
- 예상 구간 대비 위치: ...

[호가/유동성]
- imbalancePct: ...
- wallPressure: ...
- bid/ask wall: ...
- 최근 히스토리 변화: ...

[시장 상태]
- breadth/tone: ...
- 강한 섹터: ...
- 회피 후보: ...

[글로벌/뉴스]
- ETF/매크로/리스크온오프: ...
- 즉시 확인할 뉴스: ...

[판단]
- 진입 가능 조건: ...
- 보류 이유: ...
- 다음 체크 시점: ...
```

- 시장평가 체크리스트
  - `시장 신뢰도`
    - BTC가 시장을 리드하는지, 아니면 혼자만 버티는지
    - `direction.breadth.tone`이 `risk-off / balanced / risk-on` 중 어디인지
    - ETF 흐름이 최근 2~3거래일 기준으로 순유입 회복인지, 재약화인지
    - 유가, 물가, 금리, 지정학 뉴스가 위험자산에 우호적인지
  - `자리 신뢰도`
    - 현재가가 지지/저항 어디에 있는지
    - 바로 위 매물대가 너무 가까운지
    - `imbalancePct`, `wallPressure`가 가격 방향과 일치하는지
    - 최근 liquidity history에서 같은 방향이 반복되는지
  - `실행 가능성`
    - 실패 시 손절이 짧고 명확한지
    - 성공 시 리워드가 저항 거리 대비 충분한지
    - 뉴스 한 줄에 무너질 자리인지, 구조적으로 버틸 자리인지

- 진입 허용 기준
  - 아래 중 다수가 맞으면 `진입 가능`으로 분류
  - BTC 또는 주도 코인이 시장보다 상대적으로 강함
  - breadth가 최소 `balanced` 이상이고 급격한 `risk-off`가 아님
  - 호가가 `balanced` 이상 또는 `bid-heavy`로 유지됨
  - 위 주요 저항까지 최소한 의미 있는 리워드가 남아 있음
  - 외부 뉴스/거시가 즉시 악화 중이 아님

- 진입 금지 기준
  - 아래 중 2개 이상이면 `보류` 또는 `금지`로 분류
  - 가격은 좋아 보여도 바로 위 저항이 너무 가까움
  - 호가가 `ask-heavy`인데 가격만 억지로 버티고 있음
  - breadth가 `risk-off`거나 ETF 흐름이 최근 재악화 중임
  - 유가/물가/정책 뉴스가 당장 변동성을 키우는 구간임
  - 표면 기대수익은 양수지만 실제 체결과 손절 구조가 나쁨

- 해석 원칙
  - `짧게 먹는 자리`와 `크게 먹는 자리`를 구분해서 평가
  - 표면 기대값보다 `시장 신뢰도 할인`을 먼저 반영
  - 확신이 낮으면 방향 예측보다 `진입 금지` 판단을 우선

- 요약 원칙
  - 가능하면 한 번의 브리핑 안에서 `현재 상태`, `근거`, `행동 조건`을 같이 제시
  - 데이터가 비어 있으면 `없음` 또는 `미지원`으로 표시하고 브리핑 자체는 계속 진행
  - 사용자가 별도 형식을 요구하지 않으면 설명형 한국어 브리핑을 우선

## 메모

- 로컬 기준 거래소는 `빗썸`
- 글로벌 기준 거래소는 현재 `바이낸스`
- 구조상 글로벌 거래소는 나중에 `OKX`, `Bybit` 등으로 확장하기 쉽게 분리해둘 수 있습니다.
- `market` 모듈은 필수고, 나머지 모듈은 실패하거나 입력이 비어도 전체 분석이 죽지 않도록 처리합니다.
