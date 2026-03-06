function trimValue(value) {
  return String(value || "").trim();
}

module.exports = {
  id: "profile",
  label: "개인 프로필",
  description: "사용자의 투자 성향, 관찰 포인트, 리스크 원칙을 AI에 전달합니다.",
  required: false,
  defaultEnabled: true,
  async collect(input) {
    const profile = {
      alias: trimValue(input.profile?.alias),
      style: trimValue(input.profile?.style),
      riskRule: trimValue(input.profile?.riskRule),
      watchItems: trimValue(input.profile?.watchItems)
    };

    if (!profile.alias && !profile.style && !profile.riskRule && !profile.watchItems) {
      return {
        skipped: true,
        reason: "개인 프로필 입력이 없습니다."
      };
    }

    return {
      summary: `${profile.alias || "사용자"}의 투자 성향과 리스크 기준을 반영합니다.`,
      data: profile
    };
  },
  formatForPrompt(profile) {
    return `
[개인 프로필]
- 사용자 별칭: ${profile.alias || "미입력"}
- 투자 스타일: ${profile.style || "미입력"}
- 리스크 원칙: ${profile.riskRule || "미입력"}
- 주시 항목: ${profile.watchItems || "미입력"}
`.trim();
  }
};
