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

[분석 메타]
- 종목: ${context.symbol || "미지정"}
- 수집 시각: ${context.fetchedAt}
- 모듈 상태:
${moduleSummary}

[수집 컨텍스트]
${promptSections}
`.trim();
}

async function analyzeContext(context, promptSections) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      analysis:
        "OPENAI_API_KEY가 설정되지 않았습니다. 현재는 모듈 수집과 시세 비교까지만 동작하며 AI 분석은 비활성화되어 있습니다."
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

  return {
    ok: true,
    analysis: payload.output_text || ""
  };
}

module.exports = {
  analyzeContext
};
