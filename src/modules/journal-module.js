function trimValue(value) {
  return String(value || "").trim();
}

module.exports = {
  id: "journal",
  label: "세션 메모",
  description: "현재 관심사, 관찰 질문, 당일 메모를 AI에 전달합니다.",
  required: false,
  defaultEnabled: true,
  async collect(input) {
    const journal = {
      note: trimValue(input.journal?.note),
      focusQuestion: trimValue(input.journal?.focusQuestion)
    };

    if (!journal.note && !journal.focusQuestion) {
      return {
        skipped: true,
        reason: "세션 메모 입력이 없습니다."
      };
    }

    return {
      summary: "현재 세션 메모와 확인하고 싶은 질문을 포함합니다.",
      data: journal
    };
  },
  formatForPrompt(journal) {
    return `
[세션 메모]
- 메모: ${journal.note || "미입력"}
- 집중 질문: ${journal.focusQuestion || "미입력"}
`.trim();
  }
};
