  // 슬롯 역할 변경
// API 통신 모듈
export const API = (() => {
  const base = location.origin;

  async function request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  }

  return {
    // 방 목록 조회
    listRooms: () => request('GET', base + '/api/rooms'),
    
    // 방 생성
    createRoom: (params) => request('POST', base + '/api/rooms', params),
    
    // 방 상세 조회
    getRoom: (id) => request('GET', base + `/api/rooms/${id}`),
    
    // 슬롯 점유
    claim: (id, body) => request('POST', base + `/api/rooms/${id}/claim`, body),
    
    // 슬롯 해제
    release: (id, body) => request('POST', base + `/api/rooms/${id}/release`, body),
    
    // 준비 상태 토글
    ready: (id, body) => request('POST', base + `/api/rooms/${id}/ready`, body),
    
    // 플레이어 추방
    kick: (id, body) => request('POST', base + `/api/rooms/${id}/kick`, body),
    
    // AI 모드 변경
    mode: (id, body) => request('POST', base + `/api/rooms/${id}/mode`, body),
    
    // 발화자 지정
    speaker: (id, body) => request('POST', base + `/api/rooms/${id}/speaker`, body),
    
    // 게임 시작
    start: (id, body) => request('POST', base + `/api/rooms/${id}/start`, body),
    runPrompt: (id, body) => request('POST', base + `/api/rooms/${id}/run-prompt`, body),
    
    // 파일 업로드
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(base + '/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response.json();
    }
  };
})();
