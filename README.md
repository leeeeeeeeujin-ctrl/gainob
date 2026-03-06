# Coin AI Briefing

빗썸 시세를 국내 기준으로 보고, 바이낸스 가격을 글로벌 기준점으로 함께 비교한 뒤 개인 컨텍스트까지 묶어서 AI에 넘기는 개인용 웹앱입니다.

## 기능

- 빗썸 현재가, 24시간 변동률, 거래량, 호가 조회
- 바이낸스 현재가, 24시간 변동률, 거래량, 호가 조회
- 빗썸 `USDT/KRW`를 이용한 글로벌 가격 KRW 환산
- 빗썸 가격과 글로벌 환산 가격 차이 계산
- 최근 빗썸 1시간봉 24개 조회
- 개인 프로필, 리스크 원칙, 당일 메모를 로컬에 저장
- 모듈 단위로 컨텍스트를 수집하고 부분 실패를 분리
- OpenAI API로 시장 데이터 + 개인 컨텍스트 분석 요청

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
- API는 [api/[...route].js](d:/aass/gainob/api/[...route].js) 를 통해 서버리스 함수로 배포됩니다.
- 실제 Express 앱 엔트리는 [src/web-handler.js](d:/aass/gainob/src/web-handler.js) 입니다.
- 정적 파일은 `public/`에서 그대로 서빙됩니다.
- Vercel 환경변수에 `OPENAI_API_KEY`, 필요하면 `OPENAI_MODEL`을 넣으면 됩니다.

## 환경변수

- `OPENAI_API_KEY`: AI 분석 기능 사용 시 필요
- `OPENAI_MODEL`: 기본값 `gpt-4.1-mini`
- `PORT`: 기본값 `3000`

## 메모

- 로컬 기준 거래소는 `빗썸`
- 글로벌 기준 거래소는 현재 `바이낸스`
- 구조상 글로벌 거래소는 나중에 `OKX`, `Bybit` 등으로 확장하기 쉽게 분리해둘 수 있습니다.
- `market` 모듈은 필수고, 나머지 모듈은 실패하거나 입력이 비어도 전체 분석이 죽지 않도록 처리합니다.
