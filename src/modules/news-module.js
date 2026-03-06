const { getIntelligenceSnapshot } = require("../intelligence");

function getSharedIntelligence(input) {
  if (!input.__intelligencePromise) {
    input.__intelligencePromise = getIntelligenceSnapshot(input.symbol, input.label);
  }

  return input.__intelligencePromise;
}

module.exports = {
  id: "news",
  label: "뉴스 통계",
  description: "코인 관련 최근 뉴스의 건수, 톤, 주요 출처를 요약합니다.",
  required: false,
  defaultEnabled: true,
  async collect(input) {
    const snapshot = await getSharedIntelligence(input);

    return {
      summary: `최근 뉴스 ${snapshot.newsStats.articleCount}건, 24시간 ${snapshot.newsStats.recent24hCount}건, 평균 톤 ${snapshot.newsStats.averageTone.toFixed(2)}`,
      data: {
        fetchedAt: snapshot.fetchedAt,
        newsStats: snapshot.newsStats
      }
    };
  },
  formatForPrompt(data) {
    return `
[뉴스 통계]
- 수집 시각: ${data.fetchedAt}
- 총 기사 수: ${data.newsStats.articleCount}
- 최근 24시간 기사 수: ${data.newsStats.recent24hCount}
- 최근 72시간 기사 수: ${data.newsStats.recent72hCount}
- 평균 톤: ${data.newsStats.averageTone}
- 최신 헤드라인: ${data.newsStats.latestHeadline || "없음"}
- 최신 기사 시각: ${data.newsStats.latestPublishedAt || "없음"}
- 주요 출처:
${data.newsStats.topDomains.map((item) => `  - ${item.domain}: ${item.count}건`).join("\n")}
`.trim();
  }
};
