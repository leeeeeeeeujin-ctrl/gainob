function buildPrompt(context, promptSections) {
  const moduleSummary = context.modules
    .map((module) => `- ${module.label}: ${module.status}${module.error ? ` (${module.error})` : ""}`)
    .join("\n");

  return `
당신은 사용자의 개인 분석 AI다.
시장 데이터만 기계적으로 요약하지 말고, 개인 프로필과 세션 메모가 있으면 함께 반영하라.
확신이 없는 내용은 단정하지 말고, 관찰과 가설을 분리해서 표현하라.
반드시 아래 형식으로 한국어로 답하라.

1. 한 줄 요약
2. 지금 보이는 핵심 관찰 3개
3. 사용자 관점에서 체크할 포인트 3개
4. 주의할 리스크 2개
5. 다음 행동 후보 2개

답변 마지막에는 반드시 `[CHART_ANNOTATIONS_JSON]` 헤더를 쓰고, 그 아래 한 줄 JSON 객체를 넣어라.
JSON 형식:
{"annotations":[{"type":"line|zone|marker","label":"문구","reason":"근거","color":"#hex 또는 rgba","from":{"time":1710000000000,"price":1},"to":{"time":1710003600000,"price":1},"startTime":1710000000000,"endTime":1710003600000,"minPrice":1,"maxPrice":2,"time":1710000000000,"price":1}]}
불확실하면 annotations는 빈 배열로 반환하라.

[분석 메타]
- 종목: ${context.symbol || "미지정"}
- 수집 시각: ${context.fetchedAt}
- 모듈 상태:
${moduleSummary}

[수집 컨텍스트]
${promptSections}
`.trim();
}

function extractChartAnnotations(analysisText) {
  const marker = "[CHART_ANNOTATIONS_JSON]";
  const markerIndex = analysisText.indexOf(marker);

  if (markerIndex === -1) {
    return {
      analysis: analysisText.trim(),
      annotations: []
    };
  }

  const summaryText = analysisText.slice(0, markerIndex).trim();
  const jsonText = analysisText.slice(markerIndex + marker.length).trim().split("\n")[0].trim();

  try {
    const payload = JSON.parse(jsonText);

    return {
      analysis: summaryText,
      annotations: Array.isArray(payload.annotations) ? payload.annotations : []
    };
  } catch (_error) {
    return {
      analysis: summaryText || analysisText.trim(),
      annotations: []
    };
  }
}

async function analyzeContext(context, promptSections) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      analysis:
        "OPENAI_API_KEY가 설정되지 않았습니다. 현재는 모듈 수집과 시세 비교까지만 동작하며 AI 분석은 비활성화되어 있습니다.",
      annotations: []
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(context, promptSections)
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const parsed = extractChartAnnotations(payload.output_text || "");

  return {
    ok: true,
    analysis: parsed.analysis,
    annotations: parsed.annotations
  };
}

module.exports = {
  analyzeContext
};
