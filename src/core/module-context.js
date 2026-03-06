function sanitizeModuleIds(requestedIds, availableModules) {
  const defaultIds = availableModules.filter((module) => module.defaultEnabled).map((module) => module.id);

  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    return defaultIds;
  }

  const knownIds = new Set(availableModules.map((module) => module.id));
  const selectedIds = Array.from(new Set(requestedIds.filter((id) => knownIds.has(id))));

  for (const module of availableModules) {
    if (module.required && !selectedIds.includes(module.id)) {
      selectedIds.unshift(module.id);
    }
  }

  return selectedIds;
}

function createModuleContext(modules) {
  const registry = new Map(modules.map((module) => [module.id, module]));

  function listModules() {
    return modules.map(({ id, label, description, required, defaultEnabled }) => ({
      id,
      label,
      description,
      required,
      defaultEnabled
    }));
  }

  async function collect(input) {
    const selectedIds = sanitizeModuleIds(input.moduleIds, modules);
    const selectedModules = selectedIds.map((id) => registry.get(id)).filter(Boolean);

    const results = await Promise.all(
      selectedModules.map(async (module) => {
        try {
          const collected = await module.collect(input);

          if (collected?.skipped) {
            return {
              id: module.id,
              label: module.label,
              status: "skipped",
              summary: collected.summary || collected.reason || "입력 데이터가 없어 건너뛰었습니다.",
              error: null,
              data: null
            };
          }

          return {
            id: module.id,
            label: module.label,
            status: "ok",
            summary: collected.summary || "",
            error: null,
            data: collected.data ?? null
          };
        } catch (error) {
          if (module.required) {
            throw new Error(`${module.label}: ${error.message}`);
          }

          return {
            id: module.id,
            label: module.label,
            status: "error",
            summary: "",
            error: error.message,
            data: null
          };
        }
      })
    );

    return {
      fetchedAt: new Date().toISOString(),
      symbol: input.symbol || null,
      modules: results
    };
  }

  function buildPromptSections(context) {
    return context.modules
      .map((result) => {
        const module = registry.get(result.id);

        if (!module) {
          return null;
        }

        if (result.status === "ok") {
          return module.formatForPrompt(result.data);
        }

        if (result.status === "skipped") {
          return `[${module.label}]\n- 상태: skipped\n- 이유: ${result.summary}`;
        }

        return `[${module.label}]\n- 상태: error\n- 오류: ${result.error}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return {
    listModules,
    collect,
    buildPromptSections
  };
}

module.exports = {
  createModuleContext
};
