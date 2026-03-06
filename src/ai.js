function buildPrompt(context, promptSections) {
  const moduleSummary = context.modules
    .map((module) => `- ${module.label}: ${module.status}${module.error ? ` (${module.error})` : ""}`)
    .join("\n");
  const manualAnnotations = Array.isArray(context.manualAnnotations) ? context.manualAnnotations : [];
  const drawingSection = manualAnnotations.length
    ? `\n\n[사용자 드로잉]\n${manualAnnotations
        .map((annotation) => {
          if (annotation.type === "line") {
            return `- line | ${annotation.label || "사용자 선"} | (${annotation.from?.time}, ${annotation.from?.price}) -> (${annotation.to?.time}, ${annotation.to?.price}) | ${annotation.reason || "사용자 표시"}`;
          }

          if (annotation.type === "zone") {
            return `- zone | ${annotation.label || "사용자 구간"} | ${annotation.startTime}~${annotation.endTime} | ${annotation.minPrice}~${annotation.maxPrice} | ${annotation.reason || "사용자 표시"}`;
          }

          return `- marker | ${annotation.label || "사용자 마커"} | (${annotation.time}, ${annotation.price}) | ${annotation.reason || "사용자 표시"}`;
        })
        .join("\n")}`
    : "";
  const chatHistory = Array.isArray(context.chatHistory) ? context.chatHistory : [];
  const chatSection = chatHistory.length
    ? `\n\n[최근 대화]\n${chatHistory
        .map((item) => `- ${item.sender === "ai" ? "AI" : "사용자"}: ${item.content || ""}`)
        .join("\n")}`
    : "";
  const userMessageSection = context.userMessage ? `\n\n[이번 요청]\n${context.userMessage}` : "";

  return `
당신은 사용자의 개인 분석 AI다.
시장 데이터만 기계적으로 요약하지 말고, 개인 프로필과 세션 메모가 있으면 함께 반영하라.
사용자가 직접 차트에 그린 드로잉이 있으면 그 의도를 우선 반영하라.
사용자의 최근 대화 맥락이 있으면 그것을 우선 이어받아 답하라.
질문이 단순 확인, 대화, 짧은 의견 요청이면 굳이 1~5 분석 포맷으로 과하게 답하지 말고 자연스럽게 대화하라.
사용자가 명시적으로 분석, 시나리오, 리스크, 행동 계획을 요구할 때만 구조화된 분석 포맷을 사용하라.
종목이 불분명하면 섣불리 단정하지 말고 현재 컨텍스트 종목을 기준으로 답하되, 필요하면 짧게 확인 질문 1개만 하라.
확신이 없는 내용은 단정하지 말고, 관찰과 가설을 분리해서 표현하라.
분석 요청일 때는 아래 형식을 우선 사용하라.

1. 한 줄 요약
2. 지금 보이는 핵심 관찰 3개
3. 사용자 관점에서 체크할 포인트 3개
4. 주의할 리스크 2개
5. 다음 행동 후보 2개

답변 마지막에는 반드시 [CHART_ANNOTATIONS_JSON] 헤더를 쓰고, 그 아래 한 줄 JSON 객체를 넣어라.
JSON 형식:
{"annotations":[{"type":"line|zone|marker","label":"문구","reason":"근거","color":"#hex 또는 rgba","from":{"time":1710000000000,"price":1},"to":{"time":1710003600000,"price":1},"startTime":1710000000000,"endTime":1710003600000,"minPrice":1,"maxPrice":2,"time":1710000000000,"price":1}]}
불확실하면 annotations는 빈 배열로 반환하라.

[분석 메타]
- 종목: ${context.symbol || "미지정"}
- 수집 시각: ${context.fetchedAt}
- 모듈 상태:
${moduleSummary}

[수집 컨텍스트]
${promptSections}${drawingSection}${chatSection}${userMessageSection}
`.trim();
}

function normalizeProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "openai" || normalized === "gpt") {
    return "openai";
  }

  if (normalized === "gemini" || normalized === "google") {
    return "gemini";
  }

  return "auto";
}

function getCredentialValue(primary, fallback) {
  return primary === undefined || primary === null || primary === "" ? fallback : primary;
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

function resolveProviderConfig(requestedProvider, credentials = {}, options = {}) {
  const provider = normalizeProvider(requestedProvider || credentials.provider || process.env.AI_PROVIDER);
  const useEnvFallback = options.useEnvFallback !== false;
  const openAiKey = useEnvFallback
    ? getCredentialValue(credentials.openAiKey, process.env.OPENAI_API_KEY)
    : credentials.openAiKey || "";
  const openAiModel = useEnvFallback
    ? getCredentialValue(credentials.openAiModel, process.env.OPENAI_MODEL) || "gpt-4.1-mini"
    : credentials.openAiModel || "gpt-4.1-mini";
  const geminiKey = useEnvFallback
    ? getCredentialValue(credentials.geminiKey, process.env.GEMINI_API_KEY)
    : credentials.geminiKey || "";
  const geminiModel = useEnvFallback
    ? getCredentialValue(credentials.geminiModel, process.env.GEMINI_MODEL) || "gemini-2.5-flash"
    : credentials.geminiModel || "gemini-2.5-flash";
  const hasOpenAi = Boolean(openAiKey);
  const hasGemini = Boolean(geminiKey);

  if (provider === "openai") {
    return hasOpenAi
      ? {
          provider: "openai",
          apiKey: openAiKey,
          model: openAiModel
        }
      : {
          provider: "openai",
          missing: "OPENAI_API_KEY"
        };
  }

  if (provider === "gemini") {
    return hasGemini
      ? {
          provider: "gemini",
          apiKey: geminiKey,
          model: geminiModel
        }
      : {
          provider: "gemini",
          missing: "GEMINI_API_KEY"
        };
  }

  if (hasOpenAi) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: openAiModel
    };
  }

  if (hasGemini) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: geminiModel
    };
  }

  return {
    provider: "auto",
    missing: "OPENAI_API_KEY 또는 GEMINI_API_KEY"
  };
}

async function requestOpenAi(prompt, apiKey, model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
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
  return payload.output_text || "";
}

function extractGeminiText(payload) {
  return (payload.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();
}

async function requestGemini(prompt, apiKey, model) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return extractGeminiText(payload);
}

async function analyzeContext(context, promptSections, options = {}) {
  const prompt = buildPrompt(context, promptSections);
  const config = resolveProviderConfig(options.provider, options.credentials, {
    useEnvFallback: options.useEnvFallback
  });

  if (!config.apiKey) {
    return {
      ok: false,
      provider: config.provider,
      model: null,
      analysis: `${config.missing}가 설정되지 않았습니다. 현재는 모듈 수집과 시세 비교까지만 동작하며 AI 분석은 비활성화되어 있습니다.`,
      annotations: []
    };
  }

  const outputText =
    config.provider === "gemini"
      ? await requestGemini(prompt, config.apiKey, config.model)
      : await requestOpenAi(prompt, config.apiKey, config.model);
  const parsed = extractChartAnnotations(outputText);

  return {
    ok: true,
    provider: config.provider,
    model: config.model,
    analysis: parsed.analysis,
    annotations: parsed.annotations
  };
}

module.exports = {
  analyzeContext
};
