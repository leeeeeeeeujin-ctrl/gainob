// 로컬 스토리지 관리
export const Store = (() => {
  const LS = {
    clientId: 'RSK_CLIENT_ID',
    name: 'RSK_NAME',
    roster: 'RSK_ROSTER',
    apiKeys: 'RSK_API_KEYS',
    apiSecrets: 'RSK_API_SECRETS',
    prompts: 'RSK_PROMPTS',
    myPromptId: 'RSK_MY_PROMPT_ID',
  };

  const state = {
    clientId: localStorage.getItem(LS.clientId) || (() => {
      const id = 'c-' + (crypto.randomUUID?.() || Date.now());
      localStorage.setItem(LS.clientId, id);
      return id;
    })(),
    name: localStorage.getItem(LS.name) || 'Player',
    roster: loadJSON(LS.roster, []),
    apiKeys: loadJSON(LS.apiKeys, []),
    spectators: [],
  };

  function loadJSON(key, defaultValue) {
    try {
      return JSON.parse(localStorage.getItem(key) || '');
    } catch {
      return defaultValue;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // 이름 설정
  function setName(value) {
    state.name = value || 'Player';
    localStorage.setItem(LS.name, state.name);
  }

  // 캐릭터 관리
  function addChar(character) {
    const list = [...state.roster, character];
    state.roster = list;
    save(LS.roster, list);
  }

  function removeChar(id) {
    state.roster = state.roster.filter(x => x.id !== id);
    save(LS.roster, state.roster);
  }

  // API 키 관리
  function addApiKey(label, keyPlain) {
    const id = crypto.randomUUID?.() || ('k-' + Date.now());
    const last4 = keyPlain.slice(-4);
    const masked = keyPlain.length > 8 ? 
      keyPlain.slice(0, 4) + '…' + last4 : 
      '••••' + last4;
    
    const item = { id, label, keyMasked: masked, last4 };
    const list = [...state.apiKeys, item];
    state.apiKeys = list;
    save(LS.apiKeys, list);
    
    const secrets = loadJSON(LS.apiSecrets, {});
    secrets[id] = keyPlain;
    save(LS.apiSecrets, secrets);
    
    return item;
  }

  function removeApiKey(id) {
    state.apiKeys = state.apiKeys.filter(k => k.id !== id);
    save(LS.apiKeys, state.apiKeys);
    
    const secrets = loadJSON(LS.apiSecrets, {});
    delete secrets[id];
    save(LS.apiSecrets, secrets);
  }

  function getApiSecret(id) {
    const secrets = loadJSON(LS.apiSecrets, {});
    return secrets[id] || '';
  }

  // 프롬프트 관리
  // 프롬프트 관리
  // ===== Prompts V2 Storage (byId + order) =====
  const PROMPTS_V2_KEY = 'RSK_PROMPTS_V2';
  const PROMPTS_V1_KEY = 'RSK_PROMPTS';          // 기존 배열 저장 키
  const MY_PROMPT_ID_KEY = 'RSK_MY_PROMPT_ID';

  function _uuid() {
    return (crypto?.randomUUID?.() || ('p-' + Date.now() + '-' + Math.random()));
  }

  // V2 로드 (없으면 V1 → V2 마이그레이션)
  function loadPromptsV2() {
    const raw = localStorage.getItem(PROMPTS_V2_KEY);
    if (raw) {
      try {
        const v = JSON.parse(raw);
        if (v && v.version === 2 && v.byId && v.order) return v;
      } catch (_) {}
    }
    // 없거나 손상 → V1에서 마이그레이션
    const arr = loadPromptsV1Array(); // 안전 로드
    const byId = {};
    const order = [];
    for (const p of arr) {
      let id = String(p?.id || '');
      if (!id || byId[id]) id = _uuid();
      byId[id] = { id, label: p?.label || p?.id || '프롬프트', text: p?.text || '' };
      order.push(id);
    }
    const v2 = { version: 2, byId, order };
    localStorage.setItem(PROMPTS_V2_KEY, JSON.stringify(v2));
    return v2;
  }

  // V1 배열 로더(마이그레이션용)
  function loadPromptsV1Array() {
    const raw = localStorage.getItem(PROMPTS_V1_KEY);
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object') return [v]; // 과거 단일 객체 저장 방지
    } catch(_) {}
    return [];
  }

  // 배열처럼 사용하기 위한 뷰
  function promptList() {
    const { byId, order } = loadPromptsV2();
    return order.map(id => byId[id]).filter(Boolean);
  }

  // 단일 저장(전체 덮기) — 배열을 받아 V2 구조로 저장
  function savePromptList(list) {
    const byId = {};
    const order = [];
    for (const p0 of Array.isArray(list) ? list : []) {
      let id = String(p0?.id || '');
      if (!id || byId[id]) id = _uuid();
      const p = { id, label: p0?.label || '프롬프트', text: p0?.text || '' };
      byId[id] = p;
      order.push(id);
    }
    const v2 = { version: 2, byId, order };
    localStorage.setItem(PROMPTS_V2_KEY, JSON.stringify(v2));
    _fixActiveId();
    return promptList();
  }

  // 항목 API (편집기에서 쓰기 좋게)
  function addPrompt(p) {
    const v2 = loadPromptsV2();
    let id = String(p?.id || '');
    if (!id || v2.byId[id]) id = _uuid();
    v2.byId[id] = { id, label: p?.label || '프롬프트', text: p?.text || '' };
    v2.order.push(id);
    localStorage.setItem(PROMPTS_V2_KEY, JSON.stringify(v2));
    _fixActiveId();
    return id;
  }

  function updatePrompt(id, patch) {
    const v2 = loadPromptsV2();
    const cur = v2.byId[id];
    if (!cur) return;
    v2.byId[id] = { ...cur, ...patch, id }; // id 고정
    localStorage.setItem(PROMPTS_V2_KEY, JSON.stringify(v2));
  }

  function removePrompt(id) {
    const v2 = loadPromptsV2();
    if (!v2.byId[id]) return;
    delete v2.byId[id];
    v2.order = v2.order.filter(x => x !== id);
    localStorage.setItem(PROMPTS_V2_KEY, JSON.stringify(v2));
    const cur = localStorage.getItem(MY_PROMPT_ID_KEY);
    if (cur === id) _fixActiveId();
  }

  function getActivePromptId() {
    return localStorage.getItem(MY_PROMPT_ID_KEY) || '';
  }

  function setActivePromptId(id) {
    const v2 = loadPromptsV2();
    if (id && v2.byId[id]) {
      localStorage.setItem(MY_PROMPT_ID_KEY, id);
    } else {
      _fixActiveId();
    }
  }

  function _fixActiveId() {
    const v2 = loadPromptsV2();
    const first = v2.order[0] || '';
    if (first) localStorage.setItem(MY_PROMPT_ID_KEY, first);
    else localStorage.removeItem(MY_PROMPT_ID_KEY);
  }

  // ─── 하위호환 alias ───
  const loadPrompts = promptList;      // 배열 반환
  const savePrompts = savePromptList;  // 배열 저장

  return {
    LS,
    state,
    setName,
    addChar,
    removeChar,
    addApiKey,
    removeApiKey,
    getApiSecret,

    // 프롬프트 API (신규 + 하위호환)
    loadPrompts,            // 배열 뷰
    savePrompts,            // 배열 저장(전체)
    addPrompt,
    updatePrompt,
    removePrompt,
    getActivePromptId,
    setActivePromptId
  };
})();
