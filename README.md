# Coin AI Briefing

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

권장 조회 순서:

1. `/api/public/direction`으로 시장 breadth와 상위/하위 후보를 확인합니다.
2. `/api/public/sector-flow`로 어떤 섹터에 상대강도가 붙는지 봅니다.
3. `/api/public/opportunity`로 추세 추종 후보, 반등 감시 후보, 회피 후보를 나눕니다.
4. 관심 심볼은 `/api/public/briefing`, `/api/public/liquidity`, `/api/public/overlay`로 상세 확인합니다.

- `GET /api/public`
  - 어떤 공개 엔드포인트가 있는지 설명 JSON을 반환합니다.
- `GET /api/public/briefing?symbol=BTC&timeframe=1h`
  - 바이낸스 메인 시세, 빗썸 비교가, 호가/매물벽 요약, 매크로/뉴스 요약, 기본 차트 주석을 JSON으로 반환합니다.
- `GET /api/public/briefing?symbol=BTC&timeframe=1h&format=text`
  - 같은 내용을 ChatGPT 웹에 붙여넣기 쉬운 텍스트로 반환합니다.
- `GET /api/public/direction?timeframe=1h&limit=5&universe=10`
  - 상위 거래량 코인을 훑어서 다중 타임프레임 변화율, 호가 불균형, 프리미엄, 펀딩, 거래대금을 합산한 방향성 후보를 반환합니다.
- `GET /api/public/sector-flow?timeframe=1h&universe=24`
  - 상위 거래대금 코인을 섹터별로 묶어서 어느 섹터에 유동성이 붙거나 빠지는지 집계합니다.
- `GET /api/public/opportunity?timeframe=1h&universe=24&limit=6`
  - 섹터 상대강도, 호가 불균형, 점수 변화량을 합쳐서 추세 추종 후보 / 반등 감시 후보 / 회피 후보를 반환합니다.
- `GET /api/public/direction/history?symbol=BTC&timeframe=1h&limit=24`
  - 저장된 방향 점수와 신뢰도 이력을 반환합니다.
- `GET /api/public/overlay?symbol=BTC&timeframe=1h&candles=96`
  - AI 오버레이 구간 지표, 신호, 바이어스를 JSON으로 반환합니다.
  - `start`, `end`를 넘기면 해당 구간 기준으로 계산하고, 없으면 타임프레임별 기본 visible 범위를 사용합니다.
  - `indicators`로 `range,midpoint,vwap,trend,breakout,pressure,volume` 중 필요한 항목만 선택할 수 있습니다.

예:

```text
https://<your-domain>/api/public
https://<your-domain>/api/public/briefing?symbol=BTC&timeframe=1h
https://<your-domain>/api/public/briefing?symbol=BTC&timeframe=1h&format=text
https://<your-domain>/api/public/direction?timeframe=1h&limit=5&universe=10
https://<your-domain>/api/public/sector-flow?timeframe=1h&universe=24
https://<your-domain>/api/public/opportunity?timeframe=1h&universe=24&limit=6
https://<your-domain>/api/public/direction/history?symbol=BTC&timeframe=1h&limit=24
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
  - `GET /api/public/market?symbol=BTC&timeframe=1h&concise=true`
    - 기본은 간결 응답(캔들 24개, 최근 거래 20개, 호가 깊이 20)
    - 쿼리 파라미터: `concise`(true|false), `candles`, `trades`, `orderbookDepth`, `start`, `end`(ISO 또는 epoch ms)
  - `GET /api/public/liquidity?symbol=BTC&orderbookDepth=10`
    - 호가/유동성(스프레드, 매물벽, bids/asks 배열 제한)
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
curl 'http://localhost:3000/api/public/market?symbol=BTC&timeframe=1h&candles=12&trades=10&orderbookDepth=10'

curl 'http://localhost:3000/api/public/liquidity?symbol=BTC&orderbookDepth=10'

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

`/api/public/direction/history`와 점수 변화량 추적은 DB 테이블이 있어야 제대로 동작합니다.

```bash
npm run db:init
```

테이블이 없으면 direction 엔드포인트 자체는 계속 응답하지만, 저장 수는 `0`, history 응답은 빈 배열로 폴백됩니다.

이 섹션을 README에 추가하여 외부 툴(예: GPT 플러그인, 파이프라인)에서 바로 호출해 사용할 수 있도록 했습니다.

## 메모

- 로컬 기준 거래소는 `빗썸`
- 글로벌 기준 거래소는 현재 `바이낸스`
- 구조상 글로벌 거래소는 나중에 `OKX`, `Bybit` 등으로 확장하기 쉽게 분리해둘 수 있습니다.
- `market` 모듈은 필수고, 나머지 모듈은 실패하거나 입력이 비어도 전체 분석이 죽지 않도록 처리합니다.
